/**
 * ========================================================================
 * REAL-TIME ACTIVITY FEED COMPONENT
 * ========================================================================
 * Purpose: Live activity tracking with historical data from DB and S3
 * Features: Auto-refresh, filtering, time grouping, animations
 * Pattern: Intelligent real-time monitoring
 * ========================================================================
 */

import React, { useEffect, useState, useRef } from 'react'
import * as HeroIcons from '@heroicons/react/24/outline'
import { API_BASE_URL } from '../../config/api.config'
import {
  ACTIVITY_FILTERS,
  REALTIME_CONFIG,
  formatActivityTime,
  generateActivityMessage,
  getActivityIcon,
  filterActivities,
  groupActivitiesByTime
} from '../../config/activityTracking.config'

const RealTimeActivityFeed = ({ 
  apiEndpoint = '/activity/recent/',
  maxHeight = '600px',
  showFilters = true,
  autoRefresh = true 
}) => {
  const [activities, setActivities] = useState([])
  const [filteredActivities, setFilteredActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('all')
  const [newActivityCount, setNewActivityCount] = useState(0)
  const [isLive, setIsLive] = useState(autoRefresh)
  const feedRef = useRef(null)
  const previousActivitiesRef = useRef([])

  // Fetch activities from API
  const fetchActivities = async () => {
    try {
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access')
      const response = await fetch(`${API_BASE_URL}${apiEndpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        const newActivities = Array.isArray(data) ? data : data.results || []
        
        // Check for new activities
        if (previousActivitiesRef.current.length > 0) {
          const newCount = newActivities.filter(
            activity => !previousActivitiesRef.current.some(prev => prev.id === activity.id)
          ).length
          
          if (newCount > 0) {
            setNewActivityCount(prev => prev + newCount)
            // Auto-scroll to top if enabled
            if (REALTIME_CONFIG.autoScroll && feedRef.current) {
              feedRef.current.scrollTop = 0
            }
          }
        }
        
        previousActivitiesRef.current = newActivities
        setActivities(newActivities)
      }
    } catch (error) {
      console.error('Error fetching activities:', error)
    } finally {
      setLoading(false)
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchActivities()
  }, [apiEndpoint])

  // Auto-refresh
  useEffect(() => {
    if (!isLive) return

    const interval = setInterval(() => {
      fetchActivities()
    }, REALTIME_CONFIG.refreshInterval)

    return () => clearInterval(interval)
  }, [isLive, apiEndpoint])

  // Filter activities
  useEffect(() => {
    const filtered = filterActivities(activities, activeFilter)
    setFilteredActivities(filtered)
  }, [activities, activeFilter])

  // Group activities by time
  const groupedActivities = REALTIME_CONFIG.groupByTime 
    ? groupActivitiesByTime(filteredActivities)
    : { ALL: { label: 'All Activity', activities: filteredActivities } }

  // Handle filter change
  const handleFilterChange = (filterId) => {
    setActiveFilter(filterId)
    setNewActivityCount(0)
  }

  // Toggle live updates
  const toggleLive = () => {
    setIsLive(!isLive)
    if (!isLive) {
      fetchActivities()
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2">
              <HeroIcons.BoltIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Real-Time Activity</h3>
              <p className="text-blue-100 text-sm">Live system monitoring</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* New Activity Badge */}
            {newActivityCount > 0 && (
              <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold animate-pulse">
                +{newActivityCount} new
              </div>
            )}
            
            {/* Live Toggle */}
            <button
              onClick={toggleLive}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
                ${isLive 
                  ? 'bg-green-500 text-white hover:bg-green-600' 
                  : 'bg-white/20 text-white hover:bg-white/30'}
              `}
            >
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-white animate-pulse' : 'bg-gray-300'}`} />
              {isLive ? 'Live' : 'Paused'}
            </button>

            {/* Refresh Button */}
            <button
              onClick={fetchActivities}
              disabled={loading}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-all"
            >
              <HeroIcons.ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.values(ACTIVITY_FILTERS).map(filter => {
              const IconComponent = HeroIcons[filter.icon] || HeroIcons.Squares2X2Icon
              const isActive = activeFilter === filter.id
              
              return (
                <button
                  key={filter.id}
                  onClick={() => handleFilterChange(filter.id)}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
                    ${isActive 
                      ? 'bg-white text-blue-600 shadow-lg' 
                      : 'bg-white/20 text-white hover:bg-white/30'}
                  `}
                >
                  <IconComponent className="w-4 h-4" />
                  {filter.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Activity Feed */}
      <div 
        ref={feedRef}
        className="overflow-y-auto p-6 space-y-6"
        style={{ maxHeight }}
      >
        {loading ? (
          // Loading Skeletons
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredActivities.length === 0 ? (
          // Empty State
          <div className="text-center py-12">
            <HeroIcons.InboxIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium">No activities yet</p>
            <p className="text-gray-400 text-sm">Activity will appear here as it happens</p>
          </div>
        ) : (
          // Activity Groups
          Object.entries(groupedActivities).map(([groupKey, group]) => (
            <div key={groupKey} className="space-y-4">
              {REALTIME_CONFIG.groupByTime && (
                <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider sticky top-0 bg-white py-2">
                  {group.label}
                </h4>
              )}
              
              {group.activities.map((activity, index) => {
                const iconConfig = getActivityIcon(activity.type)
                const IconComponent = HeroIcons[iconConfig.icon] || HeroIcons.BellIcon
                const message = generateActivityMessage(activity)
                
                return (
                  <div
                    key={activity.id || index}
                    className="flex gap-4 p-4 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all group"
                  >
                    {/* Icon */}
                    <div className={`
                      ${iconConfig.bgColor} ${iconConfig.borderColor}
                      rounded-lg p-2.5 border-2
                      group-hover:scale-110 transition-transform
                    `}>
                      <IconComponent className={`w-5 h-5 ${iconConfig.textColor}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-gray-900 font-medium">
                            <span className="text-blue-600 font-semibold">
                              {activity.user_name || activity.user || 'System'}
                            </span>
                            {' '}
                            {message}
                          </p>
                          
                          {activity.description && (
                            <p className="text-gray-500 text-sm mt-1 line-clamp-2">
                              {activity.description}
                            </p>
                          )}

                          {activity.metadata && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {Object.entries(activity.metadata).slice(0, 3).map(([key, value]) => (
                                <span
                                  key={key}
                                  className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-600 text-xs"
                                >
                                  {key}: {value}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Timestamp */}
                        {REALTIME_CONFIG.showTimestamp && (
                          <span className="text-xs text-gray-400 whitespace-nowrap">
                            {formatActivityTime(activity.timestamp)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>

      {/* Footer Stats */}
      <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">
            Showing <span className="font-bold text-gray-900">{filteredActivities.length}</span> activities
          </span>
          <span className="text-gray-500">
            Updates every {REALTIME_CONFIG.refreshInterval / 1000}s
          </span>
        </div>
      </div>
    </div>
  )
}

export default RealTimeActivityFeed
