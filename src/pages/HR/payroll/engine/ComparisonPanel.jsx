/**
 * ComparisonPanel — orchestrator for the Payroll Comparison feature.
 *
 *   1. Multi-file upload queue with per-file profile + status
 *   2. History strip listing every comparison run against the selected run
 *   3. Summary KPIs (matched / variance / external-only / payroll-only)
 *   4. Three view modes:
 *        - Diff Table        (current active comparison, with filters)
 *        - Recommendations   (plain-language action cards across all sources)
 *        - Consolidated      (cross-source matrix; needs 2+ uploads)
 *   5. XLSX download per comparison
 *
 * Used standalone in `ComparisonsHub` (global tab) and embedded inside
 * `RunDetail`. Soft-coded throughout via `payrollEngine.config.js`.
 */
import React, { useEffect, useMemo, useState } from 'react'
import * as HeroIcons from '@heroicons/react/24/outline'

import payrollEngineService, { downloadBlob } from '../../../../services/payrollEngine.service'
import {
  COMPARISON_STATUS, COMPARISON_STATUS_META,
  COMPARISON_FIELDS, COMPARISON_PROFILE_FALLBACK,
  comparisonFieldMeta, formatNumber,
} from '../../../../config/payrollEngine.config'

import ComparisonDiffTable from './ComparisonDiffTable'
import ComparisonRecommendationsInbox from './ComparisonRecommendationsInbox'
import ComparisonConsolidatedView from './ComparisonConsolidatedView'

function formatDateTime(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-AE', {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

const STATUS_TABS = [
  { key: '__all__',                          label: 'All' },
  { key: COMPARISON_STATUS.VARIANCE,         label: COMPARISON_STATUS_META[COMPARISON_STATUS.VARIANCE].label },
  { key: COMPARISON_STATUS.MATCH,            label: COMPARISON_STATUS_META[COMPARISON_STATUS.MATCH].label },
  { key: COMPARISON_STATUS.EXTERNAL_ONLY,    label: COMPARISON_STATUS_META[COMPARISON_STATUS.EXTERNAL_ONLY].label },
  { key: COMPARISON_STATUS.PAYROLL_ONLY,     label: COMPARISON_STATUS_META[COMPARISON_STATUS.PAYROLL_ONLY].label },
]

const VIEW_MODES = [
  { key: 'diff',         label: 'Diff Table',      icon: 'TableCellsIcon',
    hint: 'Row-by-row comparison for the selected upload' },
  { key: 'inbox',        label: 'Recommendations', icon: 'InboxStackIcon',
    hint: 'Plain-language actions grouped by severity & employee' },
  { key: 'consolidated', label: 'Consolidated',    icon: 'Squares2X2Icon',
    hint: 'Cross-source matrix — best with 2+ uploads' },
]

// Quick profile auto-detect from filename — pure UX hint, the backend
// still re-detects when source_profile='auto'.
function guessProfileFromFilename(name) {
  const n = (name || '').toLowerCase()
  if (n.includes('valueframe') || n.startsWith('vf'))     return 'valueframe'
  if (n.includes('sympa'))                                return 'sympa'
  return 'auto'
}

export default function ComparisonPanel({
  runId,
  runOptions = [],
  showRunPicker = false,
  defaultRunId = '',
}) {
  const [profiles, setProfiles] = useState(COMPARISON_PROFILE_FALLBACK)
  const [activeRunId, setActiveRunId] = useState(runId || defaultRunId || '')

  // History = all comparisons for the current run (summary cards)
  const [history, setHistory] = useState([])
  // Detailed comparisons (with rows) for inbox + consolidated view.
  // Keyed by comparison id.
  const [details, setDetails] = useState({})
  const [activeId, setActiveId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Upload queue: each entry = { id, file, profile, label, status, progress, error }
  const [queue, setQueue] = useState([])
  const [uploading, setUploading] = useState(false)

  // View mode
  const [viewMode, setViewMode] = useState('diff')

  // Diff-mode filters
  const [statusFilter, setStatusFilter] = useState('__all__')
  const [search, setSearch] = useState('')
  const [filteredRows, setFilteredRows] = useState([])
  const [rowsLoading, setRowsLoading] = useState(false)

  // ── Effect: keep activeRunId in sync when parent prop changes
  useEffect(() => {
    if (runId && runId !== activeRunId) setActiveRunId(runId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId])

  // ── Effect: load profile list once
  useEffect(() => {
    payrollEngineService.getComparisonProfiles()
      .then((data) => { if (Array.isArray(data) && data.length) setProfiles(data) })
      .catch(() => { /* keep fallback */ })
  }, [])

  // ── Effect: when active run changes, reload history + clear details
  useEffect(() => {
    if (!activeRunId) {
      setHistory([]); setDetails({}); setActiveId(null); setFilteredRows([])
      return
    }
    refreshHistoryAndDetails()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRunId])

  // ── Effect: when filters / active comparison change, reload filtered rows
  useEffect(() => {
    if (!activeId) { setFilteredRows([]); return }
    reloadFilteredRows(activeId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, statusFilter, search])

  const refreshHistoryAndDetails = async () => {
    setLoading(true); setError(null)
    try {
      const data = await payrollEngineService.listComparisons({ run: activeRunId })
      const list = Array.isArray(data) ? data : (data?.results ?? [])
      setHistory(list)
      if (!list.length) {
        setDetails({}); setActiveId(null); setFilteredRows([])
        return
      }
      const detailObjs = await Promise.all(
        list.map((c) => payrollEngineService.getComparison(c.id))
      )
      const map = {}
      for (const d of detailObjs) map[d.id] = d
      setDetails(map)
      setActiveId((cur) => (cur && map[cur]) ? cur : list[0].id)
    } catch (e) {
      setError(e?.response?.data?.error || e.message)
    } finally {
      setLoading(false)
    }
  }

  const reloadFilteredRows = async (id) => {
    setRowsLoading(true)
    const params = {}
    if (statusFilter !== '__all__') params.status = statusFilter
    if (search.trim()) params.search = search.trim()
    try {
      const data = await payrollEngineService.listComparisonRows(id, params)
      const list = Array.isArray(data) ? data : (data?.results ?? [])
      setFilteredRows(list)
    } catch (e) {
      setError(e?.response?.data?.error || e.message)
    } finally {
      setRowsLoading(false)
    }
  }

  // ── Upload queue ──────────────────────────────────────────────────
  const handleFilesPicked = (filesList) => {
    const files = Array.from(filesList || [])
    if (!files.length) return
    setQueue((q) => [
      ...q,
      ...files.map((f, i) => ({
        id: `${Date.now()}-${i}-${f.name}`,
        file: f,
        profile: guessProfileFromFilename(f.name),
        label: '',
        status: 'pending',     // pending | uploading | done | error
        error: null,
      })),
    ])
    // Reset the input so re-picking the same file works
    const input = document.getElementById('comparison-file-input')
    if (input) input.value = ''
  }

  const updateQueueEntry = (id, patch) =>
    setQueue((q) => q.map((e) => (e.id === id ? { ...e, ...patch } : e)))

  const removeQueueEntry = (id) =>
    setQueue((q) => q.filter((e) => e.id !== id))

  const runQueue = async () => {
    if (!activeRunId) { setError('Pick a payroll run first.'); return }
    const pending = queue.filter((q) => q.status === 'pending' || q.status === 'error')
    if (!pending.length) return
    setUploading(true); setError(null)
    for (const entry of pending) {
      updateQueueEntry(entry.id, { status: 'uploading', error: null })
      try {
        const detail = await payrollEngineService.uploadComparison({
          runId: activeRunId,
          file: entry.file,
          sourceLabel: entry.label,
          sourceProfile: entry.profile,
        })
        updateQueueEntry(entry.id, { status: 'done', resultId: detail.id })
      } catch (e) {
        updateQueueEntry(entry.id, {
          status: 'error',
          error: e?.response?.data?.error || e.message,
        })
      }
    }
    setUploading(false)
    await refreshHistoryAndDetails()
    // Clear successfully-uploaded entries
    setQueue((q) => q.filter((e) => e.status !== 'done'))
  }

  const clearQueue = () => setQueue([])

  // ── Per-comparison actions ────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!confirm('Delete this comparison report?')) return
    try {
      await payrollEngineService.deleteComparison(id)
      await refreshHistoryAndDetails()
      if (activeId === id) setActiveId(null)
    } catch (e) {
      setError(e?.response?.data?.error || e.message)
    }
  }

  const handleDownloadXlsx = async (id) => {
    const cmp = history.find((c) => c.id === id)
    if (!cmp) return
    try {
      const blob = await payrollEngineService.downloadComparisonXlsx(id)
      downloadBlob(blob, `comparison_${cmp.run_cycle_code}_${cmp.source_profile}_${id}.xlsx`)
    } catch (e) {
      setError(e?.response?.data?.error || e.message)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────
  const activeDetail = activeId ? details[activeId] : null
  const detectedFields = useMemo(() => {
    const fields = activeDetail?.summary?.fields_detected || []
    return fields.filter((f) => f !== 'employee_no' && f !== 'full_name')
  }, [activeDetail])

  const allDetails = useMemo(() => Object.values(details), [details])

  const aggregateKpis = useMemo(() => {
    const agg = { matched: 0, variance: 0, external_only: 0, payroll_only: 0 }
    for (const d of allDetails) {
      const s = d.summary || {}
      agg.matched       += s.matched || 0
      agg.variance      += s.variance || 0
      agg.external_only += s.external_only || 0
      agg.payroll_only  += s.payroll_only || 0
    }
    return agg
  }, [allDetails])

  const hasMultiple = allDetails.length >= 2

  return (
    <div className="space-y-4">
      {/* ── Upload card ──────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <HeroIcons.ArrowsRightLeftIcon className="w-4 h-4 text-indigo-600" />
              Upload external file(s)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Drop or pick <b>one or many</b> ValueFrame / Sympa / generic XLSX files.
              Each file becomes its own comparison; uploading two or more enables
              the Consolidated cross-source view.
            </p>
          </div>
        </div>

        {/* Run picker + file picker */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-4">
          {showRunPicker && (
            <div className="md:col-span-4">
              <label className="block text-[11px] uppercase font-medium text-slate-500 mb-1">
                Payroll run
              </label>
              <select
                value={activeRunId}
                onChange={(e) => setActiveRunId(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-md px-2 py-2 bg-white"
              >
                <option value="">— select —</option>
                {runOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.cycle_code} {r.status_label ? `(${r.status_label})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className={showRunPicker ? 'md:col-span-8' : 'md:col-span-12'}>
            <label className="block text-[11px] uppercase font-medium text-slate-500 mb-1">
              Add file(s)
            </label>
            <div className="flex items-center gap-2">
              <label
                htmlFor="comparison-file-input"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 cursor-pointer"
              >
                <HeroIcons.DocumentPlusIcon className="w-4 h-4" />
                Pick files
              </label>
              <input
                id="comparison-file-input"
                type="file"
                multiple
                accept=".xlsx,.xls,.csv"
                onChange={(e) => handleFilesPicked(e.target.files)}
                className="hidden"
              />
              <span className="text-xs text-slate-500">
                {queue.length
                  ? `${queue.length} file${queue.length === 1 ? '' : 's'} queued`
                  : 'No files queued yet'}
              </span>
              <div className="ml-auto flex items-center gap-2">
                {queue.length > 0 && (
                  <button
                    type="button"
                    onClick={clearQueue}
                    disabled={uploading}
                    className="text-xs text-slate-500 underline disabled:opacity-50"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={runQueue}
                  disabled={uploading || !activeRunId || queue.every((q) => q.status === 'done')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {uploading
                    ? <HeroIcons.ArrowPathIcon className="w-4 h-4 animate-spin" />
                    : <HeroIcons.ArrowUpTrayIcon className="w-4 h-4" />}
                  {uploading ? 'Comparing…' : `Run comparison${queue.length > 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Per-file queue */}
        {queue.length > 0 && (
          <div className="mt-3 border border-slate-200 rounded-md divide-y divide-slate-100">
            {queue.map((q) => (
              <QueueRow
                key={q.id}
                entry={q}
                profiles={profiles}
                onChange={(patch) => updateQueueEntry(q.id, patch)}
                onRemove={() => removeQueueEntry(q.id)}
                disabled={uploading}
              />
            ))}
          </div>
        )}

        {error && (
          <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}
      </div>

      {/* ── History strip ────────────────────────────────────────── */}
      {history.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <div className="text-[11px] uppercase font-medium text-slate-500 mb-2">
            Uploads for this run ({history.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {history.map((h) => {
              const isActive = activeId === h.id
              const variances = h.summary?.variance || 0
              return (
                <div
                  key={h.id}
                  className={`flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md border ${
                    isActive
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveId(h.id)}
                    className="flex items-center gap-1.5"
                  >
                    <HeroIcons.DocumentMagnifyingGlassIcon className="w-3.5 h-3.5" />
                    <span className="font-medium">{h.source_label || h.source_profile}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500">{formatDateTime(h.created_at)}</span>
                    {variances ? (
                      <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700 border border-amber-200">
                        {variances} diff
                      </span>
                    ) : (
                      <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-200">
                        clean
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadXlsx(h.id)}
                    title="Download diff XLSX"
                    className="text-slate-400 hover:text-indigo-700"
                  >
                    <HeroIcons.ArrowDownTrayIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(h.id)}
                    title="Delete this comparison"
                    className="text-slate-400 hover:text-rose-600"
                  >
                    <HeroIcons.XMarkIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Aggregate KPIs (across all sources) ─────────────────── */}
      {allDetails.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile
            label={allDetails.length > 1 ? `Matched (all ${allDetails.length} sources)` : 'Matched'}
            value={formatNumber(aggregateKpis.matched, { decimals: 0 })}
            tone="emerald"
            icon="CheckCircleIcon"
          />
          <KpiTile
            label="Variances"
            value={formatNumber(aggregateKpis.variance, { decimals: 0 })}
            tone="amber"
            icon="ExclamationTriangleIcon"
          />
          <KpiTile
            label="External only"
            value={formatNumber(aggregateKpis.external_only, { decimals: 0 })}
            tone="sky"
            icon="UserPlusIcon"
          />
          <KpiTile
            label="Missing from external"
            value={formatNumber(aggregateKpis.payroll_only, { decimals: 0 })}
            tone="rose"
            icon="UserMinusIcon"
          />
        </div>
      )}

      {/* ── View-mode tabs + content ─────────────────────────────── */}
      {allDetails.length > 0 && (
        <div>
          <div className="bg-white border border-slate-200 rounded-xl px-2 pt-1.5 mb-3">
            <div className="flex gap-1 overflow-x-auto">
              {VIEW_MODES.map((m) => {
                const Icon = HeroIcons[m.icon] || HeroIcons.TableCellsIcon
                const isActive = viewMode === m.key
                const disabled = m.key === 'consolidated' && !hasMultiple
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => !disabled && setViewMode(m.key)}
                    title={disabled ? 'Upload at least 2 files to enable' : m.hint}
                    disabled={disabled}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-t-md border-b-2 whitespace-nowrap ${
                      disabled
                        ? 'border-transparent text-slate-300 cursor-not-allowed'
                        : isActive
                          ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40'
                          : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {m.label}
                  </button>
                )
              })}
            </div>
          </div>

          {viewMode === 'diff' && activeDetail && (
            <DiffView
              detail={activeDetail}
              detectedFields={detectedFields}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              search={search}
              setSearch={setSearch}
              rows={filteredRows}
              rowsLoading={rowsLoading}
            />
          )}

          {viewMode === 'inbox' && (
            <ComparisonRecommendationsInbox comparisons={allDetails} />
          )}

          {viewMode === 'consolidated' && (
            <ComparisonConsolidatedView comparisons={allDetails} />
          )}
        </div>
      )}

      {!allDetails.length && !loading && activeRunId && (
        <div className="text-center text-slate-500 text-sm py-8 border border-dashed border-slate-300 rounded-xl">
          No comparisons yet. Pick one or more external files above and click
          “Run comparisons” to get started.
        </div>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────

function QueueRow({ entry, profiles, onChange, onRemove, disabled }) {
  const statusBadge = {
    pending:   { cls: 'bg-slate-100 text-slate-600',     label: 'Queued',     icon: HeroIcons.QueueListIcon },
    uploading: { cls: 'bg-indigo-100 text-indigo-700',   label: 'Comparing…', icon: HeroIcons.ArrowPathIcon, spin: true },
    done:      { cls: 'bg-emerald-100 text-emerald-700', label: 'Done',       icon: HeroIcons.CheckCircleIcon },
    error:     { cls: 'bg-rose-100 text-rose-700',       label: 'Failed',     icon: HeroIcons.XCircleIcon },
  }[entry.status] || {}
  const Icon = statusBadge.icon || HeroIcons.DocumentIcon

  return (
    <div className="px-3 py-2 flex items-center gap-2 flex-wrap text-xs bg-white">
      <HeroIcons.DocumentTextIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
      <div className="font-medium text-slate-800 min-w-0 truncate flex-1 md:flex-none md:w-64" title={entry.file.name}>
        {entry.file.name}
      </div>
      <span className="text-[10px] text-slate-400">
        {(entry.file.size / 1024).toFixed(0)} KB
      </span>
      <select
        value={entry.profile}
        onChange={(e) => onChange({ profile: e.target.value })}
        disabled={disabled || entry.status === 'uploading' || entry.status === 'done'}
        className="text-[11px] border border-slate-300 rounded px-1.5 py-1 bg-white"
        title="Source profile"
      >
        {profiles.map((p) => (
          <option key={p.code} value={p.code}>{p.label}</option>
        ))}
      </select>
      <input
        type="text"
        value={entry.label}
        onChange={(e) => onChange({ label: e.target.value })}
        placeholder="Label (optional)"
        disabled={disabled || entry.status === 'uploading' || entry.status === 'done'}
        className="text-[11px] border border-slate-300 rounded px-1.5 py-1 flex-1 min-w-[120px]"
      />
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${statusBadge.cls}`}>
        <Icon className={`w-3 h-3 ${statusBadge.spin ? 'animate-spin' : ''}`} />
        {statusBadge.label}
      </span>
      {entry.error && (
        <span className="text-[10px] text-rose-600 max-w-xs truncate" title={entry.error}>
          {entry.error}
        </span>
      )}
      {entry.status !== 'uploading' && (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="text-slate-400 hover:text-rose-600 disabled:opacity-50"
          title="Remove"
        >
          <HeroIcons.XMarkIcon className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

function KpiTile({ label, value, tone = 'slate', icon }) {
  const tones = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    amber:   'bg-amber-50 border-amber-200 text-amber-800',
    sky:     'bg-sky-50 border-sky-200 text-sky-800',
    rose:    'bg-rose-50 border-rose-200 text-rose-800',
    slate:   'bg-slate-50 border-slate-200 text-slate-800',
  }
  const Icon = icon ? (HeroIcons[icon] || HeroIcons.SparklesIcon) : null
  return (
    <div className={`border rounded-lg p-3 ${tones[tone] || tones.slate}`}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 opacity-70" />}
        <div className="text-[10px] uppercase font-medium opacity-70">{label}</div>
      </div>
      <div className="text-lg font-semibold tabular-nums mt-1">{value || 0}</div>
    </div>
  )
}

function DiffView({
  detail, detectedFields,
  statusFilter, setStatusFilter, search, setSearch,
  rows, rowsLoading,
}) {
  return (
    <div className="space-y-3">
      {/* Source header + per-field breakdown */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="text-sm font-semibold text-slate-700">
          {detail.source_label}
          <span className="ml-2 text-xs font-normal text-slate-500">
            vs {detail.run_cycle_code} · uploaded {formatDateTime(detail.created_at)}
            {detail.uploaded_by_name ? ` by ${detail.uploaded_by_name}` : ''}
          </span>
        </div>
        {detectedFields.length > 0 && (
          <div className="mt-3">
            <div className="text-[11px] uppercase font-medium text-slate-500 mb-2">
              Variance by field (this source)
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {detectedFields.map((f) => {
                const meta = comparisonFieldMeta(f)
                const st = detail.summary?.by_field?.[f] || {}
                const total = st.variances || 0
                const crit = st.critical || 0
                const warn = st.warning || 0
                return (
                  <div
                    key={f}
                    className={`border rounded-md px-2 py-1.5 text-xs ${
                      crit ? 'border-rose-200 bg-rose-50'
                      : warn ? 'border-amber-200 bg-amber-50'
                      : total ? 'border-sky-200 bg-sky-50'
                      : 'border-emerald-200 bg-emerald-50'
                    }`}
                  >
                    <div className="font-medium text-slate-700">{meta.label}</div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px]">
                      {total
                        ? (
                          <>
                            <span className="text-slate-600">{total} diff</span>
                            {crit ? <span className="text-rose-600 font-medium">·{crit}!</span> : null}
                            {warn ? <span className="text-amber-600 font-medium">·{warn}⚠</span> : null}
                          </>
                        )
                        : <span className="text-emerald-700 font-medium">all match ✓</span>
                      }
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex flex-wrap gap-1">
            {STATUS_TABS.map((t) => {
              const isActive = statusFilter === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setStatusFilter(t.key)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md border ${
                    isActive
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {t.label}
                </button>
              )
            })}
          </div>
          <div className="relative">
            <HeroIcons.MagnifyingGlassIcon className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search name / emp #"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 pr-2 py-1.5 text-xs border border-slate-300 rounded-md w-64"
            />
          </div>
        </div>
      </div>

      <ComparisonDiffTable
        rows={rows}
        detectedFields={detectedFields}
        loading={rowsLoading}
      />
    </div>
  )
}
