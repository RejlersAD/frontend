import React from 'react'

const TONE_BG = {
  blue:   'bg-blue-50    text-blue-700    ring-blue-100',
  indigo: 'bg-indigo-50  text-indigo-700  ring-indigo-100',
  green:  'bg-emerald-50 text-emerald-700 ring-emerald-100',
  amber:  'bg-amber-50   text-amber-700   ring-amber-100',
  rose:   'bg-rose-50    text-rose-700    ring-rose-100',
  violet: 'bg-violet-50  text-violet-700  ring-violet-100',
  slate:  'bg-slate-50   text-slate-700   ring-slate-200',
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
    <div className={`rounded-xl ring-1 p-4 ${TONE_BG[tone] || TONE_BG.slate}`}>
      <div className="text-xs uppercase tracking-wider opacity-80">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{display}</div>
      {sublabel && <div className="mt-1 text-xs opacity-70">{sublabel}</div>}
    </div>
  )
}
