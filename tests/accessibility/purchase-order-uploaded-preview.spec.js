import { test, expect } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import { orderFormHarness, orderFormId, orderFormNumber, orderFormRecommendation } from '../fixtures/purchase-order-form.fixture'

test.setTimeout(120000)
test.use({ actionTimeout: 30000 })
test.use({ serviceWorkers: 'block', viewport: { width: 1910, height: 945 } })

// Real, tiny PDFs created exclusively for this browser test. The originals have
// deliberately different bytes from the generated export to catch fallback bugs.
function pdfFile(text) {
  const stream = `BT /F1 12 Tf 40 760 Td (${text}) Tj ET`
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>', `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(value => `${String(value).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf)
}

const original = pdfFile('ORIGINAL SIGNED UPLOAD - synthetic test only')
const revision = pdfFile('SECOND SIGNED UPLOAD - synthetic test only')
const generated = pdfFile('GENERATED EXPORT - not the uploaded original')
const doc = (id, filename) => ({ id, filename, content_url: `/api/v1/procurement/orders/${orderFormId}/uploaded-documents/${id}/content/`, uploaded_at: '2026-09-15T08:00:00Z' })
const firstDocument = doc('00000000-0000-4000-8000-000000009101', 'Signed-PO-original.pdf')
const secondDocument = doc('attachment-0', 'Signed-PO-revision.pdf')
const uploads = page => page.locator('.upo-preview:visible')
const uploadedViewer = (page, filename = firstDocument.filename) => uploads(page).getByRole('region', { name: `Uploaded PO PDF: ${filename}`, exact: true })
const generatedViewer = page => page.getByRole('region', { name: `Purchase Order ${orderFormNumber} PDF preview`, exact: true })
const documentRequests = state => state.requests.filter(({ path }) => path.includes('/uploaded-documents/'))
const assertReadOnly = state => {
  expect(state.requests.filter(({ method, path }) => path.startsWith('/api/v1/procurement/') && !['GET', 'HEAD', 'OPTIONS'].includes(method))).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
}

async function open(page, { detail = false, documents = [firstDocument], prepare } = {}) {
  const state = await orderFormHarness(page, {
    path: detail ? `/procurement/orders/${orderFormId}` : '/procurement/orders',
    prepare: fixture => {
      fixture.record = {
        id: orderFormId, po_number: orderFormNumber, po_date: '2026-09-15', status: 'draft',
        title: 'Synthetic uploaded PO preview', summary: 'Uploaded document comparison',
        pr_reference: orderFormRecommendation.id, pr_number: orderFormRecommendation.pr_number,
        vendor: 21, vendor_name: fixture.vendors[0].name, currency: 'AED', project_number: '5900985',
        total_amount: '420000.00', tax_amount: '20000.00', expected_delivery: '2026-10-20',
        items: [{ description: 'Synthetic engineering services', quantity: 1, unit: 'Package', unit_price: '400000.00', total_price: '400000.00' }],
        created_at: '2026-09-15T08:00:00Z', attachments: [], approval_log: [],
      }
      fixture.orders = [fixture.record]
      fixture.uploadedDocuments = documents
      fixture.uploadedContent[firstDocument.content_url] = { body: original }
      fixture.uploadedContent[secondDocument.content_url] = { body: revision }
      fixture.generatedPdf = generated
      prepare?.(fixture)
    },
  })
  if (detail) {
    await expect(page.getByRole('region', { name: 'Purchase order PDF preview', exact: true })).toBeVisible({ timeout: 90000 })
  } else {
    await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible({ timeout: 90000 })
    await page.getByRole('button', { name: `Actions for ${orderFormNumber}`, exact: true }).click()
    await page.getByRole('menuitem', { name: 'Edit order', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Edit purchase order', exact: true })).toBeVisible()
  }
  const tabs = page.getByRole('tablist', { name: 'Purchase order preview views', exact: true })
  await expect(page.getByRole('tab', { name: /^(Uploaded|Generated) PO$/ })).toHaveCount(0)
  if (!detail) await expect(tabs.getByRole('tab', { name: 'Document', exact: true })).toHaveAttribute('aria-selected', 'true')
  return { state, tabs }
}

async function downloadOriginal(page, expected, filename) {
  const pending = page.waitForEvent('download')
  await uploads(page).getByRole('link', { name: 'Download uploaded PO', exact: true }).click()
  const download = await pending
  expect(download.suggestedFilename()).toBe(filename)
  expect(await readFile(await download.path())).toEqual(expected)
}

async function expectViewerFillsPanel(viewer, panel) {
  await expect(viewer.getByRole('img')).toBeVisible({ timeout: 30000 })
  await expect.poll(async () => {
    const viewerBounds = await viewer.boundingBox()
    const panelBounds = await panel.boundingBox()
    return Math.max(Math.abs(viewerBounds.x - panelBounds.x), Math.abs(viewerBounds.width - panelBounds.width),
      Math.abs(viewerBounds.y + viewerBounds.height - panelBounds.y - panelBounds.height))
  }, { message: 'The controlled PDF viewer must fill the panel below any source selector or toolbar.' }).toBeLessThanOrEqual(2)
  const bounds = await viewer.boundingBox()
  const panelBounds = await panel.boundingBox()
  expect(bounds.y).toBeGreaterThanOrEqual(panelBounds.y - 2)
  expect(bounds.y).toBeLessThanOrEqual(panelBounds.y + 80)
  expect(bounds.height).toBeGreaterThan(200)
  await expect(viewer.getByRole('button', { name: 'Fit width', exact: true })).toBeVisible()
}

test('edit preview defaults to authenticated original PDF and downloads exact uploaded bytes', async ({ page }) => {
  const { state, tabs } = await open(page)
  const viewer = uploadedViewer(page)
  await expect(viewer.getByRole('img', { name: `Uploaded PO PDF: ${firstDocument.filename}, page 1 of 1`, exact: true })).toBeVisible({ timeout: 30000 })
  await expectViewerFillsPanel(viewer, page.locator('.pop-uploaded'))
  await expect(uploads(page)).not.toContainText(firstDocument.filename)
  await expect(uploads(page).getByRole('link', { name: 'Download uploaded PO', exact: true })).toHaveText('')
  await expect(uploads(page).getByRole('link', { name: 'Open uploaded PO', exact: true })).toHaveAttribute('href', /^blob:/)
  await expect(page.locator('.pop-document')).toHaveCount(0)
  expect(documentRequests(state).filter(({ path }) => path.endsWith('/content/'))[0].authorization).toBe('Bearer isolated-order-form-fixture-token')
  await downloadOriginal(page, original, firstDocument.filename)
  expect(state.requests.filter(({ path }) => path.endsWith('/export-pdf/'))).toEqual([])
  await page.screenshot({ path: '../artifacts/po-original-preview-edit-desktop.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await uploads(page).scrollIntoViewIfNeeded()
  await expectViewerFillsPanel(viewer, page.locator('.pop-uploaded'))
  await page.screenshot({ path: '../artifacts/po-original-preview-edit-mobile.png' })
  await page.setViewportSize({ width: 1910, height: 945 })
  const documentTab = tabs.getByRole('tab', { name: 'Document', exact: true })
  await documentTab.focus()
  await documentTab.press('ArrowRight')
  await expect(tabs.getByRole('tab', { name: /^Validation/ })).toBeFocused()
  await tabs.getByRole('tab', { name: /^Validation/ }).press('Home')
  await expect(documentTab).toBeFocused()
  await expect(uploadedViewer(page).getByRole('img')).toBeVisible({ timeout: 30000 })
  assertReadOnly(state)
})

test('source discovery failure stays explicit until retry confirms there is no uploaded original', async ({ page }) => {
  const { state } = await open(page, { documents: [], prepare: fixture => { fixture.uploadedDocumentsError = { detail: 'Synthetic temporary outage.' } } })
  await expect(uploads(page).getByRole('alert')).toContainText('Uploaded PO documents could not be loaded.')
  await expect(page.locator('.pop-document')).toHaveCount(0)
  expect(state.requests.filter(({ path }) => path.endsWith('/export-pdf/'))).toEqual([])
  state.uploadedDocumentsError = null
  await uploads(page).getByRole('button', { name: 'Retry uploaded PO', exact: true }).click()
  await expect(page.locator('.pop-document:visible')).toContainText(orderFormNumber)
  await expect(uploads(page)).toHaveCount(0)
  expect(documentRequests(state).filter(({ path }) => path.endsWith('/content/'))).toEqual([])
  assertReadOnly(state)
})

test('missing original content stays explicit and multiple uploaded PDFs remain distinct', async ({ page }) => {
  const { state } = await open(page, { documents: [firstDocument, secondDocument], prepare: fixture => { fixture.uploadedContent[firstDocument.content_url] = { status: 404 } } })
  await expect(uploads(page).getByRole('alert')).toContainText('The uploaded PO PDF is no longer available.')
  await expect(uploads(page).getByRole('link', { name: 'Download uploaded PO', exact: true })).toHaveCount(0)
  await expect(page.locator('.pop-document')).toHaveCount(0)
  state.uploadedContent[firstDocument.content_url] = { body: original }
  await uploads(page).getByRole('button', { name: 'Retry uploaded PO', exact: true }).click()
  await expect(uploadedViewer(page).getByRole('img')).toBeVisible({ timeout: 30000 })
  const oldUrl = await uploads(page).getByRole('link', { name: 'Open uploaded PO', exact: true }).getAttribute('href')
  await uploads(page).getByRole('combobox', { name: 'Uploaded PO document', exact: true }).selectOption(secondDocument.id)
  await expect(uploadedViewer(page, secondDocument.filename).getByRole('img')).toBeVisible({ timeout: 30000 })
  await expect(uploads(page).getByRole('link', { name: 'Open uploaded PO', exact: true })).not.toHaveAttribute('href', oldUrl)
  await downloadOriginal(page, revision, secondDocument.filename)
  expect(state.requests.filter(({ path }) => path.endsWith('/export-pdf/'))).toEqual([])
  assertReadOnly(state)
})

test('saved order defaults to its original without generating another PDF and fits mobile', async ({ page }) => {
  const { state } = await open(page, { detail: true })
  await expect(uploadedViewer(page).getByRole('img')).toBeVisible({ timeout: 30000 })
  await expect(page.getByRole('tablist', { name: 'Purchase order PDF source' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Print PDF', exact: true })).toHaveCount(0)
  await expect(generatedViewer(page)).toHaveCount(0)
  await expectViewerFillsPanel(uploadedViewer(page), page.locator('.po-detail-pdf-preview'))
  await expect(uploads(page)).not.toContainText(firstDocument.filename)
  await downloadOriginal(page, original, firstDocument.filename)
  expect(state.requests.filter(({ path }) => path.endsWith('/export-pdf/'))).toEqual([])
  await page.screenshot({ path: '../artifacts/po-original-preview-saved-desktop.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await uploads(page).scrollIntoViewIfNeeded()
  await expectViewerFillsPanel(uploadedViewer(page), page.locator('.po-detail-pdf-preview'))
  const bounds = await uploads(page).boundingBox()
  expect(bounds.width).toBeGreaterThan(200)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: '../artifacts/po-original-preview-saved-mobile.png' })
  assertReadOnly(state)
})

test('saved order generates a preview only after source discovery confirms no original', async ({ page }) => {
  let release
  const pending = new Promise(resolve => { release = resolve })
  const { state } = await open(page, { detail: true, documents: [], prepare: fixture => { fixture.uploadedDocumentsDeferred = pending } })
  await expect(uploads(page)).toContainText('Loading uploaded PO documents')
  expect(state.requests.filter(({ path }) => path.endsWith('/export-pdf/'))).toEqual([])
  release()
  await expect(generatedViewer(page).getByRole('img')).toBeVisible({ timeout: 30000 })
  await expectViewerFillsPanel(generatedViewer(page), page.locator('.po-detail-pdf-preview'))
  await expect(page.getByRole('link', { name: 'Open Purchase Order PDF', exact: true })).toBeVisible()
  const print = page.getByRole('button', { name: 'Print PDF', exact: true })
  await expect(print).toBeVisible()
  const originalUrl = await page.getByRole('link', { name: 'Open Purchase Order PDF', exact: true }).getAttribute('href')
  const opened = page.waitForEvent('popup')
  await print.click()
  const printWindow = await opened
  await expect(printWindow).toHaveURL(originalUrl)
  await printWindow.close()
  expect(state.requests.filter(({ path }) => path.endsWith('/export-pdf/'))).toHaveLength(1)
  await expect(uploads(page)).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('.po-detail-pdf-preview').scrollIntoViewIfNeeded()
  await expectViewerFillsPanel(generatedViewer(page), page.locator('.po-detail-pdf-preview'))
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  assertReadOnly(state)
})

test('saved order source errors never trigger a generated replacement', async ({ page }) => {
  const { state } = await open(page, { detail: true, prepare: fixture => { fixture.uploadedDocumentsError = { detail: 'Synthetic source outage.' } } })
  await expect(uploads(page).getByRole('alert')).toContainText('Uploaded PO documents could not be loaded.')
  expect(state.requests.filter(({ path }) => path.endsWith('/export-pdf/'))).toEqual([])
  state.uploadedDocumentsError = null
  await uploads(page).getByRole('button', { name: 'Retry uploaded PO', exact: true }).click()
  await expect(uploadedViewer(page).getByRole('img')).toBeVisible({ timeout: 30000 })
  expect(state.requests.filter(({ path }) => path.endsWith('/export-pdf/'))).toEqual([])
  assertReadOnly(state)
})

test('changing saved orders discards a late source response from the previous order', async ({ page }) => {
  let release
  const pending = new Promise(resolve => { release = resolve })
  const { state } = await open(page, { detail: true, prepare: fixture => { fixture.uploadedDocumentsDeferred = pending } })
  await expect(uploads(page)).toContainText('Loading uploaded PO documents')
  const nextId = '00000000-0000-4000-8000-000000009003'
  const nextDocument = { ...secondDocument, content_url: `/api/v1/procurement/orders/${nextId}/uploaded-documents/attachment-0/content/` }
  await page.route(`**/api/v1/procurement/orders/${nextId}/**`, async route => {
    const path = new URL(route.request().url()).pathname
    state.requests.push({ path, method: route.request().method() })
    if (path.endsWith('/uploaded-documents/')) return route.fulfill({ json: { results: [nextDocument] } })
    if (path.endsWith('/content/')) return route.fulfill({ contentType: 'application/pdf', body: revision })
    if (path.endsWith(`/${nextId}/`)) return route.fulfill({ json: { ...state.record, id: nextId, po_number: 'PO-NEXT-SYNTHETIC' } })
    state.unknown.push({ path })
    return route.fulfill({ status: 400, json: {} })
  })
  await page.evaluate(next => {
    window.history.pushState({}, '', `/procurement/orders/${next}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, nextId)
  await expect(uploadedViewer(page, secondDocument.filename).getByRole('img')).toBeVisible({ timeout: 30000 })
  release()
  await downloadOriginal(page, revision, secondDocument.filename)
  await expect(uploads(page)).not.toContainText(firstDocument.filename)
  expect(state.requests.filter(({ path }) => path.endsWith('/export-pdf/'))).toEqual([])
  assertReadOnly(state)
})
