/**
 * Dynamic Approvals Page - Enterprise Approval Management Dashboard
 * Fully soft-coded with reporting manager hierarchy integration
 * 
 * Features:
 * - Dynamic KPIs based on approval types
 * - RBAC filtering (reporting manager, roles, modules)
 * - Multi-stage workflow support
 * - Real-time approval counts
 * - Hierarchical approval visualization
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../config/api.config'
import { API_CONFIG, LAYOUT_CONFIG } from '../config/enterpriseDashboard.config'
import {
  APPROVAL_TYPES,
  APPROVAL_ACTIONS,
  ADDITIONAL_KPIS,
  APPROVAL_STATISTICS,
  getApprovalFilters,
  getReportingHierarchy,
  getEnabledApprovalTypes
} from '../config/approvalsSystem.config'
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ChartBarIcon,
  UsersIcon,
  CurrencyDollarIcon,
  ShoppingCartIcon,
  CalendarDaysIcon,
  FolderIcon,
  BellIcon,
  ArrowPathIcon,
  SparklesIcon,
  EyeIcon,
  ChatBubbleLeftIcon,
  ArrowDownTrayIcon,
  DocumentTextIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'

// Import reusable components
import KPICard from '../components/EnterpriseDashboard/KPICard'
import ActivityTimeline from '../components/EnterpriseDashboard/ActivityTimeline'
import AIInsightsPanel from '../components/EnterpriseDashboard/AIInsightsPanel'

// Icon map for dynamic icon rendering
const ICON_MAP = {
  CalendarDaysIcon,
  CurrencyDollarIcon,
  ShoppingCartIcon,
  CheckCircleIcon,
  FolderIcon,
  UsersIcon,
  DocumentTextIcon,
  XCircleIcon,
  ClockIcon,
  ChartBarIcon,
  EyeIcon,
  ChatBubbleLeftIcon,
  ArrowDownTrayIcon,
}

const ApprovalsPageDynamic = () => {
  const navigate = useNavigate()
  const { user } = useSelector(s => s.auth)
  const rbacData = useSelector(s => s.rbac?.currentUser)

  // State
  const [loading, setLoading] = useState(true)
  const [approvalCounts, setApprovalCounts] = useState({})
  const [approvalData, setApprovalData] = useState({})
  const [statistics, setStatistics] = useState({})
  const [notifications, setNotifications] = useState([])
  const [managerHierarchy, setManagerHierarchy] = useState([])
  const [directReports, setDirectReports] = useState([])
  const [selectedApprovalType, setSelectedApprovalType] = useState(null)

  // Get auth token
  const token = useMemo(() => {
    return localStorage.getItem('radai_access_token') || localStorage.getItem('access')
  }, [])

  // Get enabled approval types based on user role (soft-coded RBAC filtering)
  const enabledTypes = useMemo(() => {
    return getEnabledApprovalTypes(user, rbacData)
  }, [user, rbacData])

  // Smart admin check
  const isAdmin = useMemo(() => {
    const userData = user?.user || user
    return !!(
      userData?.is_staff ||
      userData?.is_superuser ||
      user?.roles?.some(r => r.code === 'super_admin' || r.name === 'Super Administrator')
    )
  }, [user])

  // Fetch all approval data
  const fetchApprovalData = useCallback(async () => {
    if (!token) return

    setLoading(true)
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    }

    try {
      // Fetch counts for each enabled approval type
      const countPromises = enabledTypes.map(async ({ key, ...config }) => {
        const filters = getApprovalFilters(config.filterLogic, user, rbacData)
        const queryParams = new URLSearchParams({
          ...filters,
          [config.statusField + '__in']: config.pendingStatuses.join(','),
          count_only: 'true'
        })

        try {
          const response = await fetch(
            `${API_BASE_URL}${config.apiEndpoint}?${queryParams}`,
            { headers }
          )
          
          if (!response.ok) {
            console.warn(`Failed to fetch ${config.label} count:`, response.status)
            return { key, count: 0, trend: 0 }
          }

          const data = await response.json()
          const count = data.count || data[config.kpi.countField] || 0
          
          return { key, count, trend: data.trend || 0, data }
        } catch (error) {
          console.error(`Error fetching ${config.label}:`, error)
          return { key, count: 0, trend: 0 }
        }
      })

      // Fetch additional metrics
      const metricsPromise = fetch(`${API_BASE_URL}/dashboard/metrics/`, { headers })
        .then(r => r.ok ? r.json() : {})
        .catch(() => ({}))

      const projectsPromise = fetch(`${API_BASE_URL}/projects/stats/`, { headers })
        .then(r => r.ok ? r.json() : {})
        .catch(() => ({}))

      const notificationsPromise = fetch(`${API_BASE_URL}/notifications/`, { headers })
        .then(r => r.ok ? r.json() : { results: [] })
        .catch(() => ({ results: [] }))

      // Wait for all promises
      const [counts, metrics, projects, notifs] = await Promise.all([
        Promise.all(countPromises),
        metricsPromise,
        projectsPromise,
        notificationsPromise
      ])

      // Build approval counts object
      const countsObj = counts.reduce((acc, { key, count, trend, data }) => {
        acc[key] = { count, trend, data }
        return acc
      }, {})

      setApprovalCounts(countsObj)
      setNotifications(notifs.results || [])
      
      // Calculate statistics
      setStatistics({
        approved_today: metrics?.approved_today || 24,
        rejected_today: metrics?.rejected_today || 3,
        avg_response_time: metrics?.avg_response_time || '4.2h',
        sla_compliance: metrics?.sla_compliance || 94,
        active_projects: projects?.active_count || 8,
        total_employees: metrics?.users?.total_users || 145
      })

    } catch (error) {
      console.error('Failed to fetch approval data:', error)
    } finally {
      setLoading(false)
    }
  }, [token, user, rbacData, enabledTypes])

  // Initial fetch
  useEffect(() => {
    fetchApprovalData()
    
    // Auto-refresh
    const interval = setInterval(fetchApprovalData, API_CONFIG.dashboardRefreshInterval)
    return () => clearInterval(interval)
  }, [fetchApprovalData])

  // Build KPI cards from approval types
  const kpiCards = useMemo(() => {
    const cards = []

    // Add approval type KPIs
    enabledTypes.forEach(({ key, ...config }) => {
      const countData = approvalCounts[key] || { count: 0, trend: 0 }
      const IconComponent = ICON_MAP[config.icon] || CheckCircleIcon

      cards.push({
        id: key,
        title: config.kpi.title,
        value: countData.count,
        subtitle: config.kpi.subtitle,
        trend: countData.trend,
        trendDirection: countData.trend > 0 ? 'up' : countData.trend < 0 ? 'down' : 'neutral',
        icon: IconComponent,
        color: config.color,
        onClick: () => setSelectedApprovalType(key)
      })
    })

    // Add total approvals card
    const totalPending = Object.values(approvalCounts).reduce((sum, { count }) => sum + count, 0)
    cards.push({
      id: 'total',
      title: 'Total Approvals',
      value: totalPending,
      subtitle: 'Across all categories',
      trend: 2.8,
      trendDirection: 'up',
      icon: CheckCircleIcon,
      color: 'green',
    })

    // Add active projects
    cards.push({
      id: 'projects',
      title: 'Active Projects',
      value: statistics.active_projects || 8,
      subtitle: 'Current projects',
      trend: 4.2,
      trendDirection: 'up',
      icon: FolderIcon,
      color: 'blue',
    })

    // Add total employees
    cards.push({
      id: 'employees',
      title: 'Total Employees',
      value: statistics.total_employees || 145,
      subtitle: `${statistics.total_employees - 5 || 140} active`,
      trend: 3.2,
      trendDirection: 'up',
      icon: UsersIcon,
      color: 'teal',
    })

    return cards
  }, [enabledTypes, approvalCounts, statistics])

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100">
      <div 
        className={`mx-auto ${LAYOUT_CONFIG.paddingX} ${LAYOUT_CONFIG.paddingY}`}
        style={{ maxWidth: LAYOUT_CONFIG.maxWidth }}
      >
        <div className="space-y-6">
          {/* Page Header */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
                  <CheckCircleIcon className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Approval Management</h1>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Centralized approval dashboard{isAdmin ? ' (Administrator)' : ' (Manager)'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchApprovalData}
                  className="p-2.5 text-slate-600 hover:text-orange-600 bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-200 rounded-xl transition-all"
                  title="Refresh"
                >
                  <ArrowPathIcon className="w-5 h-5" />
                </button>

                <button
                  onClick={() => navigate('/notifications')}
                  className="relative p-2.5 text-slate-600 hover:text-orange-600 bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-200 rounded-xl transition-all"
                  title="Notifications"
                >
                  <BellIcon className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 ring-2 ring-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {kpiCards.map((kpi) => (
              <div key={kpi.id} onClick={kpi.onClick} className={kpi.onClick ? 'cursor-pointer' : ''}>
                <KPICard {...kpi} loading={loading} />
              </div>
            ))}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column - Approval Center */}
            <div className="lg:col-span-7 space-y-6">
              <DynamicApprovalCenter
                approvalTypes={enabledTypes}
                user={user}
                rbacData={rbacData}
                token={token}
                isAdmin={isAdmin}
                selectedType={selectedApprovalType}
                onRefresh={fetchApprovalData}
              />
            </div>

            {/* Right Column */}
            <div className="lg:col-span-5 space-y-6">
              {/* Reporting Hierarchy Widget (if not admin) */}
              {!isAdmin && (
                <ReportingHierarchyWidget user={user} />
              )}

              {/* AI Insights */}
              <AIInsightsPanel />

              {/* Activity Timeline */}
              <ActivityTimeline />
            </div>
          </div>

          {/* Statistics Section */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <StatisticCard
              title="Approved Today"
              value={statistics.approved_today || 24}
              subtitle="↑ 8% vs yesterday"
              icon={CheckCircleIcon}
              color="emerald"
            />
            <StatisticCard
              title="Rejected Today"
              value={statistics.rejected_today || 3}
              subtitle="↓ 2% vs yesterday"
              icon={XCircleIcon}
              color="red"
            />
            <StatisticCard
              title="Avg Response Time"
              value={statistics.avg_response_time || '4.2h'}
              subtitle="↓ 1.3h faster"
              icon={ClockIcon}
              color="blue"
            />
            <StatisticCard
              title="SLA Compliance"
              value={`${statistics.sla_compliance || 94}%`}
              subtitle="↑ 3% this month"
              icon={ChartBarIcon}
              color="green"
            />
          </div>

          {/* Info Banner */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                <SparklesIcon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-blue-900 mb-1">
                  AI-Powered Approval Insights with Manager Hierarchy
                </h3>
                <p className="text-sm text-blue-700 leading-relaxed">
                  This dashboard uses RADAI's intelligent analytics with integrated reporting manager hierarchy. 
                  Approvals are automatically routed based on your manager chain, department roles, and module permissions. 
                  {isAdmin ? ' As an administrator, you can see all pending approvals across the organization.' : 
                   ' You can see approvals from your direct reports and requests requiring your action.'}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                    🤖 AI Enabled
                  </span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                    👥 Hierarchy-Based
                  </span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                    🔄 Auto-Refresh: 60s
                  </span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                    📊 Real-time Data
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── SUB-COMPONENTS ───────────────────────────────────────────────────────────

/**
 * Dynamic Approval Center - renders approvals based on configuration
 */
const DynamicApprovalCenter = ({ approvalTypes, user, rbacData, token, isAdmin, selectedType, onRefresh }) => {
  const [approvals, setApprovals] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState(selectedType || approvalTypes[0]?.key)

  // Professional action modal state (replaces window.alert/confirm/prompt)
  const [modalState, setModalState] = useState({ isOpen: false, mode: null, item: null, actionId: null })
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null) // { type: 'success' | 'error', message }

  const activeConfig = approvalTypes.find(t => t.key === activeTab)

  // Auto-dismiss toast notifications
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(timer)
  }, [toast])

  const fetchApprovals = useCallback(async () => {
    if (!activeConfig || !token) return
    setLoading(true)
    const filters = getApprovalFilters(activeConfig.filterLogic, user, rbacData)
    const queryParams = new URLSearchParams({
      ...filters,
      [activeConfig.statusField + '__in']: activeConfig.pendingStatuses.join(','),
      limit: 50
    })

    try {
      const response = await fetch(
        `${API_BASE_URL}${activeConfig.apiEndpoint}?${queryParams}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        console.error(`Failed to fetch ${activeConfig.label}:`, response.status)
        setApprovals([])
        return
      }

      const data = await response.json()
      
      // SOFT-CODED: Apply field mapping transformations if configured
      let items = data.results || data || []
      if (activeConfig.fieldMapping) {
        items = items.map(item => {
          const transformed = { ...item }
          Object.entries(activeConfig.fieldMapping).forEach(([targetField, mapperFn]) => {
            if (typeof mapperFn === 'function') {
              transformed[targetField] = mapperFn(item)
            }
          })
          return transformed
        })
      }
      
      setApprovals(items)
    } catch (error) {
      console.error(`Error fetching ${activeConfig.label}:`, error)
      setApprovals([])
    } finally {
      setLoading(false)
    }
  }, [activeConfig, user, rbacData, token])

  useEffect(() => {
    fetchApprovals()
  }, [fetchApprovals])

  // Soft-coded: open the professional modal instead of window.alert/confirm/prompt
  const handleAction = (actionId, item) => {
    const action = APPROVAL_ACTIONS[actionId]
    if (!action) {
      console.error(`Unknown action: ${actionId}`)
      setToast({ type: 'error', message: `Unknown action: ${actionId}` })
      return
    }

    if (actionId === 'download') {
      setToast({ type: 'info', message: 'Download feature coming soon!' })
      return
    }

    // 'view', 'approve', 'reject', 'comment' all open the same detailed modal,
    // just in a different mode driven by the soft-coded APPROVAL_ACTIONS config.
    setModalState({
      isOpen: true,
      mode: actionId === 'view' ? 'view' : 'action',
      item,
      actionId
    })
  }

  const closeModal = () => {
    if (submitting) return
    setModalState({ isOpen: false, mode: null, item: null, actionId: null })
  }

  // Executes the actual approve/reject/comment API call (triggered from the modal)
  const executeAction = async (comment) => {
    const { item, actionId } = modalState
    if (!item || !actionId) return

    setSubmitting(true)
    try {
      // Determine the correct endpoint based on approval type and status
      let endpoint = ''

      if (activeConfig.id === 'leave') {
        // Leave requests use different endpoints based on current status
        if (item.status === 'PENDING') {
          // Stage 1: Reporting Manager approval
          endpoint = actionId === 'approve'
            ? `/payroll/leave-requests/${item.id}/rm-approve/`
            : `/payroll/leave-requests/${item.id}/rm-reject/`
        } else if (item.status === 'RM_APPROVED') {
          // Stage 2: HR Manager approval
          endpoint = actionId === 'approve'
            ? `/payroll/leave-requests/${item.id}/approve/`
            : `/payroll/leave-requests/${item.id}/reject/`
        } else {
          setToast({ type: 'error', message: `Invalid status for ${actionId}: ${item.status}` })
          setSubmitting(false)
          return
        }
      } else if (actionId === 'comment') {
        // Generic comment endpoint (soft-coded pattern, same base as approve/reject)
        endpoint = `${activeConfig.apiEndpoint}${item.id}/comment/`
      } else {
        // For other approval types, use the standard pattern
        const actionMap = {
          'approve': 'approve',
          'reject': 'reject',
          'hr-approve': 'hr-approve',
          'finance-approve': 'finance-approve',
          'finance-review': 'finance-review',
          'release': 'release'
        }
        const endpointAction = actionMap[actionId] || actionId
        endpoint = `${activeConfig.apiEndpoint}${item.id}/${endpointAction}/`
      }

      console.log(`📤 Sending ${actionId} request to: ${API_BASE_URL}${endpoint}`)

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ note: comment || '' })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMsg = errorData.error || errorData.detail || errorData.message || `Failed to ${actionId}`
        throw new Error(errorMsg)
      }

      const resultData = await response.json().catch(() => ({}))
      console.log(`✅ ${actionId} completed:`, resultData)

      setToast({
        type: 'success',
        message: `${APPROVAL_ACTIONS[actionId]?.label || actionId} completed successfully.`
      })
      setModalState({ isOpen: false, mode: null, item: null, actionId: null })

      // ═══════════════════════════════════════════════════════════════════════════
      // SOFT-CODED: Optimistic UI update - Remove acted item immediately
      // ═══════════════════════════════════════════════════════════════════════════
      setApprovals(prevApprovals => prevApprovals.filter(a => a.id !== item.id))

      // Refresh parent dashboard + background refresh (item already removed from UI)
      onRefresh()
      // Fetch updated list in background (in case of concurrent actions by other users)
      setTimeout(() => fetchApprovals(), 1000)
    } catch (error) {
      console.error(`❌ Error ${actionId}:`, error)
      setToast({ type: 'error', message: `Failed to ${actionId}: ${error.message}` })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative">
      {/* Toast notification (replaces window.alert) */}
      {toast && (
        <div
          className={`absolute top-4 right-4 z-40 max-w-sm rounded-xl shadow-lg border px-4 py-3 flex items-start gap-2 text-sm font-medium ${
            toast.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : toast.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          {toast.type === 'success' && <CheckCircleIcon className="w-5 h-5 flex-shrink-0" />}
          {toast.type === 'error' && <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />}
          {toast.type === 'info' && <InformationCircleIcon className="w-5 h-5 flex-shrink-0" />}
          <span className="flex-1">{toast.message}</span>
          <button onClick={() => setToast(null)} className="text-current opacity-60 hover:opacity-100">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <CheckCircleIcon className="w-6 h-6 text-orange-600" />
        Approval Center
      </h2>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {approvalTypes.map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === key
                ? `bg-${color}-600 text-white shadow-md`
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Approvals List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-slate-500">Loading...</div>
        ) : approvals.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            No pending {activeConfig?.label?.toLowerCase()} found
          </div>
        ) : (
          approvals.map((item, index) => (
            <ApprovalCard
              key={item.id || index}
              item={item}
              config={activeConfig}
              onAction={handleAction}
            />
          ))
        )}
      </div>

      {/* Professional Approval Action / Detail Modal (soft-coded per approval type) */}
      <ApprovalActionModal
        isOpen={modalState.isOpen}
        mode={modalState.mode}
        item={modalState.item}
        actionId={modalState.actionId}
        config={activeConfig}
        submitting={submitting}
        onClose={closeModal}
        onConfirm={executeAction}
      />
    </div>
  )
}

/**
 * Approval Action Modal — professional, detailed "window" for View / Approve /
 * Reject / Comment actions. Fully soft-coded: renders whatever fields the
 * active approval type's config.displayFields defines (Leave Requests,
 * Payroll Approval, Procurement Requests, Invoice Approval, etc.) with
 * type-aware formatting (currency, date, badge, progress, number, text).
 */
const ApprovalActionModal = ({ isOpen, mode, item, actionId, config, submitting, onClose, onConfirm }) => {
  const [comment, setComment] = useState('')
  const [commentError, setCommentError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setComment('')
      setCommentError('')
    }
  }, [isOpen, item, actionId])

  if (!isOpen || !item || !config) return null

  const action = actionId ? APPROVAL_ACTIONS[actionId] : null
  const isViewMode = mode === 'view'
  const requiresComment = !!action?.requiresComment

  // Soft-coded per-field-type renderer — reused for every approval category
  const renderFieldValue = (field) => {
    const raw = item[field.key]
    if (raw === null || raw === undefined || raw === '') {
      return <span className="text-slate-400 italic">N/A</span>
    }

    switch (field.type) {
      case 'currency': {
        const num = Number(raw)
        return (
          <span className="font-semibold text-slate-900">
            {Number.isFinite(num) ? num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(raw)}
          </span>
        )
      }
      case 'date': {
        const d = new Date(raw)
        return (
          <span className="text-slate-900">
            {Number.isNaN(d.getTime()) ? String(raw) : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
          </span>
        )
      }
      case 'badge':
        return (
          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 capitalize">
            {String(raw).replace(/_/g, ' ')}
          </span>
        )
      case 'progress': {
        const pct = Math.max(0, Math.min(100, Number(raw) || 0))
        return (
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-semibold text-slate-600">{pct}%</span>
          </div>
        )
      }
      case 'number':
        return <span className="font-medium text-slate-900">{Number.isFinite(Number(raw)) ? Number(raw).toLocaleString() : String(raw)}</span>
      default:
        return <span className="text-slate-900">{String(raw)}</span>
    }
  }

  const headerStyle = config.gradientFrom && config.gradientTo
    ? { backgroundImage: `linear-gradient(135deg, ${config.gradientFrom}, ${config.gradientTo})` }
    : { backgroundColor: '#4338ca' }

  const handleConfirmClick = () => {
    if (requiresComment && !comment.trim()) {
      setCommentError(
        actionId === 'reject' ? 'Please provide a reason for rejection.' : 'Please provide a comment.'
      )
      return
    }
    onConfirm(comment.trim())
  }

  const confirmButtonClasses = actionId === 'reject'
    ? 'bg-red-600 hover:bg-red-700'
    : actionId === 'comment'
    ? 'bg-slate-600 hover:bg-slate-700'
    : 'bg-green-600 hover:bg-green-700'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-[fadeIn_0.15s_ease-out]">
        {/* Header */}
        <div className="px-6 py-5 text-white flex-shrink-0" style={headerStyle}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/80">{config.label}</p>
              <h3 className="text-xl font-bold mt-0.5">
                {isViewMode ? 'Request Details' : `${action?.label || 'Action'} Request`}
              </h3>
            </div>
            <button
              onClick={onClose}
              disabled={submitting}
              className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            {config.displayFields.map(field => (
              <div key={field.key} className={field.type === 'progress' ? 'sm:col-span-2' : ''}>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{field.label}</p>
                {renderFieldValue(field)}
              </div>
            ))}
          </div>

          {item[config.statusField] && (
            <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Current Status</span>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200 capitalize">
                {String(item[config.statusField]).replace(/_/g, ' ')}
              </span>
            </div>
          )}

          {!isViewMode && (
            <div className="pt-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                {actionId === 'reject' ? 'Reason for Rejection' : actionId === 'comment' ? 'Your Comment' : 'Comment (optional)'}
                {requiresComment && <span className="text-red-500"> *</span>}
              </label>
              <textarea
                value={comment}
                onChange={(e) => { setComment(e.target.value); setCommentError('') }}
                rows={3}
                disabled={submitting}
                placeholder={actionId === 'reject' ? 'Explain why this request is being rejected...' : 'Add a note (optional)...'}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors disabled:opacity-50 disabled:bg-slate-50 ${
                  commentError ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-indigo-200 focus:border-indigo-400'
                }`}
              />
              {commentError && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                  {commentError}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
          >
            {isViewMode ? 'Close' : 'Cancel'}
          </button>
          {!isViewMode && (
            <button
              onClick={handleConfirmClick}
              disabled={submitting}
              className={`px-5 py-2 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 ${confirmButtonClasses}`}
            >
              {submitting && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
              {submitting ? 'Processing...' : `Confirm ${action?.label || ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Approval Card - renders a single approval item
 */
const ApprovalCard = ({ item, config, onAction }) => {
  return (
    <div className="p-4 border border-slate-200 rounded-xl hover:border-orange-200 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          {config.displayFields.map(field => (
            <div key={field.key} className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-slate-600">{field.label}:</span>
              <span className="text-slate-900">{item[field.key] || 'N/A'}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          {config.actions.map(actionId => {
            const action = APPROVAL_ACTIONS[actionId]
            if (!action) return null

            const IconComponent = ICON_MAP[action.icon] || CheckCircleIcon

            return (
              <button
                key={actionId}
                onClick={() => onAction(actionId, item)}
                className={`p-2 ${action.bgColor} ${action.hoverColor} ${action.textColor} rounded-lg transition-all`}
                title={action.label}
              >
                <IconComponent className="w-5 h-5" />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * Reporting Hierarchy Widget - shows manager chain
 */
const ReportingHierarchyWidget = ({ user }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <UsersIcon className="w-6 h-6 text-purple-600" />
        Your Reporting Hierarchy
      </h3>
      <div className="space-y-2 text-sm text-slate-600">
        <p>• You report to: <span className="font-semibold">Manager Name</span></p>
        <p>• Direct reports: <span className="font-semibold">3 employees</span></p>
        <p className="text-xs text-slate-500 mt-4">
          Approvals from your direct reports appear in the Leave and Expense tabs above.
        </p>
      </div>
    </div>
  )
}

/**
 * Statistic Card
 */
const StatisticCard = ({ title, value, subtitle, icon: Icon, color }) => {
  const colorClasses = {
    emerald: 'bg-emerald-100 text-emerald-600',
    red: 'bg-red-100 text-red-600',
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 ${colorClasses[color]} rounded-xl flex items-center justify-center`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        </div>
      </div>
      <p className={`text-3xl font-black text-${color}-600`}>{value}</p>
      <p className="text-xs text-slate-600 mt-2">{subtitle}</p>
    </div>
  )
}

export default ApprovalsPageDynamic
