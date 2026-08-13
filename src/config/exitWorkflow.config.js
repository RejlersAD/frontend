/**
 * Exit/Resignation Workflow Configuration
 * Soft-coded constants for exit management system
 * Mirrors backend EXIT_REQUEST_TYPES, EXIT_OVERALL_STATUS, etc.
 */

// Exit Request Types
export const EXIT_REQUEST_TYPES = [
  { value: 'resignation', label: 'Voluntary Resignation', icon: '🚶', color: 'blue' },
  { value: 'termination', label: 'Termination', icon: '⚠️', color: 'red' },
  { value: 'contract_end', label: 'Contract Completion', icon: '📋', color: 'gray' },
  { value: 'retirement', label: 'Retirement', icon: '👴', color: 'purple' },
  { value: 'mutual_separation', label: 'Mutual Separation', icon: '🤝', color: 'yellow' },
  { value: 'absconding', label: 'Absconding', icon: '🏃', color: 'red' },
];

// Common Exit Reasons (Employee Dropdown)
export const EXIT_REASONS = [
  { value: 'better_opportunity', label: 'Better Career Opportunity' },
  { value: 'higher_salary', label: 'Higher Salary/Compensation' },
  { value: 'career_growth', label: 'Lack of Career Growth' },
  { value: 'work_life_balance', label: 'Work-Life Balance' },
  { value: 'relocation', label: 'Relocation/Personal Reasons' },
  { value: 'health_reasons', label: 'Health Reasons' },
  { value: 'pursuing_education', label: 'Pursuing Higher Education' },
  { value: 'company_culture', label: 'Company Culture Mismatch' },
  { value: 'job_role_mismatch', label: 'Job Role Mismatch' },
  { value: 'toxic_work_environment', label: 'Toxic Work Environment' },
  { value: 'lack_of_recognition', label: 'Lack of Recognition' },
  { value: 'family_responsibilities', label: 'Family Responsibilities' },
  { value: 'entrepreneurship', label: 'Starting Own Business' },
  { value: 'dissatisfaction', label: 'General Dissatisfaction' },
  { value: 'other', label: 'Other (Please Specify)' },
];

// Overall Status Configuration
export const EXIT_STATUS_CONFIG = {
  pending_manager: {
    label: 'Pending Manager Approval',
    color: 'yellow',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
    icon: '⏳',
    description: 'Waiting for your reporting manager to review and approve',
  },
  pending_hr: {
    label: 'Pending HR Approval',
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
    icon: '📋',
    description: 'Manager approved. Waiting for HR final approval',
  },
  approved: {
    label: 'Approved - Exit Process Can Begin',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    icon: '✅',
    description: 'Request approved. Exit process will begin',
  },
  rejected: {
    label: 'Rejected',
    color: 'red',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
    icon: '❌',
    description: 'Exit request was rejected',
  },
  withdrawn: {
    label: 'Withdrawn by Employee',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
    icon: '↩️',
    description: 'You withdrew this request',
  },
  processing: {
    label: 'Exit Process in Progress',
    color: 'indigo',
    bgColor: 'bg-indigo-100',
    textColor: 'text-indigo-800',
    icon: '🔄',
    description: 'Exit activities are being processed',
  },
  completed: {
    label: 'Exit Completed',
    color: 'purple',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-800',
    icon: '🏁',
    description: 'All exit activities completed',
  },
};

// Exit Process Status
export const EXIT_PROCESS_STATUS_CONFIG = {
  not_started: { label: 'Not Started', color: 'gray', icon: '⚪' },
  access_revocation: { label: 'Access Revocation', color: 'yellow', icon: '🔒' },
  equipment_return: { label: 'Equipment Return', color: 'blue', icon: '💻' },
  exit_interview: { label: 'Exit Interview', color: 'purple', icon: '💬' },
  clearance: { label: 'Department Clearances', color: 'orange', icon: '📋' },
  settlement: { label: 'Final Settlement', color: 'green', icon: '💰' },
  completed: { label: 'All Activities Completed', color: 'green', icon: '✅' },
};

// Approval Actions
export const APPROVAL_ACTIONS = {
  approve: { label: 'Approve', color: 'green', icon: '✅' },
  reject: { label: 'Reject', color: 'red', icon: '❌' },
};

// Clearance Departments
export const CLEARANCE_DEPARTMENTS = [
  { code: 'IT', label: 'Information Technology', icon: '💻' },
  { code: 'HR', label: 'Human Resources', icon: '👥' },
  { code: 'Finance', label: 'Finance & Accounts', icon: '💰' },
  { code: 'Admin', label: 'Administration', icon: '📋' },
  { code: 'Security', label: 'Security', icon: '🔒' },
  { code: 'Library', label: 'Library', icon: '📚' },
  { code: 'Facilities', label: 'Facilities Management', icon: '🏢' },
  { code: 'Project', label: 'Project Department', icon: '🚀' },
];

// Clearance Status
export const CLEARANCE_STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: 'yellow',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
    icon: '⏳',
  },
  cleared: {
    label: 'Cleared',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    icon: '✅',
  },
  pending_action: {
    label: 'Pending Employee Action',
    color: 'orange',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-800',
    icon: '⚠️',
  },
};

// Activity Timeline Icons
export const ACTIVITY_ICONS = {
  request_submitted: '📝',
  manager_notified: '📧',
  manager_approved: '✅',
  manager_rejected: '❌',
  manager_commented: '💬',
  hr_notified: '📋',
  hr_approved: '✅',
  hr_rejected: '❌',
  hr_commented: '💬',
  lwd_adjusted: '📅',
  process_initiated: '🚀',
  access_revoked: '🔒',
  equipment_returned: '💻',
  exit_interview_scheduled: '📅',
  exit_interview_completed: '✅',
  clearance_completed: '✅',
  settlement_processed: '💰',
  request_withdrawn: '↩️',
  offboarding_created: '📋',
  status_changed: '🔄',
  document_uploaded: '📄',
  email_sent: '📧',
  other: 'ℹ️',
};

// Notice Period Configuration
export const NOTICE_PERIOD_CONFIG = {
  minimum_days: 15,
  standard_days: 30,
  senior_days: 60,
  director_days: 90,
};

// API Endpoints (relative paths - baseURL already includes /api/v1)
export const EXIT_API_ENDPOINTS = {
  base: 'onboarding/exit-requests',
  list: 'onboarding/exit-requests/',
  detail: (id) => `onboarding/exit-requests/${id}/`,
  submit: 'onboarding/exit-requests/submit_request/',
  statistics: 'onboarding/exit-requests/statistics/',
  managerAction: (id) => `onboarding/exit-requests/${id}/manager_action/`,
  hrAction: (id) => `onboarding/exit-requests/${id}/hr_action/`,
  withdraw: (id) => `onboarding/exit-requests/${id}/withdraw/`,
  createClearances: (id) => `onboarding/exit-requests/${id}/create_clearances/`,
  updateClearance: (id) => `onboarding/exit-requests/${id}/update_clearance/`,
};

// Helper Functions
export const getStatusConfig = (status) => EXIT_STATUS_CONFIG[status] || {};
export const getProcessStatusConfig = (status) => EXIT_PROCESS_STATUS_CONFIG[status] || {};
export const getClearanceStatusConfig = (status) => CLEARANCE_STATUS_CONFIG[status] || {};
export const getActivityIcon = (activityType) => ACTIVITY_ICONS[activityType] || '•';
export const getRequestTypeLabel = (type) => {
  const config = EXIT_REQUEST_TYPES.find(t => t.value === type);
  return config ? config.label : type;
};

// Validation
export const validateExitRequest = (data) => {
  const errors = {};
  
  if (!data.exit_reason) {
    errors.exit_reason = 'Exit reason is required';
  }
  
  if (!data.proposed_last_working_day) {
    errors.proposed_last_working_day = 'Last working day is required';
  } else {
    const lwd = new Date(data.proposed_last_working_day);
    const today = new Date();
    const noticeDays = Math.ceil((lwd - today) / (1000 * 60 * 60 * 24));
    
    if (noticeDays < 0) {
      errors.proposed_last_working_day = 'Last working day cannot be in the past';
    } else if (noticeDays < NOTICE_PERIOD_CONFIG.minimum_days) {
      errors.proposed_last_working_day = `Notice period must be at least ${NOTICE_PERIOD_CONFIG.minimum_days} days`;
    }
  }
  
  if (data.exit_reason === 'other' && !data.exit_reason_detail) {
    errors.exit_reason_detail = 'Please specify the reason';
  }
  
  return errors;
};
