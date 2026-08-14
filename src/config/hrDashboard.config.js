/**
 * HR Vice President — Consolidated Real-Time Dashboard
 * -----------------------------------------------------
 * Soft-coded configuration for `/hr` — the single landing surface designed
 * for the HR Vice President to see workforce + attendance + onboarding
 * activity at a glance.
 *
 * NO core logic is modified — every value on the dashboard is derived from
 * existing endpoints:
 *   • timesheetService.fetchLive()    → live IN/OUT roster + summary
 *   • timesheetService.fetchDaily()   → today's per-user hours
 *   • timesheetService.fetchMonthly() → month-to-date hours / late / full day
 *   • rbacService.getUsers()          → workforce master (status, MFA, dept)
 *
 * Everything visible on the page — labels, polling intervals, KPI compute
 * functions, section visibility, colours, accent gradients, empty-state
 * copy, quick-link buttons — lives in this file. Tweak here, no JSX edits.
 */

import {
  HR_DISCIPLINES,
  matchDiscipline,
  fullName,
  getEmail,
  formatDate,
} from './hrEmployees.config'

// ─────────────────────────────────────────────────────────────────────────────
// Helper to format leave records for consolidated report
// ─────────────────────────────────────────────────────────────────────────────
export const formatLeaveRecord = (record) => ({
  ...record,
  employee_display: record.employee_name || `${record.employee?.first_name || ''} ${record.employee?.last_name || ''}`.trim() || 'Unknown',
  leave_type_display: record.leave_type_detail?.name || record.leave_type || 'Unknown',
  status_display: (record.status || 'UNKNOWN').replace('_', ' '),
})

// ─────────────────────────────────────────────────────────────────────────────
// 1. POLLING — how often the live tiles refresh (ms)
//    Overridable via env var so production can dial it up/down without a rebuild
//    of the page component.
// ─────────────────────────────────────────────────────────────────────────────
export const HR_DASHBOARD_POLL_MS = Number(
  import.meta.env?.VITE_HR_DASHBOARD_POLL_MS || 30000
)

// Maximum employees to pull for workforce analytics. Matches the page-size used
// by /hr/employees so caching can be shared if a future enhancement adds it.
export const HR_DASHBOARD_FETCH_PAGE_SIZE = 500

// Number of recent punches to show in the live activity feed.
export const HR_DASHBOARD_LIVE_FEED_LIMIT = 8

// Number of recent joiners (last N days) to show.
export const HR_DASHBOARD_RECENT_JOINER_DAYS = 30
export const HR_DASHBOARD_RECENT_JOINER_LIMIT = 6

// Threshold (in days) above which a punch's "last seen" turns grey/old.
export const HR_DASHBOARD_STALE_PUNCH_MIN = 120

// ─────────────────────────────────────────────────────────────────────────────
// 2. COPY — headings, sub-headings, empty states. All English-localisable.
// ─────────────────────────────────────────────────────────────────────────────
export const HR_DASHBOARD_COPY = {
  pageTitle: 'HR Command Center',
  pageSubtitle:
    'Real-time workforce overview — attendance, headcount, onboarding and engagement at a single glance.',
  greetingMorning: 'Good morning',
  greetingAfternoon: 'Good afternoon',
  greetingEvening: 'Good evening',
  refreshing: 'Refreshing…',
  liveBadge: 'LIVE',
  autoRefreshOn: 'Auto-refresh on',
  autoRefreshOff: 'Auto-refresh off',
  manualRefresh: 'Refresh now',
  lastUpdated: 'Last updated',
  loading: 'Loading workforce signals…',
  emptyLive: 'No biometric punches recorded today yet.',
  emptyDaily: 'No attendance data captured for today.',
  emptyMonthly: 'Month-to-date rollup is empty.',
  emptyJoiners: `No new joiners in the last ${HR_DASHBOARD_RECENT_JOINER_DAYS} days.`,
  emptyDept: 'No department data available.',
  emptyDiscipline: 'No discipline mapping available.',
  workforceError: 'Could not load the workforce directory.',
  timesheetError: 'Could not load biometric attendance data.',
  timesheetUnavailable: 'Biometric attendance is not configured for this environment.',
  sectionLive: 'Live attendance pulse',
  sectionLiveHint: 'Auto-updates from the biometric feed.',
  sectionWorkforce: 'Workforce composition',
  sectionWorkforceHint: 'All registered employees in RAD AI.',
  sectionToday: "Today's punctuality",
  sectionTodayHint: 'Derived from today\'s biometric report.',
  sectionMonth: 'Month-to-date rollup',
  sectionMonthHint: 'Hours, full days and late arrivals so far this month.',
  sectionJoiners: 'Recent joiners',
  sectionJoinersHint: `New employees added in the last ${HR_DASHBOARD_RECENT_JOINER_DAYS} days.`,
  sectionLinks: 'Quick actions',
  sectionAIChampion: 'AI Champion spotlight',
  sectionAIChampionHint: 'This month\u2019s top engineers powering RAD AI \u2014 driven by activity, AI usage and impact.',
  emptyAIChampion: 'No AI Champion data available yet. Activity needs to accumulate over the period.',
  aiChampionForbidden: 'AI Champion analytics are restricted to administrators. Open the full console for details.',
  aiChampionLinkLabel: 'Open full AI Champion console',
  // Pending actions inbox
  sectionPending: 'Pending Actions',
  sectionPendingHint: 'Items from Payroll, Leave & Salary requiring your attention right now.',
  emptyPending: 'All clear — no pending actions at this time.',
  notifTitle: 'Pending Notifications',
  notifEmpty: 'No pending notifications.',
  notifClear: 'All clear',
  // Payroll snapshot
  sectionPayrollSnapshot: 'Payroll & Leave Snapshot',
  sectionPayrollSnapshotHint: 'Live summary from the Payroll Engine (4.2) and Self-Service Portal (4.3).',
  payrollSnapshotError: 'Payroll snapshot unavailable — check /hr/payroll.',
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. TOP KPI TILES (real-time strip across the top)
//    Each tile is a pure compute over { workforce, live, daily, monthly }.
//    Returning `null` from `compute` hides the tile (graceful degradation
//    when a data source isn't configured).
// ─────────────────────────────────────────────────────────────────────────────
const pct = (num, den) => (den > 0 ? `${Math.round((num / den) * 100)}%` : '0%')

const buildPendingOnboardingRows = ({ workforce = [], lifecycleRequests = [] }) => {
  const requests = Array.isArray(lifecycleRequests) ? lifecycleRequests : []
  const requestUserIds = new Set(requests.map(row => String(row.user_id || '')).filter(Boolean))
  const requestEmails = new Set(requests.map(row => String(row.employee_email || '').toLowerCase()).filter(Boolean))
  const pendingAccounts = workforce
    .filter(employee => employee.status === 'pending')
    .filter(employee => {
      const userId = String(employee.user_id || employee.id || employee.user?.id || '')
      const email = String(getEmail(employee) || '').toLowerCase()
      return !requestUserIds.has(userId) && !requestEmails.has(email)
    })
    .map(employee => ({
      id: `account-${employee.user_id || employee.id}`,
      user_id: employee.user_id || employee.id,
      employee_name: fullName(employee),
      employee_email: getEmail(employee),
      employee_id: employee.employee_number || employee.employee_id,
      department: employee.department,
      request_type: 'Account Setup',
      display_status: 'Awaiting First Login',
      status: 'pending',
      effective_date: employee.created_at,
      created_at: employee.created_at,
    }))

  return [...requests, ...pendingAccounts]
}

export const HR_DASHBOARD_KPIS = [
  {
    id: 'headcount',
    label: 'Total Headcount',
    sub: 'All registered employees',
    icon: 'UsersIcon',
    accent: 'from-blue-500 to-indigo-600',
    compute: ({ workforce }) => workforce.length,
  },
  {
    id: 'active',
    label: 'Active Employees',
    sub: 'Currently working',
    icon: 'CheckBadgeIcon',
    accent: 'from-emerald-500 to-teal-600',
    compute: ({ workforce }) => workforce.filter((e) => e.status === 'active').length,
  },
  {
    id: 'currently_in',
    label: 'Currently IN',
    sub: 'Punched in right now',
    icon: 'ArrowRightOnRectangleIcon',
    accent: 'from-green-500 to-emerald-600',
    compute: ({ live }) => live?.summary?.currently_in ?? 0,
  },
  {
    id: 'currently_out',
    label: 'Currently OUT',
    sub: 'Off-site / not punched',
    icon: 'ArrowLeftOnRectangleIcon',
    accent: 'from-slate-500 to-slate-700',
    compute: ({ live }) => live?.summary?.currently_out ?? 0,
  },
  {
    id: 'late_today',
    label: 'Late Today',
    sub: 'Arrived after grace period',
    icon: 'ClockIcon',
    accent: 'from-amber-500 to-orange-600',
    compute: ({ live }) => live?.summary?.late_today ?? 0,
  },
  {
    id: 'attendance_rate',
    label: 'Attendance Today',
    sub: 'Of active employees seen (capped 100%)',
    icon: 'PresentationChartLineIcon',
    accent: 'from-cyan-500 to-blue-600',
    compute: ({ live, workforce }) => {
      const seen   = live?.summary?.total_seen_today ?? 0
      const active = workforce.filter((e) => e.status === 'active').length
      if (active === 0) return seen > 0 ? '100%' : '0%'
      // Biometric can record contractors/visitors not in RBAC — cap at 100
      // so the tile always shows a meaningful 0–100 % range.
      return `${Math.min(100, Math.round((seen / active) * 100))}%`
    },
  },
  {
    id: 'pending_onboarding',
    label: 'Pending Onboarding',
    sub: 'Lifecycle requests',
    icon: 'UserPlusIcon',
    accent: 'from-purple-500 to-fuchsia-600',
    compute: (ctx) => buildPendingOnboardingRows(ctx).length,
  },
  {
    id: 'mfa_adoption',
    label: 'MFA Adoption',
    sub: 'Two-factor enabled',
    icon: 'ShieldCheckIcon',
    accent: 'from-indigo-500 to-violet-600',
    compute: ({ workforce }) =>
      workforce.length === 0
        ? '0%'
        : pct(workforce.filter((e) => e.is_mfa_enabled).length, workforce.length),
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// 4. SECTIONS — declarative visibility flag. Flip to `false` to hide a card
//    without touching the page component.
// ─────────────────────────────────────────────────────────────────────────────
export const HR_DASHBOARD_SECTIONS = {
  liveFeed: true,
  workforceComposition: false,  // SOFT-CODED: Disabled to hide "Workforce composition" and "Engineering disciplines" sections
  todayPunctuality: true,
  monthRollup: true,
  recentJoiners: true,
  quickLinks: true,
  aiChampion: true,
  pendingActions: true,    // Inbox: leave + alerts + salary + slips
  payrollSnapshot: true,   // Second KPI row from 4.2 + 4.3 data
  leaveRecordsConsolidated: true,  // Consolidated leave report for all users
}

// ─────────────────────────────────────────────────────────────────────────────
// 4c. PENDING ACTION TYPES  — defines each notification category.
//     `route` is the /hr/payroll URL (tab driven via query param).
//     `priority` controls sort order in the inbox (lower = more urgent).
// ─────────────────────────────────────────────────────────────────────────────
export const HR_DASHBOARD_PENDING_TYPES = [
  {
    id:       'alerts',
    label:    'Audit Alerts',
    icon:     'ExclamationTriangleIcon',
    route:    '/hr/payroll?tab=auditor',
    priority: 1,
    bg:    'bg-rose-50',
    border:'border-rose-200',
    text:  'text-rose-700',
    dot:   'bg-rose-500',
    badge: 'bg-rose-100 text-rose-800 border-rose-200',
    actionLabel: 'View alerts',
    zeroMsg:     'No open alerts',
    singularMsg: 'audit alert needs attention',
    pluralMsg:   'audit alerts need attention',
    getItems:    (d) => Array.isArray(d?.pendingAlerts)     ? d.pendingAlerts.slice(0, 3)     : [],
    getCount:    (d) => Number(d?.pendingAlertsCount  ?? d?.pendingAlerts?.length  ?? 0),
    getRowLabel: (r) => r.description || r.alert_type || 'Audit alert',
    getRowSub:   (r) => r.employee_name || r.created_at?.slice(0, 10) || '',
  },
  {
    id:       'leave',
    label:    'Leave Requests',
    icon:     'CalendarDaysIcon',
    route:    '/hr/payroll?tab=leave',
    priority: 2,
    bg:    'bg-amber-50',
    border:'border-amber-200',
    text:  'text-amber-700',
    dot:   'bg-amber-500',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    actionLabel: 'Review requests',
    zeroMsg:     'No pending leave requests',
    singularMsg: 'leave request awaiting approval',
    pluralMsg:   'leave requests awaiting approval',
    getItems:    (d) => Array.isArray(d?.pendingLeave)       ? d.pendingLeave.slice(0, 3)       : [],
    getCount:    (d) => Number(d?.pendingLeaveCount   ?? d?.pendingLeave?.length   ?? 0),
    getRowLabel: (r) => r.employee_name || 'Employee',
    getRowSub:   (r) => `${r.leave_type_detail?.code || r.leave_type || ''} · ${r.start_date || ''}${r.end_date && r.end_date !== r.start_date ? ` – ${r.end_date}` : ''}`.trim(),
  },
  {
    id:       'salary',
    label:    'Salary Approvals',
    icon:     'BanknotesIcon',
    route:    '/hr/payroll?tab=salary',
    priority: 3,
    bg:    'bg-purple-50',
    border:'border-purple-200',
    text:  'text-purple-700',
    dot:   'bg-purple-500',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
    actionLabel: 'Review structures',
    zeroMsg:     'No pending salary approvals',
    singularMsg: 'salary structure awaiting approval',
    pluralMsg:   'salary structures awaiting approval',
    getItems:    (d) => Array.isArray(d?.pendingSalary)      ? d.pendingSalary.slice(0, 3)      : [],
    getCount:    (d) => Number(d?.pendingSalaryCount  ?? d?.pendingSalary?.length  ?? 0),
    getRowLabel: (r) => r.employee_name || r.employee_code || 'Employee',
    getRowSub:   (r) => `Effective ${r.effective_date || '—'} · ${r.currency || 'AED'} ${Number(r.net_salary || 0).toLocaleString()}`,
  },
  {
    id:       'slips',
    label:    'Salary Slip Approvals',
    icon:     'DocumentTextIcon',
    route:    '/hr/payroll?tab=engine',
    priority: 4,
    bg:    'bg-indigo-50',
    border:'border-indigo-200',
    text:  'text-indigo-700',
    dot:   'bg-indigo-500',
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    actionLabel: 'Review slips',
    zeroMsg:     'No pending salary slips',
    singularMsg: 'salary slip pending approval',
    pluralMsg:   'salary slips pending approval',
    getItems:    (d) => Array.isArray(d?.pendingSlips)       ? d.pendingSlips.slice(0, 3)       : [],
    getCount:    (d) => Number(d?.pendingSlipsCount   ?? d?.pendingSlips?.length   ?? 0),
    getRowLabel: (r) => r.employee_name || r.employee_code || 'Employee',
    getRowSub:   (r) => `${r.month_name || ''} ${r.year || ''}`.trim() || r.period || '—',
  },
]

// Total pending count across all types (used for the bell badge).
export const buildTotalPending = (pending) =>
  HR_DASHBOARD_PENDING_TYPES.reduce((sum, t) => sum + t.getCount(pending), 0)

// ─────────────────────────────────────────────────────────────────────────────
// 4d. PAYROLL SNAPSHOT KPIs — second row derived from payroll/leave/salary APIs
//     Each `compute` receives { payrollSummary, pendingLeaveCount, pendingAlertsCount, pendingSalaryCount, pendingSlipsCount, salarySummary }
// ─────────────────────────────────────────────────────────────────────────────
export const HR_DASHBOARD_PAYROLL_KPIS = [
  {
    id:      'leave_pending',
    label:   'Pending Leave',
    sub:     'Awaiting HR approval',
    icon:    'CalendarDaysIcon',
    accent:  'from-amber-400 to-orange-500',
    urgent:  true,
    compute: (d) => d.pendingLeaveCount ?? null,
  },
  {
    id:      'audit_alerts',
    label:   'Open Alerts',
    sub:     'Payroll audit flags',
    icon:    'ExclamationTriangleIcon',
    accent:  'from-rose-500 to-red-600',
    urgent:  true,
    compute: (d) => d.pendingAlertsCount ?? null,
  },
  {
    id:      'salary_pending',
    label:   'Salary Approvals',
    sub:     'Structures & slips',
    icon:    'BanknotesIcon',
    accent:  'from-purple-500 to-violet-600',
    urgent:  true,
    compute: (d) => (d.pendingSalaryCount ?? 0) + (d.pendingSlipsCount ?? 0),
  },
  {
    id:      'payroll_runs',
    label:   'Payroll Runs',
    sub:     'This month (from engine)',
    icon:    'CpuChipIcon',
    accent:  'from-teal-500 to-cyan-600',
    urgent:  false,
    compute: (d) => d.payrollSummary?.total_runs ?? d.payrollSummary?.payroll_runs ?? 0,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// 4e. CONSOLIDATED LEAVE RECORDS REPORT — Configuration for HR Manager dashboard
//     Shows all users' leave records with filtering by status, employee, type
// ─────────────────────────────────────────────────────────────────────────────
export const HR_DASHBOARD_LEAVE_REPORT = {
  title: 'Consolidated Leave Records',
  subtitle: 'All employees leave history and status',
  icon: 'ClipboardDocumentListIcon',
  accentGradient: 'from-amber-500 to-orange-600',
  
  // Status filter options (soft-coded for easy modification)
  statusFilters: [
    { value: 'ALL', label: 'All Status', color: 'slate' },
    { value: 'PENDING', label: 'Pending', color: 'amber' },
    { value: 'RM_APPROVED', label: 'RM Approved', color: 'blue' },
    { value: 'APPROVED', label: 'Approved', color: 'green' },
    { value: 'REJECTED', label: 'Rejected', color: 'red' },
    { value: 'RM_REJECTED', label: 'RM Rejected', color: 'rose' },
    { value: 'CANCELLED', label: 'Cancelled', color: 'slate' },
  ],
  
  // Leave type options for filtering
  leaveTypeFilters: [
    { value: 'ALL', label: 'All Types' },
    { value: 'annual', label: 'Annual Leave' },
    { value: 'sick', label: 'Sick Leave' },
    { value: 'unpaid', label: 'Unpaid Leave' },
    { value: 'maternity', label: 'Maternity Leave' },
    { value: 'paternity', label: 'Paternity Leave' },
    { value: 'compassionate', label: 'Compassionate Leave' },
    { value: 'study', label: 'Study Leave' },
    { value: 'other', label: 'Other' },
  ],
  
  // Table columns configuration (soft-coded for easy reordering/modification)
  columns: [
    { key: 'employee_name', label: 'Employee', width: 'w-48', sortable: true },
    { key: 'leave_type', label: 'Type', width: 'w-32', type: 'badge', sortable: true },
    { key: 'start_date', label: 'Start Date', width: 'w-32', type: 'date', sortable: true },
    { key: 'end_date', label: 'End Date', width: 'w-32', type: 'date', sortable: true },
    { key: 'days_requested', label: 'Days', width: 'w-20', type: 'number', sortable: true },
    { key: 'status', label: 'Status', width: 'w-32', type: 'status-badge', sortable: true },
    { key: 'created_at', label: 'Submitted', width: 'w-32', type: 'datetime', sortable: true },
    { key: 'reason', label: 'Reason', width: 'flex-1', type: 'text' },
  ],
  
  // Status badge color mapping (soft-coded)
  statusColors: {
    PENDING: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
    RM_APPROVED: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
    APPROVED: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
    REJECTED: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
    RM_REJECTED: { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' },
    CANCELLED: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
  },
  
  // Leave type badge colors (soft-coded)
  leaveTypeColors: {
    annual: { bg: 'bg-blue-100', text: 'text-blue-700' },
    sick: { bg: 'bg-red-100', text: 'text-red-700' },
    unpaid: { bg: 'bg-gray-100', text: 'text-gray-700' },
    maternity: { bg: 'bg-pink-100', text: 'text-pink-700' },
    paternity: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
    compassionate: { bg: 'bg-purple-100', text: 'text-purple-700' },
    study: { bg: 'bg-cyan-100', text: 'text-cyan-700' },
    other: { bg: 'bg-slate-100', text: 'text-slate-600' },
  },
  
  // Pagination (soft-coded)
  defaultPageSize: 25,
  pageSizeOptions: [10, 25, 50, 100],
  
  // Export functionality
  exportEnabled: true,
  exportFilename: 'leave_records',
  
  // Quick stats to show above the table
  quickStats: [
    { key: 'total', label: 'Total Records', icon: 'ClipboardDocumentListIcon', color: 'slate' },
    { key: 'pending', label: 'Pending Approval', icon: 'ClockIcon', color: 'amber' },
    { key: 'approved', label: 'Approved', icon: 'CheckCircleIcon', color: 'green' },
    { key: 'rejected', label: 'Rejected', icon: 'XCircleIcon', color: 'red' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// 4b. AI CHAMPION SPOTLIGHT — configuration for the embedded AI Champion card.
//
// Reads from the existing `analyticsService` (no backend changes). The card
// degrades gracefully when:
//   - the viewer is not admin (endpoint returns 403)  → shows a CTA
//   - the AI Champion module is not yet seeded         → shows empty state
//
// Tweak the rolling window, podium size and route here — no JSX edits needed.
// ─────────────────────────────────────────────────────────────────────────────
export const HR_DASHBOARD_AI_CHAMPION = {
  // Rolling window (days) used for both leaderboard and cost report.
  windowDays: 30,
  // Top-N spots to surface in the podium row.
  podiumSize: 3,
  // Route the “Open full console” action navigates to.
  fullConsoleRoute: '/admin/ai-champion',
  // Auto-refresh interval (ms). Falls back to the dashboard’s base poll cadence
  // when undefined. Use a larger value than HR_DASHBOARD_POLL_MS — champion
  // metrics don’t move minute-to-minute.
  pollMs: 5 * 60 * 1000,
  // Tier visual styling (matches Admin/AIChampion.jsx TIER_STYLES, kept inline
  // so the dashboard has no cross-page imports).
  tierStyles: {
    diamond:   { ring: 'from-cyan-400 via-blue-500 to-indigo-600',     pill: 'bg-blue-50 text-blue-700 border-blue-200',       emoji: '\uD83D\uDC8E' },
    platinum:  { ring: 'from-slate-300 via-slate-400 to-slate-600',    pill: 'bg-slate-100 text-slate-700 border-slate-300',   emoji: '\uD83C\uDFC6' },
    gold:      { ring: 'from-yellow-300 via-amber-400 to-orange-500',  pill: 'bg-yellow-50 text-yellow-700 border-yellow-200', emoji: '\uD83E\uDD47' },
    silver:    { ring: 'from-gray-200 via-gray-300 to-gray-500',       pill: 'bg-gray-100 text-gray-700 border-gray-300',      emoji: '\uD83E\uDD48' },
    bronze:    { ring: 'from-amber-300 via-amber-500 to-orange-700',   pill: 'bg-amber-50 text-amber-700 border-amber-200',    emoji: '\uD83E\uDD49' },
    rookie:    { ring: 'from-emerald-200 via-emerald-300 to-teal-500', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', emoji: '\uD83C\uDF31' },
    founder:   { ring: 'from-fuchsia-400 via-purple-500 to-indigo-700', pill: 'bg-purple-50 text-purple-700 border-purple-300', emoji: '\uD83D\uDC51' },
    architect: { ring: 'from-sky-400 via-blue-500 to-indigo-700',      pill: 'bg-sky-50 text-sky-700 border-sky-300',          emoji: '\uD83C\uDFDB\uFE0F' },
  },
  // Default tier when the row doesn’t declare one.
  defaultTier: 'rookie',
  // KPI tiles shown alongside the podium.
  kpis: [
    { id: 'champion', label: 'Current Champion', icon: 'TrophyIcon',     accent: 'from-amber-400 to-orange-600' },
    { id: 'players',  label: 'Active Players',   icon: 'UsersIcon',      accent: 'from-emerald-500 to-teal-600' },
    { id: 'activity', label: 'Activity Events',  icon: 'BoltIcon',       accent: 'from-blue-500 to-indigo-600' },
    { id: 'savings',  label: 'AI Cost Tracked',  icon: 'CurrencyDollarIcon', accent: 'from-purple-500 to-fuchsia-600' },
  ],
}

// Pull a tier style by code, with safe fallback to the default tier.
export const getAIChampionTierStyle = (tier) => {
  const t = (tier || HR_DASHBOARD_AI_CHAMPION.defaultTier || 'rookie').toLowerCase()
  return (
    HR_DASHBOARD_AI_CHAMPION.tierStyles[t] ||
    HR_DASHBOARD_AI_CHAMPION.tierStyles[HR_DASHBOARD_AI_CHAMPION.defaultTier] ||
    { ring: 'from-slate-300 to-slate-500', pill: 'bg-slate-100 text-slate-700 border-slate-300', emoji: '\u2728' }
  )
}

// Build a podium dataset from a raw leaderboard response.
// Accepts either `{ leaderboard: [...] }`, `{ results: [...] }` or a bare array.
export const buildAIChampionPodium = (raw) => {
  const list =
    (Array.isArray(raw?.leaderboard) && raw.leaderboard) ||
    (Array.isArray(raw?.results) && raw.results) ||
    (Array.isArray(raw) && raw) ||
    []
  return list.slice(0, HR_DASHBOARD_AI_CHAMPION.podiumSize).map((row, idx) => ({
    rank: row.rank ?? idx + 1,
    name:
      row.user_full_name ||
      row.full_name ||
      row.name ||
      row.user?.full_name ||
      `${row.user?.first_name || ''} ${row.user?.last_name || ''}`.trim() ||
      row.email ||
      'Unknown',
    email: row.email || row.user?.email || '',
    department: row.department || row.user?.department || '',
    score: Number(row.total_score ?? row.score ?? 0),
    tier: (row.tier || row.badge_tier || HR_DASHBOARD_AI_CHAMPION.defaultTier).toLowerCase(),
    aiInteractions: Number(row.ai_interactions ?? row.ai_usage_count ?? 0),
    activityCount: Number(row.activity_count ?? row.total_actions ?? 0),
    avatar: row.avatar || row.user?.avatar || null,
  }))
}

// Format a currency-style USD value for the AI cost KPI.
export const formatAICost = (raw) => {
  const cost = Number(
    raw?.total_cost_usd ??
      raw?.total_cost ??
      raw?.summary?.total_cost_usd ??
      raw?.summary?.total_cost ??
      0
  )
  if (!Number.isFinite(cost) || cost === 0) return '$0'
  if (cost >= 1000) return `$${(cost / 1000).toFixed(1)}K`
  return `$${cost.toFixed(2)}`
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. DEPARTMENT / DISCIPLINE BREAKDOWN
//    Returns ordered [{label, count, accent}, ...]
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_BAR_ACCENT = 'from-slate-400 to-slate-600'

export const buildDepartmentBreakdown = (workforce, topN = 8) => {
  const map = new Map()
  for (const e of workforce) {
    const key = (e.department || 'Unassigned').trim() || 'Unassigned'
    map.set(key, (map.get(key) || 0) + 1)
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([label, count]) => ({ label, count, accent: DEFAULT_BAR_ACCENT }))
}

export const buildDisciplineBreakdown = (workforce) => {
  const map = new Map()
  for (const e of workforce) {
    const d = matchDiscipline(e.engineer_profile?.discipline || e.department)
    const key = d?.label || 'Other / Unmapped'
    const tone = d?.tone || 'bg-slate-100 text-slate-700'
    if (!map.has(key)) map.set(key, { count: 0, tone })
    map.get(key).count += 1
  }
  return Array.from(map.entries())
    .map(([label, v]) => ({ label, count: v.count, tone: v.tone }))
    .sort((a, b) => b.count - a.count)
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. TODAY PUNCTUALITY — derived from daily report rows
// ─────────────────────────────────────────────────────────────────────────────
export const buildTodayPunctuality = (dailyRows) => {
  const rows = Array.isArray(dailyRows) ? dailyRows : []
  const total = rows.length
  const late = rows.filter((r) => r.is_late).length
  const full = rows.filter((r) => r.is_full_day).length
  const half = total - full
  return {
    total,
    late,
    onTime: total - late,
    full,
    half,
    onTimePct: pct(total - late, total),
    fullPct: pct(full, total),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. MONTH-TO-DATE ROLLUP — derived from monthly report rows
// ─────────────────────────────────────────────────────────────────────────────
export const buildMonthRollup = (monthlyRows) => {
  const rows = Array.isArray(monthlyRows) ? monthlyRows : []
  let totalHours = 0
  let totalDays = 0
  let totalLate = 0
  let totalFull = 0
  let totalHalf = 0
  for (const r of rows) {
    totalHours += Number(r.total_hours || 0)
    totalDays += Number(r.days_present || 0)
    totalLate += Number(r.late_arrivals || 0)
    totalFull += Number(r.full_days || 0)
    totalHalf += Number(r.half_days || 0)
  }
  const employees = rows.length
  return {
    employees,
    totalHours: Math.round(totalHours),
    avgHoursPerEmployee: employees > 0 ? (totalHours / employees).toFixed(1) : '0.0',
    avgDaysPerEmployee: employees > 0 ? (totalDays / employees).toFixed(1) : '0.0',
    totalLate,
    totalFull,
    totalHalf,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. RECENT JOINERS — last N days
// ─────────────────────────────────────────────────────────────────────────────
export const buildRecentJoiners = (workforce) => {
  const cutoff = Date.now() - HR_DASHBOARD_RECENT_JOINER_DAYS * 86400000
  return workforce
    .filter((e) => {
      const t = new Date(e.created_at || 0).getTime()
      return !Number.isNaN(t) && t >= cutoff
    })
    .sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    )
    .slice(0, HR_DASHBOARD_RECENT_JOINER_LIMIT)
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. LIVE ACTIVITY FEED — latest punches sorted newest-first
// ─────────────────────────────────────────────────────────────────────────────
export const buildLiveFeed = (live) => {
  const rows = Array.isArray(live?.rows) ? live.rows : []
  // live.rows already returns latest-per-employee; sort by time desc for the feed.
  return [...rows]
    .sort((a, b) => {
      const ta = new Date(a.punch_time || a.login_time || a.logout_time || 0).getTime()
      const tb = new Date(b.punch_time || b.login_time || b.logout_time || 0).getTime()
      return tb - ta
    })
    .slice(0, HR_DASHBOARD_LIVE_FEED_LIMIT)
}

// Convenience: format a punch row's time + minute-since-now badge.
export const formatPunchTime = (row) => {
  const raw = row?.punch_time || row?.login_time || row?.logout_time
  if (!raw) return { time: '—', minutesAgo: null, stale: true }
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return { time: String(raw), minutesAgo: null, stale: true }
  const minutesAgo = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000))
  return {
    time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    minutesAgo,
    stale: minutesAgo > HR_DASHBOARD_STALE_PUNCH_MIN,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. QUICK LINKS
// ─────────────────────────────────────────────────────────────────────────────
export const HR_DASHBOARD_QUICK_LINKS = [
  {
    id: 'employees',
    label: 'Employee Directory',
    description: 'Browse the full workforce',
    to: '/hr/employees',
    icon: 'UserGroupIcon',
    tone: 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100',
  },
  {
    id: 'payroll',
    label: 'Payroll & Salary',
    description: 'Attendance, leave, payroll engine & salary management',
    to: '/hr/payroll',
    icon: 'BanknotesIcon',
    tone: 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100',
  },
  {
    id: 'selfservice',
    label: 'Self-Service Portal',
    description: 'Personal leave, attendance, timesheet & payroll',
    to: '/hr/leave',
    icon: 'SparklesIcon',
    tone: 'bg-violet-50 text-violet-700 border-violet-100 hover:bg-violet-100',
  },
  {
    id: 'timesheet',
    label: 'Time Sheet Analytics',
    description: 'Live, daily and monthly biometric reports',
    to: '/hr/employees?tab=timesheet',
    icon: 'ClockIcon',
    tone: 'bg-cyan-50 text-cyan-700 border-cyan-100 hover:bg-cyan-100',
  },
  {
    id: 'admin',
    label: 'User Management',
    description: 'Manage roles and access control',
    to: '/admin/users',
    icon: 'ShieldCheckIcon',
    tone: 'bg-purple-50 text-purple-700 border-purple-100 hover:bg-purple-100',
  },
  {
    id: 'ai_champion',
    label: 'AI Champion Console',
    description: 'Leaderboard, badges and AI usage analytics',
    to: '/admin/ai-champion',
    icon: 'TrophyIcon',
    tone: 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100',
  },
  {
    id: 'profile',
    label: 'My Profile',
    description: 'Personal details and security',
    to: '/profile',
    icon: 'UserCircleIcon',
    tone: 'bg-slate-50 text-slate-700 border-slate-100 hover:bg-slate-100',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// 11. STATUS DISTRIBUTION (donut-style chip strip)
// ─────────────────────────────────────────────────────────────────────────────
export const HR_DASHBOARD_STATUS_PALETTE = {
  active:    { label: 'Active',    bar: 'bg-emerald-500', text: 'text-emerald-700' },
  pending:   { label: 'Pending',   bar: 'bg-amber-500',   text: 'text-amber-700' },
  inactive:  { label: 'Inactive',  bar: 'bg-slate-400',   text: 'text-slate-600' },
  suspended: { label: 'Suspended', bar: 'bg-red-500',     text: 'text-red-700' },
  on_leave:  { label: 'On Leave',  bar: 'bg-blue-500',    text: 'text-blue-700' },
}

export const buildStatusDistribution = (workforce) => {
  const map = new Map()
  for (const e of workforce) {
    const s = e.status || 'inactive'
    map.set(s, (map.get(s) || 0) + 1)
  }
  return Array.from(map.entries())
    .map(([code, count]) => ({
      code,
      count,
      ...(HR_DASHBOARD_STATUS_PALETTE[code] || {
        label: code,
        bar: 'bg-slate-300',
        text: 'text-slate-600',
      }),
    }))
    .sort((a, b) => b.count - a.count)
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. KPI DRILL-DOWN REPORT CONFIGS
//     Maps each top KPI tile id → the full report shown in the slide-over modal.
//     `getRows({ workforce, live, daily, monthly })` returns the report rows.
//     `columns` declares how each column is labelled and rendered.
//     Badge types: statusBadge | mfaBadge | lateBadge | attendanceBadge | mono
// ─────────────────────────────────────────────────────────────────────────────
const _liveName  = (r) => r.radai_full_name  || r.name || r.employee_name  || r.employee_code || '—'
const _liveDept  = (r) => r.radai_department || r.department || '—'
const _liveTime  = (raw) => {
  if (!raw) return '—'
  const d = new Date(raw)
  return Number.isNaN(d.getTime())
    ? String(raw)
    : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export const HR_DASHBOARD_KPI_REPORTS = {
  headcount: {
    title: 'Total Headcount',
    description: 'All registered employees across every status and department.',
    icon: 'UsersIcon',
    accentGradient: 'from-blue-500 to-indigo-600',
    emptyMsg: 'No employees registered.',
    getRows: ({ workforce }) => workforce,
    searchFn: (r) =>
      `${fullName(r)} ${getEmail(r)} ${r.department || ''} ${r.status || ''}`.toLowerCase(),
    columns: [
      { key: 'name',   label: 'Name',       render: (r) => fullName(r) || '—' },
      { key: 'email',  label: 'Email',       render: (r) => getEmail(r) || '—', mono: true },
      { key: 'dept',   label: 'Department',  render: (r) => r.department || '—' },
      { key: 'status', label: 'Status',      render: (r) => r.status || '—', statusBadge: true },
      { key: 'mfa',    label: 'MFA',         render: (r) => r.is_mfa_enabled ? 'Enabled' : 'Disabled', mfaBadge: true },
      { key: 'joined', label: 'Joined',      render: (r) => formatDate(r.created_at) },
    ],
  },

  active: {
    title: 'Active Employees',
    description: 'Employees with "active" status — currently engaged in the organisation.',
    icon: 'CheckBadgeIcon',
    accentGradient: 'from-emerald-500 to-teal-600',
    emptyMsg: 'No active employees found.',
    getRows: ({ workforce }) => workforce.filter((e) => e.status === 'active'),
    searchFn: (r) =>
      `${fullName(r)} ${getEmail(r)} ${r.department || ''}`.toLowerCase(),
    columns: [
      { key: 'name',   label: 'Name',       render: (r) => fullName(r) || '—' },
      { key: 'email',  label: 'Email',       render: (r) => getEmail(r) || '—', mono: true },
      { key: 'dept',   label: 'Department',  render: (r) => r.department || '—' },
      { key: 'mfa',    label: 'MFA',         render: (r) => r.is_mfa_enabled ? 'Enabled' : 'Disabled', mfaBadge: true },
      { key: 'joined', label: 'Joined',      render: (r) => formatDate(r.created_at) },
    ],
  },

  currently_in: {
    title: 'Currently IN',
    description: 'Employees with a live punch-IN recorded from the biometric system right now.',
    icon: 'ArrowRightOnRectangleIcon',
    accentGradient: 'from-green-500 to-emerald-600',
    emptyMsg: 'No employees currently punched in.',
    getRows: ({ live }) => {
      const rows = Array.isArray(live?.rows) ? live.rows : []
      // Use the backend-computed `is_in` boolean (authoritative) with a
      // punch_type fallback for rows that pre-date the is_in enrichment.
      return rows.filter((r) =>
        r.is_in === true ||
        (r.is_in === undefined &&
          ['IN', '1'].includes((r.punch_type || '').toString().toUpperCase()))
      )
    },
    searchFn: (r) => `${_liveName(r)} ${_liveDept(r)}`.toLowerCase(),
    columns: [
      { key: 'name',   label: 'Name',       render: (r) => _liveName(r) },
      { key: 'dept',   label: 'Department', render: (r) => _liveDept(r) },
      { key: 'code',   label: 'Emp. Code',  render: (r) => r.employee_code || '—', mono: true },
      { key: 'punch',  label: 'Punch Time', render: (r) => _liveTime(r.punch_time || r.login_time) },
    ],
  },

  currently_out: {
    title: 'Currently OUT',
    description: 'Employees whose last biometric record today is an OUT punch.',
    icon: 'ArrowLeftOnRectangleIcon',
    accentGradient: 'from-slate-500 to-slate-700',
    emptyMsg: 'No employees marked as out.',
    getRows: ({ live }) => {
      const rows = Array.isArray(live?.rows) ? live.rows : []
      // `is_in === false` is set by the backend for every OUT row — this is
      // the same field the summary.currently_out counter uses, so the
      // drill-down count will always match the KPI tile.
      return rows.filter((r) =>
        r.is_in === false ||
        (r.is_in === undefined &&
          ['OUT', '0', '2'].includes((r.punch_type || '').toString().toUpperCase()))
      )
    },
    searchFn: (r) => `${_liveName(r)} ${_liveDept(r)}`.toLowerCase(),
    columns: [
      { key: 'name',    label: 'Name',        render: (r) => _liveName(r) },
      { key: 'dept',    label: 'Department',  render: (r) => _liveDept(r) },
      { key: 'code',    label: 'Emp. Code',   render: (r) => r.employee_code || '—', mono: true },
      { key: 'punch',   label: 'Punched Out', render: (r) => _liveTime(r.punch_time || r.logout_time) },
    ],
  },

  late_today: {
    title: 'Late Arrivals Today',
    description: 'Employees who punched in after the grace period cutoff for today.',
    icon: 'ClockIcon',
    accentGradient: 'from-amber-500 to-orange-600',
    emptyMsg: 'No late arrivals recorded today.',
    getRows: ({ daily }) =>
      (Array.isArray(daily?.rows) ? daily.rows : []).filter((r) => r.is_late),
    searchFn: (r) =>
      `${r.employee_name || r.name || r.employee_code || ''} ${r.department || ''}`.toLowerCase(),
    columns: [
      { key: 'name',  label: 'Name',        render: (r) => r.employee_name || r.name || r.employee_code || '—' },
      { key: 'dept',  label: 'Department',  render: (r) => r.department || '—' },
      { key: 'in',    label: 'Punch In',    render: (r) => r.first_in_time || r.login_time || '—' },
      { key: 'hours', label: 'Hours Today', render: (r) => r.total_hours != null ? `${Number(r.total_hours).toFixed(1)}h` : '—' },
      { key: 'flag',  label: 'Status',      render: () => 'Late', lateBadge: true },
    ],
  },

  attendance_rate: {
    title: "Today's Attendance",
    description: 'All employees tracked via biometric today — punch records and hours worked.',
    icon: 'PresentationChartLineIcon',
    accentGradient: 'from-cyan-500 to-blue-600',
    emptyMsg: 'No attendance data captured for today.',
    getRows: ({ daily }) => Array.isArray(daily?.rows) ? daily.rows : [],
    searchFn: (r) =>
      `${r.employee_name || r.name || r.employee_code || ''} ${r.department || ''}`.toLowerCase(),
    columns: [
      { key: 'name',    label: 'Name',       render: (r) => r.employee_name || r.name || r.employee_code || '—' },
      { key: 'dept',    label: 'Department', render: (r) => r.department || '—' },
      { key: 'in',      label: 'First In',   render: (r) => r.first_in_time || r.login_time || '—' },
      { key: 'hours',   label: 'Hours',      render: (r) => r.total_hours != null ? `${Number(r.total_hours).toFixed(1)}h` : '—' },
      { key: 'late',    label: 'Punctuality', render: (r) => r.is_late ? 'Late' : 'On Time', attendanceBadge: true },
      { key: 'fullday', label: 'Full Day',   render: (r) => r.is_full_day ? 'Yes' : 'No' },
    ],
  },

  pending_onboarding: {
    title: 'Pending Onboarding',
    description: 'Active Onboarding | Offboarding requests and employee accounts awaiting first login.',
    icon: 'UserPlusIcon',
    accentGradient: 'from-purple-500 to-fuchsia-600',
    emptyMsg: 'No employees pending onboarding.',
    getRows: (ctx) => buildPendingOnboardingRows(ctx),
    searchFn: (r) =>
      `${r.employee_name || fullName(r)} ${r.employee_email || getEmail(r)} ${r.employee_id || ''} ${r.department || ''} ${r.request_type || ''}`.toLowerCase(),
    columns: [
      { key: 'type',   label: 'Request Type', render: (r) => r.request_type || 'Onboarding', typeBadge: true },
      { key: 'name',   label: 'Employee',    render: (r) => r.employee_name || fullName(r) || '—' },
      { key: 'emp_id', label: 'Employee ID', render: (r) => r.employee_id || '—', mono: true },
      { key: 'dept',   label: 'Department',  render: (r) => r.department || '—' },
      { key: 'status', label: 'Status',      render: (r) => r.display_status || r.status || '—', statusBadge: true },
      { key: 'date',   label: 'Joining / Exit Date', render: (r) => formatDate(r.effective_date) },
      { key: 'action', label: 'Action', actionLink: true, render: (r) => r.request_type === 'Onboarding' ? 'Open IT Checklist' : r.request_type === 'Offboarding' ? 'Open Offboarding' : 'Open Account' },
    ],
  },

  mfa_adoption: {
    title: 'MFA Adoption Report',
    description: 'Two-factor authentication status for all registered employees. Disabled accounts shown first.',
    icon: 'ShieldCheckIcon',
    accentGradient: 'from-indigo-500 to-violet-600',
    emptyMsg: 'No employees found.',
    getRows: ({ workforce }) =>
      [...workforce].sort((a, b) => {
        // Disabled first so HR can act on them immediately
        if (!a.is_mfa_enabled && b.is_mfa_enabled) return -1
        if (a.is_mfa_enabled && !b.is_mfa_enabled) return 1
        return 0
      }),
    searchFn: (r) =>
      `${fullName(r)} ${getEmail(r)} ${r.department || ''}`.toLowerCase(),
    columns: [
      { key: 'name',   label: 'Name',       render: (r) => fullName(r) || '—' },
      { key: 'email',  label: 'Email',       render: (r) => getEmail(r) || '—', mono: true },
      { key: 'dept',   label: 'Department',  render: (r) => r.department || '—' },
      { key: 'status', label: 'Status',      render: (r) => r.status || '—', statusBadge: true },
      { key: 'mfa',    label: 'MFA Status',  render: (r) => r.is_mfa_enabled ? 'Enabled' : 'Disabled', mfaBadge: true },
    ],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. GREETING HELPER (shown in header)
// ─────────────────────────────────────────────────────────────────────────────
export const getGreeting = () => {
  const h = new Date().getHours()
  if (h < 12) return HR_DASHBOARD_COPY.greetingMorning
  if (h < 17) return HR_DASHBOARD_COPY.greetingAfternoon
  return HR_DASHBOARD_COPY.greetingEvening
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. EXPORT BUNDLE
// ─────────────────────────────────────────────────────────────────────────────
export default {
  HR_DASHBOARD_POLL_MS,
  HR_DASHBOARD_FETCH_PAGE_SIZE,
  HR_DASHBOARD_LIVE_FEED_LIMIT,
  HR_DASHBOARD_RECENT_JOINER_DAYS,
  HR_DASHBOARD_RECENT_JOINER_LIMIT,
  HR_DASHBOARD_STALE_PUNCH_MIN,
  HR_DASHBOARD_COPY,
  HR_DASHBOARD_KPIS,
  HR_DASHBOARD_PAYROLL_KPIS,
  HR_DASHBOARD_SECTIONS,
  HR_DASHBOARD_AI_CHAMPION,
  HR_DASHBOARD_QUICK_LINKS,
  HR_DASHBOARD_STATUS_PALETTE,
  HR_DASHBOARD_PENDING_TYPES,
  getAIChampionTierStyle,
  buildAIChampionPodium,
  buildTotalPending,
  formatAICost,
  HR_DISCIPLINES,
  buildDepartmentBreakdown,
  buildDisciplineBreakdown,
  buildTodayPunctuality,
  buildMonthRollup,
  buildRecentJoiners,
  buildLiveFeed,
  buildStatusDistribution,
  formatPunchTime,
  getGreeting,
}
