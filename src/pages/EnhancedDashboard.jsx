import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../config/api.config'
import { DASHBOARD_WIDGETS, getEnabledWidgets } from '../config/dashboard.config'
import { 
  StatCard, 
  DepartmentCard, 
  NotificationCard,
  AIInsightCard,
  SkeletonCard 
} from '../components/Dashboard/DashboardWidgets'
import { 
  BellIcon, 
  ArrowPathIcon,
  Cog6ToothIcon,
  ChartBarIcon 
} from '@heroicons/react/24/outline'

/**
 * Enhanced Dashboard Component
 * Comprehensive dashboard with predictive analytics and real-time monitoring
 */
const EnhancedDashboard = () => {
  const { user } = useSelector((state) => state.auth)
  const navigate = useNavigate()
  
  const [dashboardData, setDashboardData] = useState({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Fetch data for all widgets
  const fetchDashboardData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)

      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access')
      const headers = { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }

      const widgets = getEnabledWidgets()
      const fetchPromises = []
      const widgetKeys = []

      // Build fetch promises for all widget data
      widgets.forEach(widget => {
        if (widget.type === 'stats' && widget.cards) {
          widget.cards.forEach(card => {
            if (card.apiEndpoint) {
              widgetKeys.push({ widget: widget.id, card: card.id })
              fetchPromises.push(
                fetch(`${API_BASE_URL}${card.apiEndpoint}`, { headers })
                  .then(r => r.ok ? r.json() : null)
                  .catch(() => null)
              )
            }
          })
        }
        
        if (widget.type === 'analytics' && widget.widgets) {
          widget.widgets.forEach(analyticsWidget => {
            if (analyticsWidget.apiEndpoint) {
              widgetKeys.push({ widget: widget.id, analytics: analyticsWidget.id })
              fetchPromises.push(
                fetch(`${API_BASE_URL}${analyticsWidget.apiEndpoint}`, { headers })
                  .then(r => r.ok ? r.json() : null)
                  .catch(() => null)
              )
            }
          })
        }

        if (widget.apiEndpoint) {
          widgetKeys.push({ widget: widget.id })
          fetchPromises.push(
            fetch(`${API_BASE_URL}${widget.apiEndpoint}`, { headers })
              .then(r => r.ok ? r.json() : null)
              .catch(() => null)
          )
        }
      })

      const results = await Promise.all(fetchPromises)
      
      // Organize results by widget
      const newData = {}
      results.forEach((result, index) => {
        const key = widgetKeys[index]
        if (!newData[key.widget]) newData[key.widget] = {}
        
        if (key.card) {
          newData[key.widget][key.card] = result
        } else if (key.analytics) {
          if (!newData[key.widget].analytics) newData[key.widget].analytics = {}
          newData[key.widget].analytics[key.analytics] = result
        } else {
          newData[key.widget].data = result
        }
      })

      setDashboardData(newData)
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Initial data fetch
  useEffect(() => {
    fetchDashboardData()
  }, [])

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchDashboardData(true)
    }, 60000) // Refresh every minute

    return () => clearInterval(interval)
  }, [autoRefresh])

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good Morning'
    if (hour < 18) return 'Good Afternoon'
    return 'Good Evening'
  }

  // Format last updated time
  const formatLastUpdated = () => {
    const diff = Math.floor((new Date() - lastUpdated) / 1000)
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    return `${Math.floor(diff / 3600)}h ago`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-4xl sm:text-5xl font-extrabold mb-2">
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  {getGreeting()}, {USER_DISPLAY_CONFIG.formatting.getDisplayName(user)}
                </span>
              </h1>
              <p className="text-gray-600 text-lg flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Comprehensive Control Dashboard
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Last Updated */}
              <div className="px-4 py-2 bg-white rounded-xl border border-gray-200 text-sm text-gray-600">
                Updated {formatLastUpdated()}
              </div>

              {/* Auto Refresh Toggle */}
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-4 py-2 rounded-xl border-2 font-medium transition-all ${
                  autoRefresh
                    ? 'bg-green-50 border-green-500 text-green-700'
                    : 'bg-gray-50 border-gray-300 text-gray-600'
                }`}
              >
                <ArrowPathIcon className={`w-5 h-5 inline mr-2 ${autoRefresh ? 'animate-spin-slow' : ''}`} />
                Auto-refresh
              </button>

              {/* Manual Refresh */}
              <button
                onClick={() => fetchDashboardData(true)}
                disabled={refreshing}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                <ArrowPathIcon className={`w-5 h-5 inline mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>

              {/* Notifications */}
              <button
                onClick={() => navigate('/notifications')}
                className="relative px-4 py-2 bg-white rounded-xl border-2 border-gray-200 hover:border-blue-500 transition-all"
              >
                <BellIcon className="w-5 h-5 inline text-gray-700" />
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
                  {dashboardData['notifications']?.data?.unread_count || 0}
                </span>
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <>
            {/* Quick Stats */}
            {DASHBOARD_WIDGETS.quickStats.enabled && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <ChartBarIcon className="w-7 h-7 text-blue-600" />
                  Quick Stats
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {DASHBOARD_WIDGETS.quickStats.cards.map(card => (
                    <StatCard
                      key={card.id}
                      card={card}
                      data={dashboardData['quick-stats']?.[card.id]}
                      onClick={card.onClick}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Real-time Notifications */}
            {DASHBOARD_WIDGETS.notifications.enabled && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <BellIcon className="w-7 h-7 text-orange-600" />
                    Real-time Alerts
                  </h2>
                  <button
                    onClick={() => navigate('/notifications')}
                    className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    View All →
                  </button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {dashboardData['notifications']?.data?.results?.slice(0, 6).map(notification => {
                    const category = DASHBOARD_WIDGETS.notifications.categories.find(
                      c => c.id === notification.category
                    ) || DASHBOARD_WIDGETS.notifications.categories[2]
                    
                    return (
                      <NotificationCard
                        key={notification.id}
                        notification={notification}
                        category={category}
                      />
                    )
                  }) || (
                    <div className="col-span-2 text-center py-8 text-gray-500">
                      No new notifications
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Department Overview */}
            {DASHBOARD_WIDGETS.departmentOverview.enabled && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <Cog6ToothIcon className="w-7 h-7 text-purple-600" />
                  Department Activity
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {DASHBOARD_WIDGETS.departmentOverview.departments.map(dept => (
                    <DepartmentCard
                      key={dept.id}
                      department={dept}
                      data={dashboardData['department-overview']?.[dept.id]}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* AI Insights */}
            {DASHBOARD_WIDGETS.aiInsights.enabled && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <span className="text-3xl">🤖</span>
                  AI-Powered Insights
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {DASHBOARD_WIDGETS.aiInsights.categories.map(category => {
                    const insights = dashboardData['ai-insights']?.data?.[category.id] || []
                    return insights.slice(0, 2).map((insight, idx) => (
                      <AIInsightCard
                        key={`${category.id}-${idx}`}
                        insight={insight}
                        category={category}
                      />
                    ))
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </div>
  )
}

export default EnhancedDashboard
