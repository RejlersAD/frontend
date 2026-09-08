/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useState } from 'react'
import {
  ArrowRightIcon, BanknotesIcon, BuildingOffice2Icon, CalendarDaysIcon,
  ChartBarIcon, CheckCircleIcon, CircleStackIcon, ClockIcon,
  ExclamationCircleIcon, ExclamationTriangleIcon, FlagIcon,
  ShieldExclamationIcon, UserCircleIcon,
} from '@heroicons/react/24/outline'
import * as PC from '../../../services/projectControl.service'

const rowsOf = (value) => Array.isArray(value) ? value : value?.results || []
const hasValue = (value) => value !== null && value !== undefined && value !== ''
const numeric = (value) => hasValue(value) && Number.isFinite(Number(value)) ? Number(value) : null
const clamp = (value) => Math.max(0, Math.min(100, Number(value) || 0))

const formatDate = (value, fallback = 'Not provided') => {
  if (!value) return fallback
  const date = new Date(String(value).length === 10 ? `${value}T00:00:00` : value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

const formatDateTime = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const formatMoney = (value, currency = 'AED', fallback = 'Not established') => {
  const amount = numeric(value)
  if (amount === null) return fallback
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency', currency, maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

const durationMonths = (start, finish) => {
  if (!start || !finish) return null
  const from = new Date(`${start}T00:00:00`)
  const to = new Date(`${finish}T00:00:00`)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return null
  return Math.max(1, Math.round(Math.round((to - from) / 86400000) / 30.4375))
}

const projectManagerName = (project) => {
  const manager = project.team_members_data?.find((item) => item.role === 'project_manager' && item.is_active)?.user
  if (manager) return [manager.first_name, manager.last_name].filter(Boolean).join(' ') || manager.email
  if (project.owner) return [project.owner.first_name, project.owner.last_name].filter(Boolean).join(' ') || project.owner.email
  return project.owner_name || 'Not assigned'
}

const Panel = ({ title, icon: Icon, action, children, className = '' }) => (
  <section className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 ${className}`}>
    <header className="flex min-h-12 items-center justify-between gap-3 border-b border-slate-200 px-4 dark:border-slate-700">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
        {Icon && <Icon aria-hidden="true" className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}{title}
      </h2>
      {action}
    </header>
    {children}
  </section>
)

const TextAction = ({ children, onClick, disabled = false }) => (
  <button type="button" onClick={onClick} disabled={disabled} className="inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent dark:text-indigo-300 dark:hover:bg-indigo-950/40">
    {children}<ArrowRightIcon aria-hidden="true" className="h-3.5 w-3.5" />
  </button>
)

const Fact = ({ icon: Icon, label, value, missing = false, children }) => (
  <div className="flex min-h-[4.75rem] items-center gap-3 border-b border-slate-200 px-4 py-3 last:border-0 dark:border-slate-700 lg:border-b-0 lg:border-r">
    <Icon aria-hidden="true" className="h-6 w-6 shrink-0 text-slate-500 dark:text-slate-400" />
    <div className="min-w-0">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-0.5 truncate text-sm font-semibold ${missing ? 'text-rose-700 dark:text-rose-300' : 'text-slate-900 dark:text-white'}`}>{value}</p>
      {children}
    </div>
  </div>
)

const Metric = ({ label, value, detail, source, tone = 'default', progress }) => {
  const tones = { default: 'text-slate-950 dark:text-white', warning: 'text-amber-700 dark:text-amber-300' }
  return (
    <div className="min-w-0 border-b border-slate-200 p-4 last:border-0 dark:border-slate-700 md:border-b-0 md:border-r">
      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</p>
      <p className={`mt-1 truncate text-xl font-semibold tracking-tight ${tones[tone]}`}>{value}</p>
      {progress !== undefined && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-label={label} aria-valuemin="0" aria-valuemax="100" aria-valuenow={clamp(progress)}><div className="h-full rounded-full bg-indigo-600" style={{ width: `${clamp(progress)}%` }} /></div>}
      {detail && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail}</p>}
      {source && <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">Source: {source}</p>}
    </div>
  )
}

const EmptyState = ({ children }) => <div className="grid min-h-36 place-items-center px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">{children}</div>

const LoadingDashboard = () => (
  <div role="status" aria-live="polite" className="space-y-3">
    <span className="sr-only">Loading project performance</span>
    {[80, 128, 260, 220].map((height, index) => <div key={index} className="animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900" style={{ height }} />)}
  </div>
)

export default function ProjectDashboardTab({ project, phaseFlags, onSelectView, onEdit }) {
  const [dashboard, setDashboard] = useState({ kpis: null, commercial: null, milestones: [], tasks: [], changes: [], issues: [], loading: true })
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let active = true
    setDashboard((current) => ({ ...current, loading: true }))
    Promise.allSettled([
      PC.getCostKpis(project.id), PC.getCommercialDashboard(project.id),
      PC.listProjectMilestones(project.id), PC.listProjectTasks(project.id),
      PC.listChangeEvents(project.id),
    ]).then(([kpis, commercial, milestones, tasks, changes]) => {
      if (!active) return
      const requests = [
        ['Cost performance', kpis],
        ['Commercial summary', commercial],
        ['Project milestones', milestones],
        ['Project tasks', tasks],
        ['Project changes', changes],
      ]
      const issues = requests
        .filter(([, result]) => result.status === 'rejected')
        .map(([label, result]) => {
          const status = result.reason?.response?.status
          if (status === 404) return `${label}: the API route is not active in the running backend.`
          if (status === 403) return `${label}: your project role does not permit access.`
          if (status >= 500) return `${label}: the backend returned server error ${status}.`
          if (!result.reason?.response) return `${label}: the backend could not be reached.`
          return `${label}: ${result.reason?.response?.data?.detail || result.reason?.message || 'request failed'}.`
        })
      setDashboard({
        kpis: kpis.status === 'fulfilled' ? kpis.value : null,
        commercial: commercial.status === 'fulfilled' ? commercial.value : null,
        milestones: milestones.status === 'fulfilled' ? rowsOf(milestones.value) : [],
        tasks: tasks.status === 'fulfilled' ? rowsOf(tasks.value) : [],
        changes: changes.status === 'fulfilled' ? rowsOf(changes.value) : [],
        issues,
        loading: false,
      })
    })
    return () => { active = false }
  }, [project.id, reloadToken])

  const model = useMemo(() => {
    const { kpis, commercial, milestones, tasks, changes } = dashboard
    const currency = kpis?.currency || commercial?.currency || project.currency || 'AED'
    const budget = numeric(kpis?.budget)
    const actual = numeric(kpis?.spent ?? commercial?.actual)
    const committed = numeric(kpis?.committed ?? commercial?.committed)
    const forecast = kpis?.forecast || {}
    const finish = project.custom_fields?.forecast_finish || project.end_date
    const dataDate = forecast.snapshot_date || project.custom_fields?.data_date || project.updated_at
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const upcomingLimit = new Date(today.getTime() + 14 * 86400000)
    const milestoneRows = milestones.slice().sort((a, b) => String(a.target_date).localeCompare(String(b.target_date)))
    const dueMilestones = milestoneRows.filter((item) => {
      if (item.is_completed || !item.target_date) return false
      const target = new Date(`${item.target_date}T00:00:00`)
      return target >= today && target <= upcomingLimit
    })
    const openChanges = changes.filter((item) => !['closed', 'approved', 'rejected'].includes(item.status))
    const manager = projectManagerName(project)
    const attention = []
    if (!(budget > 0)) attention.push({ title: 'Control budget not established', detail: 'Required for CPI and EAC calculations', owner: 'Project Controls', action: 'Set baseline', go: () => onSelectView?.('cost-dashboard') })
    if (!project.client_name) attention.push({ title: 'Client information missing', detail: 'Required for reporting and contracts', owner: 'Project Manager', action: 'Complete details', go: onEdit })
    if (!project.scope_type) attention.push({ title: 'Scope type missing', detail: 'Required for project classification', owner: 'Project Manager', action: 'Set scope', go: onEdit })
    if (dueMilestones.length) attention.push({ title: `${dueMilestones.length} milestone${dueMilestones.length === 1 ? '' : 's'} due within 14 days`, detail: dueMilestones.slice(0, 2).map((item) => item.name).join(' · '), owner: manager, action: 'Review', go: () => onSelectView?.('plan-baseline') })
    const readiness = [
      { label: 'Client', ready: Boolean(project.client_name), action: 'Add client' },
      { label: 'Scope type', ready: Boolean(project.scope_type), action: 'Set scope type' },
      { label: 'Cost baseline', ready: Boolean(budget > 0), action: 'Set baseline' },
      { label: 'Ledger postings', ready: Boolean(kpis?.ledger_entry_count), action: 'Add posting' },
      { label: 'Schedule dates', ready: Boolean(project.start_date && project.end_date), action: 'Set dates' },
    ]
    return {
      currency, budget, actual, committed, forecast, finish, dataDate, milestoneRows,
      dueMilestones, openChanges, manager, attention, readiness, tasks,
      readinessScore: Math.round((readiness.filter((item) => item.ready).length / readiness.length) * 100),
      recentEvents: commercial?.recent_events || [],
    }
  }, [dashboard, project, onEdit, onSelectView])

  if (dashboard.loading) return <LoadingDashboard />
  const progress = clamp(project.progress)
  const spi = numeric(model.forecast.spi)
  const cpi = numeric(model.forecast.cpi)
  const eac = numeric(model.forecast.eac)
  const months = durationMonths(project.start_date, model.finish)

  return (
    <div className="space-y-3 print:space-y-2">
      {dashboard.issues.length > 0 && (
        <section role="alert" aria-labelledby="project-data-warning-title" className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100 sm:flex-row sm:items-start">
          <ExclamationTriangleIcon aria-hidden="true" className="h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 id="project-data-warning-title" className="text-sm font-semibold">Some project-control data is unavailable</h2>
            <p className="mt-1 text-xs leading-5 text-amber-900 dark:text-amber-200">The project loaded correctly, but the following supporting services failed. Empty panels below do not mean that records were deleted.</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5">
              {dashboard.issues.map(issue => <li key={issue}>{issue}</li>)}
            </ul>
            {dashboard.issues.some(issue => issue.includes('route is not active')) && <p className="mt-2 text-xs font-semibold">Restart the backend service to activate the updated task and milestone routes, then retry.</p>}
          </div>
          <button type="button" onClick={() => setReloadToken(value => value + 1)} className="min-h-9 shrink-0 rounded-lg border border-amber-400 bg-white px-3 text-xs font-semibold text-amber-950 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 dark:bg-amber-900 dark:text-amber-50">Retry data</button>
        </section>
      )}
      <section aria-label="Project facts" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="grid lg:grid-cols-7">
          <Fact icon={BuildingOffice2Icon} label="Client" value={project.client_name || 'Not provided'} missing={!project.client_name} />
          <Fact icon={UserCircleIcon} label="Project manager" value={model.manager} missing={model.manager === 'Not assigned'} />
          <Fact icon={CalendarDaysIcon} label="Start date" value={formatDate(project.start_date)} missing={!project.start_date} />
          <Fact icon={CalendarDaysIcon} label="Forecast finish" value={formatDate(model.finish)} missing={!model.finish} />
          <Fact icon={ClockIcon} label="Baseline duration" value={months ? `${months} months` : 'Not established'} missing={!months} />
          <Fact icon={ChartBarIcon} label="Physical progress" value={`${progress}%`}><div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-label="Physical progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}><div className="h-full rounded-full bg-indigo-600" style={{ width: `${progress}%` }} /></div></Fact>
          <Fact icon={CircleStackIcon} label="Currency" value={model.currency} />
        </div>
      </section>

      {model.attention.length > 0 && <section aria-labelledby="attention-title" className="overflow-hidden rounded-xl border border-rose-200 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/20">
        <div className="grid xl:grid-cols-[16rem_1fr]">
          <div className="flex items-center gap-3 border-b border-rose-200 px-4 py-3 dark:border-rose-900 xl:border-b-0 xl:border-r"><ExclamationCircleIcon aria-hidden="true" className="h-8 w-8 shrink-0 text-rose-600" /><div><h2 id="attention-title" className="font-semibold text-rose-800 dark:text-rose-200">Needs attention</h2><p className="text-xs text-rose-700 dark:text-rose-300">{model.attention.length} item{model.attention.length === 1 ? '' : 's'} require action</p></div></div>
          <div className="grid md:grid-cols-2 2xl:grid-cols-3">{model.attention.slice(0, 3).map((item) => <div key={item.title} className="flex min-w-0 items-start gap-3 border-b border-rose-200 px-4 py-3 last:border-0 dark:border-rose-900 md:border-r"><ExclamationTriangleIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</p><p className="mt-0.5 truncate text-xs text-slate-600 dark:text-slate-300">{item.detail}</p><p className="mt-1 text-[11px] text-slate-500">Owner: {item.owner}</p></div><button type="button" onClick={item.go} className="min-h-10 shrink-0 rounded-md border border-indigo-200 bg-white px-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:bg-slate-900 dark:text-indigo-300">{item.action}</button></div>)}</div>
        </div>
      </section>}

      <section aria-label="Performance indicators" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="grid md:grid-cols-3 xl:grid-cols-6">
          <Metric label="Physical progress" value={`${progress}%`} detail={`As of ${formatDate(model.dataDate, 'current record')}`} source="Project" progress={progress} />
          <Metric label="Schedule performance index (SPI)" value={spi === null ? 'Not available' : spi.toFixed(2)} detail={spi === null ? 'No approved EVM snapshot' : spi < 1 ? 'Behind plan' : 'On or ahead of plan'} source="EVM" tone={spi !== null && spi < 1 ? 'warning' : 'default'} />
          <Metric label="Cost performance index (CPI)" value={cpi === null ? 'Not available' : cpi.toFixed(2)} detail={cpi === null ? 'Control budget not established' : cpi < 1 ? 'Cost efficiency below plan' : 'Cost efficiency on plan'} source="EVM" tone={cpi !== null && cpi < 1 ? 'warning' : 'default'} />
          <Metric label="Control budget" value={formatMoney(model.budget, model.currency)} detail={model.budget ? 'Posted baseline cost control' : 'Set baseline to enable controls'} source="Cost Control" tone={model.budget ? 'default' : 'warning'} />
          <Metric label="Actual cost (AC)" value={formatMoney(model.actual, model.currency, `${model.currency} 0`)} detail={dashboard.kpis?.ledger_entry_count ? `${dashboard.kpis.ledger_entry_count} posted ledger entries` : 'No ledger postings'} source="Finance" />
          <Metric label="Forecast finish" value={formatDate(model.finish)} detail={project.end_date ? 'Based on current project plan' : 'No approved schedule finish'} source="Schedule" tone={!model.finish ? 'warning' : 'default'} />
        </div>
      </section>

      <div className="grid grid-cols-12 gap-3">
        <Panel title="Schedule & progress" icon={CalendarDaysIcon} className="col-span-12 xl:col-span-7" action={<TextAction onClick={() => onSelectView?.('plan-baseline')}>Open schedule</TextAction>}>
          <div className="grid min-h-64 gap-5 p-5 md:grid-cols-[1fr_14rem]">
            <div className="flex flex-col justify-center"><div className="mb-6 flex items-center justify-between text-xs text-slate-500"><span>{formatDate(project.start_date)}</span><span>Data date: {formatDate(model.dataDate, 'Not set')}</span><span>{formatDate(model.finish)}</span></div><div className="relative h-3 rounded-full bg-slate-200 dark:bg-slate-700"><div className="absolute inset-y-0 left-0 rounded-full bg-indigo-600" style={{ width: `${progress}%` }} /><div className="absolute -top-2 h-7 w-px bg-rose-500" style={{ left: `${progress}%` }} aria-hidden="true" /></div><div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600 dark:text-slate-300"><span><i className="mr-1.5 inline-block h-2 w-5 rounded bg-indigo-600" />Recorded physical progress</span><span><i className="mr-1.5 inline-block h-3 w-px bg-rose-500" />Current progress position</span></div><p className="mt-6 text-xs text-slate-500">A time-phased baseline curve will appear when approved period data is available. Planned progress is not inferred.</p></div>
            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800"><p className="text-xs text-slate-500">Actual progress</p><p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">{progress}%</p><p className="mt-4 text-xs text-slate-500">SPI</p><p className="mt-1 text-lg font-semibold">{spi === null ? 'Not available' : spi.toFixed(2)}</p><p className="mt-4 text-xs text-slate-500">Open tasks</p><p className="mt-1 text-lg font-semibold">{model.tasks.filter((task) => task.status !== 'completed').length}</p></div>
          </div>
        </Panel>

        <Panel title="Milestones" icon={FlagIcon} className="col-span-12 xl:col-span-5" action={<TextAction onClick={() => onSelectView?.('plan-baseline')}>Open milestones</TextAction>}>
          {model.milestoneRows.length ? <div className="max-h-72 overflow-auto" role="region" aria-label="Project milestones" tabIndex="0"><table className="min-w-full text-left text-xs"><thead className="sticky top-0 bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><tr><th scope="col" className="px-4 py-2.5">Milestone</th><th scope="col" className="px-4 py-2.5">Target date</th><th scope="col" className="px-4 py-2.5">Status</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{model.milestoneRows.slice(0, 6).map((item) => { const overdue = !item.is_completed && item.target_date && new Date(`${item.target_date}T00:00:00`) < new Date(); const dueSoon = model.dueMilestones.includes(item); const label = item.is_completed ? 'Complete' : overdue ? 'Overdue' : dueSoon ? 'At risk' : 'Planned'; const tone = item.is_completed ? 'text-emerald-700' : overdue ? 'text-rose-700' : dueSoon ? 'text-amber-700' : 'text-slate-600'; return <tr key={item.id}><td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{item.name}</td><td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">{formatDate(item.target_date)}</td><td className={`whitespace-nowrap px-4 py-3 font-semibold ${tone}`}><span aria-hidden="true" className="mr-1.5">●</span>{label}</td></tr> })}</tbody></table></div> : <EmptyState>No milestones have been recorded for this project.</EmptyState>}
        </Panel>

        <Panel title="Cost & forecast" icon={BanknotesIcon} className="col-span-12 lg:col-span-6 xl:col-span-5" action={<TextAction onClick={() => onSelectView?.('commercial-dashboard')}>Open cost control</TextAction>}>
          <div className="grid grid-cols-2 gap-px bg-slate-200 dark:bg-slate-700 sm:grid-cols-3">{[
            ['Contract value', project.contract_value, 'Add contract details'], ['Control budget', model.budget, 'Set baseline'],
            ['Actual cost', model.actual ?? 0, 'No ledger postings'], ['Commitments', model.committed, 'No commitment data'],
            ['Estimate at completion', eac, 'Requires EVM snapshot'], ['Remaining budget', dashboard.kpis?.remaining, 'Requires control budget'],
          ].map(([label, value, fallback]) => <div key={label} className="min-h-24 bg-white p-3 dark:bg-slate-900"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">{formatMoney(value, model.currency, 'Not available')}</p>{numeric(value) === null && <p className="mt-1 text-[11px] text-indigo-700 dark:text-indigo-300">{fallback}</p>}</div>)}</div>
          {!model.budget && <div className="m-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><ExclamationTriangleIcon aria-hidden="true" className="h-5 w-5 shrink-0" /><span>Establish a cost baseline to enable CPI and EAC calculations.</span></div>}
        </Panel>

        <Panel title="Risks & changes" icon={ShieldExclamationIcon} className="col-span-12 lg:col-span-6 xl:col-span-3" action={<TextAction disabled={!phaseFlags?.phase_4_risk_analytics} onClick={() => onSelectView?.('risk')}>{phaseFlags?.phase_4_risk_analytics ? 'Open register' : 'Register unavailable'}</TextAction>}>
          <div className="grid grid-cols-2 border-b border-slate-200 dark:border-slate-700"><div className="p-3"><p className="text-xs text-slate-500">Live risks</p><p className="mt-1 text-sm font-semibold">Not connected</p></div><div className="border-l border-slate-200 p-3 dark:border-slate-700"><p className="text-xs text-slate-500">Pending changes</p><p className="mt-1 text-xl font-semibold">{model.openChanges.length}</p></div></div>
          {model.openChanges.length ? <div className="divide-y divide-slate-100 dark:divide-slate-800">{model.openChanges.slice(0, 3).map((item) => <div key={item.id} className="p-3"><div className="flex justify-between gap-2"><p className="truncate text-xs font-semibold text-slate-900 dark:text-white">{item.summary}</p><span className="text-[11px] capitalize text-amber-700">{item.severity}</span></div><p className="mt-1 text-[11px] capitalize text-slate-500">{item.status}</p></div>)}</div> : <EmptyState>No pending change events. The risk register is not connected.</EmptyState>}
        </Panel>

        <Panel title="Recent project activity" icon={ClockIcon} className="col-span-12 xl:col-span-4" action={<TextAction onClick={() => onSelectView?.('commercial-dashboard')}>View activity</TextAction>}>
          {model.recentEvents.length ? <div className="max-h-60 overflow-auto"><table className="min-w-full text-left text-xs"><thead className="sticky top-0 bg-slate-50 text-slate-600 dark:bg-slate-800"><tr><th scope="col" className="px-3 py-2">Date & time</th><th scope="col" className="px-3 py-2">Activity</th><th scope="col" className="px-3 py-2">User</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{model.recentEvents.slice(0, 6).map((event) => <tr key={event.id}><td className="whitespace-nowrap px-3 py-2 text-slate-500">{formatDateTime(event.event_at)}</td><td className="px-3 py-2 text-slate-800 dark:text-slate-200">{event.event_type_display}</td><td className="px-3 py-2 text-slate-600 dark:text-slate-300">{event.actor}</td></tr>)}</tbody></table></div> : <EmptyState>No audited commercial activity has been recorded.</EmptyState>}
        </Panel>
      </div>

      <section aria-labelledby="readiness-title" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="grid xl:grid-cols-[18rem_1fr_12rem]">
          <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700 xl:border-b-0 xl:border-r"><CircleStackIcon aria-hidden="true" className="h-7 w-7 text-indigo-600" /><div><h2 id="readiness-title" className="text-sm font-semibold text-slate-900 dark:text-white">Project data readiness</h2><p className="text-xs text-slate-500">Complete key data for reliable reporting.</p></div></div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5">{model.readiness.map((item) => <button type="button" key={item.label} onClick={item.ready ? undefined : (item.label === 'Cost baseline' || item.label === 'Ledger postings' ? () => onSelectView?.('cost-dashboard') : onEdit)} className="min-h-16 border-b border-slate-200 px-3 py-2 text-left hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600 dark:border-slate-700 dark:hover:bg-slate-800 lg:border-b-0 lg:border-r"><p className="flex items-center gap-1.5 text-xs text-slate-500">{item.ready ? <CheckCircleIcon aria-hidden="true" className="h-4 w-4 text-emerald-600" /> : <ExclamationCircleIcon aria-hidden="true" className="h-4 w-4 text-rose-600" />}{item.label}</p><p className={`mt-1 text-xs font-semibold ${item.ready ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>{item.ready ? 'Available' : item.action}</p></button>)}</div>
          <div className="flex items-center gap-3 px-4 py-3"><div className="flex-1"><div className="flex justify-between text-xs"><span className="font-semibold">Overall readiness</span><span>{model.readinessScore}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-label="Overall project data readiness" aria-valuemin="0" aria-valuemax="100" aria-valuenow={model.readinessScore}><div className="h-full rounded-full bg-indigo-600" style={{ width: `${model.readinessScore}%` }} /></div></div></div>
        </div>
      </section>
    </div>
  )
}
