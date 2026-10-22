import { test, expect } from '@playwright/test'

const organizationCatalog = {
  departments: [{ code: 'engineering', label: 'Engineering' }, { code: 'procurement', label: 'Procurement' }],
  organizational_roles: [{ code: 'engineer', label: 'Engineer' }, { code: 'senior_engineer', label: 'Senior Engineer' }],
}

test('HR can select the supplied organization options and identify EDC profile-only employees', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ json: [] }))
  await page.addInitScript(() => sessionStorage.setItem('employee-create-draft:hr-browser-test', JSON.stringify({
    version: 1, step: 1, data: { first_name: 'Test', surname: 'Employee', business_unit: '', business_area: '' },
  })))
  await page.goto('/tests/hr-enhancements/harness.html')
  const units = page.getByLabel('Business unit', { exact: false })
  await expect(units.locator('option')).toHaveText(['Select business unit', 'Rejlers Abu Dhabi', 'Rejlers India', 'PMC', 'EDC'])
  await units.selectOption('EDC')
  await expect(page.getByText('EDC: employee profile only. Excluded from payroll processing.')).toBeVisible()
  const areas = page.getByLabel('Business area', { exact: false })
  await expect(areas.locator('option')).toHaveCount(10)
  await areas.selectOption('Finance & IT')
  await expect(areas).toHaveValue('Finance & IT')
  await units.selectOption('Rejlers India')
  await expect(page.getByText('EDC: employee profile only. Excluded from payroll processing.')).toHaveCount(0)
})

test('probation defaults to six calendar months and retains an HR custom end date', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ json: [] }))
  await page.addInitScript(() => sessionStorage.setItem('employee-create-draft:hr-browser-test', JSON.stringify({
    version: 1, step: 2, data: { first_name: 'Test', surname: 'Employee', joining_date: '2026-01-31' },
  })))
  await page.goto('/tests/hr-enhancements/harness.html')
  await expect(page.locator('#employee-probation_start_date')).toHaveValue('2026-01-31')
  await expect(page.locator('#employee-probation_end_date')).toHaveValue('2026-07-31')
  await page.locator('#employee-probation_end_date').fill('2026-05-15')
  await page.locator('#employee-probation_start_date').fill('2026-02-01')
  await expect(page.locator('#employee-probation_end_date')).toHaveValue('2026-05-15')
  await expect(page.locator('#employee-derived_probation_end_date')).toHaveValue('2026-05-15')
})

test('Department and UAE job title open, search, select and close without a Finland field', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ json: route.request().url().includes('organization-catalog') ? organizationCatalog : [] }))
  await page.addInitScript(() => sessionStorage.setItem('employee-create-draft:hr-browser-test', JSON.stringify({
    version: 1, step: 1, data: { first_name: 'Test', surname: 'Employee', job_title_finland: 'Old restored title' },
  })))
  await page.goto('/tests/hr-enhancements/harness.html')
  const department = page.getByRole('combobox', { name: 'Department', exact: true })
  await department.click()
  await expect(page.getByRole('listbox', { name: 'Department options' }).getByRole('option', { name: 'Engineering', exact: true })).toBeVisible()
  await department.fill('proc')
  await expect(page.getByRole('listbox', { name: 'Department options' }).getByRole('option', { name: 'Engineering', exact: true })).toHaveCount(0)
  await page.getByRole('listbox', { name: 'Department options' }).getByRole('option', { name: 'Procurement', exact: true }).click()
  await expect(department).toHaveValue('Procurement')
  await expect(department).toHaveAttribute('aria-expanded', 'false')
  const title = page.getByRole('combobox', { name: 'Job title (UAE)', exact: true })
  await title.click()
  await title.fill('senior')
  await title.press('Enter')
  await expect(title).toHaveValue('Senior Engineer')
  await expect(title).toHaveAttribute('aria-expanded', 'false')
  await title.click()
  await title.fill('other search')
  await title.press('Escape')
  await expect(title).toHaveValue('Senior Engineer')
  await expect(page.getByLabel('Job title (Finland', { exact: false })).toHaveCount(0)
  await expect(page.getByText('Division', { exact: true })).toHaveCount(0)
})

test('organization choices recover when the catalog read is retried', async ({ page }) => {
  let catalogCalls = 0
  await page.route('**/api/**', route => {
    if (route.request().url().includes('organization-catalog')) {
      catalogCalls += 1
      return route.fulfill(catalogCalls === 1 ? { status: 503, json: { detail: 'Unavailable' } } : { json: organizationCatalog })
    }
    return route.fulfill({ json: [] })
  })
  await page.addInitScript(() => sessionStorage.setItem('employee-create-draft:hr-browser-test', JSON.stringify({ version: 1, step: 1, data: {} })))
  await page.goto('/tests/hr-enhancements/harness.html')
  await page.getByRole('button', { name: 'Retry', exact: true }).first().click()
  const department = page.getByRole('combobox', { name: 'Department', exact: true })
  await department.click()
  await expect(page.getByRole('listbox', { name: 'Department options' }).getByRole('option', { name: 'Engineering', exact: true })).toBeVisible()
})

test('review uses Department and omits the retired Finland title from restored drafts', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ json: route.request().url().includes('organization-catalog') ? organizationCatalog : [] }))
  await page.addInitScript(() => sessionStorage.setItem('employee-create-draft:hr-browser-test', JSON.stringify({
    version: 1, step: 3, data: { division: 'Engineering', job_title_uae: 'Engineer', job_title_finland: 'Retired Finland title' },
  })))
  await page.goto('/tests/hr-enhancements/harness.html')
  await expect(page.getByText('Department', { exact: true })).toBeVisible()
  await expect(page.getByText('Division', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Job title (Finland)', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Retired Finland title', { exact: true })).toHaveCount(0)
})
