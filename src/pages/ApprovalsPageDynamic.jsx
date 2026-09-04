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
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../config/api.config'
import { API_CONFIG } from '../config/enterpriseDashboard.config'
import {
  APPROVAL_ACTIONS,
  getApprovalFilters,
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
  ArrowPathIcon,
  SparklesIcon,
  EyeIcon,
  ChatBubbleLeftIcon,
  ArrowDownTrayIcon,
  DocumentTextIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  BoltIcon,
  ShieldCheckIcon,
  ArrowTrendingUpIcon,
  CommandLineIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'

// Import reusable components
import ActivityTimeline from '../components/EnterpriseDashboard/ActivityTimeline'
import ProcurementApprovalPreviewModal from '../components/approvals/ProcurementApprovalPreviewModal'
import { fetchCurrentUser } from '../store/slices/rbacSlice'

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
  const dispatch = useDispatch()
  const { user } = useSelector(s => s.auth)
  const rbacData = useSelector(s => s.rbac?.currentUser)
  const dashboardRequestRef = useRef(false)

  // State
  const [approvalCounts, setApprovalCounts] = useState({})
  const [statistics, setStatistics] = useState({})
  const [approvalSearch, setApprovalSearch] = useState('')
  const [approvalFilter, setApprovalFilter] = useState('all')

  // Get auth token
  const token = useMemo(() => {
    return localStorage.getItem('radai_access_token') || localStorage.getItem('access')
  }, [])

  useEffect(() => {
    if (token && !rbacData) {
      dispatch(fetchCurrentUser())
    }
  }, [dispatch, rbacData, token])

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
    if (!token || dashboardRequestRef.current || document.visibilityState === 'hidden') return
    dashboardRequestRef.current = true

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

      // Wait for all promises
      const [counts, metrics, projects] = await Promise.all([
        Promise.all(countPromises),
        metricsPromise,
        projectsPromise
      ])

      // Build approval counts object
      const countsObj = counts.reduce((acc, { key, count, trend, data }) => {
        acc[key] = { count, trend, data }
        return acc
      }, {})

      setApprovalCounts(countsObj)
      // Calculate statistics
      setStatistics({
        approved_today: metrics?.approved_today ?? 0,
        rejected_today: metrics?.rejected_today ?? 0,
        avg_response_time: metrics?.avg_response_time || '—',
        sla_compliance: metrics?.sla_compliance ?? null,
        active_projects: projects?.active_count ?? 0,
        total_employees: metrics?.users?.total_users ?? 0
      })

    } catch (error) {
      console.error('Failed to fetch approval data:', error)
    } finally {
      dashboardRequestRef.current = false
    }
  }, [token, user, rbacData, enabledTypes])

  // Initial fetch
  useEffect(() => {
    fetchApprovalData()
    
    // Auto-refresh
    const interval = setInterval(fetchApprovalData, API_CONFIG.dashboardRefreshInterval)
    return () => clearInterval(interval)
  }, [fetchApprovalData])

  const approvalQueues = useMemo(() => enabledTypes.map(({ key, ...config }) => {
    const countData = approvalCounts[key] || { count: 0, trend: 0, data: {} }
    const count = Number(countData.count || 0)
    const overdue = Number(
      countData.data?.overdue_count
      || countData.data?.sla_breached_count
      || countData.data?.urgent_count
      || 0
    )
    return {
      key,
      label: config.label,
      count,
      overdue,
      trend: Number(countData.trend || 0),
      Icon: ICON_MAP[config.icon] || CheckCircleIcon,
      urgency: overdue > 0 || count >= 10 ? 'critical' : count >= 5 ? 'attention' : 'normal',
    }
  }).sort((a, b) => b.overdue - a.overdue || b.count - a.count), [enabledTypes, approvalCounts])

  const totalPending = approvalQueues.reduce((sum, queue) => sum + queue.count, 0)
  const overdueTotal = approvalQueues.reduce((sum, queue) => sum + queue.overdue, 0)
  const priorityQueue = approvalQueues[0]
  const approvalTypesWithCounts = useMemo(() => enabledTypes.map(({ key, ...config }) => ({
    key,
    ...config,
    queueCount: Number(approvalCounts[key]?.count || 0),
  })), [enabledTypes, approvalCounts])
  return (
    <div className="h-full min-h-0 w-full overflow-hidden bg-[#f5f6f8]">
      <div 
        className="flex h-full min-h-0 w-full max-w-none flex-col overflow-hidden px-3 py-2 sm:px-4 lg:px-5 xl:px-6"
      >
        <div className="flex h-full min-h-0 flex-col gap-3">
          {/* Page Header */}
          <div className="shrink-0 rounded-lg border border-slate-200 bg-white px-4 py-3 sm:px-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="flex shrink-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#0f6cbd] text-white shadow-sm">
                  <CommandLineIcon className="h-6 w-6" />
                </div>
                <div className="flex items-center gap-2 whitespace-nowrap text-xs text-slate-500"><span>Management</span><span>/</span><span className="font-semibold text-[#0f6cbd]">Approvals</span></div>
              </div>

              <div className="relative w-full min-w-[220px] xl:max-w-xl">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={approvalSearch}
                  onChange={(event) => setApprovalSearch(event.target.value)}
                  placeholder="Search all approvals by number, title, requester, type or amount..."
                  aria-label="Search all approvals"
                  className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#0f6cbd] focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <nav className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Filter unified approvals">
                <div className="flex min-w-max items-center justify-end gap-1">
                  <button type="button" onClick={() => setApprovalFilter('all')} className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold transition ${approvalFilter === 'all' ? 'border-[#0f6cbd] bg-blue-50 text-[#0f6cbd]' : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950'}`}>
                    All approvals
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${approvalFilter === 'all' ? 'bg-[#0f6cbd] text-white' : 'bg-slate-200 text-slate-600'}`}>{totalPending}</span>
                  </button>
                  {approvalTypesWithCounts.map(({ key, id, label, queueCount }) => {
                    const filterId = id || key
                    const isActive = approvalFilter === filterId
                    return (
                      <button key={key} type="button" onClick={() => setApprovalFilter(filterId)} className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold transition ${isActive ? 'border-[#0f6cbd] bg-blue-50 text-[#0f6cbd]' : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950'}`}>
                        {label}
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${isActive ? 'bg-[#0f6cbd] text-white' : 'bg-slate-200 text-slate-600'}`}>{queueCount || 0}</span>
                      </button>
                    )
                  })}
                </div>
              </nav>
              </div>
            </div>

          {/* Grouped management KPIs */}
          <div className="grid shrink-0 grid-cols-1 gap-3 xl:grid-cols-3">
            <KPIGroup
              eyebrow="Decision queue"
              title="Workload requiring action"
              tone={overdueTotal > 0 ? 'critical' : totalPending >= 10 ? 'attention' : 'normal'}
              metrics={[
                { label: 'Total pending', value: totalPending, helper: `${approvalQueues.length} active queues` },
                { label: 'SLA risks', value: overdueTotal, helper: overdueTotal ? 'Act immediately' : 'No reported breaches' },
                { label: 'Largest queue', value: priorityQueue?.count || 0, helper: priorityQueue?.label || 'No queue' },
              ]}
            />
            <KPIGroup
              eyebrow="Today’s flow"
              title="Decision throughput"
              tone="success"
              metrics={[
                { label: 'Approved', value: statistics.approved_today ?? 0, helper: 'Completed today' },
                { label: 'Rejected', value: statistics.rejected_today ?? 0, helper: 'Returned today' },
                { label: 'Avg response', value: statistics.avg_response_time || '—', helper: 'Current cycle time' },
              ]}
            />
            <KPIGroup
              eyebrow="Operational health"
              title="Control and capacity"
              tone={statistics.sla_compliance !== null && statistics.sla_compliance !== undefined && statistics.sla_compliance < 90 ? 'critical' : 'info'}
              metrics={[
                { label: 'SLA compliance', value: statistics.sla_compliance === null || statistics.sla_compliance === undefined ? '—' : `${statistics.sla_compliance}%`, helper: statistics.sla_compliance === null || statistics.sla_compliance === undefined ? 'Metric unavailable' : 'Approval target' },
                { label: 'Active projects', value: statistics.active_projects ?? 0, helper: 'In delivery' },
                { label: 'Employees', value: statistics.total_employees ?? 0, helper: 'Organization coverage' },
              ]}
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid min-h-0 flex-1 grid-cols-1 items-stretch gap-4 overflow-y-auto [scrollbar-width:none] xl:overflow-hidden xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_390px] [&::-webkit-scrollbar]:hidden">
            {/* Left Column - Approval Center */}
            <div className="h-full min-h-0 min-w-0">
              <DynamicApprovalCenter
                approvalTypes={approvalTypesWithCounts}
                user={user}
                rbacData={rbacData}
                token={token}
                searchQuery={approvalSearch}
                filterType={approvalFilter}
                onRefresh={fetchApprovalData}
              />
            </div>

            {/* Right Column */}
            <div className="h-full min-h-0 min-w-0 space-y-4 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <ApprovalIntelligencePanel
                queues={approvalQueues}
                statistics={statistics}
                onSelectQueue={(queueKey) => {
                  const queue = approvalTypesWithCounts.find(({ key }) => key === queueKey)
                  setApprovalFilter(queue?.id || queue?.key || 'all')
                }}
              />
              {/* Reporting Hierarchy Widget (if not admin) */}
              {!isAdmin && (
                <ReportingHierarchyWidget />
              )}

              {/* Activity Timeline */}
              <ActivityTimeline />
            </div>
          </div>

          {/* Statistics Section */}
          <div className="hidden">
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
          <div className="hidden">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                <SparklesIcon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-blue-900 mb-1">
                  AI-Powered Approval Insights with Manager Hierarchy
                </h3>
                <p className="text-sm text-blue-700 leading-relaxed">
                  This dashboard uses RADAI&apos;s intelligent analytics with integrated reporting manager hierarchy.
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
const KPIGroup = ({ eyebrow, title, tone = 'normal', metrics }) => {
  const tones = {
    critical: { bar: 'bg-rose-500', icon: 'bg-rose-50 text-rose-600', ring: 'border-rose-200/80', Icon: ExclamationTriangleIcon },
    attention: { bar: 'bg-amber-500', icon: 'bg-amber-50 text-amber-600', ring: 'border-amber-200/80', Icon: BoltIcon },
    success: { bar: 'bg-emerald-500', icon: 'bg-emerald-50 text-emerald-600', ring: 'border-emerald-200/80', Icon: ArrowTrendingUpIcon },
    info: { bar: 'bg-blue-500', icon: 'bg-blue-50 text-blue-600', ring: 'border-blue-200/80', Icon: ShieldCheckIcon },
    normal: { bar: 'bg-indigo-500', icon: 'bg-indigo-50 text-indigo-600', ring: 'border-indigo-200/80', Icon: ChartBarIcon },
  }
  const style = tones[tone] || tones.normal
  const GroupIcon = style.Icon

  return (
    <section className={`relative overflow-hidden rounded-lg border bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${style.ring}`}>
      <div className={`absolute inset-y-0 left-0 w-1 ${style.bar}`} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex min-w-[145px] items-center gap-2 pl-1">
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${style.icon}`}>
            <GroupIcon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">{eyebrow}</p>
            <h2 className="truncate text-xs font-semibold text-slate-900">{title}</h2>
          </div>
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-3 divide-x divide-slate-100">
          {metrics.map((metric) => (
            <div key={metric.label} className="min-w-0 px-2 first:pl-0 last:pr-0">
              <div className="flex items-baseline gap-1.5">
                <p className="text-base font-semibold tracking-tight text-slate-950 tabular-nums">{metric.value}</p>
                <p className="truncate text-[10px] font-semibold text-slate-600">{metric.label}</p>
              </div>
              <p className="truncate text-[9px] text-slate-400" title={metric.helper}>{metric.helper}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const ApprovalIntelligencePanel = ({ queues, statistics, onSelectQueue }) => {
  const priorityQueue = queues[0]
  const hasSla = statistics.sla_compliance !== null && statistics.sla_compliance !== undefined
  const sla = Number(statistics.sla_compliance || 0)
  const recommendations = [
    priorityQueue?.count > 0 && {
      title: `Focus on ${priorityQueue.label}`,
      detail: `${priorityQueue.count} decision${priorityQueue.count === 1 ? '' : 's'} waiting in the largest queue.`,
      tone: priorityQueue.urgency,
      queue: priorityQueue.key,
    },
    hasSla && sla < 90 && {
      title: 'SLA recovery required',
      detail: `Compliance is ${sla}%. Clear aged items before accepting lower-priority work.`,
      tone: 'critical',
    },
    Number(statistics.rejected_today || 0) > Number(statistics.approved_today || 0) && {
      title: 'Rejection rate needs review',
      detail: 'Returned decisions exceed approvals today. Check request quality and rejection reasons.',
      tone: 'attention',
    },
  ].filter(Boolean)

  if (!recommendations.length) {
    recommendations.push({
      title: 'Queues are under control',
      detail: 'No immediate decision risk is visible. Continue with the highest-volume queue.',
      tone: 'normal',
      queue: priorityQueue?.key,
    })
  }

  const toneStyles = {
    critical: 'border-rose-200 bg-rose-50 text-rose-900',
    attention: 'border-amber-200 bg-amber-50 text-amber-900',
    normal: 'border-blue-200 bg-blue-50 text-blue-900',
  }

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-950 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="border-b border-slate-200 bg-gradient-to-r from-[#f3f8fd] via-white to-violet-50 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#0f6cbd] to-violet-600 text-white shadow-sm">
            <SparklesIcon className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Decision Intelligence</h2>
            <p className="text-xs text-slate-500">Copilot-prioritized queue signals</p>
          </div>
        </div>
      </div>
      <div className="space-y-2 p-3">
        {recommendations.map((insight, index) => (
          <button
            key={insight.title}
            type="button"
            onClick={() => insight.queue && onSelectQueue(insight.queue)}
            disabled={!insight.queue}
            className={`w-full rounded-lg border p-3 text-left transition ${toneStyles[insight.tone] || toneStyles.normal} ${insight.queue ? 'hover:border-[#0f6cbd] hover:shadow-sm' : 'cursor-default'}`}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-white/70 text-xs font-black">{index + 1}</span>
              <div>
                <p className="text-sm font-extrabold">{insight.title}</p>
                <p className="mt-1 text-xs leading-5 opacity-80">{insight.detail}</p>
                {insight.queue && <p className="mt-2 text-[10px] font-black uppercase tracking-wider">Open queue →</p>}
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        <span>Live analysis</span><span>Refreshes with dashboard</span>
      </div>
    </section>
  )
}

const DynamicApprovalCenter = ({ approvalTypes, user, rbacData, token, searchQuery, filterType, onRefresh }) => {
  const navigate = useNavigate()
  const [approvals, setApprovals] = useState([])
  const [loading, setLoading] = useState(false)

  // Professional action modal state (replaces window.alert/confirm/prompt)
  const [modalState, setModalState] = useState({ isOpen: false, mode: null, item: null, actionId: null, config: null })
  const [procurementPreview, setProcurementPreview] = useState({ isOpen: false, type: null, recordId: null })
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null) // { type: 'success' | 'error', message }

  const filteredApprovals = useMemo(() => {
    const normalizedQuery = String(searchQuery || '').trim().toLowerCase()
    const queueItems = filterType && filterType !== 'all'
      ? approvals.filter((item) => item._approvalType === filterType)
      : approvals
    if (!normalizedQuery) return queueItems

    return queueItems.filter((item) => {
      try {
        return JSON.stringify(item).toLowerCase().includes(normalizedQuery)
      } catch {
        return Object.values(item || {}).some((value) => String(value ?? '').toLowerCase().includes(normalizedQuery))
      }
    })
  }, [approvals, filterType, searchQuery])

  // Auto-dismiss toast notifications
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(timer)
  }, [toast])

  const fetchApprovals = useCallback(async () => {
    if (!approvalTypes.length || !token) return
    setLoading(true)
    try {
      const queueResults = await Promise.all(approvalTypes.map(async (config) => {
        const filters = getApprovalFilters(config.filterLogic, user, rbacData)
        const queryParams = new URLSearchParams({
          ...filters,
          [config.statusField + '__in']: config.pendingStatuses.join(','),
          limit: 200,
          page_size: 200,
        })

        try {
          const response = await fetch(`${API_BASE_URL}${config.apiEndpoint}?${queryParams}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })
          if (!response.ok) {
            console.error(`Failed to fetch ${config.label}:`, response.status)
            return []
          }

          const data = await response.json()
          const sourceItems = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : []
          return sourceItems.map((item) => {
            const transformed = { ...item }
            if (config.fieldMapping) {
              Object.entries(config.fieldMapping).forEach(([targetField, mapperFn]) => {
                if (typeof mapperFn === 'function') transformed[targetField] = mapperFn(item)
              })
            }
            return {
              ...transformed,
              _approvalType: config.id,
              _approvalLabel: config.label,
              _approvalConfig: config,
            }
          })
        } catch (error) {
          console.error(`Error fetching ${config.label}:`, error)
          return []
        }
      }))

      const mergedApprovals = queueResults.flat().sort((left, right) => {
        const leftStatus = approvalRowStatus(left)
        const rightStatus = approvalRowStatus(right)
        const urgencyRank = { Urgent: 3, Attention: 2, 'On track': 1 }
        const urgencyDifference = (urgencyRank[rightStatus.label] || 0) - (urgencyRank[leftStatus.label] || 0)
        if (urgencyDifference) return urgencyDifference
        const leftDate = new Date(left.submitted_at || left.created_at || left.requested_at || left.date_submitted || 0).getTime()
        const rightDate = new Date(right.submitted_at || right.created_at || right.requested_at || right.date_submitted || 0).getTime()
        return rightDate - leftDate
      })
      setApprovals(mergedApprovals)
    } catch (error) {
      console.error('Error fetching unified approval inbox:', error)
      setApprovals([])
    } finally {
      setLoading(false)
    }
  }, [approvalTypes, user, rbacData, token])

  useEffect(() => {
    fetchApprovals()
  }, [fetchApprovals])

  // Soft-coded: open the professional modal instead of window.alert/confirm/prompt
  const handleAction = (actionId, item) => {
    const itemConfig = item?._approvalConfig
    const action = APPROVAL_ACTIONS[actionId]
    if (!action) {
      console.error(`Unknown action: ${actionId}`)
      setToast({ type: 'error', message: `Unknown action: ${actionId}` })
      return
    }

    if (actionId === 'view' && ['procurement', 'purchase_order'].includes(itemConfig?.id)) {
      setProcurementPreview({
        isOpen: true,
        type: itemConfig.id === 'purchase_order' ? 'po' : 'pr',
        recordId: item.id,
      })
      return
    }

    if (actionId === 'view' && typeof itemConfig?.detailPath === 'function') {
      navigate(itemConfig.detailPath(item))
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
      actionId,
      config: itemConfig,
    })
  }

  const closeModal = () => {
    if (submitting) return
    setModalState({ isOpen: false, mode: null, item: null, actionId: null, config: null })
  }

  // Executes the actual approve/reject/comment API call (triggered from the modal)
  const executeAction = async (comment) => {
    const { item, actionId, config } = modalState
    if (!item || !actionId || !config) return

    setSubmitting(true)
    try {
      // Determine the correct endpoint based on approval type and status
      let endpoint = ''

      if (config.id === 'leave') {
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
        endpoint = `${config.actionApiEndpoint || config.apiEndpoint}${item.id}/comment/`
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
        const endpointAction = config.actionEndpointMap?.[actionId] || actionMap[actionId] || actionId
        endpoint = `${config.actionApiEndpoint || config.apiEndpoint}${item.id}/${endpointAction}/`
      }

      console.log(`📤 Sending ${actionId} request to: ${API_BASE_URL}${endpoint}`)

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(
          config.id === 'purchase_order'
            ? { note: comment || '', reason: comment || '', approval_stage: item.approval_stage }
            : (config.id === 'procurement' || config.id === 'profile_document') && actionId === 'reject'
              ? { reason: comment || '' }
              : { note: comment || '', signature: '' }
        )
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
      setModalState({ isOpen: false, mode: null, item: null, actionId: null, config: null })

      // ═══════════════════════════════════════════════════════════════════════════
      // SOFT-CODED: Optimistic UI update - Remove acted item immediately
      // ═══════════════════════════════════════════════════════════════════════════
      setApprovals(prevApprovals => prevApprovals.filter(a => !(
        String(a.id) === String(item.id) && a._approvalType === item._approvalType
      )))

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
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
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

      {/* Approvals List */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {loading ? (
          <div className="space-y-3 py-2">
            {[1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-slate-100" />)}
          </div>
        ) : approvals.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 py-20 text-center text-slate-700">
            <CheckCircleIcon className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
            <p className="font-bold">All queues cleared</p>
            <p className="mt-1 text-xs">No pending approvals were found.</p>
          </div>
        ) : filteredApprovals.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 py-20 text-center text-slate-700">
            <MagnifyingGlassIcon className="mx-auto mb-3 h-10 w-10 text-slate-400" />
            <p className="font-bold">No matching requests</p>
            <p className="mt-1 text-xs">Try another approval filter, name, request number, status, or amount.</p>
          </div>
        ) : (
          <ApprovalTable key={`${filterType || 'all'}:${searchQuery || ''}`} items={filteredApprovals} onAction={handleAction} />
        )}
      </div>

      {/* Professional Approval Action / Detail Modal (soft-coded per approval type) */}
      <ApprovalActionModal
        isOpen={modalState.isOpen}
        mode={modalState.mode}
        item={modalState.item}
        actionId={modalState.actionId}
        config={modalState.config}
        token={token}
        submitting={submitting}
        onClose={closeModal}
        onConfirm={executeAction}
        onSelectAction={handleAction}
      />

      <ProcurementApprovalPreviewModal
        isOpen={procurementPreview.isOpen}
        type={procurementPreview.type}
        recordId={procurementPreview.recordId}
        onClose={() => setProcurementPreview({ isOpen: false, type: null, recordId: null })}
        onDecision={() => {
          setApprovals((current) => current.filter((item) => !(
            String(item.id) === String(procurementPreview.recordId)
            && item._approvalType === (procurementPreview.type === 'po' ? 'purchase_order' : 'procurement')
          )))
          onRefresh()
          setTimeout(() => fetchApprovals(), 500)
        }}
      />
    </section>
  )
}

/**
 * Approval Action Modal — professional, detailed "window" for View / Approve /
 * Reject / Comment actions. Fully soft-coded: renders whatever fields the
 * active approval type's config.displayFields defines (Leave Requests,
 * Payroll Approval, Procurement Requests, Invoice Approval, etc.) with
 * type-aware formatting (currency, date, badge, progress, number, text).
 */
const ApprovalActionModal = ({ isOpen, mode, item, actionId, config, token, submitting, onClose, onConfirm, onSelectAction }) => {
  const [comment, setComment] = useState('')
  const [commentError, setCommentError] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewMimeType, setPreviewMimeType] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setComment('')
      setCommentError('')
    }
  }, [isOpen, item, actionId])

  useEffect(() => {
    if (!isOpen || !item || !config?.previewEndpoint || !token) {
      setPreviewUrl('')
      setPreviewMimeType('')
      setPreviewError('')
      return undefined
    }

    const controller = new AbortController()
    let objectUrl = ''
    setPreviewLoading(true)
    setPreviewError('')

    const loadPreview = async () => {
      try {
        const endpoint = typeof config.previewEndpoint === 'function'
          ? config.previewEndpoint(item)
          : config.previewEndpoint
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        })
        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          throw new Error(error.detail || 'Document preview could not be loaded.')
        }
        const blob = await response.blob()
        objectUrl = URL.createObjectURL(blob)
        setPreviewMimeType(blob.type)
        setPreviewUrl(objectUrl)
      } catch (error) {
        if (error.name !== 'AbortError') setPreviewError(error.message)
      } finally {
        if (!controller.signal.aborted) setPreviewLoading(false)
      }
    }

    loadPreview()
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [isOpen, item, config, token])

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

      <div className={`relative bg-white w-full ${config.previewEndpoint ? 'max-w-5xl' : 'max-w-lg'} rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-[fadeIn_0.15s_ease-out]`}>
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
          {config.previewEndpoint && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">Document Preview</p>
                  <p className="text-xs text-slate-500">Review the uploaded file before taking action.</p>
                </div>
                {previewUrl && (
                  <a
                    href={previewUrl}
                    download={item.document_file_name || 'profile-document'}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <ArrowDownTrayIcon className="h-4 w-4" /> Download
                  </a>
                )}
              </div>
              <div className="flex h-[420px] items-center justify-center p-3">
                {previewLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <ArrowPathIcon className="h-5 w-5 animate-spin" /> Loading secure preview…
                  </div>
                ) : previewError ? (
                  <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
                    {previewError}
                  </div>
                ) : previewUrl && previewMimeType.startsWith('image/') ? (
                  <img
                    src={previewUrl}
                    alt={item.document_name || item.document_type_label || 'Profile document'}
                    className="max-h-full max-w-full rounded-lg bg-white object-contain shadow-sm"
                  />
                ) : previewUrl ? (
                  <iframe
                    src={previewUrl}
                    title={item.document_file_name || 'Profile document preview'}
                    className="h-full w-full rounded-lg border-0 bg-white"
                  />
                ) : null}
              </div>
            </div>
          )}

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
          {isViewMode && config.actions?.includes('reject') && (
            <button
              onClick={() => onSelectAction('reject', item)}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              <XCircleIcon className="h-4 w-4" />
              Reject
            </button>
          )}
          {isViewMode && config.actions?.includes('approve') && (
            <button
              onClick={() => onSelectAction('approve', item)}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircleIcon className="h-4 w-4" />
              Approve
            </button>
          )}
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

const tableCellValue = (item, field) => {
  const raw = item[field.key]
  if (raw === null || raw === undefined || raw === '') return <span className="text-slate-400">—</span>
  if (field.type === 'currency') {
    const amount = Number(raw)
    return Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(raw)
  }
  if (field.type === 'date') {
    const date = new Date(raw)
    return Number.isNaN(date.getTime()) ? String(raw) : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
  }
  if (field.type === 'badge') {
    return <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-slate-700">{String(raw).replace(/_/g, ' ')}</span>
  }
  if (field.type === 'progress') {
    const percent = Math.max(0, Math.min(100, Number(raw) || 0))
    return <div className="flex min-w-[90px] items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-[#0f6cbd]" style={{ width: `${percent}%` }} /></div><span className="text-[10px] font-semibold tabular-nums">{percent}%</span></div>
  }
  return String(raw)
}

const approvalRowStatus = (item) => {
  const submittedAt = item.submitted_at || item.created_at || item.requested_at || item.date_submitted
  const submittedTime = submittedAt ? new Date(submittedAt).getTime() : NaN
  const ageHours = Number.isFinite(submittedTime) ? Math.max(0, (Date.now() - submittedTime) / 3600000) : 0
  const priority = String(item.priority || '').toLowerCase()
  if (['urgent', 'critical', 'high'].includes(priority) || ageHours >= 48) return { label: 'Urgent', dot: 'bg-rose-500', text: 'text-rose-700', ageHours }
  if (ageHours >= 24) return { label: 'Attention', dot: 'bg-amber-500', text: 'text-amber-700', ageHours }
  return { label: 'On track', dot: 'bg-emerald-500', text: 'text-emerald-700', ageHours }
}

const firstApprovalValue = (item, keys) => {
  for (const key of keys) {
    const value = item?.[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return '—'
}

const unifiedApprovalDetails = (item) => {
  const config = item._approvalConfig || {}
  const firstConfiguredField = config.displayFields?.[0]?.key
  const reference = firstApprovalValue(item, [
    'requisition_number', 'pr_number', 'order_number', 'po_number', 'invoice_number',
    'request_number', 'document_number', 'month_year', firstConfiguredField,
  ].filter(Boolean))
  const title = firstApprovalValue(item, [
    'title', 'description', 'purpose', 'reason', 'document_name', 'leave_type',
    'category', 'invoice_type', 'destination',
  ])
  const requester = firstApprovalValue(item, [
    'requester_name', 'requested_by_name', 'employee_name', 'issued_by_name',
    'generated_by', 'vendor_name', 'supplier_name',
  ])
  const amount = firstApprovalValue(item, [
    'total_estimated_cost', 'total_amount', 'amount', 'total_gross', 'total_net',
  ])
  const stage = firstApprovalValue(item, [
    'approval_stage', 'approval_level', 'workflow_stage', config.statusField, 'status',
  ].filter(Boolean))
  return { reference, title, requester, amount, stage }
}

/** Unified table containing every enabled approval queue. */
const ApprovalTable = ({ items, onAction }) => {
  const pageSize = 10
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const pageStart = (currentPage - 1) * pageSize
  const visibleItems = items.slice(pageStart, pageStart + pageSize)

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages))
  }, [totalPages])

  const openRequest = (item) => onAction('view', item)

  return (
    <div className="overflow-hidden rounded-md border border-slate-200">
      <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full min-w-[1120px] border-collapse text-left">
      <thead className="sticky top-0 z-10 bg-[#f8f9fa] text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        <tr>
          <th className="w-32 border-b border-slate-200 px-3 py-2.5">Queue status</th>
          <th className="w-44 border-b border-slate-200 px-3 py-2.5">Approval type</th>
          <th className="w-48 border-b border-slate-200 px-3 py-2.5">Reference</th>
          <th className="border-b border-slate-200 px-3 py-2.5">Details</th>
          <th className="w-44 border-b border-slate-200 px-3 py-2.5">Requested by</th>
          <th className="w-36 border-b border-slate-200 px-3 py-2.5">Amount</th>
          <th className="w-40 border-b border-slate-200 px-3 py-2.5">Current stage</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white">
        {visibleItems.map((item, index) => {
          const status = approvalRowStatus(item)
          const details = unifiedApprovalDetails(item)
          const numericAmount = Number(String(details.amount).replace(/,/g, ''))
          return (
            <tr
              key={item.approval_queue_id || item.id || pageStart + index}
              className="group cursor-pointer hover:bg-blue-50/40 focus-within:bg-blue-50/40"
              onClick={() => openRequest(item)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  openRequest(item)
                }
              }}
              tabIndex={0}
              aria-label={`Open ${item._approvalLabel || 'approval'} request details`}
            >
              <td className="border-l-[3px] border-l-transparent px-3 py-3 group-hover:border-l-[#0f6cbd]">
                <div className={`flex items-center gap-2 text-xs font-semibold ${status.text}`}><span className={`h-2 w-2 rounded-full ${status.dot}`} />{status.label}</div>
                <p className="mt-1 text-[10px] text-slate-400">{status.ageHours > 0 ? `Waiting ${status.ageHours < 1 ? '<1' : Math.floor(status.ageHours)}h` : 'Decision required'}</p>
              </td>
              <td className="px-3 py-3"><span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-semibold text-[#0f6cbd]">{item._approvalLabel}</span></td>
              <td className="max-w-[210px] px-3 py-3 text-xs font-semibold text-slate-950"><div className="truncate" title={String(details.reference)}>{String(details.reference)}</div></td>
              <td className="max-w-[300px] px-3 py-3 text-xs text-slate-700"><div className="truncate" title={String(details.title)}>{String(details.title)}</div></td>
              <td className="max-w-[190px] px-3 py-3 text-xs text-slate-700"><div className="truncate" title={String(details.requester)}>{String(details.requester)}</div></td>
              <td className="px-3 py-3 text-xs font-medium tabular-nums text-slate-700">{Number.isFinite(numericAmount) ? `AED ${numericAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : String(details.amount)}</td>
              <td className="px-3 py-3"><span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-slate-700">{String(details.stage).replace(/_/g, ' ')}</span></td>
            </tr>
          )
        })}
      </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Showing <span className="font-semibold text-slate-900">{pageStart + 1}</span>–<span className="font-semibold text-slate-900">{Math.min(pageStart + pageSize, items.length)}</span> of <span className="font-semibold text-slate-900">{items.length}</span>
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 font-semibold text-slate-700 transition hover:border-[#0f6cbd] hover:text-[#0f6cbd] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeftIcon className="h-3.5 w-3.5" /> Previous
          </button>
          <span className="min-w-20 text-center font-medium tabular-nums">Page {currentPage} of {totalPages}</span>
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={currentPage === totalPages}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 font-semibold text-slate-700 transition hover:border-[#0f6cbd] hover:text-[#0f6cbd] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next <ChevronRightIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Reporting Hierarchy Widget - shows manager chain
 */
const ReportingHierarchyWidget = () => {
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
