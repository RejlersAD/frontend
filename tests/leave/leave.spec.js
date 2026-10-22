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
  await page.getByRole('button', { name: 'Approve and continue' }).click()
  await request
  await expect(page.getByRole('button', { name: 'Approve and continue' })).toHaveCount(0)
})
test('HR rejection requires a reason and uses the final endpoint', async ({ page }) => {
  await setup(page, 'RM_APPROVED')
  await page.getByRole('button', { name: 'Reject', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Please enter a rejection reason.')
  await page.getByRole('textbox', { name: 'Comment (required to reject)' }).fill('Insufficient cover')
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

test('FU displays all four approval stages and sends the current decision to the intermediate endpoint', async ({ page }) => {
  const item = { ...leave, leave_type_detail: { code: 'FU', name: 'Flex Utilization' }, review_stage: 'jemal_review',
    approval_steps: ['Jemal', 'Rafat', 'Mohammed', 'HR final approval'].map((title, index) => ({ title, detail: title, active: index === 0 })) }
  await page.route('**/api/**', route => route.fulfill({ json: item }))
  await page.goto('/tests/leave/harness.html')
  await expect(page.getByRole('list', { name: 'Approval history' }).getByRole('listitem')).toHaveCount(5)
  const decision = page.waitForRequest(request => request.method() === 'POST' && request.url().endsWith('/rm-approve/'))
  await page.getByRole('button', { name: 'Approve and continue' }).click()
  await decision
})

test('HR can approve an extended range with an explicit balance exception and reason', async ({ page }) => {
  const item = { ...leave, status: 'RM_APPROVED', review_stage: 'hr_review', leave_type_detail: { code: 'AL', name: 'Annual leave', category: 'annual' } }
  await page.route('**/api/**', route => route.fulfill({ json: item }))
  await page.goto('/tests/leave/harness.html')
  await page.getByLabel('Approved end date', { exact: true }).fill('2026-10-14')
  await page.getByLabel('Allow approval beyond available annual leave balance').check()
  await page.getByLabel('Reason for HR adjustment').fill('Additional three days approved by HR')
  const decision = page.waitForRequest(request => request.method() === 'POST' && request.url().endsWith('/approve/'))
  await page.getByRole('button', { name: 'Approve leave', exact: true }).click()
  expect((await decision).postDataJSON()).toMatchObject({ approved_end_date: '2026-10-14', allow_negative_balance: true, override_reason: 'Additional three days approved by HR' })
})
