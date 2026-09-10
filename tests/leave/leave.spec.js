import { test, expect } from '@playwright/test'
const leave = { id: 'leave-1', employee_name: 'Ahmed Ali', days_requested: '5.00', status: 'PENDING', status_display: 'Pending manager approval', start_date: '2026-10-05', end_date: '2026-10-09', created_at: '2026-09-10T09:00:00Z', leave_type_detail: { name: 'Annual leave' }, line_manager_name: 'Line Manager', reason: 'Family holiday', can_review: true }
async function setup(page, stage = 'PENDING') {
  let pending = true
  let item = { ...leave, status: stage }
  await page.route('**/api/**', async route => {
    const url = route.request().url()
    if (url.includes('procurement')) return route.fulfill({ json: { results: [] } })
    if (url.includes('pending-for-me')) return route.fulfill({ json: { results: pending ? [item] : [] } })
    if (route.request().method() === 'POST') {
      pending = false
      item = { ...item, status: 'RM_APPROVED', status_display: 'Pending HR approval', can_review: false }
    }
    return route.fulfill({ json: item })
  })
  await page.goto('/tests/leave/harness.html')
  return () => { pending = false }
}
test('manager reviews exact leave and approval stops reminders', async ({ page }) => {
  await setup(page)
  await expect(page.getByText('Please approve the leave request of Ahmed Ali ? 5 days requested')).toBeVisible()
  await page.getByRole('link', { name: 'Review request' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('Family holiday')).toBeVisible()
  const request = page.waitForRequest(req => req.method() === 'POST' && req.url().endsWith('/rm-approve/'))
  await page.getByRole('button', { name: 'Approve and send to HR' }).click()
  await request
  await expect(page.getByText('Pending HR approval', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Approval waiting for you')).toHaveCount(0)
})
test('snooze repeats after ten minutes', async ({ page }) => {
  await page.clock.install()
  await setup(page)
  await page.getByRole('button', { name: 'Remind in 10 min', exact: true }).click()
  await page.clock.runFor(9 * 60_000)
  await expect(page.getByText('Approval waiting for you')).toHaveCount(0)
  await page.clock.runFor(60_000)
  await expect(page.getByText('Approval waiting for you')).toBeVisible()
})
test('HR rejection requires reason and uses final endpoint', async ({ page }) => {
  await setup(page, 'RM_APPROVED')
  await page.getByRole('link', { name: 'Review request' }).click()
  await page.getByRole('button', { name: 'Reject', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Please enter a rejection reason.')
  await page.getByRole('textbox').fill('Insufficient cover')
  const request = page.waitForRequest(req => req.method() === 'POST' && req.url().endsWith('/reject/'))
  await page.getByRole('button', { name: 'Reject', exact: true }).click()
  expect((await request).postDataJSON()).toEqual({ note: 'Insufficient cover' })
})
test('resolved requests disappear on refresh', async ({ page }) => {
  const resolve = await setup(page)
  await expect(page.getByText('Approval waiting for you')).toBeVisible()
  resolve()
  await page.evaluate(() => window.dispatchEvent(new Event('leave-approval-updated')))
  await expect(page.getByText('Approval waiting for you')).toHaveCount(0)
})
