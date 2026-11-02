import { radaiConfirm } from '../../../services/radaiDialog'
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
import { useSearchParams } from 'react-router-dom'
import OvertimeManagement from '../OvertimeManagement'
import { createPortal } from 'react-dom'
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
const formatLeaveDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

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

const PAGE_SIZE_OPTIONS = [12, 25, 50, 'All']
const ALL_DEPTS = 'all'
const LEAVE_VIEWS = [
  { id: 'overview', label: 'Overview', icon: 'ChartBarSquareIcon' },
  { id: 'list', label: 'Employees', icon: 'TableCellsIcon' },
  { id: 'detail', label: 'Detail', icon: 'UserCircleIcon' },
  { id: 'requests', label: 'Requests', icon: 'ClipboardDocumentListIcon' },
  { id: 'encashment', label: 'Encashment', icon: 'BanknotesIcon' },
]

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
export default function LeaveDashboard({ headerActions = null, onViewChange = null }) {
  const [params] = useSearchParams()
  const [view,        setView]        = useState(() => params.get('view') === 'encashment' ? 'encashment' : 'overview')
  useEffect(() => { if (params.get('view') === 'encashment') setView('encashment') }, [params])
  useEffect(() => { onViewChange?.(view === 'requests' ? 'Review and manage employee leave requests' : view === 'encashment' ? 'Review leave encashment and payroll payouts' : view === 'detail' ? 'Employee leave entitlement and history' : 'Employee balances and leave activity') }, [view, onViewChange])
  const [records,     setRecords]     = useState([])    // full unfiltered list for counts
  const [loading,     setLoading]     = useState(false)
  const [recordsError, setRecordsError] = useState(null)
  const [branch,      setBranch]      = useState(null)  // null = All | 'RAD' | 'RIN'
  const [search,      setSearch]      = useState('')
  const [deptFilter,  setDeptFilter]  = useState(ALL_DEPTS)
  const [selected,    setSelected]    = useState(null)  // full record with monthly breakdown
  const [detailLoading, setDetailLoading] = useState(false)
  const [pageSize,    setPageSize]    = useState(12)
  const [page,        setPage]        = useState(1)
  const [sortCol,     setSortCol]     = useState('name')
  const [sortAsc,     setSortAsc]     = useState(true)
  const [trendPeriod, setTrendPeriod] = useState(6)
  const [cfEditing,   setCfEditing]   = useState(false)  // carry-forward inline edit mode
  const [cfValue,     setCfValue]     = useState('')
  const [cfSaving,    setCfSaving]    = useState(false)
  const [cfMsg,       setCfMsg]       = useState(null)   // { type: 'ok'|'err', text }

  // ── Requests view state ────────────────────────────────────────────────────
  // 'rm_pending'  → PENDING requests (awaiting Reporting Manager)
  // 'hr_pending'  → RM_APPROVED requests (awaiting HR final approval)
  // 'new'         → Submit new request form
  // 'history'     → Resolved requests
  const [reqTab,       setReqTab]       = useState('all')
  const [requestStatusFilter, setRequestStatusFilter] = useState('PENDING')
  const [selectedRequestId, setSelectedRequestId] = useState(null)
  const [requestSearch, setRequestSearch] = useState('')
  const [requestDepartment, setRequestDepartment] = useState('all')
  const [requestLeaveType, setRequestLeaveType] = useState('all')
  const [requestDateRange, setRequestDateRange] = useState('all')
  const [requestPage, setRequestPage] = useState(1)
  const [showReferral, setShowReferral] = useState(false)
  const [referralOptions, setReferralOptions] = useState([])
  const [referralApproverId, setReferralApproverId] = useState('')
  const [referralNote, setReferralNote] = useState('')
  const [referralBusy, setReferralBusy] = useState(false)
  const [leaveTypes,   setLeaveTypes]   = useState([])
  const [requests,     setRequests]     = useState([])
  const [reqLoading,   setReqLoading]   = useState(false)
  const [requestError, setRequestError] = useState(null)
  const [requestReloadKey, setRequestReloadKey] = useState(0)
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
  const loadRecords = useCallback(() => {
    setLoading(true)
    setRecordsError(null)
    const params = { year: YEAR, page_size: 500 }
    if (branch) params.branch = branch
    return payrollService.getLeaveRecords(params)
      .then(d => { setRecords(Array.isArray(d) ? d : (d?.results ?? [])); setRecordsError(null) })
      .catch(() => { setRecords([]); setRecordsError('Leave records could not be loaded.') })
      .finally(() => setLoading(false))
  }, [branch])

  useEffect(() => { loadRecords() }, [loadRecords])

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
  const loadDetail = useCallback((rec, { preserveCfMsg = false } = {}) => {
    setDetailLoading(true)
    setView('detail')
    if (!preserveCfMsg) { setCfEditing(false); setCfMsg(null) }
    payrollService.getLeaveRecord(rec.id)
      .then(d => setSelected(d))
      .catch(() => setSelected(rec))
      .finally(() => setDetailLoading(false))
  }, [])

  // ── Edit carry forward (HR/Admin only) ─────────────────────────────────────
  const startEditCarryforward = () => {
    setCfValue(String(selected?.carryforward ?? 0))
    setCfMsg(null)
    setCfEditing(true)
  }

  const cancelEditCarryforward = () => {
    setCfEditing(false)
    setCfMsg(null)
  }

  const saveCarryforward = async () => {
    const parsed = Number(cfValue)
    if (Number.isNaN(parsed)) {
      setCfMsg({ type: 'err', text: 'Enter a valid number.' })
      return
    }
    setCfSaving(true)
    setCfMsg(null)
    try {
      await payrollService.updateLeaveRecordCarryforward(selected.id, parsed)
      setCfEditing(false)
      setCfMsg({ type: 'ok', text: 'Carry forward updated.' })
      loadDetail(selected, { preserveCfMsg: true })
      // Refresh the records list too — Avg Balance KPI, dept chart, and the
      // Employees-tab list all derive from it via useMemo, so this is the
      // one call needed to bring every other Leave Balance view up to date.
      loadRecords()
    } catch (e) {
      const msg = e?.response?.data?.error || e?.response?.data?.detail || e?.message || 'Failed to update carry forward.'
      setCfMsg({ type: 'err', text: msg })
    } finally {
      setCfSaving(false)
    }
  }

  // ── Load leave types (once) ────────────────────────────────────────────────
  useEffect(() => {
    payrollService.getLeaveTypes()
      .then(d => setLeaveTypes(Array.isArray(d) ? d : (d?.results ?? [])))
      .catch(() => {})
  }, [])

  // ── Role checks ───────────────────────────────────────────────────────────
  const rbacUser    = useSelector(s => s.rbac?.currentUser)
  const authUser    = useSelector(s => s.auth?.user)
  // authUser is the raw UserProfileSerializer payload — is_staff/is_superuser
  // live on the nested `user` object (UserSerializer), not at the top level.
  const isHRManager = (
    authUser?.user?.is_staff ||
    authUser?.user?.is_superuser ||
    rbacUser?.roles?.some(r =>
      r.code?.startsWith('hr') || ['admin', 'superadmin', 'super_admin'].includes(r.code)
    )
  ) ?? false
  // ── Load requests whenever requests tab is active ──────────────────────────
  useEffect(() => {
    if (!['overview', 'requests'].includes(view)) return
    setReqLoading(true)
    setRequestError(null)
    let params = {}
    if      (reqTab === 'rm_pending')  params = { status: 'PENDING' }
    else if (reqTab === 'hr_pending')  params = { status: 'RM_APPROVED' }
    else if (reqTab === 'all') params = { status__in: 'PENDING,RM_APPROVED,APPROVED,REJECTED,CANCELLED,RM_REJECTED' }
    // Multi-status filters must use `status__in` — the backend only splits
    // on commas for that param name; plain `status` does an exact match
    // against the whole string, so a comma-joined list here always matched
    // zero rows.
    else if (reqTab === 'history')     params = { status__in: 'APPROVED,REJECTED,CANCELLED,RM_REJECTED' }
    // 'new' tab: no fetch needed
    if (reqTab !== 'new') {
      payrollService.getLeaveRequests(params)
        .then(d => setRequests(Array.isArray(d) ? d : (d?.results ?? [])))
        .catch(() => { setRequests([]); setRequestError('Leave requests could not be loaded.') })
        .finally(() => setReqLoading(false))
    } else {
      setReqLoading(false)
    }
  }, [view, reqTab, requestReloadKey])

  // ── Working days preview for the new-request form ─────────────────────────
  const formWorkDays = useMemo(() => {
    if (!formState.start_date || !formState.end_date) return null
    const s = new Date(formState.start_date)
    const e = new Date(formState.end_date)
    if (e < s) return null
    let d = 0; let c = new Date(s)
    while (c <= e) { if (c.getDay() !== 0 && c.getDay() !== 6) d++; c = new Date(c.getFullYear(), c.getMonth(), c.getDate() + 1) }
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

  const openRequestReferral = async (request) => {
    setReferralOptions([])
    setReferralApproverId('')
    setReferralNote('')
    setShowReferral(true)
    try {
      const response = await payrollService.getLeaveRequestReferralOptions(request.id)
      const options = (response?.results || []).filter((option) => option.eligible)
      setReferralOptions(options)
      if (options.length) setReferralApproverId(String(options[0].id))
    } catch {
      setFormMsg({ type: 'err', text: 'Authorized clarification reviewers could not be loaded.' })
      setShowReferral(false)
    }
  }

  const submitRequestReferral = async (request) => {
    if (!referralApproverId) return
    setReferralBusy(true)
    try {
      const updated = await payrollService.referLeaveRequest(request.id, referralApproverId, referralNote)
      setRequests((previous) => previous.map((item) => String(item.id) === String(request.id) ? updated : item))
      setSelectedRequestId(request.id)
      setShowReferral(false)
    } catch (error) {
      setFormMsg({ type: 'err', text: error?.response?.data?.error || 'The clarification request could not be routed.' })
    } finally {
      setReferralBusy(false)
    }
  }

  const cancelRequest = async (id) => {
    setReviewBusy(id)
    try {
      await payrollService.cancelLeaveRequest(id)
      setRequests(prev => prev.filter(r => r.id !== id))
    } catch {
      // The list remains unchanged when cancellation fails.
    }
    finally { setReviewBusy(null) }
  }

  // ── Initialize Current Month Leave ─────────────────────────────────────────
  const [initBusy, setInitBusy] = useState(false)
  const [initMsg, setInitMsg] = useState(null)  // { type: 'ok'|'err', text }
  
  const initializeCurrentMonthLeave = async () => {
    if (!(await radaiConfirm(
      `Initialize current month leave balance to 1.83 days for all employees?\n\n` +
      `This will set the earned value for ${new Date().toLocaleString('default', { month: 'long' })} ${YEAR} ` +
      `to the standard monthly accrual (1.83 days = 22 days/year ÷ 12 months).`
    ))) return
    
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

  const upcomingRequests = useMemo(() => [...requests]
    .filter((request) => ['APPROVED', 'RM_APPROVED'].includes(request.status) && String(request.end_date || '') >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || '')))
    .slice(0, 3), [requests])

  const currentMonth = new Date().getMonth() + 1
  const trendStartMonth = Math.max(1, currentMonth - trendPeriod + 1)
  const leaveTrend = useMemo(() => MONTH_LABELS.slice(trendStartMonth - 1, currentMonth).map((month, index) => {
    const monthNumber = trendStartMonth + index
    return {
      month,
      days: records.reduce((total, record) => total + Number(record.monthly_breakdown?.find((item) => Number(item.month) === monthNumber)?.taken || 0), 0),
    }
  }), [records, trendStartMonth, currentMonth])

  const totalEntitlementDays = kpis.total * ANNUAL_ENTITLEMENT
  const utilizationPercent = totalEntitlementDays > 0
    ? Math.min(100, Math.round((kpis.totalTaken / totalEntitlementDays) * 100))
    : 0

  const quickAccessItems = [
    { label: 'Leave balances', detail: 'View employee leave balances', icon: 'CalendarDaysIcon', target: 'list', tone: 'leave-tile-yellow' },
    { label: 'Leave requests', detail: 'Create and manage requests', icon: 'DocumentTextIcon', target: 'requests', tone: 'leave-tile-peach' },
    { label: 'Encashment', detail: 'Manage leave encashment', icon: 'BanknotesIcon', target: 'encashment', tone: 'leave-tile-blue' },
    { label: 'Team calendar', detail: 'View team leave schedule', icon: 'CalendarIcon', target: 'requests', tone: 'leave-tile-green' },
  ]
  const renderQuickAccess = () => (
    <section className="leave-panel leave-quick-access">
      <h2>Quick access</h2>
      <div className="leave-quick-access-grid">
        {quickAccessItems.map((item) => {
          const Icon = HeroIcons[item.icon] || HeroIcons.CalendarDaysIcon
          return <button key={item.label} type="button" onClick={() => { if (item.target === 'requests') { setReqTab('all'); setRequestPage(1) } if (item.target === 'list') setPage(1); setView(item.target) }} className={`leave-quick-access-card ${item.tone}`}>
            <Icon aria-hidden="true" className="leave-quick-access-icon" />
            <span className="leave-quick-access-copy"><strong>{item.label}</strong><span>{item.detail}</span></span>
            <HeroIcons.ChevronRightIcon aria-hidden="true" className="leave-quick-access-chevron" />
          </button>
        })}
      </div>
    </section>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // OVERVIEW VIEW
  // ─────────────────────────────────────────────────────────────────────────
  const renderOverview = () => {
    const overviewPageSize = 7
    const overviewPages = Math.max(1, Math.ceil(filtered.length / overviewPageSize))
    const overviewPage = Math.min(page, overviewPages)
    const overviewRows = filtered.slice((overviewPage - 1) * overviewPageSize, overviewPage * overviewPageSize)
    const todayDate = new Date().toISOString().slice(0, 10)

    return (
      <div className="leave-overview-layout">
        <div className="leave-overview-main">
          {renderQuickAccess()}
          <section className="leave-panel leave-balance-panel">
            <div className="leave-section-heading"><div><h2>Employee leave balances</h2><p>All balances shown in days</p></div><span className="leave-record-count">{filtered.length} employees</span></div>
            <div className="leave-kpi-grid">
              {[
                { label: 'Employees', value: kpis.total, icon: 'UsersIcon', color: 'blue' },
                { label: 'Pending requests', value: requests.filter((request) => ['PENDING', 'RM_APPROVED'].includes(request.status)).length, icon: 'DocumentTextIcon', color: 'amber' },
                { label: 'On leave today', value: requests.filter((request) => request.status === 'APPROVED' && request.start_date <= todayDate && request.end_date >= todayDate).length, icon: 'CalendarDaysIcon', color: 'blue' },
                { label: 'Low balances', value: kpis.low + kpis.negative, icon: 'ExclamationTriangleIcon', color: 'red' },
              ].map((item) => { const Icon = HeroIcons[item.icon] || HeroIcons.UsersIcon; return <div key={item.label} className={`leave-kpi leave-kpi-${item.color}`}><Icon aria-hidden="true" /><span className="leave-kpi-copy"><strong>{loading ? '?' : item.value}</strong><span>{item.label}</span></span></div> })}
            </div>
            <div className="leave-filter-grid">
              <label className="leave-field-label">Search employee<div className="leave-search-field"><HeroIcons.MagnifyingGlassIcon aria-hidden="true" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Name, code, or title" /></div></label>
              <label className="leave-field-label">Department<select value={deptFilter} onChange={(event) => { setDeptFilter(event.target.value); setPage(1) }}><option value={ALL_DEPTS}>All departments</option>{departments.map((department) => <option key={department} value={department}>{department}</option>)}</select></label>
            </div>
            {recordsError && <div className="leave-error" role="alert"><span>{recordsError}</span><button type="button" onClick={loadRecords}>Retry</button></div>}
            <div className="leave-table-wrap"><table className="leave-balance-table">
              <colgroup><col className="leave-col-employee" /><col className="leave-col-department" /><col className="leave-col-number" /><col className="leave-col-number" /><col className="leave-col-number" /><col className="leave-col-number" /><col className="leave-col-actions" /></colgroup>
              <thead><tr><th scope="col">Employee</th><th scope="col">Department</th><th scope="col" className="is-numeric">Earned</th><th scope="col" className="is-numeric">Taken</th><th scope="col" className="is-numeric">Encashed</th><th scope="col" className="is-numeric">Balance</th><th scope="col" className="is-actions">Actions</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={7} className="leave-table-message"><Spinner /> Loading employee balances?</td></tr>
                  : recordsError ? <tr><td colSpan={7} className="leave-table-message">Employee balances are unavailable. Retry to load them.</td></tr>
                  : !overviewRows.length ? <tr><td colSpan={7} className="leave-table-message">{records.length ? 'No employees match the selected filters.' : 'No employee leave records are available.'}</td></tr>
                  : overviewRows.map((record) => {
                    const balance = Number(record.leave_balance || 0)
                    const tier = balanceTier(balance)
                    const lowBalance = balance < BALANCE_TIERS[1].max
                    return <tr key={record.id}>
                      <td><button type="button" onClick={() => loadDetail(record)} className="leave-employee-link"><span className="leave-avatar">{String(record.employee_name || '?').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span className="leave-employee-copy"><strong title={record.employee_name}>{record.employee_name}</strong><span title={`${record.employee_code || ''} ? ${record.job_title || 'Employee'}`}>{record.employee_code || '?'} ? {record.job_title || 'Employee'}</span></span></button></td>
                      <td className="leave-department-cell" title={record.department || 'Unassigned'}>{record.department || 'Unassigned'}</td>
                      <td className="is-numeric">{Number(record.total_earned || 0).toFixed(2)}</td><td className="is-numeric">{Number(record.total_taken || 0).toFixed(2)}</td><td className="is-numeric">{Number(record.total_encashed || 0).toFixed(2)}</td>
                      <td className={`is-numeric leave-balance-value ${lowBalance ? 'is-low' : 'is-healthy'}`}><span className="sr-only">{tier.label}: </span>{balance.toFixed(2)}</td>
                      <td className="is-actions"><div className="leave-row-actions"><button type="button" className="leave-view-action" onClick={() => loadDetail(record)}>View</button><details className="leave-row-menu"><summary aria-label={`More actions for ${record.employee_name}`}><HeroIcons.EllipsisVerticalIcon aria-hidden="true" /></summary><div><button type="button" onClick={() => loadDetail(record)}>View employee details</button></div></details></div></td>
                    </tr>
                  })}
              </tbody>
            </table></div>
            <div className="leave-pagination"><span>{filtered.length ? `${(overviewPage - 1) * overviewPageSize + 1}?${Math.min(overviewPage * overviewPageSize, filtered.length)} of ${filtered.length} employees` : '0 employees'}</span><div><button type="button" aria-label="Previous page" disabled={overviewPage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><HeroIcons.ChevronLeftIcon aria-hidden="true" /></button><span className="leave-page-number" aria-current="page">{overviewPage}</span><button type="button" aria-label="Next page" disabled={overviewPage >= overviewPages} onClick={() => setPage((current) => Math.min(overviewPages, current + 1))}><HeroIcons.ChevronRightIcon aria-hidden="true" /></button></div></div>
          </section>
        </div>
        <aside className="leave-insights">
          <section className="leave-panel leave-utilization-panel">
          <div className="leave-insight-heading"><h2>Leave utilization</h2><span className="leave-insight-filter-label">Annual leave</span></div>
            <div className="leave-gauge" role="img" aria-label={`${utilizationPercent}% of annual entitlement used. ${kpis.totalTaken.toFixed(2)} of ${totalEntitlementDays.toFixed(2)} days.`}>
              <svg viewBox="0 0 200 112" aria-hidden="true"><path className="leave-gauge-track" d="M 12 102 A 88 88 0 0 1 188 102" /><path className="leave-gauge-value" d="M 12 102 A 88 88 0 0 1 188 102" pathLength="100" strokeDasharray={`${utilizationPercent} 100`} /></svg>
              <div className="leave-gauge-copy"><strong>{utilizationPercent}%</strong><span>Used annual entitlement</span><small>{kpis.totalTaken.toFixed(2)} / {totalEntitlementDays.toFixed(2)} days</small></div>
            </div>
            <div className="leave-gauge-scale"><span>0%</span><span>100%</span></div>
          </section>
          <section className="leave-panel leave-trend-panel">
            <div className="leave-insight-heading"><h2>Leave trend</h2><label className="sr-only" htmlFor="leave-trend-period">Trend period</label><select id="leave-trend-period" value={trendPeriod} onChange={(event) => setTrendPeriod(Number(event.target.value))}><option value={6}>Last 6 months</option><option value={12}>Last 12 months</option></select></div>
            <div className="leave-trend-chart" role="img" aria-label={`Leave days taken per month for the last ${trendPeriod} months.`}><ResponsiveContainer width="100%" height="100%"><BarChart data={leaveTrend} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}><CartesianGrid stroke="#e8edf5" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 9, fill: '#58709A' }} axisLine={{ stroke: '#dfe6f1' }} tickLine={false} /><YAxis tick={{ fontSize: 9, fill: '#58709A' }} axisLine={false} tickLine={false} width={34} label={{ value: 'Days', angle: -90, position: 'insideLeft', style: { fill: '#58709A', fontSize: 9 } }} /><Tooltip formatter={(value) => [`${Number(value).toFixed(2)} days`, 'Leave taken']} contentStyle={{ borderRadius: 4, borderColor: '#dfe6f1', fontSize: 11 }} /><Bar dataKey="days" name="Leave taken" fill="#075BFF" radius={[3, 3, 0, 0]} maxBarSize={28} /></BarChart></ResponsiveContainer></div>
          </section>
          <section className="leave-panel leave-upcoming-panel">
            <div className="leave-insight-heading"><h2>Upcoming leave</h2><button type="button" className="leave-text-action" onClick={() => { setReqTab('history'); setView('requests') }}>View all</button></div>
            <div className="leave-upcoming-list">{reqLoading ? <p className="leave-empty-state">Loading upcoming leave?</p> : upcomingRequests.length ? upcomingRequests.map((request) => {
              const employee = records.find((record) => String(record.employee_code) === String(request.employee_code))
              return <div key={request.id} className="leave-upcoming-row"><span className="leave-avatar">{String(request.employee_name || '?').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span className="leave-upcoming-copy"><strong>{request.employee_name}</strong><span>{request.job_title || employee?.job_title || 'Employee'}</span><span>{request.start_date} ? {request.end_date}</span></span><span className={`leave-status ${String(request.status).toLowerCase()}`}>{request.status_display || request.status}</span></div>
            }) : <p className="leave-empty-state">No upcoming or active leave.</p>}</div>
          </section>
        </aside>
      </div>
    )
  }

  // LIST VIEW
  // ─────────────────────────────────────────────────────────────────────────
  const renderList = () => (
    <div className="leave-list-view">
      {/* Controls */}
      <div className="leave-panel leave-list-controls">
        <div className="flex-1 min-w-48">
          <label className="block text-xs text-slate-500 mb-1">Search employee</label>
          <div className="relative">
            <HeroIcons.MagnifyingGlassIcon className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Name, code, or title…"
              className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>
        <div className="min-w-44">
          <label className="block text-xs text-slate-500 mb-1">Department</label>
          <select value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setPage(1) }}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
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
      {recordsError && <div className="leave-error" role="alert"><span>{recordsError}</span><button type="button" onClick={loadRecords}>Retry</button></div>}
      {loading ? (
        <div className="leave-panel flex min-h-24 items-center justify-center gap-2 text-sm text-slate-500"><Spinner /> Loading employee balances…</div>
      ) : !recordsError ? (
        <div className="leave-panel leave-list-table">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {LIST_COLS.map(c => (
                    <th key={c.id} aria-sort={sortCol === c.id ? (sortAsc ? 'ascending' : 'descending') : 'none'}
                      className="text-left px-3 py-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                      <button type="button" onClick={() => toggleSort(c.id)} className="flex items-center gap-1 text-inherit">
                        {c.label}
                        {sortCol === c.id && (
                          sortAsc
                            ? <HeroIcons.ChevronUpIcon className="w-3 h-3" />
                            : <HeroIcons.ChevronDownIcon className="w-3 h-3" />
                        )}
                      </button>
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
                        return <td key={c.id} className={`px-3 py-2.5 text-slate-700 whitespace-nowrap ${c.cellType === 'number' ? 'text-right tabular-nums' : ''}`}>{v}</td>
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
          <div className="leave-pagination"><span>{filtered.length ? `${(page - 1) * (pageSize === 'All' ? filtered.length : pageSize) + 1}–${Math.min(page * (pageSize === 'All' ? filtered.length : pageSize), filtered.length)} of ${filtered.length} employees` : '0 employees'}</span><div><button type="button" aria-label="Previous page" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || pageSize === 'All'}><HeroIcons.ChevronLeftIcon aria-hidden="true" /></button><span className="leave-page-number" aria-current="page">{page}</span><button type="button" aria-label="Next page" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || pageSize === 'All'}><HeroIcons.ChevronRightIcon aria-hidden="true" /></button></div></div>
        </div>
      ) : null}
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
    return (
      <div className="leave-detail-view space-y-4">
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

          {/* Carry forward row */}
          <div className="mt-3 bg-slate-50 rounded-lg p-3 border border-slate-200 flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs text-slate-500">Carry Forward</div>
            {cfEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="number" step="0.01" value={cfValue}
                  onChange={e => setCfValue(e.target.value)}
                  className="w-24 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  autoFocus
                />
                <button type="button" onClick={saveCarryforward} disabled={cfSaving}
                  className="p-1.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50">
                  {cfSaving ? <Spinner /> : <HeroIcons.CheckIcon className="w-3.5 h-3.5" />}
                </button>
                <button type="button" onClick={cancelEditCarryforward} disabled={cfSaving}
                  className="p-1.5 rounded bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 disabled:opacity-50">
                  <HeroIcons.XMarkIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="text-lg font-bold text-slate-700">{Number(selected.carryforward || 0).toFixed(2)} d</div>
                {isHRManager && (
                  <button type="button" onClick={startEditCarryforward} title="Edit carry forward"
                    className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                    <HeroIcons.PencilSquareIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
          {cfMsg && (
            <div className={`mt-2 px-3 py-2 rounded-lg text-xs ${cfMsg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
              {cfMsg.text}
            </div>
          )}
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
  const visibleRequests = requests.filter((request) => {
    const statusMatches = requestStatusFilter === 'ALL'
      || (requestStatusFilter === 'PENDING' && ['PENDING', 'RM_APPROVED'].includes(request.status))
      || request.status === requestStatusFilter
      || (requestStatusFilter === 'REJECTED' && request.status === 'RM_REJECTED')
    const departmentMatches = requestDepartment === 'all' || request.department === requestDepartment
    const leaveTypeMatches = requestLeaveType === 'all' || String(request.leave_type_detail?.id || request.leave_type) === String(requestLeaveType)
    const query = requestSearch.trim().toLowerCase()
    const searchMatches = !query || [request.employee_name, request.employee_code, request.id, request.request_number, request.reason]
      .some((value) => String(value || '').toLowerCase().includes(query))
    const today = new Date()
    const localDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const monthStart = localDateKey(new Date(today.getFullYear(), today.getMonth(), 1))
    const monthEnd = localDateKey(new Date(today.getFullYear(), today.getMonth() + 1, 0))
    const dateMatches = requestDateRange === 'all'
      || (requestDateRange === 'month' && request.start_date <= monthEnd && request.end_date >= monthStart)
      || (requestDateRange === 'upcoming' && request.end_date >= localDateKey(today))
      || (requestDateRange === 'past' && request.end_date < localDateKey(today))
    return statusMatches && departmentMatches && leaveTypeMatches && searchMatches && dateMatches
  })
  const selectedRequest = visibleRequests.find((request) => String(request.id) === String(selectedRequestId)) || visibleRequests[0] || null
  const requestDepartments = [...new Set(requests.map((request) => request.department).filter(Boolean))].sort()
  const requestTotalPages = Math.max(1, Math.ceil(visibleRequests.length / 6))

  // ─────────────────────────────────────────────────────────────────────────
  // Encashment view helpers
  // ─────────────────────────────────────────────────────────────────────────
  const MONTH_NAMES = ['January','February','March','April','May','June',
    'July','August','September','October','November','December']

  const [annualEncashmentOpen, setAnnualEncashmentOpen] = useState(false)
  const [encSearch, setEncSearch] = useState('')
  const [encDepartment, setEncDepartment] = useState('all')
  const [encStatusFilter, setEncStatusFilter] = useState('all')
  const [encPage, setEncPage] = useState(1)
  const [selectedEncashmentCode, setSelectedEncashmentCode] = useState(null)

  const loadEncashmentStatus = (yr, mo) => {
    setEncLoading(true)
    setEncStatus(null)
    payrollService.getLeaveEncashmentStatus({ year: yr, month: mo })
      .then(d => setEncStatus(d?.status === 'not_run' ? 'not_run' : d))
      .catch(() => setEncMsg({ type: 'err', text: 'Unable to load encashment status. Please try again.' }))
      .finally(() => setEncLoading(false))
  }

  const loadPreview = () => {
    setEncLoading(true)
    setEncPreview(null)
    setEncMsg(null)
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
    if (view !== 'encashment' || !isHRManager) return
    loadEncashmentStatus(encYear, encMonth)
    loadPreview()
  }, [view, encYear, encMonth, isHRManager]) // eslint-disable-line react-hooks/exhaustive-deps

  const encPreviewRows = encPreview || []
  const encFilteredRows = encPreviewRows.filter((row) => {
    const record = records.find((item) => String(item.employee_code) === String(row.employee_code))
    const department = record?.department || ''
    const query = encSearch.trim().toLowerCase()
    const rowStatus = encStatus && encStatus !== 'not_run' && ['success', 'partial'].includes(encStatus.status) ? 'processed' : 'preview'
    return (encDepartment === 'all' || department === encDepartment)
      && (encStatusFilter === 'all' || encStatusFilter === rowStatus)
      && (!query || [row.employee_name, row.employee_code, department].some((value) => String(value || '').toLowerCase().includes(query)))
  })
  const encSelectedRow = encFilteredRows.find((row) => String(row.employee_code || row.employee_id) === String(selectedEncashmentCode)) || encFilteredRows[0] || null
  const encTotalDays = encPreviewRows.reduce((total, row) => total + Number(row.days_encashed || 0), 0)
  const encTotalPay = encPreviewRows.reduce((total, row) => total + Number(row.encashment_pay || 0), 0)
  const encDepartments = [...new Set(encPreviewRows.map((row) => records.find((item) => String(item.employee_code) === String(row.employee_code))?.department).filter(Boolean))].sort()

  const renderEncashmentWorkspace = () => {
    const alreadyRun = encStatus && encStatus !== 'not_run' && ['success', 'partial'].includes(encStatus.status)
    const periodLabel = `${MONTH_NAMES[encMonth - 1]} ${encYear}`
    return (
      <div className="leave-tab-workspace leave-encashment-workspace">
        <div className="leave-split-layout">
          <div className="leave-workspace-main">
          {renderQuickAccess()}
          <section className="leave-panel leave-encashment-panel">
            <h2 className="mb-2 text-base font-semibold text-slate-900">Encashment preview</h2>
            <div className="leave-summary-grid mb-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
              {[
                { label: 'Employees', value: encPreviewRows.length, icon: 'UsersIcon', color: 'text-amber-600' },
                { label: 'Days to encash', value: encTotalDays.toFixed(2), icon: 'DocumentIcon', color: 'text-blue-600' },
                { label: 'Estimated payout', value: `AED ${encTotalPay.toLocaleString('en-AE', { minimumFractionDigits: 2 })}`, icon: 'BanknotesIcon', color: 'text-emerald-600' },
                { label: 'Period status', value: alreadyRun ? 'Completed' : 'Preview', icon: alreadyRun ? 'CheckCircleIcon' : 'ClockIcon', color: alreadyRun ? 'text-emerald-600' : 'text-red-600' },
              ].map((item) => { const Icon = HeroIcons[item.icon] || HeroIcons.DocumentIcon; return <div key={item.label} className="flex min-w-0 items-center gap-2 rounded-md border border-slate-200 px-2 py-2"><Icon className={`h-6 w-6 shrink-0 ${item.color}`} /><span className="min-w-0"><strong className={`block truncate text-base leading-5 ${item.color}`}>{encLoading && !encPreview ? '…' : item.value}</strong><span className="text-[9px] font-medium uppercase text-slate-500">{item.label}</span></span></div> })}
            </div>
            <div className="leave-subtabs" role="tablist" aria-label="Encashment status">
              {[['all', 'All requests'], ['preview', 'Preview'], ['processed', 'Processed']].map(([status, label]) => <button key={status} type="button" role="tab" aria-selected={encStatusFilter === status} className={encStatusFilter === status ? 'is-active' : ''} onClick={() => { setEncStatusFilter(status); setEncPage(1) }}>{label}{status === 'all' ? ` (${encPreviewRows.length})` : status === (alreadyRun ? 'processed' : 'preview') ? ` (${encPreviewRows.length})` : ' (0)'}</button>)}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
              <label className="leave-field-label">Search employee or ID<div className="leave-search-field"><HeroIcons.MagnifyingGlassIcon aria-hidden="true" /><input value={encSearch} onChange={(event) => { setEncSearch(event.target.value); setEncPage(1) }} placeholder="Name or employee ID" /></div></label>
              <label className="leave-field-label">Department<select value={encDepartment} onChange={(event) => { setEncDepartment(event.target.value); setEncPage(1) }}><option value="all">All departments</option>{encDepartments.map((department) => <option key={department}>{department}</option>)}</select></label>
              <label className="leave-field-label">Status<select value={encStatusFilter} onChange={(event) => { setEncStatusFilter(event.target.value); setEncPage(1) }}><option value="all">All statuses</option><option value="preview">Preview</option><option value="processed">Processed</option></select></label>
              <label className="leave-field-label">Payroll month<select value={encMonth} onChange={(event) => { setEncMonth(Number(event.target.value)); setEncPage(1) }}>{MONTH_NAMES.map((month, index) => <option key={month} value={index + 1}>{month} {encYear}</option>)}</select></label>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="leave-encashment-table w-full min-w-[760px] table-fixed border-collapse"><colgroup><col className="w-[5%]" /><col className="w-[31%]" /><col className="w-[8%]" /><col className="w-[17%]" /><col className="w-[17%]" /><col className="w-[12%]" /><col className="w-[10%]" /></colgroup>
                <thead className="bg-slate-50 text-[9px] font-semibold uppercase text-slate-600"><tr><th className="px-2 py-2 text-left" /><th className="px-2 py-2 text-left">Employee</th><th className="px-2 py-2 text-right">Days</th><th className="px-2 py-2 text-right">Daily rate (AED)</th><th className="px-2 py-2 text-right">Amount (AED)</th><th className="px-2 py-2 text-center">Status</th><th className="px-2 py-2 text-right">Action</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{encLoading && !encPreview ? <tr><td colSpan={7} className="py-8 text-center text-slate-400"><Spinner /> Loading encashment preview…</td></tr> : encFilteredRows.length ? encFilteredRows.slice((encPage - 1) * 6, encPage * 6).map((row) => { const code = String(row.employee_code || row.employee_id); const selectedRow = String(encSelectedRow?.employee_code || encSelectedRow?.employee_id) === code; const record = records.find((item) => String(item.employee_code) === String(row.employee_code)); return <tr key={code} aria-selected={selectedRow} onClick={() => setSelectedEncashmentCode(code)} className={selectedRow ? 'is-selected' : ''}><td><button type="button" className="leave-selection-button" aria-label={`Select ${row.employee_name}`} aria-pressed={selectedRow} onClick={() => setSelectedEncashmentCode(code)}><span className={selectedRow ? 'is-selected' : ''} /></button></td><td className="px-2 py-2"><span className="flex min-w-0 items-center gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[9px] font-semibold text-blue-700">{String(row.employee_name || '?').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span className="leave-employee-copy"><strong>{row.employee_name}</strong><span>{row.employee_code || '—'} · {record?.job_title || record?.designation || record?.department || 'Employee'}</span></span></span></td><td className="px-2 py-2 text-right tabular-nums">{Number(row.days_encashed).toFixed(2)}</td><td className="is-numeric">AED {Number(row.daily_rate).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td className="is-numeric">AED {Number(row.encashment_pay).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td className="px-2 py-2 text-center"><span className={`inline-flex rounded border px-1.5 py-1 text-[9px] font-semibold ${alreadyRun ? 'border-emerald-200 bg-emerald-100 text-emerald-800' : 'border-amber-200 bg-amber-100 text-amber-800'}`}>{alreadyRun ? 'PROCESSED' : 'PREVIEW'}</span></td><td className="px-2 py-2 text-right"><button type="button" onClick={(event) => { event.stopPropagation(); setSelectedEncashmentCode(code) }} className="font-medium text-blue-600 hover:underline">View</button></td></tr> }) : <tr><td colSpan={7} className="py-8 text-center text-xs text-slate-400">{encPreview ? 'No employees match these filters.' : 'No encashment preview available.'}</td></tr>}</tbody>
              </table>
            </div>
            <div className="leave-pagination mt-2 flex items-center justify-between text-[10px] text-slate-600"><span>{encFilteredRows.length ? `${(encPage - 1) * 6 + 1} - ${Math.min(encPage * 6, encFilteredRows.length)} of ${encFilteredRows.length}` : 0} employees</span><div className="flex items-center gap-1"><button type="button" aria-label="Previous page" disabled={encPage <= 1} onClick={() => setEncPage((page) => Math.max(1, page - 1))} className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40"><HeroIcons.ChevronLeftIcon className="h-3 w-3" /></button><span className="rounded bg-blue-600 px-2 py-1 text-white">{encPage}</span><button type="button" aria-label="Next page" disabled={encPage >= Math.max(1, Math.ceil(encFilteredRows.length / 6))} onClick={() => setEncPage((page) => Math.min(Math.max(1, Math.ceil(encFilteredRows.length / 6)), page + 1))} className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40"><HeroIcons.ChevronRightIcon className="h-3 w-3" /></button></div></div>
            <details open={annualEncashmentOpen} onToggle={(event) => setAnnualEncashmentOpen(event.currentTarget.open)} className="mt-3 min-w-0 max-w-full border-t border-slate-100 pt-2"><summary className="cursor-pointer text-xs font-medium text-slate-600">Annual encashment run controls</summary><div className="w-full max-w-full min-w-0 overflow-x-auto pt-3">{renderEncashment()}</div></details>
          </section>
          <details className="leave-panel leave-overtime-panel">
            <summary className="cursor-pointer text-xs font-semibold text-slate-700">Overtime requests</summary>
            <div className="mt-3 max-h-[65vh] max-w-full overflow-auto"><OvertimeManagement reviewOnly /></div>
          </details>
          <span id="encashment-run-controls" className="sr-only">Encashment run controls</span>
          </div>
          <aside className="leave-panel leave-encashment-details">
            {encLoading ? <div className="leave-no-selection"><Spinner /><span>Loading encashment preview?</span></div> : encSelectedRow ? (() => {
              const employeeRecord = records.find((record) => String(record.employee_code) === String(encSelectedRow.employee_code))
              const availableBalance = employeeRecord ? Number(employeeRecord.leave_balance || 0) : null
              const encashedDays = Number(encSelectedRow.days_encashed || 0)
              return <>
                <div className="leave-detail-heading"><div><h2>Encashment details</h2><p>Employee ID <strong>{encSelectedRow.employee_code || encSelectedRow.employee_id || '?'}</strong></p></div><span className={`leave-status ${alreadyRun ? 'processed' : 'pending'}`}>{alreadyRun ? 'Run complete' : 'Preview'}</span></div>
                <div className="leave-detail-person"><span className="leave-avatar leave-avatar-large">{String(encSelectedRow.employee_name || '?').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><div><strong>{encSelectedRow.employee_name}</strong><span>{employeeRecord?.job_title || employeeRecord?.designation || 'Employee'}</span><span>{employeeRecord?.department || 'Department unavailable'}</span></div></div>
                <section className="leave-detail-section"><h3>Balance and calculation</h3><dl>
                  <div><dt>Available leave</dt><dd>{availableBalance === null ? 'Unavailable' : `${availableBalance.toFixed(2)} days`}</dd></div>
                  <div><dt>Requested encashment</dt><dd>{encashedDays.toFixed(2)} days</dd></div>
                  <div><dt>Projected remaining balance</dt><dd>{availableBalance === null ? 'Unavailable' : `${(availableBalance - encashedDays).toFixed(2)} days`}</dd></div>
                  <div><dt>Daily rate</dt><dd>AED {Number(encSelectedRow.daily_rate || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd></div>
                </dl></section>
                <div className="leave-payout-row"><span>Estimated payout</span><strong>AED {Number(encSelectedRow.encashment_pay || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
                <p className="leave-detail-footnote">{encashedDays.toFixed(2)} days ? AED {Number(encSelectedRow.daily_rate || 0).toFixed(2)} daily rate. The configured daily rate uses monthly salary ? {LEAVE_ENCASHMENT_WORKING_DAYS} working days.</p>
                <section className="leave-detail-section"><h3>Payroll and processing</h3><dl>
                  <div><dt>Payroll month</dt><dd>{periodLabel}</dd></div>
                  <div><dt>Run status</dt><dd>{alreadyRun ? 'Encashment run completed' : 'Preview only'}</dd></div>
                  <div><dt>Payment status</dt><dd>{alreadyRun ? 'Not provided by this workflow' : 'Not processed'}</dd></div>
                  <div><dt>Approval route</dt><dd>{encStatus?.triggered_by ? `Run initiated by ${encStatus.triggered_by}` : 'No per-request approval route is available'}</dd></div>
                </dl></section>
                <div className="leave-inline-message is-info"><HeroIcons.InformationCircleIcon aria-hidden="true" />{alreadyRun ? 'The period run is complete. Payment status is tracked outside this workflow.' : 'Preview only. The period action processes eligible balances; this panel does not approve or mark payment.'}</div>
                {isHRManager && <button type="button" className="leave-primary-button leave-full-button" onClick={() => setEncConfirm(true)} disabled={alreadyRun || encRunning}>{encRunning ? 'Processing?' : alreadyRun ? 'Encashment completed' : `Run encashment for ${periodLabel}`}</button>}
                <a href="#encashment-run-controls" onClick={() => setAnnualEncashmentOpen(true)} className="leave-detail-link">View run details</a>
              </>
            })() : <div className="leave-no-selection"><HeroIcons.BanknotesIcon aria-hidden="true" /><strong>No encashment row selected</strong><span>{encMsg?.text || (encPreview ? 'No employees match these filters.' : 'No encashment preview is available for this period.')}</span>{!encPreview && <button type="button" className="leave-secondary-button" onClick={loadPreview}>Retry preview</button>}</div>}
          </aside>
        </div>
      </div>
    )
  }

  const renderEncashment = () => {
    const alreadyRun = encStatus && encStatus !== 'not_run' && ['success', 'partial'].includes(encStatus.status)
    const periodLabel = `${MONTH_NAMES[encMonth - 1]} ${encYear}`

    return (
      <div className="w-full min-w-0 space-y-3">
        <section className="grid min-w-0 grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(120px,0.7fr)_minmax(140px,0.9fr)_auto] sm:items-end">
          <label className="block min-w-0 text-[10px] font-medium text-slate-500">Year
            <select value={encYear} onChange={(event) => setEncYear(Number(event.target.value))} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500">
              {[encYear - 1, encYear, encYear + 1].map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          <label className="block min-w-0 text-[10px] font-medium text-slate-500">Month
            <select value={encMonth} onChange={(event) => setEncMonth(Number(event.target.value))} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500">
              {MONTH_NAMES.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
            </select>
          </label>
          <button type="button" onClick={loadPreview} disabled={encLoading} className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <HeroIcons.ArrowPathIcon className={`h-4 w-4 ${encLoading ? 'animate-spin' : ''}`} />{encLoading ? 'Loading preview?' : 'Refresh preview'}
          </button>
        </section>

        {encLoading && <div className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-5 text-xs text-slate-500"><Spinner /> Loading encashment status?</div>}
        {!encLoading && alreadyRun && (
          <section className={`rounded-lg border p-3 ${encStatus.status === 'success' ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
            <div className="flex items-start gap-2"><HeroIcons.CheckCircleIcon className={`mt-0.5 h-4 w-4 shrink-0 ${encStatus.status === 'success' ? 'text-emerald-600' : 'text-amber-600'}`} /><div className="min-w-0 flex-1">
              <h3 className="text-xs font-semibold text-slate-800">Encashment {encStatus.status === 'success' ? 'completed' : 'completed with warnings'} ? {periodLabel}</h3>
              <dl className="mt-2 grid grid-cols-2 gap-3 text-[10px] sm:grid-cols-4"><div><dt className="text-slate-500">Employees</dt><dd className="font-semibold text-slate-800">{encStatus.records_processed ?? encPreviewRows.length}</dd></div><div><dt className="text-slate-500">Days encashed</dt><dd className="font-semibold text-slate-800">{Number(encStatus.total_days_encashed || 0).toFixed(2)}</dd></div><div><dt className="text-slate-500">Total pay (AED)</dt><dd className="font-semibold text-slate-800">{Number(encStatus.total_pay || 0).toLocaleString('en-AE', { minimumFractionDigits: 2 })}</dd></div><div><dt className="text-slate-500">Run by</dt><dd className="truncate font-semibold text-slate-800">{encStatus.triggered_by || '?'}</dd></div></dl>
              {encStatus.missing_salaries?.length > 0 && <details className="mt-2 text-[10px] text-amber-800"><summary className="cursor-pointer font-medium">{encStatus.missing_salaries.length} employees had no salary; payout was set to AED 0</summary><p className="mt-1 max-h-24 overflow-y-auto break-words rounded border border-amber-200 bg-white/70 p-2">{encStatus.missing_salaries.join(', ')}</p></details>}
            </div></div>
          </section>
        )}
        {!encLoading && !alreadyRun && <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600"><HeroIcons.InformationCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><span>No encashment run found for {periodLabel}. Review the preview above before starting the run.</span></div>}
        {encMsg && <div role="status" className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${encMsg.type === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          {encMsg.type === 'ok' ? <HeroIcons.CheckCircleIcon className="h-4 w-4 shrink-0" /> : <HeroIcons.ExclamationCircleIcon className="h-4 w-4 shrink-0" />}{encMsg.text}
        </div>}
        {isHRManager && <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-3"><button type="button" disabled={alreadyRun || encRunning || encLoading} onClick={() => setEncConfirm(true)} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-700 px-4 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"><HeroIcons.BanknotesIcon className="h-4 w-4" />{encRunning ? 'Running encashment?' : alreadyRun ? `Already run for ${periodLabel}` : `Run encashment for ${periodLabel}`}</button>{alreadyRun && <span className="text-[10px] text-slate-500">Completed {encStatus.executed_at ? new Date(encStatus.executed_at).toLocaleDateString() : ''}</span>}</div>}
      </div>
    )
  }

  const renderRequests = () => (
    <div className="leave-tab-workspace leave-request-workspace">
      {reqTab !== 'new' && (
        <div className="leave-split-layout">
          <div className="leave-workspace-main">
            {renderQuickAccess()}
            <section className="leave-panel leave-requests-main">
              <h2 className="mb-2 text-sm font-semibold text-slate-900">Leave requests</h2>
              <div className="leave-summary-grid mb-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
                {[
                  { label: 'Pending', value: requests.filter((request) => ['PENDING', 'RM_APPROVED'].includes(request.status)).length, icon: 'DocumentTextIcon', color: 'text-amber-600' },
                  { label: 'Approved', value: requests.filter((request) => request.status === 'APPROVED').length, icon: 'CheckCircleIcon', color: 'text-emerald-600' },
                  { label: 'Rejected', value: requests.filter((request) => ['REJECTED', 'RM_REJECTED'].includes(request.status)).length, icon: 'XCircleIcon', color: 'text-red-600' },
                  { label: 'Cancelled', value: requests.filter((request) => request.status === 'CANCELLED').length, icon: 'NoSymbolIcon', color: 'text-slate-500' },
                ].map((item) => { const Icon = HeroIcons[item.icon] || HeroIcons.DocumentTextIcon; return <div key={item.label} className="flex items-center gap-2 rounded-md border border-slate-200 px-2 py-2"><Icon className={`h-6 w-6 shrink-0 ${item.color}`} /><span><strong className={`block text-base leading-5 ${item.color}`}>{reqLoading ? '…' : item.value}</strong><span className="text-[9px] font-medium uppercase text-slate-500">{item.label}</span></span></div> })}
              </div>
              <div className="leave-subtabs" role="tablist" aria-label="Leave request status">
                {[['ALL','All requests'],['PENDING','Pending'],['APPROVED','Approved'],['REJECTED','Rejected'],['CANCELLED','Cancelled']].map(([status, label]) => <button key={status} type="button" role="tab" aria-selected={requestStatusFilter === status} onClick={() => { setRequestStatusFilter(status); setRequestPage(1); setReqTab('all') }} className={requestStatusFilter === status ? 'is-active' : ''}>{label}{status === 'PENDING' ? ` (${requests.filter((request) => ['PENDING','RM_APPROVED'].includes(request.status)).length})` : ''}</button>)}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
                <label className="leave-field-label">Search employee or request ID<div className="leave-search-field"><HeroIcons.MagnifyingGlassIcon aria-hidden="true" /><input value={requestSearch} onChange={(event) => { setRequestSearch(event.target.value); setRequestPage(1) }} placeholder="Name, employee ID, or request ID" /></div></label>
                <label className="leave-field-label">Leave type<select value={requestLeaveType} onChange={(event) => { setRequestLeaveType(event.target.value); setRequestPage(1) }}><option value="all">All types</option>{leaveTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
                <label className="leave-field-label">Department<select value={requestDepartment} onChange={(event) => { setRequestDepartment(event.target.value); setRequestPage(1) }}><option value="all">All departments</option>{requestDepartments.map((department) => <option key={department}>{department}</option>)}</select></label>
                <label className="leave-field-label">Date range<select value={requestDateRange} onChange={(event) => { setRequestDateRange(event.target.value); setRequestPage(1) }}><option value="all">All dates</option><option value="month">Current month</option><option value="upcoming">Upcoming</option><option value="past">Past</option></select></label>
              </div>
              {requestError && <div className="leave-error" role="alert"><span>{requestError}</span><button type="button" onClick={() => setRequestReloadKey((key) => key + 1)}>Retry</button></div>}
              <div className="mt-3 overflow-x-auto">
                <table className="leave-requests-table w-full min-w-[760px] table-fixed border-collapse">
                  <colgroup><col className="w-[5%]" /><col className="w-[32%]" /><col className="w-[18%]" /><col className="w-[22%]" /><col className="w-[8%]" /><col className="w-[10%]" /><col className="w-[5%]" /></colgroup>
                  <thead className="bg-slate-50 text-[9px] font-semibold uppercase text-slate-600"><tr><th className="px-2 py-2 text-left"> </th><th className="px-2 py-2 text-left">Employee</th><th className="px-2 py-2 text-left">Leave type</th><th className="px-2 py-2 text-left">Dates</th><th className="px-2 py-2 text-center">Days</th><th className="px-2 py-2 text-left">Status</th><th className="px-2 py-2 text-right">Action</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">{reqLoading ? <tr><td colSpan={7} className="leave-table-message"><Spinner /> Loading requests…</td></tr> : requestError ? <tr><td colSpan={7} className="leave-table-message">Requests are unavailable. Retry to load them.</td></tr> : visibleRequests.length ? visibleRequests.slice((requestPage - 1) * 6, requestPage * 6).map((request) => { const employeeRecord = records.find((record) => String(record.employee_code) === String(request.employee_code)); const selectedRow = String(selectedRequest?.id) === String(request.id); return <tr key={request.id} aria-selected={selectedRow} onClick={() => setSelectedRequestId(request.id)} className={selectedRow ? 'is-selected' : ''}><td><button type="button" className="leave-selection-button" aria-label={`Select ${request.employee_name}`} aria-pressed={selectedRow} onClick={() => setSelectedRequestId(request.id)}><span className={selectedRow ? 'is-selected' : ''} /></button></td><td><span className="leave-employee-link"><span className="leave-avatar">{String(request.employee_name || '?').split(/\s+/).map((part) => part[0]).slice(0,2).join('').toUpperCase()}</span><span className="leave-employee-copy"><strong>{request.employee_name}</strong><span>{request.employee_code || '—'} · {request.job_title || employeeRecord?.job_title || employeeRecord?.designation || request.department || 'Employee'}</span></span></span></td><td className="leave-request-type">{request.leave_type_detail?.name || request.leave_type_detail?.code || 'Leave'}</td><td>{formatLeaveDate(request.start_date)} – {formatLeaveDate(request.end_date)}</td><td className="is-numeric">{Number(request.days_requested).toFixed(2)}</td><td><span className={`leave-status ${String(request.status).toLowerCase()}`}>{request.status_display || request.status}</span></td><td className="is-actions"><button type="button" onClick={(event) => { event.stopPropagation(); setSelectedRequestId(request.id) }} className="leave-view-action">{request.can_review ? 'Review' : 'View'}</button></td></tr> }) : <tr><td colSpan={7} className="leave-table-message">No requests match these filters.</td></tr>}</tbody>
                </table>
              </div>
              <div className="leave-pagination mt-2 flex items-center justify-between text-[10px] text-slate-600"><span>{visibleRequests.length ? `${(requestPage - 1) * 6 + 1} - ${Math.min(requestPage * 6, visibleRequests.length)} of ${visibleRequests.length}` : 0} requests</span><div className="flex items-center gap-1"><button type="button" aria-label="Previous page" disabled={requestPage <= 1} onClick={() => setRequestPage((page) => Math.max(1, page - 1))} className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40"><HeroIcons.ChevronLeftIcon className="h-3 w-3" /></button><span className="rounded bg-blue-600 px-2 py-1 text-white">{requestPage}</span><button type="button" aria-label="Next page" disabled={requestPage >= requestTotalPages} onClick={() => setRequestPage((page) => Math.min(requestTotalPages, page + 1))} className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40"><HeroIcons.ChevronRightIcon className="h-3 w-3" /></button></div></div>
            </section>
          </div>
          <aside className="leave-panel leave-request-details">
            {selectedRequest ? (() => {
              const employeeRecord = records.find((record) => String(record.employee_code) === String(selectedRequest.employee_code))
              const availableBalance = employeeRecord ? Number(employeeRecord.leave_balance || 0) : null
              const duration = Number(selectedRequest.days_requested || 0)
              const approvalSteps = selectedRequest.approval_steps || []
              const activeStep = approvalSteps.find((step) => step.active)
              const attachment = selectedRequest.attachment
              const dateLabel = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '?'
              const managerStage = selectedRequest.review_stage === 'manager_review'
              const approveAction = managerStage ? 'rm_approve' : 'approve'
              const rejectAction = managerStage ? 'rm_reject' : 'reject'
              return <>
                <div className="leave-detail-heading"><div><h2>Request details</h2><p>ID <strong>{selectedRequest.request_number || selectedRequest.id}</strong></p></div><span className={`leave-status ${String(selectedRequest.status).toLowerCase()}`}>{selectedRequest.status_display || selectedRequest.status}</span></div>
                <div className="leave-detail-person"><span className="leave-avatar leave-avatar-large">{String(selectedRequest.employee_name || '?').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><div><strong>{selectedRequest.employee_name}</strong><span>{selectedRequest.job_title || employeeRecord?.job_title || employeeRecord?.designation || 'Employee'}</span><span>{selectedRequest.department || employeeRecord?.department || 'Department unavailable'}</span></div></div>
                <section className="leave-detail-section"><h3>Leave details</h3><dl>
                  <div><dt>Type</dt><dd>{selectedRequest.leave_type_detail?.name || selectedRequest.leave_type_detail?.code || 'Leave'}</dd></div>
                  <div><dt>Start date</dt><dd>{dateLabel(selectedRequest.start_date)}</dd></div>
                  <div><dt>End date</dt><dd>{dateLabel(selectedRequest.end_date)}</dd></div>
                  <div><dt>Duration</dt><dd>{duration.toFixed(2)} working days</dd></div>
                  <div><dt>Available balance</dt><dd>{availableBalance === null ? 'Unavailable' : `${availableBalance.toFixed(2)} days`}</dd></div>
                  <div><dt>After approval</dt><dd>{availableBalance === null ? 'Calculated on approval' : `${(availableBalance - duration).toFixed(2)} days*`}</dd></div>
                </dl>{availableBalance !== null && <p className="leave-detail-footnote">*Projection uses the displayed leave balance and requested duration.</p>}</section>
                <section className="leave-detail-section"><h3>Reason</h3><p className="leave-detail-reason">{selectedRequest.reason || 'No reason provided.'}</p></section>
                {attachment && <section className="leave-detail-section"><h3>Attachment</h3><a className="leave-attachment-link" href={attachment} target="_blank" rel="noreferrer"><HeroIcons.DocumentIcon aria-hidden="true" />View supporting document</a></section>}
                <section className="leave-detail-section"><h3>Approval route</h3>{approvalSteps.length ? <ol className="leave-approval-route">{approvalSteps.map((step, index) => <li key={step.code || index} className={step.active ? 'is-current' : step.complete ? 'is-complete' : ''}><span className="leave-approval-marker">{step.complete ? <HeroIcons.CheckIcon aria-hidden="true" /> : index + 1}</span><span><strong>{step.title}</strong><span>{step.active ? `Current stage${selectedRequest.line_manager_name ? ` ? ${selectedRequest.line_manager_name}` : ''}` : step.complete ? (step.detail || 'Complete') : step.rejected ? 'Rejected' : 'Awaiting review'}</span>{step.note && <small>{step.note}</small>}</span></li>)}</ol> : <p className="leave-detail-muted">{selectedRequest.status_display || selectedRequest.status}{activeStep?.title ? ` ? ${activeStep.title}` : ''}{selectedRequest.line_manager_name ? ` ? ${selectedRequest.line_manager_name}` : ''}</p>}{selectedRequest.referral_history?.length > 0 && <p className="leave-detail-muted">Last routed to {selectedRequest.referral_history.at(-1).approver}</p>}</section>
                {selectedRequest.can_review && <div className="leave-detail-actions"><div className="leave-review-note"><label htmlFor="leave-review-note">Review note</label><textarea id="leave-review-note" rows="2" value={reqNote} onChange={(event) => setReqNote(event.target.value)} placeholder="Optional note" /></div><div className="leave-detail-action-row"><button type="button" className="leave-primary-button" disabled={reviewBusy === selectedRequest.id} onClick={() => reviewRequest(selectedRequest.id, approveAction)}>Approve</button><button type="button" className="leave-danger-button" disabled={reviewBusy === selectedRequest.id} onClick={() => reviewRequest(selectedRequest.id, rejectAction)}>Reject</button></div>{selectedRequest.can_refer && <button type="button" className="leave-secondary-button leave-full-button" onClick={() => openRequestReferral(selectedRequest)}>Request clarification</button>}</div>}
                {formMsg && <div role="alert" className={`leave-inline-message ${formMsg.type === 'ok' ? 'is-success' : 'is-error'}`}>{formMsg.text}</div>}
                {showReferral && <div className="leave-referral-form"><label className="leave-field-label">Authorized reviewer<select value={referralApproverId} onChange={(event) => setReferralApproverId(event.target.value)} disabled={!referralOptions.length}><option value="">{referralOptions.length ? 'Select reviewer' : 'No eligible reviewer'}</option>{referralOptions.map((option) => <option key={option.id} value={option.id}>{option.name}{option.employee_code ? ` ? ${option.employee_code}` : ''}</option>)}</select></label><label className="leave-field-label">Clarification note<textarea rows="2" value={referralNote} onChange={(event) => setReferralNote(event.target.value)} placeholder="Add context for the reviewer" /></label><div className="leave-detail-action-row"><button type="button" className="leave-primary-button" disabled={!referralApproverId || referralBusy} onClick={() => submitRequestReferral(selectedRequest)}>{referralBusy ? 'Sending?' : 'Send request'}</button><button type="button" className="leave-secondary-button" disabled={referralBusy} onClick={() => setShowReferral(false)}>Cancel</button></div></div>}
              </>
            })() : <div className="leave-no-selection"><HeroIcons.DocumentMagnifyingGlassIcon aria-hidden="true" /><strong>No request selected</strong><span>Select a request to see its details and available actions.</span></div>}
          </aside>
        </div>
      )}
      {/* ── NEW REQUEST form ─────────────────────────────────────────────── */}
      {reqTab === 'new' && (
        <div className="leave-new-request-workspace">
        {renderQuickAccess()}
        <div className="leave-panel leave-new-request-form">
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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Department</label>
              <input value={formState.department}
                onChange={e => setFormState(s => ({ ...s, department: e.target.value }))}
                placeholder="e.g. Engineering"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Leave Type <span className="text-rose-500">*</span></label>
              <select value={formState.leave_type}
                onChange={e => setFormState(s => ({ ...s, leave_type: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">End Date <span className="text-rose-500">*</span></label>
              <input type="date" value={formState.end_date} min={formState.start_date}
                onChange={e => setFormState(s => ({ ...s, end_date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Reason</label>
              <textarea rows={3} value={formState.reason}
                onChange={e => setFormState(s => ({ ...s, reason: e.target.value }))}
                placeholder="Optional reason / notes…"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-indigo-500" />
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
        </div>
      )}

      {/* ── PENDING / HISTORY table ─────────────────────────────────────── */}

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

  const branchSelector = (
    <div className="flex items-end gap-2">
      <label className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Year<select aria-label="Year" value={view === 'encashment' ? encYear : YEAR} onChange={event => { if (view === 'encashment') { setEncYear(Number(event.target.value)); setEncPage(1) } }} className="mt-1 block w-28 rounded border border-slate-200 bg-white px-2 py-2 text-xs font-normal normal-case text-slate-800">{(view === 'encashment' ? [encYear - 1, encYear, encYear + 1] : [YEAR]).map(year => <option key={year} value={year}>{year}</option>)}</select></label>
      <label className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Branch<select aria-label="Branch" value={branch || ''} onChange={event => { setBranch(event.target.value || null); setPage(1) }} className="mt-1 block w-44 rounded border border-slate-200 bg-white px-2 py-2 text-xs font-normal normal-case text-slate-800"><option value="">All branches ({branchCounts.ALL})</option>{BRANCHES.map(item => <option key={item.id} value={item.id}>{item.label} ({branchCounts[item.id] ?? 0})</option>)}</select></label>
      <button type="button" onClick={() => { const rows = view === 'encashment' ? encFilteredRows.map((row) => [row.employee_name, row.employee_code, row.days_encashed, row.daily_rate, row.encashment_pay]) : [LIST_COLS.map(column => column.label), ...filtered.map(record => LIST_COLS.map(column => column.accessor(record)))]; const csv = (view === 'encashment' ? [['Employee', 'Employee ID', 'Days', 'Daily rate (AED)', 'Amount (AED)'], ...rows] : rows).map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n'); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); link.download = view === 'encashment' ? `leave-encashment-${encYear}-${String(encMonth).padStart(2, '0')}.csv` : `leave-balances-${YEAR}.csv`; link.click(); URL.revokeObjectURL(link.href) }} className="inline-flex items-center gap-2 rounded border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"><HeroIcons.ArrowDownTrayIcon className="h-4 w-4" />Export</button>
      {view === 'requests' && <button type="button" onClick={() => setReqTab('new')} className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"><HeroIcons.PlusIcon className="h-4 w-4" />New request</button>}
      {view === 'encashment' && <button type="button" disabled={!isHRManager} onClick={() => setEncConfirm(true)} className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><HeroIcons.PlusIcon className="h-4 w-4" />New encashment</button>}
    </div>
  )

  return (
    <>
    <div className="leave-dashboard-space">
      {headerActions ? createPortal(branchSelector, headerActions) : <div className="flex justify-end">{branchSelector}</div>}
      <nav className="leave-tabs" role="tablist" aria-label="Leave management sections">
        {LEAVE_VIEWS.map((tab) => {
          const Icon = HeroIcons[tab.icon] || HeroIcons.TableCellsIcon
          const active = view === tab.id || (view === 'overviews' && tab.id === 'overview')
          return <button key={tab.id} id={`leave-tab-${tab.id}`} type="button" role="tab" aria-selected={active} aria-controls="leave-view-panel" tabIndex={active ? 0 : -1} onClick={() => { setPage(1); setView(tab.id) }} onKeyDown={(event) => {
            const currentIndex = LEAVE_VIEWS.findIndex((item) => item.id === tab.id)
            const nextIndex = event.key === 'ArrowRight' ? (currentIndex + 1) % LEAVE_VIEWS.length : event.key === 'ArrowLeft' ? (currentIndex - 1 + LEAVE_VIEWS.length) % LEAVE_VIEWS.length : event.key === 'Home' ? 0 : event.key === 'End' ? LEAVE_VIEWS.length - 1 : -1
            if (nextIndex >= 0) { event.preventDefault(); const nextTab = LEAVE_VIEWS[nextIndex]; document.getElementById(`leave-tab-${nextTab.id}`)?.focus(); setPage(1); setView(nextTab.id) }
          }} className={active ? 'is-active' : ''}><Icon aria-hidden="true" /><span>{tab.label}</span></button>
        })}
      </nav>
      <div id="leave-view-panel" className="leave-tab-panel" role="tabpanel" aria-labelledby={`leave-tab-${view === 'overviews' ? 'overview' : view}`}>
        {(view === 'overview' || view === 'overviews') && renderOverview()}
        {view === 'list' && renderList()}
        {view === 'detail' && renderDetail()}
        {view === 'requests' && renderRequests()}
        {view === 'encashment' && renderEncashmentWorkspace()}
      </div>
    </div>
    {encConfirm && createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEncConfirm(false) }}>
        <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="encashment-confirm-title">
          <h2 id="encashment-confirm-title" className="mb-2 flex items-center gap-2 text-base font-semibold text-slate-900"><HeroIcons.BanknotesIcon className="h-5 w-5 text-blue-600" />Confirm encashment</h2>
          <p className="mb-4 text-sm text-slate-600">This will encash all unused leave balances for <strong>{MONTH_NAMES[encMonth - 1]} {encYear}</strong> using the formula <code className="rounded bg-slate-100 px-1 text-xs">days × (salary ÷ {LEAVE_ENCASHMENT_WORKING_DAYS})</code>. This action cannot be undone.</p>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setEncConfirm(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button><button type="button" disabled={encRunning} onClick={handleRunEncashment} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">{encRunning ? 'Running…' : 'Yes, run encashment'}</button></div>
        </section>
      </div>,
      document.body,
    )}
    </>
  )
}

