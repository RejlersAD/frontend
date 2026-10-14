import { test, expect } from '@playwright/test'
import { masterScheduleHarness } from '../fixtures/master-schedule.fixture.js'

const workspace = page => page.getByRole('region', { name: 'Master schedule workspace', exact: true })
const approval = page => page.getByRole('dialog', { name: 'Review & publish baseline', exact: true })
const checks = page => page.getByRole('region', { name: 'Schedule issues', exact: true })
const timing = task => ({
  code: 'negative_float', severity: 'critical', message: 'Activity requires 3 working days of timing recovery.',
  task_ids: [task.id], minimum_float_days: -3, target_finish_date: '2026-12-20',
  forecast_finish_date: '2026-12-23',
  affected_activities: [{ task_id: task.id, title: task.title, total_float_days: -3 }],
})
const clean = state => {
  expect(state.pageErrors).toEqual([])
  expect(state.unknownWrites).toEqual([])
  expect(state.unknown).toEqual([])
}

test('timing warnings allow authorized submission and publication without changing project dates or activities', async ({ page }) => {
  const state = await masterScheduleHarness(page, {
    decorateSnapshot(plan) {
      // A retained legacy blocker and the current warning must render once.
      const issue = timing(plan.tasks[0])
      plan.blockers = [issue]
      plan.warnings = [{ ...issue, severity: 'warning' }, {
        code: 'contract_finish_overrun', message: 'Forecast exceeds the fixed project finish.',
        target_finish_date: '2026-12-20', forecast_finish_date: '2026-12-23', task_ids: [plan.tasks[0].id],
      }]
      return plan
    },
  })
  const before = structuredClone(state.records[17])
  await workspace(page).getByRole('button', { name: 'Review 2 timing warnings', exact: true }).click()
  await expect(checks(page).getByRole('heading', { name: 'Review timing warnings', exact: true })).toBeVisible()
  await expect(checks(page).getByText('Activity requires 3 working days of timing recovery.', { exact: true })).toHaveCount(1)
  await expect(checks(page)).toContainText('Timing warnings do not prevent submission or baseline approval.')
  await expect(checks(page).getByRole('cell', { name: '-3 d', exact: true })).toBeVisible()
  await workspace(page).getByRole('button', { name: 'Review & approve', exact: true }).click()
  await expect(approval(page)).toBeVisible()
  const submit = approval(page).getByRole('button', { name: 'Submit for approval', exact: true })
  await expect(submit).toBeEnabled()
  await submit.click()
  const publish = approval(page).getByRole('button', { name: 'Approve & publish baseline', exact: true })
  await expect(publish).toBeEnabled()
  await publish.click()
  await expect(approval(page).getByRole('heading', { name: 'Baseline published', exact: true })).toBeVisible()
  expect(state.records[17].simplePlan.tasks).toEqual(before.simplePlan.tasks)
  expect(state.records[17].project.start_date).toBe(before.project.start_date)
  expect(state.records[17].project.end_date).toBe(before.project.end_date)
  expect(state.writes.map(item => item.path.split('/').filter(Boolean).at(-1))).toEqual(['submit', 'approve-publish'])
  clean(state)
})

test('timing warnings do not bypass a genuine dependency blocker', async ({ page }) => {
  const state = await masterScheduleHarness(page, {
    decorateSnapshot(plan) {
      plan.blockers = [{ code: 'dependency_cycle', message: 'Activities form a dependency loop.', task_ids: [plan.tasks[0].id], field: 'depends_on' }]
      plan.warnings = [timing(plan.tasks[0])]
      return plan
    },
  })
  await workspace(page).getByRole('button', { name: 'Review 1 action', exact: true }).click()
  await expect(checks(page)).toContainText('1 review action needs attention before submission.')
  await expect(checks(page)).toContainText('Activities form a dependency loop.')
  await expect(checks(page)).toContainText('Warning only.')
  await workspace(page).getByRole('button', { name: 'Review & approve', exact: true }).click()
  await expect(approval(page).getByRole('button', { name: 'Submit for approval', exact: true })).toBeDisabled()
  expect(state.writes).toEqual([])
  clean(state)
})

test('nonblocking timing warnings do not grant missing submission permission', async ({ page }) => {
  const state = await masterScheduleHarness(page, {
    decorateSnapshot(plan) {
      plan.warnings = [timing(plan.tasks[0])]
      plan.permissions.can_submit = false
      return plan
    },
  })
  await workspace(page).getByRole('button', { name: 'Review & approve', exact: true }).click()
  await expect(checks(page).getByRole('heading', { name: 'Review timing warnings', exact: true })).toBeVisible()
  await expect(approval(page).getByRole('button', { name: 'Submit for approval', exact: true })).toBeDisabled()
  expect(state.writes).toEqual([])
  clean(state)
})
