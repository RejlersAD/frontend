/**
 * Internal Sales Intelligence Dashboard  ·  /sales
 * ══════════════════════════════════════════════════
 * Three tabs: Overview | Sales Pipeline | Platform Usage
 *
 * SOFT-CODED:
 *   • CONFIG      — tabs, pipeline stages, tiers, colours, refresh timers
 *   • CATEGORY_UI — event-category icon / colour map
 *   • STATUS_STYLE — user-status badge colours
 *
 * To add a tab      → push to CONFIG.tabs, add a case in <TabContent>
 * To add a stage    → push to CONFIG.pipelineStages — nothing else changes
 * To add a colour   → edit CONFIG.disciplineColors
 * To add a category → edit CATEGORY_UI
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, CartesianGrid, Legend,
} from 'recharts';
import {
  ChartBarIcon, UsersIcon, BoltIcon, BanknotesIcon, TrophyIcon,
  ArrowTrendingUpIcon, ArrowTrendingDownIcon, SparklesIcon,
  PlusIcon, ArrowDownTrayIcon,
  PresentationChartLineIcon, RocketLaunchIcon, SignalIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline';
import internalSalesService from '../services/internalSales.service';
import salesService          from '../services/sales.service';

// ─────────────────────────────────────────────────────────────────────────────
// ① SOFT-CODED CONFIG — change ALL behaviour / colours / tabs here ONLY
// ─────────────────────────────────────────────────────────────────────────────
const CONFIG = {
  defaultTab: 'overview',

  // Tab definitions — add a new object here to add a tab
  tabs: [
    { key: 'overview',  label: 'Overview',        icon: '🏠' },
    { key: 'pipeline',  label: 'Sales Pipeline',  icon: '🚀' },
    { key: 'usage',     label: 'Platform Usage',  icon: '📊' },
  ],

  // Time-range selector
  timeRanges: [
    { key: '1d',  label: 'Today'   },
    { key: '7d',  label: '7 Days'  },
    { key: '30d', label: '30 Days' },
    { key: '90d', label: '90 Days' },
  ],

  // Pipeline stages — reorder / add here; JSX auto-renders from this array
  pipelineStages: [
    { key: 'lead',        label: 'Lead',        color: '#94a3b8', badge: 'bg-slate-100 text-slate-700'      },
    { key: 'qualified',   label: 'Qualified',   color: '#3b82f6', badge: 'bg-blue-100 text-blue-700'       },
    { key: 'proposal',    label: 'Proposal',    color: '#8b5cf6', badge: 'bg-violet-100 text-violet-700'   },
    { key: 'negotiation', label: 'Negotiation', color: '#f59e0b', badge: 'bg-amber-100 text-amber-700'     },
    { key: 'closed_won',  label: 'Won ✓',       color: '#10b981', badge: 'bg-emerald-100 text-emerald-700' },
    { key: 'closed_lost', label: 'Lost',        color: '#ef4444', badge: 'bg-red-100 text-red-700'         },
  ],

  // Client tier badge styles
  tierStyle: {
    enterprise: 'bg-purple-100 text-purple-700',
    premium:    'bg-indigo-100 text-indigo-700',
    standard:   'bg-blue-100 text-blue-700',
    basic:      'bg-gray-100 text-gray-600',
  },

  // Discipline chart colours
  disciplineColors: {
    'Process (P&ID)':       '#3b82f6',
    'Digitization (PFD)':   '#8b5cf6',
    'Process Datasheet':    '#06b6d4',
    'Electrical Datasheet': '#f59e0b',
    'CRS Documents':        '#10b981',
    'DesignIQ':             '#ec4899',
    'Finance':              '#6366f1',
    'Procurement':          '#f97316',
    'QHSE':                 '#14b8a6',
    'Project Control':      '#84cc16',
    'Sales':                '#ef4444',
    'Admin / RBAC':         '#64748b',
    'User Management':      '#94a3b8',
    'Other':                '#cbd5e1',
  },

  // Auto-refresh timers (ms)
  refreshIntervalMs:  60_000,
  activeNowRefreshMs: 15_000,
  sessionsRefreshMs:  30_000,
  topUsersLimit:      10,
};

// Soft-coded event-category → icon / colour
const CATEGORY_UI = {
  authentication:   { icon: '🔐', color: 'bg-blue-50 text-blue-700 border-blue-100'      },
  authorization:    { icon: '🛡️', color: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  data_management:  { icon: '🗂️', color: 'bg-teal-50 text-teal-700 border-teal-100'      },
  system_operation: { icon: '⚙️', color: 'bg-gray-50 text-gray-700 border-gray-200'      },
  security:         { icon: '🚨', color: 'bg-red-50 text-red-700 border-red-100'          },
  api:              { icon: '🔌', color: 'bg-purple-50 text-purple-700 border-purple-100' },
  ml_ai:            { icon: '🤖', color: 'bg-pink-50 text-pink-700 border-pink-100'       },
  communication:    { icon: '📨', color: 'bg-yellow-50 text-yellow-700 border-yellow-100' },
  maintenance:      { icon: '🔧', color: 'bg-orange-50 text-orange-700 border-orange-100' },
};

// User-status badge colours (mirrors rbac STATUS_CHOICES)
const STATUS_STYLE = {
  active:    'bg-green-100 text-green-700',
  inactive:  'bg-gray-100 text-gray-500',
  suspended: 'bg-red-100 text-red-700',
  pending:   'bg-yellow-100 text-yellow-700',
};

// ─────────────────────────────────────────────────────────────────────────────
// ② PURE HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const fmt      = n => (n  ?? 0).toLocaleString();

// Soft-coded currency formatter. Defaults match the UAE deployment but the
// API response can override `currency` / `currency_locale` per request so
// the same component works in any region without a code change.
const SALES_CURRENCY_DEFAULTS = { code: 'AED', locale: 'en-AE' };
let SALES_CURRENCY = { ...SALES_CURRENCY_DEFAULTS };
const setSalesCurrency = (code, locale) => {
  if (code)   SALES_CURRENCY.code   = code;
  if (locale) SALES_CURRENCY.locale = locale;
};
// Smart compact currency: "AED 4.2M", "AED 850K", "AED 12,500".
// Falls back to long form for values < 10k so small numbers stay precise.
const fmtCurr = n => {
  if (n == null) return '—';
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  const { code, locale } = SALES_CURRENCY;
  try {
    if (Math.abs(num) >= 10_000) {
      return new Intl.NumberFormat(locale, {
        style: 'currency', currency: code,
        notation: 'compact', maximumFractionDigits: 1,
      }).format(num);
    }
    return new Intl.NumberFormat(locale, {
      style: 'currency', currency: code, maximumFractionDigits: 0,
    }).format(num);
  } catch {
    return `${code} ${num.toLocaleString()}`;
  }
};
const pct      = n => `${(n ?? 0).toFixed(1)}%`;
const discColor = lbl => CONFIG.disciplineColors[lbl] ?? '#64748b';
const safeArr  = v => (Array.isArray(v) ? v : v?.results ?? v?.data ?? []);

// ─────────────────────────────────────────────────────────────────────────────
// ③ MICRO-COMPONENTS (shared across all tabs)
// ─────────────────────────────────────────────────────────────────────────────

// Soft-coded KPI accent palette — cycles based on `tone` prop
const KPI_TONES = {
  indigo:  { from: 'from-indigo-500',  to: 'to-purple-600',  icon: 'bg-indigo-50 text-indigo-600',  bar: 'bg-gradient-to-r from-indigo-500 to-purple-500' },
  emerald: { from: 'from-emerald-500', to: 'to-teal-600',    icon: 'bg-emerald-50 text-emerald-600', bar: 'bg-gradient-to-r from-emerald-500 to-teal-500' },
  amber:   { from: 'from-amber-500',   to: 'to-orange-600',  icon: 'bg-amber-50 text-amber-600',    bar: 'bg-gradient-to-r from-amber-500 to-orange-500' },
  rose:    { from: 'from-rose-500',    to: 'to-pink-600',    icon: 'bg-rose-50 text-rose-600',      bar: 'bg-gradient-to-r from-rose-500 to-pink-500' },
  sky:     { from: 'from-sky-500',     to: 'to-blue-600',    icon: 'bg-sky-50 text-sky-600',        bar: 'bg-gradient-to-r from-sky-500 to-blue-500' },
  violet:  { from: 'from-violet-500',  to: 'to-fuchsia-600', icon: 'bg-violet-50 text-violet-600',  bar: 'bg-gradient-to-r from-violet-500 to-fuchsia-500' },
};

function KpiCard({ icon, label, value, sub, pulse, tone = 'indigo', delta, Icon }) {
  const t = KPI_TONES[tone] ?? KPI_TONES.indigo;
  const deltaUp = typeof delta === 'number' && delta > 0;
  const deltaDown = typeof delta === 'number' && delta < 0;
  return (
    <div className="relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden group">
      {/* Top accent bar */}
      <div className={`absolute inset-x-0 top-0 h-1 ${t.bar}`} />
      <div className="p-5 flex items-start gap-4">
        <div className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 ${t.icon} ${pulse ? 'animate-pulse' : ''} group-hover:scale-105 transition-transform`}>
          {Icon ? <Icon className="h-5 w-5" /> : <span className="text-xl select-none">{icon}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">{label}</p>
          <p className="text-2xl font-black text-gray-900 leading-none tabular-nums">{value}</p>
          <div className="flex items-center gap-2 mt-1.5">
            {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
            {deltaUp && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                <ArrowTrendingUpIcon className="h-3 w-3" />{Math.abs(delta).toFixed(1)}%
              </span>
            )}
            {deltaDown && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-full">
                <ArrowTrendingDownIcon className="h-3 w-3" />{Math.abs(delta).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, subtitle, Icon, accent = 'indigo' }) {
  const accentBg = {
    indigo:  'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber:   'bg-amber-50 text-amber-600',
    rose:    'bg-rose-50 text-rose-600',
    sky:     'bg-sky-50 text-sky-600',
    violet:  'bg-violet-50 text-violet-600',
  }[accent] ?? 'bg-indigo-50 text-indigo-600';
  return (
    <div className="flex items-center gap-3 mb-4">
      {Icon ? (
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${accentBg}`}>
          <Icon className="h-5 w-5" />
        </div>
      ) : (
        <span className="text-2xl select-none">{icon}</span>
      )}
      <div>
        <h2 className="text-base font-bold text-gray-900 leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
    </div>
  );
}

function EmptyState({ icon = '📭', message }) {
  return (
    <div className="flex flex-col items-center py-10 gap-2 text-gray-400">
      <span className="text-4xl select-none">{icon}</span>
      <p className="text-sm">{message}</p>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex flex-col items-center py-16 gap-4">
      <div className="w-10 h-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
      <p className="text-sm text-gray-400 font-medium">Loading…</p>
    </div>
  );
}

function ErrorBanner({ message, onRetry }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-700 text-sm flex gap-2 items-center justify-between">
      <span className="flex gap-2 items-center"><span className="select-none">⚠️</span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="ml-4 text-xs font-semibold underline hover:text-amber-900 whitespace-nowrap">
          Retry
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ③b UNIQUE WIDGETS — SalesHealthRing + QuickActionsBar + MiniSparkline
// ─────────────────────────────────────────────────────────────────────────────

// Soft-coded health-score weights — tune without code change
const HEALTH_WEIGHTS = {
  winRate:       0.35,   // pipeline win %
  pipelineFill:  0.25,   // deals > 0 normalised
  activity:      0.20,   // active users today / total users
  clientHealth:  0.20,   // avg top-client health
};

function computeSalesHealth({ pipeline, overview, clients, activeNow }) {
  const winRate   = Math.min(100, pipeline?.win_rate ?? 0);
  const deals     = pipeline?.total_deals ?? pipeline?.deal_count ?? 0;
  const pipelineFill = Math.min(100, deals * 5);  // 20 deals = 100%
  const totalUsers = overview?.total_users || 1;
  const activityPct = Math.min(100, (activeNow?.length ?? 0) / totalUsers * 100 * 10);
  const topClients = clients?.top ?? [];
  const avgClientHealth = topClients.length
    ? topClients.reduce((s, c) => s + (c.health_score ?? 0), 0) / topClients.length
    : 50;
  const score =
    winRate        * HEALTH_WEIGHTS.winRate      +
    pipelineFill   * HEALTH_WEIGHTS.pipelineFill +
    activityPct    * HEALTH_WEIGHTS.activity     +
    avgClientHealth* HEALTH_WEIGHTS.clientHealth;
  return Math.round(Math.max(0, Math.min(100, score)));
}

function SalesHealthRing({ score, label = 'Sales Health' }) {
  const R = 54, C = 2 * Math.PI * R;
  const dash = (score / 100) * C;
  const tier = score >= 75 ? { txt: 'Excellent', cls: 'text-emerald-600', stroke: '#10b981', bg: 'from-emerald-500 to-teal-500' }
             : score >= 50 ? { txt: 'Healthy',   cls: 'text-sky-600',     stroke: '#0ea5e9', bg: 'from-sky-500 to-blue-500' }
             : score >= 25 ? { txt: 'Needs Focus', cls: 'text-amber-600', stroke: '#f59e0b', bg: 'from-amber-500 to-orange-500' }
             :               { txt: 'Critical',  cls: 'text-rose-600',    stroke: '#ef4444', bg: 'from-rose-500 to-red-500' };
  return (
    <div className="relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden p-5 flex items-center gap-5">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tier.bg}`} />
      <div className="relative h-32 w-32 flex-shrink-0">
        <svg viewBox="0 0 128 128" className="h-32 w-32 -rotate-90">
          <circle cx="64" cy="64" r={R} fill="none" stroke="#f1f5f9" strokeWidth="10" />
          <circle
            cx="64" cy="64" r={R} fill="none"
            stroke={tier.stroke} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={`${dash} ${C}`}
            style={{ transition: 'stroke-dasharray 900ms ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black text-gray-900 tabular-nums">{score}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">score</span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
        <p className={`text-xl font-black mt-0.5 ${tier.cls}`}>{tier.txt}</p>
        <p className="text-xs text-gray-500 mt-1.5 leading-snug">
          Composite of win rate, pipeline depth,<br/>activity & client health.
        </p>
      </div>
    </div>
  );
}

// Soft-coded quick actions — add an entry, it shows up; nothing else to wire
const QUICK_ACTIONS = [
  { key: 'new_deal',     label: 'New Deal',     Icon: PlusIcon,           tone: 'indigo',  tab: 'pipeline' },
  { key: 'new_client',   label: 'New Client',   Icon: BuildingOffice2Icon, tone: 'violet',  tab: 'pipeline' },
  { key: 'export',       label: 'Export CSV',   Icon: ArrowDownTrayIcon,  tone: 'emerald', tab: 'pipeline' },
  { key: 'insights',     label: 'AI Insights',  Icon: SparklesIcon,       tone: 'amber',   tab: 'pipeline' },
  { key: 'usage',        label: 'Platform Usage', Icon: PresentationChartLineIcon, tone: 'sky', tab: 'usage' },
];

function QuickActionsBar({ onAction, activeTab }) {
  const toneBg = {
    indigo:  'hover:bg-indigo-50  hover:text-indigo-700  hover:border-indigo-200',
    violet:  'hover:bg-violet-50  hover:text-violet-700  hover:border-violet-200',
    emerald: 'hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200',
    amber:   'hover:bg-amber-50   hover:text-amber-700   hover:border-amber-200',
    sky:     'hover:bg-sky-50     hover:text-sky-700     hover:border-sky-200',
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <BoltIcon className="h-4 w-4 text-indigo-500" />
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Quick Actions</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map(a => (
          <button
            key={a.key}
            onClick={() => onAction?.(a)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 transition-all ${toneBg[a.tone]}`}
            title={`Go to ${a.label}`}
          >
            <a.Icon className="h-4 w-4" />
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Compact inline sparkline (pure SVG — no deps)
function MiniSparkline({ data = [], color = '#6366f1', height = 28, width = 88 }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = Math.max(1, max - min);
  const step = data.length > 1 ? width / (data.length - 1) : width;
  const points = data.map((v, i) => `${i * step},${height - ((v - min) / span) * height}`).join(' ');
  return (
    <svg width={width} height={height} className="inline-block">
      <polyline fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ④ PIPELINE TAB — stage cards, deals table, client grid, AI insights
// ─────────────────────────────────────────────────────────────────────────────
function StageCard({ stage, summary = {} }) {
  const count = summary.deal_count  ?? summary.count ?? 0;
  const value = summary.total_value ?? summary.value ?? 0;
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${stage.badge}`}>{stage.label}</span>
        <span className="text-xs text-gray-400 font-medium">{count} deal{count !== 1 ? 's' : ''}</span>
      </div>
      <p className="text-2xl font-black text-gray-900">{fmtCurr(value)}</p>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: count > 0 ? '100%' : '6px', backgroundColor: stage.color, minWidth: '6px' }}
        />
      </div>
    </div>
  );
}

function DealsTable({ deals }) {
  const stageMap = Object.fromEntries(CONFIG.pipelineStages.map(s => [s.key, s]));
  if (!deals.length) return <EmptyState icon="🤝" message="No deals found. Add your first deal to get started." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
            <th className="pb-3 pr-4">Deal</th>
            <th className="pb-3 pr-4">Client</th>
            <th className="pb-3 pr-4">Stage</th>
            <th className="pb-3 pr-4 text-right">Value</th>
            <th className="pb-3 pr-4 text-center">Win %</th>
            <th className="pb-3 text-right">Close Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {deals.map((d, i) => {
            const stage = stageMap[d.stage] ?? { badge: 'bg-gray-100 text-gray-600', label: d.stage };
            const winP  = d.win_probability ?? d.win_prob ?? null;
            return (
              <tr key={d.id ?? i} className="hover:bg-gray-50 transition-colors">
                <td className="py-3 pr-4">
                  <p className="font-semibold text-gray-900 truncate max-w-[200px]">{d.title || d.name || '—'}</p>
                  {d.priority && (
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      d.priority === 'high'   ? 'bg-red-50 text-red-600' :
                      d.priority === 'medium' ? 'bg-amber-50 text-amber-600' :
                                                'bg-gray-50 text-gray-500'
                    }`}>{d.priority}</span>
                  )}
                </td>
                <td className="py-3 pr-4 text-gray-600 text-xs truncate max-w-[130px]">
                  {d.client_name || d.client || '—'}
                </td>
                <td className="py-3 pr-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${stage.badge}`}>
                    {stage.label}
                  </span>
                </td>
                <td className="py-3 pr-4 text-right font-semibold text-indigo-700">
                  {fmtCurr(d.value ?? d.deal_value)}
                </td>
                <td className="py-3 pr-4 text-center">
                  {winP != null ? (
                    <div className="flex items-center justify-center gap-1.5">
                      <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${winP}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{winP}%</span>
                    </div>
                  ) : '—'}
                </td>
                <td className="py-3 text-right text-xs text-gray-400">
                  {(d.expected_close_date || d.close_date)
                    ? new Date(d.expected_close_date ?? d.close_date).toLocaleDateString()
                    : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ClientGrid({ clients }) {
  const { tierStyle } = CONFIG;
  if (!clients.length) return <EmptyState icon="🏢" message="No client data available." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
            <th className="pb-3 pr-4">Client</th>
            <th className="pb-3 pr-4">Industry</th>
            <th className="pb-3 pr-4">Tier</th>
            <th className="pb-3 pr-4 text-right">Revenue</th>
            <th className="pb-3 pr-4 text-center">Health</th>
            <th className="pb-3 text-center">Churn Risk</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {clients.map((c, i) => {
            const churn  = c.churn_probability ?? c.churn_risk ?? 0;
            const health = c.health_score ?? 0;
            return (
              <tr key={c.id ?? i} className="hover:bg-gray-50 transition-colors">
                <td className="py-3 pr-4">
                  <p className="font-semibold text-gray-900">{c.name || c.company_name || '—'}</p>
                  {c.primary_contact && <p className="text-xs text-gray-400">{c.primary_contact}</p>}
                </td>
                <td className="py-3 pr-4 text-gray-600 text-xs">{c.industry || '—'}</td>
                <td className="py-3 pr-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${tierStyle[c.tier] ?? tierStyle.basic}`}>
                    {c.tier || 'basic'}
                  </span>
                </td>
                <td className="py-3 pr-4 text-right font-semibold text-indigo-700">
                  {fmtCurr(c.total_revenue ?? c.annual_revenue)}
                </td>
                <td className="py-3 pr-4 text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${health}%`,
                          backgroundColor: health > 70 ? '#10b981' : health > 40 ? '#f59e0b' : '#ef4444',
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-400">{health}%</span>
                  </div>
                </td>
                <td className="py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    churn > 70 ? 'bg-red-100 text-red-700' :
                    churn > 40 ? 'bg-amber-100 text-amber-700' :
                                 'bg-green-100 text-green-700'
                  }`}>
                    {churn > 70 ? 'High' : churn > 40 ? 'Medium' : 'Low'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AIInsightsPanel({ insights }) {
  if (!insights.length) return <EmptyState icon="🤖" message="No AI insights available yet." />;
  return (
    <div className="space-y-3">
      {insights.map((ins, i) => (
        <div
          key={i}
          className={`flex items-start gap-3 p-4 rounded-xl border ${
            ins.priority === 'high'   ? 'bg-red-50 border-red-100'      :
            ins.priority === 'medium' ? 'bg-amber-50 border-amber-100'  :
                                        'bg-blue-50 border-blue-100'
          }`}
        >
          <span className="text-2xl flex-shrink-0 mt-0.5 select-none">
            {ins.type === 'warning'        ? '⚠️' :
             ins.type === 'opportunity'    ? '💡' :
             ins.type === 'recommendation' ? '🎯' : '🤖'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 text-sm">{ins.title || ins.insight || ins.message}</p>
            {ins.description && <p className="text-xs text-gray-600 mt-0.5">{ins.description}</p>}
            {ins.action       && <p className="text-xs text-indigo-600 font-medium mt-1">→ {ins.action}</p>}
          </div>
          {ins.priority && (
            <span className={`ml-auto flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
              ins.priority === 'high'   ? 'bg-red-100 text-red-700'     :
              ins.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                                          'bg-blue-100 text-blue-700'
            }`}>
              {ins.priority}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ⑤ PLATFORM USAGE TAB — sessions, DB events, all-users (preserved logic)
// ─────────────────────────────────────────────────────────────────────────────
function SessionsPanel({ sessions }) {
  const { active_sessions = [], recent_sessions = [], active_count = 0 } = sessions;
  const [tab, setTab] = useState('active');
  const rows = tab === 'active' ? active_sessions : recent_sessions;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <SectionHeader
          icon="🖥️"
          title="User Sessions"
          subtitle={`${active_count} active now · browser, OS, device & current page`}
        />
        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm">
          {[['active', `Active (${active_count})`], ['recent', 'Last 7 Days']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-1.5 font-semibold transition-colors ${
                tab === key ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon="🖥️" message={tab === 'active' ? 'No users active right now.' : 'No session data for the last 7 days.'} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="pb-3 pr-4">User</th>
                <th className="pb-3 pr-4">Browser / OS</th>
                <th className="pb-3 pr-4">Device</th>
                <th className="pb-3 pr-4">IP Address</th>
                <th className="pb-3 pr-4">Current Page</th>
                <th className="pb-3 pr-4 text-right">Duration</th>
                <th className="pb-3 text-right">Last Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{s.user_name || '—'}</p>
                        <p className="text-xs text-gray-400 truncate">{s.user_email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-gray-600">
                    <p>{s.browser}</p>
                    <p className="text-xs text-gray-400">{s.os}</p>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                      {s.device_type}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-gray-500 text-xs font-mono">{s.ip_address || '—'}</td>
                  <td className="py-3 pr-4 text-gray-500 text-xs truncate max-w-[160px]">{s.current_page || '—'}</td>
                  <td className="py-3 pr-4 text-right text-gray-500 text-xs">{s.duration_label}</td>
                  <td className="py-3 text-right text-gray-400 text-xs">
                    {new Date(s.last_activity).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DbEventsPanel({ dbEvents, evtCategory, setEvtCategory }) {
  const { events = [], total_in_period = 0, category_summary = [] } = dbEvents;
  const filtered = evtCategory ? events.filter(e => e.category === evtCategory) : events;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
        <SectionHeader
          icon="🗄️"
          title="Database Events"
          subtitle={`${fmt(total_in_period)} total events in period — logins, uploads, AI calls, errors & more`}
        />
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <button
            onClick={() => setEvtCategory('')}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              !evtCategory ? 'bg-indigo-600 text-white border-indigo-600' : 'text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          {category_summary.map(c => {
            const ui = CATEGORY_UI[c.category] ?? { icon: '📋', color: 'bg-gray-50 text-gray-700 border-gray-200' };
            return (
              <button
                key={c.category}
                onClick={() => setEvtCategory(prev => prev === c.category ? '' : c.category)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                  evtCategory === c.category
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : `${ui.color} hover:opacity-80`
                }`}
              >
                <span>{ui.icon}</span>
                <span>{c.label}</span>
                <span className="opacity-70">({fmt(c.count)})</span>
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="🗄️" message="No events for this filter." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="pb-3 pr-4">Time</th>
                <th className="pb-3 pr-4">Category</th>
                <th className="pb-3 pr-4">Event</th>
                <th className="pb-3 pr-4">User</th>
                <th className="pb-3 pr-4">Description</th>
                <th className="pb-3 pr-4 text-center">Status</th>
                <th className="pb-3 text-right">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(ev => {
                const ui = CATEGORY_UI[ev.category] ?? { icon: '📋', color: 'bg-gray-50 text-gray-700 border-gray-200' };
                return (
                  <tr key={ev.id} className={`hover:bg-gray-50 transition-colors ${!ev.success ? 'bg-red-50/40' : ''}`}>
                    <td className="py-2.5 pr-4 text-xs text-gray-400 whitespace-nowrap">
                      {new Date(ev.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border w-fit ${ui.color}`}>
                        <span>{ui.icon}</span><span>{ev.category_label}</span>
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="text-xs font-mono text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                        {ev.activity_type}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <p className="font-medium text-gray-800 truncate max-w-[130px]">
                        {ev.user_full_name || ev.user_email || 'System'}
                      </p>
                      {ev.ip_address && <p className="text-xs font-mono text-gray-400">{ev.ip_address}</p>}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600 max-w-[240px] truncate">{ev.description}</td>
                    <td className="py-2.5 pr-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        ev.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {ev.success ? 'OK' : 'Fail'}
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-xs text-gray-400">
                      {ev.duration_ms != null ? `${ev.duration_ms} ms` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AllUsersPanel({ allUsers, userSearch, setUserSearch }) {
  const query    = userSearch.trim().toLowerCase();
  const filtered = query
    ? allUsers.filter(u =>
        u.full_name.toLowerCase().includes(query)  ||
        u.email.toLowerCase().includes(query)      ||
        u.department.toLowerCase().includes(query) ||
        u.job_title.toLowerCase().includes(query)
      )
    : allUsers;

  const activeCount  = allUsers.filter(u => u.total_requests > 0).length;
  const dormantCount = allUsers.length - activeCount;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <SectionHeader
          icon="👥"
          title="All Registered Users"
          subtitle={`${activeCount} engaged · ${dormantCount} dormant · ${allUsers.length} total`}
        />
        <input
          type="text"
          placeholder="Search by name, email, department…"
          value={userSearch}
          onChange={e => setUserSearch(e.target.value)}
          className="w-full sm:w-72 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="👥" message={userSearch ? 'No users match your search.' : 'No user profiles in the system.'} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="pb-3 pr-4">User</th>
                <th className="pb-3 pr-4">Department / Title</th>
                <th className="pb-3 pr-4">Role</th>
                <th className="pb-3 pr-4 text-center">Status</th>
                <th className="pb-3 pr-4 text-right">Requests</th>
                <th className="pb-3 pr-4 text-right">Disciplines</th>
                <th className="pb-3 text-right">Last Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(u => {
                const initials  = u.full_name
                  ? u.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
                  : u.email[0].toUpperCase();
                const isEngaged = u.total_requests > 0;
                return (
                  <tr key={u.email} className={`transition-colors ${isEngaged ? 'hover:bg-indigo-50' : 'opacity-60 hover:bg-gray-50'}`}>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          isEngaged ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{u.full_name || '—'}</p>
                          <p className="text-xs text-gray-400 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="text-gray-700 truncate">{u.department || '—'}</p>
                      <p className="text-xs text-gray-400 truncate">{u.job_title || ''}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {(u.roles || []).length > 0
                          ? (u.roles || []).slice(0, 2).map(r => (
                              <span key={r} className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium">{r}</span>
                            ))
                          : <span className="text-gray-400 text-xs">—</span>
                        }
                        {(u.roles || []).length > 2 && <span className="text-xs text-gray-400">+{(u.roles || []).length - 2}</span>}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[u.status] ?? STATUS_STYLE.inactive}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <span className={`font-semibold ${isEngaged ? 'text-indigo-700' : 'text-gray-300'}`}>
                        {fmt(u.total_requests)}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right text-gray-500">{u.disciplines_used || '—'}</td>
                    <td className="py-3 text-right text-gray-400 text-xs">
                      {u.last_seen ? new Date(u.last_seen).toLocaleDateString() : 'Never'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ⑥ UTILISATION REPORT PANEL — management/sales comprehensive usage report
//    Soft-coded: periods, columns, export fields all driven from config arrays
// ─────────────────────────────────────────────────────────────────────────────

// Period options — add a new object here to add a period; nothing else changes
const REPORT_PERIOD_OPTIONS = [
  { key: 'daily',     label: 'Daily (30d)'   },
  { key: 'weekly',    label: 'Weekly (90d)'  },
  { key: 'monthly',   label: 'Monthly'       },
  { key: 'quarterly', label: 'Quarterly'     },
];

// Dept breakdown table columns — reorder/add here only
const DEPT_COLUMNS = [
  { key: 'department',     label: 'Department',     align: 'left'  },
  { key: 'user_count',     label: 'Users',          align: 'right' },
  { key: 'requests',       label: 'API Requests',   align: 'right' },
  { key: 'ai_calls',       label: 'AI Calls',       align: 'right' },
  { key: 'estimated_cost', label: 'Est. AI Cost',   align: 'right', fmt: v => `$${Number(v).toFixed(4)}` },
];

// User breakdown CSV export columns — add to include in download
const USER_CSV_COLS = [
  { key: 'full_name',       label: 'Name'           },
  { key: 'email',           label: 'Email'          },
  { key: 'department',      label: 'Department'     },
  { key: 'job_title',       label: 'Job Title'      },
  { key: 'requests',        label: 'API Requests'   },
  { key: 'ai_calls',        label: 'AI Calls'       },
  { key: 'estimated_cost',  label: 'Est. AI Cost'   },
  { key: 'avg_response_ms', label: 'Avg Response ms'},
  { key: 'disciplines_used',label: 'Disciplines'    },
  { key: 'last_seen',       label: 'Last Seen'      },
];

// Chart colour palette — soft-coded; cycles for unknown departments
const REPORT_COLORS = ['#6366f1','#10b981','#f59e0b','#06b6d4','#ec4899','#84cc16','#ef4444','#8b5cf6','#f97316','#14b8a6'];
const rptColor = (i) => REPORT_COLORS[i % REPORT_COLORS.length];

function _buildCsv(rows, cols) {
  const header = cols.map(c => c.label).join(',');
  const body   = rows.map(r =>
    cols.map(c => {
      const v = r[c.key] ?? '';
      return typeof v === 'string' && v.includes(',') ? `"${v}"` : v;
    }).join(',')
  );
  return [header, ...body].join('\n');
}

function _downloadBlob(content, filename, type = 'text/csv') {
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function UtilisationReportPanel({
  reportData, reportPeriod, setReportPeriod,
  reportAnchor, setReportAnchor,
  reportLoading, reportError, onGenerate,
}) {
  const [userSearch, setUserSearch]   = useState('');
  const [deptFilter, setDeptFilter]   = useState('');
  const [sortCol, setSortCol]         = useState('requests');
  const [sortDir, setSortDir]         = useState('desc');

  const meta      = reportData?.report_meta   ?? {};
  const summary   = reportData?.summary       ?? {};
  const byDept    = reportData?.by_department ?? [];
  const byUser    = reportData?.by_user       ?? [];
  const byDisc    = reportData?.by_discipline ?? [];
  const trends    = reportData?.trends        ?? [];
  const costModel = reportData?.ai_cost_model ?? {};

  // Filtered + sorted users
  const filteredUsers = byUser
    .filter(u =>
      (!deptFilter || u.department === deptFilter) &&
      (!userSearch  || u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
                       u.email.toLowerCase().includes(userSearch.toLowerCase()))
    )
    .sort((a, b) => {
      const av = a[sortCol] ?? 0;
      const bv = b[sortCol] ?? 0;
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };
  const sortIcon = (col) => sortCol !== col ? '↕' : sortDir === 'asc' ? '↑' : '↓';

  // Unique departments for filter dropdown
  const depts = [...new Set(byUser.map(u => u.department))].sort();

  const handleExportCsv = () => {
    const csv = _buildCsv(byUser, USER_CSV_COLS);
    const label = meta.anchor || new Date().toISOString().slice(0, 7);
    _downloadBlob(csv, `utilisation-report-${meta.period || 'monthly'}-${label}.csv`);
  };

  const handleExportDeptCsv = () => {
    const cols = DEPT_COLUMNS.map(c => ({ key: c.key, label: c.label }));
    const csv  = _buildCsv(byDept, cols);
    _downloadBlob(csv, `dept-report-${meta.period || 'monthly'}-${meta.anchor || ''}.csv`);
  };

  const handlePrint = () => window.print();

  // anchor input: default to current YYYY-MM
  const currentMonth = new Date().toISOString().slice(0, 7);

  return (
    <div className="utilisation-report space-y-6">
      {/* ── Report Header / Controls ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <span className="text-2xl select-none">📋</span>
              Utilisation Report
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Department + user breakdown · API usage · AI cost estimation
              {meta.generated_at && (
                <span className="ml-2 text-gray-400">
                  · Generated {new Date(meta.generated_at).toLocaleString()}
                </span>
              )}
            </p>
          </div>

          {/* Controls row */}
          <div className="flex flex-wrap items-center gap-2 print-hide">
            {/* Period selector */}
            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
              {REPORT_PERIOD_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setReportPeriod(key)}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    reportPeriod === key
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Anchor month picker (shown for monthly/quarterly) */}
            {(reportPeriod === 'monthly' || reportPeriod === 'quarterly') && (
              <input
                type="month"
                value={reportAnchor || currentMonth}
                onChange={e => setReportAnchor(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            )}

            {/* Generate button */}
            <button
              onClick={onGenerate}
              disabled={reportLoading}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {reportLoading ? '⏳ Loading…' : '⚡ Generate'}
            </button>

            {/* Export buttons — only visible when data exists */}
            {reportData && (
              <>
                <button
                  onClick={handleExportCsv}
                  className="px-3 py-1.5 rounded-lg border border-green-200 text-green-700 text-xs font-semibold hover:bg-green-50 transition-colors"
                  title="Download user-level CSV"
                >
                  ⬇ CSV Users
                </button>
                <button
                  onClick={handleExportDeptCsv}
                  className="px-3 py-1.5 rounded-lg border border-teal-200 text-teal-700 text-xs font-semibold hover:bg-teal-50 transition-colors"
                  title="Download department-level CSV"
                >
                  ⬇ CSV Depts
                </button>
                <button
                  onClick={handlePrint}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors"
                  title="Print / Save as PDF"
                >
                  🖨 PDF
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Error / empty states ── */}
      {reportError && <ErrorBanner message={reportError} onRetry={onGenerate} />}
      {reportLoading && <Spinner />}

      {!reportData && !reportLoading && !reportError && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-400">
          <span className="text-5xl block mb-3 select-none">📋</span>
          <p className="font-semibold text-gray-600">No report generated yet</p>
          <p className="text-sm mt-1">Select a period above and click <strong>⚡ Generate</strong></p>
        </div>
      )}

      {reportData && !reportLoading && (
        <>
          {/* ── Summary KPIs ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KpiCard icon="⚡" label="Total API Requests" value={fmt(summary.total_requests)}    sub={`${fmt(summary.unique_users)} users`} />
            <KpiCard icon="🤖" label="AI Calls (Est.)"    value={fmt(summary.total_ai_calls)}    sub={`$${(summary.estimated_ai_cost ?? 0).toFixed(4)} est. cost`} />
            <KpiCard icon="⏱️" label="Avg Response"       value={`${fmt(summary.avg_response_ms)} ms`} sub={`${pct(summary.success_rate)} success`} />
            <KpiCard icon="🏢" label="Departments"        value={fmt(byDept.length)}              sub={`${fmt(summary.total_disciplines)} disciplines`} />
          </div>

          {/* ── Trend chart ── */}
          {trends.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <SectionHeader
                icon="📈"
                title="Request Trend"
                subtitle={`${REPORT_PERIOD_OPTIONS.find(p => p.key === meta.period)?.label ?? meta.period} — ${meta.period_label}`}
              />
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={trends} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="rptReq" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}    />
                    </linearGradient>
                    <linearGradient id="rptAI" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(v, n) => [
                      fmt(v),
                      n === 'requests' ? 'API Requests' : n === 'ai_calls' ? 'AI Calls' : 'Users',
                    ]}
                  />
                  <Legend formatter={n => n === 'requests' ? 'API Requests' : n === 'ai_calls' ? 'AI Calls (est.)' : 'Unique Users'} />
                  <Area type="monotone" dataKey="requests"    stroke="#6366f1" fill="url(#rptReq)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="unique_users" stroke="#f59e0b" fill="none"         strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                  <Area type="monotone" dataKey="ai_calls"    stroke="#10b981" fill="url(#rptAI)"  strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Department breakdown ── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <SectionHeader icon="🏢" title="Department Breakdown" subtitle="Usage ranked by API volume" />

            {/* Mini bar chart for departments */}
            {byDept.length > 0 && (
              <ResponsiveContainer width="100%" height={Math.max(160, byDept.length * 40)}>
                <BarChart data={byDept} layout="vertical" margin={{ top: 0, right: 60, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="department" width={170} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v, n) => [fmt(v), n === 'requests' ? 'API Requests' : 'AI Calls']} />
                  <Legend formatter={n => n === 'requests' ? 'API Requests' : 'AI Calls'} />
                  <Bar dataKey="requests" name="requests" radius={[0, 4, 4, 0]}>
                    {byDept.map((_, i) => <Cell key={i} fill={rptColor(i)} />)}
                  </Bar>
                  <Bar dataKey="ai_calls" name="ai_calls" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* Department table */}
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                    {DEPT_COLUMNS.map(c => (
                      <th key={c.key} className={`pb-3 pr-4 ${c.align === 'right' ? 'text-right' : ''}`}>
                        {c.label}
                      </th>
                    ))}
                    <th className="pb-3 text-left">Top Users</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {byDept.map((d, i) => (
                    <tr key={d.department} className="hover:bg-gray-50 transition-colors">
                      {DEPT_COLUMNS.map(c => (
                        <td key={c.key} className={`py-2.5 pr-4 ${c.align === 'right' ? 'text-right' : ''}`}>
                          {c.key === 'department' ? (
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: rptColor(i) }} />
                              <span className="font-semibold text-gray-800">{d.department}</span>
                            </div>
                          ) : c.fmt ? (
                            <span className="font-mono text-gray-700">{c.fmt(d[c.key])}</span>
                          ) : (
                            <span className={c.key === 'requests' ? 'font-semibold text-indigo-700' : 'text-gray-700'}>
                              {fmt(d[c.key])}
                            </span>
                          )}
                        </td>
                      ))}
                      <td className="py-2.5 text-xs text-gray-500">
                        {(d.top_users ?? []).map(u => u.full_name || u.email).join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Discipline chart ── */}
          {byDisc.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <SectionHeader icon="🏭" title="Usage by Discipline / Module" subtitle="API volume per engineering area" />
              <ResponsiveContainer width="100%" height={Math.max(200, byDisc.length * 34)}>
                <BarChart data={byDisc} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="discipline_label" width={155} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v, n) => [fmt(v), n === 'requests' ? 'Requests' : 'Users']} />
                  <Legend formatter={n => n === 'requests' ? 'Requests' : 'Unique Users'} />
                  <Bar dataKey="requests" name="requests" radius={[0, 4, 4, 0]}>
                    {byDisc.map((d, i) => <Cell key={i} fill={discColor(d.discipline_label)} />)}
                  </Bar>
                  <Bar dataKey="unique_users" name="unique_users" fill="#a5b4fc" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── User breakdown ── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <SectionHeader icon="👥" title="User Breakdown" subtitle={`${filteredUsers.length} of ${byUser.length} users`} />
              <div className="flex gap-2 flex-wrap print-hide">
                {/* Department filter */}
                <select
                  value={deptFilter}
                  onChange={e => setDeptFilter(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="">All Departments</option>
                  {depts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                {/* User search */}
                <input
                  placeholder="Search name / email…"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 w-48 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                    <th className="pb-3 pr-4">User</th>
                    <th className="pb-3 pr-4">Department</th>
                    {[
                      { col: 'requests',        label: 'Requests'   },
                      { col: 'ai_calls',        label: 'AI Calls'   },
                      { col: 'estimated_cost',  label: 'Est. Cost'  },
                      { col: 'avg_response_ms', label: 'Avg ms'     },
                    ].map(({ col, label }) => (
                      <th
                        key={col}
                        className="pb-3 pr-4 text-right cursor-pointer select-none hover:text-indigo-600 transition-colors"
                        onClick={() => toggleSort(col)}
                      >
                        {label} <span className="text-gray-400">{sortIcon(col)}</span>
                      </th>
                    ))}
                    <th className="pb-3 text-right">Last Seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredUsers.length === 0 ? (
                    <tr><td colSpan={7} className="py-8 text-center text-gray-400 text-xs">No users match the current filter.</td></tr>
                  ) : filteredUsers.map(u => (
                    <tr key={u.email} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 pr-4">
                        <p className="font-semibold text-gray-900 text-sm">{u.full_name}</p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                        {u.job_title && <p className="text-xs text-gray-400 italic">{u.job_title}</p>}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="text-xs bg-indigo-50 text-indigo-700 rounded-full px-2 py-0.5 font-medium">
                          {u.department}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-right font-semibold text-indigo-700">{fmt(u.requests)}</td>
                      <td className="py-2.5 pr-4 text-right text-emerald-700 font-semibold">{fmt(u.ai_calls)}</td>
                      <td className="py-2.5 pr-4 text-right font-mono text-gray-600 text-xs">${u.estimated_cost.toFixed(4)}</td>
                      <td className="py-2.5 pr-4 text-right text-gray-500">{fmt(u.avg_response_ms)} ms</td>
                      <td className="py-2.5 text-right text-xs text-gray-400">
                        {u.last_seen ? new Date(u.last_seen).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── AI Cost Disclaimer ── */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-amber-800 text-xs space-y-1">
            <p className="font-bold text-sm flex items-center gap-2">
              <span className="select-none">⚠️</span> AI Cost Estimation Model
            </p>
            <p>
              AI usage is <strong>estimated</strong> from <code>SystemActivity</code> events of type{' '}
              <code>ai_analysis</code> and <code>ml_prediction</code>.
              Actual token counts are not tracked — figures use a blended average of{' '}
              <strong>{fmt(costModel.avg_tokens_per_call)} tokens/call</strong> at{' '}
              <strong>${costModel.cost_per_1k_input_tokens}/1k input</strong> /{' '}
              <strong>${costModel.cost_per_1k_output_tokens}/1k output</strong>{' '}
              ({costModel.model_assumed}).
            </p>
            <p className="text-amber-600">{costModel.note}</p>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ⑦ TAB CONTENT ROUTER — add a new `if (tab === 'xyz')` block to add a tab
// ─────────────────────────────────────────────────────────────────────────────
function TabContent({ tab, state, actions }) {
  const {
    range, overview, disciplines, topUsers, trends, activeNow,
    allUsers, userSearch, dbEvents, evtCategory, sessions,
    pipeline, clients, aiInsights, activities,
    pipelineLoading, pipelineError,
    reportData, reportPeriod, reportAnchor, reportLoading, reportError,
  } = state;
  const { setUserSearch, setEvtCategory, fetchPipeline, fetchReport,
          setReportPeriod, setReportAnchor } = actions;

  // ── OVERVIEW ─────────────────────────────────────────────────────────────
  if (tab === 'overview') {
    const topDiscipline  = disciplines[0]?.discipline_label ?? '—';
    const byStage        = pipeline?.by_stage ?? [];
    const healthScore    = computeSalesHealth({ pipeline, overview, clients, activeNow });
    const trendReq       = (trends ?? []).map(t => t.requests || 0);
    const trendUsers     = (trends ?? []).map(t => t.users || 0);

    return (
      <div className="space-y-6">

        {/* Health Ring + Quick Actions (2-col hero strip) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SalesHealthRing score={healthScore} label="Sales Health Score" />
          <div className="lg:col-span-2">
            <QuickActionsBar onAction={actions.onQuickAction} activeTab={tab} />
          </div>
        </div>

        {/* KPI row — usage + pipeline (icon-based, tone-coded) */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard Icon={SignalIcon}    tone="emerald" label="Active Now"     value={fmt(activeNow.length)}                                           sub="last 15 min" pulse />
          <KpiCard Icon={UsersIcon}     tone="sky"     label="Users Today"    value={fmt(overview?.today_users)}                                     sub={`${fmt(overview?.total_users)} in period`} />
          <KpiCard Icon={BoltIcon}      tone="indigo"  label="Requests"       value={fmt(overview?.today_requests)}                                  sub={`${fmt(overview?.total_requests)} in period`} />
          <KpiCard Icon={BanknotesIcon} tone="violet"  label="Pipeline Value" value={fmtCurr(pipeline?.total_pipeline_value ?? pipeline?.total_value)} sub={`${fmt(pipeline?.total_deals ?? pipeline?.deal_count)} deals`} />
          <KpiCard Icon={TrophyIcon}    tone="amber"   label="Win Rate"       value={pct(pipeline?.win_rate ?? 0)}                                   sub={topDiscipline} />
        </div>

        {/* Trends + Active Now */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-start justify-between mb-4">
              <SectionHeader Icon={PresentationChartLineIcon} title="Usage Trends" subtitle="Daily requests & active users" accent="indigo" />
              {trendReq.length > 1 && (
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500"/>Requests</span>
                  <MiniSparkline data={trendReq} color="#6366f1" />
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"/>Users</span>
                  <MiniSparkline data={trendUsers} color="#10b981" />
                </div>
              )}
            </div>
            {trends.length === 0 ? (
              <EmptyState icon="📈" message="Not enough data to show trends yet." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={trends} margin={{ top: 4, right: 24, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="gradReq" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}    />
                    </linearGradient>
                    <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v, n) => [fmt(v), n === 'requests' ? 'Requests' : 'Users']} />
                  <Legend formatter={v => v === 'requests' ? 'Requests' : 'Unique Users'} />
                  <Area type="monotone" dataKey="requests" stroke="#6366f1" fill="url(#gradReq)"   strokeWidth={2} name="requests" />
                  <Area type="monotone" dataKey="users"    stroke="#10b981" fill="url(#gradUsers)" strokeWidth={2} name="users" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col">
            <SectionHeader Icon={SignalIcon} title="Active Right Now" subtitle={`${activeNow.length} user${activeNow.length !== 1 ? 's' : ''} · last 15 min`} accent="emerald" />
            <div className="flex-1 overflow-y-auto space-y-2 max-h-64">
              {activeNow.length === 0 ? (
                <EmptyState icon="😴" message="No users active right now" />
              ) : activeNow.map((u, i) => (
                <div key={u.user_email ?? i} className="flex items-center gap-3 p-2.5 rounded-xl bg-gradient-to-r from-emerald-50/50 to-transparent hover:from-emerald-50 hover:to-emerald-50/30 transition-all">
                  <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                      {u.user_full_name?.[0] || u.user_email?.[0] || '?'}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{u.user_full_name || u.user_email}</p>
                    <p className="text-xs text-gray-500 truncate">{u.last_discipline}</p>
                  </div>
                  <span className="ml-auto text-xs text-gray-400 font-medium flex-shrink-0 tabular-nums">{fmt(u.requests)} req</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pipeline snapshot (bar chart, soft-rendered from CONFIG.pipelineStages) */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <SectionHeader Icon={RocketLaunchIcon} title="Pipeline Snapshot" subtitle="Deal counts by stage" accent="violet" />
          {pipelineError ? <ErrorBanner message={pipelineError} onRetry={fetchPipeline} /> :
           byStage.length === 0 ? <EmptyState icon="🚀" message="No pipeline data. Visit Sales Pipeline tab to manage deals." /> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={byStage} margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="stage_label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v, n) => [fmt(v), n === 'deal_count' ? 'Deals' : 'Value']} />
                <Bar dataKey="deal_count" name="deal_count" radius={[4, 4, 0, 0]}>
                  {byStage.map((entry, i) => {
                    const stg = CONFIG.pipelineStages.find(s => s.key === entry.stage);
                    return <Cell key={i} fill={stg?.color ?? '#6366f1'} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* AI Insights preview */}
        {aiInsights.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <SectionHeader Icon={SparklesIcon} title="AI Insights" subtitle="Top recommendations from your CRM engine" accent="amber" />
            <AIInsightsPanel insights={aiInsights.slice(0, 3)} />
          </div>
        )}
      </div>
    );
  }

  // ── SALES PIPELINE ────────────────────────────────────────────────────────
  if (tab === 'pipeline') {
    const stageMap = Object.fromEntries((pipeline?.by_stage ?? []).map(s => [s.stage, s]));
    return (
      <div className="space-y-6">

        {pipelineLoading && <Spinner />}
        {pipelineError   && <ErrorBanner message={pipelineError} onRetry={fetchPipeline} />}

        {/* Stage cards — auto-driven from CONFIG.pipelineStages */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {CONFIG.pipelineStages.map(stage => (
            <StageCard key={stage.key} stage={stage} summary={stageMap[stage.key] ?? {}} />
          ))}
        </div>

        {/* Pipeline KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon="💰" label="Total Pipeline" value={fmtCurr(pipeline?.total_pipeline_value ?? pipeline?.total_value)}           sub="all open deals" />
          <KpiCard icon="✅" label="Won (Period)"   value={fmtCurr(pipeline?.won_value ?? pipeline?.closed_won_value ?? 0)}            sub={`${fmt(pipeline?.won_deals ?? 0)} deals won`} />
          <KpiCard icon="📊" label="Win Rate"       value={pct(pipeline?.win_rate)}                                                    sub="closed_won vs all closed" />
          <KpiCard icon="⏱️" label="Avg Deal Life"  value={`${fmt(pipeline?.avg_deal_days ?? pipeline?.avg_cycle_days ?? 0)} days`}   sub="lead to close" />
        </div>

        {/* Deals table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <SectionHeader icon="🤝" title="All Deals" subtitle={`${fmt(pipeline?.total_deals ?? 0)} deals in pipeline`} />
          <DealsTable deals={safeArr(pipeline?.deals)} />
        </div>

        {/* Top clients */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <SectionHeader icon="🏢" title="Top Clients" subtitle="Ranked by revenue · health score · churn risk" />
          <ClientGrid clients={clients.top} />
        </div>

        {/* At-risk clients */}
        {clients.atRisk.length > 0 && (
          <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-6">
            <SectionHeader icon="🚨" title="At-Risk Clients" subtitle="High churn probability — requires immediate attention" />
            <ClientGrid clients={clients.atRisk} />
          </div>
        )}

        {/* AI Recommendations */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <SectionHeader icon="🤖" title="AI Recommendations" subtitle="Powered by your CRM intelligence engine" />
          <AIInsightsPanel insights={aiInsights} />
        </div>

        {/* Upcoming activities */}
        {activities.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <SectionHeader icon="📅" title="Upcoming Activities" subtitle="Next 7 days" />
            <div className="space-y-2">
              {activities.map((a, i) => (
                <div key={a.id ?? i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 hover:bg-indigo-50 transition-colors">
                  <span className="text-xl flex-shrink-0 select-none">
                    {a.type === 'call' ? '📞' : a.type === 'email' ? '📧' : a.type === 'meeting' ? '🗓️' : '📌'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 text-sm">{a.title || a.subject || a.description}</p>
                    {a.client_name && <p className="text-xs text-gray-500">{a.client_name}</p>}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">
                    {(a.due_date || a.scheduled_at)
                      ? new Date(a.due_date ?? a.scheduled_at).toLocaleDateString()
                      : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Utilisation Report — department/user/AI cost breakdown */}
        <UtilisationReportPanel
          reportData={reportData}
          reportPeriod={reportPeriod}
          setReportPeriod={setReportPeriod}
          reportAnchor={reportAnchor}
          setReportAnchor={setReportAnchor}
          reportLoading={reportLoading}
          reportError={reportError}
          onGenerate={fetchReport}
        />
      </div>
    );
  }

  // ── PLATFORM USAGE ────────────────────────────────────────────────────────
  if (tab === 'usage') {
    return (
      <div className="space-y-6">

        {/* Discipline bar chart */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <SectionHeader
            icon="🏭"
            title="Usage by Discipline"
            subtitle={`Requests per engineering area — ${CONFIG.timeRanges.find(r => r.key === range)?.label}`}
          />
          {disciplines.length === 0 ? (
            <EmptyState icon="📊" message="No data yet — start using the platform to see stats." />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(240, disciplines.length * 36)}>
              <BarChart data={disciplines} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="discipline_label" width={155} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v, n) => [fmt(v), n === 'total_requests' ? 'Requests' : 'Users']} />
                <Legend formatter={v => v === 'total_requests' ? 'Requests' : 'Unique Users'} />
                <Bar dataKey="total_requests" name="total_requests" radius={[0, 4, 4, 0]}>
                  {disciplines.map((d, i) => <Cell key={i} fill={discColor(d.discipline_label)} />)}
                </Bar>
                <Bar dataKey="unique_users" name="unique_users" fill="#a5b4fc" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Discipline badge pills */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <SectionHeader icon="🏷️" title="Discipline Breakdown" subtitle="All modules accessed in period" />
          <div className="flex flex-wrap gap-2">
            {disciplines.length === 0
              ? <p className="text-gray-400 text-sm">No discipline data yet.</p>
              : disciplines.map(d => (
                  <div
                    key={d.discipline_key}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full text-white text-xs font-semibold shadow-sm"
                    style={{ backgroundColor: discColor(d.discipline_label) }}
                  >
                    <span>{d.discipline_label}</span>
                    <span className="bg-white/25 rounded-full px-1.5 py-0.5">{fmt(d.total_requests)}</span>
                    <span className="text-white/70">·</span>
                    <span className="text-white/80">{d.unique_users} users</span>
                  </div>
                ))
            }
          </div>
        </div>

        {/* Top Users */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <SectionHeader icon="⭐" title="Top Users" subtitle={`Most active — ${CONFIG.timeRanges.find(r => r.key === range)?.label}`} />
          {topUsers.length === 0 ? (
            <EmptyState icon="👤" message="No user data for this period." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                    <th className="pb-3 pr-4">#</th>
                    <th className="pb-3 pr-4">User</th>
                    <th className="pb-3 pr-4 text-right">Requests</th>
                    <th className="pb-3 pr-4 text-right">Disciplines</th>
                    <th className="pb-3 text-right">Avg Response</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {topUsers.map((u, i) => (
                    <tr key={u.user_email} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 pr-4">
                        <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-bold ${
                          i === 0 ? 'bg-yellow-100 text-yellow-700' :
                          i === 1 ? 'bg-gray-100 text-gray-600'    :
                          i === 2 ? 'bg-orange-100 text-orange-700' : 'text-gray-400'
                        }`}>
                          {i < 3 ? ['🥇','🥈','🥉'][i] : i + 1}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-gray-900">{u.user_full_name || '—'}</p>
                        <p className="text-xs text-gray-400">{u.user_email}</p>
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold text-indigo-700">{fmt(u.total_requests)}</td>
                      <td className="py-3 pr-4 text-right text-gray-600">{u.disciplines_used}</td>
                      <td className="py-3 text-right text-gray-500">{fmt(u.avg_response_ms)} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* All-users roster */}
        <AllUsersPanel
          allUsers={allUsers}
          userSearch={userSearch}
          setUserSearch={setUserSearch}
        />

        {/* Sessions */}
        <SessionsPanel sessions={sessions} />

        {/* DB Events */}
        <DbEventsPanel
          dbEvents={dbEvents}
          evtCategory={evtCategory}
          setEvtCategory={setEvtCategory}
        />
      </div>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ⑦ ROOT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function InternalSalesDashboard() {

  // ── Platform usage state ─────────────────────────────────────────────────
  const [range, setRange]             = useState('7d');
  const [overview, setOverview]       = useState(null);
  const [disciplines, setDisciplines] = useState([]);
  const [topUsers, setTopUsers]       = useState([]);
  const [trends, setTrends]           = useState([]);
  const [activeNow, setActiveNow]     = useState([]);
  const [allUsers, setAllUsers]       = useState([]);
  const [userSearch, setUserSearch]   = useState('');
  const [dbEvents, setDbEvents]       = useState({ events: [], total_in_period: 0, category_summary: [] });
  const [evtCategory, setEvtCategory] = useState('');
  const [sessions, setSessions]       = useState({ active_sessions: [], recent_sessions: [], active_count: 0 });
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError]   = useState(null);

  // ── CRM / pipeline state ─────────────────────────────────────────────────
  const [pipeline, setPipeline]             = useState(null);
  const [clients, setClients]               = useState({ top: [], atRisk: [] });
  const [aiInsights, setAiInsights]         = useState([]);
  const [activities, setActivities]         = useState([]);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [pipelineError, setPipelineError]   = useState(null);
  const [pipelineLoaded, setPipelineLoaded] = useState(false); // lazy — load once

  // ── Utilisation Report state ─────────────────────────────────────────────
  const [reportData,    setReportData]    = useState(null);
  const [reportPeriod,  setReportPeriod]  = useState('monthly');
  const [reportAnchor,  setReportAnchor]  = useState(() => new Date().toISOString().slice(0, 7));
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError,   setReportError]   = useState(null);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]   = useState(CONFIG.defaultTab);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const mainTimer      = useRef(null);
  const activeNowTimer = useRef(null);
  const sessionsTimer  = useRef(null);

  // ── Fetch: platform usage (tied to range) ────────────────────────────────
  const fetchUsage = useCallback(async () => {
    try {
      setUsageError(null);
      const trendRange = range === '1d' ? '7d' : range;
      const [ov, disc, users, tr, allU, evts] = await Promise.all([
        internalSalesService.getOverview(range),
        internalSalesService.getDisciplines(range),
        internalSalesService.getTopUsers(range, CONFIG.topUsersLimit),
        internalSalesService.getTrends(trendRange),
        internalSalesService.getAllUsers(range),
        internalSalesService.getDbEvents(range, { limit: 100 }),
      ]);
      setOverview(ov);
      setDisciplines(disc);
      setTopUsers(users);
      setTrends(tr);
      setAllUsers(allU);
      setDbEvents(evts);
      setLastRefresh(new Date());
    } catch (e) {
      console.error('Usage fetch error:', e);
      setUsageError('Could not load analytics. Backend may still be starting up.');
    } finally {
      setUsageLoading(false);
    }
  }, [range]);

  const fetchActive = useCallback(async () => {
    try { setActiveNow(await internalSalesService.getActiveNow()); } catch (_) {}
  }, []);

  const fetchSessions = useCallback(async () => {
    try { setSessions(await internalSalesService.getSessions()); } catch (_) {}
  }, []);

  // ── Fetch: CRM data — lazy, loads once when pipeline tab is first visited ─
  const fetchPipeline = useCallback(async () => {
    if (pipelineLoaded) return;
    setPipelineLoading(true);
    setPipelineError(null);
    try {
      const [summary, topC, atRisk, insights, upcoming] = await Promise.allSettled([
        salesService.getPipelineSummary(),
        salesService.getTopClients({ limit: 20 }),
        salesService.getAtRiskClients(),
        salesService.getAIInsights(),
        salesService.getUpcomingActivities(7),
      ]);

      if (summary.status  === 'fulfilled') {
        // Adopt API-provided currency (soft-coded; defaults to AED).
        setSalesCurrency(summary.value?.currency, summary.value?.currency_locale);
        setPipeline(summary.value);
      }
      if (topC.status     === 'fulfilled') setClients(prev => ({ ...prev, top:    safeArr(topC.value)    }));
      if (atRisk.status   === 'fulfilled') setClients(prev => ({ ...prev, atRisk: safeArr(atRisk.value)  }));
      if (insights.status === 'fulfilled') setAiInsights(safeArr(insights.value?.insights ?? insights.value));
      if (upcoming.status === 'fulfilled') setActivities(safeArr(upcoming.value));

      if (summary.status === 'rejected') {
        // Don't mark loaded — allows auto-retry on next tab visit
        setPipelineError('Connecting to analytics engine… switching to this tab will retry automatically.');
        return;
      }

      setPipelineLoaded(true);
    } catch (e) {
      setPipelineError('Failed to load sales pipeline data.');
    } finally {
      setPipelineLoading(false);
    }
  }, [pipelineLoaded]);

  // ── Fetch: utilisation report (manual trigger) ───────────────────────────
  const fetchReport = useCallback(async () => {
    setReportLoading(true);
    setReportError(null);
    try {
      const data = await internalSalesService.getUtilisationReport({
        period: reportPeriod,
        anchor: reportAnchor,
      });
      setReportData(data);
    } catch (e) {
      console.error('Report fetch error:', e);
      setReportError('Could not load utilisation report. Please try again.');
    } finally {
      setReportLoading(false);
    }
  }, [reportPeriod, reportAnchor]);

  // ── Lifecycle — usage polling ─────────────────────────────────────────────
  useEffect(() => {
    setUsageLoading(true);
    fetchUsage();
    fetchActive();
    fetchSessions();

    clearInterval(mainTimer.current);
    clearInterval(activeNowTimer.current);
    clearInterval(sessionsTimer.current);

    mainTimer.current      = setInterval(fetchUsage,    CONFIG.refreshIntervalMs);
    activeNowTimer.current = setInterval(fetchActive,   CONFIG.activeNowRefreshMs);
    sessionsTimer.current  = setInterval(fetchSessions, CONFIG.sessionsRefreshMs);

    return () => {
      clearInterval(mainTimer.current);
      clearInterval(activeNowTimer.current);
      clearInterval(sessionsTimer.current);
    };
  }, [fetchUsage, fetchActive, fetchSessions]);

  // ── Lazy-load CRM when Sales Pipeline or Overview tab is first opened ────
  useEffect(() => {
    if (activeTab === 'pipeline' || activeTab === 'overview') fetchPipeline();
  }, [activeTab, fetchPipeline]);

  // ── Bundle state / actions for TabContent ───────────────────────────────
  const tabState = {
    range, overview, disciplines, topUsers, trends, activeNow,
    allUsers, userSearch, dbEvents, evtCategory, sessions,
    pipeline, clients, aiInsights, activities,
    pipelineLoading, pipelineError,
  };
  const onQuickAction = useCallback((action) => {
    // Soft-routed quick-action: jump to the relevant tab
    if (action?.tab) setActiveTab(action.tab);
  }, []);
  const tabActions = { setUserSearch, setEvtCategory, fetchPipeline, fetchUsage, onQuickAction };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="w-full min-h-full bg-gradient-to-br from-slate-50 via-indigo-50/20 to-purple-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* ── Hero banner (gradient, icon-based) ── */}
        <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 rounded-2xl shadow-lg overflow-hidden">
          {/* Decorative blur blobs */}
          <div className="absolute -top-12 -right-12 h-44 w-44 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 left-1/3 h-56 w-56 rounded-full bg-fuchsia-400/20 blur-3xl pointer-events-none" />

          <div className="relative px-6 py-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">

              {/* Logo + title */}
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
                  <ChartBarIcon className="h-7 w-7 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight">
                      Sales Intelligence
                    </h1>
                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 backdrop-blur text-[10px] font-bold text-white ring-1 ring-white/20 uppercase tracking-wider">
                      <SparklesIcon className="h-3 w-3" /> AI · Live
                    </span>
                  </div>
                  <p className="text-sm text-white/80 mt-0.5">
                    Platform analytics · CRM pipeline · live user activity
                  </p>
                </div>
              </div>

              {/* Time range + live indicator */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex rounded-xl overflow-hidden bg-white/10 backdrop-blur ring-1 ring-white/20">
                  {CONFIG.timeRanges.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setRange(key)}
                      className={`px-3.5 py-1.5 text-xs font-bold transition-all ${
                        range === key ? 'bg-white text-indigo-700 shadow-sm' : 'text-white/80 hover:bg-white/10'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur ring-1 ring-white/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse inline-block" />
                  <span className="text-[11px] font-bold text-white">LIVE</span>
                  <span className="text-[10px] text-white/70 ml-1 tabular-nums">{lastRefresh.toLocaleTimeString()}</span>
                </div>
              </div>
            </div>

            {/* Tab bar — segmented, glass */}
            <div className="flex gap-1 mt-5 p-1 rounded-xl bg-white/10 backdrop-blur ring-1 ring-white/20 w-fit">
              {CONFIG.tabs.map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold transition-all select-none ${
                    activeTab === key
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-white/85 hover:bg-white/10'
                  }`}
                >
                  <span>{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Loading ── */}
        {usageLoading && <Spinner />}

        {/* ── Tab content — always rendered after initial load.
             usageError shows as a warning banner but does NOT hide tabs.
             The Sales Pipeline tab uses its own endpoints and stays functional
             even when the Usage/Analytics API is unreachable. ── */}
        {!usageLoading && (
          <>
            {usageError && (
              <ErrorBanner
                message={usageError}
                onRetry={fetchUsage}
              />
            )}
            <TabContent tab={activeTab} state={tabState} actions={tabActions} />
          </>
        )}

      </div>
    </div>
  );
}
