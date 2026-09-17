import { test, expect } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import {
  recommendationPdfImportHarness, syntheticApprovedPdf, missingImportNumber, existingImportNumber,
} from '../fixtures/purchase-recommendation-pdf-import.fixture'

test.setTimeout(150000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } })

const dialog = page => page.getByRole('dialog', { name: 'Upload PR, PO and Vendor' })
const digest = async path => createHash('sha256').update(await readFile(path)).digest('hex')
const clean = state => { expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([]) }
const loaded = async page => {
  await expect(page.getByRole('heading', { name: 'Purchase Recommendations', exact: true })).toBeVisible({ timeout: 100000 })
  await expect(page.getByRole('complementary', { name: 'Recommendation details' })).toHaveAttribute('aria-busy', 'false')
}
async function openPreview(page) {
  await page.getByRole('button', { name: 'More recommendation actions', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Import signed PDF', exact: true }).click()
  await expect(dialog(page)).toBeVisible()
  await dialog(page).getByLabel('Select signed or approved PR PDF', { exact: true }).setInputFiles(syntheticApprovedPdf)
  await expect(dialog(page)).toContainText(syntheticApprovedPdf.name)
  await dialog(page).getByRole('button', { name: 'Preview OCR', exact: true }).click()
  await expect(dialog(page).getByLabel('PR Number', { exact: false })).toBeVisible()
}

test('imports appear only under More and cancelling an OCR preview creates no recommendation', async ({ page }) => {
  const sidebarFiles = ['src/components/Layout/Sidebar.jsx', 'src/components/Layout/Sidebar.css']
  const before = await Promise.all(sidebarFiles.map(digest))
  const state = await recommendationPdfImportHarness(page)
  await loaded(page)
  await expect(page.locator('.prr-import-actions')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Import signed PDF', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Import Excel', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'More recommendation actions', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Import signed PDF', exact: true })).toHaveCount(1)
  await expect(page.getByRole('menuitem', { name: 'Import Excel', exact: true })).toHaveCount(1)
  await page.keyboard.press('Escape')
  const initialCount = state.props.requisitions.length
  await openPreview(page)
  expect(state.previewRequests).toHaveLength(1)
  expect(state.previewRequests[0]).toMatchObject({ preview_only: 'true', file: { filename: syntheticApprovedPdf.name } })
  expect(state.previewRequests[0]).not.toHaveProperty('create_new')
  expect(state.saveRequests).toEqual([])
  expect(state.props.requisitions).toHaveLength(initialCount)
  await dialog(page).getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(dialog(page)).toHaveCount(0)
  expect(state.saveRequests).toEqual([])
  expect(await Promise.all(sidebarFiles.map(digest))).toEqual(before)
  clean(state)
})

test('a missing recommendation can be explicitly created from reviewed PDF data and refreshes the register', async ({ page }) => {
  const state = await recommendationPdfImportHarness(page)
  await loaded(page)
  const initialCount = state.props.requisitions.length
  await openPreview(page)
  await expect(dialog(page)).toContainText(`${missingImportNumber} is not in RADAI`)
  const createButton = dialog(page).getByRole('button', { name: 'Create reviewed PR', exact: true })
  await expect(createButton).toBeEnabled()
  await dialog(page).getByLabel('Product / Service', { exact: false }).fill('Reviewed synthetic pump package')
  state.deferSave = true
  await createButton.click()
  await expect.poll(() => state.saveRequests.length).toBe(1)
  await expect(dialog(page).getByRole('button', { name: 'Validating and saving...', exact: true })).toBeDisabled()
  expect(state.saveRequests[0]).toMatchObject({ create_new: 'true', file: { filename: syntheticApprovedPdf.name } })
  expect(state.saveRequests[0]).not.toHaveProperty('preview_only')
  expect(state.saveRequests[0]).not.toHaveProperty('expected_pr_number')
  expect(JSON.parse(state.saveRequests[0].manual_overrides)).toMatchObject({ pr_number: missingImportNumber, product_service: 'Reviewed synthetic pump package' })
  state.savePending()
  await expect(dialog(page)).toContainText('created from the reviewed PDF')
  await expect(dialog(page)).toContainText('Status: draft')
  expect(state.props.requisitions).toHaveLength(initialCount + 1)
  await dialog(page).getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByRole('button', { name: `Select ${missingImportNumber}`, exact: true })).toBeVisible()
  clean(state)
})

test('a matching recommendation attaches the PDF without overwriting register values or adding another record', async ({ page }) => {
  const state = await recommendationPdfImportHarness(page, { existing: true })
  await loaded(page)
  const initialCount = state.props.requisitions.length
  await openPreview(page)
  await expect(dialog(page)).toContainText(`${existingImportNumber} exists in RADAI`)
  await expect(dialog(page).getByRole('button', { name: 'Create reviewed PR', exact: true })).toHaveCount(0)
  await dialog(page).getByRole('button', { name: 'Attach signed PDF', exact: true }).click()
  await expect(dialog(page)).toContainText('has the signed PDF attached')
  expect(state.saveRequests).toHaveLength(1)
  expect(state.saveRequests[0]).not.toHaveProperty('create_new')
  expect(state.saveRequests[0]).toMatchObject({ attach_only: 'true', expected_pr_number: existingImportNumber }); expect(JSON.parse(state.saveRequests[0].manual_overrides)).toEqual({})
  expect(state.props.requisitions).toHaveLength(initialCount)
  clean(state)
})

test('corrected PR numbers are checked before saving and a rejected save preserves the review and source PDF for retry', async ({ page }) => {
  const correctedNumber = 'RAD-PRJ-PR-9012_2026'
  const state = await recommendationPdfImportHarness(page)
  await loaded(page)
  await openPreview(page)
  const pdfUrl = await dialog(page).locator('iframe[title="Approved PR source PDF"]').getAttribute('src')
  await dialog(page).getByLabel('PR Number', { exact: false }).fill(correctedNumber)
  await expect(dialog(page)).toContainText('Check the corrected PR number')
  await expect(dialog(page).getByRole('button', { name: 'Save Reviewed PR', exact: true })).toBeDisabled()
  await dialog(page).getByRole('button', { name: 'Check PR number', exact: true }).click()
  await expect(dialog(page)).toContainText('Create a recommendation from this PDF')
  expect(state.numberChecks).toEqual([{ pr_number: correctedNumber }])
  state.saveError = { status: 409, body: { error: 'The recommendation changed while this PDF was being reviewed. Check the PR number and retry.' } }
  await dialog(page).getByRole('button', { name: 'Create reviewed PR', exact: true }).click()
  await expect(dialog(page).getByRole('alert')).toContainText('The recommendation changed')
  await expect(dialog(page).getByLabel('PR Number', { exact: false })).toHaveValue(correctedNumber)
  await expect(dialog(page).locator('iframe[title="Approved PR source PDF"]')).toHaveAttribute('src', pdfUrl)
  await expect(dialog(page).getByRole('button', { name: 'Create reviewed PR', exact: true })).toBeEnabled()
  expect(state.saveRequests[0].create_new).toBe('true')
  state.saveError = null
  await dialog(page).getByRole('button', { name: 'Create reviewed PR', exact: true }).click()
  await expect(dialog(page)).toContainText('created from the reviewed PDF')
  expect(state.saveRequests).toHaveLength(2)
  expect(state.saveRequests[1].file).toEqual({ filename: syntheticApprovedPdf.name })
  clean(state)
})
