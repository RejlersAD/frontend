import test from 'node:test'
import assert from 'node:assert/strict'
import { APPROVAL_TYPES } from '../src/config/approvalsSystem.config.js'
import { approvalDetails, approvalsCsv, filterApprovals, formatAge, normalizeApproval, sortApprovals, timestamp } from '../src/components/approvals/approvalQueue.js'

const NOW = Date.parse('2026-09-14T12:00:00Z')
const configFor = id => Object.values(APPROVAL_TYPES).find(config => config.id === id)
const row = (type, raw = {}) => normalizeApproval({ id: 'request-1', ...raw }, configFor(type), NOW)
const filters = overrides => ({ search: '', tab: 'all', queue: 'all', priority: 'all', age: 'all', amount: 'all', requester: 'all', ...overrides })
const hoursAgo = value => new Date(NOW - value * 3600000).toISOString()

test('leave decision permission uses the strict server can_review flag', () => {
  for (const can_review of [false, undefined, null, 'true', 1]) {
    assert.equal(row('leave', { status: 'PENDING', can_review })._canDecide, false)
  }
  assert.equal(row('leave', { status: 'PENDING', can_review: true })._canDecide, true)
})

test('PO decisions need strict can_approve, independent of amount, priority or stage title', () => {
  for (const can_approve of [false, undefined, null, 'true', 1]) {
    assert.equal(row('purchase_order', { can_approve, approval_stage: 'Final Management Sign-off', total_amount: '9000000', priority: 'urgent' })._canDecide, false)
  }
  assert.equal(row('purchase_order', { can_approve: true, approval_stage: 'Financial Approval' })._canDecide, true)
})

test('PR current-user queue semantics preserve assignment while honoring explicit negative flags', () => {
  assert.equal(row('procurement', { status: 'in_review' })._canDecide, true)
  assert.equal(row('procurement', { status: 'in_review', can_approve: false })._canDecide, false)
  assert.equal(row('procurement', { status: 'in_review', can_review: false })._canDecide, false)
  const converted = row('procurement', { status: 'converted', approval_workflow_config: [{ status: 'pending', evidence_requested_at: '2026-09-14T10:00:00Z' }] })
  assert.equal(converted._canDecide, true)
  assert.equal(converted.status, 'converted')
})

test('unconnected payroll and invoice registers do not become actionable', () => {
  for (const type of ['payroll', 'invoice']) {
    assert.equal(row(type, { can_review: true, can_approve: true, status: 'pending_approval', approval_status: 'pending_approval' })._canDecide, false)
  }
})

test('queue identities retain separate PO stages and distinguish request types', () => {
  const rows = [row('purchase_order', { id: 'same', approval_queue_id: 'same:0', approval_stage: 'Technical Approval' }),
    row('purchase_order', { id: 'same', approval_queue_id: 'same:1', approval_stage: 'Financial Approval' }),
    row('procurement', { id: 'same' }), row('leave', { id: 'same' })]
  assert.equal(new Set(rows.map(item => item._queueKey)).size, 4)
  assert.equal(rows[1].approval_stage, 'Financial Approval')
  assert.equal(rows[1]._queueKey, 'purchase_order:same:1')
})

test('normalization does not mutate raw records or their workflow evidence', () => {
  const raw = { id: 'pr', total_price: '0.00', estimated_budget: '90.00', approval_workflow_config: [{ level: 1, status: 'approved', approved_at: '2026-09-12T12:00:00Z' }] }
  const before = structuredClone(raw)
  normalizeApproval(raw, configFor('procurement'), NOW)
  assert.deepEqual(raw, before)
  assert.equal(raw._queueKey, undefined)
})

test('recorded zero PR price is preserved instead of falling through to estimated budget', () => {
  const item = row('procurement', { total_price: 0, estimated_budget: '12500', currency: 'AED' })
  assert.equal(item.total_estimated_cost, 0)
  assert.equal(item._details.amount, 0)
  assert.equal(item._details.amountText, 'AED 0.00')
})

test('only missing PR price falls back to recorded estimated budget', () => {
  assert.equal(row('procurement', { total_price: null, estimated_budget: '52.15', currency: 'EUR' })._details.amount, 52.15)
  assert.equal(row('procurement', { total_price: null, estimated_budget: null })._details.amount, null)
  assert.equal(row('purchase_order', { total_amount: 'not-a-number', currency: 'USD' })._details.amount, null)
})

test('original currency is normalized without FX or invented AED', () => {
  assert.equal(row('purchase_order', { total_amount: '325.75', currency: 'usd' })._details.amountText, 'USD 325.75')
  const unspecified = row('purchase_order', { total_amount: '325.75', currency: null })._details
  assert.equal(unspecified.currency, null)
  assert.equal(unspecified.amountText, 'Currency not recorded 325.75')
})

test('padded currency codes normalize to their original code, and whitespace is missing currency', () => {
  assert.equal(row('purchase_order', { total_amount: '2.00', currency: ' usd ' })._details.currency, 'USD')
  const missing = row('procurement', { total_price: '2.00', currency: ' \t ' })._details
  assert.equal(missing.currency, null)
  assert.equal(missing.amountText, 'Currency not recorded 2.00')
})

test('nonmonetary leave/document fields are not interpreted as transaction amounts', () => {
  assert.equal(row('leave', { days_requested: 5, amount: 500, currency: 'AED' })._details.amount, null)
  assert.equal(row('profile_document', { document_number: '123456', total_amount: 500 })._details.amount, null)
})

test('missing, invalid and future record dates remain unknown ages', () => {
  for (const created_at of [undefined, null, '', 'not-a-date', '2026-09-15T12:00:00Z']) {
    const details = row('leave', { created_at })._details
    assert.equal(details.ageHours, null)
    assert.equal(details.ageLabel, 'Age unknown')
  }
  assert.equal(timestamp('not-a-date'), null)
})

test('age is based on the real recorded timestamp and retains its basis', () => {
  const item = row('leave', { created_at: hoursAgo(49.5) })
  assert.equal(item._details.ageHours, 49.5)
  assert.equal(item._details.ageBasis, 'Record age')
  assert.equal(item._details.ageLabel, '49h')
  const submitted = row('procurement', { created_at: hoursAgo(80), submitted_at: hoursAgo(3) })
  assert.equal(submitted._details.ageHours, 3)
  assert.equal(submitted._details.ageBasis, 'Since submission')
  assert.equal(formatAge(0), '<1h')
  assert.equal(formatAge(72), '3d')
})

test('only PR review_due_at establishes an approval deadline, with strict timestamp boundary', () => {
  assert.equal(row('procurement', { review_due_at: hoursAgo(1) })._details.overdue, true)
  assert.equal(row('procurement', { review_due_at: new Date(NOW).toISOString() })._details.overdue, false)
  const future = row('procurement', { review_due_at: new Date(NOW + 3600000).toISOString() })._details
  assert.equal(future.dueTime, NOW + 3600000)
  assert.equal(future.overdue, false)
  const startOfLocalDay = new Date(NOW)
  startOfLocalDay.setHours(0, 0, 0, 0)
  assert.equal(approvalDetails({ _approvalType: 'procurement', review_due_at: startOfLocalDay.toISOString() }, NOW).dueToday, true)
})

test('delivery, leave, payment and identity expiry dates do not become approval deadlines', () => {
  for (const type of ['procurement', 'purchase_order', 'leave', 'invoice', 'profile_document']) {
    const details = row(type, { expected_delivery: '2026-01-01', required_date: '2026-01-01', start_date: '2026-01-01', due_date: '2026-01-01', expiry_date: '2026-01-01' })._details
    assert.equal(details.dueTime, null)
    assert.equal(details.overdue, false)
  }
})

test('priority remains recorded rather than inferred from old or missing dates', () => {
  assert.equal(row('leave', { created_at: hoursAgo(900) })._details.priority.code, 'unknown')
  assert.equal(row('procurement', { priority: 'high' })._details.priority.code, 'high')
  assert.equal(row('procurement', { priority: 'medium' })._details.priority.label, 'Medium')
})

test('Leave HR stage respects direct HR routing and manager completion', () => {
  assert.equal(row('leave', { status: 'PENDING', review_stage: 'hr_review' })._details.stageLabel, 'HR Review')
  assert.equal(row('leave', { status: 'RM_APPROVED' })._details.stageLabel, 'HR Review')
  assert.equal(row('leave', { status: 'PENDING', review_stage: 'manager_review' })._details.stageLabel, 'Manager Review')
})

test('supplier names do not masquerade as requesters', () => {
  const details = row('purchase_order', { vendor_name: 'Supplier only', supplier_name: 'Supplier only' })._details
  assert.equal(details.requester, 'Not recorded')
  assert.equal(row('purchase_order', { created_by_name: 'Recorded creator' })._details.requester, 'Recorded creator')
})

test('My approvals applies actionability while All available preserves visible nonactionable rows', () => {
  const own = row('leave', { id: 'own', can_review: false })
  const assigned = row('leave', { id: 'report', can_review: true })
  assert.deepEqual(filterApprovals([own, assigned], filters({ tab: 'mine' })).map(item => item.id), ['report'])
  assert.equal(filterApprovals([own, assigned], filters()).length, 2)
})

test('age filter boundaries have no overlap and exclude unknown dates', () => {
  const items = [0, 23.99, 24, 71.99, 72].map((hours, index) => row('leave', { id: String(index), created_at: hoursAgo(hours) }))
  items.push(row('leave', { id: 'unknown' }))
  assert.deepEqual(filterApprovals(items, filters({ age: '24h' })).map(item => item.id), ['0', '1'])
  assert.deepEqual(filterApprovals(items, filters({ age: '1-3d' })).map(item => item.id), ['2', '3'])
  assert.deepEqual(filterApprovals(items, filters({ age: '3d' })).map(item => item.id), ['4'])
  assert.deepEqual(filterApprovals(items, filters({ age: 'unknown' })).map(item => item.id), ['unknown'])
})

test('amount filters never compare different currencies and retain a recorded zero', () => {
  const items = [row('procurement', { id: 'zero', total_price: '0', currency: 'USD' }),
    row('purchase_order', { id: 'usd', total_amount: '100000', currency: 'USD' }),
    row('purchase_order', { id: 'aed', total_amount: '500000', currency: 'AED' }), row('leave', { id: 'none' })]
  assert.deepEqual(filterApprovals(items, filters({ amount: 'USD:high' })).map(item => item.id), ['usd'])
  assert.deepEqual(filterApprovals(items, filters({ amount: 'USD:low' })).map(item => item.id), ['zero'])
  assert.deepEqual(filterApprovals(items, filters({ amount: 'none' })).map(item => item.id), ['none'])
  assert.equal(filterApprovals(items, filters({ amount: 'recorded' })).length, 3)
})

test('queue, requester and search filters intersect without matching hidden narrative fields', () => {
  const items = [row('procurement', { id: 'a', pr_number: 'PR-A', requester_name: 'Original', issued_by_name: 'Requester A', department: 'Engineering', priority: 'high', signature: 'hidden-only-marker' }),
    row('procurement', { id: 'b', pr_number: 'PR-B', issued_by_name: 'Requester B', department: 'Finance', priority: 'normal' })]
  assert.deepEqual(filterApprovals(items, filters({ queue: 'procurement', requester: 'Requester A', search: 'engineering', priority: 'high' })).map(item => item.id), ['a'])
  assert.equal(filterApprovals(items, filters({ search: 'hidden-only-marker' })).length, 0)
  assert.equal(filterApprovals(items, filters({ tab: 'leave' })).length, 0)
})

test('sort prioritizes recorded priority, actual overdue deadlines and older records without mutating rows', () => {
  const items = [row('procurement', { id: 'old', priority: 'high', created_at: hoursAgo(48) }),
    row('procurement', { id: 'overdue', priority: 'high', created_at: hoursAgo(1), review_due_at: hoursAgo(0.5) }),
    row('procurement', { id: 'urgent', priority: 'urgent' }), row('leave', { id: 'unknown', created_at: hoursAgo(500) })]
  assert.deepEqual(sortApprovals(items).map(item => item.id), ['urgent', 'overdue', 'old', 'unknown'])
  assert.deepEqual(items.map(item => item.id), ['old', 'overdue', 'urgent', 'unknown'])
})

test('CSV export escapes spreadsheet formulas, quotes and newlines without exporting source evidence', () => {
  for (const prefix of ['=1+1', '+SUM(A1)', '-SUM(A1)', '@SUM(A1)', '  =1+1', '\t=1+1', '\r=1+1', '\n=1+1']) {
    const item = row('procurement', { pr_number: prefix, title: 'Quoted "text",\nnext line', issued_by_name: 'Requester', total_price: '0', currency: 'USD', signature: 'secret-signature', attachment: 'secret-document-url' })
    const csv = approvalsCsv([item])
    assert.ok(csv.startsWith('\uFEFF'))
    assert.ok(csv.includes(`"'${prefix}"`))
    assert.ok(csv.includes('"Quoted ""text"",\nnext line"'))
    assert.ok(csv.includes('"0","USD"'))
    assert.ok(!csv.includes('secret-signature'))
    assert.ok(!csv.includes('secret-document-url'))
  }
})

test('CSV preserves unknown numeric/date fields as empty cells rather than zero or fabricated dates', () => {
  const csv = approvalsCsv([row('leave', { id: 'unknown', can_review: false })])
  const line = csv.split('\r\n')[1]
  assert.ok(line.endsWith(',"","","","leave:unknown"'))
  assert.ok(!line.includes('1970'))
})
