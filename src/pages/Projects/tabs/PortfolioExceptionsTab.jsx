/* eslint-disable react/prop-types */
import React, { useCallback, useEffect, useState } from 'react'
import {
  ArrowPathIcon, ArrowRightIcon, CheckCircleIcon, ExclamationTriangleIcon,
  FunnelIcon, MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'

import { getPortfolioExceptions } from '../../../services/projectControl.service'

const severityStyle = {
  critical: 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200',
  high: 'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-200',
  medium: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
  low: 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200',
  clear: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
}
const fieldClass = 'min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100'
const buttonClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'

const messageFor = (error) => {
  const data = error?.response?.data
  if (data?.detail) return data.detail
  if (data?.error) return data.error
  return error?.message || 'The portfolio exception dashboard could not be loaded.'
}

function SeverityBadge({ value }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${severityStyle[value] || severityStyle.medium}`}>{value}</span>
}

function Metric({ label, value, detail, tone = 'slate' }) {
  const toneClass = tone === 'critical' ? 'text-rose-700 dark:text-rose-300' : tone === 'high' ? 'text-orange-700 dark:text-orange-300' : 'text-slate-950 dark:text-white'
  return <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p><p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail}</p></div>
}

export default function PortfolioExceptionsTab({ onSelectProject, onSelectView }) {
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ severity: '', category: '', search: '' })
  const [query, setQuery] = useState({})
  const [expanded, setExpanded] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setDashboard(await getPortfolioExceptions(query))
    } catch (requestError) {
      setError(messageFor(requestError))
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => { load() }, [load])

  const applyFilters = (event) => {
    event.preventDefault()
    setQuery(Object.fromEntries(Object.entries(filters).filter(([, value]) => value)))
  }

  const resetFilters = () => {
    setFilters({ severity: '', category: '', search: '' })
    setQuery({})
  }

  const openIssue = (projectId, targetView) => {
    onSelectProject(projectId)
    onSelectView(targetView || 'controls-periods')
  }

  if (loading && !dashboard) return <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">Analysing accessible projects for control exceptions…</div>

  const summary = dashboard?.summary || {}
  const projectRows = dashboard?.projects || []

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
        <div><h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950 dark:text-white"><ExclamationTriangleIcon className="h-6 w-6 text-amber-600" />Portfolio exception dashboard</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Projects are ranked by the highest governed exception. Clear projects remain visible for portfolio completeness.</p></div>
        <div className="text-xs text-slate-500 dark:text-slate-400"><p>Generated {dashboard?.generated_at ? new Date(dashboard.generated_at).toLocaleString() : '—'}</p><p className="mt-1">CPI warning &lt; {dashboard?.thresholds?.cpi_warning_below} · SPI warning &lt; {dashboard?.thresholds?.spi_warning_below}</p></div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Portfolio exception summary">
        <Metric label="Projects shown" value={summary.total_projects || 0} detail={`${summary.accessible_project_count || 0} accessible · ${summary.clear_projects || 0} clear`} />
        <Metric label="Need attention" value={summary.projects_needing_attention || 0} detail={`${summary.exception_count || 0} total exceptions`} tone="high" />
        <Metric label="Critical projects" value={summary.critical_projects || 0} detail="Immediate management action" tone="critical" />
        <Metric label="High projects" value={summary.high_projects || 0} detail="Action this reporting cycle" tone="high" />
        <Metric label="Medium projects" value={summary.medium_projects || 0} detail="Monitor and resolve" />
      </section>

      <form onSubmit={applyFilters} className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900" aria-label="Portfolio filters">
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300"><span>Search project or owner</span><span className="relative"><MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-slate-400" /><input className={`${fieldClass} w-full pl-10`} value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Project code, name or owner" /></span></label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300"><span>Severity</span><select className={fieldClass} value={filters.severity} onChange={(event) => setFilters({ ...filters, severity: event.target.value })}><option value="">All severities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300"><span>Category</span><select className={fieldClass} value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="">All categories</option><option value="governance">Governance</option><option value="reporting">Reporting</option><option value="data_quality">Data quality</option><option value="cost">Cost</option><option value="schedule">Schedule</option></select></label>
        <button className={buttonClass} type="submit"><FunnelIcon className="h-4 w-4" />Apply</button><button className={buttonClass} type="button" onClick={resetFilters}>Reset</button><button className={buttonClass} type="button" onClick={load} disabled={loading}><ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
      </form>

      {error && <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{error}</div>}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900" aria-label="Portfolio exceptions by project">
        <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300"><tr><th className="px-4 py-3">Project</th><th className="px-4 py-3">Health</th><th className="px-4 py-3">Latest controls</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3 text-right">Exceptions</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {projectRows.map((row) => {
            const open = expanded[row.project.id]
            const lead = row.exceptions[0]
            return <React.Fragment key={row.project.id}><tr className="align-top"><td className="px-4 py-4"><p className="font-semibold text-slate-950 dark:text-white">{row.project.code} · {row.project.name}</p><p className="mt-1 text-xs text-slate-500">{row.project.status} · {row.project.progress_pct}% complete</p></td><td className="px-4 py-4"><SeverityBadge value={row.overall_severity} /></td><td className="px-4 py-4 text-xs text-slate-600 dark:text-slate-300">{row.latest_snapshot ? <><p>Data date {row.latest_snapshot.data_date} · v{row.latest_snapshot.version}</p><p className="mt-1">CPI {row.latest_snapshot.cpi ?? 'N/A'} · SPI {row.latest_snapshot.spi ?? 'N/A'}</p></> : <p>No sealed snapshot</p>}</td><td className="px-4 py-4">{row.project.owner.name}</td><td className="px-4 py-4 text-right"><button type="button" className="font-semibold text-indigo-700 underline-offset-2 hover:underline dark:text-indigo-300" onClick={() => setExpanded((current) => ({ ...current, [row.project.id]: !open }))} aria-expanded={Boolean(open)} aria-label={`${row.exception_count} exceptions for ${row.project.code}`}>{row.exception_count}</button></td><td className="px-4 py-4 text-right">{lead ? <button type="button" className={buttonClass} onClick={() => openIssue(row.project.id, lead.target_view)}>Resolve top issue<ArrowRightIcon className="h-4 w-4" /></button> : <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300"><CheckCircleIcon className="h-5 w-5" />No action</span>}</td></tr>{open && <tr><td colSpan="6" className="bg-slate-50 px-4 py-4 dark:bg-slate-950"><ul className="grid gap-3 lg:grid-cols-2">{row.exceptions.map((issue) => <li key={issue.code} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="flex items-center gap-2"><SeverityBadge value={issue.severity} /><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{issue.category.replace('_', ' ')}</span></div><p className="mt-2 font-semibold text-slate-950 dark:text-white">{issue.title}</p><p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{issue.detail}</p><p className="mt-2 text-xs text-slate-500">Accountable: {issue.owner.name}</p></div><button type="button" className={buttonClass} onClick={() => openIssue(row.project.id, issue.target_view)}>Open action<ArrowRightIcon className="h-4 w-4" /></button></div></li>)}</ul></td></tr>}</React.Fragment>
          })}
          {!projectRows.length && <tr><td colSpan="6" className="px-6 py-12 text-center text-sm text-slate-500">No accessible projects match the selected filters.</td></tr>}
        </tbody></table></div>
      </section>
    </div>
  )
}
