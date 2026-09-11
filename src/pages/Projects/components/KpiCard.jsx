import React from 'react'

const TONE_BG = {
  blue:   'border-blue-200 bg-gradient-to-br from-white to-blue-50/70 text-blue-800',
  indigo: 'border-indigo-200 bg-gradient-to-br from-white to-indigo-50/70 text-indigo-800',
  green:  'border-emerald-200 bg-gradient-to-br from-white to-emerald-50/70 text-emerald-800',
  amber:  'border-amber-200 bg-gradient-to-br from-white to-amber-50/80 text-amber-800',
  rose:   'border-rose-200 bg-gradient-to-br from-white to-rose-50/80 text-rose-800',
  violet: 'border-violet-200 bg-gradient-to-br from-white to-violet-50/70 text-violet-800',
  slate:  'border-slate-200 bg-gradient-to-br from-white to-slate-50 text-slate-800',
}

function formatCurrency(value, currency = 'AED') {
  const n = Number(value || 0)
  if (Number.isNaN(n)) return value
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency', currency, maximumFractionDigits: 0,
    }).format(n)
  } catch {
    return `${currency} ${n.toLocaleString()}`
  }
}

export default function KpiCard({ label, value, tone = 'slate', isCurrency = false, isPercent = false, currency = 'AED', sublabel }) {
  let display = value
  if (value === null || value === undefined || value === '') display = '—'
  else if (isCurrency) display = formatCurrency(value, currency)
  else if (isPercent)  display = `${Number(value).toFixed(1)}%`

  return (
    <div className={`rounded-xl border p-4 ${TONE_BG[tone] || TONE_BG.slate}`}>
      <div className="text-xs uppercase tracking-wider opacity-80">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{display}</div>
      {sublabel && <div className="mt-1 text-xs opacity-70">{sublabel}</div>}
    </div>
  )
}
