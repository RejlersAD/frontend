import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowPathIcon,
  ArrowRightIcon,
  BellAlertIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CpuChipIcon,
  DocumentTextIcon,
  EnvelopeOpenIcon,
  ExclamationTriangleIcon,
  FolderIcon,
  InboxIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  TrashIcon,
  UserIcon,
  WrenchScrewdriverIcon,
  XCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import notificationService from '../services/notification.service'
import apiClient from '../services/api.service'
import { formatDistanceToNow } from '../utils/dateFormatter'
import { resolveNotificationTarget } from '../utils/notificationNavigation'
import PurchaseOrderLivePreview from './Procurement/PurchaseOrderLivePreview'
import PurchaseRequisitionDocumentPreview from './Procurement/PurchaseRequisitionDocumentPreview'

const FILTERS = [
  { id: 'all', label: 'All notifications' },
  { id: 'unread', label: 'Unread' },
  { id: 'urgent', label: 'Urgent & critical' },
]

const PAGE_SIZE = 10

const requestErrorMessage = (error) => {
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

const statsFromNotifications = (items) => ({
  total_count: items.length,
  unread_count: items.filter((item) => !item.is_read).length,
  read_count: items.filter((item) => item.is_read).length,
  by_priority: items.reduce((counts, item) => {
    const priority = String(item.priority || 'NORMAL').toUpperCase()
    counts[priority] = (counts[priority] || 0) + 1
    return counts
  }, {}),
})

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
  APPROVAL: CheckCircleIcon,
  ALERT: ExclamationTriangleIcon,
  INFO: InformationCircleIcon,
}

const categoryName = (notification) => (
  notification.category_detail?.name
  || notification.category_name
  || notification.category?.name
  || 'INFO'
)

const NotificationPanel = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isAuthenticated } = useSelector((state) => state.auth)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const viewMode = 'list'
  const [currentPage, setCurrentPage] = useState(1)
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [recordPreview, setRecordPreview] = useState({ loading: false, data: null, error: '' })
  const [previewDecision, setPreviewDecision] = useState({ loading: false, mode: null, reason: '', message: '', error: '' })
  const refreshAbortRef = useRef(null)
  const hasLoadedInboxRef = useRef(false)

  const previewType = searchParams.get('preview')
  const previewId = searchParams.get('id')

  const fetchNotifications = useCallback(async ({ quiet = false } = {}) => {
    if (refreshAbortRef.current) refreshAbortRef.current.abort()
    const controller = new AbortController()
    refreshAbortRef.current = controller
    if (!quiet) setLoading(true)
    try {
      const [listResult, statsResult] = await Promise.allSettled([
        notificationService.getNotifications(
          { ordering: '-created_at', page_size: 100 },
          { signal: controller.signal },
        ),
        notificationService.getStats({ signal: controller.signal }),
      ])

      if (controller.signal.aborted) return

      if (listResult.status === 'rejected') {
        console.error('[NotificationPanel] Inbox refresh failed:', listResult.reason)
        if (!quiet || !hasLoadedInboxRef.current) {
          setError(requestErrorMessage(listResult.reason))
        }
        return
      }

      const listData = listResult.value
      const nextNotifications = Array.isArray(listData?.results)
        ? listData.results
        : Array.isArray(listData) ? listData : []
      setNotifications(nextNotifications)
      hasLoadedInboxRef.current = true
      setError('')

      if (statsResult.status === 'fulfilled') {
        setStats(statsResult.value)
      } else {
        // Statistics are supplementary. Keep the freshly loaded inbox usable
        // and calculate the visible counters locally when that endpoint fails.
        console.warn('[NotificationPanel] Statistics refresh failed:', statsResult.reason)
        setStats(statsFromNotifications(nextNotifications))
      }
    } finally {
      if (refreshAbortRef.current === controller) {
        refreshAbortRef.current = null
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return undefined
    fetchNotifications()
    const interval = setInterval(() => fetchNotifications({ quiet: true }), 60000)
    return () => {
      clearInterval(interval)
      refreshAbortRef.current?.abort()
    }
  }, [fetchNotifications, isAuthenticated])

  useEffect(() => {
    if (!['po', 'pr'].includes(previewType) || !previewId) {
      setRecordPreview({ loading: false, data: null, error: '' })
      setPreviewDecision({ loading: false, mode: null, reason: '', message: '', error: '' })
      return undefined
    }

    let cancelled = false
    const fetchRecordPreview = async () => {
      setRecordPreview({ loading: true, data: null, error: '' })
      try {
        const endpoint = previewType === 'po'
          ? `/procurement/orders/${previewId}/`
          : `/procurement/requisitions/${previewId}/`
        const response = await apiClient.get(endpoint)
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
  }, [previewId, previewType])

  const closeRecordPreview = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('preview')
    nextParams.delete('id')
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  const handlePreviewDecision = async (decision) => {
    if (!recordPreview.data || !['approve', 'reject'].includes(decision)) return

    const reason = previewDecision.reason.trim()
    if (decision === 'reject' && reason.length < 10) {
      setPreviewDecision((current) => ({ ...current, error: 'Please provide a rejection reason of at least 10 characters.', message: '' }))
      return
    }

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
          ? { signature: '' }
          : { reason }

      const response = await apiClient.post(endpoint, payload)
      const updatedRecord = response.data?.purchase_order || response.data?.requisition || response.data
      if (updatedRecord && typeof updatedRecord === 'object') {
        setRecordPreview((current) => ({ ...current, data: { ...current.data, ...updatedRecord } }))
      }
      setPreviewDecision({
        loading: false,
        mode: null,
        reason: '',
        message: `${previewType === 'po' ? 'Purchase Order' : 'Purchase Requisition'} ${decision === 'approve' ? 'approved' : 'rejected'} successfully.`,
        error: '',
      })
      window.dispatchEvent(new Event('procurement-approval-updated'))
      void fetchNotifications({ quiet: true })
    } catch (requestError) {
      setPreviewDecision((current) => ({
        ...current,
        loading: false,
        error: requestError.response?.data?.detail || requestError.response?.data?.error || `Unable to ${decision} this request.`,
        message: '',
      }))
    }
  }

  useEffect(() => {
    if (!previewType || !previewId) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleEscape = (event) => {
      if (event.key === 'Escape') closeRecordPreview()
    }
    window.addEventListener('keydown', handleEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [closeRecordPreview, previewId, previewType])

  const filteredNotifications = useMemo(() => {
    const query = search.trim().toLowerCase()
    return notifications.filter((notification) => {
      const priority = String(notification.priority || 'NORMAL').toUpperCase()
      if (filter === 'unread' && notification.is_read) return false
      if (filter === 'urgent' && !['CRITICAL', 'URGENT', 'HIGH'].includes(priority)) return false
      if (!query) return true
      return [notification.title, notification.message, categoryName(notification), priority]
        .some((value) => String(value || '').toLowerCase().includes(query))
    })
  }, [filter, notifications, search])

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

  useEffect(() => {
    setCurrentPage(1)
  }, [filter, search])

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages))
  }, [totalPages])

  const unreadCount = Number(stats?.unread_count ?? notifications.filter((item) => !item.is_read).length)
  const urgentCount = Number(
    (stats?.by_priority?.CRITICAL || 0)
    + (stats?.by_priority?.URGENT || 0)
    + (stats?.by_priority?.HIGH || 0)
  )

  const handleMarkAsRead = async (id) => {
    setBusyId(id)
    try {
      await notificationService.markAsRead(id)
      setNotifications((current) => current.map((item) => item.id === id ? { ...item, is_read: true } : item))
      setStats((current) => current ? {
        ...current,
        unread_count: Math.max(0, Number(current.unread_count || 0) - 1),
        read_count: Number(current.read_count || 0) + 1,
      } : current)
    } catch (requestError) {
      console.error('[NotificationPanel] Error marking as read:', requestError)
      setError('The notification could not be marked as read. Please retry.')
    } finally {
      setBusyId(null)
    }
  }

  const handleMarkAllAsRead = async () => {
    setBulkLoading(true)
    setError('')
    try {
      await notificationService.markAllAsRead()
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })))
      setStats((current) => current ? {
        ...current,
        unread_count: 0,
        read_count: Number(current.total_count || current.read_count || 0),
      } : current)
    } catch (requestError) {
      console.error('[NotificationPanel] Error marking all as read:', requestError)
      setError('Notifications could not be marked as read. Please retry.')
    } finally {
      setBulkLoading(false)
    }
  }

  const handleDelete = async (id) => {
    setBusyId(id)
    try {
      const removed = notifications.find((item) => item.id === id)
      await notificationService.deleteNotification(id)
      setNotifications((current) => current.filter((item) => item.id !== id))
      setStats((current) => current ? {
        ...current,
        total_count: Math.max(0, Number(current.total_count || 0) - 1),
        unread_count: Math.max(0, Number(current.unread_count || 0) - (removed?.is_read ? 0 : 1)),
        read_count: Math.max(0, Number(current.read_count || 0) - (removed?.is_read ? 1 : 0)),
      } : current)
    } catch (requestError) {
      console.error('[NotificationPanel] Error deleting notification:', requestError)
      setError('The notification could not be removed. Please retry.')
    } finally {
      setBusyId(null)
    }
  }

  const openNotification = (notification) => {
    const target = resolveNotificationTarget(notification)
    if (!notification.is_read) void handleMarkAsRead(notification.id)
    if (!target) return

    if (target.isExternal) {
      window.location.assign(target.href)
    } else {
      navigate(target.href, { state: { fromNotificationId: notification.id } })
    }
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
    <div className="h-full min-h-0 w-full overflow-hidden bg-[#f5f6f8]">
      <div className="h-full min-h-0 w-full max-w-none overflow-y-auto px-3 py-3 [scrollbar-width:none] sm:px-4 lg:px-5 xl:px-6 [&::-webkit-scrollbar]:hidden">
        <div className="space-y-3">
        {false && (
        <section className="rounded-lg border border-slate-200 bg-white px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#0f6cbd] text-white">
                  <BellAlertIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 whitespace-nowrap text-xs text-slate-500"><span>Management</span><span>/</span><span className="font-semibold text-[#0f6cbd]">Notifications</span></div>
                  <h1 className="mt-0.5 text-base font-semibold text-slate-950">Notification inbox</h1>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fetchNotifications()}
                disabled={loading}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition hover:border-[#0f6cbd] hover:text-[#0f6cbd] disabled:opacity-40"
                title="Refresh notifications"
              >
                <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                disabled={bulkLoading || unreadCount === 0}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-[#0f6cbd] px-3 text-xs font-semibold text-white transition hover:bg-[#115ea3] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <EnvelopeOpenIcon className="h-4 w-4" />
                {bulkLoading ? 'Updating…' : 'Mark all read'}
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-200 pt-3 sm:grid-cols-4">
            {[
              { label: 'Total', value: stats?.total_count ?? notifications.length, tone: 'text-slate-950' },
              { label: 'Unread', value: unreadCount, tone: 'text-[#0f6cbd]' },
              { label: 'Urgent / high', value: urgentCount, tone: urgentCount ? 'text-rose-700' : 'text-slate-950' },
              { label: 'Read', value: stats?.read_count ?? notifications.filter((item) => item.is_read).length, tone: 'text-emerald-700' },
            ].map((metric) => (
              <div key={metric.label} className="border-l border-slate-200 px-3 first:border-l-0">
                <p className={`text-lg font-semibold tabular-nums ${metric.tone}`}>{metric.value}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{metric.label}</p>
              </div>
            ))}
          </div>
        </section>
        )}

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0f6cbd]">Attention stream</p>
              <h2 className="mt-0.5 text-base font-semibold text-slate-950">Your inbox</h2>
              <p className="mt-1 text-xs text-slate-500">{filteredNotifications.length} item{filteredNotifications.length === 1 ? '' : 's'} in the current view</p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
              <div className="relative w-full sm:min-w-72 lg:w-96">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, message, category…"
                className="h-10 w-full rounded-md border border-slate-300 bg-white pl-10 pr-10 text-sm text-slate-800 outline-none transition focus:border-[#0f6cbd] focus:ring-2 focus:ring-blue-100"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" aria-label="Clear search">
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
              </div>
            </div>
          </div>

          <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-[#f8f9fa] px-4 py-2">
            {FILTERS.map((option) => {
              const count = option.id === 'unread' ? unreadCount : option.id === 'urgent' ? urgentCount : stats?.total_count ?? notifications.length
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFilter(option.id)}
                  className={`inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-md border px-3 text-xs font-semibold transition ${filter === option.id ? 'border-[#0f6cbd] bg-blue-50 text-[#0f6cbd]' : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-950'}`}
                >
                  {option.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${filter === option.id ? 'bg-[#0f6cbd] text-white' : 'bg-slate-200 text-slate-600'}`}>{count}</span>
                </button>
              )
            })}
          </div>

          {error && (
            <div className="mx-5 mt-5 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              <ExclamationTriangleIcon className="h-5 w-5 flex-none" />
              <span className="flex-1">{error}</span>
              <button
                type="button"
                onClick={() => fetchNotifications()}
                disabled={loading}
                className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-50"
              >
                {loading ? 'Retrying…' : 'Retry'}
              </button>
              <button type="button" onClick={() => setError('')}><XMarkIcon className="h-4 w-4" /></button>
            </div>
          )}

          <div className="p-0">
            {loading ? (
              [1, 2, 3, 4].map((item) => <div key={item} className="h-32 animate-pulse rounded-2xl bg-slate-100" />)
            ) : filteredNotifications.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 py-16 text-center">
                <InboxIcon className="mx-auto h-12 w-12 text-emerald-400" />
                <h3 className="mt-3 text-lg font-black text-emerald-900">You’re all caught up</h3>
                <p className="mt-1 text-sm text-emerald-700">No notifications match this view.</p>
                {(filter !== 'all' || search) && (
                  <button type="button" onClick={() => { setFilter('all'); setSearch('') }} className="mt-4 text-sm font-bold text-emerald-800 underline">Clear filters</button>
                )}
              </div>
            ) : viewMode === 'cards' ? (
              paginatedNotifications.map((notification) => {
                const priority = String(notification.priority || 'NORMAL').toUpperCase()
                const priorityStyle = PRIORITY_STYLES[priority] || PRIORITY_STYLES.NORMAL
                const category = categoryName(notification).toUpperCase()
                const CategoryIcon = CATEGORY_ICONS[category] || InformationCircleIcon
                const isBusy = busyId === notification.id
                const actionTarget = resolveNotificationTarget(notification)

                return (
                  <article key={notification.id} className={`rounded-2xl border border-l-4 p-4 transition hover:-translate-y-0.5 hover:shadow-lg sm:p-5 ${priorityStyle.card} ${notification.is_read ? 'opacity-75' : 'shadow-sm'}`}>
                    <div className="flex flex-col items-start gap-4 sm:flex-row">
                      <div className="relative flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-white bg-white/80 text-slate-700 shadow-sm">
                        <CategoryIcon className="h-5 w-5" />
                        {!notification.is_read && <span className={`absolute -right-1 -top-1 h-3 w-3 rounded-full ring-2 ring-white ${priorityStyle.dot}`} />}
                      </div>

                      <div className="w-full min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-black text-slate-950">{notification.title}</h3>
                              {!notification.is_read && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">New</span>}
                            </div>
                            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">{notification.message}</p>
                          </div>
                          <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ring-1 ${priorityStyle.badge}`}>{priorityStyle.label}</span>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 pt-3">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
                            <span className="rounded-full bg-white/80 px-2.5 py-1 text-slate-700">{category.replaceAll('_', ' ')}</span>
                            <span className="inline-flex items-center gap-1"><ClockIcon className="h-3.5 w-3.5" />{notification.time_ago || formatDistanceToNow(notification.created_at)}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            {actionTarget && (
                              <button type="button" onClick={() => openNotification(notification)} disabled={isBusy} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50">
                                {actionTarget.isRecordPreview ? 'Preview' : notification.action_label || 'Open'} <ArrowRightIcon className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {!notification.is_read && (
                              <button type="button" onClick={() => handleMarkAsRead(notification.id)} disabled={isBusy} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50" title="Mark as read">
                                <EnvelopeOpenIcon className="h-4 w-4" />
                              </button>
                            )}
                            <button type="button" onClick={() => handleDelete(notification.id)} disabled={isBusy} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50" title="Delete notification">
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[820px] table-fixed text-left">
                  <thead className="bg-[#f8f9fa] text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    <tr>
                      <th className="w-[52%] px-4 py-2.5">Notification</th>
                      <th className="w-[14%] px-3 py-2.5">Priority</th>
                      <th className="w-[17%] px-3 py-2.5">Category</th>
                      <th className="w-[17%] px-3 py-2.5">Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedNotifications.map((notification) => {
                      const priority = String(notification.priority || 'NORMAL').toUpperCase()
                      const priorityStyle = PRIORITY_STYLES[priority] || PRIORITY_STYLES.NORMAL
                      const category = categoryName(notification).toUpperCase()
                      const CategoryIcon = CATEGORY_ICONS[category] || InformationCircleIcon
                      return (
                        <tr
                          key={notification.id}
                          className={`cursor-pointer border-b border-slate-100 transition last:border-b-0 hover:bg-blue-50/50 focus-within:bg-blue-50/50 ${notification.is_read ? 'opacity-75' : ''}`}
                          onClick={() => openNotification(notification)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              openNotification(notification)
                            }
                          }}
                          tabIndex={0}
                          aria-label={`Open notification: ${notification.title}`}
                        >
                          <td className={`border-l-[3px] px-4 py-3 align-top ${priorityStyle.listBorder}`}>
                            <div className="flex min-w-0 items-start gap-3">
                              <div className="relative flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                                <CategoryIcon className="h-4 w-4" />
                                {!notification.is_read && <span className={`absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white ${priorityStyle.dot}`} />}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-xs font-semibold text-slate-900" title={notification.title}>{notification.title}</p>
                                  {!notification.is_read && <span className="flex-none rounded-full bg-[#0f6cbd] px-1.5 py-0.5 text-[8px] font-semibold uppercase text-white">New</span>}
                                </div>
                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500" title={notification.message}>{notification.message}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 align-top">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${priorityStyle.badge}`}>{priorityStyle.label}</span>
                          </td>
                          <td className="px-3 py-3 align-top text-xs font-medium text-slate-600">{category.replaceAll('_', ' ')}</td>
                          <td className="px-3 py-3 align-top text-xs text-slate-500">{notification.time_ago || formatDistanceToNow(notification.created_at)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {!loading && filteredNotifications.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-xs font-semibold text-slate-500">
                Showing <span className="font-black text-slate-800">{(activePage - 1) * PAGE_SIZE + 1}–{Math.min(activePage * PAGE_SIZE, filteredNotifications.length)}</span> of <span className="font-black text-slate-800">{filteredNotifications.length}</span>
              </p>
              <nav className="flex flex-wrap items-center gap-1.5" aria-label="Notification pagination">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={activePage === 1}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeftIcon className="h-4 w-4" /> Previous
                </button>
                {visiblePages.map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    aria-current={activePage === page ? 'page' : undefined}
                    className={`h-9 min-w-9 rounded-lg px-2 text-xs font-black transition ${activePage === page ? 'bg-indigo-600 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700'}`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={activePage === totalPages}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next <ChevronRightIcon className="h-4 w-4" />
                </button>
              </nav>
            </div>
          )}
        </section>
        </div>
      </div>

      {['po', 'pr'].includes(previewType) && previewId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-5" role="presentation" onMouseDown={closeRecordPreview}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-record-preview-title"
            className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600">Notification preview</p>
                <h2 id="notification-record-preview-title" className="mt-1 truncate text-lg font-black text-slate-950 sm:text-xl">
                  {previewType === 'po' ? 'Purchase Order' : 'Purchase Recommendation'} · {recordPreview.data?.po_number || recordPreview.data?.pr_number || previewId}
                </h2>
              </div>
              <button type="button" onClick={closeRecordPreview} className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Close preview">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-100 p-3 sm:p-5">
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
                <PurchaseOrderLivePreview
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
                <PurchaseRequisitionDocumentPreview requisition={recordPreview.data} />
              ) : null}
            </div>

            {recordPreview.data && !recordPreview.loading && !recordPreview.error && (
              <footer className="border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
                {previewDecision.mode === 'reject' && !previewDecision.message && (
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
                  <div className="mb-3 flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                    <ExclamationTriangleIcon className="h-4 w-4 flex-none" />{previewDecision.error}
                  </div>
                )}
                {previewDecision.message && (
                  <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                    <CheckCircleIcon className="h-4 w-4 flex-none" />{previewDecision.message}
                  </div>
                )}

                {!previewDecision.message && (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {previewDecision.mode === 'reject' && (
                      <button type="button" onClick={() => setPreviewDecision((current) => ({ ...current, mode: null, reason: '', error: '' }))} disabled={previewDecision.loading} className="h-9 rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40">Cancel</button>
                    )}
                    <button
                      type="button"
                      onClick={() => previewDecision.mode === 'reject' ? handlePreviewDecision('reject') : setPreviewDecision((current) => ({ ...current, mode: 'reject', message: '', error: '' }))}
                      disabled={previewDecision.loading}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-rose-300 bg-white px-4 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-40"
                    >
                      <XCircleIcon className="h-4 w-4" />
                      {previewDecision.loading && previewDecision.mode === 'reject' ? 'Rejecting...' : previewDecision.mode === 'reject' ? 'Confirm rejection' : 'Reject'}
                    </button>
                    {previewDecision.mode !== 'reject' && (
                      <button type="button" onClick={() => handlePreviewDecision('approve')} disabled={previewDecision.loading} className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-600 px-4 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40">
                        <CheckCircleIcon className="h-4 w-4" />{previewDecision.loading ? 'Approving...' : 'Approve'}
                      </button>
                    )}
                  </div>
                )}
              </footer>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

export default NotificationPanel
