import test from 'node:test'
import assert from 'node:assert/strict'
import { missingApprovalPosition, vicePresidentPositionFromWorkflow } from '../src/pages/Procurement/recommendationApprovalPositions.js'

test('Level 1 employees do not require a designated position, regardless of title or legacy role', () => {
  const workflow = [
    { level: 1, user_id: 8, business_position: 'project_manager', job_title: 'CEO' },
    { level: 1, user_id: 9, job_title: 'Software Developer', role: 'Level 1 Approver' },
    { level: 1, user_id: 10, business_position: 'legacy/Position' },
    { level: '1', user_id: 11, role: 'Vice President' },
  ]
  assert.equal(missingApprovalPosition(workflow), false)
  assert.equal(vicePresidentPositionFromWorkflow(workflow), '')
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
