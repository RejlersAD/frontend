import React, { useEffect, useState } from 'react'
import { ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

import * as PC from '../../../services/projectControl.service'

const KPI = [
  ['contract_value', 'Contract Value', 'bg-indigo-50 text-indigo-800'],
  ['budget', 'Approved Budget', 'bg-sky-50 text-sky-800'],
  ['committed', 'PO Commitments', 'bg-violet-50 text-violet-800'],
  ['actual', 'Verified Actual', 'bg-amber-50 text-amber-800'],
  ['paid', 'Supplier Paid', 'bg-emerald-50 text-emerald-800'],
  ['unpaid_actual', 'Approved / Unpaid', 'bg-rose-50 text-rose-800'],
]

const money = (value, currency) => Number(value || 0).toLocaleString(undefined, {
  style: 'currency', currency: currency || 'AED', maximumFractionDigits: 0,
})

export default function CommercialDashboardTab({ project }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = () => {
    setLoading(true)
    setError('')
    PC.getCommercialDashboard(project.id)
      .then(setData)
      .catch((err) => setError(err?.response?.data?.error || err?.message || 'Commercial dashboard could not be loaded.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [project.id])

  if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">Loading commercial controls…</div>
  if (error) return <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700">{error}</div>
  if (!data) return null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Project Commercial Control</h2>
          <p className="mt-1 text-xs text-slate-500">Shared facts from Project Control, Procurement and Finance. Amounts use posted ledger entries.</p>
        </div>
        <button onClick={reload} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          <ArrowPathIcon className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {KPI.map(([key, label, tone]) => (
          <div key={key} className={`rounded-xl p-4 ${tone}`}>
            <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
            <p className="mt-2 text-xl font-bold">{money(data[key], data.currency)}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {[
          ['Approved POs', data.counts.approved_purchase_orders],
          ['Accepted Receipts', data.counts.accepted_receipts],
          ['Verified Invoices', data.counts.verified_invoices],
          ['Payment Events', data.counts.payments],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4"><h3 className="text-sm font-semibold">WBS Commercial Position</h3></div>
          <div className="max-h-80 overflow-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500"><tr><th className="px-4 py-2">WBS</th><th className="px-4 py-2 text-right">Budget</th><th className="px-4 py-2 text-right">Committed</th><th className="px-4 py-2 text-right">Actual</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.wbs.map((row) => <tr key={row.code}><td className="px-4 py-3 font-medium">{row.code} · {row.name}</td><td className="px-4 py-3 text-right">{money(row.budget, data.currency)}</td><td className="px-4 py-3 text-right">{money(row.committed, data.currency)}</td><td className="px-4 py-3 text-right">{money(row.actual, data.currency)}</td></tr>)}
                {!data.wbs.length && <tr><td colSpan="4" className="px-4 py-8 text-center text-slate-400">No posted WBS commercial entries.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4"><h3 className="text-sm font-semibold">Commercial Audit Trail</h3><p className="mt-1 text-xs text-slate-500">Immutable events; duplicate deliveries are ignored.</p></div>
          <div className="max-h-80 divide-y divide-slate-100 overflow-auto">
            {data.recent_events.map((event) => <div key={event.id} className="flex gap-3 px-5 py-3">
              {event.processing_error ? <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" /> : <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />}
              <div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><p className="font-medium text-slate-800">{event.event_type_display}</p><time className="shrink-0 text-slate-400">{new Date(event.event_at).toLocaleString()}</time></div><p className="truncate text-slate-500">{event.source_reference || event.source_type} · {event.actor}{event.amount !== null ? ` · ${money(event.amount, event.currency || data.currency)}` : ''}</p></div>
            </div>)}
            {!data.recent_events.length && <p className="px-5 py-8 text-center text-xs text-slate-400">No commercial events captured yet. Run the historical reconciliation preview, then apply it.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
