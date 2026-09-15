import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { formProject, formRecordId, recommendationFormHarness } from '../fixtures/purchase-recommendation-form.fixture'

test.setTimeout(120000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } })
const workspace = page => page.locator('.recommendation-form-workspace')
const steps = page => page.getByRole('navigation', { name: 'Recommendation steps' })
const editor = page => page.getByRole('region', { name: 'Purchase recommendation form', exact: true })
const preview = page => page.getByRole('complementary', { name: 'Live purchase recommendation preview', exact: true })
const saves = state => state.requests.filter(({ method, path }) => ['POST', 'PATCH'].includes(method) && /^\/api\/v1\/procurement\/requisitions\/(?:[^/]+\/)?$/.test(path))
const open = async (page, options = {}) => {
  const state = await recommendationFormHarness(page, options)
  await expect(page.getByRole('heading', { name: options.edit ? 'Edit purchase recommendation' : 'Create purchase recommendation', exact: true })).toBeVisible({ timeout: 90000 })
  await expect(steps(page).getByRole('button')).toHaveCount(5)
  return state
}
const gotoStep = (page, name) => steps(page).getByRole('button', { name: new RegExp(name) }).click()
const verifyIsolation = state => { expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([]) }
const fillRequest = async page => {
  await page.getByRole('textbox', { name: 'PR number', exact: true }).fill('RAD-PRJ-PR-9001_2026')
  await page.getByRole('textbox', { name: 'Product / service', exact: true }).fill('Value Engineering Services')
  await page.getByRole('textbox', { name: 'Project / Department', exact: true }).fill('5900985')
  await page.getByRole('button', { name: formProject.label, exact: true }).click()
  await page.getByRole('button', { name: 'Continue to supplier & pricing', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Supplier selection', exact: true })).toBeVisible()
}

test('new request validates required fields and preview issues return to the relevant step', async ({ page }) => {
  const state = await open(page)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: '../artifacts/purchase-recommendation-form-new-request.png' })
  await page.getByRole('button', { name: 'Continue to supplier & pricing', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'PR number', exact: true })).toBeFocused()
  await expect(editor(page)).toContainText('Enter the PR number manually')
  expect(saves(state)).toEqual([])
  await preview(page).getByRole('tab', { name: /^Validation/ }).click()
  await expect(preview(page).getByRole('tabpanel', { name: /^Validation/ })).toContainText('Product/Service description is required')
  await preview(page).getByRole('button', { name: 'Product/Service description is required', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Product / service', exact: true })).toBeFocused()
  await preview(page).getByRole('tab', { name: /^Validation/ }).focus()
  await page.keyboard.press('ArrowLeft')
  await expect(preview(page).getByRole('tab', { name: 'Document', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', { name: 'Review & submit', exact: true }).click()
  await page.getByRole('button', { name: 'Submit for approval', exact: true }).click()
  expect(state.submissions).toEqual([])
  expect(saves(state)).toEqual([])
  verifyIsolation(state)
})

test('new request adds supplier shortlist, updates pricing and keeps draft saves on one record', async ({ page }) => {
  const state = await open(page)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: '../artifacts/purchase-recommendation-form-new-request.png' })
  await fillRequest(page)
  for (const name of ['Alfanar Engineering LLC', 'Petroserve Solutions', 'Desert Tech Services']) {
    await page.getByRole('button', { name: 'Add supplier', exact: true }).click()
    await page.locator('.prf-sp-vendor-options').getByRole('button', { name: new RegExp(name) }).click()
  }
  await page.getByRole('combobox', { name: /^Preferred supplier/ }).selectOption('21')
  await page.getByRole('textbox', { name: /^Reason for supplier selection/ }).fill('Best overall value, proven experience with similar projects, and compliant commercial terms.')
  await page.getByRole('combobox', { name: 'Currency', exact: true }).selectOption('AED')
  await page.getByRole('button', { name: 'Add line item', exact: true }).click()
  await page.getByRole('textbox', { name: 'Line item 1 description', exact: true }).fill('Value Engineering Services - Package 1 & 2')
  await page.getByRole('spinbutton', { name: 'Line item 1 unit price', exact: true }).fill('400000')
  await page.getByRole('combobox', { name: 'Line item 1 VAT', exact: true }).selectOption('5')
  await page.getByRole('textbox', { name: 'Line item 1 unit', exact: true }).fill('Package')
  await page.getByRole('button', { name: 'Show advanced pricing details', exact: true }).click()
  await page.getByRole('spinbutton', { name: 'Line item 1 budget', exact: true }).fill('1000000')
  await page.getByRole('button', { name: 'Hide advanced pricing details', exact: true }).click()
  await expect(page.locator('.prf-sp-grand-total')).toContainText('420,000.00')
  await expect(page.locator('.prf-sp-budget')).toContainText('580,000.00')
  await expect(preview(page)).toContainText('Alfanar Engineering LLC')
  await expect(preview(page)).toContainText('Value Engineering Services')
  await page.evaluate(() => document.fonts.ready)
  await page.locator('.prf-form-scroll').evaluate(element => { element.scrollTop = 0 })
  const actionBar = await page.locator('.prf-action-bar').boundingBox()
  for (const amount of await page.locator('.prf-sp-budget strong').all()) {
    const bounds = await amount.boundingBox()
    expect(bounds.y + bounds.height, 'Budget values must be visible above the sticky action bar').toBeLessThanOrEqual(actionBar.y)
  }
  await page.screenshot({ path: '../artifacts/purchase-recommendation-form-desktop-1672.png' })
  await workspace(page).getByRole('button', { name: 'Save draft', exact: true }).first().click()
  await expect.poll(() => saves(state).length).toBeGreaterThan(0)
  await expect(page.locator('.prf-save-state')).toContainText('Draft saved')
  expect(saves(state).filter(({ method }) => method === 'POST')).toHaveLength(1)
  expect(state.record).toMatchObject({ pr_number: 'RAD-PRJ-PR-9001_2026', supplier_name: 'Alfanar Engineering LLC', total_price: 400000, currency: 'AED' })
  expect(state.record.items[0]).toMatchObject({ description: 'Value Engineering Services - Package 1 & 2', quantity: '1', unit_price: '400000', total: '400000.00' })
  expect(state.record.items[0]).not.toHaveProperty('vat_rate')
  expect(state.record.price_remarks_data.line_details[0]).toMatchObject({ vat_rate: '5', budget: '1000000' })
  await expect(page).toHaveURL(/\/procurement\/requisitions\/new$/)
  await page.getByRole('spinbutton', { name: 'Line item 1 quantity', exact: true }).fill('2')
  await page.getByRole('spinbutton', { name: 'Line item 1 unit price', exact: true }).fill('1250')
  await expect(page.locator('.prf-sp-grand-total')).toContainText('2,625.00')
  await workspace(page).getByRole('button', { name: 'Save draft', exact: true }).first().click()
  await expect.poll(() => Number(state.record.total_price)).toBe(2500)
  expect(saves(state).filter(({ method }) => method === 'POST')).toHaveLength(1)
  expect(saves(state).some(({ path, method }) => method === 'PATCH' && path.endsWith(`/${formRecordId}/`))).toBeTruthy()
  expect(state.submissions).toEqual([])
  // The API normalizes line items. VAT, vendor and budget must survive through
  // the supported metadata field and be restored when the draft is reopened.
  await page.goto(`/procurement/requisitions/${formRecordId}/edit`)
  await expect(page.getByRole('heading', { name: 'Edit purchase recommendation', exact: true })).toBeVisible()
  await gotoStep(page, 'Supplier & pricing')
  await expect(page.getByRole('combobox', { name: 'Line item 1 VAT', exact: true })).toHaveValue('5')
  await expect(page.locator('.prf-sp-grand-total')).toContainText('2,625.00')
  await expect(page.getByRole('combobox', { name: /^Preferred supplier/ })).toHaveValue('21')
  verifyIsolation(state)
})

test('edit keeps saved request fields, supplier changes update the document and quantity updates persist', async ({ page }) => {
  const state = await open(page, { edit: true })
  await gotoStep(page, 'Request')
  await expect(page.getByRole('textbox', { name: 'PR number', exact: true })).toHaveValue('RAD-PRJ-PR-9001_2026')
  await expect(page.getByRole('textbox', { name: 'Product / service', exact: true })).toHaveValue('Value Engineering Services')
  await expect(page.getByRole('textbox', { name: 'Edit selected project or department', exact: true })).toHaveValue(formProject.label)
  await gotoStep(page, 'Supplier & pricing')
  await page.getByRole('searchbox', { name: 'Search vendors by name or code', exact: true }).fill('Petro')
  await expect(page.getByRole('searchbox', { name: 'Search vendors by name or code', exact: true })).toHaveValue('Petro')
  await expect(page.locator('.prf-sp-vendor-option')).toHaveCount(1)
  await expect(page.locator('.prf-sp-vendor-option')).toContainText('Petroserve Solutions')
  await page.getByRole('button', { name: 'Close supplier search', exact: true }).click()
  await page.getByRole('combobox', { name: /^Preferred supplier/ }).selectOption('22')
  await expect(preview(page)).toContainText('Petroserve Solutions')
  await page.getByRole('spinbutton', { name: 'Line item 1 quantity', exact: true }).fill('3')
  await page.getByRole('spinbutton', { name: 'Line item 1 unit price', exact: true }).fill('1000')
  await expect(page.locator('.prf-sp-grand-total')).toContainText('3,150.00')
  await workspace(page).getByRole('button', { name: 'Save draft', exact: true }).first().click()
  await expect.poll(() => Number(state.record.total_price)).toBe(3000)
  expect(state.record.supplier_name).toBe('Petroserve Solutions')
  expect(Number(state.record.items[0].quantity)).toBe(3)
  expect(Number(state.record.items[0].total)).toBe(3000)
  expect(saves(state).every(({ method }) => method === 'PATCH')).toBeTruthy()
  await gotoStep(page, 'Business justification')
  await expect(page.getByRole('textbox', { name: 'Purchase description', exact: true })).toHaveValue('Value engineering for the approved EPC design package.')
  await gotoStep(page, 'Supplier & pricing')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('button', { name: 'Open sidebar', exact: true })).toBeVisible()
  await page.locator('main.main-content').evaluate(element => { element.scrollTop = 0 })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  await page.screenshot({ path: '../artifacts/purchase-recommendation-form-shell-390.png' })
  verifyIsolation(state)
})

test('high-value approval remains blocked without management approval and evidence', async ({ page }) => {
  const state = await open(page, { edit: true })
  await page.getByRole('button', { name: 'Review & submit', exact: true }).click()
  await expect(editor(page)).toContainText('Management Approval Required')
  await page.getByRole('button', { name: 'Submit for approval', exact: true }).click()
  await expect(editor(page)).toContainText('Attach evidence of management approval')
  expect(state.submissions).toEqual([])
  await preview(page).getByRole('tab', { name: /^Validation/ }).click()
  await expect(preview(page).getByRole('tabpanel', { name: /^Validation/ })).toContainText('Management Approval must be Yes')
  verifyIsolation(state)
})

test('valid edited recommendation submits through the existing workflow endpoint', async ({ page }) => {
  const state = await open(page, { edit: true, record: {
    total_price: '1000.00', net_total_excl_vat: '1000.00',
    items: [{ description: 'Approved engineering review package', quantity: '1', unit: 'EA', unit_price: '1000.00', total: '1000.00' }],
  } })
  await page.getByRole('button', { name: 'Review & submit', exact: true }).click()
  await page.getByRole('button', { name: 'Submit for approval', exact: true }).click()
  await expect.poll(() => state.submissions.length).toBe(1)
  expect(state.submissions[0].approval_workflow_config.map(stage => Number(stage.level))).toEqual([0, 1, 3, 4, 5])
  await expect(page).toHaveURL(/\/procurement\/requisitions$/)
  await expect(page.getByRole('heading', { name: 'Purchase Recommendations', exact: true })).toBeVisible()
  verifyIsolation(state)
})

test('preview zoom and PDF export use the current document without saving the recommendation', async ({ page }) => {
  const state = await open(page)
  await page.getByRole('textbox', { name: 'Product / service', exact: true }).fill('Isolated preview export check')
  const currentScale = await preview(page).getByLabel('Preview zoom', { exact: true }).textContent()
  await preview(page).getByRole('button', { name: 'Zoom in preview', exact: true }).click()
  await expect(preview(page).getByLabel('Preview zoom', { exact: true })).not.toHaveText(currentScale)
  await preview(page).getByRole('button', { name: 'Fit width', exact: true }).click()
  await expect(preview(page).getByRole('button', { name: 'Fit width', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const downloadPromise = page.waitForEvent('download')
  await preview(page).getByRole('button', { name: 'Download PDF', exact: true }).click()
  const download = await downloadPromise
  await download.saveAs('../artifacts/purchase-recommendation-form-preview.pdf')
  const contents = await readFile('../artifacts/purchase-recommendation-form-preview.pdf')
  expect(contents.subarray(0, 5).toString()).toBe('%PDF-')
  expect(contents.length).toBeGreaterThan(1000)
  expect(saves(state)).toEqual([])
  verifyIsolation(state)
})

test('all five form steps expose accessible names and readable contrast', async ({ page }) => {
  const state = await open(page, { edit: true })
  const audits = []
  for (const name of ['Request', 'Supplier & pricing', 'Business justification', 'Documents', 'Approval & submit']) {
    await gotoStep(page, name)
    const result = await new AxeBuilder({ page }).include('.recommendation-form-workspace').analyze()
    audits.push({ step: name, violations: result.violations.filter(({ impact }) => ['serious', 'critical'].includes(impact)) })
  }
  await writeFile('../artifacts/purchase-recommendation-form-step-accessibility.json', JSON.stringify(audits, null, 2))
  expect(audits.filter(({ violations }) => violations.length)).toEqual([])
  verifyIsolation(state)
})

test('desktop and mobile retain the existing sidebar with accessible form and usable scrolling', async ({ page }) => {
  const protectedFiles = ['src/components/Layout/Sidebar.jsx', 'src/components/Layout/Sidebar.css', 'src/config/layout.config.js']
  const hashes = async () => Object.fromEntries(await Promise.all(protectedFiles.map(async path => [path, createHash('sha256').update(await readFile(path)).digest('hex')])))
  const before = await hashes()
  const state = await open(page, { edit: true })
  await gotoStep(page, 'Supplier & pricing')
  const measurements = []
  for (const width of [1672, 1366, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 941 })
    await page.evaluate(() => document.fonts.ready)
    await page.locator('main.main-content').evaluate(element => { element.scrollTop = 0 })
    const measure = await page.evaluate(() => {
      const box = selector => { const element = document.querySelector(selector); if (!element) return null; const bounds = element.getBoundingClientRect(); return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, bottom: bounds.bottom, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth } }
      return { width: innerWidth, html: box('html'), sidebar: box('#application-sidebar'), header: box('#application-content > header'), workspace: box('.recommendation-form-workspace'), editor: box('.prf-editor'), preview: box('.rpp-preview'), bottomActions: box('.prf-action-bar'), overflow: [...document.querySelectorAll('.recommendation-form-workspace *')].filter(element => element.getBoundingClientRect().right > innerWidth + 1).slice(0, 25).map(element => ({ tag: element.tagName, className: element.className, width: element.getBoundingClientRect().width, right: element.getBoundingClientRect().right, overflowX: getComputedStyle(element).overflowX, minWidth: getComputedStyle(element).minWidth })) }
    })
    measurements.push(measure)
    if (width > 1000) expect(measure.sidebar.width).toBe(250)
    else await expect(page.getByRole('button', { name: 'Open sidebar', exact: true })).toBeVisible()
    await page.screenshot({ path: `../artifacts/purchase-recommendation-form-shell-${width}.png` })
  }
  const accessibility = await new AxeBuilder({ page }).include('.recommendation-form-workspace').analyze()
  await writeFile('../artifacts/purchase-recommendation-form-evidence.json', JSON.stringify({ measurements, protectedFilesBefore: before, protectedFilesAfter: await hashes(), accessibility: accessibility.violations, requests: state.requests, unknown: state.unknown, pageErrors: state.pageErrors }, null, 2))
  for (const measure of measurements) expect(measure.html.scrollWidth).toBeLessThanOrEqual(measure.width)
  expect(await hashes()).toEqual(before)
  expect(accessibility.violations.filter(({ impact }) => ['serious', 'critical'].includes(impact))).toEqual([])
  verifyIsolation(state)
})
