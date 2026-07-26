/**
 * Payroll Intelligence Platform — Soft-Coded Configuration
 * =========================================================
 * All thresholds, colours, labels, column definitions, validation rules,
 * AI insight rules, and chatbot patterns live here.
 * No magic values in component code.
 *
 * Pattern mirrors hrEmployees.config.js for consistency.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. TABS
// ─────────────────────────────────────────────────────────────────────────────
export const PAYROLL_TABS = [
  { id: 'dashboard',  label: 'Dashboard',         icon: 'ChartBarIcon',               description: 'Executive KPI overview' },
  { id: 'attendance', label: 'Attendance',         icon: 'ClipboardDocumentCheckIcon', description: 'HR Attendance — Daily · Monthly · Yearly' },
  { id: 'leave',      label: 'Leave',              icon: 'CalendarDaysIcon',           description: 'Leave balances imported from HR Excel' },
  { id: 'engine',     label: 'Payroll Engine',     icon: 'CpuChipIcon',                description: 'Salary slips & approvals' },
  { id: 'salary',     label: 'Salary Management', icon: 'BanknotesIcon',              description: 'Employee salary structures & history' },
  { id: 'auditor',    label: 'AI Auditor',         icon: 'MagnifyingGlassIcon',        description: 'Anomaly detection' },
  { id: 'assistant',  label: 'AI Assistant',       icon: 'ChatBubbleLeftIcon',         description: 'Payroll chatbot' },
]
export const PAYROLL_DEFAULT_TAB = 'dashboard'

// ─────────────────────────────────────────────────────────────────────────────
// 2. STATUS MAPS
// ─────────────────────────────────────────────────────────────────────────────
export const PAYROLL_SLIP_STATUS = {
  draft:            { label: 'Draft',            tone: 'bg-slate-100 text-slate-600 border-slate-200' },
  generated:        { label: 'Generated',        tone: 'bg-blue-100 text-blue-700 border-blue-200' },
  pending_approval: { label: 'Pending Approval', tone: 'bg-amber-100 text-amber-700 border-amber-200' },
  approved:         { label: 'Approved',         tone: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rejected:         { label: 'Rejected',         tone: 'bg-rose-100 text-rose-700 border-rose-200' },
  sent:             { label: 'Sent',             tone: 'bg-purple-100 text-purple-700 border-purple-200' },
  archived:         { label: 'Archived',         tone: 'bg-gray-100 text-gray-500 border-gray-200' },
}

export const PAYROLL_RUN_STATUS = {
  draft:      { label: 'Draft',      tone: 'bg-slate-100 text-slate-600' },
  processing: { label: 'Processing', tone: 'bg-blue-100 text-blue-700' },
  completed:  { label: 'Completed',  tone: 'bg-emerald-100 text-emerald-700' },
  failed:     { label: 'Failed',     tone: 'bg-rose-100 text-rose-700' },
}

export const PAYROLL_ALERT_SEVERITY = {
  low:      { label: 'Low',      tone: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-400' },
  medium:   { label: 'Medium',   tone: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-400' },
  high:     { label: 'High',     tone: 'bg-orange-100 text-orange-700',dot: 'bg-orange-500' },
  critical: { label: 'Critical', tone: 'bg-rose-100 text-rose-700',    dot: 'bg-rose-500' },
}

export const PAYROLL_VALIDATION_SEVERITY = {
  error:   { label: 'Error',   tone: 'bg-rose-50 border-rose-200 text-rose-700',     icon: 'XCircleIcon' },
  warning: { label: 'Warning', tone: 'bg-amber-50 border-amber-200 text-amber-700',  icon: 'ExclamationTriangleIcon' },
  info:    { label: 'Info',    tone: 'bg-blue-50 border-blue-200 text-blue-700',      icon: 'InformationCircleIcon' },
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. KPI TILES
// ─────────────────────────────────────────────────────────────────────────────
// compute() receives the dashboardSummary object from the API
export const PAYROLL_KPIS = [
  {
    id: 'employees',
    label: 'Active Employees',
    icon: 'UsersIcon',
    tone: 'bg-blue-50 text-blue-700',
    compute: (s) => s?.total_employees ?? '—',
    suffix: '',
  },
  {
    id: 'gross',
    label: 'Current Month Gross',
    icon: 'BanknotesIcon',
    tone: 'bg-emerald-50 text-emerald-700',
    compute: (s) => fmtCurrency(s?.current_month_gross),
    suffix: '',
  },
  {
    id: 'net',
    label: 'Current Month Net',
    icon: 'CurrencyDollarIcon',
    tone: 'bg-teal-50 text-teal-700',
    compute: (s) => fmtCurrency(s?.current_month_net),
    suffix: '',
  },
  {
    id: 'pending',
    label: 'Pending Approvals',
    icon: 'ClockIcon',
    tone: 'bg-amber-50 text-amber-700',
    compute: (s) => s?.pending_approvals ?? 0,
    suffix: ' slips',
  },
  {
    id: 'ytd',
    label: 'YTD Payroll',
    icon: 'ChartBarIcon',
    tone: 'bg-purple-50 text-purple-700',
    compute: (s) => fmtCurrency(s?.ytd_payroll),
    suffix: '',
  },
  {
    id: 'alerts',
    label: 'Open Alerts',
    icon: 'BellAlertIcon',
    tone: 'bg-rose-50 text-rose-700',
    compute: (s) => (s?.open_validations ?? 0) + (s?.open_alerts ?? 0),
    suffix: ' issues',
  },
  {
    id: 'activity_hours',
    label: 'Approved Activity',
    icon: 'ClipboardDocumentCheckIcon',
    tone: 'bg-indigo-50 text-indigo-700',
    compute: (s) => s?.approved_activity_hours_mtd != null
      ? `${parseFloat(s.approved_activity_hours_mtd).toFixed(1)} hrs`
      : '—',
    suffix: '',
    sub: (s) => s?.approved_activity_count_mtd != null
      ? `${s.approved_activity_count_mtd} tasks this month`
      : '',
  },
]

// Attendance KPIs — biometric data tiles (non-clickable)
export const ATT_KPIS = [
  {
    id: 'present_today',
    label: 'Present Today',
    icon: 'CheckCircleIcon',
    tone: 'bg-emerald-50 text-emerald-700',
    compute: (s) => s?.present_today ?? '—',
    sub: (s) => s?.total_employees ? `of ${s.total_employees} employees` : '',
  },
  {
    id: 'absent_today',
    label: 'Absent Today',
    icon: 'XCircleIcon',
    tone: 'bg-rose-50 text-rose-700',
    compute: (s) => s?.absent_today ?? '—',
    sub: (s) => s?.absent_today && s?.total_employees 
      ? `${((s.absent_today / s.total_employees) * 100).toFixed(1)}% absence rate`
      : '',
  },
  {
    id: 'on_leave_today',
    label: 'On Leave',
    icon: 'CalendarDaysIcon',
    tone: 'bg-amber-50 text-amber-700',
    compute: (s) => s?.on_leave_today ?? '—',
    sub: () => 'approved leave requests',
  },
  {
    id: 'avg_hours_today',
    label: 'Avg Hours Today',
    icon: 'ClockIcon',
    tone: 'bg-blue-50 text-blue-700',
    compute: (s) => s?.avg_hours_today != null
      ? `${parseFloat(s.avg_hours_today).toFixed(1)} hrs`
      : '—',
    sub: (s) => s?.present_today ? `across ${s.present_today} present` : '',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// 4. TABLE COLUMNS
// ─────────────────────────────────────────────────────────────────────────────
export const PAYROLL_RUN_COLUMNS = [
  { id: 'run_code',    label: 'Run Code',   accessor: (r) => r.run_code },
  { id: 'period',      label: 'Period',     accessor: (r) => `${String(r.month).padStart(2,'0')}/${r.year}` },
  { id: 'employees',   label: 'Employees',  accessor: (r) => r.total_employees ?? 0 },
  { id: 'gross',       label: 'Gross',      accessor: (r) => fmtCurrency(r.total_gross_salary) },
  { id: 'net',         label: 'Net',        accessor: (r) => fmtCurrency(r.total_net_salary) },
  { id: 'status',      label: 'Status',     accessor: (r) => r.status, cellType: 'run_status' },
]

export const PAYROLL_SLIP_COLUMNS = [
  { id: 'slip_number', label: 'Slip #',     accessor: (r) => r.slip_number },
  { id: 'employee',    label: 'Employee',   accessor: (r) => r.employee_name || r.employee_salary_info },
  { id: 'basic',       label: 'Basic',      accessor: (r) => fmtCurrency(r.basic_salary) },
  { id: 'allowances',  label: 'Allowances', accessor: (r) => fmtCurrency(r.total_allowances) },
  { id: 'deductions',  label: 'Deductions', accessor: (r) => fmtCurrency(r.total_deductions) },
  { id: 'net',         label: 'Net Salary', accessor: (r) => fmtCurrency(r.net_salary) },
  { id: 'status',      label: 'Status',     accessor: (r) => r.status, cellType: 'slip_status' },
]

// Month options for payroll run dropdowns
export const PAYROLL_RUN_MONTHS = [
  { value: 1,  label: 'January' },
  { value: 2,  label: 'February' },
  { value: 3,  label: 'March' },
  { value: 4,  label: 'April' },
  { value: 5,  label: 'May' },
  { value: 6,  label: 'June' },
  { value: 7,  label: 'July' },
  { value: 8,  label: 'August' },
  { value: 9,  label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
]

// ─────────────────────────────────────────────────────────────────────────────
// 5. AUDIT THRESHOLDS — soft-coded, override without touching component code
// ─────────────────────────────────────────────────────────────────────────────
export const PAYROLL_AUDIT_THRESHOLDS = {
  spikePercent:     20,    // % change in net salary that triggers a spike alert
  overtimeHours:    60,    // hours/month above which overtime alert fires
  minPresentDays:   15,    // days below which attendance anomaly fires
  minHoursPerDay:   4,     // hours below which a day is not counted as present
  burnoutHoursMonth: 200,  // monthly hours above which burnout risk fires
  lowUtilPercent:   50,    // utilization % below which productivity alert fires
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. VALIDATION RULES
// ─────────────────────────────────────────────────────────────────────────────
// check(slips, employees) → returns array of finding objects
export const PAYROLL_VALIDATION_RULES = [
  {
    id: 'missing_salary_structure',
    label: 'Missing Salary Structure',
    severity: 'error',
    check: (slips, employees) =>
      employees
        .filter((e) => !e.basic_salary || Number(e.basic_salary) <= 0)
        .map((e) => ({
          employee: e,
          description: `${e.employee_id || e.user?.email} has no basic salary configured.`,
          suggested_action: 'Open the employee salary profile and set basic salary.',
        })),
  },
  {
    id: 'negative_net_salary',
    label: 'Negative Net Salary',
    severity: 'error',
    check: (slips) =>
      slips
        .filter((s) => Number(s.net_salary) < 0)
        .map((s) => ({
          slip: s,
          description: `Slip ${s.slip_number} has a negative net salary (${fmtCurrency(s.net_salary)}).`,
          suggested_action: 'Review deduction amounts — total deductions exceed gross salary.',
        })),
  },
  {
    id: 'duplicate_slip',
    label: 'Duplicate Salary Slip',
    severity: 'error',
    check: (slips) => {
      const seen = {}
      const dupes = []
      for (const s of slips) {
        const key = `${s.employee_salary_info}-${s.month}-${s.year}`
        if (seen[key]) {
          dupes.push({
            slip: s,
            description: `Duplicate slip detected for employee ${s.slip_number} in ${s.month}/${s.year}.`,
            suggested_action: 'Delete the duplicate slip before approving.',
          })
        }
        seen[key] = true
      }
      return dupes
    },
  },
  {
    id: 'pending_approval_overdue',
    label: 'Approval Overdue (>3 days)',
    severity: 'warning',
    check: (slips) => {
      const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000
      return slips
        .filter((s) => s.status === 'pending_approval' && s.created_at &&
          Date.now() - new Date(s.created_at).getTime() > THREE_DAYS_MS)
        .map((s) => ({
          slip: s,
          description: `Slip ${s.slip_number} has been pending approval for more than 3 days.`,
          suggested_action: 'Escalate to approver or reassign.',
        }))
    },
  },
  {
    id: 'missing_present_days',
    label: 'Missing Attendance Data',
    severity: 'warning',
    check: (slips) =>
      slips
        .filter((s) => s.status !== 'draft' && (s.present_days === null || s.present_days === undefined))
        .map((s) => ({
          slip: s,
          description: `Slip ${s.slip_number}: attendance data (present days) is missing.`,
          suggested_action: 'Sync attendance data before finalising payroll.',
        })),
  },
  {
    id: 'zero_gross',
    label: 'Zero Gross Salary',
    severity: 'warning',
    check: (slips) =>
      slips
        .filter((s) => Number(s.gross_salary) === 0)
        .map((s) => ({
          slip: s,
          description: `Slip ${s.slip_number} has zero gross salary.`,
          suggested_action: 'Check if all salary components are correctly mapped.',
        })),
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// 7. AI INSIGHT RULES (client-side, rule-based)
// ─────────────────────────────────────────────────────────────────────────────
// compute({ employee, monthlyTs, slip, prevMonthTs }) → { title, description, severity, value }
export const PAYROLL_AI_INSIGHT_RULES = [
  {
    id: 'attendance_anomaly',
    type: 'attendance_anomaly',
    label: 'Attendance Anomaly',
    icon: 'ExclamationCircleIcon',
    compute: ({ monthlyTs }) => {
      const days = monthlyTs?.days_present ?? null
      if (days === null) return null
      if (days < PAYROLL_AUDIT_THRESHOLDS.minPresentDays) {
        return {
          severity: 'warning',
          title: 'Low Attendance',
          description: `Only ${days} days present this month (threshold: ${PAYROLL_AUDIT_THRESHOLDS.minPresentDays}).`,
          value: days,
        }
      }
      return { severity: 'info', title: 'Attendance Normal', description: `${days} days present.`, value: days }
    },
  },
  {
    id: 'missing_timesheet',
    type: 'missing_timesheet',
    label: 'Missing Timesheet',
    icon: 'ClockIcon',
    compute: ({ monthlyTs }) => {
      if (!monthlyTs) {
        return { severity: 'error', title: 'No Timesheet Data', description: 'No timesheet record found for this month.', value: 0 }
      }
      const hours = monthlyTs.total_hours ?? 0
      if (hours === 0) {
        return { severity: 'warning', title: 'Zero Hours Logged', description: 'Timesheet exists but shows 0 hours.', value: 0 }
      }
      return null
    },
  },
  {
    id: 'overtime_alert',
    type: 'overtime_alert',
    label: 'Overtime Alert',
    icon: 'FireIcon',
    compute: ({ monthlyTs }) => {
      const hours = monthlyTs?.total_hours ?? 0
      if (hours > PAYROLL_AUDIT_THRESHOLDS.overtimeHours) {
        return {
          severity: 'warning',
          title: 'Excessive Overtime',
          description: `${hours.toFixed(1)}h logged — exceeds ${PAYROLL_AUDIT_THRESHOLDS.overtimeHours}h threshold.`,
          value: hours,
        }
      }
      return null
    },
  },
  {
    id: 'burnout_risk',
    type: 'burnout_risk',
    label: 'Burnout Risk',
    icon: 'HeartIcon',
    compute: ({ monthlyTs }) => {
      const hours = monthlyTs?.total_hours ?? 0
      if (hours > PAYROLL_AUDIT_THRESHOLDS.burnoutHoursMonth) {
        return {
          severity: 'error',
          title: 'Burnout Risk',
          description: `${hours.toFixed(1)}h/month exceeds burnout threshold of ${PAYROLL_AUDIT_THRESHOLDS.burnoutHoursMonth}h.`,
          value: hours,
        }
      }
      return null
    },
  },
  {
    id: 'payroll_risk',
    type: 'payroll_risk',
    label: 'Payroll Risk Score',
    icon: 'ShieldExclamationIcon',
    compute: ({ monthlyTs, slip }) => {
      let score = 0
      const days = monthlyTs?.days_present ?? PAYROLL_AUDIT_THRESHOLDS.minPresentDays
      if (days < PAYROLL_AUDIT_THRESHOLDS.minPresentDays) score += 30
      if (!monthlyTs) score += 40
      if (slip && Number(slip.net_salary) < 0) score += 30
      const severity = score >= 70 ? 'error' : score >= 40 ? 'warning' : 'info'
      return {
        severity,
        title: `Risk Score: ${score}/100`,
        description: score >= 70 ? 'High risk — review before processing.'
          : score >= 40 ? 'Moderate risk — verify attendance and salary data.'
          : 'Low risk — payroll looks healthy.',
        value: score,
      }
    },
  },
  {
    id: 'productivity_trend',
    type: 'productivity_trend',
    label: 'Productivity Trend',
    icon: 'ArrowTrendingUpIcon',
    compute: ({ monthlyTs, prevMonthTs }) => {
      if (!monthlyTs || !prevMonthTs) return null
      const curr = monthlyTs.total_hours ?? 0
      const prev = prevMonthTs.total_hours ?? 0
      if (prev === 0) return null
      const change = ((curr - prev) / prev) * 100
      return {
        severity: change >= 0 ? 'info' : 'warning',
        title: change >= 0 ? `+${change.toFixed(1)}% vs last month` : `${change.toFixed(1)}% vs last month`,
        description: `Hours: ${curr.toFixed(1)}h this month vs ${prev.toFixed(1)}h last month.`,
        value: change,
      }
    },
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// 8. CHATBOT PATTERNS (keyword → intent → response generator)
// ─────────────────────────────────────────────────────────────────────────────
export const PAYROLL_CHATBOT_PATTERNS = [
  {
    id: 'show_payslip',
    keywords: ['payslip', 'salary slip', 'my slip', 'pay slip'],
    quickLabel: 'Show my payslip',
    intent: 'show_payslip',
    respond: (data) => data?.latestSlip
      ? `Your latest payslip (${data.latestSlip.slip_number}) for ${data.latestSlip.month}/${data.latestSlip.year}:\n• Gross: ${fmtCurrency(data.latestSlip.gross_salary)}\n• Deductions: ${fmtCurrency(data.latestSlip.total_deductions)}\n• Net: ${fmtCurrency(data.latestSlip.net_salary)}\nStatus: ${PAYROLL_SLIP_STATUS[data.latestSlip.status]?.label ?? data.latestSlip.status}`
      : 'No salary slip found for the current period.',
  },
  {
    id: 'overtime',
    keywords: ['overtime', 'over time', 'extra hours'],
    quickLabel: 'Overtime this month',
    intent: 'overtime',
    respond: (data) => {
      const hours = data?.monthlyTs?.total_hours ?? 0
      const standard = 8 * (data?.monthlyTs?.days_present ?? 22)
      const ot = Math.max(0, hours - standard)
      return ot > 0
        ? `You have logged ${ot.toFixed(1)} overtime hours this month (${hours.toFixed(1)}h total vs ${standard}h standard).`
        : 'No overtime recorded this month.'
    },
  },
  {
    id: 'leave_balance',
    keywords: ['leave', 'leave balance', 'annual leave', 'vacation'],
    quickLabel: 'Leave balance',
    intent: 'leave_balance',
    respond: () => 'Leave balance data is managed in Sympa HRMS. Please check your HR portal for current leave balances.',
  },
  {
    id: 'deduction',
    keywords: ['deduction', 'why deducted', 'deduct', 'minus'],
    quickLabel: 'Why was salary deducted',
    intent: 'deduction',
    respond: (data) => {
      const breakdown = data?.latestSlip?.deductions_breakdown
      if (!breakdown || Object.keys(breakdown).length === 0) return 'No deduction breakdown available for the current period.'
      const lines = Object.entries(breakdown).map(([k, v]) => `• ${k}: ${fmtCurrency(v)}`)
      return `Deduction breakdown for your latest slip:\n${lines.join('\n')}`
    },
  },
  {
    id: 'payroll_summary',
    keywords: ['payroll summary', 'team payroll', 'department payroll', 'total payroll'],
    quickLabel: 'Payroll summary',
    intent: 'payroll_summary',
    persona: ['finance', 'manager', 'hr'],
    respond: (data) =>
      data?.summary
        ? `Current month payroll summary:\n• Employees: ${data.summary.total_employees}\n• Gross: ${fmtCurrency(data.summary.current_month_gross)}\n• Net: ${fmtCurrency(data.summary.current_month_net)}\n• Pending approvals: ${data.summary.pending_approvals}`
        : 'Payroll summary is not available yet.',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// 9. FEATURE FLAGS
// ─────────────────────────────────────────────────────────────────────────────
// Enable fullscreen mode toggle button in Payroll Intelligence
export const PAYROLL_FULLSCREEN_ENABLED = true

// ─────────────────────────────────────────────────────────────────────────────
// 10. COPY
// ─────────────────────────────────────────────────────────────────────────────
export const PAYROLL_COPY = {
  pageTitle:            'Payroll Intelligence',
  pageSubtitle:         'AI-powered payroll management — validation, auditing, and real-time insights.',
  noRunSelected:        'Select a payroll run to view salary slips.',
  noSlipsFound:         'No salary slips found for this run.',
  noEmployeeSelected:   'Select an employee to view their Digital Twin.',
  validationEmpty:      'No validation findings. Payroll looks healthy.',
  auditorEmpty:         'No audit alerts for this run.',
  projectsComingSoon:   'Project Costing requires Valueframe integration.',
  chatWelcome:          'Hello! I\'m your Payroll Assistant. Ask me anything about your salary, overtime, or payroll status.',
  searchEmployeePlaceholder: 'Search employee name, code, email…',
  // Approval tracker labels
  trackerOverdue:       'Overdue',
  trackerWarning:       'Warning',
  trackerOnTrack:       'On Track',
  trackerPendingLabel:  'Pending with',
  // Fullscreen mode labels
  fullscreenTitle:      'Toggle fullscreen mode',
  fullscreenEnter:      'Fullscreen',
  fullscreenExit:       'Exit Fullscreen',
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. FORMATTERS
// ─────────────────────────────────────────────────────────────────────────────
// Soft-coded currency — change default here to affect every component
const DEFAULT_CURRENCY = 'AED'

export const fmtCurrency = (v, currency = DEFAULT_CURRENCY) => {
  const n = parseFloat(v) || 0
  return `${currency} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export const fmtPercent = (v) => {
  const n = parseFloat(v) || 0
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

export const riskColor = (score) => {
  if (score >= 70) return 'text-rose-600'
  if (score >= 40) return 'text-amber-600'
  return 'text-emerald-600'
}

export const severityTone = (s) =>
  PAYROLL_VALIDATION_SEVERITY[s]?.tone ?? 'bg-slate-50 border-slate-200 text-slate-600'

export const slipStatusMeta = (s) => PAYROLL_SLIP_STATUS[s] ?? { label: s, tone: 'bg-slate-100 text-slate-600 border-slate-200' }
export const runStatusMeta  = (s) => PAYROLL_RUN_STATUS[s]  ?? { label: s, tone: 'bg-slate-100 text-slate-600' }

// ─────────────────────────────────────────────────────────────────────────────
// KPI DRILL-DOWN REPORT CONFIGS
// Maps each tile id → { title, description, icon, accentGradient, emptyMsg,
//   columns[], searchFn }.  The component supplies the rows via REPORT_FETCHERS.
//   Badge column types: slipStatusBadge | runStatusBadge | severityBadge |
//                       leaveStatusBadge | balanceBadge | mono
// ─────────────────────────────────────────────────────────────────────────────
const _fmtD = (v) => (v ? new Date(v).toLocaleDateString() : '—')
const _days = (v) => `${parseFloat(v ?? 0).toFixed(1)} d`

export const PAYROLL_KPI_REPORTS = {
  employees: {
    title: 'Active Employees',
    description: 'All employees with a configured salary structure.',
    icon: 'UsersIcon',
    accentGradient: 'from-blue-500 to-indigo-600',
    emptyMsg: 'No employee salary data found.',
    searchFn: (r) =>
      `${r.employee_name || r.full_name || ''} ${r.department || ''} ${r.employee_code || ''}`.toLowerCase(),
    columns: [
      { key: 'name',   label: 'Employee',   render: (r) => r.employee_name || r.full_name || r.employee_code || '—' },
      { key: 'code',   label: 'Code',       render: (r) => r.employee_code || '—', mono: true },
      { key: 'dept',   label: 'Department', render: (r) => r.department || '—' },
      { key: 'basic',  label: 'Basic',      render: (r) => fmtCurrency(r.basic_salary) },
      { key: 'gross',  label: 'Gross',      render: (r) => fmtCurrency(r.gross_salary ?? r.total_gross) },
      { key: 'net',    label: 'Net',        render: (r) => fmtCurrency(r.net_salary) },
      { key: 'status', label: 'Status',     render: (r) => r.status || '—', slipStatusBadge: true },
    ],
  },

  gross: {
    title: 'Current Month Gross',
    description: 'All salary slips for the current pay period — gross breakdown.',
    icon: 'BanknotesIcon',
    accentGradient: 'from-emerald-500 to-teal-600',
    emptyMsg: 'No salary slips found for this month.',
    searchFn: (r) =>
      `${r.employee_name || ''} ${r.slip_number || ''}`.toLowerCase(),
    columns: [
      { key: 'slip',   label: 'Slip #',      render: (r) => r.slip_number || '—', mono: true },
      { key: 'name',   label: 'Employee',    render: (r) => r.employee_name || '—' },
      { key: 'period', label: 'Period',      render: (r) => `${String(r.month || '').padStart(2,'0')}/${r.year || ''}` },
      { key: 'basic',  label: 'Basic',       render: (r) => fmtCurrency(r.basic_salary) },
      { key: 'allow',  label: 'Allowances',  render: (r) => fmtCurrency(r.total_allowances) },
      { key: 'gross',  label: 'Gross',       render: (r) => fmtCurrency(r.gross_salary) },
      { key: 'status', label: 'Status',      render: (r) => r.status || '—', slipStatusBadge: true },
    ],
  },

  net: {
    title: 'Current Month Net',
    description: 'Net take-home pay for the current month after all deductions.',
    icon: 'CurrencyDollarIcon',
    accentGradient: 'from-teal-500 to-cyan-600',
    emptyMsg: 'No salary slips found for this month.',
    searchFn: (r) =>
      `${r.employee_name || ''} ${r.slip_number || ''}`.toLowerCase(),
    columns: [
      { key: 'slip',  label: 'Slip #',      render: (r) => r.slip_number || '—', mono: true },
      { key: 'name',  label: 'Employee',    render: (r) => r.employee_name || '—' },
      { key: 'period',label: 'Period',      render: (r) => `${String(r.month || '').padStart(2,'0')}/${r.year || ''}` },
      { key: 'gross', label: 'Gross',       render: (r) => fmtCurrency(r.gross_salary) },
      { key: 'ded',   label: 'Deductions',  render: (r) => fmtCurrency(r.total_deductions) },
      { key: 'net',   label: 'Net',         render: (r) => fmtCurrency(r.net_salary) },
      { key: 'status',label: 'Status',      render: (r) => r.status || '—', slipStatusBadge: true },
    ],
  },

  pending: {
    title: 'Pending Approvals',
    description: 'Salary slips awaiting HR approval before disbursement.',
    icon: 'ClockIcon',
    accentGradient: 'from-amber-500 to-orange-600',
    emptyMsg: 'No slips pending approval — all clear.',
    searchFn: (r) =>
      `${r.employee_name || ''} ${r.slip_number || ''}`.toLowerCase(),
    columns: [
      { key: 'slip',   label: 'Slip #',   render: (r) => r.slip_number || '—', mono: true },
      { key: 'name',   label: 'Employee', render: (r) => r.employee_name || '—' },
      { key: 'period', label: 'Period',   render: (r) => `${String(r.month || '').padStart(2,'0')}/${r.year || ''}` },
      { key: 'basic',  label: 'Basic',    render: (r) => fmtCurrency(r.basic_salary) },
      { key: 'net',    label: 'Net',      render: (r) => fmtCurrency(r.net_salary) },
      { key: 'status', label: 'Status',   render: (r) => r.status || '—', slipStatusBadge: true },
    ],
  },

  ytd: {
    title: 'YTD Payroll Runs',
    description: 'All payroll runs processed so far this year.',
    icon: 'ChartBarIcon',
    accentGradient: 'from-purple-500 to-violet-600',
    emptyMsg: 'No payroll runs found for this year.',
    searchFn: (r) =>
      `${r.run_code || ''} ${r.month || ''} ${r.year || ''}`.toLowerCase(),
    columns: [
      { key: 'code',   label: 'Run Code',  render: (r) => r.run_code || '—', mono: true },
      { key: 'period', label: 'Period',    render: (r) => `${String(r.month || '').padStart(2,'0')}/${r.year || ''}` },
      { key: 'emps',   label: 'Employees', render: (r) => r.total_employees ?? '—' },
      { key: 'gross',  label: 'Gross',     render: (r) => fmtCurrency(r.total_gross_salary) },
      { key: 'net',    label: 'Net',       render: (r) => fmtCurrency(r.total_net_salary) },
      { key: 'status', label: 'Status',    render: (r) => r.status || '—', runStatusBadge: true },
    ],
  },

  alerts: {
    title: 'Open Audit Alerts',
    description: 'Payroll anomalies and compliance flags requiring HR attention.',
    icon: 'BellAlertIcon',
    accentGradient: 'from-rose-500 to-red-600',
    emptyMsg: 'No open alerts — payroll is clean.',
    searchFn: (r) =>
      `${r.employee_name || ''} ${r.description || ''} ${r.alert_type || ''}`.toLowerCase(),
    columns: [
      { key: 'type',    label: 'Alert Type',  render: (r) => r.alert_type || r.rule_code || '—' },
      { key: 'emp',     label: 'Employee',    render: (r) => r.employee_name || '—' },
      { key: 'sev',     label: 'Severity',    render: (r) => r.severity || '—', severityBadge: true },
      { key: 'desc',    label: 'Description', render: (r) => r.description || '—' },
      { key: 'created', label: 'Created',     render: (r) => _fmtD(r.created_at) },
    ],
  },

  leave_employees: {
    title: 'Employees Tracked (Leave)',
    description: 'All employees with leave records imported from HR.',
    icon: 'UsersIcon',
    accentGradient: 'from-indigo-500 to-blue-600',
    emptyMsg: 'No leave records found.',
    searchFn: (r) =>
      `${r.employee_name || r.employee_code || ''} ${r.leave_type_name || ''}`.toLowerCase(),
    columns: [
      { key: 'name',  label: 'Employee',    render: (r) => r.employee_name || r.employee_code || '—' },
      { key: 'code',  label: 'Code',        render: (r) => r.employee_code || '—', mono: true },
      { key: 'type',  label: 'Leave Type',  render: (r) => r.leave_type_name || r.leave_type || '—' },
      { key: 'taken', label: 'Taken (days)', render: (r) => _days(r.days_taken) },
      { key: 'bal',   label: 'Balance',     render: (r) => _days(r.balance ?? r.remaining_balance), balanceBadge: true },
    ],
  },

  leave_taken_ytd: {
    title: 'Leave Taken YTD',
    description: 'All approved leave requests so far this year.',
    icon: 'ArrowTrendingDownIcon',
    accentGradient: 'from-amber-500 to-orange-600',
    emptyMsg: 'No approved leave requests found.',
    searchFn: (r) =>
      `${r.employee_name || ''} ${r.leave_type_detail?.code || r.leave_type || ''}`.toLowerCase(),
    columns: [
      { key: 'name',   label: 'Employee',  render: (r) => r.employee_name || '—' },
      { key: 'type',   label: 'Type',      render: (r) => r.leave_type_detail?.code || r.leave_type || '—' },
      { key: 'days',   label: 'Days',      render: (r) => _days(r.total_days ?? r.duration_days) },
      { key: 'from',   label: 'From',      render: (r) => r.start_date || '—' },
      { key: 'to',     label: 'To',        render: (r) => r.end_date || '—' },
      { key: 'status', label: 'Status',    render: (r) => r.status || '—', leaveStatusBadge: true },
    ],
  },

  leave_earned_ytd: {
    title: 'Leave Earned YTD',
    description: 'Leave days accrued per employee from the start of the year.',
    icon: 'ArrowTrendingUpIcon',
    accentGradient: 'from-emerald-500 to-teal-600',
    emptyMsg: 'No leave balance data available.',
    searchFn: (r) =>
      `${r.employee_name || r.employee_code || ''}`.toLowerCase(),
    columns: [
      { key: 'name',   label: 'Employee',   render: (r) => r.employee_name || r.employee_code || '—' },
      { key: 'code',   label: 'Code',       render: (r) => r.employee_code || '—', mono: true },
      { key: 'type',   label: 'Leave Type', render: (r) => r.leave_type_name || r.leave_type || '—' },
      { key: 'earned', label: 'Earned',     render: (r) => _days(r.days_earned ?? r.entitlement) },
      { key: 'taken',  label: 'Taken',      render: (r) => _days(r.days_taken) },
      { key: 'bal',    label: 'Balance',    render: (r) => _days(r.balance), balanceBadge: true },
    ],
  },

  leave_avg_balance: {
    title: 'Leave Balance — Per Employee',
    description: 'Individual leave balances sorted from lowest to highest.',
    icon: 'ScaleIcon',
    accentGradient: 'from-teal-500 to-cyan-600',
    emptyMsg: 'No leave balance data available.',
    searchFn: (r) =>
      `${r.employee_name || r.employee_code || ''}`.toLowerCase(),
    columns: [
      { key: 'name',  label: 'Employee',   render: (r) => r.employee_name || r.employee_code || '—' },
      { key: 'code',  label: 'Code',       render: (r) => r.employee_code || '—', mono: true },
      { key: 'type',  label: 'Leave Type', render: (r) => r.leave_type_name || r.leave_type || '—' },
      { key: 'taken', label: 'Taken',      render: (r) => _days(r.days_taken) },
      { key: 'bal',   label: 'Balance',    render: (r) => _days(r.balance ?? r.remaining_balance), balanceBadge: true },
    ],
  },

  leave_critical: {
    title: 'Critical Leave Balance',
    description: 'Employees at or below zero leave days — immediate HR action required.',
    icon: 'ExclamationTriangleIcon',
    accentGradient: 'from-rose-600 to-red-700',
    emptyMsg: 'All employees have positive leave balances.',
    searchFn: (r) =>
      `${r.employee_name || r.employee_code || ''}`.toLowerCase(),
    columns: [
      { key: 'name',  label: 'Employee',   render: (r) => r.employee_name || r.employee_code || '—' },
      { key: 'code',  label: 'Code',       render: (r) => r.employee_code || '—', mono: true },
      { key: 'type',  label: 'Leave Type', render: (r) => r.leave_type_name || r.leave_type || '—' },
      { key: 'taken', label: 'Taken',      render: (r) => _days(r.days_taken) },
      { key: 'bal',   label: 'Balance',    render: (r) => _days(r.balance ?? r.remaining_balance), balanceBadge: true },
    ],
  },
}


// =============================================================================
// Salary Management
// =============================================================================

// ── Status map ──────────────────────────────────────────────────────────────
export const SALARY_STATUS = {
  DRAFT:            { label: 'Draft',            tone: 'bg-slate-100 text-slate-600 border-slate-200',   dot: 'bg-slate-400'   },
  PENDING_APPROVAL: { label: 'Pending Approval', tone: 'bg-amber-100 text-amber-700 border-amber-200',   dot: 'bg-amber-400'   },
  APPROVED:         { label: 'Approved',         tone: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  REJECTED:         { label: 'Rejected',         tone: 'bg-rose-100 text-rose-700 border-rose-200',     dot: 'bg-rose-500'    },
}
export const salaryStatusMeta = (s) => SALARY_STATUS[s] ?? { label: s, tone: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' }

// ── Component categories ─────────────────────────────────────────────────────
export const SALARY_COMPONENT_CATEGORIES = [
  { value: 'allowance', label: 'Allowance',       description: 'Added to gross salary' },
  { value: 'deduction', label: 'Deduction',       description: 'Subtracted from gross salary' },
  { value: 'gross',     label: 'Gross Component', description: 'Counted as part of gross salary' },
]

// ── Table column definitions ─────────────────────────────────────────────────
export const SALARY_STRUCTURE_COLUMNS = [
  { key: 'employee_code', label: 'Employee Code', sortable: true },
  { key: 'employee_name', label: 'Name',          sortable: true },
  { key: 'department',    label: 'Department',    sortable: true },
  { key: 'effective_date',label: 'Effective',     sortable: true },
  { key: 'currency',      label: 'CCY',           sortable: false },
  { key: 'basic_salary',  label: 'Basic',         sortable: true, numeric: true },
  { key: 'total_gross',   label: 'Gross',         sortable: true, numeric: true },
  { key: 'total_deductions', label: 'Deductions', sortable: false, numeric: true },
  { key: 'net_salary',    label: 'Net',           sortable: true, numeric: true },
  { key: 'status',        label: 'Status',        sortable: true },
]

export const SALARY_HISTORY_COLUMNS = [
  { key: 'employee_code',  label: 'Code',           sortable: true },
  { key: 'employee_name',  label: 'Name',           sortable: true },
  { key: 'change_date',    label: 'Effective Date', sortable: true },
  { key: 'previous_net',   label: 'Previous Net',   sortable: false, numeric: true },
  { key: 'new_net',        label: 'New Net',        sortable: false, numeric: true },
  { key: 'change_percent', label: 'Change %',       sortable: true,  numeric: true },
  { key: 'change_reason',  label: 'Reason',         sortable: false },
  { key: 'approved_by_name', label: 'Approved By',  sortable: false },
  { key: 'created_at',     label: 'Recorded',       sortable: true },
]

// ── KPI tiles ────────────────────────────────────────────────────────────────
export const SALARY_SUMMARY_KPIS = [
  { id: 'total_employees',    label: 'Employees on Record',  icon: 'UsersIcon',        color: 'text-blue-600',    bg: 'bg-blue-50'    },
  { id: 'total_payroll',      label: 'Total Net Payroll',    icon: 'BanknotesIcon',    color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { id: 'avg_salary',         label: 'Avg Net Salary',       icon: 'ChartBarIcon',     color: 'text-purple-600',  bg: 'bg-purple-50'  },
  { id: 'pending_approvals',  label: 'Pending Approvals',    icon: 'ClockIcon',        color: 'text-amber-600',   bg: 'bg-amber-50'   },
]

// ── RBAC ─────────────────────────────────────────────────────────────────────
export const SALARY_APPROVAL_ROLE_CODES = ['senior_hr', 'admin', 'superadmin', 'manager']

/**
 * Returns true if the user may approve/reject salary structures.
 * Mirrors canEditAttendance — checks nested .user.is_superuser and roles[].
 */
export function canApproveSalary(profile, authUser) {
  const djangoUser           = authUser?.user ?? authUser
  const djangoUserFromProfile = profile?.user  ?? profile
  if (djangoUser?.is_superuser || djangoUser?.is_staff)       return true
  if (djangoUserFromProfile?.is_superuser || djangoUserFromProfile?.is_staff) return true

  const allRoles = [
    ...(Array.isArray(profile?.roles)  ? profile.roles  : []),
    ...(Array.isArray(authUser?.roles) ? authUser.roles : []),
  ]
  return allRoles.some(r => {
    const code = (r?.code || '').toLowerCase()
    return SALARY_APPROVAL_ROLE_CODES.some(c => code === c || code.startsWith(c))
  })
}

// ── UI copy ───────────────────────────────────────────────────────────────────
export const SALARY_COPY = {
  pageTitle:           'Salary Management',
  pageSubtitle:        'Manage employee salary structures, review components and approve changes',
  tabStructures:       'Salary Structures',
  tabComponents:       'Component Library',
  tabHistory:          'Salary History',
  btnNew:              'New Structure',
  btnNewComponent:     'New Component',
  btnSubmit:           'Submit for Approval',
  btnApprove:          'Approve',
  btnReject:           'Reject',
  btnEdit:             'Edit',
  confirmApprove:      'Approve this salary structure? This will activate it and archive the previous one.',
  confirmReject:       'Reject this salary structure?',
  confirmDelete:       'Deactivate this record? This cannot be undone.',
  emptyStructures:     'No salary structures found.',
  emptyComponents:     'No salary components defined. Add one to get started.',
  emptyHistory:        'No salary history recorded yet.',
  successCreate:       'Salary structure created.',
  successUpdate:       'Salary structure updated.',
  successSubmit:       'Submitted for approval.',
  successApprove:      'Salary structure approved and activated.',
  successReject:       'Salary structure rejected.',
  successComponentSave:'Component saved.',
  pendingBadge:        'Pending Approvals',
  labelBasic:          'Basic Salary',
  labelGross:          'Total Gross',
  labelDeductions:     'Total Deductions',
  labelNet:            'Net Salary',
  labelEffective:      'Effective Date',
  labelCurrency:       'Currency',
  labelDepartment:     'Department',
  labelComponents:     'Salary Components',
  labelReason:         'Review Note',
  noteReadOnly:        'Approved structures are read-only. Create a new structure to make changes.',
  noteApprovalRequired:'Requires Senior HR / Manager approval before activation.',
}

// ─────────────────────────────────────────────────────────────────────────────
// 15. PAYROLL ENGINE — full lifecycle + AI intelligence constants
// ─────────────────────────────────────────────────────────────────────────────

export const ENGINE_BULK_PAGE_SIZE = 200

export const ENGINE_ANOMALY_RULES = {
  // Flag slips where net salary changed more than this % vs previous month
  salaryJumpPct:              20,
  // Flag slips with absent_days above this threshold
  highAbsentDays:             5,
  // Biometric present_days vs slip present_days tolerance before flagging mismatch
  attendanceMismatchTolerance: 1,
  // Always flag slips where net_salary is exactly 0
  zeroNetSalary:              true,
}

export const ENGINE_ANOMALY_SEVERITY = {
  highAbsent:          { label: 'High Absence',          severity: 'high' },
  zeroNet:             { label: 'Zero Net Salary',        severity: 'critical' },
  salaryJump:          { label: 'Salary Jump',            severity: 'medium' },
  attendanceMismatch:  { label: 'Attendance Mismatch',    severity: 'medium' },
}

// Chart colour palette for department bar chart — 10 distinct hues
export const ENGINE_DEPT_CHART_COLORS = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#ef4444', // red-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
  '#84cc16', // lime-500
  '#ec4899', // pink-500
  '#6366f1', // indigo-500
]

export const ENGINE_SUBTABS = [
  { id: 'overview',   label: 'Overview',   icon: 'ChartBarIcon' },
  { id: 'slips',      label: 'Slips',      icon: 'DocumentTextIcon' },
  { id: 'analytics',  label: 'Analytics',  icon: 'PresentationChartLineIcon' },
]

export const ENGINE_COPY = {
  sectionTitle:        'Payroll Engine',
  sectionSubtitle:     'Full lifecycle payroll management with AI anomaly detection',
  newRunBtn:           'New Payroll Run',
  runEngineBtn:        'Run Engine',
  runEngineRunning:    'Processing…',
  bulkApproveBtn:      'Approve All Pending',
  bulkSendBtn:         'Send All Approved',
  createRunTitle:      'Create New Payroll Run',
  noRunSelected:       'Select a payroll run to continue.',
  noSlipsFound:        'No salary slips found for this run.',
  noRuns:              'No payroll runs found. Create one to get started.',
  processing:          'Generating salary slips — this may take a moment…',
  processSuccess:      'Payroll run completed. Slips generated successfully.',
  processFailed:       'Payroll run failed. Check the error log below.',
  bulkApproveSuccess:  'All pending slips approved.',
  bulkSendSuccess:     'Emails queued for all approved slips.',
  anomalyPanelTitle:   'AI Anomaly Flags',
  anomalyNone:         'No anomalies detected for this run.',
  kpiEmployees:        'Total Employees',
  kpiGross:            'Gross Payroll',
  kpiNet:              'Net Payroll',
  kpiPending:          'Pending Approval',
  kpiAnomalies:        'AI Anomalies',
  deptChartTitle:      'Net Salary by Department',
  pieChartTitle:       'Allowances vs Deductions',
  drawerAttendance:    'Attendance',
  drawerBiometric:     'Biometric',
  drawerSlip:          'Slip',
  drawerAIFlags:       'AI Flags',
  drawerApprove:       'Approve',
  drawerReject:        'Reject',
  drawerSendEmail:     'Send Slip Email',
  drawerRejectNote:    'Rejection reason (required)',
  runCodePrefix:       'PAY',
  monthLabel:          (m) => new Date(2000, m - 1, 1).toLocaleString('en-US', { month: 'long' }),
}

// Payroll Run Management UI Copy
export const PAYROLL_RUN_COPY = {
  editTitle:       'Edit Payroll Run',
  editNote:        'Month and year can only be changed for draft runs.',
  errorNotDraft:   'Only draft runs can be edited. Completed runs are locked.',
  deleteTitle:     'Delete Payroll Run',
  deleteConfirm:   'This will permanently delete this payroll run and all associated salary slips.',
  deleteNote:      'Warning: This run is not in draft status. Deleting may affect historical records.',
  btnEdit:         'Save Changes',
  btnDelete:       'Confirm Delete',
  successEdit:     'Payroll run updated successfully.',
  successDelete:   'Payroll run deleted.',
  tooltipEdit:     'Edit run details',
  tooltipDelete:   'Delete run',
}

// ─────────────────────────────────────────────────────────────────────────────
// 16. PAYROLL DATA IMPORT — Sympa + ValueFrame + RADAI attendance merge
// ─────────────────────────────────────────────────────────────────────────────

// Source definitions — each entry drives both the upload card UI and backend routing
export const IMPORT_SOURCES = [
  {
    id:          'sympa',
    label:       'Sympa HR',
    abbr:        'SYM',
    color:       'bg-blue-50 border-blue-200',
    badge:       'bg-blue-100 text-blue-700 border-blue-200',
    icon:        'UserGroupIcon',
    iconColor:   'text-blue-600',
    accept:      '.xlsx,.xls,.csv',
    description: 'Employee master: names, IDs, departments, base salary, allowances, leave balance',
    hint:        'Sympa → HR module → Employee Report → Export XLSX / CSV',
  },
  {
    id:          'valueframe',
    label:       'ValueFrame',
    abbr:        'VF',
    color:       'bg-emerald-50 border-emerald-200',
    badge:       'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon:        'ClipboardDocumentListIcon',
    iconColor:   'text-emerald-600',
    accept:      '.xlsx,.xls,.csv',
    description: 'Project hours and cost allocations per employee per month',
    hint:        'ValueFrame → Projects → Hours by Employee → Export XLSX / CSV',
  },
]

// RADAI attendance source (auto-fetched — no upload needed)
export const IMPORT_RADAI_SOURCE = {
  id:        'radai',
  label:     'RADAI Attendance',
  abbr:      'RAD',
  badge:     'bg-violet-100 text-violet-700 border-violet-200',
  icon:      'ClockIcon',
  iconColor: 'text-violet-600',
  note:      'Biometric attendance data is fetched automatically from the RADAI database.',
}

// Soft-coded column aliases — backend uses these to detect columns regardless of header text
// First match in each list wins (all comparisons case-insensitive, trimmed)
export const IMPORT_FIELD_ALIASES_SYMPA = {
  employee_code:       ['employee no', 'employee id', 'emp no', 'emp id', 'personnel no', 'staff id', 'empno', 'id no', 'employee number'],
  employee_name:       ['name', 'full name', 'employee name', 'emp name', 'staff name', 'employee full name'],
  department:          ['department', 'dept', 'division', 'business unit', 'cost centre', 'cost center'],
  job_title:           ['job title', 'position', 'title', 'designation', 'role'],
  joining_date:        ['joining date', 'join date', 'hire date', 'date of joining', 'doj', 'start date', 'employment date', 'commencement date'],
  basic_salary:        ['basic salary', 'basic', 'base salary', 'monthly salary', 'salary', 'basic pay'],
  housing_allowance:   ['housing allowance', 'house allowance', 'hra', 'housing', 'home allowance', 'accommodation allowance'],
  transport_allowance: ['transport allowance', 'transport', 'ta', 'travel allowance', 'commute allowance', 'transportation'],
  other_allowances:    ['other allowances', 'misc allowances', 'miscellaneous', 'additional allowances'],
  other_pay:           ['other pay', 'other payment', 'extra pay', 'additional pay', 'other compensation', 'bonus pay', 'other emoluments'],
  deductions:          ['deductions', 'total deductions', 'deduction', 'monthly deduction', 'salary deduction'],
  deduction_details:   ['deduction details', 'deduction remarks', 'deduction notes', 'deduction breakdown', 'salary deduction details'],
  details:             ['details', 'notes', 'remarks', 'additional details', 'employee notes', 'comments'],
  leave_balance:       ['annual leave balance', 'leave balance', 'remaining leave', 'al balance', 'leave days remaining'],
}

export const IMPORT_FIELD_ALIASES_VALUEFRAME = {
  employee_code:  ['employee no', 'employee id', 'emp no', 'resource id', 'staff id', 'personnel no', 'resource code'],
  employee_name:  ['name', 'full name', 'employee name', 'resource', 'resource name'],
  project_code:   ['project code', 'project no', 'project', 'project id', 'proj code', 'project number'],
  project_name:   ['project name', 'proj name', 'project description', 'project title'],
  total_hours:    ['hours', 'total hours', 'billed hours', 'worked hours', 'billable hours', 'actual hours', 'logged hours'],
  overtime_hours: ['overtime hours', 'ot hours', 'extra hours', 'overtime', 'ot'],
  month:          ['month', 'period month', 'billing month', 'period'],
  year:           ['year', 'period year', 'billing year'],
}

// Master payroll preview table columns — matches the 15-column Excel output exactly
export const IMPORT_MASTER_COLUMNS = [
  { key: 'employee_code',      label: 'Emp Code',            mono: true  },
  { key: 'employee_name',      label: 'Employee Name'                     },
  { key: 'joining_date',       label: 'Joining Date'                      },
  { key: 'total_hours',        label: 'Working Hours',       numeric: true },
  { key: 'employee_salary',    label: 'Employee Salary',     numeric: true },
  { key: 'basic_salary',       label: 'Basic',               numeric: true },
  { key: 'total_allowances',   label: 'Allowance',           numeric: true },
  { key: 'transport_allowance',label: 'Transportation',      numeric: true },
  { key: 'housing_allowance',  label: 'Home Allowance',      numeric: true },
  { key: 'other_allowances',   label: 'Other Allowance',     numeric: true },
  { key: 'other_pay',          label: 'Other Pay',           numeric: true },
  { key: 'details',            label: 'Details'                           },
  { key: 'total_deductions',   label: 'Salary Deduction',    numeric: true },
  { key: 'deduction_details',  label: 'Deduction Details'                 },
  { key: 'final_salary',       label: 'Final Salary',        numeric: true, highlight: true },
]

// UI copy for the import modal
export const IMPORT_COPY = {
  btnOpen:          'Import Data Sources',
  modalTitle:       'Payroll Master File Generator',
  modalSubtitle:    'Upload Sympa and/or ValueFrame exports. RADAI attendance is merged automatically.',
  step1Title:       'Upload Source Files',
  step1Sub:         'Drag & drop or click to upload. Supports XLSX, XLS, and CSV.',
  step2Title:       'Master Payroll Preview',
  step2Sub:         rows => `${rows} employee rows extracted and merged from all active sources.`,
  generateBtn:      'Generate Master',
  generatingBtn:    'Extracting & merging…',
  downloadBtn:      'Download Excel',
  downloadingBtn:   'Preparing…',
  resetBtn:         'Upload New Files',
  cancelBtn:        'Cancel',
  radaiNote:        'RADAI attendance data will be merged automatically for the selected period.',
  noFiles:          'Upload at least one source file (Sympa or ValueFrame) to continue.',
  warningTitle:     'Merge Warnings',
  noWarnings:       'All rows merged cleanly.',
  statsLabel:       stats =>
    `Sympa: ${stats.sympa_rows ?? 0} rows  ·  ValueFrame: ${stats.vf_employees ?? 0} employees  ·  RADAI: ${stats.radai_rows ?? 0} records  ·  Merged: ${stats.matched ?? 0}`,
  errorParse:       'File parsing failed. Please check the format and try again.',
  errorGeneric:     'An error occurred. Please try again.',
  savedToDB:        'Data saved to RADAI database.',
  s3Queued:         'Excel upload to S3 queued — available in Import History shortly.',
}

// ─── Section 17: Master Payroll Import History ────────────────────────────────

// Columns for the Import History table
export const IMPORT_HISTORY_COLUMNS = [
  { key: 'period',            label: 'Period'                          },
  { key: 'generated_at',      label: 'Generated'                       },
  { key: 'generated_by',      label: 'By'                              },
  { key: 'total_rows',        label: 'Employees',   numeric: true      },
  { key: 'sympa_filename',    label: 'Sympa File'                      },
  { key: 'valueframe_filename', label: 'VF File'                       },
  { key: 'status',            label: 'S3 Status',   status: true       },
  { key: 'actions',           label: '',            actions: true      },
]

// Status badge styles for MasterPayrollImport.status
export const IMPORT_STATUS_STYLES = {
  processing: { label: 'Processing', cls: 'bg-amber-100 text-amber-700 border-amber-200'   },
  ready:      { label: 'Ready',      cls: 'bg-blue-100 text-blue-700 border-blue-200'      },
  uploaded:   { label: 'On S3',      cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  failed:     { label: 'Failed',     cls: 'bg-rose-100 text-rose-700 border-rose-200'      },
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYROLL WORKFLOW & APPROVAL TRACKER
// ─────────────────────────────────────────────────────────────────────────────

// Workflow stages for payroll approval tracker — controls stepper UI and timeline
export const PAYROLL_WORKFLOW_STAGES = [
  {
    key:          'draft',
    label:        'Draft',
    icon:         'DocumentTextIcon',
    role:         'Payroll Clerk',
    activeBg:     'bg-slate-100',
    activeBorder: 'border-slate-200',
    activeText:   'text-slate-700',
    doneBg:       'bg-emerald-50',
    doneBorder:   'border-emerald-200',
    doneText:     'text-emerald-700',
  },
  {
    key:          'hr_review',
    label:        'HR Review',
    icon:         'UserGroupIcon',
    role:         'HR',
    activeBg:     'bg-blue-100',
    activeBorder: 'border-blue-200',
    activeText:   'text-blue-700',
    doneBg:       'bg-emerald-50',
    doneBorder:   'border-emerald-200',
    doneText:     'text-emerald-700',
  },
  {
    key:          'manager_approval',
    label:        'Manager Approval',
    icon:         'ShieldCheckIcon',
    role:         'Department Manager',
    activeBg:     'bg-amber-100',
    activeBorder: 'border-amber-200',
    activeText:   'text-amber-700',
    doneBg:       'bg-emerald-50',
    doneBorder:   'border-emerald-200',
    doneText:     'text-emerald-700',
  },
  {
    key:          'finance_approval',
    label:        'Finance Approval',
    icon:         'BanknotesIcon',
    role:         'Finance',
    activeBg:     'bg-purple-100',
    activeBorder: 'border-purple-200',
    activeText:   'text-purple-700',
    doneBg:       'bg-emerald-50',
    doneBorder:   'border-emerald-200',
    doneText:     'text-emerald-700',
  },
  {
    key:          'approved',
    label:        'Approved',
    icon:         'CheckCircleIcon',
    role:         'System',
    activeBg:     'bg-emerald-100',
    activeBorder: 'border-emerald-200',
    activeText:   'text-emerald-700',
    doneBg:       'bg-emerald-50',
    doneBorder:   'border-emerald-200',
    doneText:     'text-emerald-700',
  },
  {
    key:          'sent',
    label:        'Sent',
    icon:         'PaperAirplaneIcon',
    role:         'System',
    activeBg:     'bg-indigo-100',
    activeBorder: 'border-indigo-200',
    activeText:   'text-indigo-700',
    doneBg:       'bg-emerald-50',
    doneBorder:   'border-emerald-200',
    doneText:     'text-emerald-700',
  },
]

// Approval tracker configuration
export const PAYROLL_TRACKER_CONFIG = {
  // Auto-refresh interval in milliseconds (30 seconds)
  pollIntervalMs: 30000,
  // SLA thresholds (days) for warning/overdue badges
  slaWarningDays: 2,
  slaOverdueDays: 3,
}

export const IMPORT_HISTORY_COPY = {
  title:        'Import History',
  subtitle:     'Past Sympa + ValueFrame master payroll generations.',
  empty:        'No imports yet. Generate a master payroll file to get started.',
  downloadBtn:  'Download Excel',
  refreshBtn:   'Refresh',
  loadingMsg:   'Loading history…',
  errorMsg:     'Failed to load history.',
}
