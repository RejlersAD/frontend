/**
 * ProjectDashboardTab.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * First tab in the Project Management module.
 * Displays the key commercial and scheduling facts for the selected project:
 *   1. Project Name & Code
 *   2. Client Name
 *   3. Start & Finish Date
 *   4. Contract Value with Currency
 *   5. Scope Type
 *
 * This tab reads ONLY from the `project` prop (already fetched by ProjectsPage)
 * so it requires no additional API call — zero latency on first open.
 *
 * All display strings are sourced from PROJECT_COPY (projectControl.config.js);
 * all option labels are resolved from PROJECT_SCOPE_TYPE_OPTIONS and
 * PROJECT_CURRENCY_OPTIONS so there is no hardcoded label text in this file.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useMemo } from 'react'
import {
  BuildingOffice2Icon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
  WrenchScrewdriverIcon,
  IdentificationIcon,
  ClockIcon,
  CheckBadgeIcon,
  ExclamationTriangleIcon,
  NoSymbolIcon,
} from '@heroicons/react/24/outline'

import {
  PROJECT_COPY,
  PROJECT_SCOPE_TYPE_OPTIONS,
  PROJECT_CURRENCY_OPTIONS,
  PROJECT_STATUS_OPTIONS,
  PROJECT_PRIORITY_OPTIONS,
} from '../../../config/projectControl.config'

// ─────────────────────────────────────────────────────────────────────────────
// Soft-coded display helpers
// ─────────────────────────────────────────────────────────────────────────────

// Resolve a value→label from any option list; falls back gracefully.
const resolveLabel = (options, value) =>
  options.find((o) => o.value === value)?.label ?? value ?? '—'

// Format a decimal number as a localised string with 2 decimal places.
// The browser locale is used so regional separators are respected.
const fmtNumber = (n) =>
  n != null && n !== '' ? Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'

// Format an ISO date string (yyyy-mm-dd) to a readable date.
const fmtDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')   // force local timezone
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// Derive duration in full calendar months between start and end.
const durationMonths = (start, end) => {
  if (!start || !end) return null
  const s = new Date(start)
  const e = new Date(end)
  if (e < s) return null
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
}

// Determine schedule health relative to today's date.
const scheduleHealth = (start, end, status) => {
  if (status === 'completed') return { key: 'completed', label: 'Completed', color: 'emerald' }
  if (status === 'cancelled') return { key: 'cancelled', label: 'Cancelled', color: 'slate' }
  const today = new Date()
  if (!end) return { key: 'unknown', label: 'No End Date', color: 'amber' }
  const endDate = new Date(end + 'T00:00:00')
  if (today > endDate) return { key: 'overdue', label: 'Overdue', color: 'rose' }
  // Soft threshold: amber when within 30 days of end
  const WARN_DAYS = 30
  const diff = (endDate - today) / (1000 * 60 * 60 * 24)
  if (diff <= WARN_DAYS) return { key: 'due_soon', label: `Due in ${Math.round(diff)} d`, color: 'amber' }
  return { key: 'on_track', label: 'On Track', color: 'emerald' }
}

// Tone → Tailwind class mapping for badge chips.
const BADGE_CLASSES = {
  emerald: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
  amber:   'bg-amber-100  text-amber-700  ring-1 ring-amber-200',
  rose:    'bg-rose-100   text-rose-700   ring-1 ring-rose-200',
  slate:   'bg-slate-100  text-slate-600  ring-1 ring-slate-200',
  indigo:  'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200',
  violet:  'bg-violet-100 text-violet-700 ring-1 ring-violet-200',
}

// Soft-coded status → colour mapping (mirrors PROJECT_STATUS_OPTIONS values).
const STATUS_TONES = {
  planning:  'indigo',
  active:    'emerald',
  on_hold:   'amber',
  completed: 'emerald',
  cancelled: 'slate',
}
const PRIORITY_TONES = {
  low:      'slate',
  medium:   'indigo',
  high:     'amber',
  critical: 'rose',
}

// Schedule health → icon component mapping.
const HEALTH_ICONS = {
  completed: CheckBadgeIcon,
  cancelled: NoSymbolIcon,
  overdue:   ExclamationTriangleIcon,
  due_soon:  ClockIcon,
  on_track:  CheckBadgeIcon,
  unknown:   ClockIcon,
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * InfoCard — a single labelled field inside the dashboard grid.
 * `icon` is a Heroicon component, `label` is the field name, `value` is the
 * main display string, and `sub` is optional grey helper text below it.
 */
function InfoCard({ icon: Icon, label, value, sub, accentClass = 'from-indigo-50 to-violet-50 border-indigo-100' }) {
  return (
    <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${accentClass} p-5 flex flex-col gap-1.5`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        <Icon className="h-4 w-4 text-indigo-400 flex-shrink-0" />
        {label}
      </div>
      <div className="text-base font-semibold text-slate-900 leading-snug min-h-[1.5rem]">
        {value || <span className="text-slate-400 font-normal">—</span>}
      </div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

/**
 * ProgressBar — soft-coded visual progress indicator.
 */
function ProgressBar({ pct = 0 }) {
  const clamped = Math.max(0, Math.min(100, Number(pct) || 0))
  const color = clamped >= 80 ? 'bg-emerald-500' : clamped >= 40 ? 'bg-indigo-500' : 'bg-amber-500'
  return (
    <div className="mt-1 flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-700 w-9 text-right">{clamped}%</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main tab component
// ─────────────────────────────────────────────────────────────────────────────

export default function ProjectDashboardTab({ project }) {
  if (!project) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">
        {PROJECT_COPY.noProjects}
      </div>
    )
  }

  // Resolve human-readable labels from soft-coded option lists.
  // useMemo ensures this is recomputed only when the project changes.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const derived = useMemo(() => {
    const scopeLabel    = resolveLabel(PROJECT_SCOPE_TYPE_OPTIONS, project.scope_type)
    const statusLabel   = resolveLabel(PROJECT_STATUS_OPTIONS,    project.status)
    const priorityLabel = resolveLabel(PROJECT_PRIORITY_OPTIONS,  project.priority)
    const currencyLabel = resolveLabel(PROJECT_CURRENCY_OPTIONS,  project.currency)
    const currencyCode  = project.currency || 'AED'

    const contractFormatted =
      project.contract_value != null && project.contract_value !== ''
        ? `${currencyCode} ${fmtNumber(project.contract_value)}`
        : null

    const months = durationMonths(project.start_date, project.end_date)
    const durationLabel = months != null ? `${months} month${months !== 1 ? 's' : ''}` : null

    const health = scheduleHealth(project.start_date, project.end_date, project.status)
    const HealthIcon = HEALTH_ICONS[health.key] || ClockIcon

    return {
      scopeLabel,
      statusLabel,
      priorityLabel,
      currencyLabel,
      currencyCode,
      contractFormatted,
      durationLabel,
      health,
      HealthIcon,
    }
  }, [project])

  const {
    scopeLabel, statusLabel, priorityLabel,
    contractFormatted, durationLabel,
    health, HealthIcon,
  } = derived

  return (
    <div className="space-y-6">

      {/* ── Header identity strip ───────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-white/70 text-xs font-semibold uppercase tracking-wider">
                <IdentificationIcon className="h-3.5 w-3.5" />
                {project.code || PROJECT_COPY.selectorPlaceholder}
              </div>
              <h2 className="text-xl font-bold text-white mt-0.5 leading-snug">
                {project.name}
              </h2>
              {project.client_name && (
                <div className="flex items-center gap-1.5 text-white/80 text-sm mt-1">
                  <BuildingOffice2Icon className="h-4 w-4" />
                  {project.client_name}
                </div>
              )}
            </div>

            {/* Status + Priority badges */}
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${BADGE_CLASSES[STATUS_TONES[project.status] || 'slate']}`}>
                {statusLabel}
              </span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${BADGE_CLASSES[PRIORITY_TONES[project.priority] || 'slate']}`}>
                {priorityLabel} Priority
              </span>
              {/* Schedule health chip */}
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${BADGE_CLASSES[health.color]}`}>
                <HealthIcon className="h-3 w-3" />
                {health.label}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-white/70 mb-1">
              <span>Overall Progress</span>
              <span className="font-semibold text-white">{project.progress ?? 0}%</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white/80 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(0, Math.min(100, Number(project.progress) || 0))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Description */}
        {project.description && (
          <div className="px-6 py-4 text-sm text-slate-600 border-t border-slate-100">
            {project.description}
          </div>
        )}
      </div>

      {/* ── Key facts grid (5 required fields + extras) ─────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* 1. Project Name & Code */}
        <InfoCard
          icon={IdentificationIcon}
          label="Project Name & Code"
          value={`${project.name}  ·  ${project.code}`}
          accentClass="from-indigo-50 to-violet-50 border-indigo-100"
        />

        {/* 2. Client Name */}
        <InfoCard
          icon={BuildingOffice2Icon}
          label="Client"
          value={project.client_name || null}
          sub={project.location || null}
          accentClass="from-sky-50 to-cyan-50 border-sky-100"
        />

        {/* 3. Start & Finish Date */}
        <InfoCard
          icon={CalendarDaysIcon}
          label="Schedule"
          value={`${fmtDate(project.start_date)}  →  ${fmtDate(project.end_date)}`}
          sub={durationLabel ? `Duration: ${durationLabel}` : null}
          accentClass="from-emerald-50 to-teal-50 border-emerald-100"
        />

        {/* 4. Contract Value with Currency */}
        <InfoCard
          icon={CurrencyDollarIcon}
          label="Contract Value"
          value={contractFormatted ?? null}
          sub={project.currency ? `Currency: ${project.currency}` : null}
          accentClass="from-amber-50 to-yellow-50 border-amber-100"
        />

        {/* 5. Scope Type */}
        <InfoCard
          icon={WrenchScrewdriverIcon}
          label="Scope Type"
          value={project.scope_type ? scopeLabel : null}
          accentClass="from-fuchsia-50 to-pink-50 border-fuchsia-100"
        />

        {/* Internal Budget (informational) */}
        {project.budget != null && project.budget !== '' && (
          <InfoCard
            icon={CurrencyDollarIcon}
            label="Internal Budget"
            value={`AED ${fmtNumber(project.budget)}`}
            sub={
              project.spent
                ? `Spent: AED ${fmtNumber(project.spent)} (${project.budget > 0 ? Math.round((project.spent / project.budget) * 100) : 0}%)`
                : null
            }
            accentClass="from-slate-50 to-slate-100 border-slate-200"
          />
        )}
      </div>

      {/* ── Team & tasks quick-stats ────────────────────────────────────── */}
      {(project.team_size > 0 || project.tasks_summary?.total > 0) && (
        <div className="bg-white border border-slate-200 rounded-xl px-6 py-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Quick Stats</h3>
          <div className="flex flex-wrap gap-6">
            {project.team_size > 0 && (
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">{project.team_size}</div>
                <div className="text-xs text-slate-500 mt-0.5">Team Members</div>
              </div>
            )}
            {project.tasks_summary?.total > 0 && (
              <>
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-700">{project.tasks_summary.total}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Total Tasks</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-600">{project.tasks_summary.completed}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-600">{project.tasks_summary.in_progress}</div>
                  <div className="text-xs text-slate-500 mt-0.5">In Progress</div>
                </div>
              </>
            )}
            {project.milestones_summary?.total > 0 && (
              <div className="text-center">
                <div className="text-2xl font-bold text-violet-600">{project.milestones_summary.completed}/{project.milestones_summary.total}</div>
                <div className="text-xs text-slate-500 mt-0.5">Milestones</div>
              </div>
            )}
          </div>
          {project.tasks_summary?.total > 0 && (
            <div className="mt-4">
              <div className="text-xs text-slate-500 mb-1">Task Completion</div>
              <ProgressBar pct={Math.round((project.tasks_summary.completed / project.tasks_summary.total) * 100)} />
            </div>
          )}
        </div>
      )}

      {/* ── Tags ────────────────────────────────────────────────────────── */}
      {Array.isArray(project.tags) && project.tags.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl px-6 py-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tags</div>
          <div className="flex flex-wrap gap-2">
            {project.tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 text-xs rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
