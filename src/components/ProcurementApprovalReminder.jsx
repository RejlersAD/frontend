import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BellAlertIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/react/24/outline'
import apiClient from '../services/api.service'

const POLL_INTERVAL_MS = 30_000
const ROTATION_INTERVAL_MS = 12_000
const SNOOZE_INTERVAL_MS = 10 * 60_000
const SNOOZE_STORAGE_KEY = 'radai.approvalReminder.snoozedUntil'

const REMINDER_THEMES = [
  { border: 'border-amber-300', icon: 'bg-amber-100 text-amber-700', eyebrow: 'text-amber-700', button: 'bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500', counter: 'bg-amber-50 text-amber-700' },
  { border: 'border-blue-300', icon: 'bg-blue-100 text-blue-700', eyebrow: 'text-blue-700', button: 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500', counter: 'bg-blue-50 text-blue-700' },
  { border: 'border-violet-300', icon: 'bg-violet-100 text-violet-700', eyebrow: 'text-violet-700', button: 'bg-violet-600 hover:bg-violet-700 focus-visible:ring-violet-500', counter: 'bg-violet-50 text-violet-700' },
  { border: 'border-emerald-300', icon: 'bg-emerald-100 text-emerald-700', eyebrow: 'text-emerald-700', button: 'bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500', counter: 'bg-emerald-50 text-emerald-700' },
  { border: 'border-rose-300', icon: 'bg-rose-100 text-rose-700', eyebrow: 'text-rose-700', button: 'bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500', counter: 'bg-rose-50 text-rose-700' },
]

const readSnoozedUntil = () => {
  const storedValue = Number(window.localStorage.getItem(SNOOZE_STORAGE_KEY) || 0)
  return Number.isFinite(storedValue) ? storedValue : 0
}

const ProcurementApprovalReminder = () => {
  const location = useLocation()
  const [items, setItems] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [snoozedUntil, setSnoozedUntil] = useState(readSnoozedUntil)
  const requestInFlightRef = useRef(false)

  const refresh = useCallback(async () => {
    if (requestInFlightRef.current || document.visibilityState === 'hidden') return
    requestInFlightRef.current = true
    try {
      const [requisitions, orders] = await Promise.allSettled([
        apiClient.get('/procurement/requisitions/pending-for-me/', { params: { limit: 100 } }),
        apiClient.get('/procurement/orders/pending-for-me/', { params: { limit: 100 } }),
      ])
      const prItems = (requisitions.status === 'fulfilled' ? requisitions.value.data?.results || [] : []).map((item) => ({
        id: `pr:${item.id}`,
        label: item.pr_number || item.title || 'Purchase Requisition',
        level: (() => {
          const pending = (item.approval_workflow_config || item.approval_hierarchy || [])
            .map((stage, index) => ({ stage, level: Number.isFinite(Number(stage?.level)) ? Number(stage.level) : index }))
            .filter(({ stage }) => ['pending', 'in_review'].includes(String(stage?.status || 'pending').toLowerCase()))
          return pending.length ? Math.min(...pending.map(({ level }) => level)) : undefined
        })(),
        path: `/procurement/requisitions/${item.id}`,
        kind: 'Purchase Requisition',
      }))
      const poItems = (orders.status === 'fulfilled' ? orders.value.data?.results || [] : []).map((item) => ({
        id: `po:${item.approval_queue_id || item.id}`,
        label: item.po_number || item.title || 'Purchase Order',
        level: item.approval_level,
        path: `/procurement/orders/${item.id}`,
        kind: 'Purchase Order',
      }))
      setItems([...prItems, ...poItems])
    } finally {
      requestInFlightRef.current = false
    }
  }, [])

  useEffect(() => {
    refresh()
    const timer = window.setInterval(refresh, POLL_INTERVAL_MS)
    const handleRefresh = () => refresh()
    const handleVisibility = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('focus', handleRefresh)
    window.addEventListener('procurement-approval-updated', handleRefresh)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', handleRefresh)
      window.removeEventListener('procurement-approval-updated', handleRefresh)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [refresh])

  const visibleItems = useMemo(
    () => items.filter((item) => location.pathname !== item.path),
    [items, location.pathname],
  )

  useEffect(() => {
    setCurrentIndex((index) => visibleItems.length ? index % visibleItems.length : 0)
  }, [visibleItems.length])

  useEffect(() => {
    if (visibleItems.length < 2 || snoozedUntil > Date.now()) return undefined
    const timer = window.setInterval(() => {
      setCurrentIndex((index) => (index + 1) % visibleItems.length)
    }, ROTATION_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [snoozedUntil, visibleItems.length])

  useEffect(() => {
    const delay = snoozedUntil - Date.now()
    if (delay <= 0) return undefined
    const timer = window.setTimeout(() => {
      setSnoozedUntil(0)
      window.localStorage.removeItem(SNOOZE_STORAGE_KEY)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [snoozedUntil])

  const current = visibleItems[currentIndex]
  const theme = REMINDER_THEMES[currentIndex % REMINDER_THEMES.length]
  const snooze = () => {
    const nextReminder = Date.now() + SNOOZE_INTERVAL_MS
    window.localStorage.setItem(SNOOZE_STORAGE_KEY, String(nextReminder))
    setSnoozedUntil(nextReminder)
  }

  if (!current || snoozedUntil > Date.now()) return null

  return (
    <aside key={current.id} className={`approval-reminder-enter fixed bottom-5 right-5 z-[70] w-[min(92vw,390px)] rounded-2xl border bg-white p-4 shadow-2xl shadow-slate-900/20 ${theme.border}`} role="status" aria-live="polite" aria-atomic="true">
      <button type="button" onClick={snooze} className="absolute right-2.5 top-2.5 inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label="Dismiss approval reminder for 10 minutes" title="Remind me again in 10 minutes">
        <XMarkIcon className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${theme.icon}`}>
          <BellAlertIcon className="approval-reminder-bell h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1 pr-6">
          <div className="flex items-center justify-between gap-2">
            <p className={`text-[10px] font-black uppercase tracking-[0.16em] ${theme.eyebrow}`}>Approval waiting for you</p>
            {visibleItems.length > 1 && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${theme.counter}`}>{currentIndex + 1} of {visibleItems.length}</span>}
          </div>
          <h2 className="mt-1 truncate text-sm font-extrabold text-slate-950" title={current.label}>Please approve {current.label}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {current.kind}{current.level !== undefined && current.level !== null ? ` · Level ${current.level}` : ''}
            {visibleItems.length > 1 ? ` · ${visibleItems.length - 1} more waiting` : ''}
          </p>
          <Link to={current.path} className={`mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${theme.button}`}>
            Open full request <ChevronRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </aside>
  )
}

export default ProcurementApprovalReminder
