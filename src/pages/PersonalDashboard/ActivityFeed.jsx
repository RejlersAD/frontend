/**
 * ActivityFeed — Vertical timeline of user's recent actions.
 * Colored icon bubbles connected by a subtle rail; last-item continuous.
 */
import React from 'react'
import { ACTIVITY_META } from '../../config/personalDashboard.config'

function timeAgo(isoStr) {
  if (!isoStr) return ''
  const diff  = Date.now() - new Date(isoStr).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 animate-pulse py-2.5">
      <div className="w-9 h-9 rounded-xl bg-slate-100 flex-shrink-0" />
      <div className="flex-1 pt-1">
        <div className="h-3 w-48 bg-slate-100 rounded mb-1.5" />
        <div className="h-2 w-20 bg-slate-50 rounded" />
      </div>
    </div>
  )
}

export default function ActivityFeed({ activities, loading }) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-base shadow-md">🕐</div>
          <h2 className="text-base font-bold text-slate-800">Recent Activity</h2>
        </div>
        {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
      </div>
    )
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-base shadow-md">🕐</div>
          <h2 className="text-base font-bold text-slate-800">Recent Activity</h2>
        </div>
        <div className="text-center py-8">
          <div className="text-4xl mb-2 opacity-60">🌱</div>
          <p className="text-sm text-slate-500 font-medium">No recent activity yet</p>
          <p className="text-xs text-slate-400 mt-1">Start using the platform to see your timeline here.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-base shadow-md">🕐</div>
          <div>
            <h2 className="text-base font-bold text-slate-800 leading-tight">Recent Activity</h2>
            <p className="text-[11px] text-slate-500">Your last {activities.length} actions</p>
          </div>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Timeline</span>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* vertical rail */}
        <div className="absolute left-[17px] top-2 bottom-2 w-px bg-gradient-to-b from-slate-200 via-slate-200 to-transparent" />

        <div className="space-y-1">
          {activities.map((act, idx) => {
            const meta = ACTIVITY_META[act.type] || ACTIVITY_META.default
            const failed = act.success === false
            return (
              <div key={act.id ?? idx} className="relative flex items-start gap-3 py-2 group">
                {/* Icon bubble */}
                <div className={`relative z-10 w-9 h-9 rounded-xl bg-white ring-4 ${meta.ring || 'ring-slate-100'} flex items-center justify-center text-base flex-shrink-0 shadow-sm group-hover:scale-110 transition-transform duration-200`}>
                  <span aria-hidden>{meta.icon}</span>
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-slate-700 leading-snug truncate group-hover:text-slate-900 transition-colors">
                      {act.description || meta.label}
                    </p>
                    {failed && (
                      <span className="text-[10px] uppercase font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded flex-shrink-0">
                        failed
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] uppercase tracking-wider font-semibold ${meta.color}`}>{meta.label}</span>
                    <span className="text-slate-300 text-[10px]">•</span>
                    <span className="text-[11px] text-slate-400 font-medium">{timeAgo(act.timestamp)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
