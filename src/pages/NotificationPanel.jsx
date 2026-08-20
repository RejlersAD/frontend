<<<<<<< HEAD
import React, { useCallback, useEffect, useMemo, useState } from 'react'
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
  Squares2X2Icon,
  TableCellsIcon,
  TrashIcon,
  UserIcon,
  WrenchScrewdriverIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import notificationService from '../services/notification.service'
import apiClient from '../services/api.service'
import { formatDistanceToNow } from '../utils/dateFormatter'
import { LAYOUT_CONFIG } from '../config/enterpriseDashboard.config'
import { resolveNotificationTarget } from '../utils/notificationNavigation'
import PurchaseOrderLivePreview from './Procurement/PurchaseOrderLivePreview'
import PurchaseRequisitionDocumentPreview from './Procurement/PurchaseRequisitionDocumentPreview'

const FILTERS = [
  { id: 'all', label: 'All notifications' },
  { id: 'unread', label: 'Unread' },
  { id: 'urgent', label: 'Urgent & critical' },
]

const PAGE_SIZE = 10

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
  const { user, isAuthenticated } = useSelector((state) => state.auth)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState('cards')
  const [currentPage, setCurrentPage] = useState(1)
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [recordPreview, setRecordPreview] = useState({ loading: false, data: null, error: '' })

  const previewType = searchParams.get('preview')
  const previewId = searchParams.get('id')

  const fetchNotifications = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true)
    setError('')
    try {
      const [listData, statsData] = await Promise.all([
        notificationService.getNotifications({ ordering: '-created_at', page_size: 100 }),
        notificationService.getStats(),
      ])
      setNotifications(Array.isArray(listData?.results) ? listData.results : Array.isArray(listData) ? listData : [])
      setStats(statsData)
    } catch (requestError) {
      console.error('[NotificationPanel] Error fetching notifications:', requestError)
      setError('Notifications could not be refreshed. Your last loaded inbox is still shown.')
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return undefined
    fetchNotifications()
    const interval = setInterval(() => fetchNotifications({ quiet: true }), 60000)
    return () => clearInterval(interval)
  }, [fetchNotifications, isAuthenticated])

  useEffect(() => {
    if (!['po', 'pr'].includes(previewType) || !previewId) {
      setRecordPreview({ loading: false, data: null, error: '' })
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
  }, [filter, search, viewMode])

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
=======
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
>>>>>>> origin/main
    }
  }

  const handleDelete = async (id) => {
<<<<<<< HEAD
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
    if (!target) return

    if (!notification.is_read) void handleMarkAsRead(notification.id)

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
=======
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
>>>>>>> origin/main
      </div>
    )
  }

  return (
<<<<<<< HEAD
    <div className="min-h-screen bg-[#f3f6fb]">
      <div className={`mx-auto ${LAYOUT_CONFIG.paddingX} ${LAYOUT_CONFIG.paddingY}`} style={{ maxWidth: LAYOUT_CONFIG.maxWidth }}>
        <div className="space-y-7">
        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-indigo-700 via-blue-600 to-cyan-500 px-5 py-7 text-white shadow-[0_24px_70px_-28px_rgba(37,99,235,0.65)] sm:px-8">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-white/15 blur-3xl" />
          <div className="absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-cyan-100/20 blur-3xl" />
          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
                  <BellAlertIcon className="h-7 w-7 text-cyan-100" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-100">Personal command inbox</p>
                  <h1 className="mt-1 break-words text-3xl font-black tracking-tight sm:text-4xl">Notifications Center</h1>
                </div>
              </div>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/85">
                Prioritize urgent alerts, track unread work, and move directly to the action that needs your attention, {user?.first_name || user?.username || 'there'}.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="border-r border-white/15 pr-5">
                <p className="text-3xl font-black tabular-nums">{unreadCount}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">Unread</p>
              </div>
              <button
                type="button"
                onClick={() => fetchNotifications()}
                disabled={loading}
                className="rounded-xl border border-white/25 bg-white/10 p-2.5 text-white transition hover:bg-white/20 disabled:opacity-50"
                title="Refresh notifications"
              >
                <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                disabled={bulkLoading || unreadCount === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <EnvelopeOpenIcon className="h-4 w-4" />
                {bulkLoading ? 'Updating…' : 'Mark all read'}
              </button>
            </div>
          </div>

          <div className="relative mt-7 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 sm:grid-cols-4">
            {[
              { label: 'Total', value: stats?.total_count ?? notifications.length, tone: 'text-white' },
              { label: 'Unread', value: unreadCount, tone: 'text-cyan-300' },
              { label: 'Urgent / high', value: urgentCount, tone: urgentCount ? 'text-rose-300' : 'text-emerald-300' },
              { label: 'Read', value: stats?.read_count ?? notifications.filter((item) => item.is_read).length, tone: 'text-emerald-300' },
            ].map((metric) => (
              <div key={metric.label} className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3">
                <p className={`text-2xl font-black tabular-nums ${metric.tone}`}>{metric.value}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/70">{metric.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_45px_-30px_rgba(15,23,42,0.55)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 bg-white px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600">Attention stream</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Your inbox</h2>
              <p className="mt-1 text-xs text-slate-500">{filteredNotifications.length} item{filteredNotifications.length === 1 ? '' : 's'} in the current view</p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
              <div className="relative w-full sm:min-w-72 lg:w-96">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, message, category…"
                className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-10 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" aria-label="Clear search">
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
              </div>
              <div className="grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-100 p-1" aria-label="Notification view">
                {[
                  { id: 'cards', label: 'Cards', Icon: Squares2X2Icon },
                  { id: 'list', label: 'List', Icon: TableCellsIcon },
                ].map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setViewMode(id)}
                    aria-pressed={viewMode === id}
                    className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold transition ${viewMode === id ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto border-b border-slate-100 bg-slate-50/80 px-5 py-3">
            {FILTERS.map((option) => {
              const count = option.id === 'unread' ? unreadCount : option.id === 'urgent' ? urgentCount : stats?.total_count ?? notifications.length
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFilter(option.id)}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition ${filter === option.id ? 'bg-slate-900 text-white shadow-md shadow-slate-300' : 'border border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700'}`}
                >
                  {option.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${filter === option.id ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                </button>
              )
            })}
          </div>

          {error && (
            <div className="mx-5 mt-5 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              <ExclamationTriangleIcon className="h-5 w-5 flex-none" />
              <span className="flex-1">{error}</span>
              <button type="button" onClick={() => setError('')}><XMarkIcon className="h-4 w-4" /></button>
            </div>
          )}

          <div className={viewMode === 'cards' ? 'grid grid-cols-1 gap-4 p-4 sm:p-5 xl:grid-cols-2' : 'p-0'}>
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
                <table className="w-full min-w-[880px] table-fixed text-left">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                    <tr>
                      <th className="w-[42%] px-5 py-3.5">Notification</th>
                      <th className="w-[15%] px-4 py-3.5">Priority</th>
                      <th className="w-[15%] px-4 py-3.5">Category</th>
                      <th className="w-[15%] px-4 py-3.5">Received</th>
                      <th className="w-[13%] px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedNotifications.map((notification) => {
                      const priority = String(notification.priority || 'NORMAL').toUpperCase()
                      const priorityStyle = PRIORITY_STYLES[priority] || PRIORITY_STYLES.NORMAL
                      const category = categoryName(notification).toUpperCase()
                      const CategoryIcon = CATEGORY_ICONS[category] || InformationCircleIcon
                      const isBusy = busyId === notification.id
                      const actionTarget = resolveNotificationTarget(notification)

                      return (
                        <tr key={notification.id} className={`border-b border-slate-200 transition last:border-b-0 ${priorityStyle.listRow} ${notification.is_read ? 'opacity-75' : ''}`}>
                          <td className={`border-l-4 px-5 py-4 align-top ${priorityStyle.listBorder}`}>
                            <div className="flex min-w-0 items-start gap-3">
                              <div className="relative flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                                <CategoryIcon className="h-4 w-4" />
                                {!notification.is_read && <span className={`absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white ${priorityStyle.dot}`} />}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-sm font-extrabold text-slate-900" title={notification.title}>{notification.title}</p>
                                  {!notification.is_read && <span className="flex-none rounded-full bg-indigo-600 px-1.5 py-0.5 text-[8px] font-black uppercase text-white">New</span>}
                                </div>
                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500" title={notification.message}>{notification.message}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ring-1 ${priorityStyle.badge}`}>{priorityStyle.label}</span>
                          </td>
                          <td className="px-4 py-4 align-top text-xs font-semibold text-slate-600">{category.replaceAll('_', ' ')}</td>
                          <td className="px-4 py-4 align-top text-xs font-semibold text-slate-500">{notification.time_ago || formatDistanceToNow(notification.created_at)}</td>
                          <td className="px-5 py-4 align-top">
                            <div className="flex justify-end gap-1.5">
                              {actionTarget && (
                                <button type="button" onClick={() => openNotification(notification)} disabled={isBusy} className="rounded-lg bg-indigo-600 p-2 text-white transition hover:bg-indigo-700 disabled:opacity-50" title={actionTarget.isRecordPreview ? 'Preview' : notification.action_label || 'Open'}>
                                  <ArrowRightIcon className="h-4 w-4" />
                                </button>
                              )}
                              {!notification.is_read && (
                                <button type="button" onClick={() => handleMarkAsRead(notification.id)} disabled={isBusy} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:text-emerald-700 disabled:opacity-50" title="Mark as read">
                                  <EnvelopeOpenIcon className="h-4 w-4" />
                                </button>
                              )}
                              <button type="button" onClick={() => handleDelete(notification.id)} disabled={isBusy} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-400 transition hover:text-rose-700 disabled:opacity-50" title="Delete notification">
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
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
          </section>
=======
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
>>>>>>> origin/main
        </div>
      )}
    </div>
  )
}

export default NotificationPanel
