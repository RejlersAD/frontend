/**
 * AIInsightsStrip — Horizontally scrollable AI-generated insight cards.
 * Gradient card, animated icon halo, snap scrolling.
 */
import React from 'react'
import { INSIGHT_STYLES } from '../../config/personalDashboard.config'

const ICON_EMOJI = {
  lightbulb: '💡',
  trophy:    '🏆',
  bell:      '🔔',
  sparkles:  '✨',
  chart:     '📊',
  rocket:    '🚀',
  star:      '⭐',
  check:     '✅',
}

const TYPE_LABELS = {
  tip:         'Productivity Tip',
  achievement: 'Achievement',
  alert:       'Usage Alert',
  suggestion:  'Feature Suggestion',
}

const TYPE_GRADIENT = {
  tip:         'from-blue-400/20 to-indigo-500/10',
  achievement: 'from-green-400/20 to-emerald-500/10',
  alert:       'from-amber-400/20 to-orange-500/10',
  suggestion:  'from-purple-400/20 to-pink-500/10',
}

function SkeletonCard() {
  return (
    <div className="min-w-[280px] max-w-[320px] rounded-2xl border bg-white border-slate-200 p-5 animate-pulse flex-shrink-0 shadow-sm">
      <div className="flex justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-slate-100" />
        <div className="h-5 w-20 bg-slate-100 rounded-full" />
      </div>
      <div className="h-4 w-40 bg-slate-100 rounded mb-2" />
      <div className="h-3 w-full bg-slate-50 rounded mb-1" />
      <div className="h-3 w-3/4 bg-slate-50 rounded" />
    </div>
  )
}

function SectionHeader({ subtitle }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 flex items-center justify-center text-white text-base shadow-md">✨</div>
        <div>
          <h2 className="text-base font-bold text-slate-800 leading-tight">AI Insights for You</h2>
          {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
        </div>
      </div>
      <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-400 font-bold bg-slate-100 px-2 py-1 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
        GPT-4o
      </span>
    </div>
  )
}

export default function AIInsightsStrip({ insights, loading }) {
  if (loading) {
    return (
      <div>
        <SectionHeader subtitle="Analyzing your activity…" />
        <div className="flex gap-3 overflow-x-auto pb-1">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    )
  }

  if (!insights || insights.length === 0) {
    return (
      <div>
        <SectionHeader subtitle="Personalized recommendations · refreshed nightly" />
        <div className="relative overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-white p-6 text-center">
          <div className="text-3xl mb-2">🌟</div>
          <p className="text-sm font-medium text-slate-600">Your AI insights are being prepared</p>
          <p className="text-xs text-slate-400 mt-1">Come back after your first active day — powered by GPT-4o.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <SectionHeader subtitle={`${insights.length} personalized insights · refreshed nightly`} />
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scroll-smooth">
        {insights.map((ins) => {
          const style = INSIGHT_STYLES[ins.insight_type] || INSIGHT_STYLES.tip
          const gradient = TYPE_GRADIENT[ins.insight_type] || TYPE_GRADIENT.tip
          return (
            <div
              key={ins.id}
              className={`group relative overflow-hidden min-w-[280px] max-w-[320px] flex-shrink-0 snap-start rounded-2xl border ${style.border} bg-white p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300`}
            >
              <div className={`pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-gradient-to-br ${gradient} blur-2xl opacity-70`} />
              <div className="relative">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl ${style.bg} border ${style.border} flex items-center justify-center text-xl shadow-sm`}>
                    <span aria-hidden>{ICON_EMOJI[ins.icon_key] || '💡'}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider ${style.badge}`}>
                    {TYPE_LABELS[ins.insight_type] || ins.insight_type}
                  </span>
                </div>
                {/* Title */}
                <p className="font-bold text-slate-800 text-sm leading-snug mb-1.5">{ins.title}</p>
                {/* Body */}
                <p className="text-slate-600 text-xs leading-relaxed line-clamp-3">{ins.body}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
