import test from 'node:test'
import assert from 'node:assert/strict'
import { approvalPositionsFromWorkflow, missingApprovalPosition } from '../src/pages/Procurement/recommendationApprovalPositions.js'

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
