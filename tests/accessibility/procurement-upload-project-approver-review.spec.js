import { test, expect } from '@playwright/test'
import { recommendationPdfImportHarness } from '../fixtures/purchase-recommendation-pdf-import.fixture'
import { syntheticApprovedPdf } from '../fixtures/purchase-recommendation-paired-import.fixture'
import { recommendationNumber } from '../fixtures/purchase-recommendations.fixture'

test.setTimeout(150000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } })
const dialog = page => page.getByRole('dialog', { name: 'Upload PR, PO and Vendor', exact: true })
const field = (page, name) => dialog(page).getByLabel(name, { exact: true })
const save = (page, existing = false) => dialog(page).getByRole('button', { name: existing ? 'Attach signed PDF' : 'Upload PR', exact: true })
const clean = state => { expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([]) }

async function preview(page, number) {
  await expect(page.getByRole('heading', { name: 'Purchase Recommendations', exact: true })).toBeVisible({ timeout: 100000 })
  await expect(page.getByRole('complementary', { name: 'Recommendation details' })).toHaveAttribute('aria-busy', 'false')
  await page.getByRole('button', { name: number ? `Actions for ${number}` : 'More recommendation actions', exact: true }).click()
  await page.getByRole('menuitem', { name: number ? 'Attach signed PDF' : 'Import signed PDF', exact: true }).click()
  await field(page, 'Select signed or approved PR PDF').setInputFiles(syntheticApprovedPdf)
  await dialog(page).getByRole('button', { name: 'Preview OCR', exact: true }).click()
  await expect(field(page, 'Project Number')).toBeVisible()
}

test('new import saves each comma-separated project number and displays the absent Richa at Level 0 without an approval', async ({ page }) => {
  const state = await recommendationPdfImportHarness(page)
  await preview(page)
  const richa = field(page, 'Procurement approver, Level 0')
  await expect(richa).toHaveValue('Richa Hannah Thomas')
  await expect(field(page, 'Procurement level')).toHaveValue('0')
  await expect(richa.locator('..')).toContainText('Not recorded')
  await expect(richa).toHaveJSProperty('readOnly', true)
  await field(page, 'Project Number').fill(' 5900985,5900828, 5900985, PR-X ')
  await field(page, 'Project Number').blur()
  await expect(field(page, 'Project Number')).toHaveValue('5900985, 5900828, PR-X')
  await save(page).click()
  await expect(dialog(page)).toContainText('Status: draft')
  expect(JSON.parse(state.saveRequests[0].manual_overrides).project_number).toBe('5900985, 5900828, PR-X')
  const record = state.props.requisitions.find(item => item.pr_number === state.importNumber)
  expect(record.project_numbers).toEqual(['5900985', '5900828', 'PR-X'])
  expect(state.saveRequests[0]).not.toHaveProperty('source_approval_review')
  clean(state)
})

test('existing attachment saves only deliberate project references and retains them through an error and reopen', async ({ page }) => {
  const number = recommendationNumber(6)
  const state = await recommendationPdfImportHarness(page, { extracted: { pr_number: number }, documentSignedOff: true })
  const original = structuredClone(state.props.requisitions.find(item => item.pr_number === number))
  await preview(page, number)
  await expect(field(page, 'Project Number')).toBeEditable()
  await expect(field(page, 'Product / Service')).toHaveJSProperty('readOnly', true)
  await field(page, 'Project Number').fill('5900985,5900828,5900828')
  state.saveError = { status: 503, body: { error: 'Source storage unavailable. Retry with your edits.' } }
  await save(page, true).click()
  await expect(dialog(page).getByRole('alert')).toContainText('Source storage unavailable')
  await expect(field(page, 'Project Number')).toHaveValue('5900985, 5900828')
  expect(state.props.requisitions.find(item => item.pr_number === number)).toEqual(original)
  expect(JSON.parse(state.saveRequests[0].reviewed_project_references)).toEqual({ project_number: '5900985, 5900828', expected_updated_at: original.updated_at || '2026-09-25T09:00:00.000000Z' })
  expect(JSON.parse(state.saveRequests[0].manual_overrides)).toEqual({})
  state.saveError = null
  await save(page, true).click()
  await expect(dialog(page)).toContainText('Project numbers and review were saved.')
  const saved = state.props.requisitions.find(item => item.pr_number === number)
  expect(saved.project_numbers).toEqual(['5900985', '5900828'])
  expect(saved.product_service).toEqual(original.product_service)
  expect(saved.total_price).toEqual(original.total_price)
  await dialog(page).getByRole('button', { name: 'Close', exact: true }).click()
  await preview(page, number)
  await expect(field(page, 'Project Number')).toHaveValue('5900985, 5900828')
  clean(state)
})

test('a missing project acknowledgment keeps the attachment and reviewed numbers visible', async ({ page }) => {
  const number = recommendationNumber(6)
  const state = await recommendationPdfImportHarness(page, { extracted: { pr_number: number } })
  await preview(page, number)
  await field(page, 'Project Number').fill('5900985, 5900828')
  state.projectNumbersResponse = ['5900985']
  await save(page, true).click()
  await expect(dialog(page).getByRole('alert')).toContainText('saved project numbers could not be confirmed')
  await expect(field(page, 'Project Number')).toHaveValue('5900985, 5900828')
  await expect(save(page, true)).toBeEnabled()
  expect(state.saveRequests).toHaveLength(1)
  clean(state)
})

test('unknown signed-off approver names and Levels require a Special note without changing signatures', async ({ page }) => {
  const state = await recommendationPdfImportHarness(page, { documentSignedOff: true, approvalDetection: {
    signatures: { pm: true, moe: false, mop: false, vp: false }, approver_names: { pm: '90712' }, approval_date: '2026-09-15',
    approval_rows: [{ role_key: 'pm', source_role: 'PM', name: '90712', signature_detected: true }],
  } })
  await preview(page)
  await expect(field(page, 'Project Manager')).toBeEditable()
  await field(page, 'Project Manager').fill('Corrected project reviewer')
  await field(page, 'Project Manager level').fill('1')
  await save(page).click()
  await expect(dialog(page).getByRole('alert')).toContainText('Special note')
  expect(state.saveRequests).toEqual([])
  await field(page, 'Project Manager special note').fill('The OCR captured an employee number; the original PDF identifies this reviewer.')
  await save(page).click()
  await expect(dialog(page)).toContainText('created from the reviewed PDF')
  expect(state.saveRequests[0].pm_name).toBe('Corrected project reviewer')
  expect(state.saveRequests[0]).not.toHaveProperty('manual_signature_overrides')
  expect(JSON.parse(state.saveRequests[0].source_approval_review)).toMatchObject({ approval_labels: { pm: '1' }, approver_notes: { pm: 'The OCR captured an employee number; the original PDF identifies this reviewer.' } })
  clean(state)
})
