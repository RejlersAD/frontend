import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { orderFormHarness, orderFormId, orderFormNumber } from '../fixtures/purchase-order-form.fixture'
import { mixedSizePdf } from '../fixtures/mixed-size-pdf.fixture'

test.setTimeout(120000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } })
const signature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a97sAAAAASUVORK5CYII='
const orderPath = `/api/v1/procurement/orders/${orderFormId}/`
const viewer = page => page.getByRole('region', { name: `Purchase Order ${orderFormNumber} PDF preview`, exact: true })
const reply = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
const pdfReply = (route, body) => route.fulfill({ status: 200, contentType: 'application/pdf', body, headers: { 'content-disposition': 'inline; filename="Verified-PO.pdf"' } })
const evidence = () => ({
  approved_by_id: 11, approved_by_email: 'jarmo@example.test', approved_by_name: 'Jarmo Suominen', approved_by_title: 'CEO',
  approved_at: '2026-09-15T09:00:00Z', approval_signature: signature, approval_stamp: '',
  approval_log: [{ level: 5, stage: 'CEO', approver: 'Jarmo Suominen', status: 'approved',
    user_id: 11, user_email: 'jarmo@example.test', approved_by_id: 11, approved_by_email: 'jarmo@example.test',
    approved_by_name: 'Jarmo Suominen', signature_user_id: 11, signature_user_email: 'jarmo@example.test',
    signature, approved_at: '2026-09-15T09:00:00Z' }],
})

async function setup(page, overrides = {}) {
  return orderFormHarness(page, { path: '/procurement/orders', prepare: state => {
    state.record = { id: orderFormId, po_number: orderFormNumber, po_date: '2026-09-15', status: 'sent', can_complete: true,
      title: 'Completion evidence regression', vendor: 21, vendor_name: state.vendors[0].name,
      currency: 'AED', total_amount: '1050', net_amount: '1000', tax_amount: '50', vat_basis: 'exclusive', vat_percentage: 5,
      created_at: '2026-09-15T08:00:00Z', updated_at: '2026-09-15T08:00:00Z', items: [], attachments: [], approval_log: [], ...overrides }
    state.orders = [state.record]
  } })
}

async function openDetails(page) {
  await page.getByRole('button', { name: `Actions for ${orderFormNumber}`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Preview', exact: true }).click()
}

async function downloaded(page, control) {
  const pending = page.waitForEvent('download')
  await control.click()
  return readFile(await (await pending).path())
}

function clean(state) {
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
}

async function noSeparateApprovalCard(page) {
  await expect(page.getByRole('region', { name: 'Recorded purchase order approval', exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Recorded approval', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /^Open recorded (signature|stamp) evidence$/ })).toHaveCount(0)
}

test('completion uses the saved evidence revision, ignores an older PDF and preserves the uploaded original', async ({ page }) => {
  const state = await setup(page)
  const original = mixedSizePdf(2), latest = mixedSizePdf(3)
  const contentPath = `${orderPath}uploaded-documents/source/content/`
  state.uploadedDocuments = [{ id: 'source', filename: 'Original-signed-PO.pdf', content_url: contentPath }]
  state.uploadedContent[contentPath] = { body: original }
  let releaseOld
  const held = new Promise(resolve => { releaseOld = resolve })
  let exports = 0
  await page.route(`**${orderPath}export-pdf/`, async route => {
    exports += 1
    const first = exports === 1
    if (first) await held
    await pdfReply(route, first ? mixedSizePdf(1) : latest)
  })
  await page.route(`**${orderPath}`, async route => {
    if (route.request().method() !== 'PATCH') return route.fallback()
    const body = route.request().postDataJSON()
    state.acceptedWrites.push({ method: 'PATCH', path: orderPath, body })
    state.record = { ...state.record, ...body, ...evidence(), updated_at: '2026-09-15T09:01:00Z' }
    return reply(route, state.record)
  })
  await openDetails(page)
  await expect.poll(() => exports).toBe(1)
  await page.getByRole('button', { name: 'Mark Complete', exact: true }).click()
  await page.getByRole('dialog', { name: 'Confirm action' }).getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect.poll(() => exports, { message: 'Completion must request the returned saved revision even while the older revision is pending.' }).toBe(2)
  releaseOld()
  await expect(viewer(page).getByRole('img', { name: /page 1 of 3$/ })).toBeVisible({ timeout: 30000 })
  await noSeparateApprovalCard(page)
  expect(await downloaded(page, page.getByRole('button', { name: 'Download PDF', exact: true }))).toEqual(latest)
  expect(exports).toBe(2)
  await page.screenshot({ path: '../artifacts/po-completed-document-without-approval-card.png' })
  await page.getByRole('tablist', { name: 'Purchase order PDF source' }).getByRole('tab', { name: 'Original source', exact: true }).click()
  expect(await downloaded(page, page.getByRole('link', { name: 'Download uploaded PO', exact: true }))).toEqual(original)
  expect(state.acceptedWrites).toEqual([{ method: 'PATCH', path: orderPath, body: { status: 'completed' } }])
  clean(state)
})

test('completed imported evidence stays inside the document without a separate approval card or evidence links', async ({ page }) => {
  const source = `${orderPath}uploaded-documents/signed/content/#page=1`
  const state = await setup(page, { status: 'completed', approval_signature: source, approval_stamp: source, approval_log: [{
    external: true, source: 'signed_purchase_order_pdf', evidence_document_id: 'signed', status: 'approved',
    signature_verified: true, signature: source, approved_by_name: 'External signer',
  }] })
  await openDetails(page)
  await expect(viewer(page).getByRole('img', { name: /page 1 of 1$/ })).toBeVisible({ timeout: 30000 })
  await noSeparateApprovalCard(page)
  expect(state.requests.filter(request => request.path.includes('/uploaded-documents/'))).toEqual([])
  expect(state.acceptedWrites).toEqual([])
  clean(state)
})

test('a late detail response cannot replace another PO or its PDF after navigation', async ({ page }) => {
  const state = await setup(page)
  const otherId = '00000000-0000-4000-8000-000000009003'
  const other = { ...state.record, ...evidence(), id: otherId, po_number: 'RAD-PRJ-PUR-9003_SEP2026', status: 'completed', approval_stamp: signature }
  let releaseOld, requested = false
  const held = new Promise(resolve => { releaseOld = resolve })
  await page.route(`**${orderPath}`, async route => {
    requested = true
    await held
    await reply(route, state.record).catch(() => {})
  })
  await page.route(`**/api/v1/procurement/orders/${otherId}/`, route => reply(route, other))
  await page.route(`**/api/v1/procurement/orders/${otherId}/export-pdf/`, route => pdfReply(route, mixedSizePdf(1)))
  await openDetails(page)
  await expect.poll(() => requested).toBe(true)
  await page.evaluate(path => {
    window.history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, `/procurement/orders/${otherId}`)
  await expect(page.getByRole('region', { name: `Purchase Order ${other.po_number} PDF preview`, exact: true })).toBeVisible()
  releaseOld()
  await expect(page.getByRole('region', { name: `Purchase Order ${other.po_number} PDF preview`, exact: true }).getByRole('img', { name: /page 1 of 1$/ })).toBeVisible({ timeout: 30000 })
  await expect(page.getByRole('region', { name: `Purchase Order ${orderFormNumber} PDF preview`, exact: true })).toHaveCount(0)
  expect(state.requests.filter(request => request.path === `${orderPath}export-pdf/`)).toEqual([])
  expect(state.acceptedWrites).toEqual([])
  clean(state)
})

test('a pending completion cannot overwrite or disable actions on a different PO', async ({ page }) => {
  const state = await setup(page)
  const otherId = '00000000-0000-4000-8000-000000009004'
  const other = { ...state.record, id: otherId, po_number: 'RAD-PRJ-PUR-9004_SEP2026' }
  let releaseCompletion, requested = false
  const held = new Promise(resolve => { releaseCompletion = resolve })
  await page.route(`**${orderPath}`, async route => {
    if (route.request().method() !== 'PATCH') return route.fallback()
    requested = true
    const body = route.request().postDataJSON()
    state.acceptedWrites.push({ method: 'PATCH', path: orderPath, body })
    await held
    return reply(route, { ...state.record, ...evidence(), ...body, updated_at: '2026-09-15T09:00:00Z' })
  })
  await page.route(`**/api/v1/procurement/orders/${otherId}/`, route => reply(route, other))
  await page.route(`**/api/v1/procurement/orders/${otherId}/export-pdf/`, route => pdfReply(route, mixedSizePdf(1)))
  await openDetails(page)
  await page.getByRole('button', { name: 'Mark Complete', exact: true }).click()
  await page.getByRole('dialog', { name: 'Confirm action' }).getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect.poll(() => requested).toBe(true)
  await page.evaluate(path => {
    window.history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, `/procurement/orders/${otherId}`)
  await expect(page.getByRole('button', { name: 'Mark Complete', exact: true })).toBeEnabled()
  releaseCompletion()
  await expect(page.getByRole('region', { name: `Purchase Order ${other.po_number} PDF preview`, exact: true }).getByRole('img', { name: /page 1 of 1$/ })).toBeVisible({ timeout: 30000 })
  await expect(page.getByRole('button', { name: 'Mark Complete', exact: true })).toBeEnabled()
  await noSeparateApprovalCard(page)
  expect(state.acceptedWrites).toEqual([{ method: 'PATCH', path: orderPath, body: { status: 'completed' } }])
  clean(state)
})

test('a header PDF export started before completion is cancelled instead of downloading the old revision', async ({ page }) => {
  const state = await setup(page)
  const downloads = []
  page.on('download', download => downloads.push(download))
  const latest = mixedSizePdf(3)
  let releaseOld, exports = 0
  const held = new Promise(resolve => { releaseOld = resolve })
  await page.route(`**${orderPath}export-pdf/`, async route => {
    exports += 1
    const first = exports === 1
    if (first) await held
    return pdfReply(route, first ? mixedSizePdf(1) : latest)
  })
  await page.route(`**${orderPath}`, async route => {
    if (route.request().method() !== 'PATCH') return route.fallback()
    const body = route.request().postDataJSON()
    state.acceptedWrites.push({ method: 'PATCH', path: orderPath, body })
    state.record = { ...state.record, ...body, ...evidence(), updated_at: '2026-09-15T09:01:00Z' }
    return reply(route, state.record)
  })
  await openDetails(page)
  await expect.poll(() => exports).toBe(1)
  await page.getByRole('button', { name: 'Download PDF', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Preparing PDF document', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Mark Complete', exact: true }).click()
  await page.getByRole('dialog', { name: 'Confirm action' }).getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(viewer(page).getByRole('img', { name: /page 1 of 3$/ })).toBeVisible({ timeout: 30000 })
  releaseOld()
  await expect(page.getByText('The purchase order changed while the document was being prepared. Download the updated document.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download PDF', exact: true })).toBeEnabled()
  expect(downloads).toHaveLength(0)
  expect(await downloaded(page, page.getByRole('button', { name: 'Download PDF', exact: true }))).toEqual(latest)
  expect(downloads).toHaveLength(1)
  expect(exports).toBe(2)
  expect(state.acceptedWrites).toEqual([{ method: 'PATCH', path: orderPath, body: { status: 'completed' } }])
  clean(state)
})

test('navigation cancels a pending header Word export without downloading the previous PO', async ({ page }) => {
  const state = await setup(page)
  const downloads = []
  page.on('download', download => downloads.push(download))
  const otherId = '00000000-0000-4000-8000-000000009005'
  const other = { ...state.record, id: otherId, po_number: 'RAD-PRJ-PUR-9005_SEP2026' }
  const otherPdf = mixedSizePdf(2)
  let releaseOld, requested = false
  const held = new Promise(resolve => { releaseOld = resolve })
  await page.route(`**${orderPath}export-word/`, async route => {
    requested = true
    await held
    return route.fulfill({ status: 200, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', body: 'Old synthetic Word export' })
  })
  await page.route(`**/api/v1/procurement/orders/${otherId}/`, route => reply(route, other))
  await page.route(`**/api/v1/procurement/orders/${otherId}/export-pdf/`, route => pdfReply(route, otherPdf))
  await openDetails(page)
  await page.getByRole('button', { name: 'Export Word document', exact: true }).click()
  await expect.poll(() => requested).toBe(true)
  await page.evaluate(path => {
    window.history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, `/procurement/orders/${otherId}`)
  await expect(page.getByRole('region', { name: `Purchase Order ${other.po_number} PDF preview`, exact: true }).getByRole('img', { name: /page 1 of 2$/ })).toBeVisible({ timeout: 30000 })
  releaseOld()
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('button', { name: 'Download PDF', exact: true })).toBeEnabled()
  expect(downloads).toHaveLength(0)
  expect(await downloaded(page, page.getByRole('button', { name: 'Download PDF', exact: true }))).toEqual(otherPdf)
  expect(downloads).toHaveLength(1)
  expect(state.acceptedWrites).toEqual([])
  clean(state)
})

test('returning to the register cancels a pending export after the detail component unmounts', async ({ page }) => {
  const state = await setup(page)
  const downloads = []
  page.on('download', download => downloads.push(download))
  let releaseOld, requested = false
  const held = new Promise(resolve => { releaseOld = resolve })
  await page.route(`**${orderPath}export-word/`, async route => {
    requested = true
    await held
    return route.fulfill({ status: 200, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', body: 'Old synthetic Word export' })
  })
  await openDetails(page)
  await page.getByRole('button', { name: 'Export Word document', exact: true }).click()
  await expect.poll(() => requested).toBe(true)
  await page.getByRole('button', { name: 'Back to purchase orders', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible()
  releaseOld()
  await page.waitForLoadState('networkidle')
  expect(downloads).toHaveLength(0)
  expect(state.acceptedWrites).toEqual([])
  clean(state)
})
