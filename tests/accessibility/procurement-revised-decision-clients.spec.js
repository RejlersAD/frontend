import { test, expect } from '@playwright/test'

test.setTimeout(90000)
test.use({ serviceWorkers: 'block' })
const originalVersion = '2026-09-24T10:00:00.123456Z'
const currentVersion = '2026-09-24T10:03:00.987654Z'
const reason = 'Please correct the supplier delivery scope.'

async function openClient(page, client, { missingVersion = false } = {}) {
  const record = {
    id: 'pr-1', pr_number: 'REVISION-CLIENT-PR', status: 'submitted', can_approve: true,
    updated_at: missingVersion ? undefined : originalVersion,
    product_service: 'Original reviewed purchase scope', attachments: [], items: [],
    price_remarks_data: { approval_revision_history: [{ round: 1 }] },
    approval_workflow_config: [{ level: 0, role: 'Procurement', user_id: 12, user_email: 'approver@example.test', status: 'pending' }],
  }
  const state = { record, gets: 0, posts: [], errors: [], conflicts: !missingVersion }
  page.on('pageerror', error => state.errors.push(error.message))
  await page.addInitScript(pr => {
    window.approvalFixture = { pr, po: {}, actor: { id: 12, email: 'approver@example.test' } }
    localStorage.setItem('radai_access_token', 'synthetic-decision-client-token')
    localStorage.setItem('radai_user_data', JSON.stringify({ id: 12, email: 'approver@example.test' }))
  }, record)
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    let body = {}, status = 200
    if (path === '/api/v1/procurement/requisitions/pr-1/') {
      state.gets++
      body = state.record
    } else if (path.includes('/procurement/requisitions/pr-1/process_dynamic_')) {
      state.posts.push(route.request().postDataJSON())
      status = state.conflicts ? 409 : 200
      body = state.conflicts
        ? { code: 'stale_requisition', error: 'This approval round changed. Reload before deciding.' }
        : { ...state.record, can_approve: false, status: path.includes('rejection') ? 'rejected' : 'approved' }
    } else if (path.endsWith('/notifications/')) body = { results: [] }
    else if (path.endsWith('/notifications/stats/')) body = { total_count: 0, unread_count: 0, read_count: 0, by_priority: {} }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto(client === 'queue' ? '/tests/fixtures/procurement-approval.html?view=queue' : '/tests/fixtures/notification-preview.html')
  if (client === 'notification') await page.getByRole('button', { name: 'Open purchase recommendation preview', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: /Purchase Recommendation.*REVISION-CLIENT-PR/ })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Approve', exact: true })).toBeVisible()
  return { state, dialog }
}

for (const client of ['queue', 'notification']) {
  for (const action of ['approve', 'reject']) test(`${client} ${action} preserves the displayed PR version and reloads explicitly after conflict`, async ({ page }) => {
    const { state, dialog } = await openClient(page, client)
    state.record = { ...state.record, updated_at: currentVersion, product_service: 'Corrected new approval round scope' }
    if (action === 'reject') {
      await dialog.getByRole('button', { name: 'Reject', exact: true }).click()
      await dialog.getByRole('textbox', { name: 'Rejection reason', exact: true }).fill(reason)
    }
    const decisionName = action === 'approve' ? 'Approve' : 'Confirm rejection'
    await dialog.getByRole('button', { name: decisionName, exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('This approval round changed.')
    expect(state.posts).toEqual([action === 'approve' ? { signature: '', expected_updated_at: originalVersion } : { reason, expected_updated_at: originalVersion }])
    expect(state.gets).toBe(1)
    await expect(dialog.getByRole('button', { name: decisionName, exact: true })).toBeDisabled()
    if (action === 'reject') await expect(dialog.getByRole('textbox', { name: 'Rejection reason', exact: true })).toHaveValue(reason)
    await dialog.getByRole('button', { name: 'Reload latest version', exact: true }).click()
    await expect(dialog).toContainText('Corrected new approval round scope')
    await expect(dialog.getByRole('button', { name: decisionName, exact: true })).toBeEnabled()
    expect(state.gets).toBe(2)
    if (action === 'reject') await expect(dialog.getByRole('textbox', { name: 'Rejection reason', exact: true })).toHaveValue(reason)
    state.conflicts = false
    await dialog.getByRole('button', { name: decisionName, exact: true }).click()
    await expect(dialog).toContainText(`${action === 'approve' ? 'approved' : 'rejected'} successfully.`)
    expect(state.posts[1].expected_updated_at).toBe(currentVersion)
    expect(state.errors).toEqual([])
  })

  test(`${client} does not decide when loaded PR has no timestamp`, async ({ page }) => {
    const { state, dialog } = await openClient(page, client, { missingVersion: true })
    await expect(dialog.getByRole('button', { name: 'Approve', exact: true })).toBeDisabled()
    await expect(dialog.getByRole('button', { name: 'Reject', exact: true })).toBeDisabled()
    expect(state.posts).toEqual([])
    state.record = { ...state.record, updated_at: currentVersion }
    await dialog.getByRole('button', { name: 'Reload latest version', exact: true }).click()
    await expect(dialog.getByRole('button', { name: 'Approve', exact: true })).toBeEnabled()
    await dialog.getByRole('button', { name: 'Approve', exact: true }).click()
    await expect(dialog).toContainText('approved successfully.')
    expect(state.posts).toEqual([{ signature: '', expected_updated_at: currentVersion }])
    expect(state.errors).toEqual([])
  })
}
