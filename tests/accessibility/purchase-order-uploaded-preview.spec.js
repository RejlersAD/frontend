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
const draftViewer = page => page.getByRole('complementary', { name: 'Live purchase order preview', exact: true }).getByRole('region', { name: /PDF preview/ })
const documentRequests = state => state.requests.filter(({ path }) => path.includes('/uploaded-documents/'))
const draftRequests = state => state.requests.filter(({ path }) => path.endsWith('/preview-document/'))
const generatedRequests = state => state.requests.filter(({ path }) => path.endsWith('/export-pdf/'))
const assertReadOnly = state => {
  expect(state.requests.filter(({ method, path }) => path.startsWith('/api/v1/procurement/')
    && !['GET', 'HEAD', 'OPTIONS'].includes(method)
    && !(method === 'POST' && path === '/api/v1/procurement/orders/preview-document/'))).toEqual([])
  expect(state.acceptedWrites).toEqual([])
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
  const tabs = page.getByRole('tablist', { name: detail ? 'Purchase order PDF source' : 'Purchase order preview views', exact: true })
  await expect(page.getByRole('tab', { name: /^(Uploaded|Generated) PO$/ })).toHaveCount(0)
  await expect(tabs.getByRole('tab', { name: 'Document', exact: true })).toHaveAttribute('aria-selected', 'true')
  return { state, tabs }
}

async function showOriginal(tabs) {
  await tabs.getByRole('tab', { name: 'Original source', exact: true }).click()
}

async function downloadCanonical(page, viewer) {
  const pending = page.waitForEvent('download')
  const link = viewer.getByRole('link', { name: /Download.*PDF/i })
  if (await link.count()) await link.click()
  else await page.getByRole('complementary', { name: 'Live purchase order preview', exact: true }).getByRole('button', { name: 'Download PDF', exact: true }).click()
  const download = await pending
  expect(await readFile(await download.path())).toEqual(generated)
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

test('edit preview defaults to the canonical draft and explicitly opens the unchanged original', async ({ page }) => {
  const { state, tabs } = await open(page)
  await expect(draftViewer(page).getByRole('img')).toBeVisible({ timeout: 30000 })
  expect(documentRequests(state)).toEqual([])
  await downloadCanonical(page, draftViewer(page))
  expect(draftRequests(state)).toHaveLength(1)
  await showOriginal(tabs)
  const viewer = uploadedViewer(page)
  await expect(viewer.getByRole('img', { name: `Uploaded PO PDF: ${firstDocument.filename}, page 1 of 1`, exact: true })).toBeVisible({ timeout: 30000 })
  await expectViewerFillsPanel(viewer, page.locator('.pop-uploaded:visible'))
  await expect(uploads(page)).not.toContainText(firstDocument.filename)
  await expect(uploads(page).getByRole('link', { name: 'Download uploaded PO', exact: true })).toHaveText('')
  await expect(uploads(page).getByRole('link', { name: 'Open uploaded PO', exact: true })).toHaveAttribute('href', /^blob:/)
  await expect(page.locator('.pop-document')).toHaveCount(0)
  expect(documentRequests(state).filter(({ path }) => path.endsWith('/content/'))[0].authorization).toBe('Bearer isolated-order-form-fixture-token')
  await downloadOriginal(page, original, firstDocument.filename)
  expect(generatedRequests(state)).toEqual([])
  await page.screenshot({ path: '../artifacts/po-original-preview-edit-desktop.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await uploads(page).scrollIntoViewIfNeeded()
  await expectViewerFillsPanel(viewer, page.locator('.pop-uploaded:visible'))
  await page.screenshot({ path: '../artifacts/po-original-preview-edit-mobile.png' })
  await page.setViewportSize({ width: 1910, height: 945 })
  const documentTab = tabs.getByRole('tab', { name: 'Document', exact: true })
  await documentTab.click()
  await expect(draftViewer(page).getByRole('img')).toBeVisible({ timeout: 30000 })
  await documentTab.focus()
  await documentTab.press('ArrowRight')
  await expect(tabs.getByRole('tab', { name: 'Original source', exact: true })).toBeFocused()
  await tabs.getByRole('tab', { name: 'Original source', exact: true }).press('ArrowRight')
  await expect(tabs.getByRole('tab', { name: /^Validation/ })).toBeFocused()
  await tabs.getByRole('tab', { name: /^Validation/ }).press('Home')
  await expect(documentTab).toBeFocused()
  await expect(draftViewer(page).getByRole('img')).toBeVisible({ timeout: 30000 })
  assertReadOnly(state)
})

test('an original-source discovery failure stays separate from the canonical draft', async ({ page }) => {
  const { state, tabs } = await open(page, { documents: [], prepare: fixture => { fixture.uploadedDocumentsError = { detail: 'Synthetic temporary outage.' } } })
  await expect(draftViewer(page).getByRole('img')).toBeVisible({ timeout: 30000 })
  expect(documentRequests(state)).toEqual([])
  await showOriginal(tabs)
  await expect(uploads(page).getByRole('alert')).toContainText('Uploaded PO documents could not be loaded.')
  await expect(page.locator('.pop-document')).toHaveCount(0)
  expect(state.requests.filter(({ path }) => path.endsWith('/export-pdf/'))).toEqual([])
  state.uploadedDocumentsError = null
  await uploads(page).getByRole('button', { name: 'Retry uploaded PO', exact: true }).click()
  await expect(uploads(page)).toContainText('No uploaded PO PDF is linked to this order.')
  expect(documentRequests(state).filter(({ path }) => path.endsWith('/content/'))).toEqual([])
  await tabs.getByRole('tab', { name: 'Document', exact: true }).click()
  await expect(draftViewer(page).getByRole('img')).toBeVisible({ timeout: 30000 })
  assertReadOnly(state)
})

test('missing original content stays explicit and multiple uploaded PDFs remain distinct', async ({ page }) => {
  const { state, tabs } = await open(page, { documents: [firstDocument, secondDocument], prepare: fixture => { fixture.uploadedContent[firstDocument.content_url] = { status: 404 } } })
  await expect(draftViewer(page).getByRole('img')).toBeVisible({ timeout: 30000 })
  await showOriginal(tabs)
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

test('saved order defaults to the canonical PDF and preserves explicit original downloads on mobile', async ({ page }) => {
  const { state, tabs } = await open(page, { detail: true })
  await expect(generatedViewer(page).getByRole('img')).toBeVisible({ timeout: 30000 })
  expect(documentRequests(state)).toEqual([])
  await downloadCanonical(page, generatedViewer(page))
  expect(generatedRequests(state)).toHaveLength(1)
  await showOriginal(tabs)
  await expect(uploadedViewer(page).getByRole('img')).toBeVisible({ timeout: 30000 })
  await expect(generatedViewer(page)).toBeHidden()
  await expectViewerFillsPanel(uploadedViewer(page), page.locator('.po-detail-pdf-preview [role="tabpanel"]:visible'))
  await expect(uploads(page)).not.toContainText(firstDocument.filename)
  await downloadOriginal(page, original, firstDocument.filename)
  expect(generatedRequests(state)).toHaveLength(1)
  await page.screenshot({ path: '../artifacts/po-original-preview-saved-desktop.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await uploads(page).scrollIntoViewIfNeeded()
  await expectViewerFillsPanel(uploadedViewer(page), page.locator('.po-detail-pdf-preview [role="tabpanel"]:visible'))
  const bounds = await uploads(page).boundingBox()
  expect(bounds.width).toBeGreaterThan(200)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: '../artifacts/po-original-preview-saved-mobile.png' })
  await tabs.getByRole('tab', { name: 'Document', exact: true }).click()
  await expect(generatedViewer(page).getByRole('img')).toBeVisible({ timeout: 30000 })
  expect(generatedRequests(state)).toHaveLength(1)
  assertReadOnly(state)
})

test('saved canonical preview does not wait for original discovery and print reuses its PDF', async ({ page }) => {
  let release
  const pending = new Promise(resolve => { release = resolve })
  const { state, tabs } = await open(page, { detail: true, documents: [], prepare: fixture => { fixture.uploadedDocumentsDeferred = pending } })
  await expect(generatedViewer(page).getByRole('img')).toBeVisible({ timeout: 30000 })
  await expectViewerFillsPanel(generatedViewer(page), page.locator('.po-detail-pdf-preview [role="tabpanel"]:visible'))
  await expect(page.getByRole('link', { name: 'Open Purchase Order PDF', exact: true })).toBeVisible()
  const print = page.getByRole('button', { name: 'Print PDF', exact: true })
  await expect(print).toBeVisible()
  const originalUrl = await page.getByRole('link', { name: 'Open Purchase Order PDF', exact: true }).getAttribute('href')
  const opened = page.waitForEvent('popup')
  await print.click()
  const printWindow = await opened
  await expect(printWindow).toHaveURL(originalUrl)
  await printWindow.close()
  expect(generatedRequests(state)).toHaveLength(1)
  expect(documentRequests(state)).toEqual([])
  await expect(uploads(page)).toHaveCount(0)
  await showOriginal(tabs)
  await expect(uploads(page)).toContainText('Loading uploaded PO documents')
  release()
  await expect(uploads(page)).toContainText('No uploaded PO PDF is linked to this order.')
  await tabs.getByRole('tab', { name: 'Document', exact: true }).click()
  await expect(generatedViewer(page).getByRole('img')).toBeVisible({ timeout: 30000 })
  expect(generatedRequests(state)).toHaveLength(1)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('.po-detail-pdf-preview').scrollIntoViewIfNeeded()
  await expectViewerFillsPanel(generatedViewer(page), page.locator('.po-detail-pdf-preview [role="tabpanel"]:visible'))
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  assertReadOnly(state)
})

test('saved original-source errors remain explicit without replacing the selected original', async ({ page }) => {
  const { state, tabs } = await open(page, { detail: true, prepare: fixture => { fixture.uploadedDocumentsError = { detail: 'Synthetic source outage.' } } })
  await expect(generatedViewer(page).getByRole('img')).toBeVisible({ timeout: 30000 })
  await showOriginal(tabs)
  await expect(uploads(page).getByRole('alert')).toContainText('Uploaded PO documents could not be loaded.')
  expect(generatedRequests(state)).toHaveLength(1)
  await expect(generatedViewer(page)).toBeHidden()
  state.uploadedDocumentsError = null
  await uploads(page).getByRole('button', { name: 'Retry uploaded PO', exact: true }).click()
  await expect(uploadedViewer(page).getByRole('img')).toBeVisible({ timeout: 30000 })
  expect(generatedRequests(state)).toHaveLength(1)
  assertReadOnly(state)
})

test('changing saved orders discards a late source response from the previous order', async ({ page }) => {
  let release
  const pending = new Promise(resolve => { release = resolve })
  const { state, tabs } = await open(page, { detail: true, prepare: fixture => { fixture.uploadedDocumentsDeferred = pending } })
  await expect(generatedViewer(page).getByRole('img')).toBeVisible({ timeout: 30000 })
  await showOriginal(tabs)
  await expect(uploads(page)).toContainText('Loading uploaded PO documents')
  const nextId = '00000000-0000-4000-8000-000000009003'
  const nextDocument = { ...secondDocument, content_url: `/api/v1/procurement/orders/${nextId}/uploaded-documents/attachment-0/content/` }
  await page.route(`**/api/v1/procurement/orders/${nextId}/**`, async route => {
    const path = new URL(route.request().url()).pathname
    state.requests.push({ path, method: route.request().method() })
    if (path.endsWith('/uploaded-documents/')) return route.fulfill({ json: { results: [nextDocument] } })
    if (path.endsWith('/content/')) return route.fulfill({ contentType: 'application/pdf', body: revision })
    if (path.endsWith('/export-pdf/')) return route.fulfill({ contentType: 'application/pdf', body: generated })
    if (path.endsWith(`/${nextId}/`)) return route.fulfill({ json: { ...state.record, id: nextId, po_number: 'PO-NEXT-SYNTHETIC' } })
    state.unknown.push({ path })
    return route.fulfill({ status: 400, json: {} })
  })
  await page.evaluate(next => {
    window.history.pushState({}, '', `/procurement/orders/${next}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, nextId)
  await expect(tabs.getByRole('tab', { name: 'Document', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('region', { name: 'Purchase Order PO-NEXT-SYNTHETIC PDF preview', exact: true }).getByRole('img')).toBeVisible({ timeout: 30000 })
  await showOriginal(tabs)
  await expect(uploadedViewer(page, secondDocument.filename).getByRole('img')).toBeVisible({ timeout: 30000 })
  release()
  await downloadOriginal(page, revision, secondDocument.filename)
  await expect(uploads(page)).not.toContainText(firstDocument.filename)
  expect(generatedRequests(state)).toHaveLength(2)
  assertReadOnly(state)
})
