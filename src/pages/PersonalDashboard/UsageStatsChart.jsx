/**
 * UsageStatsChart — Personal 30-day AI usage summary + discipline breakdown.
 * Two hero tiles (today / 30d), gradient horizontal bars with percentages.
 */
import React, { useMemo } from 'react'

const DISCIPLINE_GRADIENTS = [
  'from-blue-500 to-indigo-600',
  'from-purple-500 to-pink-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-red-600',
  'from-cyan-500 to-blue-600',
  'from-indigo-500 to-purple-600',
  'from-lime-500 to-green-600',
]

function SkeletonBar({ width = '60%' }) {
  return (
    <div className="mb-3 animate-pulse">
      <div className="flex items-center justify-between mb-1">
        <div className="w-32 h-3 bg-slate-100 rounded" />
        <div className="w-10 h-3 bg-slate-100 rounded" />
      </div>
      <div className="h-2.5 bg-slate-100 rounded-full" style={{ maxWidth: width }} />
    </div>
  )
}

export default function UsageStatsChart({ usageStats, loading }) {
  const disciplines = usageStats?.by_discipline || []
  const total30d    = usageStats?.total_30d || 0
  const today       = usageStats?.today || 0
  const dailyAvg    = total30d ? Math.round(total30d / 30) : 0

  const maxCount = useMemo(() => {
    if (!disciplines.length) return 1
    return Math.max(...disciplines.map(d => d.count || 0), 1)
  }, [disciplines])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="h-6 w-40 bg-slate-100 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[0, 1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)}
        </div>
        {[...Array(4)].map((_, i) => <SkeletonBar key={i} width={`${30 + i * 15}%`} />)}
      </div>
    )
  }

  if (!disciplines.length) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-base shadow-md">📈</div>
          <h2 className="text-base font-bold text-slate-800">My AI Usage</h2>
        </div>
        <div className="text-center py-8">
          <div className="text-4xl mb-2 opacity-60">📊</div>
          <p className="text-sm text-slate-500 font-medium">No usage data yet</p>
          <p className="text-xs text-slate-400 mt-1">Start using AI modules to track your activity.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-base shadow-md">📈</div>
          <div>
            <h2 className="text-base font-bold text-slate-800 leading-tight">My AI Usage</h2>
            <p className="text-[11px] text-slate-500">Personal activity · last 30 days</p>
          </div>
        </div>
      </div>

      {/* Hero summary tiles */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-50 to-orange-100 border border-amber-200 p-3">
          <div className="absolute -top-3 -right-3 h-14 w-14 rounded-full bg-amber-200/40 blur-xl" />
          <p className="relative text-[10px] uppercase tracking-widest font-bold text-amber-700">Today</p>
          <p className="relative text-2xl font-black text-amber-800 leading-tight mt-0.5">{today}</p>
        </div>
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200 p-3">
          <div className="absolute -top-3 -right-3 h-14 w-14 rounded-full bg-blue-200/40 blur-xl" />
          <p className="relative text-[10px] uppercase tracking-widest font-bold text-blue-700">30 Days</p>
          <p className="relative text-2xl font-black text-blue-800 leading-tight mt-0.5">{total30d.toLocaleString()}</p>
        </div>
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100 border border-emerald-200 p-3">
          <div className="absolute -top-3 -right-3 h-14 w-14 rounded-full bg-emerald-200/40 blur-xl" />
          <p className="relative text-[10px] uppercase tracking-widest font-bold text-emerald-700">Daily Avg</p>
          <p className="relative text-2xl font-black text-emerald-800 leading-tight mt-0.5">{dailyAvg}</p>
        </div>
      </div>

      {/* Breakdown by discipline */}
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">By Discipline</h3>
        <span className="text-[10px] text-slate-400 font-medium">Top {disciplines.length}</span>
      </div>
      <div className="space-y-2.5">
        {disciplines.map((d, idx) => {
          const pct   = Math.round((d.count / maxCount) * 100)
          const share = total30d ? Math.round((d.count / total30d) * 100) : 0
          const gradient = DISCIPLINE_GRADIENTS[idx % DISCIPLINE_GRADIENTS.length]
          const label = d.discipline_label || d.discipline_key || 'Unknown'
          return (
            <div key={d.discipline_key || idx} className="group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-700 truncate group-hover:text-slate-900">{label}</span>
                <span className="text-xs text-slate-500 flex items-center gap-1.5 flex-shrink-0">
                  <span className="font-bold text-slate-700">{d.count}</span>
                  <span className="text-[10px] text-slate-400">·</span>
                  <span className="text-[10px] font-medium text-slate-400">{share}%</span>
                </span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-700 shadow-sm`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
