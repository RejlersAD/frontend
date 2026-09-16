import test from 'node:test'
import assert from 'node:assert/strict'
import { activeApprovalStages, isAssignedApprover, canDecideProcurement, approvalSignatureEvidence, purchaseOrderSignatureEvidence } from '../src/utils/procurementApproval.js'
import { normalizeApproval } from '../src/components/approvals/approvalQueue.js'

const assigned = { level: 0, user_id: 12, user_email: 'assigned@example.test', user_name: 'Assigned User', status: 'pending' }
const ceo = { level: 5, user_id: 99, user_email: 'ceo@example.test', role: 'CEO', status: 'pending' }
const signed = { ...assigned, status: 'approved', approved_by_id: 12, approved_by_email: assigned.user_email, signature_user_id: 12, signature: '/verified-signature.png' }

test('only the lowest pending level is active, retaining original fallback order and parallel assignments', () => {
  assert.deepEqual(activeApprovalStages([ceo, assigned, { ...assigned, user_id: 13 }]).map(row => row.user_id), [12, 13])
  const fallback = [{ status: 'approved' }, { user_id: 12 }, { level: 1, user_id: 99 }]
  assert.deepEqual(activeApprovalStages(fallback).map(row => row.user_id), [99])
})
test('email assignment takes precedence over stale migration IDs', () => {
  assert.equal(isAssignedApprover(assigned, { id: 999, email: 'ASSIGNED@example.test' }), true)
  assert.equal(isAssignedApprover(assigned, { id: 12, email: 'other@example.test' }), false)
  assert.equal(isAssignedApprover({ user_id: '12' }, { user: { id: 12 } }), true)
})
test('CEO and superadmin roles cannot bypass the active assignment for PR or PO', () => {
  const actor = { id: 99, email: ceo.user_email, is_superuser: true, job_title: 'CEO' }
  assert.equal(canDecideProcurement({ can_approve: true, approval_workflow_config: [assigned, ceo] }, actor), false)
  assert.equal(canDecideProcurement({ can_approve: true, approval_log: [assigned, ceo] }, actor, 'po'), false)
  assert.equal(canDecideProcurement({ can_approve: true, approval_workflow_config: [signed, ceo] }, actor), true)
})
test('the API must explicitly allow a decision, including approval queues', () => {
  for (const flag of [undefined, false, 'true']) {
    assert.equal(canDecideProcurement({ can_approve: flag, approval_workflow_config: [assigned] }, { id: 12, email: assigned.user_email }), false)
    assert.equal(normalizeApproval({ can_approve: flag }, { id: 'procurement' })._canDecide, false)
  }
})
test('only verified matching actor evidence renders the workflow signature', () => {
  assert.equal(approvalSignatureEvidence(signed).signature, signed.signature)
  assert.equal(approvalSignatureEvidence({ ...signed, user_id: 999, signature_user_email: assigned.user_email }).verified, true)
  const unknown = approvalSignatureEvidence({ ...assigned, status: 'approved', signature: '/unknown.png' })
  assert.equal(unknown.signature, '')
  assert.equal(unknown.mismatch, false)
})
test('actor, signature owner, and server review conflicts suppress the image', () => {
  for (const patch of [{ approved_by_email: ceo.user_email }, { signature_user_id: 99 }, { signature_review_required: true }]) {
    const evidence = approvalSignatureEvidence({ ...signed, ...patch })
    assert.equal(evidence.signature, '')
    assert.equal(evidence.mismatch, true)
  }
})
test('verified original PDF evidence is retained and never an active workflow stage', () => {
  const source = { external: true, source: 'signed_purchase_requisition_pdf', status: 'approved', signature: '/original.pdf' }
  assert.equal(approvalSignatureEvidence(source).signature, source.signature)
  assert.deepEqual(activeApprovalStages([{ ...source, status: 'pending' }, assigned]), [assigned])
  const poSource = { evidence_document_id: 'doc-1', signature_verified: true, status: 'Approved' }
  assert.equal(purchaseOrderSignatureEvidence({ approval_log: [poSource], approval_signature: '/original-po.pdf' }).signature, '/original-po.pdf')
})
test('PO final signature requires complete prior levels and no review conflicts', () => {
  const final = { ...signed, stage: 'Final Management Sign-off' }
  assert.equal(purchaseOrderSignatureEvidence({ approval_log: [final] }).verified, true)
  assert.equal(purchaseOrderSignatureEvidence({ approval_log: [assigned, final] }).signature, '')
  assert.equal(purchaseOrderSignatureEvidence({ approval_log: [final], signature_review_required: true }).signature, '')
})
test('PO final evidence follows highest numeric level even when workflow order differs', () => {
  const final = { ...signed, level: 5, approved_by_name: 'Assigned User' }
  const result = purchaseOrderSignatureEvidence({ approval_log: [final, { ...signed, level: 0, signature: '/earlier.png' }], approved_by_id: 12, approval_signature: signed.signature })
  assert.equal(result.stage, final)
  assert.equal(result.verified, true)
})
test('PO parallel final approvals use the recorded final actor or latest same-level decision', () => {
  const earlier = { ...signed, level: 5, approved_at: '2026-09-01T09:00:00Z' }
  const later = { ...signed, level: 5, user_id: 99, user_email: ceo.user_email, approved_by_id: 99, approved_by_email: ceo.user_email, signature_user_id: 99, signature: '/ceo.png', approved_at: '2026-09-01T10:00:00Z' }
  assert.equal(purchaseOrderSignatureEvidence({ approval_log: [later, earlier], approved_by_id: 99, approval_signature: later.signature }).stage, later)
  assert.equal(purchaseOrderSignatureEvidence({ approval_log: [later, earlier] }).stage, later)
})
test('PO conflicting final actor, signature or recorded name requires review', () => {
  const final = { ...signed, level: 5, approved_by_name: 'Assigned User' }
  for (const patch of [{ approved_by_id: 99 }, { approval_signature: '/someone-else.png' }, { approved_by_name: 'Someone Else' }]) {
    const result = purchaseOrderSignatureEvidence({ approval_log: [final], ...patch })
    assert.equal(result.mismatch, true)
    assert.equal(result.signature, '')
  }
})
