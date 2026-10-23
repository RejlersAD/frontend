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

test('Refer To transfers the selected request and preserves pending status and history', async ({ page }) => {
  let item = { ...leave, can_refer: true }
  let payload
  await page.route('**/api/**', async route => {
    if (route.request().url().endsWith('/referral-options/')) return route.fulfill({ json: { results: [{ id: 42, name: 'Alternate Approver' }] } })
    if (route.request().url().endsWith('/refer-to/')) {
      payload = route.request().postDataJSON()
      item = { ...item, can_review: false, can_refer: false, line_manager_name: 'Alternate Approver', referral_history: [{ id: 'referral-1', actor: 'Line Manager', approver: 'Alternate Approver', stage: 'manager_review', at: '2026-10-23T08:00:00Z', note: payload.note }] }
    }
    return route.fulfill({ json: item })
  })
  await page.goto('/tests/leave/harness.html')
  await page.getByRole('button', { name: 'Refer To', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Refer request', exact: true })).toBeDisabled()
  await page.getByRole('combobox', { name: 'Refer to employee' }).fill('Alternate')
  await page.getByRole('option', { name: 'Alternate Approver' }).click()
  await page.getByRole('textbox', { name: 'Comment (required to reject)' }).fill('Please cover my absence')
  await page.getByRole('button', { name: 'Refer request', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Referral history' })).toContainText('Line Manager referred to Alternate Approver')
  await expect(page.getByRole('region', { name: 'Referral history' })).toContainText('Please cover my absence')
  expect(payload).toEqual({ approver_id: 42, note: 'Please cover my absence' })
  await expect(page.getByText('Pending Approval', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Refer To', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Print', exact: true })).toBeDisabled()
})

test('referral failure preserves recipient and comment for retry', async ({ page }) => {
  await page.route('**/api/**', async route => {
    if (route.request().url().endsWith('/referral-options/')) return route.fulfill({ json: { results: [{ id: 42, name: 'Alternate Approver' }] } })
    if (route.request().url().endsWith('/refer-to/')) return route.fulfill({ status: 400, json: { approver_id: 'This approver is no longer authorized.' } })
    return route.fulfill({ json: { ...leave, can_refer: true } })
  })
  await page.goto('/tests/leave/harness.html')
  await page.getByRole('button', { name: 'Refer To', exact: true }).click()
  await page.getByRole('combobox', { name: 'Refer to employee' }).fill('Alternate')
  await page.getByRole('option', { name: 'Alternate Approver' }).click()
  await page.getByRole('textbox', { name: 'Comment (required to reject)' }).fill('Cover required')
  await page.getByRole('button', { name: 'Refer request', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('This approver is no longer authorized.')
  await expect(page.getByRole('combobox', { name: 'Refer to employee' })).toHaveValue('Alternate Approver')
  await expect(page.getByRole('textbox', { name: 'Comment (required to reject)' })).toHaveValue('Cover required')
})

test('cancel referral leaves approval available and sends no decision', async ({ page }) => {
  const posts = []
  await page.route('**/api/**', async route => {
    if (route.request().method() === 'POST') posts.push(route.request().url())
    if (route.request().url().endsWith('/referral-options/')) return route.fulfill({ json: { results: [] } })
    return route.fulfill({ json: { ...leave, can_refer: true } })
  })
  await page.goto('/tests/leave/harness.html')
  await page.getByRole('button', { name: 'Refer To', exact: true }).click()
  await expect(page.getByText('No employees found.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel referral', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Approve and continue', exact: true })).toBeEnabled()
  expect(posts).toEqual([])
})

test('employee search covers names, employee codes and departments without filtering out other employees', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ json: route.request().url().endsWith('/referral-options/') ? { results: [
    { id: 42, name: 'Alternate Approver', employee_code: 'E0042', department: 'Engineering', eligible: true },
    { id: 43, name: 'Finance Employee', employee_code: 'F0043', department: 'Finance', eligible: false },
    { id: null, employee_id: 'imported', name: 'Imported Employee', employee_code: 'I0044', department: 'Sales', eligible: false },
  ] } : { ...leave, can_refer: true } }))
  await page.goto('/tests/leave/harness.html')
  await page.getByRole('button', { name: 'Refer To', exact: true }).click()
  const search = page.getByRole('combobox', { name: 'Refer to employee' })
  await expect(page.getByRole('option')).toHaveCount(3)
  await search.fill('f0043')
  await expect(page.getByRole('option')).toHaveCount(1)
  await expect(page.getByRole('option')).toContainText('Finance Employee')
  await page.getByRole('option').click()
  await expect(page.getByRole('button', { name: 'Refer request', exact: true })).toBeEnabled()
  await search.fill('engineering')
  await expect(page.getByRole('option')).toHaveCount(1)
  await search.press('Enter')
  await expect(search).toHaveValue('Alternate Approver / E0042')
  await search.fill('imported')
  await expect(page.getByRole('option')).toContainText('No RADAI account')
  await expect(page.getByRole('button', { name: 'Imported Employee', exact: false })).toBeDisabled()
  await search.fill('unknown')
  await expect(page.getByText('No employees found.')).toBeVisible()
})
