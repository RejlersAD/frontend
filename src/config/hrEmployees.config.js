/**
 * HR Employees Configuration (Soft-Coded)
 * ----------------------------------------
 * Centralised, framework-friendly configuration for the HR > Employees page
 * (`/hr/employees`). Every threshold, filter option, KPI definition, status
 * label, column, view-mode and tab is defined here — the page component
 * should consume this config and stay free of magic values.
 *
 * Domain context: oil & gas EPC consultancy, multi-discipline engineering
 * workforce, multi-organisation (legal entities), long employee tenures.
 *
 * To extend:
 *   - Add a new KPI → push to HR_KPIS (provide id, label, icon, compute)
 *   - Add a new filter → push to HR_FILTERS
 *   - Add a new view mode → push to HR_VIEW_MODES + handle render in the page
 *   - Add a new detail tab → push to HR_DETAIL_TABS + add a renderer
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. STATUSES — keep in sync with backend UserProfile.STATUS_CHOICES
// ─────────────────────────────────────────────────────────────────────────────
export const HR_STATUSES = {
  active:    { label: 'Active',     dot: 'bg-emerald-500', tone: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  inactive:  { label: 'Inactive',   dot: 'bg-slate-400',   tone: 'bg-slate-100 text-slate-600 border-slate-200' },
  suspended: { label: 'Suspended',  dot: 'bg-red-500',     tone: 'bg-red-100 text-red-700 border-red-200' },
  pending:   { label: 'Pending',    dot: 'bg-amber-500',   tone: 'bg-amber-100 text-amber-700 border-amber-200' },
  on_leave:  { label: 'On Leave',   dot: 'bg-blue-500',    tone: 'bg-blue-100 text-blue-700 border-blue-200' },
}

export const getStatusMeta = (status) =>
  HR_STATUSES[status] || { label: status || 'Unknown', dot: 'bg-slate-400', tone: 'bg-slate-100 text-slate-600 border-slate-200' }

// ─────────────────────────────────────────────────────────────────────────────
// 2. ENGINEERING DISCIPLINES — Oil & Gas EPC taxonomy
//    These are surfaced as filters and as colour tags on employee cards.
//    Source field: rbac/users → engineer_profile.discipline (free text fallback
//    to UserProfile.department).
// ─────────────────────────────────────────────────────────────────────────────
export const HR_DISCIPLINES = [
  { code: 'process',      label: 'Process',           tone: 'bg-purple-100 text-purple-700' },
  { code: 'piping',       label: 'Piping',            tone: 'bg-cyan-100 text-cyan-700' },
  { code: 'mechanical',   label: 'Mechanical',        tone: 'bg-orange-100 text-orange-700' },
  { code: 'electrical',   label: 'Electrical',        tone: 'bg-yellow-100 text-yellow-700' },
  { code: 'instrument',   label: 'Instrumentation',   tone: 'bg-pink-100 text-pink-700' },
  { code: 'civil',        label: 'Civil & Structural', tone: 'bg-stone-100 text-stone-700' },
  { code: 'safety',       label: 'HSE / Loss Prev.',  tone: 'bg-red-100 text-red-700' },
  { code: 'quality',      label: 'Quality / QA-QC',   tone: 'bg-lime-100 text-lime-700' },
  { code: 'project',      label: 'Project Management', tone: 'bg-indigo-100 text-indigo-700' },
  { code: 'procurement',  label: 'Procurement',       tone: 'bg-teal-100 text-teal-700' },
  { code: 'commissioning', label: 'Commissioning',    tone: 'bg-rose-100 text-rose-700' },
  { code: 'admin',        label: 'Admin & Support',   tone: 'bg-slate-100 text-slate-700' },
  { code: 'hr',           label: 'Human Resources',   tone: 'bg-fuchsia-100 text-fuchsia-700' },
  { code: 'finance',      label: 'Finance',           tone: 'bg-emerald-100 text-emerald-700' },
  { code: 'it',           label: 'IT / Digital',      tone: 'bg-sky-100 text-sky-700' },
]

export const matchDiscipline = (raw) => {
  if (!raw) return null
  const needle = String(raw).toLowerCase()
  return HR_DISCIPLINES.find(d => needle.includes(d.code) || needle.includes(d.label.toLowerCase().split(/[\s/]/)[0])) || null
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. EMPLOYMENT TYPES — soft-coded so HR can add new contract categories.
// ─────────────────────────────────────────────────────────────────────────────
export const HR_EMPLOYMENT_TYPES = [
  { code: 'permanent',  label: 'Permanent' },
  { code: 'contract',   label: 'Contract' },
  { code: 'consultant', label: 'Consultant' },
  { code: 'intern',     label: 'Intern' },
  { code: 'secondment', label: 'Secondment' },
]

// ─────────────────────────────────────────────────────────────────────────────
// 4. KPI CARDS — each KPI is a pure function over the loaded employee list
// ─────────────────────────────────────────────────────────────────────────────
const daysAgo = (iso, n) => {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return !Number.isNaN(t) && (Date.now() - t) <= n * 86400000
}

const yearsSince = (iso) => {
  if (!iso) return 0
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 0
  return Math.max(0, (Date.now() - t) / (365.25 * 86400000))
}

export const HR_KPIS = [
  {
    id: 'headcount',
    label: 'Total Headcount',
    accent: 'from-blue-500 to-indigo-600',
    calmTone: 'bg-blue-50 text-blue-700 border-blue-100',
    icon: 'UsersIcon',
    compute: (list) => list.length,
    sub: 'All registered employees',
  },
  {
    id: 'active',
    label: 'Active',
    accent: 'from-emerald-500 to-teal-600',
    calmTone: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    icon: 'CheckBadgeIcon',
    compute: (list) => list.filter(e => e.status === 'active').length,
    sub: 'Currently working',
  },
  {
    id: 'pending_onboarding',
    label: 'Pending Onboarding',
    accent: 'from-amber-500 to-orange-600',
    calmTone: 'bg-amber-50 text-amber-700 border-amber-100',
    icon: 'ClockIcon',
    compute: (list) => list.filter(e => e.status === 'pending').length,
    sub: 'Awaiting first login / setup',
  },
  {
    id: 'new_joiners_30d',
    label: 'New Joiners (30d)',
    accent: 'from-purple-500 to-fuchsia-600',
    calmTone: 'bg-purple-50 text-purple-700 border-purple-100',
    icon: 'SparklesIcon',
    compute: (list) => list.filter(e => daysAgo(e.created_at, 30)).length,
    sub: 'Joined in the last 30 days',
  },
  {
    id: 'departments',
    label: 'Departments',
    accent: 'from-cyan-500 to-blue-600',
    calmTone: 'bg-cyan-50 text-cyan-700 border-cyan-100',
    icon: 'BuildingOffice2Icon',
    compute: (list) => new Set(list.map(e => (e.department || '').trim()).filter(Boolean)).size,
    sub: 'Distinct department codes',
  },
  {
    id: 'disciplines',
    label: 'Disciplines Covered',
    accent: 'from-rose-500 to-pink-600',
    calmTone: 'bg-rose-50 text-rose-700 border-rose-100',
    icon: 'BeakerIcon',
    compute: (list) => new Set(list.map(e => matchDiscipline(e.engineer_profile?.discipline || e.department)?.code).filter(Boolean)).size,
    sub: 'Engineering specialisations',
  },
  {
    id: 'mfa_adoption',
    label: 'MFA Adoption',
    accent: 'from-indigo-500 to-violet-600',
    calmTone: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    icon: 'ShieldCheckIcon',
    compute: (list) => list.length === 0 ? '0%' : `${Math.round((list.filter(e => e.is_mfa_enabled).length / list.length) * 100)}%`,
    sub: 'Two-factor enabled accounts',
  },
  {
    id: 'long_tenure',
    label: 'Veterans (10y+)',
    accent: 'from-yellow-500 to-amber-600',
    calmTone: 'bg-amber-50 text-amber-700 border-amber-100',
    icon: 'TrophyIcon',
    compute: (list) => list.filter(e => yearsSince(e.created_at) >= 10).length,
    sub: '10+ years of service',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// 5. FILTERS — declarative. The page renders a select per entry.
//    `optionsFrom: 'static'` uses `options` verbatim, otherwise the page derives
//    options from the loaded data using `optionsFrom` as the row accessor.
// ─────────────────────────────────────────────────────────────────────────────
export const HR_FILTERS = [
  {
    id: 'status',
    label: 'Status',
    optionsFrom: 'static',
    options: [
      { value: 'all', label: 'All statuses' },
      ...Object.entries(HR_STATUSES).map(([v, m]) => ({ value: v, label: m.label })),
    ],
    match: (emp, val) => val === 'all' || emp.status === val,
  },
  {
    id: 'department',
    label: 'Department',
    optionsFrom: (emp) => emp.department,
    placeholder: 'All departments',
    match: (emp, val) => val === 'all' || (emp.department || '') === val,
  },
  {
    id: 'discipline',
    label: 'Discipline',
    optionsFrom: 'static',
    options: [
      { value: 'all', label: 'All disciplines' },
      ...HR_DISCIPLINES.map(d => ({ value: d.code, label: d.label })),
    ],
    match: (emp, val) => val === 'all' || matchDiscipline(emp.engineer_profile?.discipline || emp.department)?.code === val,
  },
  {
    id: 'organization',
    label: 'Organisation',
    optionsFrom: (emp) => emp.organization_name,
    placeholder: 'All organisations',
    match: (emp, val) => val === 'all' || (emp.organization_name || '') === val,
  },
  {
    id: 'location',
    label: 'Location',
    optionsFrom: (emp) => emp.location,
    placeholder: 'All locations',
    match: (emp, val) => val === 'all' || (emp.location || '') === val,
  },
  {
    id: 'role',
    label: 'Role',
    optionsFrom: (emp) => (emp.roles && emp.roles[0]?.name) || null,
    placeholder: 'All roles',
    match: (emp, val) => val === 'all' || (emp.roles || []).some(r => r.name === val),
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// 6. VIEW MODES
// ─────────────────────────────────────────────────────────────────────────────
export const HR_VIEW_MODES = [
  // 'cards' view intentionally removed — toggle this entry back to re-enable it.
  { id: 'table',     label: 'Table',          icon: 'TableCellsIcon' },
  { id: 'dept',      label: 'Departments',    icon: 'BuildingOffice2Icon' },
  { id: 'timesheet', label: 'Time Sheet',     icon: 'ClockIcon' },
]
export const HR_DEFAULT_VIEW_MODE = 'table'

// ─────────────────────────────────────────────────────────────────────────────
// UI simplification toggles — tweak here to declutter or re-enrich the page
// without touching component code. The HR Employees page reads these to
// decide what to show by default.
// ─────────────────────────────────────────────────────────────────────────────
export const HR_UI = {
  // Which KPIs render in the always-visible "essential" strip. The rest
  // are hidden behind a "Show all metrics" toggle so the page is not
  // overwhelming on first load.
  essentialKpiIds:        ['headcount', 'active', 'pending_onboarding', 'new_joiners_30d'],
  // Filter dropdowns start collapsed. The search bar + view-mode toggle
  // remain visible at all times.
  filtersCollapsedByDefault: true,
  // Use solid pastel tiles for KPIs instead of vivid gradients. Set to
  // false to re-enable the original gradient look.
  calmKpis: true,
  // Master switch for motion: hover transitions, transforms, pulse skeletons
  // and spinners. When false, the page renders as plain static records —
  // no animation, no hover lift, no shimmer.
  animationsEnabled: false,
  // Loading placeholder shown in place of pulsing skeleton bars when
  // animations are off. Plain text only.
  staticLoadingPlaceholder: '…',
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. CARD FIELDS — controls which secondary lines appear on the employee card
// ─────────────────────────────────────────────────────────────────────────────
export const HR_CARD_FIELDS = [
  { id: 'job_title',   icon: 'BriefcaseIcon',         accessor: (e) => e.job_title || '—' },
  { id: 'department',  icon: 'BuildingOffice2Icon',   accessor: (e) => e.department || '—' },
  { id: 'email',       icon: 'EnvelopeIcon',          accessor: (e) => getEmail(e) || '—' },
  { id: 'phone',       icon: 'PhoneIcon',             accessor: (e) => e.phone || '—' },
  { id: 'location',    icon: 'MapPinIcon',            accessor: (e) => e.location || '—' },
  { id: 'employee_id', icon: 'IdentificationIcon',    accessor: (e) => e.employee_id || '—' },
]

// ─────────────────────────────────────────────────────────────────────────────
// 8. TABLE COLUMNS
// ─────────────────────────────────────────────────────────────────────────────
export const HR_TABLE_COLUMNS = [
  { id: 'name',         label: 'Employee',     accessor: (e) => `${e.user?.first_name || ''} ${e.user?.last_name || ''}`.trim() || getEmail(e) },
  { id: 'email',        label: 'Email',        accessor: (e) => getEmail(e) || '—' },
  { id: 'employee_id',  label: 'Employee ID',  accessor: (e) => e.employee_id || '—' },
  { id: 'job_title',    label: 'Designation',  accessor: (e) => e.job_title || '—' },
  { id: 'department',   label: 'Department',   accessor: (e) => e.department || '—' },
  { id: 'discipline',   label: 'Discipline',   accessor: (e) => matchDiscipline(e.engineer_profile?.discipline || e.department)?.label || '—' },
  { id: 'organization', label: 'Organisation', accessor: (e) => e.organization_name || '—' },
  { id: 'location',     label: 'Location',     accessor: (e) => e.location || '—' },
  { id: 'status',       label: 'Status',       accessor: (e) => e.status },
  { id: 'last_login',   label: 'Last Login',   accessor: (e) => e.last_login_at },
]

// ─────────────────────────────────────────────────────────────────────────────
// 9. DETAIL DRAWER TABS
// ─────────────────────────────────────────────────────────────────────────────
export const HR_DETAIL_TABS = [
  { id: 'overview',      label: 'Overview',            icon: 'UserCircleIcon' },
  { id: 'employment',    label: 'Employment',          icon: 'BriefcaseIcon' },
  { id: 'compensation',  label: 'Compensation',        icon: 'BanknotesIcon' },
  { id: 'timesheet',     label: 'Time Sheet',          icon: 'ClockIcon' },
  { id: 'competency',    label: 'Competency',          icon: 'AcademicCapIcon' },
  { id: 'access',        label: 'Roles & Access',      icon: 'KeyIcon' },
  { id: 'security',      label: 'Security & Activity', icon: 'ShieldCheckIcon' },
]
export const HR_DEFAULT_DETAIL_TAB = 'overview'

// Soft-coded drawer width per active tab. Tabs that visualise dense data
// (time sheet, competency matrices …) get a wider canvas; record-style
// tabs stay narrow. Add a tab id here to override its width. Fallback is
// `HR_DRAWER_WIDTH_DEFAULT`. Tailwind max-w-* class names only.
export const HR_DRAWER_WIDTH_DEFAULT = 'max-w-xl'
export const HR_DRAWER_WIDTH_BY_TAB = {
  timesheet:    'max-w-6xl',
  competency:   'max-w-3xl',
  compensation: 'max-w-2xl',
  access:       'max-w-3xl',
}

// ─────────────────────────────────────────────────────────────────────────────
// 9b. PER-USER TIMESHEET PANEL — drill-down inside detail drawer
// All copy + ranges + KPI definitions are soft-coded here.
// ─────────────────────────────────────────────────────────────────────────────
export const HR_TIMESHEET_RANGES = [
  { id: '7d',   label: 'Last 7 days',   days: 7   },
  { id: '30d',  label: 'Last 30 days',  days: 30  },
  { id: '90d',  label: 'Last 90 days',  days: 90  },
  { id: 'mtd',  label: 'Month to date', preset: 'mtd' },
  { id: 'ytd',  label: 'Year to date',  preset: 'ytd' },
  { id: '365d', label: 'Last 12 months', days: 365 },
]
export const HR_TIMESHEET_DEFAULT_RANGE = '30d'

// KPI tiles rendered at the top of the panel. Accessor receives `summary`.
export const HR_TIMESHEET_KPIS = [
  { id: 'total_hours',   label: 'Total Hours',     icon: 'ClockIcon',          tone: 'blue',    accessor: (s) => (s.total_hours ?? 0).toFixed(1) },
  { id: 'days_present',  label: 'Days Present',    icon: 'CheckCircleIcon',    tone: 'emerald', accessor: (s) => s.days_present ?? 0 },
  { id: 'avg_per_day',   label: 'Avg Hours / Day', icon: 'ChartBarIcon',       tone: 'violet',  accessor: (s) => (s.avg_hours_per_day ?? 0).toFixed(2) },
  { id: 'days_full',     label: 'Full Days',       icon: 'SunIcon',            tone: 'amber',   accessor: (s) => s.days_full ?? 0 },
  { id: 'avg_first_in',  label: 'Avg First In',    icon: 'ArrowRightOnRectangleIcon',  tone: 'sky',  accessor: (s) => s.avg_first_in || '—' },
  { id: 'avg_last_out',  label: 'Avg Last Out',    icon: 'ArrowLeftOnRectangleIcon',   tone: 'rose', accessor: (s) => s.avg_last_out || '—' },
]

export const HR_TIMESHEET_DAILY_COLUMNS = [
  { id: 'date',     label: 'Date',     accessor: (r) => r.date },
  { id: 'first_in', label: 'First In', accessor: (r) => (r.first_in || '').slice(11, 16) || '—' },
  { id: 'last_out', label: 'Last Out', accessor: (r) => (r.last_out || '').slice(11, 16) || '—' },
  { id: 'hours',    label: 'Hours',    accessor: (r) => ((r.hours_worked ?? r.hours ?? 0)).toFixed(2) },
  { id: 'punches',  label: 'Punches',  accessor: (r) => r.punch_count ?? r.punches ?? 0 },
]

export const HR_TIMESHEET_COPY = {
  panelTitle:      'Time Sheet',
  panelSubtitle:   'Consolidated attendance based on biometric punches',
  loadingState:    'Loading time-sheet records…',
  emptyState:      'No punches recorded for this period.',
  noMatchState:    'No biometric record matches this employee. Ensure their employee code or email is mapped in the directory.',
  errorState:      'Unable to load time-sheet data right now.',
  rangeLabel:      'Period',
  monthlyTitle:    'Monthly Breakdown',
  dailyTitle:      'Daily Attendance',
  punchesTitle:    'Hourly Records (raw punches)',
  punchesSubtitle: 'Every biometric event in this period — one row per punch, sorted newest first.',
  showPunches:     'Show hourly records',
  hidePunches:     'Hide hourly records',
  exportCsv:       'Export CSV',
  heroTitle:       'Attendance Snapshot',
  activityTitle:   'Daily Activity',
  emptyActivity:   'No working hours recorded in this period.',
}

// Soft-coded columns for the raw-punches table. Each entry is rendered as
// plain text in the same style as the daily-attendance table — no chips,
// no colour pills, no animation. Add / remove / reorder by editing this
// list; the component picks the change up automatically.
export const HR_TIMESHEET_PUNCH_COLUMNS = [
  { id: 'date',   label: 'Date',   accessor: (p) => p.date || (p.event_time || '').slice(0, 10) || '—' },
  { id: 'day',    label: 'Day',    accessor: (p) => {
      const d = new Date(p.event_time || p.date)
      return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { weekday: 'short' })
    } },
  { id: 'time',   label: 'Time',   accessor: (p) => (p.event_time || '').slice(11, 19) || '—', mono: true },
  { id: 'type',   label: 'Type',   accessor: (p) => (p.event_type || '—').toString().toUpperCase() },
  { id: 'device', label: 'Device', accessor: (p) => p.device || p.terminal || p.reader || '—' },
]

// Sort direction for the punches table. 'desc' = newest first.
export const HR_TIMESHEET_PUNCH_SORT = 'desc'

// Soft-coded columns for the "Daily Activity" table. Renders as plain text
// — no horizontal bar chart. The component shows hours as a number plus a
// short status word picked from HR_TIMESHEET_VISUALS.hourBands.
export const HR_TIMESHEET_ACTIVITY_COLUMNS = [
  { id: 'date',   label: 'Date',   accessor: (r) => r.date || '—' },
  { id: 'day',    label: 'Day',    accessor: (r) => {
      const d = new Date(r.date)
      return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { weekday: 'short' })
    } },
  { id: 'hours',  label: 'Hours',  accessor: (r) => {
      const h = Number(r.hours_worked ?? r.hours ?? 0)
      return h > 0 ? `${h.toFixed(2)} h` : '—'
    }, mono: true },
  { id: 'status', label: 'Status', accessor: (r) => {
      const h = Number(r.hours_worked ?? r.hours ?? 0)
      return r.__bandLabel || (h === 0 ? 'Absent' : '')
    } },
]
// Sort for daily activity table. 'desc' = newest first.
export const HR_TIMESHEET_ACTIVITY_SORT = 'desc'

// Soft-coded columns for the "Monthly Breakdown" table.
export const HR_TIMESHEET_MONTHLY_COLUMNS = [
  { id: 'month',   label: 'Month',     accessor: (m) => m.__monthLabel || m.month || '—' },
  { id: 'hours',   label: 'Hours',     accessor: (m) => `${Number(m.hours || 0).toFixed(1)} h`, mono: true },
  { id: 'days',    label: 'Days',      accessor: (m) => `${m.days_present || 0}` },
  { id: 'avg',     label: 'Avg/Day',   accessor: (m) => `${Number(m.avg_per_day || 0).toFixed(2)} h`, mono: true },
  { id: 'punches', label: 'Punches',   accessor: (m) => `${m.punches || 0}` },
]

// Visual / interaction defaults for the per-user timesheet panel. All
// thresholds, colours and chart geometry live here so tweaks never touch
// the component. Add new keys freely — accessors below pick them up.
export const HR_TIMESHEET_VISUALS = {
  // Bar chart: how a single day's hours map to colour zones.
  hourBands: [
    { upTo: 0,   color: 'bg-slate-200', label: 'Absent' },
    { upTo: 4,   color: 'bg-amber-300', label: 'Half day' },
    { upTo: 8,   color: 'bg-sky-400',   label: 'Standard' },
    { upTo: 999, color: 'bg-emerald-500', label: 'Overtime' },
  ],
  // Target hours per day — drives the bar-width %.
  targetHoursPerDay: 8,
  // Donut ring (utilisation) — px geometry.
  ringSize: 132,
  ringStroke: 12,
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. PAGINATION & DATA LOAD
// ─────────────────────────────────────────────────────────────────────────────
export const HR_PAGE_SIZES = [12, 24, 48, 96]
export const HR_DEFAULT_PAGE_SIZE = 24

// Backend `/rbac/users/` returns paginated results. Use a generous fetch size
// so all KPIs and the departments view reflect the full org, not just one page.
export const HR_DATA_FETCH_PAGE_SIZE = 500

// ─────────────────────────────────────────────────────────────────────────────
// 11. EXPORT FORMATS — reuses rbacService.exportUsers under the hood
// ─────────────────────────────────────────────────────────────────────────────
export const HR_EXPORT_FORMATS = [
  { value: 'csv',  label: 'Export CSV',  ext: 'csv'  },
  { value: 'xlsx', label: 'Export Excel', ext: 'xlsx' },
]

// ─────────────────────────────────────────────────────────────────────────────
// 12. ADMIN DEEP LINKS — keep create/edit flows on the dedicated admin page
//     instead of duplicating them here. HR users get read-rich view + drill-in.
// ─────────────────────────────────────────────────────────────────────────────
export const HR_ADMIN_USER_LINK = (id) => `/admin/users/${id}`
export const HR_ADMIN_USERS_LIST_LINK = '/admin/users'

// ─────────────────────────────────────────────────────────────────────────────
// 12a. EDIT MODE CONFIGURATION — Controls inline editing in detail drawer
//      Soft-coded: RBAC permissions, editable fields, validation rules, UI labels
// ─────────────────────────────────────────────────────────────────────────────
export const HR_EDIT_CONFIG = {
  // RBAC permission required to edit employee data (null = allow all)
  requiredPermission: 'hr.employee.update',
  // Fallback: allow edit if user has any of these roles
  allowedRoles: ['Super Administrator', 'Admin', 'HR Manager'],
  // Enable edit button in detail drawer footer
  enableEditMode: true,
  // Show "Edit in Admin" link even when inline edit is available
  showAdminLink: true,
  // Salary/Compensation editing permissions (stricter than general HR edits)
  salaryEditRoles: ['Super Administrator', 'Admin', 'Finance Manager'],
  salaryRequiredPermission: 'hr.salary.update',
}

// Soft-coded: Salary increment limits and validation rules
export const HR_SALARY_CONFIG = {
  // Maximum allowed percentage increase per edit (soft-coded limit)
  maxIncrementPercent: 30,  // 30% max increase
  // Minimum basic salary (AED) — validation floor
  minBasicSalary: 3000,
  // Maximum basic salary (AED) — validation ceiling
  maxBasicSalary: 100000,
  // Minimum total package (AED)
  minTotalPackage: 5000,
  // Maximum total package (AED)
  maxTotalPackage: 200000,
  // Require note/justification for increases above this %
  requireNoteAbovePercent: 15,
  // Currency symbol
  currencySymbol: 'AED',
  // Decimal places for salary fields
  decimalPlaces: 2,
  // Show salary history (requires audit trail implementation)
  showSalaryHistory: false,
}

// Editable fields per tab — each field defines:
//   - id: field name matching backend serializer
//   - label: display label
//   - type: input type (text | email | tel | number | select | textarea | multiselect | date | currency)
//   - required: validation flag
//   - options: for select/multiselect (can be array or async function)
//   - placeholder: input placeholder
//   - helpText: helper text below input
//   - validation: custom validation function (field, value) => error string | null
//   - readOnly: cannot be edited (display only)
export const HR_EDITABLE_FIELDS = {
  overview: [
    { 
      id: 'first_name', 
      label: 'First Name', 
      type: 'text', 
      required: true,
      placeholder: 'e.g., Mohammed',
      helpText: 'Legal first name as per Emirates ID'
    },
    { 
      id: 'last_name', 
      label: 'Last Name', 
      type: 'text', 
      required: true,
      placeholder: 'e.g., Al-Rahman',
      helpText: 'Legal last name as per Emirates ID'
    },
    { 
      id: 'email', 
      label: 'Email', 
      type: 'email', 
      required: true,
      placeholder: 'user@company.com',
      readOnly: true,
      helpText: 'Primary email for login. Contact IT to change.'
    },
    { id: 'employee_id', label: 'Employee ID', type: 'text', placeholder: 'e.g., EMP001' },
    { id: 'phone', label: 'Phone', type: 'tel', placeholder: '+971 50 123 4567' },
    { id: 'location', label: 'Office Location', type: 'text', placeholder: 'Dubai, UAE' },
    { 
      id: 'is_mfa_enabled', 
      label: 'Two-Factor Auth (2FA)', 
      type: 'select',
      readOnly: true,
      options: [
        { value: true, label: 'Enabled' },
        { value: false, label: 'Disabled' }
      ],
      helpText: 'Enable in Security settings'
    },
    { id: 'bio', label: 'Bio / Notes', type: 'textarea', rows: 3, maxLength: 500, placeholder: 'Brief profile, specializations, or internal notes...' },
  ],
  employment: [
    { 
      id: 'organization', 
      label: 'Organisation', 
      type: 'select', 
      optionsFrom: 'organizations',  // fetched from rbacService.getOrganizations()
      valueField: 'id',
      labelField: 'name',
      readOnly: true,  // Usually fixed; change via admin
      helpText: 'Organisation assignment cannot be changed here. Use Admin panel.'
    },
    { id: 'department', label: 'Department', type: 'text', placeholder: 'e.g., Process Engineering', required: true },
    { id: 'job_title', label: 'Designation', type: 'text', placeholder: 'e.g., Senior Process Engineer', required: true },
    { 
      id: 'status', 
      label: 'Employment Status', 
      type: 'select',
      options: Object.entries(HR_STATUSES).map(([v, m]) => ({ value: v, label: m.label })),
      required: true,
      helpText: 'Active = working, Inactive = on leave, Suspended = access blocked'
    },
    { 
      id: 'is_active', 
      label: 'Account Active', 
      type: 'select',
      options: [
        { value: true, label: 'Active - Can Login' },
        { value: false, label: 'Inactive - Login Blocked' }
      ],
      required: true,
      helpText: 'Controls system access. Inactive users cannot log in.'
    },
    { 
      id: 'manager', 
      label: 'Reports To (Manager)', 
      type: 'select',
      optionsFrom: 'managers',  // will be fetched dynamically
      valueField: 'id',
      labelField: 'name',
      helpText: 'Direct line manager for reporting hierarchy'
    },
    { 
      id: 'roles', 
      label: 'Assigned Roles', 
      type: 'multiselect',
      optionsFrom: 'roles',  // fetched from rbacService.getRoles()
      valueField: 'id',
      labelField: 'display_name',
      helpText: 'Select one or more roles. First selected role becomes primary.',
      required: true
    },
  ],
  competency: [
    { 
      id: 'engineer_profile.discipline', 
      label: 'Discipline', 
      type: 'select',
      options: HR_DISCIPLINES.map(d => ({ value: d.code, label: d.label })),
      helpText: 'Primary engineering discipline'
    },
    { 
      id: 'engineer_profile.certifications', 
      label: 'Certifications', 
      type: 'textarea',
      rows: 2,
      placeholder: 'PMP, CEng, Six Sigma Black Belt...',
      helpText: 'Professional certifications (comma-separated)'
    },
    { 
      id: 'engineer_profile.skills', 
      label: 'Technical Skills', 
      type: 'textarea',
      rows: 3,
      placeholder: 'HYSYS, AutoCAD, P&ID review, hazard analysis...',
      helpText: 'Key technical skills and software proficiencies'
    },
    { 
      id: 'engineer_profile.experience_years', 
      label: 'Total Experience (Years)', 
      type: 'number',
      min: 0,
      max: 50,
      step: 0.5,
      placeholder: 'e.g., 10.5'
    },
  ],
  compensation: [
    {
      id: 'payroll.basic',
      label: 'Basic Salary',
      type: 'currency',
      required: true,
      min: HR_SALARY_CONFIG.minBasicSalary,
      max: HR_SALARY_CONFIG.maxBasicSalary,
      placeholder: `${HR_SALARY_CONFIG.minBasicSalary}`,
      helpText: `Monthly basic salary (${HR_SALARY_CONFIG.currencySymbol})`,
      icon: 'BanknotesIcon',
    },
    {
      id: 'payroll.housing',
      label: 'Housing Allowance',
      type: 'currency',
      min: 0,
      max: 50000,
      placeholder: '0',
      helpText: `Monthly housing allowance (${HR_SALARY_CONFIG.currencySymbol})`,
      icon: 'HomeIcon',
    },
    {
      id: 'payroll.transport',
      label: 'Transport Allowance',
      type: 'currency',
      min: 0,
      max: 10000,
      placeholder: '0',
      helpText: `Monthly transport allowance (${HR_SALARY_CONFIG.currencySymbol})`,
      icon: 'TruckIcon',
    },
    {
      id: 'payroll.home_leave',
      label: 'Home Leave Allowance',
      type: 'currency',
      min: 0,
      max: 10000,
      placeholder: '0',
      helpText: `Monthly home leave allowance (${HR_SALARY_CONFIG.currencySymbol})`,
      icon: 'GlobeAltIcon',
    },
    {
      id: 'payroll.designation',
      label: 'Payroll Designation',
      type: 'text',
      placeholder: 'e.g., Senior Engineer',
      helpText: 'Job title as it appears on payslips',
    },
    {
      id: 'payroll.grade',
      label: 'Grade',
      type: 'text',
      placeholder: 'e.g., L4, Manager',
      helpText: 'Salary grade or level',
    },
    {
      id: 'payroll.joining_date',
      label: 'Joining Date',
      type: 'date',
      helpText: 'Employment start date',
    },
    {
      id: 'payroll.notes',
      label: 'Payroll Notes',
      type: 'textarea',
      rows: 2,
      placeholder: 'Internal notes for payroll processing...',
      helpText: 'Admin notes (not shown to employee)',
    },
  ],
}

// Validation messages (soft-coded for i18n readiness)
export const HR_EDIT_VALIDATION = {
  required: (field) => `${field} is required`,
  email: 'Please enter a valid email address',
  phone: 'Please enter a valid phone number',
  minLength: (field, min) => `${field} must be at least ${min} characters`,
  maxLength: (field, max) => `${field} must not exceed ${max} characters`,
  invalidFormat: (field) => `Invalid format for ${field}`,
  minValue: (field, min) => `${field} must be at least ${HR_SALARY_CONFIG.currencySymbol} ${min.toLocaleString()}`,
  maxValue: (field, max) => `${field} must not exceed ${HR_SALARY_CONFIG.currencySymbol} ${max.toLocaleString()}`,
  salaryIncreaseLimit: `Salary increase exceeds maximum allowed (${HR_SALARY_CONFIG.maxIncrementPercent}%). Please contact Finance for approval.`,
  noteRequired: `A justification note is required for increases above ${HR_SALARY_CONFIG.requireNoteAbovePercent}%`,
}

// UI labels for edit mode
export const HR_EDIT_COPY = {
  editButton: 'Edit Profile',
  saveButton: 'Save Changes',
  cancelButton: 'Cancel',
  savingButton: 'Saving...',
  successMessage: 'Employee profile updated successfully',
  errorMessage: 'Failed to update profile. Please try again.',
  confirmCancel: 'Discard unsaved changes?',
  confirmCancelMessage: 'You have unsaved changes. Are you sure you want to cancel?',
  noPermission: 'You do not have permission to edit employee profiles',
  roleUpdateSuccess: 'Roles updated successfully',
  roleUpdateError: 'Failed to update roles',
  salaryEditButton: 'Edit Compensation',
  salaryNoPermission: 'You do not have permission to edit salary information',
  salarySuccessMessage: 'Salary updated successfully',
  salaryErrorMessage: 'Failed to update salary. Please try again.',
  salaryIncreaseWarning: 'Large salary increase detected',
  salaryIncreaseNote: 'Please provide justification for this increase',
  noPayrollProfile: 'No payroll profile found. Create one in Payroll Engine first.',
  createPayrollProfile: 'Create Payroll Profile',
}

// ─────────────────────────────────────────────────────────────────────────────
// 12b. DEPARTMENT VIEW — table columns + copy
//      Add / remove columns here; no component code changes needed.
//      `type` drives special rendering: 'status' | 'datetime' | 'date' | 'text'
// ─────────────────────────────────────────────────────────────────────────────
export const HR_DEPT_TABLE_COLUMNS = [
  { id: 'name',        label: 'Employee',    type: 'employee', minWidth: 'min-w-[200px]', accessor: (e) => fullName(e) || getEmail(e) || '—' },
  { id: '_actions',   label: '',            type: 'actions',  minWidth: 'min-w-[72px]',  accessor: () => null },
  { id: 'employee_id', label: 'Emp ID',      type: 'text',     minWidth: 'min-w-[96px]',  accessor: (e) => e.employee_id || '—' },
  { id: 'job_title',   label: 'Designation', type: 'text',     minWidth: 'min-w-[160px]', accessor: (e) => e.job_title || '—' },
  { id: 'email',       label: 'Email',       type: 'email',    minWidth: 'min-w-[200px]', accessor: (e) => getEmail(e) || '—' },
  { id: 'phone',       label: 'Phone',       type: 'text',     minWidth: 'min-w-[120px]', accessor: (e) => e.phone || '—' },
  { id: 'location',    label: 'Location',    type: 'text',     minWidth: 'min-w-[120px]', accessor: (e) => e.location || '—' },
  { id: 'discipline',  label: 'Discipline',  type: 'text',     minWidth: 'min-w-[120px]', accessor: (e) => matchDiscipline(e.engineer_profile?.discipline || e.department)?.label || '—' },
  { id: 'status',      label: 'Status',      type: 'status',   minWidth: 'min-w-[100px]', accessor: (e) => e.status },
  { id: 'tenure',      label: 'Tenure',      type: 'text',     minWidth: 'min-w-[96px]',  accessor: (e) => formatYearsOfService(e.date_joined || e.user?.date_joined) },
  { id: 'last_login',  label: 'Last Login',  type: 'datetime', minWidth: 'min-w-[140px]', accessor: (e) => e.last_login_at || e.user?.last_login },
]

// Accent palette for department cards (cycles through the list).
// Each entry drives: gradient header, employee card hover, pill badge, stat strip.
// Add or reorder entries here to change the department colour theme.
export const HR_DEPT_ACCENT_PALETTE = [
  {
    headerBg:  'from-blue-600 via-blue-700 to-indigo-800',
    pill:      'bg-white/90 text-blue-700',
    statBg:    'bg-blue-50 border-blue-100',
    empCard:   'hover:border-blue-300 hover:shadow-blue-100',
    empAccent: 'bg-blue-600',
    iconBg:    'bg-blue-100 text-blue-600',
  },
  {
    headerBg:  'from-violet-600 via-purple-700 to-fuchsia-800',
    pill:      'bg-white/90 text-violet-700',
    statBg:    'bg-violet-50 border-violet-100',
    empCard:   'hover:border-violet-300 hover:shadow-violet-100',
    empAccent: 'bg-violet-600',
    iconBg:    'bg-violet-100 text-violet-600',
  },
  {
    headerBg:  'from-emerald-600 via-teal-700 to-cyan-800',
    pill:      'bg-white/90 text-emerald-700',
    statBg:    'bg-emerald-50 border-emerald-100',
    empCard:   'hover:border-emerald-300 hover:shadow-emerald-100',
    empAccent: 'bg-emerald-600',
    iconBg:    'bg-emerald-100 text-emerald-600',
  },
  {
    headerBg:  'from-rose-600 via-pink-700 to-fuchsia-800',
    pill:      'bg-white/90 text-rose-700',
    statBg:    'bg-rose-50 border-rose-100',
    empCard:   'hover:border-rose-300 hover:shadow-rose-100',
    empAccent: 'bg-rose-600',
    iconBg:    'bg-rose-100 text-rose-600',
  },
  {
    headerBg:  'from-amber-500 via-orange-600 to-red-700',
    pill:      'bg-white/90 text-amber-700',
    statBg:    'bg-amber-50 border-amber-100',
    empCard:   'hover:border-amber-300 hover:shadow-amber-100',
    empAccent: 'bg-amber-500',
    iconBg:    'bg-amber-100 text-amber-600',
  },
  {
    headerBg:  'from-sky-600 via-cyan-700 to-teal-800',
    pill:      'bg-white/90 text-sky-700',
    statBg:    'bg-sky-50 border-sky-100',
    empCard:   'hover:border-sky-300 hover:shadow-sky-100',
    empAccent: 'bg-sky-600',
    iconBg:    'bg-sky-100 text-sky-600',
  },
  {
    headerBg:  'from-slate-600 via-gray-700 to-zinc-800',
    pill:      'bg-white/90 text-slate-700',
    statBg:    'bg-slate-50 border-slate-200',
    empCard:   'hover:border-slate-300 hover:shadow-slate-100',
    empAccent: 'bg-slate-600',
    iconBg:    'bg-slate-100 text-slate-600',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Department card display config — change values here to adjust the new card UI
// without touching any JSX.
// ─────────────────────────────────────────────────────────────────────────────
export const HR_DEPT_CARD_CONFIG = {
  // Max avatars shown in the department header cluster before a "+N" overflow badge
  avatarClusterMax: 5,
  // Columns in the employee grid inside an expanded department card.
  // Use Tailwind responsive prefix strings, e.g. 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
  employeeGridCols: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
  // Fields shown on each employee mini-card inside the grid.
  // Remove an id to hide that field without any JSX change.
  employeeCardFields: ['designation', 'email', 'employee_id', 'location', 'status'],
  // Show the "size vs largest dept" progress bar in the header
  showProgressBar: true,
  // Show the numeric stats strip (active count, designations) in the header
  showStatsBadges: true,
}

export const HR_DEPT_COPY = {
  expandAll:          'Expand all',
  collapseAll:        'Collapse all',
  employees:          'employees',
  designations:       'distinct designations',
  emptyDept:          'No departments found',
  noEmployees:        'No employees in this department',
  searchPlaceholder:  'Filter within departments…',
  addEmployee:        'Add Employee',
  addToDept:          'Add to dept',
  editEmployee:       'Edit',
  viewProfile:        'View profile',
  addEmployeeHint:    'Opens the admin user creation form.',
  editEmployeeHint:   'Opens the admin edit form for this employee.',
}

// Actions available in the department view toolbar and per-row.
// `scope` controls where they appear: 'toolbar' = top bar, 'row' = per-employee.
// `variant` drives button styling: 'primary' | 'secondary' | 'ghost'.
// `icon` is a heroicon name.
// `getHref` receives (emp?, dept?) and returns the navigation target.
export const HR_DEPT_ACTIONS = [
  {
    id:       'add_employee',
    label:    HR_DEPT_COPY.addEmployee,
    icon:     'UserPlusIcon',
    scope:    'toolbar',
    variant:  'primary',
    getHref:  (_emp, _dept) => HR_ADMIN_USERS_LIST_LINK + '?action=create',
    tooltip:  HR_DEPT_COPY.addEmployeeHint,
  },
  {
    id:       'add_to_dept',
    label:    HR_DEPT_COPY.addToDept,
    icon:     'PlusCircleIcon',
    scope:    'dept_header',
    variant:  'secondary',
    getHref:  (_emp, dept) => HR_ADMIN_USERS_LIST_LINK + `?action=create&department=${encodeURIComponent(dept || '')}`,
    tooltip:  HR_DEPT_COPY.addEmployeeHint,
  },
  {
    id:       'edit_employee',
    label:    HR_DEPT_COPY.editEmployee,
    icon:     'PencilSquareIcon',
    scope:    'row',
    variant:  'ghost',
    getHref:  (emp, _dept) => HR_ADMIN_USER_LINK(emp?.id || emp?.user?.id || ''),
    tooltip:  HR_DEPT_COPY.editEmployeeHint,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// 13. UI COPY — single point of edit for headlines / empty states
// ─────────────────────────────────────────────────────────────────────────────
export const HR_COPY = {
  pageTitle:        'Employee Management',
  pageSubtitle:     'Workforce directory, competency map and HR analytics',
  loadingMessage:   'Loading workforce data…',
  emptyTitle:       'No employees match the current filters',
  emptySubtitle:    'Try clearing filters or use the search box above.',
  errorTitle:       'Could not load employee data',
  searchPlaceholder: 'Search name, email, employee ID, biometric code (e.g. 22972), department…',
  searchButtonLabel:  'Search',
  searchClearLabel:   'Clear search',
  // Soft-coded reverse-lookup: queries matching this regex are treated as
  // biometric badge numbers. The page asks the timesheet backend who that
  // code belongs to, then opens the matching RAD AI employee drawer.
  searchBiometricCodePattern: /^\d{3,10}$/,
  searchLookupMissingTitle: 'No biometric record found',
  searchLookupMissingBody:  'No biometric record matches that code.',
  searchLookupUnmappedTitle: 'Biometric record is not linked to a RAD AI user',
  searchLookupUnmappedBody:  'Found biometric record for {name} ({email}) but no matching RAD AI employee exists.',
}

// ─────────────────────────────────────────────────────────────────────────────
// 14. HELPERS — exported so the page stays purely declarative
// ─────────────────────────────────────────────────────────────────────────────
export const formatYearsOfService = (iso) => {
  const y = yearsSince(iso)
  if (y < 1) return `${Math.floor(y * 12)} months`
  return `${y.toFixed(1)} years`
}

export const formatDateTime = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export const formatDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' })
}

export const fullName = (emp) => {
  const first = emp.user?.first_name || emp.first_name || ''
  const last = emp.user?.last_name || emp.last_name || ''
  const joined = `${first} ${last}`.trim()
  return joined || emp.full_name || emp.user?.email || emp.email || 'Unnamed user'
}

/**
 * Soft-coded email accessor — handles every shape the backend can return:
 *   - nested rich detail:   `user.email`
 *   - flat list serializer: `email`
 *   - legacy fallbacks:     `user.username` (when username is an email),
 *                           `contact_email`
 * Mirrors the `getUserEmail` helper in /admin/users so the two pages stay
 * consistent end-to-end. Returns `''` (never null) so callers can `||` safely.
 */
export const getEmail = (emp) => {
  if (!emp) return ''
  const candidates = [
    emp.user?.email,
    emp.email,
    emp.contact_email,
    emp.user?.username,  // RAD AI uses email-as-username for many users
  ]
  for (const c of candidates) {
    const v = (c || '').toString().trim()
    if (v && v.includes('@')) return v
  }
  return ''
}

export const initials = (emp) => {
  const name = fullName(emp)
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase())
    .join('') || '?'
}

/**
 * Normalise an employee record so the rest of the UI can rely on a single
 * shape, regardless of whether it came from:
 *   - the lightweight list endpoint (flat: { email, full_name, primary_role })
 *   - the rich detail endpoint     (nested: { user: {...}, roles: [...] })
 *
 * The function is **idempotent** — calling it on an already-normalised record
 * returns the same shape.
 *
 * Soft-coded: extend this helper if the backend list serializer ever exposes
 * new fields the UI consumes; no component code needs to change.
 */
export const normalizeEmployee = (raw) => {
  if (!raw || typeof raw !== 'object') return raw
  // Build nested `user` if missing — happens with the list serializer's flat shape.
  const user = raw.user && typeof raw.user === 'object'
    ? raw.user
    : {
        id: raw.user_id || null,
        email: raw.email || '',
        first_name: raw.first_name || (raw.full_name ? raw.full_name.split(/\s+/)[0] : ''),
        last_name: raw.last_name || (raw.full_name ? raw.full_name.split(/\s+/).slice(1).join(' ') : ''),
        is_active: raw.is_active ?? true,
      }
  // Build `roles` from `primary_role` if the rich list isn't present.
  let roles = Array.isArray(raw.roles) ? raw.roles : []
  if (roles.length === 0 && raw.primary_role && typeof raw.primary_role === 'object') {
    roles = [{ id: raw.primary_role.id, name: raw.primary_role.name, is_primary: true }]
  }
  return {
    ...raw,
    user,
    roles,
    modules: Array.isArray(raw.modules) ? raw.modules : [],
    engineer_profile: raw.engineer_profile || {},
  }
}

export default {
  HR_STATUSES,
  HR_DISCIPLINES,
  HR_EMPLOYMENT_TYPES,
  HR_KPIS,
  HR_FILTERS,
  HR_VIEW_MODES,
  HR_UI,
  HR_CARD_FIELDS,
  HR_TABLE_COLUMNS,
  HR_DETAIL_TABS,
  HR_DEFAULT_DETAIL_TAB,
  HR_DRAWER_WIDTH_DEFAULT,
  HR_DRAWER_WIDTH_BY_TAB,
  HR_TIMESHEET_RANGES,
  HR_TIMESHEET_DEFAULT_RANGE,
  HR_TIMESHEET_KPIS,
  HR_TIMESHEET_DAILY_COLUMNS,
  HR_TIMESHEET_COPY,
  HR_TIMESHEET_PUNCH_COLUMNS,
  HR_TIMESHEET_PUNCH_SORT,
  HR_TIMESHEET_ACTIVITY_COLUMNS,
  HR_TIMESHEET_ACTIVITY_SORT,
  HR_TIMESHEET_MONTHLY_COLUMNS,
  HR_TIMESHEET_VISUALS,
  HR_PAGE_SIZES,
  HR_DEFAULT_PAGE_SIZE,
  HR_DATA_FETCH_PAGE_SIZE,
  HR_EXPORT_FORMATS,
  HR_COPY,
  HR_ADMIN_USER_LINK,
  HR_ADMIN_USERS_LIST_LINK,
  HR_EDIT_CONFIG,
  HR_SALARY_CONFIG,
  HR_EDITABLE_FIELDS,
  HR_EDIT_VALIDATION,
  HR_EDIT_COPY,
  HR_DEPT_TABLE_COLUMNS,
  HR_DEPT_ACCENT_PALETTE,
  HR_DEPT_CARD_CONFIG,
  HR_DEPT_COPY,
  HR_DEPT_ACTIONS,
  formatYearsOfService,
  formatDateTime,
  formatDate,
  fullName,
  getEmail,
  initials,
  matchDiscipline,
  getStatusMeta,
  normalizeEmployee,
}
