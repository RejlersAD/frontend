/**
 * Enterprise Dashboard Configuration
 * Soft-coded constants for the intelligent enterprise dashboard
 * All layout, timing, and behavior settings centralized here
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// API & POLLING CONFIGURATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const API_CONFIG = {
  // Auto-refresh intervals (milliseconds)
  dashboardRefreshInterval: 60000,      // Refresh dashboard data every 60s
  kpiRefreshInterval: 30000,            // Refresh KPI cards every 30s
  activityRefreshInterval: 15000,       // Refresh activity feed every 15s
  notificationRefreshInterval: 10000,   // Check notifications every 10s
  
  // Request limits
  activityFeedLimit: 10,                // Recent activities to fetch
  approvalCenterLimit: 8,               // Pending approvals to show
  notificationPreviewLimit: 5,          // Notifications in preview
  upcomingEventsLimit: 6,               // Upcoming events to display
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LAYOUT & RESPONSIVE CONFIGURATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const LAYOUT_CONFIG = {
  // Container
  maxWidth: '1680px',                   // Maximum dashboard width
  paddingX: 'px-4 sm:px-6 lg:px-8',     // Horizontal padding
  paddingY: 'py-6',                     // Vertical padding
  gap: 'gap-6',                         // Grid gap
  
  // KPI Grid
  kpiGridCols: {
    mobile: 'grid-cols-1',
    tablet: 'sm:grid-cols-2',
    desktop: 'lg:grid-cols-3',
    wide: 'xl:grid-cols-4',
  },
  
  // Main layout columns
  mainContentCols: 'lg:col-span-8',     // Main content area
  sidebarCols: 'lg:col-span-4',         // Sidebar area
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ANIMATION CONFIGURATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const ANIMATION_CONFIG = {
  enabled: true,                        // Master animation toggle
  staggerDelay: 80,                     // Milliseconds between staggered items
  fadeInDuration: 500,                  // Fade-in animation duration
  hoverScale: 1.02,                     // Card hover scale factor
  transitionDuration: '200ms',          // Standard transition duration
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COLOR PALETTE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const COLORS = {
  // Primary brand
  primary: {
    gradient: 'linear-gradient(135deg, #f97316 0%, #ec4899 100%)',
    from: '#f97316',
    to: '#ec4899',
  },
  
  // Status colors
  status: {
    success: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', badge: 'bg-emerald-100' },
    warning: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', badge: 'bg-amber-100' },
    error: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', badge: 'bg-red-100' },
    info: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badge: 'bg-blue-100' },
    neutral: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', badge: 'bg-slate-100' },
  },
  
  // Department colors
  departments: {
    engineering: { color: '#3b82f6', bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100' },
    procurement: { color: '#8b5cf6', bg: 'bg-purple-50', text: 'text-purple-700', badge: 'bg-purple-100' },
    finance: { color: '#f59e0b', bg: 'bg-amber-50', text: 'text-amber-700', badge: 'bg-amber-100' },
    qhse: { color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-100' },
    hr: { color: '#ec4899', bg: 'bg-pink-50', text: 'text-pink-700', badge: 'bg-pink-100' },
    projects: { color: '#6366f1', bg: 'bg-indigo-50', text: 'text-indigo-700', badge: 'bg-indigo-100' },
  },
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// KPI CARD CONFIGURATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const KPI_CATEGORIES = {
  EMPLOYEE: 'employee',
  ATTENDANCE: 'attendance',
  LEAVE: 'leave',
  PAYROLL: 'payroll',
  PROCUREMENT: 'procurement',
  PROJECT: 'project',
  SYSTEM: 'system',
  ENGINEERING: 'engineering',
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// APPROVAL TYPES & PRIORITIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const APPROVAL_TYPES = {
  LEAVE: { label: 'Leave', icon: '🏖️', color: 'blue' },
  PAYROLL: { label: 'Payroll', icon: '💰', color: 'amber' },
  PROCUREMENT: { label: 'Procurement', icon: '🛒', color: 'purple' },
  EXPENSE: { label: 'Expense', icon: '💳', color: 'pink' },
  TRAVEL: { label: 'Travel', icon: '✈️', color: 'indigo' },
  DOCUMENT: { label: 'Document', icon: '📄', color: 'teal' },
  ENGINEERING: { label: 'Engineering', icon: '⚙️', color: 'cyan' },
}

export const PRIORITY_LEVELS = {
  CRITICAL: { label: 'Critical', color: 'red', badge: 'bg-red-100 text-red-700' },
  HIGH: { label: 'High', color: 'orange', badge: 'bg-orange-100 text-orange-700' },
  MEDIUM: { label: 'Medium', color: 'blue', badge: 'bg-blue-100 text-blue-700' },
  LOW: { label: 'Low', color: 'slate', badge: 'bg-slate-100 text-slate-700' },
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CHART CONFIGURATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const CHART_CONFIG = {
  defaultHeight: 280,                   // Default chart height
  colors: ['#f97316', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'],
  dateRangeOptions: [
    { value: '7', label: 'Last 7 Days' },
    { value: '30', label: 'Last 30 Days' },
    { value: '90', label: 'Last 90 Days' },
  ],
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PLACEHOLDER DATA (for missing APIs)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const PLACEHOLDER_CONFIG = {
  // Enable/disable placeholders
  useEmployeePlaceholders: true,
  useAttendancePlaceholders: true,
  useLeavePlaceholders: true,
  usePayrollPlaceholders: true,
  useApprovalPlaceholders: true,
  
  // Placeholder values
  totalEmployees: 247,
  activeEmployees: 234,
  attendanceToday: 218,
  pendingLeaveRequests: 12,
  payrollPending: 3,
  procurementRequests: 8,
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI INSIGHTS CONFIGURATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const AI_INSIGHTS_CONFIG = {
  maxInsights: 4,                       // Maximum insights to show
  refreshInterval: 300000,              // Refresh insights every 5 minutes
  insightTypes: ['trend', 'alert', 'recommendation', 'achievement'],
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// QUICK ACTIONS CONFIGURATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const ADMIN_QUICK_ACTIONS = [
  { id: 'create-employee', label: 'Create Employee', icon: '👤', route: '/hr/employees', color: 'blue' },
  { id: 'generate-payroll', label: 'Generate Payroll', icon: '💰', route: '/hr/payroll', color: 'amber' },
  { id: 'approve-leave', label: 'Approve Leave', icon: '✅', route: null, color: 'green' },
  { id: 'procurement', label: 'Procurement', icon: '🛒', route: '/procurement', color: 'purple' },
  { id: 'upload-doc', label: 'Upload Document', icon: '📤', route: '/engineering/process/pid-verification', color: 'teal' },
  { id: 'reports', label: 'View Reports', icon: '📊', route: '/admin/reports', color: 'indigo' },
  { id: 'settings', label: 'Settings', icon: '⚙️', route: '/admin', color: 'slate' },
]

export const USER_QUICK_ACTIONS = [
  { id: 'apply-leave', label: 'Apply Leave', icon: '🏖️', route: null, color: 'blue' },
  { id: 'view-payslip', label: 'View Payslip', icon: '💰', route: '/finance/salary-slip', color: 'amber' },
  { id: 'request-procurement', label: 'Request Procurement', icon: '🛒', route: '/procurement', color: 'purple' },
  { id: 'upload-doc', label: 'Upload Documents', icon: '📤', route: '/engineering/process/pid-verification', color: 'teal' },
  { id: 'view-attendance', label: 'View Attendance', icon: '📅', route: null, color: 'green' },
  { id: 'raise-ticket', label: 'Raise Ticket', icon: '🎫', route: '/contact-support', color: 'rose' },
]

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GREETING CONFIGURATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const GREETING_CONFIG = {
  morningHour: 12,                      // Morning ends at 12:00
  afternoonHour: 18,                    // Afternoon ends at 18:00
  greetings: {
    morning: 'Good Morning',
    afternoon: 'Good Afternoon',
    evening: 'Good Evening',
  },
  motivationalMessages: [
    'Ready to make an impact today! 🚀',
    'Let\'s achieve great things together! ✨',
    'Your productivity hub is ready! 💪',
    'Time to turn plans into reality! 🎯',
    'Another day to excel! 🌟',
  ],
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PERSONAL DASHBOARD CARDS (User View)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const PERSONAL_CARDS_CONFIG = {
  showLeaveBalance: true,
  showAttendance: true,
  showPayrollStatus: true,
  showProjects: true,
  showTasks: true,
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CALENDAR CONFIGURATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const CALENDAR_CONFIG = {
  defaultView: 'month',                 // 'month', 'week', 'day'
  firstDayOfWeek: 1,                    // 0 = Sunday, 1 = Monday
  eventTypes: {
    leave: { color: '#3b82f6', label: 'Leave' },
    meeting: { color: '#8b5cf6', label: 'Meeting' },
    training: { color: '#f59e0b', label: 'Training' },
    deadline: { color: '#ef4444', label: 'Deadline' },
    holiday: { color: '#10b981', label: 'Holiday' },
  },
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPORT DEFAULT CONFIG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default {
  API_CONFIG,
  LAYOUT_CONFIG,
  ANIMATION_CONFIG,
  COLORS,
  KPI_CATEGORIES,
  APPROVAL_TYPES,
  PRIORITY_LEVELS,
  CHART_CONFIG,
  PLACEHOLDER_CONFIG,
  AI_INSIGHTS_CONFIG,
  ADMIN_QUICK_ACTIONS,
  USER_QUICK_ACTIONS,
  GREETING_CONFIG,
  PERSONAL_CARDS_CONFIG,
  CALENDAR_CONFIG,
}
