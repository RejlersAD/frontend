import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BellAlertIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import apiClient from '../services/api.service'

const POLL_INTERVAL_MS = 30_000

const ProcurementApprovalReminder = () => {
  const location = useLocation()
  const [items, setItems] = useState([])
  const requestInFlightRef = useRef(false)

  const refresh = useCallback(async () => {
    if (requestInFlightRef.current || document.visibilityState === 'hidden') return
    requestInFlightRef.current = true
    try {
      const [requisitions, orders] = await Promise.allSettled([
        apiClient.get('/procurement/requisitions/pending-for-me/', { params: { limit: 20 } }),
        apiClient.get('/procurement/orders/pending-for-me/', { params: { limit: 20 } }),
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

  const current = useMemo(() => items[0], [items])
  if (!current || location.pathname === current.path) return null

  return (
    <aside className="fixed bottom-5 right-5 z-[70] w-[min(92vw,390px)] rounded-2xl border border-amber-300 bg-white p-4 shadow-2xl shadow-slate-900/20" role="alert" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <BellAlertIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">Approval waiting for you</p>
          <h2 className="mt-1 truncate text-sm font-extrabold text-slate-950">Please approve {current.label}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {current.kind}{current.level !== undefined && current.level !== null ? ` · Level ${current.level}` : ''}
            {items.length > 1 ? ` · ${items.length - 1} more waiting` : ''}
          </p>
          <Link to={current.path} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700">
            Open full request <ChevronRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </aside>
  )
}

export default ProcurementApprovalReminder
