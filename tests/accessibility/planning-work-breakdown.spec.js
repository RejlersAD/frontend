import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { confirmPlanningEvidence, planningInputsHarness, workBreakdownRecord, planningEmployees, taskAssignmentDefaults } from '../fixtures/planning-inputs.fixture'

test.setTimeout(60000)

const stage = page => page.getByRole('navigation', { name: 'Planning stages', exact: true }).getByRole('button', { name: /Work breakdown/ })
const heading = page => page.getByRole('heading', { name: 'Work breakdown', exact: true })
const savedWrites = state => state.writes.filter(write => write.path.endsWith('/work-breakdown/'))
const taskRow = (page, title) => page.getByRole('row').filter({ hasText: title })
const clean = state => {
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
}

function prepareWbs(state, complete = false) {
  const record = state.records[17]
  record.files.push(
    { ...record.files[0], id: 802, category: 'mdr', original_filename: 'Master Deliverable Register.xlsx', content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    { ...record.files[0], id: 803, category: 'schedule_requirements', original_filename: 'Client Planning Requirements.pdf' },
  )
  record.runs.find(run => run.status === 'succeeded').source_file_ids = record.files.map(file => file.id)
  confirmPlanningEvidence(record)
  const base = workBreakdownRecord(record)
  const activity = (id, discipline, title, employeeId, effort, dependencies = []) => {
    const employee = planningEmployees.find(row => row.user_id === employeeId) || null
    return { ...taskAssignmentDefaults, id, discipline, title, assignee_id: employeeId || null, assignee: employee,
      owner: employee?.name || '', effort_hours: effort, depends_on: dependencies, acceptance_criteria: '', reviewer: '', source_references: [] }
  }
  base.tasks = [
    activity('process-1', 'process', 'Process design basis', 7, 16),
    activity('process-2', 'process', 'Hydraulic calculations', complete ? 7 : null, 8, ['process-1']),
    activity('piping-1', 'piping', 'Piping isometric drawings', 8, 24, ['process-1']),
    activity('piping-2', 'piping', 'Tie-in details', complete ? 8 : null, complete ? 12 : null, ['piping-1']),
    activity('piping-3', 'piping', 'Stress analysis', 10, 32),
  ]
  record.workBreakdown = base
}

async function openWbs(page, options = {}) {
  const state = await planningInputsHarness(page, { populated: true, ...options, prepare(current) {
    prepareWbs(current, Boolean(options.complete))
    options.prepare?.(current)
  } })
  await expect(page.getByRole('heading', { name: 'Project Planning', exact: true })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'AI input review', exact: true })).not.toContainText('Loading extracted inputs')
  await expect(stage(page)).toBeEnabled()
  await stage(page).click()
  await expect(heading(page)).toBeVisible()
  await expect(taskRow(page, 'Process design basis')).toBeVisible()
  return state
}

async function fitsViewport(page) {
  const bounds = await page.evaluate(() => ({ width: innerWidth, page: document.documentElement.scrollWidth }))
  expect(bounds.page).toBeLessThanOrEqual(bounds.width + 1)
}

test('work breakdown presents saved activities, source documents, planning checks and the current stage', async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 1050 })
  const state = await openWbs(page)
  await expect(stage(page)).toHaveAttribute('aria-current', 'step')
  const metrics = page.getByLabel('Work breakdown totals', { exact: true })
  await expect(metrics).toContainText('5Planned tasks')
  await expect(metrics).toContainText('80 hPlanned effort')
  await expect(metrics).toContainText('2Unassigned tasks')
  for (const document of state.records[17].workBreakdown.source_documents) await expect(page.getByRole('region', { name: 'Work breakdown planning', exact: true }).getByText(document.name, { exact: true })).toBeVisible()
  for (const task of state.records[17].workBreakdown.tasks) await expect(taskRow(page, task.title)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add task', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Use template', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue to schedule', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Build Workable Project Plan', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Assign employee for Hydraulic calculations/ })).toBeVisible()
  expect(state.writes).toEqual([])
  await fitsViewport(page)
  await page.screenshot({ path: '../artifacts/project-planning-work-breakdown-desktop.png', fullPage: true, animations: 'disabled' })
  clean(state)
})

async function selectEmployee(dialog, label, employeeId, search) {
  const employee = planningEmployees.find(row => row.user_id === employeeId)
  await dialog.getByRole('combobox', { name: label, exact: true }).fill(search || employee.name)
  await dialog.getByRole('option', { name: new RegExp(employee.name) }).click()
}

test('adding a task immediately saves real assignee reviewer due date priority and dependencies then reload restores them', async ({ page }) => {
  const state = await openWbs(page)
  await page.getByRole('button', { name: 'Add task', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add task', exact: true })
  await dialog.getByRole('textbox', { name: 'Task / deliverable', exact: true }).fill('Tie-in site verification')
  await dialog.getByRole('combobox', { name: 'Discipline', exact: true }).selectOption('piping')
  await dialog.getByRole('combobox', { name: 'Work type', exact: true }).selectOption('task')
  await selectEmployee(dialog, 'Assigned to', 8, 'RAD-008')
  await selectEmployee(dialog, 'Reviewer', 9, 'layla.ahmed@example.test')
  await dialog.getByLabel('Due date', { exact: true }).fill('2026-10-08')
  await dialog.getByRole('combobox', { name: 'Priority', exact: true }).selectOption('high')
  await dialog.getByRole('spinbutton', { name: 'Planned effort (hours)', exact: true }).fill('18')
  await dialog.getByRole('checkbox', { name: /Piping isometric drawings/ }).check()
  await dialog.getByRole('textbox', { name: 'Acceptance criteria', exact: true }).fill('Approved walkdown and tie-in register.')
  expect(savedWrites(state)).toEqual([])
  await dialog.getByRole('button', { name: 'Add task', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(taskRow(page, 'Tie-in site verification')).toContainText('Omar Saleh')
  expect(savedWrites(state)).toHaveLength(1)
  const created = savedWrites(state)[0].data.tasks.find(task => task.title === 'Tie-in site verification')
  expect(created).toMatchObject({ discipline: 'piping', assignee_id: 8, reviewer_id: 9, task_type: 'task', due_date: '2026-10-08', priority: 'high', effort_hours: 18, depends_on: ['piping-1'], acceptance_criteria: 'Approved walkdown and tie-in register.' })
  expect(savedWrites(state)[0]).toMatchObject({ method: 'PUT', path: '/api/v1/planning-intelligence/projects/71/work-breakdown/', data: { intelligence_run_id: 901, revision: 0 } })
  const coreTask = state.records[17].tasks.find(task => task.wbs_task_id === created.id)
  expect(coreTask).toMatchObject({ assigned_to: 8, task_type: 'task', due_date: '2026-10-08', priority: 'high', status: 'todo' })
  await page.reload()
  await expect(stage(page)).toBeEnabled()
  await stage(page).click()
  await expect(taskRow(page, 'Tie-in site verification')).toContainText('Omar Saleh')
  await taskRow(page, 'Tie-in site verification').getByRole('button', { name: 'Tie-in site verification', exact: true }).click()
  const edit = page.getByRole('dialog', { name: 'Edit task', exact: true })
  await expect(edit.getByRole('spinbutton', { name: 'Planned effort (hours)', exact: true })).toHaveValue('18')
  await expect(edit.getByRole('checkbox', { name: /Piping isometric drawings/ })).toBeChecked()
  await expect(edit.getByRole('textbox', { name: 'Acceptance criteria', exact: true })).toHaveValue('Approved walkdown and tie-in register.')
  await expect(edit.getByRole('combobox', { name: 'Assigned to', exact: true })).toHaveValue('Omar Saleh')
  await expect(edit.getByRole('combobox', { name: 'Reviewer', exact: true })).toHaveValue('Layla Ahmed')
  await expect(edit.getByLabel('Due date', { exact: true })).toHaveValue('2026-10-08')
  await expect(edit.getByRole('combobox', { name: 'Priority', exact: true })).toHaveValue('high')
  await edit.getByRole('spinbutton', { name: 'Planned effort (hours)', exact: true }).fill('20')
  await edit.getByRole('combobox', { name: 'Work type', exact: true }).selectOption('deliverable')
  await edit.getByRole('button', { name: 'Save task', exact: true }).click()
  await expect(edit).toHaveCount(0)
  expect(savedWrites(state)).toHaveLength(2)
  expect(savedWrites(state)[1].data.revision).toBe(1)
  expect(state.records[17].workBreakdown.tasks.find(task => task.id === created.id)).toMatchObject({ effort_hours: 20, task_type: 'deliverable', project_task_id: coreTask.id })
  expect(state.records[17].tasks.filter(task => task.wbs_task_id === created.id)).toHaveLength(1)
  clean(state)
})

test('failed immediate assignment saves preserve the selected employee and modal edits for retry', async ({ page }) => {
  const state = await openWbs(page)
  await page.getByRole('button', { name: /Assign employee for Hydraulic calculations/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit task', exact: true })
  await selectEmployee(dialog, 'Assigned to', 7, 'Process Engineering')
  await dialog.getByLabel('Due date', { exact: true }).fill('2026-10-09')
  state.wbsSaveError = { error: 'Work breakdown storage is temporarily unavailable. Please retry.', code: 'work_breakdown_save_unavailable' }
  state.wbsStatus = 503
  await dialog.getByRole('button', { name: 'Save task', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('storage is temporarily unavailable')
  await expect(dialog.getByRole('combobox', { name: 'Assigned to', exact: true })).toHaveValue('Maya Hassan')
  await expect(dialog.getByLabel('Due date', { exact: true })).toHaveValue('2026-10-09')
  expect(state.records[17].workBreakdown.tasks.find(task => task.id === 'process-2').assignee_id).toBeNull()
  state.wbsSaveError = null
  await dialog.getByRole('button', { name: 'Save task', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(taskRow(page, 'Hydraulic calculations')).toContainText('Maya Hassan')
  expect(state.records[17].workBreakdown.tasks.find(task => task.id === 'process-2')).toMatchObject({ assignee_id: 7, due_date: '2026-10-09' })
  expect(savedWrites(state)).toHaveLength(2)
  clean(state)
})

test('work breakdown stays behind confirmation when the saved document preview is no longer current', async ({ page }) => {
  const state = await planningInputsHarness(page, { populated: true, prepare(current) {
    prepareWbs(current)
    current.records[17].runs.find(run => run.status === 'succeeded').preview_confirmation.is_current = false
  } })
  await expect(stage(page)).toBeEnabled()
  await stage(page).click()
  await expect(page.getByRole('heading', { name: 'Document Intelligence Preview', exact: true })).toBeVisible()
  await expect(heading(page)).toHaveCount(0)
  expect(state.requests.filter(request => request.path.endsWith('/work-breakdown/'))).toEqual([])
  expect(state.writes).toEqual([])
  clean(state)
})

test('continuing saves the editable work breakdown before opening schedule and resources', async ({ page }) => {
  const state = await openWbs(page, { complete: true })
  await page.getByRole('button', { name: 'Continue to schedule', exact: true }).click()
  await expect.poll(() => savedWrites(state).length).toBe(1)
  expect(savedWrites(state)[0].data).toMatchObject({ advance: true, intelligence_run_id: 901, revision: 0 })
  await expect(page.getByRole('navigation', { name: 'Planning workspace areas', exact: true })).toBeVisible()
  expect(state.writes.some(write => /baseline|generate|build-workable-plan/.test(write.path))).toBe(false)
  clean(state)
})

test('mobile work breakdown and its task editor fit the viewport and expose accessible controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const state = await openWbs(page)
  await fitsViewport(page)
  const scan = await new AxeBuilder({ page }).include('.project-performance-workspace').analyze()
  expect(scan.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
  await page.screenshot({ path: '../artifacts/project-planning-work-breakdown-mobile.png', fullPage: true, animations: 'disabled' })
  await page.getByRole('button', { name: 'Add task', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add task', exact: true })
  await expect(dialog).toBeVisible()
  const bounds = await dialog.boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
  expect(bounds.y).toBeGreaterThanOrEqual(0)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(844)
  const modalScan = await new AxeBuilder({ page }).include('[role="dialog"]').analyze()
  expect(modalScan.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
  await page.screenshot({ path: '../artifacts/project-planning-work-breakdown-mobile-editor.png', animations: 'disabled' })
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add task', exact: true })).toBeFocused()
  expect(state.writes).toEqual([])
  clean(state)
})


test('templates and planning suggestions add tasks only after explicit review and save', async ({ page }) => {
  const state = await openWbs(page)
  await page.getByRole('button', { name: 'Use template', exact: true }).click()
  const template = page.getByRole('dialog', { name: 'Use template', exact: true })
  await template.getByRole('textbox', { name: 'Deliverable name', exact: true }).fill('Safety review package')
  await template.getByRole('combobox', { name: 'Discipline', exact: true }).selectOption('process')
  await expect(template.getByText('Prepare Safety review package', { exact: true })).toBeVisible()
  await expect(template.getByText('Review Safety review package', { exact: true })).toBeVisible()
  await expect(template.getByText('Issue Safety review package', { exact: true })).toBeVisible()
  expect(state.records[17].workBreakdown.tasks).toHaveLength(5)
  await template.getByRole('button', { name: 'Add template tasks', exact: true }).click()
  await expect(template).toHaveCount(0)
  await expect(taskRow(page, 'Prepare Safety review package')).toBeVisible()
  await page.getByRole('button', { name: 'Review suggestion', exact: true }).click()
  let suggestion = page.getByRole('dialog', { name: 'Add task', exact: true })
  await expect(suggestion.getByRole('textbox', { name: 'Task / deliverable', exact: true })).toHaveValue('Interdisciplinary review')
  await suggestion.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(taskRow(page, 'Interdisciplinary review')).toHaveCount(0)
  expect(savedWrites(state)).toEqual([])
  await page.getByRole('button', { name: 'Review suggestion', exact: true }).click()
  suggestion = page.getByRole('dialog', { name: 'Add task', exact: true })
  await suggestion.getByRole('button', { name: 'Add task', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Review suggestion', exact: true })).toHaveCount(0)
  await expect.poll(() => savedWrites(state).length).toBe(1)
  const tasks = state.records[17].workBreakdown.tasks
  expect(tasks).toHaveLength(9)
  const prepare = tasks.find(task => task.title === 'Prepare Safety review package')
  const review = tasks.find(task => task.title === 'Review Safety review package')
  const issue = tasks.find(task => task.title === 'Issue Safety review package')
  expect(review.depends_on).toEqual([prepare.id])
  expect(issue.depends_on).toEqual([review.id])
  expect(tasks.find(task => task.title === 'Interdisciplinary review').depends_on).toContain(issue.id)
  clean(state)
})

test('task dependencies reject cycles and the header saves unsaved template changes after leaving is cancelled', async ({ page }) => {
  const state = await openWbs(page)
  await taskRow(page, 'Process design basis').getByRole('button', { name: 'Process design basis', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit task', exact: true })
  await dialog.getByRole('checkbox', { name: 'Hydraulic calculations', exact: true }).check()
  await dialog.getByRole('button', { name: 'Save task', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('circular sequence')
  await expect(dialog).toBeVisible()
  expect(savedWrites(state)).toEqual([])
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: 'Use template', exact: true }).click()
  const template = page.getByRole('dialog', { name: 'Use template', exact: true })
  await template.getByRole('textbox', { name: 'Deliverable name', exact: true }).fill('Electrical interface review')
  await template.getByRole('button', { name: 'Add template tasks', exact: true }).click()
  await page.getByRole('button', { name: 'Manage inputs', exact: true }).click()
  const leave = page.getByRole('dialog', { name: 'Save work breakdown?', exact: true })
  await expect(leave).toBeVisible()
  await leave.getByRole('button', { name: 'Keep editing', exact: true }).click()
  await expect(taskRow(page, 'Prepare Electrical interface review')).toBeVisible()
  expect(state.writes).toEqual([])
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect.poll(() => savedWrites(state).length).toBe(1)
  await expect(page.getByText('Work breakdown saved.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Manage inputs', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Scope summary', exact: true })).toBeVisible()
  await expect(heading(page)).toHaveCount(0)
  clean(state)
})

test('legacy owner names remain unverified and never silently become a matching employee assignment', async ({ page }) => {
  const state = await openWbs(page, { prepare(current) {
    Object.assign(current.records[17].workBreakdown.tasks[0], { assignee_id: null, assignee: null, owner: 'Maya Hassan' })
  } })
  await expect(page.getByLabel('Work breakdown totals', { exact: true })).toContainText('3Unassigned tasks')
  await taskRow(page, 'Process design basis').getByRole('button', { name: 'Process design basis', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit task', exact: true })
  await expect(dialog.getByRole('combobox', { name: 'Assigned to', exact: true })).toHaveValue('')
  await expect(dialog).toContainText('Maya Hassan')
  await dialog.getByRole('spinbutton', { name: 'Planned effort (hours)', exact: true }).fill('17')
  await dialog.getByRole('button', { name: 'Save task', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  const saved = state.records[17].workBreakdown.tasks[0]
  expect(saved).toMatchObject({ assignee_id: null, owner: 'Maya Hassan', effort_hours: 17, project_task_id: null })
  expect(state.records[17].tasks.some(task => task.wbs_task_id === saved.id)).toBe(false)
  clean(state)
})

test('assignment changes preserve the employee recorded status and progress and clear uses a real null identity', async ({ page }) => {
  const state = await openWbs(page, { prepare(current) {
    Object.assign(current.records[17].workBreakdown.tasks[0], { status: 'in_progress', progress_percent: 45, project_task_id: 2101 })
  } })
  await taskRow(page, 'Process design basis').getByRole('button', { name: 'Process design basis', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit task', exact: true })
  await expect(dialog.getByRole('combobox', { name: 'Status', exact: true })).toHaveCount(0)
  await selectEmployee(dialog, 'Assigned to', 8)
  await dialog.getByRole('combobox', { name: 'Priority', exact: true }).selectOption('critical')
  await dialog.getByRole('button', { name: 'Save task', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(state.records[17].workBreakdown.tasks[0]).toMatchObject({ assignee_id: 8, status: 'in_progress', progress_percent: 45, priority: 'critical', project_task_id: 2101 })
  const written = savedWrites(state)[0].data.tasks[0]
  for (const field of ['status', 'progress_percent', 'project_task_id', 'assignee', 'reviewer_user']) expect(written).not.toHaveProperty(field)
  await taskRow(page, 'Process design basis').getByRole('button', { name: 'Process design basis', exact: true }).click()
  await dialog.getByRole('button', { name: 'Clear assigned to', exact: true }).click()
  await dialog.getByRole('button', { name: 'Save task', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(state.records[17].workBreakdown.tasks[0]).toMatchObject({ assignee_id: null, status: 'todo', progress_percent: 0, project_task_id: null })
  expect(state.records[17].tasks.find(task => task.id === 2101)).toMatchObject({ is_deleted: true, status: 'in_progress', progress_percent: 45 })
  clean(state)
})

test('typing an employee name without selecting a search result cannot silently assign the task', async ({ page }) => {
  const state = await openWbs(page)
  await page.getByRole('button', { name: 'Add task', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add task', exact: true })
  await dialog.getByRole('textbox', { name: 'Task / deliverable', exact: true }).fill('Review process calculations')
  const assignee = dialog.getByRole('combobox', { name: 'Assigned to', exact: true })
  await assignee.fill('Maya Hassan')
  await expect(dialog.getByRole('option', { name: /Maya Hassan/ })).toBeVisible()
  await dialog.getByRole('button', { name: 'Add task', exact: true }).click()
  await expect(dialog).toBeVisible()
  expect(await assignee.evaluate(input => input.validationMessage)).toContain('Select an employee from the search results')
  expect(savedWrites(state)).toEqual([])
  await assignee.click()
  await dialog.getByRole('option', { name: /Maya Hassan/ }).click()
  await dialog.getByRole('button', { name: 'Add task', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(state.records[17].workBreakdown.tasks.find(task => task.title === 'Review process calculations').assignee_id).toBe(7)
  clean(state)
})

test('employee lookup errors can be retried without losing the task draft', async ({ page }) => {
  const state = await openWbs(page)
  state.employeeLookupError = { detail: 'Employee directory is temporarily unavailable.' }
  await page.getByRole('button', { name: 'Add task', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add task', exact: true })
  await dialog.getByRole('textbox', { name: 'Task / deliverable', exact: true }).fill('Review piping interface')
  await dialog.getByRole('combobox', { name: 'Assigned to', exact: true }).fill('RAD-008')
  await expect(dialog.getByRole('status')).toContainText('Employee directory is temporarily unavailable.')
  state.employeeLookupError = null
  await dialog.getByRole('button', { name: 'Retry employee search', exact: true }).click()
  await dialog.getByRole('option', { name: /Omar Saleh/ }).click()
  await expect(dialog.getByRole('textbox', { name: 'Task / deliverable', exact: true })).toHaveValue('Review piping interface')
  await dialog.getByRole('button', { name: 'Add task', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(state.records[17].workBreakdown.tasks.find(task => task.title === 'Review piping interface').assignee_id).toBe(8)
  clean(state)
})

test('server assignment permissions keep a visible work breakdown read only', async ({ page }) => {
  const state = await openWbs(page, { prepare(current) {
    current.records[17].workBreakdown.permissions = { can_assign: false }
  } })
  await expect(page.getByRole('button', { name: 'Add task', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Use template', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Save work breakdown', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Continue to schedule', exact: true })).toBeDisabled()
  expect(state.writes).toEqual([])
  clean(state)
})

test('refresh loads employee progress from My Work without overwriting it when assignment details are saved', async ({ page }) => {
  const state = await openWbs(page)
  await page.getByRole('button', { name: 'Save work breakdown', exact: true }).click()
  await expect(page.getByText('Work breakdown saved.', { exact: true })).toBeVisible()
  const task = state.records[17].tasks.find(row => row.wbs_task_id === 'process-1')
  Object.assign(task, { status: 'in_progress', progress_percent: 60 })
  await page.getByRole('region', { name: 'Work breakdown planning', exact: true }).getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(taskRow(page, 'Process design basis')).toContainText('In progress')
  await taskRow(page, 'Process design basis').getByRole('button', { name: 'Process design basis', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit task', exact: true })
  await expect(dialog).toContainText('In progress')
  await dialog.getByRole('combobox', { name: 'Priority', exact: true }).selectOption('high')
  await dialog.getByRole('button', { name: 'Save task', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  const written = savedWrites(state)[1].data.tasks[0]
  expect(written.priority).toBe('high')
  expect(written).not.toHaveProperty('status')
  expect(written).not.toHaveProperty('progress_percent')
  expect(state.records[17].tasks.find(row => row.id === task.id)).toMatchObject({ status: 'in_progress', progress_percent: 60 })
  clean(state)
})


const disciplineRow = (page, label) => page.getByRole('row').filter({ has: page.getByRole('button', { name: new RegExp(`^(Expand|Collapse) ${label}$`) }) })
const employeeActivity = page => page.getByRole('dialog', { name: 'Employee activity', exact: true })

function prepareEmployeeActivity(state) {
  const record = state.records[17]
  const person = planningEmployees[0]
  const manager = { user_id: 9, name: 'Layla Ahmed' }
  const task = (id, wbsId, title, overrides = {}) => ({
    project_task_id: id, wbs_task_id: wbsId, title, discipline: 'process', task_type: 'deliverable',
    status: 'in_progress', progress_percent: 45, due_date: '2026-09-14', priority: 'high',
    assignment_state: 'current', role: 'assignee', assigned_by: manager, assigned_at: '2026-09-10T06:00:00Z',
    assigned_to: person, reviewer: planningEmployees[2], ...overrides,
  })
  const snapshot = (overrides = {}) => ({ assignee_id: 7, reviewer_id: 9, status: 'todo', progress_percent: 0, ...overrides })
  state.employeeActivities['71:7'] = {
    employee: person, project: { id: 17, planning_project_id: 71, code: record.project.code, name: record.project.name },
    summary: { total_tasks: 3, current_tasks: 2, historical_tasks: 1, open: 1, in_progress: 1, review: 0, completed: 1, blocked: 0, overdue: 1 },
    tasks: [task(4101, 'process-1', 'Process design basis'), task(4102, 'process-2', 'Hydraulic calculations', { status: 'completed', progress_percent: 100, due_date: '2026-09-12' }),
      task(4103, 'old-1', 'Commissioning checklist', { status: 'blocked', progress_percent: 25, assignment_state: 'historical', assigned_to: planningEmployees[1] })],
    activity: [
      { id: 'event-5', event_id: 5, project_task_id: 4101, wbs_task_id: 'process-1', title: 'Process design basis', action: 'progress_updated', actor: { user_id: 7, name: person.name }, timestamp: '2026-09-15T06:25:00Z', before: snapshot({ status: 'in_progress', progress_percent: 25 }), after: snapshot({ status: 'in_progress', progress_percent: 45 }) },
      { id: 'event-4', event_id: 4, project_task_id: 4102, wbs_task_id: 'process-2', title: 'Hydraulic calculations', action: 'completed', actor: manager, timestamp: '2026-09-14T06:20:00Z', before: snapshot({ status: 'review', progress_percent: 90 }), after: snapshot({ status: 'completed', progress_percent: 100 }) },
      { id: 'event-3', event_id: 3, project_task_id: 4103, wbs_task_id: 'old-1', title: 'Commissioning checklist', action: 'reassigned', actor: manager, timestamp: '2026-09-13T06:15:00Z', before: snapshot({ status: 'blocked', progress_percent: 25 }), after: snapshot({ assignee_id: 8, status: 'blocked', progress_percent: 25 }) },
      { id: 'event-2', event_id: 2, project_task_id: 4101, wbs_task_id: 'process-1', title: 'Process design basis', action: 'status_changed', actor: { user_id: 7, name: person.name }, timestamp: '2026-09-12T06:10:00Z', before: snapshot(), after: snapshot({ status: 'in_progress', progress_percent: 25 }) },
      { id: 'event-1', event_id: 1, project_task_id: 4101, wbs_task_id: 'process-1', title: 'Process design basis', action: 'assigned', actor: manager, timestamp: '2026-09-10T06:00:00Z', before: {}, after: snapshot() },
    ],
  }
  Object.assign(record.workBreakdown.tasks[0], { project_task_id: 4101, status: 'in_progress', progress_percent: 45, due_date: '2026-09-14' })
}

test('collapsed discipline rows keep real employee status and latest due date visible and expand all restores tasks', async ({ page }) => {
  const state = await openWbs(page, { prepare(current) {
    const tasks = current.records[17].workBreakdown.tasks
    Object.assign(tasks[0], { status: 'in_progress', due_date: '2026-10-06' })
    Object.assign(tasks[1], { status: 'in_progress', due_date: '2026-10-12', assignee_id: 7, assignee: planningEmployees[0], owner: 'Maya Hassan' })
  } })
  await page.getByRole('button', { name: 'Collapse all', exact: true }).click()
  await expect(taskRow(page, 'Process design basis')).toHaveCount(0)
  const process = disciplineRow(page, 'Process Engineering')
  await expect(process).toContainText('Maya Hassan')
  await expect(process).toContainText('In progress')
  await expect(process).toContainText('12 Oct')
  await expect(process.getByRole('button', { name: 'Expand Process Engineering', exact: true })).toHaveAttribute('aria-expanded', 'false')
  await page.screenshot({ path: '../artifacts/work-breakdown-collapsed-summary-desktop.png', fullPage: true, animations: 'disabled' })
  await page.getByRole('button', { name: 'Expand all', exact: true }).click()
  for (const task of state.records[17].workBreakdown.tasks) await expect(taskRow(page, task.title)).toBeVisible()
  expect(state.writes).toEqual([])
  clean(state)
})

test('saving a task automatically expands its discipline while leaving other collapsed disciplines closed', async ({ page }) => {
  const state = await openWbs(page)
  await page.getByRole('button', { name: 'Collapse all', exact: true }).click()
  await page.getByRole('button', { name: 'Add task', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add task', exact: true })
  await dialog.getByRole('textbox', { name: 'Task / deliverable', exact: true }).fill('Verify piping interfaces')
  await dialog.getByRole('combobox', { name: 'Discipline', exact: true }).selectOption('piping')
  await selectEmployee(dialog, 'Assigned to', 8)
  await dialog.getByRole('button', { name: 'Add task', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(taskRow(page, 'Verify piping interfaces')).toBeVisible()
  await expect(disciplineRow(page, 'Piping Engineering').getByRole('button', { name: 'Collapse Piping Engineering', exact: true })).toHaveAttribute('aria-expanded', 'true')
  await expect(disciplineRow(page, 'Process Engineering').getByRole('button', { name: 'Expand Process Engineering', exact: true })).toHaveAttribute('aria-expanded', 'false')
  expect(savedWrites(state)).toHaveLength(1)
  clean(state)
})


async function openEmployeeActivity(page) {
  await taskRow(page, 'Process design basis').getByRole('button', { name: 'View activity for Maya Hassan', exact: true }).click()
  const dialog = employeeActivity(page)
  await expect(dialog).toBeVisible()
  return dialog
}

test('employee name opens read-only activity and assignment history while the pencil opens the assignment editor', async ({ page }) => {
  const state = await openWbs(page, { prepare: prepareEmployeeActivity })
  const dialog = await openEmployeeActivity(page)
  await expect(dialog.getByRole('combobox', { name: 'Task', exact: true })).toHaveValue('4101')
  await expect(dialog).toContainText('Maya Hassan')
  await expect(dialog).toContainText('Layla Ahmed')
  await expect(dialog).toContainText('45%')
  await expect(dialog).toContainText('Progress updated')
  await expect(page.getByRole('dialog', { name: 'Edit task', exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('combobox', { name: 'Assigned to', exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Save task', exact: true })).toHaveCount(0)
  expect(state.requests.filter(request => request.path.endsWith('/employee-activity/'))).toEqual([expect.objectContaining({ path: '/api/v1/planning-intelligence/projects/71/employee-activity/', method: 'GET', query: { user_id: '7' } })])
  const bounds = await dialog.boundingBox()
  const viewport = page.viewportSize()
  expect(Math.abs(bounds.x + bounds.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(2)
  expect(Math.abs(bounds.y + bounds.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(2)
  await page.screenshot({ path: '../artifacts/work-breakdown-employee-activity-desktop.png', animations: 'disabled' })
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await taskRow(page, 'Process design basis').getByRole('button', { name: 'Change assignee for Process design basis', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Edit task', exact: true })
  await expect(editor.getByRole('combobox', { name: 'Assigned to', exact: true })).toHaveValue('Maya Hassan')
  await expect(employeeActivity(page)).toHaveCount(0)
  expect(state.writes).toEqual([])
  clean(state)
})

test('collapsed employee summaries open all tasks and filters show completed and previous assignment history', async ({ page }) => {
  const state = await openWbs(page, { prepare: prepareEmployeeActivity })
  await page.getByRole('button', { name: 'Collapse all', exact: true }).click()
  await disciplineRow(page, 'Process Engineering').getByRole('button', { name: 'View activity for Maya Hassan', exact: true }).click()
  const dialog = employeeActivity(page)
  const filter = dialog.getByRole('combobox', { name: 'Task', exact: true })
  await expect(filter.locator('option:checked')).toHaveText('All tasks')
  await expect(dialog).toContainText('Commissioning checklist')
  await expect(dialog).toContainText('Hydraulic calculations')
  await filter.selectOption('4102')
  await expect(dialog).toContainText('100%')
  await expect(dialog).toContainText('Completed')
  await expect(dialog.getByText('Progress updated', { exact: true })).toHaveCount(0)
  await filter.selectOption('4103')
  await expect(dialog).toContainText('Assignment changed')
  await expect(dialog).toContainText('Omar Saleh')
  await filter.selectOption({ label: 'All tasks' })
  await expect(dialog.getByText('Progress updated', { exact: true })).toBeVisible()
  expect(state.requests.filter(request => request.path.endsWith('/employee-activity/'))).toHaveLength(1)
  expect(state.writes).toEqual([])
  clean(state)
})

test('employee activity failures have a retry that restores the read-only history and refreshes from the server', async ({ page }) => {
  const state = await openWbs(page, { prepare(current) {
    prepareEmployeeActivity(current)
    current.employeeActivityError = { status: 503, body: { detail: 'Employee activity is temporarily unavailable.' } }
  } })
  const dialog = await openEmployeeActivity(page)
  await expect(dialog.getByRole('alert')).toContainText('Employee activity is temporarily unavailable.')
  state.employeeActivityError = null
  await dialog.getByRole('button', { name: 'Retry employee activity', exact: true }).click()
  await expect(dialog).toContainText('Progress updated')
  await expect(dialog.getByRole('button', { name: 'Close employee activity', exact: true })).toBeFocused()
  const reads = state.requests.filter(request => request.path.endsWith('/employee-activity/')).length
  state.employeeActivities['71:7'].tasks[0].progress_percent = 55
  await dialog.getByRole('button', { name: 'Refresh activity', exact: true }).click()
  await expect(dialog).toContainText('55%')
  await expect(dialog.getByRole('button', { name: 'Close employee activity', exact: true })).toBeFocused()
  expect(state.requests.filter(request => request.path.endsWith('/employee-activity/'))).toHaveLength(reads + 1)
  expect(state.writes).toEqual([])
  clean(state)
})

test('missing assignment evidence stays explicitly unrecorded instead of inventing assignment dates or history', async ({ page }) => {
  const state = await openWbs(page, { prepare(current) {
    prepareEmployeeActivity(current)
    const data = current.employeeActivities['71:7']
    data.tasks = [{ ...data.tasks[0], assigned_at: null, assigned_by: null }]
    data.activity = []
    data.summary = { ...data.summary, total_tasks: 1, current_tasks: 1, historical_tasks: 0, completed: 0 }
  } })
  const dialog = await openEmployeeActivity(page)
  await expect(dialog).toContainText('Not recorded')
  await expect(dialog.getByText('Progress updated', { exact: true })).toHaveCount(0)
  await expect(dialog.getByText('Layla Ahmed', { exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Save task', exact: true })).toHaveCount(0)
  expect(state.writes).toEqual([])
  clean(state)
})

test('mobile employee activity is centered keyboard accessible and read only for planners without assignment permission', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const state = await openWbs(page, { prepare(current) {
    prepareEmployeeActivity(current)
    current.records[17].workBreakdown.permissions = { can_assign: false }
  } })
  const trigger = taskRow(page, 'Process design basis').getByRole('button', { name: 'View activity for Maya Hassan', exact: true })
  await expect(trigger).toBeEnabled()
  await expect(taskRow(page, 'Process design basis').getByRole('button', { name: 'Change assignee for Process design basis', exact: true })).toBeDisabled()
  const dialog = await openEmployeeActivity(page)
  await expect(dialog).toContainText('Progress updated')
  const bounds = await dialog.boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
  expect(bounds.y).toBeGreaterThanOrEqual(0)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(844)
  const scan = await new AxeBuilder({ page }).include('[role="dialog"]').analyze()
  expect(scan.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
  await page.screenshot({ path: '../artifacts/work-breakdown-employee-activity-mobile.png', animations: 'disabled' })
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
  expect(state.writes).toEqual([])
  clean(state)
})

test('historical audit entries without a current task ID remain filterable and unknown progress is not fabricated', async ({ page }) => {
  const state = await openWbs(page, { prepare(current) {
    prepareEmployeeActivity(current)
    const data = current.employeeActivities['71:7']
    Object.assign(data.tasks[2], { project_task_id: null, status: null, progress_percent: null, assigned_at: null, assigned_by: null })
    const event = data.activity.find(entry => entry.wbs_task_id === 'old-1')
    Object.assign(event, { project_task_id: null, actor: null, timestamp: null })
    Object.assign(event.before, { status: null, progress_percent: null })
    Object.assign(event.after, { status: null, progress_percent: null })
  } })
  const dialog = await openEmployeeActivity(page)
  await dialog.getByRole('combobox', { name: 'Task', exact: true }).selectOption({ label: 'Commissioning checklist' })
  const assignments = dialog.getByRole('region', { name: /Assigned work/ })
  const history = dialog.getByRole('region', { name: /Activity history/ })
  await expect(assignments.getByRole('heading', { name: 'Commissioning checklist', exact: true })).toBeVisible()
  await expect(assignments).toContainText('Previous assignment')
  await expect(assignments.getByRole('progressbar')).toHaveCount(0)
  await expect(assignments).toContainText('Not recorded')
  await expect(history).toContainText('Assignment changed')
  await expect(history).toContainText('Actor not recorded')
  await expect(history).toContainText('Omar Saleh')
  await expect(history.getByText('Progress updated', { exact: true })).toHaveCount(0)
  expect(state.writes).toEqual([])
  clean(state)
})
