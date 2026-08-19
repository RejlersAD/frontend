/**
 * QuickActionsBar — horizontal strip of persona-specific shortcut buttons.
 * Actions come from PERSONA_REGISTRY[persona].quick_actions (soft-coded).
 */
import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function QuickActionsBar({ actions, personaLabel }) {
  const navigate = useNavigate()
  if (!actions || actions.length === 0) return null

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white/70 backdrop-blur border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Quick actions
          </div>
          {personaLabel && (
            <div className="text-sm text-slate-700 font-medium">{personaLabel} shortcuts</div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a.key}
            onClick={() => a.route && navigate(a.route)}
            className={`group relative overflow-hidden rounded-xl px-4 py-3 text-white shadow-md hover:shadow-lg
                        transform hover:-translate-y-0.5 transition-all duration-200
                        bg-gradient-to-br ${a.accent || 'from-slate-500 to-slate-700'}`}
          >
            <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100
                            transition-opacity duration-300 bg-white/10" />
            <div className="relative flex items-center gap-2">
              <span className="text-xl leading-none">{a.icon}</span>
              <span className="text-sm font-semibold whitespace-nowrap">{a.label}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
