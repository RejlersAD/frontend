/**
 * ProjectPortfolio — grid of the user's projects with progress ring, health
 * traffic light, budget bar, EVM chips (CPI/SPI) and days-remaining pill.
 * Everything driven from soft-coded HEALTH_TOKENS.
 */
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { HEALTH_TOKENS } from '../../config/personalDashboardPersona.config'

const STATUS_META = {
  planning:  { chip: 'bg-slate-100 text-slate-700',   label: 'Planning'  },
  active:    { chip: 'bg-emerald-100 text-emerald-700', label: 'Active'  },
  on_hold:   { chip: 'bg-amber-100 text-amber-700',   label: 'On hold'   },
  completed: { chip: 'bg-blue-100 text-blue-700',     label: 'Completed' },
  cancelled: { chip: 'bg-red-100 text-red-700',       label: 'Cancelled' },
}

const PRIORITY_META = {
  low:      { chip: 'bg-slate-50 text-slate-600 border-slate-200' },
  medium:   { chip: 'bg-blue-50 text-blue-700 border-blue-200'    },
  high:     { chip: 'bg-orange-50 text-orange-700 border-orange-200' },
  critical: { chip: 'bg-red-50 text-red-700 border-red-200'       },
}

function ProgressRing({ pct = 0, health = 'grey', size = 60 }) {
  const stroke = 6
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference
  const strokeColor = {
    green: '#10b981',
    amber: '#f59e0b',
    red:   '#ef4444',
    grey:  '#94a3b8',
  }[health] || '#94a3b8'

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#e2e8f0" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={strokeColor} strokeWidth={stroke} fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 700ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-slate-800">{pct}%</span>
      </div>
    </div>
  )
}

function formatMoney(n, currency = 'AED') {
  if (n === null || n === undefined || n === 0) return `${currency} 0`
  if (n >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${currency} ${(n / 1_000).toFixed(1)}K`
  return `${currency} ${Math.round(n)}`
}

function ProjectCard({ project, onOpen }) {
  const health   = HEALTH_TOKENS[project.health] || HEALTH_TOKENS.grey
  const status   = STATUS_META[project.status]   || STATUS_META.planning
  const priority = PRIORITY_META[project.priority] || PRIORITY_META.medium

  const utilisation = Math.min(100, project.budget_utilisation || 0)
  const utilisationBar =
    utilisation >= 100 ? 'bg-red-500'
    : utilisation >= 85 ? 'bg-amber-500'
    : 'bg-emerald-500'

  const daysBadge =
    project.days_remaining === null || project.days_remaining === undefined
      ? null
      : project.days_remaining < 0
        ? { text: `${Math.abs(project.days_remaining)}d overdue`, cls: 'bg-red-100 text-red-700' }
        : project.days_remaining <= 14
          ? { text: `${project.days_remaining}d left`,             cls: 'bg-amber-100 text-amber-700' }
          : { text: `${project.days_remaining}d left`,             cls: 'bg-slate-100 text-slate-600' }

  return (
    <button
      onClick={onOpen}
      className={`group relative overflow-hidden text-left rounded-2xl border border-slate-200 bg-white
                  hover:border-blue-300 hover:shadow-lg transform hover:-translate-y-0.5
                  transition-all duration-200 p-4 ring-1 ${health.ring}`}
    >
      {/* Health strip */}
      <div className={`absolute inset-y-0 left-0 w-1.5 ${health.dot}`} />

      <div className="flex items-start gap-3 mb-3 pl-2">
        <ProgressRing pct={project.progress || 0} health={project.health} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">{project.code}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${status.chip}`}>
              {status.label}
            </span>
          </div>
          <div className="text-sm font-semibold text-slate-800 truncate">{project.name}</div>
          {project.client_name && (
            <div className="text-xs text-slate-500 truncate">{project.client_name}</div>
          )}
        </div>
      </div>

      <div className="pl-2 space-y-2">
        {/* Budget bar */}
        <div>
          <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1">
            <span>Budget</span>
            <span className="font-mono">
              {formatMoney(project.spent, project.currency)} / {formatMoney(project.budget, project.currency)}
            </span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${utilisationBar}`}
              style={{ width: `${utilisation}%` }}
            />
          </div>
        </div>

        {/* Chips row */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${priority.chip}`}>
            {project.priority}
          </span>
          {project.cpi !== null && project.cpi !== undefined && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-200 font-mono">
              CPI {project.cpi}
            </span>
          )}
          {project.spi !== null && project.spi !== undefined && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
              SPI {project.spi}
            </span>
          )}
          {daysBadge && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${daysBadge.cls}`}>
              {daysBadge.text}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

export default function ProjectPortfolio({ portfolio, projects, loading }) {
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse">
        <div className="h-5 w-40 bg-slate-100 rounded mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="h-40 bg-slate-100 rounded-2xl" />)}
        </div>
      </div>
    )
  }

  const hasProjects = projects && projects.length > 0
  const p = portfolio || {}

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
      {/* Header + portfolio stats */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span>🏗️</span> My Project Portfolio
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {hasProjects
              ? `${p.project_count} project${p.project_count === 1 ? '' : 's'} · ${p.active_count} active · ${p.at_risk_count} at risk`
              : 'No projects assigned yet'}
          </p>
        </div>
        {hasProjects && (
          <div className="flex gap-2 text-xs">
            <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
              <div className="font-bold text-emerald-700">{p.health_counts?.green || 0}</div>
              <div className="text-[10px] text-emerald-600 uppercase tracking-wide">Green</div>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-center">
              <div className="font-bold text-amber-700">{p.health_counts?.amber || 0}</div>
              <div className="text-[10px] text-amber-600 uppercase tracking-wide">Amber</div>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-center">
              <div className="font-bold text-red-700">{p.health_counts?.red || 0}</div>
              <div className="text-[10px] text-red-600 uppercase tracking-wide">Red</div>
            </div>
          </div>
        )}
      </div>

      {hasProjects ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {projects.map(pr => (
            <ProjectCard key={pr.id} project={pr} onOpen={() => navigate(`/designiq/projects`)} />
          ))}
        </div>
      ) : (
        <div className="text-center py-10 text-slate-400 text-sm">
          <div className="text-4xl mb-2">📋</div>
          You haven't been added to any projects yet.
        </div>
      )}
    </div>
  )
}
