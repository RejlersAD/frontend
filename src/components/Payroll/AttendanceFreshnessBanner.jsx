/**
 * AttendanceFreshnessBanner
 * =========================
 * Shows the freshness of attendance data used for payroll calculation.
 * Attendance is the key input to payroll — this banner makes the data basis
 * visible and actionable so payroll is never run on stale or missing data.
 *
 * The parent owns loading so the dashboard performs one attendance request.
 */
/* eslint-disable react/prop-types */
import * as HeroIcons from '@heroicons/react/24/outline'

const STALE_DAYS = 1

export default function AttendanceFreshnessBanner({ summary, loading = false, error = null, onRefresh }) {

  const pct = summary ? Number(summary.attendance_complete_pct || 0) : 0
  const isStale = summary
    ? new Date(summary.last_synced_at || 0) < new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000)
    : true
  const criticalAnomalies = (summary?.anomalies || []).filter(a => a.severity === 'critical')

  const tone = pct >= 95 && !isStale && criticalAnomalies.length === 0
    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
    : pct >= 70 && !isStale
    ? 'bg-amber-50 border-amber-200 text-amber-800'
    : 'bg-rose-50 border-rose-200 text-rose-800'

  const Icon = pct >= 95 && !isStale && criticalAnomalies.length === 0
    ? HeroIcons.CheckCircleIcon
    : pct >= 70 && !isStale
    ? HeroIcons.ExclamationTriangleIcon
    : HeroIcons.ExclamationCircleIcon

  if (!summary && !loading && !error) return null

  return (
    <div className={`mb-4 rounded-lg border p-4 ${tone} flex items-start gap-3`}>
      <div className="flex h-6 w-6 shrink-0 items-center justify-center">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-slate-500 animate-pulse">
            <HeroIcons.ArrowPathIcon className="h-4 w-4 animate-spin" />
            <span>Verifying attendance data freshness…</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <HeroIcons.ExclamationCircleIcon className="h-4 w-4 text-rose-500" />
            <span className="font-medium">{error}</span>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="text-xs underline underline-offset-4 hover:text-rose-600"
              >
                Retry
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-1 text-sm font-semibold">
              <span>{summary.complete_count}/{summary.employee_count}</span>
              <span className="text-xs text-slate-500">employees with complete attendance</span>
            </div>
            <div className="flex items-baseline gap-1 text-sm font-semibold">
              <span>{pct}%</span>
              <span className="text-xs text-slate-500">attendance completeness</span>
            </div>
            {summary.last_synced_at && (
              <div className="text-xs text-slate-500">
                Attendance last synced:{' '}
                <span className={isStale ? 'font-medium text-rose-600' : 'font-medium text-emerald-600'}>
                  {new Date(summary.last_synced_at).toLocaleString()}
                  {isStale ? ' (stale)' : ''}
                </span>
              </div>
            )}
            {criticalAnomalies.length > 0 && (
              <div className="text-xs font-medium text-rose-600 mt-1">
                {criticalAnomalies.length} critical attendance {criticalAnomalies.length === 1 ? 'anomaly' : 'anomalies'}
                {' — '}payroll release blocked until resolved.
              </div>
            )}
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="mt-2 text-xs underline underline-offset-4 hover:text-indigo-600"
              >
                Refresh attendance data
              </button>
            )}
          </>
        )}
      </div>
      {summary && !loading && !error && (
        <div className="ml-auto flex items-center gap-2 text-right hidden sm:block">
          <div className="text-xs text-slate-500">Payroll-ready basis</div>
          <div className="text-xs font-semibold">
            {criticalAnomalies.length === 0 ? 'READY' : 'BLOCKED'}
          </div>
        </div>
      )}
    </div>
  )
}
