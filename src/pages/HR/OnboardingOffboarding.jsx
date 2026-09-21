import { radaiConfirm, radaiAlert, radaiPrompt } from '../../services/radaiDialog'
/**
 * Onboarding & Offboarding Management
 * Employee lifecycle management — joining, exit, equipment, documents, access provisioning
 * 
 * ✅ MIGRATED: Now uses EmployeeMaster backend (employee_master_id, auto-generated employee_number)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import * as HeroIcons from '@heroicons/react/24/outline'
import apiClient from '../../services/api.service'
import DatePicker from '../../components/DatePicker'
import OrganizationSuggestions from '../../components/HR/OrganizationSuggestions'
import OnboardingDashboard from './OnboardingDashboard'
import CreateEmployeeWizard from './CreateEmployeeWizard'
import FullOnboardingOverview from './FullOnboardingOverview'
import './OnboardingDashboard.css'

// ── Soft-coded API endpoints ──────────────────────────────────────────────
// Note: apiClient baseURL already includes /api/v1, so paths are relative to that
const API_ENDPOINTS = {
  onboarding: '/onboarding',
  employees: '/users/employees',
  documents: '/onboarding/documents',
}

const API_BASE = API_ENDPOINTS.onboarding
const QUICK_EDIT_FIELDS = [
  { key: 'first_name', label: 'First Name', type: 'text', source: 'employee_master' },
  { key: 'last_name', label: 'Last Name', type: 'text', source: 'employee_master' },
  { key: 'email', label: 'Email', type: 'email', source: 'employee_master' },
  { key: 'job_title_uae', label: 'Organizational role / Job title (UAE)', type: 'text', source: 'employee_master' },
  { key: 'division', label: 'Division', type: 'text', source: 'employee_master' },
  { key: 'department', label: 'Department', type: 'text', source: 'employee_master' },
]

// ── Soft-coded status badges ──────────────────────────────────────────────
const ONBOARDING_STATUS_CONFIG = {
  initiated: { label: 'Initiated', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  documentation: { label: 'Documentation', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  equipment: { label: 'Equipment', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  access_provisioning: { label: 'Access Setup', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  training: { label: 'Training', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Cancelled', color: 'bg-rose-100 text-rose-700 border-rose-200' },
}

const ONBOARDING_WORKFLOW_STAGES = [
  {
    id: 'pre_hire',
    label: 'Pre-Hire Initiation',
    statuses: ['initiated', 'documentation'],
    icon: HeroIcons.DocumentCheckIcon,
  },
  {
    id: 'it_provisioning',
    label: 'IT Provisioning',
    statuses: ['equipment', 'access_provisioning'],
    icon: HeroIcons.ComputerDesktopIcon,
  },
  {
    id: 'orientation',
    label: 'First Day Orientation',
    statuses: ['training'],
    icon: HeroIcons.AcademicCapIcon,
  },
  {
    id: 'final_validation',
    label: 'Final Checklist Validation',
    statuses: ['completed'],
    icon: HeroIcons.ClipboardDocumentCheckIcon,
  },
]

const OFFBOARDING_CHECKLIST_STAGES = [
  { id: 'exit_initiation', label: 'Exit Initiation', shortLabel: 'Initiation', owner: 'HR', icon: HeroIcons.DocumentCheckIcon },
  { id: 'access_revocation', label: 'Access Revocation', shortLabel: 'Access', owner: 'ICT', icon: HeroIcons.LockClosedIcon },
  { id: 'asset_return', label: 'Asset Return', shortLabel: 'Assets', owner: 'ICT / HR', icon: HeroIcons.ComputerDesktopIcon },
  { id: 'exit_clearance', label: 'Exit Interview & Clearance', shortLabel: 'Clearance', owner: 'HR', icon: HeroIcons.UserGroupIcon },
  { id: 'final_settlement', label: 'Final Settlement', shortLabel: 'Settlement', owner: 'HR / Finance', icon: HeroIcons.BanknotesIcon },
]

const OFFBOARDING_STATUS_CONFIG = {
  initiated: { label: 'Initiated', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  access_revocation: { label: 'Access Revoked', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  equipment_return: { label: 'Equipment Return', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  exit_interview: { label: 'Exit Interview', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  final_settlement: { label: 'Final Settlement', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Cancelled', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700 border-red-200' },
}

const EXIT_REASON_CONFIG = {
  resignation: { label: 'Resignation', icon: HeroIcons.UserMinusIcon },
  termination: { label: 'Termination', icon: HeroIcons.ExclamationTriangleIcon },
  contract_end: { label: 'Contract End', icon: HeroIcons.DocumentTextIcon },
  retirement: { label: 'Retirement', icon: HeroIcons.SparklesIcon },
  relocation: { label: 'Relocation', icon: HeroIcons.GlobeAltIcon },
  health: { label: 'Health', icon: HeroIcons.HeartIcon },
  performance: { label: 'Performance', icon: HeroIcons.ChartBarIcon },
  redundancy: { label: 'Redundancy', icon: HeroIcons.MinusCircleIcon },
  other: { label: 'Other', icon: HeroIcons.QuestionMarkCircleIcon },
}

const BRANCH_CONFIG = {
  RAD: { label: 'Rejlers Abu Dhabi', color: 'text-blue-600' },
  RIN: { label: 'Rejlers India', color: 'text-emerald-600' },
}


// Shared button styles for the existing offboarding actions.
const BUTTON_SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

/**
 * Button Style Variants
 * Pre-defined color schemes for different button types
 */
const BUTTON_VARIANTS = {
  primary: {
    base: 'bg-blue-600 hover:bg-blue-700 text-white',
    outline: 'text-blue-600 hover:bg-blue-50 border border-blue-200',
    ghost: 'text-blue-600 hover:bg-blue-50',
  },
  secondary: {
    base: 'bg-slate-600 hover:bg-slate-700 text-white',
    outline: 'text-slate-600 hover:bg-slate-50 border border-slate-200',
    ghost: 'text-slate-600 hover:bg-slate-50',
  },
  success: {
    base: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    outline: 'text-emerald-600 hover:bg-emerald-50 border border-emerald-200',
    ghost: 'text-emerald-600 hover:bg-emerald-50',
  },
  warning: {
    base: 'bg-amber-600 hover:bg-amber-700 text-white',
    outline: 'text-amber-600 hover:bg-amber-50 border border-amber-200',
    ghost: 'text-amber-600 hover:bg-amber-50',
  },
  danger: {
    base: 'bg-rose-600 hover:bg-rose-700 text-white',
    outline: 'text-rose-600 hover:bg-rose-50 border border-rose-200',
    ghost: 'text-rose-600 hover:bg-rose-50',
  },
}

const Spinner = () => (
  <svg className="animate-spin w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
  </svg>
)

// ── Main Component ─────────────────────────────────────────────────────────
export default function OnboardingOffboarding() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(
    ['overview', 'onboarding', 'offboarding', 'offboarding-list', 'create'].includes(requestedTab) ? requestedTab : 'overview'
  )
  const [detail, setDetail] = useState(() => requestedTab === 'onboarding' && (searchParams.get('record_id') || searchParams.get('user_id'))
    ? { recordId: searchParams.get('record_id'), employee: { user_id: searchParams.get('user_id') }, focusItChecklist: searchParams.get('action') === 'it-checklist' }
    : null)
  const [exitDetail, setExitDetail] = useState(null)
  const [showInitiateExit, setShowInitiateExit] = useState(false)
  const [exitError, setExitError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const focusedUserId = searchParams.get('user_id')
  const focusedRecordId = searchParams.get('record_id')
  const requestedAction = searchParams.get('action')

  useEffect(() => {
    setActiveTab(['overview', 'onboarding', 'offboarding', 'offboarding-list', 'create'].includes(requestedTab) ? requestedTab : 'overview')
  }, [requestedTab])

  useEffect(() => {
    if (requestedTab !== 'offboarding' || !focusedRecordId) return
    let active = true
    setExitError('')
    apiClient.get(`${API_BASE}/offboarding/${focusedRecordId}/`)
      .then(response => { if (active) setExitDetail({ record: response.data }) })
      .catch(() => { if (active) setExitError('Unable to open this offboarding record. Please select the employee from the dashboard to try again.') })
    return () => { active = false }
  }, [requestedTab, focusedRecordId])

  const openDetail = useCallback((record, focusItChecklist = false, focusedChecklistStage = null) => {
    const [firstName, ...lastName] = (record.employee_name || 'Employee').trim().split(/\s+/)
    setDetail({
      recordId: record.id,
      focusItChecklist,
      focusedChecklistStage,
      employee: {
        first_name: firstName,
        last_name: lastName.join(' '),
        user_id: record.user,
        employee_number: record.employee_id,
        email: record.employee_email,
        division: record.department,
        job_title_uae: record.position,
      },
    })
  }, [])
  const openEmployee = useCallback(employee => {
    setDetail({ employee, recordId: employee.onboarding_record_id || null })
  }, [])
  useEffect(() => {
    if (requestedTab !== 'onboarding' || (!focusedRecordId && !focusedUserId)) return
    setDetail({ recordId: focusedRecordId || null, employee: { user_id: focusedUserId }, focusItChecklist: requestedAction === 'it-checklist' })
  }, [requestedTab, focusedRecordId, focusedUserId, requestedAction])
  const closeDetail = useCallback(() => {
    setDetail(null)
    setActiveTab('overview')
    setRefreshKey(value => value + 1)
    setSearchParams(current => {
      const next = new URLSearchParams(current)
      next.delete('user_id'); next.delete('record_id'); next.delete('action')
      next.set('tab', 'overview')
      return next
    }, { replace: true })
  }, [setSearchParams])
  const openExitDetail = useCallback((record, _focusItChecklist = false, initialStage = 'exit_initiation') => {
    setExitError('')
    setExitDetail({ record, initialStage })
  }, [])
  const closeExitDetail = useCallback(() => {
    setExitDetail(null)
    setRefreshKey(value => value + 1)
  }, [])
  const updateExitDetail = useCallback(record => {
    setExitDetail(current => current?.record.id === record.id ? { ...current, record } : current)
  }, [])
  const isOffboarding = activeTab === 'offboarding' || activeTab === 'offboarding-list'

  const navigation = (
    <div className="lifecycle-tabs" role="group" aria-label="Employee lifecycle">
      <button type="button" aria-pressed={!isOffboarding} onClick={() => setActiveTab('overview')}>Onboarding</button>
      <button type="button" aria-pressed={isOffboarding} onClick={() => setActiveTab('offboarding')}>Offboarding</button>
    </div>
  )
  const startButton = (
    <button type="button" className="lifecycle-start" onClick={() => isOffboarding ? setShowInitiateExit(true) : setActiveTab('create')}>
      <HeroIcons.PlusIcon aria-hidden="true" />Start {isOffboarding ? 'offboarding' : 'onboarding'}
    </button>
  )

  if (detail) return <FullOnboardingOverview {...detail} onClose={closeDetail} />

  if (activeTab === 'create') return <CreateEmployeeWizard
    onCancel={() => setActiveTab('overview')}
    onCreated={result => {
      setActiveTab('overview')
      setRefreshKey(value => value + 1)
      openDetail({ id: result.onboarding_id, user: result.user_id, employee_name: result.employee_name, employee_id: result.employee_number, employee_email: result.email, department: result.department, position: result.position })
    }}
  />

  return (
    <div className="employee-lifecycle">
      <nav className="lifecycle-breadcrumb" aria-label="Breadcrumb">
        <a href="/hr">HR</a><span aria-hidden="true">/</span><span aria-current="page">Employee Lifecycle</span>
      </nav>
      <h1>Employee Lifecycle</h1>
      {exitError && <div role="alert" className="onboarding-notice">{exitError}</div>}
      {activeTab === 'overview' || activeTab === 'offboarding' ? (
        <OnboardingDashboard
          key={activeTab}
          mode={isOffboarding ? 'offboarding' : 'onboarding'}
          navigation={navigation}
          startButton={startButton}
          onOpenRecord={isOffboarding ? openExitDetail : openDetail}
          onOpenRegister={isOffboarding ? () => setActiveTab('offboarding-list') : undefined}
          refreshKey={refreshKey}
        />
      ) : (
        <>
          <div className="lifecycle-toolbar lifecycle-toolbar--detail">{navigation}{startButton}</div>
          {(
            <button type="button" className="lifecycle-back" onClick={() => setActiveTab(isOffboarding ? 'offboarding' : 'overview')}>
              <HeroIcons.ArrowLeftIcon aria-hidden="true" />Back to overview
            </button>
          )}
          {activeTab === 'onboarding' && !focusedRecordId && !focusedUserId && <OnboardingListTab onOpenEmployee={openEmployee} />}
          {activeTab === 'offboarding-list' && <OffboardingListTab focusedRecordId={focusedRecordId} />}
        </>
      )}
      {exitDetail && <OffboardingChecklistModal {...exitDetail} onClose={closeExitDetail} onUpdated={updateExitDetail} />}
      {showInitiateExit && <InitiateExitModal onClose={() => setShowInitiateExit(false)} onSuccess={() => { setShowInitiateExit(false); setActiveTab('offboarding'); setRefreshKey(value => value + 1) }} />}
    </div>
  )
}

// Statuses that count as "not yet completed" — mirrors backend statistics() overdue/upcoming definitions
const ONBOARDING_ACTIVE_STATUSES = ['initiated', 'documentation', 'equipment', 'access_provisioning', 'training']
const OFFBOARDING_ACTIVE_STATUSES = ['initiated', 'access_revocation', 'equipment_return', 'exit_interview', 'final_settlement']

function OnboardingListTab({ onOpenEmployee }) {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ search: '', status: '', branch: '' })
  const [stats, setStats] = useState({ total: 0, urgent: 0, overdue: 0, completed: 0 })
  const [saving, setSaving] = useState(false)
  const [deletingRecordId, setDeletingRecordId] = useState(null)
  const [alert, setAlert] = useState(null)
  const [viewMode, setViewMode] = useState('compact') // 'cards' or 'compact'
  const [editingRow, setEditingRow] = useState(null) // userId of row being edited
  const [editFormData, setEditFormData] = useState({}) // Form data for inline editing

  useEffect(() => {
    loadEmployees()
  }, [filters])

  const loadEmployees = () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.append('onboarding_active', 'true')
    if (filters.search) params.append('search', filters.search)
    if (filters.status) params.append('onboarding_status', filters.status)
    if (filters.branch) params.append('onboarding_branch', filters.branch)

    Promise.all([
      apiClient.get(`${API_ENDPOINTS.employees}/active_employees/?${params}`),
      apiClient.get(`${API_BASE}/onboarding/statistics/`),
    ])
      .then(([employeeRes, statsRes]) => {
        const data = employeeRes.data.results || []
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const joiningDays = (value) => value
          ? Math.ceil((new Date(`${value}T00:00:00`) - today) / 86400000)
          : null
        setEmployees(data)
        setStats({
          total: data.length,
          urgent: data.filter(item => {
            const days = joiningDays(item.onboarding_joining_date)
            return days !== null && days >= 0 && days <= 7
          }).length,
          overdue: data.filter(item => {
            const days = joiningDays(item.onboarding_joining_date)
            return days !== null && days < 0
          }).length,
          completed: statsRes.data?.completed_this_month || 0,
        })
      })
      .catch((err) => console.error('Failed to load employees:', err))
      .finally(() => setLoading(false))
  }

  const handleSyncWorkflows = () => {
    setLoading(true)
    apiClient.post(`${API_BASE}/onboarding/sync-missing/`)
      .then((res) => {
        const createdCount = res.data?.created_count || 0
        setAlert({
          type: 'success',
          message: createdCount ? `${createdCount} onboarding workflow${createdCount === 1 ? '' : 's'} initiated` : 'Onboarding workflows are up to date',
        })
        loadEmployees()
        window.setTimeout(() => setAlert(null), 4000)
      })
      .catch((err) => {
        setAlert({ type: 'error', message: err.response?.data?.detail || 'Unable to synchronize onboarding workflows' })
        setLoading(false)
      })
  }



  // ── Quick Edit Functions (for list view) ────────────────────────────────────
  const handleQuickEdit = (employee) => {
    setEditingRow(employee.user_id)
    // Initialize edit form with current values
    const formData = {}
    QUICK_EDIT_FIELDS.forEach(field => {
      formData[field.key] = employee[field.key] || ''
    })
    setEditFormData(formData)
  }

  const handleQuickSave = (userId) => {
    setSaving(true)
    
    // Prepare updates for each changed field
    const updates = []
    QUICK_EDIT_FIELDS.forEach(field => {
      const currentValue = employees.find(e => e.user_id === userId)?.[field.key] || ''
      const newValue = editFormData[field.key] || ''
      if (currentValue !== newValue) {
        updates.push(
          apiClient.patch(`${API_ENDPOINTS.employees}/${userId}/update_profile_field/`, {
            field: field.key,
            value: newValue,
            source: field.source,
          })
        )
      }
    })

    if (updates.length === 0) {
      setEditingRow(null)
      setSaving(false)
      return
    }

    Promise.all(updates)
      .then(() => {
        setAlert({ type: 'success', message: `Updated ${updates.length} field(s) successfully` })
        loadEmployees() // Reload to show updated data
        setEditingRow(null)
        setEditFormData({})
        setTimeout(() => setAlert(null), 3000)
      })
      .catch((err) => {
        setAlert({ type: 'error', message: err.response?.data?.error || 'Failed to update fields' })
        setTimeout(() => setAlert(null), 5000)
      })
      .finally(() => setSaving(false))
  }

  const handleQuickCancel = () => {
    setEditingRow(null)
    setEditFormData({})
  }

  const handleFieldChange = (fieldKey, value) => {
    setEditFormData(prev => ({
      ...prev,
      [fieldKey]: value
    }))
  }

  const handleDeleteOnboarding = async (employee) => {
    const recordId = employee.onboarding_record_id
    if (!recordId) {
      setAlert({ type: 'error', message: 'Onboarding record could not be identified' })
      return
    }

    const employeeName = `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || employee.email
    if (!(await radaiConfirm(`Delete onboarding for ${employeeName}? This will remove it from the active onboarding list.`))) return

    setDeletingRecordId(recordId)
    try {
      // Preserve a cancelled audit record so sync-missing does not recreate
      // this workflow the next time the onboarding page is opened.
      await apiClient.patch(`${API_BASE}/onboarding/${recordId}/`, { status: 'cancelled' })
      setAlert({ type: 'success', message: `${employeeName} removed from the onboarding list` })
      loadEmployees()
      window.setTimeout(() => setAlert(null), 4000)
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.detail || err.response?.data?.error || 'Failed to remove onboarding record',
      })
      window.setTimeout(() => setAlert(null), 5000)
    } finally {
      setDeletingRecordId(null)
    }
  }

  return (
    <div className="space-y-4">
      {editingRow && <OrganizationSuggestions id="onboarding-edit" />}
      {/* Alert */}
      {alert && (
        <div className={`rounded-lg border p-3 flex items-center gap-2 ${
          alert.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
            : 'bg-rose-50 border-rose-200 text-rose-700'
        }`}>
          {alert.type === 'success' ? (
            <HeroIcons.CheckCircleIcon className="w-5 h-5" />
          ) : (
            <HeroIcons.ExclamationCircleIcon className="w-5 h-5" />
          )}
          <span className="text-sm font-medium">{alert.message}</span>
        </div>
      )}

      {/* Quick Stats Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 p-4 text-white shadow-lg">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
              <HeroIcons.UserPlusIcon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold opacity-90">Onboarding Pipeline</h3>
              <p className="text-xs opacity-75">Active employee onboarding processes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSyncWorkflows}
              className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-xs font-semibold text-white ring-1 ring-white/30 transition hover:bg-white/25"
              title="Initiate workflows for employees missing onboarding"
            >
              <HeroIcons.UserPlusIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Sync Workflows</span>
            </button>
            <button
              type="button"
              onClick={loadEmployees}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white/90 transition hover:bg-white/15 hover:text-white"
              title="Reload onboarding records"
            >
              <HeroIcons.ArrowPathIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-white/10 p-3 backdrop-blur-sm"><div className="text-2xl font-bold">{stats.total}</div><div className="mt-1 text-xs opacity-80">Total Active</div></div>
          <div className="rounded-lg bg-white/10 p-3 backdrop-blur-sm"><div className="flex items-center gap-1 text-2xl font-bold">{stats.urgent}{stats.urgent > 0 && <HeroIcons.ExclamationTriangleIcon className="h-4 w-4 animate-pulse" />}</div><div className="mt-1 text-xs opacity-80">Joining Soon (≤7 days)</div></div>
          <div className="rounded-lg bg-white/10 p-3 backdrop-blur-sm"><div className="text-2xl font-bold">{stats.overdue}</div><div className="mt-1 text-xs opacity-80">Past Joining Date</div></div>
          <div className="rounded-lg bg-white/10 p-3 backdrop-blur-sm"><div className="text-2xl font-bold">{stats.completed}</div><div className="mt-1 text-xs opacity-80">Completed This Month</div></div>
        </div>
      </div>

      {/* Filters & View Toggle */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Filters</span>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button onClick={() => setViewMode('compact')} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${viewMode === 'compact' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`} title="List View"><HeroIcons.ListBulletIcon className="h-4 w-4" /></button>
              <button onClick={() => setViewMode('cards')} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${viewMode === 'cards' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`} title="Card View"><HeroIcons.Squares2X2Icon className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="relative">
              <HeroIcons.MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search by name, email, employee number..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All Active Statuses</option>
              {ONBOARDING_ACTIVE_STATUSES.map(status => <option key={status} value={status}>{ONBOARDING_STATUS_CONFIG[status]?.label || status}</option>)}
            </select>
            <select value={filters.branch} onChange={(e) => setFilters({ ...filters, branch: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All Branches</option>
              {Object.entries(BRANCH_CONFIG).map(([value, config]) => <option key={value} value={value}>{config.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Employee List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
          <Spinner />
          <span className="ml-2 text-slate-500 mt-2">Loading active onboarding...</span>
        </div>
      ) : employees.length === 0 ? (
        <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-xl border-2 border-dashed border-slate-300 p-16 text-center">
          <HeroIcons.InboxIcon className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">No active onboarding found</p>
          <p className="text-xs text-slate-400 mt-1">Completed and cancelled workflows are hidden</p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {employees.map((employee) => (
            <div
              key={employee.user_id}
              className="bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200 overflow-hidden group"
            >
              {/* Card Header */}
              <div className="bg-gradient-to-r from-blue-500 to-violet-500 p-4 text-white">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-base">
                      {employee.first_name} {employee.last_name}
                    </h3>
                    {employee.preferred_given_name && (
                      <p className="text-xs text-blue-100 mt-0.5">
                        &ldquo;{employee.preferred_given_name}&rdquo;
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-white/20 text-xs font-medium backdrop-blur-sm">
                        <HeroIcons.IdentificationIcon className="w-3 h-3 mr-1" />
                        {employee.employee_number || 'No ID'}
                      </span>
                      {employee.onboarding_status && (
                        <span className="inline-flex items-center rounded bg-white/20 px-2 py-0.5 text-xs font-medium backdrop-blur-sm">
                          <span className="mr-1 h-1.5 w-1.5 rounded-full bg-white" />
                          {ONBOARDING_STATUS_CONFIG[employee.onboarding_status]?.label || employee.onboarding_status}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white/30">
                    <HeroIcons.UserIcon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 space-y-3">
                {/* Email */}
                <div className="flex items-center gap-2">
                  <HeroIcons.EnvelopeIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-xs text-slate-600 truncate">{employee.email}</span>
                </div>

                {/* Manager */}
                {employee.manager_name && (
                  <div className="flex items-center gap-2">
                    <HeroIcons.UserCircleIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-xs text-slate-600">
                      Reports to: <span className="font-medium text-slate-700">{employee.manager_name}</span>
                    </span>
                  </div>
                )}

                {/* Organization */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  <div>
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">Department</p>
                    <p className="text-xs text-slate-700 font-medium truncate">
                      {employee.division || employee.department || <span className="text-slate-400 italic">—</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">Title</p>
                    <p className="text-xs text-slate-700 font-medium truncate">
                      {employee.job_title_uae || employee.job_title_finland || <span className="text-slate-400 italic">—</span>}
                    </p>
                  </div>
                </div>

                {/* Action Button */}
                <button
                  onClick={() => onOpenEmployee(employee)}
                  className="w-full mt-3 px-3 py-2 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-600 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2 border border-slate-200 hover:border-blue-300"
                >
                  <HeroIcons.ArrowsPointingOutIcon className="w-4 h-4" />
                  View Full Details
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Compact List View */
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {employees.map((employee) => (
            <div key={employee.user_id} className="hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center gap-4 p-4">
                {/* Avatar */}
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm">
                  {employee.first_name?.[0]}{employee.last_name?.[0]}
                </div>

                {/* Info Grid */}
                <div className="flex-1 min-w-0">
                  {editingRow === employee.user_id ? (
                    /* Edit Mode */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide block mb-1">First Name</label>
                        <input
                          type="text"
                          value={editFormData.first_name || ''}
                          onChange={(e) => handleFieldChange('first_name', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="First Name"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide block mb-1">Last Name</label>
                        <input
                          type="text"
                          value={editFormData.last_name || ''}
                          onChange={(e) => handleFieldChange('last_name', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Last Name"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide block mb-1">Email</label>
                        <input
                          type="email"
                          value={editFormData.email || ''}
                          onChange={(e) => handleFieldChange('email', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Email"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide block mb-1">Organizational role / Job title</label>
                        <input
                          type="text"
                          list="onboarding-edit-roles"
                          value={editFormData.job_title_uae || ''}
                          onChange={(e) => handleFieldChange('job_title_uae', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Job Title"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide block mb-1">Division</label>
                        <input
                          type="text"
                          list="onboarding-edit-departments"
                          value={editFormData.division || ''}
                          onChange={(e) => handleFieldChange('division', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Division"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide block mb-1">Department</label>
                        <input
                          type="text"
                          list="onboarding-edit-departments"
                          value={editFormData.department || ''}
                          onChange={(e) => handleFieldChange('department', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Department"
                        />
                      </div>
                    </div>
                  ) : (
                    /* View Mode */
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-x-6 gap-y-1 items-center">
                      {/* Name & Email */}
                      <div className="md:col-span-2">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {employee.first_name} {employee.last_name}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{employee.email}</p>
                      </div>
                      
                      {/* Employee # */}
                      <div>
                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Emp #</p>
                        <p className="text-xs text-slate-700 font-medium">{employee.employee_number || '—'}</p>
                      </div>
                      
                      {/* Manager */}
                      <div>
                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Manager</p>
                        <p className="text-xs text-slate-700 truncate">{employee.manager_name || '—'}</p>
                      </div>
                      
                      {/* Department */}
                      <div>
                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Department</p>
                        <p className="text-xs text-slate-700 truncate">{employee.division || employee.department || '—'}</p>
                      </div>
                      
                      {/* Job Title */}
                      <div>
                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Job Title</p>
                        <p className="text-xs text-slate-700 truncate">{employee.job_title_uae || employee.job_title_finland || '—'}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {editingRow === employee.user_id ? (
                    /* Edit Mode Actions */
                    <>
                      <button
                        onClick={() => handleQuickSave(employee.user_id)}
                        disabled={saving}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Save Changes"
                      >
                        <HeroIcons.CheckIcon className="w-4 h-4" />
                        Save
                      </button>
                      <button
                        onClick={handleQuickCancel}
                        disabled={saving}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        title="Cancel"
                      >
                        <HeroIcons.XMarkIcon className="w-4 h-4" />
                        Cancel
                      </button>
                    </>
                  ) : (
                    /* View Mode Actions */
                    <>
                      {employee.onboarding_status && (
                        <span className={`hidden rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide lg:inline-flex ${ONBOARDING_STATUS_CONFIG[employee.onboarding_status]?.color || 'border-slate-200 bg-slate-100 text-slate-700'}`}>
                          {ONBOARDING_STATUS_CONFIG[employee.onboarding_status]?.label || employee.onboarding_status}
                        </span>
                      )}
                      <button
                        onClick={() => handleQuickEdit(employee)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Employee"
                      >
                        <HeroIcons.PencilSquareIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => onOpenEmployee(employee)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Full Onboarding Details"
                      >
                        <HeroIcons.UserPlusIcon className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteOnboarding(employee)}
                        disabled={deletingRecordId === employee.onboarding_record_id}
                        className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                        title="Delete Onboarding"
                        aria-label={`Delete onboarding for ${employee.first_name || ''} ${employee.last_name || ''}`}
                      >
                        {deletingRecordId === employee.onboarding_record_id ? (
                          <HeroIcons.ArrowPathIcon className="w-5 h-5 animate-spin" />
                        ) : (
                          <HeroIcons.TrashIcon className="w-5 h-5" />
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}


    </div>
  )
}

function OnboardingWorkflowStatus({ employeeId }) {
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(false)

    apiClient
      .get(`${API_BASE}/onboarding/?user_id=${employeeId}`)
      .then((res) => {
        if (!active) return
        const records = Array.isArray(res.data) ? res.data : (res.data.results || [])
        setRecord(records[0] || null)
      })
      .catch((err) => {
        console.error('Failed to load onboarding workflow:', err)
        if (active) setError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [employeeId])

  const currentStageIndex = record
    ? ONBOARDING_WORKFLOW_STAGES.findIndex((stage) => stage.statuses.includes(record.status))
    : -1
  const checklistComplete = Boolean(
    record
      && record.checklist_count > 0
      && record.checklist_completed_count === record.checklist_count
  )

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <HeroIcons.ArrowTrendingUpIcon className="w-5 h-5 text-blue-500" />
          Onboarding Workflow Status
        </h4>
        {record && (
          <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-1">
            {record.progress_percentage || 0}% complete
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-5 text-sm text-slate-500">
          <Spinner />
          <span className="ml-2">Loading workflow...</span>
        </div>
      ) : error ? (
        <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
          Unable to load onboarding workflow.
        </p>
      ) : !record ? (
        <p className="text-sm text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
          No onboarding workflow has been created for this employee.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {ONBOARDING_WORKFLOW_STAGES.map((stage, index) => {
            const Icon = stage.icon
            const isCancelled = record.status === 'cancelled'
            const isFinalStage = stage.id === 'final_validation'
            const isComplete = !isCancelled && (
              index < currentStageIndex
              || record.status === 'completed'
              || (isFinalStage && checklistComplete)
            )
            const isCurrent = !isCancelled && !isComplete && index === currentStageIndex
            const statusLabel = isCancelled
              ? 'Cancelled'
              : isComplete
                ? 'Completed'
                : isCurrent
                  ? 'In Progress'
                  : 'Pending'
            const tone = isCancelled
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : isComplete
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : isCurrent
                  ? 'border-blue-300 bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                  : 'border-slate-200 bg-slate-50 text-slate-500'

            return (
              <div key={stage.id} className={`rounded-lg border p-3 ${tone}`}>
                <div className="flex items-start justify-between gap-2">
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {isComplete ? (
                    <HeroIcons.CheckCircleIcon className="w-4 h-4 flex-shrink-0" />
                  ) : isCurrent ? (
                    <span className="w-2 h-2 mt-1 rounded-full bg-blue-500 animate-pulse" />
                  ) : (
                    <HeroIcons.ClockIcon className="w-4 h-4 flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs font-semibold mt-2 min-h-[2rem]">{stage.label}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide mt-1">{statusLabel}</p>
                {isFinalStage && (
                  <p className="text-[10px] mt-1 opacity-80">
                    {record.checklist_completed_count || 0} / {record.checklist_count || 0} items validated
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ── SMART OFFBOARDING LIST CONFIGURATION ───────────────────────────────────
// All table columns, filters, and actions are configured here
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Offboarding Table Column Configuration
 * Each column can be configured with:
 * - id: unique identifier
 * - label: column header text
 * - field: data field key
 * - type: data type (text, date, number, badge, progress)
 * - width: column width (sm, md, lg, xl, auto)
 * - sortable: enable sorting
 * - filterable: enable filtering
 * - visible: default visibility
 * - order: display order
 * - render: custom render function
 */
const OFFBOARDING_TABLE_COLUMNS = [
  {
    id: 'employee',
    label: 'Employee',
    field: 'employee_name',
    type: 'text',
    width: 'lg',
    sortable: true,
    filterable: true,
    visible: true,
    order: 1,
    render: (record) => (
      <div>
        <p className="text-sm font-semibold text-slate-700">{record.employee_name || 'N/A'}</p>
        <p className="text-xs text-slate-500">{record.employee_email || ''}</p>
      </div>
    ),
  },
  {
    id: 'position',
    label: 'Position',
    field: 'position',
    type: 'text',
    width: 'md',
    sortable: true,
    filterable: false,
    visible: true,
    order: 2,
    render: (record) => (
      <span className="text-sm text-slate-600">{record.position || '—'}</span>
    ),
  },
  {
    id: 'branch',
    label: 'Branch',
    field: 'branch',
    type: 'badge',
    width: 'sm',
    sortable: true,
    filterable: true,
    visible: true,
    order: 3,
    render: (record) => {
      const branchCfg = BRANCH_CONFIG[record.branch] || BRANCH_CONFIG.RAD
      return <span className={`text-xs font-medium ${branchCfg.color}`}>{branchCfg.label}</span>
    },
  },
  {
    id: 'last_working_day',
    label: 'Last Working Day',
    field: 'last_working_day',
    type: 'date',
    width: 'md',
    sortable: true,
    filterable: false,
    visible: true,
    order: 4,
    render: (record) => {
      const daysUntil = record.days_until_exit
      const isUrgent = daysUntil <= 7 && daysUntil >= 0
      return (
        <div>
          <p className="text-sm text-slate-700">{record.last_working_day ? new Date(record.last_working_day).toLocaleDateString() : '—'}</p>
          {daysUntil !== undefined && (
            <p className={`text-xs ${isUrgent ? 'text-rose-600 font-semibold' : 'text-slate-500'}`}>
              {daysUntil > 0 ? `in ${daysUntil} days` : daysUntil === 0 ? 'Today' : `${Math.abs(daysUntil)} days ago`}
            </p>
          )}
        </div>
      )
    },
  },
  {
    id: 'exit_reason',
    label: 'Exit Reason',
    field: 'exit_reason',
    type: 'text',
    width: 'md',
    sortable: false,
    filterable: true,
    visible: true,
    order: 5,
    render: (record) => {
      const exitCfg = EXIT_REASON_CONFIG[record.exit_reason] || EXIT_REASON_CONFIG.other
      return <span className="text-xs text-slate-700">{exitCfg.label}</span>
    },
  },
  {
    id: 'status',
    label: 'Status',
    field: 'status',
    type: 'badge',
    width: 'md',
    sortable: true,
    filterable: true,
    visible: true,
    order: 6,
    render: (record) => {
      const statusCfg = OFFBOARDING_STATUS_CONFIG[record.status] || OFFBOARDING_STATUS_CONFIG.initiated
      return (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${statusCfg.color}`}>
          {statusCfg.label}
        </span>
      )
    },
  },
  {
    id: 'progress',
    label: 'Progress',
    field: 'progress_percentage',
    type: 'progress',
    width: 'md',
    sortable: true,
    filterable: false,
    visible: true,
    order: 7,
    render: (record) => (
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
          <div
            className="bg-rose-500 h-full transition-all"
            style={{ width: `${record.progress_percentage || 0}%` }}
          />
        </div>
        <span className="text-xs font-medium text-slate-600">{record.progress_percentage || 0}%</span>
      </div>
    ),
  },
]

/**
 * Offboarding List Action Buttons Configuration
 */
const OFFBOARDING_LIST_ACTIONS = [
  {
    id: 'add-offboarding',
    label: 'Initiate Exit',
    icon: HeroIcons.UserMinusIcon,
    variant: 'warning',
    style: 'base',
    size: 'md',
    onClick: (records, loadRecords, setShowInitiateModal) => {
      if (setShowInitiateModal) setShowInitiateModal(true)
    },
    visible: true,
    tooltip: 'Start new offboarding process',
  },
  {
    id: 'export-list',
    label: 'Export',
    icon: HeroIcons.ArrowDownTrayIcon,
    variant: 'secondary',
    style: 'outline',
    size: 'md',
    onClick: async (records) => {
      console.log('Export records:', records)
      await radaiAlert('Export feature - to be implemented')
    },
    visible: true,
    tooltip: 'Export offboarding list to Excel',
  },
  {
    id: 'refresh',
    label: 'Refresh',
    icon: HeroIcons.ArrowPathIcon,
    variant: 'secondary',
    style: 'ghost',
    size: 'md',
    onClick: (records, loadRecords) => {
      if (loadRecords) loadRecords()
    },
    visible: true,
    tooltip: 'Reload offboarding records',
  },
]

/**
 * Initiate Exit Form Field Configuration
 * All form fields are soft-coded here for easy maintenance
 */
const INITIATE_EXIT_FORM_FIELDS = [
  {
    id: 'employee',
    label: 'Select Employee',
    field: 'employee_id',
    type: 'select-search',
    required: true,
    section: 'employee',
    placeholder: 'Search by name or email...',
    tooltip: 'Select the employee who is leaving',
    validation: (value) => value ? null : 'Employee is required',
  },
  {
    id: 'position',
    label: 'Position',
    field: 'position',
    type: 'text',
    required: true,
    section: 'employee',
    placeholder: 'e.g., Senior Engineer',
    tooltip: 'Current position/job title',
    validation: (value) => value?.trim() ? null : 'Position is required',
  },
  {
    id: 'department',
    label: 'Department',
    field: 'department',
    type: 'text',
    required: true,
    section: 'employee',
    placeholder: 'e.g., Engineering',
    tooltip: 'Current department',
    validation: (value) => value?.trim() ? null : 'Department is required',
  },
  {
    id: 'reporting_manager',
    label: 'Reporting Manager',
    field: 'reporting_manager',
    type: 'text',
    required: false,
    section: 'employee',
    placeholder: 'Automatically selected manager',
    tooltip: 'Uses the active project PoM; falls back to the employee line manager',
    readOnly: true,
  },
  {
    id: 'branch',
    label: 'Branch',
    field: 'branch',
    type: 'select',
    required: true,
    section: 'employee',
    options: Object.entries(BRANCH_CONFIG).map(([key, cfg]) => ({
      value: key,
      label: cfg.label,
    })),
    defaultValue: 'RAD',
    tooltip: 'Office branch location',
  },
  {
    id: 'exit_reason',
    label: 'Exit Reason',
    field: 'exit_reason',
    type: 'select',
    required: true,
    section: 'exit',
    options: Object.entries(EXIT_REASON_CONFIG).map(([key, cfg]) => ({
      value: key,
      label: cfg.label,
    })),
    tooltip: 'Primary reason for leaving',
    validation: (value) => value ? null : 'Exit reason is required',
  },
  {
    id: 'exit_reason_detail',
    label: 'Exit Reason Details',
    field: 'exit_reason_detail',
    type: 'textarea',
    required: false,
    section: 'exit',
    placeholder: 'Provide additional details about the exit reason...',
    tooltip: 'Optional detailed explanation',
    rows: 3,
  },
  {
    id: 'last_working_day',
    label: 'Last Working Day',
    field: 'last_working_day',
    type: 'date',
    required: true,
    section: 'exit',
    tooltip: 'Expected last day at work',
    validation: (value) => {
      if (!value) return 'Last working day is required'
      const date = new Date(value)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (date < today) return 'Last working day cannot be in the past'
      return null
    },
  },
  {
    id: 'notice_period_days',
    label: 'Notice Period (Days)',
    field: 'notice_period_days',
    type: 'number',
    required: false,
    section: 'exit',
    defaultValue: 30,
    min: 0,
    max: 180,
    placeholder: '30',
    tooltip: 'Standard notice period in days',
  },
  {
    id: 'project_assignments',
    label: 'Project Assignments & Manager Approvals',
    field: 'project_assignments',
    type: 'project-assignments',
    required: false,
    section: 'tracking',
    tooltip: 'Add projects the employee is working on and assign project managers for approval. Required for employees assigned to active projects.',
    helpText: 'Step 1: Project managers must approve before proceeding to HR approvals. Add each project separately.',
  },
  {
    id: 'hr_coordinator',
    label: 'HR Coordinator',
    field: 'hr_coordinator',
    type: 'select',
    required: false,
    section: 'tracking',
    placeholder: 'Select HR coordinator...',
    tooltip: 'HR Coordinator responsible for processing exit documentation and clearances',
    options: [], // Will be populated from API
    helpText: 'Step 2: HR Coordinator processes documentation after project manager approval',
  },
  {
    id: 'hr_approver',
    label: 'HR Final Approver',
    field: 'hr_approver',
    type: 'select',
    required: false,
    section: 'tracking',
    placeholder: 'Select HR approver...',
    tooltip: 'HR Manager/Approver for final exit approval and settlement',
    options: [], // Will be populated from API
    helpText: 'Step 3: HR Approver provides final approval for exit process',
  },
  {
    id: 'notes',
    label: 'Additional Notes',
    field: 'notes',
    type: 'textarea',
    required: false,
    section: 'tracking',
    placeholder: 'Any additional information or special considerations...',
    tooltip: 'Internal notes about this offboarding process',
    rows: 3,
  },
]

/**
 * Form Sections Configuration
 */
const INITIATE_EXIT_FORM_SECTIONS = [
  {
    id: 'employee',
    label: 'Employee Information',
    icon: HeroIcons.UserIcon,
    description: 'Basic employee and position details',
  },
  {
    id: 'exit',
    label: 'Exit Details',
    icon: HeroIcons.ArrowRightOnRectangleIcon,
    description: 'Reason and timeline for departure',
  },
  {
    id: 'tracking',
    label: 'Process Tracking & Approvals',
    icon: HeroIcons.ClipboardDocumentCheckIcon,
    description: 'Three-step approval workflow: Project Managers → HR Coordinator → HR Approver',
  },
]

/**
 * Offboarding Filter Configuration
 */
const OFFBOARDING_FILTERS = [
  {
    id: 'search',
    type: 'text',
    placeholder: 'Search by name, email, position...',
    field: 'search',
    icon: HeroIcons.MagnifyingGlassIcon,
    width: 'full',
  },
  {
    id: 'status',
    type: 'select',
    placeholder: 'All Statuses',
    field: 'status',
    options: Object.entries(OFFBOARDING_STATUS_CONFIG).map(([key, cfg]) => ({
      value: key,
      label: cfg.label,
    })),
    width: 'md',
  },
  {
    id: 'branch',
    type: 'select',
    placeholder: 'All Branches',
    field: 'branch',
    options: Object.entries(BRANCH_CONFIG).map(([key, cfg]) => ({
      value: key,
      label: cfg.label,
    })),
    width: 'md',
  },
  {
    id: 'exit_reason',
    type: 'select',
    placeholder: 'All Exit Reasons',
    field: 'exit_reason',
    options: Object.entries(EXIT_REASON_CONFIG).map(([key, cfg]) => ({
      value: key,
      label: cfg.label,
    })),
    width: 'md',
  },
]

// ── Offboarding List Tab ───────────────────────────────────────────────────
function OffboardingChecklistPanel({ recordId, onUpdated, initialStage = 'exit_initiation' }) {
  const [record, setRecord] = useState(null)
  const [activeStage, setActiveStage] = useState(
    OFFBOARDING_CHECKLIST_STAGES.some(stage => stage.id === initialStage) ? initialStage : 'exit_initiation'
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState('')

  const loadRecord = async () => {
    const response = await apiClient.get(`${API_BASE}/offboarding/${recordId}/`)
    setRecord(response.data)
    if (onUpdated) onUpdated(response.data)
    return response.data
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    apiClient.get(`${API_BASE}/offboarding/${recordId}/`)
      .then(response => { if (active) setRecord(response.data) })
      .catch(err => { if (active) setError(err.response?.data?.detail || 'Unable to load offboarding checklist.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [recordId])

  const startStage = async () => {
    const ongoingProjects = record?.ongoing_projects || []
    if (ongoingProjects.length > 0) {
      const projectDetails = ongoingProjects.map(project => {
        const managers = project.project_managers?.length
          ? project.project_managers.join(', ')
          : 'PoM not assigned'
        return `${project.name || project.code || 'Unnamed project'} — Project Manager: ${managers}`
      }).join('\n')
      const confirmed = (await radaiConfirm(
        `This employee is assigned to an ongoing project:\n\n${projectDetails}\n\nPlease confirm with the Project Manager and clear the project assignment first. Do you want to continue starting this offboarding checklist stage?`
      ))
      if (!confirmed) return
    }

    setSaving('start')
    setError('')
    try {
      const response = await apiClient.post(`${API_BASE}/offboarding/${recordId}/start-checklist-stage/`, { stage: activeStage })
      setRecord(response.data)
      if (onUpdated) onUpdated(response.data)
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.stage || 'Unable to start this checklist stage.')
    } finally {
      setSaving(null)
    }
  }

  const toggleItem = async (item) => {
    setSaving(item.id)
    setError('')
    try {
      await apiClient.patch(`${API_BASE}/checklist/${item.id}/`, { completed: !item.completed })
      await loadRecord()
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to update this checklist item.')
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-8"><Spinner /><span className="ml-2 text-xs text-slate-500">Loading offboarding checklist...</span></div>
  if (!record) return <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error || 'Offboarding checklist is unavailable.'}</div>

  const items = record.checklist_items || []
  const stageItems = items.filter(item => item.stage === activeStage)
  const completedCount = stageItems.filter(item => item.completed).length
  const progress = stageItems.length ? Math.round((completedCount / stageItems.length) * 100) : 0
  const config = OFFBOARDING_CHECKLIST_STAGES.find(stage => stage.id === activeStage)
  const permission = record.checklist_stage_permissions?.[activeStage]
  const readOnly = ['completed', 'cancelled', 'rejected'].includes(record.status)
  const canManage = !readOnly && Boolean(permission?.can_manage)
  const canStart = !readOnly && Boolean(permission?.can_start)
  const stageAccessMessage = permission?.disabled_reason || (readOnly
    ? 'This offboarding workflow is closed. Its checklist is read-only.'
    : canStart
      ? `You may start this stage. Checklist updates are managed by ${permission?.owner_label || config?.owner}.`
      : `Your current access does not allow changes to this stage. This stage is managed by ${permission?.owner_label || config?.owner}.`)
  const StageIcon = config?.icon || HeroIcons.ClipboardDocumentListIcon
  const printDate = new Date().toLocaleDateString('en-CA')
  const printFileName = [record.employee_name, record.employee_id || 'No-ID', 'Offboarding-Signed-Off', printDate]
    .map(value => String(value).replace(/[\\/:*?"<>|]+/g, '-').trim())
    .filter(Boolean)
    .join('_')
  const ongoingProjects = record.ongoing_projects || []

  const handleSignedOffPrint = async () => {
    const printWindow = window.open('', '_blank', 'width=1100,height=850')
    if (!printWindow) {
      await radaiAlert('Print Preview was blocked. Please allow pop-ups and try again.')
      return
    }
    const escapeHtml = (value) => {
      const node = document.createElement('div')
      node.textContent = String(value ?? '')
      return node.innerHTML
    }
    const formatPrintDate = value => value ? new Date(value).toLocaleDateString() : '—'
    const documentNumber = `HR-OFF-${String(record.employee_id || 'NO-ID').replace(/[^a-zA-Z0-9-]/g, '-')}-${printDate}`
    const checklistRows = OFFBOARDING_CHECKLIST_STAGES.flatMap(stage => {
      const rows = items.filter(item => item.stage === stage.id)
      return rows.length
        ? rows.map((item, index) => `<tr><td>${escapeHtml(stage.label)}</td><td>${index + 1}</td><td>${escapeHtml(item.task_name)}</td><td class="${item.completed ? 'done' : 'pending'}">${item.completed ? 'Completed' : 'Pending'}</td><td>${escapeHtml(item.completed_by_name || '—')}</td><td>${formatPrintDate(item.completed_date)}</td></tr>`)
        : [`<tr><td>${escapeHtml(stage.label)}</td><td>—</td><td class="muted">Stage not started</td><td class="pending">Pending</td><td>—</td><td>—</td></tr>`]
    }).join('')
    const totalCompleted = items.filter(item => item.completed).length
    const completionStatus = record.status === 'completed' ? 'SIGNED-OFF / COMPLETED' : 'PENDING SIGN-OFF'

    printWindow.document.open()
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(printFileName)}</title><style>
      @page { size: A4 portrait; margin: 16mm 12mm 15mm; }
      * { box-sizing: border-box; } body { margin:0; color:#24324a; font-family:Arial,Helvetica,sans-serif; font-size:8.5pt; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      header { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #b4234d; padding-bottom:4mm; margin-bottom:5mm; }
      .brand { font-size:12pt; font-weight:800; letter-spacing:.04em; } .control { text-align:right; color:#596579; font-size:7pt; line-height:1.45; }
      h1 { margin:0 0 4mm; padding:3mm 4mm; color:white; background:#b4234d; font-size:14pt; letter-spacing:.03em; }
      .meta { display:grid; grid-template-columns:repeat(3,1fr); border:1px solid #aeb7c5; margin-bottom:5mm; }
      .field { min-height:14mm; padding:2.5mm 3mm; border-right:1px solid #d7dce4; border-bottom:1px solid #d7dce4; } .field:nth-child(3n){border-right:0}.field:nth-last-child(-n+3){border-bottom:0}
      .label { display:block; color:#6b7690; font-size:6.5pt; font-weight:700; text-transform:uppercase; letter-spacing:.07em; } .value { display:block; margin-top:1mm; font-size:9pt; font-weight:700; }
      .summary { display:flex; justify-content:space-between; align-items:center; padding:2.5mm 3mm; border:1px solid #e5a4b8; background:#fff3f6; margin-bottom:4mm; font-weight:700; }
      table { width:100%; border-collapse:collapse; table-layout:fixed; } thead { display:table-header-group; } th { padding:2mm; color:white; background:#394a67; border:1px solid #394a67; font-size:7pt; text-align:left; }
      td { padding:1.7mm 2mm; border:1px solid #cfd5df; vertical-align:top; line-height:1.25; } th:nth-child(1){width:20%}th:nth-child(2){width:5%}th:nth-child(3){width:35%}th:nth-child(4){width:11%}th:nth-child(5){width:17%}th:nth-child(6){width:12%}
      tr { break-inside:avoid; } .done { color:#08785c; font-weight:700; } .pending { color:#b4234d; font-weight:700; } .muted { color:#778195; font-style:italic; }
      .signatures { margin-top:6mm; break-inside:avoid; } .signatures h2 { margin:0 0 3mm; font-size:10pt; color:#394a67; }
      .signature-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:4mm; } .signature { min-height:25mm; border:1px solid #aeb7c5; padding:3mm; } .signature strong { display:block; margin-bottom:9mm; color:#394a67; } .lines { display:grid; grid-template-columns:1fr 1fr; gap:4mm; color:#6b7690; font-size:7pt; } .line { border-top:1px solid #657087; padding-top:1mm; }
      footer { margin-top:5mm; padding-top:2mm; border-top:1px solid #7b879a; display:flex; justify-content:space-between; color:#6b7690; font-size:7pt; }
    </style></head><body>
      <header><div class="brand">REJLERS ABU DHABI</div><div class="control">HR CONTROLLED DOCUMENT<br>CONFIDENTIAL<br>${escapeHtml(documentNumber)}</div></header>
      <h1>EMPLOYEE OFFBOARDING CHECKLIST — SIGNED-OFF RECORD</h1>
      <section class="meta">
        <div class="field"><span class="label">Employee</span><span class="value">${escapeHtml(record.employee_name)}</span></div>
        <div class="field"><span class="label">Employee ID</span><span class="value">${escapeHtml(record.employee_id || '—')}</span></div>
        <div class="field"><span class="label">Department</span><span class="value">${escapeHtml(record.department || '—')}</span></div>
        <div class="field"><span class="label">Position</span><span class="value">${escapeHtml(record.position || '—')}</span></div>
        <div class="field"><span class="label">Last Working Day</span><span class="value">${formatPrintDate(record.last_working_day)}</span></div>
        <div class="field"><span class="label">Exit Reason</span><span class="value">${escapeHtml(EXIT_REASON_CONFIG[record.exit_reason]?.label || record.exit_reason || '—')}</span></div>
        <div class="field"><span class="label">Reporting Manager</span><span class="value">${escapeHtml(record.reporting_manager || '—')}</span></div>
        <div class="field"><span class="label">Completion Date</span><span class="value">${formatPrintDate(record.actual_completion_date)}</span></div>
        <div class="field"><span class="label">Issue Date</span><span class="value">${printDate}</span></div>
      </section>
      <div class="summary"><span>${escapeHtml(completionStatus)}</span><span>${totalCompleted} of ${items.length} tasks completed · ${record.progress_percentage || 0}% workflow progress</span></div>
      <table><thead><tr><th>Stage</th><th>#</th><th>Checklist Item</th><th>Status</th><th>Completed By</th><th>Date</th></tr></thead><tbody>${checklistRows}</tbody></table>
      <section class="signatures"><h2>Formal Sign-Off</h2><div class="signature-grid">
        ${['Employee', 'Reporting Manager', 'Human Resources', 'ICT / Systems', 'Finance / Payroll'].map(role => `<div class="signature"><strong>${role}</strong><div class="lines"><span class="line">Name & Signature</span><span class="line">Date</span></div></div>`).join('')}
        <div class="signature"><strong>Final HR Authorization</strong><div class="lines"><span class="line">Name & Signature</span><span class="line">Date / Stamp</span></div></div>
      </div></section>
      <footer><span>${escapeHtml(printFileName)}.pdf</span><span>CONFIDENTIAL HR DOCUMENT</span></footer>
    </body></html>`)
    printWindow.document.close()
    printWindow.addEventListener('afterprint', () => printWindow.close(), { once: true })
    printWindow.setTimeout(() => { printWindow.focus(); printWindow.print() }, 500)
  }

  return (
    <section className="rounded-xl border border-rose-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3"><div><h4 className="flex items-center gap-2 text-sm font-bold text-slate-800"><HeroIcons.ClipboardDocumentCheckIcon className="h-5 w-5 text-rose-500" />Offboarding Checklist</h4><p className="mt-0.5 text-xs text-slate-500">RBAC-controlled exit workflow validation</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 ring-1 ring-rose-200">{items.filter(item => item.completed).length}/{items.length} complete</span><button type="button" onClick={handleSignedOffPrint} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-slate-900" title={`Print or save as ${printFileName}.pdf`}><HeroIcons.PrinterIcon className="h-4 w-4" />Signed-Off Print / PDF</button></div></div>
      {ongoingProjects.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-amber-900" role="alert">
          <div className="flex items-start gap-2.5">
            <HeroIcons.ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
            <div className="min-w-0">
              <p className="text-xs font-bold">Ongoing project assignment requires confirmation</p>
              {ongoingProjects.map(project => (
                <p key={`${project.source}-${project.id}`} className="mt-1 text-[11px] leading-5">
                  This employee is under <span className="font-bold">{project.name || project.code || 'an ongoing project'}</span>. Please confirm with Project Manager <span className="font-bold">{project.project_managers?.length ? project.project_managers.join(', ') : 'Not assigned'}</span> and clear the project assignment first.
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="mb-4 grid grid-cols-2 gap-1.5 rounded-lg bg-slate-100 p-1 lg:grid-cols-5">
        {OFFBOARDING_CHECKLIST_STAGES.map(stage => {
          const Icon = stage.icon
          const rows = items.filter(item => item.stage === stage.id)
          const done = rows.filter(item => item.completed).length
          const stagePermission = record.checklist_stage_permissions?.[stage.id]
          return <button key={stage.id} type="button" onClick={() => { setActiveStage(stage.id); setError('') }} className={`rounded-md px-2 py-2 text-left transition ${activeStage === stage.id ? 'bg-white text-rose-700 shadow-sm ring-1 ring-rose-200' : 'text-slate-600 hover:bg-white/70'}`}><span className="flex items-center justify-between"><Icon className="h-4 w-4" />{stagePermission?.can_manage ? <HeroIcons.PencilSquareIcon className="h-3.5 w-3.5 text-emerald-500" /> : <HeroIcons.LockClosedIcon className="h-3.5 w-3.5 text-slate-400" />}</span><span className="mt-1 block text-[11px] font-bold">{stage.shortLabel}</span><span className="text-[9px] font-semibold text-slate-400">{rows.length ? `${done}/${rows.length} complete` : `Owner: ${stagePermission?.owner_label || stage.owner}`}</span></button>
        })}
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h5 className="flex items-center gap-1.5 text-sm font-bold text-slate-800"><StageIcon className="h-4 w-4 text-rose-500" />{config?.label}</h5><p className="mt-0.5 text-[11px] font-semibold text-slate-400">Owner: {permission?.owner_label || config?.owner}</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700">{progress}% complete</span><button type="button" onClick={startStage} disabled={stageItems.length > 0 || !canStart || Boolean(saving)} className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-2.5 py-1.5 text-[11px] font-bold text-white disabled:bg-slate-200 disabled:text-slate-500">{saving === 'start' ? <Spinner /> : stageItems.length ? <HeroIcons.CheckCircleIcon className="h-4 w-4" /> : <HeroIcons.PlayIcon className="h-4 w-4" />}{stageItems.length ? 'Started' : canStart ? 'Start Checklist' : 'View Only'}</button></div></div>
      {!canManage && <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{stageAccessMessage}</div>}
      {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{String(error)}</div>}
      {stageItems.length === 0 ? <div className="rounded-lg border-2 border-dashed border-rose-200 bg-rose-50/30 px-4 py-7 text-center"><StageIcon className="mx-auto h-7 w-7 text-rose-400" /><p className="mt-2 text-xs font-semibold text-slate-700">{config?.label} has not started</p><p className="mt-1 text-[11px] text-slate-500">{canStart ? 'Start this stage to create its standard tasks.' : stageAccessMessage}</p></div> : <div className="space-y-2">{stageItems.map(item => <article key={item.id} className={`rounded-lg border p-3 ${item.completed ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200'}`}><div className="flex items-start gap-3"><button type="button" onClick={() => toggleItem(item)} aria-label={`${item.completed ? "Mark pending" : "Complete"}: ${item.task_name}`} title={!canManage ? stageAccessMessage : undefined} disabled={!canManage || Boolean(saving)} className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${item.completed ? 'bg-emerald-500 text-white' : 'border-2 border-slate-300 text-transparent'} disabled:cursor-not-allowed disabled:opacity-50`}>{saving === item.id ? <Spinner /> : <HeroIcons.CheckIcon className="h-3.5 w-3.5" />}</button><div className="min-w-0 flex-1"><p className={`text-xs font-semibold ${item.completed ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{item.task_name}</p><div className="mt-1.5 flex flex-wrap gap-3 text-[10px] text-slate-500"><span>Due {item.due_date ? new Date(item.due_date).toLocaleDateString() : 'Not set'}</span><span>{item.completed_by_name || 'Unassigned'}</span><span className="capitalize">{item.priority || 'medium'} priority</span></div></div></div></article>)}</div>}
    </section>
  )
}

function OffboardingChecklistModal({ record, onClose, onUpdated, initialStage }) {
  useEffect(() => {
    const handleEscape = event => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const statusConfig = OFFBOARDING_STATUS_CONFIG[record.status] || OFFBOARDING_STATUS_CONFIG.initiated

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl" role="dialog" aria-modal="true" aria-label={`${record.employee_name || 'Employee'} offboarding checklist`} onClick={event => event.stopPropagation()}>
        <header className="flex items-center justify-between gap-3 bg-gradient-to-r from-rose-600 to-pink-600 px-5 py-4 text-white">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white/20"><HeroIcons.UserMinusIcon className="h-6 w-6" /></div>
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-lg font-bold">{record.employee_name}</h2><span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold">{statusConfig.label}</span></div><p className="mt-0.5 truncate text-xs text-rose-100">Offboarding Checklist · {record.employee_id || record.employee_email}</p></div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white" title="Close offboarding checklist"><HeroIcons.XMarkIcon className="h-5 w-5" /></button>
        </header>
        <main className="flex-1 overflow-y-auto p-4">
          <OffboardingChecklistPanel key={record.id} recordId={record.id} onUpdated={onUpdated} initialStage={initialStage} />
        </main>
      </div>
    </div>
  )
}

function OffboardingListTab({ initialFilter, focusedRecordId } = {}) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    status: '',
    branch: initialFilter?.branch || '',
    exit_reason: '',
    search: '',
  })
  // Client-side date-range filter set when arriving from an Overview KPI card ('upcoming' | 'overdue' | 'completed' | 'all')
  const [dateFilter, setDateFilter] = useState(initialFilter?.dateFilter || 'all')
  const expandedRow = null
  const [editingField, setEditingField] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState(null)
  const [viewMode, setViewMode] = useState('table') // 'table' or 'cards'
  const [stats, setStats] = useState({ total: 0, urgent: 0, overdue: 0, completed: 0 })
  const [showInitiateModal, setShowInitiateModal] = useState(false)
  const [checklistRecord, setChecklistRecord] = useState(null)
  const [actionRecordId, setActionRecordId] = useState(null)
  const focusedRecordOpened = useRef(false)

  useEffect(() => {
    loadRecords()
  }, [filters])

  const displayRecords = useMemo(() => {
    if (dateFilter === 'all') return records
    const now = new Date()
    return records.filter((r) => {
      if (dateFilter === 'upcoming') {
        return r.days_until_exit >= 0 && r.days_until_exit <= 30 && OFFBOARDING_ACTIVE_STATUSES.includes(r.status)
      }
      if (dateFilter === 'overdue') {
        return r.days_until_exit < 0 && OFFBOARDING_ACTIVE_STATUSES.includes(r.status)
      }
      if (dateFilter === 'completed') {
        if (r.status !== 'completed' || !r.actual_completion_date) return false
        const d = new Date(r.actual_completion_date)
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      }
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, dateFilter])

  useEffect(() => {
    if (!focusedRecordId || focusedRecordOpened.current || records.length === 0) return
    const record = records.find(item => String(item.id) === String(focusedRecordId))
    if (record) {
      focusedRecordOpened.current = true
      setChecklistRecord(record)
    }
  }, [focusedRecordId, records])

  const loadRecords = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.status) params.append('status', filters.status)
    if (filters.branch) params.append('branch', filters.branch)
    if (filters.exit_reason) params.append('exit_reason', filters.exit_reason)
    if (filters.search) params.append('search', filters.search)

    apiClient
      .get(`${API_BASE}/offboarding/?${params}`)
      .then((res) => {
        // Handle both paginated response (res.data.results) and direct array (res.data)
        const data = Array.isArray(res.data) ? res.data : (res.data.results || [])
        setRecords(data)
        
        // Calculate stats from records
        const total = data.length
        const urgent = data.filter(r => r.days_until_exit <= 7 && r.days_until_exit >= 0).length
        const overdue = data.filter(r => r.days_until_exit < 0).length
        const completed = data.filter(r => r.status === 'completed').length
        setStats({ total, urgent, overdue, completed })
      })
      .catch((err) => console.error('Failed to load offboarding records:', err))
      .finally(() => setLoading(false))
  }

  const handleEdit = (recordId, field, currentValue) => {
    setEditingField({ recordId, field })
    setEditValue(currentValue || '')
  }

  const handleSave = () => {
    if (!editingField) return
    
    setSaving(true)
    const { recordId, field } = editingField

    apiClient
      .patch(`${API_BASE}/offboarding/${recordId}/`, {
        [field]: editValue,
      })
      .then(() => {
        setAlert({ type: 'success', message: 'Field updated successfully' })
        loadRecords() // Reload to show updated data
        setEditingField(null)
        setTimeout(() => setAlert(null), 3000)
      })
      .catch((err) => {
        setAlert({ type: 'error', message: err.response?.data?.error || 'Failed to update field' })
        setTimeout(() => setAlert(null), 5000)
      })
      .finally(() => setSaving(false))
  }

  const handleCancel = () => {
    setEditingField(null)
    setEditValue('')
  }

  const handleRejectOffboarding = async (record) => {
    const projectNames = (record.ongoing_projects || [])
      .map(project => `${project.code} - ${project.name}`)
      .join(', ')
    const reason = (await radaiPrompt(
      `Reject ${record.employee_name}'s offboarding request?\n\nActive project(s): ${projectNames}\n\nEnter the rejection reason:`,
      'Employee is assigned to an active project.',
    ))
    if (reason === null) return
    setActionRecordId(record.id)
    try {
      await apiClient.post(`${API_BASE}/offboarding/${record.id}/reject/`, { reason })
      setAlert({ type: 'success', message: 'Offboarding request rejected and the employee was notified.' })
      loadRecords()
    } catch (err) {
      setAlert({ type: 'error', message: err.response?.data?.detail || 'Unable to reject this offboarding request.' })
    } finally {
      setActionRecordId(null)
      setTimeout(() => setAlert(null), 5000)
    }
  }

  const handleDeleteOffboarding = async (record) => {
    if (!(await radaiConfirm(`Permanently delete the offboarding process for ${record.employee_name}? This cannot be undone.`))) return
    setActionRecordId(record.id)
    try {
      await apiClient.delete(`${API_BASE}/offboarding/${record.id}/`)
      if (checklistRecord?.id === record.id) setChecklistRecord(null)
      setAlert({ type: 'success', message: 'Offboarding process deleted successfully.' })
      loadRecords()
    } catch (err) {
      setAlert({ type: 'error', message: err.response?.data?.detail || 'Unable to delete this offboarding process.' })
    } finally {
      setActionRecordId(null)
      setTimeout(() => setAlert(null), 5000)
    }
  }

  const renderFieldValue = (record, field, label, type = 'text') => {
    const value = record[field]
    const isEmpty = !value || value === ''
    const isEditing = editingField?.recordId === record.id && editingField?.field === field

    // Non-editable fields (system fields)
    const nonEditableFields = ['id', 'user', 'created_by', 'assigned_to', 'created_at', 'updated_at', 'initiated_date', 'actual_completion_date', 'progress_percentage']
    const isEditable = !nonEditableFields.includes(field)

    if (isEditing && isEditable) {
      if (type === 'date') {
        return (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="flex-1 px-2 py-1 text-xs border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <button onClick={handleSave} disabled={saving} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="Save">
              <HeroIcons.CheckIcon className="w-4 h-4" />
            </button>
            <button onClick={handleCancel} disabled={saving} className="p-1 text-slate-500 hover:bg-slate-100 rounded transition-colors" title="Cancel">
              <HeroIcons.XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        )
      } else if (type === 'textarea') {
        return (
          <div className="flex flex-col gap-2">
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full px-2 py-1 text-xs border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows="3"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving} className="px-3 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors">
                Save
              </button>
              <button onClick={handleCancel} disabled={saving} className="px-3 py-1 text-xs bg-slate-500 text-white rounded hover:bg-slate-600 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )
      } else {
        return (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="flex-1 px-2 py-1 text-xs border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <button onClick={handleSave} disabled={saving} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="Save">
              <HeroIcons.CheckIcon className="w-4 h-4" />
            </button>
            <button onClick={handleCancel} disabled={saving} className="p-1 text-slate-500 hover:bg-slate-100 rounded transition-colors" title="Cancel">
              <HeroIcons.XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        )
      }
    }

    if (isEmpty && isEditable) {
      return (
        <div className="flex items-center gap-2 group">
          <span className="text-slate-400 italic text-xs">Empty</span>
          <button
            onClick={() => handleEdit(record.id, field, value)}
            className="opacity-0 group-hover:opacity-100 p-1 text-blue-600 hover:bg-blue-50 rounded transition-all"
            title="Edit"
          >
            <HeroIcons.PencilIcon className="w-3 h-3" />
          </button>
        </div>
      )
    }

    // Display value based on type
    if (type === 'date' && value) {
      return (
        <div className="flex items-center gap-2 group">
          <span className="text-xs text-slate-700">{new Date(value).toLocaleDateString()}</span>
          {isEditable && (
            <button
              onClick={() => handleEdit(record.id, field, value)}
              className="opacity-0 group-hover:opacity-100 p-1 text-blue-600 hover:bg-blue-50 rounded transition-all"
              title="Edit"
            >
              <HeroIcons.PencilIcon className="w-3 h-3" />
            </button>
          )}
        </div>
      )
    }

    return (
      <div className="flex items-center gap-2 group">
        <span className="text-xs text-slate-700">{value || '—'}</span>
        {isEditable && value && (
          <button
            onClick={() => handleEdit(record.id, field, value)}
            className="opacity-0 group-hover:opacity-100 p-1 text-blue-600 hover:bg-blue-50 rounded transition-all"
            title="Edit"
          >
            <HeroIcons.PencilIcon className="w-3 h-3" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Alert */}
      {alert && (
        <div className={`rounded-lg border p-3 flex items-center gap-2 ${
          alert.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
            : 'bg-rose-50 border-rose-200 text-rose-700'
        }`}>
          {alert.type === 'success' ? (
            <HeroIcons.CheckCircleIcon className="w-5 h-5" />
          ) : (
            <HeroIcons.ExclamationCircleIcon className="w-5 h-5" />
          )}
          <span className="text-sm font-medium">{alert.message}</span>
        </div>
      )}

      {/* Quick Stats Banner */}
      <div className="bg-gradient-to-r from-rose-500 to-pink-600 rounded-2xl p-4 text-white shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <HeroIcons.UserMinusIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold opacity-90">Offboarding Pipeline</h3>
              <p className="text-xs opacity-75">Active exit processes</p>
            </div>
          </div>
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {OFFBOARDING_LIST_ACTIONS.filter(action => action.visible).map(action => {
              const Icon = action.icon
              const variantStyle = BUTTON_VARIANTS[action.variant][action.style]
              const sizeClass = BUTTON_SIZES[action.size]
              return (
                <button
                  key={action.id}
                  onClick={() => action.onClick(records, loadRecords, setShowInitiateModal)}
                  className={`${variantStyle} ${sizeClass} rounded-lg font-medium transition-all flex items-center gap-2`}
                  title={action.tooltip}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{action.label}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs opacity-80 mt-1">Total Active</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <div className="text-2xl font-bold flex items-center gap-1">
              {stats.urgent}
              {stats.urgent > 0 && <HeroIcons.ExclamationTriangleIcon className="w-4 h-4 animate-pulse" />}
            </div>
            <div className="text-xs opacity-80 mt-1">Leaving Soon (≤7 days)</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <div className="text-2xl font-bold">{stats.overdue}</div>
            <div className="text-xs opacity-80 mt-1">Past Last Day</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <div className="text-2xl font-bold">{stats.completed}</div>
            <div className="text-xs opacity-80 mt-1">Completed</div>
          </div>
        </div>
      </div>

      {/* Filters & View Toggle */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Filters</span>
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Table View"
              >
                <HeroIcons.ListBulletIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'cards'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Card View"
              >
                <HeroIcons.Squares2X2Icon className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {OFFBOARDING_FILTERS.map(filter => {
              if (filter.type === 'text') {
                const Icon = filter.icon
                return (
                  <div key={filter.id} className="relative">
                    {Icon && (
                      <div className="absolute left-3 top-1/2 -translate-y-1/2">
                        <Icon className="w-4 h-4 text-slate-400" />
                      </div>
                    )}
                    <input
                      type="text"
                      placeholder={filter.placeholder}
                      value={filters[filter.field]}
                      onChange={(e) => setFilters({ ...filters, [filter.field]: e.target.value })}
                      className={`w-full ${Icon ? 'pl-10' : 'pl-3'} pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500`}
                    />
                  </div>
                )
              } else if (filter.type === 'select') {
                return (
                  <select
                    key={filter.id}
                    value={filters[filter.field]}
                    onChange={(e) => setFilters({ ...filters, [filter.field]: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="">{filter.placeholder}</option>
                    {filter.options.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                )
              }
            })}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
          <Spinner />
          <span className="ml-2 text-slate-500 mt-2">Loading offboarding records...</span>
        </div>
      ) : displayRecords.length === 0 ? (
        /* Enhanced Empty State */
        <div className="bg-gradient-to-br from-slate-50 via-white to-rose-50/30 rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-rose-100 to-pink-100 rounded-full flex items-center justify-center">
            <HeroIcons.UserMinusIcon className="w-10 h-10 text-rose-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">No Offboarding Records Found</h3>
          <p className="text-sm text-slate-600 mb-6 max-w-md mx-auto">
            {filters.search || filters.status || filters.branch || filters.exit_reason || dateFilter !== 'all' ? (
              "No records match your current filters. Try adjusting your search criteria."
            ) : (
              "There are currently no active offboarding processes. Initiate an exit process to get started."
            )}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setShowInitiateModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-lg font-medium transition-all shadow-md hover:shadow-lg flex items-center gap-2"
            >
              <HeroIcons.UserMinusIcon className="w-5 h-5" />
              Initiate Exit Process
            </button>
            {(filters.search || filters.status || filters.branch || filters.exit_reason || dateFilter !== 'all') && (
              <button
                onClick={() => {
                  setFilters({ status: '', branch: '', exit_reason: '', search: '' })
                  setDateFilter('all')
                }}
                className="px-6 py-3 border-2 border-slate-300 hover:border-slate-400 text-slate-700 rounded-lg font-medium transition-all flex items-center gap-2"
              >
                <HeroIcons.XMarkIcon className="w-5 h-5" />
                Clear Filters
              </button>
            )}
          </div>
        </div>
      ) : viewMode === 'cards' ? (
        /* Card View */
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayRecords.map((record) => {
            const statusCfg = OFFBOARDING_STATUS_CONFIG[record.status] || OFFBOARDING_STATUS_CONFIG.initiated
            const branchCfg = BRANCH_CONFIG[record.branch] || BRANCH_CONFIG.RAD
            const exitCfg = EXIT_REASON_CONFIG[record.exit_reason] || EXIT_REASON_CONFIG.other
            const daysUntil = record.days_until_exit
            const isUrgent = daysUntil <= 7 && daysUntil >= 0

            return (
              <div
                key={record.id}
                className="bg-white rounded-xl border border-slate-200 hover:border-rose-300 hover:shadow-xl transition-all duration-200 overflow-hidden group"
              >
                {/* Card Header */}
                <div className={`bg-gradient-to-r ${isUrgent ? 'from-rose-600 to-pink-600' : 'from-rose-500 to-pink-500'} p-4 text-white`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-bold text-base">{record.employee_name || 'N/A'}</h3>
                      <p className="text-xs text-rose-100 mt-0.5">{record.employee_email || ''}</p>
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-white/20 text-xs font-medium backdrop-blur-sm">
                          <HeroIcons.BriefcaseIcon className="w-3 h-3 mr-1" />
                          {record.position || 'N/A'}
                        </span>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${statusCfg.color} bg-white`}>
                          {statusCfg.label}
                        </span>
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white/30">
                      <HeroIcons.UserMinusIcon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3">
                  {record.has_ongoing_projects && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <div className="flex items-start gap-2">
                        <HeroIcons.ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                        <div>
                          <p className="text-xs font-bold text-amber-900">Assigned to active project</p>
                          <p className="mt-0.5 text-[11px] text-amber-800">
                            {(record.ongoing_projects || []).map(project => `${project.code} - ${project.name}`).join(', ')}
                          </p>
                          <p className="mt-1 text-[10px] text-amber-700">The responsible PoM was notified when this exit was initiated.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Last Working Day */}
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <HeroIcons.CalendarDaysIcon className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-medium text-slate-600">Last Working Day</span>
                      </div>
                      {isUrgent && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold">
                          <HeroIcons.ExclamationTriangleIcon className="w-3 h-3 mr-1" />
                          URGENT
                        </span>
                      )}
                    </div>
                    <div className="mt-1">
                      <p className="text-sm font-semibold text-slate-800">
                        {record.last_working_day ? new Date(record.last_working_day).toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        }) : '—'}
                      </p>
                      {daysUntil !== undefined && (
                        <p className={`text-xs mt-0.5 ${isUrgent ? 'text-rose-600 font-semibold' : 'text-slate-500'}`}>
                          {daysUntil > 0 ? `${daysUntil} days remaining` : daysUntil === 0 ? 'Today' : `${Math.abs(daysUntil)} days past`}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-600">Exit Process Progress</span>
                      <span className="text-xs font-bold text-slate-700">{record.progress_percentage || 0}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-rose-500 to-pink-600 h-full transition-all duration-500"
                        style={{ width: `${record.progress_percentage || 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <div>
                      <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Branch</div>
                      <div className={`text-xs font-semibold mt-1 ${branchCfg.color}`}>{branchCfg.label}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Exit Reason</div>
                      <div className="text-xs text-slate-700 mt-1">{exitCfg.label}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Equipment</div>
                      <div className="text-xs text-slate-700 mt-1">{record.equipment_count || 0} items</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Checklist</div>
                      <div className="text-xs text-slate-700 mt-1">
                        {record.checklist_completed_count || 0} / {record.checklist_count || 0}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => setChecklistRecord(record)}
                      className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition-all hover:bg-rose-100"
                      title="Open Offboarding Checklist"
                    >
                      <HeroIcons.UserMinusIcon className="h-4 w-4" />
                      Checklist
                    </button>
                    {record.can_manage_actions && record.has_ongoing_projects && OFFBOARDING_ACTIVE_STATUSES.includes(record.status) && (
                      <button
                        type="button"
                        onClick={() => handleRejectOffboarding(record)}
                        disabled={actionRecordId === record.id}
                        className="flex items-center justify-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                        title="Reject because the employee is assigned to an active project"
                      >
                        <HeroIcons.XCircleIcon className="h-4 w-4" />Reject
                      </button>
                    )}
                    {record.can_manage_actions && (
                      <button
                        type="button"
                        onClick={() => handleDeleteOffboarding(record)}
                        disabled={actionRecordId === record.id}
                        className="flex items-center justify-center rounded-lg bg-red-50 p-2 text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                        title="Delete offboarding process"
                      >
                        <HeroIcons.TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Details (shown below card when expanded) */}
                {expandedRow === record.id && (
                  <div className="border-t border-slate-200 bg-slate-50/50 p-4">
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Employee ID</span>
                          <div className="mt-1 text-xs text-slate-700">{record.employee_id || '—'}</div>
                        </div>
                        <div>
                          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Department</span>
                          <div className="mt-1 text-xs text-slate-700">{record.department || '—'}</div>
                        </div>
                        <div>
                          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Notice Period</span>
                          <div className="mt-1 text-xs text-slate-700">{record.notice_period_days || '—'} days</div>
                        </div>
                        <div>
                          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Manager</span>
                          <div className="mt-1 text-xs text-slate-700">{record.reporting_manager || '—'}</div>
                        </div>
                      </div>
                      {record.notes && (
                        <div>
                          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Notes</span>
                          <div className="mt-1 text-xs text-slate-700 bg-white rounded p-2">{record.notes}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* Table View (existing table code) */
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Position</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Branch</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Last Working Day</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Exit Reason</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Progress</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayRecords.map((record) => {
                  const statusCfg = OFFBOARDING_STATUS_CONFIG[record.status] || OFFBOARDING_STATUS_CONFIG.initiated
                  const branchCfg = BRANCH_CONFIG[record.branch] || BRANCH_CONFIG.RAD
                  const exitCfg = EXIT_REASON_CONFIG[record.exit_reason] || EXIT_REASON_CONFIG.other
                  const daysUntil = record.days_until_exit
                  const isUrgent = daysUntil <= 7 && daysUntil >= 0

                  return (
                    <>
                      <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-700">{record.employee_name}</p>
                            <p className="text-xs text-slate-500">{record.employee_email}</p>
                            {record.has_ongoing_projects && (
                              <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700" title={(record.ongoing_projects || []).map(project => `${project.code} - ${project.name}`).join(', ')}>
                                <HeroIcons.ExclamationTriangleIcon className="h-3 w-3" />Active project assigned
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{record.position}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium ${branchCfg.color}`}>{branchCfg.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm text-slate-700">{new Date(record.last_working_day).toLocaleDateString()}</p>
                            <p className={`text-xs ${isUrgent ? 'text-rose-600 font-semibold' : 'text-slate-500'}`}>
                              {daysUntil > 0 ? `in ${daysUntil} days` : daysUntil === 0 ? 'Today' : `${Math.abs(daysUntil)} days ago`}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs text-slate-700">
                            {exitCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${statusCfg.color}`}>
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-rose-500 h-full transition-all"
                                style={{ width: `${record.progress_percentage}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-slate-600">{record.progress_percentage}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setChecklistRecord(record)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 transition-colors hover:bg-rose-50"
                              title="Open Offboarding Checklist"
                            >
                              <HeroIcons.UserMinusIcon className="h-5 w-5" />
                            </button>
                            {record.can_manage_actions && record.has_ongoing_projects && OFFBOARDING_ACTIVE_STATUSES.includes(record.status) && (
                              <button
                                type="button"
                                onClick={() => handleRejectOffboarding(record)}
                                disabled={actionRecordId === record.id}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-amber-600 transition-colors hover:bg-amber-50 disabled:opacity-50"
                                title="Reject: employee has an active project assignment"
                              >
                                <HeroIcons.XCircleIcon className="h-5 w-5" />
                              </button>
                            )}
                            {record.can_manage_actions && (
                              <button
                                type="button"
                                onClick={() => handleDeleteOffboarding(record)}
                                disabled={actionRecordId === record.id}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                                title="Delete offboarding process"
                              >
                                <HeroIcons.TrashIcon className="h-5 w-5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Details */}
                      {expandedRow === record.id && (
                        <tr className="bg-slate-50/50">
                          <td colSpan="8" className="px-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {/* Employee Information */}
                              <div className="bg-white rounded-lg border border-slate-200 p-4">
                                <h4 className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                  <HeroIcons.UserIcon className="w-4 h-4 text-rose-500" />
                                  Employee Information
                                </h4>
                                <div className="space-y-2">
                                  <div>
                                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Employee ID</span>
                                    <div className="mt-1">{renderFieldValue(record, 'employee_id', 'Employee ID')}</div>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Department</span>
                                    <div className="mt-1">{renderFieldValue(record, 'department', 'Department')}</div>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Reporting Manager</span>
                                    <div className="mt-1">{renderFieldValue(record, 'reporting_manager', 'Reporting Manager')}</div>
                                  </div>
                                </div>
                              </div>

                              {/* Exit Information */}
                              <div className="bg-white rounded-lg border border-slate-200 p-4">
                                <h4 className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                  <HeroIcons.ArrowRightOnRectangleIcon className="w-4 h-4 text-rose-500" />
                                  Exit Information
                                </h4>
                                <div className="space-y-2">
                                  <div>
                                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Notice Period (Days)</span>
                                    <div className="mt-1">{renderFieldValue(record, 'notice_period_days', 'Notice Period')}</div>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Exit Reason Detail</span>
                                    <div className="mt-1">{renderFieldValue(record, 'exit_reason_detail', 'Exit Reason Detail', 'textarea')}</div>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Target Completion</span>
                                    <div className="mt-1">{renderFieldValue(record, 'target_completion_date', 'Target Completion', 'date')}</div>
                                  </div>
                                  {record.actual_completion_date && (
                                    <div>
                                      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Actual Completion</span>
                                      <div className="mt-1">
                                        <span className="text-xs text-slate-700">{new Date(record.actual_completion_date).toLocaleDateString()}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Tracking & Notes */}
                              <div className="bg-white rounded-lg border border-slate-200 p-4">
                                <h4 className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                  <HeroIcons.DocumentTextIcon className="w-4 h-4 text-rose-500" />
                                  Tracking & Notes
                                </h4>
                                <div className="space-y-2">
                                  <div>
                                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Equipment Count</span>
                                    <div className="mt-1">
                                      <span className="text-xs text-slate-700">{record.equipment_count || 0}</span>
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Documents Count</span>
                                    <div className="mt-1">
                                      <span className="text-xs text-slate-700">{record.documents_count || 0}</span>
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Checklist</span>
                                    <div className="mt-1">
                                      <span className="text-xs text-slate-700">
                                        {record.checklist_completed_count || 0} / {record.checklist_count || 0} completed
                                      </span>
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Notes</span>
                                    <div className="mt-1">{renderFieldValue(record, 'notes', 'Notes', 'textarea')}</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {checklistRecord && (
        <OffboardingChecklistModal
          record={checklistRecord}
          onClose={() => setChecklistRecord(null)}
          onUpdated={(updatedRecord) => {
            setChecklistRecord(current => current ? { ...current, ...updatedRecord } : current)
            loadRecords()
          }}
        />
      )}
      
      {/* Initiate Exit Modal */}
      {showInitiateModal && (
        <InitiateExitModal
          onClose={() => setShowInitiateModal(false)}
          onSuccess={() => {
            setShowInitiateModal(false)
            loadRecords() // Reload records to show new entry
            setAlert({ type: 'success', message: 'Offboarding process initiated successfully!' })
            setTimeout(() => setAlert(null), 5000)
          }}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ── INITIATE EXIT MODAL COMPONENT ──────────────────────────────────────────
// Smart form-based modal for creating new offboarding records
// ═══════════════════════════════════════════════════════════════════════════

export function InitiateExitModal({ onClose, onSuccess, initialEmployeeId = null, lockEmployee = false }) {
  // Form state
  const [formData, setFormData] = useState({})
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  // Data state
  const [employees, setEmployees] = useState([])
  const [hrManagers, setHrManagers] = useState([])
  const [projectManagers, setProjectManagers] = useState([]) // ✨ Project managers for approval flow
  const [hrCoordinators, setHrCoordinators] = useState([]) // ✨ HR coordinators
  const [hrApprovers, setHrApprovers] = useState([]) // ✨ HR approvers
  const [activeOffboardings, setActiveOffboardings] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [projectAssignments, setProjectAssignments] = useState([]) // ✨ NEW: Dynamic project assignments with managers
  const [showAllEmployeesForPM, setShowAllEmployeesForPM] = useState(false) // ✨ Toggle to show all employees when no project managers
  const [pmSearchTerms, setPmSearchTerms] = useState({}) // ✨ Search terms for each project assignment's PM list

  const activeOffboardingLookup = useMemo(() => {
    const byUserId = new Map()
    const byEmail = new Map()

    activeOffboardings.forEach(record => {
      if (record.user_id) byUserId.set(String(record.user_id), record)
      if (record.employee_email) byEmail.set(record.employee_email.toLowerCase(), record)
    })

    return { byUserId, byEmail }
  }, [activeOffboardings])

  const getActiveOffboarding = (employee) => {
    if (!employee) return null
    return activeOffboardingLookup.byUserId.get(String(employee.user_id))
      || activeOffboardingLookup.byEmail.get((employee.email || '').toLowerCase())
      || null
  }

  const selectedActiveOffboarding = getActiveOffboarding(selectedEmployee)
  
  // Initialize form with default values
  useEffect(() => {
    const defaults = {}
    INITIATE_EXIT_FORM_FIELDS.forEach(field => {
      if (field.defaultValue !== undefined) {
        defaults[field.field] = field.defaultValue
      }
    })
    setFormData(defaults)
  }, [])
  
  // Load employees, HR managers, project managers, HR coordinators, and HR approvers
  // ✅ ENHANCED: Smart API calls with role filtering and minimal mode for approval workflow
  useEffect(() => {
    setLoading(true)
    Promise.all([
      // All active employees (minimal response for performance)
      apiClient.get('/users/employees/active_employees/', {
        params: { minimal: 'true' }
      }),
      // HR managers only (filtered by role)
      apiClient.get('/users/employees/active_employees/', {
        params: { role_filter: 'hr_manager', minimal: 'true' }
      }),
      // ✨ NEW: Project managers for approval flow
      apiClient.get('/users/employees/active_employees/', {
        params: { role_filter: 'project_manager', minimal: 'true' }
      }),
      // ✨ NEW: HR Coordinators for Step 2 approval
      apiClient.get('/users/employees/active_employees/', {
        params: { role_filter: 'hr_coordinator', minimal: 'true' }
      }),
      // ✨ NEW: HR Approvers for Step 3 approval (typically HR managers or senior HR)
      apiClient.get('/users/employees/active_employees/', {
        params: { role_filter: 'hr_approver', minimal: 'true' }
      }),
      // Active offboarding records
      apiClient.get(`${API_BASE}/offboarding/active-employees/`),
    ])
      .then(([empRes, hrRes, pmRes, hrCoordRes, hrApproverRes, activeOffboardingRes]) => {
        const employeeRows = empRes.data.results || []
        setEmployees(employeeRows)
        setHrManagers(hrRes.data.results || [])
        
        // ✨ SOFT-CODED FALLBACK: If no users with project_manager role exist,
        // automatically fall back to all active employees for flexibility
        const projectManagerRows = pmRes.data.results || []
        if (projectManagerRows.length === 0) {
          console.warn('⚠️ No users with project_manager role found. Using all active employees as fallback.')
          setProjectManagers(employeeRows)
          setShowAllEmployeesForPM(true)
        } else {
          setProjectManagers(projectManagerRows)
          setShowAllEmployeesForPM(false)
        }
        
        // ✨ SOFT-CODED FALLBACK: Same pattern for HR Coordinators
        const hrCoordRows = hrCoordRes.data.results || []
        setHrCoordinators(hrCoordRows.length > 0 ? hrCoordRows : employeeRows)
        
        // ✨ SOFT-CODED FALLBACK: Same pattern for HR Approvers
        const hrApproverRows = hrApproverRes.data.results || []
        setHrApprovers(hrApproverRows.length > 0 ? hrApproverRows : employeeRows)
        
        setActiveOffboardings(activeOffboardingRes.data || [])
        const initialEmployee = initialEmployeeId
          ? employeeRows.find(employee => String(employee.user_id) === String(initialEmployeeId))
          : null
        if (initialEmployee) {
          const fullName = [initialEmployee.first_name, initialEmployee.last_name]
            .filter(Boolean)
            .join(' ') || initialEmployee.email.split('@')[0]
          setSelectedEmployee(initialEmployee)
          setFormData(previous => ({
            ...previous,
            employee_id: initialEmployee.employee_number || initialEmployee.employment_id || String(initialEmployee.user_id),
            employee_name: fullName,
            employee_email: initialEmployee.email,
            user: initialEmployee.user_id,
            position: initialEmployee.position || previous.position || '',
            department: initialEmployee.department || previous.department || '',
            reporting_manager: initialEmployee.reporting_manager || previous.reporting_manager || '',
            branch: initialEmployee.branch || previous.branch || 'RAD',
          }))
        }
        console.log('✅ Loaded employees:', empRes.data.count, 'HR managers:', hrRes.data.count, 
                    'Project managers:', projectManagerRows.length, 
                    '(fallback to all:', projectManagerRows.length === 0 ? 'YES' : 'NO' + ')',
                    'HR coordinators:', hrCoordRows.length, 
                    'HR approvers:', hrApproverRows.length)
      })
      .catch(async (err) => {
        console.error('Failed to load employees:', err)
        await radaiAlert('Failed to load employee data. Please refresh the page.')
      })
      .finally(() => setLoading(false))
  }, [initialEmployeeId])
  
  // Calculate target completion date (30 days after last working day)
  useEffect(() => {
    if (formData.last_working_day) {
      const lastDay = new Date(formData.last_working_day)
      const targetDate = new Date(lastDay)
      targetDate.setDate(lastDay.getDate() + 30)
      setFormData(prev => ({
        ...prev,
        target_completion_date: targetDate.toISOString().split('T')[0]
      }))
    }
  }, [formData.last_working_day])
  
  // Handle employee selection
  // ✅ ENHANCED: Smart field mapping from EmployeeMaster to offboarding fields
  const handleEmployeeSelect = (employeeId) => {
    const employee = employees.find(emp => String(emp.user_id) === String(employeeId))
    if (employee) {
      setSelectedEmployee(employee)
      
      // Build employee name from available fields
      const fullName = [employee.first_name, employee.last_name]
        .filter(Boolean)
        .join(' ') || employee.email.split('@')[0]
      
      setFormData(prev => ({
        ...prev,
        employee_id: employee.employee_number || employee.employment_id || employeeId,
        employee_name: fullName,
        employee_email: employee.email,
        user: employee.user_id,
        // Smart field mapping from EmployeeMaster → Offboarding fields
        position: employee.position || prev.position || '',
        department: employee.department || prev.department || '',
        reporting_manager: employee.reporting_manager || prev.reporting_manager || '',
        branch: employee.branch || prev.branch || 'RAD',
      }))
      setErrors(prev => ({ ...prev, employee_id: null }))
      setEmployeeSearch('')  // Clear search after selection
      
      console.log('✅ Selected employee:', fullName, '|', employee.position, '|', employee.department)
    }
  }
  
  // Handle field change
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error for this field
    setErrors(prev => ({ ...prev, [field]: null }))
  }
  
  // Validate form
  const validateForm = () => {
    const newErrors = {}

    if (selectedActiveOffboarding) {
      newErrors.employee_id = 'This employee already has an active offboarding process.'
    }
    
    INITIATE_EXIT_FORM_FIELDS.forEach(field => {
      if (field.required) {
        const value = formData[field.field]
        if (!value || (typeof value === 'string' && !value.trim())) {
          newErrors[field.field] = `${field.label} is required`
        }
      }
      
      // Run custom validation if provided
      if (field.validation && formData[field.field]) {
        const error = field.validation(formData[field.field])
        if (error) {
          newErrors[field.field] = error
        }
      }
    })
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }
  
  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    setSubmitting(true)
    
    try {
      // Prepare payload
      const payload = {
        employee_name: formData.employee_name,
        employee_email: formData.employee_email,
        employee_id: formData.employee_id,
        user: formData.user,
        position: formData.position,
        department: formData.department,
        reporting_manager: formData.reporting_manager || '',
        branch: formData.branch || 'RAD',
        exit_reason: formData.exit_reason,
        exit_reason_detail: formData.exit_reason_detail || '',
        last_working_day: formData.last_working_day,
        notice_period_days: formData.notice_period_days || 30,
        target_completion_date: formData.target_completion_date || formData.last_working_day,
        notes: formData.notes || '',
        status: 'initiated',
        progress_percentage: 0,
        // ✨ NEW: Three-step approval workflow with project-based assignments
        project_assignments: projectAssignments.map(pa => ({
          project_number: pa.project_number,
          project_name: pa.project_name || '',
          project_manager_ids: pa.project_manager_ids || []
        })),
        hr_coordinator: formData.hr_coordinator || null,
        hr_approver: formData.hr_approver || null,
      }
      
      await apiClient.post(`${API_BASE}/offboarding/`, payload)
      
      if (onSuccess) onSuccess()
    } catch (err) {
      console.error('Failed to create offboarding record:', err)
      const errorMsg = err.response?.data?.detail || err.response?.data?.error || 'Failed to initiate offboarding process'
      setErrors({ submit: errorMsg })
    } finally {
      setSubmitting(false)
    }
  }
  
  // Filter employees based on search
  const filteredEmployees = employees.filter(emp => {
    if (!employeeSearch) return true
    const searchLower = employeeSearch.toLowerCase()
    const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase()
    const email = (emp.email || '').toLowerCase()
    return fullName.includes(searchLower) || email.includes(searchLower)
  })
  
  // Render form field based on type
  const renderField = (field) => {
    const value = formData[field.field] || ''
    const error = errors[field.field]
    
    const commonClasses = `w-full px-3 py-2 border ${error ? 'border-rose-500' : 'border-slate-300'} rounded-lg text-sm focus:outline-none focus:ring-2 ${error ? 'focus:ring-rose-500' : 'focus:ring-rose-500'}`
    
    // ✨ Dynamically populate options based on field type
    let fieldOptions = field.options || []
    if (field.id === 'assigned_to') {
      fieldOptions = hrManagers.map(hr => ({
        value: hr.user_id,
        label: `${hr.first_name} ${hr.last_name}`.trim() || hr.email
      }))
    } else if (field.id === 'project_managers') {
      fieldOptions = projectManagers.map(pm => ({
        value: pm.user_id,
        label: `${pm.first_name} ${pm.last_name}`.trim() || pm.email
      }))
    } else if (field.id === 'hr_coordinator') {
      fieldOptions = hrCoordinators.map(hr => ({
        value: hr.user_id,
        label: `${hr.first_name} ${hr.last_name}`.trim() || hr.email
      }))
    } else if (field.id === 'hr_approver') {
      fieldOptions = hrApprovers.map(hr => ({
        value: hr.user_id,
        label: `${hr.first_name} ${hr.last_name}`.trim() || hr.email
      }))
    }
    
    switch (field.type) {
      case 'select-search':
        return (
          <div>
            {!lockEmployee && <input
              type="text"
              placeholder={field.placeholder}
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
              className={commonClasses}
            />}
            {!lockEmployee && employeeSearch && filteredEmployees.length > 0 && (
              <div className="mt-1 max-h-48 overflow-y-auto border border-slate-200 rounded-lg bg-white shadow-lg">
                {filteredEmployees.map(emp => {
                  const activeOffboarding = getActiveOffboarding(emp)
                  const activeLabel = activeOffboarding?.status === 'initiated' ? 'Initiated' : 'In Progress'

                  return (
                    <button
                      key={emp.user_id}
                      type="button"
                      onClick={() => {
                        handleEmployeeSelect(emp.user_id.toString())
                        setEmployeeSearch('')
                      }}
                      className={`w-full px-3 py-2 text-left transition-colors border-b border-slate-100 last:border-b-0 ${activeOffboarding ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-blue-50'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium text-slate-800">
                          {emp.first_name} {emp.last_name}
                        </div>
                        {activeOffboarding && (
                          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-300">
                            Offboarding: {activeLabel}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">{emp.email}</div>
                      {emp.position && (
                        <div className="text-xs text-slate-400">{emp.position}</div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
            {selectedEmployee && (
              <div className={`mt-2 p-3 rounded-lg border ${selectedActiveOffboarding ? 'bg-amber-50 border-amber-300' : 'bg-blue-50 border-blue-200'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`text-sm font-semibold ${selectedActiveOffboarding ? 'text-amber-900' : 'text-blue-900'}`}>
                      {selectedEmployee.first_name} {selectedEmployee.last_name}
                    </div>
                    <div className={`text-xs ${selectedActiveOffboarding ? 'text-amber-700' : 'text-blue-700'}`}>{selectedEmployee.email}</div>
                    <div className={`mt-1 text-[11px] font-semibold ${selectedActiveOffboarding ? 'text-amber-800' : 'text-blue-800'}`}>
                      Employee ID: {selectedEmployee.employee_number || selectedEmployee.employment_id || 'Not set'}
                    </div>
                  </div>
                  {!lockEmployee && <button
                    type="button"
                    onClick={() => {
                      setSelectedEmployee(null)
                      setFormData(prev => {
                        const newData = { ...prev }
                        delete newData.employee_id
                        delete newData.employee_name
                        delete newData.employee_email
                        delete newData.user
                        return newData
                      })
                    }}
                    className={`p-1 rounded transition-colors ${selectedActiveOffboarding ? 'hover:bg-amber-100' : 'hover:bg-blue-100'}`}
                    title="Clear selection"
                  >
                    <HeroIcons.XMarkIcon className={`w-4 h-4 ${selectedActiveOffboarding ? 'text-amber-700' : 'text-blue-600'}`} />
                  </button>}
                </div>
                {selectedActiveOffboarding && (
                  <div className="mt-3 flex items-start gap-2 border-t border-amber-200 pt-3">
                    <HeroIcons.ExclamationTriangleIcon className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-amber-900">
                        Offboarding already {selectedActiveOffboarding.status === 'initiated' ? 'initiated' : 'in progress'}
                      </p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        Last working day: {new Date(selectedActiveOffboarding.last_working_day).toLocaleDateString()}. Complete or cancel the existing process before starting another.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      
      case 'project-assignments':
        // ✨ NEW: Dynamic project assignments with project numbers and managers
        return (
          <div className="space-y-3">
            {projectAssignments.map((assignment, index) => (
              <div key={index} className="p-4 border border-slate-300 rounded-lg bg-slate-50">
                <div className="flex items-start justify-between mb-3">
                  <h4 className="text-sm font-semibold text-slate-800">Project {index + 1}</h4>
                  <button
                    type="button"
                    onClick={() => {
                      setProjectAssignments(projectAssignments.filter((_, i) => i !== index))
                    }}
                    className="p-1 text-rose-600 hover:bg-rose-100 rounded transition-colors"
                    title="Remove project"
                  >
                    <HeroIcons.TrashIcon className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Project Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={assignment.project_number || ''}
                      onChange={(e) => {
                        const updated = [...projectAssignments]
                        updated[index].project_number = e.target.value
                        setProjectAssignments(updated)
                      }}
                      placeholder="e.g., PRJ-2024-001"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Project Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={assignment.project_name || ''}
                      onChange={(e) => {
                        const updated = [...projectAssignments]
                        updated[index].project_name = e.target.value
                        setProjectAssignments(updated)
                      }}
                      placeholder="e.g., UAE Oil Refinery Expansion"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-2">
                      Project Manager(s) <span className="text-rose-500">*</span>
                    </label>
                    
                    {/* ✨ Info banner when using fallback to all employees */}
                    {showAllEmployeesForPM && (
                      <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                        ℹ️ <strong>Note:</strong> Showing all active employees. No users assigned the &quot;Project Manager&quot; role yet.
                      </div>
                    )}
                    
                    {/* ✨ SOFT-CODED: Search/filter input for easier manager selection */}
                    {projectManagers.length > 5 && (
                      <div className="mb-2">
                        <input
                          type="text"
                          placeholder="🔍 Search by name, email, or department..."
                          value={pmSearchTerms[index] || ''}
                          onChange={(e) => {
                            setPmSearchTerms({ ...pmSearchTerms, [index]: e.target.value })
                          }}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}
                    
                    {/* Checkbox-based multi-select (more user-friendly than native multi-select) */}
                    <div className="border border-slate-300 rounded-lg p-3 max-h-[240px] overflow-y-auto bg-white">
                      {projectManagers.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-2">No employees available</p>
                      ) : (
                        <div className="space-y-2">
                          {projectManagers
                            .filter(pm => {
                              // ✨ SOFT-CODED: Filter by search term (case-insensitive)
                              const searchTerm = (pmSearchTerms[index] || '').toLowerCase().trim()
                              if (!searchTerm) return true
                              
                              const fullName = `${pm.first_name || ''} ${pm.last_name || ''}`.toLowerCase()
                              const email = (pm.email || '').toLowerCase()
                              const department = (pm.department || '').toLowerCase()
                              const position = (pm.position || '').toLowerCase()
                              
                              return fullName.includes(searchTerm) || 
                                     email.includes(searchTerm) || 
                                     department.includes(searchTerm) ||
                                     position.includes(searchTerm)
                            })
                            .map(pm => {
                            const isSelected = (assignment.project_manager_ids || []).includes(pm.user_id)
                            return (
                              <label
                                key={pm.user_id}
                                className={`flex items-start gap-3 p-2 rounded hover:bg-slate-50 cursor-pointer transition-colors ${
                                  isSelected ? 'bg-blue-50 border border-blue-200' : 'border border-transparent'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const updated = [...projectAssignments]
                                    const currentIds = updated[index].project_manager_ids || []
                                    
                                    if (e.target.checked) {
                                      // Add manager
                                      updated[index].project_manager_ids = [...currentIds, pm.user_id]
                                    } else {
                                      // Remove manager
                                      updated[index].project_manager_ids = currentIds.filter(id => id !== pm.user_id)
                                    }
                                    setProjectAssignments(updated)
                                  }}
                                  className="mt-0.5 h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-slate-900">
                                    {pm.first_name} {pm.last_name}
                                  </div>
                                  <div className="text-xs text-slate-500 truncate">
                                    {pm.email}
                                  </div>
                                  {pm.department && (
                                    <div className="text-xs text-slate-400">
                                      {pm.department}
                                    </div>
                                  )}
                                  {pm.position && (
                                    <div className="text-xs text-slate-400">
                                      {pm.position}
                                    </div>
                                  )}
                                </div>
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    
                    {/* Selected managers summary */}
                    {assignment.project_manager_ids && assignment.project_manager_ids.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-slate-600 mb-1">
                          Selected: {assignment.project_manager_ids.length} manager(s)
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {assignment.project_manager_ids.map(pmId => {
                            const pm = projectManagers.find(p => p.user_id === pmId)
                            if (!pm) return null
                            return (
                              <span key={pmId} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                                {pm.first_name} {pm.last_name}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...projectAssignments]
                                    updated[index].project_manager_ids = updated[index].project_manager_ids.filter(id => id !== pmId)
                                    setProjectAssignments(updated)
                                  }}
                                  className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                                  title="Remove manager"
                                >
                                  <HeroIcons.XMarkIcon className="w-3 h-3" />
                                </button>
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    
                    {(!assignment.project_manager_ids || assignment.project_manager_ids.length === 0) && (
                      <p className="mt-2 text-xs text-amber-600">
                        ⚠️ Please select at least one project manager
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            <button
              type="button"
              onClick={() => {
                setProjectAssignments([
                  ...projectAssignments,
                  { project_number: '', project_name: '', project_manager_ids: [] }
                ])
              }}
              className="w-full px-4 py-2 border-2 border-dashed border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-400 transition-colors flex items-center justify-center gap-2"
            >
              <HeroIcons.PlusIcon className="w-4 h-4" />
              Add Project Assignment
            </button>
            
            {field.helpText && (
              <p className="text-xs text-slate-600 mt-2">
                💡 {field.helpText}
              </p>
            )}
          </div>
        )
      
      case 'multi-select': {
        // ✨ Multi-select for project managers (DEPRECATED - use project-assignments instead)
        const selectedValues = []
        return (
          <div>
            <select
              multiple
              value={selectedValues}
              onChange={(e) => {
                const options = Array.from(e.target.selectedOptions)
                const values = options.map(opt => parseInt(opt.value))
                handleChange(field.field, values)
              }}
              className={`${commonClasses} min-h-[120px]`}
              required={field.required}
            >
              {fieldOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              {field.helpText || 'Hold Ctrl (Cmd on Mac) to select multiple options'}
            </p>
          </div>
        )
      
      }
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleChange(field.field, e.target.value)}
            className={commonClasses}
            required={field.required}
          >
            <option value="">{field.placeholder || `Select ${field.label}`}</option>
            {fieldOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )
      
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleChange(field.field, e.target.value)}
            placeholder={field.placeholder}
            rows={field.rows || 3}
            className={commonClasses}
            required={field.required}
          />
        )
      
      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleChange(field.field, e.target.value)}
            className={commonClasses}
            required={field.required}
            min={new Date().toISOString().split('T')[0]}
          />
        )
      
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleChange(field.field, e.target.value)}
            placeholder={field.placeholder}
            min={field.min}
            max={field.max}
            className={commonClasses}
            required={field.required}
          />
        )
      
      default: // text
        return (
          <input
            type="text"
            list={field.field === 'department' ? 'offboarding-exit-departments' : field.field === 'position' ? 'offboarding-exit-roles' : undefined}
            value={value}
            onChange={(e) => handleChange(field.field, e.target.value)}
            placeholder={field.placeholder}
            className={`${commonClasses} ${field.readOnly ? 'cursor-not-allowed bg-slate-100 text-slate-700' : ''}`}
            required={field.required}
            readOnly={field.readOnly}
          />
        )
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <OrganizationSuggestions id="offboarding-exit" />
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <HeroIcons.UserMinusIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Initiate Exit Process</h2>
              <p className="text-xs text-rose-100">Start offboarding for a departing employee</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Close"
          >
            <HeroIcons.XMarkIcon className="w-6 h-6 text-white" />
          </button>
        </div>
        
        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
              <span className="ml-2 text-slate-500">Loading...</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Submit Error */}
              {errors.submit && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 flex items-start gap-3">
                  <HeroIcons.ExclamationCircleIcon className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-rose-800">Error</p>
                    <p className="text-sm text-rose-700 mt-1">{errors.submit}</p>
                  </div>
                </div>
              )}
              
              {/* Form Sections */}
              {INITIATE_EXIT_FORM_SECTIONS.map(section => {
                const fields = INITIATE_EXIT_FORM_FIELDS.filter(f => f.section === section.id)
                if (fields.length === 0) return null
                
                const SectionIcon = section.icon
                
                return (
                  <div key={section.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
                        <SectionIcon className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">{section.label}</h3>
                        <p className="text-xs text-slate-500">{section.description}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {fields.map(field => (
                        <div
                          key={field.id}
                          className={field.type === 'textarea' || field.type === 'select-search' ? 'md:col-span-2' : ''}
                        >
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            {field.label}
                            {field.required && <span className="text-rose-500 ml-1">*</span>}
                            {field.tooltip && (
                              <span className="ml-1 text-xs text-slate-400" title={field.tooltip}>
                                <HeroIcons.InformationCircleIcon className="w-4 h-4 inline" />
                              </span>
                            )}
                          </label>
                          {renderField(field)}
                          {field.field === 'reporting_manager' && selectedEmployee && (
                            <p className="mt-1 text-[11px] font-medium text-slate-500">
                              {selectedEmployee.reporting_manager_source === 'project_manager'
                                ? `Project PoM${selectedEmployee.reporting_project_name ? ` · ${selectedEmployee.reporting_project_name}` : ''}`
                                : 'Line Manager (no active project PoM assigned)'}
                            </p>
                          )}
                          {errors[field.field] && (
                            <p className="mt-1 text-xs text-rose-600">{errors[field.field]}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </form>
          )}
        </div>
        
        {/* Modal Footer */}
        <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            <span className="text-rose-500">*</span> Required fields
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={submitting || loading || Boolean(selectedActiveOffboarding)}
              className="px-6 py-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-lg text-sm font-medium transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Spinner className="w-4 h-4" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <HeroIcons.CheckIcon className="w-4 h-4" />
                  <span>Initiate Offboarding</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Employee document management
function DocumentManagementSection({ employeeId, employeeEmail }) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [uploadData, setUploadData] = useState({
    document_type: 'offer_letter',
    document_number: '',
    issue_date: '',
    expiry_date: '',
    issuing_authority: '',
    notes: '',
    file: null,
  })
  const [alert, setAlert] = useState(null)

  // ✅ UNIFIED DOCUMENT SYSTEM: Fetch document types from ProfileDocument API (onboarding-filtered)
  // This ensures both Profile and Onboarding pages use the SAME database table (rbac.ProfileDocument)
  const [documentTypes, setDocumentTypes] = useState([])
  
  useEffect(() => {
    loadDocumentTypes()
    loadDocuments()
  }, [employeeId])
  
  const loadDocumentTypes = () => {
    apiClient
      .get('/rbac/profile-documents/document-types/onboarding/')
      .then((res) => {
        setDocumentTypes(res.data || [])
      })
      .catch((err) => console.error('Failed to load document types:', err))
  }

  const loadDocuments = () => {
    setLoading(true)
    // ✅ UNIFIED API: Fetch documents from ProfileDocument table
    // Scope the admin document queryset to the employee currently being viewed.
    apiClient
      .get(`/rbac/profile-documents/?user_id=${employeeId}&is_active=true`)
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : (res.data.results || [])
        setDocuments(data)
      })
      .catch((err) => console.error('Failed to load documents:', err))
      .finally(() => setLoading(false))
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setUploadData({ ...uploadData, file })
    }
  }

  const handleUpload = async () => {
    if (!uploadData.file) {
      setAlert({ type: 'error', message: 'Please select a file to upload' })
      setTimeout(() => setAlert(null), 3000)
      return
    }

    setUploading(true)

    try {
      // ✅ UNIFIED API: Upload to ProfileDocument table
      // Backend assigns the document to the selected employee for authorized admins.
      const formData = new FormData()
      formData.append('document_file', uploadData.file)
      formData.append('document_type', uploadData.document_type)
      formData.append('target_user_id', employeeId)
      
      if (uploadData.document_number) formData.append('document_number', uploadData.document_number)
      if (uploadData.issue_date) formData.append('issue_date', uploadData.issue_date)
      if (uploadData.expiry_date) formData.append('expiry_date', uploadData.expiry_date)
      if (uploadData.issuing_authority) formData.append('issuing_authority', uploadData.issuing_authority)
      if (uploadData.notes) formData.append('notes', uploadData.notes)

      // Upload to ProfileDocument API (same table as user profile documents)
      await apiClient.post('/rbac/profile-documents/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      setAlert({ type: 'success', message: 'Document uploaded successfully!' })
      setTimeout(() => setAlert(null), 3000)
      
      // Reset form and reload documents
      setUploadData({
        document_type: 'offer_letter',
        document_number: '',
        issue_date: '',
        expiry_date: '',
        issuing_authority: '',
        notes: '',
        file: null
      })
      setShowUploadForm(false)
      loadDocuments()
    } catch (err) {
      setAlert({ type: 'error', message: err.response?.data?.detail || err.response?.data?.error || 'Failed to upload document' })
      setTimeout(() => setAlert(null), 5000)
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async (document) => {
    try {
      // ✅ UNIFIED API: ProfileDocument stores files in S3, presigned URL in document_file_url
      if (document.document_file_url) {
        window.open(document.document_file_url, '_blank')
      } else {
        setAlert({ type: 'error', message: 'Document file not available' })
        setTimeout(() => setAlert(null), 3000)
      }
    } catch (err) {
      setAlert({ type: 'error', message: 'Failed to download document' })
      setTimeout(() => setAlert(null), 3000)
    }
  }

  const handleDelete = async (documentId) => {
    if (!(await radaiConfirm('Are you sure you want to delete this document?'))) return

    try {
      // ✅ UNIFIED API: Delete from ProfileDocument table
      await apiClient.delete(`/rbac/profile-documents/${documentId}/`)
      setAlert({ type: 'success', message: 'Document deleted successfully' })
      setTimeout(() => setAlert(null), 3000)
      loadDocuments()
    } catch (err) {
      setAlert({ type: 'error', message: 'Failed to delete document' })
      setTimeout(() => setAlert(null), 3000)
    }
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <HeroIcons.DocumentTextIcon className="w-5 h-5 text-violet-500" />
          Document Management
        </h4>
        <button
          onClick={() => setShowUploadForm(!showUploadForm)}
          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1"
        >
          {showUploadForm ? (
            <>
              <HeroIcons.XMarkIcon className="w-4 h-4" />
              Cancel
            </>
          ) : (
            <>
              <HeroIcons.PlusIcon className="w-4 h-4" />
              Upload Document
            </>
          )}
        </button>
      </div>

      {/* Alert */}
      {alert && (
        <div className={`rounded-lg border p-2 mb-3 flex items-center gap-2 text-xs ${
          alert.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
            : 'bg-rose-50 border-rose-200 text-rose-700'
        }`}>
          {alert.type === 'success' ? (
            <HeroIcons.CheckCircleIcon className="w-4 h-4" />
          ) : (
            <HeroIcons.ExclamationCircleIcon className="w-4 h-4" />
          )}
          <span className="font-medium">{alert.message}</span>
        </div>
      )}

      {/* Upload Form */}
      {showUploadForm && (
        <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Document Type</label>
              <select
                value={uploadData.document_type}
                onChange={(e) => setUploadData({ ...uploadData, document_type: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {documentTypes.map((type) => (
                  <option key={type.code} value={type.code}>
                    {type.icon} {type.label} {type.required_for_onboarding && '(Required)'}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                {documentTypes.find(t => t.code === uploadData.document_type)?.description}
              </p>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Document Number (Optional)</label>
              <input
                type="text"
                value={uploadData.document_number}
                onChange={(e) => setUploadData({ ...uploadData, document_number: e.target.value })}
                placeholder="e.g., Passport number, Contract number"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Issue Date (Optional)</label>
                <input
                  type="date"
                  value={uploadData.issue_date}
                  onChange={(e) => setUploadData({ ...uploadData, issue_date: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Expiry Date (Optional)</label>
                <input
                  type="date"
                  value={uploadData.expiry_date}
                  onChange={(e) => setUploadData({ ...uploadData, expiry_date: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Issuing Authority (Optional)</label>
              <input
                type="text"
                value={uploadData.issuing_authority}
                onChange={(e) => setUploadData({ ...uploadData, issuing_authority: e.target.value })}
                placeholder="e.g., UAE Government, Ministry of Labor"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Notes (Optional)</label>
              <textarea
                value={uploadData.notes}
                onChange={(e) => setUploadData({ ...uploadData, notes: e.target.value })}
                placeholder="Additional notes or comments"
                rows={2}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">File</label>
              <input
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Accepted formats: {documentTypes.find(t => t.code === uploadData.document_type)?.allowed_formats?.join(', ').toUpperCase()} (Max {documentTypes.find(t => t.code === uploadData.document_type)?.max_file_size_mb}MB)
              </p>
            </div>
            
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Spinner />
                  Uploading...
                </>
              ) : (
                <>
                  <HeroIcons.CloudArrowUpIcon className="w-5 h-5" />
                  Upload Document
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Documents List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner />
          <span className="ml-2 text-sm text-slate-500">Loading documents...</span>
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-8">
          <HeroIcons.DocumentIcon className="w-12 h-12 mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No documents uploaded yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => {
            const docType = documentTypes.find(t => t.code === doc.document_type) || { label: doc.document_type, icon: '📄', bg_color: 'bg-slate-100' }
            
            // Verification status badges
            const statusBadges = {
              pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700 border-amber-300' },
              verified: { label: 'Verified', className: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
              rejected: { label: 'Rejected', className: 'bg-rose-100 text-rose-700 border-rose-300' },
              expired: { label: 'Expired', className: 'bg-slate-100 text-slate-700 border-slate-300' },
            }
            const statusBadge = statusBadges[doc.verification_status] || statusBadges.pending
            
            return (
              <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-3 flex-1">
                  <div className={`w-10 h-10 rounded-lg ${docType.bg_color} flex items-center justify-center`}>
                    <span className="text-xl">{docType.icon}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      {docType.label}
                      {doc.document_number && (
                        <span className="text-xs text-slate-500 font-normal">({doc.document_number})</span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${statusBadge.className}`}>
                        {statusBadge.label}
                      </span>
                      {doc.document_file_name && (
                        <>
                          <span className="text-xs text-slate-400">•</span>
                          <span className="text-xs text-slate-500">{doc.document_file_name}</span>
                        </>
                      )}
                      {doc.expiry_date && (
                        <>
                          <span className="text-xs text-slate-400">•</span>
                          <span className={`text-xs ${doc.is_expired ? 'text-rose-600 font-medium' : doc.expires_soon ? 'text-amber-600 font-medium' : 'text-slate-500'}`}>
                            Expires: {new Date(doc.expiry_date).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {doc.document_file_url && (
                    <button
                      onClick={() => handleDownload(doc)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Download"
                    >
                      <HeroIcons.ArrowDownTrayIcon className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <HeroIcons.TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── KPI Card Component ─────────────────────────────────────────────────────
function KPICard({ label, value, icon: Icon, color = 'blue' }) {
  const colorMap = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    violet: 'bg-violet-50 border-violet-200 text-violet-700',
    rose: 'bg-rose-50 border-rose-200 text-rose-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
  }

  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="text-xs font-medium opacity-70">{label}</div>
        <Icon className="w-5 h-5 opacity-50" />
      </div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  )
}

// Enhanced KPI Card with more visual appeal and optional features
function EnhancedKPICard({ label, value, icon: Icon, bgColor, textColor, iconBg, subtitle, urgent = false }) {
  return (
    <div className={`rounded-xl border border-slate-200 p-4 ${bgColor} hover:shadow-lg transition-all duration-300 cursor-pointer group`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className={`text-xs font-semibold ${textColor} opacity-80 uppercase tracking-wide`}>{label}</div>
          {subtitle && (
            <div className="text-[10px] text-slate-500 mt-0.5">{subtitle}</div>
          )}
        </div>
        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center ${urgent ? 'animate-pulse' : ''} group-hover:scale-110 transition-transform duration-300`}>
          <Icon className={`w-5 h-5 ${textColor}`} />
        </div>
      </div>
      <div className={`text-3xl font-bold ${textColor} ${urgent ? 'text-4xl' : ''}`}>
        {value}
      </div>
      {urgent && value > 0 && (
        <div className="mt-2 text-[10px] font-medium text-rose-600 flex items-center gap-1">
          <HeroIcons.ExclamationTriangleIcon className="w-3 h-3" />
          Requires attention
        </div>
      )}
    </div>
  )
}
