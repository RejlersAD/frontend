import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { scheduleProposalHarness, proposalAssumption, proposalConstraint, proposalWarning } from '../fixtures/planning-schedule-proposal.fixture.js'
import { scheduleArea, scheduleVersion } from '../fixtures/schedule-controls.js'

test.setTimeout(60000)
const workspace = page => page.getByRole('region', { name: 'Master schedule workspace', exact: true })
const dialog = page => page.getByRole('dialog', { name: 'Review proposed schedule', exact: true })
const build = page => workspace(page).getByRole('button', { name: 'Build schedule', exact: true })
const currentTask = page => workspace(page).locator('[data-row-id="activity-5"]')
const changes = page => dialog(page).getByRole('region', { name: 'Proposed schedule changes', exact: true })
const savedCalls = state => state.writes.filter(item => !item.path.endsWith('/propose-schedule/'))
const clean = state => { expect(state.pageErrors).toEqual([]); expect(state.unknown).toEqual([]); expect(state.unknownWrites).toEqual([]) }
async function open(page, options) {
  await page.setViewportSize({ width: 1740, height: 1000 })
  const state = await scheduleProposalHarness(page, options)
  await expect(workspace(page).getByRole('heading', { name: 'Master Schedule', exact: true })).toBeVisible()
  return state
}
async function preview(page) {
  await build(page).click()
  await expect(dialog(page)).toBeVisible()
}

for (const fits of [true, false]) test(`fixed-date preview explains ${fits ? 'fitted' : 'unresolved'} timing without moving the project target`, async ({ page }) => {
  const state = await open(page, {
    async handleRequest({ path, route, record, state: current, reply }) {
      if (!path.endsWith('/propose-schedule/')) return false
      current.writes.push({ method: 'POST', path, data: route.request().postDataJSON() })
      const plan = structuredClone(record.simplePlan)
      await reply(route, { plan, proposal: {
        token: 'fixed-horizon-preview', revision: plan.revision, changed_count: 3,
        horizon_fit: {
          fits, start_date: '2026-01-06', finish_date: '2026-09-04',
          original_forecast_finish: '2026-10-01', forecast_finish: fits ? '2026-09-04' : '2026-10-01',
          moved_activity_ids: ['activity-1', 'activity-2'], resized_activity_ids: ['activity-1'],
          source_review_days: 10, source_values_changed: false,
        },
      } })
      return true
    },
  })
  const before = structuredClone(state.records[17].simplePlan)
  await preview(page)
  const summary = dialog(page).getByRole('region', { name: 'Fixed project dates', exact: true })
  await expect(summary).toContainText('06-Jan-26 → 04-Sept-26')
  await expect(summary).toContainText(fits ? 'Proposed timing fits' : 'Timing needs review · warning only')
  await expect(summary).toContainText('2 activity starts adjusted; 1 proposed duration adjusted.')
  await expect(summary).toContainText('Source values are retained.')
  await expect(dialog(page).getByRole('button', { name: 'Apply draft schedule', exact: true })).toBeEnabled()
  await expect(dialog(page).getByText('These are planning estimates, not a verified import of the original schedule. Review dates, durations and inferred links before applying.', { exact: true })).toBeVisible()
  await dialog(page).getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(state.records[17].simplePlan).toEqual(before)
  expect(savedCalls(state)).toEqual([])
  clean(state)
})

test('proposal shows current and proposed dates, stable IDs, source requirements and Gantt without saving', async ({ page }) => {
  const state = await open(page)
  const before = structuredClone(state.records[17].simplePlan)
  await preview(page)
  expect(state.writes).toEqual([expect.objectContaining({ method: 'POST', path: '/api/v1/planning-intelligence/projects/71/simple-plan/propose-schedule/', data: { revision: 4, workflow_mode: 'source_only' } })])
  await expect(dialog(page).getByText(proposalWarning, { exact: true })).toBeVisible()
  await expect(dialog(page).locator('.psq-summary > span').filter({ hasText: 'Proposed finish' })).toContainText('23-Mar-26')
  await expect(dialog(page).locator('.psq-summary > span').filter({ hasText: 'Project target' })).toContainText('04-Sept-26')
  await dialog(page).getByText('Scheduling assumptions and source requirements (3)', { exact: true }).click()
  await expect(dialog(page).getByText(proposalAssumption, { exact: true })).toBeVisible()
  await expect(dialog(page).getByText(proposalConstraint, { exact: false })).toBeVisible()
  await expect(dialog(page).getByText('Approved Scope of Work.pdf · Page 14', { exact: true })).toBeVisible()
  const rows = changes(page).locator('tbody tr')
  await expect(rows).toHaveCount(44)
  expect(await rows.locator('td:first-child').allTextContents()).toEqual(before.tasks.map(task => task.activity_code))
  expect(await rows.locator('th[scope="row"]').allTextContents()).toEqual(before.tasks.map(task => task.title))
  const changed = rows.nth(4)
  await expect(changed.locator('td').nth(1)).toHaveText('06-Jan-26 → 12-Jan-26')
  await expect(changed.locator('td').nth(2)).toHaveText('13-Jan-26 → 19-Jan-26')
  await changed.getByText('1 predecessor', { exact: true }).click()
  await expect(changed).toContainText(before.tasks[0].activity_code)
  await expect(changed).toContainText('The predecessor provides the required design input.')
  await expect(changed).toContainText('Unverified inference')
  await page.screenshot({ path: '../artifacts/planning-schedule-proposal.png', animations: 'disabled' })
  const search = dialog(page).getByRole('textbox', { name: 'Search proposed activities', exact: true })
  await search.fill(before.tasks[4].activity_code)
  await expect(rows).toHaveCount(1)
  await expect(rows).toContainText(before.tasks[4].title)
  await search.clear()
  await dialog(page).getByRole('button', { name: 'Gantt preview', exact: true }).click()
  const gantt = dialog(page).getByRole('region', { name: 'Schedule activities and Gantt', exact: true })
  await expect(gantt.locator('[data-row-kind="task"]')).toHaveCount(44)
  await expect(gantt.getByRole('button', { name: `Edit duration for ${before.tasks[4].title}`, exact: true })).toBeDisabled()
  await gantt.getByRole('button', { name: before.tasks[4].title, exact: true }).click()
  await expect(dialog(page).getByRole('region', { name: 'Proposed activity details', exact: true })).toContainText('13-Jan-26 → 19-Jan-26')
  expect(state.records[17].simplePlan).toEqual(before)
  expect(savedCalls(state)).toEqual([])
  await dialog(page).getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(dialog(page)).toHaveCount(0)
  await expect(build(page)).toBeFocused()
  await expect(currentTask(page).locator('[data-column="start"]')).toHaveText('06-Jan-26')
  await expect(currentTask(page).locator('[data-column="finish"]')).toHaveText('12-Jan-26')
  expect(state.persistedProposals).toEqual([])
  clean(state)
})

test('Apply draft schedule sends only the reviewed revision and token, then refreshes dates and logic', async ({ page }) => {
  const state = await open(page)
  const stableIds = state.records[17].simplePlan.tasks.map(task => [task.id, task.activity_code, task.title])
  await preview(page)
  const token = state.proposals[71].proposal.token
  await dialog(page).getByRole('button', { name: 'Apply draft schedule', exact: true }).click()
  await expect(dialog(page)).toHaveCount(0)
  expect(savedCalls(state)).toEqual([expect.objectContaining({ method: 'POST', path: '/api/v1/planning-intelligence/projects/71/simple-plan/apply-schedule/', data: { revision: 4, proposal_token: token } })])
  expect(state.persistedProposals).toEqual([{ project: 71, revision: 5 }])
  expect(state.records[17].simplePlan.tasks.map(task => [task.id, task.activity_code, task.title])).toEqual(stableIds)
  expect(state.records[17].simplePlan.project.end_date).toBe('2026-09-04')
  expect(state.records[17].simplePlan.state).toBe('review')
  await expect(currentTask(page).locator('[data-column="start"]')).toHaveText('13-Jan-26')
  await expect(currentTask(page).locator('[data-column="finish"]')).toHaveText('19-Jan-26')
  await expect(workspace(page).locator('.sc-footer')).toContainText('40 relationships')
  await scheduleArea(page, 'logic')
  await expect(workspace(page)).toContainText(state.records[17].simplePlan.tasks[4].title)
  await page.reload()
  await expect(currentTask(page).locator('[data-column="start"]')).toHaveText('13-Jan-26')
  await expect(workspace(page).locator('.sc-footer')).toContainText('40 relationships')
  expect(state.writes.some(item => item.path.endsWith('/submit/') || item.path.endsWith('/approve-publish/'))).toBe(false)
  clean(state)
})

test('revision conflict retains the proposal for review and leaves the current draft unchanged', async ({ page }) => {
  const state = await open(page)
  const before = structuredClone(state.records[17].simplePlan)
  await preview(page)
  state.applyError = { error: 'The plan changed in another session. Refresh and review a new proposal.', code: 'simple_plan_revision_conflict' }
  await dialog(page).getByRole('button', { name: 'Apply draft schedule', exact: true }).click()
  await expect(dialog(page).getByRole('alert')).toHaveText(state.applyError.error)
  await expect(changes(page).locator('tbody tr')).toHaveCount(44)
  await expect(dialog(page).getByRole('button', { name: 'Apply draft schedule', exact: true })).toBeEnabled()
  expect(state.records[17].simplePlan).toEqual(before)
  expect(state.persistedProposals).toEqual([])
  await dialog(page).getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(currentTask(page).locator('[data-column="start"]')).toHaveText('06-Jan-26')
  await expect(workspace(page).locator('.sc-footer')).toContainText('0 relationships')
  clean(state)
})

test('baselines and historical versions cannot build a schedule proposal', async ({ page }) => {
  const state = await open(page, { baselined: true })
  await expect(build(page)).toHaveCount(0)
  expect(state.writes).toEqual([])
  state.records[17].simplePlan.state = 'review'
  await page.reload()
  await expect(build(page)).toBeEnabled()
  await scheduleVersion(page, '90')
  await expect(build(page)).toHaveCount(0)
  await expect(dialog(page)).toHaveCount(0)
  await scheduleVersion(page, 'current')
  await expect(build(page)).toBeEnabled()
  state.records[17].simplePlan.stale_inputs = true
  await page.reload()
  await expect(build(page)).toBeDisabled()
  expect(state.writes).toEqual([])
  clean(state)
})

test('proposal dialog is centered, supports Escape and restores focus without serious accessibility issues', async ({ page }) => {
  const state = await open(page)
  await build(page).focus()
  await page.keyboard.press('Enter')
  await expect(dialog(page)).toBeVisible()
  const box = await dialog(page).boundingBox()
  expect(Math.abs(box.x + box.width / 2 - 870)).toBeLessThan(1)
  expect(Math.abs(box.y + box.height / 2 - 500)).toBeLessThan(1)
  const scan = await new AxeBuilder({ page }).include('.psq-dialog').analyze()
  expect(scan.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toHaveCount(0)
  await expect(build(page)).toBeFocused()
  expect(savedCalls(state)).toEqual([])
  expect(state.persistedProposals).toEqual([])
  clean(state)
})

test('pending proposal disables changes to the reviewed inputs, version and approval context', async ({ page }) => {
  const state = await open(page, { pauseProposal: true })
  const before = structuredClone(state.records[17].simplePlan)
  await build(page).click()
  await expect.poll(() => Boolean(state.releaseProposal)).toBe(true)
  try {
    await expect(build(page)).toBeDisabled()
    const actions = workspace(page).getByLabel('Schedule actions', { exact: true })
    await expect(actions).toHaveAttribute('aria-disabled', 'true')
    await actions.focus()
    await page.keyboard.press('Enter')
    expect(await actions.evaluate(element => element.parentElement.open)).toBe(false)
    await expect(workspace(page).getByRole('combobox', { name: 'Schedule version', exact: true, includeHidden: true })).toBeDisabled()
    for (const name of ['Save', 'Add activity', 'Review & approve']) await expect(workspace(page).getByRole('button', { name, exact: true })).toBeDisabled()
    await expect(dialog(page)).toHaveCount(0)
    expect(state.records[17].simplePlan).toEqual(before)
    expect(savedCalls(state)).toEqual([])
  } finally { state.releaseProposal() }
  await expect(dialog(page)).toBeVisible()
  await dialog(page).getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(build(page)).toBeEnabled()
  expect(state.persistedProposals).toEqual([])
  clean(state)
})
