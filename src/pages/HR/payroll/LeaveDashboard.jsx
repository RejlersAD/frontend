/**
 * Leave Dashboard — HR Leave Management
 * ======================================
 * Displays leave data imported from "Summary Leave Calculation-RAD-Updated.xlsx"
 * Source: /api/v1/payroll/leave-records/
 *
 * Views:  Overview  ·  Employee Detail  ·  Reports
 * All config (thresholds, colours, columns) → hrLeave.config.js
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import * as HeroIcons from '@heroicons/react/24/outline'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import payrollService from '../../../services/payroll.service'
import { BRANCHES, getBranch, LEAVE_YEAR, DEFAULT_ANNUAL_ENTITLEMENT, LEAVE_ENCASHMENT_WORKING_DAYS } from '../../../config/hrLeave.config'

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG — all soft-coded constants
// ─────────────────────────────────────────────────────────────────────────────
const YEAR = LEAVE_YEAR
const ANNUAL_ENTITLEMENT = DEFAULT_ANNUAL_ENTITLEMENT

const BALANCE_TIERS = [
  { label: 'Surplus (> 5)',   min: 5,   max: Infinity, color: '#10b981', bg: 'bg-emerald-50',  text: 'text-emerald-700',  border: 'border-emerald-200' },
  { label: 'Low (0 – 5)',     min: 0,   max: 5,        color: '#f59e0b', bg: 'bg-amber-50',    text: 'text-amber-700',    border: 'border-amber-200' },
  { label: 'Negative',        min: -Infinity, max: 0,  color: '#ef4444', bg: 'bg-rose-50',     text: 'text-rose-700',     border: 'border-rose-200' },
]

const balanceTier = (balance) => {
  const b = Number(balance)
  return BALANCE_TIERS.find(t => b > t.min || (b >= t.min && t.min === t.max)) ||
         BALANCE_TIERS.find(t => b >= t.min && b < t.max) ||
         (b >= 5 ? BALANCE_TIERS[0] : b >= 0 ? BALANCE_TIERS[1] : BALANCE_TIERS[2])
}

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const LIST_COLS = [
  { id: 'name',    label: 'Employee',    accessor: r => r.employee_name },
  { id: 'code',    label: 'Code',        accessor: r => r.employee_code || '—' },
  { id: 'dept',    label: 'Department',  accessor: r => r.department || '—' },
  { id: 'title',   label: 'Title',       accessor: r => r.job_title   || '—' },
  { id: 'joining', label: 'Joined',      accessor: r => r.joining_date ? r.joining_date.slice(0, 10) : '—' },
  { id: 'earned',  label: 'Earned',      accessor: r => Number(r.total_earned).toFixed(2),  cellType: 'number' },
  { id: 'taken',   label: 'Taken',       accessor: r => Number(r.total_taken).toFixed(2),   cellType: 'taken' },
  { id: 'encashed',label: 'Encashed',    accessor: r => Number(r.total_encashed).toFixed(2), cellType: 'number' },
  { id: 'balance', label: 'Balance',     accessor: r => Number(r.leave_balance).toFixed(2), cellType: 'balance' },
]

const PAGE_SIZE_OPTIONS = [25, 50, 100, 'All']
const ALL_DEPTS = 'all'

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
const Spinner = () => (
  <svg className="animate-spin w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
  </svg>
)

const BalanceBadge = ({ value }) => {
  const tier = balanceTier(value)
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${tier.bg} ${tier.text} ${tier.border}`}>
      {Number(value).toFixed(1)} d
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
const VIEWS = [
  { id: 'overview',    label: 'Overview',   icon: 'ChartBarSquareIcon' },
  { id: 'list',        label: 'Employees',  icon: 'TableCellsIcon' },
  { id: 'detail',      label: 'Detail',     icon: 'UserCircleIcon' },
  { id: 'requests',    label: 'Requests',   icon: 'ClipboardDocumentListIcon' },
  { id: 'encashment',  label: 'Encashment', icon: 'BanknotesIcon' },
]

export default function LeaveDashboard() {
  const [view,        setView]        = useState('overview')
  const [records,     setRecords]     = useState([])    // full unfiltered list for counts
  const [loading,     setLoading]     = useState(false)
  const [branch,      setBranch]      = useState(null)  // null = All | 'RAD' | 'RIN'
  const [search,      setSearch]      = useState('')
  const [deptFilter,  setDeptFilter]  = useState(ALL_DEPTS)
  const [selected,    setSelected]    = useState(null)  // full record with monthly breakdown
  const [detailLoading, setDetailLoading] = useState(false)
  const [pageSize,    setPageSize]    = useState(50)
  const [page,        setPage]        = useState(1)
  const [sortCol,     setSortCol]     = useState('name')
  const [sortAsc,     setSortAsc]     = useState(true)

  // ── Requests view state ────────────────────────────────────────────────────
  // 'rm_pending'  → PENDING requests (awaiting Reporting Manager)
  // 'hr_pending'  → RM_APPROVED requests (awaiting HR final approval)
  // 'new'         → Submit new request form
  // 'history'     → Resolved requests
  const [reqTab,       setReqTab]       = useState('rm_pending')
  const [leaveTypes,   setLeaveTypes]   = useState([])
  const [requests,     setRequests]     = useState([])
  const [reqLoading,   setReqLoading]   = useState(false)
  const [reqNote,      setReqNote]      = useState('')       // reviewer note for approve/reject
  const [formState,    setFormState]    = useState({
    employee_name: '', employee_code: '', department: '',
    leave_type: '', start_date: '', end_date: '', reason: '',
  })
  const [formBusy,     setFormBusy]     = useState(false)
  const [formMsg,      setFormMsg]      = useState(null)     // { type: 'ok'|'err', text }
  const [reviewBusy,   setReviewBusy]   = useState(null)     // UUID being reviewed

  // ── Encashment view state ──────────────────────────────────────────────────
  const today        = new Date()
  const [encYear,    setEncYear]    = useState(today.getFullYear())
  const [encMonth,   setEncMonth]   = useState(today.getMonth() + 1)
  const [encStatus,  setEncStatus]  = useState(null)   // LeaveEncashmentRun | null | 'not_run'
  const [encPreview, setEncPreview] = useState(null)   // preview rows array
  const [encLoading, setEncLoading] = useState(false)
  const [encRunning, setEncRunning] = useState(false)
  const [encMsg,     setEncMsg]     = useState(null)   // { type: 'ok'|'err', text }
  const [encConfirm, setEncConfirm] = useState(false)  // show confirm modal

  // ── Fetch all records ──────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    const params = { year: YEAR, page_size: 500 }
    if (branch) params.branch = branch
    payrollService.getLeaveRecords(params)
      .then(d => setRecords(Array.isArray(d) ? d : (d?.results ?? [])))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false))
  }, [branch])

  // ── Departments list ───────────────────────────────────────────────────────
  const departments = useMemo(() =>
    [...new Set(records.map(r => r.department).filter(Boolean))].sort(),
    [records]
  )

  // ── Filtered + sorted list ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let d = records
    if (deptFilter !== ALL_DEPTS) d = d.filter(r => r.department === deptFilter)
    if (search.trim()) {
      const s = search.toLowerCase()
      d = d.filter(r =>
        r.employee_name?.toLowerCase().includes(s) ||
        r.employee_code?.toLowerCase().includes(s) ||
        r.job_title?.toLowerCase().includes(s)
      )
    }
    return [...d].sort((a, b) => {
      let av = LIST_COLS.find(c => c.id === sortCol)?.accessor(a) ?? ''
      let bv = LIST_COLS.find(c => c.id === sortCol)?.accessor(b) ?? ''
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
      return sortAsc ? cmp : -cmp
    })
  }, [records, deptFilter, search, sortCol, sortAsc])

  const totalPages = pageSize === 'All' ? 1 : Math.ceil(filtered.length / pageSize)
  const paginated  = pageSize === 'All' ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize)

  // ── Sort toggle ────────────────────────────────────────────────────────────
  const toggleSort = (id) => {
    if (sortCol === id) setSortAsc(a => !a)
    else { setSortCol(id); setSortAsc(true) }
  }

  // ── Load detail ────────────────────────────────────────────────────────────
  const loadDetail = useCallback((rec) => {
    setDetailLoading(true)
    setView('detail')
    payrollService.getLeaveRecord(rec.id)
      .then(d => setSelected(d))
      .catch(() => setSelected(rec))
      .finally(() => setDetailLoading(false))
  }, [])

  // ── Load leave types (once) ────────────────────────────────────────────────
  useEffect(() => {
    payrollService.getLeaveTypes()
      .then(d => setLeaveTypes(Array.isArray(d) ? d : (d?.results ?? [])))
      .catch(() => {})
  }, [])

  // ── Role checks ───────────────────────────────────────────────────────────
  const rbacUser    = useSelector(s => s.rbac?.currentUser)
  const authUser    = useSelector(s => s.auth?.user)
  const isHRManager = (
    authUser?.is_staff ||
    authUser?.is_superuser ||
    rbacUser?.roles?.some(r =>
      r.code?.startsWith('hr') || r.code === 'admin' || r.code === 'super_admin'
    )
  ) ?? false
  // Reporting Manager: any staff user can action Stage-1
  const isManager = authUser?.is_staff || authUser?.is_superuser ||
    rbacUser?.roles?.some(r => (r.level ?? 0) >= 3 || r.code?.includes('manager') || r.code?.includes('senior'))

  // ── Load requests whenever requests tab is active ──────────────────────────
  useEffect(() => {
    if (view !== 'requests') return
    setReqLoading(true)
    let params = {}
    if      (reqTab === 'rm_pending')  params = { status: 'PENDING' }
    else if (reqTab === 'hr_pending')  params = { status: 'RM_APPROVED' }
    else if (reqTab === 'history')     params = { status: 'APPROVED,REJECTED,CANCELLED,RM_REJECTED' }
    // 'new' tab: no fetch needed
    if (reqTab !== 'new') {
      payrollService.getLeaveRequests(params)
        .then(d => setRequests(Array.isArray(d) ? d : (d?.results ?? [])))
        .catch(() => setRequests([]))
        .finally(() => setReqLoading(false))
    } else {
      setReqLoading(false)
    }
  }, [view, reqTab])

  // ── Working days preview for the new-request form ─────────────────────────
  const formWorkDays = useMemo(() => {
    if (!formState.start_date || !formState.end_date) return null
    const s = new Date(formState.start_date)
    const e = new Date(formState.end_date)
    if (e < s) return null
    let d = 0; let c = new Date(s)
    while (c <= e) { if (c.getDay() !== 0 && c.getDay() !== 6) d++; c.setDate(c.getDate() + 1) }
    return d
  }, [formState.start_date, formState.end_date])

  // ── Submit new leave request ───────────────────────────────────────────────
  const submitRequest = async () => {
    if (!formState.employee_name || !formState.leave_type || !formState.start_date || !formState.end_date) {
      setFormMsg({ type: 'err', text: 'Please fill in all required fields.' })
      return
    }
    setFormBusy(true)
    setFormMsg(null)
    try {
      await payrollService.createLeaveRequest({
        employee_name: formState.employee_name,
        employee_code: formState.employee_code || undefined,
        department:    formState.department    || undefined,
        leave_type:    Number(formState.leave_type),
        start_date:    formState.start_date,
        end_date:      formState.end_date,
        reason:        formState.reason,
      })
      setFormMsg({ type: 'ok', text: 'Leave request submitted successfully.' })
      setFormState({ employee_name: '', employee_code: '', department: '', leave_type: '', start_date: '', end_date: '', reason: '' })
    } catch {
      setFormMsg({ type: 'err', text: 'Failed to submit request. Please try again.' })
    } finally {
      setFormBusy(false)
    }
  }

  // ── Approve / Reject helper ────────────────────────────────────────────────
  const reviewRequest = async (id, action) => {
    setReviewBusy(id)
    try {
      if (action === 'rm_approve') await payrollService.rmApproveLeaveRequest(id, reqNote)
      else if (action === 'rm_reject') await payrollService.rmRejectLeaveRequest(id, reqNote)
      else if (action === 'approve')   await payrollService.approveLeaveRequest(id, reqNote)
      else                             await payrollService.rejectLeaveRequest(id, reqNote)
      setRequests(prev => prev.filter(r => r.id !== id))
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Action failed'
      setFormMsg({ type: 'err', text: msg })
    }
    finally { setReviewBusy(null); setReqNote('') }
  }

  const cancelRequest = async (id) => {
    setReviewBusy(id)
    try {
      await payrollService.cancelLeaveRequest(id)
      setRequests(prev => prev.filter(r => r.id !== id))
    } catch {}
    finally { setReviewBusy(null) }
  }

  // ── Initialize Current Month Leave ─────────────────────────────────────────
  const [initBusy, setInitBusy] = useState(false)
  const [initMsg, setInitMsg] = useState(null)  // { type: 'ok'|'err', text }
  
  const initializeCurrentMonthLeave = async () => {
    if (!window.confirm(
      `Initialize current month leave balance to 1.83 days for all employees?\n\n` +
      `This will set the earned value for ${new Date().toLocaleString('default', { month: 'long' })} ${YEAR} ` +
      `to the standard monthly accrual (1.83 days = 22 days/year ÷ 12 months).`
    )) return
    
    setInitBusy(true)
    setInitMsg(null)
    try {
      const result = await payrollService.initializeCurrentMonthLeave({ 
        year: YEAR,
        month: new Date().getMonth() + 1,  // current month
        branch: branch || undefined,
      })
      setInitMsg({ 
        type: 'ok', 
        text: `✅ Initialized ${result.records_created} new records, updated ${result.records_updated} existing records. Monthly accrual: ${result.monthly_accrual.toFixed(2)} days.` 
      })
      // Reload records to show updated balances
      setTimeout(() => {
        const params = { year: YEAR, page_size: 500 }
        if (branch) params.branch = branch
        payrollService.getLeaveRecords(params)
          .then(d => setRecords(Array.isArray(d) ? d : (d?.results ?? [])))
          .catch(() => {})
      }, 500)
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Initialization failed'
      setInitMsg({ type: 'err', text: `❌ ${msg}` })
    } finally {
      setInitBusy(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // KPI computations
  // ─────────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total     = records.length
    const negative  = records.filter(r => Number(r.leave_balance) < 0).length
    const low       = records.filter(r => Number(r.leave_balance) >= 0 && Number(r.leave_balance) < 5).length
    const surplus   = records.filter(r => Number(r.leave_balance) >= 5).length
    const totalTaken  = records.reduce((s, r) => s + Number(r.total_taken  || 0), 0)
    const totalEncash = records.reduce((s, r) => s + Number(r.total_encashed || 0), 0)
    const avgBalance  = total > 0
      ? (records.reduce((s, r) => s + Number(r.leave_balance || 0), 0) / total).toFixed(2)
      : 0
    return { total, negative, low, surplus, totalTaken, totalEncash, avgBalance }
  }, [records])

  // ─────────────────────────────────────────────────────────────────────────
  // Chart data
  // ─────────────────────────────────────────────────────────────────────────
  const deptChart = useMemo(() => {
    const map = {}
    records.forEach(r => {
      const d = r.department || 'Unassigned'
      if (!map[d]) map[d] = { dept: d.slice(0, 15), taken: 0, encashed: 0, balance: 0, count: 0 }
      map[d].taken    += Number(r.total_taken    || 0)
      map[d].encashed += Number(r.total_encashed || 0)
      map[d].balance  += Number(r.leave_balance  || 0)
      map[d].count++
    })
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 12)
  }, [records])

  const balanceDist = useMemo(() => [
    { name: 'Surplus ≥5d',  value: kpis.surplus,  fill: '#10b981' },
    { name: 'Low 0–5d',     value: kpis.low,       fill: '#f59e0b' },
    { name: 'Negative',     value: kpis.negative,  fill: '#ef4444' },
  ].filter(d => d.value > 0), [kpis])

  const topNegative = useMemo(() =>
    [...records]
      .filter(r => Number(r.leave_balance) < 0)
      .sort((a, b) => Number(a.leave_balance) - Number(b.leave_balance))
      .slice(0, 10),
    [records]
  )

  // ─────────────────────────────────────────────────────────────────────────
  // OVERVIEW VIEW
  // ─────────────────────────────────────────────────────────────────────────
  const renderOverview = () => (
    <div className="space-y-5">
      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: 'Total Employees', value: kpis.total,      icon: 'UsersIcon',         bg: 'bg-blue-50',    text: 'text-blue-700' },
          { label: 'Surplus Balance', value: kpis.surplus,    icon: 'CheckCircleIcon',   bg: 'bg-emerald-50', text: 'text-emerald-700' },
          { label: 'Low Balance',     value: kpis.low,        icon: 'ExclamationCircleIcon', bg: 'bg-amber-50', text: 'text-amber-700' },
          { label: 'Negative Balance',value: kpis.negative,   icon: 'XCircleIcon',       bg: 'bg-rose-50',    text: 'text-rose-700' },
          { label: 'Total Days Taken',value: kpis.totalTaken.toFixed(0), icon: 'CalendarDaysIcon', bg: 'bg-purple-50', text: 'text-purple-700' },
          { label: 'Avg Balance',     value: `${kpis.avgBalance}d`, icon: 'ScaleIcon',   bg: 'bg-slate-50',   text: 'text-slate-700' },
        ].map(k => {
          const Icon = HeroIcons[k.icon] || HeroIcons.ChartBarIcon
          return (
            <div key={k.label} className={`${k.bg} rounded-xl p-4 border border-white/80 shadow-sm`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">{k.label}</span>
                <Icon className={`w-4 h-4 ${k.text}`} />
              </div>
              <div className={`text-2xl font-bold ${k.text}`}>{loading ? '…' : k.value}</div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Dept bar chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <HeroIcons.BuildingOfficeIcon className="w-4 h-4 text-slate-400" />
            Leave Taken + Encashed by Department
          </h3>
          {deptChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={deptChart} margin={{ top: 5, right: 20, bottom: 30, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="dept" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="taken"    name="Days Taken"    fill="#3b82f6" radius={[3,3,0,0]} />
                <Bar dataKey="encashed" name="Days Encashed" fill="#8b5cf6" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-32 flex items-center justify-center text-slate-400 text-sm">{loading ? <Spinner /> : 'No data'}</div>}
        </div>

        {/* Balance distribution pie */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <HeroIcons.ChartPieIcon className="w-4 h-4 text-slate-400" />
            Leave Balance Distribution
          </h3>
          {balanceDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={balanceDist} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                  paddingAngle={3} dataKey="value" nameKey="name" label={({ name, value }) => `${value}`}>
                  {balanceDist.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [`${v} employees`, n]} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="h-32 flex items-center justify-center text-slate-400 text-sm">{loading ? <Spinner /> : 'No data'}</div>}
        </div>
      </div>

      {/* Negative balance alert */}
      {topNegative.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-rose-800 mb-2 flex items-center gap-1.5">
            <HeroIcons.ExclamationTriangleIcon className="w-4 h-4" />
            Employees with Negative Leave Balance ({topNegative.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {topNegative.map((r, i) => (
              <button key={i} type="button" onClick={() => loadDetail(r)}
                className="bg-white text-rose-700 text-xs px-3 py-1.5 rounded-full border border-rose-200 hover:bg-rose-100 transition flex items-center gap-1.5">
                <span>{r.employee_name}</span>
                <span className="font-bold">{Number(r.leave_balance).toFixed(1)}d</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // LIST VIEW
  // ─────────────────────────────────────────────────────────────────────────
  const renderList = () => (
    <div className="space-y-3">
      {/* Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <label className="block text-xs text-slate-500 mb-1">Search employee</label>
          <div className="relative">
            <HeroIcons.MagnifyingGlassIcon className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Name, code, or title…"
              className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="min-w-44">
          <label className="block text-xs text-slate-500 mb-1">Department</label>
          <select value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setPage(1) }}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
            <option value={ALL_DEPTS}>All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Rows</label>
          <select value={pageSize} onChange={e => { setPageSize(e.target.value === 'All' ? 'All' : Number(e.target.value)); setPage(1) }}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
            {PAGE_SIZE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="ml-auto text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          <span className="font-semibold">{filtered.length}</span> of {records.length} employees
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-32 gap-2 text-slate-400 text-sm"><Spinner /> Loading…</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {LIST_COLS.map(c => (
                    <th key={c.id} onClick={() => toggleSort(c.id)}
                      className="text-left px-3 py-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-slate-100 transition select-none">
                      <div className="flex items-center gap-1">
                        {c.label}
                        {sortCol === c.id && (
                          sortAsc
                            ? <HeroIcons.ChevronUpIcon className="w-3 h-3" />
                            : <HeroIcons.ChevronDownIcon className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                  ))}                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">Branch</th>                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.length === 0 ? (
                  <tr><td colSpan={LIST_COLS.length + 2} className="text-center py-10 text-slate-400 text-sm">No records found</td></tr>
                ) : paginated.map((r) => {
                  const balance   = Number(r.leave_balance)
                  const branchMeta = getBranch(r.branch)
                  return (
                    <tr key={r.id} className={`hover:bg-slate-50 transition-colors ${balance < 0 ? 'bg-rose-50/30' : ''}`}>
                      {LIST_COLS.map(c => {
                        const v = c.accessor(r)
                        if (c.cellType === 'balance') {
                          return <td key={c.id} className="px-3 py-2.5"><BalanceBadge value={r.leave_balance} /></td>
                        }
                        if (c.cellType === 'taken') {
                          return <td key={c.id} className={`px-3 py-2.5 font-medium ${Number(r.total_taken) > 0 ? 'text-blue-700' : 'text-slate-400'}`}>{v}</td>
                        }
                        return <td key={c.id} className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{v}</td>
                      })}
                      {/* Branch badge */}
                      <td className="px-3 py-2.5">
                        {branchMeta ? (
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${branchMeta.badgeBg} ${branchMeta.badgeText} ${branchMeta.badgeBorder}`}>
                            {branchMeta.label}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">{r.branch || '—'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <button type="button" onClick={() => loadDetail(r)}
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                          Detail <HeroIcons.ArrowRightIcon className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pageSize !== 'All' && totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-2.5 py-1 text-xs rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-50">← Prev</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-2.5 py-1 text-xs rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-50">Next →</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // DETAIL VIEW
  // ─────────────────────────────────────────────────────────────────────────
  const renderDetail = () => {
    if (!selected && !detailLoading) return (
      <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">
        <HeroIcons.UserCircleIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
        Select an employee from the Employees tab
      </div>
    )
    if (detailLoading) return (
      <div className="flex items-center justify-center h-32 gap-2 text-slate-400 text-sm"><Spinner /> Loading…</div>
    )

    const monthly = selected?.monthly_breakdown ?? []
    const chartData = monthly.map(m => ({
      month:   MONTH_LABELS[(m.month || 1) - 1],
      earned:  Number(m.earned   || 0),
      taken:   Number(m.taken    || 0),
      encashed:Number(m.encashed || 0),
      balance: Number(m.balance  || 0),
    }))
    const tier = balanceTier(selected.leave_balance)

    return (
      <div className="space-y-4">
        {/* Back button */}
        <button type="button" onClick={() => setView('list')}
          className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
          <HeroIcons.ArrowLeftIcon className="w-4 h-4" /> Back to list
        </button>

        {/* Header card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{selected.employee_name}</h2>
              <p className="text-sm text-slate-500 mt-0.5">{selected.job_title || '—'}</p>
              <div className="flex flex-wrap gap-2 mt-2 text-xs text-slate-600">
                {selected.employee_code && <span className="bg-slate-100 px-2 py-0.5 rounded">#{selected.employee_code}</span>}
                {selected.department    && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">{selected.department}</span>}
                {selected.joining_date  && <span className="bg-slate-100 px-2 py-0.5 rounded">Joined {selected.joining_date.slice(0, 10)}</span>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500 mb-1">Leave Balance</div>
              <BalanceBadge value={selected.leave_balance} />
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            {[
              { label: 'Annual Entitlement', value: `${Number(selected.annual_entitlement).toFixed(1)} d`, color: 'text-slate-700' },
              { label: 'Total Earned',       value: `${Number(selected.total_earned).toFixed(2)} d`,      color: 'text-emerald-700' },
              { label: 'Total Taken',        value: `${Number(selected.total_taken).toFixed(2)} d`,       color: 'text-blue-700' },
              { label: 'Total Encashed',     value: `${Number(selected.total_encashed).toFixed(2)} d`,    color: 'text-purple-700' },
            ].map(s => (
              <div key={s.label} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div className="text-xs text-slate-500">{s.label}</div>
                <div className={`text-lg font-bold ${s.color} mt-0.5`}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly chart */}
        {chartData.some(d => d.earned > 0 || d.taken > 0) && (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Monthly Leave Breakdown — {YEAR}</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="earned"   name="Earned"   fill="#10b981" radius={[3,3,0,0]} />
                <Bar dataKey="taken"    name="Taken"    fill="#3b82f6" radius={[3,3,0,0]} />
                <Bar dataKey="encashed" name="Encashed" fill="#8b5cf6" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Monthly table */}
        {monthly.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 text-xs text-slate-500">Monthly breakdown</div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Month','Earned','Taken','Encashed','Balance'].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthly.map((m, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-medium text-slate-700">{m.month_label || MONTH_LABELS[(m.month || 1) - 1]}</td>
                      <td className="px-3 py-2.5 text-emerald-700">{Number(m.earned   || 0).toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-blue-700">{Number(m.taken    || 0).toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-purple-700">{Number(m.encashed || 0).toFixed(2)}</td>
                      <td className="px-3 py-2.5"><BalanceBadge value={m.balance} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REQUESTS VIEW
  // ─────────────────────────────────────────────────────────────────────────
  const REQ_TABS = [
    { id: 'new',        label: 'New Request',            icon: 'PlusCircleIcon' },
    { id: 'rm_pending', label: 'Awaiting Manager',       icon: 'ClockIcon',      badge: requests.length },
    { id: 'hr_pending', label: 'Awaiting HR Approval',   icon: 'CheckBadgeIcon', badge: null },
    { id: 'history',    label: 'History',                icon: 'ArchiveBoxIcon' },
  ]

  const STATUS_STYLES = {
    PENDING:     'bg-amber-100 text-amber-800 border-amber-300',
    RM_APPROVED: 'bg-blue-100 text-blue-800 border-blue-300',
    RM_REJECTED: 'bg-orange-100 text-orange-800 border-orange-300',
    APPROVED:    'bg-emerald-100 text-emerald-800 border-emerald-300',
    REJECTED:    'bg-rose-100 text-rose-800 border-rose-300',
    CANCELLED:   'bg-slate-100 text-slate-600 border-slate-300',
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Encashment view helpers
  // ─────────────────────────────────────────────────────────────────────────
  const MONTH_NAMES = ['January','February','March','April','May','June',
    'July','August','September','October','November','December']

  const loadEncashmentStatus = (yr, mo) => {
    setEncLoading(true)
    setEncStatus(null)
    setEncPreview(null)
    payrollService.getLeaveEncashmentStatus({ year: yr, month: mo })
      .then(d => setEncStatus(d))
      .catch(() => setEncStatus('not_run'))
      .finally(() => setEncLoading(false))
  }

  const loadPreview = () => {
    setEncLoading(true)
    payrollService.previewLeaveEncashment({ year: encYear, month: encMonth })
      .then(d => setEncPreview(d?.preview || []))
      .catch(() => setEncMsg({ type: 'err', text: 'Failed to load preview.' }))
      .finally(() => setEncLoading(false))
  }

  const handleRunEncashment = async () => {
    setEncConfirm(false)
    setEncRunning(true)
    setEncMsg(null)
    try {
      const result = await payrollService.runLeaveEncashment({ year: encYear, month: encMonth })
      setEncPreview(result?.preview || [])
      setEncStatus({
        status: result?.missing_salaries?.length > 0 ? 'partial' : 'success',
        year: encYear, month: encMonth,
        records_processed: result?.records_processed,
        total_days_encashed: result?.total_days_encashed,
        total_pay: result?.total_pay,
        missing_salaries: result?.missing_salaries || [],
        executed_at: new Date().toISOString(),
        triggered_by: 'You',
      })
      setEncMsg({ type: 'ok', text: `Encashment completed. ${result?.records_processed} employees processed.` })
    } catch (e) {
      const msg = e?.response?.data?.error || 'Encashment run failed.'
      setEncMsg({ type: 'err', text: msg })
    } finally {
      setEncRunning(false)
    }
  }

  // Load status when encashment view becomes active or period changes
  useEffect(() => {
    if (view !== 'encashment') return
    loadEncashmentStatus(encYear, encMonth)
  }, [view, encYear, encMonth]) // eslint-disable-line react-hooks/exhaustive-deps

  const renderEncashment = () => {
    const alreadyRun = encStatus && encStatus !== 'not_run' && encStatus?.status === 'success'
    const periodLabel = `${MONTH_NAMES[encMonth - 1]} ${encYear}`

    return (
      <div className="space-y-4">
        {/* Period selector */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Year</label>
            <select value={encYear} onChange={e => setEncYear(Number(e.target.value))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
              {[encYear - 1, encYear, encYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Month</label>
            <select value={encMonth} onChange={e => setEncMonth(Number(e.target.value))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
              {MONTH_NAMES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <button type="button" onClick={loadPreview} disabled={encLoading}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            {encLoading ? 'Loading…' : 'Preview'}
          </button>
        </div>

        {/* Status banner */}
        {encLoading && (
          <div className="text-sm text-slate-500 text-center py-6 animate-pulse">Loading encashment data…</div>
        )}
        {!encLoading && encStatus && encStatus !== 'not_run' && (
          <div className={`rounded-xl border p-4 flex flex-wrap gap-4 items-start ${
            encStatus.status === 'success' ? 'bg-emerald-50 border-emerald-200' :
            encStatus.status === 'partial' ? 'bg-amber-50 border-amber-200' :
            'bg-rose-50 border-rose-200'}`}>
            <HeroIcons.CheckCircleIcon className={`w-5 h-5 mt-0.5 shrink-0 ${
              encStatus.status === 'success' ? 'text-emerald-600' : 'text-amber-600'}`} />
            <div className="flex-1 text-sm">
              <div className="font-semibold text-slate-800 mb-1">
                Encashment {encStatus.status === 'success' ? 'completed' : 'completed with warnings'} — {periodLabel}
              </div>
              <div className="text-slate-600 grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                <div><div className="text-xs text-slate-400">Employees</div><div className="font-semibold">{encStatus.records_processed}</div></div>
                <div><div className="text-xs text-slate-400">Days Encashed</div><div className="font-semibold">{Number(encStatus.total_days_encashed).toFixed(2)}</div></div>
                <div><div className="text-xs text-slate-400">Total Pay (AED)</div><div className="font-semibold">{Number(encStatus.total_pay).toLocaleString('en-AE', { minimumFractionDigits: 2 })}</div></div>
                <div><div className="text-xs text-slate-400">Run by</div><div className="font-semibold">{encStatus.triggered_by}</div></div>
              </div>
              {encStatus.missing_salaries?.length > 0 && (
                <div className="mt-2 text-xs text-amber-700">
                  ⚠ {encStatus.missing_salaries.length} employee(s) had no salary on record — encashment pay set to 0:&nbsp;
                  {encStatus.missing_salaries.join(', ')}
                </div>
              )}
            </div>
          </div>
        )}
        {!encLoading && (encStatus === null || encStatus === 'not_run') && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-500 flex items-center gap-2">
            <HeroIcons.InformationCircleIcon className="w-4 h-4 text-slate-400 shrink-0" />
            No encashment run found for {periodLabel}.
          </div>
        )}

        {/* Feedback message */}
        {encMsg && (
          <div className={`rounded-xl border px-4 py-3 text-sm flex items-center gap-2 ${
            encMsg.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                 : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
            {encMsg.type === 'ok'
              ? <HeroIcons.CheckCircleIcon className="w-4 h-4 shrink-0" />
              : <HeroIcons.ExclamationCircleIcon className="w-4 h-4 shrink-0" />}
            {encMsg.text}
          </div>
        )}

        {/* Run button (HR-only, disabled if already run) */}
        {isHRManager && (
          <div className="flex items-center gap-3">
            <button type="button"
              disabled={alreadyRun || encRunning}
              onClick={() => setEncConfirm(true)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                alreadyRun
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
              }`}>
              <HeroIcons.BanknotesIcon className="w-4 h-4" />
              {encRunning ? 'Running…' : alreadyRun ? `Already run for ${periodLabel}` : `Run Encashment for ${periodLabel}`}
            </button>
            {alreadyRun && (
              <span className="text-xs text-slate-500">
                Completed on {encStatus?.executed_at ? new Date(encStatus.executed_at).toLocaleDateString() : '—'}
              </span>
            )}
          </div>
        )}

        {/* Confirm modal */}
        {encConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
              <h3 className="text-base font-semibold text-slate-800 mb-2 flex items-center gap-2">
                <HeroIcons.BanknotesIcon className="w-5 h-5 text-blue-600" />
                Confirm Encashment
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                This will encash all unused leave balances for <strong>{periodLabel}</strong> using the
                formula: <code className="text-xs bg-slate-100 px-1 rounded">days × (salary ÷ {LEAVE_ENCASHMENT_WORKING_DAYS})</code>.
                This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setEncConfirm(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="button" onClick={handleRunEncashment}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors">
                  Yes, Run Encashment
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Preview / Results table */}
        {encPreview && encPreview.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">
                {encStatus && encStatus !== 'not_run' ? 'Encashment Results' : 'Preview'} — {periodLabel}
              </h3>
              <span className="text-xs text-slate-400">{encPreview.length} employees</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2 text-left">Employee</th>
                    <th className="px-3 py-2 text-right">Earned</th>
                    <th className="px-3 py-2 text-right">Taken</th>
                    <th className="px-3 py-2 text-right">Days Encashed</th>
                    <th className="px-3 py-2 text-right">Monthly Salary</th>
                    <th className="px-3 py-2 text-right">Daily Rate</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-700">Pay (AED)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {encPreview.map((row, i) => (
                    <tr key={row.employee_code || i} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-slate-800">{row.employee_name}</div>
                        <div className="text-slate-400">{row.employee_code}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-600">{Number(row.earned).toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600">{Number(row.taken).toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-blue-700">{Number(row.days_encashed).toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600">
                        {row.monthly_salary != null ? Number(row.monthly_salary).toLocaleString('en-AE', { minimumFractionDigits: 0 }) : <span className="text-amber-500">N/A</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-600">{Number(row.daily_rate).toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-emerald-700">
                        {Number(row.encashment_pay).toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-semibold text-slate-700">
                  <tr>
                    <td className="px-3 py-2.5" colSpan={3}>Totals</td>
                    <td className="px-3 py-2.5 text-right text-blue-700">
                      {encPreview.reduce((s, r) => s + Number(r.days_encashed), 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5" colSpan={2} />
                    <td className="px-3 py-2.5 text-right text-emerald-700">
                      {encPreview.reduce((s, r) => s + Number(r.encashment_pay), 0).toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
        {encPreview && encPreview.length === 0 && (
          <div className="text-sm text-slate-400 text-center py-8">
            No leave accrual records found for {periodLabel}. Run the monthly accrual first.
          </div>
        )}
      </div>
    )
  }

  const renderRequests = () => (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-2 flex gap-1 flex-wrap">
        {REQ_TABS.map(t => {
          const Icon = HeroIcons[t.icon] || HeroIcons.ClipboardDocumentListIcon
          return (
            <button key={t.id} type="button" onClick={() => setReqTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                reqTab === t.id ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}>
              <Icon className="w-4 h-4" />{t.label}
            </button>
          )
        })}
      </div>
      {/* Stage guide banner */}
      {reqTab !== 'new' && reqTab !== 'history' && (
        <div className="flex items-start gap-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
          <HeroIcons.InformationCircleIcon className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <span>
            <strong>Two-stage leave approval (direct manager only):</strong>{' '}
            Employee submits → <strong className="text-amber-700">Direct Reporting Manager</strong> approves →{' '}
            <strong className="text-blue-700">HR Manager</strong> gives final approval.
            {reqTab === 'rm_pending' && ' ← Stage 1: You see only your direct reports.'}
            {reqTab === 'hr_pending' && ' ← Stage 2: HR final approval for all employees.'}
          </span>
        </div>
      )}

      {/* ── NEW REQUEST form ─────────────────────────────────────────────── */}
      {reqTab === 'new' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 max-w-2xl">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <HeroIcons.PlusCircleIcon className="w-4 h-4 text-blue-400" />
            Submit Leave Request
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Employee name with datalist */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Employee Name <span className="text-rose-500">*</span></label>
              <input
                list="leave-emp-list"
                value={formState.employee_name}
                onChange={e => {
                  const val = e.target.value
                  const match = records.find(r => r.employee_name === val)
                  setFormState(s => ({
                    ...s, employee_name: val,
                    employee_code: match?.employee_code ?? s.employee_code,
                    department:    match?.department    ?? s.department,
                  }))
                }}
                placeholder="Search or type employee name…"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
              <datalist id="leave-emp-list">
                {records.map(r => <option key={r.id} value={r.employee_name} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Employee Code</label>
              <input value={formState.employee_code}
                onChange={e => setFormState(s => ({ ...s, employee_code: e.target.value }))}
                placeholder="e.g. EMP-001"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Department</label>
              <input value={formState.department}
                onChange={e => setFormState(s => ({ ...s, department: e.target.value }))}
                placeholder="e.g. Engineering"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Leave Type <span className="text-rose-500">*</span></label>
              <select value={formState.leave_type}
                onChange={e => setFormState(s => ({ ...s, leave_type: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                <option value="">— Select leave type —</option>
                {leaveTypes.map(lt => (
                  <option key={lt.id} value={lt.id}>{lt.code} — {lt.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col justify-end">
              {formWorkDays !== null && (
                <div className="text-xs bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-3 py-2">
                  <span className="font-bold">{formWorkDays}</span> working day{formWorkDays !== 1 ? 's' : ''} requested
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Start Date <span className="text-rose-500">*</span></label>
              <input type="date" value={formState.start_date}
                onChange={e => setFormState(s => ({ ...s, start_date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">End Date <span className="text-rose-500">*</span></label>
              <input type="date" value={formState.end_date} min={formState.start_date}
                onChange={e => setFormState(s => ({ ...s, end_date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Reason</label>
              <textarea rows={3} value={formState.reason}
                onChange={e => setFormState(s => ({ ...s, reason: e.target.value }))}
                placeholder="Optional reason / notes…"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          {formMsg && (
            <div className={`mt-3 px-4 py-2.5 rounded-lg text-sm ${formMsg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
              {formMsg.text}
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={submitRequest} disabled={formBusy}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition">
              {formBusy ? <Spinner /> : <HeroIcons.PaperAirplaneIcon className="w-4 h-4" />}
              {formBusy ? 'Submitting…' : 'Submit Request'}
            </button>
            <button type="button" onClick={() => { setFormState({ employee_name: '', employee_code: '', department: '', leave_type: '', start_date: '', end_date: '', reason: '' }); setFormMsg(null) }}
              className="px-4 py-2 text-slate-600 rounded-lg text-sm hover:bg-slate-100 transition">
              Reset
            </button>
          </div>
        </div>
      )}

      {/* ── PENDING / HISTORY table ─────────────────────────────────────── */}
      {(reqTab === 'rm_pending' || reqTab === 'hr_pending' || reqTab === 'history') && (
        reqLoading ? (
          <div className="flex items-center justify-center h-28 gap-2 text-slate-400 text-sm"><Spinner /> Loading…</div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Employee','Code','Dept','Leave Type','From','To','Days','Reason','Status',
                      reqTab === 'rm_pending' ? 'RM Action'
                      : reqTab === 'hr_pending' ? 'HR Action'
                      : 'Reviewer',
                    ].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requests.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-10 text-slate-400 text-sm">
                      {reqTab === 'rm_pending' ? 'No requests awaiting manager approval'
                       : reqTab === 'hr_pending' ? 'No requests awaiting HR approval'
                       : 'No leave history'}
                    </td></tr>
                  ) : requests.map(r => {
                    const lt   = r.leave_type_detail
                    const isBusy = reviewBusy === r.id
                    return (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2.5 font-medium text-slate-800 whitespace-nowrap">{r.employee_name}</td>
                        <td className="px-3 py-2.5 text-slate-500">{r.employee_code || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{r.department || '—'}</td>
                        <td className="px-3 py-2.5">
                          {lt ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${lt.badge_bg} ${lt.badge_text} ${lt.badge_border}`}>
                              {lt.code}
                            </span>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{r.start_date}</td>
                        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{r.end_date}</td>
                        <td className="px-3 py-2.5 text-center font-semibold text-slate-700">{Number(r.days_requested).toFixed(0)}</td>
                        <td className="px-3 py-2.5 text-slate-500 max-w-xs truncate">{r.reason || '—'}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLES[r.status] || 'bg-slate-100 text-slate-600 border-slate-300'}`}>
                            {r.status_display || r.status}
                          </span>
                        </td>
                        {reqTab === 'rm_pending' ? (
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              {isManager && (
                                <>
                                  <button type="button" disabled={isBusy} onClick={() => reviewRequest(r.id, 'rm_approve')}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50 transition">
                                    {isBusy ? <Spinner /> : <HeroIcons.CheckIcon className="w-3.5 h-3.5" />}
                                    Approve
                                  </button>
                                  <button type="button" disabled={isBusy} onClick={() => reviewRequest(r.id, 'rm_reject')}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-100 disabled:opacity-50 transition">
                                    <HeroIcons.XMarkIcon className="w-3.5 h-3.5" />
                                    Reject
                                  </button>
                                </>
                              )}
                              {!isManager && <span className="text-xs text-slate-400">Manager action</span>}
                            </div>
                          </td>
                        ) : reqTab === 'hr_pending' ? (
                          <td className="px-3 py-2.5">
                            <div className="flex flex-col gap-1">
                              <div className="text-xs text-slate-400 mb-0.5">
                                RM: <span className="font-medium text-slate-600">{r.rm_reviewed_by_name || '—'}</span>
                                {r.rm_reviewed_at && <span className="ml-1">({r.rm_reviewed_at.slice(0,10)})</span>}
                              </div>
                              {isHRManager ? (
                                <div className="flex items-center gap-1.5">
                                  <button type="button" disabled={isBusy} onClick={() => reviewRequest(r.id, 'approve')}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition">
                                    {isBusy ? <Spinner /> : <HeroIcons.CheckBadgeIcon className="w-3.5 h-3.5" />}
                                    Final Approve
                                  </button>
                                  <button type="button" disabled={isBusy} onClick={() => reviewRequest(r.id, 'reject')}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-100 disabled:opacity-50 transition">
                                    <HeroIcons.XMarkIcon className="w-3.5 h-3.5" />
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">HR Manager action</span>
                              )}
                            </div>
                          </td>
                        ) : (
                          <td className="px-3 py-2.5 text-slate-500 text-xs">
                            <div>{r.reviewed_by_name || r.rm_reviewed_by_name || '—'}</div>
                            {(r.reviewed_at || r.rm_reviewed_at) && (
                              <div className="text-slate-400">{(r.reviewed_at || r.rm_reviewed_at).slice(0, 10)}</div>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────────
  // Per-branch employee counts for the selector badges
  const branchCounts = useMemo(() => {
    const m = { ALL: records.length }
    BRANCHES.forEach(b => { m[b.id] = records.filter(r => r.branch === b.id).length })
    return m
  }, [records])

  const activeBranchMeta  = branch ? getBranch(branch) : null
  const activeBranchLabel = activeBranchMeta ? activeBranchMeta.fullName : 'All Branches (RAD + RIN)'

  return (
    <div className="space-y-4">
      {/* Branch selector toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">Branch</span>

        {/* All pill */}
        <button type="button" onClick={() => { setBranch(null); setPage(1) }}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
            branch === null
              ? 'bg-slate-700 text-white border-slate-700'
              : 'bg-slate-50 text-slate-600 border-slate-300 hover:bg-slate-100'
          }`}>
          All
          <span className={`text-[10px] font-bold ${branch === null ? 'text-slate-300' : 'text-slate-400'}`}>
            {loading ? '' : branchCounts.ALL}
          </span>
        </button>

        {/* Per-branch pills */}
        {BRANCHES.map(b => (
          <button key={b.id} type="button" onClick={() => { setBranch(b.id); setPage(1) }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              branch === b.id
                ? `${b.activeBg} ${b.activeText} border-transparent shadow-sm`
                : `${b.badgeBg} ${b.badgeText} ${b.badgeBorder} hover:opacity-80`
            }`}>
            {b.label}
            <span className="text-[10px] font-bold opacity-60">
              {loading ? '' : (branchCounts[b.id] ?? 0)}
            </span>
          </button>
        ))}

        <div className="ml-auto text-xs text-slate-500 font-medium">
          {loading
            ? <span className="animate-pulse text-slate-400">Loading…</span>
            : activeBranchLabel
          }
        </div>
      </div>

      {/* View tabs */}
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-2 flex gap-1 items-center flex-wrap">
        {VIEWS.map(v => {
          const Icon = HeroIcons[v.icon] || HeroIcons.TableCellsIcon
          const active = view === v.id
          return (
            <button key={v.id} type="button" onClick={() => setView(v.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                active ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}>
              <Icon className="w-4 h-4" />
              {v.label}
            </button>
          )
        })}
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
          {records.length} employees · {YEAR} · {activeBranchLabel}
        </div>
      </div>

      {view === 'overview'   && renderOverview()}
      {view === 'list'       && renderList()}
      {view === 'detail'     && renderDetail()}
      {view === 'requests'   && renderRequests()}
      {view === 'encashment' && renderEncashment()}
    </div>
  )
}
