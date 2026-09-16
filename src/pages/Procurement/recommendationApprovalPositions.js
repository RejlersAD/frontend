// Level 1 accepts any active employee. General Vice President assignments
// still require an explicit position, never inferred from a display title.
export const missingApprovalPosition = (workflow = []) => workflow.some(
  stage => Number(stage?.level) !== 1 && stage?.role === 'Vice President' && !stage.business_position,
)

export const vicePresidentPositionFromWorkflow = (workflow = []) => (
  workflow.find(stage => stage?.role === 'Vice President' && Number(stage.level) !== 1)?.business_position || ''
)
