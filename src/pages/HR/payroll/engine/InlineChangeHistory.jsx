import React, { useEffect, useState } from 'react'
import * as HeroIcons from '@heroicons/react/24/outline'
import payrollEngineService from '../../../../services/payrollEngine.service'
import {
  CHANGE_LOG_ACTION,
  CHANGE_LOG_ACTION_META,
  CHANGE_LOG_FIELD_LABELS,
  INLINE_CHANGE_HISTORY,
  formatCurrency
} from '../../../../config/payrollEngine.config'

/**
 * InlineChangeHistory — Compact, embedded change log viewer
 * 
 * Displays change history for a specific kind (earning/deduction) within
 * the section itself, rather than in a separate modal. Shows compact
 * timeline of changes with expand/collapse functionality.
 * 
 * Props:
 * - payslipId: ID of the payslip to fetch changes for
 * - kind: 'earning' or 'deduction' (filters changes to this type only)
 */
export default function InlineChangeHistory({ payslipId, kind }) {
  const [changes, setChanges] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [displayLimit, setDisplayLimit] = useState(INLINE_CHANGE_HISTORY.DEFAULT_LIMIT)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    loadHistory()
  }, [payslipId, kind])

  const loadHistory = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await payrollEngineService.getPayslipChangeHistory(payslipId)
      
      // Backend returns: { payslip_id, employee_name, total_changes, changes: [...] }
      let data = []
      if (Array.isArray(response)) {
        // Direct array (legacy format)
        data = response
      } else if (response && Array.isArray(response.changes)) {
        // Object with changes property (current backend format)
        data = response.changes
      } else if (response && Array.isArray(response.results)) {
        // Paginated format
        data = response.results
      } else if (response && Array.isArray(response.data)) {
        // Generic data property
        data = response.data
      } else {
        console.warn('Unexpected response format from getPayslipChangeHistory:', response)
        data = []
      }
      
      // Filter by kind
      const filtered = data.filter(c => 
        c.new_values?.kind === kind || c.old_values?.kind === kind
      )
      setChanges(filtered)
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to load change history')
    } finally {
      setLoading(false)
    }
  }

  const formatDateTime = (isoString) => {
    if (!isoString) return '—'
    const date = new Date(isoString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getDisplayValue = (change, field) => {
    const values = change.new_values || change.old_values || {}
    const value = values[field]
    
    if (field === 'amount') {
      return formatCurrency(value, { withSymbol: false })
    }
    return value || '—'
  }

  const getActionMeta = (action) => {
    return CHANGE_LOG_ACTION_META[action] || {
      label: action,
      icon: 'QuestionMarkCircleIcon',
      badge: 'bg-slate-50 text-slate-700 border-slate-300',
      color: 'text-slate-600'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-3 text-xs text-slate-400">
        <HeroIcons.ArrowPathIcon className="w-3.5 h-3.5 animate-spin mr-1.5" />
        Loading change history...
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-md px-2.5 py-2 flex items-start gap-1.5">
        <HeroIcons.ExclamationTriangleIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>{error}</span>
      </div>
    )
  }

  if (changes.length === 0) {
    return (
      <div className="text-xs text-slate-400 italic py-2 px-2.5 bg-slate-50/50 rounded-md border border-slate-100">
        {INLINE_CHANGE_HISTORY.EMPTY_MESSAGE}
      </div>
    )
  }

  const displayedChanges = expanded ? changes : changes.slice(0, displayLimit)
  const hasMore = changes.length > displayLimit && !expanded

  return (
    <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden bg-slate-50/30">
      {/* Header */}
      <div className="px-2.5 py-1.5 bg-slate-100/50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] uppercase font-semibold text-slate-600">
          <HeroIcons.ClockIcon className="w-3 h-3" />
          Change History
          <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-slate-200 text-[9px] font-bold text-slate-700">
            {changes.length}
          </span>
        </div>
        {changes.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-blue-600 hover:text-blue-700 font-medium flex items-center gap-0.5"
          >
            {expanded ? (
              <>
                <HeroIcons.ChevronUpIcon className="w-3 h-3" />
                Show Less
              </>
            ) : (
              <>
                <HeroIcons.ChevronDownIcon className="w-3 h-3" />
                Show All
              </>
            )}
          </button>
        )}
      </div>

      {/* Changes Table */}
      <div className="divide-y divide-slate-100">
        {displayedChanges.map((change) => {
          const meta = getActionMeta(change.action)
          const Icon = HeroIcons[meta.icon] || HeroIcons.QuestionMarkCircleIcon

          return (
            <div key={change.id} className="px-2.5 py-2 hover:bg-white/60 transition-colors">
              <div className="flex items-start gap-2">
                {/* Icon & Badge */}
                <div className="flex-shrink-0 mt-0.5">
                  <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border ${meta.badge}`}>
                      {meta.label}
                    </span>
                    <span className="text-[10px] font-medium text-slate-700 truncate">
                      {getDisplayValue(change, 'label')}
                    </span>
                    {change.action === CHANGE_LOG_ACTION.UPDATED && (
                      <span className="text-[10px] text-slate-500">
                        {formatCurrency(change.old_values?.amount || 0, { withSymbol: false })}
                        {' → '}
                        {formatCurrency(change.new_values?.amount || 0, { withSymbol: false })}
                      </span>
                    )}
                    {change.action === CHANGE_LOG_ACTION.CREATED && (
                      <span className="text-[10px] text-emerald-600 font-medium">
                        +{formatCurrency(change.new_values?.amount || 0, { withSymbol: false })}
                      </span>
                    )}
                    {change.action === CHANGE_LOG_ACTION.DELETED && (
                      <span className="text-[10px] text-rose-600 font-medium line-through">
                        {formatCurrency(change.old_values?.amount || 0, { withSymbol: false })}
                      </span>
                    )}
                  </div>

                  {/* Actor & Timestamp */}
                  {(INLINE_CHANGE_HISTORY.SHOW_ACTOR || INLINE_CHANGE_HISTORY.SHOW_TIMESTAMP) && (
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      {INLINE_CHANGE_HISTORY.SHOW_ACTOR && (
                        <span className="flex items-center gap-1">
                          <HeroIcons.UserIcon className="w-3 h-3" />
                          {change.actor_name || 'System'}
                        </span>
                      )}
                      {INLINE_CHANGE_HISTORY.SHOW_TIMESTAMP && (
                        <span className="flex items-center gap-1">
                          <HeroIcons.ClockIcon className="w-3 h-3" />
                          {formatDateTime(change.at)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Description (if changed) */}
                  {change.action === CHANGE_LOG_ACTION.UPDATED && 
                   change.old_values?.description !== change.new_values?.description && (
                    <div className="mt-1 text-[10px] text-slate-600">
                      <span className="line-through text-slate-400">{change.old_values?.description || 'No description'}</span>
                      {' → '}
                      <span>{change.new_values?.description || 'No description'}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="px-2.5 py-2 bg-slate-50 border-t border-slate-200">
          <button
            onClick={() => setDisplayLimit(prev => prev + INLINE_CHANGE_HISTORY.EXPAND_INCREMENT)}
            className="w-full text-[10px] text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-1"
          >
            <HeroIcons.ChevronDownIcon className="w-3 h-3" />
            Load {Math.min(INLINE_CHANGE_HISTORY.EXPAND_INCREMENT, changes.length - displayLimit)} More
          </button>
        </div>
      )}
    </div>
  )
}
