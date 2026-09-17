import { test, expect } from '@playwright/test'
import { recommendationHarness, recommendationId as id, recommendationNumber as number } from '../fixtures/purchase-recommendations.fixture'

test.setTimeout(90000)
test.use({ serviceWorkers: 'block' })

const navigateReview = (page, recordId) => page.evaluate(next => {
  window.history.pushState({}, '', `/procurement/requisitions/${next}`)
  window.dispatchEvent(new PopStateEvent('popstate'))
}, recordId)
const profileReads = state => state.requests.filter(request => request.path === '/api/v1/rbac/users/me/').length

test('changing review IDs keeps the newer record and reuses the loaded approval profile', async ({ page }) => {
  const state = await recommendationHarness(page, { realApp: true })
  await expect(page.getByRole('heading', { name: 'Purchase Recommendations', exact: true })).toBeVisible()
  const existingProfiles = profileReads(state)
  state.deferred[id(201)] = true
  await navigateReview(page, id(201))
  await expect(page.getByText('Loading approval request...', { exact: true })).toBeVisible()
  await expect.poll(() => Boolean(state.pending[id(201)])).toBe(true)
  await expect.poll(() => profileReads(state)).toBeGreaterThan(existingProfiles)
  const profileCount = profileReads(state)
  await navigateReview(page, id(202))
  await expect(page.getByRole('heading', { name: number(2), exact: true, level: 1 })).toBeVisible()
  expect(profileReads(state)).toBe(profileCount)
  state.pending[id(201)]()
  await expect.poll(() => state.delivered[id(201)]).toBe(true)
  await expect(page.getByRole('heading', { name: number(2), exact: true, level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: number(1), exact: true, level: 1 })).toHaveCount(0)
  expect(profileReads(state)).toBe(profileCount)
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})

test('a mismatched review response never displays another requisition', async ({ page }) => {
  const state = await recommendationHarness(page, { realApp: true })
  await expect(page.getByRole('heading', { name: 'Purchase Recommendations', exact: true })).toBeVisible()
  state.details[id(202)] = { ...state.details[id(201)] }
  await navigateReview(page, id(202))
  await expect(page.getByRole('heading', { name: 'Could not open approval request', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: number(1), exact: true, level: 1 })).toHaveCount(0)
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})
