import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSelector } from 'react-redux'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  BellAlertIcon,
  BellIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ClockIcon,
  CpuChipIcon,
  DocumentTextIcon,
  EnvelopeOpenIcon,
  EnvelopeIcon,
  EllipsisHorizontalIcon,
  ExclamationTriangleIcon,
  FolderIcon,
  FlagIcon,
  FunnelIcon,
  InboxIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  TrashIcon,
  UserIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
  XCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import notificationService from '../services/notification.service'
import apiClient from '../services/api.service'
import { resolveNotificationTarget } from '../utils/notificationNavigation'
import { loadNotificationInbox } from '../utils/notificationInbox'
import { notificationCategory, notificationPriority, isApprovalNotification, isUrgentNotification, notificationSourceKey, notificationDateGroup, notificationTimeLabel } from '../utils/notificationCenter'
import NotificationPurchaseOrderPreview from '../components/notifications/NotificationPurchaseOrderPreview'
import PurchaseRequisitionDocumentPreview from './Procurement/PurchaseRequisitionDocumentPreview'
import { canDecideProcurement } from '../utils/procurementApproval'
import '../components/notifications/NotificationRecordPreview.css'
import './NotificationPanel.css'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'urgent', label: 'Urgent' },
  { id: 'approvals', label: 'Approvals' },
]

const PAGE_SIZE = 10
const EMPTY_NOTIFICATIONS = []

const requestErrorMessage = (error) => {
  if (error?.notificationMessage) return error.notificationMessage
  const status = error?.response?.status || error?.originalError?.response?.status
  if (error?.isTimeout || error?.code === 'ECONNABORTED' || /timeout/i.test(error?.message || '')) {
    return 'Notification refresh timed out. The existing inbox remains available; select Retry when the server is less busy.'
  }
  if (status === 401) return 'Your session has expired. Sign in again to refresh notifications.'
  if (status === 403) return 'You do not have permission to refresh this notification inbox.'
  if (status >= 500) return 'The notification service returned a server error. The existing inbox remains available.'
  if (error?.isNetworkError || !error?.response) {
    return 'The notification service could not be reached. Check the connection and select Retry.'
  }
  return error?.response?.data?.detail || 'Notifications could not be refreshed. The existing inbox remains available.'
}

const PRIORITY_STYLES = {
  CRITICAL: {
    card: 'border-rose-200 border-l-rose-600 bg-rose-50/50',
    badge: 'bg-rose-100 text-rose-700 ring-rose-200',
    dot: 'bg-rose-500',
    listRow: 'bg-rose-50/70 hover:bg-rose-100/70',
    listBorder: 'border-l-rose-600',
    label: 'Critical',
  },
  URGENT: {
    card: 'border-red-200 border-l-red-500 bg-red-50/40',
    badge: 'bg-red-100 text-red-700 ring-red-200',
    dot: 'bg-red-500',
    listRow: 'bg-red-50/60 hover:bg-red-100/70',
    listBorder: 'border-l-red-500',
    label: 'Urgent',
  },
  HIGH: {
    card: 'border-amber-200 border-l-amber-500 bg-amber-50/40',
    badge: 'bg-amber-100 text-amber-700 ring-amber-200',
    dot: 'bg-amber-500',
    listRow: 'bg-amber-50/60 hover:bg-amber-100/70',
    listBorder: 'border-l-amber-500',
    label: 'High',
  },
  MEDIUM: {
    card: 'border-blue-200 border-l-blue-500 bg-blue-50/30',
    badge: 'bg-blue-100 text-blue-700 ring-blue-200',
    dot: 'bg-blue-500',
    listRow: 'bg-blue-50/50 hover:bg-blue-100/60',
    listBorder: 'border-l-blue-500',
    label: 'Medium',
  },
  NORMAL: {
    card: 'border-slate-200 border-l-indigo-400 bg-white',
    badge: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
    dot: 'bg-indigo-500',
    listRow: 'bg-white hover:bg-indigo-50/60',
    listBorder: 'border-l-indigo-400',
    label: 'Normal',
  },
  LOW: {
    card: 'border-slate-200 border-l-slate-300 bg-white',
    badge: 'bg-slate-100 text-slate-600 ring-slate-200',
    dot: 'bg-slate-400',
    listRow: 'bg-slate-50/60 hover:bg-slate-100',
    listBorder: 'border-l-slate-300',
    label: 'Low',
  },
}

const CATEGORY_ICONS = {
  SYSTEM: WrenchScrewdriverIcon,
  PROJECT: FolderIcon,
  QHSE: ShieldCheckIcon,
  DOCUMENT: DocumentTextIcon,
  USER: UserIcon,
  ADMIN: WrenchScrewdriverIcon,
  AI: CpuChipIcon,
  APPROVAL: DocumentTextIcon,
  ALERT: ExclamationTriangleIcon,
  INFO: DocumentTextIcon,
  PROCUREMENT: DocumentTextIcon,
}

const categoryName = notificationCategory

const NotificationPanel = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isAuthenticated, user } = useSelector((state) => state.auth)
  const notificationUserId = user?.user?.id ?? user?.id
  const [inboxNotifications, setNotifications] = useState([])
  const [loadedInboxContext, setLoadedInboxContext] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [sortOrder, setSortOrder] = useState('newest')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [detailsClosed, setDetailsClosed] = useState(false)
  const [menuId, setMenuId] = useState(null)
  const [menuUpwards, setMenuUpwards] = useState(false)
  const [relatedOpen, setRelatedOpen] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [recordPreview, setRecordPreview] = useState({ loading: false, data: null, error: '' })
  const [previewDecision, setPreviewDecision] = useState({ loading: false, mode: null, reason: '', message: '', error: '' })
  const refreshAbortRef = useRef(null)
  const hasLoadedInboxRef = useRef(false)
  const actionPendingRef = useRef(false)
  const accountKey = `${Boolean(isAuthenticated)}:${notificationUserId ?? ''}`
  const accountGenerationRef = useRef({ key: accountKey, generation: 0 })
  if (accountGenerationRef.current.key !== accountKey) {
    accountGenerationRef.current = { key: accountKey, generation: accountGenerationRef.current.generation + 1 }
  }
  const inboxContextRef = useRef('')
  inboxContextRef.current = `${accountKey}:${accountGenerationRef.current.generation}`
  const notifications = loadedInboxContext === inboxContextRef.current ? inboxNotifications : EMPTY_NOTIFICATIONS
  const rowButtonRefs = useRef(new Map())
  const previewDialogRef = useRef(null)
  const previewDecisionPendingRef = useRef(false)
  previewDecisionPendingRef.current = previewDecision.loading

  const previewType = searchParams.get('preview')
  const previewId = searchParams.get('id')
  const previewContextRef = useRef('')
  previewContextRef.current = `${previewType}:${previewId}:${inboxContextRef.current}`
  const canDecidePreview = canDecideProcurement(recordPreview.data, user, previewType)
  const previewNeedsReload = previewType === 'pr' && (previewDecision.stale || (recordPreview.data && !recordPreview.data.updated_at))

  const fetchNotifications = useCallback(async ({ quiet = false } = {}) => {
    if (actionPendingRef.current) return
    if (refreshAbortRef.current) refreshAbortRef.current.abort()
    const context = inboxContextRef.current
    const controller = new AbortController()
    refreshAbortRef.current = controller
    if (!quiet) setLoading(true)
    try {
      const [listResult, statsResult] = await Promise.allSettled([
        loadNotificationInbox(page => notificationService.getNotifications(
          { ordering: '-created_at', page_size: 100, ...(page > 1 ? { page } : {}) },
          { signal: controller.signal },
        ), { signal: controller.signal }),
        notificationService.getStats({ signal: controller.signal }),
      ])

      if (controller.signal.aborted || inboxContextRef.current !== context) return

      if (listResult.status === 'rejected') {
        console.error('[NotificationPanel] Inbox refresh failed:', listResult.reason)
        if (!quiet || !hasLoadedInboxRef.current) {
          setError(requestErrorMessage(listResult.reason))
        }
        return
      }

      setNotifications(listResult.value)
      setLoadedInboxContext(context)
      hasLoadedInboxRef.current = true
      setError('')

      if (statsResult.status === 'rejected') console.warn('[NotificationPanel] Supplementary statistics unavailable:', statsResult.reason)
    } catch (requestError) {
      if (!controller.signal.aborted && inboxContextRef.current === context && (!quiet || !hasLoadedInboxRef.current)) setError(requestErrorMessage(requestError))
    } finally {
      if (refreshAbortRef.current === controller) {
        refreshAbortRef.current = null
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    setNotifications([])
    setLoadedInboxContext(null)
    setSelectedId(null)
    setDetailsClosed(false)
    setError('')
    setMenuId(null)
    setBusyId(null)
    setBulkLoading(false)
    setCurrentPage(1)
    hasLoadedInboxRef.current = false
    actionPendingRef.current = false
    if (!isAuthenticated) return undefined
    fetchNotifications()
    const interval = setInterval(() => fetchNotifications({ quiet: true }), 60000)
    return () => {
      clearInterval(interval)
      refreshAbortRef.current?.abort()
    }
  }, [fetchNotifications, isAuthenticated, notificationUserId])

  useEffect(() => {
    if (!isAuthenticated || !['po', 'pr'].includes(previewType) || !previewId) {
      setRecordPreview({ loading: false, data: null, error: '' })
      setPreviewDecision({ loading: false, mode: null, reason: '', message: '', error: '' })
      return undefined
    }

    let cancelled = false
    const fetchRecordPreview = async () => {
      setRecordPreview({ loading: true, data: null, error: '' })
      setPreviewDecision({ loading: false, mode: null, reason: '', message: '', error: '' })
      try {
        const endpoint = previewType === 'po'
          ? `/procurement/orders/${previewId}/`
          : `/procurement/requisitions/${previewId}/`
        const response = await apiClient.get(endpoint, { params: { _fresh: Date.now() } })
        if (!cancelled) setRecordPreview({ loading: false, data: response.data, error: '' })
      } catch (requestError) {
        console.error('[NotificationPanel] Failed to load record preview:', requestError)
        if (!cancelled) {
          setRecordPreview({
            loading: false,
            data: null,
            error: requestError.response?.data?.detail || `The ${previewType === 'po' ? 'Purchase Order' : 'Purchase Recommendation'} preview could not be loaded.`,
          })
        }
      }
    }

    fetchRecordPreview()
    return () => { cancelled = true }
  }, [previewId, previewType, isAuthenticated, notificationUserId])

  const closeRecordPreview = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('preview')
    nextParams.delete('id')
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  const reloadRecordPreview = async () => {
    if (previewDecision.loading || previewDecision.reloading || previewType !== 'pr') return
    const context = previewContextRef.current
    setPreviewDecision(current => ({ ...current, reloading: true, error: '' }))
    try {
      const { data } = await apiClient.get(`/procurement/requisitions/${previewId}/`, { params: { _fresh: Date.now() }, suppressErrorToast: true })
      if (previewContextRef.current !== context) return
      if (String(data?.id) !== String(previewId) || !data.updated_at) throw new Error('The current recommendation version could not be confirmed. Please retry.')
      setRecordPreview({ loading: false, data, error: '' })
      setPreviewDecision(current => ({ ...current, stale: false, reloading: false, error: '', message: '' }))
    } catch (error) {
      if (previewContextRef.current === context) setPreviewDecision(current => ({ ...current, reloading: false, stale: true, error: error.response?.data?.detail || error.message || 'The latest recommendation could not be loaded.' }))
    }
  }

  const handlePreviewDecision = async (decision) => {
    if (!canDecidePreview || previewDecision.loading || previewDecision.reloading || previewNeedsReload || !recordPreview.data || !['approve', 'reject'].includes(decision)) return

    const reason = previewDecision.reason.trim()
    if (decision === 'reject' && reason.length < 10) {
      setPreviewDecision((current) => ({ ...current, error: 'Please provide a rejection reason of at least 10 characters.', message: '' }))
      return
    }

    const context = previewContextRef.current
    setPreviewDecision((current) => ({ ...current, loading: true, error: '', message: '' }))
    try {
      const isPurchaseOrder = previewType === 'po'
      const endpoint = isPurchaseOrder
        ? `/procurement/orders/${previewId}/${decision}/`
        : `/procurement/requisitions/${previewId}/${decision === 'approve' ? 'process_dynamic_approval' : 'process_dynamic_rejection'}/`
      const payload = isPurchaseOrder
        ? {
            approval_stage: recordPreview.data.current_approval?.stage || recordPreview.data.approval_stage,
            note: reason,
            reason,
          }
        : decision === 'approve'
          ? { signature: '', expected_updated_at: recordPreview.data.updated_at }
          : { reason, expected_updated_at: recordPreview.data.updated_at }

      const response = await apiClient.post(endpoint, payload)
      if (previewContextRef.current !== context) return
      const updatedRecord = response.data?.purchase_order || response.data?.requisition || response.data
      if (updatedRecord && typeof updatedRecord === 'object') {
        setRecordPreview((current) => ({ ...current, data: { ...current.data, ...updatedRecord } }))
      }
      setPreviewDecision({
        loading: false,
        mode: null,
        reason: '',
        message: `${previewType === 'po' ? 'Purchase Order' : 'Purchase Recommendation'} ${decision === 'approve' ? 'approved' : 'rejected'} successfully.`,
        error: '',
      })
      window.dispatchEvent(new Event('procurement-approval-updated'))
      void fetchNotifications({ quiet: true })
    } catch (requestError) {
      if (previewContextRef.current !== context) return
      setPreviewDecision((current) => ({
        ...current,
        loading: false,
        stale: previewType === 'pr' && requestError.response?.status === 409,
        error: requestError.response?.data?.detail || requestError.response?.data?.error || `Unable to ${decision} this request.`,
        message: '',
      }))
    }
  }

  useEffect(() => {
    if (!['po', 'pr'].includes(previewType) || !previewId) return undefined
    const dialog = previewDialogRef.current
    if (!dialog) return undefined
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const controls = () => [...dialog.querySelectorAll(
      'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]',
    )].filter(element => element.getClientRects().length)
    const focusStart = () => (dialog.querySelector('button[aria-label="Close preview"]:not([disabled])') || controls()[0] || dialog).focus({ preventScroll: true })
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !previewDecisionPendingRef.current) {
        event.preventDefault()
        closeRecordPreview()
      } else if (event.key === 'Tab') {
        const available = controls()
        const first = available[0], last = available.at(-1)
        if (!first) { event.preventDefault(); dialog.focus(); return }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
          event.preventDefault(); last.focus()
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
          event.preventDefault(); first.focus()
        }
      }
    }
    const containFocus = event => {
      if (!dialog.contains(event.target)) focusStart()
    }
    focusStart()
    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('focusin', containFocus)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('focusin', containFocus)
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [closeRecordPreview, previewId, previewType])

  const filteredNotifications = useMemo(() => {
    const query = search.trim().toLowerCase()
    return notifications.filter((notification) => {
      const priority = notificationPriority(notification)
      if (filter === 'unread' && notification.is_read) return false
      if (filter === 'urgent' && !isUrgentNotification(notification)) return false
      if (filter === 'approvals' && !isApprovalNotification(notification)) return false
      if (category !== 'all' && categoryName(notification) !== category) return false
      if (priorityFilter !== 'all' && priority !== priorityFilter) return false
      return !query || [notification.title, notification.message, categoryName(notification), priority]
        .some(value => String(value || '').toLowerCase().includes(query))
    }).sort((a, b) => {
      const first = new Date(a.created_at).getTime() || 0
      const second = new Date(b.created_at).getTime() || 0
      return sortOrder === 'oldest' ? first - second : second - first
    })
  }, [filter, notifications, search, category, priorityFilter, sortOrder])

  const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / PAGE_SIZE))
  const activePage = Math.min(currentPage, totalPages)
  const paginatedNotifications = useMemo(() => {
    const start = (activePage - 1) * PAGE_SIZE
    return filteredNotifications.slice(start, start + PAGE_SIZE)
  }, [activePage, filteredNotifications])
  const visiblePages = useMemo(() => {
    const start = Math.max(1, Math.min(activePage - 2, totalPages - 4))
    const end = Math.min(totalPages, start + 4)
    return Array.from({ length: end - start + 1 }, (_, index) => start + index)
  }, [activePage, totalPages])
  const categories = useMemo(() => [...new Set(notifications.map(categoryName))].sort(), [notifications])
  const selectedNotification = detailsClosed ? null : paginatedNotifications.find(item => item.id === selectedId) || paginatedNotifications[0] || null
  const selectedTarget = selectedNotification && resolveNotificationTarget(selectedNotification)
  const SelectedIcon = CATEGORY_ICONS[selectedNotification && categoryName(selectedNotification)] || DocumentTextIcon
  const sourceKey = selectedNotification && notificationSourceKey(selectedNotification)
  const relatedNotifications = useMemo(() => sourceKey ? notifications.filter(item => item.id !== selectedNotification?.id && notificationSourceKey(item) === sourceKey) : [], [notifications, sourceKey, selectedNotification?.id])
  const actionBusy = busyId !== null || bulkLoading
  const selectedBusy = selectedNotification && busyId === selectedNotification.id
  const hasFilters = filter !== 'all' || search || category !== 'all' || priorityFilter !== 'all'

  useEffect(() => { setCurrentPage(1); setMenuId(null) }, [filter, search, category, priorityFilter, sortOrder])
  useEffect(() => { setCurrentPage(page => Math.min(page, totalPages)); setMenuId(null) }, [totalPages, currentPage])
  useEffect(() => {
    if (menuId === null) return undefined
    const closeMenu = event => {
      if (event.type === 'keydown' && event.key !== 'Escape') return
      if (event.type !== 'keydown' && event.target.closest('.notification-center__row-actions')) return
      setMenuId(null)
      if (event.type === 'keydown') rowButtonRefs.current.get(menuId)?.focus()
    }
    document.addEventListener('pointerdown', closeMenu)
    document.addEventListener('keydown', closeMenu)
    return () => {
      document.removeEventListener('pointerdown', closeMenu)
      document.removeEventListener('keydown', closeMenu)
    }
  }, [menuId])

  const unreadCount = notifications.filter(item => !item.is_read).length
  const urgentCount = notifications.filter(isUrgentNotification).length
  const approvalCount = notifications.filter(isApprovalNotification).length
  const countsReady = hasLoadedInboxRef.current && loadedInboxContext === inboxContextRef.current
  const resetFilters = () => { setFilter('all'); setSearch(''); setCategory('all'); setPriorityFilter('all') }
  const selectNotification = notification => { setSelectedId(notification.id); setDetailsClosed(false); setMenuId(null) }
  const selectRelated = notification => {
    resetFilters()
    const sorted = [...notifications].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    setSortOrder('newest')
    selectNotification(notification)
    // Selection can refer to a later page in the unfiltered inbox.
    setTimeout(() => setCurrentPage(Math.floor(sorted.findIndex(item => item.id === notification.id) / PAGE_SIZE) + 1), 0)
  }
  const closeDetails = () => {
    setDetailsClosed(true)
    if (selectedNotification) rowButtonRefs.current.get(selectedNotification.id)?.focus()
  }

  const runNotificationAction = async (id, action, onSuccess, failureMessage) => {
    if (actionPendingRef.current || !isAuthenticated) return
    const context = inboxContextRef.current
    actionPendingRef.current = true
    refreshAbortRef.current?.abort()
    setBusyId(id)
    setError('')
    setMenuId(null)
    try {
      await action()
      if (inboxContextRef.current !== context) return
      onSuccess()
      window.dispatchEvent(new Event('notifications-updated'))
    } catch (requestError) {
      if (inboxContextRef.current === context) setError(requestError.response?.data?.detail || failureMessage)
    } finally {
      if (inboxContextRef.current === context) {
        actionPendingRef.current = false
        setBusyId(null)
        setBulkLoading(false)
      }
    }
  }

  const handleMarkAsRead = async id => {
    if (id === null || id === undefined || !notifications.some(item => item.id === id && !item.is_read)) return
    await runNotificationAction(id, () => notificationService.markAsRead(id), () => {
      setNotifications(current => current.map(item => item.id === id ? { ...item, is_read: true } : item))
    }, 'The notification could not be marked as read. Please retry.')
  }

  const handleMarkAllAsRead = async () => {
    if (actionPendingRef.current) return
    setBulkLoading(true)
    await runNotificationAction('all', () => notificationService.markAllAsRead(), () => {
      setNotifications(current => current.map(item => ({ ...item, is_read: true })))
    }, 'Notifications could not be marked as read. Please retry.')
  }

  const handleDelete = async id => {
    if (id === null || id === undefined) return
    await runNotificationAction(id, () => notificationService.deleteNotification(id), () => {
      setNotifications(current => current.filter(item => item.id !== id))
    }, 'The notification could not be dismissed. Please retry.')
  }

  const openNotification = notification => {
    const target = resolveNotificationTarget(notification)
    if (!target) return
    if (!notification.is_read) void handleMarkAsRead(notification.id)
    if (target.isExternal) window.location.assign(target.href)
    else navigate(target.href, { state: { fromNotificationId: notification.id } })
  }

  const openLabel = notification => {
    const target = resolveNotificationTarget(notification)
    if (target?.href.includes('preview=po')) return 'Open purchase order'
    if (target?.href.includes('preview=pr')) return 'Open purchase recommendation'
    return notification.action_label || 'Open notification'
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-slate-50 px-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <BellAlertIcon className="mx-auto h-10 w-10 text-slate-400" />
          <p className="mt-3 font-semibold text-slate-700">Please sign in to view notifications.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="notification-center">
      <section className="notification-center__overview" aria-labelledby="notification-center-title">
        <div className="notification-center__heading-row">
          <div>
            <h1 id="notification-center-title">Notification Center</h1>
            <p>Review updates, approvals and items requiring your attention.</p>
          </div>
          <div className="notification-center__header-actions">
            <div className="notification-center__search">
              <MagnifyingGlassIcon aria-hidden="true" />
              <input type="search" aria-label="Search notifications" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search notifications..." />
              {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search"><XMarkIcon /></button>}
            </div>
            <button type="button" className={`notification-center__button${filtersOpen ? ' is-active' : ''}`} aria-expanded={filtersOpen} aria-controls="notification-center-filters" onClick={() => setFiltersOpen(current => !current)}><FunnelIcon />Filters{priorityFilter !== 'all' && <span className="notification-center__filter-dot" />}</button>
            <button type="button" className="notification-center__button notification-center__button--link" disabled={actionBusy || !unreadCount || loading} onClick={handleMarkAllAsRead}><EnvelopeIcon />{bulkLoading ? 'Updating...' : 'Mark all as read'}</button>
          </div>
        </div>
        <div className="notification-center__metrics">
          {[
            { id: 'all', label: 'All', accessible: 'All notifications', value: notifications.length, icon: BellIcon, tone: 'blue' },
            { id: 'unread', label: 'Unread', accessible: 'Unread notifications', value: unreadCount, icon: EnvelopeIcon, tone: 'purple' },
            { id: 'urgent', label: 'Urgent & critical', accessible: 'Urgent notifications', value: urgentCount, icon: ExclamationTriangleIcon, tone: 'red' },
            { id: 'approvals', label: 'Approvals', accessible: 'Approval notifications', value: approvalCount, icon: UsersIcon, tone: 'amber' },
          ].map(metric => <button type="button" key={metric.id} aria-label={`${metric.accessible}: ${countsReady ? metric.value : 'unavailable'}`} aria-pressed={filter === metric.id} title={metric.id === 'urgent' ? 'High, urgent and critical priority notifications' : undefined} onClick={() => setFilter(metric.id)} className={`notification-center__metric notification-center__metric--${metric.tone}${filter === metric.id ? ' is-selected' : ''}`}>
            <span className="notification-center__metric-icon"><metric.icon aria-hidden="true" /></span>
            <span><span className="notification-center__metric-label metric-label">{metric.label}</span><strong className="metric-value">{countsReady ? metric.value : '—'}</strong></span>
          </button>)}
        </div>
        {filtersOpen && <div id="notification-center-filters" className="notification-center__expanded-filters">
          <label>Priority<select aria-label="Priority" value={priorityFilter} onChange={event => setPriorityFilter(event.target.value)}><option value="all">All priorities</option>{['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL'].map(priority => <option key={priority} value={priority}>{PRIORITY_STYLES[priority].label}</option>)}</select></label>
          <button type="button" className="notification-center__button" onClick={resetFilters} disabled={!hasFilters}>Clear filters</button>
          <button type="button" className="notification-center__button" onClick={() => fetchNotifications()} disabled={loading || actionBusy}><ArrowPathIcon className={loading ? 'notification-center__spin' : ''} />Refresh</button>
        </div>}
      </section>

      {error && <div className="notification-center__error" role="alert"><ExclamationTriangleIcon /><span>{error}</span><button type="button" onClick={() => fetchNotifications()} disabled={loading || actionBusy}>{loading ? 'Retrying...' : 'Retry'}</button><button type="button" aria-label="Dismiss error" onClick={() => setError('')}><XMarkIcon /></button></div>}

      <div className={`notification-center__workspace${selectedNotification ? '' : ' notification-center__workspace--no-details'}`}>
        <section className="notification-center__inbox" aria-label="Notifications" aria-busy={loading}>
          <div className="notification-center__list-toolbar">
            <div className="notification-center__tabs" aria-label="Notification views" role="group">
              {FILTERS.map(option => <button type="button" key={option.id} aria-pressed={filter === option.id} onClick={() => setFilter(option.id)} className={filter === option.id ? 'is-active' : ''}>{option.label}</button>)}
            </div>
            <div className="notification-center__list-selects">
              <span className="notification-center__select"><select aria-label="Category" value={category} onChange={event => setCategory(event.target.value)}><option value="all">Category</option>{categories.map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select><ChevronDownIcon /></span>
              <span className="notification-center__select"><select aria-label="Sort notifications" value={sortOrder} onChange={event => setSortOrder(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select><ChevronDownIcon /></span>
            </div>
          </div>
          <div className="notification-center__list-body">
            {loading && !notifications.length ? <div className="notification-center__loading" role="status"><ArrowPathIcon className="notification-center__spin" /><span>Loading notifications...</span>{[1, 2, 3, 4, 5, 6].map(item => <div key={item} className="notification-center__skeleton" />)}</div>
              : !paginatedNotifications.length ? <div className="notification-center__empty"><InboxIcon /><h2>{hasFilters ? 'No matching notifications' : error ? 'Notifications unavailable' : 'You are all caught up'}</h2><p>{hasFilters ? 'Try another search or clear your filters.' : error ? 'Retry to load your notifications.' : 'New updates will appear here.'}</p>{hasFilters && <button type="button" className="notification-center__button" onClick={resetFilters}>Clear filters</button>}</div>
                : paginatedNotifications.map((notification, index) => {
                  const priority = notificationPriority(notification)
                  const category = categoryName(notification)
                  const CategoryIcon = CATEGORY_ICONS[category] || DocumentTextIcon
                  const group = notificationDateGroup(notification.created_at)
                  const showGroup = index === 0 || notificationDateGroup(paginatedNotifications[index - 1].created_at) !== group
                  const selected = selectedNotification?.id === notification.id
                  return <React.Fragment key={notification.id}>
                    {showGroup && <h2 className="notification-center__date-group">{group}</h2>}
                    <article className={`notification-center__row${selected ? ' is-selected' : ''}${notification.is_read ? '' : ' is-unread'}`}>
                      <button type="button" ref={element => { if (element) rowButtonRefs.current.set(notification.id, element); else rowButtonRefs.current.delete(notification.id) }} className="notification-center__row-main" aria-label={`View notification: ${notification.title}`} aria-pressed={selected} onClick={() => selectNotification(notification)}>
                        <span className="notification-center__row-icon"><CategoryIcon aria-hidden="true" /></span>
                        <span className={`notification-center__unread-dot${notification.is_read ? ' is-read' : ''}${['HIGH', 'URGENT', 'CRITICAL'].includes(priority) ? ' is-urgent' : ''}`} title={notification.is_read ? 'Read' : 'Unread'} />
                        <span className="notification-center__row-copy"><strong title={notification.title}>{notification.title}</strong><span title={notification.message}>{notification.message}</span></span>
                        <span className="notification-center__row-category"><span className={`notification-center__category${category === 'APPROVAL' ? ' is-approval' : ''}`}>{category.replaceAll('_', ' ')}</span></span>
                        <span className="notification-center__row-priority"><span className={`notification-center__priority notification-center__priority--${priority.toLowerCase()}`}>{PRIORITY_STYLES[priority]?.label || priority}</span></span>
                        <time className="notification-center__row-time" dateTime={notification.created_at} title={notification.created_at && new Date(notification.created_at).toLocaleString()}>{notificationTimeLabel(notification)}</time>
                        <span className="notification-center__sr-only">{notification.is_read ? 'Read' : 'Unread'}</span>
                      </button>
                      <div className="notification-center__row-actions">
                        <button type="button" aria-label={`Actions for ${notification.title}`} aria-expanded={menuId === notification.id} aria-controls={`notification-actions-${notification.id}`} className="notification-center__more" onClick={event => {
                          const button = event.currentTarget
                          const listBounds = button.closest('.notification-center__list-body').getBoundingClientRect()
                          setMenuUpwards(listBounds.bottom - button.getBoundingClientRect().bottom < 140)
                          setMenuId(current => current === notification.id ? null : notification.id)
                        }}><EllipsisHorizontalIcon /></button>
                        {menuId === notification.id && <div id={`notification-actions-${notification.id}`} className={`notification-center__menu${menuUpwards ? ' opens-upwards' : ''}`}>
                          {resolveNotificationTarget(notification) && <button type="button" disabled={actionBusy} onClick={() => { setMenuId(null); openNotification(notification) }}><ArrowTopRightOnSquareIcon />{openLabel(notification)}</button>}
                          {!notification.is_read && <button type="button" disabled={actionBusy} onClick={() => handleMarkAsRead(notification.id)}><EnvelopeOpenIcon />Mark as read</button>}
                          <button type="button" disabled={actionBusy} onClick={() => handleDelete(notification.id)}><TrashIcon />Dismiss</button>
                        </div>}
                      </div>
                    </article>
                  </React.Fragment>
                })}
          </div>
          <footer className="notification-center__pagination">
            <p>Showing <strong>{filteredNotifications.length ? `${(activePage - 1) * PAGE_SIZE + 1}–${Math.min(activePage * PAGE_SIZE, filteredNotifications.length)}` : '0'}</strong> of <strong>{filteredNotifications.length}</strong></p>
            <nav aria-label="Notification pagination"><button type="button" disabled={activePage === 1} onClick={() => setCurrentPage(page => Math.max(1, page - 1))}><ChevronLeftIcon />Previous</button>{visiblePages.map(page => <button type="button" key={page} aria-label={`Page ${page}`} aria-current={activePage === page ? 'page' : undefined} className={activePage === page ? 'is-active' : ''} onClick={() => setCurrentPage(page)}>{page}</button>)}<button type="button" disabled={activePage === totalPages} onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}>Next<ChevronRightIcon /></button></nav>
          </footer>
        </section>

        {selectedNotification && <aside className="notification-center__details" aria-labelledby="notification-details-heading">
          <header className="notification-center__details-heading"><h2 id="notification-details-heading">Notification details</h2><button type="button" onClick={closeDetails} aria-label="Close notification details"><XMarkIcon /></button></header>
          <div className="notification-center__details-scroll">
            <div className="notification-center__detail-identity"><span className="notification-center__detail-icon"><SelectedIcon /></span><div><h3>{selectedNotification.title}</h3><div className="notification-center__detail-badges"><span className={`notification-center__priority notification-center__priority--${notificationPriority(selectedNotification).toLowerCase()}`}>{PRIORITY_STYLES[notificationPriority(selectedNotification)]?.label || notificationPriority(selectedNotification)}</span><span className="notification-center__category">{categoryName(selectedNotification).replaceAll('_', ' ')}</span></div></div></div>
            <div className="notification-center__received"><ClockIcon /><div><span>Received</span><strong>{notificationTimeLabel(selectedNotification)}</strong></div></div>
            <section className="notification-center__detail-section"><h3>Description</h3><p className="notification-center__description">{selectedNotification.message || 'No description provided.'}</p></section>
            <section className="notification-center__detail-section"><h3>Details</h3><dl><div><dt><DocumentTextIcon />Category</dt><dd>{categoryName(selectedNotification).replaceAll('_', ' ')}</dd></div><div><dt><FlagIcon />Priority</dt><dd>{PRIORITY_STYLES[notificationPriority(selectedNotification)]?.label || notificationPriority(selectedNotification)}</dd></div><div><dt><ClockIcon />Received</dt><dd title={new Date(selectedNotification.created_at).toLocaleString()}>{notificationTimeLabel(selectedNotification)}</dd></div></dl></section>
            <section className="notification-center__detail-section notification-center__related"><button type="button" aria-expanded={relatedOpen} aria-controls="notification-related-updates" onClick={() => setRelatedOpen(current => !current)}><span>Related updates ({relatedNotifications.length})</span><ChevronDownIcon className={relatedOpen ? 'is-open' : ''} /></button>{relatedOpen && <div id="notification-related-updates">{relatedNotifications.length ? relatedNotifications.map(notification => <button type="button" className="notification-center__related-item" key={notification.id} onClick={() => selectRelated(notification)}><span><DocumentTextIcon /></span><span><strong>{notification.title}</strong><time dateTime={notification.created_at}>{notificationTimeLabel(notification)}</time></span></button>) : <p className="notification-center__related-empty">No related updates.</p>}</div>}</section>
          </div>
          <footer className="notification-center__detail-actions">
            {selectedTarget && <button type="button" className="notification-center__button notification-center__button--primary" disabled={actionBusy} onClick={() => openNotification(selectedNotification)}><ArrowTopRightOnSquareIcon />{openLabel(selectedNotification)}</button>}
            <button type="button" className="notification-center__button" disabled={actionBusy || selectedNotification.is_read} onClick={() => handleMarkAsRead(selectedNotification.id)}><EnvelopeIcon />{selectedBusy ? 'Updating...' : selectedNotification.is_read ? 'Read' : 'Mark as read'}</button>
            <button type="button" className="notification-center__button" disabled={actionBusy} onClick={() => handleDelete(selectedNotification.id)}><TrashIcon />Dismiss</button>
          </footer>
        </aside>}
      </div>

      {['po', 'pr'].includes(previewType) && previewId && createPortal(
        <div className="notification-record-preview-backdrop" role="presentation" onMouseDown={() => { if (!previewDecision.loading) closeRecordPreview() }}>
          <section
            ref={previewDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-record-preview-title"
            tabIndex={-1}
            className="notification-record-preview"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="notification-record-preview__header">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600">Notification preview</p>
                <h2 id="notification-record-preview-title" className="mt-1 text-lg font-black text-slate-950 sm:text-xl">
                  {previewType === 'po' ? 'Purchase Order' : 'Purchase Recommendation'} · {recordPreview.data?.po_number || recordPreview.data?.pr_number || previewId}
                </h2>
              </div>
              <button type="button" onClick={closeRecordPreview} disabled={previewDecision.loading} className="flex-none rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40" aria-label="Close preview">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </header>

            <div className="notification-record-preview__content" tabIndex={0} aria-label="Document preview pages">
              {recordPreview.loading ? (
                <div className="flex min-h-[420px] items-center justify-center">
                  <div className="text-center">
                    <ArrowPathIcon className="mx-auto h-9 w-9 animate-spin text-indigo-600" />
                    <p className="mt-3 text-sm font-semibold text-slate-600">Loading preview…</p>
                  </div>
                </div>
              ) : recordPreview.error ? (
                <div className="mx-auto mt-12 max-w-lg rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
                  <ExclamationTriangleIcon className="mx-auto h-9 w-9 text-rose-500" />
                  <p className="mt-3 text-sm font-bold text-rose-800">{recordPreview.error}</p>
                </div>
              ) : recordPreview.data && previewType === 'po' ? (
                <NotificationPurchaseOrderPreview
                  formData={recordPreview.data}
                  vendor={{
                    name: recordPreview.data.vendor_name,
                    address: recordPreview.data.vendor_address || recordPreview.data.seller_address,
                    country: recordPreview.data.vendor_country || recordPreview.data.country,
                  }}
                  prReference={{ id: recordPreview.data.pr_reference, pr_number: recordPreview.data.pr_number }}
                  files={(Array.isArray(recordPreview.data.attachments) ? recordPreview.data.attachments : []).map((file) => (
                    typeof file === 'string'
                      ? { name: file.split('/').pop() || file }
                      : { ...file, name: file.name || file.file_name || file.filename || 'Attachment' }
                  ))}
                />
              ) : recordPreview.data ? (
                <div className="notification-record-preview__requisition"><PurchaseRequisitionDocumentPreview requisition={recordPreview.data} /></div>
              ) : null}
            </div>

            {recordPreview.data && !recordPreview.loading && !recordPreview.error && (
              <footer className="notification-record-preview__footer">
                {canDecidePreview && previewDecision.mode === 'reject' && !previewDecision.message && (
                  <div className="mb-3">
                    <label htmlFor="notification-preview-rejection" className="mb-1.5 block text-xs font-semibold text-slate-700">Rejection reason</label>
                    <textarea
                      id="notification-preview-rejection"
                      value={previewDecision.reason}
                      onChange={(event) => setPreviewDecision((current) => ({ ...current, reason: event.target.value, error: '' }))}
                      rows={3}
                      maxLength={1000}
                      disabled={previewDecision.loading}
                      placeholder="Explain why this request is being rejected..."
                      className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#0f6cbd] focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">Minimum 10 characters · {previewDecision.reason.length}/1000</p>
                  </div>
                )}

                {previewDecision.error && (
                  <div role="alert" className="mb-3 flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                    <ExclamationTriangleIcon className="h-4 w-4 flex-none" />{previewDecision.error}
                  </div>
                )}
                {previewNeedsReload && <div className="mb-3 text-sm text-amber-900"><p>Reload and review the latest recommendation before recording a decision. Your rejection reason is retained.</p><button type="button" onClick={reloadRecordPreview} disabled={previewDecision.reloading} className="mt-2 font-semibold underline">{previewDecision.reloading ? 'Reloading...' : 'Reload latest version'}</button></div>}
                {previewDecision.message && (
                  <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                    <CheckCircleIcon className="h-4 w-4 flex-none" />{previewDecision.message}
                  </div>
                )}

                {canDecidePreview && !previewDecision.message && (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {previewDecision.mode === 'reject' && (
                      <button type="button" onClick={() => setPreviewDecision((current) => ({ ...current, mode: null, reason: '', error: '' }))} disabled={previewDecision.loading} className="h-9 rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40">Cancel</button>
                    )}
                    <button
                      type="button"
                      onClick={() => previewDecision.mode === 'reject' ? handlePreviewDecision('reject') : setPreviewDecision((current) => ({ ...current, mode: 'reject', message: '', error: '' }))}
                      disabled={previewDecision.loading || previewDecision.reloading || previewNeedsReload}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-rose-300 bg-white px-4 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-40"
                    >
                      <XCircleIcon className="h-4 w-4" />
                      {previewDecision.loading && previewDecision.mode === 'reject' ? 'Rejecting...' : previewDecision.mode === 'reject' ? 'Confirm rejection' : 'Reject'}
                    </button>
                    {previewDecision.mode !== 'reject' && (
                      <button type="button" onClick={() => handlePreviewDecision('approve')} disabled={previewDecision.loading || previewDecision.reloading || previewNeedsReload} className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-600 px-4 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40">
                        <CheckCircleIcon className="h-4 w-4" />{previewDecision.loading ? 'Approving...' : 'Approve'}
                      </button>
                    )}
                  </div>
                )}
              </footer>
            )}
          </section>
        </div>,
        document.body,
      )}
    </div>
  )
}

export default NotificationPanel
