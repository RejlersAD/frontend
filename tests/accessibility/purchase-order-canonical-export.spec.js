import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { Buffer } from 'node:buffer'
import { orderFormHarness, orderFormId, orderFormNumber, orderFormRecommendation } from '../fixtures/purchase-order-form.fixture'
import { mixedSizePdf } from '../fixtures/mixed-size-pdf.fixture'

test.setTimeout(120000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } })
const pane = page => page.getByRole('complementary', { name: 'Live purchase order preview' })
const previews = state => state.requests.filter(request => request.path.endsWith('/preview-document/'))
const lastPdf = state => previews(state).filter(request => request.body.format === 'pdf').at(-1)
const clean = state => {
  expect(state.acceptedWrites).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
}
const narrative = '<h2 style="text-align:center">Current unsaved scope</h2><p><strong>Bold</strong> <em>italic</em> <u>underlined</u></p><ol><li>First deliverable</li><li>Second deliverable</li></ol><table><tbody><tr><td>Service</td><td>Hours</td></tr><tr><td>Design</td><td>42</td></tr></tbody></table><div data-po-page-break="true">Page Break</div><p>Continuation</p>'

async function openEditor(page, overrides = {}) {
  const state = await orderFormHarness(page, { path: '/procurement/orders', prepare: fixture => {
    fixture.record = {
      id: orderFormId, po_number: orderFormNumber, po_date: '2026-09-15', status: 'draft',
      title: 'Saved narrative order', description: '<p>Older saved narrative</p>', vendor: 21, vendor_name: fixture.vendors[0].name,
      currency: 'AED', total_amount: '1050', net_amount: '1000', tax_amount: '50', vat_basis: 'exclusive', vat_percentage: 5,
      pr_reference: orderFormRecommendation.id, pr_number: orderFormRecommendation.pr_number,
      items: [{ description: 'Design', quantity: 1, unit_price: 1000 }], attachments: [], approval_log: [], ...overrides,
    }
    fixture.orders = [fixture.record]
    fixture.uploadedDocuments = [{ id: 'source', filename: 'Older-original.pdf', content_url: `/api/v1/procurement/orders/${orderFormId}/uploaded-documents/source/content/` }]
  } })
  await page.getByRole('button', { name: `Actions for ${orderFormNumber}`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Edit order', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Edit purchase order', exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'PO Description & Scope', exact: true }).click()
  await expect(pane(page).getByRole('button', { name: 'Download PDF', exact: true })).toBeEnabled({ timeout: 30000 })
  return state
}

async function editNarrative(page, html) {
  await page.getByRole('textbox', { name: 'PO Narrative', exact: true }).evaluate((element, value) => {
    element.innerHTML = value
    element.dispatchEvent(new Event('input', { bubbles: true }))
  }, html)
}

async function downloaded(page, control) {
  const event = page.waitForEvent('download')
  await control.click()
  const download = await event
  return { filename: download.suggestedFilename(), bytes: await readFile(await download.path()) }
}

test('editor PDF and Word use the current rich narrative snapshot without saving or substituting an uploaded original', async ({ page }) => {
  const state = await openEditor(page)
  await editNarrative(page, narrative)
  await expect(pane(page).getByRole('button', { name: 'Download PDF', exact: true })).toBeDisabled()
  await expect.poll(() => lastPdf(state)?.body.snapshot.description).toBe(narrative)
  const viewer = pane(page).getByRole('region', { name: 'Current purchase order PDF preview', exact: true })
  await expect(viewer.getByRole('img')).toBeVisible({ timeout: 30000 })
  const count = previews(state).length
  const pdf = await downloaded(page, pane(page).getByRole('button', { name: 'Download PDF', exact: true }))
  expect(pdf.bytes).toEqual(state.generatedPdf)
  expect(previews(state)).toHaveLength(count)
  const word = await downloaded(page, pane(page).getByRole('button', { name: 'Download Word', exact: true }))
  expect(word.filename).toBe('Current-PO.docx')
  expect(word.bytes.toString()).toBe(state.generatedWord)
  expect(previews(state).at(-1).body).toMatchObject({ format: 'word', order_id: orderFormId, snapshot: { description: narrative }, attachment_metadata: [] })
  expect(state.requests.filter(request => request.path.includes('/uploaded-documents/') || request.path.endsWith('/export-pdf/') || request.path.endsWith('/export-word/'))).toEqual([])
  await page.screenshot({ path: '../artifacts/po-current-narrative-canonical-preview.png' })
  clean(state)
})

test('stale preview responses and preview failures never enable a download of older form content', async ({ page }) => {
  const state = await openEditor(page)
  let release
  const pending = new Promise(resolve => { release = resolve })
  let firstStarted = false
  const latest = mixedSizePdf(2)
  await page.route('**/api/v1/procurement/orders/preview-document/', async route => {
    const raw = route.request().postData()
    if (raw.includes('Delayed older edit')) {
      firstStarted = true
      await pending
      return route.fulfill({ contentType: 'application/pdf', body: state.generatedPdf })
    }
    if (raw.includes('Rejected current edit')) return route.fulfill({ status: 400, json: { description: ['The narrative table is too wide.'] } })
    return route.fulfill({ contentType: 'application/pdf', body: latest, headers: { 'content-disposition': 'inline; filename="Latest.pdf"' } })
  })
  await editNarrative(page, '<p>Delayed older edit</p>')
  await expect.poll(() => firstStarted).toBe(true)
  await editNarrative(page, '<p>Newest draft edit</p>')
  await expect(pane(page).getByRole('button', { name: 'Download PDF', exact: true })).toBeDisabled()
  await expect(pane(page).getByRole('button', { name: 'Download PDF', exact: true })).toBeEnabled()
  release()
  expect((await downloaded(page, pane(page).getByRole('button', { name: 'Download PDF', exact: true }))).bytes).toEqual(latest)
  await editNarrative(page, '<p>Rejected current edit</p>')
  await expect(pane(page).getByRole('alert')).toContainText('description: The narrative table is too wide.')
  await expect(pane(page).getByRole('button', { name: 'Download PDF', exact: true })).toBeDisabled()
  await expect(pane(page).getByRole('button', { name: 'Download Word', exact: true })).toBeDisabled()
  await expect(page.getByRole('textbox', { name: 'PO Narrative', exact: true })).toContainText('Rejected current edit')
  await editNarrative(page, '<p>Corrected current edit</p>')
  await expect(pane(page).getByRole('button', { name: 'Download PDF', exact: true })).toBeEnabled()
  clean(state)
})

test('saved detail PDF downloads reuse its canonical preview and Word exports the same saved order', async ({ page }) => {
  const state = await openEditor(page)
  await page.getByRole('button', { name: 'Close purchase order', exact: true }).click()
  const row = page.getByRole('region', { name: 'Purchase order register', exact: true }).getByRole('row').filter({ has: page.getByRole('button', { name: `Select ${orderFormNumber}`, exact: true }) })
  await row.getByRole('button', { name: 'Preview', exact: true }).click()
  const viewer = page.getByRole('region', { name: `Purchase Order ${orderFormNumber} PDF preview`, exact: true })
  await expect(viewer.getByRole('img')).toBeVisible({ timeout: 30000 })
  const pdf = await downloaded(page, viewer.getByRole('link', { name: 'Download Purchase Order PDF', exact: true }))
  expect(pdf.bytes).toEqual(state.generatedPdf)
  const headerPdf = await downloaded(page, page.getByRole('button', { name: 'Download PDF', exact: true }))
  expect(headerPdf.bytes).toEqual(pdf.bytes)
  expect(state.requests.filter(request => request.path.endsWith('/export-pdf/'))).toHaveLength(1)
  const word = await downloaded(page, page.getByRole('button', { name: 'Export Word document', exact: true }))
  expect(word.bytes.toString()).toBe(state.generatedWord)
  expect(state.requests.filter(request => request.path.endsWith('/export-word/'))).toHaveLength(1)
  expect(state.requests.filter(request => request.path.includes('/uploaded-documents/'))).toEqual([])
  clean(state)
})

test('preview attachment order preserves untouched metadata and reflects removals and unsaved labels', async ({ page }) => {
  const state = await openEditor(page, { attachments: [{ filename: 'first.pdf', s3_key: 'first' }, { filename: 'second.pdf', s3_key: 'second' }] })
  expect(lastPdf(state).body.attachment_metadata).toEqual([{ existing_attachment_index: 0 }, { existing_attachment_index: 1 }])
  await page.getByRole('tab', { name: 'Attachments', exact: true }).click()
  await page.getByRole('button', { name: 'Remove', exact: true }).first().click()
  await page.getByRole('textbox', { name: 'Attachment 1 title', exact: true }).fill(' Retained revised title ')
  await page.locator('#po-attachment-multiple').setInputFiles({ name: 'new-source.pdf', mimeType: 'application/pdf', buffer: Buffer.from(mixedSizePdf(1)) })
  await expect.poll(() => lastPdf(state)?.body.attachment_metadata).toEqual([
    { existing_attachment_index: 1, title: 'Retained revised title', description: '' },
    { new_file_index: 0, title: 'new-source', description: '' },
  ])
  expect(lastPdf(state).body.attachments).toEqual({ filename: 'new-source.pdf' })
  clean(state)
})

test('saving a reviewed purchase summary preserves contact metadata and restores the same text when reopened', async ({ page }) => {
  const state = await openEditor(page, { contact_persons: { purchase_summary: 'Saved supplier summary', technical: [{ name: 'Technical contact retained' }] } })
  await page.getByRole('tab', { name: 'Header, Buyer & Project', exact: true }).click()
  await expect(page.locator('[name="summary"]')).toHaveValue('Saved supplier summary')
  await page.locator('[name="summary"]').fill('Reviewed vendor purchase summary')
  await expect.poll(() => lastPdf(state)?.body.snapshot.summary).toBe('Reviewed vendor purchase summary')
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible()
  expect(state.acceptedWrites).toHaveLength(1)
  expect(state.acceptedWrites[0].body).toEqual({ contact_persons: { purchase_summary: 'Reviewed vendor purchase summary', technical: [{ name: 'Technical contact retained' }] } })
  await page.getByRole('button', { name: `Actions for ${orderFormNumber}`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Edit order', exact: true }).click()
  await expect(page.locator('[name="summary"]')).toHaveValue('Reviewed vendor purchase summary')
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})

test('saving during an older saved PDF export requests the new revision and ignores late older bytes', async ({ page }) => {
  const state = await openEditor(page, { updated_at: '2026-09-14T08:00:00Z' })
  await page.getByRole('button', { name: 'Close purchase order', exact: true }).click()
  let release
  const older = new Promise(resolve => { release = resolve })
  let calls = 0
  const latest = mixedSizePdf(3)
  await page.route(`**/api/v1/procurement/orders/${orderFormId}/export-pdf/`, async route => {
    calls += 1
    const call = calls
    if (call === 1) await older
    return route.fulfill({ contentType: 'application/pdf', body: call === 1 ? state.generatedPdf : latest })
  })
  await page.getByRole('button', { name: `Actions for ${orderFormNumber}`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Preview', exact: true }).click()
  await expect.poll(() => calls).toBe(1)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.locator('[name="title"]').fill('New saved document revision')
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click()
  await expect.poll(() => calls).toBe(2)
  release()
  const viewer = page.getByRole('region', { name: `Purchase Order ${orderFormNumber} PDF preview`, exact: true })
  await expect(viewer.getByRole('img')).toBeVisible({ timeout: 30000 })
  expect((await downloaded(page, viewer.getByRole('link', { name: 'Download Purchase Order PDF', exact: true }))).bytes).toEqual(latest)
  expect(state.acceptedWrites).toHaveLength(1)
  expect(state.acceptedWrites[0].body).toEqual({ title: 'New saved document revision' })
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})
