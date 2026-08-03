/**
 * WelcomeHero — Personalized greeting card with KPI summary.
 * Animated aurora background, glassmorphism KPI cards with trend hints.
 */
import React, { useEffect, useState } from 'react'
import { ROLE_GRADIENTS } from '../../config/personalDashboard.config'

const KPI_ICONS = {
  sparkles: '✨',
  chart:    '📊',
  bell:     '🔔',
  check:    '✅',
  rocket:   '🚀',
  star:     '⭐',
  trophy:   '🏆',
  default:  '📌',
}

const KPI_ACCENT = {
  ai_calls_today:        { emoji: '⚡', trend: 'today',           accent: 'from-amber-300/40 to-orange-500/30' },
  ai_calls_30d:          { emoji: '📈', trend: 'last 30 days',    accent: 'from-cyan-300/40 to-blue-500/30' },
  unread_notifications:  { emoji: '🔔', trend: 'to review',       accent: 'from-rose-300/40 to-pink-500/30' },
  pending_approvals:     { emoji: '📋', trend: 'awaiting you',    accent: 'from-emerald-300/40 to-teal-500/30' },
}

// Tone tokens for persona-driven KPIs (kpi.tone → gradient + trend label + dot)
const TONE_TOKENS = {
  green: { accent: 'from-emerald-300/40 to-teal-500/30', label: 'On track', dot: 'bg-emerald-400' },
  amber: { accent: 'from-amber-300/40 to-orange-500/30', label: 'Watch',    dot: 'bg-amber-400'   },
  red:   { accent: 'from-rose-300/40 to-red-500/30',     label: 'Critical', dot: 'bg-red-400'     },
  blue:  { accent: 'from-cyan-300/40 to-blue-500/30',    label: 'Live',     dot: 'bg-cyan-400'    },
  grey:  { accent: 'from-slate-300/30 to-slate-500/20',  label: '—',        dot: 'bg-slate-300'   },
}

function getTimeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return { text: 'Good morning', emoji: '🌅' }
  if (h < 17) return { text: 'Good afternoon', emoji: '☀️' }
  return { text: 'Good evening', emoji: '🌙' }
}

// Soft-coded relative-time formatter — reused across dashboard widgets later.
const RELATIVE_TIME_REFRESH_MS = 10000
function formatRelativeTime(iso) {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (diffSec < 5)     return 'just now'
  if (diffSec < 60)    return `${diffSec}s ago`
  const mins = Math.round(diffSec / 60)
  if (mins  < 60)      return `${mins}m ago`
  const hrs  = Math.round(mins / 60)
  if (hrs   < 24)      return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}

export default function WelcomeHero({ userContext, kpis, loading, generatedAt }) {
  const greeting  = getTimeOfDay()
  const firstName = userContext?.name?.split(' ')[0] || 'there'
  const roleCode  = userContext?.role_code || 'default'
  const gradient  = ROLE_GRADIENTS[roleCode] || ROLE_GRADIENTS.default
  const topKpis   = (kpis || []).slice(0, 4)

  // Live-updating "updated Xs ago" tick — cheap, one setInterval.
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!generatedAt) return
    const id = setInterval(() => setTick(t => t + 1), RELATIVE_TIME_REFRESH_MS)
    return () => clearInterval(id)
  }, [generatedAt])
  const updatedLabel = formatRelativeTime(generatedAt)

  if (loading) {
    return (
      <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${gradient} p-8 animate-pulse shadow-xl`}>
        <div className="h-8 w-64 bg-white/20 rounded-lg mb-2" />
        <div className="h-4 w-40 bg-white/15 rounded mb-8" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="bg-white/10 rounded-2xl h-24" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${gradient} p-6 sm:p-8 shadow-2xl`}>
      {/* Animated aurora blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-white/10 blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-white/10 blur-3xl animate-pulse" style={{ animationDuration: '8s', animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/3 h-40 w-40 rounded-full bg-white/5 blur-2xl animate-pulse" style={{ animationDuration: '10s' }} />
      </div>

      {/* Subtle grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          {/* Greeting */}
          <div className="flex items-center gap-4">
            <div className="relative">
              {userContext?.avatar_url ? (
                <img
                  src={userContext.avatar_url}
                  alt="avatar"
                  className="w-16 h-16 rounded-2xl border-2 border-white/50 object-cover shadow-lg flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl font-black text-white shadow-lg ring-2 ring-white/30 flex-shrink-0">
                  {firstName[0]?.toUpperCase()}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-emerald-400 ring-2 ring-white/80 shadow" />
            </div>
            <div>
              <p className="text-white/80 text-sm font-medium flex items-center gap-1.5">
                <span>{greeting.emoji}</span>
                <span>{greeting.text},</span>
              </p>
              <h1 className="text-white text-2xl sm:text-3xl font-black leading-tight tracking-tight">
                {firstName} <span className="text-white/70 font-medium">👋</span>
              </h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-[11px] uppercase tracking-wider bg-white/25 backdrop-blur-sm text-white px-2.5 py-1 rounded-full font-bold">
                  {(userContext?.role_code || 'user').replace(/_/g, ' ')}
                </span>
                {userContext?.department && (
                  <span className="text-xs text-white/75 flex items-center gap-1">
                    <span className="opacity-60">·</span> {userContext.department}
                  </span>
                )}
                {userContext?.job_title && (
                  <span className="text-xs text-white/60 flex items-center gap-1">
                    <span className="opacity-60">·</span> {userContext.job_title}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Date + live indicator */}
          <div className="text-right space-y-1">
            <p className="text-white/60 text-xs font-medium hidden sm:block">
              {new Date().toLocaleDateString('en-AE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <p className="text-white text-lg font-bold hidden sm:block">
              {new Date().toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </p>
            <div className="inline-flex items-center gap-1.5 text-[11px] text-white/80 bg-white/15 backdrop-blur-sm px-2 py-1 rounded-full font-medium">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Live
              {updatedLabel && (
                <span className="text-white/60 font-normal ml-1">· updated {updatedLabel}</span>
              )}
            </div>
          </div>
        </div>

        {/* KPI row */}
        {topKpis.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {topKpis.map((kpi) => {
              const toneTok = kpi.tone ? TONE_TOKENS[kpi.tone] : null
              const accent = KPI_ACCENT[kpi.key] || {
                emoji: kpi.emoji || KPI_ICONS[kpi.icon] || KPI_ICONS.default,
                trend: kpi.sub || '',
                accent: toneTok?.accent || 'from-white/20 to-white/5',
              }
              const emoji = kpi.emoji || accent.emoji
              const trendLabel = kpi.sub || accent.trend
              return (
                <div
                  key={kpi.key}
                  className="group relative overflow-hidden rounded-2xl bg-white/15 backdrop-blur-md p-4 border border-white/20 shadow-lg hover:bg-white/20 hover:scale-[1.02] transition-all duration-300"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${toneTok?.accent || accent.accent} opacity-70`} />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl" aria-hidden>{emoji}</span>
                      {toneTok ? (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-white/85 font-bold bg-white/15 backdrop-blur-sm px-2 py-0.5 rounded-full">
                          <span className={`h-1.5 w-1.5 rounded-full ${toneTok.dot}`} />
                          {toneTok.label}
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase tracking-widest text-white/60 font-bold">{accent.trend}</span>
                      )}
                    </div>
                    <p className="text-white/75 text-[11px] font-semibold uppercase tracking-wide truncate">{kpi.label}</p>
                    <p className="text-white text-3xl font-black leading-tight mt-0.5">
                      {typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}
                    </p>
                    {trendLabel && toneTok && (
                      <p className="text-white/70 text-[11px] mt-1 truncate">{trendLabel}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
