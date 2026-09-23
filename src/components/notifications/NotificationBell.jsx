import { radaiPrompt, radaiConfirm } from '../../services/radaiDialog'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useSelector } from 'react-redux'
import { BellIcon } from '@heroicons/react/24/outline'
import { BellAlertIcon } from '@heroicons/react/24/solid'
import notificationService from '../../services/notification.service'
import notificationAlertService from '../../services/notificationAlert.service'
import pushNotificationService from '../../services/pushNotification.service'
import NotificationDropdown from './NotificationDropdown'
import { canDecideOffboardingNotification } from '../../utils/approvalCapabilities'

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

const notificationError = (error, action) => {
  const response = error?.response || error?.originalError?.response
  if (response?.status === 401) return 'Your session has expired. Sign in again to manage notifications.'
  if (response?.status === 403) return `Unable to ${action}. Your account is not allowed to perform this action.`
  if (error?.isTimeout || error?.isNetworkError || !response) {
    return `Unable to ${action}. Check your connection, then refresh or try the action again.`
  }
  return `Unable to ${action}. ${typeof response.data?.detail === 'string' ? response.data.detail : 'Please try again.'}`
}

const NotificationBell = () => {
  const { isAuthenticated, user } = useSelector((state) => state.auth)
  const pushUserId = user?.user?.id ?? user?.id
  const [unreadCount, setUnreadCount] = useState(0)
  const [showDropdown, setShowDropdown] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [busyIds, setBusyIds] = useState([])
  const [bulkBusy, setBulkBusy] = useState(false)
  const [decisionLoadingId, setDecisionLoadingId] = useState(null)
  const [decisionMessage, setDecisionMessage] = useState('')
  const [soundEnabled, setSoundEnabled] = useState(notificationAlertService.isSoundEnabled())
  const [pushState, setPushState] = useState({ supported: true, available: true, enabled: false, busy: false, error: '' })
  const dropdownRef = useRef(null)
  const bellRef = useRef(null)
  const errorCountRef = useRef(0)
  const pollingIntervalRef = useRef(null)
  const unreadAbortRef = useRef(null)
  const notificationListAbortRef = useRef(null)
  const lastUnreadCountRef = useRef(null)
  const notificationsRef = useRef(notifications)
  const openRef = useRef(showDropdown)
  const sessionRef = useRef(0)
  const revisionRef = useRef(0)
  const busyRef = useRef(new Set())
  const bulkBusyRef = useRef(false)
  notificationsRef.current = notifications
  openRef.current = showDropdown

  const updateCount = useCallback((count) => {
    const next = Math.max(0, Number(count) || 0)
    lastUnreadCountRef.current = next
    setUnreadCount(next)
  }, [])

  const fetchNotifications = useCallback(async () => {
    if (busyRef.current.size || bulkBusyRef.current) return
    notificationListAbortRef.current?.abort()
    const controller = new AbortController()
    notificationListAbortRef.current = controller
    const session = sessionRef.current
    const revision = revisionRef.current
    setLoading(true)
    try {
      const data = await notificationService.getNotifications(
        { ordering: '-created_at', page_size: 25 },
        { signal: controller.signal },
      )
      if (controller.signal.aborted || session !== sessionRef.current || revision !== revisionRef.current) return
      const items = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : []
      setNotifications(items)
      setHasMore(Boolean(data?.next) || Number(data?.count) > items.length)
    } catch (error) {
      if (!controller.signal.aborted && session === sessionRef.current && revision === revisionRef.current) {
        setErrorMessage(notificationError(error, 'load notifications'))
      }
    } finally {
      if (notificationListAbortRef.current === controller) {
        notificationListAbortRef.current = null
        setLoading(false)
      }
    }
  }, [])

  const fetchUnreadCount = useCallback(async () => {
    if (window[POLL_CONFIG.heavyOpFlag] || busyRef.current.size || bulkBusyRef.current) return
    unreadAbortRef.current?.abort()
    const controller = new AbortController()
    unreadAbortRef.current = controller
    const session = sessionRef.current
    const revision = revisionRef.current
    try {
      const count = await notificationService.getUnreadCount({ signal: controller.signal })
      if (controller.signal.aborted || session !== sessionRef.current || revision !== revisionRef.current) return
      if (lastUnreadCountRef.current !== null && count > lastUnreadCountRef.current) {
        notificationAlertService.play()
        window.dispatchEvent(new CustomEvent('radai:new-notification', {
          detail: { count: count - lastUnreadCountRef.current },
        }))
        if (openRef.current) void fetchNotifications()
      }
      updateCount(count)
      errorCountRef.current = 0
    } catch (error) {
      if (controller.signal.aborted || session !== sessionRef.current) return
      errorCountRef.current += 1
      if (error.response?.status === 401) {
        clearInterval(pollingIntervalRef.current)
      } else if (errorCountRef.current === POLL_CONFIG.failureThreshold) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = setInterval(fetchUnreadCount, POLL_CONFIG.backoffMs)
      }
    } finally {
      if (unreadAbortRef.current === controller) unreadAbortRef.current = null
    }
  }, [fetchNotifications, updateCount])

  useEffect(() => {
    notificationAlertService.installUnlockListeners()
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return undefined
    let active = true
    pushNotificationService.getStatus()
      .then((status) => active && setPushState((previous) => ({ ...previous, ...status, error: '' })))
      .catch((error) => active && setPushState((previous) => ({ ...previous, error: error.message })))
    return () => { active = false }
  }, [isAuthenticated, pushUserId])

  // Reset private inbox state when the signed-in recipient changes.
  useEffect(() => {
    sessionRef.current += 1
    errorCountRef.current = 0
    lastUnreadCountRef.current = null
    busyRef.current.clear()
    bulkBusyRef.current = false
    setBusyIds([])
    setBulkBusy(false)
    setNotifications([])
    setUnreadCount(0)
    setShowDropdown(false)
    setErrorMessage('')
    setDecisionMessage('')
    setDecisionLoadingId(null)
    setHasMore(false)
    if (isAuthenticated) {
      void fetchUnreadCount()
      pollingIntervalRef.current = setInterval(fetchUnreadCount, POLL_CONFIG.intervalMs)
    }
    return () => {
      sessionRef.current += 1
      clearInterval(pollingIntervalRef.current)
      unreadAbortRef.current?.abort()
      notificationListAbortRef.current?.abort()
    }
  }, [isAuthenticated, pushUserId, fetchUnreadCount])

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (showDropdown) {
      void fetchNotifications()
    }
  }, [showDropdown, fetchNotifications])

  // Portal avoids clipping inside sticky headers. Keep keyboard focus in the drawer.
  useEffect(() => {
    if (!showDropdown) return undefined
    const bell = bellRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dropdownRef.current?.focus()
    const handleKeyDown = (event) => {
      if (event.defaultPrevented || document.querySelector('.radai-dialog[open]')) return
      if (event.key === 'Escape') {
        event.preventDefault()
        setShowDropdown(false)
      } else if (event.key === 'Tab') {
        const focusable = [...(dropdownRef.current?.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]',
        ) || [])].filter(element => element.getClientRects().length)
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (!first) {
          event.preventDefault()
          dropdownRef.current?.focus()
        } else if (!dropdownRef.current?.contains(document.activeElement)) {
          event.preventDefault()
          ;(event.shiftKey ? last : first).focus()
        } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dropdownRef.current)) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      bell?.focus()
    }
  }, [showDropdown])

  const handleBellClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setShowDropdown(current => !current)
  }

  const invalidatePendingReads = () => {
    revisionRef.current += 1
    unreadAbortRef.current?.abort()
    notificationListAbortRef.current?.abort()
    notificationListAbortRef.current = null
    setLoading(false)
  }

  const restoreDrawerFocus = () => requestAnimationFrame(() => {
    if (openRef.current && !dropdownRef.current?.contains(document.activeElement)) {
      dropdownRef.current?.focus()
    }
  })

  const mutateNotification = async (notificationId, operation) => {
    const notification = notificationsRef.current.find(item => item.id === notificationId)
    if (!notification || busyRef.current.has(notificationId) || bulkBusyRef.current) return
    if (operation === 'read' && notification.is_read) return
    const session = sessionRef.current
    busyRef.current.add(notificationId)
    setBusyIds([...busyRef.current])
    setErrorMessage('')
    invalidatePendingReads()
    try {
      if (operation === 'read') await notificationService.markAsRead(notificationId)
      else await notificationService.deleteNotification(notificationId)
      if (session !== sessionRef.current) return
      setNotifications(items => operation === 'read'
        ? items.map(item => item.id === notificationId ? { ...item, is_read: true } : item)
        : items.filter(item => item.id !== notificationId))
      if (!notification.is_read) updateCount((lastUnreadCountRef.current || 0) - 1)
    } catch (error) {
      if (session === sessionRef.current) {
        setErrorMessage(notificationError(error, operation === 'read' ? 'mark this notification as read' : 'delete this notification'))
      }
    } finally {
      if (session === sessionRef.current) {
        busyRef.current.delete(notificationId)
        setBusyIds([...busyRef.current])
        restoreDrawerFocus()
        void fetchUnreadCount()
      }
    }
  }

  const handleMarkAsRead = (notificationId) => mutateNotification(notificationId, 'read')
  const handleDelete = (notificationId) => mutateNotification(notificationId, 'delete')

  const handleMarkAllAsRead = async () => {
    if (bulkBusyRef.current || busyRef.current.size) return
    const session = sessionRef.current
    bulkBusyRef.current = true
    setBulkBusy(true)
    setErrorMessage('')
    invalidatePendingReads()
    try {
      await notificationService.markAllAsRead()
      if (session !== sessionRef.current) return
      setNotifications(items => items.map(item => ({ ...item, is_read: true })))
      updateCount(0)
    } catch (error) {
      if (session === sessionRef.current) setErrorMessage(notificationError(error, 'mark all notifications as read'))
    } finally {
      if (session === sessionRef.current) {
        bulkBusyRef.current = false
        setBulkBusy(false)
        restoreDrawerFocus()
        void fetchUnreadCount()
      }
    }
  }

  const handleRefresh = () => {
    setErrorMessage('')
    void fetchNotifications()
    void fetchUnreadCount()
  }

  const handleToggleSound = () => {
    const enabled = notificationAlertService.setSoundEnabled(!soundEnabled)
    setSoundEnabled(enabled)
    if (enabled) notificationAlertService.play()
  }

  const handleTogglePush = async () => {
    setPushState((previous) => ({ ...previous, busy: true, error: '' }))
    try {
      const enabled = pushState.enabled
        ? await pushNotificationService.disable()
        : await pushNotificationService.enable()
      setPushState((previous) => ({ ...previous, enabled, busy: false, error: '' }))
    } catch (error) {
      setPushState((previous) => ({ ...previous, busy: false, error: error.message }))
    }
  }

  const handleOffboardingDecision = async (notification, decision) => {
    const offboardingId = notification.metadata?.offboarding_id
    if (!offboardingId || !canDecideOffboardingNotification(notification) || decisionLoadingId) return
    const session = sessionRef.current

    let note = ''
    if (decision === 'rejected') {
      note = (await radaiPrompt('Enter the reason for rejecting this exit process:'))
      if (note === null) return
      if (!note.trim()) {
        setDecisionMessage('A rejection reason is required.')
        return
      }
    } else if (!(await radaiConfirm('Approve this employee exit process?'))) {
      return
    }

    if (session !== sessionRef.current) return
    setDecisionLoadingId(notification.id)
    setDecisionMessage('')
    try {
      const current = await notificationService.getOffboardingReview(offboardingId)
      if (session !== sessionRef.current) return
      if (current.can_project_manager_decide !== true) {
        setNotifications(prev => prev.map(item => item.id === notification.id
          ? { ...item, metadata: { ...item.metadata, requires_action: false } } : item))
        setDecisionMessage('This exit approval is no longer available to you at the current stage.')
        return
      }
      const result = await notificationService.decideOffboarding(offboardingId, decision, note.trim())
      if (session !== sessionRef.current) return
      invalidatePendingReads()
      setNotifications(prev => prev.map(item => (
        item.metadata?.offboarding_id === offboardingId &&
        item.metadata?.action_type === 'offboarding_project_manager_decision'
          ? {
              ...item,
              is_read: true,
              metadata: { ...item.metadata, decision_status: result.decision, requires_action: false },
            }
          : item
      )))
      setDecisionMessage(`Exit process ${result.decision} successfully.`)
      await fetchUnreadCount()
    } catch (error) {
      if (session !== sessionRef.current) return
      setDecisionMessage(
        error.response?.data?.detail ||
        error.response?.data?.decision ||
        'Unable to record the Project Manager decision.'
      )
      setNotifications(prev => prev.map(item => item.id === notification.id
        ? { ...item, metadata: { ...item.metadata, requires_action: false } } : item))
    } finally {
      if (session === sessionRef.current) setDecisionLoadingId(null)
    }
  }

  return (
    <div className="relative z-50">
      <button
        ref={bellRef}
        onClick={handleBellClick}
        type="button"
        className="relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
        aria-label="Notifications"
        aria-expanded={showDropdown}
        aria-haspopup="dialog"
        aria-controls={showDropdown ? 'notification-drawer' : undefined}
        style={{ pointerEvents: 'auto' }}
      >
        {unreadCount > 0 ? (
          <BellAlertIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        ) : (
          <BellIcon className="h-5 w-5" />
        )}
        
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-4 text-white shadow-sm ring-2 ring-white dark:ring-gray-800">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && createPortal(
        <>
        <div className="notification-drawer-backdrop" aria-hidden="true" onClick={() => setShowDropdown(false)} />
        <NotificationDropdown
          ref={dropdownRef}
          notifications={notifications}
          loading={loading}
          unreadCount={unreadCount}
          onMarkAsRead={handleMarkAsRead}
          onMarkAllAsRead={handleMarkAllAsRead}
          onDelete={handleDelete}
          onRefresh={handleRefresh}
          onClose={() => setShowDropdown(false)}
          onNavigate={() => setShowDropdown(false)}
          busyIds={busyIds}
          bulkBusy={bulkBusy}
          errorMessage={errorMessage}
          hasMore={hasMore}
          onOffboardingDecision={handleOffboardingDecision}
          decisionLoadingId={decisionLoadingId}
          decisionMessage={decisionMessage}
          soundEnabled={soundEnabled}
          onToggleSound={handleToggleSound}
          pushState={pushState}
          onTogglePush={handleTogglePush}
        />
        </>,
        document.body,
      )}
    </div>
  )
}

export default NotificationBell
