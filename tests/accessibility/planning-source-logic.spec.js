import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { primaveraScheduleHarness } from '../fixtures/primavera-schedule.fixture.js'
import { compactScheduleHarness } from '../fixtures/compact-schedule.fixture.js'
import { closeScheduleMenu, scheduleAction, scheduleMenu, scheduleWorkspace } from '../fixtures/schedule-controls.js'

test.setTimeout(60000)
const dialog = page => page.getByRole('dialog', { name: 'Build logic & sequence', exact: true })
const stages = [['IFR', 'IFR'], ['COMPANY_REVIEW', 'Company Review'], ['IFA', 'IFA'], ['COMPANY_APPROVAL', 'Company Approval'], ['FINAL_ISSUE', 'IFT/IFM']]
const summary = { activity_count: 44, workflow_group_count: 1, relationship_count: 4, unsequenced_activity_count: 39, source_start_date: '2026-09-21', source_finish_date: '2026-12-20', source_duration_days: 65, source_total_float_days: 0, source_total_float_status: 'extracted' }
const clean = state => { expect(state.pageErrors).toEqual([]); expect(state.unknown).toEqual([]); expect(state.unknownWrites).toEqual([]); expect(state.writes).toEqual([]) }

async function sourceLogicHarness(page, { staleOnce = false, readOnly = false, history = false } = {}) {
  let applied = false, revision = 3, calendar, attempts = 0
  await page.setViewportSize({ width: 1740, height: 1000 })
  return primaveraScheduleHarness(page, {
    prepare(state) {
      state.logicRequests = []
      for (const record of Object.values(state.records)) {
        Object.assign(record.simplePlan, { canonical_version: true, source_import: { source_file_id: 23 }, version_id: 31,
          master_revision: revision, evidence_policy: 'document_driven', duration_policy: 'source_only', calculation_available: false,
          versions: [{ id: 31, version_number: 1, status: 'draft', label: 'Original source' }, { id: 32, version_number: 2, status: 'calculated', label: 'Calculated planning draft' }],
        })
        record.simplePlan.tasks = record.simplePlan.tasks.map(task => ({ ...task, duration_days: task.duration_days ?? 2,
          source_start_date: task.planned_start_date || '2026-09-21', source_finish_date: task.planned_finish_date || '2026-09-22',
          source_start_status: 'extracted', source_finish_status: 'extracted', source_total_float_status: 'extracted', source_total_float_days: 8,
          duration_source: 'source_document', duration_calendar_verified: false, planned_start_date: null, planned_finish_date: null,
          is_critical: null, total_float_days: null, calculated: false, depends_on: [], dependency_details: [],
        }))
      }
    },
    decorateSnapshot(plan, record, historicalVersion) {
      Object.assign(plan, { master_revision: revision, viewing_history: history || Boolean(historicalVersion) })
      plan.permissions.can_edit = false
      plan.permissions.can_build_source_logic = !readOnly
      if (applied && String(historicalVersion) !== '31') {
        Object.assign(plan, { version_id: 32, calculation_available: true, calculation_basis: 'source_rule_cpm', source_import: null,
          source_logic: { source_version_id: 31, calendar_origin: calendar.origin, calendar,
            summary: { ...summary, calculated_start_date: '2026-09-21', calculated_finish_date: '2026-12-22', calculated_duration_days: 67, calculated_total_float_days: 0, critical_activity_count: 2 }, assumptions: ['Cross-discipline dependencies require planner review.'] },
        })
        plan.permissions.can_build_source_logic = false
        plan.tasks = plan.tasks.map((task, index) => ({ ...task, duration_calendar_verified: true, calculated: true,
          planned_start_date: task.source_start_date, planned_finish_date: task.source_finish_date,
          is_critical: index < 2, total_float_days: index < 2 ? 0 : 3,
          ...(index < 5 ? { workflow_stage_code: stages[index][0], workflow_stage_name: stages[index][1] } : {}),
          depends_on: index > 0 && index < 5 ? [plan.tasks[index - 1].id] : [],
          dependency_details: index > 0 && index < 5 ? [{ task_id: plan.tasks[index - 1].id, type: 'FS', lag_days: 0, source: 'source_stage_rule', evidence_type: 'planning_inference', rationale: 'Ordered stages within the same source deliverable.' }] : [],
        }))
      }
      return plan
    },
    async handleRequest({ path, route, reply, state }) {
      if (path.endsWith('/simple-plan/preview-source-logic/')) {
        const body = route.request().postDataJSON(); calendar = body.calendar_spec
        state.logicRequests.push({ action: 'preview', body })
        await reply(route, { preview_token: `logic-${revision}`, can_apply: true, summary, calendar,
          assumptions: ['Printed starts are planning release dates.'], warnings: ['Other activities remain without inferred cross-discipline or milestone links.'] })
        return true
      }
      if (path.endsWith('/simple-plan/apply-source-logic/')) {
        const body = route.request().postDataJSON(); state.logicRequests.push({ action: 'apply', body }); attempts += 1
        if (staleOnce && attempts === 1) { revision = 8; await reply(route, { error: 'Source or Master Schedule changed. Review again.' }, 409) }
        else { applied = true; revision += 1; await reply(route, { schedule_version_id: 32, created: true, notice: 'Calculated planning draft created. Original source retained.' }) }
        return true
      }
      return false
    },
  })
}

test('source logic previews an explicit calendar and opens a separate calculated draft with stage colors and source comparison', async ({ page }) => {
  const state = await sourceLogicHarness(page)
  const original = structuredClone(state.records[17].simplePlan)
  await scheduleAction(page, 'Build logic & sequence')
  await expect(dialog(page)).toContainText('draft assumption')
  await expect(dialog(page).getByRole('checkbox', { name: 'Monday', exact: true })).toBeChecked()
  await expect(dialog(page).getByRole('checkbox', { name: 'Saturday', exact: true })).not.toBeChecked()
  await dialog(page).getByRole('button', { name: 'Preview logic & sequence', exact: true }).click()
  await expect(dialog(page).getByRole('region', { name: 'Logic preview' })).toContainText('39')
  await expect(dialog(page).getByRole('row', { name: /Calculated draft/ })).toHaveCount(0)
  expect(state.logicRequests[0].body).toMatchObject({ source_version_id: 31, revision: 3, calendar_spec: { working_weekdays: [0, 1, 2, 3, 4], hours_per_day: 8, exceptions: [], origin: 'scenario_assumption', timezone: 'Asia/Dubai' } })
  await dialog(page).getByRole('checkbox', { name: 'Saturday', exact: true }).check()
  await expect(dialog(page).getByRole('region', { name: 'Logic preview' })).toHaveCount(0)
  await dialog(page).getByRole('spinbutton', { name: 'Hours per working day' }).fill('6')
  await dialog(page).getByRole('button', { name: 'Preview logic & sequence', exact: true }).click()
  await expect(dialog(page).getByRole('region', { name: 'Logic preview' })).toContainText('6 hours/day')
  expect(state.logicRequests.at(-1).body.calendar_spec).toMatchObject({ working_weekdays: [0, 1, 2, 3, 4, 5], hours_per_day: 6 })
  const axe = await new AxeBuilder({ page }).include('.psl-dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(axe.violations).toEqual([])
  await dialog(page).getByRole('button', { name: 'Create calculated draft', exact: true }).click()
  await expect(dialog(page)).toHaveCount(0)
  const displayOptions = await scheduleMenu(page, 'Schedule actions')
  await displayOptions.getByRole('checkbox', { name: 'Color bars by workflow stage', exact: true }).check()
  await closeScheduleMenu(page, 'Schedule actions')
  await scheduleMenu(page, 'Schedule legend')
  const legend = scheduleWorkspace(page).getByRole('region', { name: 'Schedule sequence legend', exact: true })
  await expect(legend).toContainText('Calculated planning draft')
  for (const [, label] of stages) await expect(legend).toContainText(label)
  await expect(legend).toContainText('Other activities')
  await expect(legend).not.toContainText('Unspecified phase')
  await expect(legend).not.toContainText('Source dates')
  const colors = await legend.locator('[data-phase] i').evaluateAll(items => items.map(item => item.style.background))
  expect(new Set(colors).size).toBe(6)
  await closeScheduleMenu(page, 'Schedule legend')
  await expect(scheduleWorkspace(page).locator('.sc-footer')).toContainText('2 critical')
  await expect(scheduleWorkspace(page).locator('.sc-footer')).toContainText('4 relationships')
  await expect(scheduleWorkspace(page).locator('.p6-dependency-link')).toHaveCount(4)
  await expect(scheduleWorkspace(page).locator('.p6-dependency').first()).toHaveAttribute('aria-label', /Deterministic stage rule; planning relationship, not printed source logic/)
  await scheduleWorkspace(page).getByRole('button', { name: /^Review(?: \d+)? issues?$/ }).click()
  const warnings = page.getByRole('dialog', { name: 'Schedule warnings', exact: true })
  await warnings.locator('.psl-summary summary').click()
  await expect(warnings.locator('.psl-summary')).toContainText('22 Dec 2026')
  await expect(warnings.locator('.psl-summary')).toContainText('65 days as printed')
  await expect(warnings.locator('.psl-summary')).toContainText('67 working days')
  await expect(warnings.locator('.psl-summary')).toContainText('partial network')
  await warnings.getByRole('button', { name: 'Close schedule warnings', exact: true }).click()
  await scheduleWorkspace(page).getByRole('button', { name: original.tasks[0].title, exact: true }).click()
  const details = page.getByRole('complementary', { name: 'Activity details' })
  await details.locator('summary').filter({ hasText: /^Source and calculated timing$/ }).click()
  await expect(details.getByRole('row', { name: /^Printed source/ })).toContainText('8')
  await expect(details.getByRole('row', { name: /^Calculated draft/ }).getByRole('cell').last()).toHaveText('0')
  await scheduleWorkspace(page).getByRole('button', { name: /^Review(?: \d+)? issues?$/ }).click()
  await warnings.locator('.psl-summary summary').click()
  await warnings.getByRole('button', { name: 'View original source version', exact: true }).click()
  await warnings.getByRole('button', { name: 'Close schedule warnings', exact: true }).click()
  await expect(scheduleWorkspace(page).locator('.p6-dependency-link')).toHaveCount(0)
  await expect(scheduleWorkspace(page).locator('[data-row-id="activity-1"] [data-column="float"]')).toHaveText('8')
  await scheduleMenu(page, 'Schedule actions')
  await expect(scheduleWorkspace(page).getByRole('button', { name: 'Build logic & sequence', exact: true })).toHaveCount(0)
  expect(state.records[17].simplePlan).toEqual(original)
  clean(state)
})

test('stale logic cannot be applied again until a fresh preview uses the latest revision', async ({ page }) => {
  const state = await sourceLogicHarness(page, { staleOnce: true })
  await scheduleWorkspace(page).getByRole('button', { name: 'Build logic & sequence', exact: true }).click()
  await dialog(page).getByRole('button', { name: 'Preview logic & sequence', exact: true }).click()
  await dialog(page).getByRole('button', { name: 'Create calculated draft', exact: true }).click()
  await expect(dialog(page).getByRole('alert')).toHaveText('Source or Master Schedule changed. Review again.')
  await expect(dialog(page).getByRole('button', { name: 'Create calculated draft', exact: true })).toHaveCount(0)
  await dialog(page).getByRole('button', { name: 'Review latest inputs', exact: true }).click()
  await expect(dialog(page).getByRole('button', { name: 'Create calculated draft', exact: true })).toBeEnabled()
  expect(state.logicRequests.at(-1).body.revision).toBe(8)
  await dialog(page).getByRole('button', { name: 'Create calculated draft', exact: true }).click()
  await expect(dialog(page)).toHaveCount(0)
  expect(state.logicRequests.at(-1).body.preview_token).toBe('logic-8')
  clean(state)
})

for (const restriction of ['readOnly', 'history']) test(`${restriction} source views do not offer a logic mutation`, async ({ page }) => {
  const state = await sourceLogicHarness(page, { [restriction]: true })
  await expect(scheduleWorkspace(page).getByRole('button', { name: 'Build logic & sequence', exact: true })).toHaveCount(0)
  expect(state.logicRequests).toEqual([])
  clean(state)
})

test('multiple relationship types between the same pair remain visible in graph, counts and Logic table', async ({ page }) => {
  const state = await compactScheduleHarness(page, { prepare(state) {
    for (const record of Object.values(state.records)) record.simplePlan.tasks[1].dependency_details.push({ task_id: 'activity-1', type: 'FF', lag_days: 1, source: 'planner' })
  } })
  const pair = scheduleWorkspace(page).locator('.p6-dependency-link[data-predecessor-id="activity-1"][data-successor-id="activity-2"]')
  await expect(pair).toHaveCount(2)
  await expect(pair.locator('..').locator('title')).toHaveCount(2)
  await expect(scheduleWorkspace(page).locator('.sc-footer')).toContainText('5 relationships')
  await scheduleWorkspace(page).getByRole('combobox', { name: 'Schedule workspace area', exact: true }).selectOption('logic')
  const table = scheduleWorkspace(page).getByRole('table')
  await expect(table.getByRole('row')).toHaveCount(6)
  await expect(table.getByRole('row').filter({ hasText: 'Lag: 1 d' })).toContainText('Finish to finish')
  await expect(table.getByRole('row').filter({ hasText: 'Lag: 1 d' })).toContainText('Planner-defined relationship')
  clean(state)
})
