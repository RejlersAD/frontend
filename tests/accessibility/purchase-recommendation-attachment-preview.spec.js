import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { Buffer } from 'node:buffer'
import { recommendationPdfImportHarness, syntheticApprovedPdf } from '../fixtures/purchase-recommendation-pdf-import.fixture'
import { recommendationId, recommendationNumber } from '../fixtures/purchase-recommendations.fixture'

test.setTimeout(150000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } })
const recordId = recommendationId(204)
const number = recommendationNumber(4)
const recordPath = `/api/v1/procurement/requisitions/${recordId}/`
const details = page => page.getByRole('complementary', { name: 'Recommendation details', exact: true })
const importDialog = page => page.getByRole('dialog', { name: 'Upload PR, PO and Vendor', exact: true })
const originalPanel = page => page.getByRole('region', { name: 'Original uploaded PR', exact: true })

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
const newestBytes = pdfFile('NEWEST SIGNED PR - protected source only')
const olderBytes = pdfFile('OLDER SIGNED PR - retained for source history')
const clean = state => { expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([]) }
async function waitRegister(page) {
  await expect(page.getByRole('heading', { name: 'Purchase Recommendations', exact: true })).toBeVisible()
  await expect(details(page)).toHaveAttribute('aria-busy', 'false')
}
async function menuAction(page, action) {
  await page.getByRole('button', { name: `Actions for ${number}`, exact: true }).click()
  await page.getByRole('menuitem', { name: action, exact: true }).click()
}
async function expectOriginalBytes(page, expected) {
  const frame = originalPanel(page).locator('iframe')
  await expect(frame).toHaveAttribute('src', /^blob:/)
  expect(await page.evaluate(async source => (await fetch(source.split('#')[0])).text(), await frame.getAttribute('src'))).toBe(expected)
}

for (const hasOlderSource of [false, true]) {
  test(`Attach signed PDF refreshes ${hasOlderSource ? 'an older original to the newest' : 'a native recommendation to its'} private original across Preview, Download, Edit and Delete`, async ({ page }) => {
    const contentPath = `${recordPath}uploaded-documents/${hasOlderSource ? 1 : 0}/content/`
    const older = { type: 'signed_purchase_requisition_pdf', filename: 'older-signed-pr.pdf', url: '/__signed-attachment-test__/older.pdf', sha256: 'older-source', uploaded_at: '2026-09-01T08:00:00Z' }
    const newest = { type: 'signed_purchase_requisition_pdf', document_type: 'signed_purchase_requisition_pdf', filename: syntheticApprovedPdf.name, storage_key: 'synthetic/private/signed-pr.pdf', url: '', s3_url: '', content_url: contentPath, sha256: 'newest-source', uploaded_at: '2026-09-15T08:00:00Z' }
    const state = await recommendationPdfImportHarness(page, {
      documentSignedOff: true, extracted: { pr_number: number }, documentComparison: { identity_matched: true, fields: [] },
      savedAttachments: [...(hasOlderSource ? [older] : []), newest],
      savedVerification: { document_sha256: newest.sha256, signed_off: true, source_approval_rows: [] },
      approvalDetection: { signatures: { pm: true, moe: true, mop: true, vp: true }, approval_date: '2026-09-15' },
      prepare: fixture => {
        const attachments = hasOlderSource ? [older] : []
        fixture.props.requisitions.find(record => record.id === recordId).attachments = attachments
        fixture.details[recordId].attachments = attachments
      },
    })
    const sourceRequests = []
    await page.route(`**${contentPath}`, route => {
      sourceRequests.push({ method: route.request().method(), authorization: route.request().headers().authorization })
      return route.fulfill({ contentType: 'application/pdf', headers: { 'x-frame-options': 'DENY' }, body: newestBytes })
    })
    await page.route('**/__signed-attachment-test__/older.pdf', route => route.fulfill({ contentType: 'application/pdf', body: olderBytes }))
    await page.route(/\/api\/v1\/procurement\/requisitions\/(?:vendor-options|get_projects_departments|get_product_services|get_suppliers|get_po_numbers)\//, route => {
      state.requests.push({ path: new URL(route.request().url()).pathname, method: route.request().method() })
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ suggestions: [] }) })
    })
    await waitRegister(page)
    await page.getByRole('button', { name: `Select ${number}`, exact: true }).click()
    await expect(details(page)).toHaveAttribute('aria-busy', 'false')
    await menuAction(page, 'Attach signed PDF')
    await importDialog(page).getByLabel('Select signed or approved PR PDF', { exact: true }).setInputFiles({ ...syntheticApprovedPdf, buffer: Buffer.from(newestBytes) })
    await importDialog(page).getByRole('button', { name: 'Preview OCR', exact: true }).click()
    await expect(importDialog(page).getByRole('button', { name: 'Attach signed PDF', exact: true })).toBeEnabled()
    const beforeSave = state.requests.length
    await importDialog(page).getByRole('button', { name: 'Attach signed PDF', exact: true }).click()
    await expect(importDialog(page)).toContainText('has the signed PDF attached')
    await importDialog(page).getByRole('button', { name: 'Close', exact: true }).click()
    await waitRegister(page)
    expect(state.saveRequests).toHaveLength(1)
    expect(state.saveRequests[0]).toMatchObject({ expected_pr_number: number, attach_only: 'true' })
    expect(state.requests.slice(beforeSave).some(request => request.path === '/api/v1/procurement/requisitions/' && request.method === 'GET')).toBe(true)
    expect(state.requests.slice(beforeSave).some(request => request.path === recordPath && request.method === 'GET')).toBe(true)
    await menuAction(page, 'Preview recommendation')
    await expect(details(page)).toBeFocused()
    await expect(page).toHaveURL(/\/procurement\/requisitions$/)
    await expect(details(page).locator('a[href="/__signed-attachment-test__/older.pdf"]')).toHaveCount(0)
    const registerDownload = page.waitForEvent('download')
    await menuAction(page, 'Download PDF')
    const downloaded = await registerDownload
    expect(downloaded.suggestedFilename()).toBe(newest.filename)
    expect(await readFile(await downloaded.path(), 'utf8')).toBe(newestBytes)
    await details(page).getByRole('button', { name: 'View approval record', exact: true }).click()
    await expect(page.getByRole('heading', { name: number, level: 1, exact: true })).toBeVisible()
    await expectOriginalBytes(page, newestBytes)
    if (hasOlderSource) {
      const files = originalPanel(page).getByRole('combobox', { name: 'Uploaded PR file', exact: true })
      await files.selectOption({ label: older.filename })
      await expectOriginalBytes(page, olderBytes)
      await files.selectOption({ label: newest.filename })
      await expectOriginalBytes(page, newestBytes)
    }
    await page.getByRole('button', { name: 'Back to Purchase Recommendations', exact: true }).click()
    await waitRegister(page)
    await menuAction(page, 'Edit recommendation')
    await expect(page).toHaveURL(new RegExp(`/procurement/requisitions/${recordId}/edit$`))
    await expect(page.getByRole('heading', { name: 'Edit purchase recommendation', exact: true })).toBeVisible()
    await expectOriginalBytes(page, newestBytes)
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await waitRegister(page)
    await menuAction(page, 'Delete recommendation')
    await page.getByRole('dialog', { name: 'Confirm action', exact: true }).getByRole('button', { name: 'Confirm', exact: true }).click()
    await expect.poll(() => state.deleted).toEqual([recordId])
    await expect(page.getByRole('button', { name: `Select ${number}`, exact: true })).toHaveCount(0)
    expect(sourceRequests.length).toBeGreaterThanOrEqual(3)
    expect(sourceRequests.every(request => request.method === 'GET' && request.authorization === 'Bearer isolated-browser-fixture-token')).toBe(true)
    expect(state.requests.filter(request => /\/export_pdf\/$/.test(request.path))).toEqual([])
    expect(state.requests.filter(request => request.method === 'PATCH')).toEqual([])
    clean(state)
  })
}
