import { test, expect } from '@playwright/test'
import {
  recommendationPdfImportHarness, syntheticApprovedPdf, missingImportNumber,
} from '../fixtures/purchase-recommendation-pdf-import.fixture'

test.setTimeout(150000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } })

const modal = page => page.getByRole('dialog', { name: 'Upload PR, PO and Vendor' })
const field = (page, label) => modal(page).getByLabel(new RegExp(`^${label}`))
const labelFor = (page, label) => field(page, label).locator('..')
const clean = state => { expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([]) }

// Synthetic extraction-shaped data: no business PDF, OCR service or live API
// is involved. The amount and sales-budget remark deliberately use USD.
const extraction = overrides => ({
  pr_number: missingImportNumber, issued_by_name: 'Maya Hassan', issued_date: '2026-01-15',
  product_service: 'Telecom integration consultancy', supplier_name: 'Atlas Industrial Supplies',
  supplier_business_id: 'SYNTHETIC-225', project_department: '5901056 - EPC telecom integration',
  project_number: '5901056', description_reason: 'Telecom integration consultancy for the approved EPC scope.',
  preferred_supplier: 'Atlas Industrial Supplies', net_total: '225608.00', currency: 'USD',
  budget_in_aed: '', net_total_aed: '', po_reference: 'RAD-PRJ-PUR-0002_JAN2026',
  special_notes: 'Reimbursement by the client against approved supporting invoices.',
  price_remarks: 'Sales Budget USD 225,608.00', extraction_method: 'native',
  price_lines: [{ description: 'Telecom integration consultancy', total: '225608.00', currency: 'USD', remarks: 'Sales Budget USD 225,608.00' }],
  field_confidence: {
    pr_number: 'high', issued_by: 'medium', issued_date: 'high', product_service: 'high',
    supplier: 'conflict', supplier_business_id: 'manual', project_number: 'medium',
    description: 'high', price: 'derived', currency: 'high', price_remarks: 'high',
    budget_in_aed: 'missing', net_total_aed: 'missing', po_reference: 'high', special_notes: 'high',
  },
  field_provenance: {
    issued_by: { source: 'labeled_document_text', evidence: 'Issued by: Maya Hassan', text_method: 'native' },
    supplier: { source: 'labeled_document_text', evidence: 'Supplier text needs review against the signed PDF.', text_method: 'native' },
    price: { source: 'sum_of_price_rows', evidence: 'Telecom integration consultancy USD 225,608.00', text_method: 'native' },
    currency: { source: 'price_rows', evidence: 'USD 225,608.00', text_method: 'native' },
    project_number: { source: 'service_project_reference', evidence: 'Telecom integration services for project 5901056', text_method: 'native' },
    price_remarks: { source: 'price_row_remarks', evidence: 'Sales Budget USD 225,608.00', text_method: 'native' },
  },
  ...(overrides || {}),
})

const approvalDetection = {
  signatures: { pm: false, moe: false, mop: false, vp: false },
  approver_names: { pm: 'Maya Hassan' }, approval_date: '',
  approval_rows: [
    { source_role: 'PM', role_key: 'pm', raw_name: '5901056 | Maya Hassan', name: 'Maya Hassan', signature_detected: false, remarks: 'Source row requires signature review' },
    { source_role: 'VP', role_key: 'vp', raw_name: 'Samir Ali', name: 'Samir Ali', signature_detected: false },
  ],
}

async function preview(page, overrides) {
  const state = await recommendationPdfImportHarness(page, { extracted: extraction(overrides), approvalDetection })
  await expect(page.getByRole('heading', { name: 'Purchase Recommendations', exact: true })).toBeVisible({ timeout: 100000 })
  await expect(page.getByRole('complementary', { name: 'Recommendation details' })).toHaveAttribute('aria-busy', 'false')
  await page.getByRole('button', { name: 'More recommendation actions', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Import signed PDF', exact: true }).click()
  await modal(page).getByLabel('Select signed or approved PR PDF', { exact: true }).setInputFiles(syntheticApprovedPdf)
  await modal(page).getByRole('button', { name: 'Preview OCR', exact: true }).click()
  await expect(field(page, 'PR Number')).toHaveValue(missingImportNumber)
  expect(state.previewRequests).toHaveLength(1)
  expect(state.saveRequests).toEqual([])
  return state
}

async function save(page, state) {
  await modal(page).getByRole('button', { name: 'Create reviewed PR', exact: true }).click()
  await expect(modal(page)).toContainText('created from the reviewed PDF')
  expect(state.saveRequests).toHaveLength(1)
  expect(state.saveRequests[0].create_new).toBe('true')
  expect(JSON.parse(state.saveRequests[0].manual_signature_overrides)).toEqual({})
  await expect(modal(page)).toContainText('Status: draft')
  clean(state)
  return JSON.parse(state.saveRequests[0].manual_overrides)
}

test('shows business values and genuine conflicts without extraction details or optional-field warnings', async ({ page }) => {
  const state = await preview(page)
  await expect(field(page, 'Entered price')).toHaveValue('225608.00')
  await expect(field(page, 'Currency')).toHaveValue('USD')
  await expect(field(page, 'Project Number')).toHaveValue('5901056')
  await expect(field(page, 'PO Reference')).toHaveValue('RAD-PRJ-PUR-0002_JAN2026')
  await expect(field(page, 'Special Notes')).toHaveValue(/Reimbursement by the client/)
  await expect(field(page, 'Price Remarks / Sales Budget')).toHaveValue('Sales Budget USD 225,608.00')
  await expect(field(page, 'Budget in AED')).toHaveValue('')
  await expect(field(page, 'Net Total in AED')).toHaveValue('')
  await expect(modal(page).locator('[data-confidence]')).toHaveCount(0)
  for (const message of ['Source:', 'Text source:', 'Manual review required', 'Extraction ready for review', 'No AED equivalent was read from the PDF', 'Approval evidence', 'Approval rows read from the PDF', 'Signature detected automatically']) {
    await expect(modal(page)).not.toContainText(message)
  }
  await expect(field(page, 'Supplier Name')).toHaveAttribute('aria-invalid', 'true')
  await expect(labelFor(page, 'Supplier Name')).toContainText('Conflicting values. Check this field against the PDF.')
  for (const label of ['Issued By', 'Project Number', 'Entered price', 'Budget in AED', 'Net Total in AED', 'Supplier Business ID']) {
    await expect(field(page, label)).toHaveAttribute('aria-invalid', 'false')
    await expect(field(page, label)).not.toHaveClass(/bg-(?:amber|red)-/)
    await expect(labelFor(page, label)).not.toContainText(/Enter |Conflicting values/)
  }
  await expect(modal(page).getByRole('heading', { name: 'Price breakdown', exact: true })).toBeVisible()
  await expect(modal(page).getByRole('textbox', { name: 'Price line 1 description', exact: true })).toHaveValue('Telecom integration consultancy')
  await expect(modal(page).getByRole('spinbutton', { name: 'Price line 1 amount', exact: true })).toHaveValue('225608.00')
  await expect(modal(page).getByRole('textbox', { name: 'Price line 1 remarks', exact: true })).toHaveValue('Sales Budget USD 225,608.00')
  await expect(field(page, 'Project Manager')).toHaveValue('Maya Hassan')
  await expect(field(page, 'Approval Date')).toBeVisible()
  await expect(modal(page).getByRole('checkbox', { name: 'Verify signature in PDF', exact: true })).toHaveCount(4)
  await expect(modal(page)).not.toContainText('Source row requires signature review')
  expect(state.saveRequests).toEqual([])
  await field(page, 'Entered price').scrollIntoViewIfNeeded()
  await modal(page).screenshot({ path: '../artifacts/purchase-recommendation-extraction-quality.png' })
  await modal(page).getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(state.saveRequests).toEqual([])
  clean(state)
})

test('reviewed price remarks remain editable and are included in the import payload without review metadata', async ({ page }) => {
  const state = await preview(page)
  const revisedRemarks = 'Sales Budget USD 225,608.00; client reimbursement confirmed.'
  await field(page, 'Price Remarks / Sales Budget').fill(revisedRemarks)
  await expect(labelFor(page, 'Price Remarks / Sales Budget').locator('[data-confidence]')).toHaveCount(0)
  await expect(labelFor(page, 'Price Remarks / Sales Budget')).not.toContainText('Source:')
  await expect(field(page, 'Price Remarks / Sales Budget')).toHaveAttribute('aria-invalid', 'false')
  await field(page, 'Supplier Name').fill('Verified Atlas Industrial Supplies')
  await expect(field(page, 'Supplier Name')).toHaveAttribute('aria-invalid', 'false')
  await expect(labelFor(page, 'Supplier Name')).not.toContainText('Conflicting values')
  const payload = await save(page, state)
  expect(payload).toMatchObject({
    net_total: '225608.00', currency: 'USD', project_number: '5901056',
    po_reference: 'RAD-PRJ-PUR-0002_JAN2026', special_notes: extraction().special_notes,
    price_remarks: revisedRemarks, budget_in_aed: '', net_total_aed: '',
  })
  expect(payload.price_lines).toEqual(extraction().price_lines)
})

test('reviewing multiple price rows preserves each description, amount and remark in the submitted USD breakdown', async ({ page }) => {
  const original = [
    { description: 'Engineering scope', total: '150000.00', currency: 'USD', remarks: 'Original engineering quote' },
    { description: 'Site support', total: '75608.00', currency: 'USD', remarks: 'Site support quotation' },
  ]
  const state = await preview(page, { price_lines: original })
  await modal(page).getByRole('spinbutton', { name: 'Price line 2 amount', exact: true }).fill('75610.00')
  await modal(page).getByRole('textbox', { name: 'Price line 2 remarks', exact: true }).fill('Corrected against the signed site quotation')
  await field(page, 'Entered price').fill('225610.00')
  const payload = await save(page, state)
  expect(payload.net_total).toBe('225610.00')
  expect(payload.currency).toBe('USD')
  expect(payload.net_total_aed).toBe('')
  expect(payload.price_lines).toEqual([
    original[0],
    { ...original[1], total: '75610.00', remarks: 'Corrected against the signed site quotation' },
  ])
})

test('missing total and currency show only actionable errors and clear when corrected', async ({ page }) => {
  const state = await preview(page, { net_total: '', currency: '', special_notes: '' })
  await expect(field(page, 'Entered price')).toHaveAttribute('aria-invalid', 'true')
  await expect(labelFor(page, 'Entered price')).toContainText('Enter entered price.')
  await expect(field(page, 'Currency')).toHaveAttribute('aria-invalid', 'true')
  await expect(labelFor(page, 'Currency')).toContainText('Enter currency.')
  await expect(field(page, 'Special Notes')).toHaveAttribute('aria-invalid', 'false')
  await expect(labelFor(page, 'Special Notes')).not.toContainText('Enter')
  await field(page, 'Entered price').fill('225610.00')
  await field(page, 'Currency').selectOption('USD')
  await expect(field(page, 'Entered price')).toHaveAttribute('aria-invalid', 'false')
  await expect(field(page, 'Currency')).toHaveAttribute('aria-invalid', 'false')
  const payload = await save(page, state)
  expect(payload.net_total).toBe('225610.00')
  expect(payload.currency).toBe('USD')
  expect(payload.price_lines).toEqual(extraction().price_lines)
  expect(payload.net_total_aed).toBe('')
})
