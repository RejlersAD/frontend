import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { Buffer } from 'node:buffer'
import { recommendationHarness, recommendationId as id, recommendationNumber as number } from '../fixtures/purchase-recommendations.fixture'

test.setTimeout(90000)
const preview = page => page.getByRole('region', { name: 'Procurement document preview', exact: true })
const panel = page => preview(page).getByRole('tabpanel', { name: 'PR + PO', exact: true })
const originalSource = '/__combined-preview-fixture__/original-pr.pdf'
const update = (state, index, patch) => {
  Object.assign(state.props.requisitions[index - 1], patch)
  Object.assign(state.details[id(index + 200)], patch)
}
// Valid source bytes let the browser exercise the same blob viewer and download flow as production.
function pdfFile(...labels) {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${labels.map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${labels.length} >>`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
  labels.forEach((label, i) => {
    const stream = `BT /F1 14 Tf 40 750 Td (${label}) Tj ET`
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${5 + i * 2} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
  })
  let pdf = '%PDF-1.4\n'
  const offsets = []
  objects.forEach((object, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${object}\nendobj\n` })
  const xref = pdf.length
  return `${pdf}xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(value => `${String(value).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
}
const prPdf = pdfFile('Original PR first')
const poPdf = pdfFile('Original PO second')
const combinedPdf = pdfFile('Original PR first', 'Original PO second')
const prepare = state => {
  update(state, 1, { status: 'converted', linked_po_id: '101', po_number_reference: 'PO-TEST-001', attachments: [{ type: 'signed_purchase_requisition_pdf', filename: 'original-pr.pdf', url: originalSource }] })
  state.approvalRecords[id(201)] = { body: combinedPdf, headers: { 'X-Approval-Record-PR-Source': 'uploaded_original', 'X-Approval-Record-PO-Source': 'uploaded_original' } }
  state.uploadedDocuments['101'] = [{ id: 'source-101', filename: 'original-po.pdf', content_url: '/api/v1/procurement/orders/101/uploaded-documents/source-101/content/' }]
  state.uploadedContent['/api/v1/procurement/orders/101/uploaded-documents/source-101/content/'] = { body: poPdf }
}
const open = async (page, index = 1) => {
  await expect(page.getByRole('heading', { name: 'Purchase Recommendations', exact: true })).toBeVisible()
  await page.getByRole('button', { name: `Select ${number(index)}`, exact: true }).click()
  const details = page.getByRole('complementary', { name: 'Recommendation details' })
  await expect(details).toHaveAttribute('aria-busy', 'false')
  await details.getByRole('button', { name: 'View approval record', exact: true }).click()
  await expect(page.getByRole('heading', { name: number(index), level: 1, exact: true })).toBeVisible()
}
const bytes = async (page, frame) => {
  await expect(frame).toHaveAttribute('src', /^blob:/)
  return page.evaluate(async url => (await fetch(url.split('#')[0])).text(), await frame.getAttribute('src'))
}
const clean = state => {
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
  expect(state.requests.filter(request => /\/(export_pdf|export-pdf)\/$/.test(request.path))).toEqual([])
}

test('View approval record opens the combined originals and downloads both while retaining individual tabs', async ({ page }) => {
  await page.route(`**${originalSource}`, route => route.fulfill({ contentType: 'application/pdf', body: prPdf }))
  const state = await recommendationHarness(page, { realApp: true, prepare })
  await open(page)
  await expect(preview(page).getByRole('tab', { name: 'PR + PO', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(preview(page).getByRole('tab')).toHaveCount(3)
  const frame = panel(page).getByTitle('Combined PR and PO PDF', { exact: true })
  expect(await bytes(page, frame)).toBe(combinedPdf)
  await expect(panel(page)).toContainText('PR first, then PO')
  await expect(panel(page)).toContainText('PO: Uploaded original')
  const downloading = page.waitForEvent('download')
  await panel(page).getByRole('link', { name: 'Download combined PR and PO PDF' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe(`${number(1)}-PR-PO.pdf`)
  expect(await readFile(await download.path(), 'utf8')).toBe(combinedPdf)
  await page.setViewportSize({ width: 390, height: 844 })
  await preview(page).scrollIntoViewIfNeeded()
  const bounds = await panel(page).boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
  await page.screenshot({ path: '../artifacts/combined-pr-po-preview/mobile.png' })
  await preview(page).getByRole('tab', { name: 'PR Preview', exact: true }).click()
  expect(await bytes(page, preview(page).getByTitle('Original uploaded PR: original-pr.pdf'))).toBe(prPdf)
  await preview(page).getByRole('tab', { name: /^Linked PO/ }).click()
  expect(await bytes(page, preview(page).getByTitle('Uploaded PO PDF: original-po.pdf'))).toBe(poPdf)
  expect(state.requests.filter(request => request.path.endsWith('/approval-record-pdf/'))).toHaveLength(1)
  await page.getByRole('button', { name: 'Back to Purchase Recommendations', exact: true }).click()
  await open(page)
  await expect(preview(page).getByRole('tab', { name: 'PR + PO', exact: true })).toHaveAttribute('aria-selected', 'true')
  expect(await bytes(page, panel(page).locator('iframe'))).toBe(combinedPdf)
  clean(state)
})

for (const attachmentWarnings of [0, 1]) test(`a PO created in RADAI appears without requesting an upload (attachment warnings=${attachmentWarnings})`, async ({ page }) => {
  const generatedPo = pdfFile('Uploaded PR first', 'RADAI generated PO second')
  const state = await recommendationHarness(page, { realApp: true, prepare: state => {
    prepare(state)
    state.uploadedDocuments['101'] = []
    state.approvalRecords[id(201)] = { body: generatedPo, headers: { 'X-Approval-Record-PR-Source': 'uploaded_original', 'X-Approval-Record-PO-Source': 'radai_generated', 'X-PO-Attachment-Warnings': String(attachmentWarnings) } }
  } })
  await open(page)
  expect(await bytes(page, panel(page).getByTitle('Combined PR and PO PDF', { exact: true }))).toBe(generatedPo)
  await expect(panel(page)).toContainText('PR: Uploaded original')
  await expect(panel(page)).toContainText('PO: RADAI-generated')
  if (attachmentWarnings) await expect(panel(page).getByRole('status')).toContainText('The PO is included. 1 supporting attachment could not be added')
  else await expect(panel(page).getByRole('status')).toHaveCount(0)
  await expect(panel(page).getByRole('alert')).toHaveCount(0)
  await expect(panel(page).getByRole('button', { name: 'Upload signed PO', exact: true })).toHaveCount(0)
  await expect(panel(page).getByRole('link', { name: 'Download combined PR and PO PDF' })).toBeVisible()
  expect(state.requests.filter(request => request.path.startsWith('/api/v1/procurement/') && request.method !== 'GET')).toEqual([])
  clean(state)
})

test('combined source failures and invalid content can retry without generated replacements', async ({ page }) => {
  const state = await recommendationHarness(page, { integration: true, prepare: state => {
    prepare(state)
    state.approvalRecords[id(201)] = { status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'The original linked PO PDF is unavailable.' }) }
  } })
  await open(page)
  await expect(panel(page).getByRole('alert')).toContainText('The original linked PO PDF is unavailable.')
  await expect(panel(page).locator('iframe')).toHaveCount(0)
  state.approvalRecords[id(201)] = { body: '<html>Not a PDF</html>' }
  await panel(page).getByRole('button', { name: 'Retry combined PDF' }).click()
  await expect(panel(page).getByRole('alert')).toContainText('The combined PR and PO PDF could not be loaded.')
  await expect(panel(page).getByRole('link', { name: 'Download combined PR and PO PDF' })).toHaveCount(0)
  state.approvalRecords[id(201)] = { body: combinedPdf }
  await panel(page).getByRole('button', { name: 'Retry combined PDF' }).click()
  expect(await bytes(page, panel(page).locator('iframe'))).toBe(combinedPdf)
  clean(state)
})

test('leaving an outstanding preview cannot replace the next requisition document', async ({ page }) => {
  let release
  const wait = new Promise(resolve => { release = resolve })
  const nextPdf = pdfFile('Different PR source', 'Different PO source')
  const state = await recommendationHarness(page, { integration: true, prepare: state => {
    prepare(state)
    state.approvalRecords[id(201)] = { body: combinedPdf, wait }
    update(state, 2, { linked_po_id: '101', attachments: [{ type: 'signed_purchase_requisition_pdf', filename: 'different.pdf', url: originalSource }] })
    state.approvalRecords[id(202)] = { body: nextPdf }
  } })
  try {
    await open(page)
    await expect(panel(page).getByRole('status')).toContainText('Loading PR and PO documents')
    await expect.poll(() => state.requests.some(request => request.path === `/api/v1/procurement/requisitions/${id(201)}/approval-record-pdf/`)).toBeTruthy()
    await page.getByRole('button', { name: 'Back to Purchase Recommendations', exact: true }).click()
    await open(page, 2)
    expect(await bytes(page, panel(page).locator('iframe'))).toBe(nextPdf)
    release()
    await expect(panel(page).getByRole('link', { name: 'Download combined PR and PO PDF' })).toHaveAttribute('download', `${number(2)}-PR-PO.pdf`)
    expect(await bytes(page, panel(page).locator('iframe'))).toBe(nextPdf)
    clean(state)
  } finally { release() }
})

test('a missing PO original can be uploaded on the unified page and restores the combined preview without leaving the approval record', async ({ page }) => {
  const state = await recommendationHarness(page, { realApp: true, prepare: state => {
    prepare(state)
    state.approvalRecords[id(201)] = { status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'approval_record_source_missing', source: 'po', recovery: 'upload_original_po', error: 'The original linked PO PDF is unavailable. Upload the signed PO PDF to restore the combined preview.' }) }
  } })
  const uploads = []
  await page.route('**/api/v1/procurement/po-documents/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (path.endsWith('/approval-employees/')) return route.fulfill({ json: { results: [] } })
    if (path.endsWith('/preview_signed_pdf/')) return route.fulfill({ json: { success: true, preview_only: true, extracted_data: { po_number: 'PO-TEST-001', vendor_name: 'Atlas Industrial Supplies', summary: 'Original signed scope', currency: 'USD', total_amount: '22500', gross_amount: '22500', tax_amount: '0', po_date: '2026-07-01' }, approval_evidence: {} } })
    if (path.endsWith('/import_signed_pdf/')) {
      uploads.push(request.postData())
      state.approvalRecords[id(201)] = { body: combinedPdf }
      return route.fulfill({ json: { success: true, operation: 'attached', purchase_order_id: '101', po_number: 'PO-TEST-001', pr_id: id(201), po_link: { status: 'linked', po_id: '101', manual_link_required: false } } })
    }
    return route.fallback()
  })
  await open(page)
  await panel(page).getByRole('button', { name: 'Upload signed PO', exact: true }).click()
  const uploader = page.getByRole('dialog', { name: 'Upload PR, PO and Vendor', exact: true })
  await uploader.getByLabel('Select signed or approved PO PDF', { exact: true }).setInputFiles({ name: 'original-po.pdf', mimeType: 'application/pdf', buffer: Buffer.from(poPdf) })
  await uploader.getByRole('button', { name: 'Preview OCR', exact: true }).click()
  await expect(uploader.getByLabel('PO Number', { exact: true })).toHaveValue('PO-TEST-001')
  expect(uploads).toHaveLength(0)
  const detailReads = () => state.requests.filter(request => request.path === `/api/v1/procurement/requisitions/${id(201)}/` && request.method === 'GET').length
  const previousReads = detailReads()
  await uploader.getByRole('button', { name: 'Save PO', exact: true }).click()
  await expect(uploader).toHaveCount(0)
  expect(await bytes(page, panel(page).locator('iframe'))).toBe(combinedPdf)
  expect(uploads).toHaveLength(1)
  expect(uploads[0]).toContain(`name="pr_id"\r\n\r\n${id(201)}`)
  await expect.poll(detailReads).toBeGreaterThan(previousReads)
  await expect(page.getByRole('heading', { name: number(1), level: 1, exact: true })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Edit Signed Purchase Order PDF', exact: true })).toHaveCount(0)
  clean(state)
})

for (const isSuperuser of [false, true]) test(`a read-only reviewer (superuser=${isSuperuser}) can open the available PR original without an upload action`, async ({ page }) => {
  await page.route(`**${originalSource}`, route => route.fulfill({ contentType: 'application/pdf', body: prPdf }))
  const state = await recommendationHarness(page, { integration: true, prepare: state => {
    prepare(state)
    state.actor.is_superuser = isSuperuser
    state.actor.module_actions = { procurement_requisitions: ['read'], procurement_orders: ['read'] }
    state.approvalRecords[id(201)] = { status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'The original linked PO PDF is unavailable.' }) }
  } })
  await open(page)
  await expect(panel(page).getByRole('alert')).toBeVisible()
  await expect(panel(page).getByRole('button', { name: 'Upload signed PO', exact: true })).toHaveCount(0)
  await panel(page).getByRole('button', { name: 'View PR PDF', exact: true }).click()
  expect(await bytes(page, preview(page).getByTitle('Original uploaded PR: original-pr.pdf'))).toBe(prPdf)
  clean(state)
})
