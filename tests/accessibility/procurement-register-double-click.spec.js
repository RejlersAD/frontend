import { test, expect } from '@playwright/test'
import { recommendationHarness } from '../fixtures/purchase-recommendations.fixture'
import { orderFormHarness, orderFormId, orderFormNumber } from '../fixtures/purchase-order-form.fixture'
import { mixedSizePdf } from '../fixtures/mixed-size-pdf.fixture'

test.setTimeout(90000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } })
const clean = state => { expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([]) }
const selectedRow = (page, name, number) => page.getByRole('region', { name, exact: true }).getByRole('row').filter({ has: page.getByRole('button', { name: `Select ${number}`, exact: true }) })

test('recommendation row double-click opens its approval record while number buttons and bulk checkboxes only select', async ({ page }) => {
  const state = await recommendationHarness(page, { realApp: true })
  const record = state.props.requisitions[1], other = state.props.requisitions[0]
  const row = selectedRow(page, 'Recommendation register', record.pr_number)
  await row.getByRole('button', { name: `Select ${record.pr_number}`, exact: true }).dblclick()
  await expect(page).toHaveURL(/\/procurement\/requisitions$/)
  await expect(page.getByRole('complementary', { name: 'Recommendation details' }).getByRole('heading', { name: record.pr_number, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Recommendation register options', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Select records', exact: true }).click()
  await row.getByRole('checkbox', { name: `Select for bulk ${record.pr_number}`, exact: true }).dblclick()
  await expect(page).toHaveURL(/\/procurement\/requisitions$/)
  await expect(row.getByRole('checkbox')).not.toBeChecked()
  const otherRow = selectedRow(page, 'Recommendation register', other.pr_number)
  await otherRow.getByText(other.product_service, { exact: true }).click()
  await expect(otherRow).toHaveClass(/prw-selected-row/)
  await expect(page).toHaveURL(/\/procurement\/requisitions$/)
  await row.getByText(record.product_service, { exact: true }).dblclick()
  await expect(page).toHaveURL(new RegExp(`/procurement/requisitions/${record.id}$`))
  await expect(page.getByRole('heading', { name: record.pr_number, level: 1, exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Approval history', exact: true })).toBeVisible()
  expect(state.requests.filter(request => request.method !== 'GET' && !request.path.includes('/ai-champion/'))).toEqual([])
  clean(state)
})

test('purchase order row double-click opens the clicked saved PO and ignores its selection button', async ({ page }) => {
  const other = { id: '00000000-0000-4000-8000-000000009099', po_number: 'RAD-PRJ-PUR-9099_SEP2026', title: 'Different selected purchase order', status: 'draft', currency: 'AED', total_amount: '50', items: [], created_at: '2026-09-14T08:00:00Z' }
  const state = await orderFormHarness(page, { path: '/procurement/orders', prepare: fixture => {
    fixture.record = { id: orderFormId, po_number: orderFormNumber, title: 'Completed order double-click preview', status: 'completed', currency: 'AED', total_amount: '1000', items: [], approval_log: [], created_at: '2026-09-15T08:00:00Z' }
    fixture.orders = [fixture.record, other]
  } })
  await page.route(`**/api/v1/procurement/orders/${other.id}/`, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(other) }))
  const row = selectedRow(page, 'Purchase order register', orderFormNumber)
  await row.getByRole('button', { name: `Select ${orderFormNumber}`, exact: true }).dblclick()
  await expect(page).toHaveURL(/\/procurement\/orders$/)
  const otherRow = selectedRow(page, 'Purchase order register', other.po_number)
  await otherRow.getByText(other.title, { exact: true }).click()
  await expect(otherRow).toHaveClass(/prw-selected-row/)
  await expect(page).toHaveURL(/\/procurement\/orders$/)
  await row.getByText(state.record.title, { exact: true }).dblclick()
  await expect(page).toHaveURL(new RegExp(`/procurement/orders/${orderFormId}$`))
  await expect(page.getByRole('heading', { name: orderFormNumber, level: 1, exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: `Purchase Order ${orderFormNumber} PDF preview`, exact: true }).getByRole('img')).toBeVisible({ timeout: 30000 })
  expect(state.acceptedWrites).toEqual([])
  clean(state)
})

test('pending uploaded PO row double-click opens its saved PDF viewer through the existing Preview action', async ({ page }) => {
  const id = 'pending-po-double-click'
  const state = await orderFormHarness(page, { path: '/procurement/orders', prepare: fixture => {
    const document = { id, original_filename: 'Pending-source.pdf', confirmed_po: null, created_at: '2026-09-15T08:00:00Z', extraction_status: 'completed', extracted_data: { po_number: orderFormNumber, summary: 'Pending signed source double-click', vendor_name: 'Original supplier', currency: 'USD', total_amount: '6489', tax_amount: '0', gross_amount: '6489', po_date: '2026-07-01', reconciliation_required: true } }
    fixture.pendingDocuments = [document]
    fixture.documentRecords[id] = document
    fixture.uploadedContent[`/api/v1/procurement/po-documents/${id}/content/`] = { body: mixedSizePdf(1) }
  } })
  await selectedRow(page, 'Purchase order register', orderFormNumber).getByText('Pending signed source double-click', { exact: true }).dblclick()
  const dialog = page.getByRole('dialog', { name: 'Signed Purchase Order PDF', exact: true })
  await expect(dialog.getByRole('region', { name: 'Signed purchase order PDF preview', exact: true }).getByRole('img')).toBeVisible({ timeout: 30000 })
  await expect(dialog).toContainText(orderFormNumber)
  await expect(dialog.getByRole('button', { name: 'Save changes', exact: true })).toHaveCount(0)
  await expect(page).toHaveURL(/\/procurement\/orders$/)
  expect(state.acceptedWrites).toEqual([])
  clean(state)
})
