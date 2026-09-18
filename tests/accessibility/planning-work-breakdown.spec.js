import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { confirmPlanningEvidence, planningInputsHarness, workBreakdownRecord } from '../fixtures/planning-inputs.fixture'

test.setTimeout(60000)

const stage = page => page.getByRole('navigation', { name: 'Planning stages', exact: true }).getByRole('button', { name: /Work breakdown/ })
const heading = page => page.getByRole('heading', { name: 'Work breakdown', exact: true })
const savedWrites = state => state.writes.filter(write => write.path.endsWith('/work-breakdown/'))
const taskRow = (page, title) => page.getByRole('row').filter({ hasText: title })
const saveWbs = page => page.getByRole('button', { name: 'Save work breakdown', exact: true })
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
  const activity = (id, discipline, title, owner, effort, dependencies = []) => ({ id, discipline, title, owner, effort_hours: effort, depends_on: dependencies, acceptance_criteria: '', reviewer: '', source_references: [] })
  base.tasks = [
    activity('process-1', 'process', 'Process design basis', 'Lead Process Engineer', 16),
    activity('process-2', 'process', 'Hydraulic calculations', complete ? 'Process Engineer' : '', 8, ['process-1']),
    activity('piping-1', 'piping', 'Piping isometric drawings', 'Lead Piping Engineer', 24, ['process-1']),
    activity('piping-2', 'piping', 'Tie-in details', complete ? 'Piping Engineer' : '', complete ? 12 : null, ['piping-1']),
    activity('piping-3', 'piping', 'Stress analysis', 'Stress Engineer', 32),
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
  await expect(page.getByRole('button', { name: /Assign owner.*Hydraulic calculations/ })).toBeVisible()
  expect(state.writes).toEqual([])
  await fitsViewport(page)
  await page.screenshot({ path: '../artifacts/project-planning-work-breakdown-desktop.png', fullPage: true, animations: 'disabled' })
  clean(state)
})

test('add task saves owner effort dependencies and review requirements and reload restores them', async ({ page }) => {
  const state = await openWbs(page)
  await page.getByRole('button', { name: 'Add task', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add task', exact: true })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('textbox', { name: 'Task / deliverable', exact: true }).fill('Tie-in site verification')
  await dialog.getByRole('combobox', { name: 'Discipline', exact: true }).selectOption('piping')
  await dialog.getByRole('textbox', { name: 'Owner', exact: true }).fill('Piping Lead')
  await dialog.getByRole('spinbutton', { name: 'Planned effort (hours)', exact: true }).fill('18')
  await dialog.getByRole('checkbox', { name: /Piping isometric drawings/ }).check()
  await dialog.getByRole('textbox', { name: 'Acceptance criteria', exact: true }).fill('Approved walkdown and tie-in register.')
  await dialog.getByRole('textbox', { name: 'Reviewer', exact: true }).fill('Project Manager')
  await dialog.getByRole('button', { name: 'Add task', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(taskRow(page, 'Tie-in site verification')).toContainText('Piping Lead')
  expect(savedWrites(state)).toEqual([])
  await saveWbs(page).click()
  await expect.poll(() => savedWrites(state).length).toBe(1)
  const created = savedWrites(state)[0].data.tasks.find(task => task.title === 'Tie-in site verification')
  expect(created).toMatchObject({ discipline: 'piping', owner: 'Piping Lead', effort_hours: 18, depends_on: ['piping-1'], acceptance_criteria: 'Approved walkdown and tie-in register.', reviewer: 'Project Manager' })
  expect(savedWrites(state)[0]).toMatchObject({ method: 'PUT', path: '/api/v1/planning-intelligence/projects/71/work-breakdown/', data: { intelligence_run_id: 901, revision: 0 } })
  await expect(page.getByText('Work breakdown saved.', { exact: true })).toBeVisible()
  await page.reload()
  await expect(stage(page)).toBeEnabled()
  await stage(page).click()
  await expect(taskRow(page, 'Tie-in site verification')).toContainText('Piping Lead')
  await taskRow(page, 'Tie-in site verification').getByRole('button', { name: 'Tie-in site verification', exact: true }).click()
  const edit = page.getByRole('dialog', { name: 'Edit task', exact: true })
  await expect(edit.getByRole('spinbutton', { name: 'Planned effort (hours)', exact: true })).toHaveValue('18')
  await expect(edit.getByRole('checkbox', { name: /Piping isometric drawings/ })).toBeChecked()
  await expect(edit.getByRole('textbox', { name: 'Acceptance criteria', exact: true })).toHaveValue('Approved walkdown and tie-in register.')
  await expect(edit.getByRole('textbox', { name: 'Reviewer', exact: true })).toHaveValue('Project Manager')
  await edit.getByRole('spinbutton', { name: 'Planned effort (hours)', exact: true }).fill('20')
  await edit.getByRole('button', { name: 'Save task', exact: true }).click()
  await saveWbs(page).click()
  await expect.poll(() => savedWrites(state).length).toBe(2)
  expect(savedWrites(state)[1].data.revision).toBe(1)
  expect(state.records[17].workBreakdown.tasks.find(task => task.id === created.id).effort_hours).toBe(20)
  clean(state)
})

test('assigning an owner updates the task while failed work breakdown saves preserve edits for retry', async ({ page }) => {
  const state = await openWbs(page)
  await page.getByRole('button', { name: /Assign owner.*Hydraulic calculations/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit task', exact: true })
  await dialog.getByRole('textbox', { name: 'Owner', exact: true }).fill('Process Calculation Lead')
  await dialog.getByRole('button', { name: 'Save task', exact: true }).click()
  await expect(taskRow(page, 'Hydraulic calculations')).toContainText('Process Calculation Lead')
  state.wbsSaveError = { error: 'Work breakdown storage is temporarily unavailable. Please retry.', code: 'work_breakdown_save_unavailable' }
  state.wbsStatus = 503
  await saveWbs(page).click()
  await expect(page.getByRole('alert').filter({ hasText: 'storage is temporarily unavailable' })).toBeVisible()
  await expect(taskRow(page, 'Hydraulic calculations')).toContainText('Process Calculation Lead')
  expect(state.records[17].workBreakdown.tasks.find(task => task.id === 'process-2').owner).toBe('')
  state.wbsSaveError = null
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect.poll(() => state.records[17].workBreakdown.tasks.find(task => task.id === 'process-2').owner).toBe('Process Calculation Lead')
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
  await saveWbs(page).click()
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

test('task dependencies cannot form a circular sequence and unsaved edits stay available when leaving is cancelled', async ({ page }) => {
  const state = await openWbs(page)
  await taskRow(page, 'Process design basis').getByRole('button', { name: 'Process design basis', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit task', exact: true })
  await dialog.getByRole('checkbox', { name: 'Hydraulic calculations', exact: true }).check()
  await dialog.getByRole('button', { name: 'Save task', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('circular sequence')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('checkbox', { name: 'Hydraulic calculations', exact: true }).uncheck()
  await dialog.getByRole('textbox', { name: 'Owner', exact: true }).fill('Updated Process Lead')
  await dialog.getByRole('button', { name: 'Save task', exact: true }).click()
  await page.getByRole('button', { name: 'Manage inputs', exact: true }).click()
  const leave = page.getByRole('dialog', { name: 'Save work breakdown?', exact: true })
  await expect(leave).toBeVisible()
  await leave.getByRole('button', { name: 'Keep editing', exact: true }).click()
  await expect(taskRow(page, 'Process design basis')).toContainText('Updated Process Lead')
  expect(state.writes).toEqual([])
  await saveWbs(page).click()
  await expect.poll(() => savedWrites(state).length).toBe(1)
  await page.getByRole('button', { name: 'Manage inputs', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Scope summary', exact: true })).toBeVisible()
  await expect(heading(page)).toHaveCount(0)
  clean(state)
})
