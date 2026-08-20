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
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { API_BASE_URL } from '../config/api.config'
import { API_CONFIG, LAYOUT_CONFIG } from '../config/enterpriseDashboard.config'
import {
<<<<<<< HEAD
  APPROVAL_ACTIONS,
  getApprovalFilters,
=======
  APPROVAL_TYPES,
  APPROVAL_ACTIONS,
  ADDITIONAL_KPIS,
  APPROVAL_STATISTICS,
  getApprovalFilters,
  getReportingHierarchy,
>>>>>>> origin/main
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
<<<<<<< HEAD
  BoltIcon,
  ShieldCheckIcon,
  ArrowTrendingUpIcon,
  CommandLineIcon,
} from '@heroicons/react/24/outline'

// Import reusable components
import ActivityTimeline from '../components/EnterpriseDashboard/ActivityTimeline'
=======
} from '@heroicons/react/24/outline'

// Import reusable components
import KPICard from '../components/EnterpriseDashboard/KPICard'
import ActivityTimeline from '../components/EnterpriseDashboard/ActivityTimeline'
import AIInsightsPanel from '../components/EnterpriseDashboard/AIInsightsPanel'
>>>>>>> origin/main
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
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useSelector(s => s.auth)
  const rbacData = useSelector(s => s.rbac?.currentUser)

  // State
  const [loading, setLoading] = useState(true)
  const [approvalCounts, setApprovalCounts] = useState({})
<<<<<<< HEAD
  const [statistics, setStatistics] = useState({})
  const [notifications, setNotifications] = useState([])
=======
  const [approvalData, setApprovalData] = useState({})
  const [statistics, setStatistics] = useState({})
  const [notifications, setNotifications] = useState([])
  const [managerHierarchy, setManagerHierarchy] = useState([])
  const [directReports, setDirectReports] = useState([])
>>>>>>> origin/main
  const [selectedApprovalType, setSelectedApprovalType] = useState(searchParams.get('tab'))

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
<<<<<<< HEAD
        approved_today: metrics?.approved_today ?? 0,
        rejected_today: metrics?.rejected_today ?? 0,
        avg_response_time: metrics?.avg_response_time || '—',
        sla_compliance: metrics?.sla_compliance ?? null,
        active_projects: projects?.active_count ?? 0,
        total_employees: metrics?.users?.total_users ?? 0
=======
        approved_today: metrics?.approved_today || 24,
        rejected_today: metrics?.rejected_today || 3,
        avg_response_time: metrics?.avg_response_time || '4.2h',
        sla_compliance: metrics?.sla_compliance || 94,
        active_projects: projects?.active_count || 8,
        total_employees: metrics?.users?.total_users || 145
>>>>>>> origin/main
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

<<<<<<< HEAD
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
=======
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
>>>>>>> origin/main

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
<<<<<<< HEAD
    <div className="min-h-screen bg-[#f3f6fb]">
=======
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100">
>>>>>>> origin/main
      <div 
        className={`mx-auto ${LAYOUT_CONFIG.paddingX} ${LAYOUT_CONFIG.paddingY}`}
        style={{ maxWidth: LAYOUT_CONFIG.maxWidth }}
      >
<<<<<<< HEAD
        <div className="space-y-8">
          {/* Page Header */}
          <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-indigo-700 via-blue-600 to-cyan-500 p-6 text-white shadow-[0_24px_70px_-28px_rgba(37,99,235,0.65)] sm:p-8">
            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-white/15 blur-3xl" />
            <div className="absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-cyan-100/20 blur-3xl" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
                  <CommandLineIcon className="h-7 w-7 text-cyan-100" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-100">Management workspace</p>
                  <h1 className="mt-1 break-words text-3xl font-black tracking-tight sm:text-4xl">Approval Command Center</h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/85">
                    Prioritize decisions, protect SLA performance, and keep every approval queue moving{isAdmin ? ' across the organization.' : ' for your team.'}
=======
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
>>>>>>> origin/main
                  </p>
                </div>
              </div>

<<<<<<< HEAD
              <div className="flex flex-wrap items-center gap-3">
                <div className="mr-1 border-r border-white/15 pr-5">
                  <p className="text-3xl font-black tabular-nums">{loading ? '—' : totalPending}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">Open decisions</p>
                </div>
                <button
                  onClick={fetchApprovalData}
                  className="rounded-xl border border-white/25 bg-white/10 p-2.5 text-white transition hover:bg-white/20"
                  title="Refresh"
                >
                  <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
=======
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchApprovalData}
                  className="p-2.5 text-slate-600 hover:text-orange-600 bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-200 rounded-xl transition-all"
                  title="Refresh"
                >
                  <ArrowPathIcon className="w-5 h-5" />
>>>>>>> origin/main
                </button>

                <button
                  onClick={() => navigate('/notifications')}
<<<<<<< HEAD
                  className="relative rounded-xl border border-white/15 bg-white/10 p-2.5 text-slate-200 transition hover:bg-white/20 hover:text-white"
=======
                  className="relative p-2.5 text-slate-600 hover:text-orange-600 bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-200 rounded-xl transition-all"
>>>>>>> origin/main
                  title="Notifications"
                >
                  <BellIcon className="w-5 h-5" />
                  {unreadCount > 0 && (
<<<<<<< HEAD
                    <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-indigo-700">
=======
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 ring-2 ring-white">
>>>>>>> origin/main
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => navigate('/dashboard')}
<<<<<<< HEAD
                  className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm transition hover:bg-cyan-50"
=======
                  className="px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
>>>>>>> origin/main
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          </div>

<<<<<<< HEAD
          {/* Grouped management KPIs */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
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
          <div className="grid grid-cols-1 gap-7 xl:grid-cols-12">
            {/* Left Column - Approval Center */}
            <div className="xl:col-span-8">
=======
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
>>>>>>> origin/main
              <DynamicApprovalCenter
                approvalTypes={enabledTypes}
                user={user}
                rbacData={rbacData}
                token={token}
<<<<<<< HEAD
=======
                isAdmin={isAdmin}
>>>>>>> origin/main
                selectedType={selectedApprovalType}
                onRefresh={fetchApprovalData}
              />
            </div>

            {/* Right Column */}
<<<<<<< HEAD
            <div className="space-y-7 xl:col-span-4">
              <ApprovalIntelligencePanel
                queues={approvalQueues}
                statistics={statistics}
                onSelectQueue={setSelectedApprovalType}
              />
              {/* Reporting Hierarchy Widget (if not admin) */}
              {!isAdmin && (
                <ReportingHierarchyWidget />
              )}

=======
            <div className="lg:col-span-5 space-y-6">
              {/* Reporting Hierarchy Widget (if not admin) */}
              {!isAdmin && (
                <ReportingHierarchyWidget user={user} />
              )}

              {/* AI Insights */}
              <AIInsightsPanel />

>>>>>>> origin/main
              {/* Activity Timeline */}
              <ActivityTimeline />
            </div>
          </div>

          {/* Statistics Section */}
<<<<<<< HEAD
          <div className="hidden">
=======
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
>>>>>>> origin/main
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
<<<<<<< HEAD
          <div className="hidden">
=======
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6">
>>>>>>> origin/main
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
<<<<<<< HEAD
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
    <section className={`relative overflow-hidden rounded-2xl border bg-white p-5 shadow-[0_14px_35px_-24px_rgba(15,23,42,0.5)] ${style.ring}`}>
      <div className={`absolute inset-y-0 left-0 w-1 ${style.bar}`} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{eyebrow}</p>
          <h2 className="mt-1 text-base font-extrabold text-slate-900">{title}</h2>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${style.icon}`}>
          <GroupIcon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-5 grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {metrics.map((metric) => (
          <div key={metric.label} className="min-w-0 py-3 first:pt-0 last:pb-0 sm:px-3 sm:py-0 sm:first:pl-0 sm:last:pr-0">
            <p className="text-2xl font-black tracking-tight text-slate-950 tabular-nums">{metric.value}</p>
            <p className="mt-1 text-[11px] font-bold text-slate-600">{metric.label}</p>
            <p className="mt-1 truncate text-[10px] text-slate-400" title={metric.helper}>{metric.helper}</p>
          </div>
        ))}
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
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-white shadow-[0_18px_45px_-24px_rgba(15,23,42,0.9)]">
      <div className="border-b border-white/10 bg-gradient-to-r from-indigo-500/20 to-cyan-400/10 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 shadow-lg shadow-indigo-950/40">
            <SparklesIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold">Decision Intelligence</h2>
            <p className="text-xs text-slate-400">Prioritized from live queue signals</p>
          </div>
        </div>
      </div>
      <div className="space-y-3 p-4">
        {recommendations.map((insight, index) => (
          <button
            key={insight.title}
            type="button"
            onClick={() => insight.queue && onSelectQueue(insight.queue)}
            disabled={!insight.queue}
            className={`w-full rounded-xl border p-4 text-left transition ${toneStyles[insight.tone] || toneStyles.normal} ${insight.queue ? 'hover:-translate-y-0.5 hover:shadow-md' : 'cursor-default'}`}
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
      <div className="flex items-center justify-between border-t border-white/10 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        <span>Live analysis</span><span>Refreshes with dashboard</span>
      </div>
    </section>
  )
}

const DynamicApprovalCenter = ({ approvalTypes, user, rbacData, token, selectedType, onRefresh }) => {
=======
const DynamicApprovalCenter = ({ approvalTypes, user, rbacData, token, isAdmin, selectedType, onRefresh }) => {
>>>>>>> origin/main
  const [approvals, setApprovals] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState(selectedType || approvalTypes[0]?.key)

  useEffect(() => {
    if (selectedType && approvalTypes.some((type) => type.key === selectedType)) {
      setActiveTab(selectedType)
    }
  }, [selectedType, approvalTypes])

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
        endpoint = `${activeConfig.actionApiEndpoint || activeConfig.apiEndpoint}${item.id}/comment/`
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
        const endpointAction = activeConfig.actionEndpointMap?.[actionId] || actionMap[actionId] || actionId
        endpoint = `${activeConfig.actionApiEndpoint || activeConfig.apiEndpoint}${item.id}/${endpointAction}/`
      }

      console.log(`📤 Sending ${actionId} request to: ${API_BASE_URL}${endpoint}`)

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(
          activeConfig.id === 'purchase_order'
            ? { note: comment || '', reason: comment || '', approval_stage: item.approval_stage }
            : (activeConfig.id === 'procurement' || activeConfig.id === 'profile_document') && actionId === 'reject'
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
<<<<<<< HEAD
    <section className="relative min-h-[640px] overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_20px_55px_-30px_rgba(15,23,42,0.55)]">
=======
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative">
>>>>>>> origin/main
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

<<<<<<< HEAD
      <div className="flex flex-col gap-4 border-b border-slate-200 bg-gradient-to-r from-white via-white to-indigo-50/70 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-200">
              <CheckCircleIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600">Primary workspace</p>
              <h2 className="text-xl font-black tracking-tight text-slate-950">Approval Center</h2>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">Review context, decide, and advance the highest-priority work.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-right shadow-sm">
          <p className="text-2xl font-black text-slate-950 tabular-nums">{loading ? '—' : approvals.length}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">In selected queue</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto border-b border-slate-100 bg-slate-50/80 px-6 py-3">
        {approvalTypes.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === key
                ? 'bg-slate-900 text-white shadow-md shadow-slate-300'
                : 'border border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700'
=======
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
>>>>>>> origin/main
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Approvals List */}
<<<<<<< HEAD
      <div className="max-h-[760px] space-y-3 overflow-y-auto p-6">
        {loading ? (
          <div className="space-y-3 py-2">
            {[1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-slate-100" />)}
          </div>
        ) : approvals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 py-16 text-center text-emerald-800">
            <CheckCircleIcon className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
            <p className="font-bold">Queue cleared</p>
            <p className="mt-1 text-xs">No pending {activeConfig?.label?.toLowerCase()} found.</p>
=======
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-slate-500">Loading...</div>
        ) : approvals.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            No pending {activeConfig?.label?.toLowerCase()} found
>>>>>>> origin/main
          </div>
        ) : (
          approvals.map((item, index) => (
            <ApprovalCard
              key={item.approval_queue_id || item.id || index}
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
        token={token}
        submitting={submitting}
        onClose={closeModal}
        onConfirm={executeAction}
        onSelectAction={handleAction}
      />
<<<<<<< HEAD
    </section>
=======
    </div>
>>>>>>> origin/main
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

/**
 * Approval Card - renders a single approval item
 */
const ApprovalCard = ({ item, config, onAction }) => {
<<<<<<< HEAD
  const submittedAt = item.submitted_at || item.created_at || item.requested_at || item.date_submitted
  const submittedTime = submittedAt ? new Date(submittedAt).getTime() : NaN
  const hasSubmittedTime = Number.isFinite(submittedTime)
  const ageHours = hasSubmittedTime ? Math.max(0, (Date.now() - submittedTime) / 3600000) : 0
  const priority = String(item.priority || '').toLowerCase()
  const urgency = ['urgent', 'critical', 'high'].includes(priority) || ageHours >= 48
    ? 'critical'
    : ageHours >= 24 ? 'attention' : 'normal'
  const urgencyStyles = {
    critical: { card: 'border-rose-200 border-l-4 border-l-rose-500 bg-rose-50/30', badge: 'bg-rose-100 text-rose-700', label: 'Urgent' },
    attention: { card: 'border-amber-200 border-l-4 border-l-amber-500 bg-amber-50/30', badge: 'bg-amber-100 text-amber-700', label: 'Attention' },
    normal: { card: 'border-slate-200 border-l-4 border-l-emerald-500 bg-white', badge: 'bg-emerald-100 text-emerald-700', label: 'On track' },
  }
  const style = urgencyStyles[urgency]

  return (
    <article className={`rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg ${style.card}`}>
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-200/70 pb-3">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${style.badge}`}>{style.label}</span>
          {hasSubmittedTime && <span className="text-[11px] font-medium text-slate-400">Waiting {ageHours < 1 ? '<1' : Math.floor(ageHours)}h</span>}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Decision required</span>
      </div>
      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid flex-1 grid-cols-1 gap-x-5 gap-y-2 sm:grid-cols-2">
          {config.displayFields.map(field => (
            <div key={field.key} className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{field.label}</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-slate-800" title={String(item[field.key] || 'N/A')}>{item[field.key] || 'N/A'}</p>
=======
  return (
    <div className="p-4 border border-slate-200 rounded-xl hover:border-orange-200 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          {config.displayFields.map(field => (
            <div key={field.key} className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-slate-600">{field.label}:</span>
              <span className="text-slate-900">{item[field.key] || 'N/A'}</span>
>>>>>>> origin/main
            </div>
          ))}
        </div>

<<<<<<< HEAD
        <div className="flex w-full flex-row flex-wrap gap-2 sm:w-auto sm:flex-nowrap">
=======
        <div className="flex gap-2">
>>>>>>> origin/main
          {config.actions.map(actionId => {
            const action = APPROVAL_ACTIONS[actionId]
            if (!action) return null

            const IconComponent = ICON_MAP[action.icon] || CheckCircleIcon

            return (
              <button
                key={actionId}
                onClick={() => onAction(actionId, item)}
<<<<<<< HEAD
                className={`rounded-xl p-2.5 shadow-sm transition-all ${action.bgColor} ${action.hoverColor} ${action.textColor}`}
=======
                className={`p-2 ${action.bgColor} ${action.hoverColor} ${action.textColor} rounded-lg transition-all`}
>>>>>>> origin/main
                title={action.label}
              >
                <IconComponent className="w-5 h-5" />
              </button>
            )
          })}
        </div>
      </div>
<<<<<<< HEAD
    </article>
=======
    </div>
>>>>>>> origin/main
  )
}

/**
 * Reporting Hierarchy Widget - shows manager chain
 */
<<<<<<< HEAD
const ReportingHierarchyWidget = () => {
=======
const ReportingHierarchyWidget = ({ user }) => {
>>>>>>> origin/main
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
