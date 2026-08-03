/**
 * EnterpriseAdminDashboard - Super Administrator Dashboard
 * Modern enterprise dashboard with KPIs, approvals, activity, and AI insights
 * Uses existing APIs and gracefully handles missing data
 */
import React, { useState, useEffect, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../config/api.config'
import { PLACEHOLDER_CONFIG, API_CONFIG, LAYOUT_CONFIG } from '../config/enterpriseDashboard.config'
import {
  UsersIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
  ShoppingCartIcon,
  FolderIcon,
  ServerIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline'

// Import components
import WelcomeHeader from '../components/EnterpriseDashboard/WelcomeHeader'
import KPICard from '../components/EnterpriseDashboard/KPICard'
import ApprovalCenter from '../components/EnterpriseDashboard/ApprovalCenter'
import ActivityTimeline from '../components/EnterpriseDashboard/ActivityTimeline'
import AIInsightsPanel from '../components/EnterpriseDashboard/AIInsightsPanel'
import QuickActionsGrid from '../components/EnterpriseDashboard/QuickActionsGrid'

const EnterpriseAdminDashboard = () => {
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
  const kpis = useMemo(() => {
    const totalUsers = dashboardData.metrics?.users?.total_users || PLACEHOLDER_CONFIG.totalEmployees
    const activeUsers = dashboardData.metrics?.users?.active_users || PLACEHOLDER_CONFIG.activeEmployees
    const systemHealth = dashboardData.metrics?.performance?.system_health || 96
    const totalDocs = dashboardData.metrics?.documents?.total_documents || 1247
    const activeProjects = dashboardData.projects?.active_count || 8
    const pendingProjects = dashboardData.projects?.pending_count || 3

    return [
      {
        title: 'Total Employees',
        value: totalUsers,
        subtitle: `${activeUsers} active`,
        trend: 3.2,
        trendDirection: 'up',
        icon: UsersIcon,
        color: 'blue',
        sparklineData: [220, 225, 230, 234, 238, 242, 247],
      },
      {
        title: 'Active Today',
        value: activeUsers,
        subtitle: `${Math.round((activeUsers / totalUsers) * 100)}% of total`,
        trend: 1.5,
        trendDirection: 'up',
        icon: UserGroupIcon,
        color: 'green',
        sparklineData: [210, 215, 218, 220, 224, 230, 234],
      },
      {
        title: 'Attendance Today',
        value: PLACEHOLDER_CONFIG.attendanceToday,
        subtitle: '88% present',
        trend: 2.1,
        trendDirection: 'up',
        icon: ClockIcon,
        color: 'emerald',
      },
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
        title: 'Active Projects',
        value: activeProjects,
        subtitle: `${pendingProjects} pending`,
        trend: 4.2,
        trendDirection: 'up',
        icon: FolderIcon,
        color: 'pink',
      },
      {
        title: 'Total Documents',
        value: totalDocs >= 1000 ? `${(totalDocs / 1000).toFixed(1)}K` : totalDocs,
        subtitle: 'Processed this month',
        trend: 8.7,
        trendDirection: 'up',
        icon: DocumentTextIcon,
        color: 'teal',
        sparklineData: [1100, 1150, 1180, 1200, 1220, 1235, 1247],
      },
      {
        title: 'System Health',
        value: `${systemHealth}%`,
        subtitle: systemHealth >= 95 ? 'Excellent' : systemHealth >= 85 ? 'Good' : 'Needs attention',
        trend: systemHealth >= 95 ? 2.1 : -1.2,
        trendDirection: systemHealth >= 95 ? 'up' : 'down',
        icon: ServerIcon,
        color: systemHealth >= 95 ? 'green' : systemHealth >= 85 ? 'amber' : 'red',
      },
      {
        title: 'AI Requests',
        value: dashboardData.metrics?.ai_requests || '2.4K',
        subtitle: 'This month',
        trend: 12.3,
        trendDirection: 'up',
        icon: WrenchScrewdriverIcon,
        color: 'orange',
      },
      {
        title: 'Tasks Completed',
        value: '156',
        subtitle: 'This week',
        trend: 6.8,
        trendDirection: 'up',
        icon: CheckCircleIcon,
        color: 'emerald',
      },
      {
        title: 'Average Response',
        value: '2.4s',
        subtitle: 'Processing time',
        trend: -8.5,
        trendDirection: 'down',
        icon: ChartBarIcon,
        color: 'blue',
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
          {/* Welcome Header */}
          <WelcomeHeader 
            user={rbacCurrentUser || user} 
            unreadNotifications={unreadCount}
          />

          {/* KPI Cards Grid */}
          <div className={`grid ${LAYOUT_CONFIG.kpiGridCols.mobile} ${LAYOUT_CONFIG.kpiGridCols.tablet} ${LAYOUT_CONFIG.kpiGridCols.desktop} ${LAYOUT_CONFIG.kpiGridCols.wide} ${LAYOUT_CONFIG.gap}`}>
            {kpis.map((kpi, index) => (
              <KPICard
                key={index}
                {...kpi}
                loading={loading}
              />
            ))}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-8 space-y-6">
              {/* Approval Center */}
              <ApprovalCenter />

              {/* AI Insights Panel */}
              <AIInsightsPanel />

              {/* Quick Actions */}
              <QuickActionsGrid isAdmin={true} />
            </div>

            {/* Right Column */}
            <div className="lg:col-span-4 space-y-6">
              {/* Activity Timeline */}
              <ActivityTimeline />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EnterpriseAdminDashboard
