import { test, expect } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { orderFormHarness, orderFormId, orderFormNumber, orderFormRecommendation } from '../fixtures/purchase-order-form.fixture'

test.setTimeout(90000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } })
const editor = page => page.getByRole('region', { name: 'Edit Signed Purchase Order PDF', exact: true })
const lookups = state => state.requests.filter(request => request.path.endsWith('/available-requisitions/')
  || (request.path.endsWith('/vendors/') && request.query.page_size === '50'))
const source = Buffer.from('%PDF-1.4\n% synthetic saved document\n%%EOF')

async function openSaved(page, { origin = false, linked = false } = {}) {
  const id = 'saved-upload-optimization'
  const state = await orderFormHarness(page, { path: '/procurement/orders', prepare: fixture => {
    const document = { id, original_filename: 'Saved source.pdf', confirmed_po: null,
      created_at: '2026-09-15T08:00:00Z', extraction_status: 'completed', extracted_data: {
        po_number: orderFormNumber, summary: 'Saved source description', vendor_name: 'Original supplier',
        currency: 'USD', total_amount: '6489', tax_amount: '0', gross_amount: '6489', po_date: '2026-07-01',
        ...(origin ? { originating_pr_id: orderFormRecommendation.id, pr_id: orderFormRecommendation.id, pr_number: orderFormRecommendation.pr_number } : {}),
      } }
    fixture.pendingDocuments = [document]
    fixture.documentRecords[id] = document
    fixture.uploadedContent[`/api/v1/procurement/po-documents/${id}/content/`] = { body: source }
  } })
  let resolveMetadata
  const metadata = new Promise(resolve => { resolveMetadata = resolve })
  let metadataRequested = false
  await page.route(`**/api/v1/procurement/po-documents/${id}/`, async route => {
    metadataRequested = true
    await metadata
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      ...state.documentRecords[id], confirmed_po: linked ? orderFormId : null,
    }) })
  })
  await page.getByRole('button', { name: `Actions for ${orderFormNumber}`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Edit uploaded PDF', exact: true }).click()
  await expect(editor(page)).toBeVisible()
  await expect.poll(() => metadataRequested).toBe(true)
  // Exceed the supplier-search debounce while the source metadata is unavailable.
  await page.waitForTimeout(350)
  expect(lookups(state)).toEqual([])
  resolveMetadata()
  await expect(editor(page).getByRole('textbox', { name: 'Description', exact: true })).toHaveValue('Saved source description')
  return state
}

test('a saved PR-originated PO loads only its visible supplier selector after metadata arrives', async ({ page }) => {
  const state = await openSaved(page, { origin: true })
  await expect(editor(page).getByRole('combobox', { name: 'Purchase recommendation', exact: true })).toBeDisabled()
  await expect(editor(page).getByRole('combobox', { name: 'Matched supplier', exact: true })).toBeEnabled()
  await expect.poll(() => lookups(state).length).toBe(1)
  expect(lookups(state)[0].path).toBe('/api/v1/procurement/vendors/')
  await expect(editor(page).getByRole('button', { name: 'Save PO', exact: true })).toBeEnabled()
  expect(state.acceptedWrites).toEqual([])
  expect(state.requests.filter(request => /\/(preview_signed_pdf|import_signed_pdf)\/$/.test(request.path))).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})

test('a saved document already linked to an order does not load its hidden supplier selector', async ({ page }) => {
  // Model a stale register row whose document was linked before opening it.
  const state = await openSaved(page, { linked: true })
  await expect(editor(page).getByRole('combobox', { name: 'Purchase recommendation', exact: true })).toBeEnabled()
  await expect(editor(page).getByRole('combobox', { name: 'Matched supplier', exact: true })).toHaveCount(0)
  await expect(editor(page).getByRole('button', { name: 'Save changes', exact: true })).toBeEnabled()
  await page.waitForTimeout(350)
  expect(lookups(state).map(request => request.path)).toEqual(['/api/v1/procurement/orders/available-requisitions/'])
  expect(state.acceptedWrites).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})
