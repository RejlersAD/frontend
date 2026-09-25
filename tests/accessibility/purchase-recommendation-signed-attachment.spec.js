import { test, expect } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { recommendationPdfImportHarness, syntheticApprovedPdf, existingImportNumber, missingImportNumber } from '../fixtures/purchase-recommendation-pdf-import.fixture'
import { syntheticApprovedPdf as readableApprovedPdf } from '../fixtures/purchase-recommendation-paired-import.fixture'
import { recommendationNumber } from '../fixtures/purchase-recommendations.fixture'

test.setTimeout(150000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } })
const modal = page => page.getByRole('dialog', { name: 'Upload PR, PO and Vendor' })
const approvals = page => modal(page).getByRole('region', { name: 'Approval & signatories', exact: true })
const canonicalChecks = page => approvals(page).getByRole('checkbox', { name: /^(Verify signature in PDF|Signature verified in PDF)$/ })
const roleLabels = { pm: 'Project Manager', moe: 'Manager of Engineering', mop: 'Manager of Projects', vp: 'VP Operations' }
const clean = state => { expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([]) }
const signed = {
  documentSignedOff: true,
  approvalDetection: {
    signatures: { pm: true, mop: true, vp: true, moe: false }, approval_date: '', date_present: true,
    approver_names: { pm: 'Source Project Director', mop: 'Source Projects Manager', vp: 'Source Operations VP' },
    approval_date_evidence: { review_required: true },
    approval_rows: [
      { source_role: 'PD', role_key: 'pm', name: 'Source Project Director', signature_detected: true },
      { source_role: 'MoP', role_key: 'mop', name: 'Source Projects Manager', signature_detected: true },
      { source_role: 'VP', role_key: 'vp', name: 'Source Operations VP', signature_detected: true },
    ],
  },
}
const orders = [{ id: '00000000-0000-4000-8000-000000000901', po_number: 'RAD-PRJ-PUR-0002_JAN2026', supplier_name: 'Atlas Industrial Supplies' }]
const unmatched = { status: 'not_found', manual_link_required: true, message: 'No matching purchase order was found.' }
const loaded = async page => {
  await expect(page.getByRole('heading', { name: 'Purchase Recommendations', exact: true })).toBeVisible({ timeout: 100000 })
  await expect(page.getByRole('complementary', { name: 'Recommendation details' })).toHaveAttribute('aria-busy', 'false')
}
async function preview(page, number, pdf = syntheticApprovedPdf, action = 'Preview OCR') {
  await loaded(page)
  await page.getByRole('button', { name: number ? `Actions for ${number}` : 'More recommendation actions', exact: true }).click()
  await page.getByRole('menuitem', { name: number ? 'Attach signed PDF' : 'Import signed PDF', exact: true }).click()
  await modal(page).getByLabel('Select signed or approved PR PDF', { exact: true }).setInputFiles(pdf)
  await expect(modal(page).getByLabel('Product / Service', { exact: true })).toHaveCount(0)
  await modal(page).getByRole('button', { name: action, exact: true }).click()
  await expect(modal(page).getByLabel('PR Number', { exact: true })).toBeVisible()
}

test('three signed source roles remain visible without requiring a fourth signature and an unreadable date stays editable', async ({ page }) => {
  const state = await recommendationPdfImportHarness(page, { ...signed, poLink: { status: 'linked', po_id: orders[0].id, po_number: orders[0].po_number, manual_link_required: false } })
  await preview(page)
  await expect(approvals(page)).toBeVisible()
  for (const [role, label] of Object.entries(roleLabels)) {
    const signer = approvals(page).getByLabel(label, { exact: true })
    await expect(signer).toHaveValue(signed.approvalDetection.approver_names[role] || '')
    await expect(signer).toHaveJSProperty('readOnly', true)
  }
  await expect(approvals(page).getByText('Detected', { exact: true })).toHaveCount(3)
  await expect(approvals(page).getByLabel('Manager of Engineering', { exact: true }).locator('..')).toContainText('Not on document')
  await expect(canonicalChecks(page)).toHaveCount(0)
  await expect(modal(page)).toContainText('Enter the approval date shown in the PDF.')
  await expect(modal(page).getByRole('button', { name: 'Upload PR', exact: true })).toBeEnabled()
  await modal(page).getByLabel('PR Approval date', { exact: true }).fill('2026-01-20')
  await expect(modal(page)).not.toContainText('Enter the approval date shown in the PDF.')
  await modal(page).getByRole('button', { name: 'Upload PR', exact: true }).click()
  await expect(modal(page)).toContainText('Status: approved')
  await expect(modal(page)).not.toContainText('Signature verification required')
  await expect(modal(page).getByRole('link', { name: 'Open purchase order' })).toHaveAttribute('href', `/procurement/orders/${orders[0].id}`)
  expect(state.saveRequests[0].approval_date).toBe('2026-01-20')
  for (const key of ['pm_name', 'moe_name', 'mop_name', 'vp_name', 'manual_signature_overrides']) expect(state.saveRequests[0]).not.toHaveProperty(key)
  expect(state.requests.filter(request => /submit|approve|workflow/.test(request.path) && request.method === 'POST')).toEqual([])
  clean(state)
})

test('signed-off three-role approval with a captured date remains visible when attaching to an existing recommendation', async ({ page }, testInfo) => {
  const number = recommendationNumber(6)
  const approvalDetection = {
    ...signed.approvalDetection,
    approval_date: '2026-01-20', date_ocr: ['20 / 01 / 2026'], approval_date_evidence: { review_required: false },
    approver_names: { pm: 'Captured Project Director', vp: 'Captured Operations VP' },
    approval_rows: [
      { source_role: 'PD', role_key: 'pm', name: 'Captured Project Director', signature_detected: true },
      { source_role: 'MoP', role_key: 'mop', name: 'Captured Projects Manager', signature_detected: true },
      { source_role: 'VP', role_key: 'vp', name: 'Captured Operations VP', signature_detected: true },
      { source_role: 'PM', role_key: 'pm', name: 'Second captured project reviewer', signature_detected: true, remarks: 'Second explicitly captured source row' },
    ],
  }
  const state = await recommendationPdfImportHarness(page, { ...signed, extracted: { pr_number: number }, approvalDetection })
  const previous = structuredClone(state.props.requisitions.find(record => record.pr_number === number))
  await preview(page, number, { ...syntheticApprovedPdf, buffer: readableApprovedPdf.buffer })
  await expect(modal(page).getByRole('img', { name: 'Approved PR source PDF, page 1 of 1', exact: true })).toBeVisible({ timeout: 30000 })
  await expect(approvals(page)).toBeVisible()
  for (const [role, value] of Object.entries({ pm: 'Captured Project Director; Second captured project reviewer', moe: '', mop: 'Captured Projects Manager', vp: 'Captured Operations VP' })) {
    const signer = approvals(page).getByLabel(roleLabels[role], { exact: true })
    await expect(signer).toHaveValue(value)
    await expect(signer).toHaveJSProperty('readOnly', true)
  }
  for (const role of ['pm', 'mop', 'vp']) await expect(approvals(page).getByLabel(roleLabels[role], { exact: true }).locator('..')).toContainText('Detected')
  await expect(approvals(page).getByLabel('Manager of Engineering', { exact: true }).locator('..')).toContainText('Not on document')
  await expect(approvals(page).getByLabel('Project Manager', { exact: true }).locator('..')).toContainText('PD')
  await expect(canonicalChecks(page)).toHaveCount(0)
  for (const sourceText of ['Second captured project reviewer', 'Second explicitly captured source row']) await expect(approvals(page)).toContainText(sourceText)
  await expect(approvals(page)).toContainText('Captured date text: 20 / 01 / 2026')
  await expect(approvals(page).getByLabel('Additional approver', { exact: true })).toHaveValue('')
  await expect(approvals(page).getByRole('checkbox', { name: 'Verify additional approver signature in PDF', exact: true })).not.toBeChecked()
  const date = approvals(page).getByLabel('PR Approval date', { exact: true })
  await expect(date).toHaveValue('2026-01-20')
  await expect(date).toBeEditable()
  await approvals(page).scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('signed-approval-three-roles.png') })
  await date.fill('2026-01-23')
  await modal(page).getByRole('button', { name: 'Attach signed PDF', exact: true }).click()
  await expect(modal(page)).toContainText('Existing recommendation values were kept.')
  expect(state.saveRequests).toHaveLength(1)
  expect(state.saveRequests[0]).toMatchObject({ attach_only: 'true', expected_pr_number: number, manual_overrides: '{}', approval_date: '2026-01-23' })
  for (const key of ['pm_name', 'moe_name', 'mop_name', 'vp_name', 'manual_signature_overrides']) expect(state.saveRequests[0]).not.toHaveProperty(key)
  expect(state.props.requisitions.find(record => record.id === previous.id)).toMatchObject({ product_service: previous.product_service, total_price: previous.total_price, status: previous.status })
  expect(state.requests.filter(request => /submit|approve|workflow/.test(request.path) && request.method === 'POST')).toEqual([])
  clean(state)
})

test('signed-off four-role approval remains visible without inventing an unreadable signer name or new confirmations', async ({ page }) => {
  const approvalDetection = {
    signatures: { pm: true, moe: true, mop: true, vp: true },
    approver_names: { pm: 'Captured Project Manager', moe: 'Captured Engineering Manager', mop: 'Captured Projects Manager' },
    approval_rows: [], table_detected: true, all_four_signatures: true,
    approval_date: '2026-01-21', date_present: true, approval_date_evidence: { review_required: false },
  }
  const state = await recommendationPdfImportHarness(page, { documentSignedOff: true, approvalDetection })
  await preview(page)
  await expect(approvals(page)).toBeVisible()
  for (const [role, label] of Object.entries(roleLabels)) {
    const signer = approvals(page).getByLabel(label, { exact: true })
    await expect(signer).toHaveValue(approvalDetection.approver_names[role] || '')
    await expect(signer).toHaveJSProperty('readOnly', true)
  }
  await expect(approvals(page).getByText('Detected', { exact: true })).toHaveCount(4)
  await expect(canonicalChecks(page)).toHaveCount(0)
  await expect(approvals(page).getByLabel('Additional approver', { exact: true })).toHaveValue('')
  await expect(approvals(page).getByRole('checkbox', { name: 'Verify additional approver signature in PDF', exact: true })).not.toBeChecked()
  await expect(approvals(page).getByLabel('PR Approval date', { exact: true })).toHaveValue('2026-01-21')
  await expect(approvals(page).getByLabel('PR Approval date', { exact: true })).toBeEditable()
  await modal(page).getByRole('button', { name: 'Upload PR', exact: true }).click()
  await expect(modal(page)).toContainText('Status: approved')
  expect(state.saveRequests).toHaveLength(1)
  for (const key of ['pm_name', 'moe_name', 'mop_name', 'vp_name', 'manual_signature_overrides']) expect(state.saveRequests[0]).not.toHaveProperty(key)
  clean(state)
})

test('unsigned signer review keeps manual evidence explicit and preserves signer edits after a rejected save', async ({ page }) => {
  const approvalDetection = {
    signatures: { pm: false, moe: false, mop: false, vp: false },
    approver_names: { pm: 'Initial captured reviewer' }, approval_date: '',
  }
  const state = await recommendationPdfImportHarness(page, {
    approvalDetection,
    savedApprovalDetection: { ...approvalDetection, signatures: { ...approvalDetection.signatures, pm: true } },
  })
  await preview(page, undefined, { ...syntheticApprovedPdf, buffer: readableApprovedPdf.buffer })
  await expect(modal(page).getByRole('img', { name: 'Approved PR source PDF, page 1 of 1', exact: true })).toBeVisible({ timeout: 30000 })
  const signer = approvals(page).getByLabel('Project Manager', { exact: true })
  await expect(signer).toBeEditable()
  await expect(approvals(page).getByRole('checkbox', { name: 'Verify signature in PDF', exact: true })).toHaveCount(4)
  await signer.fill('Reviewed source signer')
  await signer.locator('..').getByRole('checkbox', { name: 'Verify signature in PDF', exact: true }).check()
  const date = approvals(page).getByLabel('PR Approval date', { exact: true })
  await date.fill('2026-01-22')
  state.saveError = { status: 409, body: { error: 'The source review changed. Your signer review is retained.' } }
  await modal(page).getByRole('button', { name: 'Upload PR', exact: true }).click()
  await expect(modal(page).getByRole('alert')).toContainText('Your signer review is retained.')
  await expect(signer).toHaveValue('Reviewed source signer')
  await expect(date).toHaveValue('2026-01-22')
  await expect(approvals(page).getByRole('checkbox', { name: 'Signature verified in PDF', exact: true })).toBeChecked()
  expect(JSON.parse(state.saveRequests[0].manual_signature_overrides)).toEqual({ pm: true })
  expect(state.saveRequests[0]).toMatchObject({ pm_name: 'Reviewed source signer', approval_date: '2026-01-22' })
  state.saveError = null
  await modal(page).getByRole('button', { name: 'Upload PR', exact: true }).click()
  await expect(modal(page)).toContainText('Status: draft')
  expect(state.saveRequests).toHaveLength(2)
  expect(state.saveRequests[1]).toEqual(state.saveRequests[0])
  clean(state)
})

test('an unsigned duplicate source role requires explicit verification despite a detected canonical summary', async ({ page }) => {
  const state = await recommendationPdfImportHarness(page, { approvalDetection: {
    signatures: { pm: true, moe: false, mop: false, vp: false },
    approver_names: { pm: 'First source project director' }, approval_date: '',
    approval_rows: [
      { source_role: 'PD', role_key: 'pm', name: 'First source project director', signature_detected: true },
      { source_role: 'PM', role_key: 'pm', name: 'Second source project manager', signature_detected: false },
    ],
  } })
  const initialCount = state.props.requisitions.length
  await preview(page, undefined, { ...syntheticApprovedPdf, buffer: readableApprovedPdf.buffer })
  await expect(modal(page).getByRole('img', { name: 'Approved PR source PDF, page 1 of 1', exact: true })).toBeVisible({ timeout: 30000 })
  const signer = approvals(page).getByLabel('Project Manager', { exact: true })
  await expect(signer).toHaveValue('First source project director; Second source project manager')
  await expect(signer).toHaveJSProperty('readOnly', true)
  await expect(signer.locator('..')).toContainText('Signature not detected')
  await expect(signer.locator('..').getByText('Detected', { exact: true })).toHaveCount(0)
  const verify = signer.locator('..').getByRole('checkbox', { name: 'Verify signature in PDF', exact: true })
  await expect(verify).not.toBeChecked()
  await expect(canonicalChecks(page)).toHaveCount(1)
  const progress = modal(page).getByRole('list', { name: 'Document review progress' }).getByRole('listitem').filter({ hasText: 'Approval & signatures' })
  await approvals(page).getByLabel('PR Approval date', { exact: true }).fill('2026-01-24')
  await expect(progress).toContainText('Approval & signatures: pending review')
  await verify.check()
  await expect(progress).toContainText('Approval & signatures: complete')
  state.saveError = { status: 409, body: { error: 'The source review changed. Check the current record before retrying.' } }
  await modal(page).getByRole('button', { name: 'Upload PR', exact: true }).click()
  await expect(modal(page).getByRole('alert')).toContainText('Check the current record before retrying.')
  expect(state.saveRequests).toHaveLength(1)
  expect(JSON.parse(state.saveRequests[0].manual_signature_overrides)).toEqual({ pm: true })
  // The full source list is visible; the canonical name sent to the existing command stays unchanged.
  expect(state.saveRequests[0]).toMatchObject({ pm_name: 'First source project director', approval_date: '2026-01-24' })
  expect(state.props.requisitions).toHaveLength(initialCount)
  await expect(signer).toHaveValue('First source project director; Second source project manager')
  await expect(approvals(page).getByRole('checkbox', { name: 'Signature verified in PDF', exact: true })).toBeChecked()
  clean(state)
})

test('a converted recommendation opens directly on complete read-only OCR fields and attaches without changing saved values', async ({ page }, testInfo) => {
  const number = recommendationNumber(6)
  const extracted = {
    pr_number: number, issued_by_name: 'Source PDF Issuer', issued_date: '2026-02-04',
    product_service: 'OCR-only synthetic instrument package', supplier_name: 'Source PDF Supplier',
    supplier_business_id: 'SOURCE-LICENSE-001', project_department: 'Source engineering department', project_number: 'SOURCE-PRJ-007',
    description_reason: 'Source document justification for two instrument packages.', preferred_supplier: 'Source preferred supplier',
    net_total: '225608.00', currency: 'USD', price_remarks: 'Source quoted commercial basis',
    budget_in_aed: '850000.00', net_total_aed: '828973.38', po_reference: 'SOURCE-PO-001', special_notes: 'Source document release notes',
    price_lines: [
      { description: 'Source instrument package one', total: '125608.00', currency: 'USD', remarks: 'First source line' },
      { description: 'Source instrument package two', total: '100000.00', currency: 'USD', remarks: 'Second source line' },
    ],
  }
  const state = await recommendationPdfImportHarness(page, { ...signed, extracted, documentComparison: {
    identity_matched: true, has_mismatches: true, fields: [
      { field: 'net_total', label: 'Total Price', current_value: '22500.00', pdf_value: '225608.00', status: 'mismatch' },
      { field: 'currency', label: 'Currency', current_value: 'USD', pdf_value: 'USD', status: 'matched' },
      { field: 'special_notes', label: 'Special Notes', current_value: '', pdf_value: '', status: 'missing', missing_in: 'both' },
    ],
  } })
  const initial = structuredClone(state.props.requisitions.find(row => row.pr_number === number))
  await preview(page, number, { ...syntheticApprovedPdf, buffer: readableApprovedPdf.buffer }, 'Extract PDF data')
  expect(state.previewRequests).toHaveLength(1)
  await expect(modal(page).getByRole('img', { name: 'Approved PR source PDF, page 1 of 1', exact: true })).toBeVisible({ timeout: 30000 })
  for (const heading of ['PR information', 'Financial information', 'Description and price breakdown', 'Document identity']) {
    await expect(modal(page).getByRole('heading', { name: heading, exact: true })).toBeVisible()
  }
  const fields = [
    ['PR Number', 'pr_number'], ['Issued By', 'issued_by_name'], ['Issued Date', 'issued_date'],
    ['Product / Service', 'product_service'], ['Supplier Name', 'supplier_name'], ['Supplier Business ID', 'supplier_business_id'],
    ['Project / Department', 'project_department'], ['Project Number', 'project_number'], ['Description and Reason', 'description_reason'],
    ['Preferred Supplier', 'preferred_supplier'], ['Entered price', 'net_total'], ['Price Remarks / Sales Budget', 'price_remarks'],
    ['Budget in AED', 'budget_in_aed'], ['Net Total in AED', 'net_total_aed'], ['PO Reference', 'po_reference'], ['Special Notes', 'special_notes'],
  ]
  for (const [label, key] of fields) {
    const control = modal(page).getByLabel(label, { exact: true })
    await expect(control).toHaveValue(extracted[key])
    await expect(control).toHaveJSProperty('readOnly', true)
  }
  const currency = modal(page).getByLabel('Currency', { exact: true })
  await expect(currency).toHaveValue('USD')
  expect(await currency.evaluate(control => control.disabled || control.readOnly)).toBe(true)
  for (const [index, line] of extracted.price_lines.entries()) {
    for (const [label, key] of [['description', 'description'], ['amount', 'total'], ['remarks', 'remarks']]) {
      const control = modal(page).getByLabel(`Price line ${index + 1} ${label}`, { exact: true })
      await expect(control).toHaveValue(line[key])
      await expect(control).toHaveJSProperty('readOnly', true)
    }
    const lineCurrency = modal(page).getByLabel(`Price line ${index + 1} currency`, { exact: true })
    await expect(lineCurrency).toHaveValue(line.currency)
    expect(await lineCurrency.evaluate(control => control.disabled || control.readOnly)).toBe(true)
  }
  await expect(modal(page).getByRole('button', { name: 'Add line', exact: true })).toHaveCount(0)
  await expect(modal(page).getByRole('button', { name: /^Remove price line / })).toHaveCount(0)
  await expect(modal(page).getByLabel('VAT price basis', { exact: true })).toHaveCount(0)
  expect(extracted.product_service).not.toBe(initial.product_service)
  expect(extracted.net_total).not.toBe(initial.total_price)
  const comparison = modal(page).getByRole('region', { name: 'Differences between recommendation and PDF' })
  await expect(comparison).toHaveCount(0)
  await expect(modal(page).getByRole('heading', { name: 'Purchase recommendation details', exact: true })).toHaveCount(0)
  await expect(modal(page).getByText('Existing recommendation values will be kept.', { exact: false })).toHaveCount(0)
  await expect(modal(page).getByText('Extracted PDF data is shown below for review.', { exact: false })).toHaveCount(0)
  await expect(modal(page).getByLabel('PR Number', { exact: true })).toHaveAttribute('readonly', '')
  await modal(page).getByLabel('PR Approval date', { exact: true }).fill('2026-02-05')
  await modal(page).locator('.procurement-import-review__form').evaluate(element => { element.scrollTop = 0 })
  await page.screenshot({ path: testInfo.outputPath('existing-pr-ocr-review.png') })
  await modal(page).getByRole('button', { name: 'Attach signed PDF', exact: true }).click()
  await expect(modal(page)).toContainText('Existing recommendation values were kept.')
  await expect(modal(page)).toContainText('Status: converted')
  expect(state.previewRequests[0]).toMatchObject({ expected_pr_number: number, attach_only: 'true' })
  expect(state.saveRequests[0]).toMatchObject({ expected_pr_number: number, attach_only: 'true', manual_overrides: '{}', approval_date: '2026-02-05' })
  expect(state.saveRequests[0]).not.toHaveProperty('create_new')
  const retainedFields = Object.fromEntries(Object.entries(initial).filter(([key]) => key !== 'attachments'))
  expect(state.props.requisitions.find(row => row.pr_number === number)).toMatchObject(retainedFields)
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
  await modal(page).getByRole('button', { name: 'Upload PR', exact: true }).click()
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
