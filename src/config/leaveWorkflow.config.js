/**
 * ============================================================================
 * LEAVE APPROVAL WORKFLOW CONFIGURATION
 * ============================================================================
 * Soft-coded configuration for leave request approval hierarchy with
 * reporting manager integration.
 * 
 * USE CASE:
 * Ahmed (ahmed.aljefri@rejlers.ae) reports to Tanzeem (tanzeem.agra@rejlers.ae)
 * Ahmed applies leave → Notification to Tanzeem (Reporting Manager)
 * Tanzeem approves → Notification to Sanglin (sanglin.samuel@rejlers.ae, HR Manager)
 * Sanglin approves → Updates all dashboards and leave records
 * 
 * @author RADAI System
 * @date 2026-07-14
 */

// ══════════════════════════════════════════════════════════════════════════
// WORKFLOW STAGES — Two-Stage Approval Process
// ══════════════════════════════════════════════════════════════════════════

/**
 * Leave request approval workflow stages
 * Stage 1: Reporting Manager approval
 * Stage 2: HR Manager final approval
 */
export const LEAVE_WORKFLOW_STAGES = {
  // Stage 1: Reporting Manager Approval
  STAGE_1_RM_APPROVAL: {
    stage: 1,
    name: 'Reporting Manager Approval',
    description: 'Leave request submitted by employee, awaiting reporting manager approval',
    statusValue: 'PENDING',
    nextStatus: 'RM_APPROVED',
    rejectStatus: 'RM_REJECTED',
    roleRequired: 'reporting_manager',
    approvalEndpoint: '/api/v1/payroll/leave-requests/{id}/rm-approve/',
    rejectEndpoint: '/api/v1/payroll/leave-requests/{id}/rm-reject/',
    actions: ['rm_approve', 'rm_reject', 'view'],
    notificationRecipients: 'reporting_manager',
    notificationTemplate: {
      subject: 'Leave Request Pending Your Approval',
      body: '{employee_name} has submitted a leave request for {days_requested} day(s) from {start_date} to {end_date}. Please review and approve or reject.',
    },
    slaHours: 24, // 24 hours for RM to respond
  },

  // Stage 2: HR Manager Final Approval
  STAGE_2_HR_APPROVAL: {
    stage: 2,
    name: 'HR Manager Final Approval',
    description: 'Leave request approved by reporting manager, awaiting HR final approval',
    statusValue: 'RM_APPROVED',
    nextStatus: 'APPROVED',
    rejectStatus: 'REJECTED',
    roleRequired: 'hr_manager',
    approvalEndpoint: '/api/v1/payroll/leave-requests/{id}/approve/',
    rejectEndpoint: '/api/v1/payroll/leave-requests/{id}/reject/',
    actions: ['approve', 'reject', 'view'],
    notificationRecipients: 'hr_manager',
    notificationTemplate: {
      subject: 'Leave Request Pending HR Approval',
      body: '{employee_name}\'s leave request has been approved by {rm_name}. Please provide final approval or rejection.',
    },
    slaHours: 48, // 48 hours for HR to respond
  },
};

// ══════════════════════════════════════════════════════════════════════════
// STATUS CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════

/**
 * Leave request status definitions
 * Matches backend LeaveRequestStatus model
 */
export const LEAVE_REQUEST_STATUSES = {
  PENDING: {
    code: 'PENDING',
    label: 'Pending',
    description: 'Waiting for Reporting Manager approval',
    color: 'amber',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-300',
    icon: 'ClockIcon',
    allowedActions: ['rm_approve', 'rm_reject', 'view', 'cancel'],
    currentStage: 1,
  },
  RM_APPROVED: {
    code: 'RM_APPROVED',
    label: 'Pending HR Approval',
    description: 'Approved by Reporting Manager, awaiting HR',
    color: 'blue',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-300',
    icon: 'CheckCircleIcon',
    allowedActions: ['approve', 'reject', 'view'],
    currentStage: 2,
  },
  RM_REJECTED: {
    code: 'RM_REJECTED',
    label: 'Rejected by Manager',
    description: 'Rejected by Reporting Manager',
    color: 'red',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    borderColor: 'border-red-300',
    icon: 'XCircleIcon',
    allowedActions: ['view'],
    currentStage: 1,
    isFinal: true,
  },
  APPROVED: {
    code: 'APPROVED',
    label: 'Approved',
    description: 'Fully approved by HR',
    color: 'green',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    borderColor: 'border-green-300',
    icon: 'CheckBadgeIcon',
    allowedActions: ['view', 'download'],
    currentStage: 2,
    isFinal: true,
  },
  REJECTED: {
    code: 'REJECTED',
    label: 'Rejected',
    description: 'Rejected by HR',
    color: 'red',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    borderColor: 'border-red-300',
    icon: 'XCircleIcon',
    allowedActions: ['view'],
    currentStage: 2,
    isFinal: true,
  },
  CANCELLED: {
    code: 'CANCELLED',
    label: 'Cancelled',
    description: 'Cancelled by employee',
    color: 'gray',
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-700',
    borderColor: 'border-gray-300',
    icon: 'XMarkIcon',
    allowedActions: ['view'],
    isFinal: true,
  },
};

// ══════════════════════════════════════════════════════════════════════════
// ACTION DEFINITIONS
// ══════════════════════════════════════════════════════════════════════════

/**
 * Available actions for leave requests
 */
export const LEAVE_REQUEST_ACTIONS = {
  rm_approve: {
    id: 'rm_approve',
    label: 'Approve',
    icon: 'CheckCircleIcon',
    color: 'green',
    bgColor: 'bg-green-600',
    hoverColor: 'hover:bg-green-700',
    textColor: 'text-white',
    requiresComment: false,
    confirmMessage: 'Are you sure you want to approve this leave request?',
    endpoint: '/api/v1/payroll/leave-requests/{id}/rm-approve/',
    method: 'POST',
    successMessage: 'Leave request approved successfully. Notification sent to HR.',
    nextStage: 2,
  },
  rm_reject: {
    id: 'rm_reject',
    label: 'Reject',
    icon: 'XCircleIcon',
    color: 'red',
    bgColor: 'bg-red-600',
    hoverColor: 'hover:bg-red-700',
    textColor: 'text-white',
    requiresComment: true,
    confirmMessage: 'Are you sure you want to reject this leave request? Please provide a reason.',
    endpoint: '/api/v1/payroll/leave-requests/{id}/rm-reject/',
    method: 'POST',
    successMessage: 'Leave request rejected. Employee has been notified.',
    nextStage: null, // Final
  },
  approve: {
    id: 'approve',
    label: 'Approve',
    icon: 'CheckBadgeIcon',
    color: 'green',
    bgColor: 'bg-green-600',
    hoverColor: 'hover:bg-green-700',
    textColor: 'text-white',
    requiresComment: false,
    confirmMessage: 'Provide final approval for this leave request?',
    endpoint: '/api/v1/payroll/leave-requests/{id}/approve/',
    method: 'POST',
    successMessage: 'Leave request fully approved. Employee and manager notified.',
    nextStage: null, // Final
  },
  reject: {
    id: 'reject',
    label: 'Reject',
    icon: 'XCircleIcon',
    color: 'red',
    bgColor: 'bg-red-600',
    hoverColor: 'hover:bg-red-700',
    textColor: 'text-white',
    requiresComment: true,
    confirmMessage: 'Reject this leave request? Please provide a reason.',
    endpoint: '/api/v1/payroll/leave-requests/{id}/reject/',
    method: 'POST',
    successMessage: 'Leave request rejected. Employee and manager notified.',
    nextStage: null, // Final
  },
  view: {
    id: 'view',
    label: 'View',
    icon: 'EyeIcon',
    color: 'blue',
    bgColor: 'bg-blue-600',
    hoverColor: 'hover:bg-blue-700',
    textColor: 'text-white',
    requiresComment: false,
    confirmMessage: null,
    method: 'VIEW',
  },
  cancel: {
    id: 'cancel',
    label: 'Cancel',
    icon: 'XMarkIcon',
    color: 'gray',
    bgColor: 'bg-gray-600',
    hoverColor: 'hover:bg-gray-700',
    textColor: 'text-white',
    requiresComment: true,
    confirmMessage: 'Cancel this leave request?',
    endpoint: '/api/v1/payroll/leave-requests/{id}/cancel/',
    method: 'POST',
    successMessage: 'Leave request cancelled successfully.',
    nextStage: null, // Final
  },
  download: {
    id: 'download',
    label: 'Download',
    icon: 'ArrowDownTrayIcon',
    color: 'indigo',
    bgColor: 'bg-indigo-600',
    hoverColor: 'hover:bg-indigo-700',
    textColor: 'text-white',
    requiresComment: false,
    method: 'DOWNLOAD',
  },
};

// ══════════════════════════════════════════════════════════════════════════
// RBAC FILTER CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════

/**
 * Determine which leave requests a user can see based on their role
 * @param {Object} user - Current user object
 * @param {Object} rbacData - RBAC data (roles, modules, permissions)
 * @returns {Object} Filter parameters for API call
 */
export const getLeaveRequestFilters = (user, rbacData) => {
  // Check if user is admin (can see everything)
  const isAdmin = !!(
    user?.is_staff ||
    user?.is_superuser ||
    user?.roles?.some((r) => r.code === 'super_admin' || r.name === 'Super Administrator')
  );

  if (isAdmin) {
    return {}; // No filters - see all
  }

  // Check if user is HR Manager
  const isHRManager = user?.roles?.some((r) => r.code === 'hr_manager' || r.name === 'HR Manager');

  if (isHRManager) {
    // HR sees all RM_APPROVED requests (Stage 2) + all final statuses for reporting
    return {
      status__in: 'RM_APPROVED,APPROVED,REJECTED',
    };
  }

  // Regular employees and reporting managers
  // See own requests + requests from direct reports (where manager = this user)
  return {
    reporting_manager: user?.id, // Backend will filter by employee__rbac_profile__manager__user=user
  };
};

// ══════════════════════════════════════════════════════════════════════════
// NOTIFICATION CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════

/**
 * Notification templates for each workflow event
 */
export const LEAVE_NOTIFICATION_TEMPLATES = {
  // When employee submits leave request
  LEAVE_REQUEST_SUBMITTED: {
    recipientType: 'reporting_manager',
    subject: 'New Leave Request Pending Your Approval',
    emailTemplate: `
      <h2>Leave Request Pending Approval</h2>
      <p>Hello {manager_name},</p>
      <p><strong>{employee_name}</strong> has submitted a leave request:</p>
      <ul>
        <li><strong>Leave Type:</strong> {leave_type}</li>
        <li><strong>Start Date:</strong> {start_date}</li>
        <li><strong>End Date:</strong> {end_date}</li>
        <li><strong>Days Requested:</strong> {days_requested}</li>
        <li><strong>Reason:</strong> {reason}</li>
      </ul>
      <p>Please log in to review and approve or reject this request.</p>
      <a href="{approval_url}" style="display:inline-block;padding:10px 20px;background:#10b981;color:#fff;text-decoration:none;border-radius:5px;">Review Request</a>
    `,
    pushNotification: {
      title: 'New Leave Request',
      body: '{employee_name} has requested leave for {days_requested} day(s)',
      icon: 'ClockIcon',
      actionUrl: '/approvals?tab=leave&status=PENDING',
    },
  },

  // When RM approves leave request
  LEAVE_REQUEST_RM_APPROVED: {
    recipientType: 'hr_manager',
    subject: 'Leave Request Pending HR Approval',
    emailTemplate: `
      <h2>Leave Request Pending Final Approval</h2>
      <p>Hello,</p>
      <p>A leave request has been approved by the reporting manager and requires your final approval:</p>
      <ul>
        <li><strong>Employee:</strong> {employee_name}</li>
        <li><strong>Leave Type:</strong> {leave_type}</li>
        <li><strong>Period:</strong> {start_date} to {end_date} ({days_requested} days)</li>
        <li><strong>Approved By:</strong> {rm_name}</li>
        <li><strong>RM Note:</strong> {rm_note}</li>
      </ul>
      <a href="{approval_url}" style="display:inline-block;padding:10px 20px;background:#10b981;color:#fff;text-decoration:none;border-radius:5px;">Review Request</a>
    `,
    pushNotification: {
      title: 'Leave Request Pending HR Approval',
      body: '{employee_name}\'s leave request approved by {rm_name}',
      icon: 'CheckCircleIcon',
      actionUrl: '/approvals?tab=leave&status=RM_APPROVED',
    },
    // Also notify employee that RM approved
    secondaryRecipient: 'employee',
    secondaryEmailTemplate: `
      <h2>Your Leave Request Has Been Approved by Your Manager</h2>
      <p>Hello {employee_name},</p>
      <p>Your leave request has been approved by your reporting manager <strong>{rm_name}</strong>.</p>
      <p>The request is now pending final approval from HR. You will be notified once a decision is made.</p>
    `,
  },

  // When RM rejects leave request
  LEAVE_REQUEST_RM_REJECTED: {
    recipientType: 'employee',
    subject: 'Leave Request Rejected',
    emailTemplate: `
      <h2>Leave Request Rejected</h2>
      <p>Hello {employee_name},</p>
      <p>Your leave request has been rejected by your reporting manager <strong>{rm_name}</strong>.</p>
      <p><strong>Reason:</strong> {rm_note}</p>
      <p>If you have questions, please contact your manager directly.</p>
    `,
    pushNotification: {
      title: 'Leave Request Rejected',
      body: 'Your leave request has been rejected by {rm_name}',
      icon: 'XCircleIcon',
      actionUrl: '/hr/leave',
    },
  },

  // When HR approves leave request (final)
  LEAVE_REQUEST_APPROVED: {
    recipientType: 'employee',
    subject: 'Leave Request Approved',
    emailTemplate: `
      <h2>Leave Request Approved</h2>
      <p>Hello {employee_name},</p>
      <p>Your leave request has been fully approved by HR.</p>
      <ul>
        <li><strong>Leave Type:</strong> {leave_type}</li>
        <li><strong>Period:</strong> {start_date} to {end_date}</li>
        <li><strong>Days:</strong> {days_requested}</li>
      </ul>
      <p>Your leave balance will be updated accordingly.</p>
      <p style="color:#10b981;font-weight:bold;">✓ APPROVED</p>
    `,
    pushNotification: {
      title: 'Leave Request Approved',
      body: 'Your leave request has been fully approved',
      icon: 'CheckBadgeIcon',
      actionUrl: '/hr/leave',
    },
    // Also notify RM
    secondaryRecipient: 'reporting_manager',
    secondaryEmailTemplate: `
      <h2>Leave Request Approved</h2>
      <p>Hello {manager_name},</p>
      <p>The leave request for <strong>{employee_name}</strong> has been fully approved by HR.</p>
      <p><strong>Period:</strong> {start_date} to {end_date} ({days_requested} days)</p>
    `,
  },

  // When HR rejects leave request
  LEAVE_REQUEST_REJECTED: {
    recipientType: 'employee',
    subject: 'Leave Request Rejected by HR',
    emailTemplate: `
      <h2>Leave Request Rejected</h2>
      <p>Hello {employee_name},</p>
      <p>Unfortunately, your leave request has been rejected by HR.</p>
      <p><strong>Reason:</strong> {reviewer_note}</p>
      <p>If you have questions, please contact HR directly.</p>
    `,
    pushNotification: {
      title: 'Leave Request Rejected',
      body: 'Your leave request has been rejected by HR',
      icon: 'XCircleIcon',
      actionUrl: '/hr/leave',
    },
    // Also notify RM
    secondaryRecipient: 'reporting_manager',
    secondaryEmailTemplate: `
      <h2>Leave Request Rejected</h2>
      <p>Hello {manager_name},</p>
      <p>The leave request for <strong>{employee_name}</strong> has been rejected by HR.</p>
      <p><strong>Reason:</strong> {reviewer_note}</p>
    `,
  },
};

// ══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════

/**
 * Get current workflow stage for a leave request
 * @param {string} status - Current status code
 * @returns {number} Current stage number
 */
export const getCurrentStage = (status) => {
  return LEAVE_REQUEST_STATUSES[status]?.currentStage || 0;
};

/**
 * Get allowed actions for a status
 * @param {string} status - Current status code
 * @returns {Array} Array of allowed action IDs
 */
export const getAllowedActions = (status) => {
  return LEAVE_REQUEST_STATUSES[status]?.allowedActions || [];
};

/**
 * Check if user can approve at current stage
 * @param {string} status - Current status code
 * @param {Object} user - Current user
 * @param {Object} leaveRequest - Leave request object
 * @returns {boolean} True if user can approve
 */
export const canUserApprove = (status, user, leaveRequest) => {
  const stage = getCurrentStage(status);

  if (stage === 1) {
    // Stage 1: Only reporting manager can approve
    return (
      user?.id === leaveRequest?.employee?.rbac_profile?.manager?.user?.id ||
      user?.email === leaveRequest?.reporting_manager_email
    );
  }

  if (stage === 2) {
    // Stage 2: Only HR manager can approve
    return user?.roles?.some((r) => r.code === 'hr_manager' || r.name === 'HR Manager');
  }

  return false;
};

/**
 * Get next status after approval
 * @param {string} currentStatus - Current status code
 * @returns {string} Next status code
 */
export const getNextStatus = (currentStatus) => {
  if (currentStatus === 'PENDING') return 'RM_APPROVED';
  if (currentStatus === 'RM_APPROVED') return 'APPROVED';
  return currentStatus; // Already final
};

/**
 * Get notification template for action
 * @param {string} action - Action ID (rm_approve, rm_reject, approve, reject)
 * @param {Object} leaveRequest - Leave request data
 * @returns {Object} Notification template with populated data
 */
export const getNotificationTemplate = (action, leaveRequest) => {
  const eventMap = {
    create: 'LEAVE_REQUEST_SUBMITTED',
    rm_approve: 'LEAVE_REQUEST_RM_APPROVED',
    rm_reject: 'LEAVE_REQUEST_RM_REJECTED',
    approve: 'LEAVE_REQUEST_APPROVED',
    reject: 'LEAVE_REQUEST_REJECTED',
  };

  const eventKey = eventMap[action];
  return LEAVE_NOTIFICATION_TEMPLATES[eventKey] || null;
};

/**
 * Format template with leave request data
 * @param {string} template - Template string with {placeholders}
 * @param {Object} leaveRequest - Leave request data
 * @param {Object} user - Current user (for manager_name)
 * @returns {string} Formatted string
 */
export const formatNotificationTemplate = (template, leaveRequest, user) => {
  return template
    .replace(/{employee_name}/g, leaveRequest.employee_name || 'Employee')
    .replace(/{leave_type}/g, leaveRequest.leave_type?.name || 'Annual Leave')
    .replace(/{start_date}/g, leaveRequest.start_date || '')
    .replace(/{end_date}/g, leaveRequest.end_date || '')
    .replace(/{days_requested}/g, leaveRequest.days_requested || '0')
    .replace(/{reason}/g, leaveRequest.reason || 'Not specified')
    .replace(/{manager_name}/g, user?.first_name + ' ' + user?.last_name || 'Manager')
    .replace(/{rm_name}/g, leaveRequest.rm_reviewed_by_name || 'Manager')
    .replace(/{rm_note}/g, leaveRequest.rm_note || 'No note provided')
    .replace(/{reviewer_note}/g, leaveRequest.reviewer_note || 'No reason provided')
    .replace(/{approval_url}/g, `${window.location.origin}/approvals?tab=leave`);
};

// ══════════════════════════════════════════════════════════════════════════
// EXPORT DEFAULTS
// ══════════════════════════════════════════════════════════════════════════

export default {
  LEAVE_WORKFLOW_STAGES,
  LEAVE_REQUEST_STATUSES,
  LEAVE_REQUEST_ACTIONS,
  LEAVE_NOTIFICATION_TEMPLATES,
  getLeaveRequestFilters,
  getCurrentStage,
  getAllowedActions,
  canUserApprove,
  getNextStatus,
  getNotificationTemplate,
  formatNotificationTemplate,
};
