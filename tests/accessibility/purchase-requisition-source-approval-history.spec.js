import { test, expect } from '@playwright/test'
import { recommendationHarness, recommendationId, recommendationNumber } from '../fixtures/purchase-recommendations.fixture'

test.setTimeout(90000)
test.use({ viewport: { width: 1672, height: 1040 } })

const recordId = recommendationId(201)
const sourceRows = [
  { level: 1, role: 'Project Manager', user_id: '7', user_name: 'Maya Hassan', status: 'approved', approved_at: '2026-07-01T08:00:00Z' },
  { level: 2, role: 'Manager of Engineering', user_id: '8', user_name: 'Samir Ali', status: 'approved', approved_at: '2026-07-01T09:00:00Z' },
  { level: 3, role: 'Manager of Projects', user_id: '9', user_name: 'Richa Thomas', status: 'approved', approved_at: '2026-07-01T10:00:00Z' },
  { level: 4, role: 'VP Operations', user_id: '7', user_name: 'Dana Farah', status: 'not_recorded', approved_at: null },
].map(row => ({ ...row, external: true, source: 'signed_purchase_requisition_pdf', signature_verified: row.status === 'approved' }))
const sourceMetadata = {
  import_source: 'signed_pr_pdf',
  signed_document_verification: { signed_off: false, source_approval_rows: sourceRows },
}
const history = page => page.getByRole('region', { name: 'Approval history', exact: true })

async function openRecord(page, overrides = {}) {
  const patch = {
    status: 'draft', status_display: 'Draft', approval_workflow_config: [], approval_hierarchy: [],
    attachments: [], price_remarks_data: {}, ...overrides,
  }
  const state = await recommendationHarness(page, {
    integration: true,
    prepare: fixture => {
      Object.assign(fixture.props.requisitions[0], patch)
      Object.assign(fixture.details[recordId], patch)
    },
  })
  await expect(page.getByRole('heading', { name: 'Purchase Recommendations', exact: true })).toBeVisible()
  await page.getByRole('button', { name: `Select ${recommendationNumber(1)}`, exact: true }).click()
  const details = page.getByRole('complementary', { name: 'Recommendation details', exact: true })
  await expect(details).toHaveAttribute('aria-busy', 'false')
  await details.getByRole('button', { name: 'View approval record', exact: true }).click()
  await expect(page.getByRole('heading', { name: recommendationNumber(1), exact: true, level: 1 })).toBeVisible()
  await expect(history(page)).toBeVisible()
  return state
}

function assertReadOnly(state) {
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
  expect(state.requests.filter(({ method }) => method !== 'GET')).toEqual([])
}

test('partial uploaded approval history shows verified names and unverified VP without granting approval actions', async ({ page }) => {
  const state = await openRecord(page, {
    price_remarks_data: sourceMetadata,
    attachments: [{ type: 'signed_purchase_requisition_pdf', filename: 'Synthetic-approval-history.pdf' }],
  })
  await expect(history(page)).toContainText('Approvals recorded on uploaded PR')
  await expect(history(page)).toContainText('Signature verification incomplete')
  const rows = history(page).getByRole('listitem')
  await expect(rows).toHaveCount(4)
  for (const source of sourceRows) {
    const row = rows.filter({ hasText: source.role })
    await expect(row).toContainText(source.user_name)
    await expect(row).toContainText(source.status === 'approved' ? 'Approved' : 'Not recorded')
  }
  const vp = rows.filter({ hasText: 'VP Operations' })
  await expect(vp).toContainText('Signature not verified')
  await expect(vp).not.toContainText('Pending')
  await expect(history(page)).not.toContainText('Approval workflow has not been configured.')
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Reject', exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Your Action Required', exact: true })).toHaveCount(0)
  await page.screenshot({ path: '../artifacts/source-approval-history/partial-source-history.png' })
  assertReadOnly(state)
})

test('ordinary draft without source evidence keeps its unconfigured workflow message', async ({ page }) => {
  const state = await openRecord(page)
  await expect(history(page)).toContainText('Approval workflow has not been configured.')
  await expect(history(page).getByRole('listitem')).toHaveCount(1)
  await expect(history(page)).toContainText('Richa Hannah Thomas')
  await expect(history(page)).toContainText('Level 0')
  await expect(history(page)).toContainText('Not recorded')
  await expect(history(page)).not.toContainText('Approvals recorded on uploaded PR')
  await expect(history(page)).not.toContainText('Signature verification incomplete')
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Reject', exact: true })).toHaveCount(0)
  assertReadOnly(state)
})

test('configured workflow takes precedence over display-only uploaded approval history', async ({ page }) => {
  const state = await openRecord(page, {
    status: 'in_review', status_display: 'In review', can_approve: true,
    approval_workflow_config: [{ level: 1, role: 'Project Manager', user_id: '7', user_name: 'Current Workflow Approver', status: 'pending' }],
    price_remarks_data: sourceMetadata,
    attachments: [{ type: 'signed_purchase_requisition_pdf', filename: 'Synthetic-approval-history.pdf' }],
  })
  await expect(history(page).getByRole('listitem')).toHaveCount(2)
  await expect(history(page)).toContainText('Current Workflow Approver')
  await expect(history(page)).not.toContainText('Dana Farah')
  await expect(history(page)).not.toContainText('Approvals recorded on uploaded PR')
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reject', exact: true })).toBeVisible()
  assertReadOnly(state)
})
