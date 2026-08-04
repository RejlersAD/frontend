/**
 * Payroll Intelligence — Executive Dashboard
 * Shows KPI tiles, payroll runs table, and trend charts.
 * Every KPI tile is clickable — opens a live drill-down report modal.
 */
import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import * as HeroIcons from '@heroicons/react/24/outline'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import payrollService from '../../../services/payroll.service'
import payrollEngineService from '../../../services/payrollEngine.service'
import timesheetSvc from '../../../services/timesheet.service'
import {
  PAYROLL_KPIS, ATT_KPIS, PAYROLL_RUN_COLUMNS, PAYROLL_COPY,
  PAYROLL_KPI_REPORTS, PAYROLL_SLIP_STATUS, PAYROLL_ALERT_SEVERITY,
  PAYROLL_RUN_COPY, PAYROLL_RUN_MONTHS,
  PAYROLL_WORKFLOW_STAGES,
  runStatusMeta, fmtCurrency,
} from '../../../config/hrPayroll.config'

// ── Month names for display ───────────────────────────────────────────────
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const Spinner = () => (
  <svg className="animate-spin w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
  </svg>
)

const PIE_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4']

// ─────────────────────────────────────────────────────────────────────────────
// Approval Pipeline Widget — compact summary embedded in the main dashboard.
// Only rendered for admins / super-admins (gated by isSuperAdmin prop).
// Full tracker is on the "Approval Tracker" tab; this is a heads-up widget.
// ─────────────────────────────────────────────────────────────────────────────
const PIPELINE_STAGE_KPIS = [
  { key: 'draft',            label: 'Draft',          cls: 'bg-slate-100  text-slate-700  border-slate-200'  },
  { key: 'frozen',           label: 'Frozen',         cls: 'bg-blue-100   text-blue-700   border-blue-200'   },
  { key: 'hr_approved',      label: 'HR Approved',    cls: 'bg-violet-100 text-violet-700 border-violet-200' },
  { key: 'finance_review',   label: 'In Finance',     cls: 'bg-amber-100  text-amber-700  border-amber-200'  },
  { key: 'finance_approved', label: 'Fin. Approved',  cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { key: 'released',         label: 'Released',       cls: 'bg-green-100  text-green-700  border-green-200'  },
]

function ApprovalPipelineWidget({ data, onViewAll }) {
  const { summary = {}, results = [] } = data

  // Show up to 5 active (non-released) files sorted most-critical first
  const active = [...results]
    .filter(r => r.workflow_stage !== 'released')
    .sort((a, b) => {
      const rank = { overdue: 0, warning: 1, ok: 2 }
      return (rank[a.current_sla_status] ?? 2) - (rank[b.current_sla_status] ?? 2)
    })
    .slice(0, 5)

  const overdueCount = summary.overdue_count ?? 0
  const warningCount = summary.warning_count ?? 0

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
            <HeroIcons.ClipboardDocumentListIcon className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Approval Pipeline</h3>
            <p className="text-[10px] text-slate-400">{summary.total ?? 0} master payroll file{(summary.total ?? 0) !== 1 ? 's' : ''}</p>
          </div>
          {overdueCount > 0 && (
            <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700 border border-rose-200">
              <HeroIcons.ExclamationCircleIcon className="w-3.5 h-3.5" />
              {overdueCount} overdue
            </span>
          )}
          {warningCount > 0 && overdueCount === 0 && (
            <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
              <HeroIcons.ExclamationTriangleIcon className="w-3.5 h-3.5" />
              {warningCount} at risk
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors"
        >
          Full Tracker
          <HeroIcons.ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Stage KPI mini-bar */}
      <div className="grid grid-cols-6 gap-2 mb-4">
        {PIPELINE_STAGE_KPIS.map(({ key, label, cls }) => (
          <div key={key} className={`rounded-lg border px-2 py-2 text-center ${cls}`}>
            <div className="text-lg font-bold leading-tight">{summary.by_stage?.[key] ?? 0}</div>
            <div className="text-[10px] font-medium opacity-70 leading-tight mt-0.5 truncate">{label}</div>
          </div>
        ))}
      </div>

      {/* Active files — sorted most-critical first */}
      {active.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Active Files</p>
          {active.map(row => {
            const stageDef = PAYROLL_WORKFLOW_STAGES.find(s => s.key === row.workflow_stage)
            const Icon     = stageDef ? (HeroIcons[stageDef.icon] || HeroIcons.DocumentTextIcon) : HeroIcons.DocumentTextIcon
            const isOverdue = row.current_sla_status === 'overdue'
            const isWarning = row.current_sla_status === 'warning'

            return (
              <div
                key={row.id}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                  isOverdue ? 'bg-rose-50/60 border-rose-200'
                  : isWarning ? 'bg-amber-50/60 border-amber-200'
                  : 'bg-slate-50 border-slate-100'
                }`}
              >
                {/* Left: icon + period */}
                <div className="flex items-center gap-2.5 min-w-0">
                  {stageDef && (
                    <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center ${stageDef.activeBg} border ${stageDef.activeBorder}`}>
                      <Icon className={`w-3 h-3 ${stageDef.activeText}`} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-700 leading-tight">{row.period}</p>
                    <p className="text-[10px] text-slate-400">{row.total_rows} employees</p>
                  </div>
                </div>

                {/* Right: stage chip + days + pending role */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {stageDef && (
                    <span className={`hidden sm:inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full border ${stageDef.activeBg} ${stageDef.activeText} ${stageDef.activeBorder}`}>
                      {stageDef.label}
                    </span>
                  )}
                  {row.days_in_current_stage != null && (
                    <span className={`text-[10px] font-medium ${
                      isOverdue ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-slate-400'
                    }`}>
                      {row.days_in_current_stage}d
                      {row.current_sla_days ? `/${row.current_sla_days}d` : ''}
                    </span>
                  )}
                  {row.pending_role && (
                    <span className="hidden md:inline-flex items-center gap-0.5 text-[10px] text-slate-400">
                      <HeroIcons.UserIcon className="w-3 h-3" />
                      {row.pending_role}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : summary.total > 0 ? (
        <p className="text-xs text-emerald-600 text-center py-3 flex items-center justify-center gap-1.5">
          <HeroIcons.CheckCircleIcon className="w-4 h-4" />
          All payroll files have been released.
        </p>
      ) : (
        <p className="text-xs text-slate-400 text-center py-4">No master payroll files yet.</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Report fetchers — one per KPI id.  Runs only when the modal opens.
// ─────────────────────────────────────────────────────────────────────────────
const NOW = new Date()
const CY  = NOW.getFullYear()
const CM  = NOW.getMonth() + 1

// The Gross/Net/Pending/YTD KPI tiles are computed from the Payroll Engine
// (apps.payroll_engine — where payroll runs are actually generated), so
// their drill-down reports must read from the same engine models, not the
// legacy apps.finance salary-slip endpoints (always empty in this deployment).
// These helpers normalise the engine's Payslip/PayrollRun shape into the
// field names the existing report columns already expect (see
// PAYROLL_KPI_REPORTS in hrPayroll.config.js) so no column/UI changes are needed.
const normalisePayslip = (p) => ({
  ...p,
  slip_number:      p.employee_no || p.id,
  employee_name:    p.snapshot_full_name,
  month:            CM,
  year:             CY,
  basic_salary:     p.basic,
  total_allowances: [p.housing, p.transport, p.home_leave, p.other_earnings]
    .reduce((sum, v) => sum + (parseFloat(v) || 0), 0),
  gross_salary:     p.gross_earnings,
  net_salary:       p.net_payable,
})

const normaliseRun = (r) => ({
  ...r,
  run_code:           r.cycle_code,
  total_employees:    r.employee_count,
  total_gross_salary: r.total_gross,
  total_net_salary:   r.total_net,
})

// EmployeeLeaveRecord API rows expose total_earned/total_taken/leave_balance;
// the leave-record report columns expect days_earned/days_taken/balance.
const normaliseLeaveRecord = (r) => ({
  ...r,
  days_earned: r.total_earned,
  days_taken:  r.total_taken,
  balance:     r.leave_balance,
})

// Current-month PayrollRun — shared by Gross/Net/Pending drill-downs so none
// of them accidentally span multiple runs (each run has its own full set of
// employee payslips, so mixing runs together duplicates every employee).
const fetchCurrentMonthRun = async () => {
  const runResp = await payrollEngineService.listRuns({ year: CY, month: CM, page_size: 1 })
  return (runResp?.results ?? (Array.isArray(runResp) ? runResp : []))[0] ?? null
}

const fetchCurrentMonthPayslips = async (extraParams = {}) => {
  const run = await fetchCurrentMonthRun()
  if (!run) return { results: [] }
  const data = await payrollEngineService.listPayslips({ run: run.id, page_size: 500, ...extraParams })
  const rows = data?.results ?? (Array.isArray(data) ? data : [])
  return { results: rows.map(normalisePayslip) }
}

const REPORT_FETCHERS = {
  employees: () => payrollEngineService.listEmployees({ page_size: 500, is_active: 'true' }),
  gross:            () => fetchCurrentMonthPayslips(),
  net:              () => fetchCurrentMonthPayslips(),
  pending:          () => fetchCurrentMonthPayslips({ status: 'draft' }),
  ytd: async () => {
    const data = await payrollEngineService.listRuns({ year: CY, page_size: 50 })
    const rows = data?.results ?? (Array.isArray(data) ? data : [])
    return { results: rows.map(normaliseRun) }
  },
  // Merges PayrollAuditAlert (status=open) + PayrollValidationLog (is_resolved=false)
  // into a single normalised list so the drill-down matches the KPI tile count.
  alerts: async () => {
    const [auditResult, validResult] = await Promise.allSettled([
      payrollService.getAuditAlerts({ status: 'open', page_size: 500 }),
      payrollService.getValidationLogs({ is_resolved: 'false', page_size: 500 }),
    ])
    const toArr = (r) =>
      r.status === 'fulfilled'
        ? (r.value?.results ?? (Array.isArray(r.value) ? r.value : []))
        : []
    const auditRows = toArr(auditResult).map((r) => ({
      ...r,
      _source:     'Audit Alert',
      alert_type:  r.alert_type_display || r.alert_type || '—',
      description: r.root_cause || r.suggested_action || '',
    }))
    const validRows = toArr(validResult).map((r) => ({
      ...r,
      _source:     'Validation',
      alert_type:  r.rule_label || r.rule_id || '—',
      description: r.description || r.suggested_action || '',
    }))
    return { results: [...auditRows, ...validRows] }
  },
  // The leave-records API returns total_earned/total_taken/leave_balance,
  // but these report columns (and extractRows' own sort/filter below) read
  // them under different aliases (days_earned, days_taken, balance,
  // remaining_balance) — alias them here so the existing columns work
  // without touching the shared report config.
  leave_employees: async () => {
    const data = await payrollService.getLeaveRecords({ page_size: 500 })
    const rows = data?.results ?? (Array.isArray(data) ? data : [])
    return { results: rows.map(normaliseLeaveRecord) }
  },
  // The API returns the computed day count as `days_requested`, but the
  // report column reads `total_days`/`duration_days` — alias it here so the
  // existing column keeps working without touching the shared report config.
  leave_taken_ytd: async () => {
    const data = await payrollService.getLeaveRequests({ status: 'APPROVED', page_size: 500 })
    const rows = data?.results ?? (Array.isArray(data) ? data : [])
    return { results: rows.map((r) => ({ ...r, total_days: r.days_requested })) }
  },
  leave_earned_ytd: async () => {
    const data = await payrollService.getLeaveRecords({ page_size: 500 })
    const rows = data?.results ?? (Array.isArray(data) ? data : [])
    return { results: rows.map(normaliseLeaveRecord) }
  },
  leave_avg_balance: async () => {
    const data = await payrollService.getLeaveRecords({ page_size: 500 })
    const rows = data?.results ?? (Array.isArray(data) ? data : [])
    return { results: rows.map(normaliseLeaveRecord) }
  },
  leave_critical: async () => {
    const data = await payrollService.getLeaveRecords({ page_size: 500 })
    const rows = data?.results ?? (Array.isArray(data) ? data : [])
    return { results: rows.map(normaliseLeaveRecord) }
  },
}

// Post-process raw API response → array of report rows
const extractRows = (id, data) => {
  const base = data?.results ?? (Array.isArray(data) ? data : [])
  if (id === 'net')
    return [...base].sort((a, b) => parseFloat(b.net_salary || 0) - parseFloat(a.net_salary || 0))
  if (id === 'leave_avg_balance')
    return [...base].sort((a, b) => parseFloat(a.balance ?? 0) - parseFloat(b.balance ?? 0))
  if (id === 'leave_critical')
    return base.filter((r) => parseFloat(r.balance ?? r.remaining_balance ?? 0) <= 0)
  return base
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI drill-down report modal
// ─────────────────────────────────────────────────────────────────────────────
function KpiReportModal({ reportId, onClose }) {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const config = PAYROLL_KPI_REPORTS[reportId]

  // Escape key to close
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  // Fetch report data on mount
  useEffect(() => {
    const fetcher = REPORT_FETCHERS[reportId]
    if (!fetcher) { setLoading(false); return }
    setLoading(true)
    fetcher()
      .then((data) => setRows(extractRows(reportId, data)))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [reportId])

  if (!config) return null

  const filtered = search.trim()
    ? rows.filter((r) => config.searchFn(r).includes(search.toLowerCase()))
    : rows

  const renderCell = (col, row) => {
    const val = col.render(row)
    if (col.slipStatusBadge) {
      const meta = PAYROLL_SLIP_STATUS[String(val).toLowerCase()] ?? { tone: 'bg-slate-100 text-slate-600 border-slate-200', label: val }
      return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${meta.tone}`}>{meta.label ?? val}</span>
    }
    if (col.runStatusBadge) {
      const meta = runStatusMeta(String(val))
      return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${meta.tone}`}>{meta.label}</span>
    }
    if (col.severityBadge) {
      const s = PAYROLL_ALERT_SEVERITY[String(val).toLowerCase()] ?? { tone: 'bg-slate-100 text-slate-600', label: val }
      return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${s.tone}`}>{s.label}</span>
    }
    if (col.leaveStatusBadge) {
      const LEAVE_STYLES = {
        APPROVED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        PENDING:  'bg-amber-100   text-amber-700   border-amber-200',
        REJECTED: 'bg-rose-100    text-rose-700    border-rose-200',
        CANCELLED:'bg-slate-100   text-slate-500   border-slate-200',
      }
      const style = LEAVE_STYLES[String(val).toUpperCase()] ?? 'bg-slate-100 text-slate-600 border-slate-200'
      return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${style}`}>{val}</span>
    }
    if (col.balanceBadge) {
      const n = parseFloat(val) || 0
      const style = n <= 0
        ? 'bg-rose-100 text-rose-700 border-rose-200'
        : n < 5
          ? 'bg-amber-100 text-amber-700 border-amber-200'
          : 'bg-emerald-100 text-emerald-700 border-emerald-200'
      return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${style}`}>{val}</span>
    }
    if (col.mono) return <span className="font-mono text-xs text-slate-500">{val}</span>
    return val
  }

  const HeaderIcon = HeroIcons[config.icon] ?? HeroIcons.ChartBarIcon

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 bg-black/50 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl my-auto">
        {/* Gradient header */}
        <div className={`bg-gradient-to-r ${config.accentGradient} rounded-t-2xl p-5 text-white`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <HeaderIcon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{config.title}</h2>
                <p className="text-sm text-white/80 mt-0.5 max-w-xl">{config.description}</p>
              </div>
            </div>
            <button type="button" onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center flex-shrink-0 transition-colors"
              title="Close (Esc)">
              <HeroIcons.XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          {!loading && (
            <div className="mt-3 text-sm text-white/90 flex items-center gap-1.5">
              <HeroIcons.TableCellsIcon className="w-4 h-4 opacity-80" />
              <strong>{rows.length}</strong> total records
              {search.trim() && <> · <strong>{filtered.length}</strong> matching filter</>}
            </div>
          )}
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 bg-slate-50/60">
          <div className="relative flex-1">
            <HeroIcons.MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input type="text" placeholder="Search by name, code, type…"
              value={search} onChange={(e) => setSearch(e.target.value)} autoFocus
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
            {search && (
              <button type="button" onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <HeroIcons.XMarkIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button type="button" onClick={onClose}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors whitespace-nowrap">
            ← Close Report
          </button>
        </div>

        {/* Data table */}
        <div className="overflow-x-auto" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-500 text-sm">
              <Spinner /> Loading report data…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-slate-500 italic py-14 text-center">
              {search.trim() ? 'No records match your search.' : config.emptyMsg}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white border-b border-slate-200 shadow-sm z-10">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide w-10">#</th>
                  {config.columns.map((col) => (
                    <th key={col.key} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((row, idx) => (
                  <tr key={row.id ?? idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-slate-400 font-mono">{idx + 1}</td>
                    {config.columns.map((col) => (
                      <td key={col.key} className="px-4 py-2.5 text-slate-800 max-w-xs truncate">
                        {renderCell(col, row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 rounded-b-2xl bg-slate-50/40 flex items-center justify-between text-xs text-slate-400">
          <span>Payroll Intelligence Platform — live data</span>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800 font-medium transition-colors">Close ✕</button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI tile — now a clickable button that opens the drill-down modal
// ─────────────────────────────────────────────────────────────────────────────
function KpiTile({ kpi, summary, onClick }) {
  const Icon = HeroIcons[kpi.icon] || HeroIcons.ChartBarIcon
  const val = kpi.compute(summary)
  const isSalaryTile = ['gross', 'net', 'ytd'].includes(kpi.id)
  const isZeroSalary = isSalaryTile && (parseFloat(summary?.[
    kpi.id === 'gross' ? 'current_month_gross' :
    kpi.id === 'net'   ? 'current_month_net'   : 'ytd_payroll'
  ] ?? 0) === 0)
  const noRuns = !summary?.latest_run?.id

  return (
    <button
      type="button"
      onClick={onClick}
      title={`Click to view ${kpi.label} report`}
      className={`rounded-xl border p-4 ${kpi.tone} border-current/10 relative text-left w-full hover:shadow-md hover:scale-[1.02] active:scale-[0.99] transition-all cursor-pointer group`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 opacity-70" />
        <span className="text-xs font-semibold uppercase tracking-wider opacity-70">{kpi.label}</span>
      </div>
      <div className="text-xl font-bold leading-tight">{val}{kpi.suffix}</div>
      {kpi.sub && summary && (
        <div className="text-[10px] opacity-60 mt-0.5 font-normal">{kpi.sub(summary)}</div>
      )}
      {isSalaryTile && isZeroSalary && noRuns && (
        <div className="text-[10px] opacity-60 mt-1 font-normal">No payroll runs yet</div>
      )}
      <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-60 transition-opacity text-[10px] uppercase tracking-widest">
        View →
      </div>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Leave intelligence tile — clickable button
// ─────────────────────────────────────────────────────────────────────────────
function LeaveTile({ icon, label, value, sub, bg, border, textColor, subColor, onClick }) {
  const Icon = HeroIcons[icon] ?? HeroIcons.CalendarDaysIcon
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Click to view ${label} report`}
      className={`${bg} rounded-lg p-3 border ${border} text-left w-full hover:shadow-md hover:scale-[1.02] active:scale-[0.99] transition-all cursor-pointer group relative`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3.5 h-3.5 ${textColor}`} />
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${textColor}`}>{label}</span>
      </div>
      <div className={`text-2xl font-bold ${textColor}`}>{value}</div>
      <div className={`text-[10px] mt-0.5 ${subColor}`}>{sub}</div>
      <div className={`absolute bottom-1.5 right-2 opacity-0 group-hover:opacity-50 transition-opacity text-[9px] uppercase tracking-widest ${textColor}`}>
        View →
      </div>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit Payroll Run modal
// ─────────────────────────────────────────────────────────────────────────────
function RunEditModal({ run, onClose, onSaved }) {
  const [form, setForm] = useState({
    run_code:     run.run_code     || '',
    month:        run.month        || 1,
    year:         run.year         || new Date().getFullYear(),
    period_start: run.period_start || '',
    period_end:   run.period_end   || '',
  })
  const [busy, setBusy] = useState(false)
  const [msg,  setMsg]  = useState('')

  const isDraft = run.status === 'draft'

  // Close on Escape
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const handleSave = async () => {
    if (!form.run_code?.trim()) { setMsg('Error: Run Code is required.'); return }
    setBusy(true)
    setMsg('')
    try {
      const payload = {
        run_code:     form.run_code,
        month:        form.month,
        year:         form.year,
        ...(form.period_start ? { period_start: form.period_start } : {}),
        ...(form.period_end   ? { period_end:   form.period_end   } : {}),
      }
      await payrollService.updatePayrollRun(run.id, payload)
      setMsg(PAYROLL_RUN_COPY.successEdit)
      setTimeout(onSaved, 800)
    } catch (e) {
      const detail = e?.response?.data
      const errMsg = typeof detail === 'object'
        ? Object.entries(detail).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ')
        : (detail || e?.message || 'Update failed')
      setMsg('Error: ' + errMsg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <HeroIcons.PencilSquareIcon className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-semibold text-slate-800">{PAYROLL_RUN_COPY.editTitle}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <HeroIcons.XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {!isDraft && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm">
              <HeroIcons.ExclamationTriangleIcon className="w-4 h-4 shrink-0" />
              {PAYROLL_RUN_COPY.errorNotDraft}
            </div>
          )}
          {msg && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm border ${
              msg.startsWith('Error')
                ? 'bg-rose-50 border-rose-200 text-rose-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}>
              {msg.startsWith('Error')
                ? <HeroIcons.ExclamationCircleIcon className="w-4 h-4 shrink-0" />
                : <HeroIcons.CheckCircleIcon className="w-4 h-4 shrink-0" />
              }
              {msg}
            </div>
          )}

          {/* Run Code */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Run Code</label>
            <input
              type="text"
              value={form.run_code}
              onChange={e => setForm(f => ({ ...f, run_code: e.target.value }))}
              disabled={!isDraft}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-slate-50"
            />
          </div>

          {/* Month + Year */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Month</label>
              <select
                value={form.month}
                onChange={e => setForm(f => ({ ...f, month: parseInt(e.target.value, 10) }))}
                disabled={!isDraft}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-slate-50"
              >
                {PAYROLL_RUN_MONTHS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Year</label>
              <input
                type="number"
                value={form.year}
                onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value, 10) }))}
                disabled={!isDraft}
                min={2020} max={2099} step={1}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-slate-50"
              />
            </div>
          </div>

          {/* Period Start + End */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Period Start</label>
              <input
                type="date"
                value={form.period_start}
                onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))}
                disabled={!isDraft}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Period End</label>
              <input
                type="date"
                value={form.period_end}
                onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))}
                disabled={!isDraft}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-slate-50"
              />
            </div>
          </div>

          <p className="text-xs text-slate-400">{PAYROLL_RUN_COPY.editNote}</p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={busy}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 rounded-lg transition flex items-center gap-1.5"
          >
            {busy ? <Spinner /> : <HeroIcons.CheckIcon className="w-4 h-4" />}
            {PAYROLL_RUN_COPY.btnEdit}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete Payroll Run confirmation modal
// ─────────────────────────────────────────────────────────────────────────────
function DeleteConfirmModal({ run, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false)
  const [msg,  setMsg]  = useState('')

  const isDraft = run.status === 'draft'

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const handleDelete = async () => {
    setBusy(true)
    try {
      await payrollService.deletePayrollRun(run.id)
      setMsg(PAYROLL_RUN_COPY.successDelete)
      setTimeout(onDeleted, 600)
    } catch (e) {
      setMsg('Error: ' + (e?.response?.data?.detail || e?.message || 'Delete failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md">
        <div className="p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4">
            <HeroIcons.TrashIcon className="w-7 h-7 text-rose-600" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 mb-2">{PAYROLL_RUN_COPY.deleteTitle}</h3>
          <p className="text-sm text-slate-500">{PAYROLL_RUN_COPY.deleteConfirm}</p>
          <p className="text-xs text-slate-400 mt-2">
            Run: <strong className="text-slate-700">{run.run_code}</strong>
            {' · '}{String(run.month).padStart(2, '0')}/{run.year}
          </p>
          {!isDraft && (
            <p className="text-xs text-amber-600 mt-2 font-medium">{PAYROLL_RUN_COPY.deleteNote}</p>
          )}
          {msg && (
            <p className={`text-xs mt-3 font-medium ${msg.startsWith('Error') ? 'text-rose-600' : 'text-emerald-600'}`}>
              {msg}
            </p>
          )}
        </div>
        <div className="px-6 pb-6 flex justify-center gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={busy}
            className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 rounded-lg transition flex items-center gap-1.5"
          >
            {busy ? <Spinner /> : <HeroIcons.TrashIcon className="w-4 h-4" />}
            {PAYROLL_RUN_COPY.btnDelete}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PayrollDashboard({ onSelectRun, onSwitchTab }) {
  const [summary,      setSummary]      = useState(null)
  const [runs,         setRuns]         = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [processing,   setProcessing]   = useState(null)
  const [reportId,     setReportId]     = useState(null)
  const [editRun,      setEditRun]      = useState(null)
  const [deleteRun,    setDeleteRun]    = useState(null)
  const [attStats,     setAttStats]     = useState(null)
  const [trackerData,  setTrackerData]  = useState(null)   // approval pipeline widget

  // Role — used to gate the Approval Pipeline widget
  const rbacUser    = useSelector(s => s.rbac?.currentUser)
  const authUser    = useSelector(s => s.auth?.user)
  const isSuperAdmin = (
    authUser?.is_superuser ||
    rbacUser?.roles?.some(r => r.code === 'superadmin' || r.code === 'admin')
  ) ?? false

  useEffect(() => {
    setLoading(true)
    Promise.all([
      payrollService.getDashboardSummary().catch(() => null),
      payrollService.getPayrollRuns({ page_size: 12 }).catch(() => ({ results: [] })),
    ]).then(async ([s, r]) => {
      // The backend summary counts draft payslips across every PayrollRun
      // (all months), but the Pending Approvals modal only ever shows the
      // current month's run — recompute the card's count the same way so
      // both agree.
      if (s) {
        const run = await fetchCurrentMonthRun().catch(() => null)
        if (run) {
          const pendingResp = await payrollEngineService
            .listPayslips({ run: run.id, status: 'draft', page_size: 1 })
            .catch(() => null)
          s.pending_approvals = pendingResp?.count ?? s.pending_approvals
        } else {
          s.pending_approvals = 0
        }
      }
      setSummary(s)
      setRuns(r?.results ?? r ?? [])
    }).catch((e) => setError(e.message)).finally(() => setLoading(false))

    // Attendance stats — non-blocking, biometric data is optional
    const now = new Date()
    timesheetSvc.fetchMonthly(now.getFullYear(), now.getMonth() + 1)
      .then((res) => {
        const rows = res?.rows ?? []
        if (!rows.length) return
        const totalEmployees = rows.length
        const presentCount   = rows.filter((r) => (r.days_present ?? 0) > 0).length
        const totalHours     = rows.reduce((s, r) => s + (r.total_hours ?? 0), 0)
        const avgHoursPerDay = totalEmployees
          ? rows.reduce((s, r) => s + (r.avg_hours_per_day ?? 0), 0) / totalEmployees
          : 0
        setAttStats({
          presentCount,
          totalEmployees,
          attendanceRateMtd: totalEmployees ? (presentCount / totalEmployees) * 100 : 0,
          avgHoursPerDay,
          totalHours,
        })
      })
      .catch(() => {}) // biometric tile degrades gracefully
  }, [])

  // Approval tracker — loaded separately; only for super-admins
  useEffect(() => {
    if (!isSuperAdmin) return
    payrollService.getApprovalTracker().catch(() => null).then(d => {
      if (d) setTrackerData(d)
    })
  }, [isSuperAdmin])

  // Build trend data from runs list
  const trendData = [...runs].reverse().slice(0, 6).map((r) => ({
    period: `${String(r.month).padStart(2,'0')}/${String(r.year).slice(-2)}`,
    gross:  parseFloat(r.total_gross_salary) || 0,
    net:    parseFloat(r.total_net_salary)   || 0,
  }))

  const reloadRuns = async () => {
    const r = await payrollService.getPayrollRuns({ page_size: 12 }).catch(() => ({ results: [] }))
    setRuns(r?.results ?? r ?? [])
  }

  const handleProcess = async (runId) => {
    setProcessing(runId)
    try {
      await payrollService.processPayrollRun(runId)
      await reloadRuns()
    } finally {
      setProcessing(null)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Spinner />
      <span className="ml-3 text-slate-500 text-sm">Loading payroll data…</span>
    </div>
  )

  if (error) return (
    <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-700 text-sm">{error}</div>
  )

  return (
    <div className="space-y-6">
      {/* KPI Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {PAYROLL_KPIS.map((kpi) => (
          <KpiTile key={kpi.id} kpi={kpi} summary={summary} onClick={() => setReportId(kpi.id)} />
        ))}
      </div>

      {/* Attendance KPI Tiles — live biometric data (non-clickable, gracefully hidden if unavailable) */}
      {attStats && (
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 uppercase tracking-wider">
            <HeroIcons.SignalIcon className="w-3.5 h-3.5" />
            Biometric Attendance
          </div>
          {ATT_KPIS.map((kpi) => {
            const Icon = HeroIcons[kpi.icon] || HeroIcons.ClockIcon
            return (
              <div
                key={kpi.id}
                className={`rounded-xl border p-4 ${kpi.tone} border-current/10 min-w-[160px] flex-1 max-w-xs`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-4 h-4 opacity-70" />
                  <span className="text-xs font-semibold uppercase tracking-wider opacity-70">{kpi.label}</span>
                </div>
                <div className="text-xl font-bold leading-tight">{kpi.compute(attStats)}</div>
                <div className="text-[10px] opacity-60 mt-0.5">{kpi.sub(attStats)}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Leave Intelligence Panel — always shown when summary is loaded */}
      {summary && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <HeroIcons.CalendarDaysIcon className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-slate-700">
              Leave Intelligence — {summary.current_year}
            </h3>
            <span className="ml-auto text-xs text-slate-400">
              {MONTH_NAMES[(summary.current_month ?? new Date().getMonth() + 1) - 1]} {summary.current_year ?? new Date().getFullYear()}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
            {/* Employees tracked */}
            <LeaveTile
              icon="UsersIcon" label="Employees Tracked"
              value={summary.leave_employees} sub="active this year"
              bg="bg-indigo-50" border="border-indigo-100" textColor="text-indigo-700" subColor="text-indigo-500"
              onClick={() => setReportId('leave_employees')}
            />
            {/* Leave taken YTD */}
            <LeaveTile
              icon="ArrowTrendingDownIcon" label="Leave Taken YTD"
              value={parseFloat(summary.leave_total_taken_ytd ?? 0).toFixed(1)} sub="days"
              bg="bg-amber-50" border="border-amber-100" textColor="text-amber-700" subColor="text-amber-500"
              onClick={() => setReportId('leave_taken_ytd')}
            />
            {/* Leave earned YTD */}
            <LeaveTile
              icon="ArrowTrendingUpIcon" label="Leave Earned YTD"
              value={parseFloat(summary.leave_total_earned_ytd ?? 0).toFixed(1)} sub="days"
              bg="bg-emerald-50" border="border-emerald-100" textColor="text-emerald-700" subColor="text-emerald-500"
              onClick={() => setReportId('leave_earned_ytd')}
            />
            {/* Avg balance */}
            <LeaveTile
              icon="ScaleIcon" label="Avg Leave Balance"
              value={parseFloat(summary.leave_avg_balance ?? 0).toFixed(1)} sub="days / employee"
              bg="bg-teal-50" border="border-teal-100" textColor="text-teal-700" subColor="text-teal-500"
              onClick={() => setReportId('leave_avg_balance')}
            />
            {/* Critical alerts */}
            <LeaveTile
              icon="ExclamationTriangleIcon" label="Critical Balance"
              value={summary.leave_critical_alerts ?? 0} sub="employees at ≤ 0 days"
              bg={(summary.leave_critical_alerts ?? 0) > 0 ? 'bg-rose-50' : 'bg-slate-50'}
              border={(summary.leave_critical_alerts ?? 0) > 0 ? 'border-rose-100' : 'border-slate-100'}
              textColor={(summary.leave_critical_alerts ?? 0) > 0 ? 'text-rose-700' : 'text-slate-400'}
              subColor={(summary.leave_critical_alerts ?? 0) > 0 ? 'text-rose-500' : 'text-slate-400'}
              onClick={() => setReportId('leave_critical')}
            />
          </div>
          {/* On leave this month sub-line */}
          {parseFloat(summary.leave_current_month_taken ?? 0) > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
              <HeroIcons.CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
              <span>
                <strong className="text-slate-700">
                  {parseFloat(summary.leave_current_month_taken).toFixed(1)} days
                </strong>{' '}
                taken in {MONTH_NAMES[(summary.current_month ?? 1) - 1]} across{' '}
                <strong className="text-slate-700">{summary.leave_employees_taken}</strong> employees YTD
              </span>
            </div>
          )}
        </div>
      )}

      {/* Approval Pipeline Widget — super-admin only, non-blocking */}
      {isSuperAdmin && trackerData && (
        <ApprovalPipelineWidget
          data={trackerData}
          onViewAll={() => onSwitchTab?.('tracker')}
        />
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar chart — payroll trend */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Monthly Payroll Trend (last 6 months)</h3>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trendData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => fmtCurrency(v)} />
                <Bar dataKey="gross" name="Gross" fill="#3b82f6" radius={[3,3,0,0]} />
                <Bar dataKey="net"   name="Net"   fill="#10b981" radius={[3,3,0,0]} />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No run data yet</div>
          )}
        </div>

        {/* Pie — run status distribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Run Status Distribution</h3>
          {runs.length > 0 ? (() => {
            const statusCounts = runs.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc }, {})
            const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name: runStatusMeta(name).label, value }))
            return (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )
          })() : (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No runs yet</div>
          )}
        </div>
      </div>

      {/* Payroll Runs Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Payroll Runs</h3>
          <span className="text-xs text-slate-500">{runs.length} runs</span>
        </div>
        {runs.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">
            <HeroIcons.InboxIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
            No payroll runs found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {PAYROLL_RUN_COLUMNS.map((c) => (
                    <th key={c.id} className="text-left px-4 py-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">{c.label}</th>
                  ))}
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runs.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => onSelectRun?.(r)}
                  >
                    {PAYROLL_RUN_COLUMNS.map((c) => {
                      const v = c.accessor(r)
                      if (c.cellType === 'run_status') {
                        const m = runStatusMeta(v)
                        return (
                          <td key={c.id} className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${m.tone}`}>{m.label}</span>
                          </td>
                        )
                      }
                      return <td key={c.id} className="px-4 py-3 text-slate-700">{v}</td>
                    })}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Process */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleProcess(r.id) }}
                          disabled={r.status === 'completed' || processing === r.id}
                          title="Process this payroll run"
                          className="text-xs px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-md transition"
                        >
                          {processing === r.id ? '…' : 'Process'}
                        </button>
                        {/* Edit */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setEditRun(r) }}
                          title={r.status !== 'draft' ? PAYROLL_RUN_COPY.tooltipEdit + ' (draft only)' : PAYROLL_RUN_COPY.tooltipEdit}
                          className="text-xs px-2.5 py-1 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-md transition flex items-center gap-1"
                        >
                          <HeroIcons.PencilSquareIcon className="w-3 h-3" />
                          Edit
                        </button>
                        {/* Delete */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDeleteRun(r) }}
                          title={r.status !== 'draft' ? PAYROLL_RUN_COPY.tooltipDelete + ' (draft only)' : PAYROLL_RUN_COPY.tooltipDelete}
                          className="text-xs px-2.5 py-1 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-md transition flex items-center gap-1"
                        >
                          <HeroIcons.TrashIcon className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* KPI drill-down report modal */}
      {reportId && (
        <KpiReportModal reportId={reportId} onClose={() => setReportId(null)} />
      )}

      {/* Edit payroll run modal */}
      {editRun && (
        <RunEditModal
          run={editRun}
          onClose={() => setEditRun(null)}
          onSaved={() => { setEditRun(null); reloadRuns() }}
        />
      )}

      {/* Delete payroll run confirmation */}
      {deleteRun && (
        <DeleteConfirmModal
          run={deleteRun}
          onClose={() => setDeleteRun(null)}
          onDeleted={() => { setDeleteRun(null); reloadRuns() }}
        />
      )}
    </div>
  )
}


