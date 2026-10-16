import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { orderFormHarness, orderFormId, orderFormNumber, orderFormRecommendation } from '../fixtures/purchase-order-form.fixture'
import { formActor } from '../fixtures/purchase-recommendation-form.fixture'
import { syntheticApprovedPdf, syntheticPoPdf } from '../fixtures/purchase-recommendation-paired-import.fixture'

test.setTimeout(90000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } })
const modal = page => page.getByRole('dialog', { name: 'Upload PR, PO and Vendor', exact: true })
const save = page => modal(page).getByRole('button', { name: 'Save PO', exact: true })
const clean = state => { expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([]) }
const reply = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
const documentCalls = state => state.requests.filter(request => /^\/api\/v1\/procurement\/po-documents\/[^/]+\/(?:content\/|reconcile\/)?$/.test(request.path) && !['preview_signed_pdf', 'import_signed_pdf', 'approval-employees'].some(action => request.path.includes(action)))
async function open(page, options = {}) {
  const state = await orderFormHarness(page, { path: '/procurement/orders', ...options })
  await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'More purchase order actions', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Import signed PDF', exact: true }).click()
  await expect(modal(page)).toBeVisible()
  return state
}
async function review(page) {
  await modal(page).getByLabel('Select signed or approved PO PDF', { exact: true }).setInputFiles(syntheticPoPdf)
  await modal(page).getByRole('button', { name: 'Preview OCR', exact: true }).click()
  await expect(modal(page).getByLabel('PO Number', { exact: true })).toHaveValue(orderFormNumber)
}

test('PO register opens one upload/review page and saves PO plus reviewed vendor details without a document-edit handoff', async ({ page }) => {
  const state = await open(page)
  await expect(modal(page).getByLabel('Select signed or approved PR PDF', { exact: true })).toHaveCount(1)
  await review(page)
  expect(state.acceptedWrites).toEqual([])
  await expect(modal(page).getByRole('region', { name: 'Vendor details', exact: true })).toBeVisible()
  await expect(modal(page).getByLabel('Vendor trade license', { exact: true })).toHaveValue('ORIGINAL-LICENSE')
  await expect(modal(page).getByLabel('Vendor email', { exact: true })).toHaveValue('original@example.test')
  await modal(page).getByLabel('PO Description', { exact: true }).fill('Reviewed PO and vendor on one page')
  await modal(page).getByLabel('Vendor contact person', { exact: true }).fill('Reviewed Seller Contact')
  await modal(page).getByLabel('Vendor email', { exact: true }).fill('reviewed@example.test')
  await modal(page).getByRole('textbox', { name: 'Vendor address', exact: true }).fill('Reviewed supplier address')
  await mkdir('artifacts', { recursive: true })
  await modal(page).locator('.procurement-import-review__form').evaluate(element => { element.scrollTop = 0 })
  await page.screenshot({ path: 'artifacts/unified-po-upload-review.png' })
  await save(page).click()
  await expect(modal(page)).toContainText('The original PO PDF is attached.')
  expect(state.acceptedWrites).toHaveLength(1)
  expect(state.acceptedWrites[0]).toMatchObject({ path: '/api/v1/procurement/po-documents/import_signed_pdf/', body: {
    file: { filename: syntheticPoPdf.name }, reviewed_fields: { summary: 'Reviewed PO and vendor on one page', seller_contact_person: 'Reviewed Seller Contact', seller_email: 'reviewed@example.test', seller_address: 'Reviewed supplier address' },
  } })
  expect(state.orders).toHaveLength(1)
  expect(documentCalls(state)).toEqual([])
  await expect(page.getByRole('dialog', { name: 'Edit Signed Purchase Order PDF', exact: true })).toHaveCount(0)
  clean(state)
})

test('PO-only permissions allow review/save without PR-file requirements or PR-only lookup endpoints', async ({ page }) => {
  const actor = { ...formActor, is_superuser: false, modules: [{ code: 'procurement_orders' }], module_actions: { procurement_orders: ['read', 'create'], procurement_requisitions: [] } }
  const state = await open(page, { actor })
  await expect(modal(page).getByLabel('Select signed or approved PR PDF', { exact: true })).toHaveCount(0)
  await review(page)
  await expect(save(page)).toBeEnabled()
  await save(page).click()
  await expect(modal(page)).toContainText('The original PO PDF is attached.')
  expect(state.requests.filter(request => ['/api/v1/procurement/requisitions/get_approvers/', '/api/v1/procurement/requisitions/check_pr_number/', '/api/v1/procurement/requisitions/'].includes(request.path))).toEqual([])
  expect(state.acceptedWrites).toHaveLength(1)
  clean(state)
})

test('PO-only upload saves visible signature evidence with missing signer and date for review', async ({ page }) => {
  const warning = 'PO approval evidence needs review: the approver name and approval date are missing.'
  const state = await open(page, { prepare: fixture => {
    fixture.poPdfPreviews[syntheticPoPdf.name] = { data: { approval_evidence: { signature_detected: true, approved_by_name: '', approved_date: '' } } }
    fixture.poPdfImportResult = { success: true, purchase_order_id: orderFormId, po_number: orderFormNumber, operation: 'created', signature_visible: true, signature_verified: false, approval_evidence_complete: false, workflow_issues: [warning] }
  } })
  await review(page)
  await expect(modal(page).getByLabel('PO approval signature is visible', { exact: true })).not.toBeChecked()
  await modal(page).getByLabel('PO approval signature is visible', { exact: true }).check()
  await modal(page).getByLabel('PO Approver title', { exact: true }).fill('Visible source title')
  await expect(modal(page).getByRole('status', { name: 'PO approval evidence warning', exact: true })).toContainText('Missing PO approver name and PO approval date.')
  await save(page).click()
  await expect(modal(page)).toContainText('The original PO PDF is attached.')
  await expect(modal(page)).toContainText(warning)
  expect(state.acceptedWrites).toHaveLength(1)
  expect(state.acceptedWrites[0].body).toMatchObject({ signature_verified: true, approved_by_name: '', approved_date: '', approved_by_title: 'Visible source title', file: { filename: syntheticPoPdf.name } })
  expect(documentCalls(state)).toEqual([])
  await expect(page.getByRole('dialog', { name: 'Edit Signed Purchase Order PDF', exact: true })).toHaveCount(0)
  clean(state)
})

test('PO-only upload retains its PDF and edits until a missing or invalid amount is corrected', async ({ page }) => {
  const actor = { ...formActor, is_superuser: false, modules: [{ code: 'procurement_orders' }], module_actions: { procurement_orders: ['read', 'create'], procurement_requisitions: [] } }
  const state = await open(page, { actor, prepare: fixture => {
    fixture.poPdfPreviews[syntheticPoPdf.name] = { data: {
      extracted_data: { total_amount: null, gross_amount: null },
      reconciliation_issues: ['The purchase amount could not be confirmed. Review and save the amount from the original PDF.'],
    } }
  } })
  await review(page)
  await modal(page).getByLabel('Vendor email', { exact: true }).fill('retained@example.test')
  const source = modal(page).getByRole('link', { name: 'Open PO PDF in new tab', exact: true })
  const sourceUrl = await source.getAttribute('href')
  const amount = modal(page).getByLabel('PO Entered price', { exact: true })
  await expect(amount).toHaveValue('')
  for (const value of ['', '-10']) {
    await amount.fill(value)
    await save(page).click()
    await expect(amount).toBeFocused()
    await expect(amount).toHaveAttribute('aria-invalid', 'true')
    await expect(modal(page).getByRole('alert')).toContainText('Enter a PO amount greater than zero')
  }
  expect(state.requests.filter(request => request.path.endsWith('/import_signed_pdf/'))).toEqual([])
  expect(state.acceptedWrites).toEqual([])
  await expect(source).toHaveAttribute('href', sourceUrl)
  await expect(modal(page).getByLabel('Vendor email', { exact: true })).toHaveValue('retained@example.test')
  await amount.fill('7654.32')
  await modal(page).getByLabel('PO VAT price basis', { exact: true }).selectOption('none')
  await save(page).click()
  await expect(modal(page)).toContainText('The original PO PDF is attached.')
  expect(state.requests.filter(request => request.path.endsWith('/import_signed_pdf/'))).toHaveLength(1)
  expect(state.acceptedWrites).toHaveLength(1)
  expect(state.acceptedWrites[0].body).toMatchObject({ file: { filename: syntheticPoPdf.name }, reviewed_fields: { entered_amount: '7654.32', vat_basis: 'none', seller_email: 'retained@example.test' } })
  expect(documentCalls(state)).toEqual([])
  clean(state)
})

test('vendor permission failure retains reviewed details and selecting an existing vendor retries the same final save', async ({ page }) => {
  const state = await open(page)
  await review(page)
  await modal(page).getByLabel('Vendor phone', { exact: true }).fill('+971500009999')
  state.poPdfImportError = { detail: 'Vendor registration permission is required. Select an existing vendor.' }
  state.poPdfImportErrorStatus = 403
  await save(page).click()
  await expect(modal(page).getByRole('alert')).toContainText('Vendor registration permission')
  await expect(modal(page).getByLabel('Vendor phone', { exact: true })).toHaveValue('+971500009999')
  const supplier = modal(page).getByRole('combobox', { name: 'PO Supplier name', exact: true })
  await supplier.fill(state.vendors[0].name)
  await modal(page).getByRole('listbox', { name: 'Existing vendors', exact: true }).getByRole('option').filter({ hasText: state.vendors[0].name }).first().click()
  await expect(modal(page)).toContainText('Existing vendor selected.')
  state.poPdfImportError = null
  await save(page).click()
  await expect(modal(page)).toContainText('The original PO PDF is attached.')
  expect(state.acceptedWrites).toHaveLength(1)
  expect(state.acceptedWrites[0].body.reviewed_fields).toMatchObject({ vendor_id: String(state.vendors[0].id), seller_phone: '+971500009999', seller_contact_person: 'Original Contact' })
  expect(documentCalls(state)).toEqual([])
  clean(state)
})

test('vendor search failure does not block automatic matching and typing clears a stale selected vendor ID', async ({ page }) => {
  const state = await open(page)
  await review(page)
  const supplier = modal(page).getByRole('combobox', { name: 'PO Supplier name', exact: true })
  await supplier.fill(state.vendors[0].name)
  await modal(page).getByRole('listbox', { name: 'Existing vendors', exact: true }).getByRole('option').filter({ hasText: state.vendors[0].name }).first().click()
  await page.route('**/api/v1/procurement/vendors/**', route => reply(route, { detail: 'Vendor read permission unavailable.' }, 403))
  await supplier.fill('Corrected source seller LLC')
  await expect(modal(page)).toContainText('Vendor search is unavailable.')
  await expect(modal(page).getByText('Existing vendor selected.', { exact: true })).toHaveCount(0)
  await save(page).click()
  await expect(modal(page)).toContainText('The original PO PDF is attached.')
  expect(state.acceptedWrites[0].body.reviewed_fields).toMatchObject({ vendor_name: 'Corrected source seller LLC', vendor_id: null })
  clean(state)
})

test('an incomplete server result stays on the unified review and never opens a saved-document editor', async ({ page }) => {
  const state = await open(page, { prepare: current => { current.poPdfImportResult = { success: true, document_id: 'unexpected-pending', purchase_order_id: null, operation: 'uploaded' } } })
  await review(page)
  await modal(page).getByLabel('Vendor email', { exact: true }).fill('retained@example.test')
  await save(page).click()
  await expect(modal(page).getByRole('alert')).toContainText('saved PO and its link could not be confirmed')
  await expect(modal(page).getByLabel('Vendor email', { exact: true })).toHaveValue('retained@example.test')
  expect(state.orders).toEqual([])
  expect(documentCalls(state)).toEqual([])
  await expect(page.getByRole('dialog', { name: 'Edit Signed Purchase Order PDF', exact: true })).toHaveCount(0)
  state.poPdfImportResult = null
  await save(page).click()
  await expect(modal(page)).toContainText('The original PO PDF is attached.')
  expect(state.orders).toHaveLength(1)
  clean(state)
})

test('PR-link entrypoint can review both PDFs and normalizes paired success back to its originating PR', async ({ page }) => {
  const state = await orderFormHarness(page, { path: '/procurement/requisitions' })
  const calls = []
  await page.route('**/api/v1/procurement/requisitions/import-signed-pdf/', async route => {
    const raw = route.request().postData()
    const field = name => raw.split(`name="${name}"`)[1]?.split('\r\n\r\n').slice(1).join('\r\n\r\n').split('\r\n--')[0]
    calls.push({ raw, preview: field('preview_only') === 'true' })
    if (field('preview_only') === 'true') return reply(route, {
      success: true, preview_only: true, database_match: true, bound_pr_number: orderFormRecommendation.pr_number,
      extracted_data: { pr_number: orderFormRecommendation.pr_number }, document_signed_off: true, approval_detection: { approval_date: '2026-09-15' },
      po_preview: { extracted_data: { po_number: orderFormNumber, vendor_name: 'Source Vendor', summary: 'Source PO scope', currency: 'USD', total_amount: '6489', po_date: '2026-07-01' }, approval_evidence: {} },
    })
    const link = { status: 'linked', po_id: orderFormId, po_number: orderFormNumber, manual_link_required: false }
    Object.assign(state.recommendation, { linked_po_id: orderFormId, linked_po_number: orderFormNumber, po_number_reference: orderFormNumber, has_existing_po: true })
    state.record = { id: orderFormId, po_number: orderFormNumber, pr_reference: orderFormRecommendation.id, status: 'draft', items: [] }
    state.orders = [state.record]
    return reply(route, { success: true, requisition_id: orderFormRecommendation.id, pr_number: orderFormRecommendation.pr_number, purchase_order_id: orderFormId, po_link: link, purchase_order: { purchase_order_id: orderFormId, po_number: orderFormNumber, pr_id: orderFormRecommendation.id, po_link: link } })
  })
  await page.getByRole('button', { name: `Link purchase order for ${orderFormRecommendation.pr_number}`, exact: true }).click()
  const linking = page.getByRole('dialog', { name: 'Link purchase order', exact: true })
  await linking.getByRole('button', { name: 'Upload Signed PO', exact: true }).click()
  await expect(linking).not.toBeVisible()
  await modal(page).getByLabel('Select signed or approved PR PDF', { exact: true }).setInputFiles(syntheticApprovedPdf)
  await modal(page).getByLabel('Select signed or approved PO PDF', { exact: true }).setInputFiles(syntheticPoPdf)
  await modal(page).getByRole('button', { name: 'Preview OCR', exact: true }).click()
  await modal(page).getByRole('button', { name: 'Upload PR and PO', exact: true }).click()
  await expect(modal(page)).toHaveCount(0)
  await expect(page.getByRole('link', { name: `Open purchase order ${orderFormNumber}`, exact: true })).toBeVisible()
  expect(calls).toHaveLength(2)
  expect(calls.every(call => call.raw.includes(`name="originating_pr_id"\r\n\r\n${orderFormRecommendation.id}`))).toBe(true)
  expect(state.orders).toHaveLength(1)
  expect(documentCalls(state)).toEqual([])
  clean(state)
})

test('uploading only a PO from an existing PR attachment action keeps that PR bound through preview and save', async ({ page }) => {
  const state = await orderFormHarness(page, { path: '/procurement/requisitions', actor: { ...formActor, is_superuser: true } })
  await page.getByRole('button', { name: `Actions for ${orderFormRecommendation.pr_number}`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Attach signed PDF', exact: true }).click()
  await expect(modal(page)).toBeVisible()
  await review(page)
  await expect(modal(page).getByRole('combobox', { name: 'Purchase recommendation', exact: true })).toHaveCount(0)
  expect(state.acceptedWrites).toEqual([])
  await save(page).click()
  await expect(modal(page)).toContainText('The original PO PDF is attached.')
  expect(state.acceptedWrites).toHaveLength(1)
  expect(state.acceptedWrites[0].body.pr_id).toBe(orderFormRecommendation.id)
  expect(state.record.pr_reference).toBe(orderFormRecommendation.id)
  expect(documentCalls(state)).toEqual([])
  clean(state)
})
