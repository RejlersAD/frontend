/**
 * ConsolidatedView — cross-source heatmap.
 *
 * When the run has 2+ comparisons (e.g. ValueFrame + Sympa), this view
 * pivots all of them into a single grid:
 *
 *   Employee | Source A: field1 field2 … | Source B: field1 field2 … | …
 *
 * Each cell shows the EXTERNAL value, colour-coded by variance severity
 * vs our payroll. "—" means that field wasn't in that file.
 *
 * Props:
 *   comparisons: array of comparison DETAIL objects (with .rows[])
 */
import React, { useMemo } from 'react'
import * as HeroIcons from '@heroicons/react/24/outline'

import {
  COMPARISON_SEVERITY_META,
  comparisonFieldMeta, formatComparisonValue,
} from '../../../../config/payrollEngine.config'

export default function ComparisonConsolidatedView({ comparisons }) {
  // Each comparison contributes (sourceLabel, profile, detectedFields, rowsByEmp)
  const sources = useMemo(() => (comparisons || []).map((cmp) => {
    const detected = (cmp.summary?.fields_detected || [])
      .filter((f) => f !== 'employee_no' && f !== 'full_name')
    const byEmp = {}
    for (const row of (cmp.rows || [])) {
      const key = row.payroll_employee_no || row.external_employee_no
      if (!key) continue
      byEmp[key] = row
    }
    return {
      id: cmp.id,
      label: cmp.source_label,
      profile: cmp.source_profile,
      detectedFields: detected,
      byEmp,
    }
  }), [comparisons])

  // Union of all employee keys + display names
  const employees = useMemo(() => {
    const map = new Map()
    for (const src of sources) {
      for (const [key, row] of Object.entries(src.byEmp)) {
        if (!map.has(key)) {
          map.set(key, {
            key,
            no:   row.payroll_employee_no || row.external_employee_no || key,
            name: row.payroll_employee_name || row.external_name || '—',
            // For "Our" column, prefer any source that has our_values populated
            ourValues: row.our_values || null,
            severityScore: 0,
          })
        }
        const meta = map.get(key)
        if (!meta.ourValues && row.our_values) meta.ourValues = row.our_values
        // Tally a rough severity score for sort
        for (const v of (row.variances || [])) {
          if (v.severity === 'critical')      meta.severityScore += 3
          else if (v.severity === 'warning')  meta.severityScore += 1
        }
      }
    }
    // Sort: highest severity first, then name
    return Array.from(map.values()).sort((a, b) => {
      if (b.severityScore !== a.severityScore) return b.severityScore - a.severityScore
      return (a.name || '').localeCompare(b.name || '')
    })
  }, [sources])

  if (!comparisons?.length) {
    return (
      <div className="bg-white border border-dashed border-slate-300 rounded-xl p-6 text-center text-sm text-slate-500">
        Upload at least two external files to see the consolidated cross-source view.
      </div>
    )
  }

  if (comparisons.length === 1) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <HeroIcons.LightBulbIcon className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-amber-800">
          The consolidated view is most useful when comparing <b>multiple sources</b> at once
          (e.g. ValueFrame for hours <i>and</i> Sympa for salaries). Upload a second file
          above to enable side-by-side reconciliation.
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-200 flex items-center gap-2 bg-slate-50">
        <HeroIcons.TableCellsIcon className="w-4 h-4 text-indigo-600" />
        <h3 className="text-sm font-semibold text-slate-700">Cross-source matrix</h3>
        <span className="text-xs text-slate-500">
          · {employees.length} employees · {sources.length} sources
        </span>
        <div className="ml-auto flex items-center gap-3 text-[10px] text-slate-500">
          <LegendChip cls="bg-rose-50  border border-rose-200"  label="Critical" />
          <LegendChip cls="bg-amber-50 border border-amber-200" label="Warning" />
          <LegendChip cls="bg-sky-50   border border-sky-200"   label="Info" />
          <LegendChip cls="bg-emerald-50 border border-emerald-200" label="Match" />
        </div>
      </div>
      <div className="overflow-x-auto max-h-[60vh]">
        <table className="min-w-full text-[11px]">
          <thead className="bg-slate-50 text-slate-500 uppercase sticky top-0 z-10">
            <tr>
              <th rowSpan={2} className="px-3 py-2 text-left font-medium border-r border-slate-200">
                Employee
              </th>
              {sources.map((src) => (
                <th
                  key={src.id}
                  colSpan={Math.max(src.detectedFields.length, 1)}
                  className="px-3 py-2 text-center font-semibold border-l border-slate-200 text-indigo-700 bg-indigo-50/40"
                >
                  {src.label}
                </th>
              ))}
            </tr>
            <tr>
              {sources.map((src) => (
                src.detectedFields.length ? (
                  src.detectedFields.map((f) => (
                    <th
                      key={`${src.id}-${f}`}
                      className="px-2 py-1.5 text-right font-medium border-l border-slate-200 tabular-nums"
                    >
                      {comparisonFieldMeta(f).label}
                    </th>
                  ))
                ) : (
                  <th key={`${src.id}-empty`} className="px-2 py-1.5 border-l border-slate-200 text-slate-300">—</th>
                )
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.map((emp) => (
              <tr key={emp.key} className="hover:bg-slate-50">
                <td className="px-3 py-1.5 border-r border-slate-200 align-top">
                  <div className="font-medium text-slate-800">{emp.name}</div>
                  <div className="text-[10px] text-slate-500">#{emp.no}</div>
                </td>
                {sources.map((src) => {
                  const row = src.byEmp[emp.key]
                  if (!row) {
                    return src.detectedFields.length
                      ? src.detectedFields.map((f) => (
                          <td key={`${src.id}-${f}-x`} className="px-2 py-1.5 border-l border-slate-200 text-center text-slate-300">
                            —
                          </td>
                        ))
                      : <td key={`${src.id}-empty-x`} className="px-2 py-1.5 border-l border-slate-200 text-slate-300">—</td>
                  }
                  const varMap = Object.fromEntries((row.variances || []).map((v) => [v.field, v]))
                  return src.detectedFields.map((f) => {
                    const v = varMap[f]
                    const extVal = row.external_values?.[f]
                    const display = formatComparisonValue(f, extVal)
                    let cellCls = ''
                    if (v) {
                      const sm = COMPARISON_SEVERITY_META[v.severity] || {}
                      cellCls = sm.cell || ''
                    } else if (extVal !== undefined && extVal !== null) {
                      cellCls = 'bg-emerald-50/60'
                    }
                    return (
                      <td
                        key={`${src.id}-${f}-${row.id}`}
                        className={`px-2 py-1.5 text-right tabular-nums border-l border-slate-200 ${cellCls}`}
                        title={v ? `Our: ${formatComparisonValue(f, v.our)} / Ext: ${formatComparisonValue(f, v.external)} / ${v.severity}` : `Ext: ${display}`}
                      >
                        {display}
                      </td>
                    )
                  })
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function LegendChip({ cls, label }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block w-3 h-3 rounded ${cls}`} />
      {label}
    </span>
  )
}
