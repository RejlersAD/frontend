import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import process from 'node:process'
import { recommendationPdfImportHarness } from '../fixtures/purchase-recommendation-pdf-import.fixture'

const scanPath = process.env.PR_ACTUAL_SCAN_PATH
const extractionPath = process.env.PR_ACTUAL_EXTRACTION_PATH
const expectedPath = process.env.PR_ACTUAL_EXPECTED_PATH

test.setTimeout(150000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } })

test('reviews the provided PR scan with its extracted values without saving a recommendation', async ({ page }) => {
  test.skip(!scanPath || !extractionPath, 'Set PR_ACTUAL_SCAN_PATH and PR_ACTUAL_EXTRACTION_PATH for the local scan review.')
  const extractionResult = JSON.parse(await readFile(extractionPath, 'utf8'))
  const extracted = extractionResult.fields || extractionResult.extracted_data || extractionResult
  const approvalDetection = extractionResult.approvals || extractionResult.approval_detection || {}
  const expectedResult = expectedPath ? JSON.parse(await readFile(expectedPath, 'utf8')) : {}
  const expected = { ...extracted, ...(expectedResult.fields || expectedResult.extracted_data || expectedResult) }
  const documentSignedOff = Boolean(extractionResult.document_signed_off)
  const state = await recommendationPdfImportHarness(page, { extracted, approvalDetection, documentSignedOff, mappingIssues: extracted.extraction_issues || [] })
  // A local document can share an identifier with a synthetic register row.
  // Keep this source-field review on the new-import path; attachment comparisons
  // are covered separately with existing recommendation fixtures.
  state.props.requisitions = state.props.requisitions.filter(row => row.pr_number !== extracted.pr_number)
  const initialCount = state.props.requisitions.length
  const dialog = page.getByRole('dialog', { name: 'Import Approved PR PDF' })
  const inputFor = label => dialog.getByLabel(new RegExp(`^${label}(?:\\s*\\*)?$`))
  await expect(page.getByRole('heading', { name: 'Purchase Recommendations', exact: true })).toBeVisible({ timeout: 100000 })
  await expect(page.getByRole('complementary', { name: 'Recommendation details' })).toHaveAttribute('aria-busy', 'false')
  await page.getByRole('button', { name: 'More recommendation actions', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Import signed PDF', exact: true }).click()
  await dialog.locator('input[type="file"]').setInputFiles(scanPath)
  await dialog.getByRole('button', { name: 'Preview OCR', exact: true }).click()
  for (const [field, label] of [
    ['pr_number', 'PR Number'], ['issued_by_name', 'Issued By'], ['issued_date', 'Issued Date'],
    ['product_service', 'Product / Service'], ['supplier_name', 'Supplier Name'],
    ['currency', 'Currency'], ['project_number', 'Project Number'], ['po_reference', 'PO Reference'],
    ['special_notes', 'Special Notes'], ['price_remarks', 'Price Remarks / Sales Budget'],
  ]) await expect(inputFor(label)).toHaveValue(String(expected[field] ?? ''))
  for (const [field, label] of [['net_total', 'Entered price'], ['budget_in_aed', 'Budget in AED'], ['net_total_aed', 'Net Total in AED']]) {
    const input = inputFor(label)
    if (expected[field] == null || expected[field] === '') await expect(input).toHaveValue('')
    else expect(Number(await input.inputValue())).toBe(Number(expected[field]))
  }
  await expect(dialog.locator('[data-confidence]')).toHaveCount(0)
  for (const text of ['Source:', 'Text source:', 'Manual review required', 'Approval evidence', 'Approval rows read from the PDF']) {
    await expect(dialog).not.toContainText(text)
  }
  for (const issue of extracted.extraction_issues || []) await expect(dialog).toContainText(issue)
  if (documentSignedOff) {
    await expect(dialog.getByPlaceholder('Search or enter signer')).toHaveCount(0)
    await expect(dialog.getByRole('checkbox', { name: 'Verify signature in PDF', exact: true })).toHaveCount(0)
  } else {
    for (const [role, label] of Object.entries({ pm: 'Project Manager', moe: 'Manager of Engineering', mop: 'Manager of Projects', vp: 'VP Operations' })) {
      await expect(dialog.getByLabel(label, { exact: true })).toHaveValue(approvalDetection.approver_names?.[role] || '')
    }
    const unverified = ['pm', 'moe', 'mop', 'vp'].filter(role => !approvalDetection.signatures?.[role]).length
    await expect(dialog.getByRole('checkbox', { name: 'Verify signature in PDF', exact: true })).toHaveCount(unverified)
  }
  await expect(dialog).not.toContainText('Signature missing')
  await expect(dialog.locator('iframe[title="Approved PR source PDF"]')).toHaveAttribute('src', /^blob:/)
  await page.evaluate(() => document.fonts.ready)
  // Chromium paints the native PDF viewer outside the ordinary page DOM.
  await page.waitForTimeout(5000)
  await page.screenshot({ path: '../artifacts/pr-actual-scan-review.png' })
  await inputFor('Entered price').scrollIntoViewIfNeeded()
  await page.screenshot({ path: '../artifacts/pr-actual-scan-pricing.png' })
  expect(state.previewRequests).toHaveLength(1)
  expect(state.previewRequests[0]).toMatchObject({ preview_only: 'true', file: { filename: basename(scanPath) } })
  expect(state.saveRequests).toEqual([])
  expect(state.props.requisitions).toHaveLength(initialCount)
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(state.saveRequests).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})
