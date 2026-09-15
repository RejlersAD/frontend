import assert from 'node:assert/strict';
import test from 'node:test';
import { filterRegisterRecords, formatRegisterDate, formatRegisterMoney, normalizeRegisterRecord, registerMetrics } from '../src/pages/Procurement/procurementRegisterModel.js';

const now = new Date('2026-09-15T12:00:00Z');
const normalize = (raw, user = 42) => normalizeRegisterRecord({ id: 'po-1', status: 'draft', ...raw }, 'purchaseOrders', user, now);

test('an order without fulfilment evidence does not claim receipt or matching values', () => {
  const record = normalize({ status: 'completed', total_amount: '100', currency: 'AED', invoice_status: 'fully_invoiced' });
  assert.equal(record.receiptPercent, null);
  assert.equal(record.invoiceMatch, null);
  assert.equal(record.approvalSummary, 'not_recorded');
  assert.equal(record.ageDays, null);
});

test('awaiting approval follows live approval assignment without inventing a PO status', () => {
  const record = normalize({ approval_log: [{ stage: 'Technical', status: 'Approved', level: 0 }, { stage: 'Financial', status: 'Pending', level: 1 }], can_approve: true });
  assert.equal(record.status, 'draft');
  assert.equal(record.statusLabel, 'Awaiting approval');
  assert.equal(record.awaitingApproval, true);
  assert.equal(record.mine, true);
  assert.equal(record.primaryAction, 'review');
  assert.equal(record.approvalSteps.filter(step => step.active).length, 1);
  const cards = registerMetrics([record]);
  assert.equal(cards.find(card => card.key === 'draft').value, 0);
  assert.equal(cards.find(card => card.key === 'review').value, 1);
});

test('recorded final approval takes precedence over stale pending log entries', () => {
  const record = normalize({ approved_at: '2026-09-10T10:00:00Z', approval_log: [{ status: 'Pending' }] });
  assert.equal(record.awaitingApproval, false);
  assert.equal(record.approvalSummary, 'approved');
  assert.equal(record.nextStep, 'Ready to issue');
});

test('unconfirmed issued orders show awaiting acknowledgement without an invented deadline', () => {
  const issued = normalize({ status: 'sent', po_date: '2026-09-01' });
  assert.equal(issued.awaitingAcknowledgement, true);
  assert.equal(issued.nextStep, 'Confirm supplier acknowledgement');
  assert.equal(issued.isDeliveryOverdue, false);
  assert.equal(normalize({ status: 'sent', confirmation_date: '2026-09-12' }).awaitingAcknowledgement, false);
});

test('currency totals stay separate and invalid imported currencies are disclosed', () => {
  const records = [normalize({ total_amount: '100', currency: 'AED' }), normalize({ total_amount: '50', currency: 'USD' }), normalize({ total_amount: '999', currency: '138' })];
  const metric = registerMetrics(records).at(-1);
  assert.equal(metric.value, '2 currencies');
  assert.deepEqual(metric.currencyTotals, [{ currency: 'AED', amount: 100 }, { currency: 'USD', amount: 50 }]);
  assert.equal(metric.unverifiedCount, 1);
  assert.match(metric.description, /1 record needs value verification/);
  assert.equal(records[2].currencyValid, false);
  assert.equal(formatRegisterMoney(999, '138'), '999 · currency unverified');
  assert.equal(formatRegisterMoney(0, 'AED'), 'AED 0');
  assert.equal(formatRegisterMoney('', 'AED'), '—');
});

test('delivery filters respect date-only deadlines, missing dates, and closed orders', () => {
  const records = [normalize({ id: 'yesterday', expected_delivery: '2026-09-14' }), normalize({ id: 'today', expected_delivery: '2026-09-15' }), normalize({ id: 'future', expected_delivery: '2026-09-29' }), normalize({ id: 'far', expected_delivery: '2026-10-10' }), normalize({ id: 'closed', status: 'cancelled', expected_delivery: '2026-09-10' }), normalize({ id: 'undated' })];
  const ids = filters => filterRegisterRecords(records, filters, 42, now).map(record => record.id);
  assert.deepEqual(ids({ delivery: 'overdue' }), ['yesterday']);
  assert.deepEqual(ids({ delivery: 'next14' }), ['today', 'future']);
  assert.deepEqual(ids({ delivery: 'undated' }), ['undated']);
});

test('search, saved view, owner and project filters compose', () => {
  const records = [normalize({ id: 'mine', status: 'sent', title: 'Software', vendor_name: 'Global Supplier', enterprise_project: 15, enterprise_project_code: '5900985', created_by: 42 }), normalize({ id: 'other', status: 'sent', title: 'Software', created_by: 43 }), normalize({ id: 'closed', status: 'completed', title: 'Software', created_by: 42 })];
  assert.deepEqual(filterRegisterRecords(records, { search: 'software', savedView: 'open', myActions: true, project: 'core:15' }, 42, now).map(record => record.id), ['mine']);
  assert.equal(filterRegisterRecords(records, { myActions: true }, null, now).length, 0);
});

test('item totals use recorded values or documented quantity/rate/discount arithmetic', () => {
  const { items } = normalize({ items: [{ line_code: '001', description: 'Services', quantity: 2, unit_price: 50, discount: 10, uom: 'LOT' }, { description: 'Unknown price', quantity: 1 }, { description: 'Explicit zero', quantity: 1, unit_price: 20, total_price: 0 }] });
  assert.equal(items[0].total, 90);
  assert.equal(items[0].id, '001');
  assert.equal(items[1].total, null);
  assert.equal(items[2].total, 0);
});

test('date rendering rejects corrupt dates and age uses record creation date', () => {
  assert.equal(formatRegisterDate('2026-02-30'), '—');
  assert.equal(formatRegisterDate('nonsense'), '—');
  assert.equal(formatRegisterDate('2026-09-15'), '15 Sept 2026');
  assert.equal(normalize({ created_at: '2026-09-04T10:00:00Z', po_date: '2026-08-01' }).ageDays, 11);
});

test('PR review state is derived from actual API fields when summary is absent', () => {
  const record = normalizeRegisterRecord({ status: 'in_review', review_due_at: '2026-09-14T09:00:00Z', approval_workflow_config: [{ level: 1, user_id: 42, status: 'pending' }] }, 'purchaseRequisitions', 42, now);
  assert.equal(record.approvalSummary, 'overdue');
  assert.equal(record.statusLabel, 'Review overdue');
  assert.equal(record.mine, true);
});

const recommendation = (raw = {}, user = 42) => normalizeRegisterRecord({
  id: 'pr-1', pr_number: 'RAD-PRJ-PR-0001_2026', status: 'draft',
  product_service: 'Engineering software', project_department: '5900985',
  issued_by: 42, requester_name: 'Requesting Employee', created_at: '2026-09-01T09:00:00Z',
  supplier_name: 'Recorded Supplier', vendor: 'vendor-1', vendor_details: { id: 'vendor-1', name: 'Recorded Supplier', status: 'active' },
  total_price: '1000', currency: 'AED', po_applicable: true,
  approval_workflow_config: [{ level: 1, stage: 'Technical review', user_id: 43, user_name: 'Assigned Reviewer', status: 'pending' }],
  ...raw,
}, 'purchaseRequisitions', user, now);

test('PR draft assignments are configuration until submission and requester is not relabelled as buyer', () => {
  const draft = recommendation({}, 43);
  assert.equal(draft.requester, 'Requesting Employee');
  assert.equal(draft.buyer, 'Not assigned');
  assert.equal(draft.currentOwner, 'Requesting Employee');
  assert.equal(draft.approvalSteps[0].active, false);
  assert.equal(draft.mine, false);
  assert.equal(draft.nextStep, 'Submit for approval');
  assert.equal(recommendation({}, 42).mine, true);
});

test('parallel PR approval ownership follows lowest pending level including legacy labels', () => {
  const workflow = [
    { stage: 'Level 1 - Approver 1', user_id: 43, user_name: 'First Reviewer', status: 'pending' },
    { stage: 'Level 1 - Approver 2', user_id: 44, user_name: 'Parallel Reviewer', status: 'pending' },
    { level: 2, stage: 'Final', user_id: 42, user_name: 'Later Reviewer', status: 'pending' },
  ];
  const record = recommendation({ status: 'submitted', approval_workflow_config: workflow }, 44);
  assert.equal(record.currentOwner, 'First Reviewer, Parallel Reviewer');
  assert.deepEqual(record.currentOwnerIds, ['43', '44']);
  assert.equal(record.mine, true);
  assert.equal(recommendation({ status: 'submitted', approval_workflow_config: workflow }, 42).mine, false);
});

test('a past PR required date or urgent priority does not create a review deadline', () => {
  const record = recommendation({ status: 'submitted', priority: 'urgent', required_date: '2026-08-01' });
  assert.equal(record.approvalSummary, 'under_review');
  assert.equal(record.exceptionReasons.includes('Approval review overdue'), false);
  assert.equal(filterRegisterRecords([record], { status: 'overdue' }, 42, now).length, 0);
  const returnedToReview = recommendation({ status: 'in_review', approved_at: '2026-09-01T09:00:00Z', review_due_at: '2026-09-14T09:00:00Z' });
  assert.equal(returnedToReview.approvalSummary, 'overdue');
  assert.equal(returnedToReview.exceptionReasons.includes('Approval review overdue'), true);
});

test('Ready for PO requires recorded conversion checks and is a subset of approved', () => {
  const complete = { status: 'approved', approved_at: '2026-09-14T09:00:00Z', approval_workflow_config: [{ stage: 'Approval', user_id: 43, user_name: 'Reviewer', status: 'approved', approved_at: '2026-09-14T09:00:00Z' }] };
  const ready = recommendation(complete);
  assert.equal(ready.readyForPO, true);
  assert.equal(ready.primaryAction, 'convert');
  assert.equal(ready.readiness.length, 6);
  assert.equal(ready.readiness.every(check => check.ready === true), true);
  assert.equal(recommendation({ ...complete, vendor: null, vendor_details: null }).readyForPO, false);
  assert.equal(recommendation({ ...complete, vendor_details: { id: 'vendor-1', status: 'inactive' } }).readyForPO, false);
  assert.equal(recommendation({ ...complete, total_price: '0' }).readyForPO, false);
  assert.equal(recommendation({ ...complete, currency: '138' }).readyForPO, false);
  assert.equal(recommendation({ ...complete, approval_workflow_config: [] }).readyForPO, false);
  assert.equal(recommendation({ ...complete, po_applicable: false }).readyForPO, false);
  assert.equal(recommendation({ ...complete, linked_po_id: 'po-existing' }).readyForPO, false);
  assert.equal(recommendation({ ...complete, po_number_reference: 'RAD-PRJ-PUR-0001_2026' }).readyForPO, false);
  assert.equal(recommendation({ ...complete, pr_number: 'IMPORTED-123' }).readyForPO, false);
  assert.equal(recommendation({ ...complete, status: 'draft' }).readyForPO, false);
  const metrics = registerMetrics([ready, recommendation()], 'purchaseRequisitions');
  assert.deepEqual(metrics.map(metric => metric.key), ['all', 'draft', 'review', 'approved', 'ready_for_po', 'converted', 'exceptions']);
  assert.equal(metrics.find(metric => metric.key === 'ready_for_po').value, 1);
  assert.equal(metrics.find(metric => metric.key === 'approved').value, 1);
});

test('historical converted PRs do not invent approvals, but explicit evidence recovery remains actionable', () => {
  const converted = recommendation({ status: 'converted', linked_po_id: 'po-existing' }, 43);
  assert.equal(converted.approvalSummary, 'not_recorded');
  assert.equal(converted.approvalSteps[0].status, 'not_recorded');
  assert.equal(converted.approvalSteps[0].active, false);
  assert.equal(converted.mine, false);
  assert.equal(converted.readyForPO, false);
  assert.equal(converted.nextStep, 'Open linked purchase order');
  assert.equal(converted.approvalHistory[0].date, null);
  const recovery = recommendation({ status: 'converted', approval_workflow_config: [{ stage: 'Evidence recovery', user_id: 43, status: 'pending', evidence_requested_at: '2026-09-15T10:00:00Z' }] }, 43);
  assert.equal(recovery.approvalRecovery, true);
  assert.equal(recovery.approvalSummary, 'evidence_requested');
  assert.equal(recovery.mine, true);
  assert.equal(recovery.primaryAction, 'review');
});

test('PR history preserves recorded rejection actor and timestamp', () => {
  const record = recommendation({ status: 'rejected', approval_workflow_config: [{ stage: 'Commercial', user_id: 43, user_name: 'Assigned Reviewer', status: 'rejected', rejected_at: '2026-09-14T10:00:00Z', rejected_by_name: 'Recorded Decision Maker' }] });
  assert.deepEqual(record.approvalHistory, [{ label: 'Commercial', assignee: 'Recorded Decision Maker', status: 'rejected', date: '2026-09-14T10:00:00Z' }]);
  assert.equal(record.currentOwner, 'Requesting Employee');
  assert.equal(record.hasException, true);
});

test('30+ day draft age uses creation date without an invented inactivity SLA', () => {
  const old = recommendation({ id: 'old', created_at: '2026-08-16T09:00:00Z', updated_at: '2026-09-15T10:00:00Z' });
  const young = recommendation({ id: 'young', created_at: '2026-08-17T09:00:00Z' });
  const undated = recommendation({ id: 'undated', created_at: null });
  assert.equal(old.staleDraft, true);
  assert.equal(old.inactiveDays, 0);
  assert.equal(young.staleDraft, false);
  assert.equal(undated.staleDraft, false);
  const rows = [old, young, undated];
  const ids = filters => filterRegisterRecords(rows, filters, 42, now).map(record => record.id);
  assert.deepEqual(ids({ savedView: 'stale' }), ['old']);
  assert.deepEqual(ids({ created: 'older30' }), ['old']);
  assert.deepEqual(ids({ created: 'last30' }), ['young']);
  assert.deepEqual(ids({ created: 'undated' }), ['undated']);
});

test('PR search, requester, created-date and incomplete queues compose with real fields', () => {
  const incomplete = recommendation({ id: 'missing', total_price: null, created_at: '2026-09-15T09:00:00Z' });
  const other = recommendation({ id: 'other', issued_by: 45, requester_name: 'Another Requester' });
  assert.equal(incomplete.incomplete, true);
  assert.ok(incomplete.incompleteFields.includes('Positive recommendation value'));
  const filters = { search: 'Requesting Employee', requester: '42', created: 'today', savedView: 'incomplete' };
  assert.deepEqual(filterRegisterRecords([incomplete, other], filters, 42, now).map(record => record.id), ['missing']);
  assert.deepEqual(filterRegisterRecords([incomplete, other], { savedView: 'my_queue' }, 42, now).map(record => record.id), ['missing']);
});

test('shortlisted suppliers are not quotations and budget is not approved funding', () => {
  const raw = { selected_vendors: [{ vendor_id: 'a', vendor_name: 'Supplier A' }, { vendor_id: 'b', vendor_name: 'Supplier B' }], estimated_budget: '2000' };
  const withoutQuotes = recommendation(raw).decisionSummary;
  assert.equal(withoutQuotes.supplierCount, 2);
  assert.equal(withoutQuotes.quoteCount, null);
  assert.equal(withoutQuotes.managementApproval, null);
  assert.equal(withoutQuotes.budgetCurrency, null);
  const withQuotes = recommendation({ ...raw, price_remarks_data: { comparative_prices: [{ vendor: 'Supplier A', price: 1000 }, { vendor: 'Supplier B', price: 1500 }, { vendor: 'No recorded quote' }] } }).decisionSummary;
  assert.equal(withQuotes.quoteCount, 2);
  assert.equal(withQuotes.managementEvidenceCount, 0);
});
