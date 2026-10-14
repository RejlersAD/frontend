import { test, expect } from '@playwright/test'

const assigned = { level: 0, stage: 'Level 0 - Procurement', role: 'Procurement', user_id: 12, user_email: 'assigned@example.test', user_name: 'Assigned Procurement User', status: 'pending' }
const ceo = { level: 5, stage: 'CEO', role: 'CEO', user_id: 99, user_email: 'ceo@example.test', user_name: 'CEO Test User', status: 'pending' }
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDCEAAAAASUVORK5CYII='
const state = () => ({ actor: { id: 99, email: ceo.user_email, is_superuser: true, job_title: 'CEO' }, pr: { id: 'pr-1', pr_number: 'TEST-PR-1', status: 'in_review', can_approve: true, approval_workflow_config: [assigned, ceo], attachments: [], items: [] }, po: { id: 'po-1', po_number: 'TEST-PO-1', items: [] } })
async function open(page, data, view = 'approval') {
  const requests = [], errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(value => { window.approvalFixture = value }, data)
  await page.route('**/api/v1/**', async route => {
    requests.push({ method: route.request().method(), path: new URL(route.request().url()).pathname })
    const body = route.request().url().includes('my-signature') ? { signature: image } : route.request().url().includes('/orders/') ? data.po : data.pr
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto(`/tests/fixtures/procurement-approval.html?view=${view}`)
  return { requests, errors }
}
test('CEO superadmin cannot act while procurement is the active stage', async ({ page }) => {
  const tracked = await open(page, state())
  await expect(page.getByRole('heading', { name: 'TEST-PR-1', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Reject', exact: true })).toHaveCount(0)
  expect(tracked.requests.filter(row => row.method !== 'GET')).toEqual([])
  expect(tracked.errors).toEqual([])
})
test('the exact active assignee sees both decision controls despite a migrated ID', async ({ page }) => {
  const data = state()
  data.actor = { id: 1001, email: assigned.user_email, is_superuser: false }
  const tracked = await open(page, data)
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reject', exact: true })).toBeVisible()
  expect(tracked.errors).toEqual([])
})
test('PR and PO previews suppress mismatched signatures and identify recorded signer separately', async ({ page }) => {
  const data = state()
  const mismatch = { ...assigned, status: 'approved', signature: image, approved_by_id: 99, approved_by_email: ceo.user_email, approved_by_name: ceo.user_name }
  data.pr.approval_workflow_config = [mismatch]
  data.pr.attachments = [{ type: 'signed_purchase_requisition_pdf', url: '/original-signed.pdf', filename: 'Original.pdf' }]
  data.po = { ...data.po, approval_log: [{ ...mismatch, stage: 'Final Management Sign-off', approver: assigned.user_name }], approval_signature: image }
  const tracked = await open(page, data, 'documents')
  await expect(page.getByText('Signature needs review', { exact: true })).toBeVisible()
  await expect(page.getByText(`Recorded signer: ${ceo.user_name}`, { exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: /^(L0- PRO signature|Approval signature|Final management approval stamp)$/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'View Original Signed PDF' })).toHaveAttribute('href', '/original-signed.pdf')
  await page.screenshot({ path: 'artifacts/procurement-signature-review.png', fullPage: true })
  expect(tracked.errors).toEqual([])
})
test('queue preview waits for the fresh server decision flag', async ({ page }) => {
  const data = state()
  data.pr.can_approve = false
  const tracked = await open(page, data, 'queue')
  await expect(page.getByRole('heading', { name: /Purchase Recommendation.*TEST-PR-1/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Approve/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Reject/ })).toHaveCount(0)
  expect(tracked.requests.filter(row => row.method !== 'GET')).toEqual([])
  expect(tracked.errors).toEqual([])
})
test('PO queue hides stale decisions when a different active approver owns the stage', async ({ page }) => {
  const data = state()
  data.po = { ...data.po, can_approve: false, current_approval: assigned, approval_log: [assigned, ceo] }
  const tracked = await open(page, data, 'queue-po')
  await expect(page.getByRole('heading', { name: /Purchase Order.*TEST-PO-1/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Approve/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Reject/ })).toHaveCount(0)
  expect(tracked.requests.filter(row => row.method !== 'GET')).toEqual([])
  expect(tracked.errors).toEqual([])
})
