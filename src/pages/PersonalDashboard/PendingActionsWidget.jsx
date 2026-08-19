/**
 * PendingActionsWidget — Items needing the user's attention.
 * Card style with left priority strip, hover CTA arrow.
 */
import React from 'react'

const PRIORITY_META = {
  CRITICAL: { strip: 'bg-red-600',    chip: 'bg-red-100 text-red-800',       label: 'Critical', pulse: true  },
  URGENT:   { strip: 'bg-orange-500', chip: 'bg-orange-100 text-orange-800', label: 'Urgent',   pulse: true  },
  HIGH:     { strip: 'bg-amber-500',  chip: 'bg-amber-100 text-amber-800',   label: 'High',     pulse: false },
  NORMAL:   { strip: 'bg-blue-500',   chip: 'bg-blue-100 text-blue-700',     label: 'Normal',   pulse: false },
  LOW:      { strip: 'bg-slate-400',  chip: 'bg-slate-100 text-slate-600',   label: 'Low',      pulse: false },
}

function timeAgo(isoStr) {
  if (!isoStr) return ''
  const diff  = Date.now() - new Date(isoStr).getTime()
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (hours < 1)  return 'just now'
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export default function PendingActionsWidget({ actions, loading }) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 animate-pulse">
        <div className="h-6 w-40 bg-slate-100 rounded mb-4" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-3 py-2.5 mb-2">
            <div className="w-1 h-12 rounded bg-slate-100 flex-shrink-0" />
            <div className="flex-1">
              <div className="h-3 w-48 bg-slate-100 rounded mb-1.5" />
              <div className="h-2 w-28 bg-slate-50 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!actions || actions.length === 0) {
    return (
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-green-50 rounded-2xl border border-emerald-200 shadow-sm p-6">
        <div className="pointer-events-none absolute -top-4 -right-4 h-24 w-24 rounded-full bg-emerald-100 blur-2xl opacity-70" />
        <div className="relative flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-lg shadow-md flex-shrink-0">
            ✓
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">All caught up!</h2>
            <p className="text-sm text-slate-500 mt-0.5">No pending actions right now. Great work.</p>
          </div>
        </div>
      </div>
    )
  }

  const criticalCount = actions.filter(a => a.priority === 'CRITICAL' || a.priority === 'URGENT').length

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-base shadow-md">⏳</div>
          <div>
            <h2 className="text-base font-bold text-slate-800 leading-tight">Pending Actions</h2>
            <p className="text-[11px] text-slate-500">
              <span className="font-bold text-amber-600">{actions.length}</span>
              <span className="text-slate-400"> awaiting review</span>
              {criticalCount > 0 && (
                <>
                  <span className="text-slate-300"> · </span>
                  <span className="font-bold text-red-600">{criticalCount} urgent</span>
                </>
              )}
            </p>
          </div>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-full">
          {actions.length}
        </span>
      </div>

      {/* Items */}
      <div className="divide-y divide-slate-50">
        {actions.map((action, idx) => {
          const meta = PRIORITY_META[action.priority] || PRIORITY_META.NORMAL
          return (
            <div
              key={action.id ?? idx}
              className="group flex items-stretch gap-3 px-5 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              {/* Priority strip */}
              <div className={`w-1 rounded-full ${meta.strip} flex-shrink-0 ${meta.pulse ? 'animate-pulse' : ''}`} />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-slate-800 leading-snug truncate">{action.title}</p>
                  <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${meta.chip}`}>
                    {meta.label}
                  </span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-1">{action.message}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] text-slate-400 font-medium">{timeAgo(action.created_at)}</span>
                  <span className="text-slate-300 text-[10px]">•</span>
                  <span className="text-[11px] text-blue-600 font-semibold group-hover:underline">Review →</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
