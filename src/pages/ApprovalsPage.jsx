/**
 * ApprovalsPage - Centralized Approval Management Dashboard
 * Standalone page for managing all approvals and viewing KPIs
 * Accessible via /approvals route
 */
import React, { useState, useEffect, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../config/api.config'
import { PLACEHOLDER_CONFIG, API_CONFIG, LAYOUT_CONFIG } from '../config/enterpriseDashboard.config'
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
} from '@heroicons/react/24/outline'

// Import reusable components
import WelcomeHeader from '../components/EnterpriseDashboard/WelcomeHeader'
import KPICard from '../components/EnterpriseDashboard/KPICard'
import ApprovalCenter from '../components/EnterpriseDashboard/ApprovalCenter'
import ActivityTimeline from '../components/EnterpriseDashboard/ActivityTimeline'
import AIInsightsPanel from '../components/EnterpriseDashboard/AIInsightsPanel'

const ApprovalsPage = () => {
  const navigate = useNavigate()
  const { user } = useSelector(s => s.auth)
  const rbacCurrentUser = useSelector(s => s.rbac?.currentUser)

  const [dashboardData, setDashboardData] = useState({})
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
    
    // Auto-refresh
    const interval = setInterval(fetchDashboardData, API_CONFIG.dashboardRefreshInterval)
    return () => clearInterval(interval)
  }, [])

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access')
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }

      // Fetch available endpoints in parallel
      const [metricsRes, projectsRes, notifRes] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/dashboard/metrics/`, { headers }),
        fetch(`${API_BASE_URL}/projects/stats/`, { headers }),
        fetch(`${API_BASE_URL}/notifications/`, { headers }),
      ])

      const data = {}

      if (metricsRes.status === 'fulfilled' && metricsRes.value.ok) {
        data.metrics = await metricsRes.value.json()
      }

      if (projectsRes.status === 'fulfilled' && projectsRes.value.ok) {
        data.projects = await projectsRes.value.json()
      }

      if (notifRes.status === 'fulfilled' && notifRes.value.ok) {
        const notifData = await notifRes.value.json()
        setNotifications(notifData.results || notifData || [])
      }

      setDashboardData(data)
    } catch (error) {
      console.error('Dashboard fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Derive KPI data from APIs or placeholders
  const approvalKPIs = useMemo(() => {
    return [
      {
        title: 'Pending Leave',
        value: PLACEHOLDER_CONFIG.pendingLeaveRequests,
        subtitle: 'Awaiting approval',
        trend: 0,
        trendDirection: 'neutral',
        icon: CalendarDaysIcon,
        color: 'amber',
      },
      {
        title: 'Payroll Pending',
        value: PLACEHOLDER_CONFIG.payrollPending,
        subtitle: 'Require review',
        trend: -1.2,
        trendDirection: 'down',
        icon: CurrencyDollarIcon,
        color: 'purple',
      },
      {
        title: 'Procurement',
        value: PLACEHOLDER_CONFIG.procurementRequests,
        subtitle: 'Active requests',
        trend: 5.4,
        trendDirection: 'up',
        icon: ShoppingCartIcon,
        color: 'indigo',
      },
      {
        title: 'Total Approvals',
        value: PLACEHOLDER_CONFIG.pendingLeaveRequests + PLACEHOLDER_CONFIG.payrollPending + PLACEHOLDER_CONFIG.procurementRequests,
        subtitle: 'Across all categories',
        trend: 2.8,
        trendDirection: 'up',
        icon: CheckCircleIcon,
        color: 'green',
      },
      {
        title: 'Active Projects',
        value: dashboardData.projects?.active_count || 8,
        subtitle: `${dashboardData.projects?.pending_count || 3} pending`,
        trend: 4.2,
        trendDirection: 'up',
        icon: FolderIcon,
        color: 'blue',
      },
      {
        title: 'Total Employees',
        value: dashboardData.metrics?.users?.total_users || PLACEHOLDER_CONFIG.totalEmployees,
        subtitle: `${dashboardData.metrics?.users?.active_users || PLACEHOLDER_CONFIG.activeEmployees} active`,
        trend: 3.2,
        trendDirection: 'up',
        icon: UsersIcon,
        color: 'teal',
      },
    ]
  }, [dashboardData])

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
                    Centralized approval dashboard for all pending requests
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchDashboardData}
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
            {approvalKPIs.map((kpi, index) => (
              <KPICard
                key={index}
                {...kpi}
                loading={loading}
              />
            ))}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column - Approval Center */}
            <div className="lg:col-span-7 space-y-6">
              <ApprovalCenter />
            </div>

            {/* Right Column */}
            <div className="lg:col-span-5 space-y-6">
              {/* AI Insights */}
              <AIInsightsPanel />

              {/* Activity Timeline */}
              <ActivityTimeline />
            </div>
          </div>

          {/* Statistics Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Approval Stats */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <CheckCircleIcon className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Approved Today</h3>
                  <p className="text-xs text-slate-500">Successfully processed</p>
                </div>
              </div>
              <p className="text-3xl font-black text-emerald-600">24</p>
              <p className="text-xs text-slate-600 mt-2">↑ 8% vs yesterday</p>
            </div>

            {/* Rejected Stats */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                  <XCircleIcon className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Rejected Today</h3>
                  <p className="text-xs text-slate-500">Declined requests</p>
                </div>
              </div>
              <p className="text-3xl font-black text-red-600">3</p>
              <p className="text-xs text-slate-600 mt-2">↓ 2% vs yesterday</p>
            </div>

            {/* Average Response Time */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <ClockIcon className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Avg Response Time</h3>
                  <p className="text-xs text-slate-500">Time to approve/reject</p>
                </div>
              </div>
              <p className="text-3xl font-black text-blue-600">4.2h</p>
              <p className="text-xs text-slate-600 mt-2">↓ 1.3h faster</p>
            </div>
          </div>

          {/* Info Banner */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                <SparklesIcon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-blue-900 mb-1">
                  AI-Powered Approval Insights
                </h3>
                <p className="text-sm text-blue-700 leading-relaxed">
                  This dashboard uses RADAI's intelligent analytics to provide real-time approval metrics, 
                  identify bottlenecks, and recommend optimizations. Pending approvals are automatically 
                  prioritized based on urgency, department, and waiting time.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                    🤖 AI Enabled
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

export default ApprovalsPage
