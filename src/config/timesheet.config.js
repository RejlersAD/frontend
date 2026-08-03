/**
 * Time Sheet Analytics — Soft-Coded Configuration
 * ------------------------------------------------
 * Centralised configuration for the `/hr/employees → Time Sheet` view. Every
 * endpoint, poll interval, status colour and table column is defined here so
 * the page component stays free of magic values.
 *
 * Backend pairing: `backend/apps/timesheet/*` (mounted at
 * `${API_BASE_URL}/timesheet/`).
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. ENDPOINTS — paths are appended to API_BASE_URL by the service layer
// ─────────────────────────────────────────────────────────────────────────────
export const TIMESHEET_ENDPOINTS = {
  health:            '/timesheet/health/',
  databases:         '/timesheet/discovery/databases/',
  tables:            '/timesheet/discovery/tables/',
  columns:           '/timesheet/discovery/columns/',
  preview:           '/timesheet/discovery/preview/',
  live:              '/timesheet/live/',
  daily:             '/timesheet/daily/',
  monthly:           '/timesheet/monthly/',
  user:              '/timesheet/user/',
  lookupByCode:      '/timesheet/lookup-by-code/',
  exportDaily:       '/timesheet/export/daily/',
  exportMonthly:     '/timesheet/export/monthly/',
  exportMonthlyPdf:  '/timesheet/export/monthly/pdf/',
  exportSummary:     '/timesheet/export/summary/',
  exportSummaryPdf:  '/timesheet/export/summary/pdf/',
  exportYearly:      '/timesheet/export/yearly/',
  exportYearlyPdf:   '/timesheet/export/yearly/pdf/',
  // Self-Service (role-based, auto-scoped to current user)
  myLiveAttendance:    '/timesheet/my-attendance/live/',
  myMonthlyAttendance: '/timesheet/my-attendance/monthly/',
  myDailyAttendance:   '/timesheet/my-attendance/daily/',
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. POLLING — how often the Live tab re-fetches (ms)
// ─────────────────────────────────────────────────────────────────────────────
export const TIMESHEET_POLL_MS = Number(
  import.meta.env?.VITE_TIMESHEET_POLL_MS || 30000
)

// ─────────────────────────────────────────────────────────────────────────────
// 3. TABS shown across the top of the Time Sheet view
// ─────────────────────────────────────────────────────────────────────────────
export const TIMESHEET_TABS = [
  { id: 'live',    label: 'Live',    icon: 'SignalIcon',         description: 'Real-time IN / OUT status' },
  { id: 'daily',   label: 'Daily',   icon: 'CalendarDaysIcon',   description: 'Per-day attendance' },
  { id: 'monthly', label: 'Monthly', icon: 'CalendarIcon',       description: 'Monthly roll-up' },
  { id: 'reports', label: 'Reports', icon: 'ArrowDownTrayIcon',  description: 'Export Excel / PDF' },
  { id: 'setup',   label: 'Setup',   icon: 'Cog6ToothIcon',      description: 'SQL Server configuration' },
]
export const TIMESHEET_DEFAULT_TAB = 'live'

// ─────────────────────────────────────────────────────────────────────────────
// 4. STATUS COLOURS for live cards / row badges
// ─────────────────────────────────────────────────────────────────────────────
export const TIMESHEET_STATUS_TONES = {
  in:           'bg-emerald-100 text-emerald-700 border-emerald-200',
  out:          'bg-slate-100 text-slate-600 border-slate-200',
  late:         'bg-amber-100 text-amber-700 border-amber-200',
  full_day:     'bg-blue-100 text-blue-700 border-blue-200',
  half_day:     'bg-orange-100 text-orange-700 border-orange-200',
  unmatched:    'bg-rose-100 text-rose-700 border-rose-200',
  configured:   'bg-emerald-100 text-emerald-700 border-emerald-200',
  unconfigured: 'bg-rose-100 text-rose-700 border-rose-200',
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. TABLE COLUMN DEFINITIONS
//    Each `accessor` is a pure fn(row) => string|number. Render keeps minimal.
//    Optional `cellType` (e.g. 'email') tells the DataTable to apply a richer
//    renderer — keeps the config plain data so .js stays JSX-free.
// ─────────────────────────────────────────────────────────────────────────────
const safe = (v, fallback = '—') => (v === null || v === undefined || v === '' ? fallback : v)
const fmtTime = (v) => {
  if (!v) return '—'
  try {
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return String(v)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch { return String(v) }
}

// Soft-coded email accessor — checks every shape the enrichment layer can
// return. Keeps every column's email cell pointing at the same source list
// so a backend field rename only needs to be reflected here.
//   radai_email     → matched RAD AI user (preferred — authoritative)
//   employee_email  → column on the attendance table (if configured)
//   office_email    → Mx_VEW_UserDetails.OfficeEmail (Matrix master)
//   personal_email  → Mx_VEW_UserDetails.PersEmail   (Matrix master)
//   email           → legacy generic key
export const TIMESHEET_EMAIL_FIELDS = [
  'radai_email',
  'employee_email',
  'office_email',
  'personal_email',
  'email',
]
export const emailFrom = (r) => {
  for (const k of TIMESHEET_EMAIL_FIELDS) {
    const v = (r?.[k] || '').toString().trim()
    if (v && v.includes('@')) return v
  }
  return ''
}

// Shared email column spec — `cellType: 'email'` tells the DataTable in
// TimeSheetAnalytics.jsx to render the value as a clickable mailto link.
// Re-used by every TIMESHEET_*_COLUMNS array below so the cell behaviour
// stays uniform across Live / Daily / Monthly tabs.
const emailColumn = { id: 'email', label: 'Email', accessor: emailFrom, cellType: 'email' }

// Soft-coded biometric-card column. Source key matches the snake-cased
// alias produced by the backend `_enrich_with_user_details` helper from
// the env-var `TIMESHEET_USER_DETAILS_COLUMNS` (default `Card1`). Adding
// more cards is purely additive — extend the env and push another column
// spec here.
const CARD_FIELDS = ['card1']
const cardFrom = (r) => {
  for (const k of CARD_FIELDS) {
    const v = (r?.[k] ?? '').toString().trim()
    if (v) return v
  }
  return ''
}
const cardColumn = { id: 'card1', label: 'Card 1', accessor: (r) => safe(cardFrom(r)) }

// Soft-coded punch-type labels — backend stamps `is_in` (bool) on every live
// row so we never rely on the raw biometric value (which can be '0'/'1',
// 'IN'/'OUT', or any locale-specific string). Edit the labels here to change
// what users see in the Type column without touching component code.
export const PUNCH_TYPE_LABELS = {
  in:      'IN',
  out:     'OUT',
  unknown: '—',
}
const punchTypeLabel = (r) => {
  if (r.is_in === true)  return PUNCH_TYPE_LABELS.in
  if (r.is_in === false) return PUNCH_TYPE_LABELS.out
  return PUNCH_TYPE_LABELS.unknown
}

export const TIMESHEET_LIVE_COLUMNS = [
  { id: 'name',       label: 'Employee',  accessor: (r) => r.radai_full_name || r.name || r.employee_code },
  { id: 'employee',   label: 'Code',      accessor: (r) => safe(r.employee_code) },
  { id: 'dept',       label: 'Dept',      accessor: (r) => safe(r.radai_department || r.department) },
  { id: 'last_punch', label: 'Last Punch', accessor: (r) => fmtTime(r.punch_time || r.login_time || r.logout_time) },
  { id: 'type',       label: 'Type',      accessor: punchTypeLabel, cellType: 'punch_type' },
]

export const TIMESHEET_DAILY_COLUMNS = [
  { id: 'name',     label: 'Employee', accessor: (r) => r.radai_full_name || r.name || r.employee_code },
  { id: 'code',     label: 'Code',     accessor: (r) => safe(r.employee_code) },
  { id: 'dept',     label: 'Dept',     accessor: (r) => safe(r.radai_department || r.department) },
  { id: 'first_in', label: 'First In', accessor: (r) => fmtTime(r.first_in) },
  { id: 'last_out', label: 'Last Out', accessor: (r) => fmtTime(r.last_out) },
  { id: 'hours',    label: 'Hours',    accessor: (r) => (r.hours_worked ?? 0).toFixed(2) },
  { id: 'late',     label: 'Late?',    accessor: (r) => (r.is_late ? 'Yes' : 'No') },
  { id: 'full',     label: 'Full Day?', accessor: (r) => (r.is_full_day ? 'Yes' : 'No') },
]

export const TIMESHEET_MONTHLY_COLUMNS = [
  { id: 'name',         label: 'Employee',     accessor: (r) => r.radai_full_name || r.name || r.employee_code },
  { id: 'code',         label: 'Code',         accessor: (r) => safe(r.employee_code) },
  { id: 'dept',         label: 'Dept',         accessor: (r) => safe(r.radai_department || r.department) },
  { id: 'days',         label: 'Days Present', accessor: (r) => r.days_present || 0 },
  { id: 'full',         label: 'Full Days',    accessor: (r) => r.full_days || 0 },
  { id: 'half',         label: 'Half Days',    accessor: (r) => r.half_days || 0 },
  { id: 'late',         label: 'Late',         accessor: (r) => r.late_arrivals || 0 },
  { id: 'hours',        label: 'Total Hours',  accessor: (r) => (r.total_hours || 0).toFixed(2) },
  { id: 'avg',          label: 'Avg/Day',      accessor: (r) => (r.avg_hours_per_day || 0).toFixed(2) },
]

// ─────────────────────────────────────────────────────────────────────────────
// 6. SETUP WIZARD — env-var names the user must paste into backend/.env
// ─────────────────────────────────────────────────────────────────────────────
export const TIMESHEET_ENV_VARS = [
  { name: 'TIMESHEET_HOST',          example: '192.168.99.52',  required: false, hint: 'SQL Server host (defaults to 192.168.99.52)' },
  { name: 'TIMESHEET_PORT',          example: '1433',           required: false, hint: 'SQL Server port (defaults to 1433)' },
  { name: 'TIMESHEET_USER',          example: 'svc_radai',      required: true,  hint: 'SQL login with SELECT on the attendance table' },
  { name: 'TIMESHEET_PASSWORD',      example: '••••••••',       required: true,  hint: 'SQL login password' },
  { name: 'TIMESHEET_DATABASE',      example: 'AttendanceDB',   required: true,  hint: 'Database that holds attendance rows' },
  { name: 'TIMESHEET_TABLE',         example: 'dbo.tbl_punches', required: true, hint: '[schema].[table] of attendance rows' },
  { name: 'TIMESHEET_COL_EMP_CODE',  example: 'EmployeeCode',   required: true,  hint: 'Column = employee code (NIK / staff number)' },
  { name: 'TIMESHEET_COL_EMP_EMAIL', example: 'Email',          required: false, hint: 'Column = employee email (used for RAD AI matching)' },
  { name: 'TIMESHEET_COL_EMP_NAME',  example: 'FullName',       required: false, hint: 'Column = display name' },
  { name: 'TIMESHEET_COL_DEPARTMENT', example: 'Department',    required: false, hint: 'Column = department / discipline' },
  { name: 'TIMESHEET_COL_PUNCH_TIME', example: 'PunchTime',     required: false, hint: 'Event-stream schema: punch timestamp column' },
  { name: 'TIMESHEET_COL_PUNCH_TYPE', example: 'Direction',     required: false, hint: 'Event-stream schema: column with IN / OUT marker' },
  { name: 'TIMESHEET_COL_IN_VALUE',   example: 'IN',            required: false, hint: 'Event-stream schema: value of punch_type that means "in"' },
  { name: 'TIMESHEET_COL_LOGIN_TIME', example: 'LoginTime',     required: false, hint: 'Two-column schema: login time column' },
  { name: 'TIMESHEET_COL_LOGOUT_TIME', example: 'LogoutTime',   required: false, hint: 'Two-column schema: logout time column' },
  { name: 'TIMESHEET_COL_DATE',       example: 'WorkDate',      required: false, hint: 'Two-column schema: date column' },
  { name: 'TIMESHEET_EXPECTED_LOGIN_HOUR', example: '9',        required: false, hint: 'Hour (24h) employees are expected to log in (default 9)' },
  { name: 'TIMESHEET_LATE_THRESHOLD_MIN',  example: '15',       required: false, hint: 'Grace period before marking late (default 15 min)' },
  { name: 'TIMESHEET_FULL_DAY_HOURS',     example: '8.0',       required: false, hint: 'Minimum hours that count as a full day (default 8)' },
]

// ─────────────────────────────────────────────────────────────────────────────
// 7. COPY
// ─────────────────────────────────────────────────────────────────────────────
export const TIMESHEET_COPY = {
  title: 'Time Sheet Analytics',
  subtitle: 'Live attendance fed from the biometric SQL Server. Tracks every login / logout and rolls up to daily and monthly reports.',
  notConfiguredTitle: 'Time Sheet is not configured yet',
  notConfiguredSubtitle:
    'Open the Setup tab to point RAD AI at your SQL Server biometric database. The Setup wizard helps you list databases, pick a table, preview rows, and produce the exact environment variables you need to add to backend/.env.',
  driverMissingTitle: 'SQL Server driver is not installed in the backend container',
  driverMissingSubtitle:
    'pymssql is missing. Run: docker exec aiflow_backend_local pip install pymssql>=2.2 — or rebuild the container so requirements.txt is re-applied.',
  connectionFailedTitle: 'Cannot reach the SQL Server',
  connectionFailedSubtitle:
    'Make sure the host is reachable from inside the backend Docker container. On Windows Docker Desktop you can try using "host.docker.internal" instead of an IP.',

  // Mirror mode (production) — biometric data comes from the office-side
  // sync agent that pushes events into a Postgres mirror table on Railway.
  mirrorEmptyTitle: 'Waiting for the first sync from the office',
  mirrorEmptySubtitle:
    'The biometric mirror is set up but no events have been received yet. The office-side sync agent (timesheet_mirror_sync.py) needs to run at least once. See scripts/TIMESHEET_MIRROR_SETUP.md for setup instructions.',
  mirrorErrorTitle: 'Cannot read the biometric mirror',
  mirrorErrorSubtitle:
    'The Postgres mirror table is unreachable. Check the backend service status and database connection.',
  mirrorOkLatestPrefix: 'Last event synced:',

  // Live tab — no punches in the rolling window
  // (separate from mirrorEmpty which means no events in the DB at all)
  liveNoDataTitle: 'No punch events in the last window',
  liveNoDataSubtitle:
    'The sync agent pushes data hourly from the office biometric system. ' +
    'If you just arrived, data may appear after the next sync cycle. ' +
    'Check the Setup tab to confirm the agent is running and events are being received.',
  
  // Soft-coded stale sync detection (when DB has events but they’re too old)
  liveStaleSyncTitle: 'Sync agent has stopped running',
  liveStaleSyncSubtitle: (
    'The database has attendance records, but they are outside the rolling time window. ' +
    'This usually means the office-side sync agent has stopped running.'
  ),
  liveStaleSyncAction: 'Restart the sync agent on the office server',
  liveStaleSyncLastEvent: 'Last punch synced:',
  liveStaleSyncAge: 'Data age:',
  
  // Soft-coded prefix shown next to the rolling-window cutoff time
  liveWindowPrefix: 'Showing punches since',
  // Soft-coded fallback when as_of / window_from are not in the response
  liveSyncUnknown: 'Sync time unknown',
}
