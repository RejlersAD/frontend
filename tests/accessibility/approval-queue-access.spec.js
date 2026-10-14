import { test, expect } from '@playwright/test'

const verificationPath = '/api/v1/rbac/profile-documents/pending-verification/'
const verificationRecord = {
  id: 41,
  document_number: 'ID-VERIFICATION-41',
  document_name: 'Emirates ID verification',
  document_type: 'emirates_id',
  employee_name: 'Assigned Employee',
  verification_status: 'pending',
  can_review: true,
  created_at: '2026-09-22T10:00:00Z',
}
const procurementRecord = {
  id: 12,
  pr_number: 'PR-QUEUE-12',
  title: 'Engineering services purchase',
  status: 'in_review',
  can_approve: true,
  requester_name: 'Project Engineer',
  total_price: '1500.00',
  currency: 'AED',
  created_at: '2026-09-22T10:00:00Z',
}

async function prepare(page, verificationStatus = 200) {
  const state = { verificationStatus, requests: [], errors: [] }
  page.on('pageerror', error => state.errors.push(error.message))
  await page.addInitScript(() => localStorage.setItem('radai_access_token', 'queue-test-token'))
  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    state.requests.push({ path, method: request.method(), authorization: request.headers().authorization })
    if (path === verificationPath && state.verificationStatus !== 200) {
      return route.fulfill({ status: state.verificationStatus, contentType: 'application/json', body: JSON.stringify({ detail: state.verificationStatus === 403 ? 'HR reviewer assignment required.' : 'Service unavailable.' }) })
    }
    const records = path === verificationPath ? [verificationRecord]
      : path === '/api/v1/procurement/requisitions/pending-for-me/' ? [procurementRecord] : []
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ results: records, count: records.length, next: null }) })
  })
  await page.goto('/tests/fixtures/approval-queue-access.html')
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled()
  return state
}

const idQueue = page => page.getByRole('navigation', { name: 'Approval queues' }).getByRole('button', { name: /^ID verification/ })
const requests = page => page.getByRole('region', { name: 'Approval requests', exact: true })

test('a broad administrator without ID reviewer assignment sees an access notice without a service failure', async ({ page }, testInfo) => {
  const state = await prepare(page, 403)
  await expect(requests(page).getByRole('button', { name: 'PR-QUEUE-12', exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByText(/could not be loaded/)).toHaveCount(0)
  await idQueue(page).click()
  await expect(page.getByRole('heading', { name: 'Review access not assigned', exact: true })).toBeVisible()
  await expect(requests(page)).toContainText(/HR|reviewer|administrator/i)
  await expect(page.getByRole('button', { name: /^Approve|^Reject/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Approval settings', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Approval settings' })).toContainText('Review access not assigned')
  await page.getByRole('button', { name: 'Close approval settings' }).click()
  await page.screenshot({ path: testInfo.outputPath('id-verification-access-notice.png'), fullPage: true })
  expect(state.requests.find(request => request.path === verificationPath).authorization).toBe('Bearer queue-test-token')
  expect(state.requests.every(request => request.method === 'GET')).toBe(true)
  expect(state.errors).toEqual([])
})

test('an unavailable ID service keeps genuine error and partial counts until Retry succeeds', async ({ page }) => {
  const state = await prepare(page, 500)
  await expect(page.getByRole('alert')).toContainText('ID verification could not be loaded. Counts cover available queues only.')
  await expect(requests(page).getByRole('button', { name: 'PR-QUEUE-12', exact: true })).toBeVisible()
  await expect(page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Awaiting my decision', exact: true }) })).toContainText('1+')
  state.verificationStatus = 200
  await page.getByRole('alert').getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await idQueue(page).click()
  await expect(requests(page).getByRole('button', { name: 'ID-VERIFICATION-41', exact: true })).toBeVisible()
  await expect(page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Awaiting my decision', exact: true }) })).toContainText('2')
  expect(state.requests.filter(request => request.path === verificationPath)).toHaveLength(2)
  expect(state.errors).toEqual([])
})

test('an assigned ID reviewer sees the pending verification queue and current server decision capability', async ({ page }) => {
  const state = await prepare(page)
  await idQueue(page).click()
  await expect(requests(page).getByRole('button', { name: 'ID-VERIFICATION-41', exact: true })).toBeVisible()
  await expect(requests(page)).toContainText('Pending Verification')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Review access not assigned', exact: true })).toHaveCount(0)
  expect(state.requests.every(request => request.method === 'GET')).toBe(true)
  expect(state.errors).toEqual([])
})

test('refreshing a revoked ID assignment removes its prior row and decision controls', async ({ page }) => {
  const state = await prepare(page)
  await idQueue(page).click()
  await expect(requests(page).getByRole('button', { name: 'ID-VERIFICATION-41', exact: true })).toBeVisible()
  state.verificationStatus = 403
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Review access not assigned', exact: true })).toBeVisible()
  await expect(requests(page).getByRole('button', { name: 'ID-VERIFICATION-41', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Approve|^Reject/ })).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(state.requests.every(request => request.method === 'GET')).toBe(true)
  expect(state.errors).toEqual([])
})
