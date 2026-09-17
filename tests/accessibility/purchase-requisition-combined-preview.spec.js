import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
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
  state.approvalRecords[id(201)] = { body: combinedPdf }
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
  const frame = panel(page).getByTitle('Combined original PR and PO PDF')
  expect(await bytes(page, frame)).toBe(combinedPdf)
  await expect(panel(page)).toContainText('PR first, then PO')
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
