/**
 * Adjustments dashboard for the Payroll Engine.
 *
 * Features (soft-coded — all controlled from payrollEngine.config.js):
 *   • KPI summary tiles (counts + totals by status / kind)
 *   • Year / month / status / kind / search filters
 *   • Bulk-select with single-click cancel
 *   • Per-row Edit & Cancel actions, gated by RBAC
 *   • Create new adjustments via AdjustmentModal
 *
 * RBAC: editing/cancelling is gated by `canEditPayrollAdjustment` which
 * mirrors the backend `PayrollAdjustmentWritePermission`. Roles can be
 * tuned via the `PAYROLL_ADJUSTMENT_WRITE_ROLES` env var.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import * as HeroIcons from '@heroicons/react/24/outline'
import payrollEngineService from '../../../../services/payrollEngine.service'
import {
  formatCurrency,
  ADJUSTMENT_COLUMNS,
  MONTH_NAMES,
  ADJUSTMENT_STATUS,
  ADJUSTMENT_STATUS_META,
  ADJUSTMENT_KIND,
  ADJUSTMENT_KIND_META,
  ADJUSTMENT_KPIS,
  canEditPayrollAdjustment,
} from '../../../../config/payrollEngine.config'
import AdjustmentModal from './AdjustmentModal'

const today = new Date()
const YEAR_RANGE = [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1]

const Icon = ({ name, className }) => {
  const Cmp = HeroIcons[name] || HeroIcons.SparklesIcon
  return <Cmp className={className} />
}

const fmtAmount = (v) => formatCurrency(v ?? 0, { withSymbol: false })
const isEditable = (a) => a?.status === ADJUSTMENT_STATUS.PENDING

export default function AdjustmentsList() {
  const authUser = useSelector((s) => s.auth?.user)
  const rbacUser = useSelector((s) => s.rbac?.currentUser)
  const canEdit = useMemo(
    () => canEditPayrollAdjustment(authUser, rbacUser),
    [authUser, rbacUser],
  )

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    status: '',
    kind: '',
    search: '',
  })
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [busyIds, setBusyIds] = useState(new Set())

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const params = { ...filter }
      Object.keys(params).forEach((k) => { if (!params[k] && params[k] !== 0) delete params[k] })
      delete params.search // search is applied client-side; don't shrink the slice
      const data = await payrollEngineService.listAdjustments(params)
      const list = Array.isArray(data) ? data : (data?.results ?? [])
      setItems(list)
      setSelectedIds(new Set())
    } catch (e) {
      setError(e?.response?.data?.error || e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() /* eslint-disable-next-line */ },
    [filter.year, filter.month, filter.status, filter.kind])

  // ── Derived summary (client-side over the loaded slice)
  const summary = useMemo(() => {
    const acc = {
      count: items.length,
      pending_total: 0,
      earning_total: 0,
      deduction_total: 0,
      applied_total: 0,
      cancelled_total: 0,
    }
    for (const a of items) {
      const amt = Number(a.amount) || 0
      if (a.status === ADJUSTMENT_STATUS.PENDING)   acc.pending_total += amt
      if (a.status === ADJUSTMENT_STATUS.APPLIED)   acc.applied_total += amt
      if (a.status === ADJUSTMENT_STATUS.CANCELLED) acc.cancelled_total += amt
      if (a.kind === ADJUSTMENT_KIND.EARNING && a.status !== ADJUSTMENT_STATUS.CANCELLED)   acc.earning_total += amt
      if (a.kind === ADJUSTMENT_KIND.DEDUCTION && a.status !== ADJUSTMENT_STATUS.CANCELLED) acc.deduction_total += amt
    }
    return acc
  }, [items])

  const visible = useMemo(() => {
    const q = (filter.search || '').trim().toLowerCase()
    if (!q) return items
    return items.filter((a) =>
      (a.employee_name || '').toLowerCase().includes(q)
      || (a.employee_no || '').toLowerCase().includes(q)
      || (a.label || '').toLowerCase().includes(q)
      || (a.description || '').toLowerCase().includes(q)
      || (a.component_code || '').toLowerCase().includes(q)
    )
  }, [items, filter.search])

  const selectableIds = useMemo(
    () => visible.filter(isEditable).map((a) => a.id),
    [visible],
  )
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id))

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(selectableIds))
    }
  }
  const toggleSelectOne = (id) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelectedIds(next)
  }

  const markBusy = (id, on = true) => {
    setBusyIds((prev) => {
      const next = new Set(prev)
      if (on) next.add(id); else next.delete(id)
      return next
    })
  }

  // ── Actions ──────────────────────────────────────────────────────────────
  const openCreate = () => { setEditing(null); setModalOpen(true) }
  const openEdit = (a) => { setEditing(a); setModalOpen(true) }

  const handleSaved = (saved) => {
    setModalOpen(false)
    setEditing(null)
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.id === saved.id)
      if (idx === -1) return [saved, ...prev]
      const next = prev.slice()
      next[idx] = saved
      return next
    })
  }

  const handleCancelOne = async (a) => {
    if (!isEditable(a)) return
    if (!window.confirm(`Cancel adjustment "${a.label}" for ${a.employee_name}?`)) return
    markBusy(a.id, true)
    try {
      const updated = await payrollEngineService.cancelAdjustment(a.id)
      setItems((prev) => prev.map((x) => (x.id === a.id ? updated : x)))
    } catch (e) {
      alert(e?.response?.data?.error || e.message || 'Failed to cancel adjustment.')
    } finally {
      markBusy(a.id, false)
    }
  }

  const handleDelete = async (a) => {
    if (!window.confirm(`Permanently delete adjustment "${a.label}"? This cannot be undone.`)) return
    markBusy(a.id, true)
    try {
      await payrollEngineService.deleteAdjustment(a.id)
      setItems((prev) => prev.filter((x) => x.id !== a.id))
    } catch (e) {
      alert(e?.response?.data?.error || e.message || 'Failed to delete adjustment.')
    } finally {
      markBusy(a.id, false)
    }
  }

  const handleBulkCancel = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    if (!window.confirm(`Cancel ${ids.length} adjustment${ids.length === 1 ? '' : 's'}?`)) return
    try {
      const res = await payrollEngineService.bulkCancelAdjustments(ids)
      await load()
      alert(`Cancelled ${res.cancelled} of ${res.requested} adjustment${res.requested === 1 ? '' : 's'}.`)
    } catch (e) {
      alert(e?.response?.data?.error || e.message || 'Bulk cancel failed.')
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {ADJUSTMENT_KPIS.map((k) => {
          const raw = summary[k.id] ?? 0
          const value = k.format === 'currency' ? fmtAmount(raw) : raw.toLocaleString()
          return (
            <div
              key={k.id}
              className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3"
            >
              <div className={`p-2 rounded-lg ${k.bg}`}>
                <Icon name={k.icon} className={`w-5 h-5 ${k.color}`} />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-slate-500 uppercase tracking-wide">{k.label}</div>
                <div className="text-base font-semibold text-slate-800 tabular-nums truncate">{value}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Filter / action toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap gap-2 items-center">
        <select
          value={filter.year}
          onChange={(e) => setFilter({ ...filter, year: Number(e.target.value) })}
          className="text-sm border border-slate-300 rounded-md px-2 py-1.5"
        >
          {YEAR_RANGE.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={filter.month}
          onChange={(e) => setFilter({ ...filter, month: Number(e.target.value) })}
          className="text-sm border border-slate-300 rounded-md px-2 py-1.5"
        >
          {MONTH_NAMES.slice(1).map((n, i) => (
            <option key={i + 1} value={i + 1}>{n}</option>
          ))}
        </select>
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="text-sm border border-slate-300 rounded-md px-2 py-1.5"
        >
          <option value="">All statuses</option>
          {Object.values(ADJUSTMENT_STATUS).map((s) => (
            <option key={s} value={s}>{ADJUSTMENT_STATUS_META[s]?.label || s}</option>
          ))}
        </select>
        <select
          value={filter.kind}
          onChange={(e) => setFilter({ ...filter, kind: e.target.value })}
          className="text-sm border border-slate-300 rounded-md px-2 py-1.5"
        >
          <option value="">All kinds</option>
          {Object.values(ADJUSTMENT_KIND).map((k) => (
            <option key={k} value={k}>{ADJUSTMENT_KIND_META[k]?.label || k}</option>
          ))}
        </select>
        <div className="relative">
          <HeroIcons.MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search employee / label / description…"
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            className="text-sm border border-slate-300 rounded-md pl-7 pr-2 py-1.5 w-64"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {canEdit && selectedIds.size > 0 && (
            <button
              type="button"
              onClick={handleBulkCancel}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
            >
              <HeroIcons.NoSymbolIcon className="w-4 h-4" />
              Cancel {selectedIds.size} selected
            </button>
          )}
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-slate-300 hover:bg-slate-50"
            title="Refresh"
          >
            <HeroIcons.ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
            >
              <HeroIcons.PlusIcon className="w-4 h-4" />
              New Adjustment
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 text-xs text-red-700">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No adjustments for {MONTH_NAMES[filter.month]} {filter.year}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase">
                <tr>
                  {canEdit && (
                    <th className="px-3 py-2 w-8">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        disabled={selectableIds.length === 0}
                      />
                    </th>
                  )}
                  {ADJUSTMENT_COLUMNS.map((c) => (
                    <th
                      key={c.key}
                      style={{ width: c.width }}
                      className={`px-3 py-2 font-medium ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                    >
                      {c.label}
                    </th>
                  ))}
                  {canEdit && (
                    <th className="px-3 py-2 text-right font-medium">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((a) => {
                  const editable = isEditable(a)
                  const busy = busyIds.has(a.id)
                  const kindMeta = ADJUSTMENT_KIND_META[a.kind]
                  const statusMeta = ADJUSTMENT_STATUS_META[a.status]
                  return (
                    <tr key={a.id} className={`hover:bg-slate-50 ${selectedIds.has(a.id) ? 'bg-indigo-50/40' : ''}`}>
                      {canEdit && (
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(a.id)}
                            disabled={!editable}
                            onChange={() => toggleSelectOne(a.id)}
                            title={editable ? '' : 'Only pending adjustments can be selected.'}
                          />
                        </td>
                      )}
                      <td className="px-3 py-2 text-slate-700">{a.employee_name}</td>
                      <td className="px-3 py-2 font-mono text-slate-500">{a.employee_no}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-2 py-0.5 text-[10px] rounded-full border ${kindMeta?.badge || ''}`}>
                          {kindMeta?.sign || ''} {kindMeta?.label || a.kind}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{a.label}</td>
                      <td className="px-3 py-2 text-slate-500 max-w-md truncate" title={a.description}>{a.description}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtAmount(a.amount)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-2 py-0.5 text-[10px] rounded-full border ${statusMeta?.badge || ''}`}>
                          {statusMeta?.label || a.status}
                        </span>
                      </td>
                      {canEdit && (
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {editable ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEdit(a)}
                                disabled={busy}
                                className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-slate-300 hover:bg-slate-100 disabled:opacity-50"
                                title="Edit adjustment"
                              >
                                <HeroIcons.PencilSquareIcon className="w-3.5 h-3.5" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancelOne(a)}
                                disabled={busy}
                                className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                                title="Cancel adjustment"
                              >
                                <HeroIcons.NoSymbolIcon className="w-3.5 h-3.5" />
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(a)}
                                disabled={busy}
                                className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-rose-300 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                                title="Delete adjustment"
                              >
                                <HeroIcons.TrashIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              {a.status === ADJUSTMENT_STATUS.APPLIED ? 'Locked (applied)' : 'Cancelled'}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-slate-50">
                <tr>
                  <td
                    colSpan={(canEdit ? 1 : 0) + ADJUSTMENT_COLUMNS.length - 2}
                    className="px-3 py-2 text-right text-[11px] font-medium text-slate-500 uppercase"
                  >
                    Showing {visible.length} of {items.length}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-700">
                    {fmtAmount(visible.reduce((s, a) => s + (Number(a.amount) || 0), 0))}
                  </td>
                  <td colSpan={(canEdit ? 2 : 1)} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <AdjustmentModal
        open={modalOpen}
        adjustment={editing}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        onSaved={handleSaved}
      />
    </div>
  )
}
