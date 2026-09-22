import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { masterScheduleHarness, registerNames } from '../fixtures/master-schedule.fixture.js'
import { scheduleArea, scheduleVersion } from '../fixtures/schedule-controls.js'

test.setTimeout(60000)

const workspace = page => page.getByRole('region', { name: 'Master schedule workspace', exact: true })
const approval = page => page.getByRole('dialog', { name: 'Review & publish baseline', exact: true })
const issues = page => page.getByRole('region', { name: 'Schedule issues', exact: true })
const submit = page => approval(page).getByRole('button', { name: 'Submit for approval', exact: true })
const simpleWrites = state => state.writes.filter(item => item.path.includes('/simple-plan/'))
const reason = 'The schedule finishes 2 working days after the required project finish.'
const clean = state => {
  expect(state.pageErrors).toEqual([])
  expect(state.unknownWrites).toEqual([])
  expect(state.unknown).toEqual([])
}

const deadlineIssue = task => ({
  code: 'negative_float', severity: 'critical', message: reason,
  task_ids: [task.id], task_count: 1, field: 'duration_days', minimum_float_days: -2,
  forecast_finish_date: task.planned_finish_date, target_finish_date: '2026-12-20',
  resolution: 'Review the activity duration and its predecessor links against the approved schedule.',
  affected_activities: [{
    task_id: task.id, title: task.title, planned_start_date: task.planned_start_date,
    planned_finish_date: task.planned_finish_date, duration_days: task.duration_days, total_float_days: -2,
  }],
})

async function open(page, options = {}) {
  const state = await masterScheduleHarness(page, options)
  await expect(workspace(page).getByRole('heading', { name: 'Master Schedule', exact: true })).toBeVisible()
  return state
}

async function review(page) {
  await workspace(page).getByRole('button', { name: 'Review & approve', exact: true }).click()
  await expect(approval(page)).toBeVisible()
}

test('repeated missing durations become one actionable review with every activity still reachable', async ({ page }) => {
  const state = await open(page, {
    prepare(current) {
      const plan = current.records[17].simplePlan
      plan.tasks = Array.from({ length: 220 }, (_, index) => ({
        ...plan.tasks[0], id: `missing-${index + 1}`, title: `Source deliverable ${index + 1}`,
        activity_code: `MDR-${index + 1}`, duration_days: null, planned_start_date: null,
        planned_finish_date: null, total_float_days: null, depends_on: [],
      }))
    },
    decorateSnapshot(plan) {
      plan.blockers = [
        { code: 'reference_schedule_not_imported', message: 'Uploaded activity dates, calendar and relationships require review.' },
        ...plan.tasks.map(task => ({ code: 'duration_required', task_id: task.id, field: 'duration_days', message: `${task.title} has no source duration.` })),
      ]
      return plan
    },
  })
  await workspace(page).getByRole('button', { name: 'Review 2 actions', exact: true }).click()
  await expect(issues(page)).toContainText('2 review actions need attention before submission.')
  await expect(issues(page).locator('article')).toHaveCount(2)
  await expect(issues(page)).toContainText('220 affected activities')
  await expect(issues(page)).toContainText('Project start and finish define the planning window.')
  const durationReview = issues(page).locator('article').filter({ has: page.getByRole('heading', { name: 'Review activity durations against the documents', exact: true }) })
  await expect(durationReview.getByRole('button', { name: 'Project inputs', exact: true })).toBeEnabled()
  await durationReview.getByRole('button', { name: 'Show all 220 affected activities', exact: true }).click()
  await durationReview.getByRole('button', { name: 'Edit activity Source deliverable 220', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Edit task', exact: true })
  await expect(editor.getByLabel('Task / deliverable', { exact: true })).toHaveValue('Source deliverable 220')
  await expect(editor.getByLabel('Duration (working days)', { exact: true })).toHaveValue('')
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(state.writes).toEqual([])
  expect(state.records[17].simplePlan.tasks.every(task => task.duration_days === null && !task.depends_on.length)).toBe(true)
  clean(state)
})

test('a timing warning explains the affected activity and allows an optional reviewed correction before submitting', async ({ page }) => {
  const state = await open(page, {
    prepare(current) {
      const task = current.records[17].simplePlan.tasks[0]
      Object.assign(task, { activity_code: 'ACT-001', planned_start_date: '2026-12-17', planned_finish_date: '2026-12-22', duration_days: 4, total_float_days: null })
    },
    decorateSnapshot(plan, record) {
      if (record.project.id === 17 && plan.tasks[0].duration_days > 2) plan.warnings = [deadlineIssue(plan.tasks[0])]
      return plan
    },
  })
  const targetBefore = state.records[17].project.end_date
  const unchangedTask = structuredClone(state.records[17].simplePlan.tasks[1])
  await review(page)
  await expect(approval(page).getByRole('heading', { name: 'Review timing warnings', exact: true })).toBeVisible()
  await expect(issues(page)).toContainText(reason)
  await expect(issues(page)).toContainText(registerNames[0])
  await expect(issues(page)).toContainText('Review the activity duration and its predecessor links')
  await expect(issues(page)).toContainText('20 Dec 2026')
  await expect(issues(page)).toContainText('22 Dec 2026')
  await expect(issues(page).getByRole('cell', { name: '-2 d', exact: true })).toBeVisible()
  await expect(submit(page)).toBeEnabled()
  expect(simpleWrites(state)).toHaveLength(0)
  expect(state.records[17].simplePlan.tasks[0].duration_days).toBe(4)
  const scan = await new AxeBuilder({ page }).include('[aria-label="Schedule issues"]').analyze()
  expect(scan.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
  await issues(page).scrollIntoViewIfNeeded()
  await page.screenshot({ path: '../artifacts/schedule-checks-approval.png', animations: 'disabled' })

  await issues(page).getByRole('button', { name: `Edit activity ${registerNames[0]}`, exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Edit task', exact: true })
  await expect(editor).toBeVisible()
  await expect(editor.getByLabel('Task / deliverable', { exact: true })).toHaveValue(registerNames[0])
  await editor.getByLabel('Duration (working days)', { exact: true }).fill('2')
  await editor.getByRole('button', { name: 'Save task', exact: true }).click()
  await expect(editor).toHaveCount(0)
  await expect(approval(page)).toBeVisible()
  await expect(submit(page)).toBeEnabled()
  const saved = simpleWrites(state).find(item => item.method === 'PUT')
  expect(saved.data.tasks[0]).toMatchObject({ id: 'register-1', duration_days: 2, planned_start_date: '2026-12-17', depends_on: [] })
  expect(state.records[17].simplePlan.tasks[0].planned_finish_date).toBe('2026-12-18')
  expect(state.records[17].simplePlan.tasks[1]).toMatchObject({ id: unchangedTask.id, title: unchangedTask.title, planned_start_date: unchangedTask.planned_start_date, duration_days: unchangedTask.duration_days, depends_on: unchangedTask.depends_on })
  expect(state.records[17].project.end_date).toBe(targetBefore)
  expect(state.writes.some(item => item.method === 'PATCH' || item.path.endsWith('/apply-schedule/'))).toBe(false)
  await submit(page).click()
  await expect(approval(page).getByRole('button', { name: 'Approve & publish baseline', exact: true })).toBeEnabled()
  expect(simpleWrites(state).filter(item => item.path.endsWith('/submit/')).map(item => item.data.revision)).toEqual([5])
  clean(state)
})

test('checking the same revision cannot dismiss a submission-only blocker missing from the draft response', async ({ page }) => {
  const state = await open(page, {
    async handleRequest({ route, path, record, state: current, reply }) {
      if (!path.endsWith('/submit/')) return false
      current.writes.push({ method: 'POST', path, data: route.request().postDataJSON() })
      await reply(route, { error: 'Resolve the schedule checks before submitting.', code: 'simple_plan_schedule_blocked', blockers: [{ code: 'resource_capacity', message: 'Omar Saleh is assigned beyond available capacity.', activities: [record.simplePlan.tasks[1].id], field: 'owner' }] }, 400)
      return true
    },
  })
  await review(page)
  await submit(page).click()
  await expect(issues(page)).toContainText('Omar Saleh is assigned beyond available capacity.')
  await expect(issues(page).getByRole('button', { name: `Edit activity ${registerNames[1]}`, exact: true })).toBeEnabled()
  const before = state.requests.filter(item => item.method === 'GET' && item.path.endsWith('/simple-plan/')).length
  await issues(page).getByRole('button', { name: 'Check again', exact: true }).click()
  await expect.poll(() => state.requests.filter(item => item.method === 'GET' && item.path.endsWith('/simple-plan/')).length).toBeGreaterThan(before)
  await expect(issues(page)).toContainText('Omar Saleh is assigned beyond available capacity.')
  await expect(submit(page)).toBeDisabled()
  expect(simpleWrites(state)).toHaveLength(1)
  clean(state)
})

test('all affected activities remain reachable beyond the old 25-item limit', async ({ page }) => {
  const state = await open(page, {
    prepare(current) {
      const plan = current.records[17].simplePlan
      plan.tasks = Array.from({ length: 31 }, (_, index) => ({ ...plan.tasks[0], id: `late-${index + 1}`, title: `Late deliverable ${String(index + 1).padStart(2, '0')}`, activity_code: `LATE-${index + 1}`, total_float_days: -2, depends_on: [] }))
    },
    decorateSnapshot(plan) {
      plan.blockers = [{ ...deadlineIssue(plan.tasks[0]), task_count: plan.tasks.length, task_ids: plan.tasks.map(task => task.id), affected_activities: plan.tasks.map(task => ({ task_id: task.id, title: task.title, total_float_days: -2 })) }]
      return plan
    },
  })
  await workspace(page).getByRole('button', { name: 'Review 1 timing warning', exact: true }).click()
  await expect(issues(page).getByRole('heading', { name: 'Review timing warnings', exact: true })).toBeVisible()
  const last = issues(page).getByRole('button', { name: 'Edit activity Late deliverable 31', exact: true })
  if (!await last.isVisible()) {
    const more = issues(page).getByRole('button', { name: /Show all|Show more|Next/i })
    if (await more.count()) await more.first().click()
  }
  await expect(last).toBeVisible()
  await last.click()
  const editor = page.getByRole('dialog', { name: 'Edit task', exact: true })
  await expect(editor.getByLabel('Task / deliverable', { exact: true })).toHaveValue('Late deliverable 31')
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(state.writes).toEqual([])
  clean(state)
})

test('historical schedule checks explain issues without permitting repairs', async ({ page }) => {
  const state = await open(page, { history: true, decorateSnapshot(plan) { plan.blockers = [deadlineIssue(plan.tasks[0])]; return plan } })
  await scheduleVersion(page, '90')
  await scheduleArea(page, 'assurance')
  await expect(issues(page)).toContainText(reason)
  const edit = issues(page).getByRole('button', { name: `Edit activity ${registerNames[0]}`, exact: true })
  if (await edit.count()) await expect(edit).toBeDisabled()
  await expect(page.getByRole('dialog', { name: 'Edit task', exact: true })).toHaveCount(0)
  expect(state.writes).toEqual([])
  clean(state)
})

test('calculated issue evidence does not silently replace the saved activity constraints when editing', async ({ page }) => {
  const state = await open(page, {
    decorateSnapshot(plan) {
      const task = plan.tasks[0]
      plan.blockers = [{ ...deadlineIssue(task), forecast_finish_date: '2026-12-24', affected_activities: [{ task_id: task.id, title: task.title, planned_start_date: '2026-12-22', planned_finish_date: '2026-12-24', duration_days: 3, total_float_days: -3 }] }]
      return plan
    },
  })
  const before = structuredClone(state.records[17].simplePlan.tasks[0])
  await workspace(page).getByRole('button', { name: 'Review 1 timing warning', exact: true }).click()
  await expect(issues(page).getByRole('cell', { name: '22 Dec 2026', exact: true })).toBeVisible()
  await expect(issues(page).getByRole('cell', { name: '24 Dec 2026', exact: true })).toBeVisible()
  await issues(page).getByRole('button', { name: `Edit activity ${before.title}`, exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Edit task', exact: true })
  await expect(editor.getByLabel('Planned start', { exact: true })).toHaveValue(before.planned_start_date)
  await expect(editor.getByLabel('Duration (working days)', { exact: true })).toHaveValue(String(before.duration_days))
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(state.records[17].simplePlan.tasks[0]).toEqual(before)
  expect(state.writes).toEqual([])
  clean(state)
})

test('a delayed check response from the previous project cannot replace the newly selected schedule', async ({ page }) => {
  const state = await open(page, {
    prepare(current) {
      current.pauseChecks = false
      current.records[18].simplePlan.tasks = [{ ...current.records[18].simplePlan.tasks[0], id: 'grid-task', title: 'Grid protection review' }]
    },
    async handleRequest({ route, path, record, state: current, reply }) {
      if (route.request().method() !== 'GET' || !path.endsWith('/simple-plan/') || record.project.id !== 17 || !current.pauseChecks) return false
      current.pauseChecks = false
      const oldPlan = structuredClone(record.simplePlan)
      oldPlan.permissions = { can_edit: true, can_assign: true, can_submit: false }
      oldPlan.blockers = [{ ...deadlineIssue(oldPlan.tasks[0]), message: 'Previous project requires a duration correction.' }]
      await new Promise(resolve => { current.releaseChecks = resolve })
      await reply(route, oldPlan)
      current.oldChecksDelivered = true
      return true
    },
  })
  await scheduleArea(page, 'assurance')
  state.pauseChecks = true
  await issues(page).getByRole('button', { name: 'Check again', exact: true }).click()
  await expect.poll(() => Boolean(state.releaseChecks)).toBe(true)
  try {
    await page.locator('summary[aria-label="More project actions"]').click()
    const selector = page.getByRole('combobox', { name: 'Active Project', exact: true })
    await selector.fill('5900738')
    await selector.press('Enter')
    await expect(page).toHaveURL(/project=18/)
    await expect(workspace(page).getByRole('button', { name: 'Grid protection review', exact: true })).toBeVisible()
  } finally { state.releaseChecks() }
  await expect.poll(() => state.oldChecksDelivered).toBe(true)
  await scheduleArea(page, 'assurance')
  await expect(issues(page)).not.toContainText('Previous project requires a duration correction.')
  await expect(issues(page).getByRole('heading', { name: 'Resolve schedule issues', exact: true })).toHaveCount(0)
  expect(state.writes).toEqual([])
  clean(state)
})
