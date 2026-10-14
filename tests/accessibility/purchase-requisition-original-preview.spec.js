import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { recommendationHarness, recommendationId as id, recommendationNumber as number } from '../fixtures/purchase-recommendations.fixture'

test.setTimeout(90000)
const details = page => page.getByRole('complementary', { name: 'Recommendation details' })
const preview = page => page.getByRole('region', { name: 'Procurement document preview', exact: true })
const prPanel = page => preview(page).getByRole('tabpanel', { name: 'PR Preview', exact: true })
const poPanel = page => preview(page).getByRole('tabpanel', { name: /^Linked PO/ })
const assertRendererWidth = async (panel, viewer) => {
  await expect.poll(async () => {
    const outer = await panel.boundingBox()
    const inner = await viewer.boundingBox()
    return Math.max(Math.abs(outer.x - inner.x), Math.abs(outer.width - inner.width))
  }, { message: 'The PDF viewer must use the full approval preview panel width.' }).toBeLessThanOrEqual(2)
}
const source = (filename, fields = {}) => ({ type: 'signed_purchase_requisition_pdf', filename, url: `/__approval-source-fixture__/${filename}`, ...fields })
function pdfFile(label) {
  const stream = `BT /F1 14 Tf 40 750 Td (${label}) Tj ET`
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
  let pdf = '%PDF-1.4\n'
  const offsets = []
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(value => `${String(value).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return pdf
}
const originalPo = pdfFile('ORIGINAL uploaded linked PO - synthetic test')
const originalPr = pdfFile('ORIGINAL SIGNED PR - synthetic test')
const linkedDocument = { id: 'source-101', filename: 'Original-linked-PO.pdf', content_url: '/api/v1/procurement/orders/101/uploaded-documents/source-101/content/' }
const update = (state, index, patch) => {
  Object.assign(state.props.requisitions[index - 1], patch)
  Object.assign(state.details[id(index + 200)], patch)
}
const loaded = async page => {
  await expect(page.getByRole('heading', { name: 'Purchase Recommendations', exact: true })).toBeVisible()
  await expect(details(page)).toHaveAttribute('aria-busy', 'false')
}
const openApprovalRecord = async (page, index = 1) => {
  await page.getByRole('button', { name: `Select ${number(index)}`, exact: true }).click()
  await expect(details(page)).toHaveAttribute('aria-busy', 'false')
  await details(page).getByRole('button', { name: 'View approval record', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.recommendationRoute || window.location.pathname)).toBe(`/procurement/requisitions/${id(index + 200)}`)
  await expect(page.getByRole('heading', { name: number(index), level: 1, exact: true })).toBeVisible()
  if (await preview(page).getByRole('tab', { name: 'PR + PO', exact: true }).count()) {
    await preview(page).getByRole('tab', { name: 'PR Preview', exact: true }).click()
  }
}
const mockSources = async page => {
  const files = []
  await page.route('**/__approval-source-fixture__/**', async route => {
    files.push(new URL(route.request().url()).pathname)
    await route.fulfill({ contentType: 'application/pdf', headers: { 'x-frame-options': 'DENY' }, body: originalPr })
  })
  // Rendering a saved original must not rebuild a PDF from the form in the background.
  await page.addInitScript(() => {
    window.previewCanvasRenders = 0
    const original = HTMLCanvasElement.prototype.toDataURL
    HTMLCanvasElement.prototype.toDataURL = function (...args) {
      window.previewCanvasRenders += 1
      return original.apply(this, args)
    }
  })
  return files
}
const clean = state => {
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
  expect(state.requests.filter(request => request.method !== 'GET' && request.path !== '/api/v1/rbac/ai-champion/track/activity/')).toEqual([])
}
const exports = state => state.requests.filter(request => /\/(export_pdf|export-pdf)\/$/.test(request.path))
const pdfBytes = async (page, frame) => {
  await expect(frame).toHaveAttribute('src', /^blob:/)
  return page.evaluate(async url => (await fetch(url.split('#')[0])).text(), await frame.getAttribute('src'))
}
const assertCompactViewport = async (page, panel) => {
  const frame = panel.locator('iframe')
  await expect(frame).toBeVisible()
  await expect(panel.getByRole('heading', { name: 'Original uploaded PR', exact: true })).toHaveCount(0)
  await expect(panel.locator('.prr-source-filename')).toHaveCount(0)
  await expect(panel).not.toContainText('If the PDF does not display here')
  const container = await panel.boundingBox()
  const paper = await frame.boundingBox()
  expect(Math.abs(paper.x - container.x)).toBeLessThanOrEqual(2)
  expect(Math.abs(paper.width - container.width)).toBeLessThanOrEqual(2)
  expect(Math.abs(paper.y + paper.height - container.y - container.height)).toBeLessThanOrEqual(2)
  expect(paper.y - container.y).toBeLessThanOrEqual(52)
  expect(paper.height).toBeGreaterThanOrEqual(container.height - 52)
  expect(container.height).toBeLessThanOrEqual(await page.evaluate(() => innerHeight))
}

test('View approval record defaults both document tabs to uploaded originals without generating replacements', async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 1040 })
  const files = await mockSources(page)
  const contentUrl = `/api/v1/procurement/requisitions/${id(201)}/uploaded-documents/0/content/`
  const state = await recommendationHarness(page, { realApp: true, prepare: state => {
    update(state, 1, { status: 'converted', linked_po_id: '101', po_number_reference: 'PO-TEST-001', attachments: [source('signed-original.pdf', { content_url: contentUrl })] })
    state.uploadedDocuments['101'] = [linkedDocument]
    state.uploadedContent[linkedDocument.content_url] = { body: originalPo }
  } })
  const protectedRequests = []
  await page.route(`**${contentUrl}`, async route => {
    protectedRequests.push({ method: route.request().method(), resourceType: route.request().resourceType() })
    await route.fulfill({ contentType: 'application/pdf', headers: { 'x-frame-options': 'DENY' }, body: originalPr })
  })
  await loaded(page)
  await openApprovalRecord(page)
  const prTab = preview(page).getByRole('tab', { name: 'PR Preview', exact: true })
  await expect(preview(page).getByRole('tab')).toHaveCount(3)
  await expect(preview(page).getByRole('tab', { name: 'Uploaded PR', exact: true })).toHaveCount(0)
  await expect(prTab).toHaveAttribute('aria-selected', 'true')
  await expect(prPanel(page).locator('iframe')).toHaveAttribute('title', 'Original uploaded PR: signed-original.pdf')
  expect(await pdfBytes(page, prPanel(page).locator('iframe'))).toBe(originalPr)
  expect(protectedRequests).toEqual([{ method: 'GET', resourceType: 'xhr' }])
  expect(files).toEqual([])
  await expect(prPanel(page).getByRole('link', { name: 'Open original PDF', exact: true })).toHaveAttribute('href', /^blob:/)
  await assertCompactViewport(page, prPanel(page))
  await expect(page.getByRole('button', { name: /^Download .* PDF$/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Print .* preview$/ })).toHaveCount(0)

  await preview(page).getByRole('tab', { name: /^Linked PO/ }).click()
  await expect(poPanel(page).getByRole('img', { name: `Uploaded PO PDF: ${linkedDocument.filename}, page 1 of 1`, exact: true })).toBeVisible({ timeout: 30000 })
  const linkedViewer = () => poPanel(page).getByRole('region', { name: `Uploaded PO PDF: ${linkedDocument.filename}`, exact: true })
  await assertRendererWidth(poPanel(page), linkedViewer())
  await preview(page).scrollIntoViewIfNeeded()
  await page.screenshot({ path: '../artifacts/original-document-preview/approval-po-controlled.png' })
  const download = page.waitForEvent('download')
  await poPanel(page).getByRole('link', { name: 'Download uploaded PO', exact: true }).click()
  const saved = await download
  expect(saved.suggestedFilename()).toBe(linkedDocument.filename)
  expect(await readFile(await saved.path(), 'utf8')).toBe(originalPo)
  await prTab.click()
  await expect(prPanel(page).locator('iframe')).toHaveAttribute('title', 'Original uploaded PR: signed-original.pdf')
  expect(await pdfBytes(page, prPanel(page).locator('iframe'))).toBe(originalPr)
  await preview(page).scrollIntoViewIfNeeded()
  await page.screenshot({ path: '../artifacts/original-document-preview/approval-pr-compact.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await assertCompactViewport(page, prPanel(page))
  await preview(page).scrollIntoViewIfNeeded()
  await page.screenshot({ path: '../artifacts/original-document-preview/approval-pr-compact-mobile.png' })
  await preview(page).getByRole('tab', { name: /^Linked PO/ }).click()
  await expect(linkedViewer().getByRole('img')).toBeVisible({ timeout: 30000 })
  await assertRendererWidth(poPanel(page), linkedViewer())
  await expect.poll(() => poPanel(page).evaluate(element => {
    const bounds = element.getBoundingClientRect()
    const footerTop = document.querySelector('footer')?.getBoundingClientRect().top ?? innerHeight
    const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.bottom - 2)
    return bounds.bottom <= footerTop + 1 && element.contains(hit)
  }), { message: 'The mobile Linked PO preview must remain visible above the app footer.' }).toBe(true)
  await page.screenshot({ path: '../artifacts/original-document-preview/approval-po-controlled-mobile.png' })
  expect(await page.evaluate(() => window.previewCanvasRenders)).toBe(0)
  expect(exports(state)).toEqual([])
  clean(state)
})

test('failed or invalid original PDF bytes retry inside the compact panel without generating a substitute', async ({ page }) => {
  await mockSources(page)
  const contentUrl = `/api/v1/procurement/requisitions/${id(201)}/uploaded-documents/0/content/`
  const state = await recommendationHarness(page, { integration: true, prepare: state => update(state, 1, {
    attachments: [source('protected-original.pdf', { content_url: contentUrl })],
  }) })
  let response = { status: 404, body: '' }
  await page.route(`**${contentUrl}`, route => route.fulfill({ ...response, contentType: 'application/pdf', headers: { 'x-frame-options': 'DENY' } }))
  await loaded(page)
  await openApprovalRecord(page)
  await expect(prPanel(page).getByRole('alert')).toContainText('The original PR PDF is no longer available.')
  await expect(prPanel(page).locator('iframe')).toHaveCount(0)
  response = { status: 200, body: '<html>This is not a saved PDF.</html>' }
  await prPanel(page).getByRole('button', { name: 'Retry original PDF', exact: true }).click()
  await expect(prPanel(page).getByRole('alert')).toContainText('The original PR PDF could not be loaded.')
  await expect(prPanel(page).locator('iframe')).toHaveCount(0)
  response = { status: 200, body: originalPr }
  await prPanel(page).getByRole('button', { name: 'Retry original PDF', exact: true }).click()
  expect(await pdfBytes(page, prPanel(page).locator('iframe'))).toBe(originalPr)
  await assertCompactViewport(page, prPanel(page))
  expect(exports(state)).toEqual([])
  expect(await page.evaluate(() => window.previewCanvasRenders)).toBe(0)
  clean(state)
})

test('default original PR supports multiple files, keyboard document tabs, mobile layout and selection reset', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const files = await mockSources(page)
  const state = await recommendationHarness(page, { integration: true, prepare: state => {
    update(state, 1, { linked_po_id: '101', po_number_reference: 'PO-TEST-001', attachments: [source('first-original.pdf'), source('second-original.pdf')] })
    update(state, 2, { attachments: [source('different-pr.pdf')] })
    state.uploadedDocuments['101'] = [linkedDocument]
    state.uploadedContent[linkedDocument.content_url] = { body: originalPo }
  } })
  await loaded(page)
  await openApprovalRecord(page)
  const prTab = preview(page).getByRole('tab', { name: 'PR Preview', exact: true })
  const linkedTab = preview(page).getByRole('tab', { name: /^Linked PO/ })
  const combinedTab = preview(page).getByRole('tab', { name: 'PR + PO', exact: true })
  await expect(prPanel(page).locator('iframe')).toHaveAttribute('title', 'Original uploaded PR: first-original.pdf')
  await prPanel(page).getByRole('combobox', { name: 'Uploaded PR file', exact: true }).selectOption({ label: 'second-original.pdf' })
  await expect(prPanel(page).locator('iframe')).toHaveAttribute('title', 'Original uploaded PR: second-original.pdf')
  await expect.poll(() => files.includes('/__approval-source-fixture__/second-original.pdf')).toBeTruthy()
  expect(await pdfBytes(page, prPanel(page).locator('iframe'))).toBe(originalPr)
  await assertCompactViewport(page, prPanel(page))
  await prPanel(page).scrollIntoViewIfNeeded()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
  const bounds = await prPanel(page).boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
  await prTab.focus()
  await page.keyboard.press('ArrowRight')
  await expect(linkedTab).toBeFocused()
  await expect(linkedTab).toHaveAttribute('aria-selected', 'true')
  await expect(linkedTab).toHaveAttribute('tabindex', '0')
  await expect(prTab).toHaveAttribute('tabindex', '-1')
  await page.keyboard.press('Home')
  await expect(combinedTab).toBeFocused()
  await page.keyboard.press('End')
  await expect(linkedTab).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(combinedTab).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect(linkedTab).toBeFocused()
  await page.getByRole('button', { name: 'Back to Purchase Recommendations', exact: true }).click()
  await loaded(page)
  await openApprovalRecord(page, 2)
  await expect(preview(page).getByRole('tab')).toHaveCount(0)
  await expect(prPanel(page).locator('iframe')).toHaveAttribute('title', 'Original uploaded PR: different-pr.pdf')
  await expect(prPanel(page)).not.toContainText('first-original.pdf')
  await expect(prPanel(page)).not.toContainText('second-original.pdf')
  expect(await page.evaluate(() => window.previewCanvasRenders)).toBe(0)
  clean(state)
})

test('ordinary records retain generated PR preview and only generate linked PO after an empty source list', async ({ page }) => {
  const state = await recommendationHarness(page, { integration: true, prepare: state => update(state, 1, {
    linked_po_id: '101', po_number_reference: 'PO-TEST-001',
    attachments: [{ type: 'quotation', filename: 'supplier-quote.pdf', url: '/__approval-source-fixture__/supplier-quote.pdf' }],
  }) })
  await page.route('**/api/v1/procurement/orders/101/export-pdf/', route => {
    state.requests.push({ path: '/api/v1/procurement/orders/101/export-pdf/', method: 'GET' })
    return route.fulfill({ contentType: 'application/pdf', headers: { 'content-disposition': 'attachment; filename="PO-TEST-001.pdf"' }, body: pdfFile('Generated linked PO source') })
  })
  await loaded(page)
  await openApprovalRecord(page)
  await expect(prPanel(page).locator('iframe')).toHaveAttribute('src', /^blob:/, { timeout: 45000 })
  const generatedSource = await prPanel(page).locator('iframe').getAttribute('src')
  expect(await page.evaluate(async url => (await (await fetch(url.split('#')[0])).text()).slice(0, 5), generatedSource)).toBe('%PDF-')
  await assertCompactViewport(page, prPanel(page))
  await preview(page).scrollIntoViewIfNeeded()
  await page.screenshot({ path: '../artifacts/original-document-preview/approval-pr-generated-compact.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await assertCompactViewport(page, prPanel(page))
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(preview(page).getByRole('button', { name: 'Download Purchase Recommendation PDF', exact: true })).toBeEnabled()
  await preview(page).getByRole('tab', { name: /^Linked PO/ }).click()
  await expect(poPanel(page).getByRole('region', { name: 'PO-TEST-001.pdf preview', exact: true }).getByRole('img')).toBeVisible({ timeout: 30000 })
  const sourceIndex = state.requests.findIndex(request => request.path === '/api/v1/procurement/orders/101/uploaded-documents/')
  const exportIndex = state.requests.findIndex(request => request.path === '/api/v1/procurement/orders/101/export-pdf/')
  expect(sourceIndex).toBeGreaterThanOrEqual(0)
  expect(exportIndex).toBeGreaterThan(sourceIndex)
  await expect(preview(page).getByRole('button', { name: 'Download linked Purchase Order PDF', exact: true })).toBeEnabled()
  clean(state)
})

test('an original PR with a missing link stays unavailable instead of generating a substitute', async ({ page }) => {
  await mockSources(page)
  const state = await recommendationHarness(page, { integration: true, prepare: state => update(state, 1, {
    attachments: [source('original-missing-link.pdf', { url: undefined })],
  }) })
  await loaded(page)
  await openApprovalRecord(page)
  await expect(prPanel(page)).toContainText('The original file link is unavailable.')
  await expect(prPanel(page).getByRole('heading', { name: 'Original uploaded PR', exact: true })).toHaveCount(0)
  await expect(prPanel(page).locator('iframe')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Download .* PDF$/ })).toHaveCount(0)
  expect(await page.evaluate(() => window.previewCanvasRenders)).toBe(0)
  expect(exports(state)).toEqual([])
  clean(state)
})

test('linked PO discovery and original content failures can retry without generating substitute documents', async ({ page }) => {
  await mockSources(page)
  const state = await recommendationHarness(page, { integration: true, prepare: state => {
    update(state, 1, { linked_po_id: '101', po_number_reference: 'PO-TEST-001', attachments: [source('signed-original.pdf')] })
    state.uploadedDocumentErrors['101'] = 'Synthetic document-list outage.'
    state.uploadedDocuments['101'] = [linkedDocument]
    state.uploadedContent[linkedDocument.content_url] = { status: 404 }
  } })
  await loaded(page)
  await openApprovalRecord(page)
  await preview(page).getByRole('tab', { name: /^Linked PO/ }).click()
  await expect(poPanel(page).getByRole('alert')).toContainText('Uploaded PO documents could not be loaded.')
  expect(exports(state)).toEqual([])
  delete state.uploadedDocumentErrors['101']
  await poPanel(page).getByRole('button', { name: 'Retry uploaded PO', exact: true }).click()
  await expect(poPanel(page).getByRole('alert')).toContainText('The uploaded PO PDF is no longer available.')
  expect(exports(state)).toEqual([])
  state.uploadedContent[linkedDocument.content_url] = { body: originalPo }
  await poPanel(page).getByRole('button', { name: 'Retry uploaded PO', exact: true }).click()
  await expect(poPanel(page).getByRole('img', { name: `Uploaded PO PDF: ${linkedDocument.filename}, page 1 of 1`, exact: true })).toBeVisible({ timeout: 30000 })
  expect(exports(state)).toEqual([])
  expect(await page.evaluate(() => window.previewCanvasRenders)).toBe(0)
  clean(state)
})
