// These capabilities come from the authenticated server response. A title,
// access role, or pending status alone does not confer business approval rights.
export const canReviewProfileDocument = document =>
  document?.can_review === true && document?.verification_status === 'pending'

export const canDecideOffboardingNotification = notification =>
  notification?.metadata?.action_type === 'offboarding_project_manager_decision'
  && notification.metadata.requires_action === true
  && notification.metadata.decision_status === 'pending'

const payrollActions = [
  { from: 'draft', status: 'hr_approved', capability: 'can_hr_approve', label: 'HR Approve', fn: 'hrApproveRun', tone: 'blue' },
  { from: 'hr_approved', status: 'finance_approved', capability: 'can_finance_approve', label: 'Finance Approve', fn: 'financeApproveRun', tone: 'amber' },
  { from: 'finance_approved', status: 'released', capability: 'can_release', label: 'Release', fn: 'releaseRun', tone: 'green' },
]

export const payrollApprovalTransitions = run => payrollActions.filter(action =>
  run?.status === action.from && run?.[action.capability] === true)
