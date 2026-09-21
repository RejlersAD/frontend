import { test, expect } from '@playwright/test'
import { masterScheduleHarness } from '../fixtures/master-schedule.fixture.js'

test.setTimeout(60000)
const workspace = page => page.getByRole('region', { name: 'Master schedule workspace', exact: true })
const dialog = page => page.getByRole('dialog', { name: 'AI logic & sequence Proposal', exact: true })
const generate = page => workspace(page).getByRole('button', { name: 'Generate logic & sequence', exact: true })
const tasks = () => [
  { id: 'source-a', activity_code: 'ACT-10', title: 'Prepare equipment datasheet', discipline: 'mechanical',
    duration_days: 3, duration_unit: 'working_days', duration_source: 'source_document', duration_calendar_verified: false,
    planned_start_date: '2026-09-21', planned_finish_date: '2026-09-23', proposal_timing: true,
    calculated: false, total_float_days: null, is_critical: null, depends_on: [], dependency_details: [],
    schedule_rationale: 'The documented duration is retained; this start is proposed for review.' },
  { id: 'source-b', activity_code: 'ACT-20', title: 'Review equipment datasheet', discipline: 'mechanical',
    duration_days: 2, duration_unit: 'working_days', duration_source: 'proposed',
    planned_start_date: '2026-09-24', planned_finish_date: '2026-09-25', proposal_timing: true,
    calculated: false, total_float_days: null, is_critical: null, depends_on: ['source-a'],
    dependency_details: [{ task_id: 'source-a', type: 'FS', lag_days: 0, status: 'proposed', evidence_type: 'planning_inference', rationale: 'The datasheet must be prepared before its technical review.' }],
    dependency_rationales: { 'source-a': { status: 'proposed', evidence_type: 'planning_inference', rationale: 'The datasheet must be prepared before its technical review.' } } },
]

async function setup(page, { permitted = true, historical = false, providerFailure = false, staleOnce = false, canonical = true } = {}) {
  let active = false, attempt = 0, latestRevision = canonical ? 'source:71:3' : 4, previewCount = 0, providerConnected = false
  await page.setViewportSize({ width: 1700, height: 1050 })
  return masterScheduleHarness(page, {
    prepare(state) { state.sequenceCalls = []; state.connectionCalls = [] },
    decorateSnapshot(plan) {
      Object.assign(plan, { canonical_version: canonical, revision: latestRevision, viewing_history: historical, version_id: canonical ? 120 : null,
        ...(active ? { tasks: tasks() } : {}),
      })
      plan.permissions.can_edit = !canonical
      if (permitted) plan.permissions.can_propose_sequence = true
      return plan
    },
    async handleRequest({ path, route, state, reply }) {
      if (path.endsWith('/project-setup/ai-settings/')) {
        if (route.request().method() === 'POST') { providerConnected = true; state.connectionCalls.push(route.request().postDataJSON()) }
        await reply(route, { ai_available: providerConnected, ai_settings: { key_configured: providerConnected, storage_available: true, model: 'gpt-4o' } })
        return true
      }
      if (path.endsWith('/simple-plan/propose-intelligent-sequence/')) {
        state.sequenceCalls.push({ action: 'preview', body: route.request().postDataJSON() }); previewCount += 1
        if (providerFailure && !providerConnected) await reply(route, { error: 'The AI provider credentials are not configured.', code: 'intelligent_sequence_ai_unavailable' }, 503)
        else await reply(route, { proposal: {
          token: `proposal-${previewCount}`, activity_count: 2, relationship_count: 1,
          proposed_duration_count: 1, proposed_relationship_count: 1,
          start_date: '2026-09-21', finish_date: '2026-09-25', target_finish_date: '2026-12-20',
          calendar: { name: 'Review calendar', working_weekdays: [0, 1, 2, 3, 4], hours_per_day: 8, proposed: true },
          warnings: ['The review duration is an AI proposal and requires planner review.'],
        }, plan: { is_sequence_preview: true, calculation_available: false, project: { name: 'Test project' },
          tasks: tasks(), disciplines: [{ code: 'mechanical', name: 'Mechanical' }], duration_policy: 'source_only', evidence_policy: 'document_driven' } })
        return true
      }
      if (path.endsWith('/simple-plan/apply-intelligent-sequence/')) {
        state.sequenceCalls.push({ action: 'apply', body: route.request().postDataJSON() }); attempt += 1
        if (staleOnce && attempt === 1) {
          latestRevision = 'source:71:4'
          await reply(route, { error: 'The plan changed. Generate a fresh sequence before applying.', code: 'intelligent_sequence_stale' }, 409)
        } else {
          active = true
          await reply(route, { schedule_version_id: 121, notice: 'Proposed sequence saved as a draft. Review before baseline approval.' })
        }
        return true
      }
      return false
    },
  })
}

test('an imported Master opens a Gantt first proposal with visible links and saves once', async ({ page }) => {
  const state = await setup(page)
  await expect(workspace(page).getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  await generate(page).click()
  await expect(dialog(page).getByRole('button', { name: 'Activities & Gantt', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(dialog(page).locator('[data-row-id="source-a"] .p6-activity-bar')).toHaveCount(1)
  await expect(dialog(page).locator('[data-row-id="source-a"] .p6-activity-bar')).toHaveAttribute('data-date-basis', 'proposed')
  await expect(dialog(page).locator('[data-row-id="source-a"] [data-column="start"]')).toHaveText(/21-Sept?-26/)
  await expect(dialog(page).locator('.p6-dependency')).toHaveCount(1)
  await dialog(page).getByRole('button', { name: 'Logic & rationale', exact: true }).click()
  await expect(dialog(page).getByRole('region', { name: 'AI sequence relationships' })).toContainText('The datasheet must be prepared before its technical review.')
  await expect(dialog(page).getByRole('region', { name: 'AI sequence relationships' })).toContainText('AI proposal')
  expect(state.sequenceCalls).toEqual([{ action: 'preview', body: { revision: 'source:71:3' } }])
  await dialog(page).getByRole('button', { name: 'Use proposed sequence', exact: true }).evaluate(button => { button.click(); button.click() })
  await expect(dialog(page)).toHaveCount(0)
  await expect(workspace(page).locator('[data-row-id="source-b"] .p6-activity-bar')).toHaveCount(1)
  expect(state.sequenceCalls.filter(item => item.action === 'apply')).toEqual([{ action: 'apply', body: { proposal_token: 'proposal-1' } }])
  expect(state.pageErrors).toEqual([]); expect(state.unknownWrites).toEqual([])
})

test('AI sequence is unavailable without the permission and in historical views', async ({ page }) => {
  const state = await setup(page, { permitted: false })
  await expect(generate(page)).toHaveCount(0)
  expect(state.sequenceCalls).toEqual([])
})

test('the editable working draft can preview AI logic without a planning profile or saving', async ({ page }) => {
  const state = await setup(page, { canonical: false })
  const original = structuredClone(state.records[17].simplePlan)
  await expect(workspace(page).getByRole('button', { name: 'Build schedule', exact: true })).toHaveCount(0)
  await generate(page).click()
  await expect(dialog(page).locator('.p6-dependency')).toHaveCount(1)
  await dialog(page).getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(dialog(page)).toHaveCount(0)
  expect(state.sequenceCalls).toEqual([{ action: 'preview', body: { revision: 4 } }])
  expect(state.records[17].simplePlan).toEqual(original)
})

test('historical viewing prevents new AI proposals even when permission is present', async ({ page }) => {
  const state = await setup(page, { historical: true })
  await expect(generate(page)).toHaveCount(0)
  expect(state.sequenceCalls).toEqual([])
})

test('a stale sequence requires regeneration from the latest Master revision', async ({ page }) => {
  const state = await setup(page, { staleOnce: true })
  await generate(page).click()
  const apply = dialog(page).getByRole('button', { name: 'Use proposed sequence', exact: true })
  await apply.click()
  await expect(dialog(page).getByRole('alert')).toContainText('Generate a fresh sequence before applying')
  await expect(apply).toBeDisabled()
  await dialog(page).getByRole('button', { name: 'Regenerate from latest plan' }).click()
  await expect(apply).toBeEnabled()
  expect(state.sequenceCalls.at(-1)).toEqual({ action: 'preview', body: { revision: 'source:71:4' } })
  await apply.click()
  await expect(dialog(page)).toHaveCount(0)
  expect(state.sequenceCalls.at(-1)).toEqual({ action: 'apply', body: { proposal_token: 'proposal-2' } })
  expect(state.pageErrors).toEqual([])
})

test('provider failures stay visible and never pretend a schedule was generated', async ({ page }) => {
  const state = await setup(page, { providerFailure: true })
  await generate(page).click()
  await expect(dialog(page).getByRole('alert')).toContainText('AI provider credentials are not configured')
  await expect(dialog(page).getByRole('button', { name: 'Use proposed sequence', exact: true })).toBeDisabled()
  await expect(dialog(page).locator('.p6-activity-bar')).toHaveCount(0)
  expect(state.sequenceCalls.map(item => item.action)).toEqual(['preview'])
  const key = dialog(page).getByLabel('OpenAI API key', { exact: true })
  await expect(key).toHaveAttribute('type', 'password')
  await key.fill('mock-key-only-for-browser-test')
  await dialog(page).getByRole('button', { name: 'Test & save API key', exact: true }).click()
  await expect(key).toHaveValue('')
  await expect(dialog(page).getByRole('status').filter({ hasText: 'Connection tested and saved' })).toBeVisible()
  expect(state.sequenceCalls.map(item => item.action)).toEqual(['preview'])
  expect(state.connectionCalls).toEqual([{ model: 'gpt-4o', api_key: 'mock-key-only-for-browser-test' }])
  await dialog(page).getByRole('button', { name: 'Generate sequence', exact: true }).click()
  await expect(dialog(page).locator('.p6-dependency')).toHaveCount(1)
  await expect(dialog(page).getByRole('button', { name: 'Use proposed sequence', exact: true })).toBeEnabled()
  expect(state.pageErrors).toEqual([])
})
