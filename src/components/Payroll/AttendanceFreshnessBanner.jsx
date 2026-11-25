/** Compact attendance-readiness notification for payroll review. */
/* eslint-disable react/prop-types */
import * as HeroIcons from '@heroicons/react/24/outline'

const STALE_DAYS = 1

export default function AttendanceFreshnessBanner({ summary, loading = false, error = null, onRefresh }) {
  const pct = summary ? Number(summary.attendance_complete_pct || 0) : 0
  const isStale = summary
    ? new Date(summary.last_synced_at || 0) < new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000)
    : true
  const warnings = summary?.anomalies || []
  const healthy = pct >= 95 && !isStale && warnings.length === 0
  const tone = healthy
    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
    : 'bg-amber-50 border-amber-200 text-amber-900'
  const Icon = healthy ? HeroIcons.CheckCircleIcon : HeroIcons.ExclamationTriangleIcon

  if (!summary && !loading && !error) return null

  return (
    <div role="status" className={`mb-3 flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 ${tone}`}>
      <Icon className="h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1 text-xs">
        {loading ? (
          <div className="flex items-center gap-2 animate-pulse text-slate-600">
            <HeroIcons.ArrowPathIcon className="h-4 w-4 animate-spin" />
            <span>Checking attendance readiness…</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">Attendance status unavailable: {error}</span>
            {onRefresh && (
              <button onClick={onRefresh} className="shrink-0 underline underline-offset-4 hover:text-amber-700">
                Retry
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold">Attendance review</span>
            <span>{summary.complete_count}/{summary.employee_count} complete ({pct}%)</span>
            {warnings.length > 0 && (
              <span className="font-medium">• {warnings.length} warning{warnings.length === 1 ? '' : 's'}</span>
            )}
            {summary.last_synced_at && (
              <span className={isStale ? 'font-medium' : 'text-slate-600'}>
                • synced {new Date(summary.last_synced_at).toLocaleString()}{isStale ? ' (stale)' : ''}
              </span>
            )}
            {!healthy && <span className="text-slate-600">• advisory only; payroll release remains available</span>}
          </div>
        )}
      </div>
      {onRefresh && summary && !loading && !error && (
        <button onClick={onRefresh} title="Refresh attendance" className="shrink-0 rounded p-1 hover:bg-white/60">
          <HeroIcons.ArrowPathIcon className="h-4 w-4" />
          <span className="sr-only">Refresh attendance</span>
        </button>
      )}
    </div>
  )
}
