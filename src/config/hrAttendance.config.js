/**
 * Attendance Dashboard — Soft-Coded Configuration
 * ================================================
 * All thresholds, colours, labels, column definitions, and KPI computations
 * live here.  No magic values in component code.
 *
 * Data source: backend/apps/timesheet/*  (SQL Server biometric punches)
 * API methods: timesheet.service.js  →  fetchLive / fetchDaily / fetchMonthly
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. THRESHOLDS — override via Vite env vars
// ─────────────────────────────────────────────────────────────────────────────
export const ATT_FULL_DAY_HOURS      = Number(import.meta.env?.VITE_ATT_FULL_DAY_HOURS   || 8)
export const ATT_LATE_THRESHOLD_MIN  = Number(import.meta.env?.VITE_ATT_LATE_MIN         || 15)
export const ATT_EXPECTED_LOGIN_H    = Number(import.meta.env?.VITE_ATT_EXPECTED_LOGIN_H || 9)
export const ATT_GOOD_RATE_PCT       = Number(import.meta.env?.VITE_ATT_GOOD_RATE        || 90)  // ≥ green
export const ATT_WARN_RATE_PCT       = Number(import.meta.env?.VITE_ATT_WARN_RATE        || 75)  // ≥ amber; < = red
export const ATT_TOP_ABSENT_LIMIT    = Number(import.meta.env?.VITE_ATT_TOP_ABSENT_LIMIT || 10)  // rows in alerts
// Contractual hours per working day — used to compute Normal Hours in Summary view
export const ATT_STANDARD_DAILY_HOURS = Number(import.meta.env?.VITE_ATT_STANDARD_DAILY_HOURS || 9)
// Company name displayed in the Summary report header
export const ATT_COMPANY_NAME        = import.meta.env?.VITE_ATT_COMPANY_NAME || 'Rejlers International Engineering Solutions AB'

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEE FILTER — eliminate non-employee biometric records
// ─────────────────────────────────────────────────────────────────────────────
// When true, only rows matched to a real RAD AI user (radai_user_id is set)
// are shown. Flip to 'false' via env var to show ALL biometric records.
export const ATT_FILTER_REQUIRE_MATCH = (import.meta.env?.VITE_ATT_FILTER_REQUIRE_MATCH ?? 'true') !== 'false'

// Secondary net: regex patterns that identify non-employee biometric entries
// (facility access groups, visitor badges, maintenance terminals, etc.).
// Checked ONLY when ATT_FILTER_REQUIRE_MATCH=false OR a row has no radai_user_id.
// Add patterns here — no code changes needed.
export const ATT_NON_EMPLOYEE_PATTERNS = [
  /visitor/i,           // e.g. "DESCON Visitor-10", "Visitor Badge"
  /maintenance/i,       // maintenance terminal / zone
  /\bgate\b/i,          // gate access points
  /\bguard\b/i,         // guard / security post
  /^reception\b/i,
  /^security\b/i,
  /^test\b/i,           // test records
  /^admin\b/i,          // admin device names
  /^[A-Z][A-Z0-9 &\/\-_]{3,}$/, // 4+ char ALL-CAPS names (company/facility names)
  /^\d{4,}/,            // pure numeric / badge number rows
]

/**
 * Returns true when a biometric row should be shown to HR.
 *
 * Logic (in priority order):
 *   1. Row is matched to a RAD AI user (radai_user_id set)  → always show
 *   2. ATT_FILTER_REQUIRE_MATCH = true and no match         → always hide
 *   3. ATT_FILTER_REQUIRE_MATCH = false, no match, name
 *      matches a non-employee pattern                       → hide
 *   4. Everything else                                      → show
 */
export const filterEmployeeRow = (row) => {
  if (!row) return false
  // Rule 1: RAD AI matched → definitely a real employee
  if (row.radai_user_id) return true
  // Rule 2: strict mode on → require match
  if (ATT_FILTER_REQUIRE_MATCH) return false
  // Rule 3: lenient mode — apply name-pattern blocklist
  const name = (row.radai_full_name || row.employee_name || row.name || '').trim()
  if (!name) return false
  return !ATT_NON_EMPLOYEE_PATTERNS.some(p => p.test(name))
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. VIEW TABS
// ─────────────────────────────────────────────────────────────────────────────
export const ATTENDANCE_VIEWS = [
  { id: 'overview', label: 'Overview',  icon: 'ChartBarSquareIcon', description: 'HR Executive Summary' },
  { id: 'summary',  label: 'Summary',   icon: 'TableCellsIcon',     description: 'Consolidated monthly timesheet — Rejlers format' },
  { id: 'daily',    label: 'Daily',     icon: 'CalendarDaysIcon',   description: 'Day-by-day biometric tracker' },
  { id: 'monthly',  label: 'Monthly',   icon: 'CalendarIcon',       description: 'Monthly rollup with dept charts' },
  { id: 'yearly',   label: 'Yearly',    icon: 'ChartBarIcon',       description: '12-month trend per employee' },
  { id: 'reports',  label: 'Reports',   icon: 'ArrowDownTrayIcon',  description: 'Export Excel / PDF' },
]
export const ATTENDANCE_DEFAULT_VIEW = 'overview'

// ─────────────────────────────────────────────────────────────────────────────
// 3. STATUS META  (present / late / half_day / absent / on_leave)
// ─────────────────────────────────────────────────────────────────────────────
export const ATTENDANCE_STATUS = {
  present:  { label: 'Present',  bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', row: '' },
  late:     { label: 'Late',     bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500',   row: 'bg-amber-50/50' },
  half_day: { label: 'Half Day', bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200',  dot: 'bg-orange-500',  row: 'bg-orange-50/40' },
  absent:   { label: 'Absent',   bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    dot: 'bg-rose-500',    row: 'bg-rose-50/30' },
  on_leave: { label: 'On Leave', bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200',  dot: 'bg-purple-500',  row: 'bg-purple-50/30' },
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. CLASSIFY a single daily record → status key
// ─────────────────────────────────────────────────────────────────────────────
export const classifyDay = (record) => {
  if (!record || !record.first_in) return 'absent'
  if (record.is_full_day)          return record.is_late ? 'late' : 'present'
  return 'half_day'
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. KPI TILE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
export const ATTENDANCE_KPIS = [
  {
    id:          'present',
    label:       'Present Today',
    icon:        'UserGroupIcon',
    gradient:    'from-emerald-500 to-emerald-600',
    bgLight:     'bg-emerald-50',
    textColor:   'text-emerald-700',
    compute:     ({ daily }) => ({
      value: daily.filter(r => r.first_in).length,
      sub:   'biometric punch recorded',
    }),
  },
  {
    id:          'late',
    label:       'Late Arrivals',
    icon:        'ClockIcon',
    gradient:    'from-amber-500 to-amber-600',
    bgLight:     'bg-amber-50',
    textColor:   'text-amber-700',
    compute:     ({ daily }) => ({
      value: daily.filter(r => r.is_late).length,
      sub:   `> ${ATT_LATE_THRESHOLD_MIN} min after ${ATT_EXPECTED_LOGIN_H}:00`,
    }),
  },
  {
    id:          'half_day',
    label:       'Half Days',
    icon:        'AdjustmentsHorizontalIcon',
    gradient:    'from-orange-500 to-orange-600',
    bgLight:     'bg-orange-50',
    textColor:   'text-orange-700',
    compute:     ({ daily }) => ({
      value: daily.filter(r => r.first_in && !r.is_full_day).length,
      sub:   `< ${ATT_FULL_DAY_HOURS}h logged`,
    }),
  },
  {
    id:          'absent',
    label:       'No Punch',
    icon:        'UserMinusIcon',
    gradient:    'from-rose-500 to-rose-600',
    bgLight:     'bg-rose-50',
    textColor:   'text-rose-700',
    compute:     ({ daily, totalActive }) => ({
      value: Math.max(0, totalActive - daily.filter(r => r.first_in).length),
      sub:   'registered vs no biometric record',
    }),
  },
  {
    id:          'rate',
    label:       'Attendance Rate',
    icon:        'ChartPieIcon',
    gradient:    'from-blue-500 to-blue-600',
    bgLight:     'bg-blue-50',
    textColor:   'text-blue-700',
    compute:     ({ daily, totalActive }) => {
      const present = daily.filter(r => r.first_in).length
      const rate    = totalActive > 0 ? Math.round((present / totalActive) * 100) : 0
      return { value: `${rate}%`, sub: 'of all registered employees' }
    },
  },
  {
    id:          'avg_hours',
    label:       'Avg Hours Today',
    icon:        'ClockIcon',
    gradient:    'from-indigo-500 to-indigo-600',
    bgLight:     'bg-indigo-50',
    textColor:   'text-indigo-700',
    compute:     ({ daily }) => {
      const worked = daily.filter(r => (r.hours_worked ?? 0) > 0)
      const avg    = worked.length > 0
        ? (worked.reduce((s, r) => s + (r.hours_worked || 0), 0) / worked.length).toFixed(1)
        : '—'
      return { value: avg, sub: 'hrs per present employee' }
    },
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// 5b. OPEN-SHIFT INDICATOR — shown when an employee has an unclosed IN punch.
//     All display strings and styles are soft-coded here.
//     Backend sends `open_shift: true` and `open_shift_since` on the row.
// ─────────────────────────────────────────────────────────────────────────────
export const OPEN_SHIFT_INDICATOR = {
  // Label shown in the Hours cell when an employee is still "IN" with no OUT.
  label:        import.meta.env?.VITE_OPEN_SHIFT_LABEL        || 'In progress',
  // Tooltip text explaining the open-shift state.
  tooltip:      import.meta.env?.VITE_OPEN_SHIFT_TOOLTIP      || 'Employee is currently IN \u2014 hours will update once they check out.',
  // Badge styling (Tailwind classes)
  badgeCls:     'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-300',
  dotCls:       'w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse',
  // How many hours the backend credits for an open shift (mirrors TIMESHEET_OPEN_SHIFT_MAX_HOURS).
  // When 0 the cell shows the label only; when > 0 it also shows the credited amount.
  maxCreditedH: Number(import.meta.env?.VITE_OPEN_SHIFT_MAX_H || 0),
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. DAILY TABLE COLUMNS
// ─────────────────────────────────────────────────────────────────────────────
export const ATTENDANCE_DAILY_COLS = [
  { id: 'name',    label: 'Employee',   accessor: r => r.radai_full_name || r.name || r.employee_code || '\u2014' },
  { id: 'code',    label: 'Code',       accessor: r => r.employee_code || '\u2014' },
  { id: 'dept',    label: 'Department', accessor: r => r.radai_department || r.department || '\u2014' },
  { id: 'in',      label: 'Check In',   accessor: r => fmtTime(r.first_in) },
  { id: 'out',     label: 'Check Out',  accessor: r => fmtTime(r.last_out) },
  // hours column uses cellType 'hours_worked' so AttendanceDashboard can render
  // the open-shift badge when `r.open_shift === true`.
  { id: 'hours',   label: 'Hours',      accessor: r => r.hours_worked ?? 0, cellType: 'hours_worked' },
  { id: 'status',  label: 'Status',     accessor: r => classifyDay(r), cellType: 'att_status' },
]

// ─────────────────────────────────────────────────────────────────────────────
// 7. MONTHLY TABLE COLUMNS  (rows are pre-enriched with _absent, _rate)
// ─────────────────────────────────────────────────────────────────────────────
export const ATTENDANCE_MONTHLY_COLS = [
  { id: 'name',    label: 'Employee',   accessor: r => r.radai_full_name || r.name || r.employee_code || '—' },
  { id: 'dept',    label: 'Dept',       accessor: r => r.radai_department || r.department || '—' },
  { id: 'present', label: 'Present',    accessor: r => r.days_present || 0 },
  { id: 'absent',  label: 'Absent',     accessor: r => r._absent || 0,         cellType: 'absent_count' },
  { id: 'full',    label: 'Full Days',  accessor: r => r.full_days || 0 },
  { id: 'half',    label: 'Half Days',  accessor: r => r.half_days || 0 },
  { id: 'late',    label: 'Late In',    accessor: r => r.late_arrivals || 0,   cellType: 'late_count' },
  { id: 'hours',   label: 'Total Hrs',  accessor: r => `${(r.total_hours || 0).toFixed(1)}h` },
  { id: 'avg',     label: 'Avg/Day',    accessor: r => `${(r.avg_hours_per_day || 0).toFixed(1)}h` },
  { id: 'rate',    label: 'Rate %',     accessor: r => r._rate ?? 0,           cellType: 'att_rate' },
]

// ─────────────────────────────────────────────────────────────────────────────
// 8. HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Format a date/time string as HH:MM */
export const fmtTime = (v) => {
  if (!v) return '—'
  try {
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return String(v).slice(0, 8)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch { return String(v) }
}

/** Count Mon–Fri business days in a given year-month (1-based month) */
export const workingDaysInMonth = (year, month) => {
  let count = 0
  const d = new Date(year, month - 1, 1)
  while (d.getMonth() === month - 1) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

/** Attendance-rate colour class (text) */
export const rateColor = (pct) => {
  if (pct >= ATT_GOOD_RATE_PCT) return 'text-emerald-700'
  if (pct >= ATT_WARN_RATE_PCT) return 'text-amber-700'
  return 'text-rose-700'
}

/** Extract employee display name from any shape the backend returns */
export const empName = (r) => r.radai_full_name || r.name || r.employee_code || '—'

/** Extract department from any shape */
export const empDept = (r) => r.radai_department || r.department || 'General'

// ─────────────────────────────────────────────────────────────────────────────
// 9. CHART PALETTE
// ─────────────────────────────────────────────────────────────────────────────
export const DEPT_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6',
]

// ─────────────────────────────────────────────────────────────────────────────
// 10. MONTH LABELS
// ─────────────────────────────────────────────────────────────────────────────
export const MONTH_SHORT  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
export const MONTH_FULL   = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']

// ─────────────────────────────────────────────────────────────────────────────
// 11. UI COPY
// ─────────────────────────────────────────────────────────────────────────────
export const ATT_COPY = {
  pageTitle:     'Attendance Dashboard',
  pageSubtitle:  'Consolidated HR View — Daily · Monthly · Yearly · Reports',
  noData:        'No attendance data for this period',
  loading:       'Loading attendance data…',
  dailyEmpty:    'No biometric punches recorded for selected date',
  monthlyEmpty:  'No attendance records for selected month',
  yearlyLoading: 'Fetching 12 months of data…',
  exportHint:    'Reports are generated directly from the biometric SQL Server database',
  absenceNote:   'Absent = Working Days − Days Present (Mon–Fri schedule)',
  leaveNote:     'Planned leave management integration coming soon',
  exportOk:      'Export started — check your downloads folder',
  sourceTag:     'Biometric SQL Server  ·  Real-time sync',
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. SUMMARY VIEW HELPERS
// ─────────────────────────────────────────────────────────────────────────────
/** Format hours difference as "+X h Y min" / "-X h Y min" (matches Rejlers report format) */
export const fmtDiff = (hours) => {
  if (!isFinite(hours)) return '—'
  const sign = hours >= 0 ? '+' : '-'
  const abs  = Math.abs(hours)
  const h    = Math.floor(abs)
  const m    = Math.round((abs - h) * 60)
  return `${sign}${h} h ${m} min`
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. REPORT TYPES — soft-coded export catalogue for the Reports tab
//     Each entry drives one card in the UI; add/remove entries here without
//     touching component code.
//
//     Fields:
//       id          unique key used in the download dispatcher
//       label       card heading
//       icon        HeroIcon name (24/outline)
//       description short hint text shown in the card
//       scope       'date' | 'month' | 'year'  — which date picker to show
//       formats     array of { key, label, color, icon } — download buttons
//       note        optional amber info note (e.g. "may take a moment")
// ─────────────────────────────────────────────────────────────────────────────
export const ATT_REPORT_TYPES = [
  {
    id:          'daily',
    label:       'Daily Report',
    icon:        'CalendarDaysIcon',
    description: 'All employee punches for a single day — first-in, last-out, hours worked.',
    scope:       'date',
    formats: [
      { key: 'daily-excel', label: 'Excel', color: 'emerald', icon: 'ArrowDownTrayIcon' },
    ],
  },
  {
    id:          'monthly',
    label:       'Monthly Report',
    icon:        'CalendarIcon',
    description: 'Month-level roll-up with days present, full/half days, late arrivals and total hours.',
    scope:       'month',
    formats: [
      { key: 'monthly-excel', label: 'Excel', color: 'emerald', icon: 'ArrowDownTrayIcon' },
      { key: 'monthly-pdf',   label: 'PDF',   color: 'rose',    icon: 'DocumentArrowDownIcon' },
    ],
  },
  {
    id:          'summary',
    label:       'Summary Report',
    icon:        'TableCellsIcon',
    description: 'Pivot grid — one row per employee, one column per day. Mirrors the HR Summary tab view.',
    scope:       'month',
    note:        'Excel includes the full day-by-day grid with weekend highlights.',
    formats: [
      { key: 'summary-excel', label: 'Excel (Pivot)', color: 'violet', icon: 'ArrowDownTrayIcon' },
      { key: 'summary-pdf',   label: 'PDF (Roll-up)', color: 'rose',   icon: 'DocumentArrowDownIcon' },
    ],
  },
  {
    id:          'yearly',
    label:       'Yearly Report',
    icon:        'ChartBarIcon',
    description: '12-month trend — one sheet per month plus a full-year summary. May take a moment to generate.',
    scope:       'year',
    note:        'Yearly exports aggregate all 12 months and may take up to 30 seconds.',
    formats: [
      { key: 'yearly-excel', label: 'Excel (All months)', color: 'blue',   icon: 'ArrowDownTrayIcon' },
      { key: 'yearly-pdf',   label: 'PDF (Summary)',      color: 'indigo', icon: 'DocumentArrowDownIcon' },
    ],
  },
]

// Map download key → service method name (used in dispatcher)
// Soft-coded: adding a new format only requires a new entry here + in ATT_REPORT_TYPES.
export const ATT_DOWNLOAD_METHOD_MAP = {
  'daily-excel':   'downloadDailyExcel',
  'monthly-excel': 'downloadMonthlyExcel',
  'monthly-pdf':   'downloadMonthlyPdf',
  'summary-excel': 'downloadSummaryExcel',
  'summary-pdf':   'downloadSummaryPdf',
  'yearly-excel':  'downloadYearlyExcel',
  'yearly-pdf':    'downloadYearlyPdf',
}

// ─────────────────────────────────────────────────────────────────────────────
// 14. PUBLIC HOLIDAY — display config for Summary tab
// ─────────────────────────────────────────────────────────────────────────────
// Column header accent colour for public-holiday days in the pivot table.
// Soft-coded: change colours here; no component edits needed.
export const ATT_HOLIDAY_CELL_BG    = 'bg-violet-100'
export const ATT_HOLIDAY_CELL_BORDER = 'border-violet-300'
export const ATT_HOLIDAY_HEADER_BG  = 'bg-violet-700'
export const ATT_HOLIDAY_HEADER_TEXT = 'text-white'
// Abbreviation shown inside the cell when a day is a public holiday
export const ATT_HOLIDAY_SYMBOL     = 'PH'

// ─────────────────────────────────────────────────────────────────────────────
// 15. ATTENDANCE OVERRIDE — reason option list (mirrors backend choices)
//     Values must match OVERRIDE_REASON_CHOICES in apps.payroll.models.py.
// ─────────────────────────────────────────────────────────────────────────────
export const OVERRIDE_REASON_OPTIONS = [
  { value: 'biometric_error', label: 'Biometric device error' },
  { value: 'system_outage',   label: 'System / network outage' },
  { value: 'forgot_punch',    label: 'Employee forgot to punch' },
  { value: 'site_visit',      label: 'On-site client visit (no biometric access)' },
  { value: 'wfh',             label: 'Work from home (WFH approved)' },
  { value: 'travel',          label: 'Business travel' },
  { value: 'training',        label: 'Approved external training' },
  { value: 'hr_correction',   label: 'HR administrative correction' },
  { value: 'other',           label: 'Other (see note)' },
]

// ─────────────────────────────────────────────────────────────────────────────
// 16. HR MANAGER PERMISSION — soft-coded role codes that grant edit access
//     Add / remove role codes without touching components.
//     Checked client-side only as a UX guard; the real enforcement is in the
//     backend _is_hr_manager() helper (apps.payroll.views).
// ─────────────────────────────────────────────────────────────────────────────
export const HR_MANAGER_ROLE_CODES = (
  import.meta.env?.VITE_HR_MANAGER_ROLES || 'hr,hr_manager,hr_admin,admin,superadmin,manager'
).split(',').map(s => s.trim().toLowerCase()).filter(Boolean)

/**
 * Returns true if the given user/profile should see HR edit controls.
 *
 * Supports two call shapes:
 *   canEditAttendance(rbacProfile, authUser)
 *     - rbacProfile  = s.rbac.currentUser  (UserProfileSerializer, may be null)
 *     - authUser     = s.auth.user          (UserProfileSerializer stored at login)
 *
 * UserProfileSerializer shape:
 *   { user: { is_superuser, is_staff, ... }, roles: [{ id, name, code, level }], ... }
 *
 * Checked client-side only as a UX guard; the backend enforces the same rule
 * via _is_hr_manager() in apps.payroll.views.
 */
export const canEditAttendance = (profile, authUser) => {
  if (!profile && !authUser) return false

  // ── 1. Superuser / staff check ─────────────────────────────────────────────
  // UserProfileSerializer nests Django user fields under `.user`; handle both
  // the nested shape and a flat shape (for safety/backward-compat).
  const djangoUser = authUser?.user ?? authUser
  if (djangoUser?.is_superuser || djangoUser?.is_staff) return true

  const djangoUserFromProfile = profile?.user ?? profile
  if (djangoUserFromProfile?.is_superuser || djangoUserFromProfile?.is_staff) return true

  // ── 2. Role code check ─────────────────────────────────────────────────────
  // Collect role codes from all available sources (roles array on both objects).
  // UserProfileSerializer exposes `roles: [{ id, name, code, level }]`.
  const roleCodes = [
    ...(profile?.roles  || []),
    ...(authUser?.roles || []),
  ]
    .map(r => (r?.code || '').toLowerCase().trim())
    .filter(Boolean)

  if (roleCodes.length === 0) return false

  return roleCodes.some(code =>
    HR_MANAGER_ROLE_CODES.some(c => code === c || code.startsWith(c))
  )
}

// Copy strings for new edit / holiday UI elements
export const ATT_EDIT_COPY = {
  editTitle:          'Edit Attendance',
  editHint:           'Correct the biometric hours for this employee on this date.',
  overrideHoursLabel: 'Corrected Hours',
  originalHoursLabel: 'Original (Biometric)',
  reasonLabel:        'Reason',
  noteLabel:          'HR Note (optional)',
  saveBtn:            'Save Correction',
  cancelBtn:          'Cancel',
  savingBtn:          'Saving…',
  saveOk:             'Correction saved successfully.',
  saveErr:            'Failed to save correction. Please try again.',
  overrideIndicator:  'Manually corrected by HR',
  holidayTitle:       'Public Holidays',
  holidayAddBtn:      'Add Holiday',
  holidayEditBtn:     'Edit',
  holidayDeactivateBtn: 'Deactivate',
  holidayName:        'Holiday Name',
  holidayDate:        'Date',
  holidayRegion:      'Region',
  holidayNote:        'Note (optional)',
  holidaySource:      'Source',
  holidaySaveBtn:     'Save Holiday',
  holidaySavingBtn:   'Saving…',
  holidayDeleteConfirm: (name) => `Deactivate "${name}"? It will no longer appear in the calendar but the record is kept for audit.`,
  holidaySeeded:      'Abu Dhabi / UAE Official (Abu Dhabi Govt.)',
  holidayHrAdded:     'Added by HR Manager',
  noHolidays:         'No public holidays defined for this year.',
  holidaySaveOk:      'Holiday saved.',
  holidaySaveErr:     'Failed to save holiday.',
}

// ─────────────────────────────────────────────────────────────────────────────
// 17. SUMMARY LEAVE COLUMNS — soft-coded leave type codes shown as extra
//     summary columns in the attendance Summary tab.
//     Change codes/labels here to match any leave type seeded in the backend.
//     Override via VITE_ env vars without touching this file.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SUMMARY_LEAVE_TYPES — Dynamic leave columns for attendance Summary view.
 * 
 * Each leave type displayed as a separate column in the attendance summary table.
 * Configure which leave types to track and display here.
 * 
 * Fields:
 * - code: Leave type code from backend (must match LeaveType.code in database)
 * - label: Column header label
 * - shortLabel: Abbreviated label for narrow columns (optional)
 * - showBalance: If true, show remaining balance from DB; if false, show days taken this month
 * - enabled: Set to false to hide this column without removing the config
 * - displayOrder: Sort order in the table (lower numbers appear first)
 * - color: Tailwind color class for visual identification (optional)
 * 
 * To add a new leave type column:
 * 1. Add an entry here with the leave type code from the database
 * 2. Set enabled: true
 * 3. No code changes needed — the table will automatically add the column
 * 
 * To hide a leave type column:
 * - Set enabled: false (keeps config for future use)
 * - Or remove the entry entirely
 */
export const SUMMARY_LEAVE_TYPES = [
  {
    code: 'AL',
    label: 'Annual Leave',
    shortLabel: 'Annual',
    showBalance: import.meta.env?.VITE_AL_SHOW_BALANCE !== 'false', // Show remaining balance by default
    enabled: true,
    displayOrder: 1,
    color: 'emerald',
    description: 'Paid annual leave entitlement',
  },
  {
    code: 'SL',
    label: 'Sick Leave',
    shortLabel: 'Sick',
    showBalance: false,  // Show days taken, not balance
    enabled: true,
    displayOrder: 2,
    color: 'blue',
    description: 'Medical/sick leave taken this month',
  },
  {
    code: 'EL',
    label: 'Emergency Leave',
    shortLabel: 'Emergency',
    showBalance: false,
    enabled: true,
    displayOrder: 3,
    color: 'amber',
    description: 'Emergency leave taken this month',
  },
  {
    code: 'UL',
    label: 'Unpaid Leave',
    shortLabel: 'Unpaid',
    showBalance: false,
    enabled: true,
    displayOrder: 4,
    color: 'red',
    description: 'Unpaid leave taken this month',
  },
  {
    code: 'ML',
    label: 'Maternity Leave',
    shortLabel: 'Maternity',
    showBalance: false,
    enabled: true,
    displayOrder: 5,
    color: 'purple',
    description: 'Maternity leave taken this month',
  },
  {
    code: 'PL',
    label: 'Paternity Leave',
    shortLabel: 'Paternity',
    showBalance: false,
    enabled: true,
    displayOrder: 6,
    color: 'indigo',
    description: 'Paternity leave taken this month',
  },
]

// Legacy constants for backward compatibility (deprecated — use SUMMARY_LEAVE_TYPES instead)
export const SUMMARY_ANNUAL_LEAVE_CODE  = import.meta.env?.VITE_ANNUAL_LEAVE_CODE  || 'AL'
export const SUMMARY_UNPAID_LEAVE_CODE  = import.meta.env?.VITE_UNPAID_LEAVE_CODE  || 'UL'
export const SUMMARY_ANNUAL_LEAVE_LABEL = import.meta.env?.VITE_ANNUAL_LEAVE_LABEL || 'Annual Leave'
export const SUMMARY_UNPAID_LEAVE_LABEL = import.meta.env?.VITE_UNPAID_LEAVE_LABEL || 'Unpaid Leave'
export const SUMMARY_AL_SHOW_BALANCE    = import.meta.env?.VITE_AL_SHOW_BALANCE !== 'false'
