/**
 * MilestonesTimeline — horizontal countdown of upcoming milestones.
 * Urgency colouring is driven by HEALTH_THRESHOLDS.milestone_*.
 */
import React from 'react'
import { HEALTH_THRESHOLDS } from '../../config/personalDashboardPersona.config'

function urgencyClass(days_out, is_overdue) {
  if (is_overdue) return { chip: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500',    label: 'Overdue' }
  if (days_out <= HEALTH_THRESHOLDS.milestone_urgent_days) return { chip: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500', label: 'Urgent'  }
  if (days_out <= HEALTH_THRESHOLDS.milestone_soon_days)   return { chip: 'bg-amber-100 text-amber-700 border-amber-200',    dot: 'bg-amber-500',  label: 'Soon'    }
  return { chip: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', label: 'On track' }
}

export default function MilestonesTimeline({ milestones, loading }) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse">
        <div className="h-5 w-40 bg-slate-100 rounded mb-4" />
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2, 3].map(i => <div key={i} className="h-28 w-56 shrink-0 bg-slate-100 rounded-xl" />)}
        </div>
      </div>
    )
  }

  const has = milestones && milestones.length > 0

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-fuchsia-50/30 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span>🎯</span> Upcoming Milestones
        </h3>
        {has && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
            next {HEALTH_THRESHOLDS.milestone_soon_days * 2}d window
          </span>
        )}
      </div>

      {has ? (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
          {milestones.map((m) => {
            const u = urgencyClass(m.days_out, m.is_overdue)
            const dateFmt = new Date(m.target_date).toLocaleDateString(undefined, {
              day: '2-digit', month: 'short', year: '2-digit',
            })
            return (
              <div
                key={m.id}
                className="relative shrink-0 w-56 rounded-xl border border-slate-200 bg-white p-3
                           hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-xl ${u.dot}`} />
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${u.chip}`}>
                    {u.label}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 uppercase">{m.project_code}</span>
                </div>
                <div className="text-sm font-semibold text-slate-800 line-clamp-2 mb-2 min-h-[2.5rem]">
                  {m.name}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">{dateFmt}</span>
                  <span className={`text-xs font-bold ${m.is_overdue ? 'text-red-600' : 'text-slate-700'}`}>
                    {m.is_overdue ? `${Math.abs(m.days_out)}d late` : `${m.days_out}d`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-slate-400 text-sm">
          <div className="text-3xl mb-2">🎉</div>
          No upcoming milestones in the window.
        </div>
      )}
    </div>
  )
}
