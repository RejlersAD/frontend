import { test, expect } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { orderFormHarness, orderFormId, orderFormNumber, orderFormRecommendation } from '../fixtures/purchase-order-form.fixture'
import { formActor } from '../fixtures/purchase-recommendation-form.fixture'

test.setTimeout(90000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } })

const record = () => ({
  id: orderFormId, po_number: orderFormNumber, po_date: '2026-07-01', status: 'completed',
  title: 'Completed signed service order', vendor: 21, vendor_name: 'Alfanar Engineering LLC',
  currency: 'USD', total_amount: '6489.00', tax_amount: '0.00', vat_percentage: 0,
  pr_reference: null, pr_number: '', payment_terms: 'Net 30', items: [],
  approval_log: [{ stage: 'Final sign-off', approver: 'Historical Approver', status: 'approved', source: 'uploaded_pdf' }],
  created_at: '2026-09-15T08:00:00Z',
})

const reply = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
const register = page => page.getByRole('region', { name: 'Purchase order register', exact: true })
const dialog = page => page.getByRole('dialog', { name: 'Link purchase recommendation' })
const ordersActor = actions => ({ ...formActor, is_superuser: false, modules: [{ code: 'procurement_orders' }], module_actions: { procurement_orders: actions } })
async function openCompleted(page, actor = ordersActor(['read', 'update'])) {
  const state = await orderFormHarness(page, { actor, path: '/procurement/orders', prepare: fixture => {
    fixture.record = record()
    fixture.orders = [fixture.record]
  } })
  state.linkRequests = []
  state.lookupRequests = []
  state.lookupError = null
  state.linkError = null
  state.searchOnly = false
  await page.route('**/api/v1/procurement/orders/available-requisitions/**', route => {
    const search = new URL(route.request().url()).searchParams.get('search') || ''
    state.lookupRequests.push(search)
    if (state.lookupError) return reply(route, { detail: state.lookupError }, 503)
    const rows = (state.searchOnly && !search) || (search && !orderFormRecommendation.pr_number.includes(search)) ? [] : [orderFormRecommendation]
    return reply(route, rows)
  })
  await page.route('**/api/v1/procurement/requisitions/*/link-purchase-order/', route => {
    const request = { path: new URL(route.request().url()).pathname, method: route.request().method(), body: route.request().postDataJSON() }
    state.linkRequests.push(request)
    if (state.linkError) return reply(route, { requisition_id: orderFormRecommendation.id, po_link: { status: 'conflict', manual_link_required: true, message: state.linkError }, error: state.linkError }, 409)
    state.record = { ...state.record, pr_reference: orderFormRecommendation.id, pr_number: orderFormRecommendation.pr_number }
    state.orders = [state.record]
    return reply(route, { requisition_id: orderFormRecommendation.id, po_link: { status: 'linked', po_id: orderFormId, po_number: orderFormNumber, manual_link_required: false } })
  })
  return state
}

test('completed PO links a recommendation through its dedicated action without editing commercial data', async ({ page }) => {
  const state = await openCompleted(page)
  await register(page).getByRole('button', { name: `Reconcile purchase recommendation for ${orderFormNumber}` }).click()
  await expect(dialog(page)).toBeVisible({ timeout: 5000 })
  await dialog(page).getByRole('combobox', { name: 'Purchase recommendation', exact: true }).selectOption(orderFormRecommendation.id)
  await page.screenshot({ path: '../artifacts/completed-po-pr-link-dialog.png' })
  await dialog(page).getByRole('button', { name: 'Link recommendation', exact: true }).click()
  await expect(dialog(page)).toHaveCount(0)
  await expect(register(page).getByRole('link', { name: orderFormRecommendation.pr_number })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Purchase order details', exact: true }).getByRole('link', { name: orderFormRecommendation.pr_number })).toBeVisible()
  expect(state.linkRequests).toEqual([{ path: `/api/v1/procurement/requisitions/${orderFormRecommendation.id}/link-purchase-order/`, method: 'POST', body: { purchase_order_id: orderFormId } }])
  expect(state.acceptedWrites).toEqual([])
  expect(state.requests.filter(item => ['PATCH', 'PUT'].includes(item.method))).toEqual([])
  for (const field of ['status', 'po_number', 'total_amount', 'currency', 'tax_amount', 'approval_log']) expect(state.record[field]).toEqual(record()[field])
  expect(state.requests.filter(item => item.path.endsWith('/reserve-number/'))).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})

test('completed PO detail offers linkage while commercial edit remains unavailable and cancel sends no mutation', async ({ page }) => {
  const state = await openCompleted(page)
  await page.getByRole('complementary', { name: 'Purchase order details', exact: true }).getByRole('button', { name: `Reconcile purchase recommendation for ${orderFormNumber}` }).click()
  await expect(dialog(page)).toBeVisible()
  await dialog(page).getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(dialog(page)).toHaveCount(0)
  await register(page).getByRole('button', { name: `Actions for ${orderFormNumber}`, exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Edit order', exact: true })).toHaveCount(0)
  expect(state.linkRequests).toEqual([])
  expect(state.acceptedWrites).toEqual([])
})

test('recommendation lookup shows failures and empty results, retries, and searches the server for older records', async ({ page }) => {
  const state = await openCompleted(page)
  state.lookupError = 'Recommendation lookup temporarily unavailable.'
  await register(page).getByRole('button', { name: `Reconcile purchase recommendation for ${orderFormNumber}` }).click()
  await expect(dialog(page).getByRole('alert')).toContainText(state.lookupError)
  await expect(dialog(page).getByRole('button', { name: 'Link recommendation', exact: true })).toBeDisabled()
  state.lookupError = null
  state.searchOnly = true
  await dialog(page).getByRole('button', { name: 'Retry recommendations' }).click()
  await expect(dialog(page)).toContainText('No recommendations found.')
  await dialog(page).getByLabel('Search recommendations', { exact: true }).fill(orderFormRecommendation.pr_number)
  await expect(dialog(page).getByRole('combobox', { name: 'Purchase recommendation', exact: true }).locator('option')).toHaveCount(2)
  expect(state.lookupRequests).toContain(orderFormRecommendation.pr_number)
  await dialog(page).getByRole('combobox', { name: 'Purchase recommendation', exact: true }).selectOption(orderFormRecommendation.id)
  await expect(dialog(page).getByRole('button', { name: 'Link recommendation', exact: true })).toBeEnabled()
  expect(state.linkRequests).toEqual([])
})

test('link conflict preserves the selected recommendation and retries only the link action', async ({ page }) => {
  const state = await openCompleted(page)
  state.linkError = 'This purchase order is already linked to another recommendation.'
  await register(page).getByRole('button', { name: `Reconcile purchase recommendation for ${orderFormNumber}` }).click()
  await dialog(page).getByRole('combobox', { name: 'Purchase recommendation', exact: true }).selectOption(orderFormRecommendation.id)
  await dialog(page).getByRole('button', { name: 'Link recommendation', exact: true }).click()
  await expect(dialog(page).getByRole('alert')).toHaveText(state.linkError)
  await expect(dialog(page).getByRole('combobox', { name: 'Purchase recommendation', exact: true })).toHaveValue(orderFormRecommendation.id)
  expect(state.record.pr_reference).toBeNull()
  state.linkError = null
  await dialog(page).getByRole('button', { name: 'Link recommendation', exact: true }).click()
  await expect(dialog(page)).toHaveCount(0)
  expect(state.linkRequests).toHaveLength(2)
  expect(state.acceptedWrites).toEqual([])
})

test('read-only PO users cannot open the recommendation link action', async ({ page }) => {
  const state = await openCompleted(page, ordersActor(['read']))
  await expect(register(page).getByRole('button', { name: `Reconcile purchase recommendation for ${orderFormNumber}` })).toBeDisabled()
  await expect(page.getByRole('complementary', { name: 'Purchase order details', exact: true }).getByRole('button', { name: `Reconcile purchase recommendation for ${orderFormNumber}` })).toBeDisabled()
  expect(state.lookupRequests).toEqual([])
  expect(state.linkRequests).toEqual([])
})

test('uploaded PO recommendation dropdown uses the PO-authorized lookup and searches without PR register access', async ({ page }) => {
  const documentId = 'pending-po-recommendation-link'
  const state = await orderFormHarness(page, { actor: ordersActor(['read', 'update']), path: '/procurement/orders', prepare: fixture => {
    const document = { id: documentId, original_filename: 'Signed-PO.pdf', confirmed_po: null, created_at: '2026-09-15T08:00:00Z', extraction_status: 'completed', extracted_data: { po_number: orderFormNumber, summary: 'Signed original awaiting linkage', vendor_name: 'Original supplier', currency: 'USD', total_amount: '6489', tax_amount: '0', gross_amount: '6489', po_date: '2026-07-01', reconciliation_required: true } }
    fixture.pendingDocuments = [document]
    fixture.documentRecords[documentId] = document
    fixture.uploadedContent[`/api/v1/procurement/po-documents/${documentId}/content/`] = { body: Buffer.from('%PDF-1.4\n% synthetic original\n%%EOF') }
  } })
  const lookups = [], denied = []
  await page.route(/\/api\/v1\/procurement\/requisitions\/(?:\?.*)?$/, route => { denied.push(route.request().url()); return reply(route, { detail: 'Purchase Recommendations access is not assigned.' }, 403) })
  await page.route('**/api/v1/procurement/orders/available-requisitions/**', route => {
    lookups.push(new URL(route.request().url()).searchParams.get('search') || '')
    return reply(route, [orderFormRecommendation])
  })
  await register(page).getByRole('button', { name: `Reconcile purchase recommendation for ${orderFormNumber}` }).click()
  const editor = page.getByRole('region', { name: 'Edit Signed Purchase Order PDF' })
  await expect(editor).toBeVisible()
  await editor.getByRole('combobox', { name: 'Purchase recommendation', exact: true }).selectOption(orderFormRecommendation.id)
  await editor.getByLabel('Search recommendations', { exact: true }).fill(orderFormRecommendation.pr_number)
  await editor.getByRole('button', { name: 'Search', exact: true }).click()
  await expect.poll(() => lookups).toContain(orderFormRecommendation.pr_number)
  await expect(editor.getByRole('combobox', { name: 'Purchase recommendation', exact: true })).toHaveValue(orderFormRecommendation.id)
  expect(denied).toEqual([])
  expect(state.acceptedWrites).toEqual([])
  expect(state.unknown).toEqual([])
})
