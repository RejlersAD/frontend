import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { primaveraScheduleHarness } from '../fixtures/primavera-schedule.fixture.js'

test.setTimeout(60000)
const workspace = page => page.getByRole('region', { name: 'Master schedule workspace', exact: true })
const grid = page => workspace(page).getByRole('region', { name: 'Schedule activities and Gantt', exact: true })
const activityRow = (page, task) => grid(page).locator(`[data-row-kind="task"][data-row-id="${task.id}"]`)
const cell = (page, task, column) => activityRow(page, task).locator(`[data-column="${column}"]`)
const edits = state => state.writes.filter(write => (write.method === 'PUT' && write.path.endsWith('/simple-plan/')) || write.path.endsWith('/simple-plan/edit-activity/'))
const clean = state => {
  expect(state.pageErrors).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.unknownWrites).toEqual([])
}
const sourceReference = { file_id: 904, filename: '04 Schedule (1).pdf', locator: { page: 1, row: 20 }, excerpt: 'FEED-PRO-010 | Design basis | 10 | 21-Sep-26 | 02-Oct-26' }

// The mocked API retains imported evidence independently from saved planner
// inputs. Browser assertions verify the interaction/request contract; calendar
// arithmetic and graph validation are covered by the backend service tests.
async function editingHarness(page, options = {}) {
  await page.setViewportSize({ width: 1740, height: 1000 })
  const editable = plan => !options.viewer && plan.state !== 'baselined' && !plan.viewing_history
  const snapshot = plan => ({ ...structuredClone(plan), permissions: { can_edit: editable(plan) && !options.canonical, can_edit_gantt: editable(plan), can_assign: editable(plan) && !options.canonical, can_submit: false, can_approve_publish: false, can_reopen: plan.state === 'baselined' } })
  const state = await primaveraScheduleHarness(page, {
    prepare(current) {
      for (const record of Object.values(current.records)) {
        const plan = record.simplePlan
        const summary = { duration_days: null, planned_start_date: null, planned_finish_date: null, total_float_days: null, complete: false }
        Object.assign(plan, { state: options.baselined ? 'baselined' : 'review', viewing_history: Boolean(options.historical), evidence_policy: 'document_driven', duration_policy: 'source_only', calculation_available: false,
          stale_inputs: options.stale ?? true, project_summary: summary, canonical_version: Boolean(options.canonical), master_revision: 4,
          source_logic: { status: 'inputs_changed', calculated: false, relationship_count: 1, unsequenced_activity_count: 1 } })
        plan.tasks = plan.tasks.slice(0, 5).map((task, index) => ({ ...task,
          duration_source: 'source_document', duration_calendar_verified: false,
          original_duration_days: 10, duration_days: 10, duration_unit: 'working_days',
          planned_start_date: null, planned_finish_date: null, due_date: null,
          source_start_date: '2026-09-21', source_finish_date: '2026-10-02',
          source_start_status: 'extracted', source_finish_status: 'extracted', source_date_status: 'extracted', source_date_references: [sourceReference],
          calculated: false, total_float_days: null, is_critical: null,
          depends_on: index === 1 ? ['activity-1'] : [],
          dependency_details: index === 1 ? [{ task_id: 'activity-1', type: 'FS', lag_days: 0 }] : [],
          dependency_rationales: index === 1 ? { 'activity-1': { source: 'source_document', relationship_type: 'FS', lag_days: 0, source_references: [sourceReference] } } : {},
        }))
        for (const node of plan.wbs_nodes) node.summary = { ...summary }
      }
      options.prepare?.(current)
    },
    decorateSnapshot(plan) { return snapshot(plan) },
    async handleRequest(context) {
      if (await options.handleRequest?.(context)) return true
      const { path, route, reply, state: current, record } = context
      const method = route.request().method()
      const granular = path.endsWith('/simple-plan/edit-activity/') && method === 'POST'
      if (!granular && (!path.endsWith('/simple-plan/') || method !== 'PUT')) return false
      const body = route.request().postDataJSON()
      current.writes.push({ path, method, data: body })
      if (current.saveError) { await reply(route, current.saveError, 409); return true }
      const before = record.simplePlan
      if (body.revision !== before.revision) { await reply(route, { error: 'The plan changed in another session. Refresh before saving.', code: 'simple_plan_revision_conflict' }, 409); return true }
      const updates = body.updates || [body]
      const requestedTasks = granular ? before.tasks.map(task => {
        const update = updates.find(item => String(item.task_id) === String(task.id))
        if (!update) return task
        return { ...task, ...update, ...(update.dependency_details ? { depends_on: [...new Set(update.dependency_details.map(link => link.task_id))] } : {}) }
      }) : body.tasks
      record.simplePlan = { ...before, tasks: requestedTasks.map(task => {
        const previous = before.tasks.find(row => row.id === task.id)
        const saved = { ...previous, ...task }
        if (task.duration_days !== previous.duration_days) saved.duration_source = 'planner'
        if (task.timing_edit) {
          const { field, value } = task.timing_edit
          Object.assign(saved, { planner_timing: value ? { anchor: field, date: value, edited_by: 7, edited_at: '2026-09-15T06:30:00Z', basis: 'planner_input' } : null,
            planner_start_date: field === 'start' ? value : null, planner_finish_date: field === 'finish' ? value : null,
            planned_start_date: field === 'start' ? value : null, planned_finish_date: field === 'finish' ? value : null })
        }
        delete saved.timing_edit
        return saved
      }), revision: before.revision + 1, master_revision: before.master_revision + 1, calculation_available: false }
      options.onSave?.(record.simplePlan, body, before)
      await reply(route, snapshot(record.simplePlan))
      return true
    },
  })
  await expect(workspace(page).getByRole('heading', { name: 'Master Schedule', exact: true })).toBeVisible()
  return state
}

async function beginEdit(page, task, field) {
  await cell(page, task, field).getByRole('button', { name: `Edit ${field} for ${task.title}`, exact: true }).click()
  const name = `${field[0].toUpperCase()}${field.slice(1)} for ${task.title}`
  const input = page.getByLabel(name, { exact: true })
  await expect(input).toBeFocused()
  return input
}

const taskLabel = task => `${task.activity_code} · ${task.title}`
async function openLogic(page, task) {
  await cell(page, task, 'logic').getByRole('button', { name: `Edit logic for ${task.title}`, exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Activity logic', exact: true })
  await expect(dialog).toBeVisible()
  return dialog
}
async function addLink(dialog, task, direction = 'predecessor') {
  await dialog.getByLabel(`Add ${direction}`, { exact: true }).fill(task.activity_code)
  await dialog.getByRole('button', { name: `Add ${direction} ${taskLabel(task)}`, exact: true }).click()
}

test('Gantt logic supports FS, SS, FF, SF and signed lags, retaining them after reload', async ({ page }) => {
  const state = await editingHarness(page)
  const [first, second, third, fourth, fifth] = state.records[17].simplePlan.tasks
  const dialog = await openLogic(page, fifth)
  const relationships = [[first, 'FS', '2'], [second, 'SS', '-1.5'], [third, 'FF', '0'], [fourth, 'SF', '3']]
  for (const [task, type, lag] of relationships) {
    await addLink(dialog, task)
    await dialog.getByLabel(`Relationship type for ${taskLabel(task)}`, { exact: true }).selectOption(type)
    await dialog.getByLabel(`Lag for ${taskLabel(task)}`, { exact: true }).fill(lag)
  }
  const scan = await new AxeBuilder({ page }).include('[role="dialog"]').analyze()
  expect(scan.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
  await page.screenshot({ path: 'artifacts/gantt-logic-editing-desktop.png', fullPage: true, animations: 'disabled' })
  await dialog.getByRole('button', { name: 'Save logic', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(edits(state)).toHaveLength(1)
  expect(state.records[17].simplePlan.tasks[4].dependency_details).toEqual(relationships.map(([task, type, lag]) => expect.objectContaining({ task_id: task.id, type, lag_days: Number(lag) })))
  await expect(workspace(page).locator('.sc-footer')).toContainText('5 relationships')
  await page.reload()
  const reopened = await openLogic(page, fifth)
  for (const [task, type, lag] of relationships) {
    await expect(reopened.getByLabel(`Relationship type for ${taskLabel(task)}`, { exact: true })).toHaveValue(type)
    await expect(reopened.getByLabel(`Lag for ${taskLabel(task)}`, { exact: true })).toHaveValue(lag)
  }
  await reopened.getByRole('button', { name: `Remove relationship with ${taskLabel(second)}`, exact: true }).click()
  await reopened.getByRole('button', { name: 'Save logic', exact: true }).click()
  await expect(reopened).toHaveCount(0)
  expect(state.records[17].simplePlan.tasks[4].dependency_details).toHaveLength(3)
  expect(state.records[17].simplePlan.tasks[4].depends_on).not.toContain(second.id)
  await expect(workspace(page).locator('.sc-footer')).toContainText('4 relationships')
  clean(state)
})

test('cycle errors retain the proposed logic and do not submit a partial graph', async ({ page }) => {
  const state = await editingHarness(page)
  const [first, second] = state.records[17].simplePlan.tasks
  const dialog = await openLogic(page, first)
  await addLink(dialog, second)
  await dialog.getByRole('button', { name: 'Save logic', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('circular sequence')
  await expect(dialog.getByLabel(`Relationship type for ${taskLabel(second)}`, { exact: true })).toHaveValue('FS')
  expect(edits(state)).toHaveLength(0)
  await dialog.getByRole('button', { name: `Remove relationship with ${taskLabel(second)}`, exact: true }).click()
  await dialog.getByRole('button', { name: 'Successors', exact: true }).click()
  await expect(dialog.getByLabel(`Relationship type for ${taskLabel(second)}`, { exact: true })).toHaveValue('FS')
  await dialog.getByLabel(`Relationship type for ${taskLabel(second)}`, { exact: true }).selectOption('SS')
  await dialog.getByLabel(`Lag for ${taskLabel(second)}`, { exact: true }).fill('-2')
  await dialog.getByRole('button', { name: 'Save logic', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(edits(state)).toHaveLength(1)
  expect(state.records[17].simplePlan.tasks[1].dependency_details).toEqual([expect.objectContaining({ task_id: first.id, type: 'SS', lag_days: -2 })])
  clean(state)
})

test('unchanged logic closes without a request and invalid duration stays in the cell', async ({ page }) => {
  const state = await editingHarness(page)
  const task = state.records[17].simplePlan.tasks[1]
  const dialog = await openLogic(page, task)
  await dialog.getByRole('button', { name: 'Save logic', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(edits(state)).toHaveLength(0)
  const input = await beginEdit(page, task, 'duration')
  await input.fill('-3')
  await input.press('Enter')
  await expect(input).toHaveValue('-3')
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('alert').filter({ hasText: 'duration greater than zero' })).toBeVisible()
  expect(edits(state)).toHaveLength(0)
  await input.press('Escape')
  await expect(cell(page, task, 'duration')).toHaveText('10 d')
  clean(state)
})

test('source duration, start and finish can be saved directly in Gantt and survive reload', async ({ page }) => {
  const state = await editingHarness(page)
  const task = state.records[17].simplePlan.tasks[0]
  await expect(cell(page, task, 'start')).toHaveText('21-Sept-26')
  await expect(cell(page, task, 'finish')).toHaveText('02-Oct-26')

  const duration = await beginEdit(page, task, 'duration')
  await duration.fill('12')
  await duration.press('Enter')
  await expect(cell(page, task, 'duration')).toHaveText('12 d')
  expect(edits(state)).toHaveLength(1)

  const start = await beginEdit(page, task, 'start')
  await start.fill('2026-09-22')
  await start.press('Enter')
  await expect(cell(page, task, 'start')).toHaveText('22-Sept-26')
  const finish = await beginEdit(page, task, 'finish')
  await finish.fill('2026-10-07')
  await workspace(page).getByRole('heading', { name: 'Master Schedule', exact: true }).click()
  await expect(cell(page, task, 'finish')).toHaveText('07-Oct-26')
  expect(edits(state)).toHaveLength(3)
  expect(edits(state).map(write => write.data.revision)).toEqual([4, 5, 6])
  const saved = state.records[17].simplePlan.tasks[0]
  expect(edits(state).every(write => write.method === 'POST' && write.path.endsWith('/simple-plan/edit-activity/'))).toBe(true)
  expect(edits(state)[0].data).toEqual({ revision: 4, task_id: task.id, duration_days: 12 })
  expect(edits(state)[1].data.timing_edit).toEqual({ field: 'start', value: '2026-09-22' })
  expect(edits(state)[2].data.timing_edit).toEqual({ field: 'finish', value: '2026-10-07' })
  expect(saved).toMatchObject({ duration_days: 12, planned_finish_date: '2026-10-07', planner_timing: { anchor: 'finish', date: '2026-10-07' }, source_start_date: '2026-09-21', source_finish_date: '2026-10-02', original_duration_days: 10 })
  expect(saved.source_date_references).toEqual([sourceReference])
  await page.reload()
  await expect(cell(page, task, 'duration')).toHaveText('12 d')
  // A manual finish is the latest anchor. The opposite endpoint remains
  // uncalculated until a valid calendar is available; old source dates do not
  // silently become the other half of a newly edited activity.
  await expect(cell(page, task, 'start')).toHaveText('Not calculated')
  await expect(cell(page, task, 'finish')).toHaveText('07-Oct-26')
  await expect(cell(page, task, 'float')).toHaveText('Not calculated')
  await workspace(page).getByRole('button', { name: task.title, exact: true }).click()
  const details = page.getByRole('complementary', { name: 'Activity details', exact: true })
  await expect(details.getByRole('rowheader', { name: 'Printed source', exact: true })).toBeVisible()
  await expect(details.getByRole('rowheader', { name: 'Calculated draft', exact: true })).toHaveCount(0)
  clean(state)
})

test('Escape cancels without a write and a failed save retains the entered value for retry', async ({ page }) => {
  const state = await editingHarness(page)
  const task = state.records[17].simplePlan.tasks[0]
  let input = await beginEdit(page, task, 'duration')
  await input.fill('14')
  await input.press('Escape')
  await expect(cell(page, task, 'duration')).toHaveText('10 d')
  expect(edits(state)).toHaveLength(0)
  input = await beginEdit(page, task, 'finish')
  await input.fill('2026-10-08')
  state.saveError = { error: 'This draft changed in another session. Your edit has not been saved.', code: 'simple_plan_revision_conflict' }
  await input.press('Enter')
  await expect(input).toHaveValue('2026-10-08')
  await expect(page.getByRole('alert').filter({ hasText: 'Your edit has not been saved' }).first()).toBeVisible()
  expect(state.records[17].simplePlan.revision).toBe(4)
  state.saveError = null
  await input.press('Enter')
  await expect(cell(page, task, 'finish')).toHaveText('08-Oct-26')
  expect(edits(state).map(write => write.data.revision)).toEqual([4, 4])
  clean(state)
})

test('selected canonical master allows a granular Gantt edit while the general task editor stays locked', async ({ page }) => {
  const state = await editingHarness(page, { canonical: true })
  const task = state.records[17].simplePlan.tasks[0]
  await expect(workspace(page).getByRole('button', { name: 'Add activity', exact: true })).toBeDisabled()
  const input = await beginEdit(page, task, 'finish')
  await input.fill('2026-10-09')
  await input.press('Enter')
  await expect(cell(page, task, 'finish')).toHaveText('09-Oct-26')
  expect(edits(state)).toEqual([expect.objectContaining({ method: 'POST', path: '/api/v1/planning-intelligence/projects/71/simple-plan/edit-activity/', data: { revision: 4, task_id: task.id, timing_edit: { field: 'finish', value: '2026-10-09' } } })])
  await page.reload()
  await expect(cell(page, task, 'finish')).toHaveText('09-Oct-26')
  expect(state.records[17].simplePlan.tasks[0].source_finish_date).toBe('2026-10-02')
  clean(state)
})

test('calendar validation blockers retain the active Gantt cell and allow a corrected date retry', async ({ page }) => {
  const state = await editingHarness(page)
  const task = state.records[17].simplePlan.tasks[0]
  const input = await beginEdit(page, task, 'finish')
  await input.fill('2026-10-11')
  state.saveError = { error: 'Review the exact constraint dates against the working calendar.', blockers: [{ code: 'nonworking_constraint', message: 'Choose a working date.' }] }
  await input.press('Enter')
  await expect(grid(page)).toBeVisible()
  await expect(input).toHaveValue('2026-10-11')
  await expect(page.getByRole('alert').filter({ hasText: 'Review the exact constraint dates against the working calendar.' })).toBeVisible()
  expect(state.records[17].simplePlan.revision).toBe(4)
  expect(state.records[17].simplePlan.tasks[0].source_finish_date).toBe('2026-10-02')
  state.saveError = null
  await input.fill('2026-10-09')
  await input.press('Enter')
  await expect(cell(page, task, 'finish')).toHaveText('09-Oct-26')
  expect(edits(state).map(write => write.data.revision)).toEqual([4, 4])
  clean(state)
})

for (const permission of ['viewer', 'baselined', 'historical']) {
  test(`${permission} schedules and WBS summaries do not expose editable cells`, async ({ page }) => {
    const state = await editingHarness(page, { [permission]: true })
    for (const task of state.records[17].simplePlan.tasks) {
      for (const field of ['duration', 'start', 'finish', 'logic']) {
        const button = activityRow(page, task).getByRole('button', { name: `Edit ${field} for ${task.title}`, exact: true })
        if (await button.count()) await expect(button).toBeDisabled()
      }
    }
    await expect(grid(page).locator('[data-row-kind="wbs"]').getByRole('button', { name: /^Edit (duration|start|finish|logic)/ })).toHaveCount(0)
    expect(edits(state)).toHaveLength(0)
    clean(state)
  })
}

test('inline keyboard editing has loaded fonts and no serious accessibility violations', async ({ page }) => {
  const state = await editingHarness(page)
  const task = state.records[17].simplePlan.tasks[0]
  await page.evaluate(() => document.fonts.ready)
  const font = await page.evaluate(async () => {
    const family = getComputedStyle(document.querySelector('.primavera-gantt')).fontFamily
    const faces = await document.fonts.load('14px "IBM Plex Sans"')
    return { family, available: document.fonts.check(`14px ${family}`), loaded: faces.length > 0 && faces.every(face => face.status === 'loaded') }
  })
  test.info().annotations.push({ type: 'rendered-font', description: font.family })
  expect(font.available).toBe(true)
  expect(font.loaded).toBe(true)
  const input = await beginEdit(page, task, 'duration')
  await input.fill('12')
  const scan = await new AxeBuilder({ page }).include('.schedule-canvas').analyze()
  expect(scan.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
  await page.screenshot({ path: 'artifacts/gantt-inline-editing-desktop.png', fullPage: true, animations: 'disabled' })
  await input.press('Escape')
  expect(edits(state)).toHaveLength(0)
  clean(state)
})
