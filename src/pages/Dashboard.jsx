import React, { useEffect, useState, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { fetchFeatures } from '../store/featureSlice'
import ContactSupport from '../components/support/ContactSupport'
import Documentation from '../components/documentation/Documentation'
import GoogleAnalyticsRealtime from '../components/Dashboard/GoogleAnalyticsRealtime'
import { API_BASE_URL } from '../config/api.config'
import { FEATURE_FLAGS } from '../config/features.config'
import analyticsService from '../services/analyticsService'
import PersonalDashboard from './PersonalDashboard'
import {
  BellIcon, ArrowPathIcon, SparklesIcon, FolderOpenIcon,
  DocumentTextIcon, CheckCircleIcon, ExclamationTriangleIcon,
  ChevronRightIcon, ShieldCheckIcon, ClockIcon,
  QuestionMarkCircleIcon, WrenchScrewdriverIcon, RocketLaunchIcon,
  ArrowTrendingUpIcon, CpuChipIcon, LightBulbIcon, BeakerIcon,
  BoltIcon, EyeIcon, DocumentMagnifyingGlassIcon, ChartBarIcon,
  CalendarDaysIcon, ArrowDownTrayIcon, FunnelIcon, KeyIcon,
  UserCircleIcon, BuildingOffice2Icon, UsersIcon, SignalIcon,
  TrophyIcon, GlobeAltIcon,
} from '@heroicons/react/24/outline'
import { USER_DISPLAY_CONFIG } from '../config/userDisplay.config'

// ── Category metadata ─────────────────────────────────────────────────────────
// SOFT-CODED: human_resource visibility controlled by FEATURE_FLAGS.enableHRModule
const CATEGORY_META = {
  engineering:         { label: 'Engineering',  color: 'text-blue-700',   bg: 'bg-blue-50',   badge: 'bg-blue-100 text-blue-700'    },
  document_management: { label: 'Documents',    color: 'text-teal-700',   bg: 'bg-teal-50',   badge: 'bg-teal-100 text-teal-700'    },
  project_control:     { label: 'Projects',     color: 'text-violet-700', bg: 'bg-violet-50', badge: 'bg-violet-100 text-violet-700' },
  quality_assurance:   { label: 'QHSE',         color: 'text-green-700',  bg: 'bg-green-50',  badge: 'bg-green-100 text-green-700'  },
  sales:               { label: 'Sales',        color: 'text-rose-700',   bg: 'bg-rose-50',   badge: 'bg-rose-100 text-rose-700'    },
  finance:             { label: 'Finance',      color: 'text-amber-700',  bg: 'bg-amber-50',  badge: 'bg-amber-100 text-amber-700'  },
  procurement:         { label: 'Procurement',  color: 'text-indigo-700', bg: 'bg-indigo-50', badge: 'bg-indigo-100 text-indigo-700' },
  ...(FEATURE_FLAGS.enableHRModule ? {
    human_resource:    { label: 'Human Resource', color: 'text-pink-700', bg: 'bg-pink-50',   badge: 'bg-pink-100 text-pink-700'    },
  } : {}),
}

// ── Roadmap items ─────────────────────────────────────────────────────────────
const ROADMAP = [
  { id: 'wrench-sync', icon: '🔗', name: 'Wrench Bidirectional Sync',  description: 'Two-way live sync between Wrench SmartProject and RADAI.',    eta: 'Q2 2026', status: 'In Dev',    statusColor: 'bg-blue-100 text-blue-700'    },
  { id: 'ai-bom',      icon: '🤖', name: 'AI Bill of Materials',        description: 'Auto-generate BoM from P&ID drawings via vision AI.',        eta: 'Q2 2026', status: 'Planning', statusColor: 'bg-violet-100 text-violet-700' },
  { id: 'mobile',      icon: '📱', name: 'RADAI Mobile App',            description: 'Field-ready companion app for QHSE inspections & alerts.',    eta: 'Q3 2026', status: 'Planning', statusColor: 'bg-violet-100 text-violet-700' },
  { id: 'pred-maint',  icon: '⚡', name: 'Predictive Maintenance',      description: 'ML anomaly detection on sensor data to prevent failures.',    eta: 'Q3 2026', status: 'Research', statusColor: 'bg-gray-100 text-gray-600'     },
]

// ── AI insight chips (static but contextual) ─────────────────────────────────
const AI_INSIGHTS = [
  { id: 1, icon: '📈', text: 'Engineering throughput up 8.4% — AI identified peak processing at 10–11am', color: 'from-blue-50 to-blue-100/60',   border: 'border-blue-200',  label: 'Trend',    labelColor: 'bg-blue-100 text-blue-700'  },
  { id: 2, icon: '⚠️', text: 'QHSE checklist completion rate dropped 3% — recommended: schedule review', color: 'from-amber-50 to-amber-100/60', border: 'border-amber-200', label: 'Alert',    labelColor: 'bg-amber-100 text-amber-700'},
  { id: 3, icon: '✅', text: 'P&ID extraction accuracy holding at 94.2% — model performance nominal',     color: 'from-green-50 to-green-100/60', border: 'border-green-200', label: 'Status',   labelColor: 'bg-green-100 text-green-700'},
]

// ── AI engine models ───────────────────────────────────────────────────────────
const AI_MODELS = [
  { name: 'Language Model',  sub: 'GPT-4o',         status: 'online',  color: '#22c55e' },
  { name: 'Vision Engine',   sub: 'Custom CNN v3',  status: 'online',  color: '#22c55e' },
  { name: 'OCR Pipeline',    sub: 'Tesseract Pro',  status: 'online',  color: '#22c55e' },
  { name: 'Risk Analyzer',   sub: 'RADAI-ML v2',    status: 'standby', color: '#f59e0b' },
]

// ── AI Champion advertisement ticker (soft-coded) ────────────────────────────
// Compact marketing strip rendered below Quick Launch. Rotates messages
// (current champion, runner-up, cost-savings, call-to-action) every
// AI_CHAMPION_TICKER.rotateMs. Click navigates to /admin/ai-champion.
const AI_CHAMPION_TICKER = {
  refreshMs: 60_000,    // poll backend every 60s
  rotateMs:  6_000,     // rotate slide every 6s
  route:     '/admin/ai-champion',
  // Tier visuals shared with the AI Champion page
  tierEmoji: { diamond: '💎', platinum: '🏆', gold: '🥇', silver: '🥈', bronze: '🥉', rookie: '🌱' },
  // Static fallback slides used when no champion data is available yet
  fallback: [
    { tag: 'New',       icon: '🏆', text: 'AI Champion of the Month — earn badges by using RAD AI features.', cta: 'See leaderboard' },
    { tag: 'Realtime',  icon: '⚡', text: 'Top RADAI users are recognised every week, month, and quarter.',     cta: 'View Hall of Fame' },
    { tag: 'Compete',   icon: '🚀', text: 'Every AI request, P&ID and datasheet you process counts towards your score.', cta: 'Join the race' },
  ],
}

// ── Trend line chart (SVG) ────────────────────────────────────────────────────
const TrendLineChart = ({ data, color = '#f97316', fillColor = 'rgba(249,115,22,0.08)', h = 80, showDots = false }) => {
  if (!data || data.length < 2) return null
  const w   = 320
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - ((v - min) / range) * (h - 8) - 4,
  }))
  const line  = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const fill  = `${line} L${w},${h} L0,${h} Z`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height: h }}>
      <defs>
        <linearGradient id="lgFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#lgFill)" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {showDots && pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} stroke="white" strokeWidth="1.5" />
      ))}
    </svg>
  )
}

// ── Mini bar chart ────────────────────────────────────────────────────────────
const MiniBarChart = ({ color = '#f97316', h = 52 }) => {
  const bars   = [0.4, 0.7, 1.0, 0.6, 0.85, 0.5, 0.3]
  const labels = ['M', 'T', 'W', 'T', 'F',  'S', 'S']
  const w = 14, gap = 5
  const totalW = bars.length * w + (bars.length - 1) * gap
  return (
    <svg width={totalW} height={h + 14} viewBox={`0 0 ${totalW} ${h + 14}`}>
      {bars.map((ratio, i) => {
        const barH  = Math.max(6, Math.round(ratio * (h - 6)))
        const x     = i * (w + gap)
        const isMax = ratio === Math.max(...bars)
        return (
          <g key={i}>
            <rect x={x} y={h - barH} width={w} height={barH} rx="3" fill={isMax ? color : '#e5e7eb'} />
            {isMax && <circle cx={x + w / 2} cy={h - barH - 5} r="3" fill={color} />}
            <text x={x + w / 2} y={h + 13} textAnchor="middle" fontSize="8" fill="#9ca3af">{labels[i]}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Accuracy arc gauge ────────────────────────────────────────────────────────
const AccuracyGauge = ({ value = 89 }) => {
  const r = 30, cx = 40, cy = 40
  const circ = 2 * Math.PI * r
  const arc  = (value / 100) * circ
  return (
    <svg width="80" height="80" viewBox="0 0 80 80">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth="8" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="url(#aiGrad)" strokeWidth="8"
        strokeDasharray={`${arc} ${circ}`} strokeDashoffset={circ * 0.25}
        strokeLinecap="round" style={{ transform: 'rotate(-90deg)', transformOrigin: '40px 40px' }} />
      <defs>
        <linearGradient id="aiGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f97316" /><stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <text x="40" y="37" textAnchor="middle" fontSize="13" fontWeight="800" fill="#111827">{value}%</text>
      <text x="40" y="50" textAnchor="middle" fontSize="7"  fill="#9ca3af">Accuracy</text>
    </svg>
  )
}

// ── SVG donut chart ───────────────────────────────────────────────────────────
const DonutChart = ({ segments, size = 96, thickness = 11 }) => {
  const r     = (size - thickness) / 2
  const cx    = size / 2, cy = size / 2
  const circ  = 2 * Math.PI * r
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  let offset  = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth={thickness} />
      {segments.map((seg, i) => {
        const dash = (seg.value / total) * circ
        const el   = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={seg.color} strokeWidth={thickness}
            strokeDasharray={`${Math.max(0, dash - 3)} ${circ}`}
            strokeDashoffset={-offset} strokeLinecap="round" />
        )
        offset += dash
        return el
      })}
    </svg>
  )
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
const SparklineChart = () => (
  <svg viewBox="0 0 240 50" preserveAspectRatio="none" className="w-full" style={{ height: 50 }}>
    <path d="M0,28 C40,10 80,46 120,28 C160,10 200,46 240,28"
      stroke="white" strokeWidth="2.5" fill="none" opacity="0.9" strokeLinecap="round" />
    <path d="M0,38 C30,20 70,54 115,37 C155,20 195,52 240,36"
      stroke="white" strokeWidth="1.5" fill="none" opacity="0.35" strokeLinecap="round" />
  </svg>
)

// ── Daily Usage Bar Chart ─────────────────────────────────────────────────────
// Renders a full-width bar chart from daily_totals array.
// W=100% SVG; bars are purely data-driven — no hard-coded values.
const DailyUsageBarChart = ({ data = [], loading = false, height = 160 }) => {
  const W = 800, H = height
  const PAD = { top: 12, right: 8, bottom: 28, left: 36 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  if (loading) return (
    <div className="flex items-center justify-center" style={{ height }}>
      <div className="w-5 h-5 border-2 border-orange-300 border-t-orange-600 rounded-full animate-spin" />
    </div>
  )

  const rows = data.length ? data : []
  const maxVal = Math.max(...rows.map(r => r.total), 1)
  const barW   = Math.max(2, plotW / Math.max(rows.length, 1) - 2)

  // label every Nth bar so they don't overlap
  const labelEvery = rows.length <= 14 ? 1 : rows.length <= 31 ? 3 : rows.length <= 60 ? 7 : 14

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(pct => {
        const y = PAD.top + plotH * (1 - pct)
        return (
          <g key={pct}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y}
              stroke="#f3f4f6" strokeWidth="1" />
            <text x={PAD.left - 4} y={y + 3} textAnchor="end"
              fontSize="9" fill="#9ca3af">
              {Math.round(maxVal * pct)}
            </text>
          </g>
        )
      })}
      {/* Bars */}
      {rows.map((r, i) => {
        const x       = PAD.left + i * (plotW / rows.length)
        const barPct  = r.total / maxVal
        const barH    = Math.max(barPct * plotH, r.total > 0 ? 2 : 0)
        const y       = PAD.top + plotH - barH
        const succPct = r.total > 0 ? r.success / r.total : 1
        const fill    = succPct >= 0.95 ? '#f97316' : succPct >= 0.8 ? '#fbbf24' : '#f87171'
        return (
          <g key={r.date}>
            <rect x={x + 1} y={y} width={barW} height={barH}
              fill={fill} opacity="0.85" rx="2" />
            {r.failed > 0 && (
              <rect x={x + 1} y={y} width={barW}
                height={Math.max((r.failed / maxVal) * plotH, 1)}
                fill="#f87171" opacity="0.5" rx="2" />
            )}
            {i % labelEvery === 0 && (
              <text x={x + barW / 2 + 1} y={H - 6}
                textAnchor="middle" fontSize="8" fill="#9ca3af">
                {r.date?.slice(5) /* MM-DD */}
              </text>
            )}
          </g>
        )
      })}
      {/* Trend line (polyline over bar tops) */}
      {rows.length > 1 && (
        <polyline
          points={rows.map((r, i) => {
            const x = PAD.left + i * (plotW / rows.length) + barW / 2 + 1
            const y = PAD.top + plotH - (r.total / maxVal) * plotH
            return `${x},${y}`
          }).join(' ')}
          fill="none" stroke="#f97316" strokeWidth="1.5" strokeOpacity="0.5"
          strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 2"
        />
      )}
    </svg>
  )
}

// ── Module → category mapping (for RBAC-aware filtering) ─────────────────────
const MODULE_CATEGORY_MAP = {
  pid_analysis:           'engineering',
  pfd_to_pid:             'engineering',
  electrical_datasheet:   'engineering',
  instrument_datasheet:   'engineering',
  mechanical_datasheet:   'engineering',
  crs_documents:          'document_management',
  project_control:        'project_control',
  qhse:                   'quality_assurance',
  sales:                  'sales',
  finance:                'finance',
  procurement:            'procurement',
  ...(FEATURE_FLAGS.enableHRModule ? { human_resource: 'human_resource' } : {}),
  designiq:               'engineering',
}

const MODULE_DISPLAY = {
  pid_analysis:         { label: 'P&ID Analysis',  color: 'bg-blue-100 text-blue-700'     },
  pfd_to_pid:           { label: 'PFD to P&ID',    color: 'bg-blue-100 text-blue-700'     },
  electrical_datasheet: { label: 'Electrical DS',  color: 'bg-indigo-100 text-indigo-700' },
  instrument_datasheet: { label: 'Instrument DS',  color: 'bg-violet-100 text-violet-700' },
  mechanical_datasheet: { label: 'Mechanical DS',  color: 'bg-purple-100 text-purple-700' },
  crs_documents:        { label: 'Documents',      color: 'bg-teal-100 text-teal-700'     },
  project_control:      { label: 'Projects',       color: 'bg-indigo-100 text-indigo-700' },
  qhse:                 { label: 'QHSE',           color: 'bg-green-100 text-green-700'   },
  sales:                { label: 'Sales',           color: 'bg-rose-100 text-rose-700'     },
  finance:              { label: 'Finance',         color: 'bg-amber-100 text-amber-700'   },
  procurement:          { label: 'Procurement',     color: 'bg-orange-100 text-orange-700' },
  ...(FEATURE_FLAGS.enableHRModule ? { human_resource: { label: 'Human Resource', color: 'bg-pink-100 text-pink-700' } } : {}),
  designiq:             { label: 'Design IQ',       color: 'bg-cyan-100 text-cyan-700'     },
}

// ── Recommendations builder ───────────────────────────────────────────────────
const buildRecommendations = ({ notifications, dashboardStats, metricsData, features, userModuleCodes, isAdmin }) => {
  const recs = []
  // Notifications — always visible to all authenticated users
  const unread = notifications.filter(n => !n.is_read).length
  if (unread > 0) recs.push({ id: 'notif', Icon: BellIcon, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', priority: 'High', title: `${unread} unread alert${unread > 1 ? 's' : ''}`, subtitle: 'Review latest notifications', route: '/notifications' })
  // System health — only meaningful for admins
  const hp = metricsData?.performance?.system_health
  if (isAdmin && hp !== undefined && hp < 85) recs.push({ id: 'health', Icon: ExclamationTriangleIcon, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', priority: 'Critical', title: `System health ${hp}%`, subtitle: 'Backend services need review', route: null })
  // Active projects — only if user has project_control module (or is admin)
  const ap = dashboardStats.projects?.active_count || 0
  const canSeeProjects = isAdmin || (userModuleCodes || []).includes('project_control')
  if (ap > 0 && canSeeProjects) recs.push({ id: 'projects', Icon: FolderOpenIcon, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', priority: 'Medium', title: `${ap} active project${ap > 1 ? 's' : ''}`, subtitle: 'Review progress & milestones', route: '/projects' })
  // Feature suggestions — filtered to categories the user can access
  const defaultCats = ['engineering', 'document_management', 'quality_assurance', 'project_control', 'sales']
  const accessibleCats = isAdmin
    ? defaultCats
    : [...new Set((userModuleCodes || []).map(m => MODULE_CATEGORY_MAP[m]).filter(Boolean))]
  for (const cat of (accessibleCats.length ? accessibleCats : defaultCats)) {
    if (recs.length >= 4) break
    const f    = features?.find(feat => feat.category === cat)
    if (!f) continue
    const meta = CATEGORY_META[cat] || {}
    recs.push({ id: `f_${cat}`, Icon: SparklesIcon, color: meta.color || 'text-gray-600', bg: meta.bg || 'bg-gray-50', border: 'border-gray-200', priority: 'Low', title: f.name, subtitle: f.description, route: f.frontendRoute })
  }
  return recs.slice(0, 4)
}

const PRIORITY_COLORS = {
  Critical: 'bg-red-100 text-red-700',
  High:     'bg-orange-100 text-orange-700',
  Medium:   'bg-blue-100 text-blue-700',
  Low:      'bg-gray-100 text-gray-600',
}

// ── Soft-coded layout dimensions — tune here, no JSX changes needed ────────────
// maxWidth:       overall page cap — '1600px' fills wide monitors without overflow
// sidebarWidth:   right panel fixed width
// heroColSpan:    hero card col-span inside the top 5-col grid (1–4; donut takes 5-heroColSpan)
// outerPaddingX:  horizontal gutters (Tailwind classes)
// outerPaddingY:  vertical top/bottom padding (Tailwind class)
const LAYOUT = {
  maxWidth:      '1600px',
  sidebarWidth:  '300px',
  heroColSpan:   3,           // hero card takes 3 of 5 cols; donut gets 2
  outerPaddingX: 'px-4 sm:px-8 lg:px-12 xl:px-16',
  outerPaddingY: 'py-8',
  sectionGap:    'gap-7',
  innerGap:      'space-y-6',
}

// ── Soft-coded animation config — adjust durations/delays without touching JSX ──
// Increase staggerMs to slow card entrance; set enabled:false to disable all
const ANIM = {
  enabled:       true,
  staggerMs:     80,    // ms between each staggered card
  fadeInMs:      520,   // fade + slide-up duration for section entry
  pulseMs:       2800,  // hero number counter pulse period
  shimmerMs:     2200,  // shimmer sweep on hero card
  kpiHoverScale: 1.025, // scale factor on KPI card hover
}

// Inject keyframes once (idempotent)
const _STYLE_ID = 'radai-dash-anim'
if (typeof document !== 'undefined' && !document.getElementById(_STYLE_ID)) {
  const s = document.createElement('style')
  s.id = _STYLE_ID
  s.textContent = `
    @keyframes radai-fadein {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0);    }
    }
    @keyframes radai-shimmer {
      0%   { transform: translateX(-100%) skewX(-15deg); }
      100% { transform: translateX(220%)  skewX(-15deg); }
    }
    @keyframes radai-scalein {
      from { opacity: 0; transform: scale(0.94); }
      to   { opacity: 1; transform: scale(1);    }
    }
    @keyframes radai-slidein-right {
      from { opacity: 0; transform: translateX(22px); }
      to   { opacity: 1; transform: translateX(0);    }
    }
    @keyframes radai-countup {
      0%   { opacity: 0.3; transform: scale(0.92); }
      60%  { opacity: 1;   transform: scale(1.04); }
      100% { opacity: 1;   transform: scale(1);    }
    }
    @keyframes radai-ticker-progress {
      from { width: 0%;   }
      to   { width: 100%; }
    }
    .radai-fadein   { animation: radai-fadein  ${ANIM.fadeInMs}ms cubic-bezier(.22,.68,0,1.2) both; }
    .radai-scalein  { animation: radai-scalein ${ANIM.fadeInMs}ms cubic-bezier(.22,.68,0,1.2) both; }
    .radai-slidein  { animation: radai-slidein-right ${ANIM.fadeInMs}ms cubic-bezier(.22,.68,0,1.2) both; }
    .radai-countup  { animation: radai-countup ${ANIM.pulseMs}ms ease both; }
    .radai-kpi:hover { transform: scale(${ANIM.kpiHoverScale}) translateY(-2px); box-shadow: 0 6px 24px -4px rgba(249,115,22,0.15); transition: transform 0.22s ease, box-shadow 0.22s ease; }
  `
  document.head.appendChild(s)
}

// ── AI Champion ticker (compact marketing strip) ─────────────────────────────
const AIChampionTicker = () => {
  const navigate = useNavigate()
  const [champion, setChampion] = useState(null)
  const [slideIdx, setSlideIdx] = useState(0)

  // Build slide list from live data + fallback
  const slides = useMemo(() => {
    const out = []
    const top = champion?.champion
    const runner = champion?.podium?.[1]
    if (top) {
      const name = top.user?.name || top.user?.email || 'Top user'
      const tierIcon = AI_CHAMPION_TICKER.tierEmoji[top.tier] || '🏆'
      out.push({
        tag: 'Live · Champion',
        icon: tierIcon,
        text: `${name} is leading this month with ${Number(top.champion_score || 0).toFixed(0)} pts`,
        cta: 'See leaderboard',
        accent: 'from-amber-400 to-orange-500',
      })
    }
    if (runner) {
      const rname = runner.user?.name || runner.user?.email || 'Runner-up'
      out.push({
        tag: 'Runner-up',
        icon: '🥈',
        text: `${rname} climbing fast — ${Number(runner.champion_score || 0).toFixed(0)} pts`,
        cta: 'View podium',
        accent: 'from-slate-400 to-slate-600',
      })
    }
    out.push({
      tag: 'Earn badges',
      icon: '🚀',
      text: 'Use RAD AI features to climb the realtime, weekly, monthly & quarterly Hall of Fame.',
      cta: 'Join the race',
      accent: 'from-fuchsia-500 to-purple-600',
    })
    if (out.length < 2) {
      AI_CHAMPION_TICKER.fallback.forEach((s) => out.push({ ...s, accent: 'from-orange-500 to-pink-500' }))
    }
    return out
  }, [champion])

  // Poll backend
  useEffect(() => {
    let mounted = true
    const fetchOnce = () =>
      analyticsService.getCurrentChampion()
        .then((d) => { if (mounted) setChampion(d) })
        .catch(() => {})
    fetchOnce()
    const id = setInterval(fetchOnce, AI_CHAMPION_TICKER.refreshMs)
    return () => { mounted = false; clearInterval(id) }
  }, [])

  // Rotate slides
  useEffect(() => {
    if (slides.length <= 1) return
    const id = setInterval(() => setSlideIdx((i) => (i + 1) % slides.length), AI_CHAMPION_TICKER.rotateMs)
    return () => clearInterval(id)
  }, [slides.length])

  const slide = slides[slideIdx % slides.length] || slides[0]
  if (!slide) return null

  return (
    <button
      type="button"
      onClick={() => navigate(AI_CHAMPION_TICKER.route)}
      className="group relative w-full overflow-hidden rounded-2xl border border-amber-200 shadow-sm hover:shadow-md transition-all text-left"
      title="Open AI Champion dashboard"
      style={{ background: 'linear-gradient(135deg,#fff7ed 0%,#fef3c7 45%,#fce7f3 100%)' }}
    >
      {/* Decorative orbs */}
      <div aria-hidden="true" className={`absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-30 bg-gradient-to-br ${slide.accent} blur-xl`} />
      <div aria-hidden="true" className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full opacity-20 bg-gradient-to-br from-amber-300 to-pink-300 blur-xl" />

      <div className="relative flex items-center gap-3 px-4 py-2.5">
        {/* Trophy badge */}
        <div className={`flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br ${slide.accent} flex items-center justify-center shadow-sm`}>
          <TrophyIcon className="w-5 h-5 text-white" />
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full text-white bg-gradient-to-r ${slide.accent}`}>
              {slide.tag}
            </span>
            <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-amber-700">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              AI Champion
            </span>
            <span className="ml-auto text-[9px] text-amber-700/70 hidden sm:inline">{slideIdx + 1}/{slides.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="text-base leading-none">{slide.icon}</span>
            <p className="text-[11.5px] font-semibold text-gray-800 leading-tight truncate">
              {slide.text}
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="flex-shrink-0 hidden sm:flex items-center gap-1 text-[11px] font-bold text-orange-700 group-hover:text-orange-900 transition">
          {slide.cta}
          <ChevronRightIcon className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>

      {/* Progress bar (rotation timer) */}
      {slides.length > 1 && (
        <div className="relative h-0.5 bg-amber-100/60 overflow-hidden">
          <div
            key={slideIdx}
            className={`absolute inset-y-0 left-0 bg-gradient-to-r ${slide.accent}`}
            style={{ animation: `radai-ticker-progress ${AI_CHAMPION_TICKER.rotateMs}ms linear forwards` }}
          />
        </div>
      )}
    </button>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { user }              = useSelector(s => s.auth)
  const { features, loading } = useSelector(s => s.features)
  const rbacCurrentUser       = useSelector(s => s.rbac?.currentUser)
  const dispatch              = useDispatch()
  const navigate              = useNavigate()

  const [activeTab,      setActiveTab]      = useState('features')
  const [activeCategory, setActiveCategory] = useState('all')
  const [analyticsRange, setAnalyticsRange] = useState('30d')
  const [usageRange,     setUsageRange]     = useState('30')
  const [showSupport,    setShowSupport]    = useState(false)
  const [showDocs,       setShowDocs]       = useState(false)
  const [dashboardStats, setDashboardStats] = useState({})
  const [notifications,  setNotifications]  = useState([])
  const [metricsData,    setMetricsData]    = useState({})
  const [loadingStats,   setLoadingStats]   = useState(true)
  const [lastRefreshed,  setLastRefreshed]  = useState(null)
  const [aiPulse,        setAiPulse]        = useState(false)
  const [usageData,      setUsageData]      = useState({ summary: {}, daily_totals: [], discipline_breakdown: [] })
  const [loadingUsage,   setLoadingUsage]   = useState(false)

  // ── Derive RBAC access from Redux (no core logic change) ────────────────────
  const rbacData = rbacCurrentUser || user
  const rbacUser = rbacData?.user || rbacData
  const isAdmin  = !!(rbacUser?.is_staff || rbacUser?.is_superuser || rbacData?.roles?.some(r => r.code === 'super_admin' || r.name === 'Super Administrator'))
  const userModuleCodes = useMemo(() => {
    if (isAdmin) return Object.keys(MODULE_CATEGORY_MAP)
    const mods = rbacData?.modules || rbacCurrentUser?.modules || []
    return Array.isArray(mods) ? mods.map(m => (typeof m === 'string' ? m : m.code)).filter(Boolean) : []
  }, [isAdmin, rbacData, rbacCurrentUser])

  // ── Role-based routing: non-admins get PersonalDashboard ────────────────────
  if (!isAdmin) {
    return <PersonalDashboard />
  }

  const userRoleLabel  = useMemo(() => {
    const u = rbacData || {}
    if (u.is_superuser) return 'Super Administrator'
    if (u.is_staff)     return 'Administrator'
    const role = (u.roles || [])[0]
    if (role?.name)   return role.name
    if (role?.code)   return role.code.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    return 'Standard User'
  }, [rbacData])

  useEffect(() => { dispatch(fetchFeatures()); loadAll() }, [dispatch])
  useEffect(() => { const t = setInterval(loadAll, 30000); return () => clearInterval(t) }, [])
  useEffect(() => { const t = setInterval(() => setAiPulse(p => !p), 3000); return () => clearInterval(t) }, [])

  const loadAll = async () => {
    await Promise.all([fetchData(), fetchMetrics()])
    setLoadingStats(false)
    setLastRefreshed(new Date())
  }

  const fetchMetrics = async () => {
    try {
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access')
      const res   = await fetch(`${API_BASE_URL}/dashboard/metrics/`, { headers: { Authorization: `Bearer ${token}` } })
      // Graceful: 403 = user lacks admin metrics access; skip silently
      if (res.ok) setMetricsData(await res.json())
    } catch { /* silent */ }
  }

  const fetchUsage = async (days = usageRange) => {
    try {
      setLoadingUsage(true)
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access')
      const res   = await fetch(`${API_BASE_URL}/dashboard/usage/?days=${days}`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) setUsageData(await res.json())
    } catch { /* silent */ } finally {
      setLoadingUsage(false)
    }
  }

  // Re-fetch usage whenever date range changes
  useEffect(() => { fetchUsage(usageRange) }, [usageRange])

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access')
      const h     = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      const [nr, pr, er] = await Promise.allSettled([
        // Notifications: always available to all authenticated users
        fetch(`${API_BASE_URL}/notifications/`, { headers: h }).then(r => r.ok ? r.json() : null),
        // Projects stats: gracefully skip if 403 (no project_control module)
        fetch(`${API_BASE_URL}/projects/stats/`, { headers: h }).then(r => r.ok ? r.json() : null),
        // P&ID stats: gracefully skip if 403 (no pid_analysis module)
        fetch(`${API_BASE_URL}/pid/stats/`,      { headers: h }).then(r => r.ok ? r.json() : null),
      ])
      if (nr.status === 'fulfilled' && nr.value) setNotifications(nr.value.results || nr.value)
      const stats = {}
      if (pr.status === 'fulfilled' && pr.value) stats.projects    = pr.value
      if (er.status === 'fulfilled' && er.value) stats.engineering = er.value
      setDashboardStats(stats)
    } catch { /* silent */ }
  }

  const getGreeting = () => {
    const h = new Date().getHours()
    return h < 12 ? 'Good Morning' : h < 18 ? 'Good Afternoon' : 'Good Evening'
  }

  const displayName = USER_DISPLAY_CONFIG.formatting.getDisplayName(user)
  const unread      = notifications.filter(n => !n.is_read).length
  const health      = metricsData?.performance?.system_health
  const totalDocs   = metricsData?.documents?.total_documents || 0
  const activeUsers = metricsData?.users?.active_users || 0
  const totalUsers  = metricsData?.users?.total_users || 1
  const today       = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  const pipelineSegs = [
    { label: 'Approved',  value: 55, color: '#f97316' },
    { label: 'In Review', value: 30, color: '#fbbf24' },
    { label: 'Pending',   value: 15, color: '#fbcfe8' },
  ]

  const recommendations = useMemo(
    () => buildRecommendations({ notifications, dashboardStats, metricsData, features, userModuleCodes, isAdmin }),
    [notifications, dashboardStats, metricsData, features, userModuleCodes, isAdmin],
  )

  const categorizedFeatures = useMemo(() =>
    features?.reduce((acc, f) => {
      const c = f.category || 'other';
      (acc[c] = acc[c] || []).push(f)
      return acc
    }, {}) || {}
  , [features])

  // DEBUG: Log categorizedFeatures to console
  useEffect(() => {
    console.log('🔍 Dashboard: features from Redux:', features);
    console.log('🔍 Dashboard: features length:', features?.length);
    if (features && features.length > 0) {
      const pc = features.filter(f => f.category === 'project_control');
      console.log('🎯 PROJECT_CONTROL features in Redux:', pc);
      pc.forEach(f => {
        console.log(`  - ${f.name} (order: ${f.order}, route: ${f.frontendRoute || f.frontend_route})`);
      });
    }
    
    if (categorizedFeatures && Object.keys(categorizedFeatures).length > 0) {
      console.log('✅ Dashboard: categorizedFeatures loaded:', {
        categories: Object.keys(categorizedFeatures),
        totalFeatures: Object.values(categorizedFeatures).flat().length,
        project_control: categorizedFeatures.project_control || 'NOT FOUND'
      });
      if (categorizedFeatures.project_control) {
        console.log('🎯 PROJECT_CONTROL in categorizedFeatures:', categorizedFeatures.project_control);
      }
    } else {
      console.log('⚠️ Dashboard: categorizedFeatures is empty or not loaded');
    }
  }, [categorizedFeatures, features]);

  const categoryTabs = useMemo(() => {
    const active = Object.keys(categorizedFeatures).filter(k => k !== 'other' && categorizedFeatures[k].length > 0)
    return [{ id: 'all', label: 'All' }, ...active.map(k => ({ id: k, label: CATEGORY_META[k]?.label || k }))]
  }, [categorizedFeatures])

  const featureActivity = useMemo(() => {
    if (!features) return []
    console.log('🔍 featureActivity: Processing features:', features.length);
    const USES  = [2100, 1847, 1203, 956, 743, 520]
    const TREND = [4,    7,    -2,   5,   8,   -1]
    const CONF  = [94,   91,   88,   95,  87,   92]
    const seen  = new Set()
    // Filter by user's accessible module categories (backend also filters, this is belt-and-suspenders)
    const accessibleCats = isAdmin
      ? null  // null = show all
      : new Set(userModuleCodes.map(m => MODULE_CATEGORY_MAP[m]).filter(Boolean))
    
    const result = features
      .filter(f => f.category !== 'other')
      .filter(f => isAdmin || !accessibleCats || accessibleCats.has(f.category))
      .filter(f => { if (seen.has(f.frontendRoute || f.frontend_route)) return false; seen.add(f.frontendRoute || f.frontend_route); return true })
      .slice(0, 6)
      .map((f, i) => ({ ...f, uses: USES[i] || 400 + i * 200, trend: TREND[i] || 3, conf: CONF[i] || 90 }))
    
    console.log('🔍 featureActivity: Result:', result.length, 'features');
    result.forEach(f => console.log(`  - ${f.name} (${f.category})`));
    return result;
  }, [features, isAdmin, userModuleCodes])

  const filteredActivity = useMemo(() =>
    activeCategory === 'all' ? featureActivity : featureActivity.filter(f => f.category === activeCategory)
  , [featureActivity, activeCategory])

  const docsDisplay = totalDocs >= 1000 ? `${(totalDocs / 1000).toFixed(1)}K` : (totalDocs || '1.2K')

  // ── Analytics: derive chart data from real metricsData ─────────────────────
  const trendPoints = useMemo(() => {
    const base = totalDocs || 120
    // Simulate 30-point trend based on real total (rises toward current value)
    return Array.from({ length: 30 }, (_, i) => {
      const progress = (i + 1) / 30
      const noise    = Math.sin(i * 1.3) * 0.08 + Math.cos(i * 0.7) * 0.05
      return Math.max(1, Math.round(base * (0.6 + 0.4 * progress + noise)))
    })
  }, [totalDocs])

  const categoryBreakdown = useMemo(() => {
    const total = Math.max(totalDocs, 1)
    return [
      { label: 'Engineering',  value: Math.round(total * 0.33), color: '#3b82f6',  pct: 33 },
      { label: 'QHSE',         value: Math.round(total * 0.25), color: '#22c55e',  pct: 25 },
      { label: 'Documents',    value: Math.round(total * 0.20), color: '#14b8a6',  pct: 20 },
      { label: 'Projects',     value: Math.round(total * 0.14), color: '#8b5cf6',  pct: 14 },
      { label: 'Sales & Other',value: Math.round(total * 0.08), color: '#f97316',  pct: 8  },
    ]
  }, [totalDocs])

  const kpiCards = useMemo(() => [
    { label: 'Avg. Processing Time', value: '2.4s', sub: '↓ 0.3s vs last week',   good: true  },
    { label: 'Error Rate',           value: loadingStats ? '—' : `${Math.max(0, 100 - (health || 96)).toFixed(1)}%`, sub: 'Below threshold',      good: true  },
    { label: 'Queue Depth',          value: loadingStats ? '—' : (dashboardStats.projects?.pending_count || 0), sub: 'Documents pending',     good: (dashboardStats.projects?.pending_count || 0) < 20 },
    { label: 'Throughput / hr',      value: loadingStats ? '—' : `${Math.round((totalDocs || 120) / 720)}`, sub: 'Docs per hour (30d avg)', good: true  },
  ], [health, totalDocs, dashboardStats, loadingStats])

  const refreshLabel = lastRefreshed
    ? lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f8f7f4 0%, #f2f1ee 60%, #ede9e3 100%)' }}>
      <div className={`mx-auto ${LAYOUT.outerPaddingX} ${LAYOUT.outerPaddingY} ${LAYOUT.innerGap}`} style={{ maxWidth: LAYOUT.maxWidth }}>

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            {/* AI brain icon */}
            <div className="relative mt-0.5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #f97316, #ec4899)' }}>
                <CpuChipIcon className="w-5 h-5 text-white" />
              </div>
              <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-white ${aiPulse ? 'opacity-100' : 'opacity-60'} transition-opacity duration-700`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">AI Operations Center</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-sm">RADAI</span>
              </div>
              <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
                  <span>{getGreeting()}, {displayName}</span>
                </span>
                <span className="text-gray-300">·</span>
                <span>{today}</span>
              </p>
            </div>
          </div>

          {/* Right header controls */}
          <div className="flex items-center gap-2">
            {/* AI status badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white border border-green-200 rounded-xl shadow-sm">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[11px] font-semibold text-green-700">AI Active</span>
              <span className="text-[10px] text-gray-400 border-l border-gray-200 pl-1.5 ml-0.5">GPT-4o + Vision</span>
            </div>
            <button onClick={loadAll} title="Refresh" className="p-2 text-gray-400 hover:text-gray-700 hover:bg-white rounded-xl border border-transparent hover:border-gray-200 transition">
              <ArrowPathIcon className="w-4 h-4" />
            </button>
            <button onClick={() => navigate('/notifications')} className="relative p-2 text-gray-400 hover:text-orange-500 hover:bg-white rounded-xl border border-transparent hover:border-gray-200 transition">
              <BellIcon className="w-4 h-4" />
              {unread > 0 && <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-orange-500 text-[9px] font-bold text-white rounded-full flex items-center justify-center">{unread}</span>}
            </button>
          </div>
        </div>

        {/* ── Main layout: left + right sidebar ────────────────────────────── */}
        <div className={`flex ${LAYOUT.sectionGap} items-start`}>

          {/* ── Left content ─────────────────────────────────────────────── */}
          <div className={`flex-1 min-w-0 ${LAYOUT.innerGap}`}>

            {/* Top row: Hero card + Donut card */}
            <div className={`grid grid-cols-5 gap-5 ${ANIM.enabled ? 'radai-fadein' : ''}`}
              style={ANIM.enabled ? { animationDelay: `${ANIM.staggerMs}ms` } : {}}>

              {/* Hero gradient card */}
              <div className={`col-span-${LAYOUT.heroColSpan} relative overflow-hidden rounded-2xl p-6 text-white shadow-lg shadow-orange-200/40`}
                style={{ background: 'linear-gradient(135deg, #ea580c 0%, #f97316 30%, #e11d48 75%, #db2777 100%)' }}>

                {/* Blurred glow blobs */}
                <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, white, transparent)' }} />
                <div className="absolute -bottom-6 left-10 w-28 h-28 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #fbbf24, transparent)' }} />
                {/* Shimmer sweep — soft-coded via ANIM.shimmerMs */}
                {ANIM.enabled && (
                  <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
                    <div style={{
                      position: 'absolute', top: 0, left: 0, width: '40%', height: '100%',
                      background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.12) 50%, transparent 70%)',
                      animation: `radai-shimmer ${ANIM.shimmerMs}ms ease-in-out infinite`,
                      animationDelay: '1.2s',
                    }} />
                  </div>
                )}

                <div className="relative">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <DocumentMagnifyingGlassIcon className="w-4 h-4 text-white/80" />
                      <span className="text-sm font-semibold text-white/90">AI Documents Processed</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-white/20 rounded-full text-white/90 backdrop-blur-sm">
                      Live
                    </span>
                  </div>

                  <div className="flex items-end gap-3 mt-2 mb-1">
                    <span className="text-5xl font-extrabold tracking-tight leading-none">
                      {loadingStats ? '—' : docsDisplay}
                    </span>
                    <div className="mb-1.5">
                      <div className="flex items-center gap-1 text-white/90 text-sm font-semibold">
                        <ArrowTrendingUpIcon className="w-3.5 h-3.5" />
                        <span>+8.4%</span>
                      </div>
                      <span className="text-[10px] text-white/60">vs last month</span>
                    </div>
                  </div>

                  {/* AI confidence row */}
                  <div className="flex items-center gap-2 mb-4">
                    <CpuChipIcon className="w-3.5 h-3.5 text-white/60" />
                    <span className="text-[11px] text-white/70">AI Model Confidence</span>
                    <span className="text-[11px] font-bold text-white bg-white/20 px-1.5 py-0.5 rounded-md">94.2%</span>
                    <span className="text-[10px] text-white/50 ml-auto">Last run: 3 min ago</span>
                  </div>

                  {/* Sparkline */}
                  <SparklineChart />

                  {/* Breakdown row */}
                  <div className="grid grid-cols-3 pt-3 mt-2 border-t border-white/20 text-center">
                    {[['Engineering', '58%'], ['QHSE', '27%'], ['Other', '15%']].map(([lbl, val], i) => (
                      <div key={i} className={i < 2 ? 'border-r border-white/20' : ''}>
                        <div className="text-[10px] text-white/65 mb-0.5">{lbl}</div>
                        <div className="text-base font-bold">{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Donut card */}
              <div className={`col-span-${5 - LAYOUT.heroColSpan} bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col`}>
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <span className="text-sm font-bold text-gray-800">Document Pipeline</span>
                    <p className="text-[10px] text-gray-400 mt-0.5">AI-classified documents</p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full border border-orange-100">AI</span>
                </div>
                <p className="text-3xl font-extrabold text-gray-900 mb-4">
                  {totalDocs >= 1000 ? `${(totalDocs / 1000).toFixed(1)}k` : (totalDocs ? `${totalDocs}` : '0.3k')}
                </p>
                <div className="flex items-center gap-5 flex-1">
                  <div className="relative flex-shrink-0">
                    <DonutChart segments={pipelineSegs} size={96} thickness={11} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl">🛢️</span>
                    </div>
                  </div>
                  <div className="space-y-2.5 flex-1">
                    {pipelineSegs.map((seg, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: seg.color }} />
                        <span className="text-gray-500">{seg.label}</span>
                        <div className="flex-1 h-1 rounded-full bg-gray-100 overflow-hidden mx-1">
                          <div className="h-full rounded-full transition-all" style={{ width: `${seg.value}%`, background: seg.color }} />
                        </div>
                        <span className="font-bold text-gray-800 w-8 text-right">{seg.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── AI Insight chips ──────────────────────────────────────── */}
            <div className={`grid grid-cols-3 gap-3 ${ANIM.enabled ? 'radai-fadein' : ''}`}
              style={ANIM.enabled ? { animationDelay: `${ANIM.staggerMs * 2}ms` } : {}}>
              {AI_INSIGHTS.map(ins => (
                <div key={ins.id}
                  className={`relative overflow-hidden rounded-xl p-3.5 bg-gradient-to-br ${ins.color} border ${ins.border} flex items-start gap-3`}
                >
                  <div className="w-8 h-8 flex-shrink-0 rounded-lg bg-white/70 backdrop-blur-sm flex items-center justify-center text-base shadow-sm">
                    {ins.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <LightBulbIcon className="w-3 h-3 text-gray-500" />
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">AI Insight</span>
                      <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full ${ins.labelColor}`}>{ins.label}</span>
                    </div>
                    <p className="text-[11px] text-gray-700 leading-relaxed">{ins.text}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Feature Activity / Roadmap ─────────────────────────────── */}
            <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden ${ANIM.enabled ? 'radai-fadein' : ''}`}
              style={ANIM.enabled ? { animationDelay: `${ANIM.staggerMs * 3}ms` } : {}}>

              {/* Tabs */}
              <div className="px-5 pt-4 pb-0 flex items-center gap-6 border-b border-gray-100">
                {[{ id: 'features',   label: 'Feature Activity',           icon: BoltIcon        },
                  { id: 'analytics',  label: 'Analytics',                  icon: ChartBarIcon     },
                  { id: 'roadmap',    label: 'AI Roadmap',                 icon: RocketLaunchIcon },
                  { id: 'usage',      label: 'Usage',                      icon: SignalIcon       },
                  { id: 'gaRealtime', label: 'Google Analytics — Real-time', icon: GlobeAltIcon     },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`pb-3 text-sm font-semibold border-b-2 transition flex items-center gap-1.5
                      ${activeTab === tab.id
                        ? 'border-orange-500 text-gray-900'
                        : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                ))}
                {activeTab === 'features' && categoryTabs.length > 1 && (
                  <div className="ml-auto flex items-center gap-1 pb-2">
                    {categoryTabs.map(t => (
                      <button key={t.id} onClick={() => setActiveCategory(t.id)}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition
                          ${activeCategory === t.id ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-100'}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Feature rows */}
              {activeTab === 'features' && (
                <>
                  {/* Column header */}
                  <div className="px-5 py-2 grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 items-center border-b border-gray-50">
                    <div className="w-10" />
                    <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Feature</span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 w-20 text-right">Usage</span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 w-14 text-center">AI Conf.</span>
                    <div className="w-4" />
                  </div>
                  <div className="divide-y divide-gray-50">
                    {loading
                      ? [1, 2, 3, 4].map(i => (
                          <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                            <div className="w-10 h-10 rounded-xl bg-gray-100 animate-pulse" />
                            <div className="flex-1 space-y-1.5">
                              <div className="h-3 bg-gray-100 rounded-full w-1/2 animate-pulse" />
                              <div className="h-2 bg-gray-50 rounded-full w-2/3 animate-pulse" />
                            </div>
                          </div>
                        ))
                      : filteredActivity.length > 0
                        ? filteredActivity.map(f => {
                            const meta    = CATEGORY_META[f.category] || {}
                            const usesStr = f.uses >= 1000 ? `${(f.uses / 1000).toFixed(1)}k` : `${f.uses}`
                            const confColor = f.conf >= 92 ? 'text-green-600 bg-green-50' : f.conf >= 85 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50'
                            return (
                              <div key={f.id} onClick={() => navigate(f.frontendRoute)}
                                className="flex items-center gap-4 px-5 py-3.5 hover:bg-gradient-to-r hover:from-orange-50/30 hover:to-transparent cursor-pointer transition group"
                              >
                                <div className={`w-10 h-10 rounded-xl ${meta.bg || 'bg-gray-100'} flex items-center justify-center text-xl flex-shrink-0 group-hover:scale-105 transition-transform`}>
                                  {f.icon || '📊'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-orange-600 transition">{f.name}</p>
                                    <span className={`hidden sm:inline text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${meta.badge || 'bg-gray-100 text-gray-600'}`}>
                                      {meta.label || f.category}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-gray-400 truncate">{f.description}</p>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0 w-20 justify-end">
                                  <span className="text-sm font-bold text-gray-700">{usesStr}</span>
                                  <span className={`text-[10px] font-bold ${f.trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    {f.trend >= 0 ? '▲' : '▼'}{Math.abs(f.trend)}%
                                  </span>
                                </div>
                                <div className={`w-14 text-center text-[11px] font-bold px-2 py-0.5 rounded-lg ${confColor} flex-shrink-0`}>
                                  {f.conf}%
                                </div>
                                <ChevronRightIcon className="w-4 h-4 text-gray-200 group-hover:text-orange-400 flex-shrink-0 transition" />
                              </div>
                            )
                          })
                        : (
                          <div className="py-12 text-center">
                            <QuestionMarkCircleIcon className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                            <p className="text-sm text-gray-400">No features available</p>
                          </div>
                        )
                    }
                  </div>
                </>
              )}

              {/* Analytics tab */}
              {activeTab === 'analytics' && (
                <div className="p-5 space-y-5">

                  {/* Time-range selector + last refreshed */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 rounded-xl p-1">
                      {['7d', '30d', '90d'].map(r => (
                        <button key={r} onClick={() => setAnalyticsRange(r)}
                          className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition ${
                            analyticsRange === r
                              ? 'bg-white shadow-sm text-orange-600 border border-orange-100'
                              : 'text-gray-400 hover:text-gray-600'
                          }`}
                        >
                          {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : '90 Days'}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      {refreshLabel && (
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                          Updated {refreshLabel}
                        </span>
                      )}
                      <button onClick={loadAll}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-orange-600 bg-orange-50 border border-orange-100 rounded-xl hover:bg-orange-100 transition">
                        <ArrowPathIcon className="w-3 h-3" /> Refresh
                      </button>
                    </div>
                  </div>

                  {/* KPI cards row */}
                  <div className="grid grid-cols-4 gap-3">
                    {kpiCards.map((kpi, i) => (
                      <div key={i}
                        className={`radai-kpi bg-gradient-to-br from-white to-gray-50/80 rounded-xl p-3.5 border border-gray-100 hover:border-orange-200 transition ${ANIM.enabled ? 'radai-scalein' : ''}`}
                        style={ANIM.enabled ? { animationDelay: `${i * ANIM.staggerMs}ms` } : {}}>
                        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{kpi.label}</div>
                        <div className="text-xl font-extrabold text-gray-900 leading-none mb-1">{kpi.value}</div>
                        <div className={`text-[10px] font-semibold ${kpi.good ? 'text-green-600' : 'text-red-500'}`}>{kpi.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* Trend line chart */}
                  <div className="bg-gradient-to-br from-white to-orange-50/20 rounded-xl border border-gray-100 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-sm font-bold text-gray-800">Document Processing Trend</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          {analyticsRange === '7d' ? 'Last 7 days' : analyticsRange === '30d' ? 'Last 30 days' : 'Last 90 days'} · AI-processed documents
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-extrabold text-gray-900">{docsDisplay}</span>
                        <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">↑ 8.4%</span>
                      </div>
                    </div>
                    <TrendLineChart
                      data={analyticsRange === '7d' ? trendPoints.slice(-7) : analyticsRange === '90d' ? [...trendPoints, ...trendPoints, ...trendPoints.slice(0,30)] : trendPoints}
                      color="#f97316" h={80} showDots={analyticsRange === '7d'}
                    />
                    <div className="flex justify-between mt-1.5 px-0.5">
                      {(analyticsRange === '7d'
                        ? ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
                        : analyticsRange === '30d'
                          ? ['Week 1','Week 2','Week 3','Week 4']
                          : ['Jan','Feb','Mar']
                      ).map(lbl => (
                        <span key={lbl} className="text-[9px] text-gray-300">{lbl}</span>
                      ))}
                    </div>
                  </div>

                  {/* Category breakdown */}
                  <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm font-bold text-gray-800">By Category</div>
                      <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <FunnelIcon className="w-3 h-3" /> Live breakdown
                      </span>
                    </div>
                    <div className="space-y-3">
                      {categoryBreakdown.map((cat, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-[11px] font-semibold text-gray-600 w-24 flex-shrink-0">{cat.label}</span>
                          <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${cat.pct}%`, background: cat.color }}
                            />
                          </div>
                          <div className="flex items-center gap-2 w-20 justify-end">
                            <span className="text-[11px] font-bold text-gray-800">{cat.value >= 1000 ? `${(cat.value/1000).toFixed(1)}k` : cat.value}</span>
                            <span className="text-[9px] text-gray-400">{cat.pct}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}

              {/* Roadmap grid */}
              {activeTab === 'roadmap' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
                  {ROADMAP.map((item, idx) => (
                    <div key={item.id}
                      className="relative flex items-start gap-3 p-4 rounded-xl bg-gradient-to-br from-gray-50 to-white border border-gray-100 hover:border-orange-200 hover:shadow-sm transition overflow-hidden"
                    >
                      <div className="absolute top-3 right-3 text-[10px] font-bold text-gray-300"># {String(idx + 1).padStart(2, '0')}</div>
                      <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-lg flex-shrink-0 shadow-sm">{item.icon}</div>
                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-bold text-gray-800">{item.name}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.statusColor}`}>{item.status}</span>
                        </div>
                        <p className="text-[11px] text-gray-500 leading-relaxed">{item.description}</p>
                        <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-2">
                          <ClockIcon className="w-3 h-3" />
                          <span>ETA {item.eta}</span>
                          <span className="ml-auto text-[9px] text-gray-300 flex items-center gap-0.5">
                            <CpuChipIcon className="w-2.5 h-2.5" /> AI-powered
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Usage tab ───────────────────────────────────────────── */}
              {activeTab === 'usage' && (() => {
                const s   = usageData.summary || {}
                const days = usageData.daily_totals || []
                const disc = usageData.discipline_breakdown || []
                const DISC_COLORS = [
                  '#f97316','#3b82f6','#22c55e','#8b5cf6','#14b8a6',
                  '#f59e0b','#ec4899','#6366f1','#84cc16','#06b6d4',
                ]
                return (
                  <div className="p-4 space-y-4">

                    {/* Range selector */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <SignalIcon className="w-4 h-4 text-orange-500" />
                        <span className="text-sm font-bold text-gray-800">System Usage Trend</span>
                        {loadingUsage && <div className="w-3.5 h-3.5 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />}
                      </div>
                      <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-0.5 border border-gray-100">
                        {[['7','7d'],['14','14d'],['30','30d'],['90','90d']].map(([val, lbl]) => (
                          <button key={val} onClick={() => setUsageRange(val)}
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition
                              ${usageRange === val ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Summary KPI row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Total Requests',  value: (s.total_requests ?? '—').toLocaleString?.() ?? s.total_requests ?? '—', icon: '📡' },
                        { label: 'Active Users',    value: s.active_users   ?? '—', icon: '👥' },
                        { label: 'Success Rate',    value: s.success_rate != null ? `${s.success_rate}%` : '—', icon: '✅' },
                        { label: 'Avg. Response',   value: s.avg_response_ms ? `${s.avg_response_ms}ms` : '—', icon: '⚡' },
                      ].map(kpi => (
                        <div key={kpi.label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                          <div className="text-base mb-1">{kpi.icon}</div>
                          <div className="text-lg font-black text-gray-800 leading-none">{kpi.value}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{kpi.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Bar chart */}
                    <div className="bg-gray-50 rounded-xl border border-gray-100 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-gray-600">Daily Requests</span>
                        <div className="flex items-center gap-2 text-[9px] text-gray-400">
                          <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 rounded-sm bg-orange-400" /> Success</span>
                          <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 rounded-sm bg-red-300" /> Failed</span>
                          <span className="flex items-center gap-0.5"><span className="border-t-2 border-dashed border-orange-400 inline-block w-4" /> Trend</span>
                        </div>
                      </div>
                      {days.length === 0 && !loadingUsage
                        ? <div className="flex items-center justify-center h-32 text-[11px] text-gray-400">No usage data yet for this range.</div>
                        : <DailyUsageBarChart data={days} loading={loadingUsage} height={160} />
                      }
                    </div>

                    {/* Discipline breakdown */}
                    {disc.length > 0 && (
                      <div className="bg-gray-50 rounded-xl border border-gray-100 p-3">
                        <div className="text-[11px] font-bold text-gray-600 mb-3">Usage by Module</div>
                        <div className="space-y-2">
                          {disc.map((d, i) => (
                            <div key={d.key} className="flex items-center gap-2">
                              <div className="w-20 text-[10px] text-gray-500 truncate shrink-0">{d.label}</div>
                              <div className="flex-1 h-2 rounded-full bg-white border border-gray-200 overflow-hidden">
                                <div className="h-full rounded-full transition-all"
                                  style={{ width: `${d.percentage}%`, background: DISC_COLORS[i % DISC_COLORS.length] }}
                                />
                              </div>
                              <div className="w-8 text-[10px] font-bold text-gray-700 text-right shrink-0">{d.percentage}%</div>
                              <div className="w-12 text-[9px] text-gray-400 text-right shrink-0">{d.count.toLocaleString()}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Peak day callout */}
                    {s.peak_day && s.peak_count > 0 && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-50 border border-orange-100 text-[11px]">
                        <span className="text-orange-500">🔥</span>
                        <span className="font-semibold text-gray-700">Peak:</span>
                        <span className="text-gray-600">{s.peak_day}</span>
                        <span className="ml-auto font-bold text-orange-600">{s.peak_count.toLocaleString()} requests</span>
                      </div>
                    )}

                  </div>
                )
              })()}

              {/* ── Google Analytics Real-time tab ─────────────────────── */}
              {activeTab === 'gaRealtime' && (
                <div className="px-5 py-4">
                  <GoogleAnalyticsRealtime isAdmin={isAdmin} />
                </div>
              )}
            </div>

            {/* ── Quick Launch ─────────────────────────────────────────────── */}
            {(loading || featureActivity.length > 0) && (
              <div className={`rounded-2xl overflow-hidden border border-orange-100 shadow-sm ${ANIM.enabled ? 'radai-fadein' : ''}`}
                style={{
                  background: 'linear-gradient(135deg, #fff7ed 0%, #fff1e6 50%, #fce7f3 100%)',
                  ...(ANIM.enabled ? { animationDelay: `${ANIM.staggerMs * 4}ms` } : {}),
                }}>

                {/* Header */}
                <div className="px-5 py-3.5 flex items-center justify-between border-b border-orange-100/80">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center shadow-sm"
                      style={{ background: 'linear-gradient(135deg, #f97316, #ec4899)' }}>
                      <BoltIcon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">Quick Launch</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">AI-ranked</span>
                      </div>
                      <span className="text-[10px] text-gray-400">Top features by usage · refreshes every 30s</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/70 border border-orange-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-[10px] font-semibold text-green-700">Live</span>
                    {refreshLabel && <span className="text-[9px] text-gray-400 pl-1 border-l border-gray-200">{refreshLabel}</span>}
                  </div>
                </div>

                {/* Grid */}
                <div className="p-4 grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {loading
                    ? [1,2,3,4,5,6].map(i => (
                        <div key={i} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/60 animate-pulse">
                          <div className="w-10 h-10 rounded-xl bg-orange-100" />
                          <div className="h-2.5 w-14 bg-orange-50 rounded-full" />
                          <div className="h-2 w-10 bg-orange-50 rounded-full" />
                        </div>
                      ))
                    : featureActivity.slice(0, 6).map((f, i) => {
                        const meta     = CATEGORY_META[f.category] || {}
                        const usesStr  = f.uses >= 1000 ? `${(f.uses / 1000).toFixed(1)}k` : `${f.uses}`
                        const rankGrads = [
                          'from-orange-500 to-pink-500',
                          'from-orange-400 to-rose-400',
                          'from-amber-500 to-orange-400',
                          'from-violet-500 to-indigo-500',
                          'from-teal-500 to-cyan-400',
                          'from-blue-500 to-indigo-400',
                        ]
                        const confColor = f.conf >= 92 ? 'text-green-600' : f.conf >= 85 ? 'text-amber-600' : 'text-red-500'
                        return (
                          <button key={f.id} onClick={() => navigate(f.frontendRoute)}
                            className="group relative flex flex-col items-center gap-2 p-3 rounded-xl border border-orange-100 bg-white/70 hover:bg-white hover:border-orange-300 hover:shadow-md transition-all duration-200 text-center overflow-hidden"
                          >
                            {/* Rank badge */}
                            <div className={`absolute top-2 left-2 w-4 h-4 rounded-md bg-gradient-to-br ${rankGrads[i]} flex items-center justify-center shadow-sm`}>
                              <span className="text-[8px] font-black text-white">{i + 1}</span>
                            </div>

                            {/* Hover glow */}
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"
                              style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(249,115,22,0.07), transparent 70%)' }} />

                            {/* Icon */}
                            <div className={`relative mt-2 w-11 h-11 rounded-xl ${meta.bg || 'bg-orange-50'} flex items-center justify-center text-2xl group-hover:scale-110 transition-transform duration-200 border border-orange-100/50`}>
                              {f.icon || '📊'}
                            </div>

                            {/* Name */}
                            <p className="relative text-[11px] font-semibold text-gray-700 group-hover:text-orange-600 transition leading-tight line-clamp-2 px-0.5">
                              {f.name}
                            </p>

                            {/* Usage + trend */}
                            <div className="relative flex items-center gap-1">
                              <span className="text-[10px] text-gray-500 font-medium">{usesStr}</span>
                              <span className={`text-[9px] font-bold ${f.trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {f.trend >= 0 ? '▲' : '▼'}{Math.abs(f.trend)}%
                              </span>
                            </div>

                            {/* AI confidence */}
                            <div className="relative flex items-center gap-1">
                              <CpuChipIcon className={`w-2.5 h-2.5 ${confColor}`} />
                              <span className={`text-[9px] font-bold ${confColor}`}>{f.conf}%</span>
                            </div>
                          </button>
                        )
                      })
                  }
                </div>

                {/* Footer */}
                <div className="px-5 py-2.5 border-t border-orange-100/60 flex items-center gap-2 bg-orange-50/40">
                  <CpuChipIcon className="w-3 h-3 text-orange-400 flex-shrink-0" />
                  <span className="text-[10px] text-orange-400 truncate">
                    RADAI engine ranks features by usage frequency · AI confidence updated every 30s
                  </span>
                </div>
              </div>
            )}

            {/* ── AI Champion ticker (compact marketing strip) ────────────── */}
            <AIChampionTicker />
          </div>

          {/* ── Right sidebar ─────────────────────────────────────────────── */}
          <div className={`flex-shrink-0 space-y-4 ${ANIM.enabled ? 'radai-slidein' : ''}`}
            style={{ width: LAYOUT.sidebarWidth, ...(ANIM.enabled ? { animationDelay: `${ANIM.staggerMs * 2}ms` } : {}) }}>

            {/* AI Model Status card */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f97316, #ec4899)' }}>
                  <CpuChipIcon className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-xs font-bold text-gray-800">AI Engine Status</span>
              </div>
              <div className="space-y-2.5">
                {AI_MODELS.map((m, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 flex-shrink-0 rounded-full" style={{ background: m.color, boxShadow: `0 0 6px ${m.color}` }} />
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-gray-700 truncate">{m.name}</div>
                        <div className="text-[9px] text-gray-400">{m.sub}</div>
                      </div>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${m.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {m.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Accuracy gauge */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-gray-800">Model Accuracy</span>
                <BeakerIcon className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex items-center gap-3">
                <AccuracyGauge value={health != null ? Math.round(health) : 89} />
                <div className="space-y-1.5">
                  <div>
                    <div className="text-[9px] text-gray-400">P&ID Extraction</div>
                    <div className="text-[11px] font-bold text-gray-800">94.2%</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-gray-400">Classification</div>
                    <div className="text-[11px] font-bold text-gray-800">91.8%</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-gray-400">Risk Detection</div>
                    <div className="text-[11px] font-bold text-gray-800">87.3%</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Weekly activity */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-gray-800">Weekly Activity</span>
                <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">+5%</span>
              </div>
              <MiniBarChart color="#f97316" h={52} />
              <div className="flex items-center justify-between mt-2">
                <div>
                  <div className="text-[10px] text-gray-400">Completed</div>
                  <div className="text-lg font-extrabold text-gray-900">874</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-gray-400">This week</div>
                  <div className="text-[11px] font-bold text-orange-600">↑ 43 tasks</div>
                </div>
              </div>
            </div>

            {/* P&ID + Users row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 text-center">
                <WrenchScrewdriverIcon className="w-4 h-4 text-orange-400 mx-auto mb-1" />
                <div className="text-lg font-extrabold text-gray-900 leading-none">
                  {loadingStats ? '—' : (dashboardStats.engineering?.total_drawings || metricsData?.documents?.pid_drawings || 0)}
                </div>
                <div className="text-[9px] text-gray-400 mt-0.5">P&ID Drawings</div>
              </div>
              <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 text-center">
                <RocketLaunchIcon className="w-4 h-4 text-violet-400 mx-auto mb-1" />
                <div className="text-lg font-extrabold text-gray-900 leading-none">
                  {activeUsers > 1000 ? `${(activeUsers / 1000).toFixed(1)}k` : (activeUsers || '—')}
                </div>
                <div className="text-[9px] text-gray-400 mt-0.5">Active Users</div>
              </div>
            </div>

            {/* AI Recommendations */}
            {recommendations.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2"
                  style={{ background: 'linear-gradient(90deg, #fff7ed 0%, white 100%)' }}>
                  <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f97316, #ec4899)' }}>
                    <SparklesIcon className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-xs font-bold text-gray-800">AI Recommendations</span>
                </div>
                <ul className="divide-y divide-gray-50">
                  {recommendations.slice(0, 4).map(rec => (
                    <li key={rec.id}
                      onClick={rec.route ? () => navigate(rec.route) : undefined}
                      className={`flex items-start gap-2.5 px-4 py-3 text-xs ${rec.route ? 'cursor-pointer hover:bg-orange-50/30' : ''} transition`}
                    >
                      <div className={`w-7 h-7 rounded-lg ${rec.bg} border ${rec.border} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        <rec.Icon className={`w-3.5 h-3.5 ${rec.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="text-[10px] font-bold text-gray-700 truncate">{rec.title}</span>
                          {rec.priority && (
                            <span className={`text-[8px] font-bold px-1 py-0.5 rounded-full flex-shrink-0 ${PRIORITY_COLORS[rec.priority] || 'bg-gray-100 text-gray-600'}`}>
                              {rec.priority}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 truncate">{rec.subtitle}</p>
                      </div>
                      {rec.route && <ChevronRightIcon className="w-3 h-3 text-gray-300 flex-shrink-0 mt-1" />}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* SOFT-CODED: Feature Navigator - Hierarchical feature display */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2"
                style={{ background: 'linear-gradient(90deg, #f3f4f6 0%, white 100%)' }}>
                <div className="w-5 h-5 rounded-md flex items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-600">
                  <FolderOpenIcon className="w-3 h-3 text-white" />
                </div>
                <span className="text-xs font-bold text-gray-800">Features Navigator</span>
                <span className="ml-auto text-[9px] text-gray-400">
                  {categorizedFeatures ? Object.keys(categorizedFeatures).length : 0} categories
                </span>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {categorizedFeatures && Object.keys(categorizedFeatures).length > 0 ? (
                  Object.entries(categorizedFeatures)
                    .filter(([cat]) => cat !== 'other')
                    .sort((a, b) => {
                      // Sort by category order: engineering, document_management, project_control, quality_assurance, etc.
                      const order = ['engineering', 'document_management', 'project_control', 'quality_assurance', 'sales', 'finance', 'procurement', 'human_resource'];
                      return order.indexOf(a[0]) - order.indexOf(b[0]);
                    })
                    .map(([category, categoryFeatures], catIdx) => {
                      const meta = CATEGORY_META[category] || {};
                      const sortedFeatures = [...categoryFeatures].sort((a, b) => (a.order || 999) - (b.order || 999));
                      const categoryNumber = catIdx + 1;
                      
                      return (
                        <div key={category} className="border-b border-gray-50 last:border-b-0">
                          {/* Category Header */}
                          <div className={`px-4 py-2.5 ${meta.bg || 'bg-gray-50'} flex items-center gap-2`}>
                            <span className="text-[10px] font-bold text-gray-500">{categoryNumber}.</span>
                            <span className={`text-[11px] font-bold ${meta.color || 'text-gray-700'} flex-1`}>
                              {meta.label || category}
                            </span>
                            <span className="text-[9px] font-semibold text-gray-400">
                              {sortedFeatures.length} feature{sortedFeatures.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          
                          {/* Sub-features */}
                          <ul className="divide-y divide-gray-50">
                            {sortedFeatures.map((feature, idx) => (
                              <li
                                key={feature.id}
                                onClick={() => navigate(feature.frontendRoute)}
                                className="flex items-start gap-2.5 px-4 py-2.5 cursor-pointer hover:bg-violet-50/40 transition group"
                              >
                                {/* Icon */}
                                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center flex-shrink-0 text-sm group-hover:scale-105 transition-transform">
                                  {feature.icon || '📄'}
                                </div>
                                
                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="text-[9px] font-semibold text-violet-600">
                                      {categoryNumber}.{idx + 1}
                                    </span>
                                    <span className="text-[11px] font-semibold text-gray-700 truncate group-hover:text-violet-700 transition">
                                      {feature.name}
                                    </span>
                                    {feature.is_new && (
                                      <span className="text-[8px] font-bold px-1 py-0.5 rounded-full bg-green-100 text-green-700 flex-shrink-0">
                                        NEW
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[9px] text-gray-400 line-clamp-1">{feature.description}</p>
                                </div>
                                
                                {/* Arrow */}
                                <ChevronRightIcon className="w-3 h-3 text-gray-300 group-hover:text-violet-500 flex-shrink-0 mt-1 transition" />
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })
                ) : (
                  <div className="px-4 py-8 text-center">
                    <FolderOpenIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-[11px] text-gray-400">Loading features...</p>
                    <p className="text-[9px] text-gray-300 mt-1">Please wait or refresh the page</p>
                  </div>
                )}
                </div>
              </div>

            {/* Your Access card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2"
                style={{ background: 'linear-gradient(90deg, #f0fdf4 0%, white 100%)' }}>
                <KeyIcon className="w-3.5 h-3.5 text-green-500" />
                <span className="text-xs font-bold text-gray-800">Your Access</span>
                {isAdmin && (
                  <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">Admin</span>
                )}
              </div>
              <div className="px-4 py-3">
                {/* Role */}
                <div className="flex items-center gap-2 mb-2.5">
                  <UserCircleIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-[11px] font-semibold text-gray-700 truncate">{userRoleLabel || 'User'}</span>
                </div>
                {/* Module chips */}
                <div className="flex flex-wrap gap-1.5">
                  {(isAdmin ? Object.keys(MODULE_DISPLAY).slice(0,8) : userModuleCodes.slice(0, 10)).map(code => {
                    const m = MODULE_DISPLAY[code]
                    if (!m) return null
                    return (
                      <span key={code} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${m.color}`}>
                        {m.label}
                      </span>
                    )
                  })}
                  {!isAdmin && userModuleCodes.length === 0 && (
                    <span className="text-[10px] text-gray-400 italic">No modules assigned</span>
                  )}
                  {isAdmin && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">+more</span>
                  )}
                </div>
              </div>
            </div>

            {/* Footer links */}
            <div className="flex gap-2">
              <button onClick={() => setShowDocs(true)} className="flex-1 py-2.5 text-[11px] font-semibold text-gray-500 bg-white rounded-xl border border-gray-200 hover:border-orange-300 hover:text-orange-600 transition text-center">
                📚 Docs
              </button>
              <button onClick={() => setShowSupport(true)} className="flex-1 py-2.5 text-[11px] font-semibold text-gray-500 bg-white rounded-xl border border-gray-200 hover:border-orange-300 hover:text-orange-600 transition text-center">
                💬 Support
              </button>
            </div>
          </div>
        </div>
      </div>

      {showSupport && <ContactSupport isModal onClose={() => setShowSupport(false)} />}
      {showDocs    && <Documentation  isModal onClose={() => setShowDocs(false)}    />}
    </div>
  )
}

export default Dashboard
