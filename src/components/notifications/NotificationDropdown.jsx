import React, { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import { 
  CheckCircleIcon, 
  TrashIcon, 
  XMarkIcon,
  ArrowPathIcon,
  BellSlashIcon
} from '@heroicons/react/24/outline'
import { formatDistanceToNow } from '../../utils/dateFormatter'

/**
 * NotificationDropdown Component
 * Displays list of notifications in a dropdown panel
 */

const NotificationDropdown = forwardRef(({
  notifications = [],
  loading = false,
  unreadCount = 0,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onRefresh
}, ref) => {

  const getPriorityColor = (priority) => {
    switch (priority?.toUpperCase()) {
      case 'URGENT':
        return 'bg-red-500'
      case 'HIGH':
        return 'bg-orange-500'
      case 'MEDIUM':
        return 'bg-yellow-500'
      case 'NORMAL':
        return 'bg-blue-500'
      case 'LOW':
        return 'bg-gray-500'
      default:
        return 'bg-blue-500'
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

  const formatTime = (timestamp) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
    } catch (error) {
      return 'recently'
    }
  }

  return (
    <div
      ref={ref}
      className="absolute right-0 mt-2 w-96 max-h-[600px] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-[9999]"
      style={{ position: 'absolute', zIndex: 9999 }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="text-white font-bold text-lg">Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 bg-amber-500 text-white text-xs font-bold rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
            title="Refresh"
          >
            <ArrowPathIcon className="w-4 h-4 text-white" />
          </button>
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllAsRead}
              className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
              title="Mark all as read"
            >
              <CheckCircleIcon className="w-4 h-4 text-white" />
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="overflow-y-auto max-h-[500px]">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <BellSlashIcon className="w-16 h-16 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-slate-600 dark:text-slate-400 font-medium">No notifications</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">You're all caught up! 🎉</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                  !notification.is_read ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  {/* Category Icon */}
                  <div className="flex-shrink-0 mt-1">
                    <span className="text-2xl">
                      {getCategoryIcon(notification.category?.name)}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-1">
                            {notification.title}
                          </h4>
                          <span className={`flex-shrink-0 w-2 h-2 rounded-full ${getPriorityColor(notification.priority)}`}></span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 mb-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center space-x-3 text-xs text-slate-500 dark:text-slate-400">
                          <span>{formatTime(notification.created_at)}</span>
                          {notification.category && (
                            <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-xs">
                              {notification.category.name}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center space-x-1 ml-2">
                        {!notification.is_read && (
                          <button
                            onClick={() => onMarkAsRead(notification.id)}
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                            title="Mark as read"
                          >
                            <CheckCircleIcon className="w-4 h-4 text-green-600 dark:text-green-400" />
                          </button>
                        )}
                        <button
                          onClick={() => onDelete(notification.id)}
                          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="w-4 h-4 text-red-600 dark:text-red-400" />
                        </button>
                      </div>
                    </div>

                    {/* Action Button */}
                    {notification.action_url && (
                      <Link
                        to={notification.action_url}
                        className="mt-2 inline-flex items-center text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                      >
                        {notification.action_label || 'View Details'} →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-900 px-4 py-3 border-t border-slate-200 dark:border-slate-700">
          <Link
            to="/notifications"
            className="block text-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
          >
            📋 View All Notifications
          </Link>
        </div>
      )}
    </div>
  )
})

NotificationDropdown.displayName = 'NotificationDropdown'

export default NotificationDropdown
