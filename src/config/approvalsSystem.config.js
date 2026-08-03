/**
 * Approvals System - SOFT-CODED Configuration
 * Central configuration for all approval types, KPIs, actions, and workflow rules
 * 
 * RBAC Integration: Automatically filters approvals based on:
 * - Reporting manager hierarchy
 * - Role assignments (allowedRoles per approval type)
 * - Module permissions
 * - Admin privileges
 * 
 * Role-Based Access Control (allowedRoles):
 * - Each approval type can specify which roles are allowed to see/approve it
 * - 'default' role: Only sees Leave Requests (self-service)
 * - Specialized roles: See approval types relevant to their function (HR, Finance, Procurement)
 * - Admins/Superusers: See all approval types
 * - Reporting Managers: See Leave Requests from direct reports (even with 'default' role)
 */

// ── APPROVAL TYPES ──────────────────────────────────────────────────────────
// Define all approval types in the system with their configuration
export const APPROVAL_TYPES = {
  LEAVE: {
    id: 'leave',
    label: 'Leave Requests',
    pluralLabel: 'Leave Requests',
    icon: 'CalendarDaysIcon',
    color: 'amber',
    gradientFrom: '#f59e0b',
    gradientTo: '#d97706',
    apiEndpoint: '/payroll/leave-requests/',
    // Role-based access control
    allowedRoles: ['default', 'hr_manager', 'hr_admin', 'super_admin', 'admin'],  // All users can access leave requests
    requiresReportingManager: true,  // Users must be reporting managers OR have allowed role
    // Filtering logic for who can see/approve
    filterLogic: 'reporting_manager_or_hr',  // Custom filter type
    statusField: 'status',
    pendingStatuses: ['PENDING', 'RM_APPROVED'],  // Statuses that need action
    // Two-stage workflow
    stages: [
      { stage: 1, role: 'reporting_manager', statusValue: 'PENDING', nextStatus: 'RM_APPROVED' },
      { stage: 2, role: 'hr_manager', statusValue: 'RM_APPROVED', nextStatus: 'APPROVED' }
    ],
    // SOFT-CODED: Field mapping to transform API response fields to display fields
    // Maps API field names to expected display field names, with fallback logic
    fieldMapping: {
      days: (item) => item.days_requested || item.days || null,
      leave_type: (item) => item.leave_type_detail?.name || item.leave_type || null,
      reason: (item) => item.reason || item.remarks || null,
    },
    // Fields to display in approval cards
    displayFields: [
      { key: 'employee_name', label: 'Employee', type: 'text' },
      { key: 'leave_type', label: 'Type', type: 'badge' },
      { key: 'start_date', label: 'From', type: 'date' },
      { key: 'end_date', label: 'To', type: 'date' },
      { key: 'days', label: 'Days', type: 'number' },
      { key: 'reason', label: 'Reason', type: 'text' }
    ],
    // Actions available
    actions: ['approve', 'reject', 'view'],
    // KPI configuration
    kpi: {
      enabled: true,
      title: 'Pending Leave',
      subtitle: 'Awaiting approval',
      countField: 'count',  // Field in API response with count
      trendCalculation: 'week_over_week'  // How to calculate trend
    }
  },
  
  PAYROLL: {
    id: 'payroll',
    label: 'Payroll Approval',
    pluralLabel: 'Payroll Runs',
    icon: 'CurrencyDollarIcon',
    color: 'purple',
    gradientFrom: '#9333ea',
    gradientTo: '#7c3aed',
    apiEndpoint: '/payroll/master-payroll-history/',
    // Role-based access control
    allowedRoles: ['hr_manager', 'hr_admin', 'finance_manager', 'finance_admin', 'super_admin', 'admin'],
    requiresReportingManager: false,  // Role-based only, not reporting manager
    filterLogic: 'role_based',  // Filter by role (HR, Finance, Admin)
    statusField: 'workflow_stage',
    pendingStatuses: ['frozen', 'hr_approved', 'finance_review'],
    // Multi-stage workflow
    stages: [
      { stage: 1, role: 'hr_manager', statusValue: 'frozen', nextStatus: 'hr_approved', action: 'hr-approve' },
      { stage: 2, role: 'finance_team', statusValue: 'hr_approved', nextStatus: 'finance_review', action: 'finance-review' },
      { stage: 3, role: 'finance_manager', statusValue: 'finance_review', nextStatus: 'finance_approved', action: 'finance-approve' },
      { stage: 4, role: 'admin', statusValue: 'finance_approved', nextStatus: 'released', action: 'release' }
    ],
    displayFields: [
      { key: 'month_year', label: 'Period', type: 'text' },
      { key: 'total_employees', label: 'Employees', type: 'number' },
      { key: 'total_gross', label: 'Gross Pay', type: 'currency' },
      { key: 'total_net', label: 'Net Pay', type: 'currency' },
      { key: 'workflow_stage', label: 'Stage', type: 'badge' },
      { key: 'generated_by', label: 'Created By', type: 'text' }
    ],
    actions: ['approve', 'reject', 'view', 'download'],
    kpi: {
      enabled: true,
      title: 'Payroll Pending',
      subtitle: 'Require review',
      countField: 'pending_count',
      trendCalculation: 'month_over_month'
    }
  },
  
  PROCUREMENT: {
    id: 'procurement',
    label: 'Procurement Requests',
    pluralLabel: 'Purchase Requisitions',
    icon: 'ShoppingCartIcon',
    color: 'indigo',
    gradientFrom: '#6366f1',
    gradientTo: '#4f46e5',
    apiEndpoint: '/procurement/requisitions/',
    // Role-based access control
    allowedRoles: ['procurement_manager', 'procurement_admin', 'finance_manager', 'super_admin', 'admin'],
    requiresReportingManager: false,
    filterLogic: 'approval_workflow',  // Filter by approval_workflow field
    statusField: 'overall_status',
    pendingStatuses: ['pending_approval', 'partially_approved'],
    // Dynamic multi-step workflow (defined per requisition)
    stages: [], // Workflow is dynamic in approval_workflow field
    displayFields: [
      { key: 'requisition_number', label: 'PR Number', type: 'text' },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'requester_name', label: 'Requester', type: 'text' },
      { key: 'total_estimated_cost', label: 'Amount', type: 'currency' },
      { key: 'priority', label: 'Priority', type: 'badge' },
      { key: 'approval_progress', label: 'Progress', type: 'progress' }
    ],
    actions: ['approve', 'reject', 'view', 'comment'],
    kpi: {
      enabled: true,
      title: 'Procurement',
      subtitle: 'Active requests',
      countField: 'pending_count',
      trendCalculation: 'week_over_week'
    }
  },
  
  INVOICE: {
    id: 'invoice',
    label: 'Invoice Approval',
    pluralLabel: 'Invoices',
    icon: 'DocumentTextIcon',
    color: 'green',
    gradientFrom: '#10b981',
    gradientTo: '#059669',
    apiEndpoint: '/finance/invoices/',
    // Role-based access control
    allowedRoles: ['finance_manager', 'finance_admin', 'procurement_manager', 'super_admin', 'admin'],
    requiresReportingManager: false,
    filterLogic: 'approval_chain',  // Filter by approval chain
    statusField: 'approval_status',
    pendingStatuses: ['pending_approval'],
    // Multi-level approval chain (defined in ApprovalRoute)
    stages: [],  // Approval chain is dynamic per invoice type
    displayFields: [
      { key: 'invoice_number', label: 'Invoice #', type: 'text' },
      { key: 'vendor_name', label: 'Vendor', type: 'text' },
      { key: 'amount', label: 'Amount', type: 'currency' },
      { key: 'invoice_type', label: 'Type', type: 'badge' },
      { key: 'due_date', label: 'Due Date', type: 'date' },
      { key: 'approval_level', label: 'Level', type: 'text' }
    ],
    actions: ['approve', 'reject', 'view'],
    kpi: {
      enabled: true,
      title: 'Invoices',
      subtitle: 'Pending approval',
      countField: 'pending_count',
      trendCalculation: 'week_over_week'
    }
  },
  
  EXPENSE: {
    id: 'expense',
    label: 'Expense Reports',
    pluralLabel: 'Expense Reports',
    icon: 'ReceiptPercentIcon',
    color: 'rose',
    gradientFrom: '#f43f5e',
    gradientTo: '#e11d48',
    apiEndpoint: '/finance/expenses/',  // If exists
    filterLogic: 'reporting_manager',
    statusField: 'status',
    pendingStatuses: ['pending'],
    stages: [
      { stage: 1, role: 'reporting_manager', statusValue: 'pending', nextStatus: 'approved' }
    ],
    displayFields: [
      { key: 'employee_name', label: 'Employee', type: 'text' },
      { key: 'total_amount', label: 'Amount', type: 'currency' },
      { key: 'category', label: 'Category', type: 'badge' },
      { key: 'date', label: 'Date', type: 'date' }
    ],
    actions: ['approve', 'reject', 'view'],
    kpi: {
      enabled: false,  // Disable if not implemented yet
      title: 'Expenses',
      subtitle: 'Pending approval',
      countField: 'count',
      trendCalculation: 'week_over_week'
    }
  },
  
  TRAVEL: {
    id: 'travel',
    label: 'Travel Requests',
    pluralLabel: 'Travel Requests',
    icon: 'GlobeAltIcon',
    color: 'cyan',
    gradientFrom: '#06b6d4',
    gradientTo: '#0891b2',
    apiEndpoint: '/hr/travel-requests/',  // If exists
    filterLogic: 'reporting_manager',
    statusField: 'status',
    pendingStatuses: ['pending'],
    stages: [
      { stage: 1, role: 'reporting_manager', statusValue: 'pending', nextStatus: 'approved' }
    ],
    displayFields: [
      { key: 'employee_name', label: 'Employee', type: 'text' },
      { key: 'destination', label: 'Destination', type: 'text' },
      { key: 'start_date', label: 'From', type: 'date' },
      { key: 'end_date', label: 'To', type: 'date' },
      { key: 'purpose', label: 'Purpose', type: 'text' }
    ],
    actions: ['approve', 'reject', 'view'],
    kpi: {
      enabled: false,  // Disable if not implemented yet
      title: 'Travel',
      subtitle: 'Pending approval',
      countField: 'count',
      trendCalculation: 'week_over_week'
    }
  },
  
  DOCUMENT: {
    id: 'document',
    label: 'Document Approval',
    pluralLabel: 'Documents',
    icon: 'DocumentCheckIcon',
    color: 'blue',
    gradientFrom: '#3b82f6',
    gradientTo: '#2563eb',
    apiEndpoint: '/crs/documents/',  // CRS documents
    filterLogic: 'role_based',
    statusField: 'approval_status',
    pendingStatuses: ['pending_approval'],
    stages: [
      { stage: 1, role: 'reviewer', statusValue: 'pending_approval', nextStatus: 'approved' }
    ],
    displayFields: [
      { key: 'document_number', label: 'Doc #', type: 'text' },
      { key: 'document_title', label: 'Title', type: 'text' },
      { key: 'revision', label: 'Revision', type: 'text' },
      { key: 'project_name', label: 'Project', type: 'text' }
    ],
    actions: ['approve', 'reject', 'view', 'comment'],
    kpi: {
      enabled: false,  // Disable if not implemented yet
      title: 'Documents',
      subtitle: 'Pending review',
      countField: 'count',
      trendCalculation: 'week_over_week'
    }
  }
}

// ── APPROVAL ACTIONS ────────────────────────────────────────────────────────
// Define all possible actions with their configuration
export const APPROVAL_ACTIONS = {
  approve: {
    id: 'approve',
    label: 'Approve',
    icon: 'CheckCircleIcon',
    color: 'green',
    bgColor: 'bg-green-600',
    hoverColor: 'hover:bg-green-700',
    textColor: 'text-white',
    requiresComment: false,
    confirmMessage: 'Are you sure you want to approve this request?'
  },
  reject: {
    id: 'reject',
    label: 'Reject',
    icon: 'XCircleIcon',
    color: 'red',
    bgColor: 'bg-red-600',
    hoverColor: 'hover:bg-red-700',
    textColor: 'text-white',
    requiresComment: true,  // Force comment for rejection
    confirmMessage: 'Are you sure you want to reject this request? Please provide a reason.'
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
    confirmMessage: null  // No confirmation needed
  },
  comment: {
    id: 'comment',
    label: 'Comment',
    icon: 'ChatBubbleLeftIcon',
    color: 'gray',
    bgColor: 'bg-gray-600',
    hoverColor: 'hover:bg-gray-700',
    textColor: 'text-white',
    requiresComment: true,
    confirmMessage: null
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
    confirmMessage: null
  }
}

// ── KPI CONFIGURATION ────────────────────────────────────────────────────────
// Additional KPI metrics not tied to specific approval types
export const ADDITIONAL_KPIS = {
  TOTAL_APPROVALS: {
    id: 'total_approvals',
    title: 'Total Approvals',
    subtitle: 'Across all categories',
    icon: 'CheckCircleIcon',
    color: 'green',
    calculation: 'sum_all_pending',  // Sum all pending approvals
    enabled: true
  },
  ACTIVE_PROJECTS: {
    id: 'active_projects',
    title: 'Active Projects',
    subtitle: 'Current projects',
    icon: 'FolderIcon',
    color: 'blue',
    apiEndpoint: '/projects/stats/',
    calculation: 'api_field',
    apiField: 'active_count',
    enabled: true
  },
  TOTAL_EMPLOYEES: {
    id: 'total_employees',
    title: 'Total Employees',
    subtitle: 'Active employees',
    icon: 'UsersIcon',
    color: 'teal',
    apiEndpoint: '/dashboard/metrics/',
    calculation: 'api_field',
    apiField: 'users.total_users',
    enabled: true
  },
  PENDING_DOCUMENTS: {
    id: 'pending_documents',
    title: 'Documents',
    subtitle: 'Pending review',
    icon: 'DocumentTextIcon',
    color: 'orange',
    calculation: 'approval_type',
    approvalType: 'DOCUMENT',
    enabled: false  // Enable when CRS is integrated
  }
}

// ── RBAC FILTER LOGIC ────────────────────────────────────────────────────────
// Define how to filter approvals for each user based on their role/hierarchy

/**
 * Get filter parameters for approval API based on user role and hierarchy
 * @param {string} filterLogic - Type of filter logic (from APPROVAL_TYPES)
 * @param {object} user - Current user object
 * @param {object} rbacData - RBAC data (roles, modules, etc.)
 * @returns {object} Filter parameters to append to API call
 */
export function getApprovalFilters(filterLogic, user, rbacData) {
  const userId = user?.id || user?.user?.id
  const userData = user?.user || user
  
  // Smart admin check
  const isAdmin = userData?.is_staff || userData?.is_superuser || 
                  user?.roles?.some(r => r.code === 'super_admin' || r.name === 'Super Administrator')
  
  // Admins see everything
  if (isAdmin) {
    return {}  // No filters = see all
  }
  
  switch (filterLogic) {
    case 'reporting_manager_or_hr':
      // For leave requests: Backend automatically filters based on reporting hierarchy
      // in LeaveRequestViewSet.get_queryset() using Q(employee__rbac_profile__manager__user=user)
      // So we don't need to send any user-specific filters - just let backend handle it
      const isHRManager = user?.roles?.some(r => 
        r.code === 'hr_manager' || r.name?.toLowerCase().includes('hr')
      )
      
      if (isHRManager) {
        // HR sees all requests (no filter needed - backend allows)
        // Status filter will be added separately in ApprovalsPageDynamic
        return {}
      } else {
        // Reporting managers: Backend auto-filters to show direct reports
        // No need to send reporting_manager parameter - backend handles it
        return {}
      }
    
    case 'reporting_manager':
      // Show only requests from direct reports
      return { reporting_manager: userId }
    
    case 'role_based':
      // Filter based on user's roles
      const roleFilters = {}
      
      if (user?.roles?.some(r => r.code === 'hr_manager')) {
        roleFilters.hr_pending = true
      }
      if (user?.roles?.some(r => r.code === 'finance_manager' || r.code === 'finance_team')) {
        roleFilters.finance_pending = true
      }
      
      return roleFilters
    
    case 'approval_workflow':
      // For procurement: filter by user_id in approval_workflow array
      return { approver_id: userId }
    
    case 'approval_chain':
      // For invoices: filter by approver email/ID in approval chain
      return { approver_email: userData?.email }
    
    default:
      // Default: show items assigned to user
      return { assigned_to: userId }
  }
}

// ── REPORTING MANAGER HIERARCHY ─────────────────────────────────────────────

/**
 * Get reporting manager hierarchy for a user
 * Traverses up the manager chain
 * @param {string} userId - User ID to get hierarchy for
 * @param {string} token - Auth token
 * @returns {Promise<Array>} Array of managers in hierarchy
 */
export async function getReportingHierarchy(userId, token) {
  try {
    const response = await fetch(`/api/v1/users/${userId}/reporting-hierarchy/`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) return []
    
    const data = await response.json()
    return data.hierarchy || []
  } catch (error) {
    console.error('Failed to fetch reporting hierarchy:', error)
    return []
  }
}

/**
 * Get all direct reports for a manager
 * @param {string} managerId - Manager user ID
 * @param {string} token - Auth token
 * @returns {Promise<Array>} Array of direct reports
 */
export async function getDirectReports(managerId, token) {
  try {
    const response = await fetch(`/api/v1/users/${managerId}/direct-reports/`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) return []
    
    const data = await response.json()
    return data.direct_reports || []
  } catch (error) {
    console.error('Failed to fetch direct reports:', error)
    return []
  }
}

// ── STATISTICS CONFIGURATION ─────────────────────────────────────────────────

export const APPROVAL_STATISTICS = {
  APPROVED_TODAY: {
    id: 'approved_today',
    label: 'Approved Today',
    icon: 'CheckCircleIcon',
    color: 'emerald',
    calculation: 'count_by_date_and_status',
    filters: { approved_at__gte: 'today', status: 'approved' }
  },
  REJECTED_TODAY: {
    id: 'rejected_today',
    label: 'Rejected Today',
    icon: 'XCircleIcon',
    color: 'red',
    calculation: 'count_by_date_and_status',
    filters: { rejected_at__gte: 'today', status: 'rejected' }
  },
  AVG_RESPONSE_TIME: {
    id: 'avg_response_time',
    label: 'Avg Response Time',
    icon: 'ClockIcon',
    color: 'blue',
    calculation: 'average_time',
    timeFields: ['created_at', 'decision_date'],
    unit: 'hours'
  },
  SLA_COMPLIANCE: {
    id: 'sla_compliance',
    label: 'SLA Compliance',
    icon: 'ShieldCheckIcon',
    color: 'green',
    calculation: 'percentage',
    numerator: 'approved_within_sla',
    denominator: 'total_approved',
    unit: '%'
  }
}

// ── ENABLED APPROVAL TYPES ───────────────────────────────────────────────────
// SOFT-CODED: Control which approval types are active in the system
// Filters approval types based on:
// 1. User's role assignments (allowedRoles)
// 2. Whether user is a reporting manager (for Leave Requests)
// 3. Admin/superuser privileges (see all)
export function getEnabledApprovalTypes(user = null, rbacData = null) {
  // Get all approval types with enabled KPIs
  const allTypes = Object.entries(APPROVAL_TYPES)
    .filter(([key, config]) => config.kpi.enabled !== false)
    .map(([key, config]) => ({ key, ...config }))
  
  // If no user data, return all types (admin view or initial load)
  if (!user) {
    return allTypes
  }
  
  // Extract user data
  const userData = user?.user || user
  const userRoles = user?.roles || []
  
  // Check if user is admin/superuser (sees all approval types)
  const isAdmin = !!(
    userData?.is_staff ||
    userData?.is_superuser ||
    userRoles?.some(r => r.code === 'super_admin' || r.code === 'admin' || r.name === 'Super Administrator')
  )
  
  if (isAdmin) {
    return allTypes  // Admins see everything
  }
  
  // Get user's role codes
  const userRoleCodes = userRoles.map(r => r.code?.toLowerCase() || '').filter(Boolean)
  
  // Check if user is a reporting manager (has direct reports)
  const isReportingManager = rbacData?.is_reporting_manager || 
                             userData?.is_reporting_manager || 
                             (rbacData?.direct_reports_count && rbacData.direct_reports_count > 0)
  
  // Filter approval types based on role access
  return allTypes.filter(approvalType => {
    // If no allowedRoles specified, allow all (backward compatibility)
    if (!approvalType.allowedRoles || approvalType.allowedRoles.length === 0) {
      return true
    }
    
    // Check if user has any of the allowed roles
    const hasAllowedRole = userRoleCodes.some(roleCode => 
      approvalType.allowedRoles.some(allowedRole => 
        allowedRole.toLowerCase() === roleCode
      )
    )
    
    // If approval type requires reporting manager, check that too
    if (approvalType.requiresReportingManager) {
      return hasAllowedRole || isReportingManager
    }
    
    return hasAllowedRole
  })
}

// ── EXPORT ───────────────────────────────────────────────────────────────────
export default {
  APPROVAL_TYPES,
  APPROVAL_ACTIONS,
  ADDITIONAL_KPIS,
  APPROVAL_STATISTICS,
  getApprovalFilters,
  getReportingHierarchy,
  getDirectReports,
  getEnabledApprovalTypes
}
