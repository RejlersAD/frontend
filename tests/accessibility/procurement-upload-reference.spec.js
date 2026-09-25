import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { recommendationPdfImportHarness } from '../fixtures/purchase-recommendation-pdf-import.fixture'
import { pairedImportHarness, syntheticApprovedPdf, syntheticPoPdf } from '../fixtures/purchase-recommendation-paired-import.fixture'

test.setTimeout(150000)
test.use({ serviceWorkers: 'block' })

const dialog = page => page.getByRole('dialog', { name: 'Upload PR, PO and Vendor', exact: true })
const source = page => dialog(page).getByRole('region', { name: 'Source PDF preview', exact: true })
const form = page => dialog(page).locator('.procurement-import-review__form')
const clean = state => { expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([]) }

async function openReview(page, paired = false) {
  const state = paired ? await pairedImportHarness(page) : await recommendationPdfImportHarness(page, {
    extracted: {
      price_lines: [{ description: 'Synthetic reviewed pump package', total: '12500.00', currency: 'AED', remarks: 'Source quote' }],
      po_reference: 'RAD-PRJ-PUR-9002_SEP2026',
    },
  })
  await expect(page.getByRole('heading', { name: 'Purchase Recommendations', exact: true })).toBeVisible({ timeout: 100000 })
  await expect(page.getByRole('complementary', { name: 'Recommendation details' })).toHaveAttribute('aria-busy', 'false')
  await page.getByRole('button', { name: 'More recommendation actions', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Import signed PDF', exact: true }).click()
  await dialog(page).getByLabel('Select signed or approved PR PDF', { exact: true }).setInputFiles(syntheticApprovedPdf)
  if (paired) await dialog(page).getByLabel('Select signed or approved PO PDF', { exact: true }).setInputFiles(syntheticPoPdf)
  await dialog(page).getByRole('button', { name: 'Preview OCR', exact: true }).click()
  await expect(dialog(page).getByLabel('PR Number', { exact: true })).toBeVisible()
  const kind = paired ? 'PO' : 'PR'
  await expect(source(page).getByRole('img', { name: `Approved ${kind} source PDF, page 1 of 1`, exact: true })).toBeVisible({ timeout: 30000 })
  return state
}

test('desktop review keeps the source beside grouped fields and actions visible while scrolling', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1672, height: 941 })
  const state = await openReview(page)
  await expect(dialog(page).getByRole('heading', { name: 'Review Purchase Recommendation', exact: true })).toBeVisible()
  const save = dialog(page).getByRole('button', { name: 'Upload PR', exact: true })
  await expect(save).toBeInViewport()
  await expect(dialog(page).getByRole('button', { name: 'Save draft', exact: true })).toHaveCount(0)
  await expect(dialog(page).getByText('Draft saved', { exact: true })).toHaveCount(0)

  const [bounds, sourceBox, formBox, saveBox] = await Promise.all([
    dialog(page).boundingBox(), source(page).boundingBox(), form(page).boundingBox(), save.boundingBox(),
  ])
  expect(sourceBox.width).toBeGreaterThan(bounds.width * 0.35)
  expect(formBox.width).toBeGreaterThan(bounds.width * 0.45)
  expect(formBox.x).toBeGreaterThanOrEqual(sourceBox.x + sourceBox.width)
  expect(Math.abs(sourceBox.y - formBox.y)).toBeLessThan(30)
  expect(sourceBox.height).toBeGreaterThan(500)
  expect(sourceBox.y + sourceBox.height).toBeLessThanOrEqual(saveBox.y)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(941)
  await expect(dialog(page).getByRole('heading', { name: 'Purchase recommendation details', exact: true })).toHaveCount(0)
  const informationBox = await dialog(page).getByRole('region', { name: 'PR information', exact: true }).boundingBox()
  expect(informationBox.y - formBox.y, 'The PR cards start directly at the top of the review pane').toBeLessThanOrEqual(24)
  await expect(dialog(page).locator('.procurement-import-review__footer').getByRole('button', { name: 'Change documents', exact: true })).toBeVisible()
  const amountBox = await dialog(page).getByLabel('Price line 1 amount', { exact: true }).boundingBox()
  expect(amountBox.width, 'The entered amount must remain readable beside its currency selector').toBeGreaterThanOrEqual(80)

  await page.screenshot({ path: testInfo.outputPath('procurement-upload-review-desktop.png') })
  await form(page).evaluate(element => { element.scrollTop = element.scrollHeight })
  await expect(save).toBeInViewport()
  expect(Math.abs((await save.boundingBox()).y - saveBox.y)).toBeLessThan(2)
  expect(Math.abs((await source(page).boundingBox()).y - sourceBox.y)).toBeLessThan(2)
  await dialog(page).getByLabel('PR Approval date', { exact: true }).fill('2026-09-15')
  await form(page).evaluate(element => { element.scrollTop = 0 })
  const scan = await new AxeBuilder({ page }).include('.procurement-import-review').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(scan.violations).toEqual([])
  expect(state.saveRequests).toEqual([])
  clean(state)
})

test('mobile paired review fits the screen and keeps edited vendor details reachable above its actions', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const state = await openReview(page, true)
  const save = dialog(page).getByRole('button', { name: 'Upload PR and PO', exact: true })
  const bounds = await dialog(page).boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(844)
  expect(await dialog(page).evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
  await source(page).scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('procurement-upload-review-mobile-source.png') })
  await dialog(page).getByLabel('Vendor email', { exact: true }).fill('reviewed-mobile@example.test')
  await expect(dialog(page).getByLabel('Vendor email', { exact: true })).toHaveValue('reviewed-mobile@example.test')
  await dialog(page).getByLabel('Vendor email', { exact: true }).scrollIntoViewIfNeeded()
  await expect(save).toBeInViewport()
  const emailBox = await dialog(page).getByLabel('Vendor email', { exact: true }).boundingBox()
  const footerBox = await dialog(page).locator('.procurement-import-review__footer').boundingBox()
  expect(emailBox.x).toBeGreaterThanOrEqual(bounds.x)
  expect(emailBox.x + emailBox.width).toBeLessThanOrEqual(bounds.x + bounds.width)
  expect(emailBox.y + emailBox.height).toBeLessThanOrEqual(footerBox.y)
  await page.screenshot({ path: testInfo.outputPath('procurement-upload-review-mobile-vendor.png') })
  await dialog(page).getByLabel('PR Approval date', { exact: true }).scrollIntoViewIfNeeded()
  const footer = dialog(page).locator('.procurement-import-review__footer')
  await footer.getByRole('button', { name: 'Change documents', exact: true }).click()
  const chooser = dialog(page).getByRole('button', { name: 'Choose PDF', exact: true })
  await expect(chooser).toBeFocused()
  await expect(chooser).toBeInViewport()
  await footer.getByRole('button', { name: 'Hide source selection', exact: true }).click()
  await expect(dialog(page).getByLabel('Vendor email', { exact: true })).toHaveValue('reviewed-mobile@example.test')
  const cancel = dialog(page).getByRole('button', { name: 'Cancel', exact: true })
  await cancel.focus()
  await page.keyboard.press('Tab')
  await expect(save).toBeFocused()
  expect(state.pairPreviews).toHaveLength(1)
  expect(state.pairSaves).toEqual([])
  clean(state)
})

test('keyboard source switching preserves reviewed fields and the original PDF links', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const state = await openReview(page, true)
  await dialog(page).getByLabel('Product / Service', { exact: true }).fill('Keyboard reviewed PR scope')
  await dialog(page).getByLabel('PR Approval date', { exact: true }).scrollIntoViewIfNeeded()
  const footer = dialog(page).locator('.procurement-import-review__footer')
  await footer.getByRole('button', { name: 'Change documents', exact: true }).click()
  const chooser = dialog(page).getByRole('button', { name: 'Choose PDF', exact: true })
  await expect(chooser).toBeFocused()
  await expect(chooser).toBeInViewport()
  await footer.getByRole('button', { name: 'Hide source selection', exact: true }).click()
  await expect(dialog(page).getByLabel('Product / Service', { exact: true })).toHaveValue('Keyboard reviewed PR scope')
  const poTab = source(page).getByRole('tab', { name: 'PO PDF', exact: true })
  const prTab = source(page).getByRole('tab', { name: 'PR PDF', exact: true })
  const poUrl = await source(page).getByRole('link', { name: 'Open PO PDF in new tab', exact: true }).getAttribute('href')
  await poTab.focus()
  await page.keyboard.press('Home')
  await expect(prTab).toBeFocused()
  await expect(prTab).toHaveAttribute('aria-selected', 'true')
  await expect(source(page).getByRole('link', { name: 'Open PR PDF in new tab', exact: true })).toHaveAttribute('href', /^blob:/)
  await page.keyboard.press('End')
  await expect(poTab).toBeFocused()
  await expect(poTab).toHaveAttribute('aria-selected', 'true')
  await expect(source(page).getByRole('link', { name: 'Open PO PDF in new tab', exact: true })).toHaveAttribute('href', poUrl)
  await expect(dialog(page).getByLabel('Product / Service', { exact: true })).toHaveValue('Keyboard reviewed PR scope')
  await page.route('**/api/v1/procurement/po-documents/approval-employees/**', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ results: [{ id: 'synthetic-reviewer', name: 'Source PO Reviewer', position: 'Source signer', employee_number: 'TEST-001' }] }),
  }))
  const approver = dialog(page).getByRole('combobox', { name: 'PO Approver name', exact: true })
  await approver.fill('Source PO Reviewer')
  await expect(approver).toHaveAttribute('aria-expanded', 'true')
  await approver.press('Escape')
  await expect(dialog(page)).toBeVisible()
  await expect(approver).toHaveValue('Source PO Reviewer')
  await expect(approver).toHaveAttribute('aria-expanded', 'false')
  await expect(dialog(page).getByLabel('Product / Service', { exact: true })).toHaveValue('Keyboard reviewed PR scope')
  expect(state.pairPreviews).toHaveLength(1)
  expect(state.pairSaves).toEqual([])
  await dialog(page).getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(dialog(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'More recommendation actions', exact: true })).toBeFocused()
  clean(state)
})

test('reviewed price lines can be added and removed without changing the recorded header amount', async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 })
  const state = await openReview(page)
  const add = dialog(page).getByRole('button', { name: 'Add line', exact: true })
  await expect(dialog(page).getByRole('button', { name: 'Remove price line 1', exact: true })).toBeDisabled()
  await add.click()
  await dialog(page).getByLabel('Price line 2 description', { exact: true }).fill('Reviewed optional service')
  await dialog(page).getByLabel('Price line 2 amount', { exact: true }).fill('0.00')
  await dialog(page).getByLabel('Price line 2 remarks', { exact: true }).fill('Included in the source total')
  await add.click()
  await dialog(page).getByLabel('Price line 3 description', { exact: true }).fill('Discarded review line')
  await dialog(page).getByRole('button', { name: 'Remove price line 3', exact: true }).click()
  await expect(dialog(page).getByLabel('Price line 3 description', { exact: true })).toHaveCount(0)
  await expect(dialog(page).getByLabel('Entered price', { exact: true })).toHaveValue('12500.00')
  expect(state.saveRequests).toEqual([])
  await dialog(page).getByRole('button', { name: 'Upload PR', exact: true }).click()
  await expect(dialog(page)).toContainText('created from the reviewed PDF')
  expect(state.saveRequests).toHaveLength(1)
  expect(JSON.parse(state.saveRequests[0].manual_overrides)).toMatchObject({
    net_total: '12500.00',
    price_lines: [
      { description: 'Synthetic reviewed pump package', total: '12500.00', currency: 'AED', remarks: 'Source quote' },
      { description: 'Reviewed optional service', total: '0.00', currency: 'AED', remarks: 'Included in the source total' },
    ],
  })
  clean(state)
})
