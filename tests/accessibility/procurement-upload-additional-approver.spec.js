import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { recommendationPdfImportHarness as baseImportHarness } from '../fixtures/purchase-recommendation-pdf-import.fixture'
import { pairedImportHarness, syntheticApprovedPdf, syntheticPoPdf } from '../fixtures/purchase-recommendation-paired-import.fixture'
import { recommendationNumber } from '../fixtures/purchase-recommendations.fixture'

test.setTimeout(150000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } })

const emptyReview = { approval_labels: {}, additional_approver: null }
const roleLabels = { pm: 'Project Manager', moe: 'Manager of Engineering', mop: 'Manager of Projects', vp: 'VP Operations' }
const recommendationPdfImportHarness = (page, options = {}) => baseImportHarness(page, {
  approvalDetection: { approver_names: { pm: 'Captured project reviewer', moe: 'Captured engineering reviewer', mop: 'Captured projects reviewer', vp: 'Captured operations reviewer' } },
  ...options,
})
const dialog = page => page.getByRole('dialog', { name: 'Upload PR, PO and Vendor', exact: true })
const approvals = page => dialog(page).getByRole('region', { name: 'Approval & signatories', exact: true })
const additional = page => approvals(page).getByLabel('Additional approver', { exact: true })
const additionalLevel = page => approvals(page).getByLabel('Additional approver level', { exact: true })
const level = (page, role) => approvals(page).getByLabel(`${roleLabels[role]} level`, { exact: true })
const additionalVerify = page => approvals(page).getByRole('checkbox', { name: /^(Verify additional approver signature in PDF|Additional approver signature verified in PDF)$/ })
const save = (page, label = 'Upload PR') => dialog(page).getByRole('button', { name: label, exact: true })
const progress = page => dialog(page).getByRole('list', { name: 'Document review progress' }).getByRole('listitem').filter({ hasText: 'Approval & signatures' })
const clean = state => { expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([]) }
const noWorkflowCommands = state => expect(state.requests.filter(request => /\/(submit|approve|workflow)(\/|$)/.test(request.path) && request.method === 'POST')).toEqual([])

const signed = {
  documentSignedOff: true,
  approvalDetection: {
    signatures: { pm: true, moe: false, mop: true, vp: true },
    approver_names: { pm: 'Captured project director', mop: 'Captured projects manager', vp: 'Captured operations VP' },
    approval_date: '2026-09-15', date_present: true,
    approval_rows: [
      { role_key: 'pm', source_role: 'PD', name: 'Captured project director', signature_detected: true },
      { role_key: 'mop', source_role: 'MoP', name: 'Captured projects manager', signature_detected: true },
      { role_key: 'vp', source_role: 'VP', name: 'Captured operations VP', signature_detected: true },
    ],
  },
}

async function preview(page, { number, paired = false } = {}) {
  await expect(page.getByRole('heading', { name: 'Purchase Recommendations', exact: true })).toBeVisible({ timeout: 100000 })
  await expect(page.getByRole('complementary', { name: 'Recommendation details' })).toHaveAttribute('aria-busy', 'false')
  await page.getByRole('button', { name: number ? `Actions for ${number}` : 'More recommendation actions', exact: true }).click()
  await page.getByRole('menuitem', { name: number ? 'Attach signed PDF' : 'Import signed PDF', exact: true }).click()
  await dialog(page).getByLabel('Select signed or approved PR PDF', { exact: true }).setInputFiles(syntheticApprovedPdf)
  if (paired) await dialog(page).getByLabel('Select signed or approved PO PDF', { exact: true }).setInputFiles(syntheticPoPdf)
  await dialog(page).getByRole('button', { name: 'Preview OCR', exact: true }).click()
  await expect(approvals(page)).toBeVisible()
}

test('the optional Additional row and Level column leave an unchanged PR import payload and evidence intact', async ({ page }) => {
  const state = await recommendationPdfImportHarness(page)
  await preview(page)
  for (const heading of ['Role', 'Level', 'Signer', 'Signature']) await expect(approvals(page).getByText(heading, { exact: true })).toBeVisible()
  for (const role of Object.keys(roleLabels)) {
    await expect(level(page, role)).toHaveValue('')
    await expect(level(page, role)).toHaveAttribute('maxlength', '20')
  }
  await level(page, 'pm').fill('A source label longer than twenty characters')
  await expect(level(page, 'pm')).toHaveValue('A source label longe')
  await level(page, 'pm').fill('')
  await expect(additional(page)).toHaveValue('')
  await expect(additional(page)).toHaveAttribute('maxlength', '200')
  await expect(additional(page)).not.toHaveAttribute('required', '')
  await expect(additionalVerify(page)).not.toBeChecked()
  await expect(additionalVerify(page)).toBeDisabled()
  await expect(approvals(page).getByRole('checkbox', { name: 'Verify signature in PDF', exact: true })).toHaveCount(4)
  await save(page).click()
  await expect(dialog(page)).toContainText('Status: draft')
  expect(state.saveRequests).toHaveLength(1)
  expect(state.saveRequests[0]).not.toHaveProperty('source_approval_review')
  expect(state.saveRequests[0]).not.toHaveProperty('expected_source_approval_review')
  expect(JSON.parse(state.saveRequests[0].manual_signature_overrides)).toEqual({})
  noWorkflowCommands(state)
  clean(state)
})

test('Additional requires its source name, keeps explicit verification separate, and retains labels through a rejected save and retry', async ({ page }) => {
  const state = await recommendationPdfImportHarness(page)
  await preview(page)
  await level(page, 'pm').fill('L1 reviewer')
  await additionalLevel(page).fill('L5 reviewer')
  await expect(additionalVerify(page)).toBeDisabled()
  await save(page).click()
  await expect(dialog(page).getByRole('alert')).toContainText(/additional approver.*name|name.*additional approver/i)
  expect(state.saveRequests).toEqual([])
  await expect(additionalLevel(page)).toHaveValue('L5 reviewer')
  await additional(page).fill('Additional source reviewer')
  await additionalVerify(page).check()
  await additional(page).fill('Corrected source reviewer')
  await expect(additionalVerify(page)).not.toBeChecked()
  await additionalVerify(page).check()
  await expect(progress(page)).toContainText('pending review')
  state.saveError = { status: 409, body: { error: 'The source approval review changed. Your annotations are retained.' } }
  await save(page).click()
  await expect(dialog(page).getByRole('alert')).toContainText('Your annotations are retained.')
  await expect(additional(page)).toHaveValue('Corrected source reviewer')
  await expect(additionalVerify(page)).toBeChecked()
  await expect(level(page, 'pm')).toHaveValue('L1 reviewer')
  expect(state.sourceApprovalReview).toEqual(emptyReview)
  const expected = { approval_labels: { pm: 'L1 reviewer' }, additional_approver: { name: 'Corrected source reviewer', approval_label: 'L5 reviewer', signature_verified: true } }
  expect(JSON.parse(state.saveRequests[0].source_approval_review)).toEqual(expected)
  expect(JSON.parse(state.saveRequests[0].expected_source_approval_review)).toEqual(emptyReview)
  expect(JSON.parse(state.saveRequests[0].manual_signature_overrides)).toEqual({})
  state.saveError = null
  await save(page).click()
  await expect(dialog(page)).toContainText('Status: draft')
  expect(state.saveRequests).toHaveLength(2)
  expect(state.saveRequests[1]).toEqual(state.saveRequests[0])
  await dialog(page).getByRole('button', { name: 'Close', exact: true }).click()
  await preview(page)
  await expect(additional(page)).toHaveValue('Corrected source reviewer')
  await expect(additionalLevel(page)).toHaveValue('L5 reviewer')
  await expect(level(page, 'pm')).toHaveValue('L1 reviewer')
  await expect(additionalVerify(page)).toBeChecked()
  await expect(progress(page)).toContainText('pending review')
  noWorkflowCommands(state)
  clean(state)
})

test('an unacknowledged source review retains edits and the original snapshot for a safe retry', async ({ page }) => {
  // The first save is accepted but its acknowledgement is corrupted. Repeating it
  // preserves the draft; the fixture must not infer approval from record existence.
  const state = await recommendationPdfImportHarness(page, { savedStatus: 'draft' })
  await preview(page)
  await additional(page).fill('Reviewer awaiting acknowledgement')
  await level(page, 'vp').fill('Final review')
  state.sourceApprovalReviewResponse = emptyReview
  await save(page).click()
  await expect(dialog(page).getByRole('alert')).toContainText(/source approval review|additional approver|approval review/i)
  await expect(additional(page)).toHaveValue('Reviewer awaiting acknowledgement')
  await expect(additionalVerify(page)).not.toBeChecked()
  await expect(level(page, 'vp')).toHaveValue('Final review')
  await expect(save(page)).toBeEnabled()
  expect(state.saveRequests).toHaveLength(1)
  expect(JSON.parse(state.saveRequests[0].expected_source_approval_review)).toEqual(emptyReview)
  state.sourceApprovalReviewResponse = undefined
  await save(page).click()
  await expect(dialog(page)).toContainText('Status: draft')
  expect(state.saveRequests).toHaveLength(2)
  expect(state.saveRequests[1]).toEqual(state.saveRequests[0])
  clean(state)
})

test('signed-off attachments round-trip editable annotations while preserving captured signers, saved PR values and workflow', async ({ page }) => {
  const number = recommendationNumber(6)
  const originalReview = { approval_labels: { pm: 'L1', mop: 'L3', vp: 'L4' }, additional_approver: { name: 'Stored source reviewer', approval_label: 'L5', signature_verified: false } }
  const state = await recommendationPdfImportHarness(page, { ...signed, extracted: { pr_number: number }, sourceApprovalReview: originalReview })
  const before = structuredClone(state.props.requisitions.find(record => record.pr_number === number))
  await preview(page, { number })
  for (const [role, label] of Object.entries(roleLabels)) {
    await expect(approvals(page).getByLabel(label, { exact: true })).toHaveJSProperty('readOnly', true)
    await expect(level(page, role)).toBeEditable()
  }
  await expect(additional(page)).toHaveValue('Stored source reviewer')
  await expect(additional(page)).toBeEditable()
  await expect(approvals(page).getByRole('checkbox', { name: 'Verify signature in PDF', exact: true })).toHaveCount(0)
  await expect(progress(page)).toContainText('complete')
  await additional(page).fill('Updated optional source reviewer')
  await approvals(page).getByLabel('Additional approver special note', { exact: true }).fill('Corrected spelling against the source PDF.')
  await level(page, 'pm').fill('Director review')
  await save(page, 'Attach signed PDF').click()
  await expect(dialog(page)).toContainText('Existing recommendation values were kept.')
  const request = state.saveRequests[0]
  expect(request).toMatchObject({ attach_only: 'true', expected_pr_number: number, manual_overrides: '{}' })
  expect(JSON.parse(request.expected_source_approval_review)).toEqual(originalReview)
  expect(JSON.parse(request.source_approval_review)).toEqual({ approval_labels: { pm: 'Director review', mop: 'L3', vp: 'L4' }, additional_approver: { name: 'Updated optional source reviewer', approval_label: 'L5', signature_verified: false, special_note: 'Corrected spelling against the source PDF.' } })
  for (const field of ['pm_name', 'moe_name', 'mop_name', 'vp_name', 'manual_signature_overrides']) expect(request).not.toHaveProperty(field)
  expect(state.props.requisitions.find(record => record.id === before.id)).toMatchObject({ product_service: before.product_service, total_price: before.total_price, status: before.status, approval_workflow_config: before.approval_workflow_config })
  await dialog(page).getByRole('button', { name: 'Close', exact: true }).click()
  await preview(page, { number })
  await expect(additional(page)).toHaveValue('Updated optional source reviewer')
  await expect(level(page, 'pm')).toHaveValue('Director review')
  await expect(additionalVerify(page)).not.toBeChecked()
  await save(page, 'Attach signed PDF').click()
  await expect(dialog(page)).toContainText('Existing recommendation values were kept.')
  expect(state.saveRequests).toHaveLength(2)
  expect(state.saveRequests[1]).not.toHaveProperty('source_approval_review')
  expect(state.saveRequests[1]).not.toHaveProperty('expected_source_approval_review')
  await dialog(page).getByRole('button', { name: 'Close', exact: true }).click()
  await preview(page, { number })
  const storedReview = structuredClone(state.sourceApprovalReview)
  await approvals(page).getByRole('button', { name: 'Clear additional approver', exact: true }).click()
  await expect(additional(page)).toHaveValue('')
  await expect(additionalLevel(page)).toHaveValue('')
  await expect(additionalVerify(page)).toBeDisabled()
  await save(page, 'Attach signed PDF').click()
  await expect(dialog(page)).toContainText('Existing recommendation values were kept.')
  expect(state.saveRequests).toHaveLength(3)
  expect(JSON.parse(state.saveRequests[2].source_approval_review)).toEqual({ approval_labels: storedReview.approval_labels, additional_approver: null })
  expect(JSON.parse(state.saveRequests[2].expected_source_approval_review)).toEqual(storedReview)
  noWorkflowCommands(state)
  clean(state)
})

test('paired import saves PR annotations independently of PO signature, stamp and one-request retry', async ({ page }) => {
  const state = await pairedImportHarness(page)
  await preview(page, { paired: true })
  await additional(page).fill('PR-only additional source signer')
  await additionalLevel(page).fill('L5 PR')
  await additionalVerify(page).check()
  await level(page, 'moe').fill('L2 engineering')
  await approvals(page).getByLabel('Manager of Engineering special note', { exact: true }).fill('Engineering review level confirmed from PDF.')
  await expect(dialog(page).getByLabel('PO approval signature is visible', { exact: true })).not.toBeChecked()
  await expect(dialog(page).getByLabel('PO company stamp is visible', { exact: true })).not.toBeChecked()
  await dialog(page).getByLabel('PO company stamp is visible', { exact: true }).check()
  state.pairError = { status: 409, body: { error: 'The paired source review changed. Nothing was saved.' } }
  await save(page, 'Upload PR and PO').click()
  await expect(dialog(page).getByRole('alert')).toContainText('Nothing was saved.')
  await expect(additionalVerify(page)).toBeChecked()
  await expect(level(page, 'moe')).toHaveValue('L2 engineering')
  expect(state.pairWrites).toEqual([])
  state.pairError = null
  await save(page, 'Upload PR and PO').click()
  await expect(dialog(page)).toContainText('Both source PDFs are attached.')
  expect(state.pairWrites).toHaveLength(1)
  expect(state.pairSaves).toHaveLength(2)
  expect(state.pairSaves[1]).toEqual(state.pairSaves[0])
  const request = state.pairSaves[1]
  expect(JSON.parse(request.source_approval_review)).toEqual({ approval_labels: { moe: 'L2 engineering' }, approver_notes: { moe: 'Engineering review level confirmed from PDF.' }, additional_approver: { name: 'PR-only additional source signer', approval_label: 'L5 PR', signature_verified: true } })
  expect(JSON.parse(request.expected_source_approval_review)).toEqual(emptyReview)
  expect(request).toMatchObject({ po_signature_verified: 'false', po_stamp_verified: 'true', po_approved_by_name: 'PO Approver Only' })
  expect(JSON.parse(request.po_reviewed_fields)).not.toHaveProperty('source_approval_review')
  expect(request).not.toHaveProperty('manual_signature_overrides')
  noWorkflowCommands(state)
  clean(state)
})

test('Level and Additional controls remain accessible inside the resizable main window on desktop and mobile', async ({ page }, testInfo) => {
  const state = await recommendationPdfImportHarness(page, signed)
  await expect(page.getByRole('heading', { name: 'Purchase Recommendations', exact: true })).toBeVisible({ timeout: 100000 })
  const sidebar = page.locator('#application-sidebar')
  const sidebarBefore = await sidebar.evaluate(element => ({ width: element.getBoundingClientRect().width, x: element.getBoundingClientRect().x, background: getComputedStyle(element).backgroundColor }))
  await preview(page)
  await expect(dialog(page).getByRole('img', { name: 'Approved PR source PDF, page 1 of 1', exact: true })).toBeVisible({ timeout: 30000 })
  await additional(page).fill('Optional reviewer retained across widths')
  await additionalLevel(page).fill('L5 optional')
  await level(page, 'pm').fill('L1 source')
  const handle = dialog(page).getByRole('separator', { name: 'Resize upload window from right', exact: true })
  await handle.press('End')
  await approvals(page).scrollIntoViewIfNeeded()
  const levelBounds = await level(page, 'pm').boundingBox()
  const signerBounds = await approvals(page).getByLabel('Project Manager', { exact: true }).boundingBox()
  expect(levelBounds.x + levelBounds.width).toBeLessThanOrEqual(signerBounds.x)
  expect(Math.abs(levelBounds.y - signerBounds.y)).toBeLessThanOrEqual(2)
  const sidebarAfter = await sidebar.evaluate(element => ({ width: element.getBoundingClientRect().width, x: element.getBoundingClientRect().x, background: getComputedStyle(element).backgroundColor }))
  expect(sidebarAfter).toEqual(sidebarBefore)
  await page.screenshot({ path: testInfo.outputPath('additional-approver-desktop.png') })
  await handle.press('Home')
  await additional(page).scrollIntoViewIfNeeded()
  await expect(additional(page)).toHaveValue('Optional reviewer retained across widths')
  expect(await dialog(page).locator('.procurement-import-review__surface').evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
  await page.setViewportSize({ width: 390, height: 844 })
  await additional(page).scrollIntoViewIfNeeded()
  await expect(additional(page)).toBeInViewport()
  await expect(additionalLevel(page)).toHaveValue('L5 optional')
  await expect(dialog(page).getByRole('separator')).toHaveCount(0)
  expect(await dialog(page).locator('.procurement-import-review__surface').evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
  const input = await additional(page).boundingBox()
  const footer = await dialog(page).locator('.procurement-import-review__footer').boundingBox()
  expect(input.y + input.height).toBeLessThanOrEqual(footer.y + 1)
  await page.screenshot({ path: testInfo.outputPath('additional-approver-mobile.png') })
  const scan = await new AxeBuilder({ page }).include('.procurement-import-review').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(scan.violations).toEqual([])
  expect(state.previewRequests).toHaveLength(1)
  expect(state.saveRequests).toEqual([])
  clean(state)
})
