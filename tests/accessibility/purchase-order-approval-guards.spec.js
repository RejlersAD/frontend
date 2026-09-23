import { test, expect } from '@playwright/test'
import { orderFormHarness, orderFormId, orderFormNumber, orderFormRecommendation } from '../fixtures/purchase-order-form.fixture'
import { purchaseOrderHarness } from '../fixtures/purchase-orders.fixture'

test.setTimeout(120000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } })

const reason = 'Complete all required purchase order approvals before sending or completing this order.'
const lockReason = 'Approved commercial details are locked. Create a revised purchase order for commercial changes.'
const open = async (page, overrides = {}, prepare) => {
  const state = await orderFormHarness(page, {
  path: `/procurement/orders/${orderFormId}`,
  prepare: state => {
    state.record = {
      id: orderFormId, po_number: orderFormNumber, status: 'draft', po_date: '2026-09-15',
      title: 'Approval controls regression', vendor: 21, vendor_name: state.vendors[0].name,
      currency: 'AED', total_amount: '1050.00', net_amount: '1000.00', tax_amount: '50.00',
      vat_basis: 'exclusive', vat_percentage: 5, payment_terms: 'Net 30',
      pr_reference: orderFormRecommendation.id, pr_number: orderFormRecommendation.pr_number,
      approval_log: [{ level: 1, stage: 'Technical', status: 'pending' }], items: [], attachments: [],
      ...overrides,
    }
    state.orders = [state.record]
    prepare?.(state)
  },
  })
  await expect(page.getByRole('heading', { name: orderFormNumber, exact: true })).toBeVisible({ timeout: 90000 })
  return state
}
const clean = state => { expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([]) }

for (const status of ['draft', 'sent']) {
  for (const capabilities of ['denied', 'missing']) {
    test(`${status} order blocks lifecycle actions when approval capability is ${capabilities}`, async ({ page }) => {
      const state = await open(page, {
        status,
        ...(capabilities === 'denied' ? { can_send_to_vendor: false, can_complete: false, lifecycle_block_reason: reason } : {}),
      })
      const button = page.getByRole('button', { name: status === 'draft' ? 'Send to Vendor' : 'Mark Complete', exact: true })
      await expect(button).toBeDisabled()
      await expect(button).toHaveAccessibleDescription(capabilities === 'denied' ? reason : /requires confirmed approvals/)
      await expect(page.getByRole('button', { name: 'Download PDF', exact: true })).toBeEnabled()
      await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeEnabled()
      expect(state.acceptedWrites).toEqual([])
      clean(state)
    })
  }
}

test('explicit server authorization permits sending the approved order', async ({ page }) => {
  const state = await open(page, { can_send_to_vendor: true, approval_log: [{ level: 1, stage: 'Technical', status: 'approved' }] })
  await page.getByRole('button', { name: 'Send to Vendor', exact: true }).click()
  await page.getByRole('dialog', { name: 'Confirm action' }).getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect.poll(() => state.acceptedWrites.length).toBe(1)
  expect(state.acceptedWrites[0].body).toEqual({ status: 'sent' })
  clean(state)
})

test('a server approval rejection during issue remains visible and leaves the order unchanged', async ({ page }) => {
  const state = await open(page, { can_send_to_vendor: true }, fixture => { fixture.sendError = { status: [reason] } })
  await page.getByRole('button', { name: 'Send to Vendor', exact: true }).click()
  await page.getByRole('dialog', { name: 'Confirm action' }).getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByText(`Failed to send order: ${reason}`, { exact: true })).toBeVisible()
  expect(state.acceptedWrites).toEqual([])
  expect(state.record.status).toBe('draft')
  clean(state)
})

test('editing a partially approved order explains its commercial lock and preserves a rejected edit', async ({ page }) => {
  const state = await open(page, {
    can_send_to_vendor: false, lifecycle_block_reason: reason,
    commercial_edit_locked: true, commercial_edit_lock_reason: lockReason,
    approval_log: [{ level: 1, stage: 'Technical', status: 'approved' }, { level: 2, stage: 'Finance', status: 'pending' }],
  }, fixture => { fixture.saveError = { payment_terms: [lockReason] } })
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const editor = page.getByRole('region', { name: 'Purchase order editor', exact: true })
  await expect(editor.getByRole('status').filter({ hasText: lockReason })).toBeVisible()
  await page.locator('[name="payment_terms"]').fill('Net 90')
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click()
  await expect(editor.getByRole('alert')).toContainText(lockReason)
  await expect(page.locator('[name="payment_terms"]')).toHaveValue('Net 90')
  expect(state.acceptedWrites).toEqual([])
  expect(state.record.payment_terms).toBe('Net 30')
  await page.getByRole('tab', { name: 'Attachments', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Send to vendor', exact: true })).toBeDisabled()
  clean(state)
})

test('register issue cannot rely on historical approval labels when the server blocks release', async ({ page }) => {
  const state = await purchaseOrderHarness(page, { prepare: fixture => {
    Object.assign(fixture.details[108], { can_send_to_vendor: false, lifecycle_block_reason: reason })
  } })
  await page.getByRole('button', { name: 'Select PO-TEST-008', exact: true }).click()
  const detail = page.getByRole('complementary', { name: 'Purchase order details', exact: true })
  await expect(detail.getByRole('button', { name: 'Issue order', exact: true })).toBeDisabled()
  await expect(detail.getByRole('button', { name: 'Issue order', exact: true })).toHaveAccessibleDescription(reason)
  expect(await page.evaluate(() => window.purchaseOrderActions)).toEqual([])
  clean(state)
})
