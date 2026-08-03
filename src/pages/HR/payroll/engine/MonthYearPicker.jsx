import React from 'react'
import { MONTH_NAMES } from '../../../../config/payrollEngine.config'

const currentYear = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i)

export default function MonthYearPicker({ year, month, onChange, className = '' }) {
  return (
    <div className={`inline-flex gap-2 ${className}`}>
      <select
        value={month}
        onChange={(e) => onChange({ year, month: Number(e.target.value) })}
        className="text-sm border border-slate-300 rounded-md px-2 py-1.5 bg-white"
      >
        {MONTH_NAMES.slice(1).map((name, i) => (
          <option key={i + 1} value={i + 1}>{name}</option>
        ))}
      </select>
      <select
        value={year}
        onChange={(e) => onChange({ year: Number(e.target.value), month })}
        className="text-sm border border-slate-300 rounded-md px-2 py-1.5 bg-white"
      >
        {YEAR_OPTIONS.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  )
}
