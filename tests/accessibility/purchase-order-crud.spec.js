import { test, expect } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import { orderFormHarness, orderFormId, orderFormNumber, orderFormRecommendation } from '../fixtures/purchase-order-form.fixture'
import { purchaseOrderHarness } from '../fixtures/purchase-orders.fixture'
import { formActor } from '../fixtures/purchase-recommendation-form.fixture'
import { mixedSizePdf } from '../fixtures/mixed-size-pdf.fixture'

test.setTimeout(90000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } })
const register = page => page.getByRole('region', { name: 'Purchase order register', exact: true })
const isolated = state => { expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([]) }
const expectSavedEditor = async (page, state, writes = 1) => {
  await expect.poll(() => state.acceptedWrites.length).toBe(writes)
  await expect(page.getByRole('heading', { name: 'Edit purchase order', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save changes', exact: true }).first()).toBeEnabled()
}
const record = () => ({
  id: orderFormId, po_number: orderFormNumber, po_date: '2026-07-01', status: 'sent',
  title: 'Signed original service order', summary: 'Original signed scope', vendor: 21,
  vendor_name: 'Alfanar Engineering LLC', currency: 'USD', total_amount: '6489.00', tax_amount: '0.00', vat_percentage: 0,
  pr_reference: orderFormRecommendation.id, pr_number: orderFormRecommendation.pr_number,
  payment_terms: 'Net 30', seller_reference: 'Clear this reference', items: [], contact_persons: {},
  payment_milestones: [{ description: 'Accepted delivery', percentage: 100 }],
  approved_by_name: 'Historical Approver', approved_by_title: 'Historical Director', approved_date: '2026-07-03',
  approval_log: [{ stage: 'Final Management Sign-off', approver: 'Historical Approver', status: 'approved', source: 'uploaded_pdf', date: '2026-07-03' }],
  attachments: [], created_at: '2026-09-15T08:00:00Z',
})
const openNative = (page, prepare) => orderFormHarness(page, { path: '/procurement/orders', prepare: state => {
  state.record = record()
  // The list intentionally omits details: editing must hydrate the detail endpoint.
  state.orders = [{ id: orderFormId, po_number: orderFormNumber, title: 'Stale list title', status: 'sent', total_amount: '1', currency: 'USD' }]
  prepare?.(state)
} })
const menu = async (page, action) => {
  await page.getByRole('button', { name: `Actions for ${orderFormNumber}`, exact: true }).click()
  await page.getByRole('menuitem', { name: action, exact: true }).click()
}

test('edit saves only changed fields without damaging signed evidence or lump-sum pricing', async ({ page }) => {
  const state = await openNative(page)
  await menu(page, 'Edit order')
  await expect(page.getByRole('heading', { name: 'Edit purchase order' })).toBeVisible()
  await expect(page.locator('.purchase-order-form-workspace')).toHaveClass(/pof-page/)
  await expect(page.locator('.pof-modal')).toHaveCount(0)
  await expect(page.locator('[name="title"]')).toHaveValue('Signed original service order')
  await page.locator('[name="title"]').fill('Corrected description')
  await page.locator('[name="seller_reference"]').fill('')
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click()
  await expectSavedEditor(page, state)
  expect(state.acceptedWrites).toHaveLength(1)
  expect(state.acceptedWrites[0]).toMatchObject({ method: 'PATCH', body: { title: 'Corrected description', seller_reference: '' } })
  for (const field of ['total_amount', 'tax_amount', 'vat_percentage', 'approval_log', 'approved_by_name', 'approved_by_title', 'approved_date', 'payment_milestones', 'items']) {
    expect(state.acceptedWrites[0].body).not.toHaveProperty(field)
    expect(state.record[field]).toEqual(record()[field])
  }
  expect(state.requests.filter(item => item.path.endsWith('/reserve-number/'))).toHaveLength(0)
  isolated(state)
})

test('row and menu Preview open the clicked completed PO instead of the selected sidebar order', async ({ page }) => {
  const other = { ...record(), id: '00000000-0000-4000-8000-000000009003', po_number: 'RAD-PRJ-PUR-9003_SEP2026', title: 'A different selected order', created_at: '2026-09-14T08:00:00Z' }
  const sourcePath = `/api/v1/procurement/orders/${orderFormId}/uploaded-documents/preview-original/content/`
  const state = await openNative(page, fixture => {
    fixture.record.status = 'completed'
    fixture.orders = [fixture.record, other]
    fixture.uploadedDocuments = [{ id: 'preview-original', filename: 'Clicked-PO-original.pdf', content_url: sourcePath }]
    fixture.uploadedContent[sourcePath] = { body: mixedSizePdf(1) }
  })
  await page.route(`**/api/v1/procurement/orders/${other.id}/`, route => {
    state.requests.push({ path: new URL(route.request().url()).pathname, method: route.request().method() })
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(other) })
  })
  for (const action of ['row', 'menu']) {
    await page.getByRole('button', { name: `Select ${other.po_number}`, exact: true }).click()
    await expect(page.getByRole('complementary', { name: 'Purchase order details' })).toContainText(other.title)
    await expect(page).toHaveURL(/\/procurement\/orders$/)
    if (action === 'row') {
      const row = register(page).getByRole('row').filter({ has: page.getByRole('button', { name: `Select ${orderFormNumber}`, exact: true }) })
      await row.getByRole('button', { name: 'Preview', exact: true }).click()
    } else await menu(page, 'Preview')
    await expect(page).toHaveURL(new RegExp(`/procurement/orders/${orderFormId}$`))
    await expect(page.getByRole('heading', { name: orderFormNumber, level: 1, exact: true })).toBeVisible()
    const viewer = page.getByRole('region', { name: `Purchase Order ${orderFormNumber} PDF preview`, exact: true })
    await expect(viewer.getByRole('img')).toBeVisible({ timeout: 30000 })
    await expect(page.getByRole('heading', { name: other.po_number, level: 1, exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Back to purchase orders', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible()
  }
  expect(state.acceptedWrites).toEqual([])
  expect(state.requests.filter(request => request.path.endsWith('/export-pdf/'))).toHaveLength(2)
  isolated(state)
})

test('delete can be cancelled, preserves protected records on conflict, and removes the order only after successful confirmation', async ({ page }) => {
  const state = await openNative(page, fixture => { fixture.deleteError = { detail: 'This order has linked receipts.' } })
  await menu(page, 'Delete order')
  await page.getByRole('dialog', { name: 'Confirm action' }).getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(state.requests.filter(item => item.method === 'DELETE')).toHaveLength(0)
  await menu(page, 'Delete order')
  await page.getByRole('dialog', { name: 'Confirm action' }).getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'This order has linked receipts.' })).toBeVisible()
  await expect(register(page).getByRole('button', { name: `Select ${orderFormNumber}` })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  state.deleteError = null
  await menu(page, 'Delete order')
  await page.getByRole('dialog', { name: 'Confirm action' }).getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'No purchase orders yet' })).toBeVisible()
  expect(state.acceptedWrites.filter(item => item.method === 'DELETE')).toHaveLength(1)
  expect(state.requests.filter(item => item.path === '/api/v1/procurement/requisitions/').length).toBeGreaterThan(1)
  isolated(state)
})

test('legacy order can save an unrelated correction and link a PR without replacing its number, commercial values or sign-off', async ({ page }) => {
  const state = await openNative(page, fixture => {
    fixture.record.pr_reference = null
    fixture.record.pr_number = ''
    fixture.record.payment_terms = ''
  })
  await menu(page, 'Edit order')
  await page.locator('[name="title"]').fill('Corrected legacy title')
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click()
  await expectSavedEditor(page, state)
  expect(state.acceptedWrites[0].body).toEqual({ title: 'Corrected legacy title' })
  await page.getByRole('button', { name: 'Close purchase order', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible()
  await menu(page, 'Edit order')
  await page.locator('#po-pr-search').fill(orderFormRecommendation.pr_number)
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click()
  await expectSavedEditor(page, state, 2)
  expect(state.acceptedWrites[1].body).toEqual({ pr_reference: orderFormRecommendation.id })
  expect(state.record.po_number).toBe(orderFormNumber)
  expect(state.record.total_amount).toBe('6489.00')
  expect(state.record.approval_log).toEqual(record().approval_log)
  expect(state.requests.filter(item => item.path.endsWith('/reserve-number/'))).toHaveLength(0)
  isolated(state)
})

test('register PDF download uses the canonical saved document even when an original upload exists', async ({ page }) => {
  const original = Buffer.from('%PDF-1.4\n% SIGNED ORIGINAL SOURCE\n%%EOF')
  const path = `/api/v1/procurement/orders/${orderFormId}/uploaded-documents/source-one/content/`
  const state = await openNative(page, fixture => {
    fixture.uploadedDocumentsError = { detail: 'Original source lookup unavailable.' }
    fixture.uploadedDocuments = [{ id: 'source-one', filename: 'Signed-original.pdf', content_url: path }]
    fixture.uploadedContent[path] = { body: original }
  })
  const downloadEvent = page.waitForEvent('download')
  await menu(page, 'Download PDF')
  const download = await downloadEvent
  expect(download.suggestedFilename()).toBe('Generated-PO.pdf')
  expect(await readFile(await download.path())).toEqual(state.generatedPdf)
  expect(state.requests.filter(item => item.path.endsWith('/export-pdf/'))).toHaveLength(1)
  expect(state.requests.filter(item => item.path.includes('/uploaded-documents/'))).toEqual([])
  expect(state.acceptedWrites).toEqual([])
  isolated(state)
})

test('PO-only user deletes an order without requesting the inaccessible PR register', async ({ page }) => {
  const state = await orderFormHarness(page, {
    path: '/procurement/orders',
    actor: { ...formActor, is_superuser: false, modules: [{ code: 'procurement_orders' }], module_actions: { procurement_orders: ['read', 'update', 'delete'] } },
    prepare: fixture => { fixture.record = record(); fixture.orders = [fixture.record] },
  })
  await menu(page, 'Delete order')
  await page.getByRole('dialog', { name: 'Confirm action' }).getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'No purchase orders yet' })).toBeVisible()
  expect(state.requests.filter(item => item.path === '/api/v1/procurement/requisitions/')).toHaveLength(0)
  expect(state.acceptedWrites).toHaveLength(1)
  isolated(state)
})

test('pending signed upload row and menu Preview open its PDF viewer before edit and delete', async ({ page }) => {
  const id = 'pending-po-crud'
  const state = await orderFormHarness(page, { path: '/procurement/orders', prepare: fixture => {
    const document = { id, original_filename: 'Signed-PO.pdf', confirmed_po: null, created_at: '2026-09-15T08:00:00Z', extraction_status: 'completed', extracted_data: { po_number: orderFormNumber, summary: 'Pending signed source', vendor_name: 'Original supplier', currency: 'USD', total_amount: '6489', tax_amount: '0', gross_amount: '6489', po_date: '2026-07-01', reconciliation_required: true } }
    fixture.pendingDocuments = [document]
    fixture.documentRecords[id] = document
    fixture.uploadedContent[`/api/v1/procurement/po-documents/${id}/content/`] = { body: mixedSizePdf(1) }
  } })
  const panel = page.getByRole('complementary', { name: 'Uploaded purchase order details' })
  for (const action of ['row', 'menu']) {
    if (action === 'row') await register(page).getByRole('button', { name: 'Preview', exact: true }).click()
    else await menu(page, 'Preview')
    const dialog = page.getByRole('dialog', { name: 'Signed Purchase Order PDF', exact: true })
    await expect(dialog.getByRole('region', { name: 'Signed purchase order PDF preview', exact: true }).getByRole('img')).toBeVisible({ timeout: 30000 })
    await expect(dialog).toContainText(orderFormNumber)
    await expect(dialog.getByRole('button', { name: 'Save changes', exact: true })).toHaveCount(0)
    await expect(page).toHaveURL(/\/procurement\/orders$/)
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(dialog).toHaveCount(0)
  }
  expect(state.requests.filter(request => request.path === `/api/v1/procurement/po-documents/${id}/content/`).length).toBeGreaterThanOrEqual(2)
  expect(state.acceptedWrites).toEqual([])
  await menu(page, 'Edit uploaded PDF')
  await expect(page.getByRole('region', { name: 'Edit Signed Purchase Order PDF' })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByLabel('Supplier name', { exact: true }).fill('Corrected supplier name')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Changes saved' })).toBeVisible()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(panel).toContainText('Corrected supplier name')
  await menu(page, 'Delete uploaded PDF')
  await page.getByRole('dialog', { name: 'Confirm action' }).getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'No purchase orders yet' })).toBeVisible()
  expect(state.acceptedWrites.map(item => item.method)).toEqual(['PATCH', 'DELETE'])
  isolated(state)
})

test('read-only capabilities expose preview without create, edit, or delete actions', async ({ page }) => {
  const state = await purchaseOrderHarness(page, { prepare: fixture => Object.assign(fixture.props, { canCreate: false, canEdit: false, canDelete: false }) })
  await expect(page.getByRole('button', { name: 'New purchase order', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Actions for PO-TEST-003', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Preview', exact: true })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Edit order', exact: true })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: 'Delete order', exact: true })).toHaveCount(0)
  isolated(state)
})

test('reviewed signed upload explicitly reconciles with a master supplier and keeps the same original PDF', async ({ page }) => {
  const id = 'pending-reconcile-po'
  const original = Buffer.from('%PDF-1.4\n% ORIGINAL RECONCILIATION SOURCE\n%%EOF')
  const state = await orderFormHarness(page, { path: '/procurement/orders', prepare: fixture => {
    const document = { id, original_filename: 'Reconciled-original.pdf', confirmed_po: null, created_at: '2026-09-15T08:00:00Z', extraction_status: 'completed', extracted_data: { po_number: orderFormNumber, summary: 'Signed source awaiting reconciliation', vendor_name: 'Original supplier', currency: 'USD', total_amount: '6489', tax_amount: '0', gross_amount: '6489', po_date: '2026-07-01', reconciliation_required: true } }
    fixture.pendingDocuments = [document]
    fixture.documentRecords[id] = document
    fixture.uploadedContent[`/api/v1/procurement/po-documents/${id}/content/`] = { body: original }
    fixture.poReconcileError = { detail: 'Existing order details do not match the uploaded source.' }
  } })
  await menu(page, 'Edit uploaded PDF')
  await page.getByRole('button', { name: 'Complete reconciliation', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Choose a purchase recommendation' })).toBeVisible()
  expect(state.acceptedWrites).toHaveLength(0)
  await page.getByRole('combobox', { name: 'Purchase recommendation', exact: true }).selectOption(orderFormRecommendation.id)
  await page.getByRole('combobox', { name: 'Matched supplier', exact: true }).selectOption('21')
  await page.getByRole('button', { name: 'Complete reconciliation', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Existing order details do not match' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Edit Signed Purchase Order PDF' })).toBeVisible()
  expect(state.orders).toHaveLength(0)
  state.poReconcileError = null
  await page.getByRole('button', { name: 'Complete reconciliation', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible()
  await expect(register(page).getByRole('button', { name: `Select ${orderFormNumber}` })).toBeVisible()
  expect(state.orders).toHaveLength(1)
  expect(state.acceptedWrites.filter(item => item.path.endsWith('/reconcile/'))).toHaveLength(1)
  const event = page.waitForEvent('download')
  await menu(page, 'Download PDF')
  expect(await readFile(await (await event).path())).toEqual(state.generatedPdf)
  await menu(page, 'Preview')
  await page.getByRole('tab', { name: 'Original source', exact: true }).click()
  const originalEvent = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Download uploaded PO', exact: true }).click()
  expect(await readFile(await (await originalEvent).path())).toEqual(original)
  expect(state.requests.filter(item => item.path.endsWith('/import_signed_pdf/'))).toHaveLength(0)
  isolated(state)
})


test('a signed legacy order changes financial values only after explicit VAT confirmation and Save', async ({ page }) => {
  const state = await openNative(page)
  await menu(page, 'Edit order')
  await expect(page.locator('[name="total_amount"]')).toHaveValue('6489.00')
  await expect(page.getByRole('combobox', { name: 'Price basis', exact: true })).toHaveValue('unconfirmed')
  await page.locator('[name="currency"]').selectOption('AED')
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click()
  await expect(page.getByRole('alert').filter({ hasText: 'Confirm whether these prices include VAT' })).toBeVisible()
  expect(state.acceptedWrites).toEqual([])
  await page.getByRole('button', { name: 'Dismiss error' }).click()
  await page.locator('[name="currency"]').selectOption('USD')
  await page.getByRole('spinbutton', { name: 'Price before order discount', exact: true }).fill('100')
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click()
  await expect(page.getByRole('alert').filter({ hasText: 'Confirm whether these prices include VAT' })).toBeVisible()
  expect(state.acceptedWrites).toEqual([])
  await page.getByRole('button', { name: 'Dismiss error' }).click()
  await page.getByRole('combobox', { name: 'Price basis', exact: true }).selectOption('inclusive')
  await expect(page.locator('[name="tax_amount"]')).toHaveValue('4.76')
  await expect(page.locator('[name="total_amount"]')).toHaveValue('100')
  expect(state.acceptedWrites).toEqual([])
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click()
  await expectSavedEditor(page, state)
  expect(state.acceptedWrites).toHaveLength(1)
  expect(state.acceptedWrites[0].body).toMatchObject({ vat_basis: 'inclusive', entered_amount: 100, net_amount: 95.24, tax_amount: 4.76, total_amount: 100, vat_percentage: 5 })
  expect(state.record.approval_log).toEqual(record().approval_log)
  expect(state.acceptedWrites[0].body).not.toHaveProperty('attachments')
  await page.getByRole('button', { name: 'Close purchase order', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible()
  await menu(page, 'Edit order')
  await expect(page.getByRole('spinbutton', { name: 'Price before order discount', exact: true })).toHaveValue('100')
  await page.locator('[name="title"]').fill('Only a description edit')
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click()
  await expectSavedEditor(page, state, 2)
  expect(state.acceptedWrites[1].body).toEqual({ title: 'Only a description edit' })
  isolated(state)
})

test('pending PDF VAT review preserves extracted financial evidence and submits only the explicit treatment', async ({ page }) => {
  const id = 'pending-po-vat-review'
  const source = { po_number: orderFormNumber, summary: 'Source order', vendor_name: 'Original supplier', currency: 'USD', total_amount: '100', tax_amount: '0', gross_amount: '100', po_date: '2026-07-01' }
  const state = await orderFormHarness(page, { path: '/procurement/orders', prepare: fixture => {
    const document = { id, original_filename: 'Signed-PO.pdf', confirmed_po: null, created_at: '2026-09-15T08:00:00Z', extraction_status: 'completed', extracted_data: { ...source } }
    fixture.pendingDocuments = [document]
    fixture.documentRecords[id] = document
    fixture.uploadedContent[`/api/v1/procurement/po-documents/${id}/content/`] = { body: Buffer.from('%PDF-1.4 signed original remains unchanged') }
  } })
  await menu(page, 'Edit uploaded PDF')
  await expect(page.getByRole('spinbutton', { name: 'VAT amount', exact: true })).toHaveValue('0')
  await page.getByRole('combobox', { name: 'Price basis', exact: true }).selectOption('inclusive')
  await expect(page.getByRole('spinbutton', { name: 'VAT amount', exact: true })).toHaveValue('4.76')
  await expect(page.getByRole('spinbutton', { name: 'Gross amount', exact: true })).toHaveValue('100')
  expect(state.acceptedWrites).toEqual([])
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Changes saved' })).toBeVisible()
  expect(state.acceptedWrites).toHaveLength(1)
  expect(state.acceptedWrites[0].body).toMatchObject({ vat_basis: 'inclusive', entered_amount: '100' })
  for (const key of ['total_amount', 'tax_amount', 'gross_amount']) {
    expect(state.acceptedWrites[0].body).not.toHaveProperty(key)
    expect(state.documentRecords[id].extracted_data[key]).toBe(source[key])
  }
  // Model the API's saved review separately from the unchanged source evidence.
  state.documentRecords[id].extracted_data.canonical_financials = {
    entered_amount: '100.00', vat_basis: 'inclusive', net_amount: '95.24',
    tax_amount: '4.76', total_amount: '100.00', vat_percentage: '5.00',
  }
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await menu(page, 'Edit uploaded PDF')
  await expect(page.getByRole('spinbutton', { name: 'VAT amount', exact: true })).toHaveValue('4.76')
  await expect(page.getByRole('combobox', { name: 'Price basis', exact: true })).toHaveValue('unconfirmed')
  await page.getByLabel('Supplier name', { exact: true }).fill('Corrected reviewed supplier')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Changes saved' })).toBeVisible()
  expect(state.acceptedWrites).toHaveLength(2)
  for (const key of ['total_amount', 'tax_amount', 'gross_amount', 'entered_amount', 'vat_basis', 'canonical_financials']) {
    expect(state.acceptedWrites[1].body).not.toHaveProperty(key)
  }
  isolated(state)
})
