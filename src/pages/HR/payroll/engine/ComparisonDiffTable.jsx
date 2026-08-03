/**
 * ComparisonDiffTable — per-row variance table with severity-coloured cells.
 * Pure presentation; consumes pre-loaded `rows` and the field list.
 */
import React from 'react'
import {
  COMPARISON_STATUS_META, COMPARISON_SEVERITY_META,
  comparisonFieldMeta, formatComparisonValue,
} from '../../../../config/payrollEngine.config'

const KIND_GLYPH = { money: '$', hours: 'h', days: 'd', identifier: '#' }

export default function ComparisonDiffTable({ rows, detectedFields, loading }) {
  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-500">
        Loading rows…
      </div>
    )
  }
  if (!rows.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-500">
        No rows for the current filter.
      </div>
    )
  }
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Employee</th>
              <th className="px-3 py-2 text-left font-medium">Match</th>
              {detectedFields.map((f) => {
                const meta = comparisonFieldMeta(f)
                return (
                  <th key={f} className="px-3 py-2 text-right font-medium tabular-nums">
                    <span className="text-slate-400 mr-1">
                      {KIND_GLYPH[meta.kind] || ''}
                    </span>
                    {meta.label}
                  </th>
                )
              })}
              <th className="px-3 py-2 text-left font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const meta = COMPARISON_STATUS_META[row.status] || {}
              const varMap = Object.fromEntries((row.variances || []).map((v) => [v.field, v]))
              const recs = (row.variances || [])
                .filter((v) => v.recommendation)
                .map((v) => ({
                  field: comparisonFieldMeta(v.field).label,
                  text: v.recommendation,
                  sev: v.severity,
                }))
              return (
                <tr key={row.id} className={`hover:bg-slate-50 ${meta.rowFill || ''}`}>
                  <td className="px-3 py-2 align-top">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${meta.badge || ''}`}>
                      {meta.short || row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium text-slate-800">
                      {row.payroll_employee_name || row.external_name || '—'}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {row.payroll_employee_no || row.external_employee_no || ''}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-500 text-[10px] align-top">
                    {row.matched_by || '—'}
                  </td>
                  {detectedFields.map((f) => {
                    const v = varMap[f]
                    const ourValue = formatComparisonValue(f, v?.our ?? null)
                    const extValue = formatComparisonValue(f, v?.external ?? null)
                    if (!v) {
                      return <td key={f} className="px-3 py-2 text-right text-slate-300 align-top">—</td>
                    }
                    const sev = COMPARISON_SEVERITY_META[v.severity] || {}
                    return (
                      <td
                        key={f}
                        className={`px-3 py-2 text-right tabular-nums align-top ${sev.cell || ''}`}
                        title={`Our: ${ourValue}\nExternal: ${extValue}\nDiff: ${v.diff ?? '—'} (${v.pct ?? 0}%)`}
                      >
                        <div className="text-slate-700">{ourValue}</div>
                        <div className="text-[10px] text-slate-500">ext {extValue}</div>
                      </td>
                    )
                  })}
                  <td className="px-3 py-2 text-slate-600 max-w-xs align-top">
                    {recs.length ? (
                      <ul className="space-y-0.5">
                        {recs.map((r, i) => {
                          const sm = COMPARISON_SEVERITY_META[r.sev] || {}
                          return (
                            <li key={i} className="flex items-start gap-1 text-[11px] leading-snug">
                              <span className={`inline-block w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${
                                r.sev === 'critical' ? 'bg-rose-500'
                                : r.sev === 'warning' ? 'bg-amber-500'
                                : 'bg-sky-400'
                              }`} />
                              <span><span className="font-medium">{r.field}:</span> {r.text}</span>
                            </li>
                          )
                        })}
                      </ul>
                    ) : <span className="text-slate-300">—</span>}
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
