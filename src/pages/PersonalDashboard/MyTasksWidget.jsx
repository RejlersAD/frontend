/**
 * MyTasksWidget — personal task list with priority chips, due-date badges,
 * overdue highlighting. Tokens come from PRIORITY_TOKENS.
 */
import React from 'react'
import { PRIORITY_TOKENS } from '../../config/personalDashboardPersona.config'

const STATUS_LABEL = {
  todo:        { chip: 'bg-slate-100 text-slate-700', label: 'To do'   },
  in_progress: { chip: 'bg-blue-100 text-blue-700',   label: 'Doing'   },
  review:      { chip: 'bg-purple-100 text-purple-700', label: 'Review' },
  completed:   { chip: 'bg-emerald-100 text-emerald-700', label: 'Done' },
}

function dueBadge(days_out, is_overdue) {
  if (is_overdue)          return { cls: 'bg-red-100 text-red-700',       txt: `${Math.abs(days_out)}d late` }
  if (days_out === null)   return { cls: 'bg-slate-100 text-slate-500',   txt: 'No date'                     }
  if (days_out === 0)      return { cls: 'bg-orange-100 text-orange-700', txt: 'Today'                       }
  if (days_out <= 3)       return { cls: 'bg-amber-100 text-amber-700',   txt: `${days_out}d`                }
  return { cls: 'bg-slate-100 text-slate-600', txt: `${days_out}d` }
}

export default function MyTasksWidget({ tasks, loading }) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse">
        <div className="h-5 w-32 bg-slate-100 rounded mb-4" />
        {[0, 1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-100 rounded-lg mb-2" />)}
      </div>
    )
  }

  const has = tasks && tasks.length > 0
  const overdueCount = has ? tasks.filter(t => t.is_overdue).length : 0

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span>✅</span> My Tasks
        </h3>
        {has && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold
                            ${overdueCount > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
            {tasks.length} open{overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}
          </span>
        )}
      </div>

      {has ? (
        <div className="space-y-2">
          {tasks.map(t => {
            const prio = PRIORITY_TOKENS[t.priority] || PRIORITY_TOKENS.medium
            const status = STATUS_LABEL[t.status] || STATUS_LABEL.todo
            const due = dueBadge(t.days_out, t.is_overdue)
            return (
              <div
                key={t.id}
                className={`group relative rounded-lg border p-3 hover:shadow-sm transition
                            ${t.is_overdue ? 'border-red-200 bg-red-50/40' : 'border-slate-200 bg-white'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-mono text-slate-400 uppercase">{t.project_code}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${status.chip}`}>{status.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${prio.chip}`}>{t.priority}</span>
                    </div>
                    <div className="text-sm text-slate-800 font-medium truncate">{t.title}</div>
                  </div>
                  <span className={`shrink-0 text-[11px] px-2 py-1 rounded-md font-semibold ${due.cls}`}>
                    {due.txt}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-slate-400 text-sm">
          <div className="text-3xl mb-2">☕</div>
          Nothing on your plate — enjoy the calm.
        </div>
      )}
    </div>
  )
}
