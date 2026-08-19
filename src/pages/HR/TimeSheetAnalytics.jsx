/**
 * HR · Time Sheet Analytics (`/hr/employees → Time Sheet`)
 * --------------------------------------------------------
 * Real-time attendance dashboard powered by the on-premise SQL Server
 * biometric database (`backend/apps/timesheet/*`).
 *
 * Five tabs:
 *   • Live     — auto-refreshing IN/OUT roster + late-today counter
 *   • Daily    — per-user hours for a chosen date
 *   • Monthly  — month rollup with full/half-day + late stats
 *   • Reports  — Excel + PDF downloads
 *   • Setup    — discovery wizard (databases → tables → columns → env vars)
 *
 * Every label, endpoint, polling interval and column comes from
 * `frontend/src/config/timesheet.config.js`. No magic values live here.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import * as HeroIcons from '@heroicons/react/24/outline'
import timesheetService from '../../services/timesheet.service'
import {
  TIMESHEET_TABS,
  TIMESHEET_DEFAULT_TAB,
  TIMESHEET_POLL_MS,
  TIMESHEET_STATUS_TONES,
  TIMESHEET_LIVE_COLUMNS,
  TIMESHEET_DAILY_COLUMNS,
  TIMESHEET_MONTHLY_COLUMNS,
  TIMESHEET_ENV_VARS,
  TIMESHEET_COPY,
  PUNCH_TYPE_LABELS,
} from '../../config/timesheet.config'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const Icon = ({ name, className = 'w-5 h-5' }) => {
  const C = HeroIcons[name] || HeroIcons.QuestionMarkCircleIcon
  return <C className={className} aria-hidden="true" />
}

const fmtError = (err) => {
  if (!err) return null
  if (typeof err === 'string') return err
  if (err.response?.data?.error) return err.response.data.error
  if (err.response?.data?.detail) return err.response.data.detail
  return err.message || 'Unknown error'
}

const todayISO = () => new Date().toISOString().slice(0, 10)
const now = () => new Date().getFullYear()
const thisMonth = () => new Date().getMonth() + 1

// ─────────────────────────────────────────────────────────────────────────────
// Soft-coded row search — fields checked when filtering timesheet rows by text.
// Add/remove field names here to change what the search covers without
// touching any tab component.
// ─────────────────────────────────────────────────────────────────────────────
const ROW_SEARCH_FIELDS = [
  'radai_full_name', 'name', 'employee_name', 'employee_code',
  'radai_email', 'employee_email', 'email',
  'department', 'radai_department',
]

/** Return true when `row` matches the trimmed lowercase query `q`. */
const rowMatchesQuery = (row, q) => {
  if (!q) return true
  return ROW_SEARCH_FIELDS.some(f => {
    const v = (row[f] ?? '').toString().toLowerCase()
    return v && v.includes(q)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: RowSearchBar — inline search for timesheet data tables.
// Used by Live, Daily and Monthly tabs.
// ─────────────────────────────────────────────────────────────────────────────
const RowSearchBar = ({ value, onChange, totalCount, matchCount }) => (
  <div className="flex items-center gap-3">
    <div className="relative flex-1 max-w-sm">
      <HeroIcons.MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search name, code, email, dept…"
        autoComplete="off"
        className="w-full pl-9 pr-8 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
          aria-label="Clear search"
        >
          <HeroIcons.XMarkIcon className="w-4 h-4" />
        </button>
      )}
    </div>
    {value && (
      <span className="text-xs text-slate-500">
        {matchCount} of {totalCount} rows
      </span>
    )}
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// Live-tab filter predicates (soft-coded)
// Backend stamps `is_in` (bool) and `is_late` (bool) on every live row.
// `null` value means "show all rows" (no filter applied).
// ─────────────────────────────────────────────────────────────────────────────
const LIVE_FILTER_FNS = {
  in:      (r) => r.is_in === true,
  out:     (r) => r.is_in === false,
  late:    (r) => r.is_late === true,
  total:   null,
  matched: (r) => Boolean(r.radai_user_id),
}

const LIVE_FILTER_LABELS = {
  in:      'Currently IN',
  out:     'Currently OUT',
  late:    'Late Today',
  total:   'All Seen Today',
  matched: 'Matched to RAD AI',
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: KPI cards (Live tab)
// ─────────────────────────────────────────────────────────────────────────────
const LiveKpis = ({ summary, asOf, activeFilter, onFilterChange }) => {
  const tiles = [
    { id: 'in',      label: 'Currently IN',      value: summary?.currently_in    ?? 0, accent: 'from-emerald-500 to-teal-600',   icon: 'ArrowRightOnRectangleIcon' },
    { id: 'out',     label: 'Currently OUT',     value: summary?.currently_out   ?? 0, accent: 'from-slate-500 to-slate-700',    icon: 'ArrowLeftOnRectangleIcon' },
    { id: 'late',    label: 'Late Today',        value: summary?.late_today      ?? 0, accent: 'from-amber-500 to-orange-600',   icon: 'ClockIcon' },
    { id: 'total',   label: 'Seen Today',        value: summary?.total_seen_today ?? 0, accent: 'from-blue-500 to-indigo-600',    icon: 'UsersIcon' },
    { id: 'matched', label: 'Matched to RAD AI', value: summary?.matched_to_radai ?? 0, accent: 'from-purple-500 to-fuchsia-600', icon: 'LinkIcon' },
  ]
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {tiles.map(t => {
          const isActive = activeFilter === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onFilterChange(isActive ? null : t.id)}
              title={isActive ? `Clear "${t.label}" filter` : `Filter by ${t.label}`}
              className={[
                'relative overflow-hidden rounded-xl bg-gradient-to-br text-white p-4 shadow-md text-left w-full',
                t.accent,
                'transition-all duration-150',
                isActive
                  ? 'ring-4 ring-white/60 scale-[1.04] shadow-xl'
                  : 'hover:scale-[1.02] hover:shadow-lg',
                activeFilter && !isActive ? 'opacity-40' : 'opacity-100',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-1">
                <Icon name={t.icon} className="w-6 h-6 opacity-80 flex-shrink-0" />
                <span className="text-[10px] uppercase tracking-wider opacity-80 text-right leading-tight">{t.label}</span>
              </div>
              <div className="mt-2 text-3xl font-bold leading-tight">{t.value}</div>
              {isActive && (
                <div className="absolute bottom-1.5 right-2 text-[9px] font-semibold uppercase tracking-widest opacity-90 flex items-center gap-0.5">
                  <HeroIcons.FunnelIcon className="w-3 h-3" /> active
                </div>
              )}
            </button>
          )
        })}
      </div>
      {asOf && (
        <div className="text-xs text-slate-500 text-right">
          Updated {new Date(asOf).toLocaleTimeString()} · auto-refresh every {Math.round(TIMESHEET_POLL_MS / 1000)}s
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: Generic data table
// ─────────────────────────────────────────────────────────────────────────────
const DataTable = ({ rows, columns, emptyMessage }) => {
  if (!rows || rows.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
        <HeroIcons.InboxIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <div className="text-sm text-slate-600">{emptyMessage || 'No data for this period.'}</div>
      </div>
    )
  }
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {columns.map(c => (
                <th key={c.id} className="text-left px-3 py-2 font-semibold text-slate-700 uppercase text-[11px] tracking-wider">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={r.employee_code || r.radai_user_id || i} className="hover:bg-slate-50">
                {columns.map(c => {
                  const v = c.accessor(r)
                  // Soft-coded cell renderer dispatch — `cellType` on the
                  // column declares the renderer (kept in the config as a
                  // string so timesheet.config.js stays JSX-free).
                  if (c.cellType === 'email') {
                    const e = (v || '').toString().trim()
                    return (
                      <td key={c.id} className="px-3 py-2 text-slate-800 whitespace-nowrap">
                        {e && e.includes('@')
                          ? <a href={`mailto:${e}`} className="text-blue-700 hover:underline" title={e}>{e}</a>
                          : <span className="text-slate-400">—</span>}
                      </td>
                    )
                  }
                  // Soft-coded punch-type badge — labels come from PUNCH_TYPE_LABELS
                  // in timesheet.config.js so display text never needs a code change.
                  if (c.cellType === 'punch_type') {
                    const isIn  = v === PUNCH_TYPE_LABELS.in
                    const isOut = v === PUNCH_TYPE_LABELS.out
                    return (
                      <td key={c.id} className="px-3 py-2 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          isIn  ? 'bg-emerald-100 text-emerald-700' :
                          isOut ? 'bg-rose-100 text-rose-700' :
                                  'bg-slate-100 text-slate-500'
                        }`}>
                          {isIn  && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                          {isOut && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
                          {v}
                        </span>
                      </td>
                    )
                  }
                  return (
                    <td key={c.id} className="px-3 py-2 text-slate-800 whitespace-nowrap">
                      {v}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: Health banner (shown when not configured / driver missing / connection failed)
// ─────────────────────────────────────────────────────────────────────────────
const HealthBanner = ({ health, onOpenSetup }) => {
  if (!health) return null
  const { driver, config, ping } = health
  // Soft-coded backend mode. Falls back to legacy behaviour if the backend
  // doesn't yet return `data_source` (older deployments).
  const dataSource = (health.data_source || config?.data_source || 'sqlserver').toLowerCase()

  let title, subtitle, tone = TIMESHEET_STATUS_TONES.unconfigured

  // ── Mirror mode (production / Railway): no SQL Server reachability concept.
  // Decide based on the local Postgres mirror table.
  if (dataSource === 'mirror') {
    if (ping?.ok) return null  // Healthy mirror with events → no banner.
    if (ping?.error) {
      title = TIMESHEET_COPY.mirrorErrorTitle
      subtitle = `${TIMESHEET_COPY.mirrorErrorSubtitle}\n${ping.error}`
    } else {
      title = TIMESHEET_COPY.mirrorEmptyTitle
      subtitle = TIMESHEET_COPY.mirrorEmptySubtitle
    }
  // ── SQL Server (direct LAN) mode: original behaviour.
  } else if (!driver?.driver_in_use) {
    title = TIMESHEET_COPY.driverMissingTitle
    subtitle = TIMESHEET_COPY.driverMissingSubtitle
  } else if (!config?.configured) {
    title = TIMESHEET_COPY.notConfiguredTitle
    subtitle = TIMESHEET_COPY.notConfiguredSubtitle
  } else if (ping && ping.ok === false) {
    title = TIMESHEET_COPY.connectionFailedTitle
    subtitle = `${TIMESHEET_COPY.connectionFailedSubtitle}\nDriver error: ${ping.error || 'unknown'}`
  } else {
    return null
  }

  return (
    <div className={`border rounded-xl p-4 flex items-start gap-3 ${tone}`}>
      <HeroIcons.ExclamationTriangleIcon className="w-6 h-6 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <div className="font-semibold">{title}</div>
        <div className="text-sm mt-1 whitespace-pre-line opacity-90">{subtitle}</div>
      </div>
      <button
        type="button"
        onClick={onOpenSetup}
        className="px-3 py-1.5 bg-white text-rose-700 border border-rose-200 rounded-md text-xs font-semibold hover:bg-rose-50"
      >
        Open Setup
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Live
// ─────────────────────────────────────────────────────────────────────────────
const LiveTab = ({ refreshTick, onManualRefresh }) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeFilter, setActiveFilter] = useState(null)
  const [rowSearch, setRowSearch] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    // Soft-coded: add cache-busting timestamp to force fresh data
    const cacheBuster = Date.now()
    
    // Log fetch attempt for debugging production issues
    if (window.location.hostname !== 'localhost') {
      console.log(`[Timesheet] 📡 Fetching live attendance data (tick: ${refreshTick}, cache: ${cacheBuster})`)
    }
    
    timesheetService.fetchLive(cacheBuster)
      .then(d => { 
        if (!cancelled) { 
          setData(d); 
          setError(null);
          if (window.location.hostname !== 'localhost') {
            console.log(`[Timesheet] ✅ Live data loaded: ${d?.rows?.length || 0} rows, summary:`, d?.summary)
          }
        } 
      })
      .catch(e => { 
        if (!cancelled) {
          const errMsg = fmtError(e);
          setError(errMsg);
          if (window.location.hostname !== 'localhost') {
            console.error(`[Timesheet] ❌ Failed to fetch live data:`, errMsg, e)
          }
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [refreshTick])

  // Manual refresh handler - bypasses cache
  const handleManualRefresh = useCallback(() => {
    setIsRefreshing(true)
    onManualRefresh()
    // Reset refreshing state after animation
    setTimeout(() => setIsRefreshing(false), 1000)
  }, [onManualRefresh])

  const allRows = data?.rows || []
  const filterFn = activeFilter ? LIVE_FILTER_FNS[activeFilter] : null
  const q = rowSearch.trim().toLowerCase()
  const filteredRows = allRows
    .filter(r => filterFn ? filterFn(r) : true)
    .filter(r => rowMatchesQuery(r, q))

  if (loading && !data) {
    return <div className="text-center text-slate-500 py-10">Loading live status…</div>
  }
  if (error) {
    return <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-lg">{error}</div>
  }
  if (data?.configured === false) {
    return null  // The HealthBanner above already explains; no extra noise here.
  }

  // Soft-coded: when the rolling window returns 0 rows (e.g. sync agent
  // hasn't run yet today, or timezone boundary mismatch), show a helpful
  // diagnostic banner instead of a silent empty table.
  const windowFrom = data?.window_from
  const fmtWindowFrom = windowFrom
    ? new Date(windowFrom).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
    : null

  return (
    <div className="space-y-4">
      {/* ── Soft-coded window label + Refresh button ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
          <HeroIcons.ClockIcon className="w-3.5 h-3.5 text-slate-400" />
          {fmtWindowFrom && (
            <>
              {TIMESHEET_COPY.liveWindowPrefix}{' '}
              <span className="font-semibold text-slate-700">{fmtWindowFrom}</span>
              {data?.lookback_hours && (
                <span className="ml-1 text-slate-400">({data.lookback_hours} h window)</span>
              )}
            </>
          )}
          {!fmtWindowFrom && <span className="text-slate-400">Loading...</span>}
        </div>
        
        {/* Soft-coded: Manual refresh button - bypasses cache and triggers sync */}
        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={isRefreshing || loading}
          className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
            isRefreshing || loading
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
          }`}
          title="Fetch latest punch data from server (bypasses cache)"
        >
          <HeroIcons.ArrowPathIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>
      
      <LiveKpis
        summary={data?.summary}
        asOf={data?.as_of}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />
      <RowSearchBar
        value={rowSearch}
        onChange={setRowSearch}
        totalCount={allRows.filter(r => filterFn ? filterFn(r) : true).length}
        matchCount={filteredRows.length}
      />
      {activeFilter && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
          <div className="text-sm text-blue-800 font-medium flex items-center gap-2">
            <HeroIcons.FunnelIcon className="w-4 h-4" />
            Showing{' '}
            <span className="font-bold">{filteredRows.length}</span>
            {' '}of{' '}
            <span className="font-bold">{allRows.length}</span>
            {' '}employees — Filter: <span className="font-bold">{LIVE_FILTER_LABELS[activeFilter]}</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveFilter(null)}
            className="text-xs text-blue-700 hover:text-blue-900 font-semibold flex items-center gap-1"
          >
            <HeroIcons.XMarkIcon className="w-4 h-4" />
            Clear filter
          </button>
        </div>
      )}

      {/* ── Soft-coded stale sync diagnostic banner (when DB has data but it's too old) ── */}
      {allRows.length === 0 && !activeFilter && !q && data?.sync_stale && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
          <HeroIcons.ExclamationTriangleIcon className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-rose-800">{TIMESHEET_COPY.liveStaleSyncTitle}</div>
            <div className="text-xs text-rose-700 mt-1">{TIMESHEET_COPY.liveStaleSyncSubtitle}</div>
            <div className="mt-2 space-y-1">
              {data.mirror_latest_event && (
                <div className="text-xs text-rose-600 flex items-center gap-1">
                  <HeroIcons.ClockIcon className="w-3 h-3" />
                  {TIMESHEET_COPY.liveStaleSyncLastEvent}{' '}
                  <span className="font-semibold">
                    {new Date(data.mirror_latest_event).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
              )}
              {data.sync_age_days && (
                <div className="text-xs text-rose-600 flex items-center gap-1">
                  <HeroIcons.ExclamationCircleIcon className="w-3 h-3" />
                  {TIMESHEET_COPY.liveStaleSyncAge}{' '}
                  <span className="font-semibold">
                    {data.sync_age_days < 1 
                      ? `${data.sync_age_hours} hours ago`
                      : `${data.sync_age_days} days ago`}
                  </span>
                </div>
              )}
            </div>
            <div className="mt-3 text-xs font-semibold text-rose-800 bg-rose-100 border border-rose-300 rounded px-3 py-2">
              🔧 {TIMESHEET_COPY.liveStaleSyncAction}
            </div>
          </div>
        </div>
      )}

      {/* ── Soft-coded no-data diagnostic banner (shown only when 0 rows + no filter + no stale data) ── */}
      {allRows.length === 0 && !activeFilter && !q && !data?.sync_stale && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <HeroIcons.ExclamationTriangleIcon className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-amber-800">{TIMESHEET_COPY.liveNoDataTitle}</div>
            <div className="text-xs text-amber-700 mt-1">{TIMESHEET_COPY.liveNoDataSubtitle}</div>
            {fmtWindowFrom && (
              <div className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                <HeroIcons.ClockIcon className="w-3 h-3" />
                Window checked: {fmtWindowFrom} →{' '}
                {data?.as_of ? new Date(data.as_of).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : TIMESHEET_COPY.liveSyncUnknown}
              </div>
            )}
          </div>
        </div>
      )}

      <DataTable
        rows={filteredRows}
        columns={TIMESHEET_LIVE_COLUMNS}
        emptyMessage={
          q              ? `No rows match "${rowSearch}".` :
          activeFilter   ? `No employees match "${LIVE_FILTER_LABELS[activeFilter]}".` :
          /* else */       TIMESHEET_COPY.liveNoDataTitle
        }
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Daily
// ─────────────────────────────────────────────────────────────────────────────
const DailyTab = () => {
  const [date, setDate] = useState(todayISO())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [rowSearch, setRowSearch] = useState('')

  const load = useCallback(() => {
    setLoading(true); setError(null)
    timesheetService.fetchDaily(date)
      .then(setData)
      .catch(e => setError(fmtError(e)))
      .finally(() => setLoading(false))
  }, [date])

  useEffect(load, [load])

  const allRows = data?.rows || []
  const q = rowSearch.trim().toLowerCase()
  const filteredRows = allRows.filter(r => rowMatchesQuery(r, q))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-700">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
          max={todayISO()}
        />
        <button
          type="button"
          onClick={load}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>
      <RowSearchBar value={rowSearch} onChange={setRowSearch} totalCount={allRows.length} matchCount={filteredRows.length} />
      {error && <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg text-sm">{error}</div>}
      {loading ? (
        <div className="text-center text-slate-500 py-6">Loading…</div>
      ) : data?.configured === false ? null : (
        <DataTable rows={filteredRows} columns={TIMESHEET_DAILY_COLUMNS} emptyMessage={q ? `No rows match "${rowSearch}".` : `No attendance for ${date}.`} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Monthly
// ─────────────────────────────────────────────────────────────────────────────
const MonthlyTab = () => {
  const [year, setYear] = useState(now())
  const [month, setMonth] = useState(thisMonth())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [rowSearch, setRowSearch] = useState('')

  const load = useCallback(() => {
    setLoading(true); setError(null)
    timesheetService.fetchMonthly(year, month)
      .then(setData)
      .catch(e => setError(fmtError(e)))
      .finally(() => setLoading(false))
  }, [year, month])

  useEffect(load, [load])

  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  const years  = Array.from({ length: 5 }, (_, i) => now() - 2 + i)

  const allRows = data?.rows || []
  const q = rowSearch.trim().toLowerCase()
  const filteredRows = allRows.filter(r => rowMatchesQuery(r, q))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-700">Period</label>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm">
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm">
          {months.map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
        </select>
        <button type="button" onClick={load} className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
          Refresh
        </button>
        {data?.working_days_in_month != null && (
          <span className="text-xs text-slate-500 ml-auto">
            Working days in month: <span className="font-semibold text-slate-700">{data.working_days_in_month}</span>
          </span>
        )}
      </div>
      <RowSearchBar value={rowSearch} onChange={setRowSearch} totalCount={allRows.length} matchCount={filteredRows.length} />
      {error && <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg text-sm">{error}</div>}
      {loading ? (
        <div className="text-center text-slate-500 py-6">Loading…</div>
      ) : data?.configured === false ? null : (
        <DataTable rows={filteredRows} columns={TIMESHEET_MONTHLY_COLUMNS} emptyMessage={q ? `No rows match "${rowSearch}".` : 'No attendance in this month.'} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Reports
// ─────────────────────────────────────────────────────────────────────────────
const ReportsTab = () => {
  const [date, setDate] = useState(todayISO())
  const [year, setYear] = useState(now())
  const [month, setMonth] = useState(thisMonth())
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  const wrap = (key, fn) => async () => {
    setBusy(key); setError(null)
    try { await fn() } catch (e) { setError(fmtError(e)) } finally { setBusy(null) }
  }

  return (
    <div className="space-y-5">
      {error && <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg text-sm">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="font-semibold text-slate-900 flex items-center gap-2">
          <HeroIcons.CalendarDaysIcon className="w-5 h-5 text-blue-600" /> Daily Report
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
          <button type="button" disabled={!!busy} onClick={wrap('daily-xlsx', () => timesheetService.downloadDailyExcel(date))}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
            {busy === 'daily-xlsx' ? 'Generating…' : 'Download Excel'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="font-semibold text-slate-900 flex items-center gap-2">
          <HeroIcons.CalendarIcon className="w-5 h-5 text-blue-600" /> Monthly Report
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm">
            {Array.from({ length: 5 }, (_, i) => now() - 2 + i).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
          </select>
          <button type="button" disabled={!!busy} onClick={wrap('monthly-xlsx', () => timesheetService.downloadMonthlyExcel(year, month))}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
            {busy === 'monthly-xlsx' ? 'Generating…' : 'Download Excel'}
          </button>
          <button type="button" disabled={!!busy} onClick={wrap('monthly-pdf', () => timesheetService.downloadMonthlyPdf(year, month))}
                  className="px-3 py-1.5 bg-rose-600 text-white rounded-md text-sm font-medium hover:bg-rose-700 disabled:opacity-50">
            {busy === 'monthly-pdf' ? 'Generating…' : 'Download PDF'}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Monthly reports include per-employee totals, per-day drilldown, late arrivals and full/half-day counts.
          Configure <code className="bg-slate-100 px-1 rounded">TIMESHEET_REPORT_RECIPIENTS</code> in <code className="bg-slate-100 px-1 rounded">backend/.env</code> to receive these automatically by email each month.
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Setup (Discovery wizard)
// ─────────────────────────────────────────────────────────────────────────────
const SetupTab = ({ health, onHealthRefresh }) => {
  const [databases, setDatabases] = useState([])
  const [database, setDatabase] = useState('')
  const [tables, setTables] = useState([])
  const [table, setTable] = useState('')
  const [columns, setColumns] = useState([])
  const [preview, setPreview] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const driverOK = !!health?.driver?.driver_in_use

  const loadDatabases = useCallback(async () => {
    setBusy(true); setError(null)
    try {
      const r = await timesheetService.listDatabases()
      setDatabases(r.databases || [])
    } catch (e) { setError(fmtError(e)) } finally { setBusy(false) }
  }, [])

  useEffect(() => {
    if (driverOK) loadDatabases()
  }, [driverOK, loadDatabases])

  const onPickDatabase = async (db) => {
    setDatabase(db); setTables([]); setTable(''); setColumns([]); setPreview([])
    if (!db) return
    setBusy(true); setError(null)
    try {
      const r = await timesheetService.listTables(db)
      setTables(r.tables || [])
    } catch (e) { setError(fmtError(e)) } finally { setBusy(false) }
  }

  const onPickTable = async (tbl) => {
    setTable(tbl); setColumns([]); setPreview([])
    if (!tbl) return
    setBusy(true); setError(null)
    try {
      const [c, p] = await Promise.all([
        timesheetService.listColumns(database, tbl),
        timesheetService.previewTable(database, tbl, 5),
      ])
      setColumns(c.columns || [])
      setPreview(p.rows || [])
    } catch (e) { setError(fmtError(e)) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-5">
      {/* Health snapshot */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="font-semibold text-slate-900 flex items-center gap-2 mb-2">
          <HeroIcons.HeartIcon className="w-5 h-5 text-rose-500" /> Server Health
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Stat label="Host" value={health?.sqlserver_host || '—'} />
          <Stat label="Port" value={health?.sqlserver_port || '—'} />
          <Stat label="Driver" value={health?.driver?.driver_in_use || 'not installed'} ok={!!health?.driver?.driver_in_use} />
          <Stat label="Configured" value={health?.config?.configured ? 'yes' : 'no'} ok={!!health?.config?.configured} />
          <Stat label="Credentials" value={health?.config?.credentials ? 'set' : 'missing'} ok={!!health?.config?.credentials} />
          <Stat label="Database" value={health?.config?.database_selected ? 'set' : 'not set'} ok={!!health?.config?.database_selected} />
          <Stat label="Table" value={health?.config?.table_selected ? 'set' : 'not set'} ok={!!health?.config?.table_selected} />
          <Stat label="Variant" value={health?.config?.schema_variant || '—'} />
        </div>
        {health?.ping && !health.ping.ok && (
          <div className="mt-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-2">
            Last ping failed: {health.ping.error || 'unknown error'}
          </div>
        )}
        <button type="button" onClick={onHealthRefresh} className="mt-3 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold hover:bg-slate-200">
          Re-test connection
        </button>
      </div>

      {/* Discovery wizard */}
      {driverOK && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="font-semibold text-slate-900 flex items-center gap-2">
            <HeroIcons.MagnifyingGlassIcon className="w-5 h-5 text-blue-600" /> Discovery Wizard
          </div>

          {error && <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg text-sm">{error}</div>}

          <div className="grid md:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">1. Database</span>
              <select value={database} onChange={(e) => onPickDatabase(e.target.value)} disabled={busy} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm">
                <option value="">— select —</option>
                {databases.map(d => <option key={d.database_name} value={d.database_name}>{d.database_name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">2. Table</span>
              <select value={table} onChange={(e) => onPickTable(e.target.value)} disabled={busy || !database} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm">
                <option value="">— select —</option>
                {tables.map(t => <option key={t.qualified_name} value={t.qualified_name}>{t.qualified_name}</option>)}
              </select>
            </label>
          </div>

          {columns.length > 0 && (
            <div>
              <div className="text-xs font-medium text-slate-600 mb-1">3. Columns ({columns.length})</div>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto bg-slate-50 border border-slate-200 rounded-lg p-2">
                {columns.map(c => (
                  <span key={c.column_name} className="bg-white border border-slate-200 rounded px-2 py-0.5 text-xs">
                    <span className="font-medium text-slate-800">{c.column_name}</span>
                    <span className="text-slate-400 ml-1">{c.data_type}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {preview.length > 0 && (
            <div>
              <div className="text-xs font-medium text-slate-600 mb-1">4. Preview ({preview.length} rows)</div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-x-auto max-h-60">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-100">
                    <tr>
                      {Object.keys(preview[0]).map(k => (
                        <th key={k} className="text-left px-2 py-1 font-semibold text-slate-700 sticky top-0 bg-slate-100 z-10">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={i} className="border-t border-slate-200">
                        {Object.keys(preview[0]).map(k => (
                          <td key={k} className="px-2 py-1 text-slate-700">{String(r[k] ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Env-var cheat sheet */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
        <div className="font-semibold text-slate-900 flex items-center gap-2">
          <HeroIcons.KeyIcon className="w-5 h-5 text-amber-500" /> Environment Variables
        </div>
        <p className="text-xs text-slate-600">
          Add these to <code className="bg-slate-100 px-1 rounded">backend/.env</code> and restart the backend container:
          <code className="bg-slate-100 px-1 rounded ml-1">docker-compose --profile local restart backend</code>
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-2 py-1.5 font-semibold text-slate-700">Variable</th>
                <th className="text-left px-2 py-1.5 font-semibold text-slate-700">Example</th>
                <th className="text-left px-2 py-1.5 font-semibold text-slate-700">Required</th>
                <th className="text-left px-2 py-1.5 font-semibold text-slate-700">Hint</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {TIMESHEET_ENV_VARS.map(v => (
                <tr key={v.name}>
                  <td className="px-2 py-1.5 font-mono text-slate-800">{v.name}</td>
                  <td className="px-2 py-1.5 font-mono text-slate-500">{v.example}</td>
                  <td className="px-2 py-1.5">
                    {v.required ? (
                      <span className="text-rose-700 font-semibold">Yes</span>
                    ) : (
                      <span className="text-slate-400">No</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-slate-600">{v.hint}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const Stat = ({ label, value, ok }) => (
  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
    <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    <div className={`text-sm font-semibold mt-0.5 ${ok === false ? 'text-rose-700' : ok === true ? 'text-emerald-700' : 'text-slate-800'}`}>{value}</div>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
const TimeSheetAnalytics = () => {
  const [activeTab, setActiveTab] = useState(TIMESHEET_DEFAULT_TAB)
  const [health, setHealth] = useState(null)
  const [healthError, setHealthError] = useState(null)
  const [liveTick, setLiveTick] = useState(0)

  const loadHealth = useCallback(async () => {
    try {
      const h = await timesheetService.fetchHealth()
      setHealth(h)
      setHealthError(null)
    } catch (e) {
      setHealthError(fmtError(e))
    }
  }, [])

  // Soft-coded: manual refresh handler for Live tab
  const refreshLiveData = useCallback(() => {
    setLiveTick(t => t + 1)
  }, [])

  useEffect(() => { loadHealth() }, [loadHealth])

  // Live tab auto-refresh
  useEffect(() => {
    if (activeTab !== 'live') return
    const id = setInterval(() => setLiveTick(t => t + 1), TIMESHEET_POLL_MS)
    return () => clearInterval(id)
  }, [activeTab])

  const goToSetup = () => setActiveTab('setup')

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <HeroIcons.ClockIcon className="w-6 h-6 text-blue-600" />
            {TIMESHEET_COPY.title}
          </h2>
          <p className="text-sm text-slate-500 mt-1 max-w-3xl">{TIMESHEET_COPY.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={loadHealth}
          className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md text-xs font-medium hover:bg-slate-200 flex items-center gap-1"
        >
          <HeroIcons.ArrowPathIcon className="w-4 h-4" />
          Refresh status
        </button>
      </div>

      {healthError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg text-sm">
          Health check failed: {healthError}
        </div>
      )}

      <HealthBanner health={health} onOpenSetup={goToSetup} />

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex flex-wrap gap-1 -mb-px">
          {TIMESHEET_TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
                activeTab === t.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
              title={t.description}
            >
              <Icon name={t.icon} className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab body */}
      <div>
        {activeTab === 'live'    && <LiveTab refreshTick={liveTick} onManualRefresh={refreshLiveData} />}
        {activeTab === 'daily'   && <DailyTab />}
        {activeTab === 'monthly' && <MonthlyTab />}
        {activeTab === 'reports' && <ReportsTab />}
        {activeTab === 'setup'   && <SetupTab health={health} onHealthRefresh={loadHealth} />}
      </div>
    </div>
  )
}

export default TimeSheetAnalytics
