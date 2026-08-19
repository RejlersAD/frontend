import React from 'react'
import { VARIANCE_BUCKET_STYLES } from '../../../config/projectControl.config'

function fmtAmount(v) {
  const n = Number(v || 0)
  if (Number.isNaN(n)) return v
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export default function VarianceTable({ report }) {
  if (!report) return null
  if (report.message) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-700 p-6 text-sm">
        {report.message}
      </div>
    )
  }
  const rows = report.rows || []
  return (
    <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-800">
            Variance: {report.compare?.kind} v{report.compare?.version} vs {report.base?.kind} v{report.base?.version}
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Grouped by <code className="bg-slate-100 px-1 rounded">{report.group_by}</code>
            {' · '}thresholds: green ≤ {report.thresholds?.green_max}% · amber ≤ {report.thresholds?.amber_max}%
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">Total delta</div>
          <div className={`text-lg font-semibold ${
            report.totals?.bucket === 'red' ? 'text-rose-600'
              : report.totals?.bucket === 'amber' ? 'text-amber-600'
              : 'text-emerald-600'
          }`}>
            {fmtAmount(report.totals?.delta)} ({report.totals?.delta_pct}%)
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-wider">
            <tr>
              <th className="text-left px-4 py-2">{report.group_by === 'wbs' ? 'WBS' : 'Discipline'}</th>
              <th className="text-right px-4 py-2">Base</th>
              <th className="text-right px-4 py-2">Compare</th>
              <th className="text-right px-4 py-2">Δ Amount</th>
              <th className="text-right px-4 py-2">Δ %</th>
              <th className="text-left px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">No rows to compare.</td></tr>
            )}
            {rows.map((r) => {
              const style = VARIANCE_BUCKET_STYLES[r.bucket] || VARIANCE_BUCKET_STYLES.green
              return (
                <tr key={r.key} className={style.row}>
                  <td className="px-4 py-2 font-mono text-xs text-slate-700">{r.key}</td>
                  <td className="px-4 py-2 text-right">{fmtAmount(r.base_amount)}</td>
                  <td className="px-4 py-2 text-right">{fmtAmount(r.compare_amount)}</td>
                  <td className="px-4 py-2 text-right">{fmtAmount(r.delta_amount)}</td>
                  <td className="px-4 py-2 text-right">{r.delta_pct}%</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${style.badge}`}>{r.bucket}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
