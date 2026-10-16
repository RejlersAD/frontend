import { radaiConfirm } from '../../../services/radaiDialog'
/**
 * Attendance Dashboard — HR Manager Consolidated View
 * ====================================================
 * 5 sub-views: Overview · Daily · Monthly matrix · Yearly · Reports
 *
 * Data reuses the existing attendance and HR services.
 * All config, thresholds, colours and labels live in hrAttendance.config.js.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './attendanceWorkspace.css'
import DailyAttendanceTab from './DailyAttendanceTab'
import YearlyAttendanceTab from './YearlyAttendanceTab'
import AttendanceOverviewTab from './AttendanceOverviewTab'
import { useSelector } from 'react-redux'
import * as HeroIcons from '@heroicons/react/24/outline'
import ts from '../../../services/timesheet.service'
import payrollService from '../../../services/payroll.service'
import {
  ATTENDANCE_VIEWS, ATTENDANCE_DEFAULT_VIEW,
  MONTH_FULL,
  ATT_STANDARD_DAILY_HOURS, ATT_STANDARD_MONTHLY_WORKING_DAYS,
  ATT_COMPANY_NAME, fmtDiff,
  workingDaysInMonth, empName, empDept,
  ATT_COPY, filterEmployeeRow,
  // ── New: edit + holiday
  ATT_HOLIDAY_CELL_BG, ATT_HOLIDAY_CELL_BORDER,
  ATT_HOLIDAY_HEADER_BG, ATT_HOLIDAY_HEADER_TEXT, ATT_HOLIDAY_SYMBOL,
  OVERRIDE_REASON_OPTIONS, canEditAttendance, ATT_EDIT_COPY,
  // ── Reports catalogue
  ATT_REPORT_TYPES, ATT_DOWNLOAD_METHOD_MAP,
  // ── Summary leave columns (NEW: dynamic soft-coded leave types)
  SUMMARY_LEAVE_TYPES,
  // ── Legacy leave column constants (deprecated but kept for backward compatibility)
  SUMMARY_ANNUAL_LEAVE_CODE, SUMMARY_UNPAID_LEAVE_CODE,
  SUMMARY_ANNUAL_LEAVE_LABEL, SUMMARY_UNPAID_LEAVE_LABEL,
  SUMMARY_AL_SHOW_BALANCE,
} from '../../../config/hrAttendance.config'
import { getLeaveType, ABSENT_SYMBOL, BRANCHES } from '../../../config/hrLeave.config'

// ─────────────────────────────────────────────────────────────────────────────
// Shared micro-components  (defined outside main component — stable references)
// ─────────────────────────────────────────────────────────────────────────────
const Spinner = () => (
  <svg className="animate-spin w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
  </svg>
)

const EmptyState = ({ icon: IconName = 'InboxIcon', msg, loading, loadingMsg }) => {
  const Icon = HeroIcons[IconName] || HeroIcons.InboxIcon
  if (loading) return (
    <div className="flex items-center justify-center h-32 gap-2 text-slate-400 text-sm">
      <Spinner />{loadingMsg || ATT_COPY.loading}
    </div>
  )
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">
      <Icon className="w-10 h-10 mx-auto mb-2 opacity-40" />
      {msg || ATT_COPY.noData}
    </div>
  )
}

const ATTENDANCE_PAGE_SIZES = [10, 25, 50, 100]
const DEFAULT_ATTENDANCE_PAGE_SIZE = 25

const matchesEmployeeSearch = (employee, query) => {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [
    empName(employee),
    empDept(employee),
    employee?.employee_code,
    employee?.employee_id,
    employee?.radai_email,
    employee?.email,
  ].some(value => String(value || '').toLowerCase().includes(q))
}

const pageRows = (rows, page, pageSize) => {
  const safePage = Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)))
  return rows.slice((safePage - 1) * pageSize, safePage * pageSize)
}

const TablePagination = ({ total, page, pageSize, onPageChange, onPageSizeChange, itemLabel = 'employees' }) => {
  if (!total) return null
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, pages)
  const first = (safePage - 1) * pageSize + 1
  const last = Math.min(total, safePage * pageSize)
  return (
    <div className="att-pagination flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-4 py-3 text-xs text-slate-500">
      <span>Showing <strong className="text-slate-700">{first}-{last}</strong> of <strong className="text-slate-700">{total}</strong> {itemLabel}</span>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5">
          Rows per page
          <select value={pageSize} onChange={event => onPageSizeChange(Number(event.target.value))}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700">
            {ATTENDANCE_PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onPageChange(safePage - 1)} disabled={safePage <= 1}
            className="rounded-md border border-slate-300 bg-white p-1.5 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Previous page">
            <HeroIcons.ChevronLeftIcon className="h-3.5 w-3.5" />
          </button>
          {[...new Set([1, ...Array.from({ length: Math.min(pages, 3) }, (_, i) => Math.max(1, Math.min(safePage - 1, pages - 2)) + i), pages])].sort((a, b) => a - b).map((number, index, numbers) => (
            <span key={number} className="inline-flex items-center gap-1">
              {index > 0 && number - numbers[index - 1] > 1 && <span aria-hidden="true">…</span>}
              <button type="button" className="att-page-number" aria-label={`Page ${number}`} aria-current={number === safePage ? 'page' : undefined} onClick={() => onPageChange(number)}>{number}</button>
            </span>
          ))}
          <button type="button" onClick={() => onPageChange(safePage + 1)} disabled={safePage >= pages}
            className="rounded-md border border-slate-300 bg-white p-1.5 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Next page">
            <HeroIcons.ChevronRightIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DownloadReportPanel
// Drop-down panel driven entirely by ATT_REPORT_TYPES + ATT_DOWNLOAD_METHOD_MAP.
// Adding a new report type → edit the config only; no code changes here.
// Props: year, month — current toolbar selection (defaults for month/year scopes).
// ─────────────────────────────────────────────────────────────────────────────
const COLOR_MAP = {
  emerald: { btn: 'bg-emerald-600 hover:bg-emerald-700 text-white', busy: 'bg-emerald-200 text-emerald-600' },
  rose:    { btn: 'bg-rose-600    hover:bg-rose-700    text-white', busy: 'bg-rose-200    text-rose-600'    },
  violet:  { btn: 'bg-violet-600  hover:bg-violet-700  text-white', busy: 'bg-violet-200  text-violet-600'  },
  blue:    { btn: 'bg-blue-600    hover:bg-blue-700    text-white', busy: 'bg-blue-200    text-blue-600'    },
  indigo:  { btn: 'bg-indigo-600  hover:bg-indigo-700  text-white', busy: 'bg-indigo-200  text-indigo-600'  },
}

// Soft-coded year options in the panel — covers 3 years back to current
const PANEL_YEAR_RANGE = Number(import.meta.env?.VITE_DL_PANEL_YEAR_RANGE || 3)

function DownloadReportPanel({ year, month, tsService }) {
  const [error, setError] = useState('')
  const [open,   setOpen]   = useState(false)
  const [busy,   setBusy]   = useState('')  // tracks which key is downloading
  const ref = useRef(null)

  // Scope-specific param state — default to current toolbar values
  const today = new Date().toISOString().slice(0, 10)
  const [params, setParams] = useState({
    date:  today,
    month: month,
    year:  year,
  })

  // Keep params in sync when outer year/month toolbar changes
  useEffect(() => { setParams(p => ({ ...p, year, month })) }, [year, month])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handle = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const yearOpts = useMemo(() => {
    const cur = new Date().getFullYear()
    return Array.from({ length: PANEL_YEAR_RANGE + 1 }, (_, i) => cur - PANEL_YEAR_RANGE + i + 1)
  }, [])

  const handleDownload = async (key, scope) => {
    const method = ATT_DOWNLOAD_METHOD_MAP[key]
    if (!method || !tsService[method]) return
    setError('')
    setBusy(key)
    try {
      if (scope === 'date')  await tsService[method](params.date)
      else if (scope === 'year') await tsService[method](params.year)
      else                   await tsService[method](params.year, params.month)
    } catch (downloadError) { setError(downloadError?.response?.data?.detail || 'The report could not be downloaded. Please try again.') }
    finally { setBusy('') }
  }

  return (
    <div className="att-export relative" ref={ref} onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); ref.current?.querySelector('button')?.focus() } }}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition ${
          open
            ? 'bg-slate-700 text-white border-slate-800'
            : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
        }`}
      >
        <HeroIcons.ArrowDownTrayIcon className="w-4 h-4" />
        Export
        <HeroIcons.ChevronDownIcon className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="att-export-panel absolute top-full right-0 mt-2 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl w-[420px] p-4 space-y-4">
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
            Select report type &amp; format
          </p>

          {ATT_REPORT_TYPES.map(rpt => {
            const Icon = HeroIcons[rpt.icon] || HeroIcons.DocumentArrowDownIcon
            return (
              <div key={rpt.id} className="border border-slate-100 rounded-xl p-3 space-y-2.5 hover:border-slate-200 transition">
                {/* Header */}
                <div className="flex items-start gap-2">
                  <div className="p-1.5 bg-slate-100 rounded-lg">
                    <Icon className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{rpt.label}</p>
                    <p className="text-xs text-slate-500 leading-snug">{rpt.description}</p>
                  </div>
                </div>

                {/* Scope date controls */}
                {rpt.scope === 'date' && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 w-10 shrink-0">Date</label>
                    <input
                      type="date"
                      value={params.date}
                      onChange={e => setParams(p => ({ ...p, date: e.target.value }))}
                      className="border border-slate-300 rounded-lg text-xs px-2 py-1.5 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                    />
                  </div>
                )}
                {rpt.scope === 'month' && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 w-10 shrink-0">Period</label>
                    <select
                      value={params.year}
                      onChange={e => setParams(p => ({ ...p, year: Number(e.target.value) }))}
                      className="border border-slate-300 rounded-lg text-xs px-2 py-1.5 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                    >
                      {yearOpts.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select
                      value={params.month}
                      onChange={e => setParams(p => ({ ...p, month: Number(e.target.value) }))}
                      className="border border-slate-300 rounded-lg text-xs px-2 py-1.5 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                    >
                      {MONTH_FULL.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                    </select>
                  </div>
                )}
                {rpt.scope === 'year' && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 w-10 shrink-0">Year</label>
                    <select
                      value={params.year}
                      onChange={e => setParams(p => ({ ...p, year: Number(e.target.value) }))}
                      className="border border-slate-300 rounded-lg text-xs px-2 py-1.5 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                    >
                      {yearOpts.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                )}

                {/* Amber note (e.g. "may take a moment") */}
                {rpt.note && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                    ⚠ {rpt.note}
                  </p>
                )}

                {/* Format download buttons */}
                <div className="flex flex-wrap gap-2">
                  {rpt.formats.map(fmt => {
                    const FmtIcon = HeroIcons[fmt.icon] || HeroIcons.ArrowDownTrayIcon
                    const c = COLOR_MAP[fmt.color] || COLOR_MAP.emerald
                    const isBusy = busy === fmt.key
                    return (
                      <button
                        key={fmt.key}
                        type="button"
                        disabled={!!busy}
                        onClick={() => handleDownload(fmt.key, rpt.scope)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition ${
                          isBusy ? c.busy + ' cursor-wait' : c.btn + (busy ? ' opacity-50 cursor-not-allowed' : '')
                        }`}
                      >
                        {isBusy
                          ? <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                          : <FmtIcon className="w-3.5 h-3.5" />
                        }
                        {isBusy ? 'Generating…' : fmt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SummaryTab — Consolidated Monthly Time Sheet  (matches Rejlers report format)
// Each row = one employee; columns = calendar days 1–31 showing hours worked.
// Summary columns: Total · Days · Normal Hours · Difference
// All thresholds read from hrAttendance.config.js — no magic numbers here.
// ─────────────────────────────────────────────────────────────────────────────
function SummaryTab({ initialDate, initialSearch = '' }) {
  const initNow = initialDate ? new Date(`${initialDate}T12:00:00`) : new Date()
  const [year,          setYear]          = useState(initNow.getFullYear())
  const [month,         setMonth]         = useState(initNow.getMonth() + 1)
  const [search,        setSearch]        = useState(initialSearch)
  const [summaryPage,   setSummaryPage]   = useState(1)
  const [summaryPageSize, setSummaryPageSize] = useState(DEFAULT_ATTENDANCE_PAGE_SIZE)
  const [resp,          setResp]          = useState(null)
  const [busy,          setBusy]          = useState(false)
  const [err,           setErr]           = useState('')
  const [refresh, setRefresh] = useState(0)
  const [density, setDensity] = useState('comfortable')
  const [showDetails, setShowDetails] = useState(false)
  const [leaveCalendar, setLeaveCalendar] = useState({})  // { employee_code: { 'YYYY-MM-DD': {code,name,...} } }
  const [annualLeaveDb,     setAnnualLeaveDb]     = useState({})  // { employee_code: { balance, ... } }
  const [annualLeaveByName, setAnnualLeaveByName] = useState({})  // { norm_name: { balance, ... } } — fallback
  const [annualLeaveLoading, setAnnualLeaveLoading] = useState(false)
  // Sync upload state (HR Manager only)
  const [syncUploading, setSyncUploading] = useState(false)
  const [syncMsg,       setSyncMsg]       = useState('')
  const [attendanceUploading, setAttendanceUploading] = useState(false)
  const [attendanceUploadMsg, setAttendanceUploadMsg] = useState('')
  const attendanceFileRef = useRef(null)
  const leaveFileRef = useRef(null)
  const [summaryBranch,        setSummaryBranch]        = useState(null)   // null = All | 'RAD' | 'RIN'
  // Set of employee_codes for the selected branch; null = no filter (show All)
  const [branchCodes,           setBranchCodes]           = useState(null)
  const [branchCodesLoading,    setBranchCodesLoading]    = useState(false)
  const [branchError, setBranchError] = useState('')

  // ── RBAC / permission ──────────────────────────────────────────────────────
  // canEdit = true when the logged-in user holds an HR Manager or admin role.
  // The check is client-side for UX only; the backend enforces the same rule.
  const authUser    = useSelector((s) => s.auth?.user)
  const rbacProfile = useSelector((s) => s.rbac?.currentUser)
  const canEdit     = canEditAttendance(rbacProfile, authUser)

  // ── Attendance Overrides ───────────────────────────────────────────────────
  // overrideMap: { employeeCode: { 'YYYY-MM-DD': { override_hours, reason, note, id } } }
  const [overrideMap,   setOverrideMap]   = useState({})
  const [correctionsReady, setCorrectionsReady] = useState(false)
  const [correctionsError, setCorrectionsError] = useState(false)
  // Edit modal state
  const [editTarget,    setEditTarget]    = useState(null)  // { employeeCode, employeeName, date, currentHours }
  const editDialogRef = useRef(null)
  const [editHours,     setEditHours]     = useState('')
  const [editReason,    setEditReason]    = useState('hr_correction')
  const [editNote,      setEditNote]      = useState('')
  const [editSaving,    setEditSaving]    = useState(false)
  const [editMsg,       setEditMsg]       = useState('')

  // ── Public Holidays ────────────────────────────────────────────────────────
  // Set of date strings 'YYYY-MM-DD' that are public holidays in this month.
  const [holidays,       setHolidays]      = useState([])  // full holiday objects
  const [showHolidayPanel, setShowHolidayPanel] = useState(false)
  // Holiday form state
  const [hForm,          setHForm]         = useState({ date: '', name: '', name_ar: '', region: 'AE-AZ', note: '' })
  const [hEditing,       setHEditing]      = useState(null)  // holiday id being edited
  const [hSaving,        setHSaving]       = useState(false)
  const [hMsg,           setHMsg]          = useState('')

  useEffect(() => {
    if (!editTarget) return undefined
    const previous = document.activeElement
    const dialog = editDialogRef.current
    dialog?.showModal()
    return () => { dialog?.close(); if (previous?.isConnected) previous.focus() }
  }, [editTarget])

  // When branch selection changes, fetch the employee codes for that branch
  // so we can cross-reference against biometric attendance rows (which have no branch tag)
  useEffect(() => {
    let active = true
    setBranchError('')
    if (!summaryBranch) {
      setBranchCodes(null)
      setBranchCodesLoading(false)
      return undefined
    }
    setBranchCodes(new Set())
    setBranchCodesLoading(true)
    payrollService.getBranchEmployeeCodes(summaryBranch, year)
      .then(d => { if (active) setBranchCodes(new Set(d?.codes || [])) })
      .catch(() => { if (active) { setBranchCodes(new Set()); setBranchError('Branch employees could not be loaded. Please retry.') } })
      .finally(() => { if (active) setBranchCodesLoading(false) })
    return () => { active = false }
  }, [summaryBranch, year, refresh])

  // Fetch biometric attendance
  useEffect(() => {
    let active = true
    setBusy(true)
    setErr('')
    setResp(null)
    ts.fetchMonthly(year, month)
      .then(d => { if (active) setResp(d) })
      .catch(e => { if (active) setErr(e?.response?.data?.detail || e?.message || 'Failed to load attendance data') })
      .finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [year, month, refresh])

  // Refresh leave overlays after decisions and when returning to the page.
  useEffect(() => {
    let active = true
    setLeaveCalendar({})
    const refresh = () => payrollService.getLeaveCalendar(year, month)
      .then(d => { if (active) setLeaveCalendar(d?.calendar || {}) })
      .catch(() => { if (active) setLeaveCalendar({}) })
    refresh()
    window.addEventListener('leave-approval-updated', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      active = false
      window.removeEventListener('leave-approval-updated', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [year, month, refresh])

  // Fetch computed annual leave balance from the DB (per employee, YTD as of selected month)
  // Soft-coded: only fetched when SUMMARY_AL_SHOW_BALANCE is true
  useEffect(() => {
    if (!SUMMARY_AL_SHOW_BALANCE) return
    let active = true
    setAnnualLeaveLoading(true)
    setAnnualLeaveDb({})
    setAnnualLeaveByName({})
    payrollService.getAnnualLeaveBalanceSummary(year, month)
      .then(d => {
        if (!active) return
        setAnnualLeaveDb(d?.balances || {})
        setAnnualLeaveByName(d?.balances_by_name || {})
      })
      .catch(() => { if (active) { setAnnualLeaveDb({}); setAnnualLeaveByName({}) } })
      .finally(() => { if (active) setAnnualLeaveLoading(false) })
    return () => { active = false }
  }, [year, month, refresh])

  // Fetch HR attendance overrides for this month
  useEffect(() => {
    let active = true
    setOverrideMap({})
    setCorrectionsReady(false)
    setCorrectionsError(false)
    payrollService.getAttendanceOverrides(year, month)
      .then(rows => {
        if (!active) return
        // Build a nested lookup: { employeeCode: { 'YYYY-MM-DD': override } }
        const map = {}
        ;(rows || []).forEach(ov => {
          if (!map[ov.employee_code]) map[ov.employee_code] = {}
          map[ov.employee_code][ov.date] = ov
        })
        setOverrideMap(map)
        setCorrectionsReady(true)
      })
      .catch(() => { if (active) { setOverrideMap({}); setCorrectionsError(true) } })
    return () => { active = false }
  }, [year, month, refresh])

  // Fetch public holidays for this year (shown as column accents + side panel)
  useEffect(() => {
    let active = true
    setHolidays([])
    payrollService.getPublicHolidays(year, { active_only: 'true' })
      .then(rows => { if (active) setHolidays(Array.isArray(rows) ? rows : (rows?.results || [])) })
      .catch(() => { if (active) setHolidays([]) })
    return () => { active = false }
  }, [year, refresh])

  // Build a Set of 'YYYY-MM-DD' strings for quick O(1) holiday lookup
  const holidayDateSet = useMemo(() => {
    const s = new Set()
    holidays.forEach(h => {
      if (h.date) s.add(h.date)
    })
    return s
  }, [holidays])

  // Build a holiday name lookup: { 'YYYY-MM-DD': holidayName }
  const holidayNameMap = useMemo(() => {
    const m = {}
    holidays.forEach(h => { if (h.date) m[h.date] = h.name })
    return m
  }, [holidays])

  const rows        = resp?.rows || []
  const calendarWorkingDays = resp?.working_days_in_month || workingDaysInMonth(year, month)
  const workingDays = resp?.standard_working_days || ATT_STANDARD_MONTHLY_WORKING_DAYS
  const daysInMonth = new Date(year, month, 0).getDate()         // last day of month
  const days        = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => i + 1),
    [daysInMonth]
  )
  // Soft-coded helper: build ISO date string for any cell in the selected month
  const cellDateStr = (d) => `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const isHoliday   = (d) => holidayDateSet.has(cellDateStr(d))

  // Open the edit modal for a cell
  const openEdit = (row, d) => {
    if (!canEdit) return
    const dateStr = cellDateStr(d)
    const existing = overrideMap[row.code]?.[dateStr]
    const currentBio = row.dayMap[d]?.type === 'worked' ? row.dayMap[d].hours : 0
    setEditTarget({ employeeCode: row.code, employeeName: row.name, date: dateStr, currentHours: currentBio })
    setEditHours(existing ? String(existing.override_hours) : String(currentBio))
    setEditReason(existing?.reason || 'hr_correction')
    setEditNote(existing?.note || '')
    setEditMsg('')
  }

  // Save override via API
  const saveOverride = async () => {
    if (!editTarget) return
    setEditSaving(true); setEditMsg('')
    try {
      const payload = {
        employee_code:  editTarget.employeeCode,
        employee_name:  editTarget.employeeName,
        date:           editTarget.date,
        original_hours: editTarget.currentHours,
        override_hours: parseFloat(editHours) || 0,
        reason:         editReason,
        note:           editNote,
      }
      const saved = await payrollService.createAttendanceOverride(payload)
      // Update local override map
      setOverrideMap(prev => ({
        ...prev,
        [editTarget.employeeCode]: {
          ...(prev[editTarget.employeeCode] || {}),
          [editTarget.date]: saved,
        },
      }))
      setEditMsg(ATT_EDIT_COPY.saveOk)
      setTimeout(() => setEditTarget(null), 1000)
    } catch {
      setEditMsg(ATT_EDIT_COPY.saveErr)
    } finally {
      setEditSaving(false)
    }
  }

  // Save / update public holiday
  const saveHoliday = async () => {
    setHSaving(true); setHMsg('')
    try {
      if (hEditing) {
        await payrollService.updatePublicHoliday(hEditing, hForm)
      } else {
        await payrollService.createPublicHoliday({ ...hForm, source: 'hr_added' })
      }
      // Re-fetch holidays
      const rows = await payrollService.getPublicHolidays(year, { active_only: 'true' })
      setHolidays(Array.isArray(rows) ? rows : (rows?.results || []))
      setHMsg(ATT_EDIT_COPY.holidaySaveOk)
      setHForm({ date: '', name: '', name_ar: '', region: 'AE-AZ', note: '' })
      setHEditing(null)
    } catch {
      setHMsg(ATT_EDIT_COPY.holidaySaveErr)
    } finally {
      setHSaving(false)
    }
  }

  const deactivateHoliday = async (h) => {
    if (!(await radaiConfirm(ATT_EDIT_COPY.holidayDeleteConfirm(h.name)))) return
    try {
      await payrollService.deactivatePublicHoliday(h.id)
      setHolidays(prev => prev.filter(x => x.id !== h.id))
    } catch { /* silent — user sees no change */ }
  }
  const yearOpts    = useMemo(() => [year - 2, year - 1, year].filter(y => y > 2020), [year])
  const round2      = (v) => Math.round(v * 100) / 100

  // Soft-coded: lookup helper — try employee_code first, fall back to normalised name.
  // Handles cases where biometric codes differ in format from HR Excel codes.
  const getAnnualLeaveEntry = (empCode, empName) => {
    if (empCode && annualLeaveDb[empCode]) return annualLeaveDb[empCode]
    // Normalise name the same way the backend does: lowercase, collapse spaces
    const norm = (empName || '').toLowerCase().replace(/\s+/g, ' ').trim()
    return annualLeaveByName[norm] || null
  }

  // HR Manager: upload Excel to seed/refresh leave data on production
  const handleSyncUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSyncUploading(true); setSyncMsg('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('year', String(year))
      fd.append('branch', summaryBranch || 'RAD')
      const result = await payrollService.syncLeaveData(fd)
      e.target.value = ''
      setSyncMsg(`✅ Synced: ${result.created} created, ${result.updated} updated, ${result.computed} computed`)
      // Refresh the annual leave balance data
      payrollService.getAnnualLeaveBalanceSummary(year, month)
        .then(d => { setAnnualLeaveDb(d?.balances || {}); setAnnualLeaveByName(d?.balances_by_name || {}) })
        .catch(() => {})
    } catch (err) {
      setSyncMsg(`❌ Sync failed: ${err?.message || 'Unknown error'}`)
    } finally {
      setSyncUploading(false)
    }
  }

  const handleAttendanceUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAttendanceUploading(true)
    setAttendanceUploadMsg('')
    try {
      const result = await ts.uploadDailyAttendance(file, year, month)
      e.target.value = ''
      setRefresh(value => value + 1)
      const imported = (result.created || 0) + (result.updated || 0)
      setAttendanceUploadMsg(
        `Imported ${imported} daily entries · ${result.created || 0} new · ${result.updated || 0} updated${result.skipped ? ` · ${result.skipped} skipped` : ''}`
      )
    } catch (uploadError) {
      const data = uploadError?.response?.data
      setAttendanceUploadMsg(data?.detail || data?.errors?.[0]?.error || uploadError?.message || 'Attendance upload failed')
    } finally {
      setAttendanceUploading(false)
    }
  }

  // Soft-coded: compute day-of-week for any date in the selected month.
  // 0 = Sunday, 6 = Saturday (standard JS)
  const dayOfWeek   = (d) => new Date(year, month - 1, d).getDay()
  const isSaturday  = (d) => dayOfWeek(d) === 6
  const isSunday    = (d) => dayOfWeek(d) === 0
  const isWeekend   = (d) => isSaturday(d) || isSunday(d)

  // Build pivot: employee × day → slot object { type:'worked'|'leave'|'override', hours?, ... }
  const pivotRows = useMemo(() => {
    const q = search.toLowerCase().trim()
    return rows
      // Remove non-employee biometric records (facility names, visitor badges, etc.)
      .filter(filterEmployeeRow)
      // Branch filter
      .filter(r => !summaryBranch || branchCodes?.has(r.employee_code || ''))
      .filter(r => matchesEmployeeSearch(r, q))
      .map(r => {
        const dayMap = {}
        ;(r.days_detail || []).forEach(d => {
          const day = parseInt(d.date ? d.date.split('-')[2] : '0', 10)
          if (day > 0) dayMap[day] = { type: 'worked', hours: d.hours || 0 }
        })
        // Overlay approved leave — only on days WITHOUT biometric data
        const empCode  = r.employee_code || ''
        const empLeave = leaveCalendar[empCode] || {}
        Object.entries(empLeave).forEach(([dateStr, lv]) => {
          const day = parseInt(dateStr.split('-')[2], 10)
          if (day > 0 && !dayMap[day]) {
            dayMap[day] = { type: 'leave', code: lv.code, name: `${lv.name}${lv.half_day ? ' (half day)' : ''}`, badge_bg: lv.badge_bg, badge_text: lv.badge_text }
          }
        })
        // Apply HR attendance overrides — replaces biometric value for the cell.
        // Shown as type:'override' so the cell can render a pencil indicator.
        const empOverrides = overrideMap[empCode] || {}
        Object.entries(empOverrides).forEach(([dateStr, ov]) => {
          const day = parseInt(dateStr.split('-')[2], 10)
          if (day > 0) {
            dayMap[day] = {
              type:    'override',
              hours:   parseFloat(ov.override_hours) || 0,
              reason:  ov.reason,
              note:    ov.note,
              overrideId: ov.id,
            }
          }
        })
        const totalHrs  = round2(
          Object.values(dayMap).reduce((s, slot) =>
            s + ((slot?.type === 'worked' || slot?.type === 'override') ? (slot.hours || 0) : 0), 0)
        )
        const normalHrs = workingDays * ATT_STANDARD_DAILY_HOURS
        
        // ✅ NEW: Dynamic leave days calculation for ALL enabled leave types (soft-coded)
        // Counts approved leave days per type from the leave calendar
        const leaveDays = {}
        SUMMARY_LEAVE_TYPES.filter(lt => lt.enabled !== false).forEach(leaveType => {
          leaveDays[leaveType.code] = Object.values(empLeave).filter(lv => lv.code === leaveType.code).reduce((total, lv) => total + (lv.half_day ? 0.5 : 1), 0)
        })
        
        return {
          name:        empName(r),
          dept:        empDept(r),
          code:        empCode,
          dayMap,
          totalHrs,
          daysPresent: r.days_present || 0,
          normalHrs,
          diff:        round2(totalHrs - normalHrs),
          leaveDays,   // ✅ NEW: Dynamic object with all leave type counts (e.g., { AL: 2, SL: 1, EL: 0, ... })
          // ⚠️ DEPRECATED: Legacy fields kept for backward compatibility
          annualLeaveDays: leaveDays.AL || 0,
          unpaidLeaveDays: leaveDays.UL || 0,
        }
      })
  }, [rows, search, workingDays, leaveCalendar, branchCodes, overrideMap, summaryBranch])

  // Column totals row
  const totals = useMemo(() => {
    const dayMap = {}
    let totalHrs = 0, normalHrs = 0, daysPresent = 0
    
    // ✅ NEW: Dynamic leave totals for ALL enabled leave types
    const leaveTotals = {}
    SUMMARY_LEAVE_TYPES.filter(lt => lt.enabled !== false).forEach(leaveType => {
      leaveTotals[leaveType.code] = 0
    })
    
    pivotRows.forEach(r => {
      Object.entries(r.dayMap).forEach(([d, slot]) => {
        const day  = parseInt(d, 10)
        const hrs  = (slot?.type === 'worked' || slot?.type === 'override') ? (slot.hours || 0) : 0
        dayMap[day] = round2((dayMap[day] || 0) + hrs)
      })
      totalHrs    += r.totalHrs
      normalHrs   += r.normalHrs
      daysPresent += r.daysPresent
      
      // ✅ NEW: Sum leave days for each type
      Object.keys(leaveTotals).forEach(code => {
        leaveTotals[code] += (r.leaveDays?.[code] || 0)
      })
    })
    totalHrs  = round2(totalHrs)
    normalHrs = round2(normalHrs)
    return {
      dayMap,
      totalHrs,
      daysPresent,
      normalHrs,
      diff: round2(totalHrs - normalHrs),
      leaveTotals,  // ✅ NEW: Dynamic object { AL: 15, SL: 8, EL: 2, ... }
      // ⚠️ DEPRECATED: Legacy fields kept for backward compatibility
      annualLeaveDays: leaveTotals.AL || 0,
      unpaidLeaveDays: leaveTotals.UL || 0,
    }
  }, [pivotRows])

  const pagedPivotRows = useMemo(
    () => pageRows(pivotRows, summaryPage, summaryPageSize),
    [pivotRows, summaryPage, summaryPageSize]
  )

  useEffect(() => {
    setSummaryPage(1)
  }, [search, year, month, summaryBranch, summaryPageSize])

  const correctionsCount = pivotRows.reduce((count, row) => count + Object.values(row.dayMap).filter(slot => slot.type === 'override').length, 0)
  const summaryAvailable = !busy && !err && !branchError && !branchCodesLoading && !!resp && resp.configured !== false
  const hoursLabel = value => summaryAvailable && correctionsReady ? `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}h` : '—'
  const sourceLabel = ({ manual_upload: 'Manual upload source', biometric: 'Biometric source', hybrid: 'Biometric + uploaded hours' })[resp?.attendance_source] || 'Attendance records'
  const actions = <>
    <DownloadReportPanel year={year} month={month} tsService={ts} />
    <button type="button" className="att-button" aria-label="Refresh attendance" disabled={busy} onClick={() => setRefresh(value => value + 1)}><HeroIcons.ArrowPathIcon aria-hidden="true" /></button>
    {canEdit && <label className="att-button att-upload">
      <HeroIcons.ArrowUpTrayIcon aria-hidden="true" />{attendanceUploading ? 'Importing…' : 'Upload daily hours'}
      <input ref={attendanceFileRef} className="att-file-input" aria-label="Upload daily hours" type="file" accept=".xlsx,.csv" onChange={handleAttendanceUpload} disabled={attendanceUploading} />
    </label>}
  </>

  return (
    <div className="att-matrix" data-density={density}>
      <section className="att-filter-panel" aria-label="Attendance filters">
        <div className="att-filters">
          <label className="att-field att-search">
            <span>Search employees</span>
            <div className="att-search-box"><HeroIcons.MagnifyingGlassIcon aria-hidden="true" />
              <input aria-label="Employee search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Employee name or department" autoComplete="off" />
            </div>
          </label>
          <div className="att-field"><span>Branch</span><div className="att-branches" role="group" aria-label="Branch">
            <button type="button" aria-pressed={summaryBranch === null} onClick={() => setSummaryBranch(null)} className={summaryBranch === null ? 'bg-slate-700 text-white border-slate-700' : 'bg-slate-50 text-slate-600 border-slate-200'}>All</button>
            {BRANCHES.map(branch => <button key={branch.id} type="button" aria-pressed={summaryBranch === branch.id} onClick={() => setSummaryBranch(branch.id)} className={summaryBranch === branch.id ? `${branch.activeBg} ${branch.activeText} border-transparent` : `${branch.badgeBg} ${branch.badgeText} ${branch.badgeBorder}`}>{branch.label}</button>)}
          </div></div>
          <label className="att-field"><span>Month</span><select aria-label="Month" value={month} onChange={event => setMonth(Number(event.target.value))}>{MONTH_FULL.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></label>
          <label className="att-field"><span>Year</span><select aria-label="Year" value={year} onChange={event => setYear(Number(event.target.value))}>{yearOpts.map(value => <option key={value}>{value}</option>)}</select></label>
          <div className="att-filter-actions">
            <div className="att-primary-actions">{actions}</div>
            {canEdit && <label className="att-button att-sync"><HeroIcons.ArrowPathIcon aria-hidden="true" />{syncUploading ? 'Syncing…' : 'Sync leave'}<input ref={leaveFileRef} className="att-file-input" aria-label="Sync leave" type="file" accept=".xlsx,.xls" onChange={handleSyncUpload} disabled={syncUploading} /></label>}
            <button type="button" className="att-button att-holidays" aria-expanded={showHolidayPanel} onClick={() => setShowHolidayPanel(value => !value)}><HeroIcons.CalendarDaysIcon aria-hidden="true" />Public holidays</button>
            <details className="att-columns"><summary className="att-button"><HeroIcons.ViewColumnsIcon aria-hidden="true" />Columns</summary><div className="att-columns-panel"><label><input type="checkbox" checked={showDetails} onChange={event => setShowDetails(event.target.checked)} />Detailed totals</label><p>Days, leave balances, normal hours and difference.</p></div></details>
            <label className="att-density"><span className="sr-only">Density</span><select aria-label="Density" value={density} onChange={event => setDensity(event.target.value)}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
          </div>
        </div>
        <div className="att-meta">
          <span><strong>{summaryAvailable ? pivotRows.length : '—'}</strong> employees</span>
          <span><strong>{workingDays}</strong> contractual workdays</span>
          <span>Standard <strong>{ATT_STANDARD_DAILY_HOURS}h/day</strong></span>
          <span title={`${calendarWorkingDays} scheduled weekdays in period`}>Source: {sourceLabel}</span>
          <div className="att-legend" aria-label="Attendance legend">
            <span><b className="att-absent">A</b>Absent</span><span><b className="att-leave">L</b>Leave</span><span><b className="att-holiday">PH</b>Holiday</span><span><b className="att-unscheduled">—</b>No hours recorded</span>
          </div>
        </div>
        {syncMsg && <div role="status" className="att-message flex items-center gap-3 text-xs text-slate-700">{syncMsg}{syncMsg.startsWith('❌') && <button type="button" className="att-button" disabled={syncUploading} onClick={() => handleSyncUpload({ target: leaveFileRef.current })}>Retry sync</button>}</div>}
        {attendanceUploadMsg && <div role="status" className={`att-message flex items-center gap-3 text-xs ${attendanceUploadMsg.startsWith('Imported') ? 'text-emerald-700' : 'text-rose-700'}`}>{attendanceUploadMsg}{!attendanceUploadMsg.startsWith('Imported') && <button type="button" className="att-button" disabled={attendanceUploading} onClick={() => handleAttendanceUpload({ target: attendanceFileRef.current })}>Retry upload</button>}</div>}
      </section>
      <dl className="att-summary" aria-label="Filtered attendance summary">
        <div className="att-summary-item"><HeroIcons.ClockIcon aria-hidden="true" /><div><dt>Recorded</dt><dd>{hoursLabel(totals.totalHrs)}</dd></div></div>
        <div className="att-summary-item" title={`Existing contractual basis: ${workingDays} days × ${ATT_STANDARD_DAILY_HOURS} hours per employee`}><HeroIcons.DocumentTextIcon aria-hidden="true" /><div><dt>Expected</dt><dd>{hoursLabel(totals.normalHrs)}</dd></div></div>
        <div className="att-summary-item"><HeroIcons.ScaleIcon aria-hidden="true" /><div><dt>Variance</dt><dd className={summaryAvailable && totals.diff < 0 ? 'att-negative' : ''}>{hoursLabel(totals.diff)}</dd></div></div>
        <div className="att-summary-item" title={correctionsReady ? 'Recorded HR corrections in the filtered matrix' : 'HR corrections are loading or unavailable'}><HeroIcons.PencilSquareIcon aria-hidden="true" /><div><dt>HR corrections</dt><dd>{summaryAvailable && correctionsReady ? correctionsCount : '—'}</dd></div></div>
      </dl>
      {correctionsError && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex flex-wrap items-center gap-3">HR corrections could not be loaded. The matrix shows source hours; summary totals are unavailable.<button type="button" className="att-button" onClick={() => setRefresh(value => value + 1)}>Retry corrections</button></div>}

      {/* ── Public Holiday Panel (collapsible) ── */}
      {showHolidayPanel && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-violet-800 flex items-center gap-2">
              <HeroIcons.CalendarDaysIcon className="w-4 h-4" />
              {ATT_EDIT_COPY.holidayTitle} — {year}
            </h3>
            {canEdit && (
              <button type="button"
                onClick={() => { setHEditing(null); setHForm({ date: '', name: '', name_ar: '', region: 'AE-AZ', note: '' }); setHMsg('') }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700">
                <HeroIcons.PlusIcon className="w-3.5 h-3.5" />
                {ATT_EDIT_COPY.holidayAddBtn}
              </button>
            )}
          </div>

          {/* Holiday add/edit form (HR only) */}
          {canEdit && (hEditing !== undefined || hForm.date !== undefined) && (
            <div className="bg-white border border-violet-200 rounded-lg p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{ATT_EDIT_COPY.holidayDate} *</label>
                <input type="date" value={hForm.date}
                  onChange={e => setHForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{ATT_EDIT_COPY.holidayName} *</label>
                <input type="text" value={hForm.name} placeholder="UAE National Day"
                  onChange={e => setHForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Arabic Name (optional)</label>
                <input type="text" value={hForm.name_ar} placeholder="اليوم الوطني"
                  onChange={e => setHForm(f => ({ ...f, name_ar: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{ATT_EDIT_COPY.holidayRegion}</label>
                <select value={hForm.region} onChange={e => setHForm(f => ({ ...f, region: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500">
                  <option value="AE-AZ">Abu Dhabi (UAE)</option>
                  <option value="AE">UAE-wide</option>
                  <option value="COMPANY">Company-specific</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">{ATT_EDIT_COPY.holidayNote}</label>
                <input type="text" value={hForm.note} placeholder="Subject to moon sighting, etc."
                  onChange={e => setHForm(f => ({ ...f, note: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500" />
              </div>
              <div className="sm:col-span-2 flex items-center gap-3">
                <button type="button" onClick={saveHoliday} disabled={hSaving || !hForm.date || !hForm.name}
                  className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-50">
                  {hSaving ? ATT_EDIT_COPY.holidaySavingBtn : ATT_EDIT_COPY.holidaySaveBtn}
                </button>
                <button type="button" onClick={() => { setHEditing(undefined); setHForm({ date: '', name: '', name_ar: '', region: 'AE-AZ', note: '' }) }}
                  className="px-4 py-2 text-slate-600 text-sm rounded-lg hover:bg-slate-100">
                  {ATT_EDIT_COPY.cancelBtn}
                </button>
                {hMsg && <span className={`text-xs ${hMsg.includes('Failed') ? 'text-rose-600' : 'text-emerald-600'}`}>{hMsg}</span>}
              </div>
            </div>
          )}

          {/* Holiday list */}
          {holidays.length === 0 ? (
            <p className="text-sm text-violet-500 italic">{ATT_EDIT_COPY.noHolidays}</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {holidays.map(h => (
                <div key={h.id} className="flex items-center justify-between bg-white border border-violet-100 rounded-lg px-3 py-2 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-violet-700 text-xs whitespace-nowrap">{h.date}</span>
                    <span className="font-semibold text-slate-800 truncate">{h.name}</span>
                    {h.name_ar && <span className="text-slate-400 text-xs truncate" dir="rtl">{h.name_ar}</span>}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      h.source === 'government' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {h.source === 'government' ? ATT_EDIT_COPY.holidaySeeded : ATT_EDIT_COPY.holidayHrAdded}
                    </span>
                    {h.note && <span className="text-slate-400 text-xs italic truncate">{h.note}</span>}
                  </div>
                  {canEdit && (
                    <div className="flex gap-1 ml-2 flex-shrink-0">
                      <button type="button"
                        onClick={() => { setHEditing(h.id); setHForm({ date: h.date, name: h.name, name_ar: h.name_ar || '', region: h.region || 'AE-AZ', note: h.note || '' }); setHMsg('') }}
                        className="p-1.5 text-violet-600 hover:bg-violet-50 rounded" title={ATT_EDIT_COPY.holidayEditBtn}>
                        <HeroIcons.PencilSquareIcon className="w-3.5 h-3.5" />
                      </button>
                      {h.source === 'hr_added' && (
                        <button type="button"
                          onClick={() => deactivateHoliday(h)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded" title={ATT_EDIT_COPY.holidayDeactivateBtn}>
                          <HeroIcons.TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {(err || branchError) && (
        <div role="alert" className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-700 flex items-center gap-2">
          <HeroIcons.ExclamationCircleIcon className="w-4 h-4 flex-shrink-0" /> {err || branchError}<button type="button" className="att-button ml-auto" onClick={() => setRefresh(value => value + 1)}>Retry</button>
        </div>
      )}

      {/* Loading skeleton */}
      {(busy || branchCodesLoading) && <EmptyState loading icon="TableCellsIcon" loadingMsg={ATT_COPY.loading} />}

      {/* Empty state */}
      {!busy && !err && !branchError && !branchCodesLoading && pivotRows.length === 0 && (
        <EmptyState icon="TableCellsIcon" msg={resp?.configured === false ? 'Attendance source is not configured.' : search || summaryBranch ? 'No employees match these filters.' : ATT_COPY.monthlyEmpty} />
      )}

      {/* ══ Cross-tab pivot table ══ */}
      {!busy && !err && !branchCodesLoading && pivotRows.length > 0 && (
        <div className="att-matrix-panel">
          <div className="att-matrix-heading">
            <div>
              <h2>Employee daily hours</h2>
              <p className="text-xs text-slate-500">Numbered columns show recorded hours for each day.</p>
            </div>
            <span className="att-source-badge">{sourceLabel}</span>
          </div>
          <div className="att-table-scroll" tabIndex={0} role="region" aria-label="Employee daily hours matrix">
            <table className={`att-matrix-table ${showDetails ? '' : 'att-hide-details'}`} data-table-typography="preserve">
              <caption className="sr-only">Employee daily hours for {MONTH_FULL[month - 1]} {year}. Totals include all filtered employees.</caption>

              {/* Column headers: Employee | 1–31 | Total | Days | Normal Hours | Difference */}
              <thead>
                {/* Row 1: day numbers */}
                <tr className="bg-slate-700 text-white">
                  <th className="sticky left-0 z-20 bg-slate-700 px-3 py-2.5 text-left font-semibold whitespace-nowrap border-r border-slate-500" style={{ minWidth: '200px' }}>
                    Employee
                  </th>
                  {days.map(d => {
                    const sat = isSaturday(d)
                    const sun = isSunday(d)
                    const ph  = !sat && !sun && isHoliday(d)
                    return (
                      <th key={d}
                        title={sat ? 'Saturday' : sun ? 'Sunday' : ph ? (holidayNameMap[cellDateStr(d)] || 'Public Holiday') : ''}
                        className={[
                          'py-2 text-center font-semibold border-r',
                          sat ? 'bg-amber-600 border-amber-700' : '',
                          sun ? 'bg-rose-700  border-rose-800'  : '',
                          ph  ? `${ATT_HOLIDAY_HEADER_BG} border-violet-800 ${ATT_HOLIDAY_HEADER_TEXT}` : '',
                          !sat && !sun && !ph ? 'border-slate-600' : '',
                        ].join(' ')}
                        style={{ minWidth: '2.3rem' }}>
                        {d}
                      </th>
                    )
                  })}
                  <th className="att-total px-3 py-2.5 text-right font-semibold whitespace-nowrap border-l-2 border-slate-500 bg-slate-800">Total</th>
                  <th className="att-detail-column px-3 py-2.5 text-center font-semibold whitespace-nowrap bg-slate-800">Days</th>
                  
                  {/* ✅ DYNAMIC LEAVE COLUMNS — Soft-coded from SUMMARY_LEAVE_TYPES */}
                  {SUMMARY_LEAVE_TYPES.filter(lt => lt.enabled !== false)
                    .sort((a, b) => (a.displayOrder || 99) - (b.displayOrder || 99))
                    .map(leaveType => {
                      const colorMap = {
                        emerald: 'bg-emerald-800',
                        blue: 'bg-blue-800',
                        amber: 'bg-amber-800',
                        red: 'bg-red-900',
                        purple: 'bg-purple-800',
                        indigo: 'bg-indigo-800',
                      }
                      const bgClass = colorMap[leaveType.color] || 'bg-slate-800'
                      return (
                        <th
                          key={leaveType.code}
                          className={`att-detail-column px-3 py-2.5 text-center font-semibold whitespace-nowrap ${bgClass}`}
                          title={leaveType.description}>
                          {leaveType.label}
                          {leaveType.showBalance && leaveType.code === 'AL' && SUMMARY_AL_SHOW_BALANCE && (
                            <div className="text-[9px] font-normal opacity-70">Balance</div>
                          )}
                        </th>
                      )
                    })}
                  
                  <th className="att-detail-column px-3 py-2.5 text-right font-semibold whitespace-nowrap bg-slate-800 border-r border-slate-600">
                    Normal Hrs
                  </th>
                  <th className="att-detail-column px-3 py-2.5 text-right font-semibold whitespace-nowrap bg-slate-800">Difference</th>
                </tr>
                {/* Row 2: Sa / Su / PH labels */}
                <tr className="bg-slate-600 text-[9px] uppercase tracking-wide">
                  <td className="sticky left-0 z-20 bg-slate-600 border-r border-slate-500" />
                  {days.map(d => {
                    const sat = isSaturday(d)
                    const sun = isSunday(d)
                    const ph  = !sat && !sun && isHoliday(d)
                    return (
                      <td key={d}
                        className={[
                          'text-center border-r font-bold leading-none py-0.5',
                          sat ? 'bg-amber-500 text-white border-amber-600' : '',
                          sun ? 'bg-rose-600  text-white border-rose-700'  : '',
                          ph  ? 'bg-violet-600 text-white border-violet-700' : '',
                          !sat && !sun && !ph ? 'text-transparent border-slate-500' : '',
                        ].join(' ')}>
                        {sat ? 'Sa' : sun ? 'Su' : ph ? ATT_HOLIDAY_SYMBOL : '·'}
                      </td>
                    )
                  })}
                  <td colSpan={showDetails ? 4 + SUMMARY_LEAVE_TYPES.filter(lt => lt.enabled !== false).length : 1} className="bg-slate-600 border-l-2 border-slate-500" />
                </tr>
              </thead>

              {/* Data rows */}
              <tbody>
                {pagedPivotRows.map((r, i) => (
                  <tr key={i}
                    className={`border-b border-slate-100 hover:bg-blue-50/40 transition-colors ${
                      i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                    }`}>
                    {/* Sticky name cell */}
                    <td className="sticky left-0 z-10 bg-inherit px-3 py-1.5 font-medium text-slate-800 whitespace-nowrap border-r border-slate-200">
                      <div className="leading-tight">{r.name}</div>
                      {r.dept && <div className="text-[10px] text-slate-400 font-normal">{r.dept}</div>}
                    </td>
                    {/* Day cells */}
                    {days.map(d => {
                      const slot   = r.dayMap[d]
                      const sat    = isSaturday(d)
                      const sun    = isSunday(d)
                      const wkd    = sat || sun
                      const ph     = !wkd && isHoliday(d)
                      const today  = new Date()
                      const isFuture = new Date(year, month - 1, d) > today

                      let cellContent
                      if (slot?.type === 'worked') {
                        cellContent = (
                          <span className={`font-medium tabular-nums ${
                            wkd ? (sat ? 'text-amber-700' : 'text-rose-700') : 'text-slate-700'
                          }`}>{slot.hours.toFixed(2)}</span>
                        )
                      } else if (slot?.type === 'override') {
                        // HR-corrected cell — show override_hours with pencil icon
                        cellContent = (
                          <span className="flex items-center justify-center gap-0.5">
                            <span className="font-medium tabular-nums text-violet-700">{(slot.hours).toFixed(2)}</span>
                            <HeroIcons.PencilSquareIcon
                              className="w-2.5 h-2.5 text-violet-400 flex-shrink-0"
                              title={`${ATT_EDIT_COPY.overrideIndicator}: ${slot.note || slot.reason || ''}`}
                            />
                          </span>
                        )
                      } else if (slot?.type === 'leave') {
                        const lt = getLeaveType(slot.code)
                        cellContent = (
                          <span
                            className={`text-[9px] font-bold px-0.5 py-0.5 rounded ${lt.cellBg} ${lt.cellText}`}
                            title={slot.name}
                          >{slot.code}</span>
                        )
                      } else if (ph) {
                        cellContent = (
                          <span
                            className="text-[9px] font-bold text-violet-700 px-0.5"
                            title={holidayNameMap[cellDateStr(d)] || 'Public Holiday'}
                          >{ATT_HOLIDAY_SYMBOL}</span>
                        )
                      } else if (!wkd && !isFuture) {
                        cellContent = (
                          <span className="font-bold text-rose-600" style={{ fontSize: 9 }}>{ABSENT_SYMBOL}</span>
                        )
                      } else {
                        cellContent = (
                          <span className={wkd ? (sat ? 'text-amber-200' : 'text-rose-200') : 'text-slate-300'} style={{ fontSize: 9 }}>—</span>
                        )
                      }

                      return (
                        <td key={d}
                          className={[
                            'py-1.5 text-center border-r relative',
                            sat ? 'bg-amber-50 border-amber-200' : '',
                            sun ? 'bg-rose-50  border-rose-200'  : '',
                            ph  ? `${ATT_HOLIDAY_CELL_BG} ${ATT_HOLIDAY_CELL_BORDER}` : '',
                            !wkd && !ph ? 'border-slate-100' : '',
                            canEdit && !wkd && !isFuture && slot?.type !== 'leave' ? 'cursor-pointer hover:bg-violet-50/70 group' : '',
                          ].join(' ')}
                          style={{ minWidth: '2.3rem' }}>
                          {canEdit && !wkd && !isFuture && slot?.type !== 'leave'
                            ? <button type="button" className="att-cell-button" aria-label={`Edit ${r.name}, ${cellDateStr(d)}`} onClick={() => openEdit(r, d)}>{cellContent}</button>
                            : cellContent}
                          {/* Hover pencil indicator for editable cells */}
                          {canEdit && !wkd && !isFuture && slot?.type !== 'leave' && (
                            <HeroIcons.PencilSquareIcon className="absolute top-0.5 right-0.5 w-2 h-2 text-violet-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </td>
                      )
                    })}
                    {/* Summary cells */}
                    <td className="att-total px-3 py-1.5 text-right font-bold text-slate-800 border-l-2 border-slate-300 whitespace-nowrap tabular-nums bg-slate-50">
                      {r.totalHrs.toFixed(2)}
                    </td>
                    <td className="att-detail-column px-3 py-1.5 text-center font-semibold text-slate-700 bg-slate-50">
                      {r.daysPresent}
                    </td>
                    
                    {/* ✅ DYNAMIC LEAVE CELLS — Soft-coded from SUMMARY_LEAVE_TYPES */}
                    {SUMMARY_LEAVE_TYPES.filter(lt => lt.enabled !== false)
                      .sort((a, b) => (a.displayOrder || 99) - (b.displayOrder || 99))
                      .map(leaveType => {
                        const leaveDays = r.leaveDays?.[leaveType.code] || 0
                        const colorMap = {
                          emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', balBg: 'bg-emerald-50', balText: 'text-emerald-700' },
                          blue: { bg: 'bg-blue-50', text: 'text-blue-700', balBg: 'bg-blue-50', balText: 'text-blue-700' },
                          amber: { bg: 'bg-amber-50', text: 'text-amber-700', balBg: 'bg-amber-50', balText: 'text-amber-700' },
                          red: { bg: 'bg-red-50', text: 'text-red-700', balBg: 'bg-red-50', balText: 'text-red-700' },
                          purple: { bg: 'bg-purple-50', text: 'text-purple-700', balBg: 'bg-purple-50', balText: 'text-purple-700' },
                          indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', balBg: 'bg-indigo-50', balText: 'text-indigo-700' },
                        }
                        const colors = colorMap[leaveType.color] || { bg: 'bg-slate-50', text: 'text-slate-700', balBg: 'bg-slate-50', balText: 'text-slate-700' }
                        
                        // Special handling for Annual Leave balance display
                        if (leaveType.showBalance && leaveType.code === 'AL' && SUMMARY_AL_SHOW_BALANCE) {
                          if (annualLeaveLoading) {
                            return (
                              <td key={leaveType.code} className={`att-detail-column px-3 py-1.5 text-center font-semibold ${colors.bg} ${colors.text} whitespace-nowrap`}>
                                <span className="text-[9px] text-slate-400 italic">…</span>
                              </td>
                            )
                          }
                          const dbEntry = getAnnualLeaveEntry(r.code, r.name)
                          if (dbEntry) {
                            const bal    = parseFloat(dbEntry.balance ?? 0).toFixed(2)
                            const taken  = parseFloat(dbEntry.taken_ytd  ?? 0).toFixed(2)
                            const earned = parseFloat(dbEntry.earned_ytd ?? 0).toFixed(2)
                            const balNum = parseFloat(dbEntry.balance ?? 0)
                            const balColor = balNum < 0 ? 'text-rose-700 bg-rose-50' : balNum < 2 ? 'text-amber-700 bg-amber-50' : 'text-emerald-700 bg-emerald-50'
                            return (
                              <td key={leaveType.code} className={`att-detail-column px-3 py-1.5 text-center font-semibold ${colors.bg} ${colors.text} whitespace-nowrap`}>
                                <span
                                  className={`inline-flex flex-col items-center leading-tight px-1 py-0.5 rounded text-[10px] font-bold ${balColor}`}
                                  title={`Balance: ${bal} days | Earned YTD: ${earned} | Taken YTD: ${taken} | CF: ${parseFloat(dbEntry.carryforward ?? 0).toFixed(2)}`}
                                >
                                  <span>{bal} d</span>
                                  {leaveDays > 0 && <span className="font-normal opacity-70">{leaveDays} taken</span>}
                                </span>
                              </td>
                            )
                          }
                        }
                        
                        // Standard display: days taken this month
                        return (
                          <td key={leaveType.code} className={`att-detail-column px-3 py-1.5 text-center font-semibold ${colors.bg} ${colors.text} whitespace-nowrap`}>
                            {leaveDays > 0 ? leaveDays : '—'}
                          </td>
                        )
                      })}
                    
                    <td className="att-detail-column px-3 py-1.5 text-right text-slate-600 bg-slate-50 whitespace-nowrap tabular-nums border-r border-slate-200">
                      {r.normalHrs} h
                    </td>
                    <td className={`att-detail-column px-3 py-1.5 text-right font-semibold whitespace-nowrap bg-slate-50 tabular-nums ${
                      r.diff >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {fmtDiff(r.diff)}
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Totals footer */}
              <tfoot>
                <tr className="bg-slate-800 text-white border-t-2 border-slate-500 font-bold">
                  <td className="sticky left-0 z-10 bg-slate-800 px-3 py-2.5 whitespace-nowrap border-r border-slate-600">
                    Total
                  </td>
                  {days.map(d => {
                    const h   = totals.dayMap[d]
                    const sat = isSaturday(d)
                    const sun = isSunday(d)
                    const wkd = sat || sun
                    return (
                      <td key={d}
                        className={[
                          'py-2.5 text-center border-r',
                          sat ? 'bg-amber-700 border-amber-800' : '',
                          sun ? 'bg-rose-800  border-rose-900'  : '',
                          !wkd ? 'border-slate-700' : '',
                        ].join(' ')}
                        style={{ minWidth: '2.3rem' }}>
                        {h !== undefined
                          ? <span className="font-semibold tabular-nums">{h.toFixed(2)}</span>
                          : <span className="opacity-25">—</span>
                        }
                      </td>
                    )
                  })}
                  <td className="px-3 py-2.5 text-right border-l-2 border-slate-600 tabular-nums">
                    {totals.totalHrs.toFixed(2)}
                  </td>
                  <td className="att-detail-column px-3 py-2.5 text-center">{totals.daysPresent}</td>
                  
                  {/* ✅ DYNAMIC LEAVE TOTALS — Soft-coded from SUMMARY_LEAVE_TYPES */}
                  {SUMMARY_LEAVE_TYPES.filter(lt => lt.enabled !== false)
                    .sort((a, b) => (a.displayOrder || 99) - (b.displayOrder || 99))
                    .map(leaveType => {
                      const totalDays = totals.leaveTotals?.[leaveType.code] || 0
                      const colorMap = {
                        emerald: 'text-emerald-300',
                        blue: 'text-blue-300',
                        amber: 'text-amber-300',
                        red: 'text-red-300',
                        purple: 'text-purple-300',
                        indigo: 'text-indigo-300',
                      }
                      const textColor = colorMap[leaveType.color] || 'text-slate-300'
                      
                      return (
                        <td key={leaveType.code} className={`att-detail-column px-3 py-2.5 text-center font-semibold ${textColor}`}>
                          {totalDays > 0 ? totalDays : '—'}
                          {leaveType.showBalance && leaveType.code === 'AL' && SUMMARY_AL_SHOW_BALANCE && Object.keys(annualLeaveDb).length > 0 && (
                            <div className="text-[9px] font-normal opacity-70">taken</div>
                          )}
                        </td>
                      )
                    })}
                  
                  <td className="att-detail-column px-3 py-2.5 text-right tabular-nums border-r border-slate-600">
                    {totals.normalHrs} h
                  </td>
                  <td className={`att-detail-column px-3 py-2.5 text-right tabular-nums ${
                    totals.diff >= 0 ? 'text-emerald-300' : 'text-rose-300'
                  }`}>
                    {fmtDiff(totals.diff)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {/* Footer note */}
          <div className="att-matrix-note">
            <span>Normal Hours = {workingDays} working days × {ATT_STANDARD_DAILY_HOURS} h  ·  {ATT_COPY.absenceNote}</span>
            <span>{pivotRows.length} of {rows.length} employees shown</span>
          </div>
          <TablePagination total={pivotRows.length} page={summaryPage} pageSize={summaryPageSize}
            onPageChange={setSummaryPage} onPageSizeChange={setSummaryPageSize} />
        </div>
      )}

      {/* ── Attendance Override Edit Modal ── */}
      {editTarget && (
        <dialog ref={editDialogRef} className="att-edit-dialog" aria-labelledby="attendance-edit-title" onCancel={event => { event.preventDefault(); if (!editSaving) setEditTarget(null) }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 id="attendance-edit-title" className="text-base font-bold text-slate-800 flex items-center gap-2">
                <HeroIcons.PencilSquareIcon className="w-4 h-4 text-violet-600" />
                {ATT_EDIT_COPY.editTitle}
              </h3>
              <button type="button" aria-label="Close attendance correction" disabled={editSaving} onClick={() => setEditTarget(null)}
                className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
                <HeroIcons.XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {/* Context info */}
              <div className="bg-violet-50 rounded-lg px-3 py-2 text-xs text-violet-700 flex items-start gap-2">
                <HeroIcons.InformationCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                {ATT_EDIT_COPY.editHint}
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
                <div><span className="font-semibold text-slate-700">Employee:</span> {editTarget.employeeName}</div>
                <div><span className="font-semibold text-slate-700">Date:</span> {editTarget.date}</div>
              </div>
              {/* Original hours (read-only) */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{ATT_EDIT_COPY.originalHoursLabel}</label>
                <input aria-label={ATT_EDIT_COPY.originalHoursLabel} type="number" disabled value={editTarget.currentHours}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-500" />
              </div>
              {/* Override hours */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">{ATT_EDIT_COPY.overrideHoursLabel} *</label>
                <input type="number" min={0} max={24} step={0.5}
                  aria-label={ATT_EDIT_COPY.overrideHoursLabel} value={editHours} onChange={e => setEditHours(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500" />
              </div>
              {/* Reason */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">{ATT_EDIT_COPY.reasonLabel} *</label>
                <select aria-label={ATT_EDIT_COPY.reasonLabel} value={editReason} onChange={e => setEditReason(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500">
                  {OVERRIDE_REASON_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {/* Note */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">{ATT_EDIT_COPY.noteLabel}</label>
                <textarea aria-label={ATT_EDIT_COPY.noteLabel} rows={2} value={editNote} onChange={e => setEditNote(e.target.value)}
                  placeholder="Explain the correction…"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 resize-none" />
              </div>
              {editMsg && (
                <p className={`text-xs px-3 py-2 rounded-lg ${editMsg === ATT_EDIT_COPY.saveOk ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {editMsg}
                </p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
              <button type="button" onClick={() => setEditTarget(null)}
                disabled={editSaving}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
                {ATT_EDIT_COPY.cancelBtn}
              </button>
              <button type="button" onClick={saveOverride}
                disabled={editSaving || editHours === ''}
                className="px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-50">
                {editSaving ? ATT_EDIT_COPY.savingBtn : ATT_EDIT_COPY.saveBtn}
              </button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ReportsTab — config-driven export catalogue
// All report types, formats, and date scopes come from ATT_REPORT_TYPES in
// hrAttendance.config.js — no changes needed here to add a new report type.
// ─────────────────────────────────────────────────────────────────────────────
function ReportsTab({ todayStr }) {
  const now = new Date()
  const [dlDate,  setDlDate]  = useState(todayStr)
  const [dlYear,  setDlYear]  = useState(now.getFullYear())
  const [dlMonth, setDlMonth] = useState(now.getMonth() + 1)
  const [busy,    setBusy]    = useState('')   // key of currently exporting format
  const [msgs,    setMsgs]    = useState({})   // { [formatKey]: 'ok' | 'err: ...' }

  // Soft-coded year options: current year + previous 2 years
  const yearOpts = [dlYear - 2, dlYear - 1, dlYear].filter(y => y > 2020)

  // Unified download dispatcher — reads method name from ATT_DOWNLOAD_METHOD_MAP
  const download = useCallback(async (formatKey, scope) => {
    const method = ATT_DOWNLOAD_METHOD_MAP[formatKey]
    if (!method || !ts[method]) return
    setBusy(formatKey)
    setMsgs(prev => ({ ...prev, [formatKey]: '' }))
    try {
      if (scope === 'date')  await ts[method](dlDate)
      if (scope === 'month') await ts[method](dlYear, dlMonth)
      if (scope === 'year')  await ts[method](dlYear)
      setMsgs(prev => ({ ...prev, [formatKey]: 'ok' }))
    } catch (e) {
      setMsgs(prev => ({ ...prev, [formatKey]: `err: ${e.message}` }))
    } finally {
      setBusy('')
    }
  }, [dlDate, dlYear, dlMonth])

  // Colour palette for download buttons (soft-coded, maps to Tailwind classes)
  const BTN_COLORS = {
    emerald: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    rose:    'bg-rose-600    hover:bg-rose-700    text-white',
    violet:  'bg-violet-600  hover:bg-violet-700  text-white',
    blue:    'bg-blue-600    hover:bg-blue-700    text-white',
    indigo:  'bg-indigo-600  hover:bg-indigo-700  text-white',
  }

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 flex items-start gap-2">
        <HeroIcons.InformationCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
        {ATT_COPY.exportHint}
      </div>

      {/* One card per report type — driven entirely by ATT_REPORT_TYPES config */}
      {ATT_REPORT_TYPES.map(report => {
        const Icon = HeroIcons[report.icon] || HeroIcons.ArrowDownTrayIcon
        return (
          <div key={report.id} className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
              <Icon className="w-4 h-4 text-slate-400" />
              {report.label}
            </h3>
            <p className="text-xs text-slate-500 mb-4">{report.description}</p>

            {/* Optional amber note (e.g. "yearly may take a moment") */}
            {report.note && (
              <div className="mb-3 flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <HeroIcons.ExclamationTriangleIcon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                {report.note}
              </div>
            )}

            <div className="flex flex-wrap items-end gap-3">
              {/* Date picker — scope determines which control is shown */}
              {report.scope === 'date' && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Date</label>
                  <input type="date" value={dlDate} max={todayStr}
                    onChange={e => setDlDate(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
                </div>
              )}
              {report.scope === 'month' && (
                <>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Month</label>
                    <select value={dlMonth} onChange={e => setDlMonth(Number(e.target.value))}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                      {MONTH_FULL.map((name, i) => (
                        <option key={i + 1} value={i + 1}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Year</label>
                    <select value={dlYear} onChange={e => setDlYear(Number(e.target.value))}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                      {yearOpts.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </>
              )}
              {report.scope === 'year' && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Year</label>
                  <select value={dlYear} onChange={e => setDlYear(Number(e.target.value))}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                    {yearOpts.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              )}

              {/* Download buttons — one per format in ATT_REPORT_TYPES[n].formats */}
              {report.formats.map(fmt => {
                const BtnIcon = HeroIcons[fmt.icon] || HeroIcons.ArrowDownTrayIcon
                const isThis  = busy === fmt.key
                const msg     = msgs[fmt.key]
                return (
                  <div key={fmt.key} className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => download(fmt.key, report.scope)}
                      disabled={!!busy}
                      className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg disabled:opacity-60 transition ${BTN_COLORS[fmt.color] || BTN_COLORS.emerald}`}
                    >
                      {isThis
                        ? <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                          </svg>
                        : <BtnIcon className="w-4 h-4" />
                      }
                      {isThis ? 'Exporting…' : fmt.label}
                    </button>
                    {/* Per-button status message */}
                    {msg && (
                      <span className={`text-xs px-1 ${msg === 'ok' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {msg === 'ok' ? ATT_COPY.exportOk : msg.replace('err: ', '')}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
const NOW          = new Date()
const TODAY_STR    = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, '0')}-${String(NOW.getDate()).padStart(2, '0')}`

export default function AttendanceDashboard() {
  // ── UI state ────────────────────────────────────────────────────────────────
  const [view,         setView]         = useState(ATTENDANCE_DEFAULT_VIEW)
  const [selectedDate, setSelectedDate] = useState(TODAY_STR)
  const [dailyInitialSearch, setDailyInitialSearch] = useState('')
  const [matrixSelection, setMatrixSelection] = useState({})

  // ── Data state ──────────────────────────────────────────────────────────────
  const [dailyData,   setDailyData]   = useState([])

  const [loadingDaily,   setLoadingDaily]   = useState(false)
  const [dailyError, setDailyError] = useState('')
  const [dailySource, setDailySource] = useState('')
  const [dailyLoadedDate, setDailyLoadedDate] = useState('')
  const [dailyRefresh, setDailyRefresh] = useState(0)

  // ── Daily data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (view !== 'daily') return
    let active = true
    setLoadingDaily(true)
    setDailyData([])
    setDailyError('')
    setDailySource('')
    setDailyLoadedDate('')
    ts.fetchDaily(selectedDate)
      .then(d => {
        if (!active) return
        if (d?.configured === false) {
          setDailyError(typeof d.message === 'string' && d.message ? d.message : 'The attendance source is not configured or is unavailable.')
          return
        }
        const rows = d?.rows || (Array.isArray(d) ? d : null)
        if (!Array.isArray(rows)) throw new Error('Invalid daily attendance response')
        setDailyData(rows.filter(filterEmployeeRow))
        const source = d?.attendance_source || (d?.variant === 'manual' || d?.hours_mode === 'manual' ? 'manual_upload' : '')
        setDailySource(({ manual_upload: 'Manual upload source', biometric: 'Biometric source', hybrid: 'Biometric + uploaded hours' })[source] || 'Attendance records')
        setDailyLoadedDate(selectedDate)
      })
      .catch(failure => {
        if (!active) return
        setDailyError(failure?.response?.status === 403 ? 'You do not have permission to view daily attendance.'
          : failure?.response?.status === 401 ? 'Your session has expired. Sign in again to load attendance.'
            : 'Daily attendance could not be loaded. Please try again.')
      })
      .finally(() => { if (active) setLoadingDaily(false) })
    return () => { active = false }
  }, [selectedDate, view, dailyRefresh])

  const renderDaily = () => (
    <DailyAttendanceTab rows={dailyData} date={selectedDate} today={TODAY_STR}
      loading={loadingDaily || (!dailyError && dailyLoadedDate !== selectedDate)}
      error={dailyError} source={dailySource} onDateChange={setSelectedDate}
      onRefresh={() => setDailyRefresh(value => value + 1)} Pagination={TablePagination} initialSearch={dailyInitialSearch} />
  )

  // MAIN RENDER
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="attendance-workspace">
      <nav className="att-tabs" aria-label="Attendance views">
        {ATTENDANCE_VIEWS.map(item => <button key={item.id} type="button" className="att-tab" aria-pressed={view === item.id} title={item.description} onClick={() => { setDailyInitialSearch(''); setMatrixSelection({}); setView(item.id) }}>{item.label}</button>)}
      </nav>

      {/* Render active view */}
      {view === 'overview' && <AttendanceOverviewTab date={selectedDate} today={TODAY_STR} onDateChange={setSelectedDate}
        onOpenDaily={(date, search = '') => { setSelectedDate(date); setDailyInitialSearch(search); setView('daily') }}
        onOpenMatrix={(date, search = '') => { setMatrixSelection({ initialDate: date, initialSearch: search }); setView('summary') }} /> }
      {view === 'summary'  && <SummaryTab {...matrixSelection} />}
      {view === 'daily'    && renderDaily()}
      {view === 'yearly'   && <YearlyAttendanceTab Pagination={TablePagination} />}
      {view === 'reports'  && <ReportsTab todayStr={TODAY_STR} />}
    </div>
  )
}
