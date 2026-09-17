import { test, expect } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { orderFormHarness, orderFormId, orderFormNumber, orderFormRecommendation } from '../fixtures/purchase-order-form.fixture'
import { formActor } from '../fixtures/purchase-recommendation-form.fixture'

test.setTimeout(60000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } })
const prId = orderFormRecommendation.id
const prNumber = orderFormRecommendation.pr_number
const documentId = 'signed-order-from-recommendation'
const dialog = page => page.getByRole('dialog', { name: 'Link purchase order', exact: true })
const importer = page => page.getByRole('dialog', { name: 'Import Signed Purchase Order PDF', exact: true })
const reply = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
const source = { name: 'Signed-original-PO.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% SYNTHETIC SIGNED PO SOURCE\n%%EOF') }
const po = () => ({ id: orderFormId, po_number: orderFormNumber, status: 'completed', vendor_name: 'Alfanar Engineering LLC', currency: 'USD', total_amount: '6489.00', title: 'Original signed scope', items: [], created_at: '2026-09-15T08:00:00Z' })
const poLink = () => ({ status: 'linked', po_id: orderFormId, po_number: orderFormNumber, manual_link_required: false })
const actor = actions => ({ ...formActor, is_superuser: false, modules: [{ code: 'procurement_requisitions' }, { code: 'procurement_orders' }], module_actions: { procurement_requisitions: ['read'], procurement_orders: actions } })
const isolated = state => { expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([]) }

async function open(page, options = {}) {
  const state = await orderFormHarness(page, { path: '/procurement/requisitions', actor: options.actor, recommendation: { po_applicable: true } })
  Object.assign(state, { lookups: [], imports: [], links: [], reconciliations: [], searchOnly: false, lookupError: null, linkError: null, importError: null, reconcileError: null, pending: false })
  const markLinked = () => {
    state.record = { ...po(), pr_reference: prId, pr_number: prNumber }
    state.orders = [state.record]
    Object.assign(state.recommendation, { linked_po_id: orderFormId, linked_po_number: orderFormNumber, po_number_reference: orderFormNumber, has_existing_po: true })
  }
  await page.route('**/api/v1/procurement/orders/?**', route => {
    const search = new URL(route.request().url()).searchParams.get('search') || ''
    state.lookups.push(search)
    if (state.lookupError) return reply(route, { detail: state.lookupError }, 503)
    const rows = (state.searchOnly && !search) || (search && !orderFormNumber.includes(search)) ? [] : [po()]
    return reply(route, { count: rows.length, results: rows })
  })
  await page.route('**/api/v1/procurement/requisitions/*/link-purchase-order/', route => {
    state.links.push({ path: new URL(route.request().url()).pathname, body: route.request().postDataJSON() })
    if (state.linkError) return reply(route, { error: state.linkError }, 409)
    markLinked()
    return reply(route, { requisition_id: prId, po_link: poLink() })
  })
  await page.route('**/api/v1/procurement/po-documents/import_signed_pdf/', route => {
    const body = route.request().postData()
    state.imports.push(body)
    if (state.importError) return reply(route, { error: state.importError }, 409)
    if (state.pending) {
      const fields = { po_number: orderFormNumber, pr_id: prId, pr_number: prNumber, originating_pr_id: prId, summary: 'Signed original awaiting supplier review', vendor_name: 'Original supplier', vendor_id: state.pendingVendorId || null, currency: 'USD', total_amount: '6489', gross_amount: '6489', tax_amount: '0', po_date: '2026-07-01', reconciliation_required: true }
      state.documentRecords[documentId] = { id: documentId, original_filename: source.name, confirmed_po: null, extraction_status: 'completed', extracted_data: fields }
      state.uploadedContent[`/api/v1/procurement/po-documents/${documentId}/content/`] = { body: source.buffer }
      return reply(route, { ...fields, document_id: documentId, purchase_order_id: null, operation: 'uploaded', success: true })
    }
    markLinked()
    return reply(route, { document_id: documentId, purchase_order_id: orderFormId, pr_id: prId, pr_number: prNumber, po_number: orderFormNumber, po_link: poLink(), operation: 'created', success: true })
  })
  await page.route('**/api/v1/procurement/po-documents/*/reconcile/', route => {
    const body = route.request().postDataJSON()
    state.reconciliations.push(body)
    if (state.reconcileError) return reply(route, state.reconcileError, state.reconcileErrorStatus || 409)
    state.documentRecords[documentId].extracted_data = { ...state.documentRecords[documentId].extracted_data, ...body.reviewed_fields }
    markLinked()
    state.documentRecords[documentId].confirmed_po = orderFormId
    return reply(route, { document_id: documentId, purchase_order_id: orderFormId, pr_id: prId, pr_number: prNumber, po_link: poLink(), operation: 'created', success: true })
  })
  await page.getByRole('button', { name: `Link purchase order for ${prNumber}`, exact: true }).click()
  await expect(dialog(page)).toBeVisible()
  return state
}

async function upload(page) {
  await dialog(page).getByRole('button', { name: 'Upload Signed PO', exact: true }).click()
  await expect(importer(page)).toBeVisible()
  await expect(dialog(page)).not.toBeVisible()
  await importer(page).locator('input[type="file"]').setInputFiles(source)
  await importer(page).getByRole('button', { name: 'Save PO', exact: true }).click()
}

test('typing searches existing POs and links a completed order without changing its commercial data', async ({ page }) => {
  const state = await open(page)
  state.searchOnly = true
  const input = dialog(page).getByRole('combobox', { name: 'Purchase order', exact: true })
  await input.fill('9002')
  await expect.poll(() => state.lookups).toContain('9002')
  await expect(dialog(page).getByRole('option', { name: new RegExp(orderFormNumber) })).toBeVisible()
  await input.press('ArrowDown')
  await input.press('Enter')
  await dialog(page).getByRole('button', { name: 'Link purchase order', exact: true }).click()
  await expect(dialog(page)).not.toBeVisible()
  await expect(page.getByRole('link', { name: `Open purchase order ${orderFormNumber}`, exact: true })).toBeVisible()
  expect(state.links).toEqual([{ path: `/api/v1/procurement/requisitions/${prId}/link-purchase-order/`, body: { purchase_order_id: orderFormId } }])
  expect(state.imports).toEqual([])
  expect(state.acceptedWrites).toEqual([])
  expect(state.record).toMatchObject({ status: 'completed', total_amount: '6489.00', currency: 'USD' })
  isolated(state)
})

test('signed PDF import carries the original PR and refreshes its saved PO link', async ({ page }) => {
  const state = await open(page)
  await page.screenshot({ path: '../artifacts/pr-po-upload-link-dialog.png' })
  await upload(page)
  await expect(importer(page)).not.toBeVisible()
  await expect(page.getByRole('link', { name: `Open purchase order ${orderFormNumber}`, exact: true })).toBeVisible()
  expect(state.imports).toHaveLength(1)
  expect(state.imports[0]).toContain('name="pr_id"')
  expect(state.imports[0]).toContain(prId)
  expect(state.imports[0]).toContain(source.name)
  expect(state.record.pr_reference).toBe(prId)
  expect(state.orders).toHaveLength(1)
  expect(state.links).toEqual([])
  isolated(state)
})

test('Save PO persists reviewed fields and links the originating PR in one request', async ({ page }) => {
  const state = await open(page)
  state.pending = true
  await upload(page)
  const editor = page.getByRole('dialog', { name: 'Edit Signed Purchase Order PDF', exact: true })
  await expect(editor).toBeVisible()
  expect(state.orders).toEqual([])
  await expect(editor).toContainText(prNumber)
  await expect(editor.getByRole('button', { name: 'Save changes', exact: true })).toHaveCount(0)
  await expect(editor.getByRole('button', { name: 'Complete reconciliation', exact: true })).toHaveCount(0)
  await editor.getByLabel('Description', { exact: true }).fill('Reviewed scope from the signed source')
  await editor.getByRole('combobox', { name: 'Matched supplier', exact: true }).selectOption('21')
  await editor.getByRole('button', { name: 'Save PO', exact: true }).click()
  await expect(editor).not.toBeVisible()
  await expect(page.getByRole('link', { name: `Open purchase order ${orderFormNumber}`, exact: true })).toBeVisible()
  expect(state.reconciliations).toHaveLength(1)
  expect(state.reconciliations[0]).toMatchObject({ vendor_id: '21', pr_id: prId, reviewed_fields: { summary: 'Reviewed scope from the signed source', pr_id: prId } })
  expect(state.requests.filter(request => request.method === 'PATCH')).toEqual([])
  expect(state.imports).toHaveLength(1)
  expect(state.orders).toHaveLength(1)
  expect(state.links).toEqual([])
  isolated(state)
})

test('failed upload keeps the selected signed source and PR context available for retry', async ({ page }) => {
  const state = await open(page)
  state.importError = 'The signed source references a different purchase recommendation.'
  await upload(page)
  await expect(importer(page).getByRole('alert')).toContainText(state.importError)
  await expect(importer(page)).toContainText(source.name)
  expect(state.orders).toEqual([])
  state.importError = null
  await importer(page).getByRole('button', { name: 'Save PO', exact: true }).click()
  await expect(importer(page)).not.toBeVisible()
  expect(state.imports).toHaveLength(2)
  expect(state.imports.every(body => body.includes(prId))).toBe(true)
  expect(state.orders).toHaveLength(1)
  isolated(state)
})

test('cancelling signed import returns to the same searchable link dialog without writing', async ({ page }) => {
  const state = await open(page)
  await dialog(page).getByRole('button', { name: 'Upload Signed PO', exact: true }).click()
  await expect(importer(page)).toBeVisible()
  await importer(page).getByRole('button', { name: 'Close PDF dialog', exact: true }).click()
  await expect(dialog(page)).toBeVisible()
  await expect(dialog(page)).toContainText(prNumber)
  expect(state.imports).toEqual([])
  expect(state.links).toEqual([])
  expect(state.acceptedWrites).toEqual([])
  isolated(state)
})

test('link-only permission retains existing PO lookup while signed upload requires create access', async ({ page }) => {
  const state = await open(page, { actor: actor(['read', 'update']) })
  await expect(dialog(page).getByRole('combobox', { name: 'Purchase order', exact: true })).toBeEnabled()
  await expect(dialog(page).getByRole('button', { name: 'Upload Signed PO', exact: true })).toHaveCount(0)
  expect(state.imports).toEqual([])
  isolated(state)
})

test('PO create permission can import from its PR without update permission or a second link request', async ({ page }) => {
  const state = await open(page, { actor: actor(['read', 'create']) })
  await expect(dialog(page).getByRole('combobox', { name: 'Purchase order', exact: true })).toHaveCount(0)
  await upload(page)
  await expect(page.getByRole('link', { name: `Open purchase order ${orderFormNumber}`, exact: true })).toBeVisible()
  expect(state.imports).toHaveLength(1)
  expect(state.links).toEqual([])
  isolated(state)
})

test('existing PO link conflict preserves the selection and permits retry', async ({ page }) => {
  const state = await open(page)
  state.linkError = 'This purchase order is already linked to another recommendation.'
  const input = dialog(page).getByRole('combobox', { name: 'Purchase order', exact: true })
  await input.fill('9002')
  await expect.poll(() => state.lookups).toContain('9002')
  await dialog(page).getByRole('option', { name: new RegExp(orderFormNumber) }).click()
  await dialog(page).getByRole('button', { name: 'Link purchase order', exact: true }).click()
  await expect(dialog(page).getByRole('alert')).toContainText(state.linkError)
  await expect(input).toHaveValue(new RegExp(orderFormNumber))
  expect(state.orders).toEqual([])
  state.linkError = null
  await dialog(page).getByRole('button', { name: 'Link purchase order', exact: true }).click()
  await expect(dialog(page)).not.toBeVisible()
  expect(state.links).toHaveLength(2)
  expect(state.imports).toEqual([])
  isolated(state)
})

test('failed PO lookup shows a retry and typing another query clears stale selections', async ({ page }) => {
  const state = await open(page)
  const input = dialog(page).getByRole('combobox', { name: 'Purchase order', exact: true })
  state.lookupError = 'Purchase order lookup temporarily unavailable.'
  await input.fill('9002')
  await expect(dialog(page).getByRole('alert')).toContainText(state.lookupError)
  state.lookupError = null
  await dialog(page).getByRole('button', { name: 'Retry purchase orders' }).click()
  await input.focus()
  await dialog(page).getByRole('option', { name: new RegExp(orderFormNumber) }).click()
  await expect(dialog(page).getByRole('button', { name: 'Link purchase order', exact: true })).toBeEnabled()
  await input.fill('no-such-order')
  await expect(dialog(page).getByRole('button', { name: 'Link purchase order', exact: true })).toBeDisabled()
  await expect(dialog(page)).toContainText('No purchase orders found.')
  expect(state.links).toEqual([])
  expect(state.imports).toEqual([])
  isolated(state)
})

test('Save PO registers an extracted supplier without requiring a master dropdown selection', async ({ page }) => {
  const state = await open(page)
  state.pending = true
  state.pendingVendorId = '21'
  await upload(page)
  const editor = page.getByRole('dialog', { name: 'Edit Signed Purchase Order PDF', exact: true })
  await expect(editor).toBeVisible()
  await expect(editor.getByRole('combobox', { name: 'Matched supplier', exact: true })).toHaveValue('21')
  await editor.getByLabel('Supplier name', { exact: true }).fill('New source supplier LLC')
  await expect(editor.getByRole('combobox', { name: 'Matched supplier', exact: true })).toHaveValue('')
  await editor.getByRole('button', { name: 'Save PO', exact: true }).click()
  await expect(editor).not.toBeVisible()
  expect(state.reconciliations).toHaveLength(1)
  expect(state.reconciliations[0]).toMatchObject({ pr_id: prId, reviewed_fields: { vendor_name: 'New source supplier LLC' } })
  expect(state.reconciliations[0].vendor_id ?? null).toBeNull()
  expect(state.requests.filter(request => ['PATCH', 'PUT'].includes(request.method))).toEqual([])
  expect(state.imports).toHaveLength(1)
  expect(state.links).toEqual([])
  expect(state.orders).toHaveLength(1)
  isolated(state)
})

test('failed combined save retains reviewed details and retries without another upload or partial save', async ({ page }) => {
  const state = await open(page)
  state.pending = true
  await upload(page)
  const editor = page.getByRole('dialog', { name: 'Edit Signed Purchase Order PDF', exact: true })
  await expect(editor).toBeVisible()
  await editor.getByLabel('Description', { exact: true }).fill('Reviewed description retained on failure')
  state.reconcileError = { detail: 'Vendor registration permission is required. Select an existing supplier instead.' }
  state.reconcileErrorStatus = 403
  await editor.getByRole('button', { name: 'Save PO', exact: true }).click()
  await expect(editor.getByRole('alert')).toContainText(state.reconcileError.detail)
  await expect(editor.getByLabel('Description', { exact: true })).toHaveValue('Reviewed description retained on failure')
  expect(state.documentRecords[documentId].extracted_data.summary).toBe('Signed original awaiting supplier review')
  expect(state.orders).toEqual([])
  expect(state.requests.filter(request => request.method === 'PATCH')).toEqual([])
  state.reconcileError = null
  await editor.getByRole('combobox', { name: 'Matched supplier', exact: true }).selectOption('21')
  await editor.getByRole('button', { name: 'Save PO', exact: true }).click()
  await expect(editor).not.toBeVisible()
  expect(state.reconciliations).toHaveLength(2)
  expect(state.reconciliations[1]).toMatchObject({ vendor_id: '21', reviewed_fields: { summary: 'Reviewed description retained on failure' } })
  expect(state.imports).toHaveLength(1)
  expect(state.orders).toHaveLength(1)
  isolated(state)
})

test('reopening a PR-originated pending PDF from the PO register keeps the single Save PO action', async ({ page }) => {
  const state = await orderFormHarness(page, { path: '/procurement/orders', prepare: fixture => {
    const document = { id: documentId, original_filename: source.name, confirmed_po: null, created_at: '2026-09-15T08:00:00Z', extraction_status: 'completed', extracted_data: { originating_pr_id: prId, pr_id: prId, pr_number: prNumber, po_number: orderFormNumber, summary: 'Original pending order', vendor_name: 'New seller LLC', currency: 'USD', total_amount: '6489', tax_amount: '0', gross_amount: '6489', po_date: '2026-07-01', reconciliation_required: true } }
    fixture.pendingDocuments = [document]
    fixture.documentRecords[documentId] = document
    fixture.uploadedContent[`/api/v1/procurement/po-documents/${documentId}/content/`] = { body: source.buffer }
  } })
  await page.getByRole('button', { name: `Actions for ${orderFormNumber}`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Edit uploaded PDF', exact: true }).click()
  const editor = page.getByRole('region', { name: 'Edit Signed Purchase Order PDF', exact: true })
  await expect(editor).toBeVisible()
  await expect(editor.getByRole('combobox', { name: 'Purchase recommendation', exact: true })).toBeDisabled()
  await editor.getByRole('button', { name: 'Save PO', exact: true }).click()
  await expect(editor).not.toBeVisible()
  expect(state.acceptedWrites).toHaveLength(1)
  expect(state.acceptedWrites[0]).toMatchObject({ method: 'POST', path: `/api/v1/procurement/po-documents/${documentId}/reconcile/`, body: { pr_id: prId, reviewed_fields: { vendor_name: 'New seller LLC' } } })
  expect(state.requests.filter(request => request.path.endsWith('/import_signed_pdf/'))).toEqual([])
  isolated(state)
})
