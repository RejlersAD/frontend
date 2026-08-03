/**
 * RecentChangesWidget — feed of Change Events across the user's projects.
 * Severity tokens from SEVERITY_TOKENS.
 */
import React from 'react'
import { SEVERITY_TOKENS } from '../../config/personalDashboardPersona.config'

const STATUS_LABEL = {
  detected:  'Detected',
  reviewed:  'Reviewed',
  approved:  'Approved',
  rejected:  'Rejected',
}

function formatMoney(n, currency = 'AED') {
  if (n === null || n === undefined) return null
  const sign = n < 0 ? '-' : n > 0 ? '+' : ''
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${sign}${currency} ${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000)     return `${sign}${currency} ${(abs / 1_000).toFixed(1)}K`
  return `${sign}${currency} ${Math.round(abs)}`
}

function timeAgo(iso) {
  if (!iso) return ''
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)      return 'just now'
  if (diff < 3600)    return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)   return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function RecentChangesWidget({ changes, loading }) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse">
        <div className="h-5 w-40 bg-slate-100 rounded mb-4" />
        {[0, 1, 2].map(i => <div key={i} className="h-14 bg-slate-100 rounded-lg mb-2" />)}
      </div>
    )
  }

  const has = changes && changes.length > 0

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span>🔄</span> Recent Changes
        </h3>
        {has && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
            {changes.length} event{changes.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {has ? (
        <div className="space-y-2">
          {changes.map(c => {
            const sev = SEVERITY_TOKENS[c.severity] || SEVERITY_TOKENS.medium
            const money = formatMoney(c.delta_amount, c.currency)
            return (
              <div key={c.id} className="relative rounded-lg border border-slate-200 bg-white p-3 pl-4 hover:shadow-sm transition">
                <div className={`absolute inset-y-2 left-0 w-1 rounded-r ${sev.bar}`} />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-mono text-slate-400 uppercase">{c.project_code}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${sev.chip}`}>{c.severity}</span>
                      <span className="text-[10px] text-slate-400">· {STATUS_LABEL[c.status] || c.status}</span>
                    </div>
                    <div className="text-sm text-slate-800 line-clamp-2">{c.summary}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    {money && (
                      <div className={`text-sm font-bold font-mono ${c.delta_amount >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {money}
                      </div>
                    )}
                    <div className="text-[10px] text-slate-400">{timeAgo(c.detected_at)}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-slate-400 text-sm">
          <div className="text-3xl mb-2">📭</div>
          No changes logged recently.
        </div>
      )}
    </div>
  )
}
