import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { workflowStageHarness } from '../fixtures/workflow-stage-tree.fixture.js'
import { masterScheduleHarness } from '../fixtures/master-schedule.fixture.js'
import { scheduleAction, scheduleMenu, scheduleVersion, scheduleWorkspace } from '../fixtures/schedule-controls.js'

test.setTimeout(60000)
const inputs = page => page.getByRole('dialog', { name: 'Documents & project inputs', exact: true })
const rebuildName = 'Rebuild draft from inputs'
const clean = state => { expect(state.pageErrors).toEqual([]); expect(state.unknown).toEqual([]); expect(state.unknownWrites).toEqual([]) }
const rebuildWrites = state => state.writes.filter(item => item.path.endsWith('/simple-plan/analyse/'))

test('a current workflow draft can be explicitly rebuilt without a stale flag or extra confirmation steps', async ({ page }) => {
  const state = await workflowStageHarness(page, { async handleRequest({ path, route, state: current, record, reply }) {
    if (!path.endsWith('/simple-plan/analyse/') || route.request().method() !== 'POST') return false
    const body = route.request().postDataJSON()
    current.writes.push({ method: 'POST', path, data: body })
    // The server owns source reconciliation. This response exercises the UI
    // transition from an assigned workflow to reviewed current document rows.
    record.simplePlan = { ...record.simplePlan, revision: body.revision + 1, state: 'review', stale_inputs: false,
      deliverables: [], wbs_nodes: [], calculation_available: false,
      tasks: [{ id: 'new-source-row', title: 'Revised vendor document register', discipline: 'process', duration_days: null, duration_source: 'missing_source', planned_start_date: null, planned_finish_date: null, depends_on: [], assignee_id: null }],
      rebuild_summary: { preserved_workflow_deliverables: 0, replaced_workflow_deliverables: 3, archived_tasks: 15, new_tasks: 1 },
    }
    await reply(route, record.simplePlan)
    return true
  } })
  expect(state.records[17].simplePlan.stale_inputs).toBe(false)
  expect(state.records[17].simplePlan.deliverables).toHaveLength(3)
  const before = structuredClone(state.records[17].simplePlan)
  await scheduleAction(page, rebuildName)
  await expect(inputs(page)).toBeVisible()
  await expect(inputs(page).getByText('Rebuild this draft from current inputs?', { exact: true })).toBeVisible()
  await expect(inputs(page)).toContainText('matching source rows in the same document version')
  await expect(inputs(page)).toContainText('New, changed or ambiguous rows become unassigned draft activities.')
  await expect(inputs(page)).toContainText('archived with its employee history')
  expect(rebuildWrites(state)).toEqual([])
  await inputs(page).getByRole('button', { name: 'Keep current draft', exact: true }).click()
  expect(state.records[17].simplePlan).toEqual(before)
  expect(rebuildWrites(state)).toEqual([])
  await inputs(page).getByRole('button', { name: 'Close Documents & project inputs', exact: true }).click()
  await scheduleAction(page, rebuildName)
  await expect(inputs(page).getByText('Rebuild this draft from current inputs?', { exact: true })).toBeVisible()
  expect((await new AxeBuilder({ page }).include('.simple-schedule-dialog').analyze()).violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
  await inputs(page).getByRole('button', { name: rebuildName, exact: true }).click()
  await expect(inputs(page)).toHaveCount(0)
  await expect(scheduleWorkspace(page).getByRole('button', { name: 'Revised vendor document register', exact: true })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Draft rebuilt from current documents.' })).toBeVisible()
  expect(rebuildWrites(state)).toEqual([{ method: 'POST', path: '/api/v1/planning-intelligence/projects/71/simple-plan/analyse/', data: { revision: 4, rebuild: true } }])
  clean(state)
})

test('rebuild submits the revision shown at confirmation and does not silently overwrite a newer draft', async ({ page }) => {
  const state = await workflowStageHarness(page)
  await scheduleAction(page, rebuildName)
  await expect(inputs(page).getByText('Rebuild this draft from current inputs?', { exact: true })).toBeVisible()
  const record = state.records[17]
  record.simplePlan.revision = 5
  record.simplePlan.tasks[0].title = 'Another planner has updated this task'
  const changedDraft = structuredClone(record.simplePlan)
  await inputs(page).getByRole('button', { name: rebuildName, exact: true }).click()
  await expect(inputs(page).getByRole('alert').filter({ hasText: 'The plan changed in another session.' })).toBeVisible()
  expect(rebuildWrites(state)).toHaveLength(1)
  expect(rebuildWrites(state)[0].data).toEqual({ revision: 4, rebuild: true })
  expect(record.simplePlan).toEqual(changedDraft)
  await expect(inputs(page).getByText('Rebuild this draft from current inputs?', { exact: true })).toHaveCount(1)
  await expect(inputs(page).getByRole('button', { name: 'Keep current draft', exact: true })).toBeEnabled()
  clean(state)
})

test('Analyze and update uses the same single rebuild confirmation when a document draft already exists', async ({ page }) => {
  const state = await masterScheduleHarness(page)
  await scheduleAction(page, 'Project inputs')
  await inputs(page).getByRole('button', { name: 'Analyze & update schedule', exact: true }).click()
  await expect(inputs(page).getByText('Rebuild this draft from current inputs?', { exact: true })).toBeVisible()
  expect(rebuildWrites(state)).toEqual([])
  await inputs(page).getByRole('button', { name: rebuildName, exact: true }).click()
  await expect(inputs(page)).toHaveCount(0)
  expect(rebuildWrites(state)).toHaveLength(1)
  expect(rebuildWrites(state)[0].data).toEqual({ revision: 4, rebuild: true })
  clean(state)
})

for (const mode of ['manual', 'baselined', 'history']) test(`the rebuild action is not exposed for ${mode} schedules`, async ({ page }) => {
  const state = await masterScheduleHarness(page, { manual: mode === 'manual', history: mode === 'history', prepare(current) {
    if (mode === 'baselined') for (const record of Object.values(current.records)) record.simplePlan.state = 'baselined'
  } })
  if (mode === 'history') await scheduleVersion(page, '90')
  const menu = await scheduleMenu(page, 'Schedule actions')
  await expect(menu.getByRole('button', { name: rebuildName, exact: true })).toHaveCount(0)
  expect(rebuildWrites(state)).toEqual([])
  clean(state)
})
