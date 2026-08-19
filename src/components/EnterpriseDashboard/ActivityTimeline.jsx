/**
 * ActivityTimeline - Recent Activity Feed
 * Displays recent activities in a timeline format
 * Integrates with existing activity tracking system
 */
import React, { useState, useEffect } from 'react'
import { API_BASE_URL } from '../../config/api.config'
import { API_CONFIG } from '../../config/enterpriseDashboard.config'
import {
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'

const ActivityTimeline = () => {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchActivities()
    const interval = setInterval(fetchActivities, API_CONFIG.activityRefreshInterval)
    return () => clearInterval(interval)
  }, [])

  const fetchActivities = async () => {
    try {
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access')
      const response = await fetch(`${API_BASE_URL}/activity/recent/?limit=${API_CONFIG.activityFeedLimit}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        setActivities(data.results || data || [])
      }
    } catch (error) {
      console.error('Error fetching activities:', error)
      // Use placeholder on error
      setActivities(PLACEHOLDER_ACTIVITIES)
    } finally {
      setLoading(false)
    }
  }

  const getActivityIcon = (activity) => {
    if (activity.success === false) {
      return <XCircleIcon className="w-5 h-5 text-red-600" />
    }
    
    switch (activity.severity?.toLowerCase()) {
      case 'error':
      case 'critical':
        return <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
      case 'warning':
        return <ExclamationTriangleIcon className="w-5 h-5 text-amber-600" />
      case 'success':
        return <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
      default:
        return <InformationCircleIcon className="w-5 h-5 text-blue-600" />
    }
  }

  const getRelativeTime = (timestamp) => {
    const now = new Date()
    const activityTime = new Date(timestamp)
    const diffMs = now - activityTime
    const diffMins = Math.floor(diffMs / (1000 * 60))
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/3" />
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex gap-3">
              <div className="w-5 h-5 bg-slate-200 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-100 rounded w-3/4" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Recent Activities</h2>
          <p className="text-xs text-slate-500 mt-0.5">Latest system events</p>
        </div>
        
        <ClockIcon className="w-5 h-5 text-slate-400" />
      </div>

      {/* Timeline */}
      {activities.length === 0 ? (
        <div className="text-center py-8">
          <InformationCircleIcon className="w-12 h-12 mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No recent activities</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-[450px] overflow-y-auto">
          {activities.map((activity, index) => (
            <div key={activity.id || index} className="flex gap-3 group">
              {/* Timeline dot */}
              <div className="flex-shrink-0 relative">
                <div className="w-8 h-8 rounded-full bg-slate-50 border-2 border-slate-200 flex items-center justify-center group-hover:border-orange-200 transition-colors">
                  {getActivityIcon(activity)}
                </div>
                
                {/* Timeline line */}
                {index < activities.length - 1 && (
                  <div className="absolute top-8 left-1/2 -translate-x-1/2 w-0.5 h-full bg-slate-100" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold text-slate-900 leading-tight">
                    {activity.description || activity.activity_type || 'Activity'}
                  </p>
                  <span className="flex-shrink-0 text-xs text-slate-500">
                    {getRelativeTime(activity.timestamp || activity.created_at)}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-600">
                  {activity.category && (
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full font-medium">
                      {activity.category}
                    </span>
                  )}
                  
                  {activity.user && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span>{activity.user.name || activity.user.email}</span>
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

// Placeholder activities
const PLACEHOLDER_ACTIVITIES = [
  {
    id: 1,
    description: 'P&ID drawing analyzed successfully',
    category: 'Engineering',
    success: true,
    severity: 'success',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    user: { name: 'Ahmed Hassan' },
  },
  {
    id: 2,
    description: 'Payroll processed for 234 employees',
    category: 'Finance',
    success: true,
    severity: 'success',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    user: { name: 'Sara Ali' },
  },
  {
    id: 3,
    description: 'Document uploaded to procurement',
    category: 'Procurement',
    success: true,
    severity: 'info',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    user: { name: 'Mohammed Ahmed' },
  },
  {
    id: 4,
    description: 'QHSE inspection completed',
    category: 'QHSE',
    success: true,
    severity: 'success',
    timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    user: { name: 'Fatima Khalil' },
  },
]

export default ActivityTimeline
