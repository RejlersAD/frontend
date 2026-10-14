import test from 'node:test'
import assert from 'node:assert/strict'
import { canReviewProfileDocument, canDecideOffboardingNotification, payrollApprovalTransitions } from '../src/utils/approvalCapabilities.js'
import { normalizeApproval } from '../src/components/approvals/approvalQueue.js'

test('pending documents fail closed without the server review capability, regardless of admin claims', () => {
  for (const can_review of [undefined, false, 'true']) {
    const document = { id: 4, verification_status: 'pending', can_review, is_superuser: true }
    assert.equal(canReviewProfileDocument(document), false)
    assert.equal(normalizeApproval(document, { id: 'profile_document' })._canDecide, false)
  }
  assert.equal(canReviewProfileDocument({ verification_status: 'pending', can_review: true }), true)
  assert.equal(canReviewProfileDocument({ verification_status: 'verified', can_review: true }), false)
})

test('payroll requires both the current stage and its explicit capability', () => {
  const stages = [
    ['draft', 'can_hr_approve', 'hrApproveRun'],
    ['hr_approved', 'can_finance_approve', 'financeApproveRun'],
    ['finance_approved', 'can_release', 'releaseRun'],
  ]
  for (const [status, capability, fn] of stages) {
    assert.deepEqual(payrollApprovalTransitions({ status, is_superuser: true, job_title: 'CEO' }), [])
    assert.deepEqual(payrollApprovalTransitions({ status, [capability]: false }), [])
    assert.deepEqual(payrollApprovalTransitions({ status, [capability]: 'true' }), [])
    assert.deepEqual(payrollApprovalTransitions({ status, [capability]: true }).map(action => action.fn), [fn])
  }
  assert.deepEqual(payrollApprovalTransitions({ status: 'draft', can_finance_approve: true, can_release: true }), [])
  assert.deepEqual(payrollApprovalTransitions({ status: 'released', can_hr_approve: true, can_finance_approve: true, can_release: true }), [])
})

test('offboarding notifications only offer actions on an explicitly current pending assignment', () => {
  const metadata = { action_type: 'offboarding_project_manager_decision', decision_status: 'pending', requires_action: true }
  assert.equal(canDecideOffboardingNotification({ metadata }), true)
  for (const requires_action of [undefined, false, 'true']) {
    assert.equal(canDecideOffboardingNotification({ metadata: { ...metadata, requires_action } }), false)
  }
  assert.equal(canDecideOffboardingNotification({ metadata: { ...metadata, decision_status: 'approved' } }), false)
  assert.equal(canDecideOffboardingNotification({ metadata: { ...metadata, action_type: 'view' } }), false)
})
