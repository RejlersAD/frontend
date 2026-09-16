// A workflow position is an explicit assignment, never an employee display title.
export const approvalPositionsFromWorkflow = (workflow = []) => Object.fromEntries(
  workflow.filter(stage => Number(stage?.level) === 1 && (stage.user_id || stage.approver_id))
    .map(stage => [stage.user_id || stage.approver_id, stage.business_position || '']),
)

export const missingApprovalPosition = (workflow = []) => workflow.some(
  stage => Number(stage?.level) === 1 && !stage.business_position,
)
