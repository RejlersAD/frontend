import { test, expect } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import { orderFormHarness, orderFormId, orderFormNumber, orderFormRecommendation } from '../fixtures/purchase-order-form.fixture'

test.setTimeout(120000)
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
    await expect(page.getByRole('heading', { name: 'PDF Preview', exact: true })).toBeVisible({ timeout: 90000 })
    await expect(page.locator('iframe[title^="Purchase Order"]')).toHaveAttribute('src', /^blob:/)
  } else {
    await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible({ timeout: 90000 })
    await page.getByRole('region', { name: 'Purchase order register', exact: true }).getByRole('button', { name: 'Edit', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Edit purchase order', exact: true })).toBeVisible()
  }
  const tabs = page.getByRole('tablist', { name: detail ? 'Purchase order PDF source' : 'Purchase order preview views', exact: true })
  await expect(tabs.getByRole('tab', { name: 'Uploaded PO', exact: true })).toBeVisible()
  expect(documentRequests(state)).toEqual([])
  return { state, tabs }
}

async function downloadOriginal(page, expected, filename) {
  const pending = page.waitForEvent('download')
  await uploads(page).getByRole('link', { name: 'Download uploaded PO', exact: true }).click()
  const download = await pending
  expect(download.suggestedFilename()).toBe(filename)
  expect(await readFile(await download.path())).toEqual(expected)
}

test('edit preview lazily opens authenticated original PDF, supports keyboard tabs and downloads exact uploaded bytes', async ({ page }) => {
  const { state, tabs } = await open(page)
  const documentTab = tabs.getByRole('tab', { name: 'Document', exact: true })
  await documentTab.focus()
  await documentTab.press('ArrowRight')
  const uploaded = tabs.getByRole('tab', { name: 'Uploaded PO', exact: true })
  await expect(uploaded).toBeFocused()
  await expect(uploaded).toHaveAttribute('aria-selected', 'true')
  const frame = uploads(page).locator('iframe')
  await expect(frame).toHaveAttribute('src', /^blob:/)
  await expect(frame).toHaveAttribute('title', `Uploaded PO PDF: ${firstDocument.filename}`)
  await expect(uploads(page).getByRole('link', { name: 'Open uploaded PO', exact: true })).toHaveAttribute('href', /^blob:/)
  await page.screenshot({ path: '../artifacts/po-uploaded-preview-edit-desktop.png' })
  expect(documentRequests(state).filter(({ path }) => path.endsWith('/content/'))[0].authorization).toBe('Bearer isolated-order-form-fixture-token')
  await downloadOriginal(page, original, firstDocument.filename)
  expect(state.requests.filter(({ path }) => path.endsWith('/export-pdf/'))).toEqual([])
  await page.setViewportSize({ width: 390, height: 844 })
  await uploads(page).scrollIntoViewIfNeeded()
  await page.screenshot({ path: '../artifacts/po-uploaded-preview-edit-mobile.png' })
  await page.setViewportSize({ width: 1910, height: 945 })
  await uploaded.press('ArrowRight')
  await expect(tabs.getByRole('tab', { name: /^Validation/ })).toBeFocused()
  await tabs.getByRole('tab', { name: /^Validation/ }).press('Home')
  await expect(documentTab).toBeFocused()
  await expect(page.locator('.pop-document:visible')).toContainText(orderFormNumber)
  assertReadOnly(state)
})

test('uploaded tab gives an empty state and retries a failed document list without creating a PO', async ({ page }) => {
  const { state, tabs } = await open(page, { documents: [], prepare: fixture => { fixture.uploadedDocumentsError = { detail: 'Synthetic temporary outage.' } } })
  await tabs.getByRole('tab', { name: 'Uploaded PO', exact: true }).click()
  await expect(uploads(page).getByRole('alert')).toContainText('Uploaded PO documents could not be loaded.')
  state.uploadedDocumentsError = null
  await uploads(page).getByRole('button', { name: 'Retry uploaded PO', exact: true }).click()
  await expect(uploads(page)).toContainText('No uploaded PO PDF is linked to this order.')
  await expect(uploads(page).locator('iframe')).toHaveCount(0)
  await expect(uploads(page).getByRole('link', { name: 'Download uploaded PO', exact: true })).toHaveCount(0)
  expect(documentRequests(state).filter(({ path }) => path.endsWith('/content/'))).toEqual([])
  assertReadOnly(state)
})

test('missing original content can be retried and multiple uploaded PDFs remain distinct', async ({ page }) => {
  const { state, tabs } = await open(page, { documents: [firstDocument, secondDocument], prepare: fixture => { fixture.uploadedContent[firstDocument.content_url] = { status: 404 } } })
  await tabs.getByRole('tab', { name: 'Uploaded PO', exact: true }).click()
  await expect(uploads(page).getByRole('alert')).toContainText('The uploaded PO PDF is no longer available.')
  await expect(uploads(page).getByRole('link', { name: 'Download uploaded PO', exact: true })).toHaveCount(0)
  state.uploadedContent[firstDocument.content_url] = { body: original }
  await uploads(page).getByRole('button', { name: 'Retry uploaded PO', exact: true }).click()
  await expect(uploads(page).locator('iframe')).toHaveAttribute('title', `Uploaded PO PDF: ${firstDocument.filename}`)
  const oldUrl = await uploads(page).getByRole('link', { name: 'Open uploaded PO', exact: true }).getAttribute('href')
  await uploads(page).getByRole('combobox', { name: 'Uploaded PO document', exact: true }).selectOption(secondDocument.id)
  await expect(uploads(page).locator('iframe')).toHaveAttribute('title', `Uploaded PO PDF: ${secondDocument.filename}`)
  await expect(uploads(page).getByRole('link', { name: 'Open uploaded PO', exact: true })).not.toHaveAttribute('href', oldUrl)
  await downloadOriginal(page, revision, secondDocument.filename)
  expect(state.requests.filter(({ path }) => path.endsWith('/export-pdf/'))).toEqual([])
  assertReadOnly(state)
})

test('saved order PDF panel separates generated and uploaded PDFs and remains usable on mobile', async ({ page }) => {
  const { state, tabs } = await open(page, { detail: true })
  const generatedCount = state.requests.filter(({ path }) => path.endsWith('/export-pdf/')).length
  const generatedTab = tabs.getByRole('tab', { name: 'Generated PO', exact: true })
  await generatedTab.focus()
  await generatedTab.press('End')
  await expect(tabs.getByRole('tab', { name: 'Uploaded PO', exact: true })).toBeFocused()
  await expect(uploads(page).locator('iframe')).toHaveAttribute('src', /^blob:/)
  await downloadOriginal(page, original, firstDocument.filename)
  expect(state.requests.filter(({ path }) => path.endsWith('/export-pdf/'))).toHaveLength(generatedCount)
  await page.screenshot({ path: '../artifacts/po-uploaded-preview-saved-desktop.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await uploads(page).scrollIntoViewIfNeeded()
  const bounds = await uploads(page).boundingBox()
  expect(bounds.width).toBeGreaterThan(200)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: '../artifacts/po-uploaded-preview-saved-mobile.png' })
  await tabs.getByRole('tab', { name: 'Uploaded PO', exact: true }).press('Home')
  await expect(generatedTab).toBeFocused()
  await expect(page.locator('iframe[title^="Purchase Order"]')).toBeVisible()
  assertReadOnly(state)
})
