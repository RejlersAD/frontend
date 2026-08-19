import React, { useEffect, useState } from 'react'
import * as HeroIcons from '@heroicons/react/24/outline'
import payrollEngineService from '../../../../services/payrollEngine.service'
import {
  formatCurrency,
  CHANGE_LOG_ACTION_META,
  CHANGE_LOG_FIELD_LABELS,
} from '../../../../config/payrollEngine.config'

/**
 * ChangeHistoryModal — Display complete audit trail of line item changes
 * 
 * Shows chronological history of all creates/updates/deletes for OTHER EARNINGS
 * and DEDUCTIONS on a specific payslip.
 * 
 * Soft-coded: Uses CHANGE_LOG_ACTION_META and CHANGE_LOG_FIELD_LABELS for
 * extensibility without code changes.
 */
export default function ChangeHistoryModal({ payslipId, employeeName, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all') // 'all' | 'created' | 'updated' | 'deleted'

  useEffect(() => {
    loadHistory()
  }, [payslipId])

  const loadHistory = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await payrollEngineService.getPayslipChangeHistory(payslipId)
      setData(result)
    } catch (e) {
      setError(e?.response?.data?.error || e.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredChanges = data?.changes?.filter(
    (ch) => filter === 'all' || ch.action === filter
  ) || []

  const formatDateTime = (iso) => {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleString('en-AE', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  const renderFieldChange = (field, oldVal, newVal) => {
    const label = CHANGE_LOG_FIELD_LABELS[field] || field
    
    // Format amount as currency
    if (field === 'amount') {
      return (
        <div key={field} className="text-xs">
          <span className="font-medium text-slate-600">{label}:</span>{' '}
          {oldVal && <span className="text-rose-600 line-through">{formatCurrency(oldVal)}</span>}
          {oldVal && newVal && ' → '}
          {newVal && <span className="text-emerald-600 font-semibold">{formatCurrency(newVal)}</span>}
        </div>
      )
    }

    // Standard text field
    if (oldVal !== newVal) {
      return (
        <div key={field} className="text-xs">
          <span className="font-medium text-slate-600">{label}:</span>{' '}
          {oldVal && <span className="text-slate-400 line-through">{oldVal}</span>}
          {oldVal && newVal && ' → '}
          {newVal && <span className="font-semibold">{newVal}</span>}
        </div>
      )
    }

    return null
  }

  const renderChange = (change) => {
    const meta = CHANGE_LOG_ACTION_META[change.action] || {}
    const Icon = HeroIcons[meta.icon] || HeroIcons.InformationCircleIcon

    // Determine which fields changed
    const fields = [...new Set([
      ...Object.keys(change.old_values || {}),
      ...Object.keys(change.new_values || {})
    ])]

    return (
      <div
        key={change.id}
        className="border border-slate-200 rounded-lg p-4 bg-white hover:shadow-sm transition-shadow"
      >
        {/* Header: Action + Time + Actor */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${meta.badge || 'bg-slate-50'}`}>
              <Icon className={`w-4 h-4 ${meta.color || 'text-slate-500'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-800">
                  {meta.label || change.action}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${meta.badge || 'bg-slate-50 text-slate-600 border-slate-300'}`}
                >
                  {change.action_label}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {formatDateTime(change.at)}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-medium text-slate-700">{change.actor_name || 'System'}</div>
            {change.actor_email && (
              <div className="text-[10px] text-slate-400">{change.actor_email}</div>
            )}
          </div>
        </div>

        {/* Body: Field changes */}
        <div className="space-y-1 pl-9">
          {change.action === 'created' && (
            <div className="space-y-1">
              <div className="text-xs">
                <span className="font-medium text-slate-600">Type:</span>{' '}
                <span className="font-semibold capitalize">{change.new_values.kind}</span>
              </div>
              <div className="text-xs">
                <span className="font-medium text-slate-600">Label:</span>{' '}
                <span className="font-semibold">{change.new_values.label}</span>
              </div>
              <div className="text-xs">
                <span className="font-medium text-slate-600">Amount:</span>{' '}
                <span className="font-semibold text-emerald-600">
                  {formatCurrency(change.new_values.amount)}
                </span>
              </div>
              {change.new_values.description && (
                <div className="text-xs">
                  <span className="font-medium text-slate-600">Description:</span>{' '}
                  {change.new_values.description}
                </div>
              )}
            </div>
          )}

          {change.action === 'updated' && (
            <div className="space-y-1">
              {fields.map((field) =>
                renderFieldChange(
                  field,
                  change.old_values?.[field],
                  change.new_values?.[field]
                )
              )}
            </div>
          )}

          {change.action === 'deleted' && (
            <div className="space-y-1 opacity-75">
              <div className="text-xs">
                <span className="font-medium text-slate-600">Type:</span>{' '}
                <span className="line-through capitalize">{change.old_values.kind}</span>
              </div>
              <div className="text-xs">
                <span className="font-medium text-slate-600">Label:</span>{' '}
                <span className="line-through">{change.old_values.label}</span>
              </div>
              <div className="text-xs">
                <span className="font-medium text-slate-600">Amount:</span>{' '}
                <span className="line-through text-rose-600">
                  {formatCurrency(change.old_values.amount)}
                </span>
              </div>
            </div>
          )}

          {change.note && (
            <div className="mt-2 text-xs text-slate-500 italic border-l-2 border-slate-200 pl-2">
              {change.note}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full my-8">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <HeroIcons.ClockIcon className="w-5 h-5 text-blue-600" />
              Change History
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {employeeName || 'Employee'} · Run: {data?.run_cycle || '—'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-md"
          >
            <HeroIcons.XMarkIcon className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">Filter:</span>
            {['all', 'created', 'updated', 'deleted'].map((f) => {
              const meta = f === 'all' ? null : CHANGE_LOG_ACTION_META[f]
              const count =
                f === 'all'
                  ? data?.total_changes || 0
                  : data?.changes?.filter((ch) => ch.action === f).length || 0

              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-all ${
                    filter === f
                      ? meta?.badge || 'bg-blue-50 text-blue-700 border-blue-300'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {f === 'all' ? 'All' : meta?.label || f}
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/50 font-semibold">
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <HeroIcons.ArrowPathIcon className="w-4 h-4 animate-spin" />
                Loading change history...
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          {!loading && !error && filteredChanges.length === 0 && (
            <div className="text-center py-12">
              <HeroIcons.DocumentTextIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-600">No changes found</p>
              <p className="text-xs text-slate-400 mt-1">
                {filter === 'all'
                  ? 'No line item changes recorded for this payslip yet.'
                  : `No ${filter} actions found.`}
              </p>
            </div>
          )}

          {!loading && !error && filteredChanges.length > 0 && (
            <div className="space-y-3">
              {filteredChanges.map(renderChange)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between rounded-b-2xl">
          <div className="text-xs text-slate-500">
            {filteredChanges.length > 0 && (
              <span>
                Showing <strong>{filteredChanges.length}</strong> of{' '}
                <strong>{data?.total_changes || 0}</strong> changes
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm font-medium rounded-md border border-slate-300 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
