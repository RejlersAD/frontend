/**
 * RecommendationsInbox — plain-language action cards aggregated across one
 * or many comparisons for the same run. Groups by severity (Critical →
 * Warning → Info) and within each group, by employee.
 *
 * Props:
 *   comparisons: array of comparison DETAIL objects (with .rows[].variances[])
 *                Use ALL active comparisons for the run (multi-source aware).
 */
import React, { useMemo, useState } from 'react'
import * as HeroIcons from '@heroicons/react/24/outline'

import {
  COMPARISON_SEVERITY_META,
  comparisonFieldMeta, formatComparisonValue,
} from '../../../../config/payrollEngine.config'

const SEVERITY_ORDER = ['critical', 'warning', 'info']
const SEVERITY_ICON = {
  critical: HeroIcons.ExclamationTriangleIcon,
  warning:  HeroIcons.ExclamationCircleIcon,
  info:     HeroIcons.InformationCircleIcon,
}
const SEVERITY_HEADER = {
  critical: 'bg-rose-50  border-rose-200  text-rose-800',
  warning:  'bg-amber-50 border-amber-200 text-amber-800',
  info:     'bg-sky-50   border-sky-200   text-sky-800',
}

export default function ComparisonRecommendationsInbox({ comparisons }) {
  const [hideInfo, setHideInfo] = useState(true)

  // Flatten all variances across all comparisons into actionable items.
  const items = useMemo(() => {
    const out = []
    for (const cmp of comparisons || []) {
      for (const row of (cmp.rows || [])) {
        for (const v of (row.variances || [])) {
          if (!v.recommendation) continue
          out.push({
            sev: v.severity,
            sourceLabel: cmp.source_label,
            sourceProfile: cmp.source_profile,
            employeeNo:  row.payroll_employee_no || row.external_employee_no || '—',
            employeeName: row.payroll_employee_name || row.external_name || '—',
            field: v.field,
            our: v.our,
            external: v.external,
            diff: v.diff,
            pct: v.pct,
            text: v.recommendation,
          })
        }
      }
    }
    return out
  }, [comparisons])

  const grouped = useMemo(() => {
    const g = { critical: [], warning: [], info: [] }
    for (const it of items) (g[it.sev] || g.info).push(it)
    return g
  }, [items])

  const totals = {
    critical: grouped.critical.length,
    warning:  grouped.warning.length,
    info:     grouped.info.length,
  }
  const totalAll = totals.critical + totals.warning + totals.info

  if (!totalAll) {
    return (
      <div className="bg-white border border-emerald-200 rounded-xl p-8 text-center">
        <HeroIcons.CheckBadgeIcon className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
        <div className="text-sm font-medium text-emerald-700">
          All clear — no actionable variances detected.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Top counters */}
      <div className="grid grid-cols-3 gap-3">
        <CounterTile label="Critical" count={totals.critical} sev="critical" />
        <CounterTile label="Warning"  count={totals.warning}  sev="warning"  />
        <CounterTile label="Info"     count={totals.info}     sev="info"
                     trailing={
                       <button
                         type="button"
                         onClick={() => setHideInfo((v) => !v)}
                         className="text-[10px] underline text-sky-700"
                       >
                         {hideInfo ? 'show' : 'hide'}
                       </button>
                     } />
      </div>

      {SEVERITY_ORDER.map((sev) => {
        if (sev === 'info' && hideInfo) return null
        const list = grouped[sev]
        if (!list.length) return null
        const Icon = SEVERITY_ICON[sev]
        // Group by employee
        const byEmp = list.reduce((acc, it) => {
          const key = `${it.employeeNo}|${it.employeeName}`
          if (!acc[key]) acc[key] = { no: it.employeeNo, name: it.employeeName, items: [] }
          acc[key].items.push(it)
          return acc
        }, {})
        const empList = Object.values(byEmp)
        return (
          <div key={sev} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className={`px-4 py-2 border-b flex items-center gap-2 ${SEVERITY_HEADER[sev]}`}>
              <Icon className="w-4 h-4" />
              <div className="text-sm font-semibold capitalize">{sev}</div>
              <div className="ml-auto text-xs">
                {list.length} item{list.length === 1 ? '' : 's'} across {empList.length} employee{empList.length === 1 ? '' : 's'}
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {empList.map((emp) => (
                <div key={emp.no + emp.name} className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <HeroIcons.UserCircleIcon className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-800">{emp.name}</span>
                    <span className="text-xs text-slate-500">#{emp.no}</span>
                  </div>
                  <ul className="space-y-1.5 pl-6">
                    {emp.items.map((it, i) => (
                      <RecommendationLine key={i} it={it} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CounterTile({ label, count, sev, trailing }) {
  const Icon = SEVERITY_ICON[sev]
  const meta = COMPARISON_SEVERITY_META[sev] || {}
  return (
    <div className={`border rounded-lg p-3 flex items-center gap-3 ${meta.cell || ''}`}>
      <Icon className={`w-6 h-6 ${
        sev === 'critical' ? 'text-rose-500'
        : sev === 'warning' ? 'text-amber-500'
        : 'text-sky-500'
      }`} />
      <div className="flex-1">
        <div className="text-[10px] uppercase font-medium text-slate-500">{label}</div>
        <div className="text-xl font-semibold tabular-nums text-slate-800">{count}</div>
      </div>
      {trailing}
    </div>
  )
}

function RecommendationLine({ it }) {
  const meta = comparisonFieldMeta(it.field)
  const our = formatComparisonValue(it.field, it.our)
  const ext = formatComparisonValue(it.field, it.external)
  return (
    <li className="text-xs leading-relaxed">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-medium text-slate-700">{meta.label}</span>
        <span className="text-slate-400">·</span>
        <span className="text-slate-500">{it.sourceLabel}</span>
        <span className="text-slate-400">·</span>
        <span className="text-slate-600">
          Our <span className="font-mono">{our}</span> vs Ext <span className="font-mono">{ext}</span>
          {it.pct != null && (
            <span className={`ml-1 ${it.sev === 'critical' ? 'text-rose-600' : 'text-amber-600'} font-medium`}>
              ({it.pct >= 0 ? '+' : ''}{it.pct}%)
            </span>
          )}
        </span>
      </div>
      <div className="text-slate-700 mt-0.5">{it.text}</div>
    </li>
  )
}
