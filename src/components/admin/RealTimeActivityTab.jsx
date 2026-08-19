import React, { useState, useEffect, useMemo } from 'react';
import { useActivityStream } from '../../hooks/useActivityStream';
import { 
  ACTIVITY_CONFIG, 
  formatActivityDescription, 
  getActivityStyle, 
  formatTimestamp 
} from '../../config/activity.config';

/**
 * Real-time Activity Stream Component
 * Live monitoring of all system activities with WebSocket updates
 */
const RealTimeActivityTab = () => {
  const {
    activities,
    activeUsers,
    statistics,
    connectionStatus,
    isConnected,
    error,
    getFilteredActivities,
    requestStatistics,
  } = useActivityStream();

  // Filter state
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTimeRange, setSelectedTimeRange] = useState('realtime');

  // View state
  const [autoScroll, setAutoScroll] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  /**
   * Get filtered activities based on current filters
   */
  const filteredActivities = useMemo(() => {
    const timeRange = ACTIVITY_CONFIG.filters.timeRanges.find(r => r.id === selectedTimeRange);
    
    return getFilteredActivities({
      category: selectedCategory,
      severity: selectedSeverity,
      search: searchTerm,
      minutes: timeRange?.minutes,
    });
  }, [activities, selectedCategory, selectedSeverity, searchTerm, selectedTimeRange, getFilteredActivities]);

  /**
   * Auto-scroll to top when new activities arrive
   */
  useEffect(() => {
    if (autoScroll && filteredActivities.length > 0) {
      const container = document.getElementById('activity-list');
      if (container) {
        container.scrollTop = 0;
      }
    }
  }, [filteredActivities, autoScroll]);

  /**
   * Refresh statistics periodically
   */
  useEffect(() => {
    const interval = setInterval(() => {
      if (isConnected) {
        requestStatistics();
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [isConnected, requestStatistics]);

  /**
   * Connection status indicator
   */
  const ConnectionStatus = () => (
    <div className="flex items-center space-x-2">
      <div className={`w-3 h-3 rounded-full ${
        connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' :
        connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
        'bg-red-500'
      }`} />
      <span className="text-sm font-medium text-gray-700">
        {connectionStatus === 'connected' ? 'Live' :
         connectionStatus === 'connecting' ? 'Connecting...' :
         'Disconnected'}
      </span>
      {error && (
        <span className="text-xs text-red-600">({error})</span>
      )}
    </div>
  );

  /**
   * Statistics cards
   */
  const StatisticsPanel = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {/* Total Activities (Last Hour) */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">Last Hour</p>
            <p className="text-2xl font-bold text-blue-900">
              {statistics.total_last_hour || 0}
            </p>
          </div>
          <div className="text-3xl">⏱️</div>
        </div>
      </div>

      {/* Total Activities (Last 24h) */}
      <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-purple-600">Last 24 Hours</p>
            <p className="text-2xl font-bold text-purple-900">
              {statistics.total_last_24h || 0}
            </p>
          </div>
          <div className="text-3xl">📊</div>
        </div>
      </div>

      {/* Success Rate */}
      <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-green-600">Success Rate</p>
            <p className="text-2xl font-bold text-green-900">
              {statistics.success_rate?.toFixed(1) || 100}%
            </p>
          </div>
          <div className="text-3xl">✅</div>
        </div>
      </div>

      {/* Active Users */}
      <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-orange-600">Active Users</p>
            <p className="text-2xl font-bold text-orange-900">
              {activeUsers.length}
            </p>
          </div>
          <div className="text-3xl">👥</div>
        </div>
      </div>
    </div>
  );

  /**
   * Filters panel
   */
  const FiltersPanel = () => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Category Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Category
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {ACTIVITY_CONFIG.categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Severity Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Severity
          </label>
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Severities</option>
            {Object.entries(ACTIVITY_CONFIG.severityLevels).map(([key, level]) => (
              <option key={key} value={key}>
                {level.label}
              </option>
            ))}
          </select>
        </div>

        {/* Time Range Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Time Range
          </label>
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {ACTIVITY_CONFIG.filters.timeRanges.map(range => (
              <option key={range.id} value={range.id}>
                {range.label}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search
          </label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search activities..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* View Options */}
      <div className="flex items-center space-x-4 mt-4 pt-4 border-t border-gray-200">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Auto-scroll</span>
        </label>
        
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showDetails}
            onChange={(e) => setShowDetails(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Show details</span>
        </label>

        <div className="flex-1" />
        
        <span className="text-sm text-gray-600">
          Showing {filteredActivities.length} activities
        </span>
      </div>
    </div>
  );

  /**
   * Activity card component
   */
  const ActivityCard = ({ activity }) => {
    const style = getActivityStyle(activity);
    const description = formatActivityDescription(activity);
    const timestamp = formatTimestamp(activity.timestamp);

    return (
      <div className={`
        bg-white rounded-lg shadow-sm border-l-4 p-4 mb-3 
        transition-all duration-300 hover:shadow-md
        ${style.severity.borderClass}
        animate-fade-in
      `}>
        <div className="flex items-start space-x-3">
          {/* Icon */}
          <div className={`
            flex-shrink-0 w-10 h-10 rounded-full 
            flex items-center justify-center text-xl
            ${style.severity.bgClass}
          `}>
            {style.icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">
                  {description}
                </p>
                
                {showDetails && activity.details && (
                  <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded p-2">
                    <pre className="whitespace-pre-wrap overflow-x-auto">
                      {JSON.stringify(activity.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
              
              {/* Severity Badge */}
              <span className={`
                ml-2 px-2 py-1 text-xs font-medium rounded-full
                ${style.severity.bgClass} ${style.severity.textClass}
              `}>
                {style.severity.label}
              </span>
            </div>

            {/* Footer */}
            <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
              {activity.user_name && (
                <span className="flex items-center space-x-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>{activity.user_name}</span>
                </span>
              )}
              
              {activity.ip_address && showDetails && (
                <span className="flex items-center space-x-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  <span>{activity.ip_address}</span>
                </span>
              )}
              
              <span className="flex items-center space-x-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{timestamp}</span>
              </span>

              {activity.duration && showDetails && (
                <span className="flex items-center space-x-1">
                  <span>⏱️ {activity.duration}ms</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /**
   * Active users sidebar
   */
  const ActiveUsersSidebar = () => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2" />
        Active Users ({activeUsers.length})
      </h3>
      
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {activeUsers.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No active users</p>
        ) : (
          activeUsers.map((user, index) => (
            <div key={index} className="flex items-center space-x-2 text-sm">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 font-medium truncate">
                  {user.name || user.email || 'Unknown'}
                </p>
                {user.email && user.name && (
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 flex items-center">
            <span className="mr-3">📡</span>
            Real-time Activity Stream
          </h2>
          <p className="text-gray-600 mt-1">Live monitoring of all system activities</p>
        </div>
        <ConnectionStatus />
      </div>

      {/* Statistics Panel */}
      <StatisticsPanel />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Activity Feed */}
        <div className="lg:col-span-3">
          {/* Filters */}
          <FiltersPanel />

          {/* Activity List */}
          <div
            id="activity-list"
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 max-h-[calc(100vh-500px)] overflow-y-auto"
          >
            {filteredActivities.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">📭</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No activities found
                </h3>
                <p className="text-gray-600">
                  {!isConnected
                    ? 'Connecting to activity stream...'
                    : searchTerm
                    ? 'Try adjusting your search or filters'
                    : 'Activities will appear here in real-time'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredActivities.map((activity) => (
                  <ActivityCard key={activity.id} activity={activity} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <ActiveUsersSidebar />
          
          {/* Category Statistics */}
          {statistics.by_category && Object.keys(statistics.by_category).length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Activity by Category
              </h3>
              <div className="space-y-2">
                {Object.entries(statistics.by_category)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 8)
                  .map(([category, count]) => {
                    const categoryConfig = ACTIVITY_CONFIG.categories.find(c => c.id === category);
                    return (
                      <div key={category} className="flex items-center justify-between text-sm">
                        <span className="flex items-center space-x-2">
                          <span>{categoryConfig?.icon || '📌'}</span>
                          <span className="text-gray-700 truncate">
                            {categoryConfig?.label || category}
                          </span>
                        </span>
                        <span className="font-semibold text-gray-900">{count}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RealTimeActivityTab;

