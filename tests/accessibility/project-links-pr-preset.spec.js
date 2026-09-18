import { test, expect } from '@playwright/test'
import { projectLinksHarness } from '../fixtures/project-links.fixture'

test.setTimeout(120000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } })

test('rejecting another project PR keeps the displayed and saved PR identities aligned', async ({ page }) => {
  const state = await projectLinksHarness(page)
  const otherPR = { ...state.recommendation, id: '00000000-0000-4000-8000-000000009099',
    pr_number: 'RAD-PRJ-PR-9099_2026', enterprise_project: '18', project_details: [] }
  await page.route('**/api/v1/procurement/orders/available-requisitions/**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([state.recommendation, otherPR]),
  }))
  await page.getByRole('region', { name: 'Projects', exact: true }).getByRole('button').filter({ hasText: '5900985' }).click()
  await page.getByRole('button', { name: 'Create PO', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'New purchase order', exact: true })).toBeVisible()
  const input = page.locator('#po-pr-search')
  await input.fill('9001')
  await page.getByRole('option', { name: new RegExp(state.recommendation.pr_number) }).click()
  await expect(input).toHaveValue(state.recommendation.pr_number)
  // Entering a complete PR number takes the immediate exact-match path.
  await input.fill(otherPR.pr_number)
  await expect(page.getByText(/This PR belongs to another project/).first()).toBeVisible()
  await expect(input).toHaveValue(state.recommendation.pr_number)
  await expect(page.locator('#po-project-search')).toHaveValue(/5900985/)
  await page.getByRole('combobox', { name: 'Price basis', exact: true }).selectOption('exclusive')
  await page.locator('.purchase-order-form-workspace').getByRole('button', { name: /^Save draft$/i }).first().click()
  await expect(page.getByRole('heading', { name: 'New purchase order', exact: true })).toHaveCount(0)
  expect(state.acceptedWrites).toHaveLength(1)
  expect(state.record).toMatchObject({ pr_reference: state.recommendation.id, enterprise_project: '17', project_number: '5900985' })
  expect(state.pageErrors).toEqual([])
  expect(state.unknown).toEqual([])
})
