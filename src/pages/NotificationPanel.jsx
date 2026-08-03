import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import notificationService from '../services/notification.service'
import { formatDistanceToNow } from '../utils/dateFormatter'

/**
 * NotificationPanel Component
 * Comprehensive notification dashboard showing all important notifications
 * Grouped by priority and category for better organization
 */

const NotificationPanel = () => {
  const { user, isAuthenticated } = useSelector((state) => state.auth)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, unread, urgent
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications()
      fetchStats()
    }
  }, [isAuthenticated, filter])

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const params = { ordering: '-created_at' }
      
      if (filter === 'unread') {
        params.is_read = false
      } else if (filter === 'urgent') {
        params.priority = 'URGENT,HIGH'
      }
      
      const data = await notificationService.getNotifications(params)
      setNotifications(data.results || data)
    } catch (error) {
      console.error('[NotificationPanel] Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const data = await notificationService.getStats()
      setStats(data)
    } catch (error) {
      console.error('[NotificationPanel] Error fetching stats:', error)
    }
  }

  const handleMarkAsRead = async (id) => {
    try {
      await notificationService.markAsRead(id)
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      )
      fetchStats() // Refresh stats
    } catch (error) {
      console.error('[NotificationPanel] Error marking as read:', error)
    }
  }

  const handleDelete = async (id) => {
    try {
      await notificationService.deleteNotification(id)
      setNotifications(prev => prev.filter(n => n.id !== id))
      fetchStats() // Refresh stats
    } catch (error) {
      console.error('[NotificationPanel] Error deleting:', error)
    }
  }

  const getPriorityStyle = (priority) => {
    switch (priority?.toUpperCase()) {
      case 'URGENT':
        return 'bg-red-100 border-red-500 text-red-900'
      case 'HIGH':
        return 'bg-orange-100 border-orange-500 text-orange-900'
      case 'MEDIUM':
        return 'bg-yellow-100 border-yellow-500 text-yellow-900'
      case 'NORMAL':
        return 'bg-blue-100 border-blue-500 text-blue-900'
      case 'LOW':
        return 'bg-gray-100 border-gray-500 text-gray-900'
      default:
        return 'bg-gray-100 border-gray-500 text-gray-900'
    }
  }

  const getCategoryIcon = (category) => {
    const icons = {
      SYSTEM: '⚙️',
      PROJECT: '📊',
      QHSE: '🛡️',
      DOCUMENT: '📄',
      USER: '👤',
      ADMIN: '🔧',
      AI: '🤖',
      APPROVAL: '✅',
      ALERT: '⚠️',
      INFO: 'ℹ️'
    }
    return icons[category?.toUpperCase()] || 'ℹ️'
  }

  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please login to view notifications</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          📬 Notifications
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Stay updated with important alerts and updates for {user?.username || 'you'}
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.total_count}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Notifications</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-amber-600">{stats.unread_count}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Unread</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-green-600">{stats.read_count}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Read</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-red-600">
              {stats.by_priority?.URGENT || 0}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Urgent</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex space-x-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'unread'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Unread
        </button>
        <button
          onClick={() => setFilter('urgent')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'urgent'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Urgent
        </button>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading notifications...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No notifications
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            You're all caught up! Check back later for updates.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`border-l-4 rounded-lg p-6 shadow transition-all hover:shadow-lg ${
                getPriorityStyle(notification.priority)
              } ${!notification.is_read ? 'bg-opacity-50' : 'bg-opacity-20'}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="text-2xl">
                      {getCategoryIcon(notification.category?.name)}
                    </span>
                    <h3 className="text-lg font-bold">{notification.title}</h3>
                    {!notification.is_read && (
                      <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
                        NEW
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm mb-3">{notification.message}</p>
                  
                  <div className="flex items-center space-x-4 text-xs">
                    <span className="font-semibold">
                      {notification.category?.name}
                    </span>
                    <span>•</span>
                    <span>{notification.priority}</span>
                    <span>•</span>
                    <span>{formatDistanceToNow(notification.created_at)}</span>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  {!notification.is_read && (
                    <button
                      onClick={() => handleMarkAsRead(notification.id)}
                      className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                      title="Mark as read"
                    >
                      ✅
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(notification.id)}
                    className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              
              {notification.action_url && (
                <div className="mt-4">
                  <a
                    href={notification.action_url}
                    className="inline-flex items-center px-4 py-2 bg-white/80 hover:bg-white rounded-lg font-medium transition-colors"
                  >
                    {notification.action_label || 'View Details'} →
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default NotificationPanel
