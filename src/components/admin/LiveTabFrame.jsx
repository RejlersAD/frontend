import React, { useEffect, useMemo, useState } from 'react';

// ---------------------------------------------------------------------------
// Soft-coded per-tab presentation config for the admin dashboard tabs.
// Each entry drives the wrapper UI (title, accent gradient, KPI mini-strip,
// rotating innovation tips). Add a tab id key here to control its frame —
// nothing else needs to change. Core logic of each inner tab component is
// untouched.
// ---------------------------------------------------------------------------
export const TAB_LIVE_CONFIG = {
  'ml-detection': {
    title: 'Real-time ML Detection',
    subtitle: 'Anomaly detection, classification & alerting pipeline',
    accent: 'from-indigo-600 via-purple-600 to-pink-600',
    icon: '🤖',
    tips: [
      'Models run on every event stream — no manual triggers required.',
      'Severity thresholds are auto-calibrated from rolling 24-hour baselines.',
      'Alerts integrate with the Notification Center and email digests.',
    ],
    kpis: (ctx) => [
      { label: 'WebSocket', value: ctx.mlConnected ? 'Connected' : 'Offline',
        tone: ctx.mlConnected ? 'green' : 'red' },
      { label: 'Live Alerts', value: (ctx.mlAlerts?.length ?? 0).toString(),
        tone: (ctx.mlAlerts?.length ?? 0) > 0 ? 'amber' : 'slate' },
      { label: 'Models Active', value: (ctx.mlMetrics?.active_models ?? '—').toString(),
        tone: 'indigo' },
    ],
  },
  activity: {
    title: 'Real-time Activity Stream',
    subtitle: 'Last actions across every module, refreshed live',
    accent: 'from-blue-600 via-cyan-600 to-teal-500',
    icon: '⚡',
    tips: [
      'Click any row to inspect the raw audit payload.',
      'Pause auto-refresh to investigate a burst without items shifting.',
      'Use search to scope by user, module, or HTTP status.',
    ],
    kpis: (ctx) => [
      { label: 'Events Loaded', value: (ctx.realtimeActivity?.length ?? 0).toString(), tone: 'blue' },
      { label: 'Active Users (today)',
        value: (ctx.analyticsData?.active_users_count ?? 0).toString(), tone: 'indigo' },
      { label: 'API Calls Today',
        value: (ctx.analyticsData?.total_api_requests_today ?? 0).toLocaleString(), tone: 'cyan' },
    ],
  },
  security: {
    title: 'Security Operations Center',
    subtitle: 'Failed logins, anomalies, geo-IP risks & critical alerts',
    accent: 'from-rose-600 via-red-600 to-orange-500',
    icon: '🛡️',
    tips: [
      'Critical alerts auto-escalate to the on-call admin within 5 minutes.',
      'Acknowledge an alert to silence its threshold for the rolling window.',
      'Export selected alerts to CSV for downstream SIEM ingestion.',
    ],
    kpis: (ctx) => [
      { label: 'Active Alerts',
        value: (ctx.securityAlerts?.length ?? ctx.analyticsData?.active_alerts_count ?? 0).toString(),
        tone: (ctx.securityAlerts?.length ?? 0) > 0 ? 'red' : 'green' },
      { label: 'Critical',
        value: (ctx.analyticsData?.critical_alerts_count ?? 0).toString(),
        tone: (ctx.analyticsData?.critical_alerts_count ?? 0) > 0 ? 'red' : 'slate' },
      { label: 'Sessions',
        value: (ctx.analyticsData?.active_connections ?? 0).toString(),
        tone: 'blue' },
    ],
  },
  predictions: {
    title: 'AI Insights & Predictions',
    subtitle: 'Forecasted growth, churn risk, capacity & engagement',
    accent: 'from-violet-600 via-purple-600 to-fuchsia-600',
    icon: '🔮',
    tips: [
      'Confidence ≥ 80% indicates a strong forecast — review weekly.',
      'High-impact insights are surfaced first; click for the model story.',
      'Insights regenerate when underlying data drifts beyond 2σ.',
    ],
    kpis: (ctx) => [
      { label: 'Active Insights',
        value: (ctx.predictions?.length ?? ctx.analyticsData?.active_predictions_count ?? 0).toString(),
        tone: 'violet' },
      { label: 'High Priority',
        value: (ctx.analyticsData?.high_impact_insights_count ?? 0).toString(),
        tone: 'purple' },
      { label: 'Avg. Confidence',
        value: ctx.analyticsData?.avg_prediction_confidence != null
          ? `${Number(ctx.analyticsData.avg_prediction_confidence).toFixed(0)}%`
          : '—',
        tone: 'fuchsia' },
    ],
  },
  health: {
    title: 'System Health & Telemetry',
    subtitle: 'CPU, memory, storage, response time & success rate',
    accent: 'from-emerald-600 via-green-600 to-lime-500',
    icon: '💚',
    tips: [
      'Health score below 70% triggers an automatic SRE notification.',
      'Storage projections use a 7-day rolling regression model.',
      'Click a metric to expand its 1-hour timeline.',
    ],
    kpis: (ctx) => [
      { label: 'Health Score',
        value: ctx.analyticsData?.system_health_score != null
          ? `${Number(ctx.analyticsData.system_health_score).toFixed(1)}%`
          : '—',
        tone: (ctx.analyticsData?.system_health_score ?? 100) >= 90
          ? 'green'
          : (ctx.analyticsData?.system_health_score ?? 100) >= 70 ? 'amber' : 'red' },
      { label: 'Avg Response',
        value: ctx.analyticsData?.avg_response_time_ms != null
          ? `${Number(ctx.analyticsData.avg_response_time_ms).toFixed(0)}ms` : '—',
        tone: 'cyan' },
      { label: 'Success Rate',
        value: ctx.analyticsData?.success_rate_percentage != null
          ? `${Number(ctx.analyticsData.success_rate_percentage).toFixed(1)}%` : '—',
        tone: 'green' },
    ],
  },
  analytics: {
    title: 'Advanced Analytics',
    subtitle: 'Engagement, performance, storage, errors & document AI',
    accent: 'from-blue-600 via-indigo-600 to-violet-600',
    icon: '📊',
    tips: [
      'Use the time-window selector at the top of the dashboard to widen scope.',
      'All cards are derived from live API metrics — no static fixtures.',
      'Export the analytics view via the global Export menu.',
    ],
    kpis: (ctx) => [
      { label: 'Active Users',
        value: (ctx.analyticsData?.active_users_count ?? 0).toString(), tone: 'blue' },
      { label: 'Docs Today',
        value: (ctx.analyticsData?.documents_processed_today ?? 0).toString(), tone: 'teal' },
      { label: 'API Success',
        value: ctx.analyticsData?.success_rate_percentage != null
          ? `${Number(ctx.analyticsData.success_rate_percentage).toFixed(1)}%` : '—',
        tone: 'green' },
    ],
  },
  audit: {
    title: 'Audit & Compliance Log',
    subtitle: 'Append-only record of every privileged action',
    accent: 'from-slate-700 via-gray-700 to-zinc-700',
    icon: '📜',
    tips: [
      'Logs are immutable — only archival/export is permitted.',
      'Filter by actor, target, or action type using the search bar below.',
      'Retention follows the platform-wide 7-year policy.',
    ],
    kpis: (ctx) => [
      { label: 'Retention', value: '7 years', tone: 'slate' },
      { label: 'Today',
        value: (ctx.analyticsData?.audit_events_today ?? '—').toString(), tone: 'zinc' },
      { label: 'Integrity', value: 'Hash-chained', tone: 'green' },
    ],
  },
};

// Tone → Tailwind colour token. Soft-coded so adding a new accent is
// a single line.
const TONE_CLASSES = {
  green:   'bg-green-100 text-green-700 ring-green-300',
  red:     'bg-red-100 text-red-700 ring-red-300',
  amber:   'bg-amber-100 text-amber-700 ring-amber-300',
  blue:    'bg-blue-100 text-blue-700 ring-blue-300',
  cyan:    'bg-cyan-100 text-cyan-700 ring-cyan-300',
  teal:    'bg-teal-100 text-teal-700 ring-teal-300',
  indigo:  'bg-indigo-100 text-indigo-700 ring-indigo-300',
  violet:  'bg-violet-100 text-violet-700 ring-violet-300',
  purple:  'bg-purple-100 text-purple-700 ring-purple-300',
  fuchsia: 'bg-fuchsia-100 text-fuchsia-700 ring-fuchsia-300',
  slate:   'bg-slate-100 text-slate-700 ring-slate-300',
  zinc:    'bg-zinc-100 text-zinc-700 ring-zinc-300',
};

const TIP_ROTATION_MS = 7000;
const PULSE_FRESH_MS = 5000;

const formatRelative = (date) => {
  if (!date) return 'never';
  const diff = Math.max(0, Date.now() - new Date(date).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

/**
 * LiveTabFrame
 *
 * Wrapper that adds a unified, real-time, user-friendly chrome around any
 * admin dashboard tab body. Driven entirely by `TAB_LIVE_CONFIG` —
 * adding a new tab requires only a single config entry.
 *
 * Props:
 *   - tabId      : key into TAB_LIVE_CONFIG
 *   - children   : actual tab body (untouched)
 *   - context    : data bag forwarded to KPI accessors (analyticsData,
 *                  realtimeActivity, securityAlerts, predictions, mlMetrics, …)
 *   - onRefresh  : manual refresh callback (calls the existing loader)
 *   - lastUpdated: timestamp of the most recent successful fetch
 *   - autoRefresh: boolean — whether the parent timer is active
 *   - onToggleAutoRefresh : optional toggle callback
 *   - loading    : boolean — show spinner on the refresh icon
 */
const LiveTabFrame = ({
  tabId,
  children,
  context = {},
  onRefresh,
  lastUpdated,
  autoRefresh = true,
  onToggleAutoRefresh,
  loading = false,
}) => {
  const cfg = TAB_LIVE_CONFIG[tabId];
  const [tipIndex, setTipIndex] = useState(0);
  const [, forceTick] = useState(0);

  // Rotate the innovation tip every TIP_ROTATION_MS.
  useEffect(() => {
    if (!cfg?.tips?.length) return undefined;
    const id = setInterval(
      () => setTipIndex((i) => (i + 1) % cfg.tips.length),
      TIP_ROTATION_MS,
    );
    return () => clearInterval(id);
  }, [cfg]);

  // Drive the relative timestamp.
  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const kpis = useMemo(
    () => (cfg?.kpis ? cfg.kpis(context) : []),
    [cfg, context],
  );

  if (!cfg) return <>{children}</>;

  const isFresh =
    lastUpdated && Date.now() - new Date(lastUpdated).getTime() < PULSE_FRESH_MS;

  return (
    <div className="space-y-4">
      {/* Live header strip */}
      <div
        className={`relative overflow-hidden rounded-xl bg-gradient-to-r ${cfg.accent} text-white shadow-lg`}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, white 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Title + live pulse */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center text-2xl">
                <span aria-hidden="true">{cfg.icon}</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold truncate">
                    {cfg.title}
                  </h3>
                  <span
                    className={`relative flex h-2.5 w-2.5 ${
                      autoRefresh ? '' : 'opacity-40'
                    }`}
                    title={
                      autoRefresh
                        ? 'Auto-refresh ON'
                        : 'Auto-refresh paused'
                    }
                  >
                    {autoRefresh && (
                      <span
                        className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                          isFresh ? 'bg-green-300' : 'bg-white/60'
                        } opacity-75`}
                      />
                    )}
                    <span
                      className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                        autoRefresh
                          ? isFresh
                            ? 'bg-green-300'
                            : 'bg-white'
                          : 'bg-white/60'
                      }`}
                    />
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-white/80 truncate">
                  {cfg.subtitle}
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm">
                Updated{' '}
                <span className="font-semibold">
                  {formatRelative(lastUpdated)}
                </span>
              </span>
              {onToggleAutoRefresh && (
                <button
                  type="button"
                  onClick={onToggleAutoRefresh}
                  className="px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm transition"
                  title="Toggle auto-refresh"
                >
                  {autoRefresh ? '⏸ Pause' : '▶ Resume'}
                </button>
              )}
              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={loading}
                  className="px-2.5 py-1 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm transition disabled:opacity-50 flex items-center gap-1"
                  title="Refresh now"
                >
                  <svg
                    className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Refresh
                </button>
              )}
            </div>
          </div>

          {/* KPI mini-strip */}
          {kpis.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
              {kpis.map((k, i) => (
                <div
                  key={`${k.label}-${i}`}
                  className="rounded-lg bg-white/10 backdrop-blur-sm px-3 py-2 ring-1 ring-white/20"
                >
                  <div className="text-[10px] uppercase tracking-wide text-white/70">
                    {k.label}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span
                      className={`inline-flex w-2 h-2 rounded-full ring-2 ${
                        TONE_CLASSES[k.tone] || TONE_CLASSES.slate
                      }`}
                    />
                    <span className="text-sm sm:text-base font-bold truncate">
                      {k.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Innovation tip ribbon */}
          {cfg.tips?.length > 0 && (
            <div className="mt-3 text-xs text-white/85 italic flex items-start gap-1.5">
              <span aria-hidden="true">💡</span>
              <span className="flex-1">{cfg.tips[tipIndex]}</span>
            </div>
          )}
        </div>
      </div>

      {/* Inner tab body — untouched */}
      <div>{children}</div>
    </div>
  );
};

export default LiveTabFrame;
