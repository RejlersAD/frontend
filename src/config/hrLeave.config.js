/**
 * HR Leave Management — Soft-Coded Configuration
 * ===============================================
 * All leave type codes, status styles, and helpers live here.
 * No magic strings or colour values exist in component code.
 *
 * Backend source of truth: /api/v1/payroll/leave-types/
 * These defaults mirror the seeded data in migration 0003 and are used as
 * a fallback when the API is unavailable (e.g. no network during hot-reload).
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. ABSENT SYMBOL — shown in the Summary attendance table for a working day
//    with no biometric punch and no approved leave
// ─────────────────────────────────────────────────────────────────────────────
export const ABSENT_SYMBOL = import.meta.env?.VITE_ABSENT_SYMBOL || 'A'

// ─────────────────────────────────────────────────────────────────────────────
// 2. LEAVE TYPE DEFINITIONS
//    Mirrored from the backend seed in migration 0003.
//    Fields: code, name, color (chart hex), bg/text/border (badge Tailwind classes),
//            cellBg/cellText (compact cell variant for Summary table)
// ─────────────────────────────────────────────────────────────────────────────
export const DEFAULT_LEAVE_TYPES = [
  { code: 'AL', name: 'Annual Leave',    color: '#10b981',
    bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300',
    cellBg: 'bg-emerald-100', cellText: 'text-emerald-800' },
  { code: 'SL', name: 'Sick Leave',      color: '#3b82f6',
    bg: 'bg-blue-100',    text: 'text-blue-800',    border: 'border-blue-300',
    cellBg: 'bg-blue-100',    cellText: 'text-blue-800' },
  { code: 'EL', name: 'Emergency Leave', color: '#f59e0b',
    bg: 'bg-amber-100',   text: 'text-amber-800',   border: 'border-amber-300',
    cellBg: 'bg-amber-100',   cellText: 'text-amber-800' },
  { code: 'UL', name: 'Unpaid Leave',    color: '#ef4444',
    bg: 'bg-red-100',     text: 'text-red-800',     border: 'border-red-300',
    cellBg: 'bg-red-100',     cellText: 'text-red-800' },
  { code: 'ML', name: 'Maternity Leave', color: '#8b5cf6',
    bg: 'bg-purple-100',  text: 'text-purple-800',  border: 'border-purple-300',
    cellBg: 'bg-purple-100',  cellText: 'text-purple-800' },
  { code: 'PL', name: 'Paternity Leave', color: '#6366f1',
    bg: 'bg-indigo-100',  text: 'text-indigo-800',  border: 'border-indigo-300',
    cellBg: 'bg-indigo-100',  cellText: 'text-indigo-800' },
  { code: 'PH', name: 'Public Holiday',  color: '#6b7280',
    bg: 'bg-slate-100',   text: 'text-slate-700',   border: 'border-slate-300',
    cellBg: 'bg-slate-100',   cellText: 'text-slate-600' },
  { code: 'WO', name: 'Work Off',        color: '#14b8a6',
    bg: 'bg-teal-100',    text: 'text-teal-800',    border: 'border-teal-300',
    cellBg: 'bg-teal-100',    cellText: 'text-teal-800' },
]

/** Fallback for unknown leave type codes */
const LEAVE_FALLBACK = {
  code: '?', name: 'Leave', color: '#6b7280',
  bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300',
  cellBg: 'bg-slate-100', cellText: 'text-slate-700',
}

/**
 * Look up a leave type by its code.
 * apiTypes (optional): array from GET /api/v1/payroll/leave-types/ — when
 * supplied these take precedence over DEFAULT_LEAVE_TYPES so admin-created
 * custom types are automatically styled.
 */
export const getLeaveType = (code, apiTypes = null) => {
  if (apiTypes) {
    const hit = apiTypes.find(t => t.code === code)
    if (hit) return {
      ...hit,
      cellBg:   hit.badge_bg    || hit.cellBg    || 'bg-slate-100',
      cellText: hit.badge_text  || hit.cellText  || 'text-slate-700',
    }
  }
  return DEFAULT_LEAVE_TYPES.find(t => t.code === code) || { ...LEAVE_FALLBACK, code }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. REQUEST STATUS STYLES
// ─────────────────────────────────────────────────────────────────────────────
export const LEAVE_STATUS = {
  PENDING:   { label: 'Pending',   bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-400',   icon: 'ClockIcon' },
  APPROVED:  { label: 'Approved',  bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', icon: 'CheckCircleIcon' },
  REJECTED:  { label: 'Rejected',  bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    dot: 'bg-rose-500',    icon: 'XCircleIcon' },
  CANCELLED: { label: 'Cancelled', bg: 'bg-slate-50',   text: 'text-slate-500',   border: 'border-slate-200',   dot: 'bg-slate-300',   icon: 'MinusCircleIcon' },
}

export const leaveStatusMeta = (code) =>
  LEAVE_STATUS[code] || LEAVE_STATUS.PENDING

// ─────────────────────────────────────────────────────────────────────────────
// 4. LEAVE REQUEST VIEWS (tabs inside the Requests panel)
// ─────────────────────────────────────────────────────────────────────────────
export const LEAVE_REQ_VIEWS = [
  { id: 'new',     label: 'New Request', icon: 'PlusCircleIcon' },
  { id: 'pending', label: 'Pending',     icon: 'ClockIcon' },
  { id: 'history', label: 'History',     icon: 'ArchiveBoxIcon' },
]

// ─────────────────────────────────────────────────────────────────────────────
// 5. TABLE COLUMNS — leave request list
// ─────────────────────────────────────────────────────────────────────────────
export const LEAVE_REQUEST_COLS = [
  { id: 'name',       label: 'Employee',   accessor: r => r.employee_name },
  { id: 'leave_type', label: 'Type',       accessor: r => r.leave_type_detail?.code || r.leave_type },
  { id: 'start',      label: 'From',       accessor: r => r.start_date },
  { id: 'end',        label: 'To',         accessor: r => r.end_date },
  { id: 'days',       label: 'Days',       accessor: r => Number(r.days_requested || 0).toFixed(1) },
  { id: 'reason',     label: 'Reason',     accessor: r => r.reason || '—' },
]

// ─────────────────────────────────────────────────────────────────────────────
// 6. HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Count Mon–Fri working days between two ISO date strings (inclusive). */
export const countWorkingDays = (from, to) => {
  if (!from || !to) return 0
  let count = 0
  const start = new Date(from)
  const end   = new Date(to)
  if (start > end) return 0
  const cur = new Date(start)
  while (cur <= end) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. BRANCH / LEGAL ENTITY DEFINITIONS
//    RAD = Rejlers International Engineering Solutions AB (UAE)
//    RIN = Rejlers International Engineering Solutions IN (India)
// ─────────────────────────────────────────────────────────────────────────────
export const BRANCHES = [
  {
    id:          'RAD',
    label:       'Rejlers AB',
    fullName:    'Rejlers International Engineering Solutions AB',
    color:       '#3b82f6',
    // Tailwind classes for pill/badge
    bg:          'bg-blue-50',
    text:        'text-blue-700',
    border:      'border-blue-200',
    activeBg:    'bg-blue-600',
    activeText:  'text-white',
    badgeBg:     'bg-blue-100',
    badgeText:   'text-blue-800',
    badgeBorder: 'border-blue-300',
  },
  {
    id:          'RIN',
    label:       'Rejlers IN',
    fullName:    'Rejlers International Engineering Solutions IN',
    color:       '#8b5cf6',
    bg:          'bg-purple-50',
    text:        'text-purple-700',
    border:      'border-purple-200',
    activeBg:    'bg-purple-600',
    activeText:  'text-white',
    badgeBg:     'bg-purple-100',
    badgeText:   'text-purple-800',
    badgeBorder: 'border-purple-300',
  },
]

/** Look up a branch by id (e.g. 'RAD') — returns null if not found. */
export const getBranch = (id) => BRANCHES.find(b => b.id === id) || null

/** Return today as ISO YYYY-MM-DD */
export const todayISO = () => new Date().toISOString().slice(0, 10)

/** Return tomorrow as ISO YYYY-MM-DD */
export const tomorrowISO = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. LEAVE YEAR — always the current calendar year. Single source of truth.
//    Overridable via env var for testing a specific year without code changes.
// ─────────────────────────────────────────────────────────────────────────────
export const LEAVE_YEAR = Number(import.meta.env?.VITE_LEAVE_YEAR || new Date().getFullYear())

// ─────────────────────────────────────────────────────────────────────────────
// 9. DEFAULT ANNUAL ENTITLEMENT — fallback when the API doesn't return one.
//    Overridable via env var for different entities.
// ─────────────────────────────────────────────────────────────────────────────
export const DEFAULT_ANNUAL_ENTITLEMENT = Number(
  import.meta.env?.VITE_DEFAULT_ANNUAL_ENTITLEMENT || 22
)

// ─────────────────────────────────────────────────────────────────────────────
// 9.1 MONTHLY LEAVE ACCRUAL — soft-coded constant
//     Standard monthly leave accrual = ANNUAL_ENTITLEMENT / 12 months
//     UAE Labour Law art.75: 22 days annual → 1.8333... days per month
// ─────────────────────────────────────────────────────────────────────────────
export const MONTHLY_LEAVE_ACCRUAL = DEFAULT_ANNUAL_ENTITLEMENT / 12  // 1.8333... ≈ 1.83 days

// ─────────────────────────────────────────────────────────────────────────────
// 9.2 LEAVE ENCASHMENT — soft-coded divisor for daily rate calculation
//     Daily rate = monthly_salary ÷ LEAVE_ENCASHMENT_WORKING_DAYS
//     UAE standard: 22 working days per month.
//     Mirror of ENCASHMENT_WORKING_DAYS in backend/apps/payroll/services/leave_encashment.py
// ─────────────────────────────────────────────────────────────────────────────
export const LEAVE_ENCASHMENT_WORKING_DAYS = Number(
  import.meta.env?.VITE_LEAVE_ENCASHMENT_WORKING_DAYS || 22
)

// ─────────────────────────────────────────────────────────────────────────────
// 10. ESS LEAVE TYPE CONFIG — soft-coded entitlements for the Self-Service
//     portal. Keyed by canonical leave category (matches API `category` field
//     populated from LeaveCategory choices in payroll/models.py).
//     Colours here use a distinct palette from DEFAULT_LEAVE_TYPES so that
//     the bar-chart view stays visually separate from the badge/table views.
//
//     To enable/disable a leave type, set `enabled: true/false`.
//     Entitlement values reflect UAE Labour Law (Federal Law No.33 of 2021).
// ─────────────────────────────────────────────────────────────────────────────
export const ESS_LEAVE_TYPE_CONFIG = {
  annual:       { label: 'Annual Leave',       color: '#3b82f6', bg: 'bg-blue-50',    text: 'text-blue-700',    bar: 'bg-blue-500',    entitlement: DEFAULT_ANNUAL_ENTITLEMENT, enabled: true  },
  sick:         { label: 'Sick Leave',         color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-500', entitlement: 15,                         enabled: true  },
  emergency:    { label: 'Emergency Leave',    color: '#f59e0b', bg: 'bg-amber-50',   text: 'text-amber-700',   bar: 'bg-amber-500',   entitlement: 3,                          enabled: false },
  maternity:    { label: 'Maternity Leave',    color: '#8b5cf6', bg: 'bg-purple-50',  text: 'text-purple-700',  bar: 'bg-purple-500',  entitlement: 60,                         enabled: true  },
  paternity:    { label: 'Paternity Leave',    color: '#6366f1', bg: 'bg-indigo-50',  text: 'text-indigo-700',  bar: 'bg-indigo-500',  entitlement: 5,                          enabled: true  },
  compensatory: { label: 'Compensatory Leave', color: '#8b5cf6', bg: 'bg-violet-50',  text: 'text-violet-700',  bar: 'bg-violet-500',  entitlement: 5,                          enabled: false },
  unpaid:       { label: 'Unpaid Leave',       color: '#64748b', bg: 'bg-slate-50',   text: 'text-slate-700',   bar: 'bg-slate-400',   entitlement: 0,                          enabled: true  },
  // Set enabled: false to hide a type from the ESS portal without deleting it from the DB
  public_holiday: { label: 'Public Holiday',  color: '#6b7280', bg: 'bg-slate-50',   text: 'text-slate-600',   bar: 'bg-slate-300',   entitlement: 0,                          enabled: false },
  work_off:       { label: 'Work Off',         color: '#14b8a6', bg: 'bg-teal-50',    text: 'text-teal-700',    bar: 'bg-teal-400',    entitlement: 0,                          enabled: false },
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. ESS FEATURE VISIBILITY — soft-coded flags to enable/disable sections
//     Control which sections appear in Employee Self-Service portal.
// ─────────────────────────────────────────────────────────────────────────────
export const ESS_FEATURES = {
  // Overview section features
  showLeaveBalanceSnapshot:    true,  // Leave balance cards (annual, taken, encashed, pending)
  requireLeaveDataForSnapshot: false, // If true, hide snapshot when no leave data; if false, show zeros
  
  // Timesheet section features
  showWeeklyHoursTrend:        true,  // Weekly hours bar chart (last 8 weeks)
  requireTimesheetDataForTrend: false, // If true, hide trend when no data; if false, show "No data"
  
  // Team section features
  showTeamCalendar:            true,  // Team availability calendar
  teamCalendarDescription:     'Shows which team members are on approved leave this month. Helps plan meetings and workload distribution.', // Explanation text
}

// ─────────────────────────────────────────────────────────────────────────────
// 11.5 LEAVE REQUEST FORM FIELDS — soft-coded configuration for "Apply for Leave"
//      Controls which fields appear in the leave request form and their properties.
//      Enables easy addition/removal of fields without touching component logic.
// ─────────────────────────────────────────────────────────────────────────────
export const ESS_LEAVE_FORM_FIELDS = {
  // Core fields (always visible)
  leave_type:          { enabled: true,  required: true,  label: 'Leave Type',               type: 'select',   grid: 'col-span-1' },
  half_day:            { enabled: true,  required: false, label: 'Half Day',                 type: 'toggle',   grid: 'col-span-1' },
  start_date:          { enabled: true,  required: true,  label: 'Start Date',               type: 'date',     grid: 'col-span-1' },
  end_date:            { enabled: true,  required: true,  label: 'End Date',                 type: 'date',     grid: 'col-span-1' },
  reason:              { enabled: true,  required: false, label: 'Reason',                   type: 'textarea', grid: 'col-span-2', rows: 3 },
  
  // Enhanced fields (soft-coded, can be enabled/disabled)
  contact_number:      { enabled: true,  required: false, label: 'Contact Number when Travelling', type: 'tel',      grid: 'col-span-1', placeholder: '+971 XX XXX XXXX' },
  substitute_name:     { enabled: true,  required: false, label: 'Substitute during Leave',        type: 'text',     grid: 'col-span-1', placeholder: 'Employee name or N/A' },
  attachment:          { enabled: true,  required: false, label: 'Supporting Documents',           type: 'file',     grid: 'col-span-2', accept: '.pdf,.jpg,.jpeg,.png,.doc,.docx', maxSize: 5242880 }, // 5MB
  
  // Field order (determines rendering sequence)
  order: [
    'leave_type',
    'half_day',
    'start_date',
    'end_date',
    'contact_number',
    'substitute_name',
    'reason',
    'attachment'
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. DAILY TRACKER CONFIG — soft-coded labels, icons and thresholds
//     for the Daily Work Log feature in Employee Self-Service.
// ─────────────────────────────────────────────────────────────────────────────

export const DAILY_TRACKER_PRIORITIES = [
  { id: 'low',      label: 'Low',      icon: '↓', tailwind: 'bg-slate-100  text-slate-600  border-slate-200'  },
  { id: 'medium',   label: 'Medium',   icon: '→', tailwind: 'bg-blue-100   text-blue-700   border-blue-200'   },
  { id: 'high',     label: 'High',     icon: '↑', tailwind: 'bg-amber-100  text-amber-700  border-amber-200'  },
  { id: 'critical', label: 'Critical', icon: '!!', tailwind: 'bg-red-100    text-red-700    border-red-200'    },
]

export const DAILY_TRACKER_STATUSES = [
  { id: 'in_progress', label: 'In Progress', icon: '⏳', tailwind: 'bg-blue-100   text-blue-700   border-blue-200'   },
  { id: 'done',        label: 'Done',        icon: '✓',  tailwind: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { id: 'blocked',     label: 'Blocked',     icon: '🚫', tailwind: 'bg-red-100    text-red-700    border-red-200'    },
  { id: 'deferred',    label: 'Deferred',    icon: '⏭',  tailwind: 'bg-slate-100  text-slate-600  border-slate-200'  },
]

export const DAILY_TRACKER_PROJECT_CATEGORIES = [
  'Design Review',
  'Deliverable Production',
  'Client Meeting',
  'Internal Meeting',
  'Document Control',
  'Quality Check',
  'Change Request',
  'Site Support',
  'Procurement',
  'Training',
  'Administrative',
  'Other',
]

export const DAILY_TRACKER_COPY = {
  tabLabel:              'Daily Tracker',
  addButton:             'Log Activity',
  exportButton:          'Export to S3',
  exportSuccess:         'Logs exported successfully.',
  exportError:           'S3 export failed — check your configuration.',
  emptyLogs:             'No work logs for this date. Click "Log Activity" to add one.',
  heatmapTitle:          'Activity Heatmap (last 14 weeks)',
  weeklyChartTitle:      'This Week (hours per day)',
  teamViewTitle:         'Team Daily Logs',
  approvalQueueTitle:    'Pending Approvals',
  // Wizard labels
  wizardCreateTitle:     'Log New Activity',
  wizardEditTitle:       'Edit Activity',
  // Approval labels
  approveButton:         'Approve',
  rejectButton:          'Reject',
  approveSuccess:        'Activity approved successfully.',
  rejectSuccess:         'Activity rejected.',
  rejectNotePlaceholder: 'Reason for rejection (required)…',
  approvalQueueEmpty:    'No activities pending your approval.',
  // Thresholds
  maxHoursWarning:       12,   // warn user if hours_spent > this per entry
  heatmapWeeks:          14,   // rolling weeks shown in heatmap
  teamPageSize:          20,   // max rows in team view table
  // Heatmap colour intensity thresholds (hours)
  heatLow:               1,    // >= 1 h  -> light colour
  heatMed:               4,    // >= 4 h  -> medium colour
  heatHigh:              7,    // >= 7 h  -> full colour
  // Wizard quick-hour selector options (soft-coded)
  quickHours:            [0.5, 1, 1.5, 2, 3, 4, 6, 8],
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. DAILY TRACKER APPROVAL STATUSES
// ─────────────────────────────────────────────────────────────────────────────
export const DAILY_TRACKER_APPROVAL_STATUSES = [
  {
    id:      'pending',
    label:   'Pending Approval',
    icon:    '⏳',
    tailwind: 'bg-amber-50 text-amber-700 border-amber-200',
    rowBg:   'bg-amber-50/40',
  },
  {
    id:      'approved',
    label:   'Approved',
    icon:    '✓',
    tailwind: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rowBg:   'bg-emerald-50/30',
  },
  {
    id:      'rejected',
    label:   'Rejected',
    icon:    '✕',
    tailwind: 'bg-red-50 text-red-700 border-red-200',
    rowBg:   'bg-red-50/20',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// 13. DAILY TRACKER WIZARD STEPS
// ─────────────────────────────────────────────────────────────────────────────
export const DAILY_TRACKER_WIZARD_STEPS = [
  { id: 'task',   label: 'Task',   icon: 'PencilSquareIcon',          description: 'What did you work on?' },
  { id: 'when',   label: 'When',   icon: 'ClockIcon',                 description: 'Date and time spent' },
  { id: 'tags',   label: 'Tags',   icon: 'TagIcon',                   description: 'Category, priority & status' },
  { id: 'review', label: 'Review', icon: 'ClipboardDocumentCheckIcon', description: 'Confirm and submit' },
]

// ─────────────────────────────────────────────────────────────────────────────
// 14. DAILY TRACKER — SUBMIT-TO OPTIONS
//     The two manager roles an employee can route a log entry to for approval.
// ─────────────────────────────────────────────────────────────────────────────
export const DAILY_TRACKER_SUBMIT_TO_OPTIONS = [
  {
    id:          'project_manager',
    label:       'Project Manager',
    description: 'Route to your assigned project manager',
    chipTailwind:    'bg-blue-50    text-blue-700    border-blue-200',
    activeTailwind:  'bg-blue-600   text-white       border-blue-600',
  },
  {
    id:          'reporting_manager',
    label:       'Reporting Manager',
    description: 'Route to your direct line manager',
    chipTailwind:    'bg-emerald-50 text-emerald-700 border-emerald-200',
    activeTailwind:  'bg-emerald-600 text-white      border-emerald-600',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// 15. ESS ATTENDANCE TAB — soft-coded configuration
//     Controls the individual employee attendance tracking panel in /hr/leave.
//     
//     ⚠️  PRODUCTION ACTIVE SETTINGS (user-approved, 2026-06-26):
//         - Max daily hours capped at 9 hours (FIXED, non-negotiable)
//         - Overtime tracking DISABLED (hidden from UI)
//         - All hour calculations automatically capped at maximum
// ─────────────────────────────────────────────────────────────────────────────

/** How many past months the employee can scroll back to */
export const ESS_ATT_MONTHS_BACK = 12

/** Standard working hours per day (used to classify a day as full/partial) */
export const ESS_ATT_STANDARD_DAY_HRS = 9

/** Maximum daily hours — hours exceeding this value are CAPPED to this limit */
export const ESS_ATT_MAX_DAILY_HRS = 9

/** Standard working days in a month (fallback when API doesn't return it) */
export const ESS_ATT_STANDARD_WORKING_DAYS = 22

/** Attendance rate % thresholds for colour coding */
export const ESS_ATT_RATE_GOOD = 95   // >= good → green
export const ESS_ATT_RATE_WARN = 80   // >= warn → amber, else → rose

/** Day-level classification thresholds (hours) */
export const ESS_ATT_PARTIAL_DAY_HRS = 4   // < this → partial day, else full
export const ESS_ATT_OVERTIME_HRS    = 9   // > this → overtime flag (DEPRECATED — overtime disabled)

/** Feature toggles for attendance display */
export const ESS_ATT_FEATURES = {
  showOvertime: false,  // Hide overtime column and KPI (disabled per user request 2026-06-26)
  capHoursAtMax: true,  // Enforce max hours cap in all calculations
}

/**
 * Day-status style map (used in the per-day attendance table in ESS).
 * Keys mirror classifyDay() categories from hrAttendance.config.js.
 */
export const ESS_ATT_DAY_STATUS = {
  worked:   { label: 'Present',   dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  partial:  { label: 'Partial',   dot: 'bg-amber-400',   badge: 'bg-amber-50  text-amber-700  border-amber-200'  },
  absent:   { label: 'Absent',    dot: 'bg-rose-500',    badge: 'bg-rose-50   text-rose-700   border-rose-200'   },
  weekend:  { label: 'Day Off',   dot: 'bg-slate-300',   badge: 'bg-slate-50  text-slate-500  border-slate-200'  },
  future:   { label: 'Upcoming',  dot: 'bg-slate-200',   badge: 'bg-slate-50  text-slate-400  border-slate-100'  },
}

/** Day-of-week short labels (Sun=0 … Sat=6) */
export const ESS_ATT_DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Copy strings for the ESS Attendance tab */
export const ESS_ATT_COPY = {
  sectionTitle:    'My Attendance',
  sectionSubtitle: 'Personal attendance records — select any month to view details',
  kpiPresent:      'Present Days',
  kpiAbsent:       'Absent Days',
  kpiRate:         'Attendance Rate',
  kpiOvertime:     'Overtime Hours',
  dailyTableTitle: 'Daily Breakdown',
  noData:          'No attendance data found for this period.',
  loading:         'Loading attendance\u2026',
  rateExcellent:   'Excellent',
  rateGood:        'Good',
  rateNeeds:       'Needs attention',
}

// ─────────────────────────────────────────────────────────────────────────────
// 16. ESS TIMESHEET TAB — soft-coded configuration
//     Controls the individual employee timesheet tracking panel in /hr/leave.
//     
//     Implementation mirrors /hr/employees Timesheet view with Live/Daily/Monthly
//     tabs, but auto-scoped to the logged-in user (self-service).
// ─────────────────────────────────────────────────────────────────────────────

/** Tabs shown in ESS Timesheet section */
export const ESS_TIMESHEET_TABS = [
  { id: 'live',    label: 'Live',    icon: 'SignalIcon',       description: 'Current IN/OUT status' },
  { id: 'daily',   label: 'Daily',   icon: 'CalendarDaysIcon', description: 'Daily attendance record' },
  { id: 'monthly', label: 'Monthly', icon: 'CalendarIcon',     description: 'Monthly summary' },
]

/** Default tab when opening ESS Timesheet */
export const ESS_TIMESHEET_DEFAULT_TAB = 'live'

/** Auto-refresh interval for Live tab (milliseconds) */
export const ESS_TIMESHEET_POLL_MS = 60000  // 1 minute (less aggressive than admin view)

/** Copy strings for the ESS Timesheet tab */
export const ESS_TIMESHEET_COPY = {
  sectionTitle:    'My Timesheet',
  sectionSubtitle: 'Real-time attendance tracking — punch in/out, hours worked',
  liveNoData:      'No live attendance data available',
  dailyNoData:     'No attendance record for this date',
  monthlyNoData:   'No attendance records for this month',
  loading:         'Loading timesheet data\u2026',
  notConfigured:   'Timesheet system not configured. Contact HR if this persists.',
  needsEmployeeId: 'Your profile needs an employee_id to view timesheet data. Please contact HR.',
}

/** Status badges for timesheet display */
export const ESS_TIMESHEET_STATUS = {
  in:       { label: 'Checked IN',  bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  out:      { label: 'Checked OUT', bg: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-slate-200',   dot: 'bg-slate-400' },
  late:     { label: 'Late Arrival', bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500' },
  absent:   { label: 'Absent',      bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    dot: 'bg-rose-500' },
  weekend:  { label: 'Day Off',     bg: 'bg-slate-50',   text: 'text-slate-500',   border: 'border-slate-200',   dot: 'bg-slate-300' },
}

