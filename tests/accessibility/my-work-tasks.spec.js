import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { assignedTask, myWorkTasksHarness } from '../fixtures/my-work-tasks.fixture'
import { planningEmployees } from '../fixtures/planning-inputs.fixture'

test.setTimeout(60000)
const dialogFor = page => page.getByRole('dialog', { name: 'Assigned task', exact: true })
const clean = state => { expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([]) }
async function openTask(page, title = 'Prepare process design basis') {
  await page.getByRole('button', { name: `Open ${title}`, exact: true }).click()
  const dialog = dialogFor(page)
  await expect(dialog.getByRole('heading', { name: title, exact: true })).toBeVisible()
  return dialog
}

test('employee opens the task inside My Work and saved progress refreshes the hub before completion', async ({ page }) => {
  const state = await myWorkTasksHarness(page)
  let dialog = await openTask(page)
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(dialog).toContainText('Maya Hassan')
  await expect(dialog).toContainText('5900913')
  await page.screenshot({ path: '../artifacts/my-work-assigned-task-desktop.png', animations: 'disabled' })
  await expect(dialog.getByRole('button', { name: 'Save progress', exact: true })).toBeDisabled()
  await dialog.getByRole('combobox', { name: 'Status', exact: true }).selectOption('in_progress')
  await dialog.getByRole('spinbutton', { name: 'Progress (%)', exact: true }).fill('45')
  const reads = state.bundleReads
  await dialog.getByRole('button', { name: 'Save progress', exact: true }).click()
  await expect(dialog.getByRole('status')).toContainText('Task progress saved.')
  expect(state.writes[0]).toMatchObject({ method: 'PATCH', path: '/api/v1/dashboard/work-hub/tasks/2201/', data: { status: 'in_progress', progress_percent: 45, expected_updated_at: '2026-09-15T06:30:00Z' } })
  await expect.poll(() => state.bundleReads).toBeGreaterThan(reads)
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByTestId('workhub-tasks')).toContainText('In progress')
  await page.reload()
  dialog = await openTask(page)
  await expect(dialog.getByRole('spinbutton', { name: 'Progress (%)', exact: true })).toHaveValue('45')
  await dialog.getByRole('combobox', { name: 'Status', exact: true }).selectOption('completed')
  await dialog.getByRole('button', { name: 'Confirm completion', exact: true }).click()
  await expect(dialog.getByRole('status')).toContainText('Task completed.')
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'No open tasks assigned', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Tasks due/ })).toContainText('0')
  expect(state.tasks[0]).toMatchObject({ status: 'completed', progress_percent: 100 })
  clean(state)
})

test('deliverable assignees can submit for review but cannot select reviewer-only completion', async ({ page }) => {
  const state = await myWorkTasksHarness(page, { prepare(current) {
    current.tasks = [assignedTask({ task_type: 'deliverable', reviewer: planningEmployees[2], status: 'in_progress', progress_percent: 90, allowed_statuses: ['in_progress', 'blocked', 'review'] })]
  } })
  const dialog = await openTask(page)
  await expect(dialog).toContainText('Deliverable task')
  await expect(dialog).toContainText('Document all process assumptions and obtain an independent review.')
  await expect(dialog).toContainText('Layla Ahmed')
  expect(await dialog.getByRole('combobox', { name: 'Status', exact: true }).locator('option').evaluateAll(items => items.map(item => item.value))).not.toContain('completed')
  await dialog.getByRole('combobox', { name: 'Status', exact: true }).selectOption('review')
  await dialog.getByRole('button', { name: 'Submit for review', exact: true }).click()
  await expect(dialog.getByRole('status')).toContainText('Deliverable submitted for review.')
  expect(state.writes[0].data).toEqual({ status: 'review', expected_updated_at: '2026-09-15T06:30:00Z' })
  await expect(dialog.getByRole('spinbutton', { name: 'Progress (%)', exact: true })).toBeEnabled()
  clean(state)
})

test('assigned reviewers can complete a deliverable without editing the assignee progress', async ({ page }) => {
  const state = await myWorkTasksHarness(page, { prepare(current) {
    current.tasks = [assignedTask({ task_type: 'deliverable', assigned_to: planningEmployees[1], reviewer: planningEmployees[0], role: 'reviewer', status: 'review', progress_percent: 95, allowed_statuses: ['review', 'in_progress', 'completed'], can_update_progress: false })]
  } })
  const dialog = await openTask(page)
  await expect(dialog).toContainText('Assigned to you for review')
  await expect(dialog.getByRole('spinbutton', { name: 'Progress (%)', exact: true })).toBeDisabled()
  await dialog.getByRole('combobox', { name: 'Status', exact: true }).selectOption('completed')
  await dialog.getByRole('button', { name: 'Confirm completion', exact: true }).click()
  await expect(dialog.getByRole('status')).toContainText('Task completed.')
  expect(state.writes[0].data).toEqual({ status: 'completed', expected_updated_at: '2026-09-15T06:30:00Z' })
  clean(state)
})

test('a temporary save failure keeps the employee status and progress edits available for retry', async ({ page }) => {
  const state = await myWorkTasksHarness(page)
  const dialog = await openTask(page)
  await dialog.getByRole('combobox', { name: 'Status', exact: true }).selectOption('blocked')
  await dialog.getByRole('spinbutton', { name: 'Progress (%)', exact: true }).fill('35')
  state.saveFailure = { status: 503, body: { error: 'Task storage is temporarily unavailable.' } }
  await dialog.getByRole('button', { name: 'Save progress', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Task storage is temporarily unavailable.')
  await expect(dialog.getByRole('combobox', { name: 'Status', exact: true })).toHaveValue('blocked')
  await expect(dialog.getByRole('spinbutton', { name: 'Progress (%)', exact: true })).toHaveValue('35')
  expect(state.tasks[0].status).toBe('todo')
  state.saveFailure = null
  await dialog.getByRole('button', { name: 'Save progress', exact: true }).click()
  await expect(dialog.getByRole('status')).toContainText('Task progress saved.')
  expect(state.writes).toHaveLength(2)
  expect(state.tasks[0]).toMatchObject({ status: 'blocked', progress_percent: 35 })
  clean(state)
})

test('concurrent changes require reload and removed assignments stop further task edits', async ({ page }) => {
  const state = await myWorkTasksHarness(page)
  const dialog = await openTask(page)
  await dialog.getByRole('spinbutton', { name: 'Progress (%)', exact: true }).fill('40')
  Object.assign(state.tasks[0], { status: 'in_progress', progress_percent: 20, updated_at: '2026-09-15T06:35:00Z' })
  await dialog.getByRole('button', { name: 'Save progress', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Reload the task before updating your progress.')
  await expect(dialog.getByRole('button', { name: 'Save progress', exact: true })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Reload task', exact: true }).click()
  await expect(dialog.getByRole('spinbutton', { name: 'Progress (%)', exact: true })).toHaveValue('20')
  await dialog.getByRole('spinbutton', { name: 'Progress (%)', exact: true }).fill('50')
  state.saveFailure = { status: 403, body: { detail: 'This assignment was removed.' } }
  await dialog.getByRole('button', { name: 'Save progress', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('This task is no longer available to you.')
  await expect(dialog.getByRole('spinbutton', { name: 'Progress (%)', exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Save progress', exact: true })).toHaveCount(0)
  expect(state.tasks[0].progress_percent).toBe(20)
  clean(state)
})

test('mobile assigned task is centered accessible and supports keyboard close without navigating away', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const state = await myWorkTasksHarness(page)
  const dialog = await openTask(page)
  const bounds = await dialog.boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
  expect(bounds.y).toBeGreaterThanOrEqual(0)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(844)
  const scan = await new AxeBuilder({ page }).include('dialog[open]').analyze()
  expect(scan.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
  await page.screenshot({ path: '../artifacts/my-work-assigned-task-mobile.png', animations: 'disabled' })
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Open Prepare process design basis', exact: true })).toBeFocused()
  await expect(page).toHaveURL(/\/dashboard$/)
  expect(state.writes).toEqual([])
  clean(state)
})

test('returning to My Work loads newly assigned tasks without requiring project navigation or a full refresh', async ({ page }) => {
  const state = await myWorkTasksHarness(page)
  await expect(page.getByRole('button', { name: 'Open Prepare process design basis', exact: true })).toBeVisible()
  const featureReads = state.requests.filter(request => request.path.endsWith('/features/')).length
  const reads = state.bundleReads
  state.tasks.push(assignedTask({ id: 2202, title: 'Review hydraulic calculations', task_type: 'deliverable' }))
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('button', { name: 'Open Review hydraulic calculations', exact: true })).toBeVisible()
  expect(state.bundleReads).toBeGreaterThan(reads)
  expect(state.requests.filter(request => request.path.endsWith('/features/'))).toHaveLength(featureReads)
  await expect(page.getByRole('button', { name: /Tasks due/ })).toContainText('2')
  expect(state.writes).toEqual([])
  clean(state)
})

test('read-only assigned task access does not expose progress or status write actions', async ({ page }) => {
  const state = await myWorkTasksHarness(page, { prepare(current) {
    current.tasks = [assignedTask({ allowed_statuses: [], can_update_progress: false })]
  } })
  const dialog = await openTask(page)
  await expect(dialog.getByRole('combobox', { name: 'Status', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('spinbutton', { name: 'Progress (%)', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Save progress', exact: true })).toHaveCount(0)
  expect(state.writes).toEqual([])
  clean(state)
})
