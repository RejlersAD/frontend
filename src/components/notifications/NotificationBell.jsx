import React, { useState, useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { BellIcon } from '@heroicons/react/24/outline'
import { BellAlertIcon } from '@heroicons/react/24/solid'
import notificationService from '../../services/notification.service'
import NotificationDropdown from './NotificationDropdown'

/**
 * NotificationBell Component
 * Displays notification bell icon with unread count badge
 * Shows dropdown with recent notifications on click
 */

// ─── Soft-coded polling config ──────────────────────────────────────────────
// Easy knobs — change these to retune polling without touching logic.
const POLL_CONFIG = {
  intervalMs:        15000,   // Near-real-time approval notifications
  backoffMs:         600000,  // 10 min after repeated failures
  failureThreshold:  2,       // failures before backing off
  // When the app sets window.__RADAI_HEAVY_OP = true (uploads, exports, etc.)
  // we skip the poll for that tick — keeps the worker free for the real work.
  heavyOpFlag:       '__RADAI_HEAVY_OP',
}

const NotificationBell = () => {
  const { isAuthenticated } = useSelector((state) => state.auth)
  const [unreadCount, setUnreadCount] = useState(0)
  const [showDropdown, setShowDropdown] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [decisionLoadingId, setDecisionLoadingId] = useState(null)
  const [decisionMessage, setDecisionMessage] = useState('')
  const dropdownRef = useRef(null)
  const bellRef = useRef(null)
  const errorCountRef = useRef(0)
  const pollingIntervalRef = useRef(null)
  const unreadAbortRef = useRef(null)
  const notificationListAbortRef = useRef(null)

  // Fetch unread count on mount and every 2 minutes (optimized from 60s) - only if authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      console.log('[NotificationBell] ⚠️ User not authenticated, skipping fetch')
      errorCountRef.current = 0
      return
    }
    
    console.log('[NotificationBell] ✅ User authenticated, starting notification polling (120s interval)')
    fetchUnreadCount()
    
    // Start polling with 2-minute interval (reduced load by 50%)
    pollingIntervalRef.current = setInterval(fetchUnreadCount, POLL_CONFIG.intervalMs)
    
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
      if (unreadAbortRef.current) {
        unreadAbortRef.current.abort()
      }
      if (notificationListAbortRef.current) {
        notificationListAbortRef.current.abort()
      }
    }
  }, [isAuthenticated])

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (showDropdown) {
      fetchNotifications()
    }
  }, [showDropdown])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        bellRef.current &&
        !bellRef.current.contains(event.target)
      ) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  const fetchUnreadCount = async () => {
    // Soft-coded: skip the poll if a heavy operation is in flight (large upload,
    // bulk export, etc.). Prevents queueing requests behind a busy worker.
    if (typeof window !== 'undefined' && window[POLL_CONFIG.heavyOpFlag]) {
      console.log('[NotificationBell] ⏸️ Heavy op active, skipping unread-count poll')
      return
    }
    // Cancel any still-in-flight unread-count request before starting a new
    // one — prevents duplicate/racing requests (e.g. mount + poll overlap).
    if (unreadAbortRef.current) {
      unreadAbortRef.current.abort()
    }
    const controller = new AbortController()
    unreadAbortRef.current = controller
    try {
      const count = await notificationService.getUnreadCount({ signal: controller.signal })
      console.log('[NotificationBell] ✅ Unread count fetched:', count)
      setUnreadCount(count)

      // Reset error count on success
      errorCountRef.current = 0

    } catch (error) {
      if (error.code === 'ERR_CANCELED') return
      // Silent log — error.service already handles toast suppression.
      console.warn('[NotificationBell] Poll failed (silent):', error.message)
      
      // Increment error counter
      errorCountRef.current += 1
      
      // Handle authentication errors
      if (error.response?.status === 401) {
        console.error('[NotificationBell] ⚠️ User not authenticated')
        setUnreadCount(0)
        // Stop polling on auth error
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
        }
        return
      }
      
      // Handle timeout errors with exponential backoff
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout') || error.isTimeout) {
        // Back off after configured threshold of consecutive failures
        if (errorCountRef.current >= POLL_CONFIG.failureThreshold) {
          console.warn('[NotificationBell] 🛑 Backing off polling to', POLL_CONFIG.backoffMs, 'ms')
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
          }
          pollingIntervalRef.current = setInterval(fetchUnreadCount, POLL_CONFIG.backoffMs)
        }
      }
      
      // Keep last known count on failure (do NOT reset to 0)
    }
  }

  const fetchNotifications = async () => {
    if (notificationListAbortRef.current) {
      notificationListAbortRef.current.abort()
    }
    const controller = new AbortController()
    notificationListAbortRef.current = controller
    setLoading(true)
    try {
      console.log('[NotificationBell] 📥 Fetching notifications...')
      const data = await notificationService.getNotifications(
        {
          ordering: '-created_at',
          page_size: 10
        },
        { signal: controller.signal },
      )
      console.log('[NotificationBell] ✅ Notifications fetched:', data)
      setNotifications(data.results || data)
    } catch (error) {
      if (error.code === 'ERR_CANCELED') return
      console.warn('[NotificationBell] Notification list fetch failed:', error.message)
      if (error.response?.status === 401) {
        console.error('[NotificationBell] ⚠️ User not authenticated')
      }
    } finally {
      if (notificationListAbortRef.current === controller) {
        notificationListAbortRef.current = null
        setLoading(false)
      }
    }
  }

  const handleBellClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    console.log('[NotificationBell] Bell clicked, current showDropdown:', showDropdown)
    setShowDropdown(!showDropdown)
  }

  const handleMarkAsRead = async (notificationId) => {
    try {
      await notificationService.markAsRead(notificationId)
      // Update local state
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      )
      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1))
      // Refresh count from server to sync cache
      setTimeout(() => fetchUnreadCount(), 500)
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead()
      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
      // Refresh count from server to sync cache
      setTimeout(() => fetchUnreadCount(), 500)
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  }

  const handleDelete = async (notificationId) => {
    try {
      await notificationService.deleteNotification(notificationId)
      // Remove from local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      // Update unread count if notification was unread
      const notification = notifications.find(n => n.id === notificationId)
      if (notification && !notification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Failed to delete notification:', error)
    }
  }

  const handleOffboardingDecision = async (notification, decision) => {
    const offboardingId = notification.metadata?.offboarding_id
    if (!offboardingId) return

    let note = ''
    if (decision === 'rejected') {
      note = window.prompt('Enter the reason for rejecting this exit process:')
      if (note === null) return
      if (!note.trim()) {
        setDecisionMessage('A rejection reason is required.')
        return
      }
    } else if (!window.confirm('Approve this employee exit process?')) {
      return
    }

    setDecisionLoadingId(notification.id)
    setDecisionMessage('')
    try {
      const result = await notificationService.decideOffboarding(offboardingId, decision, note.trim())
      setNotifications(prev => prev.map(item => (
        item.metadata?.offboarding_id === offboardingId &&
        item.metadata?.action_type === 'offboarding_project_manager_decision'
          ? {
              ...item,
              is_read: true,
              metadata: { ...item.metadata, decision_status: result.decision },
            }
          : item
      )))
      setDecisionMessage(`Exit process ${result.decision} successfully.`)
      await fetchUnreadCount()
    } catch (error) {
      setDecisionMessage(
        error.response?.data?.detail ||
        error.response?.data?.decision ||
        'Unable to record the Project Manager decision.'
      )
    } finally {
      setDecisionLoadingId(null)
    }
  }

  return (
    <div className="relative z-50">
      <button
        ref={bellRef}
        onClick={handleBellClick}
        type="button"
        className="relative p-2 rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 transition-all transform hover:scale-110 cursor-pointer"
        aria-label="Notifications"
        style={{ pointerEvents: 'auto' }}
      >
        {unreadCount > 0 ? (
          <BellAlertIcon className="w-6 h-6 text-amber-300 animate-pulse" />
        ) : (
          <BellIcon className="w-6 h-6 text-white" />
        )}
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-[10px] font-bold text-white shadow-lg">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {showDropdown && (
        <NotificationDropdown
          ref={dropdownRef}
          notifications={notifications}
          loading={loading}
          unreadCount={unreadCount}
          onMarkAsRead={handleMarkAsRead}
          onMarkAllAsRead={handleMarkAllAsRead}
          onDelete={handleDelete}
          onRefresh={fetchNotifications}
          onOffboardingDecision={handleOffboardingDecision}
          decisionLoadingId={decisionLoadingId}
          decisionMessage={decisionMessage}
        />
      )}
    </div>
  )
}

export default NotificationBell
