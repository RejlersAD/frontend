import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { scheduleLogicHarness, logicGateIds, firstReviewTaskIds } from '../fixtures/schedule-logic-review.fixture.js'
import { scheduleWorkspace } from '../fixtures/schedule-controls.js'

test.setTimeout(75000)
const panel = page => page.getByRole('region', { name: 'Schedule logic review', exact: true })
const chooser = page => panel(page).getByRole('combobox', { name: 'Logic review group', exact: true })
const selected = page => panel(page).getByRole('checkbox', { name: /^Select first-stage activity / })
const current = state => state.records[17].simplePlan
const clean = state => {
  expect(state.pageErrors).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.unknownWrites).toEqual([])
}

async function open(page, options = {}) {
  await page.setViewportSize({ width: 1600, height: 1000 })
  const state = await scheduleLogicHarness(page, options)
  await scheduleWorkspace(page).getByRole('button', { name: 'Review schedule logic', exact: true }).click()
  await expect(panel(page)).toBeVisible()
  await chooser(page).selectOption('parallel-hse')
  await expect(chooser(page)).toHaveValue('parallel-hse')
  return state
}

async function selectTwo(page) {
  await panel(page).getByRole('checkbox', { name: 'Select all first-stage activities', exact: true }).uncheck()
  await selected(page).nth(0).check()
  await selected(page).nth(1).check()
}

async function chooseChange(page, operation, predecessor) {
  await panel(page).getByRole('combobox', { name: 'Predecessor change', exact: true }).selectOption(operation)
  if (predecessor) await panel(page).getByRole('combobox', { name: 'External predecessor', exact: true }).selectOption(predecessor)
}

async function preview(page) {
  await panel(page).getByRole('button', { name: 'Preview changes', exact: true }).click()
  await expect(panel(page).getByRole('region', { name: 'Reviewed changes', exact: true })).toBeVisible()
}

async function fillAssumption(page) {
  await panel(page).getByText('Keep these deliverables in parallel', { exact: true }).click()
  await panel(page).getByRole('textbox', { name: 'Parallel-work rationale', exact: true }).fill('The package owners confirmed that these separate deliverables can proceed concurrently.')
  await panel(page).getByRole('textbox', { name: 'Duration basis', exact: true }).fill('Discipline leads reviewed the estimates using documented quantities and comparable work.')
  await panel(page).getByRole('textbox', { name: 'Capacity basis', exact: true }).fill('The allocated discipline teams can support forty independent deliverables at the same time.')
  await panel(page).getByRole('spinbutton', { name: 'Maximum parallel deliverables', exact: true }).fill('40')
}

test('173 parallel deliverables across four disciplines are review findings with exact evidence and no writes', async ({ page }) => {
  const state = await open(page, { compact: false })
  await expect(panel(page).locator('.slr-counts')).toContainText('173')
  await expect(chooser(page).locator('option')).toHaveCount(4)
  await expect(selected(page)).toHaveCount(40)
  await panel(page).getByText('Group evidence and stage durations', { exact: true }).click()
  const evidence = panel(page).getByRole('table', { name: 'Recorded stage durations', exact: true })
  await expect(evidence.getByRole('row')).toHaveCount(6)
  await expect(evidence).toContainText('COMPANY_APPROVAL')
  await expect(panel(page)).toContainText('Confirm that parallel execution is intended and feasible')
  await chooser(page).selectOption('parallel-electrical')
  await expect(selected(page)).toHaveCount(33)
  await page.screenshot({ path: 'artifacts/schedule-logic-review-large.png', animations: 'disabled' })
  expect(state.writes).toEqual([])
  expect(current(state).tasks).toHaveLength(1100)
  const axe = await new AxeBuilder({ page }).include('.schedule-logic-review').analyze()
  expect(axe.violations.filter(violation => ['serious', 'critical'].includes(violation.impact))).toEqual([])
  clean(state)
})

test('reviewed replacement sends only selected first-stage typed links and preserves internal chains and dates', async ({ page }) => {
  const state = await open(page)
  await selectTwo(page)
  await chooseChange(page, 'replace', logicGateIds[0])
  await panel(page).getByRole('combobox', { name: 'Relationship type', exact: true }).selectOption('SS')
  await panel(page).getByRole('spinbutton', { name: 'Lag (working days)', exact: true }).fill('2')
  await preview(page)
  expect(state.writes).toEqual([])
  await panel(page).getByRole('button', { name: 'Apply reviewed changes', exact: true }).click()
  await expect.poll(() => state.writes.length).toBe(1)
  expect(state.writes[0].path).toMatch(/\/simple-plan\/edit-activity\/$/)
  expect(state.writes[0].data).toEqual({ revision: 4, updates: firstReviewTaskIds.map(task_id => ({ task_id, dependency_details: [{ task_id: logicGateIds[0], type: 'SS', lag_days: 2 }] })) })
  for (const task of current(state).tasks) {
    const before = state.logicBefore.tasks.find(item => item.id === task.id)
    expect(task.planned_start_date).toBe(before.planned_start_date)
    expect(task.planned_finish_date).toBe(before.planned_finish_date)
    if (!firstReviewTaskIds.includes(task.id)) expect(task).toEqual(before)
  }
  clean(state)
})

test('removing one external gate retains the other gate and all workflow-stage links', async ({ page }) => {
  const state = await open(page)
  await selectTwo(page)
  await chooseChange(page, 'remove', logicGateIds[0])
  await preview(page)
  await panel(page).getByRole('button', { name: 'Apply reviewed changes', exact: true }).click()
  await expect.poll(() => state.writes.length).toBe(1)
  expect(state.writes[0].data.updates).toEqual(firstReviewTaskIds.map(task_id => ({ task_id, dependency_details: [{ task_id: logicGateIds[1], type: 'FS', lag_days: 0 }] })))
  const internal = current(state).tasks.filter(task => task.workflow_stage_sequence > 1)
  expect(internal).toEqual(state.logicBefore.tasks.filter(task => task.workflow_stage_sequence > 1))
  clean(state)
})

test('duration-only review does not serialize unspecified source links or invent dates', async ({ page }) => {
  const state = await open(page, { prepare(state) {
    for (const record of Object.values(state.records)) {
      const task = record.simplePlan.tasks.find(task => task.id === firstReviewTaskIds[0])
      task.dependency_details[0].type = null
      task.dependency_details[0].lag_days = null
      task.dependency_details[0].source = 'source_document'
      task.duration_days = null
      task.duration_unit = null
      task.duration_source = 'missing_source'
      task.planned_start_date = null
      task.planned_finish_date = null
      const group = record.simplePlan.logic_quality.groups[0]
      group.kind = 'unconnected_workflow_start'
      group.status = 'warning'
      group.requires_review = false
    }
  } })
  await chooser(page).selectOption('parallel-hse')
  await page.screenshot({ path: 'artifacts/schedule-logic-review-drawer.png', animations: 'disabled' })
  await selectTwo(page)
  await panel(page).getByRole('checkbox', { name: 'Change first-stage duration', exact: true }).check()
  await panel(page).getByRole('spinbutton', { name: 'First-stage duration (working days)', exact: true }).fill('12')
  await preview(page)
  await panel(page).getByRole('button', { name: 'Apply reviewed changes', exact: true }).click()
  await expect.poll(() => state.writes.length).toBe(1)
  expect(state.writes[0].data.updates).toEqual(firstReviewTaskIds.map(task_id => ({ task_id, duration_days: 12 })))
  expect(current(state).tasks.find(task => task.id === firstReviewTaskIds[0]).planned_start_date).toBeNull()
  expect(current(state).tasks.find(task => task.id === firstReviewTaskIds[0]).dependency_details).toEqual(state.logicBefore.tasks.find(task => task.id === firstReviewTaskIds[0]).dependency_details)
  clean(state)
})

test('parallel assumption requires explicit capacity and three written bases and never approves the schedule', async ({ page }) => {
  const state = await open(page)
  await panel(page).getByText('Keep these deliverables in parallel', { exact: true }).click()
  await expect(panel(page).getByRole('spinbutton', { name: 'Maximum parallel deliverables', exact: true })).toHaveValue('')
  await panel(page).getByRole('button', { name: 'Record parallel-work assumption', exact: true }).click()
  expect(state.writes).toEqual([])
  await panel(page).getByText('Keep these deliverables in parallel', { exact: true }).click()
  await fillAssumption(page)
  await panel(page).getByRole('button', { name: 'Record parallel-work assumption', exact: true }).click()
  await expect.poll(() => state.writes.length).toBe(1)
  expect(state.writes[0].path).toMatch(/\/simple-plan\/confirm-parallel-logic\/$/)
  expect(state.writes[0].data).toMatchObject({ revision: 4, fingerprint: 'a'.repeat(64), group_id: 'parallel-hse', max_parallel_deliverables: 40 })
  for (const field of ['rationale', 'duration_basis', 'capacity_basis']) expect(state.writes[0].data[field].length).toBeGreaterThan(20)
  expect(current(state).state).toBe('review')
  expect(current(state).baseline).toBeNull()
  expect(current(state).tasks).toEqual(state.logicBefore.tasks)
  expect(state.writes.some(write => /approve|baseline|submit/.test(write.path))).toBe(false)
  clean(state)
})

test('baseline remains read only until a separate correction draft is requested', async ({ page }) => {
  const state = await open(page, { baseline: true })
  await expect(panel(page).getByRole('combobox', { name: 'Predecessor change', exact: true })).toBeDisabled()
  await expect(panel(page).getByRole('button', { name: 'Calculate schedule', exact: true })).toHaveCount(0)
  expect(state.writes).toEqual([])
  await panel(page).getByRole('button', { name: 'Create correction draft', exact: true }).click()
  await expect.poll(() => state.writes.length).toBe(1)
  expect(state.writes[0]).toMatchObject({ path: expect.stringMatching(/\/simple-plan\/reopen\/$/), data: { revision: 4 } })
  await expect(panel(page).getByRole('combobox', { name: 'Predecessor change', exact: true })).toBeEnabled()
  expect(current(state).version_id).toBe(92)
  expect(current(state).baseline.version_id).toBe(91)
  expect(state.logicBefore.state).toBe('baselined')
  expect(state.logicBefore.version_id).toBe(91)
  clean(state)
})

test('viewers cannot bulk edit, confirm parallel assumptions or create correction drafts', async ({ page }) => {
  const state = await open(page, { viewer: true, baseline: true })
  await expect(panel(page).getByRole('combobox', { name: 'Predecessor change', exact: true })).toBeDisabled()
  await expect(panel(page).getByRole('button', { name: 'Create correction draft', exact: true })).toHaveCount(0)
  await panel(page).getByText('Keep these deliverables in parallel', { exact: true }).click()
  await expect(panel(page).getByRole('button', { name: 'Record parallel-work assumption', exact: true })).toBeDisabled()
  expect(state.writes).toEqual([])
  clean(state)
})

test('stale revision rejection leaves the original task network and reports the error without retry', async ({ page }) => {
  const state = await open(page)
  await selectTwo(page)
  await chooseChange(page, 'remove', logicGateIds[0])
  await preview(page)
  state.logicError = { status: 409, code: 'simple_plan_revision_conflict', message: 'The plan changed in another session. Refresh before saving.' }
  await panel(page).getByRole('button', { name: 'Apply reviewed changes', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: /plan changed in another session/i }).first()).toBeVisible()
  expect(state.writes).toHaveLength(1)
  expect(current(state).tasks).toEqual(state.logicBefore.tasks)
  clean(state)
})

test('permission rejection cannot record a parallel assumption or silently approve anything', async ({ page }) => {
  const state = await open(page)
  await fillAssumption(page)
  state.logicError = { status: 403, code: 'logic_review_forbidden', message: 'Your access no longer permits reviewing schedule logic.' }
  await panel(page).getByRole('button', { name: 'Record parallel-work assumption', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: /access no longer permits/i }).first()).toBeVisible()
  expect(state.writes).toHaveLength(1)
  expect(current(state).logic_quality.groups[0].status).toBe('requires_review')
  expect(current(state).state).toBe('review')
  clean(state)
})

test('mobile review controls fit the dialog and retain keyboard-accessible evidence', async ({ page }) => {
  const state = await open(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(panel(page)).toBeVisible()
  await chooser(page).focus()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(chooser(page)).toHaveValue('parallel-process')
  const metrics = await panel(page).evaluate(element => ({ width: element.getBoundingClientRect().width, scroll: element.scrollWidth, client: element.clientWidth, viewport: window.innerWidth }))
  expect(metrics.width).toBeLessThanOrEqual(metrics.viewport)
  expect(metrics.scroll).toBeLessThanOrEqual(metrics.client + 1)
  const axe = await new AxeBuilder({ page }).include('.schedule-logic-review').analyze()
  expect(axe.violations.filter(violation => ['serious', 'critical'].includes(violation.impact))).toEqual([])
  expect(state.writes).toEqual([])
  clean(state)
})
