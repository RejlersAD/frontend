import assert from 'node:assert/strict';
import test from 'node:test';
import { recommendationSourceApprovals } from '../src/pages/Procurement/recommendationApprovalEvidence.js';
import { normalizeRegisterRecord } from '../src/pages/Procurement/procurementRegisterModel.js';

const source = { role: 'PM', user_name: 'Source Approver', status: 'approved', approved_at: '2026-01-29T12:00:00Z', external: true, source: 'signed_purchase_requisition_pdf' };
const record = rows => ({ id: 'source-pr', status: 'draft', approval_workflow_config: [], price_remarks_data: { signed_document_verification: { signed_off: false, source_approval_rows: rows } } });

test('partial source approvals appear in history without creating active workflow or changing status', () => {
  const normalized = normalizeRegisterRecord(record([source, { ...source, role: 'VP', user_name: 'Other Approver', signature_verified: false }]), 'purchaseRequisitions');
  assert.equal(normalized.status, 'draft');
  assert.equal(normalized.approvalSteps.length, 0);
  assert.equal(normalized.approvalRecovery, false);
  assert.deepEqual(normalized.approvalHistory, [
    { label: 'PM', assignee: 'Source Approver', status: 'approved', date: source.approved_at },
    { label: 'VP', assignee: 'Other Approver', status: 'not_recorded', date: null },
  ]);
});

test('source fallback excludes unrelated records and does not replace active approval history', () => {
  assert.deepEqual(recommendationSourceApprovals(record([null, {}, { ...source, external: false }, { ...source, source: 'other' }])), []);
  const raw = { ...record([source]), status: 'in_review', approval_workflow_config: [{ role: 'Engineering', user_name: 'Current Approver', status: 'pending' }] };
  const normalized = normalizeRegisterRecord(raw, 'purchaseRequisitions');
  assert.equal(normalized.approvalSteps[0].assignee, 'Current Approver');
  assert.deepEqual(normalized.approvalHistory, []);
});
