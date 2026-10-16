import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { orderFormHarness, orderFormNumber } from '../fixtures/purchase-order-form.fixture'
import { syntheticPoPdf } from '../fixtures/purchase-recommendation-paired-import.fixture'

test.setTimeout(150000)
test.use({ serviceWorkers: 'block' })

const dialog = page => page.getByRole('dialog', { name: 'Upload PR, PO and Vendor', exact: true })
const source = page => dialog(page).getByRole('region', { name: 'Source PDF preview', exact: true })
const save = page => dialog(page).getByRole('button', { name: 'Save PO', exact: true })
const clean = state => { expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([]) }

async function openPoReview(page) {
  const state = await orderFormHarness(page, {
    path: '/procurement/orders',
    prepare: fixture => {
      fixture.poPdfPreviews[syntheticPoPdf.name] = { data: {
        extracted_data: {
          summary: 'Synthetic source purchase order for reviewed equipment',
          expected_delivery: '2026-10-20', project_number: 'TEST-001',
          payment_terms: 'As recorded in the synthetic source order', payment_mode: 'Bank transfer',
          delivery_terms: 'Deliver to the project site', seller_reference: 'SOURCE-001', quote_ref: 'QUOTE-001',
        },
        approval_evidence: {
          signature_detected: true, stamp_detected: true,
          approved_by_name: 'Source PO Approver', approved_by_title: 'Source signatory', approved_date: '2026-07-01',
        },
      } }
    },
  })
  await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible({ timeout: 100000 })
  await page.getByRole('button', { name: 'More purchase order actions', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Import signed PDF', exact: true }).click()
  await dialog(page).getByLabel('Select signed or approved PO PDF', { exact: true }).setInputFiles(syntheticPoPdf)
  await dialog(page).getByRole('button', { name: 'Preview OCR', exact: true }).click()
  await expect(dialog(page).getByLabel('PO Number', { exact: true })).toHaveValue(orderFormNumber)
  await expect(source(page).getByRole('img', { name: 'Approved PO source PDF, page 1 of 1', exact: true })).toBeVisible({ timeout: 30000 })
  return state
}

test('PO desktop review keeps order and commercial cards beside the source with vendor and independent approval below', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1672, height: 941 })
  const state = await openPoReview(page)
  // Exercise the wide reference layout inside the available main-content area.
  await dialog(page).getByRole('separator', { name: 'Resize upload window from right', exact: true }).press('End')
  await expect(dialog(page).getByRole('heading', { name: 'Review Purchase Order', exact: true })).toBeVisible()
  const order = dialog(page).getByRole('region', { name: 'Order information', exact: true })
  const commercial = dialog(page).getByRole('region', { name: 'Commercial terms', exact: true })
  const vendor = dialog(page).getByRole('region', { name: 'Vendor details', exact: true })
  const approval = dialog(page).getByRole('group', { name: 'PO approval evidence', exact: true })
  await expect(order.getByLabel('PO Number', { exact: true })).toHaveValue(orderFormNumber)
  await expect(commercial.getByLabel('PO Payment terms', { exact: true })).toHaveValue('As recorded in the synthetic source order')
  await expect(vendor.getByLabel('Vendor email', { exact: true })).toHaveValue('original@example.test')
  await expect(approval.getByLabel('PO approval signature is visible', { exact: true })).not.toBeChecked()
  await expect(approval.getByLabel('PO company stamp is visible', { exact: true })).not.toBeChecked()
  await expect(approval.getByLabel('PO Approver name', { exact: true })).toHaveValue('Source PO Approver')

  const [bounds, sourceBox, orderBox, commercialBox, vendorBox, approvalBox, footerBox] = await Promise.all([
    dialog(page).boundingBox(), source(page).boundingBox(), order.boundingBox(), commercial.boundingBox(),
    vendor.boundingBox(), approval.boundingBox(), dialog(page).locator('.procurement-import-review__footer').boundingBox(),
  ])
  expect(sourceBox.width).toBeGreaterThan(bounds.width * 0.35)
  expect(sourceBox.width).toBeLessThan(bounds.width * 0.5)
  expect(orderBox.x).toBeGreaterThanOrEqual(sourceBox.x + sourceBox.width)
  expect(commercialBox.x).toBeGreaterThanOrEqual(orderBox.x + orderBox.width)
  expect(Math.abs(orderBox.y - commercialBox.y)).toBeLessThan(2)
  expect(vendorBox.y).toBeGreaterThanOrEqual(Math.max(orderBox.y + orderBox.height, commercialBox.y + commercialBox.height))
  expect(approvalBox.y).toBeGreaterThanOrEqual(vendorBox.y + vendorBox.height)
  expect((await order.getByLabel('PO Entered price', { exact: true }).boundingBox()).width).toBeGreaterThanOrEqual(100)
  await expect(save(page)).toBeInViewport()
  await expect(dialog(page).getByRole('button', { name: 'Save draft', exact: true })).toHaveCount(0)
  expect(state.acceptedWrites).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('po-review-desktop.png') })
  await approval.scrollIntoViewIfNeeded()
  const reachableApprovalBox = await approval.boundingBox()
  expect(reachableApprovalBox.y + reachableApprovalBox.height).toBeLessThanOrEqual(footerBox.y)
  const scan = await new AxeBuilder({ page }).include('.procurement-import-review').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(scan.violations).toEqual([])
  const description = order.getByLabel('PO Description', { exact: true })
  await expect(description).toHaveAttribute('aria-required', 'true')
  await description.fill('')
  await expect(dialog(page).getByText('1 required field remaining', { exact: true })).toBeVisible()
  await description.fill('Synthetic source purchase order for reviewed equipment')
  await expect(dialog(page).getByText('Required fields complete', { exact: true })).toBeVisible()
  const vendorProgress = dialog(page).getByRole('list', { name: 'Document review progress' }).getByRole('listitem').filter({ hasText: 'Vendor & approval' })
  await approval.getByLabel('PO approval signature is visible', { exact: true }).check()
  await expect(vendorProgress).toContainText('Vendor & approval: complete')
  const supplier = vendor.getByRole('combobox', { name: 'PO Supplier name', exact: true })
  await supplier.fill('')
  await expect(vendorProgress).toContainText('Vendor & approval: pending review')
  await supplier.fill('Original supplier')
  await supplier.press('Escape')
  await expect(vendorProgress).toContainText('Vendor & approval: complete')
  expect(state.acceptedWrites).toEqual([])
  clean(state)
})

test('PO mobile review keeps compact vendor fields reachable and retains input and independent evidence after a failed save', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const state = await openPoReview(page)
  const bounds = await dialog(page).boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(844)
  expect(await dialog(page).evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
  const sourceLink = source(page).getByRole('link', { name: 'Open PO PDF in new tab', exact: true })
  const sourceUrl = await sourceLink.getAttribute('href')
  await source(page).scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('po-review-mobile-source.png') })

  const email = dialog(page).getByLabel('Vendor email', { exact: true })
  await email.fill('reviewed-mobile@example.test')
  await email.scrollIntoViewIfNeeded()
  const [emailBox, footerBox] = await Promise.all([email.boundingBox(), dialog(page).locator('.procurement-import-review__footer').boundingBox()])
  expect(emailBox.x).toBeGreaterThanOrEqual(bounds.x)
  expect(emailBox.x + emailBox.width).toBeLessThanOrEqual(bounds.x + bounds.width)
  expect(emailBox.y + emailBox.height).toBeLessThanOrEqual(footerBox.y)
  await expect(save(page)).toBeInViewport()
  await page.screenshot({ path: testInfo.outputPath('po-review-mobile-vendor.png') })

  const signature = dialog(page).getByLabel('PO approval signature is visible', { exact: true })
  const stamp = dialog(page).getByLabel('PO company stamp is visible', { exact: true })
  await signature.check()
  await expect(stamp).not.toBeChecked()
  state.poPdfImportError = { detail: 'Supplier details need review. Nothing was saved.' }
  await dialog(page).getByRole('button', { name: 'Cancel', exact: true }).focus()
  await page.keyboard.press('Tab')
  await expect(save(page)).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(dialog(page).getByRole('alert')).toContainText('Supplier details need review')
  await expect(email).toHaveValue('reviewed-mobile@example.test')
  await expect(signature).toBeChecked()
  await expect(stamp).not.toBeChecked()
  await expect(sourceLink).toHaveAttribute('href', sourceUrl)
  expect(state.acceptedWrites).toEqual([])
  state.poPdfImportError = null
  await save(page).click()
  await expect(dialog(page)).toContainText('The original PO PDF is attached.')
  expect(state.acceptedWrites).toHaveLength(1)
  expect(state.acceptedWrites[0].body).toMatchObject({
    signature_verified: true, stamp_verified: false,
    reviewed_fields: { seller_email: 'reviewed-mobile@example.test' },
  })
  clean(state)
})
