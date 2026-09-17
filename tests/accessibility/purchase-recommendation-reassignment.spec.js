import { test, expect } from '@playwright/test'
import { formRecordId, recommendationFormHarness } from '../fixtures/purchase-recommendation-form.fixture'
import { mixedSizePdf } from '../fixtures/mixed-size-pdf.fixture'

test.setTimeout(150000)
test.use({ serviceWorkers: 'block', actionTimeout: 30000, viewport: { width: 1672, height: 941 } })
const replacement = { id: 12, full_name: 'Nora Engineering', email: 'nora@example.test', job_title: 'Engineering Manager', is_active: true }
const second = { id: 13, full_name: 'Omar Delivery', email: 'omar@example.test', job_title: 'VP Delivery', is_active: true }
const rows = [
  { level: 0, role: 'Procurement Department', user_id: 9, user_name: 'Richa Hannah Thomas', status: 'approved', approved_at: '2026-09-14T08:00:00Z', signature: 'recorded-signature-PD' },
  { level: 1, role: 'Level 1 Approver', user_id: 8, user_name: 'Samir Ali', status: 'approved', approved_at: '2026-09-14T09:00:00Z', signature: 'recorded-signature-L1' },
  { level: 2, role: 'Manager of Engineering (MoE)', user_id: 7, user_name: 'Maya Hassan', status: 'in_review', assignment_id: 'existing-assignment-moe' },
  { level: 3, role: 'Manager of Projects (MoP)', user_id: 8, user_name: 'Samir Ali', status: 'pending' },
  { level: 4, role: 'VP Delivery', user_id: 10, user_name: 'Mohamad El-Ghawanmeh', status: 'pending', user_email: 'moghawanmeh@rejlers.ae' },
]
const snapshot = (row, index) => ({ stage_index: index, expected_user_id: row.user_id ?? '', expected_user_email: row.user_email || '', expected_status: row.status,
  expected_assignment_id: row.assignment_id || '', expected_role: row.role || '', expected_level: row.level ?? null })
const withSnapshots = workflow => workflow.map((row, index) => {
  const { reassignment_snapshot: omitted, ...current } = row
  void omitted
  return ['pending', 'in_review', 'not_recorded'].includes(current.status)
    ? { ...current, reassignment_snapshot: snapshot(current, index) } : current
})
const pending = page => page.getByRole('region', { name: 'Pending approvers', exact: true })
const save = page => page.getByRole('button', { name: 'Save changes', exact: true }).first()
const assignments = state => state.requests.filter(request => request.method === 'PATCH' && request.path.endsWith(`/${formRecordId}/`))
const clean = state => { expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([]); expect(state.submissions).toEqual([]) }
function bodyOf(request) {
  const fields = {}
  for (const part of request.postData().split(/--[\w-]+(?:\r\n|--)/)) {
    const name = part.match(/name="([^"]+)"/)
    if (!name) continue
    const value = part.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '')
    try { fields[name[1]] = JSON.parse(value) } catch { fields[name[1]] = value }
  }
  return fields
}

async function open(page, overrides = {}, prepare) {
  await page.clock.install({ time: new Date('2026-09-15T08:00:00Z') })
  const state = await recommendationFormHarness(page, { edit: true, additionalEmployees: [replacement, second], record: {
    status: 'in_review', can_reassign_approvers: true, reassignable_approval_stage_indices: [2, 3, 4],
    approval_workflow_config: withSnapshots(structuredClone(rows)), ...overrides,
  }, prepare })
  state.reassignmentError = null
  state.savedReassignments = []
  await page.route(`**/api/v1/procurement/requisitions/${formRecordId}/`, async route => {
    if (route.request().method() !== 'PATCH') return route.fallback()
    const body = bodyOf(route.request())
    state.requests.push({ path: `/api/v1/procurement/requisitions/${formRecordId}/`, method: 'PATCH', body })
    if (state.reassignmentError) return route.fulfill({ status: 400, json: { approval_reassignments: [state.reassignmentError] } })
    const commands = body.approval_reassignments || []
    const workflow = state.record.approval_workflow_config.map((row, index) => {
      const command = commands.find(item => item.stage_index === index)
      if (!command) return row
      const employee = [replacement, second].find(user => user.id === command.user_id)
      const updated = { ...row, user_id: employee.id, user_name: employee.full_name, user_email: employee.email, status: 'pending', assignment_id: `new-assignment-${index}` }
      delete updated.external
      delete updated.source
      return updated
    })
    state.savedReassignments.push(...commands)
    const { approval_reassignments: omitted, ...fields } = body
    void omitted
    state.record = { ...state.record, ...fields, approval_workflow_config: withSnapshots(workflow) }
    await route.fulfill({ json: state.record })
  })
  await expect(page.getByRole('heading', { name: 'Edit purchase recommendation', exact: true })).toBeVisible()
  await page.getByRole('navigation', { name: 'Recommendation steps' }).getByRole('button', { name: /Approval & submit/ }).click()
  return state
}

async function select(page, role, employee) {
  await pending(page).getByRole('button', { name: `Change ${role} approver`, exact: true }).click()
  await pending(page).getByRole('textbox', { name: `Search approver for ${role}`, exact: true }).fill(employee.full_name)
  await pending(page).getByRole('button', { name: new RegExp(employee.full_name) }).click()
}

test('pending approvers are searchable and save once without rewriting completed decisions or source evidence', async ({ page }) => {
  const state = await open(page)
  const original = structuredClone(state.record)
  await expect(page.locator('[aria-label="Recorded approval history"]')).toContainText('Richa Hannah Thomas')
  await expect(page.locator('[aria-label="Recorded approval history"]')).toContainText('Samir Ali')
  await expect(pending(page).getByRole('button', { name: /^Change .* approver$/ })).toHaveCount(3)
  // The real development App deliberately mounts effects twice in StrictMode.
  // Local searches and saves must not add lookups or load unrelated role lists.
  await expect(pending(page).getByRole('button', { name: `Change ${rows[2].role} approver`, exact: true })).toBeEnabled()
  const initialLookupCount = state.approverRoles.length
  await select(page, rows[2].role, replacement)
  await select(page, rows[4].role, second)
  expect([...new Set(state.approverRoles)]).toEqual(['any_active'])
  expect(state.approverRoles).toHaveLength(initialLookupCount)
  await page.clock.runFor(35000)
  expect(assignments(state)).toEqual([])
  await page.screenshot({ path: '../artifacts/pr-pending-approver-reassignment.png' })
  await save(page).click()
  await expect.poll(() => assignments(state).length).toBe(1)
  expect(assignments(state)[0].body).toEqual({ approval_reassignments: [
    { ...snapshot(rows[2], 2), user_id: replacement.id }, { ...snapshot(rows[4], 4), user_id: second.id },
  ] })
  await expect(pending(page).getByText('Unsaved reassignment', { exact: false })).toHaveCount(0)
  expect(state.record.approval_workflow_config.slice(0, 2)).toEqual(original.approval_workflow_config.slice(0, 2))
  expect(state.record.price_remarks_data).toEqual(original.price_remarks_data)
  await expect(pending(page)).toContainText(replacement.full_name)
  await save(page).click()
  await expect.poll(() => assignments(state).length).toBe(2)
  expect(assignments(state)[1].body).not.toHaveProperty('approval_reassignments')
  expect(state.savedReassignments).toHaveLength(2)
  expect(state.approverRoles).toHaveLength(initialLookupCount)
  clean(state)
})

test('reassigning an unrecorded source row starts an internal assignment while original PDF evidence stays unchanged', async ({ page }) => {
  const sourceRows = rows.map((row, index) => ({ ...row, external: true, source: 'signed_purchase_requisition_pdf', ...(index === 3 ? { status: 'not_recorded', user_id: null } : {}) }))
  const sourceMetadata = { import_source: 'signed_pr_pdf', signed_document_verification: { signed_off: false, source_approval_rows: sourceRows }, signed_approval_evidence: { signatures: { pd: true, pm: true, mop: false } } }
  const state = await open(page, { approval_workflow_config: withSnapshots(sourceRows), price_remarks_data: sourceMetadata })
  await select(page, rows[3].role, replacement)
  await expect(pending(page)).toContainText('It does not verify a signature on the PDF.')
  await save(page).click()
  await expect.poll(() => assignments(state).length).toBe(1)
  expect(Object.keys(assignments(state)[0].body)).toEqual(['approval_reassignments'])
  await expect(pending(page).getByText('Unsaved reassignment', { exact: false })).toHaveCount(0)
  expect(state.record.price_remarks_data).toEqual(sourceMetadata)
  expect(state.record.approval_workflow_config[3]).toMatchObject({ user_id: replacement.id, status: 'pending' })
  expect(state.record.approval_workflow_config[3]).not.toHaveProperty('external')
  expect(state.requests.filter(request => request.path.endsWith('/source-approvals/'))).toEqual([])
  clean(state)
})

test('a rejected reassignment retains the selected replacement and never retries automatically', async ({ page }) => {
  const state = await open(page)
  await select(page, rows[2].role, replacement)
  state.reassignmentError = 'This approval assignment changed. Reload the record before reassigning it.'
  await save(page).click()
  await expect(page.getByRole('dialog', { name: 'Notification' })).toContainText('This approval assignment changed.')
  await page.getByRole('button', { name: 'OK', exact: true }).click()
  await expect(pending(page)).toContainText(replacement.full_name)
  await expect(pending(page)).toContainText('Unsaved reassignment')
  await page.clock.runFor(35000)
  expect(assignments(state)).toHaveLength(1)
  expect(state.savedReassignments).toEqual([])
  clean(state)
})

test('an unchanged legacy line total cannot block reassignment or be rewritten by its save', async ({ page }) => {
  const items = [{ description: 'Historical amount mismatch', quantity: '2', unit: 'LS', unit_price: '400000.00', total: '400000.00' }]
  const state = await open(page, { items })
  await select(page, rows[2].role, replacement)
  await save(page).click()
  await expect.poll(() => assignments(state).length).toBe(1)
  expect(assignments(state)[0].body).toEqual({ approval_reassignments: [{ ...snapshot(rows[2], 2), user_id: replacement.id }] })
  await expect(pending(page).getByText('Unsaved reassignment', { exact: false })).toHaveCount(0)
  expect(state.record.items).toEqual(items)
  expect(state.record.total_price).toBe('400000.00')
  clean(state)
})

test('verifying source evidence clears its queued assignment and retains changes to other pending stages', async ({ page }) => {
  const sourceRows = rows.map((row, index) => ({ ...row, external: true, source: 'signed_purchase_requisition_pdf',
    ...(index === 3 ? { status: 'not_recorded', user_id: null, user_name: '' } : {}) }))
  const contentPath = `/api/v1/procurement/requisitions/${formRecordId}/uploaded-documents/0/content/`
  const originalUrl = 'http://127.0.0.1:5173/__fixtures/reassignment-source.pdf'
  const digest = 'synthetic-source-digest'
  const pdf = mixedSizePdf(1)
  await page.context().route('**/__fixtures/reassignment-source.pdf', route => route.fulfill({ contentType: 'application/pdf', body: pdf }))
  const state = await open(page, {
    approval_workflow_config: withSnapshots(sourceRows),
    attachments: [{ filename: 'reassignment-source.pdf', type: 'signed_purchase_requisition_pdf', document_type: 'signed_purchase_requisition_pdf', url: originalUrl, content_url: contentPath, sha256: digest }],
    price_remarks_data: { import_source: 'signed_pr_pdf', signed_document_verification: { document_sha256: digest, signed_off: false, source_approval_rows: sourceRows } },
  }, state => {
    state.originalContent[contentPath] = { body: pdf }
    state.saveSourceApproval = (body, record) => {
      const reviewed = record.price_remarks_data.signed_document_verification.source_approval_rows.map((row, index) => index === body.row_index
        ? { ...row, user_name: body.approver_name, signature_verified: true, status: 'approved', approved_at: `${body.approval_date}T12:00:00Z` } : row)
      return { ...record, approval_workflow_config: withSnapshots(reviewed),
        price_remarks_data: { ...record.price_remarks_data, signed_document_verification: { ...record.price_remarks_data.signed_document_verification, source_approval_rows: reviewed } } }
    }
  })
  await select(page, rows[3].role, replacement)
  await select(page, rows[4].role, second)
  const history = page.locator('[aria-label="Recorded approval history"]')
  await history.getByRole('button', { name: `Edit ${rows[3].role} approval record`, exact: true }).click()
  await history.getByRole('textbox', { name: 'Approver name', exact: true }).fill('Verified original reviewer')
  await history.getByRole('checkbox', { name: 'I verified this signature on the original PDF', exact: true }).check()
  await history.getByLabel('Approval date', { exact: true }).fill('2026-09-14')
  await history.getByRole('button', { name: 'Save approval record', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Queued reassignment changes were cleared' })).toBeVisible()
  await expect(pending(page).getByRole('button', { name: `Change ${rows[3].role} approver`, exact: true })).toHaveCount(0)
  await expect(pending(page)).toContainText(second.full_name)
  await expect(pending(page).getByText('Unsaved reassignment', { exact: false })).toHaveCount(1)
  await save(page).click()
  await expect.poll(() => assignments(state).length).toBe(1)
  expect(assignments(state)[0].body).toEqual({ approval_reassignments: [{ ...snapshot(sourceRows[4], 4), user_id: second.id }] })
  expect(state.record.approval_workflow_config[3]).toMatchObject({ user_name: 'Verified original reviewer', status: 'approved', signature_verified: true })
  expect(state.requests.filter(request => request.path.endsWith('/source-approvals/'))).toHaveLength(1)
  clean(state)
})

for (const status of ['approved', 'converted']) test(`${status} records keep history without offering pending reassignment`, async ({ page }) => {
  const state = await open(page, { status, can_reassign_approvers: false, reassignable_approval_stage_indices: [] })
  await expect(pending(page)).toHaveCount(0)
  await expect(page.locator('[aria-label="Recorded approval history"]')).toContainText('Richa Hannah Thomas')
  await page.clock.runFor(35000)
  expect(assignments(state)).toEqual([])
  clean(state)
})
