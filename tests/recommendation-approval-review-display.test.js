import test from 'node:test';
import assert from 'node:assert/strict';
import { approvalLevelLabel, isUnknownApprover, normalizeSourceApprovalReview, recommendationDisplayApprovals, recommendationSourceReview } from '../src/pages/Procurement/recommendationApprovalEvidence.js';

const digest = 'a'.repeat(64);
const sourceRow = { role: 'PM', role_key: 'pm', user_name: 'Project Reviewer', status: 'approved', signature_verified: true, approved_at: '2026-09-01T10:00:00Z', external: true, source: 'signed_purchase_requisition_pdf', step: 1 };
const reviewed = {
  approval_labels: { pm: '1' },
  additional_approver: { name: 'Additional Reviewer', approval_label: '5', signature_verified: true, special_note: 'Name confirmed against the source.' },
};
const record = () => ({
  approval_workflow_config: [],
  price_remarks_data: {
    signed_document_verification: { document_sha256: digest, source_approval_rows: [sourceRow] },
    signed_approval_evidence: { source_approval_review: { document_sha256: digest, review: reviewed } },
  },
});

test('saved Additional and labels appear with Level 0 while raw authority stays unchanged', () => {
  const pr = record();
  const before = structuredClone(pr);
  const rows = recommendationDisplayApprovals(pr);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].user_name, 'Richa Hannah Thomas');
  assert.equal(approvalLevelLabel(rows[0]), 'Level 0');
  assert.equal(rows[0].status, 'not_recorded');
  assert.equal(rows[0].approved_at, null);
  assert.equal(rows[0].user_id, undefined);
  assert.equal(approvalLevelLabel(rows[1]), 'Level 1');
  assert.equal(rows[1].source_row_index, 0);
  assert.equal(rows[1].approved_at, sourceRow.approved_at);
  assert.equal(rows[2].user_name, 'Additional Reviewer');
  assert.equal(rows[2].status, 'verified');
  assert.equal(rows[2].approved_at, null);
  assert.equal(rows[2].special_note, reviewed.additional_approver.special_note);
  assert.deepEqual(pr, before);
});

test('another PDF cannot inherit retained review annotations', () => {
  const pr = record();
  pr.price_remarks_data.signed_document_verification.document_sha256 = 'b'.repeat(64);
  assert.equal(recommendationSourceReview(pr).additional_approver, null);
  assert.equal(recommendationDisplayApprovals(pr).some(row => row.source_review_annotation), false);
});

test('Richa already recorded remains one truthful Level 0 row with its actual decision', () => {
  const workflow = [{ user_id: 'richa-id', user_name: 'Richa Thomas', role: 'Procurement', level: 2, approval_label: '2', status: 'approved', approved_at: '2026-09-02T09:00:00Z' }];
  const rows = recommendationDisplayApprovals({ default_level_zero_approver: { id: 'richa-id', full_name: 'Richa Hannah Thomas' } }, workflow);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'approved');
  assert.equal(rows[0].approved_at, workflow[0].approved_at);
  assert.equal(approvalLevelLabel(rows[0]), 'Level 0');
  assert.equal(workflow[0].level, 2);
});

test('the saved API projection and correction note survive display normalization', () => {
  const pr = record();
  pr.source_approval_review = { ...reviewed, approver_notes: { pm: ' Captured number replaced with name. ' } };
  assert.equal(recommendationDisplayApprovals(pr)[1].special_note, 'Captured number replaced with name.');
  assert.deepEqual(normalizeSourceApprovalReview(), { approval_labels: {}, additional_approver: null });
  const vp = recommendationDisplayApprovals({ source_approval_review: { approval_labels: { vp: '4' }, approver_notes: { vp: 'Level confirmed from PDF.' } } }, [{ role: 'VP', user_name: 'Operations Reviewer', status: 'approved' }])[1];
  assert.equal(approvalLevelLabel(vp), 'Level 4');
  assert.equal(vp.special_note, 'Level confirmed from PDF.');
});

test('unknown identifiers can be corrected without treating a real recorded name as unknown', () => {
  for (const name of ['', 'Unknown', 'Unknown #123', 'Unknown Number', 'Not detected', 'N/A', '1234', '??']) assert.equal(isUnknownApprover(name), true, name);
  for (const name of ['Project Reviewer', 'Richa Thomas', 'John 2 Smith']) assert.equal(isUnknownApprover(name), false, name);
});
