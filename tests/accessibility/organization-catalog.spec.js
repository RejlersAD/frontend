import { test, expect } from '@playwright/test'

test.setTimeout(90000)

const catalog = {
  source: { title: 'Test organization chart', document_id: 'TEST-CHART', revision: 6, date: '2025-12-12' },
  departments: [
    { code: 'management', label: 'Management', head_role_code: 'ceo', functions: [] },
    { code: 'operations', label: 'Operations & Project Delivery', parent_code: 'management', head_role_code: 'operations_head', functions: ['Project delivery'] },
  ],
  organizational_roles: [
    { code: 'ceo', label: 'Chief Executive Officer', department_code: 'management', holder_name: 'Test Leader', additional_titles: [] },
    { code: 'operations_head', label: 'Head of Operations', department_code: 'operations', reports_to_role_code: 'ceo', holder_name: 'Test Manager', acting: true, additional_titles: ['Vice President'] },
  ],
}

async function mockApi(page, { catalogFailure = false } = {}) {
  const state = { writes: [], catalogFailure, catalogReads: 0 }
  const profile = { id: 'profile-7', user: { id: 7, first_name: 'Test', last_name: 'Employee', email: 'test@example.com' }, department: 'operations', job_title: 'Legacy Coordinator', engineer_profile: {}, manager_detail: null }
  await page.addInitScript(() => localStorage.setItem('radai_access_token', 'organization-test-token'))
  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (!['GET', 'OPTIONS'].includes(request.method())) state.writes.push({ path, method: request.method(), body: request.postData() })
    let body = []
    let status = 200
    if (path.endsWith('/organization-catalog/')) {
      state.catalogReads += 1
      body = state.catalogFailure ? { detail: 'Temporarily unavailable' } : catalog
      status = state.catalogFailure ? 503 : 200
    } else if (path.endsWith('/users/me/')) body = profile
    else if (path.endsWith('/my-employee-profile/')) body = { employee: {}, branch_choices: [] }
    else if (path.includes('/access-requests/')) body = { results: [], count: 0 }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  return state
}

test('organization tab shows source, incumbents and reporting lines without changing access', async ({ page }) => {
  const state = await mockApi(page)
  await page.goto('/tests/fixtures/organization-catalog.html')
  await page.getByRole('tab', { name: 'Organization structure', exact: true }).click()
  await expect(page.getByText(/TEST-CHART.*Revision 6.*2025-12-12/)).toBeVisible()
  const row = page.getByRole('row').filter({ hasText: 'Head of Operations' })
  await expect(row).toContainText('Test Manager')
  await expect(row).toContainText('Acting')
  await expect(row).toContainText('Vice President')
  await expect(row).toContainText('Chief Executive Officer')
  await page.screenshot({ path: '../artifacts/organization-structure.png', fullPage: true })
  await page.getByRole('searchbox').fill('vice president')
  await expect(page.getByRole('heading', { name: 'Operations & Project Delivery', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Management', exact: true })).toHaveCount(0)
  expect(state.writes).toEqual([])
})

test('profile keeps stored department and title when the chart loads and unrelated fields are saved', async ({ page }) => {
  const state = await mockApi(page)
  await page.goto('/tests/fixtures/organization-catalog.html?view=profile')
  const department = page.getByLabel('Department', { exact: true })
  await expect(department).toHaveValue('operations')
  await expect(department.locator('option[value="Operations & Project Delivery"]')).toHaveCount(1)
  await expect(page.getByLabel('Organizational role / Job title', { exact: true })).toHaveValue('Legacy Coordinator')
  await expect(page.locator('#career-organizational-roles option[value="Vice President"]')).toHaveCount(1)
  await page.getByLabel('Location', { exact: true }).fill('Test office')
  await page.getByRole('button', { name: 'Save Update', exact: true }).first().click()
  await expect.poll(() => state.writes.length).toBe(1)
  expect(state.writes[0].path).toBe('/api/v1/rbac/users/me/')
  expect(state.writes[0].body).toMatch(/name="department"\r\n\r\noperations\r\n/)
  expect(state.writes[0].body).toMatch(/name="job_title"\r\n\r\nLegacy Coordinator\r\n/)
  expect(state.writes[0].body).not.toContain('name="role_ids"')
})

test('failed catalog reads can be retried without an application reload', async ({ page }) => {
  const state = await mockApi(page, { catalogFailure: true })
  await page.goto('/tests/fixtures/organization-catalog.html')
  await page.getByRole('tab', { name: 'Organization structure', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Organization structure is unavailable')
  state.catalogFailure = false
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('cell', { name: /Test Manager/ })).toBeVisible()
  expect(state.catalogReads).toBe(2)
  expect(state.writes).toEqual([])
})
