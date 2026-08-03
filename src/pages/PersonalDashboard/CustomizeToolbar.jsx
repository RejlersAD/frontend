/**
 * CustomizeToolbar — floating pill toolbar that lets the user enter/leave
 * "Customize" mode, restore hidden widgets, and reset to persona defaults.
 *
 * Purely presentational — state comes from usePersonalDashboardLayout.
 */
import React from 'react'
import {
  SparklesIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'

export default function CustomizeToolbar({
  editing,
  onToggleEdit,
  hiddenWidgets,        // [{ key, label }]
  onShow,
  onReset,
  isCustomised,
}) {
  const anyHidden = hiddenWidgets.length > 0
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
      <div className="flex items-center gap-2">
        <SparklesIcon className="h-5 w-5 text-indigo-500" />
        <span className="ai-shimmer-text text-sm font-bold uppercase tracking-widest">
          AI-Personalised Dashboard
        </span>
        {isCustomised && !editing && (
          <span className="text-[10px] uppercase tracking-widest font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
            Customised
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {editing && anyHidden && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mr-1">
              Hidden:
            </span>
            {hiddenWidgets.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => onShow(key)}
                className="group inline-flex items-center gap-1 text-xs font-semibold bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 rounded-full pl-2 pr-2.5 py-1 shadow-sm transition-all"
                title={`Restore "${label}"`}
              >
                <EyeIcon className="h-3.5 w-3.5 opacity-70 group-hover:opacity-100" />
                {label}
              </button>
            ))}
          </div>
        )}

        {editing && isCustomised && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white border border-slate-200 hover:border-slate-300 text-slate-600 rounded-full px-3 py-1.5 shadow-sm transition-all"
            title="Reset to persona defaults"
          >
            <ArrowPathIcon className="h-3.5 w-3.5" />
            Reset
          </button>
        )}

        <button
          type="button"
          onClick={onToggleEdit}
          className={
            'inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-3.5 py-1.5 rounded-full shadow-md transition-all ' +
            (editing
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:shadow-emerald-400/40 hover:shadow-lg'
              : 'bg-gradient-to-r from-indigo-500 via-purple-600 to-cyan-500 text-white hover:shadow-purple-400/40 hover:shadow-lg')
          }
        >
          {editing ? (
            <>
              <CheckCircleIcon className="h-4 w-4" /> Done
            </>
          ) : (
            <>
              <SparklesIcon className="h-4 w-4" /> Customise
            </>
          )}
        </button>
      </div>
    </div>
  )
}
