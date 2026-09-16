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
const fixturePdf = label => {
  const stream = `BT /F1 14 Tf 40 750 Td (${label}) Tj ET`
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
  let pdf = '%PDF-1.4\n'
  const offsets = []
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = pdf.length
  return `${pdf}xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(value => `${String(value).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
}
const assertCompactOriginal = async panel => {
  const frame = panel.locator('iframe')
  await expect(frame).toHaveAttribute('src', /^blob:/)
  await expect(panel.getByRole('heading', { name: 'Original uploaded PR', exact: true })).toHaveCount(0)
  await expect(panel.locator('.prr-source-filename')).toHaveCount(0)
  await expect(panel).not.toContainText('If the PDF does not display here')
  const area = await panel.boundingBox()
  const document = await frame.boundingBox()
  expect(Math.abs(document.x - area.x)).toBeLessThanOrEqual(2)
  expect(Math.abs(document.width - area.width)).toBeLessThanOrEqual(2)
  expect(Math.abs(document.y + document.height - area.y - area.height)).toBeLessThanOrEqual(2)
  expect(document.y - area.y).toBeLessThanOrEqual(52)
  expect(document.height).toBeGreaterThanOrEqual(area.height - 52)
}
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
  await expect(page.getByRole('textbox', { name: /^Reason for supplier selection/ })).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Currency', exact: true }).selectOption('AED')
  await page.getByRole('button', { name: 'Add line item', exact: true }).click()
  await page.getByRole('textbox', { name: 'Line item 1 description', exact: true }).fill('Value Engineering Services - Package 1 & 2')
  await page.getByRole('spinbutton', { name: 'Line item 1 unit price', exact: true }).fill('400000')
  await page.getByRole('combobox', { name: 'VAT price basis', exact: true }).selectOption('exclusive')
  await expect(page.getByLabel('Line item 1 VAT', { exact: true })).toHaveText('5%')
  await expect(page.getByRole('combobox', { name: 'Line item 1 VAT', exact: true })).toHaveCount(0)
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
  expect(state.record).toMatchObject({ pr_number: 'RAD-PRJ-PR-9001_2026', supplier_name: 'Alfanar Engineering LLC', total_price: 420000, net_total_excl_vat: 400000, currency: 'AED' })
  expect(state.record.items[0]).toMatchObject({ description: 'Value Engineering Services - Package 1 & 2', quantity: '1', unit_price: '400000', total: '400000.00' })
  expect(state.record.items[0]).not.toHaveProperty('vat_rate')
  expect(state.record.price_remarks_data.line_details[0]).toMatchObject({ vat_rate: '5', budget: '1000000' })
  await expect(page).toHaveURL(/\/procurement\/requisitions\/new$/)
  await page.getByRole('spinbutton', { name: 'Line item 1 quantity', exact: true }).fill('2')
  await page.getByRole('spinbutton', { name: 'Line item 1 unit price', exact: true }).fill('1250')
  await expect(page.locator('.prf-sp-grand-total')).toContainText('2,625.00')
  await workspace(page).getByRole('button', { name: 'Save draft', exact: true }).first().click()
  await expect.poll(() => Number(state.record.total_price)).toBe(2625)
  expect(saves(state).filter(({ method }) => method === 'POST')).toHaveLength(1)
  expect(saves(state).some(({ path, method }) => method === 'PATCH' && path.endsWith(`/${formRecordId}/`))).toBeTruthy()
  expect(state.submissions).toEqual([])
  // The API normalizes line items. VAT, vendor and budget must survive through
  // the supported metadata field and be restored when the draft is reopened.
  await page.goto(`/procurement/requisitions/${formRecordId}/edit`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Edit purchase recommendation', exact: true })).toBeVisible()
  await gotoStep(page, 'Supplier & pricing')
  await expect(page.getByLabel('Line item 1 VAT', { exact: true })).toHaveText('5%')
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
  await page.getByRole('combobox', { name: 'VAT price basis', exact: true }).selectOption('exclusive')
  await page.getByRole('spinbutton', { name: 'Line item 1 quantity', exact: true }).fill('3')
  await page.getByRole('spinbutton', { name: 'Line item 1 unit price', exact: true }).fill('1000')
  await expect(page.locator('.prf-sp-grand-total')).toContainText('3,150.00')
  await workspace(page).getByRole('button', { name: 'Save draft', exact: true }).first().click()
  await expect.poll(() => Number(state.record.total_price)).toBe(3150)
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

test('editing an uploaded PR keeps the original in Document while field edits and Validation remain usable', async ({ page }) => {
  const sourcePath = '/__form-pr-original__/signed-recommendation.pdf'
  const revisedPath = '/__form-pr-original__/revised-recommendation.pdf'
  const contentUrl = `/api/v1/procurement/requisitions/${formRecordId}/uploaded-documents/1/content/`
  const originalPdf = fixturePdf('ORIGINAL signed PR - synthetic test')
  const revisionPdf = fixturePdf('REVISED signed PR - synthetic test')
  const sourceRequests = []
  await page.route('**/__form-pr-original__/**', async route => {
    sourceRequests.push(new URL(route.request().url()).pathname)
    await route.fulfill({ contentType: 'application/pdf', headers: { 'x-frame-options': 'DENY' }, body: revisionPdf })
  })
  const state = await open(page, { edit: true, prepare: state => { state.originalContent[contentUrl] = { body: originalPdf, headers: { 'x-frame-options': 'DENY' } } }, record: { attachments: [
    { type: 'quotation', filename: 'supplier-quotation.pdf', url: '/__form-pr-original__/quotation.pdf' },
    { type: 'signed_purchase_requisition_pdf', filename: 'signed-recommendation.pdf', url: sourcePath, content_url: contentUrl },
    { type: 'signed_purchase_requisition_pdf', filename: 'revised-recommendation.pdf', url: revisedPath },
  ] } })
  const pane = preview(page)
  const original = pane.getByRole('region', { name: 'Original uploaded PR', exact: true })
  await expect(pane.getByRole('tab')).toHaveCount(2)
  await expect(pane.getByRole('tab', { name: 'Document', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(original.locator('iframe')).toHaveAttribute('src', /^blob:/)
  const originalBlobUrl = await original.locator('iframe').getAttribute('src')
  expect(await page.evaluate(async url => (await fetch(url.split('#')[0])).text(), originalBlobUrl)).toBe(originalPdf)
  await expect(original.getByRole('link', { name: 'Open original PDF', exact: true })).toHaveAttribute('href', /^blob:/)
  expect(state.requests.filter(({ path }) => path === contentUrl).length).toBeGreaterThan(0)
  expect(sourceRequests).toEqual([])
  await assertCompactOriginal(pane.getByRole('tabpanel', { name: 'Document', exact: true }))
  await pane.scrollIntoViewIfNeeded()
  await page.screenshot({ path: '../artifacts/original-document-preview/form-pr-compact.png' })
  await expect(pane.locator('.rpp-document, .rpp-document-viewport, .rpp-current')).toHaveCount(0)
  await expect(pane.getByRole('button', { name: 'Download PDF', exact: true })).toHaveCount(0)
  await expect(pane.getByRole('button', { name: 'Zoom in preview', exact: true })).toHaveCount(0)
  await expect(pane).not.toContainText('Updates as fields are completed')
  await expect(pane).not.toContainText('supplier-quotation.pdf')
  const sourceChoices = original.getByRole('combobox', { name: 'Uploaded PR file', exact: true })
  await sourceChoices.selectOption({ label: 'revised-recommendation.pdf' })
  await expect(original.locator('iframe')).toHaveAttribute('src', /^blob:/)
  await expect(original.locator('iframe')).not.toHaveAttribute('src', originalBlobUrl)
  const revisionBlobUrl = await original.locator('iframe').getAttribute('src')
  expect(await page.evaluate(async url => (await fetch(url.split('#')[0])).text(), revisionBlobUrl)).toBe(revisionPdf)

  await gotoStep(page, 'Request')
  await page.getByRole('textbox', { name: 'PR number', exact: true }).fill('RAD-PRJ-PR-9002_2026')
  await page.getByRole('textbox', { name: 'Product / service', exact: true }).fill('Edited commercial description')
  await gotoStep(page, 'Supplier & pricing')
  await page.getByRole('spinbutton', { name: 'Line item 1 quantity', exact: true }).fill('2')
  await expect(sourceChoices.locator('option:checked')).toHaveText('revised-recommendation.pdf')
  await expect(original.locator('iframe')).toHaveAttribute('src', revisionBlobUrl)
  await expect(pane.locator('.rpp-document')).toHaveCount(0)
  await pane.getByRole('tab', { name: /^Validation/ }).click()
  await expect(pane.getByRole('tabpanel', { name: /^Validation/ })).toContainText('Management Approval must be Yes')
  await expect(pane.getByRole('tabpanel', { name: 'Document', exact: true })).toBeHidden()
  await pane.getByRole('tab', { name: /^Validation/ }).focus()
  await page.keyboard.press('ArrowLeft')
  await expect(pane.getByRole('tabpanel', { name: 'Document', exact: true })).toBeVisible()
  await expect(original.locator('iframe')).toHaveAttribute('src', revisionBlobUrl)
  await page.setViewportSize({ width: 390, height: 844 })
  await original.scrollIntoViewIfNeeded()
  await expect(original.locator('iframe')).toBeVisible()
  await assertCompactOriginal(pane.getByRole('tabpanel', { name: 'Document', exact: true }))
  await page.screenshot({ path: '../artifacts/original-document-preview/form-pr-compact-mobile.png' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  expect(state.submissions).toEqual([])
  expect(sourceRequests.every(path => [sourcePath, revisedPath].includes(path))).toBeTruthy()
  expect(state.requests.filter(({ path }) => path.includes('export_pdf'))).toEqual([])
  verifyIsolation(state)
})

test('an uploaded PR with an unavailable link never falls back to a generated form preview', async ({ page }) => {
  const state = await open(page, { edit: true, record: { attachments: [
    { document_type: 'signed_purchase_requisition_pdf', filename: 'original-with-missing-link.pdf', url: '', s3_url: '' },
  ] } })
  const pane = preview(page)
  await expect(pane.locator('.prr-source-filename')).toHaveCount(0)
  await expect(pane).toContainText('The original file link is unavailable.')
  await expect(pane.locator('iframe, .rpp-document, .rpp-document-viewport')).toHaveCount(0)
  await expect(pane.getByRole('button', { name: 'Download PDF', exact: true })).toHaveCount(0)
  await gotoStep(page, 'Request')
  await page.getByRole('textbox', { name: 'Product / service', exact: true }).fill('Changed field with unavailable source')
  await pane.getByRole('tab', { name: /^Validation/ }).click()
  await expect(pane.getByRole('tabpanel', { name: /^Validation/ })).toBeVisible()
  await pane.getByRole('tab', { name: 'Document', exact: true }).click()
  await expect(pane).toContainText('The original file link is unavailable.')
  await expect(pane.locator('iframe, .rpp-document')).toHaveCount(0)
  expect(state.submissions).toEqual([])
  expect(state.requests.filter(({ path }) => path.includes('export_pdf'))).toEqual([])
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
