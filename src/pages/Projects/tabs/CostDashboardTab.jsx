import React, { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import { ArrowPathIcon } from '@heroicons/react/24/outline'

import * as PC from '../../../services/projectControl.service'
import { COST_KPI_CARDS } from '../../../config/projectControl.config'
import KpiCard from '../components/KpiCard'

const CHART_COLORS = {
  budget:    '#6366f1',
  committed: '#0ea5e9',
  spent:     '#f59e0b',
  remaining: '#10b981',
}

export default function CostDashboardTab({ project }) {
  const [kpis, setKpis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState(null)

  const reload = () => {
    setLoading(true)
    setError(null)
    PC.getCostKpis(project.id)
      .then(setKpis)
      .catch((e) => setError(e?.response?.data?.error || e?.message || 'Failed to load KPIs'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() /* eslint-disable-next-line */ }, [project.id])

  const runSync = () => {
    setSyncing(true)
    setSyncMessage(null)
    PC.runFinanceSync(project.id)
      .then((res) => {
        if (res.skipped) {
          setSyncMessage('Finance module not installed — skipped.')
        } else {
          setSyncMessage(`Matched ${res.matched_invoices} invoice(s) totalling ${res.total_spent}.`)
        }
        reload()
      })
      .catch((e) => setSyncMessage(e?.response?.data?.error || 'Finance sync failed.'))
      .finally(() => setSyncing(false))
  }

  if (loading) return <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500">Loading cost KPIs…</div>
  if (error)   return <div className="bg-white border border-rose-200 text-rose-700 rounded-xl p-6">{error}</div>
  if (!kpis)   return null

  const chartData = [
    { name: 'Budget',    value: Number(kpis.budget    || 0), fill: CHART_COLORS.budget },
    { name: 'Committed', value: Number(kpis.committed || 0), fill: CHART_COLORS.committed },
    { name: 'Spent',     value: Number(kpis.spent     || 0), fill: CHART_COLORS.spent },
    { name: 'Remaining', value: Number(kpis.remaining || 0), fill: CHART_COLORS.remaining },
  ]

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {COST_KPI_CARDS.map((card) => (
          <KpiCard
            key={card.key}
            label={card.label}
            value={kpis[card.field]}
            tone={card.tone}
            isCurrency={card.isCurrency}
            isPercent={card.isPercent}
            currency={kpis.currency}
          />
        ))}
      </div>

      {/* Chart + forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800">Cost Breakdown</h3>
            <button
              onClick={runSync}
              disabled={syncing}
              className="text-xs px-3 py-1.5 inline-flex items-center gap-1.5 rounded-md
                         bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
            >
              <ArrowPathIcon className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync from Finance'}
            </button>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v) => v.toLocaleString()} />
                <Tooltip formatter={(v) => Number(v).toLocaleString(undefined, { style: 'currency', currency: kpis.currency || 'AED', maximumFractionDigits: 0 })} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {syncMessage && (
            <p className="mt-2 text-xs text-slate-500">{syncMessage}</p>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Forecast (EVM)</h3>
          <div className="space-y-3 text-sm">
            <Row label="EAC (forecast)" value={kpis.forecast?.eac ? Number(kpis.forecast.eac).toLocaleString() : '—'} />
            <Row label="CPI" value={kpis.forecast?.cpi ?? '—'} />
            <Row label="SPI" value={kpis.forecast?.spi ?? '—'} />
            <Row label="Last snapshot" value={kpis.forecast?.snapshot_date || '—'} />
          </div>
          <p className="text-xs text-slate-400 mt-4">
            Full EVM lights up when Phase 3 is enabled.
          </p>
        </div>
      </div>

      {/* Estimate counts */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Estimates · total"    value={kpis.estimate_counts?.total}    tone="indigo" />
        <KpiCard label="Estimates · approved" value={kpis.estimate_counts?.approved} tone="green" />
        <KpiCard label="Estimates · draft"    value={kpis.estimate_counts?.draft}    tone="slate" />
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
      <span className="text-slate-500 text-xs uppercase tracking-wider">{label}</span>
      <span className="text-slate-800 font-medium">{value}</span>
    </div>
  )
}
