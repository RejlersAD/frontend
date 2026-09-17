import { test, expect } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { recommendationPdfImportHarness, syntheticApprovedPdf, existingImportNumber, missingImportNumber } from '../fixtures/purchase-recommendation-pdf-import.fixture'
import { recommendationNumber } from '../fixtures/purchase-recommendations.fixture'

test.setTimeout(150000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } })
const modal = page => page.getByRole('dialog', { name: 'Upload PR, PO and Vendor' })
const clean = state => { expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([]) }
const signed = {
  documentSignedOff: true,
  approvalDetection: {
    signatures: { pm: true, mop: true, vp: true, moe: false }, approval_date: '', date_present: true,
    approval_date_evidence: { review_required: true },
    approval_rows: [{ role_key: 'pm' }, { role_key: 'mop' }, { role_key: 'vp' }],
  },
}
const orders = [{ id: '00000000-0000-4000-8000-000000000901', po_number: 'RAD-PRJ-PUR-0002_JAN2026', supplier_name: 'Atlas Industrial Supplies' }]
const unmatched = { status: 'not_found', manual_link_required: true, message: 'No matching purchase order was found.' }
const loaded = async page => {
  await expect(page.getByRole('heading', { name: 'Purchase Recommendations', exact: true })).toBeVisible({ timeout: 100000 })
  await expect(page.getByRole('complementary', { name: 'Recommendation details' })).toHaveAttribute('aria-busy', 'false')
}
async function preview(page, number) {
  await loaded(page)
  await page.getByRole('button', { name: number ? `Actions for ${number}` : 'More recommendation actions', exact: true }).click()
  await page.getByRole('menuitem', { name: number ? 'Attach signed PDF' : 'Import signed PDF', exact: true }).click()
  await modal(page).getByLabel('Select signed or approved PR PDF', { exact: true }).setInputFiles(syntheticApprovedPdf)
  await modal(page).getByRole('button', { name: 'Preview OCR', exact: true }).click()
  await expect(modal(page).getByLabel('PR Number', { exact: true })).toBeVisible()
}

test('three signed source roles require no fourth role or new approval and an unreadable date remains editable', async ({ page }) => {
  const state = await recommendationPdfImportHarness(page, { ...signed, poLink: { status: 'linked', po_id: orders[0].id, po_number: orders[0].po_number, manual_link_required: false } })
  await preview(page)
  await expect(modal(page).getByLabel('Manager of Engineering')).toHaveCount(0)
  await expect(modal(page).getByPlaceholder('Search or enter signer')).toHaveCount(0)
  await expect(modal(page).getByRole('checkbox')).toHaveCount(0)
  await expect(modal(page)).toContainText('Enter the approval date shown in the PDF.')
  await expect(modal(page).getByRole('button', { name: 'Create reviewed PR', exact: true })).toBeEnabled()
  await modal(page).getByLabel('Approval Date', { exact: true }).fill('2026-01-20')
  await expect(modal(page)).not.toContainText('Enter the approval date shown in the PDF.')
  await modal(page).getByRole('button', { name: 'Create reviewed PR', exact: true }).click()
  await expect(modal(page)).toContainText('Status: approved')
  await expect(modal(page)).not.toContainText('Signature verification required')
  await expect(modal(page).getByRole('link', { name: 'Open purchase order' })).toHaveAttribute('href', `/procurement/orders/${orders[0].id}`)
  expect(state.saveRequests[0].approval_date).toBe('2026-01-20')
  for (const key of ['pm_name', 'moe_name', 'mop_name', 'vp_name', 'manual_signature_overrides']) expect(state.saveRequests[0]).not.toHaveProperty(key)
  expect(state.requests.filter(request => /submit|approve|workflow/.test(request.path) && request.method === 'POST')).toEqual([])
  clean(state)
})

test('a converted recommendation accepts a bound signed PDF and displays only meaningful differences', async ({ page }) => {
  const number = recommendationNumber(6)
  const state = await recommendationPdfImportHarness(page, { ...signed, extracted: { pr_number: number, net_total: '225608.00', currency: 'USD' }, documentComparison: {
    identity_matched: true, has_mismatches: true, fields: [
      { field: 'net_total', label: 'Total Price', current_value: '22500.00', pdf_value: '225608.00', status: 'mismatch' },
      { field: 'currency', label: 'Currency', current_value: 'USD', pdf_value: 'USD', status: 'matched' },
      { field: 'special_notes', label: 'Special Notes', current_value: '', pdf_value: '', status: 'missing', missing_in: 'both' },
    ],
  } })
  const initial = { ...state.props.requisitions.find(row => row.pr_number === number) }
  await preview(page, number)
  const comparison = modal(page).getByRole('region', { name: 'Differences between recommendation and PDF' })
  await expect(comparison).toContainText('22500.00')
  await expect(comparison).toContainText('225608.00')
  await expect(comparison).not.toContainText('Currency')
  await expect(comparison).not.toContainText('Special Notes')
  await expect(modal(page).getByLabel('PR Number', { exact: true })).toHaveAttribute('readonly', '')
  await expect(modal(page).getByLabel('Total Price', { exact: true })).toHaveCount(0)
  await modal(page).getByRole('button', { name: 'Attach signed PDF', exact: true }).click()
  await expect(modal(page)).toContainText('Existing recommendation values were kept.')
  await expect(modal(page)).toContainText('Status: converted')
  expect(state.previewRequests[0]).toMatchObject({ expected_pr_number: number, attach_only: 'true' })
  expect(state.saveRequests[0]).toMatchObject({ expected_pr_number: number, attach_only: 'true', manual_overrides: '{}' })
  expect(state.props.requisitions.find(row => row.pr_number === number)).toMatchObject({ total_price: initial.total_price, product_service: initial.product_service })
  clean(state)
})

test('the actual extracted PDF identity cannot be edited to attach to another recommendation', async ({ page }) => {
  const state = await recommendationPdfImportHarness(page, { ...signed, documentComparison: { identity_matched: false, fields: [] } })
  await preview(page, existingImportNumber)
  await expect(modal(page)).toContainText('PR number does not match this recommendation')
  await expect(modal(page).getByLabel('PR Number', { exact: true })).toHaveValue(missingImportNumber)
  await expect(modal(page).getByLabel('PR Number', { exact: true })).toHaveAttribute('readonly', '')
  await expect(modal(page).getByRole('button', { name: 'Check PR number' })).toHaveCount(0)
  await expect(modal(page).getByRole('button', { name: 'Attach signed PDF', exact: true })).toBeDisabled()
  expect(state.saveRequests).toEqual([])
  clean(state)
})

test('upload prompts manual PO linking, preserves a conflict error and permits retry without uploading twice', async ({ page }) => {
  const state = await recommendationPdfImportHarness(page, { ...signed, poLink: unmatched, poOptions: orders })
  await preview(page)
  await modal(page).getByRole('button', { name: 'Create reviewed PR', exact: true }).click()
  const linking = modal(page).getByRole('region', { name: 'Link an existing purchase order' })
  await expect(linking).toBeVisible()
  await expect(linking.getByRole('button', { name: 'Link purchase order', exact: true })).toBeDisabled()
  await linking.getByRole('combobox', { name: 'Purchase order', exact: true }).click()
  await linking.getByRole('option', { name: new RegExp(orders[0].po_number) }).click()
  state.linkError = 'This purchase order is already linked to another recommendation.'
  await linking.getByRole('button', { name: 'Link purchase order', exact: true }).click()
  await expect(linking.getByRole('alert')).toContainText(state.linkError)
  state.linkError = null
  await linking.getByRole('button', { name: 'Link purchase order', exact: true }).click()
  await expect(modal(page).getByRole('link', { name: 'Open purchase order' })).toBeVisible()
  expect(state.linkRequests).toEqual([{ purchase_order_id: orders[0].id }, { purchase_order_id: orders[0].id }])
  expect(state.saveRequests).toHaveLength(1)
  clean(state)
})

test('Excel import completion offers PO linking and a PDF attachment bound to the imported record', async ({ page }) => {
  const state = await recommendationPdfImportHarness(page, { ...signed, existing: true, poOptions: orders })
  const record = state.props.requisitions.find(row => row.pr_number === existingImportNumber)
  let calls = 0
  await page.route('**/api/v1/procurement/requisitions/import-excel/', route => {
    calls += 1
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ dry_run: calls === 1, ready_rows: 1, total_rows: 1, created_count: calls === 1 ? 0 : 1, rows: [], created: calls === 1 ? [] : [{ id: record.id, pr_number: record.pr_number, po_link: unmatched }] }) })
  })
  await loaded(page)
  await page.getByRole('button', { name: 'More recommendation actions', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Import Excel', exact: true }).click()
  await page.locator('input[type="file"][accept*=".xlsx"]').setInputFiles({ name: 'synthetic-register.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('Synthetic workbook, upload API is mocked') })
  await page.getByRole('button', { name: 'Preview Import', exact: true }).click()
  await page.getByRole('button', { name: 'Import 1 Draft PRs', exact: true }).click()
  const imported = page.getByRole('region', { name: `Imported ${record.pr_number}` })
  await expect(imported.getByRole('region', { name: 'Link an existing purchase order' })).toHaveCount(0)
  await imported.getByRole('button', { name: 'Link purchase order', exact: true }).click()
  await expect(imported.getByRole('region', { name: 'Link an existing purchase order' })).toBeVisible()
  await imported.getByRole('button', { name: 'Attach signed PDF', exact: true }).click()
  await expect(modal(page)).toContainText(record.pr_number)
  await modal(page).getByLabel('Select signed or approved PR PDF', { exact: true }).setInputFiles(syntheticApprovedPdf)
  await modal(page).getByRole('button', { name: 'Preview OCR', exact: true }).click()
  await expect(modal(page).getByRole('button', { name: 'Attach signed PDF', exact: true })).toBeEnabled()
  expect(state.previewRequests[0]).toMatchObject({ expected_pr_number: record.pr_number, attach_only: 'true' })
  clean(state)
})
