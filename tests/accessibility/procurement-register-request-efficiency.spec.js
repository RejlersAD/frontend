import { test, expect } from '@playwright/test'
import { recommendationHarness, recommendationNumber } from '../fixtures/purchase-recommendations.fixture'

test.use({ serviceWorkers: 'block' })
test.setTimeout(90000)
const count = (state, path) => state.requests.filter(request => request.path === `/api/v1/${path}`).length
const rows = page => page.locator('tbody tr')

test('register refresh uses supplied employee names and does not reload unused lookups or permissions', async ({ page }) => {
  const state = await recommendationHarness(page, { realApp: true })
  await expect(page.getByRole('button', { name: `Select ${recommendationNumber(2)}`, exact: true })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Procurement registers' })).toContainText('Purchase Orders1')
  const profileCalls = count(state, 'rbac/users/me/')
  const listCalls = count(state, 'procurement/requisitions/')
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled()
  await expect(rows(page).filter({ hasText: recommendationNumber(3) })).toContainText('Samir Ali')
  expect(count(state, 'procurement/requisitions/')).toBe(listCalls + 2) // Both paginated results remain complete.
  expect(count(state, 'rbac/users/me/')).toBe(profileCalls)
  expect(count(state, 'procurement/requisitions/get_approvers/')).toBe(0)
  expect(count(state, 'procurement/vendors/')).toBe(0)
  expect(count(state, 'procurement/projects/')).toBe(0)
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})

test('legacy records without a supplied requester name still resolve their employee', async ({ page }) => {
  const state = await recommendationHarness(page, { realApp: true, prepare: fixture => {
    fixture.props.requisitions.forEach(record => {
      record.requester_name = ''; record.issued_by_name = ''; record.requested_by_name = ''
    })
  } })
  await expect(rows(page).filter({ hasText: recommendationNumber(3) })).toContainText('Samir Ali')
  expect(count(state, 'procurement/requisitions/get_approvers/')).toBe(1)
  expect(state.pageErrors).toEqual([])
})

test('a late requisition refresh cannot replace the purchase order register with an error', async ({ page }) => {
  const state = await recommendationHarness(page, { realApp: true })
  await expect(page.getByRole('button', { name: `Select ${recommendationNumber(2)}`, exact: true })).toBeVisible()
  let release, requested = false
  const pending = new Promise(resolve => { release = resolve })
  await page.route('**/api/v1/procurement/requisitions/?*', async route => {
    if (new URL(route.request().url()).searchParams.get('page_size') === '1') return route.fallback()
    requested = true
    await pending
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'Obsolete PR request' }) })
  })
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect.poll(() => requested).toBe(true)
  await page.getByRole('navigation', { name: 'Procurement registers' }).getByRole('link', { name: /Purchase Orders/ }).click()
  await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Select PO-TEST-001', exact: true })).toBeVisible()
  release()
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled()
  await expect(page.getByText('Obsolete PR request')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Select PO-TEST-001', exact: true })).toBeVisible()
  expect(state.pageErrors).toEqual([])
})
