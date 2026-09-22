import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { primaveraScheduleHarness } from '../fixtures/primavera-schedule.fixture.js'
import { scheduleWorkspace, scheduleMenu, closeScheduleMenu } from '../fixtures/schedule-controls.js'

test.setTimeout(60000)
const grid = page => scheduleWorkspace(page).getByRole('region', { name: 'Schedule activities and Gantt', exact: true })
const row = (page, id) => grid(page).locator(`[data-row-id="${id}"]`)
const clean = state => {
  expect(state.pageErrors).toEqual([])
  expect(state.unknownWrites).toEqual([])
  expect(state.unknown).toEqual([])
}
async function open(page, options = {}) {
  await page.setViewportSize({ width: 1740, height: 950 })
  const state = await primaveraScheduleHarness(page, options)
  await expect(grid(page).locator('[data-row-kind="task"]')).not.toHaveCount(0)
  return state
}

const rowWrites = state => state.writes.filter(write => write.path.endsWith('/simple-plan/edit-row/'))
async function expectSurvivingFocus(page) {
  await expect(grid(page).locator('[data-row-kind="task"] .p6-task-name:focus, [data-row-kind="task"] button[aria-label^="Edit activity "]:focus, .p6-viewport:focus')).toHaveCount(1)
}
const snapshot = (plan, canonical) => ({ ...structuredClone(plan),
  permissions: { can_edit: !canonical, can_edit_gantt: true, can_assign: !canonical, can_submit: false, can_approve_publish: false, can_reopen: false },
})

// These request fixtures exercise browser contracts and persistence. The real
// service tests own transaction boundaries, authorization and cascading deletes.
async function mutationHarness(page, { canonical = false, prepare } = {}) {
  return open(page, {
    prepare(current) {
      for (const record of Object.values(current.records)) {
        const plan = record.simplePlan
        Object.assign(plan, { canonical_version: canonical, master_revision: 4 })
        plan.tasks = [0, 1, 2, 8, 16].map(index => plan.tasks[index])
        plan.tasks = plan.tasks.map((task, index, all) => ({ ...task,
          depends_on: index ? [all[index - 1].id] : [],
          dependency_details: index ? [{ task_id: all[index - 1].id, type: index === 2 ? 'SS' : 'FS', lag_days: 0 }] : [],
        }))
      }
      prepare?.(current)
    },
    decorateSnapshot(plan) { return snapshot(plan, canonical) },
    async handleRequest({ path, route, reply, state, record }) {
      if (!path.endsWith('/simple-plan/edit-row/') || route.request().method() !== 'POST') return false
      const body = route.request().postDataJSON()
      state.writes.push({ path, method: 'POST', data: body })
      if (state.rowError) { await reply(route, state.rowError, 409); return true }
      const plan = record.simplePlan
      if (body.revision !== plan.revision) {
        await reply(route, { error: 'The plan changed in another session. Refresh before saving.', code: 'simple_plan_revision_conflict' }, 409)
        return true
      }
      const id = String(body.id)
      if (body.action === 'rename') {
        const target = body.kind === 'activity' ? plan.tasks.find(task => String(task.id) === id) : plan.wbs_nodes.find(node => String(node.id) === id)
        if (!target) { await reply(route, { error: 'Schedule row no longer exists.' }, 404); return true }
        target[body.kind === 'activity' ? 'title' : 'name'] = body.title
      } else if (body.action === 'delete') {
        const deletedNodes = new Set(body.kind === 'wbs' ? [id] : [])
        for (let count = -1; count !== deletedNodes.size;) {
          count = deletedNodes.size
          for (const node of plan.wbs_nodes) if (deletedNodes.has(String(node.parent_id))) deletedNodes.add(String(node.id))
        }
        const deletedTasks = new Set(plan.tasks.filter(task => body.kind === 'activity' ? String(task.id) === id : deletedNodes.has(String(task.wbs_node_id))).map(task => String(task.id)))
        plan.tasks = plan.tasks.filter(task => !deletedTasks.has(String(task.id))).map(task => ({ ...task,
          depends_on: (task.depends_on || []).filter(taskId => !deletedTasks.has(String(taskId))),
          dependency_details: (task.dependency_details || []).filter(link => !deletedTasks.has(String(link.task_id))),
          dependency_rationales: Object.fromEntries(Object.entries(task.dependency_rationales || {}).filter(([taskId]) => !deletedTasks.has(String(taskId)))),
        }))
        plan.wbs_nodes = plan.wbs_nodes.filter(node => !deletedNodes.has(String(node.id)))
        plan.deliverables = (plan.deliverables || []).filter(item => !deletedNodes.has(String(item.wbs_node_id)))
      } else {
        state.unknownWrites.push(path)
        await reply(route, { error: 'Unexpected row action.' }, 400)
        return true
      }
      plan.revision += 1
      plan.master_revision += 1
      plan.calculation_available = false
      await reply(route, snapshot(plan, canonical))
      return true
    },
  })
}

test('activity row edit persists and delete requires confirmation, retains failures and removes incident links', async ({ page }) => {
  const state = await mutationHarness(page)
  const original = state.records[17].simplePlan.tasks[0]
  const renamed = 'Reviewed Process Design Basis'
  await row(page, original.id).getByRole('button', { name: `Edit activity ${original.title}`, exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Edit task', exact: true })
  await editor.getByLabel('Task / deliverable', { exact: true }).fill(renamed)
  await editor.getByRole('button', { name: 'Save task', exact: true }).click()
  await expect(editor).toHaveCount(0)
  await page.reload()
  await expect(row(page, original.id).getByRole('button', { name: renamed, exact: true })).toBeVisible()
  expect(state.records[17].simplePlan.tasks[0].source_references).toEqual(original.source_references)
  const remove = row(page, original.id).getByRole('button', { name: `Delete activity ${renamed}`, exact: true })
  await remove.click()
  const confirmation = page.getByRole('dialog', { name: 'Delete activity', exact: true })
  await expect(confirmation).toContainText(renamed)
  await expect(confirmation).toContainText(/1 activit(?:y|ies)/)
  await expect(confirmation).toContainText(/1 dependency relationship/)
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(confirmation).toHaveCount(0)
  await expect(remove).toBeFocused()
  expect(rowWrites(state)).toEqual([])
  await remove.click()
  const scan = await new AxeBuilder({ page }).include('[role="dialog"]').analyze()
  expect(scan.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
  state.rowError = { error: 'Another planner changed the schedule. Your activity was not deleted.', code: 'simple_plan_revision_conflict' }
  await confirmation.getByRole('button', { name: 'Delete activity', exact: true }).click()
  await expect(confirmation.getByRole('alert')).toContainText('Your activity was not deleted')
  await expect(row(page, original.id)).toBeVisible()
  expect(state.records[17].simplePlan.tasks).toHaveLength(5)
  state.rowError = null
  await confirmation.getByRole('button', { name: 'Delete activity', exact: true }).click()
  await expect(confirmation).toHaveCount(0)
  await expect(row(page, original.id)).toHaveCount(0)
  await expectSurvivingFocus(page)
  expect(rowWrites(state)).toHaveLength(2)
  expect(rowWrites(state).map(write => write.data.revision)).toEqual([5, 5])
  expect(rowWrites(state)[1].data).toMatchObject({ kind: 'activity', id: original.id, action: 'delete' })
  await expect(grid(page).locator('.p6-dependency-link')).toHaveCount(3)
  await page.reload()
  await expect(grid(page).locator('[data-row-kind="task"]')).toHaveCount(4)
  await expect(row(page, original.id)).toHaveCount(0)
  expect(state.records[17].simplePlan.tasks[0].depends_on).toEqual([])
  expect(state.records[17].simplePlan.tasks[0].dependency_details).toEqual([])
  clean(state)
})

test('canonical activity row rename keeps its stable identity and source evidence', async ({ page }) => {
  const state = await mutationHarness(page, { canonical: true })
  const task = structuredClone(state.records[17].simplePlan.tasks[1])
  await row(page, task.id).getByRole('button', { name: `Edit activity ${task.title}`, exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Edit activity', exact: true })
  await editor.getByLabel('Activity name', { exact: true }).fill('Reviewed Heat and Material Balance')
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(editor).toHaveCount(0)
  expect(rowWrites(state)).toHaveLength(1)
  expect(rowWrites(state)[0].data).toMatchObject({ revision: 4, kind: 'activity', id: task.id, action: 'rename', title: 'Reviewed Heat and Material Balance' })
  await page.reload()
  await expect(row(page, task.id).getByRole('button', { name: 'Reviewed Heat and Material Balance', exact: true })).toBeVisible()
  expect(state.records[17].simplePlan.tasks[1]).toMatchObject({ id: task.id, activity_id: task.activity_id, activity_code: task.activity_code, source_references: task.source_references, depends_on: task.depends_on })
  clean(state)
})

test('WBS rename and confirmed delete preserve unrelated branches and disclose child and crossing-link impact', async ({ page }) => {
  const state = await mutationHarness(page)
  const ids = state.records[17].simplePlan.tasks.map(task => task.id)
  await row(page, '1110').getByRole('button', { name: 'Edit WBS FEED', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Edit WBS', exact: true })
  await editor.getByLabel('WBS name', { exact: true }).fill('Front End Design')
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(editor).toHaveCount(0)
  expect(state.records[17].simplePlan.tasks.map(task => task.id)).toEqual(ids)
  expect(rowWrites(state)[0].data).toMatchObject({ revision: 4, kind: 'wbs', action: 'rename', title: 'Front End Design' })
  expect(String(rowWrites(state)[0].data.id)).toBe('1110')
  await page.reload()
  await expect(row(page, '1110')).toContainText('Front End Design')
  const remove = row(page, '1110').getByRole('button', { name: 'Delete WBS Front End Design', exact: true })
  await remove.click()
  const confirmation = page.getByRole('dialog', { name: 'Delete WBS', exact: true })
  await expect(confirmation).toContainText('3 activities')
  await expect(confirmation).toContainText('3 dependency relationships')
  const affected = confirmation.getByRole('list', { name: 'Activities to delete', exact: true })
  await expect(affected.getByRole('listitem')).toHaveCount(3)
  for (const task of state.records[17].simplePlan.tasks.slice(0, 3)) await expect(affected).toContainText(task.title)
  for (const task of state.records[17].simplePlan.tasks.slice(3)) await expect(affected).not.toContainText(task.title)
  await page.keyboard.press('Escape')
  await expect(confirmation).toHaveCount(0)
  await expect(remove).toBeFocused()
  expect(rowWrites(state)).toHaveLength(1)
  await expect(grid(page).locator('[data-row-kind="task"]')).toHaveCount(5)
  await expect(row(page, '1000').getByRole('button', { name: /^Delete WBS/ })).toHaveCount(0)
  await page.locator('.project-performance-workspace').screenshot({ path: '../artifacts/schedule-row-actions.png', animations: 'disabled' })
  await remove.click()
  await confirmation.getByRole('button', { name: 'Delete WBS', exact: true }).click()
  await expect(confirmation).toHaveCount(0)
  await expectSurvivingFocus(page)
  for (const id of ['1110', '1111', '1112', ...ids.slice(0, 3)]) await expect(row(page, id)).toHaveCount(0)
  await expect(grid(page).locator('[data-row-kind="task"]')).toHaveCount(2)
  await expect(grid(page).locator('.p6-dependency-link')).toHaveCount(1)
  expect(state.records[17].simplePlan.tasks.map(task => task.id)).toEqual(ids.slice(3))
  expect(state.records[17].simplePlan.tasks[0].depends_on).toEqual([])
  expect(state.records[17].simplePlan.tasks[1].depends_on).toEqual([ids[3]])
  await page.reload()
  await expect(row(page, '1110')).toHaveCount(0)
  await expect(row(page, ids[3])).toBeVisible()
  await expect(row(page, ids[4])).toBeVisible()
  expect(rowWrites(state)).toHaveLength(2)
  clean(state)
})

test('a WBS with workflow and other activities keeps its own identity and deletes its complete branch', async ({ page }) => {
  const state = await mutationHarness(page, { prepare(current) {
    for (const record of Object.values(current.records)) {
      record.simplePlan.deliverables = [{ id: 'mixed-deliverable', title: 'Exact source design deliverable', activity_code: 'SOURCE-01',
        discipline: 'process', wbs_node_id: 1111, workflow_task_ids: ['activity-1'],
      }]
      record.simplePlan.tasks[0].parent_deliverable_id = 'mixed-deliverable'
    }
  } })
  const plan = state.records[17].simplePlan
  await expect(row(page, '1111')).toHaveAttribute('data-row-kind', 'wbs')
  await expect(row(page, '1111')).toContainText('Process Engineering')
  await expect(row(page, 'deliverable:mixed-deliverable')).toHaveAttribute('data-row-kind', 'deliverable')
  await expect(row(page, 'deliverable:mixed-deliverable')).toContainText('Exact source design deliverable')
  await expect(row(page, 'deliverable:mixed-deliverable').getByRole('button', { name: 'Edit WBS Exact source design deliverable', exact: true })).toBeEnabled()
  await expect(row(page, 'deliverable:mixed-deliverable').getByRole('button', { name: 'Delete WBS Exact source design deliverable', exact: true })).toBeEnabled()
  await expect(row(page, 'activity-1')).toHaveCount(1)
  await expect(row(page, 'activity-2')).toHaveCount(1)
  await row(page, '1111').getByRole('button', { name: 'Edit WBS Process Engineering', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Edit WBS', exact: true })
  await editor.getByLabel('WBS name', { exact: true }).fill('Process Engineering Revised')
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(editor).toHaveCount(0)
  expect(rowWrites(state)[0].data).toMatchObject({ kind: 'wbs', action: 'rename', title: 'Process Engineering Revised' })
  expect(String(rowWrites(state)[0].data.id)).toBe('1111')
  expect(plan.deliverables[0].title).toBe('Exact source design deliverable')
  await expect(row(page, 'deliverable:mixed-deliverable')).toContainText('Exact source design deliverable')
  await row(page, '1111').getByRole('button', { name: 'Delete WBS Process Engineering Revised', exact: true }).click()
  const confirmation = page.getByRole('dialog', { name: 'Delete WBS', exact: true })
  await expect(confirmation).toContainText('2 activities')
  await expect(confirmation).toContainText('2 dependency relationships')
  const affected = confirmation.getByRole('list', { name: 'Activities to delete', exact: true })
  await expect(affected.getByRole('listitem')).toHaveCount(2)
  for (const task of plan.tasks.slice(0, 2)) await expect(affected).toContainText(task.title)
  for (const task of plan.tasks.slice(2)) await expect(affected).not.toContainText(task.title)
  await confirmation.getByRole('button', { name: 'Delete WBS', exact: true }).click()
  await expect(confirmation).toHaveCount(0)
  await expectSurvivingFocus(page)
  expect(rowWrites(state)[1].data).toMatchObject({ kind: 'wbs', action: 'delete' })
  expect(String(rowWrites(state)[1].data.id)).toBe('1111')
  await page.reload()
  for (const id of ['1111', 'deliverable:mixed-deliverable', 'activity-1', 'activity-2']) await expect(row(page, id)).toHaveCount(0)
  await expect(grid(page).locator('[data-row-kind="task"]')).toHaveCount(3)
  await expect(grid(page).locator('.p6-dependency-link')).toHaveCount(2)
  expect(plan.tasks.map(task => task.id)).toEqual(['activity-3', 'activity-9', 'activity-17'])
  expect(plan.tasks[0].depends_on).toEqual([])
  clean(state)
})

test('workflow colors take precedence over discipline colors and critical activities retain red', async ({ page }) => {
  const state = await open(page, { prepare(current) {
    for (const record of Object.values(current.records)) {
      record.simplePlan.tasks = record.simplePlan.tasks.slice(0, 6).map((task, index) => ({
        ...task, title: `Color example ${index + 1}`, discipline: [ 'process', 'electrical', 'process', 'process', 'electrical', 'electrical' ][index],
        schedule_phase: index < 2 ? 'basis' : '', metadata: {}, is_critical: index === 5, total_float_days: index === 5 ? 0 : 4,
      }))
    }
  } })
  const bars = Array.from({ length: 6 }, (_, index) => row(page, `activity-${index + 1}`).locator('.p6-activity-bar'))
  for (const [index, key] of ['basis', 'basis', 'discipline:process', 'discipline:process', 'discipline:electrical', 'discipline:electrical'].entries()) {
    await expect(bars[index]).toHaveAttribute('data-phase', key)
    await expect(row(page, `activity-${index + 1}`).locator('.p6-task-marker')).toHaveAttribute('data-color-key', key)
  }
  const colors = await Promise.all(bars.map(bar => bar.evaluate(element => getComputedStyle(element).backgroundColor)))
  expect(colors[0]).toBe(colors[1])
  expect(colors[2]).toBe(colors[3])
  expect(new Set([colors[0], colors[2], colors[4]]).size).toBe(3)
  expect(colors[5]).toBe('rgb(239, 68, 68)')
  const markers = await Promise.all(Array.from({ length: 6 }, (_, index) => row(page, `activity-${index + 1}`).locator('.p6-task-marker').evaluate(element => getComputedStyle(element).backgroundColor)))
  expect(markers).toEqual(colors)
  await scheduleWorkspace(page).getByLabel('Schedule legend', { exact: true }).click()
  const legend = scheduleWorkspace(page).getByRole('region', { name: 'Schedule sequence legend', exact: true })
  await expect(legend.locator('[data-phase="basis"]')).toBeVisible()
  await expect(legend.locator('[data-phase="discipline:process"]')).toContainText('Process Engineering')
  await expect(legend.locator('[data-phase="discipline:electrical"]')).toContainText('Electrical Engineering')
  const menu = await scheduleMenu(page, 'Schedule actions')
  const colorToggle = menu.getByRole('checkbox', { name: 'Color bars by workflow stage', exact: true })
  await expect(colorToggle).toBeChecked()
  await colorToggle.uncheck()
  await closeScheduleMenu(page, 'Schedule actions')
  expect(await bars[0].evaluate(element => getComputedStyle(element).backgroundColor)).toBe(await bars[4].evaluate(element => getComputedStyle(element).backgroundColor))
  expect(await bars[5].evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(239, 68, 68)')
  expect(state.writes).toEqual([])
  clean(state)
})

for (const mode of ['viewer', 'baselined', 'historical']) {
  test(`${mode} schedule rows do not allow edit or delete mutations`, async ({ page }) => {
    const state = await open(page, {
      prepare(current) {
        for (const record of Object.values(current.records)) {
          record.simplePlan.state = mode === 'baselined' ? 'baselined' : 'review'
          record.simplePlan.viewing_history = mode === 'historical'
        }
      },
      decorateSnapshot(plan) {
        return mode === 'viewer' ? { ...plan, permissions: { ...plan.permissions, can_edit: false, can_edit_gantt: false, can_assign: false } } : plan
      },
    })
    const task = state.records[17].simplePlan.tasks[0]
    await expect(row(page, task.id).getByRole('button', { name: `Edit activity ${task.title}`, exact: true })).toBeDisabled()
    await expect(row(page, task.id).getByRole('button', { name: `Delete activity ${task.title}`, exact: true })).toBeDisabled()
    await expect(grid(page).locator('.p6-row-actions button:enabled')).toHaveCount(0)
    await row(page, task.id).getByRole('button', { name: task.title, exact: true }).click()
    await expect(page.getByRole('complementary', { name: 'Activity details', exact: true })).toBeVisible()
    expect(state.writes).toEqual([])
    clean(state)
  })
}
