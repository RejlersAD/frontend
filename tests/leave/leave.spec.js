import { test, expect } from '@playwright/test'
const leave = { id: 'leave-1', employee_name: 'Ahmed Ali', days_requested: '5.00', status: 'PENDING', start_date: '2026-10-05', end_date: '2026-10-09', created_at: '2026-09-10T09:00:00Z', leave_type_detail: { name: 'Annual leave' }, line_manager_name: 'Line Manager', reason: 'Family holiday', can_review: true }
async function setup(page, stage = 'PENDING') {
  let item = { ...leave, status: stage }
  await page.route('**/api/**', async route => {
    if (route.request().method() === 'POST') item = { ...item, status: stage === 'PENDING' ? 'RM_APPROVED' : 'REJECTED', can_review: false }
    return route.fulfill({ json: item })
  })
  await page.goto('/tests/leave/harness.html', { waitUntil: 'domcontentloaded' })
}
test('manager approval uses the selected request and removes decision controls', async ({ page }) => {
  await setup(page)
  await expect(page.getByText('Family holiday')).toBeVisible()
  const request = page.waitForRequest(req => req.method() === 'POST' && req.url().endsWith('/leave-1/rm-approve/'))
  await page.getByRole('button', { name: 'Approve and send to HR' }).click()
  await request
  await expect(page.getByRole('button', { name: 'Approve and send to HR' })).toHaveCount(0)
})
test('HR rejection requires a reason and uses the final endpoint', async ({ page }) => {
  await setup(page, 'RM_APPROVED')
  await page.getByRole('button', { name: 'Reject', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Please enter a rejection reason.')
  await page.getByRole('textbox').fill('Insufficient cover')
  const request = page.waitForRequest(req => req.method() === 'POST' && req.url().endsWith('/leave-1/reject/'))
  await page.getByRole('button', { name: 'Reject', exact: true }).click()
  expect((await request).postDataJSON()).toEqual({ note: 'Insufficient cover' })
})
test('pending leave cannot print and the dialog can close', async ({ page }) => {
  await setup(page)
  await expect(page.getByRole('button', { name: 'Print', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
test('mobile review stays within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page)
  await expect(page.getByText('Family holiday')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
})
