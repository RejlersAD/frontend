/**
 * ApprovalTracker — Super-Admin Payroll Approval Status Dashboard
 * Route: /hr/payroll → "Approval Tracker" tab (adminOnly)
 *
 * Shows every master payroll file with:
 *  • A 6-step visual stepper reflecting current stage
 *  • Per-stage actor + timestamp in the expandable detail row
 *  • Live SLA clock with colour-coded badges (On Track / At Risk / Overdue)
 *  • KPI summary bar across the top
 *  • Filters: stage, year, month
 *  • Auto-refresh every PAYROLL_TRACKER_CONFIG.pollIntervalMs
 *
 * All stage labels, colours, SLA thresholds, and copy are driven from
 * hrPayroll.config.js — zero hardcoded values in this file.
 */
import { useState, useEffect, useCallback } from 'react'
import * as HeroIcons from '@heroicons/react/24/outline'
import payrollService from '../../../services/payroll.service'
import {
  PAYROLL_WORKFLOW_STAGES,
  PAYROLL_TRACKER_CONFIG,
  PAYROLL_COPY,
} from '../../../config/hrPayroll.config'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ── SLA Badge ─────────────────────────────────────────────────────────────────

const SLA_BADGE_MAP = {
  overdue: { cls: 'bg-rose-100 text-rose-700 border-rose-200',       label: PAYROLL_COPY.trackerOverdue },
  warning: { cls: 'bg-amber-100 text-amber-700 border-amber-200',    label: PAYROLL_COPY.trackerWarning },
  ok:      { cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: PAYROLL_COPY.trackerOnTrack },
}

function SLABadge({ status }) {
  const { cls, label } = SLA_BADGE_MAP[status] || SLA_BADGE_MAP.ok
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {label}
    </span>
  )
}

// ── Stage Stepper (row of 6 dots + connectors) ────────────────────────────────

function StepDot({ stageDef, stageIdx, currentIdx }) {
  const Icon     = HeroIcons[stageDef.icon] || HeroIcons.CheckCircleIcon
  const isDone   = stageIdx < currentIdx
  const isCurrent = stageIdx === currentIdx

  if (isDone) {
    return (
      <div title={stageDef.label} className="w-6 h-6 rounded-full flex items-center justify-center bg-emerald-100 border-2 border-emerald-400">
        <HeroIcons.CheckIcon className="w-3 h-3 text-emerald-600" />
      </div>
    )
  }
  if (isCurrent) {
    return (
      <div
        title={stageDef.label}
        className={`w-6 h-6 rounded-full flex items-center justify-center ${stageDef.activeBg} border-2 ${stageDef.activeBorder}`}
      >
        <Icon className={`w-3 h-3 ${stageDef.activeText}`} />
      </div>
    )
  }
  return (
    <div title={stageDef.label} className="w-6 h-6 rounded-full flex items-center justify-center bg-slate-100 border-2 border-slate-200">
      <Icon className="w-3 h-3 text-slate-300" />
    </div>
  )
}

function Stepper({ stageIndex }) {
  return (
    <div className="flex items-center gap-0">
      {PAYROLL_WORKFLOW_STAGES.map((s, i) => (
        <div key={s.key} className="flex items-center">
          <StepDot stageDef={s} stageIdx={i} currentIdx={stageIndex} />
          {i < PAYROLL_WORKFLOW_STAGES.length - 1 && (
            <div className={`w-3 h-0.5 ${i < stageIndex ? 'bg-emerald-300' : 'bg-slate-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Expanded Timeline Detail ───────────────────────────────────────────────────

function ExpandedTimeline({ row }) {
  const { stages, stage_index: currentIdx } = row
  return (
    <div className="px-6 py-5 bg-gradient-to-b from-slate-50 to-white border-t border-slate-100">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        Approval Timeline — {row.period}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {PAYROLL_WORKFLOW_STAGES.map((stageDef, i) => {
          const data     = stages[stageDef.key]
          const isDone   = i < currentIdx
          const isCurrent = i === currentIdx
          const Icon     = HeroIcons[stageDef.icon] || HeroIcons.CheckCircleIcon

          let cardCls  = 'bg-white border-slate-200'
          let textCls  = 'text-slate-400'
          let iconNode = <Icon className="w-4 h-4 text-slate-300" />

          if (isDone) {
            cardCls  = `${stageDef.doneBg} ${stageDef.doneBorder}`
            textCls  = stageDef.doneText
            iconNode = <HeroIcons.CheckCircleIcon className={`w-4 h-4 ${stageDef.doneText}`} />
          } else if (isCurrent) {
            cardCls  = `${stageDef.activeBg} ${stageDef.activeBorder}`
            textCls  = stageDef.activeText
            iconNode = <Icon className={`w-4 h-4 ${stageDef.activeText}`} />
          }

          return (
            <div key={stageDef.key} className={`rounded-xl border p-3 ${cardCls}`}>
              <div className="flex items-center gap-2 mb-2">
                {iconNode}
                <span className={`text-xs font-semibold ${textCls}`}>{stageDef.label}</span>
              </div>
              {data?.timestamp ? (
                <>
                  {data.actor && (
                    <p className="text-xs text-slate-700 font-medium truncate" title={data.actor.email}>
                      {data.actor.name}
                    </p>
                  )}
                  <p className="text-xs text-slate-400 mt-0.5">{fmtDateTime(data.timestamp)}</p>
                  {data.days_elapsed != null && (
                    <p className={`text-xs mt-1 font-medium ${textCls}`}>{data.days_elapsed}d elapsed</p>
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-400">
                  {isCurrent
                    ? `${PAYROLL_COPY.trackerPendingLabel}: ${stageDef.role || '—'}`
                    : 'Pending'}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── KPI Summary Bar ────────────────────────────────────────────────────────────

function KPIBar({ summary }) {
  const financeCount = (summary.by_stage?.finance_review ?? 0) + (summary.by_stage?.finance_approved ?? 0)
  const tiles = [
    { label: 'Total Files',    value: summary.total,                          cls: 'bg-slate-100 text-slate-700  border-slate-200' },
    { label: 'Draft',          value: summary.by_stage?.draft ?? 0,           cls: 'bg-slate-100 text-slate-600  border-slate-200' },
    { label: 'Frozen',         value: summary.by_stage?.frozen ?? 0,          cls: 'bg-blue-100  text-blue-700   border-blue-200' },
    { label: 'HR Approved',    value: summary.by_stage?.hr_approved ?? 0,     cls: 'bg-violet-100 text-violet-700 border-violet-200' },
    { label: 'In Finance',     value: financeCount,                           cls: 'bg-amber-100 text-amber-700  border-amber-200' },
    { label: 'Released',       value: summary.by_stage?.released ?? 0,        cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    { label: 'Overdue',        value: summary.overdue_count ?? 0,             cls: (summary.overdue_count ?? 0) > 0 ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-400 border-slate-200' },
    { label: 'At Risk',        value: summary.warning_count ?? 0,             cls: (summary.warning_count ?? 0) > 0 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-400 border-slate-200' },
  ]
  return (
    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-5">
      {tiles.map((t) => (
        <div key={t.label} className={`rounded-xl border px-3 py-2.5 ${t.cls}`}>
          <div className="text-xl font-bold leading-tight">{t.value}</div>
          <div className="text-xs mt-0.5 opacity-75 leading-tight">{t.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── Filter Bar ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  '', 'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function FilterBar({ filter, onChange }) {
  const set = (k, v) => onChange({ ...filter, [k]: v })
  const dirty = filter.stage || filter.year || filter.month

  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 mb-4 flex flex-wrap gap-3 items-center">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Filter</span>

      <select
        value={filter.stage}
        onChange={e => set('stage', e.target.value)}
        className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
      >
        <option value="">All Stages</option>
        {PAYROLL_WORKFLOW_STAGES.map(s => (
          <option key={s.key} value={s.key}>{s.label}</option>
        ))}
      </select>

      <input
        type="number"
        placeholder="Year (e.g. 2025)"
        value={filter.year}
        onChange={e => set('year', e.target.value)}
        className="w-36 text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
      />

      <select
        value={filter.month}
        onChange={e => set('month', e.target.value)}
        className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
      >
        <option value="">All Months</option>
        {MONTH_NAMES.slice(1).map((m, i) => (
          <option key={i + 1} value={i + 1}>{m}</option>
        ))}
      </select>

      {dirty && (
        <button
          type="button"
          onClick={() => onChange({ stage: '', year: '', month: '' })}
          className="text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}

// ── Stage Badge (current stage chip in the table) ─────────────────────────────

function StageBadge({ stageKey }) {
  const stageDef = PAYROLL_WORKFLOW_STAGES.find(s => s.key === stageKey)
  if (!stageDef) return <span className="text-xs text-slate-400">{stageKey}</span>
  const Icon = HeroIcons[stageDef.icon] || HeroIcons.CheckCircleIcon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${stageDef.activeBg} ${stageDef.activeText} ${stageDef.activeBorder}`}>
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      {stageDef.label}
    </span>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ApprovalTracker() {
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [refreshing,setRefreshing]= useState(false)
  const [error,     setError]     = useState(null)
  const [expanded,  setExpanded]  = useState(null)   // id of the expanded row
  const [lastFetch, setLastFetch] = useState(null)
  const [filter,    setFilter]    = useState({ stage: '', year: '', month: '' })

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setRefreshing(true)
    try {
      const params = {}
      if (filter.stage) params.stage = filter.stage
      if (filter.year)  params.year  = filter.year
      if (filter.month) params.month = filter.month
      const res = await payrollService.getApprovalTracker(params)
      setData(res)
      setLastFetch(new Date())
      setError(null)
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
        err?.response?.data?.error  ||
        'Failed to load approval tracker.'
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filter])

  // Initial + filter-change load
  useEffect(() => { load() }, [load])

  // Auto-refresh
  useEffect(() => {
    if (!PAYROLL_TRACKER_CONFIG.pollIntervalMs) return
    const timer = setInterval(() => load(true), PAYROLL_TRACKER_CONFIG.pollIntervalMs)
    return () => clearInterval(timer)
  }, [load])

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div>
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <HeroIcons.ArrowPathIcon className="w-8 h-8 mx-auto mb-3 text-blue-500 animate-spin" />
          <p className="text-sm text-slate-500">Loading Approval Tracker…</p>
        </div>
      </div>
    )
  }

  const results = data?.results ?? []
  const summary = data?.summary ?? {}

  return (
    <div>

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <HeroIcons.ClipboardDocumentListIcon className="w-5 h-5 text-blue-600" />
            {PAYROLL_COPY.trackerTitle}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">{PAYROLL_COPY.trackerSubtitle}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          {lastFetch && (
            <span>{PAYROLL_COPY.trackerLastUpdated}: {lastFetch.toLocaleTimeString()}</span>
          )}
          <button
            type="button"
            onClick={() => load()}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 transition-colors"
          >
            <HeroIcons.ArrowPathIcon className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-2 text-sm text-rose-700">
          <HeroIcons.ExclamationCircleIcon className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── KPI Summary Bar ───────────────────────────────────────────────── */}
      {data && <KPIBar summary={summary} />}

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <FilterBar filter={filter} onChange={setFilter} />

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      {data && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-36">Period</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Employees</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Progress</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-44">Current Stage</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Days in Stage</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-36">Awaiting</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">SLA Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-14 text-center text-slate-400">
                      <HeroIcons.ClipboardDocumentListIcon className="w-10 h-10 mx-auto mb-2 opacity-25" />
                      <p className="text-sm">{PAYROLL_COPY.trackerNoData}</p>
                    </td>
                  </tr>
                ) : (
                  results.map(row => {
                    const isExpanded = expanded === row.id
                    const isOverdue  = row.current_sla_status === 'overdue'

                    return (
                      <>
                        <tr
                          key={row.id}
                          className={`transition-colors ${isOverdue ? 'bg-rose-50/40 hover:bg-rose-50/60' : 'hover:bg-slate-50'}`}
                        >
                          {/* Period */}
                          <td className="px-4 py-3">
                            <span className="font-semibold text-slate-800">{row.period}</span>
                            <div className="text-xs text-slate-400 mt-0.5">
                              Generated {fmtDate(row.generated_at)}
                            </div>
                          </td>

                          {/* Employee count */}
                          <td className="px-4 py-3 text-slate-600 font-medium">
                            {row.total_rows.toLocaleString()}
                          </td>

                          {/* Stepper */}
                          <td className="px-4 py-3">
                            <Stepper stageIndex={row.stage_index} />
                          </td>

                          {/* Current stage badge */}
                          <td className="px-4 py-3">
                            <StageBadge stageKey={row.workflow_stage} />
                          </td>

                          {/* Days in stage */}
                          <td className="px-4 py-3 text-slate-600">
                            {row.days_in_current_stage != null ? (
                              <span className={isOverdue ? 'text-rose-600 font-semibold' : ''}>
                                {row.days_in_current_stage}d
                                {row.current_sla_days && (
                                  <span className="text-slate-400 font-normal ml-1">
                                    / {row.current_sla_days}d SLA
                                  </span>
                                )}
                              </span>
                            ) : '—'}
                          </td>

                          {/* Pending role */}
                          <td className="px-4 py-3">
                            {row.pending_role ? (
                              <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                                <HeroIcons.UserIcon className="w-3.5 h-3.5 text-slate-400" />
                                {row.pending_role}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                                <HeroIcons.CheckCircleIcon className="w-3.5 h-3.5" />
                                {PAYROLL_COPY.trackerComplete}
                              </span>
                            )}
                          </td>

                          {/* SLA badge */}
                          <td className="px-4 py-3">
                            {row.workflow_stage === 'released'
                              ? <span className="text-xs text-slate-400">—</span>
                              : <SLABadge status={row.current_sla_status} />
                            }
                          </td>

                          {/* Expand/collapse */}
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => setExpanded(isExpanded ? null : row.id)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                              title="Toggle stage timeline"
                            >
                              {isExpanded
                                ? <HeroIcons.ChevronUpIcon   className="w-4 h-4" />
                                : <HeroIcons.ChevronDownIcon className="w-4 h-4" />
                              }
                            </button>
                          </td>
                        </tr>

                        {/* Expanded detail row */}
                        {isExpanded && (
                          <tr key={`${row.id}-timeline`}>
                            <td colSpan={8} className="p-0">
                              <ExpandedTimeline row={row} />
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>
              {results.length} record{results.length !== 1 ? 's' : ''}
              {filter.stage || filter.year || filter.month ? ' (filtered)' : ''}
            </span>
            <span>
              Auto-refreshes every {PAYROLL_TRACKER_CONFIG.pollIntervalMs / 1000}s
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
