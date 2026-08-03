/**
 * Attendance Dashboard — HR Manager Consolidated View
 * ====================================================
 * 5 sub-views:  Overview · Daily · Monthly · Yearly · Reports
 *
 * Data comes entirely from the existing timesheet service (SQL Server biometric).
 * All config, thresholds, colours and labels live in hrAttendance.config.js.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import * as HeroIcons from '@heroicons/react/24/outline'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import ts from '../../../services/timesheet.service'
import payrollService from '../../../services/payroll.service'
import {
  ATTENDANCE_VIEWS, ATTENDANCE_DEFAULT_VIEW,
  ATTENDANCE_STATUS, ATTENDANCE_KPIS,
  ATTENDANCE_DAILY_COLS, ATTENDANCE_MONTHLY_COLS,
  DEPT_COLORS, MONTH_SHORT, MONTH_FULL,
  ATT_GOOD_RATE_PCT, ATT_WARN_RATE_PCT, ATT_TOP_ABSENT_LIMIT,
  ATT_STANDARD_DAILY_HOURS, ATT_COMPANY_NAME, fmtDiff,
  classifyDay, workingDaysInMonth, rateColor, empName, empDept,
  fmtTime, ATT_COPY, filterEmployeeRow,
  // ── New: edit + holiday
  ATT_HOLIDAY_CELL_BG, ATT_HOLIDAY_CELL_BORDER,
  ATT_HOLIDAY_HEADER_BG, ATT_HOLIDAY_HEADER_TEXT, ATT_HOLIDAY_SYMBOL,
  OVERRIDE_REASON_OPTIONS, canEditAttendance, ATT_EDIT_COPY,
  OPEN_SHIFT_INDICATOR,
  // ── Reports catalogue
  ATT_REPORT_TYPES, ATT_DOWNLOAD_METHOD_MAP,
  // ── Summary leave columns (NEW: dynamic soft-coded leave types)
  SUMMARY_LEAVE_TYPES,
  // ── Legacy leave column constants (deprecated but kept for backward compatibility)
  SUMMARY_ANNUAL_LEAVE_CODE, SUMMARY_UNPAID_LEAVE_CODE,
  SUMMARY_ANNUAL_LEAVE_LABEL, SUMMARY_UNPAID_LEAVE_LABEL,
  SUMMARY_AL_SHOW_BALANCE,
} from '../../../config/hrAttendance.config'
import { getLeaveType, ABSENT_SYMBOL, BRANCHES, getBranch } from '../../../config/hrLeave.config'

// ─────────────────────────────────────────────────────────────────────────────
// Shared micro-components  (defined outside main component — stable references)
// ─────────────────────────────────────────────────────────────────────────────
const Spinner = () => (
  <svg className="animate-spin w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
  </svg>
)

const StatusBadge = ({ status }) => {
  const m = ATTENDANCE_STATUS[status] || ATTENDANCE_STATUS.absent
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${m.bg} ${m.text} ${m.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  )
}

const KpiTile = ({ kpi }) => {
  const Icon = HeroIcons[kpi.icon] || HeroIcons.ChartBarIcon
  return (
    <div className={`${kpi.bgLight} rounded-xl p-4 border border-white/80 shadow-sm`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-600">{kpi.label}</span>
        <Icon className={`w-4 h-4 ${kpi.textColor}`} />
      </div>
      <div className={`text-2xl font-bold ${kpi.textColor}`}>{kpi.value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{kpi.sub}</div>
    </div>
  )
}

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
    setBusy(key)
    try {
      if (scope === 'date')  await tsService[method](params.date)
      else if (scope === 'year') await tsService[method](params.year)
      else                   await tsService[method](params.year, params.month)
    } catch { /* silent — network errors surface via browser */ }
    finally { setBusy('') }
  }

  return (
    <div className="relative" ref={ref}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition ${
          open
            ? 'bg-slate-700 text-white border-slate-800'
            : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
        }`}
      >
        <HeroIcons.ArrowDownTrayIcon className="w-4 h-4" />
        Reports
        <HeroIcons.ChevronDownIcon className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-full right-0 mt-2 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl w-[420px] p-4 space-y-4">
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
                      className="border border-slate-300 rounded-lg text-xs px-2 py-1.5 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    />
                  </div>
                )}
                {rpt.scope === 'month' && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 w-10 shrink-0">Period</label>
                    <select
                      value={params.year}
                      onChange={e => setParams(p => ({ ...p, year: Number(e.target.value) }))}
                      className="border border-slate-300 rounded-lg text-xs px-2 py-1.5 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    >
                      {yearOpts.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select
                      value={params.month}
                      onChange={e => setParams(p => ({ ...p, month: Number(e.target.value) }))}
                      className="border border-slate-300 rounded-lg text-xs px-2 py-1.5 focus:ring-2 focus:ring-blue-400 focus:outline-none"
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
                      className="border border-slate-300 rounded-lg text-xs px-2 py-1.5 focus:ring-2 focus:ring-blue-400 focus:outline-none"
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
function SummaryTab() {
  const initNow = new Date()
  const [year,          setYear]          = useState(initNow.getFullYear())
  const [month,         setMonth]         = useState(initNow.getMonth() + 1)
  const [search,        setSearch]        = useState('')
  const [resp,          setResp]          = useState(null)
  const [busy,          setBusy]          = useState(false)
  const [err,           setErr]           = useState('')
  const [leaveCalendar, setLeaveCalendar] = useState({})  // { employee_code: { 'YYYY-MM-DD': {code,name,...} } }
  const [annualLeaveDb,     setAnnualLeaveDb]     = useState({})  // { employee_code: { balance, ... } }
  const [annualLeaveByName, setAnnualLeaveByName] = useState({})  // { norm_name: { balance, ... } } — fallback
  const [annualLeaveLoading, setAnnualLeaveLoading] = useState(false)
  // Sync upload state (HR Manager only)
  const [syncUploading, setSyncUploading] = useState(false)
  const [syncMsg,       setSyncMsg]       = useState('')
  const [summaryBranch,        setSummaryBranch]        = useState(null)   // null = All | 'RAD' | 'RIN'
  // Set of employee_codes for the selected branch; null = no filter (show All)
  const [branchCodes,           setBranchCodes]           = useState(null)
  const [branchCodesLoading,    setBranchCodesLoading]    = useState(false)

  // ── RBAC / permission ──────────────────────────────────────────────────────
  // canEdit = true when the logged-in user holds an HR Manager or admin role.
  // The check is client-side for UX only; the backend enforces the same rule.
  const authUser    = useSelector((s) => s.auth?.user)
  const rbacProfile = useSelector((s) => s.rbac?.currentUser)
  const canEdit     = canEditAttendance(rbacProfile, authUser)

  // ── Attendance Overrides ───────────────────────────────────────────────────
  // overrideMap: { employeeCode: { 'YYYY-MM-DD': { override_hours, reason, note, id } } }
  const [overrideMap,   setOverrideMap]   = useState({})
  // Edit modal state
  const [editTarget,    setEditTarget]    = useState(null)  // { employeeCode, employeeName, date, currentHours }
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

  // When branch selection changes, fetch the employee codes for that branch
  // so we can cross-reference against biometric attendance rows (which have no branch tag)
  useEffect(() => {
    if (!summaryBranch) {
      setBranchCodes(null)
      return
    }
    setBranchCodesLoading(true)
    payrollService.getBranchEmployeeCodes(summaryBranch, year)
      .then(d => setBranchCodes(new Set(d?.codes || [])))
      .catch(() => setBranchCodes(new Set()))   // on error: show empty rather than all
      .finally(() => setBranchCodesLoading(false))
  }, [summaryBranch, year])

  // Fetch biometric attendance
  useEffect(() => {
    setBusy(true)
    setErr('')
    ts.fetchMonthly(year, month)
      .then(d => setResp(d))
      .catch(e => setErr(e?.message || 'Failed to load attendance data'))
      .finally(() => setBusy(false))
  }, [year, month])

  // Fetch approved leave calendar — overlay on top of attendance
  useEffect(() => {
    payrollService.getLeaveCalendar(year, month)
      .then(d => setLeaveCalendar(d?.calendar || {}))
      .catch(() => setLeaveCalendar({}))
  }, [year, month])

  // Fetch computed annual leave balance from the DB (per employee, YTD as of selected month)
  // Soft-coded: only fetched when SUMMARY_AL_SHOW_BALANCE is true
  useEffect(() => {
    if (!SUMMARY_AL_SHOW_BALANCE) return
    setAnnualLeaveLoading(true)
    payrollService.getAnnualLeaveBalanceSummary(year, month)
      .then(d => {
        setAnnualLeaveDb(d?.balances || {})
        setAnnualLeaveByName(d?.balances_by_name || {})
      })
      .catch(() => { setAnnualLeaveDb({}); setAnnualLeaveByName({}) })
      .finally(() => setAnnualLeaveLoading(false))
  }, [year, month])

  // Fetch HR attendance overrides for this month
  useEffect(() => {
    payrollService.getAttendanceOverrides(year, month)
      .then(rows => {
        // Build a nested lookup: { employeeCode: { 'YYYY-MM-DD': override } }
        const map = {}
        ;(rows || []).forEach(ov => {
          if (!map[ov.employee_code]) map[ov.employee_code] = {}
          map[ov.employee_code][ov.date] = ov
        })
        setOverrideMap(map)
      })
      .catch(() => setOverrideMap({}))
  }, [year, month])

  // Fetch public holidays for this year (shown as column accents + side panel)
  useEffect(() => {
    payrollService.getPublicHolidays(year, { active_only: 'true' })
      .then(rows => setHolidays(Array.isArray(rows) ? rows : (rows?.results || [])))
      .catch(() => setHolidays([]))
  }, [year])

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
  const workingDays = resp?.working_days_in_month || workingDaysInMonth(year, month)
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
    if (!window.confirm(ATT_EDIT_COPY.holidayDeleteConfirm(h.name))) return
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
      setSyncMsg(`✅ Synced: ${result.created} created, ${result.updated} updated, ${result.computed} computed`)
      // Refresh the annual leave balance data
      payrollService.getAnnualLeaveBalanceSummary(year, month)
        .then(d => { setAnnualLeaveDb(d?.balances || {}); setAnnualLeaveByName(d?.balances_by_name || {}) })
        .catch(() => {})
    } catch (err) {
      setSyncMsg(`❌ Sync failed: ${err?.message || 'Unknown error'}`)
    } finally {
      setSyncUploading(false)
      e.target.value = ''  // reset input
    }
  }

  // Human-readable period string shown in the report header, e.g. "June 2026"
  // Soft-coded: label text comes from MONTH_FULL in hrAttendance.config.js
  const periodLabel = `${MONTH_FULL[month - 1]} ${year}`

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
      .filter(r => !branchCodes || branchCodes.has(r.employee_code || ''))
      .filter(r => !q ||
        empName(r).toLowerCase().includes(q) ||
        (r.department || '').toLowerCase().includes(q))
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
            dayMap[day] = { type: 'leave', code: lv.code, name: lv.name, badge_bg: lv.badge_bg, badge_text: lv.badge_text }
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
          leaveDays[leaveType.code] = Object.values(empLeave).filter(lv => lv.code === leaveType.code).length
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
  }, [rows, search, workingDays, leaveCalendar, branchCodes, overrideMap])

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

  return (
    <div className="space-y-4">
      {/* Report header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <HeroIcons.TableCellsIcon className="w-5 h-5 text-blue-500" />
              Time Sheet Summary — {summaryBranch ? getBranch(summaryBranch)?.fullName : 'All Branches (RAD + RIN)'}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">{periodLabel}</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            {/* Branch selector */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Branch</label>
            <div className="flex gap-1">
              <button type="button" onClick={() => setSummaryBranch(null)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  summaryBranch === null
                    ? 'bg-slate-700 text-white border-slate-700'
                    : 'bg-slate-50 text-slate-600 border-slate-300 hover:bg-slate-100'
                }`}>All</button>
              {BRANCHES.map(b => (
                <button key={b.id} type="button" onClick={() => setSummaryBranch(b.id)}
                  disabled={branchCodesLoading && summaryBranch === b.id}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1 ${
                    summaryBranch === b.id
                      ? `${b.activeBg} ${b.activeText} border-transparent`
                      : `${b.badgeBg} ${b.badgeText} ${b.badgeBorder} hover:opacity-80`
                  }`}>
                  {branchCodesLoading && summaryBranch === b.id && (
                    <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                  )}
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Month */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Month</label>
              <select value={month} onChange={e => setMonth(Number(e.target.value))}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                {MONTH_FULL.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </div>
            {/* Year */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Year</label>
              <select value={year} onChange={e => setYear(Number(e.target.value))}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                {yearOpts.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {/* Search */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Search</label>
              <div className="relative">
                <HeroIcons.MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Name or department…" autoComplete="off"
                  className="pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 w-44" />
              </div>
            </div>
            {/* Quick exports — replaced with smart report panel */}
            <DownloadReportPanel year={year} month={month} tsService={ts} />
            {/* Public Holidays button — visible to everyone; edit controls appear only for HR */}
            {/* HR Manager: sync leave data from Excel upload */}
            {canEdit && (
              <label
                className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border cursor-pointer transition ${
                  syncUploading
                    ? 'bg-sky-100 text-sky-600 border-sky-300 opacity-70'
                    : 'bg-sky-50 text-sky-700 border-sky-300 hover:bg-sky-100'
                }`}
                title="Upload HR Leave Excel to sync annual leave balances for all employees"
              >
                {syncUploading
                  ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Syncing…</>
                  : <><HeroIcons.ArrowUpTrayIcon className="w-4 h-4" /> Sync Leave</>
                }
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleSyncUpload} disabled={syncUploading} />
              </label>
            )}
            {syncMsg && (
              <span className={`text-xs px-2 py-1 rounded border ${syncMsg.startsWith('✅') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                {syncMsg}
              </span>
            )}
            <button type="button"
              onClick={() => setShowHolidayPanel(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition ${
                showHolidayPanel
                  ? 'bg-violet-600 text-white border-violet-700'
                  : 'bg-violet-50 text-violet-700 border-violet-300 hover:bg-violet-100'
              }`}>
              <HeroIcons.CalendarDaysIcon className="w-4 h-4" />
              {ATT_EDIT_COPY.holidayTitle}
              {holidays.length > 0 && (
                <span className="ml-1 bg-violet-100 text-violet-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {holidays.filter(h => {
                    const d = h.date?.slice(0, 7)
                    return d === `${year}-${String(month).padStart(2, '0')}`
                  }).length}
                </span>
              )}
            </button>
          </div>
        </div>
        {/* Stats strip */}
        <div className="mt-3 flex flex-wrap gap-5 text-xs text-slate-500 border-t border-slate-100 pt-2.5">
          <span><span className="font-semibold text-slate-700">{busy ? '…' : pivotRows.length}</span> employees</span>
          <span><span className="font-semibold text-slate-700">{workingDays}</span> working days in period</span>
          <span>Standard <span className="font-semibold text-slate-700">{ATT_STANDARD_DAILY_HOURS} h/day</span></span>
          {/* Legend for new cell types */}
          {canEdit && (
            <span className="flex items-center gap-1">
              <HeroIcons.PencilSquareIcon className="w-3 h-3 text-violet-500" />
              <span className="text-violet-600 font-semibold">HR corrected</span>
            </span>
          )}
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-violet-300 inline-block" />
            <span className="text-violet-600 font-semibold">Public holiday</span>
          </span>
          <span className="ml-auto flex items-center gap-1 text-[10px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
            {ATT_COPY.sourceTag}
          </span>
        </div>
      </div>

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
      {err && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-700 flex items-center gap-2">
          <HeroIcons.ExclamationCircleIcon className="w-4 h-4 flex-shrink-0" /> {err}
        </div>
      )}

      {/* Loading skeleton */}
      {busy && !resp && <EmptyState loading icon="TableCellsIcon" loadingMsg={ATT_COPY.loading} />}

      {/* Empty state */}
      {!busy && !err && pivotRows.length === 0 && (
        <EmptyState icon="TableCellsIcon" msg={ATT_COPY.monthlyEmpty} />
      )}

      {/* ══ Cross-tab pivot table ══ */}
      {pivotRows.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse" style={{ minWidth: 'max-content' }}>

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
                        style={{ minWidth: '2.6rem' }}>
                        {d}
                      </th>
                    )
                  })}
                  <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap border-l-2 border-slate-500 bg-slate-800">Total</th>
                  <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap bg-slate-800">Days</th>
                  
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
                          className={`px-3 py-2.5 text-center font-semibold whitespace-nowrap ${bgClass}`}
                          title={leaveType.description}>
                          {leaveType.label}
                          {leaveType.showBalance && leaveType.code === 'AL' && SUMMARY_AL_SHOW_BALANCE && (
                            <div className="text-[9px] font-normal opacity-70">Balance</div>
                          )}
                        </th>
                      )
                    })}
                  
                  <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap bg-slate-800 border-r border-slate-600">
                    Normal Hrs
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap bg-slate-800">Difference</th>
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
                  <td colSpan={2 + SUMMARY_LEAVE_TYPES.filter(lt => lt.enabled !== false).length + 2} className="bg-slate-600 border-l-2 border-slate-500" />
                </tr>
              </thead>

              {/* Data rows */}
              <tbody>
                {pivotRows.map((r, i) => (
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
                          onClick={canEdit && !wkd && !isFuture && slot?.type !== 'leave' ? () => openEdit(r, d) : undefined}
                          title={canEdit && !wkd && !isFuture && slot?.type !== 'leave' ? 'Click to edit' : undefined}
                          className={[
                            'py-1.5 text-center border-r relative',
                            sat ? 'bg-amber-50 border-amber-200' : '',
                            sun ? 'bg-rose-50  border-rose-200'  : '',
                            ph  ? `${ATT_HOLIDAY_CELL_BG} ${ATT_HOLIDAY_CELL_BORDER}` : '',
                            !wkd && !ph ? 'border-slate-100' : '',
                            canEdit && !wkd && !isFuture && slot?.type !== 'leave' ? 'cursor-pointer hover:bg-violet-50/70 group' : '',
                          ].join(' ')}
                          style={{ minWidth: '2.6rem' }}>
                          {cellContent}
                          {/* Hover pencil indicator for editable cells */}
                          {canEdit && !wkd && !isFuture && slot?.type !== 'leave' && (
                            <HeroIcons.PencilSquareIcon className="absolute top-0.5 right-0.5 w-2 h-2 text-violet-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </td>
                      )
                    })}
                    {/* Summary cells */}
                    <td className="px-3 py-1.5 text-right font-bold text-slate-800 border-l-2 border-slate-300 whitespace-nowrap tabular-nums bg-slate-50">
                      {r.totalHrs.toFixed(2)}
                    </td>
                    <td className="px-3 py-1.5 text-center font-semibold text-slate-700 bg-slate-50">
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
                              <td key={leaveType.code} className={`px-3 py-1.5 text-center font-semibold ${colors.bg} ${colors.text} whitespace-nowrap`}>
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
                              <td key={leaveType.code} className={`px-3 py-1.5 text-center font-semibold ${colors.bg} ${colors.text} whitespace-nowrap`}>
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
                          <td key={leaveType.code} className={`px-3 py-1.5 text-center font-semibold ${colors.bg} ${colors.text} whitespace-nowrap`}>
                            {leaveDays > 0 ? leaveDays : '—'}
                          </td>
                        )
                      })}
                    
                    <td className="px-3 py-1.5 text-right text-slate-600 bg-slate-50 whitespace-nowrap tabular-nums border-r border-slate-200">
                      {r.normalHrs} h
                    </td>
                    <td className={`px-3 py-1.5 text-right font-semibold whitespace-nowrap bg-slate-50 tabular-nums ${
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
                        style={{ minWidth: '2.6rem' }}>
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
                  <td className="px-3 py-2.5 text-center">{totals.daysPresent}</td>
                  
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
                        <td key={leaveType.code} className={`px-3 py-2.5 text-center font-semibold ${textColor}`}>
                          {totalDays > 0 ? totalDays : '—'}
                          {leaveType.showBalance && leaveType.code === 'AL' && SUMMARY_AL_SHOW_BALANCE && Object.keys(annualLeaveDb).length > 0 && (
                            <div className="text-[9px] font-normal opacity-70">taken</div>
                          )}
                        </td>
                      )
                    })}
                  
                  <td className="px-3 py-2.5 text-right tabular-nums border-r border-slate-600">
                    {totals.normalHrs} h
                  </td>
                  <td className={`px-3 py-2.5 text-right tabular-nums ${
                    totals.diff >= 0 ? 'text-emerald-300' : 'text-rose-300'
                  }`}>
                    {fmtDiff(totals.diff)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {/* Footer note */}
          <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Normal Hours = {workingDays} working days × {ATT_STANDARD_DAILY_HOURS} h  ·  {ATT_COPY.absenceNote}</span>
            <span>{pivotRows.length} of {rows.length} employees shown</span>
          </div>
        </div>
      )}

      {/* ── Attendance Override Edit Modal ── */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <HeroIcons.PencilSquareIcon className="w-4 h-4 text-violet-600" />
                {ATT_EDIT_COPY.editTitle}
              </h3>
              <button type="button" onClick={() => setEditTarget(null)}
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
                <input type="number" disabled value={editTarget.currentHours}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-500" />
              </div>
              {/* Override hours */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">{ATT_EDIT_COPY.overrideHoursLabel} *</label>
                <input type="number" min={0} max={24} step={0.5}
                  value={editHours} onChange={e => setEditHours(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500" />
              </div>
              {/* Reason */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">{ATT_EDIT_COPY.reasonLabel} *</label>
                <select value={editReason} onChange={e => setEditReason(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500">
                  {OVERRIDE_REASON_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {/* Note */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">{ATT_EDIT_COPY.noteLabel}</label>
                <textarea rows={2} value={editNote} onChange={e => setEditNote(e.target.value)}
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
        </div>
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
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
              {report.scope === 'month' && (
                <>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Month</label>
                    <select value={dlMonth} onChange={e => setDlMonth(Number(e.target.value))}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                      {MONTH_FULL.map((name, i) => (
                        <option key={i + 1} value={i + 1}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Year</label>
                    <select value={dlYear} onChange={e => setDlYear(Number(e.target.value))}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                      {yearOpts.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </>
              )}
              {report.scope === 'year' && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Year</label>
                  <select value={dlYear} onChange={e => setDlYear(Number(e.target.value))}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
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
const TODAY_STR    = NOW.toISOString().slice(0, 10)
const ALL_DEPT     = 'all'
const ALL_STATUS   = 'all'

export default function AttendanceDashboard() {
  // ── UI state ────────────────────────────────────────────────────────────────
  const [view,         setView]         = useState(ATTENDANCE_DEFAULT_VIEW)
  const [selectedDate, setSelectedDate] = useState(TODAY_STR)
  const [selMonth,     setSelMonth]     = useState(NOW.getMonth() + 1)
  const [selYear,      setSelYear]      = useState(NOW.getFullYear())
  const [deptFilter,   setDeptFilter]   = useState(ALL_DEPT)
  const [statusFilter, setStatusFilter] = useState(ALL_STATUS)

  // ── Data state ──────────────────────────────────────────────────────────────
  const [liveData,    setLiveData]    = useState([])
  const [dailyData,   setDailyData]   = useState([])
  const [monthlyData, setMonthlyData] = useState([])
  const [yearlyData,  setYearlyData]  = useState([])  // Array[12] of monthly arrays
  const [trendData,   setTrendData]   = useState([])  // 6-month overview chart

  const [loadingDaily,   setLoadingDaily]   = useState(false)
  const [loadingMonthly, setLoadingMonthly] = useState(false)
  const [loadingYearly,  setLoadingYearly]  = useState(false)

  // ── Always-on: fetch live for total active count (KPI denominator) ──────────
  useEffect(() => {
    ts.fetchLive()
      .then(d => setLiveData((d?.rows || (Array.isArray(d) ? d : [])).filter(filterEmployeeRow)))
      .catch(() => {})
  }, [])

  // ── Daily data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (view !== 'daily' && view !== 'overview') return
    setLoadingDaily(true)
    ts.fetchDaily(selectedDate)
      .then(d => setDailyData((d?.rows || (Array.isArray(d) ? d : [])).filter(filterEmployeeRow)))
      .catch(() => setDailyData([]))
      .finally(() => setLoadingDaily(false))
  }, [selectedDate, view])

  // ── Monthly data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (view !== 'monthly' && view !== 'overview') return
    setLoadingMonthly(true)
    ts.fetchMonthly(selYear, selMonth)
      .then(d => setMonthlyData((d?.rows || (Array.isArray(d) ? d : [])).filter(filterEmployeeRow)))
      .catch(() => setMonthlyData([]))
      .finally(() => setLoadingMonthly(false))
  }, [selYear, selMonth, view])

  // ── 6-month trend for Overview ───────────────────────────────────────────────
  useEffect(() => {
    if (view !== 'overview') return
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(NOW.getFullYear(), NOW.getMonth() - (5 - i), 1)
      return { year: d.getFullYear(), month: d.getMonth() + 1 }
    })
    Promise.all(months.map(({ year, month }) =>
      ts.fetchMonthly(year, month).catch(() => ({}))
    )).then(results => {
      setTrendData(results.map((employees, i) => {
        const arr = (employees?.rows || (Array.isArray(employees) ? employees : [])).filter(filterEmployeeRow)
        const wd  = workingDaysInMonth(months[i].year, months[i].month)
        const tp  = arr.reduce((s, e) => s + (e.days_present || 0), 0)
        const max = arr.length * wd
        return {
          month: MONTH_SHORT[months[i].month - 1],
          rate:  max > 0 ? Math.round((tp / max) * 100) : 0,
          count: arr.length,
        }
      }))
    }).catch(() => {})
  }, [view])

  // ── Yearly: fetch all 12 months in parallel ──────────────────────────────────
  useEffect(() => {
    if (view !== 'yearly') return
    setLoadingYearly(true)
    setYearlyData([])
    Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        ts.fetchMonthly(selYear, i + 1).catch(() => ({}))
      )
    ).then(results => {
      setYearlyData(results.map(d => (d?.rows || (Array.isArray(d) ? d : [])).filter(filterEmployeeRow)))
    }).finally(() => setLoadingYearly(false))
  }, [selYear, view])

  // ── Working days in currently selected month ─────────────────────────────────
  const workingDays = useMemo(
    () => workingDaysInMonth(selYear, selMonth),
    [selYear, selMonth]
  )

  // ── Departments list (from whichever data is available) ──────────────────────
  const departments = useMemo(() => {
    const src = dailyData.length > 0 ? dailyData : monthlyData
    return [...new Set(src.map(empDept))].filter(Boolean).sort()
  }, [dailyData, monthlyData])

  // ── Enriched monthly rows  (_absent, _rate appended) ─────────────────────────
  const enrichedMonthly = useMemo(() => {
    const filtered = deptFilter === ALL_DEPT
      ? monthlyData
      : monthlyData.filter(r => empDept(r) === deptFilter)
    return filtered.map(r => ({
      ...r,
      _absent: Math.max(0, workingDays - (r.days_present || 0)),
      _rate:   workingDays > 0
        ? Math.round(((r.days_present || 0) / workingDays) * 100)
        : 0,
    }))
  }, [monthlyData, workingDays, deptFilter])

  // ── Filtered daily rows ───────────────────────────────────────────────────────
  const filteredDaily = useMemo(() => {
    let d = deptFilter === ALL_DEPT ? dailyData : dailyData.filter(r => empDept(r) === deptFilter)
    if (statusFilter !== ALL_STATUS) d = d.filter(r => classifyDay(r) === statusFilter)
    return d
  }, [dailyData, deptFilter, statusFilter])

  // ── Daily status counts for summary bar ─────────────────────────────────────
  const dailyStatusCounts = useMemo(() => {
    const c = { present: 0, late: 0, half_day: 0, absent: 0 }
    dailyData.forEach(r => {
      const s = classifyDay(r)
      if (s in c) c[s]++
    })
    return c
  }, [dailyData])

  // ── KPI values ───────────────────────────────────────────────────────────────
  const kpiValues = useMemo(() =>
    ATTENDANCE_KPIS.map(k => ({
      ...k,
      ...k.compute({ daily: dailyData, totalActive: liveData.length, monthly: monthlyData }),
    })),
    [dailyData, liveData, monthlyData]
  )

  // ── Daily dept breakdown for charts ─────────────────────────────────────────
  const dailyDeptBreakdown = useMemo(() => {
    const map = {}
    dailyData.forEach(r => {
      const dept = empDept(r)
      if (!map[dept]) map[dept] = { dept, present: 0, late: 0, half_day: 0, absent: 0 }
      const s = classifyDay(r)
      map[dept][s] = (map[dept][s] || 0) + 1
    })
    return Object.values(map).sort((a, b) => (b.present + b.late + b.half_day) - (a.present + a.late + a.half_day))
  }, [dailyData])

  // ── Monthly dept breakdown for charts ────────────────────────────────────────
  const monthlyDeptBreakdown = useMemo(() => {
    const map = {}
    enrichedMonthly.forEach(r => {
      const dept = empDept(r)
      if (!map[dept]) map[dept] = { dept, present: 0, absent: 0, late: 0, employees: 0 }
      map[dept].employees++
      map[dept].present += r.days_present || 0
      map[dept].absent  += r._absent      || 0
      map[dept].late    += r.late_arrivals || 0
    })
    return Object.values(map).sort((a, b) => b.employees - a.employees)
  }, [enrichedMonthly])

  // ── Top absent employees (monthly) for alerts ────────────────────────────────
  const topAbsent = useMemo(() =>
    [...enrichedMonthly]
      .filter(r => (r._absent || 0) > 0)
      .sort((a, b) => (b._absent || 0) - (a._absent || 0))
      .slice(0, ATT_TOP_ABSENT_LIMIT),
    [enrichedMonthly]
  )

  // ── Yearly aggregation ───────────────────────────────────────────────────────
  const { yearlyEmployees, yearlyTrend } = useMemo(() => {
    if (yearlyData.length === 0) return { yearlyEmployees: [], yearlyTrend: [] }
    const map = {}
    yearlyData.forEach((employees, mi) => {
      ;(employees || []).forEach(emp => {
        const key = emp.employee_code || empName(emp)
        if (!map[key]) {
          map[key] = {
            code: key, name: empName(emp), dept: empDept(emp),
            months: Array(12).fill(null), totalPresent: 0,
          }
        }
        const wd = workingDaysInMonth(selYear, mi + 1)
        map[key].months[mi] = {
          present: emp.days_present || 0,
          wd,
          rate: wd > 0 ? Math.round(((emp.days_present || 0) / wd) * 100) : 0,
        }
        map[key].totalPresent += emp.days_present || 0
      })
    })
    const totalWd = MONTH_SHORT.reduce((s, _, i) => s + workingDaysInMonth(selYear, i + 1), 0)
    const employees = Object.values(map).map(e => ({
      ...e,
      yearRate: totalWd > 0 ? Math.round((e.totalPresent / totalWd) * 100) : 0,
    })).sort((a, b) => a.name.localeCompare(b.name))

    const trend = yearlyData.map((arr, i) => {
      const wd  = workingDaysInMonth(selYear, i + 1)
      const tp  = (arr || []).reduce((s, e) => s + (e.days_present || 0), 0)
      const max = (arr || []).length * wd
      return { month: MONTH_SHORT[i], rate: max > 0 ? Math.round((tp / max) * 100) : 0, employees: (arr || []).length }
    })
    return { yearlyEmployees: employees, yearlyTrend: trend }
  }, [yearlyData, selYear])

  // ────────────────────────────────────────────────────────────────────────────
  // VIEW: OVERVIEW
  // ────────────────────────────────────────────────────────────────────────────
  const renderOverview = () => (
    <div className="space-y-5">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpiValues.map(k => <KpiTile key={k.id} kpi={k} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 6-month rate trend */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <HeroIcons.ChartBarIcon className="w-4 h-4 text-blue-500" />
            6-Month Attendance Rate
          </h3>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                <Tooltip formatter={(v, n) => [`${v}%`, 'Rate']} />
                <Line type="monotone" dataKey="rate" stroke="#3b82f6" strokeWidth={2}
                  dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState loading={loadingMonthly} loadingMsg="Building trend…" icon="ChartBarIcon" />
          )}
        </div>

        {/* Today dept breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <HeroIcons.BuildingOfficeIcon className="w-4 h-4 text-slate-400" />
            Today by Department
          </h3>
          {dailyDeptBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyDeptBreakdown} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="dept" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="present"  name="Present"  fill="#10b981" stackId="a" radius={[0,0,0,0]} />
                <Bar dataKey="late"     name="Late"     fill="#f59e0b" stackId="a" />
                <Bar dataKey="half_day" name="Half Day" fill="#f97316" stackId="a" />
                <Bar dataKey="absent"   name="Absent"   fill="#ef4444" stackId="a" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState loading={loadingDaily} icon="BuildingOfficeIcon" msg="No punch data for today yet" />
          )}
        </div>
      </div>

      {/* Late arrivals alert strip */}
      {dailyData.filter(r => r.is_late).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
            <HeroIcons.ClockIcon className="w-4 h-4" />
            Late Arrivals Today — {dailyData.filter(r => r.is_late).length} employee{dailyData.filter(r => r.is_late).length !== 1 ? 's' : ''}
          </h3>
          <div className="flex flex-wrap gap-2">
            {dailyData.filter(r => r.is_late).map((r, i) => (
              <span key={i} className="bg-white text-amber-800 text-xs px-2.5 py-1 rounded-full border border-amber-200">
                {empName(r)} — {fmtTime(r.first_in)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  // ────────────────────────────────────────────────────────────────────────────
  // VIEW: DAILY
  // ────────────────────────────────────────────────────────────────────────────
  const renderDaily = () => (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Date</label>
          <input type="date" value={selectedDate} max={TODAY_STR}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="min-w-44">
          <label className="block text-xs text-slate-500 mb-1">Department</label>
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
            <option value={ALL_DEPT}>All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        {/* Status filter pills */}
        <div className="flex flex-wrap gap-1.5 ml-auto">
          {[ALL_STATUS, 'present', 'late', 'half_day', 'absent'].map(s => {
            const label = s === ALL_STATUS
              ? `All (${dailyData.length})`
              : `${ATTENDANCE_STATUS[s].label} (${dailyStatusCounts[s] ?? 0})`
            return (
              <button key={s} type="button" onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                  statusFilter === s ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>{label}</button>
            )
          })}
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {['present','late','half_day','absent'].map(s => {
          const m = ATTENDANCE_STATUS[s]
          return (
            <div key={s} className={`${m.bg} rounded-xl p-4 border ${m.border} text-center`}>
              <div className={`text-2xl font-bold ${m.text}`}>{dailyStatusCounts[s] ?? 0}</div>
              <div className={`text-xs font-medium ${m.text} mt-1`}>{m.label}</div>
            </div>
          )
        })}
      </div>

      {/* Table */}
      {loadingDaily ? (
        <EmptyState loading icon="CalendarDaysIcon" loadingMsg={ATT_COPY.loading} />
      ) : filteredDaily.length === 0 ? (
        <EmptyState icon="CalendarDaysIcon" msg={ATT_COPY.dailyEmpty} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">{filteredDaily.length} employees · {selectedDate}</span>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
              {ATT_COPY.sourceTag}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {ATTENDANCE_DAILY_COLS.map(c => (
                    <th key={c.id} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDaily.map((r, i) => {
                  const status  = classifyDay(r)
                  const rowTone = ATTENDANCE_STATUS[status]?.row || ''
                  return (
                    <tr key={i} className={`${rowTone} hover:bg-slate-50 transition-colors`}>
                      {ATTENDANCE_DAILY_COLS.map(c => {
                        const v = c.accessor(r)
                        if (c.cellType === 'att_status') {
                          return <td key={c.id} className="px-3 py-2.5"><StatusBadge status={v} /></td>
                        }
                        if (c.cellType === 'hours_worked') {
                          if (r.open_shift) {
                            return (
                              <td key={c.id} className="px-3 py-2.5 whitespace-nowrap">
                                <span className={OPEN_SHIFT_INDICATOR.badgeCls} title={OPEN_SHIFT_INDICATOR.tooltip}>
                                  <span className={OPEN_SHIFT_INDICATOR.dotCls} />
                                  {OPEN_SHIFT_INDICATOR.label}
                                  {OPEN_SHIFT_INDICATOR.maxCreditedH > 0 && Number(v) > 0 && (
                                    <span className="ml-1 opacity-75">({Number(v).toFixed(1)}h)</span>
                                  )}
                                </span>
                              </td>
                            )
                          }
                          return (
                            <td key={c.id} className="px-3 py-2.5 text-slate-700 whitespace-nowrap">
                              {Number(v) > 0 ? `${Number(v).toFixed(1)}h` : '\u2014'}
                            </td>
                          )
                        }
                        return <td key={c.id} className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{v}</td>
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="text-xs text-slate-400">{ATT_COPY.absenceNote}</p>
    </div>
  )

  // ────────────────────────────────────────────────────────────────────────────
  // VIEW: MONTHLY
  // ────────────────────────────────────────────────────────────────────────────
  const renderMonthly = () => {
    const pieData = (() => {
      const n = enrichedMonthly.length
      if (n === 0) return []
      const good = enrichedMonthly.filter(r => r._rate >= ATT_GOOD_RATE_PCT).length
      const warn = enrichedMonthly.filter(r => r._rate >= ATT_WARN_RATE_PCT && r._rate < ATT_GOOD_RATE_PCT).length
      const poor = n - good - warn
      return [
        { name: `Good  ≥${ATT_GOOD_RATE_PCT}%`, value: good, fill: '#10b981' },
        { name: `Warn  ≥${ATT_WARN_RATE_PCT}%`, value: warn, fill: '#f59e0b' },
        { name: `Poor  <${ATT_WARN_RATE_PCT}%`, value: poor, fill: '#ef4444' },
      ].filter(d => d.value > 0)
    })()

    return (
      <div className="space-y-4">
        {/* Controls */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Month</label>
            <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
              {MONTH_FULL.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Year</label>
            <select value={selYear} onChange={e => setSelYear(Number(e.target.value))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
              {[selYear - 1, selYear, selYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="min-w-44">
            <label className="block text-xs text-slate-500 mb-1">Department</label>
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value={ALL_DEPT}>All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="ml-auto bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600">
            <span className="font-semibold">{workingDays}</span> working days in {MONTH_FULL[selMonth - 1]} {selYear}
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Days Present vs Absent by Department</h3>
            {monthlyDeptBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={monthlyDeptBreakdown} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="dept" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="present" name="Present Days" fill="#3b82f6" radius={[3,3,0,0]} />
                  <Bar dataKey="absent"  name="Absent Days"  fill="#f87171" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState loading={loadingMonthly} icon="ChartBarIcon" msg={ATT_COPY.monthlyEmpty} />
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Attendance Rate Distribution</h3>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                    paddingAngle={3} dataKey="value">
                    {pieData.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v, name) => [`${v} employees`, name]} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState loading={loadingMonthly} icon="ChartPieIcon" msg={ATT_COPY.monthlyEmpty} />
            )}
          </div>
        </div>

        {/* Top absent alert */}
        {topAbsent.length > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-rose-800 mb-2 flex items-center gap-1.5">
              <HeroIcons.ExclamationTriangleIcon className="w-4 h-4" />
              High Absence — {MONTH_FULL[selMonth - 1]} {selYear}
            </h3>
            <div className="flex flex-wrap gap-2">
              {topAbsent.map((r, i) => (
                <span key={i} className="bg-white text-rose-700 text-xs px-2.5 py-1 rounded-full border border-rose-200 flex items-center gap-1">
                  {empName(r)}
                  <span className="font-bold">{r._absent}d</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Monthly employee table */}
        {loadingMonthly ? (
          <EmptyState loading icon="CalendarIcon" loadingMsg={ATT_COPY.loading} />
        ) : enrichedMonthly.length === 0 ? (
          <EmptyState icon="CalendarIcon" msg={ATT_COPY.monthlyEmpty} />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">{enrichedMonthly.length} employees · {MONTH_FULL[selMonth - 1]} {selYear}</span>
              <span className="text-xs text-slate-400">{workingDays} working days</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {ATTENDANCE_MONTHLY_COLS.map(c => (
                      <th key={c.id} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {enrichedMonthly.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      {ATTENDANCE_MONTHLY_COLS.map(c => {
                        const v = c.accessor(r)
                        if (c.cellType === 'att_rate') {
                          return (
                            <td key={c.id} className="px-3 py-2.5">
                              <span className={`font-semibold ${rateColor(v)}`}>{v}%</span>
                            </td>
                          )
                        }
                        if (c.cellType === 'absent_count') {
                          return (
                            <td key={c.id} className="px-3 py-2.5">
                              <span className={v > 0 ? 'text-rose-600 font-medium' : 'text-slate-400'}>{v}</span>
                            </td>
                          )
                        }
                        if (c.cellType === 'late_count') {
                          return (
                            <td key={c.id} className="px-3 py-2.5">
                              <span className={v > 0 ? 'text-amber-600 font-medium' : 'text-slate-400'}>{v}</span>
                            </td>
                          )
                        }
                        return <td key={c.id} className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{v}</td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <p className="text-xs text-slate-400">{ATT_COPY.absenceNote} · {ATT_COPY.leaveNote}</p>
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────────────────────
  // VIEW: YEARLY
  // ────────────────────────────────────────────────────────────────────────────
  const renderYearly = () => (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Year</label>
          <select value={selYear}
            onChange={e => { setSelYear(Number(e.target.value)); setYearlyData([]) }}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
            {[selYear - 2, selYear - 1, selYear].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="min-w-44">
          <label className="block text-xs text-slate-500 mb-1">Department</label>
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
            <option value={ALL_DEPT}>All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        {loadingYearly && (
          <div className="flex items-center gap-2 text-xs text-blue-600 ml-auto">
            <Spinner /> {ATT_COPY.yearlyLoading}
          </div>
        )}
      </div>

      {/* Yearly trend line chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <HeroIcons.ChartBarIcon className="w-4 h-4 text-blue-500" />
          {selYear} — Monthly Attendance Rate
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={yearlyTrend} margin={{ top: 5, right: 30, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(v, name) => [
                name === 'rate' ? `${v}%` : `${v} employees`,
                name === 'rate' ? 'Attendance Rate' : 'Active Employees',
              ]}
            />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }}
              formatter={v => v === 'rate' ? 'Attendance Rate' : 'Active Employees'} />
            <Line yAxisId="left"  type="monotone" dataKey="rate"      stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            <Line yAxisId="right" type="monotone" dataKey="employees" stroke="#10b981" strokeWidth={1} dot={{ r: 3 }} strokeDasharray="5 3" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Per-employee yearly grid */}
      {loadingYearly && yearlyEmployees.length === 0 ? (
        <EmptyState loading icon="CalendarIcon" loadingMsg={ATT_COPY.yearlyLoading} />
      ) : yearlyEmployees.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">{yearlyEmployees.filter(e => deptFilter === ALL_DEPT || e.dept === deptFilter).length} employees · {selYear}</span>
            <span className="text-xs text-slate-400">Rate = Present / Working days · Green ≥{ATT_GOOD_RATE_PCT}% · Amber ≥{ATT_WARN_RATE_PCT}%</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap sticky left-0 bg-slate-50 z-10">Employee</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Dept</th>
                  {MONTH_SHORT.map(m => (
                    <th key={m} className="text-center px-2 py-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">{m}</th>
                  ))}
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider bg-slate-100">Year</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {yearlyEmployees
                  .filter(e => deptFilter === ALL_DEPT || e.dept === deptFilter)
                  .map((emp, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap sticky left-0 bg-white z-10 border-r border-slate-100">{emp.name}</td>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{emp.dept}</td>
                      {emp.months.map((m, mi) => (
                        <td key={mi} className="px-2 py-2 text-center">
                          {m ? (
                            <span className={`font-semibold text-xs ${rateColor(m.rate)}`}>{m.rate}%</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-center bg-slate-50">
                        <span className={`font-bold text-sm ${rateColor(emp.yearRate)}`}>{emp.yearRate}%</span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : !loadingYearly && (
        <EmptyState icon="CalendarIcon" msg={ATT_COPY.noData} />
      )}
    </div>
  )

  // ────────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* View switcher tabs */}
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-2 flex gap-1 overflow-x-auto">
        {ATTENDANCE_VIEWS.map(v => {
          const Icon    = HeroIcons[v.icon] || HeroIcons.CalendarIcon
          const isActive = view === v.id
          return (
            <button key={v.id} type="button" onClick={() => setView(v.id)} title={v.description}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}>
              <Icon className="w-4 h-4" />
              {v.label}
            </button>
          )
        })}
      </div>

      {/* Render active view */}
      {view === 'overview' && renderOverview()}
      {view === 'summary'  && <SummaryTab />}
      {view === 'daily'    && renderDaily()}
      {view === 'monthly'  && renderMonthly()}
      {view === 'yearly'   && renderYearly()}
      {view === 'reports'  && <ReportsTab todayStr={TODAY_STR} />}
    </div>
  )
}
