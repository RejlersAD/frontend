/* eslint-disable react/prop-types */
import React from 'react'
import {
  ArrowDownTrayIcon, ArrowPathIcon, BanknotesIcon, CalendarDaysIcon,
  ChartBarIcon, CloudArrowDownIcon, DocumentTextIcon, EllipsisHorizontalIcon,
  ExclamationTriangleIcon, FolderIcon, PencilSquareIcon, PlusIcon, ShieldCheckIcon, Squares2X2Icon,
} from '@heroicons/react/24/outline'
import { PROJECT_COPY, PROJECT_VIEW_MODES } from '../../../config/projectControl.config'
import ProjectSelector from './ProjectSelector'

const ICONS = {
  banknotes: BanknotesIcon, calendar: CalendarDaysIcon, chart: ChartBarIcon,
  document: DocumentTextIcon, folder: FolderIcon, shield: ShieldCheckIcon,
  squares: Squares2X2Icon, alert: ExclamationTriangleIcon,
}

const titleCase = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const dateLabel = (value) => {
  if (!value) return 'Not set'
  const date = new Date(String(value).length === 10 ? `${value}T00:00:00` : value)
  return Number.isNaN(date.getTime()) ? 'Not set' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

const compactDateLabel = (value) => {
  if (!value) return 'Not set'
  const date = new Date(String(value).length === 10 ? `${value}T00:00:00` : value)
  return Number.isNaN(date.getTime()) ? 'Not set' : date.toLocaleDateString()
}

const Badge = ({ children, tone }) => {
  const tones = {
    green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  }
  return <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${tones[tone] || tones.slate}`}>{children}</span>
}

export default function ProjectControlHeader({
  projects, selectedProject, selectedProjectId, onSelectProject, loading, error,
  phaseFlags, activeView, onSelectView, onNavigate, onCreate, onEdit, onImport,
  onArchive, onRefresh, onExport,
}) {
  const visibleAreas = PROJECT_VIEW_MODES.filter((area) => (
    area.route || !area.phaseFlag || (area.phaseLabel ? phaseFlags[area.phaseFlag] === true : phaseFlags[area.phaseFlag] !== false)
  ))
  const dataDate = selectedProject?.custom_fields?.data_date || selectedProject?.updated_at
  const health = selectedProject?.is_overdue ? 'Needs attention' : 'On track'
  const progress = Math.max(0, Math.min(100, Number(selectedProject?.progress) || 0))

  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 print:border-0">
      <div className="px-4 pt-3 sm:px-6">
        {selectedProject ? (
          <div className="flex flex-col gap-3 pb-3 2xl:flex-row 2xl:items-center">
            <div className="w-full shrink-0 2xl:w-[22rem]"><ProjectSelector projects={projects} value={selectedProjectId} onChange={onSelectProject} loading={loading} error={error} label={activeView === 'portfolio-exceptions' ? 'Drill-down project' : 'Active Project'} /></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{activeView === 'portfolio-exceptions' ? 'Portfolio Exceptions' : 'Project Performance'}</h1><Badge tone={selectedProject.status === 'active' ? 'green' : 'slate'}>{titleCase(selectedProject.status)}</Badge><Badge tone={selectedProject.priority === 'critical' || selectedProject.priority === 'high' ? 'amber' : 'blue'}>{titleCase(selectedProject.priority)} priority</Badge><Badge tone={selectedProject.is_overdue ? 'amber' : 'green'}>{health}</Badge></div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                <p className="max-w-full truncate text-sm font-medium text-slate-700 dark:text-slate-200">{selectedProject.name}</p>
                <span className="rounded bg-slate-100 px-2 py-0.5 font-mono font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{selectedProject.code}</span>
                <span><span className="font-semibold">Start:</span> {compactDateLabel(selectedProject.start_date)}</span>
                <span><span className="font-semibold">End:</span> {compactDateLabel(selectedProject.end_date)}</span>
                <span className="inline-flex items-center gap-2">
                  <span><span className="font-semibold">Progress:</span> {progress}%</span>
                  <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-label="Project progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}><span className="block h-full rounded-full bg-indigo-600" style={{ width: `${progress}%` }} /></span>
                </span>
              </div>
            </div>
            <div className="shrink-0 text-xs text-slate-500 dark:text-slate-400"><p><span className="font-semibold text-slate-700 dark:text-slate-200">Data date:</span> {dateLabel(dataDate)}</p><p className="mt-0.5">Last refreshed: {dateLabel(selectedProject.updated_at)}</p></div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 print:hidden">
              <button type="button" onClick={onRefresh} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"><ArrowPathIcon aria-hidden="true" className="h-4 w-4" />Refresh</button>
              <button type="button" onClick={onExport} title="Print or save this report as PDF" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"><ArrowDownTrayIcon aria-hidden="true" className="h-4 w-4" />Export report</button>
              <details className="relative"><summary className="grid min-h-11 min-w-11 cursor-pointer list-none place-items-center rounded-lg border border-slate-300 bg-white hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:border-slate-600 dark:bg-slate-800"><span className="sr-only">More project actions</span><EllipsisHorizontalIcon aria-hidden="true" className="h-5 w-5" /></summary><div className="absolute right-0 z-30 mt-1 min-w-52 rounded-lg border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"><button type="button" onClick={onEdit} className="flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"><PencilSquareIcon aria-hidden="true" className="h-4 w-4" />Edit project details</button><button type="button" onClick={onImport} className="flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"><CloudArrowDownIcon aria-hidden="true" className="h-4 w-4" />Import from QHSE</button><button type="button" onClick={onCreate} className="flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"><PlusIcon aria-hidden="true" className="h-4 w-4" />New project</button><button type="button" onClick={onArchive} className="flex min-h-10 w-full items-center rounded-md px-3 text-left text-sm text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40">Delete project</button></div></details>
              <button type="button" onClick={onEdit} className="inline-flex min-h-11 items-center rounded-lg bg-indigo-700 px-4 text-sm font-semibold text-white hover:bg-indigo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2">Update progress</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 pb-4 xl:flex-row xl:items-end xl:justify-between"><div><h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Project Portfolio</h1><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Open and manage the projects you are authorised to access.</p></div><div className="flex flex-wrap items-end gap-2"><div className="min-w-[18rem]"><ProjectSelector projects={projects} value={selectedProjectId} onChange={onSelectProject} loading={loading} error={error} /></div><button type="button" onClick={onCreate} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-indigo-700 px-4 text-sm font-semibold text-white hover:bg-indigo-800"><PlusIcon aria-hidden="true" className="h-4 w-4" />{PROJECT_COPY.newProject}</button></div></div>
        )}
      </div>

      {selectedProject && <nav aria-label="Project work areas" className="overflow-x-auto border-t border-slate-200 px-4 dark:border-slate-700 sm:px-6 print:hidden"><ul className="flex min-w-max gap-1">{visibleAreas.map((area) => { const Icon = ICONS[area.icon] || ArrowPathIcon; const current = !area.route && activeView === area.key; return <li key={area.key}><button type="button" aria-current={current ? 'page' : undefined} onClick={() => area.route ? onNavigate(area.route) : onSelectView(area.key)} className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600 ${current ? 'border-indigo-700 text-indigo-700 dark:text-indigo-300' : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-950 dark:text-slate-300'}`}><Icon aria-hidden="true" className="h-4 w-4" />{area.label}</button></li> })}</ul></nav>}
    </header>
  )
}
