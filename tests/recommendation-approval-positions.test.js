import test from 'node:test'
import assert from 'node:assert/strict'
import { approvalPositionsFromWorkflow, missingApprovalPosition, vicePresidentPositionFromWorkflow } from '../src/pages/Procurement/recommendationApprovalPositions.js'

test('saved explicit positions remain verbatim and titles do not supply missing positions', () => {
  const workflow = [
    { level: 1, user_id: 8, business_position: 'project_manager', job_title: 'CEO' },
    { level: 1, user_id: 9, job_title: 'HR Manager', role: 'Level 1 Approver' },
    { level: 1, user_id: 10, business_position: 'legacy/Position' },
  ]
  assert.deepEqual(approvalPositionsFromWorkflow(workflow), { 8: 'project_manager', 9: '', 10: 'legacy/Position' })
  assert.equal(missingApprovalPosition(workflow), true)
  workflow[1].business_position = 'hr_manager'
  assert.equal(missingApprovalPosition(workflow), false)
})

test('a generic Vice President stage has no inferred operational position', () => {
  const workflow = [{ level: 2, role: 'Vice President', job_title: 'VP Operations' }]
  assert.equal(vicePresidentPositionFromWorkflow(workflow), '')
  assert.equal(missingApprovalPosition(workflow), true)
  workflow[0].business_position = 'cfo'
  assert.equal(vicePresidentPositionFromWorkflow(workflow), 'cfo')
  assert.equal(missingApprovalPosition(workflow), false)
  assert.equal(missingApprovalPosition([{ level: 4, role: 'VP Delivery' }]), false)
})
