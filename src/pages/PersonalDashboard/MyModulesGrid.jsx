/**
 * MyModulesGrid — Accessible module tiles grouped by category.
 * Gradient accent, hover glow, category chips, and last-used badge.
 */
import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MODULE_META, MODULE_CATEGORY_META } from '../../config/personalDashboard.config'

const UNCATEGORIZED_KEY = 'other'
const UNCATEGORIZED_META = { label: 'Other Modules', icon: '📦', order: 99 }

function timeAgo(isoStr) {
  if (!isoStr) return null
  const diff = Date.now() - new Date(isoStr).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 60)   return `${mins}m ago`
  if (hours < 24)  return `${hours}h ago`
  if (days < 30)   return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function SkeletonTile() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 animate-pulse">
      <div className="w-11 h-11 rounded-xl bg-slate-100 mb-3" />
      <div className="h-4 w-24 bg-slate-100 rounded mb-1" />
      <div className="h-3 w-16 bg-slate-50 rounded" />
    </div>
  )
}

function ModuleTile({ mod, meta, onClick }) {
  const used = Boolean(mod.last_used)
  const ago  = timeAgo(mod.last_used)
  const accent = meta.accent || 'from-slate-500 to-slate-700'

  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-400"
    >
      {/* Gradient sweep on hover */}
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent} opacity-0 group-hover:opacity-[0.06] transition-opacity duration-300`} />
      {/* Corner accent */}
      <div className={`pointer-events-none absolute -top-8 -right-8 h-16 w-16 rounded-full bg-gradient-to-br ${accent} opacity-10 group-hover:opacity-30 blur-xl transition-opacity duration-300`} />

      <div className="relative">
        <div className={`inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br ${accent} text-white text-xl shadow-md mb-3 group-hover:scale-110 transition-transform duration-300`}>
          <span aria-hidden>{meta.icon}</span>
        </div>
        <p className="font-bold text-slate-800 text-sm leading-snug line-clamp-2">{meta.label || mod.name}</p>
        <div className="flex items-center gap-1.5 mt-1.5">
          {used ? (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[11px] text-emerald-600 font-medium">Active · {ago}</p>
            </>
          ) : (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
              <p className="text-[11px] text-slate-400 font-medium">Not used yet</p>
            </>
          )}
        </div>
      </div>
    </button>
  )
}

export default function MyModulesGrid({ modules, loading }) {
  const navigate = useNavigate()

  const grouped = useMemo(() => {
    const groups = {}
    for (const mod of modules || []) {
      const meta = MODULE_META[mod.code] || { icon: '📦', label: mod.name, route: '/dashboard', category: UNCATEGORIZED_KEY, accent: 'from-slate-500 to-slate-700' }
      const cat  = meta.category || UNCATEGORIZED_KEY
      if (!groups[cat]) groups[cat] = []
      groups[cat].push({ mod, meta })
    }
    // Sort each group: used first (by recency), then unused
    for (const cat of Object.keys(groups)) {
      groups[cat].sort((a, b) => {
        const aUsed = a.mod.last_used ? 1 : 0
        const bUsed = b.mod.last_used ? 1 : 0
        if (aUsed !== bUsed) return bUsed - aUsed
        return (b.mod.last_used || '').localeCompare(a.mod.last_used || '')
      })
    }
    return groups
  }, [modules])

  const orderedCategories = useMemo(() => {
    return Object.keys(grouped).sort((a, b) => {
      const oa = (MODULE_CATEGORY_META[a] || UNCATEGORIZED_META).order
      const ob = (MODULE_CATEGORY_META[b] || UNCATEGORIZED_META).order
      return oa - ob
    })
  }, [grouped])

  if (loading) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🧩</span>
          <h2 className="text-base font-bold text-slate-800">My Workspace</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => <SkeletonTile key={i} />)}
        </div>
      </div>
    )
  }

  if (!modules || modules.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <div className="text-4xl mb-2">🔒</div>
        <p className="text-sm font-medium text-slate-600">No modules assigned</p>
        <p className="text-xs text-slate-400 mt-1">Contact your administrator to request access.</p>
      </div>
    )
  }

  const usedCount   = (modules || []).filter(m => m.last_used).length
  const totalCount  = modules.length

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
            <span className="text-base" aria-hidden>🧩</span>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 leading-tight">My Workspace</h2>
            <p className="text-xs text-slate-500">
              <span className="font-semibold text-emerald-600">{usedCount}</span>
              <span className="text-slate-400"> / {totalCount} modules active</span>
            </p>
          </div>
        </div>
      </div>

      {/* Grouped by category */}
      <div className="space-y-6">
        {orderedCategories.map((catKey) => {
          const catMeta = MODULE_CATEGORY_META[catKey] || UNCATEGORIZED_META
          const items   = grouped[catKey]
          return (
            <div key={catKey}>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-sm" aria-hidden>{catMeta.icon}</span>
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{catMeta.label}</h3>
                <span className="text-[11px] text-slate-400 font-medium">{items.length}</span>
                <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {items.map(({ mod, meta }) => (
                  <ModuleTile
                    key={mod.code}
                    mod={mod}
                    meta={meta}
                    onClick={() => navigate(meta.route)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
