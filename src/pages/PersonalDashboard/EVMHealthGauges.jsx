/**
 * EVMHealthGauges — Portfolio-level EVM at-a-glance.
 * Renders CPI, SPI, budget utilisation, and overdue count as animated gauges.
 * Thresholds are soft-coded in HEALTH_THRESHOLDS.
 */
import React from 'react'
import { HEALTH_THRESHOLDS, HEALTH_TOKENS } from '../../config/personalDashboardPersona.config'

function scoreCPI(cpi) {
  if (cpi === null || cpi === undefined) return 'grey'
  if (cpi >= HEALTH_THRESHOLDS.cpi_green) return 'green'
  if (cpi >= HEALTH_THRESHOLDS.cpi_amber) return 'amber'
  return 'red'
}
function scoreSPI(spi) {
  if (spi === null || spi === undefined) return 'grey'
  if (spi >= HEALTH_THRESHOLDS.spi_green) return 'green'
  if (spi >= HEALTH_THRESHOLDS.spi_amber) return 'amber'
  return 'red'
}
function scoreBudget(pct) {
  if (pct >= HEALTH_THRESHOLDS.budget_red)   return 'red'
  if (pct >= HEALTH_THRESHOLDS.budget_amber) return 'amber'
  return 'green'
}

function GaugeSemicircle({ value, min = 0, max = 1.4, ideal = 1.0, health = 'grey', label, format }) {
  const size = 140
  const stroke = 12
  const r = (size - stroke) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = Math.PI * r  // half-circle
  const clamped = Math.max(min, Math.min(max, value ?? min))
  const pct = (clamped - min) / (max - min)
  const offset = circumference - pct * circumference
  const color = {
    green: '#10b981', amber: '#f59e0b', red: '#ef4444', grey: '#94a3b8',
  }[health]

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
        <path
          d={`M ${stroke / 2} ${cy} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${cy}`}
          stroke="#e2e8f0" strokeWidth={stroke} fill="none" strokeLinecap="round"
        />
        <path
          d={`M ${stroke / 2} ${cy} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${cy}`}
          stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(.4,0,.2,1)' }}
        />
        {/* Ideal marker */}
        {ideal !== null && (() => {
          const angle = Math.PI + (ideal - min) / (max - min) * Math.PI
          const x = cx + Math.cos(angle) * r
          const y = cy + Math.sin(angle) * r
          return <circle cx={x} cy={y} r={3.5} fill="#1e293b" />
        })()}
      </svg>
      <div className="-mt-4 text-center">
        <div className="text-2xl font-bold text-slate-800">
          {value === null || value === undefined ? '—' : (format ? format(value) : value.toFixed(2))}
        </div>
        <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">{label}</div>
      </div>
    </div>
  )
}

function StatTile({ label, value, hint, tone = 'slate', icon }) {
  const tones = {
    slate:   'from-slate-100 to-slate-50 border-slate-200 text-slate-700',
    emerald: 'from-emerald-100 to-emerald-50 border-emerald-200 text-emerald-700',
    amber:   'from-amber-100 to-amber-50 border-amber-200 text-amber-700',
    red:     'from-red-100 to-red-50 border-red-200 text-red-700',
    blue:    'from-blue-100 to-blue-50 border-blue-200 text-blue-700',
  }
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-3 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide opacity-80">
        {icon && <span>{icon}</span>} {label}
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {hint && <div className="text-[11px] opacity-70 mt-0.5">{hint}</div>}
    </div>
  )
}

export default function EVMHealthGauges({ portfolio, loading }) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse">
        <div className="h-5 w-40 bg-slate-100 rounded mb-4" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-100 rounded-xl" />)}
        </div>
      </div>
    )
  }

  const p = portfolio || {}
  const cpiHealth = scoreCPI(p.avg_cpi)
  const spiHealth = scoreSPI(p.avg_spi)
  const budgetHealth = scoreBudget(p.budget_utilisation || 0)
  const overdueTone = (p.overdue_count || 0) > 0 ? 'red' : 'emerald'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span>📊</span> Portfolio Health · EVM Snapshot
        </h3>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${HEALTH_TOKENS[cpiHealth].chip}`}>
          Overall: {HEALTH_TOKENS[cpiHealth].label}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
        {/* Gauges */}
        <div className="grid grid-cols-2 gap-4">
          <GaugeSemicircle
            value={p.avg_cpi} min={0.5} max={1.4} ideal={1.0}
            health={cpiHealth} label="Avg CPI"
          />
          <GaugeSemicircle
            value={p.avg_spi} min={0.5} max={1.4} ideal={1.0}
            health={spiHealth} label="Avg SPI"
          />
        </div>

        {/* Tiles */}
        <div className="grid grid-cols-2 gap-3">
          <StatTile
            icon="🏗️" label="Active projects" value={p.active_count ?? 0}
            hint={`of ${p.project_count ?? 0} total`} tone="blue"
          />
          <StatTile
            icon="⚠️" label="At risk" value={p.at_risk_count ?? 0}
            hint="amber + red" tone={(p.at_risk_count || 0) > 0 ? 'amber' : 'emerald'}
          />
          <StatTile
            icon="⏰" label="Overdue" value={p.overdue_count ?? 0}
            hint="past end date" tone={overdueTone}
          />
          <StatTile
            icon="💰" label="Budget used" value={`${p.budget_utilisation ?? 0}%`}
            hint={`${(p.total_spent || 0).toLocaleString()} spent`} tone={budgetHealth === 'red' ? 'red' : budgetHealth === 'amber' ? 'amber' : 'emerald'}
          />
        </div>
      </div>
    </div>
  )
}
