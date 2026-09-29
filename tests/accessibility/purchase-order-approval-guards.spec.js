import { test, expect } from '@playwright/test'
import { orderFormHarness, orderFormId, orderFormNumber, orderFormRecommendation } from '../fixtures/purchase-order-form.fixture'

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

for (const capabilities of ['denied', 'missing']) {
  test(`draft order blocks issue when approval capability is ${capabilities}`, async ({ page }) => {
    const state = await open(page, {
      ...(capabilities === 'denied' ? { can_send_to_vendor: false, can_complete: false, lifecycle_block_reason: reason } : {}),
    })
    const button = page.getByRole('button', { name: 'Send to Vendor', exact: true })
    await expect(button).toBeDisabled()
    await expect(button).toHaveAccessibleDescription(capabilities === 'denied' ? reason : /requires confirmed approvals/)
    await expect(page.getByRole('button', { name: 'Download PDF', exact: true })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeEnabled()
    expect(state.acceptedWrites).toEqual([])
    clean(state)
  })
}

for (const status of ['sent', 'acknowledged', 'in_progress', 'partially_received', 'completed']) {
  test(`${status} order ends at Issued without post-issue actions or writes`, async ({ page }) => {
    const state = await open(page, { status, can_complete: true, lifecycle_block_reason: reason })
    await expect(page.getByText('Issued', { exact: true }).filter({ visible: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /Mark Complete|Mark acknowledged|Send to Vendor/ })).toHaveCount(0)
    await expect(page.locator('#po-lifecycle-block-reason')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Download PDF', exact: true })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeEnabled()
    expect(state.record.status).toBe(status)
    expect(state.acceptedWrites).toEqual([])
    clean(state)
  })
}

test('explicit server authorization permits sending the approved order', async ({ page }) => {
  const state = await open(page, { can_send_to_vendor: true, approval_log: [{ level: 1, stage: 'Technical', status: 'approved' }] })
  await page.getByRole('button', { name: 'Send to Vendor', exact: true }).click()
  await page.getByRole('dialog', { name: 'Confirm action' }).getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect.poll(() => state.acceptedWrites.length).toBe(1)
  expect(state.acceptedWrites[0].body).toEqual({ status: 'sent' })
  await expect(page.getByText('Purchase order issued.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Mark Complete|Mark acknowledged|Send to Vendor/ })).toHaveCount(0)
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

test('editing a partially approved order permits number correction without exposing commercial edits', async ({ page }) => {
  const state = await open(page, {
    can_send_to_vendor: false, lifecycle_block_reason: reason,
    commercial_edit_locked: true, commercial_edit_lock_reason: lockReason,
    approval_log: [{ level: 1, stage: 'Technical', status: 'approved' }, { level: 2, stage: 'Finance', status: 'pending' }],
  })
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const editor = page.getByRole('region', { name: 'Purchase order editor', exact: true })
  await expect(editor.getByRole('textbox', { name: 'PO number', exact: true })).toBeEditable()
  await expect(editor.getByRole('button', { name: 'Save changes', exact: true }).last()).toBeEnabled()
  await expect(editor.getByText(lockReason, { exact: true })).toHaveCount(0)
  await expect(editor.getByRole('textbox', { name: 'Payment Terms', exact: true })).not.toBeEditable()
  expect(state.acceptedWrites).toEqual([])
  expect(state.record.payment_terms).toBe('Net 30')
  await expect(editor.getByRole('button', { name: 'Send to vendor', exact: true })).toHaveCount(0)
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Send to Vendor', exact: true })).toBeDisabled()
  clean(state)
})

test('register issue cannot rely on historical approval labels when the server blocks release', async ({ page }) => {
  const state = await orderFormHarness(page, { path: '/procurement/orders', prepare: fixture => {
    fixture.record = {
      id: orderFormId, po_number: orderFormNumber, status: 'draft', po_date: '2026-09-15',
      title: 'Synthetic historical approval guard', vendor: 21, vendor_name: fixture.vendors[0].name,
      currency: 'AED', total_amount: '1050.00', tax_amount: '50.00',
      approved_at: '2026-09-14T08:00:00Z', approved_by: 8,
      can_send_to_vendor: false, lifecycle_block_reason: reason, items: [], attachments: [], approval_log: [],
    }
    fixture.orders = [fixture.record]
  } })
  await page.getByRole('button', { name: `Select ${orderFormNumber}`, exact: true }).click()
  const detail = page.getByRole('complementary', { name: 'Purchase order details', exact: true })
  await expect(detail.getByRole('button', { name: 'Send to Vendor', exact: true })).toBeDisabled()
  await expect(detail.getByRole('button', { name: 'Send to Vendor', exact: true })).toHaveAccessibleDescription(reason)
  expect(state.acceptedWrites).toEqual([])
  clean(state)
})
