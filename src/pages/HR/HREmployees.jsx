/**
 * HR · Employee Management (`/hr/employees`)
 * -------------------------------------------
 * HR-facing workforce directory built on top of the existing RBAC user store.
 *
 * Data source : rbacService.getUsers() — same paginated endpoint that powers
 *               `/admin/users`. This page presents the same records through an
 *               HR lens: KPIs, multi-dimensional filters, three view modes
 *               (cards / table / departments) and a slide-in detail drawer.
 *
 * Every label, threshold, KPI, filter, column and tab comes from
 * `frontend/src/config/hrEmployees.config.js` — no magic values live here.
 *
 * Create / edit / bulk-import flows intentionally deep-link back to
 * `/admin/users` so we keep one authoritative write surface.
 */
import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as HeroIcons from '@heroicons/react/24/outline'
import rbacService from '../../services/rbac.service'
import payrollEngineService from '../../services/payrollEngine.service'
import PeopleNav from '../../components/PeopleNav/PeopleNav'
import TimeSheetAnalytics from './TimeSheetAnalytics'
import { fetchUserHistory, lookupByCode } from '../../services/timesheet.service'
import {
  HR_KPIS,
  HR_FILTERS,
  HR_VIEW_MODES,
  HR_UI,
  HR_DEFAULT_VIEW_MODE,
  HR_CARD_FIELDS,
  HR_TABLE_COLUMNS,
  HR_DETAIL_TABS,
  HR_DEFAULT_DETAIL_TAB,
  HR_DRAWER_WIDTH_DEFAULT,
  HR_PAGE_SIZES,
  HR_DEFAULT_PAGE_SIZE,
  HR_DATA_FETCH_PAGE_SIZE,
  HR_EXPORT_FORMATS,
  HR_COPY,
  HR_ADMIN_USER_LINK,
  HR_ADMIN_USERS_LIST_LINK,
  HR_DISCIPLINES,
  HR_TIMESHEET_RANGES,
  HR_TIMESHEET_DEFAULT_RANGE,
  HR_TIMESHEET_KPIS,
  HR_TIMESHEET_DAILY_COLUMNS,
  HR_TIMESHEET_COPY,
  HR_TIMESHEET_PUNCH_COLUMNS,
  HR_TIMESHEET_PUNCH_SORT,
  HR_TIMESHEET_ACTIVITY_COLUMNS,
  HR_TIMESHEET_ACTIVITY_SORT,
  HR_TIMESHEET_MONTHLY_COLUMNS,
  HR_TIMESHEET_VISUALS,
  HR_DEPT_TABLE_COLUMNS,
  HR_DEPT_ACCENT_PALETTE,
  HR_DEPT_CARD_CONFIG,
  HR_DEPT_COPY,
  HR_DEPT_ACTIONS,
  HR_EDIT_CONFIG,
  HR_SALARY_CONFIG,
  HR_EDITABLE_FIELDS,
  HR_EDIT_VALIDATION,
  HR_EDIT_COPY,
  HR_STATUSES,
  formatYearsOfService,
  formatDateTime,
  formatDate,
  fullName,
  getEmail,
  initials,
  matchDiscipline,
  getStatusMeta,
  normalizeEmployee,
} from '../../config/hrEmployees.config'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Resolve a heroicon name from string → component (falls back to UserIcon). */
const Icon = ({ name, className = 'w-5 h-5' }) => {
  const C = HeroIcons[name] || HeroIcons.UserIcon
  return <C className={className} aria-hidden="true" />
}

// ─── Motion gate ────────────────────────────────────────────────────────────
// Driven by HR_UI.animationsEnabled. When animations are off we strip out
// every transition / animate-* / hover-transform class so the page renders
// as plain static records. Flip the config flag to bring motion back.
const ANIM = HR_UI?.animationsEnabled !== false
/** Return the given class string only when animations are enabled. */
const anim = (cls) => (ANIM ? cls : '')
/** Spinner that becomes a static glyph when animations are off. */
const Spinner = ({ className = 'w-4 h-4' }) =>
  ANIM
    ? <HeroIcons.ArrowPathIcon className={`${className} animate-spin`} aria-hidden="true" />
    : <HeroIcons.EllipsisHorizontalIcon className={className} aria-hidden="true" />

/** Normalise the various shapes rbacService.getUsers() can return. */
const extractUserList = (resp) => {
  if (Array.isArray(resp)) return resp
  if (Array.isArray(resp?.results)) return resp.results
  if (Array.isArray(resp?.data)) return resp.data
  if (Array.isArray(resp?.data?.results)) return resp.data.results
  return []
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: KPI Strip
// ─────────────────────────────────────────────────────────────────────────────
const KpiStrip = ({ employees, loading }) => {
  // Show only the "essential" KPIs by default to keep the page calm. Users
  // can reveal the rest with a single click. The split is driven by
  // HR_UI.essentialKpiIds — edit the config to change what's prominent.
  const [showAll, setShowAll] = useState(false)
  const essentialIds = HR_UI.essentialKpiIds || []
  const essentials   = HR_KPIS.filter(k => essentialIds.includes(k.id))
  const extras       = HR_KPIS.filter(k => !essentialIds.includes(k.id))
  const visible      = showAll ? [...essentials, ...extras] : essentials
  const useCalm      = HR_UI.calmKpis !== false

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-lg font-bold"><HeroIcons.ChartBarSquareIcon className="h-5 w-5 text-cyan-300" /> Workforce Overview</div>
          <p className="mt-1 text-xs text-slate-300">Live headcount, movement and contract-risk signals for faster HR decisions.</p>
        </div>
        <span className="w-fit rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold">Updated from employee records</span>
      </div>
      <div className="space-y-3 p-4">
      <div className={`grid gap-3 ${showAll
        ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-5'
        : 'grid-cols-2 md:grid-cols-3 xl:grid-cols-6'}`}>
        {visible.map((kpi) => (
          <div
            key={kpi.id}
            className={useCalm
              ? `rounded-xl border ${kpi.calmTone || 'bg-slate-50 text-slate-700 border-slate-100'} p-4`
              : `relative overflow-hidden rounded-xl bg-gradient-to-br ${kpi.accent} text-white p-4 shadow-md`}
          >
            <div className="flex items-center justify-between">
              <Icon name={kpi.icon} className={useCalm ? 'w-5 h-5 opacity-80' : 'w-6 h-6 opacity-80'} />
              <span className="max-w-[9rem] text-right text-[10px] font-semibold uppercase leading-tight tracking-wider opacity-70">{kpi.label}</span>
            </div>
            <div className="mt-2 text-3xl font-bold leading-tight tabular-nums">
              {loading
                ? (ANIM
                    ? <span className="inline-block w-10 h-7 bg-current opacity-20 animate-pulse rounded" />
                    : <span className="opacity-50">{HR_UI.staticLoadingPlaceholder || '…'}</span>)
                : kpi.compute(employees)}
            </div>
            <div className="mt-1 text-[11px] opacity-70 line-clamp-1">{kpi.sub}</div>
          </div>
        ))}
      </div>
      {extras.length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowAll(v => !v)}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"
          >
            {showAll ? <HeroIcons.ChevronUpIcon className="w-3.5 h-3.5" /> : <HeroIcons.ChevronDownIcon className="w-3.5 h-3.5" />}
            {showAll ? 'Show fewer metrics' : `Show all ${HR_KPIS.length} metrics`}
          </button>
        </div>
      )}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: Filters Bar
// ─────────────────────────────────────────────────────────────────────────────
const FiltersBar = ({ employees, filterValues, setFilterValue, searchTerm, setSearchTerm, viewMode, setViewMode, onReset, onSubmitSearch, searching }) => {
  // Collapse the filter dropdowns by default — soft-coded in HR_UI. Active
  // filters bubble up as a count badge so nothing is hidden silently.
  const [filtersOpen, setFiltersOpen] = useState(!HR_UI.filtersCollapsedByDefault)
  const activeFilterCount = useMemo(
    () => HR_FILTERS.reduce((n, f) => n + (filterValues[f.id] && filterValues[f.id] !== 'all' ? 1 : 0), 0),
    [filterValues]
  )

  // Commit: trim whitespace and trigger biometric reverse-lookup if applicable.
  // Filtering is already live (driven by searchTerm via onChange), so this
  // only provides the extra numeric-code lookup and trims trailing spaces.
  const commitSearch = () => {
    const term = searchTerm.trim()
    if (term !== searchTerm) setSearchTerm(term)
    onSubmitSearch?.(term)
  }

  const clearSearch = () => setSearchTerm('')

  // Derive dynamic filter options from the loaded employees list.
  const dynamicOptions = useMemo(() => {
    const out = {}
    for (const f of HR_FILTERS) {
      if (typeof f.optionsFrom === 'function') {
        const set = new Set()
        for (const emp of employees) {
          const v = f.optionsFrom(emp)
          if (v && String(v).trim()) set.add(String(v).trim())
        }
        out[f.id] = [
          { value: 'all', label: f.placeholder || `All ${f.label.toLowerCase()}` },
          ...[...set].sort().map(v => ({ value: v, label: v })),
        ]
      }
    }
    return out
  }, [employees])

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
      {/* Top row: search + view mode toggle + reset */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
        {/* Search — only relevant for card/table/dept views, hidden in timesheet mode */}
        {viewMode !== 'timesheet' && (
          <div className="relative flex-1 space-y-1.5">
            <div className="flex gap-2">
            <div className="relative flex-1">
              <HeroIcons.MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitSearch() } }}
                placeholder={HR_COPY.searchPlaceholder}
                aria-label={HR_COPY.searchPlaceholder}
                autoComplete="off"
                className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label={HR_COPY.searchClearLabel}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 ${anim('transition')}`}
                >
                  <HeroIcons.XMarkIcon className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={commitSearch}
              disabled={searching}
              className={`inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-wait text-white text-sm font-medium rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${anim('transition')}`}
            >
              {searching
                ? <Spinner className="w-4 h-4" />
                : <HeroIcons.MagnifyingGlassIcon className="w-4 h-4" />}
              <span className="hidden sm:inline">{HR_COPY.searchButtonLabel}</span>
            </button>
            </div>
            <div className="hidden flex-wrap gap-1.5 px-1 text-[10px] font-medium text-slate-500 sm:flex">
              {['Employee ID', 'Name', 'Email', 'Department', 'Manager', 'Location', 'Role'].map(field => (
                <span key={field} className="rounded-full bg-slate-100 px-2 py-0.5">{field}</span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          {viewMode !== 'timesheet' && (
          <button
            type="button"
            onClick={() => setFiltersOpen(o => !o)}
            className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border ${anim('transition')} ${
              filtersOpen || activeFilterCount > 0
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
            aria-expanded={filtersOpen}
            aria-controls="hr-filters-panel"
          >
            <HeroIcons.AdjustmentsHorizontalIcon className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-blue-600 text-white">
                {activeFilterCount}
              </span>
            )}
            <HeroIcons.ChevronDownIcon className={`w-3 h-3 ${anim('transition-transform')} ${filtersOpen ? 'rotate-180' : ''}`} />
          </button>
          )}
          <div className="inline-flex bg-slate-100 rounded-lg p-1">
            {HR_VIEW_MODES.map(vm => (
              <button
                key={vm.id}
                type="button"
                onClick={() => setViewMode(vm.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md ${anim('transition')} ${
                  viewMode === vm.id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
                aria-pressed={viewMode === vm.id}
              >
                <Icon name={vm.icon} className="w-4 h-4" />
                {vm.label}
              </button>
            ))}
          </div>
          {viewMode !== 'timesheet' && (activeFilterCount > 0 || searchTerm) && (
            <button
              type="button"
              onClick={onReset}
              className={`px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md ${anim('transition')}`}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Filter selects — collapsible; hidden entirely in timesheet mode */}
      {filtersOpen && viewMode !== 'timesheet' && (
        <div id="hr-filters-panel" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 pt-1 border-t border-slate-100">
          {HR_FILTERS.map(f => {
            const opts = f.optionsFrom === 'static' ? f.options : (dynamicOptions[f.id] || [{ value: 'all', label: f.placeholder || 'All' }])
            return (
              <div key={f.id}>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  {f.label}
                </label>
                <select
                  value={filterValues[f.id] || 'all'}
                  onChange={(e) => setFilterValue(f.id, e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {opts.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: Avatar
// ─────────────────────────────────────────────────────────────────────────────
const Avatar = ({ emp, size = 'md' }) => {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-12 h-12 text-sm', lg: 'w-20 h-20 text-2xl' }
  const cls = sizes[size] || sizes.md
  if (emp.profile_photo) {
    return (
      <img
        src={emp.profile_photo}
        alt={fullName(emp)}
        className={`${cls} rounded-full object-cover ring-2 ring-white shadow`}
        onError={(e) => { e.currentTarget.style.display = 'none' }}
      />
    )
  }
  return (
    <div className={`${cls} rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center ring-2 ring-white shadow`}>
      {initials(emp)}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: Status Badge & Discipline Tag
// ─────────────────────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const meta = getStatusMeta(status)
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${meta.tone}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  )
}

const DisciplineTag = ({ emp }) => {
  const d = matchDiscipline(emp.engineer_profile?.discipline || emp.department)
  if (!d) return null
  return <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${d.tone}`}>{d.label}</span>
}

const EMPLOYEE_QUICK_ACTIONS = [
  { id: 'view', label: 'View', icon: 'EyeIcon' },
  { id: 'edit', label: 'Edit', icon: 'PencilSquareIcon' },
  { id: 'documents', label: 'Documents', icon: 'DocumentTextIcon' },
  { id: 'leave', label: 'Leave', icon: 'CalendarDaysIcon' },
  { id: 'performance', label: 'Performance', icon: 'ChartBarIcon' },
  { id: 'payroll', label: 'Payroll', icon: 'BanknotesIcon' },
  { id: 'role_access', label: 'Role Access', icon: 'KeyIcon' },
  { id: 'deactivate', label: 'Deactivate', icon: 'NoSymbolIcon', danger: true },
]

const EmployeeQuickActions = ({ emp, onAction, compact = false }) => {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-700"
        aria-expanded={open}
        aria-label={`Quick actions for ${fullName(emp)}`}
      >
        <HeroIcons.BoltIcon className="h-4 w-4" />
        {!compact && <span>Quick actions</span>}
        <HeroIcons.ChevronDownIcon className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-1 grid w-52 grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white p-2 text-left shadow-xl">
          {EMPLOYEE_QUICK_ACTIONS.map(action => (
            <button
              key={action.id}
              type="button"
              onClick={() => { setOpen(false); onAction(emp, action.id) }}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold ${action.danger ? 'text-rose-700 hover:bg-rose-50' : 'text-slate-700 hover:bg-blue-50 hover:text-blue-700'}`}
            >
              <Icon name={action.icon} className="h-4 w-4" /> {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: Employee Card (Cards view)
// ─────────────────────────────────────────────────────────────────────────────
const EmployeeCard = ({ emp, onSelect, onAction }) => (
  <div className={`group bg-white rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-lg p-4 flex flex-col ${anim('transition')}`}>
    <button
      type="button"
      onClick={() => onSelect(emp)}
      className="text-left flex-1 flex flex-col"
    >
      <div className="flex items-start gap-3">
        <Avatar emp={emp} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="font-semibold text-slate-900 truncate">{fullName(emp)}</div>
            <StatusBadge status={emp.status} />
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            <DisciplineTag emp={emp} />
            {emp.is_mfa_enabled && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-700">
                <HeroIcons.ShieldCheckIcon className="w-3 h-3" /> MFA
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-1 text-xs">
        {HR_CARD_FIELDS.map(f => (
          <div key={f.id} className="flex items-center gap-2 text-slate-600 truncate">
            <Icon name={f.icon} className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="truncate">{f.accessor(emp)}</span>
          </div>
        ))}
      </div>
    </button>
    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
      <EmployeeQuickActions emp={emp} onAction={onAction} compact />
      <button
        type="button"
        onClick={() => onSelect(emp)}
        className="text-blue-600 hover:underline"
      >
        View details →
      </button>
    </div>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: Employees Table (Table view)
// ─────────────────────────────────────────────────────────────────────────────
const EmployeesTable = ({ employees, onSelect, onAction }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            {HR_TABLE_COLUMNS.map(c => (
              <th key={c.id} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {c.label}
              </th>
            ))}
            <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {employees.map(emp => (
            <tr key={emp.id} className="hover:bg-blue-50/50 cursor-pointer" onClick={() => onSelect(emp)}>
              {HR_TABLE_COLUMNS.map(c => {
                const v = c.accessor(emp)
                if (c.id === 'name') {
                  return (
                    <td key={c.id} className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Avatar emp={emp} size="sm" />
                        <div className="text-sm font-medium text-slate-900">{v}</div>
                      </div>
                    </td>
                  )
                }
                if (c.id === 'status') return <td key={c.id} className="px-3 py-2"><StatusBadge status={v} /></td>
                if (c.id === 'last_login') return <td key={c.id} className="px-3 py-2 text-xs text-slate-600">{formatDateTime(v)}</td>
                if (c.id === 'email') {
                  const mail = getEmail(emp)
                  return (
                    <td key={c.id} className="px-3 py-2 text-sm text-slate-700">
                      {mail
                        ? <a
                            href={`mailto:${mail}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-700 hover:text-blue-900 hover:underline truncate inline-block max-w-[14rem]"
                            title={mail}
                          >
                            {mail}
                          </a>
                        : <span className="text-slate-400">—</span>}
                    </td>
                  )
                }
                return <td key={c.id} className="px-3 py-2 text-sm text-slate-700">{v}</td>
              })}
              <td className="px-3 py-2 text-right">
                <EmployeeQuickActions emp={emp} onAction={onAction} compact />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)

const managerIdOf = (emp) => {
  const manager = emp.manager_detail?.id ?? emp.manager_id ?? (typeof emp.manager === 'object' ? emp.manager?.id : emp.manager)
  return manager ? String(manager) : null
}

const HierarchyNode = ({ node, depth, onSelect, onAction, visited }) => {
  if (visited.has(String(node.emp.id))) return null
  const nextVisited = new Set(visited)
  nextVisited.add(String(node.emp.id))
  return (
    <div className={depth ? 'ml-5 border-l border-slate-200 pl-4 sm:ml-8' : ''}>
      <div className="relative mb-2 flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        {depth > 0 && <span className="absolute -left-4 top-1/2 h-px w-4 bg-slate-200" />}
        <button type="button" onClick={() => onSelect(node.emp)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <Avatar emp={node.emp} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-slate-900">{fullName(node.emp)}</span>
            <span className="block truncate text-xs text-slate-500">{node.emp.job_title || 'Role not assigned'} · {node.emp.department || 'No department'}</span>
          </span>
        </button>
        <span className="hidden rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700 sm:inline">{node.children.length} direct</span>
        <EmployeeQuickActions emp={node.emp} onAction={onAction} compact />
      </div>
      {node.children.map(child => <HierarchyNode key={child.emp.id} node={child} depth={depth + 1} onSelect={onSelect} onAction={onAction} visited={nextVisited} />)}
    </div>
  )
}

const WorkforceHierarchy = ({ employees, onSelect, onAction }) => {
  const roots = useMemo(() => {
    const nodes = new Map(employees.map(emp => [String(emp.id), { emp, children: [] }]))
    const top = []
    nodes.forEach(node => {
      const managerNode = nodes.get(managerIdOf(node.emp))
      if (managerNode && managerNode !== node) managerNode.children.push(node)
      else top.push(node)
    })
    const sortNodes = (list) => list.sort((a, b) => fullName(a.emp).localeCompare(fullName(b.emp))).map(node => ({ ...node, children: sortNodes(node.children) }))
    return sortNodes(top)
  }, [employees])

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="flex items-center gap-2 font-bold text-slate-900"><HeroIcons.ShareIcon className="h-5 w-5 text-indigo-600" /> Workforce Hierarchy</h2><p className="mt-1 text-xs text-slate-500">Reporting lines based on each employee&apos;s assigned manager.</p></div>
        <span className="w-fit rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">{employees.length} people · {roots.length} top-level</span>
      </div>
      <div className="max-h-[70vh] space-y-4 overflow-auto p-4 sm:p-5">
        {roots.length ? roots.map(root => <HierarchyNode key={root.emp.id} node={root} depth={0} onSelect={onSelect} onAction={onAction} visited={new Set()} />) : <p className="py-10 text-center text-sm text-slate-500">No reporting relationships match the current filters.</p>}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ─── Derive action subsets once (not per-render) ────────────────────────────
const _TOOLBAR_ACTIONS    = HR_DEPT_ACTIONS.filter((a) => a.scope === 'toolbar')
const _DEPT_HDR_ACTIONS   = HR_DEPT_ACTIONS.filter((a) => a.scope === 'dept_header')
const _ROW_ACTIONS        = HR_DEPT_ACTIONS.filter((a) => a.scope === 'row')

// Shared action button renderer — variant drives the visual style.
const ActionBtn = ({ action, emp, dept, navigate }) => {
  const href   = action.getHref(emp, dept)
  const base   = 'inline-flex items-center gap-1.5 rounded-lg text-xs font-semibold px-2.5 py-1.5 transition-colors'
  const styles = {
    primary:   `${base} bg-blue-600 text-white hover:bg-blue-700`,
    secondary: `${base} bg-white border border-slate-200 text-slate-700 hover:border-blue-400 hover:text-blue-700`,
    ghost:     `${base} text-slate-500 hover:text-blue-700 hover:bg-blue-50`,
  }
  const cls = styles[action.variant] || styles.secondary
  return (
    <button
      type="button"
      title={action.tooltip || action.label}
      onClick={(e) => { e.stopPropagation(); navigate(href) }}
      className={cls}
    >
      <Icon name={action.icon} className="w-3.5 h-3.5" />
      {action.variant !== 'ghost' && <span>{action.label}</span>}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: Departments Breakdown view — rich tabular layout
// ─────────────────────────────────────────────────────────────────────────────

// Render a single cell value based on its column type.
const DeptCell = ({ col, emp, dept, onSelect, navigate }) => {
  const raw = col.accessor(emp)

  if (col.type === 'employee') {
    return (
      <button
        type="button"
        onClick={() => onSelect(emp)}
        className="flex items-center gap-2.5 text-left group"
      >
        <Avatar emp={emp} size="sm" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 truncate leading-tight">
            {fullName(emp)}
          </div>
          {emp.employee_id && (
            <div className="text-[10px] text-slate-400 font-mono">{emp.employee_id}</div>
          )}
        </div>
      </button>
    )
  }

  if (col.type === 'actions') {
    return (
      <div className="flex items-center gap-1">
        {_ROW_ACTIONS.map((action) => (
          <ActionBtn key={action.id} action={action} emp={emp} dept={dept} navigate={navigate} />
        ))}
      </div>
    )
  }

  if (col.type === 'status') {
    const meta = getStatusMeta(raw)
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${meta?.className || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
        {meta?.label || raw || '—'}
      </span>
    )
  }

  if (col.type === 'datetime') {
    return <span className="text-xs text-slate-500 whitespace-nowrap">{formatDateTime(raw)}</span>
  }

  if (col.type === 'email') {
    return raw && raw !== '—'
      ? <a href={`mailto:${raw}`} className="text-xs text-blue-600 hover:underline truncate block max-w-[180px]">{raw}</a>
      : <span className="text-xs text-slate-400">—</span>
  }

  return <span className="text-xs text-slate-700 whitespace-nowrap">{raw ?? '—'}</span>
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: Employee mini-card inside an expanded department
// Fields displayed are driven by HR_DEPT_CARD_CONFIG.employeeCardFields
// ─────────────────────────────────────────────────────────────────────────────
const DeptEmployeeCard = ({ emp, accent, onSelect, navigate }) => {
  const fields = HR_DEPT_CARD_CONFIG.employeeCardFields
  const email  = getEmail(emp)
  const status = getStatusMeta(emp.status)
  return (
    <div
      className={`group relative bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md ${accent.empCard}`}
    >
      {/* Coloured top bar */}
      <div className={`h-1 w-full bg-gradient-to-r ${accent.headerBg}`} />

      <div className="p-4">
        {/* Avatar + name */}
        <div className="flex items-start gap-3 mb-3">
          <button
            type="button"
            onClick={() => onSelect(emp)}
            className="flex-shrink-0 focus:outline-none"
            title="View profile"
          >
            <Avatar emp={emp} size="md" />
          </button>
          <div className="flex-1 min-w-0">
            <button
              type="button"
              onClick={() => onSelect(emp)}
              className="text-sm font-bold text-slate-900 group-hover:text-blue-700 truncate block w-full text-left leading-tight transition-colors"
            >
              {fullName(emp) || getEmail(emp) || '—'}
            </button>
            {fields.includes('designation') && emp.job_title && (
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">{emp.job_title}</p>
            )}
          </div>
          {/* Row-level actions (e.g. edit) */}
          <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {_ROW_ACTIONS.map((action) => (
              <ActionBtn key={action.id} action={action} emp={emp} dept={null} navigate={navigate} />
            ))}
          </div>
        </div>

        {/* Detail chips */}
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {fields.includes('status') && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium border ${status.tone}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
          )}
          {fields.includes('employee_id') && emp.employee_id && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono font-medium">
              <Icon name="IdentificationIcon" className="w-3 h-3" />
              {emp.employee_id}
            </span>
          )}
          {fields.includes('location') && emp.location && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
              <Icon name="MapPinIcon" className="w-3 h-3" />
              {emp.location}
            </span>
          )}
        </div>

        {/* Email link */}
        {fields.includes('email') && email && (
          <a
            href={`mailto:${email}`}
            className="mt-2 flex items-center gap-1.5 text-[11px] text-blue-600 hover:text-blue-800 hover:underline truncate transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <Icon name="EnvelopeIcon" className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{email}</span>
          </a>
        )}
      </div>
    </div>
  )
}

const DepartmentsView = ({ employees, onSelect, navigate }) => {
  const [expandedDepts, setExpandedDepts] = useState(new Set())
  const [deptSearch, setDeptSearch]       = useState('')
  const [sortKey, setSortKey]             = useState('name')   // 'name' | 'count'

  const grouped = useMemo(() => {
    const map = new Map()
    for (const e of employees) {
      const key = (e.department || 'Unassigned').trim() || 'Unassigned'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(e)
    }
    const entries = [...map.entries()]
    if (sortKey === 'count') entries.sort((a, b) => b[1].length - a[1].length)
    else entries.sort((a, b) => a[0].localeCompare(b[0]))
    return entries
  }, [employees, sortKey])

  const maxCount    = useMemo(() => grouped.reduce((m, [, l]) => Math.max(m, l.length), 1), [grouped])
  const allKeys     = useMemo(() => grouped.map(([k]) => k), [grouped])
  const allExpanded = expandedDepts.size === allKeys.length

  const toggle = (dept) =>
    setExpandedDepts((prev) => {
      const next = new Set(prev)
      next.has(dept) ? next.delete(dept) : next.add(dept)
      return next
    })

  const toggleAll = () =>
    setExpandedDepts(allExpanded ? new Set() : new Set(allKeys))

  const filterList = (list) => {
    if (!deptSearch.trim()) return list
    const q = deptSearch.toLowerCase()
    return list.filter(
      (e) =>
        fullName(e).toLowerCase().includes(q) ||
        (e.employee_id || '').toLowerCase().includes(q) ||
        (e.job_title   || '').toLowerCase().includes(q) ||
        (getEmail(e)   || '').toLowerCase().includes(q)
    )
  }

  if (grouped.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
        <Icon name="BuildingOffice2Icon" className="w-10 h-10" />
        <p className="text-sm">{HR_DEPT_COPY.emptyDept}</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Cross-dept search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Icon name="MagnifyingGlassIcon" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={deptSearch}
            onChange={(e) => setDeptSearch(e.target.value)}
            placeholder={HR_DEPT_COPY.searchPlaceholder}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {deptSearch && (
            <button
              type="button"
              onClick={() => setDeptSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <Icon name="XMarkIcon" className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort toggle */}
        <div className="flex items-center rounded-lg border border-slate-200 bg-white overflow-hidden text-xs">
          {[{ id: 'name', label: 'A–Z' }, { id: 'count', label: 'By size' }].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSortKey(opt.id)}
              className={`px-3 py-1.5 font-medium transition-colors ${sortKey === opt.id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Expand / Collapse all */}
        <button
          type="button"
          onClick={toggleAll}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
        >
          <Icon name={allExpanded ? 'ChevronUpIcon' : 'ChevronDownIcon'} className="w-3.5 h-3.5" />
          {allExpanded ? HR_DEPT_COPY.collapseAll : HR_DEPT_COPY.expandAll}
        </button>

        <span className="text-xs text-slate-500 ml-auto">
          {grouped.length} departments · {employees.length} {HR_DEPT_COPY.employees}
        </span>

        {_TOOLBAR_ACTIONS.map((action) => (
          <ActionBtn key={action.id} action={action} emp={null} dept={null} navigate={navigate} />
        ))}
      </div>

      {/* ── Department cards (new design) ── */}
      {grouped.map(([dept, list], idx) => {
        const accent         = HR_DEPT_ACCENT_PALETTE[idx % HR_DEPT_ACCENT_PALETTE.length]
        const isOpen         = expandedDepts.has(dept)
        const filtered       = filterList(list)
        const distinctTitles = new Set(list.map((e) => e.job_title).filter(Boolean)).size
        const activeCount    = list.filter((e) => e.status === 'active').length
        const pct            = Math.round((list.length / maxCount) * 100)
        const clusterMax     = HR_DEPT_CARD_CONFIG.avatarClusterMax

        return (
          <div
            key={dept}
            className="rounded-2xl overflow-hidden shadow-sm border border-white/10 transition-shadow duration-200 hover:shadow-md"
          >
            {/* ── Gradient header (click to expand/collapse) ── */}
            <button
              type="button"
              onClick={() => toggle(dept)}
              className={`w-full text-left bg-gradient-to-br ${accent.headerBg} px-6 py-5 focus:outline-none`}
            >
              <div className="flex items-center justify-between gap-4">
                {/* Left: name + stats */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <Icon name="BuildingOffice2Icon" className="w-5 h-5 text-white/70 flex-shrink-0" />
                    <h3 className="text-base font-bold text-white truncate">{dept}</h3>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm ${accent.pill}`}>
                      {list.length} {HR_DEPT_COPY.employees}
                    </span>
                  </div>

                  {/* Stats badges */}
                  {HR_DEPT_CARD_CONFIG.showStatsBadges && (
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="flex items-center gap-1.5 text-xs text-white/80">
                        <Icon name="BriefcaseIcon" className="w-3.5 h-3.5" />
                        {distinctTitles} {HR_DEPT_COPY.designations}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-white/80">
                        <Icon name="CheckCircleIcon" className="w-3.5 h-3.5" />
                        {activeCount} active
                      </span>
                      {list.length - activeCount > 0 && (
                        <span className="flex items-center gap-1.5 text-xs text-white/60">
                          <Icon name="ClockIcon" className="w-3.5 h-3.5" />
                          {list.length - activeCount} other
                        </span>
                      )}
                    </div>
                  )}

                  {/* Progress bar */}
                  {HR_DEPT_CARD_CONFIG.showProgressBar && (
                    <div className="mt-3 h-1.5 bg-white/20 rounded-full overflow-hidden max-w-xs">
                      <div
                        className="h-full bg-white/50 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Right: avatar cluster + chevron */}
                <div className="flex flex-col items-end gap-3 flex-shrink-0">
                  {/* Stacked avatar cluster */}
                  <div className="flex items-center -space-x-2.5">
                    {list.slice(0, clusterMax).map((e, i) => (
                      <div
                        key={e.id || i}
                        className="w-8 h-8 rounded-full ring-2 ring-white/60 flex-shrink-0 overflow-hidden shadow"
                        style={{ zIndex: clusterMax - i }}
                      >
                        {e.profile_photo
                          ? <img src={e.profile_photo} alt={fullName(e)} className="w-full h-full object-cover" />
                          : (
                            <div className="w-full h-full bg-white/25 flex items-center justify-center text-white font-bold text-[10px]">
                              {initials(e)}
                            </div>
                          )
                        }
                      </div>
                    ))}
                    {list.length > clusterMax && (
                      <div className="w-8 h-8 rounded-full ring-2 ring-white/60 bg-black/30 flex items-center justify-center text-white font-bold text-[10px] shadow">
                        +{list.length - clusterMax}
                      </div>
                    )}
                  </div>
                  {/* Chevron */}
                  <div className="flex items-center gap-1.5 text-white/70 text-xs font-medium">
                    <span>{isOpen ? 'Collapse' : 'Expand'}</span>
                    <Icon
                      name={isOpen ? 'ChevronUpIcon' : 'ChevronDownIcon'}
                      className="w-4 h-4"
                    />
                  </div>
                </div>
              </div>
            </button>

            {/* ── Expanded: action strip + employee card grid ── */}
            {isOpen && (
              <div className={`border-t-0 bg-white`}>
                {/* Action / sub-toolbar strip */}
                <div className={`flex items-center justify-between gap-3 px-5 py-2.5 border-b ${accent.statBg}`}>
                  <span className="text-xs text-slate-500 font-medium">
                    {filtered.length} of {list.length} {HR_DEPT_COPY.employees}
                    {deptSearch && ` matching "${deptSearch}"`}
                  </span>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {_DEPT_HDR_ACTIONS.map((action) => (
                      <ActionBtn key={action.id} action={action} emp={null} dept={dept} navigate={navigate} />
                    ))}
                  </div>
                </div>

                {/* Employee card grid */}
                <div className="p-5">
                  {filtered.length === 0 ? (
                    <div className="py-10 text-center text-sm text-slate-400 flex flex-col items-center gap-2">
                      <Icon name="MagnifyingGlassIcon" className="w-8 h-8 text-slate-300" />
                      {deptSearch ? `No match for "${deptSearch}"` : HR_DEPT_COPY.noEmployees}
                    </div>
                  ) : (
                    <div className={`grid ${HR_DEPT_CARD_CONFIG.employeeGridCols} gap-3`}>
                      {filtered.map((emp, ri) => (
                        <DeptEmployeeCard
                          key={emp.id || ri}
                          emp={emp}
                          accent={accent}
                          onSelect={onSelect}
                          navigate={navigate}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: Detail Drawer
// ─────────────────────────────────────────────────────────────────────────────
const Field = ({ label, value, mono = false }) => (
  <div>
    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
    <div className={`text-sm text-slate-900 ${mono ? 'font-mono' : ''}`}>{value || '—'}</div>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// Editable Field Component — Soft-Coded Edit Mode
// Renders read-only (Field) or editable input based on `isEditing` prop
// ─────────────────────────────────────────────────────────────────────────────
const EditableField = ({ field, value, isEditing, onChange, options = null, error = null }) => {
  const { id, label, type, placeholder, helpText, rows, maxLength, min, max, step, readOnly, icon } = field

  // Read-only mode OR field marked as readOnly
  if (!isEditing || readOnly) {
    let displayValue = value
    if (type === 'select' && options) {
      const opt = options.find(o => o.value === value)
      displayValue = opt?.label || value
    }
    if (type === 'multiselect' && Array.isArray(value) && options) {
      displayValue = value.map(v => options.find(o => o.value === v)?.label || v).join(', ')
    }
    if (type === 'currency') {
      const numValue = parseFloat(value) || 0
      displayValue = `${HR_SALARY_CONFIG.currencySymbol} ${numValue.toLocaleString(undefined, {
        minimumFractionDigits: HR_SALARY_CONFIG.decimalPlaces,
        maximumFractionDigits: HR_SALARY_CONFIG.decimalPlaces,
      })}`
    }
    
    // Render with icon if provided
    if (icon && type === 'currency') {
      const IconComponent = HeroIcons[icon] || HeroIcons.BanknotesIcon
      return (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
          <div className="flex items-center gap-2 mt-1">
            <IconComponent className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div className="text-base font-semibold text-slate-900">{displayValue || '—'}</div>
          </div>
        </div>
      )
    }
    
    return <Field label={label} value={displayValue} mono={type === 'tel' || type === 'email'} />
  }

  // Edit mode
  const baseInputClasses = `w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
    error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-slate-300'
  }`

  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
        {label} {field.required && <span className="text-red-500">*</span>}
      </label>
      
      {/* Currency input */}
      {type === 'currency' && (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">
            {HR_SALARY_CONFIG.currencySymbol}
          </span>
          <input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(id, e.target.value)}
            placeholder={placeholder}
            className={`${baseInputClasses} pl-14 font-mono`}
            min={min}
            max={max}
            step={step || 0.01}
          />
        </div>
      )}

      {/* Text, Email, Tel, Number */}
      {['text', 'email', 'tel', 'number'].includes(type) && (
        <input
          type={type}
          value={value || ''}
          onChange={(e) => onChange(id, e.target.value)}
          placeholder={placeholder}
          className={baseInputClasses}
          min={min}
          max={max}
          step={step}
          maxLength={maxLength}
        />
      )}

      {/* Date */}
      {type === 'date' && (
        <input
          type="date"
          value={value || ''}
          onChange={(e) => onChange(id, e.target.value)}
          className={baseInputClasses}
        />
      )}

      {/* Textarea */}
      {type === 'textarea' && (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(id, e.target.value)}
          placeholder={placeholder}
          rows={rows || 3}
          maxLength={maxLength}
          className={baseInputClasses}
        />
      )}

      {/* Select */}
      {type === 'select' && options && (
        <select
          value={value || ''}
          onChange={(e) => onChange(id, e.target.value)}
          className={baseInputClasses}
        >
          <option value="">-- Select {label} --</option>
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}

      {/* Multi-select (checkboxes) */}
      {type === 'multiselect' && options && (
        <div className="border border-slate-300 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
          {options.map(opt => {
            const isChecked = Array.isArray(value) && value.includes(opt.value)
            return (
              <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 p-1 rounded">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => {
                    const newValue = Array.isArray(value) ? [...value] : []
                    if (e.target.checked) {
                      newValue.push(opt.value)
                    } else {
                      const idx = newValue.indexOf(opt.value)
                      if (idx > -1) newValue.splice(idx, 1)
                    }
                    onChange(id, newValue)
                  }}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <span className="flex-1">{opt.label}</span>
              </label>
            )
          })}
        </div>
      )}

      {helpText && <div className="mt-1 text-[11px] text-slate-500">{helpText}</div>}
      {error && <div className="mt-1 text-[11px] text-red-600">{error}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-user timesheet panel — rendered as a tab inside the drawer.
// Reuses the existing `/api/v1/timesheet/user/` endpoint (no core change).
// ─────────────────────────────────────────────────────────────────────────────
const HR_KPI_TONES = {
  blue:    'bg-blue-50 text-blue-700 border-blue-100',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  violet:  'bg-violet-50 text-violet-700 border-violet-100',
  amber:   'bg-amber-50 text-amber-700 border-amber-100',
  sky:     'bg-sky-50 text-sky-700 border-sky-100',
  rose:    'bg-rose-50 text-rose-700 border-rose-100',
}

const _toISO = (d) => d.toISOString().slice(0, 10)
const _rangeToDates = (rangeId) => {
  const today = new Date()
  const cfg = HR_TIMESHEET_RANGES.find(r => r.id === rangeId) || HR_TIMESHEET_RANGES[0]
  if (cfg.preset === 'mtd') {
    return { from: _toISO(new Date(today.getFullYear(), today.getMonth(), 1)), to: _toISO(today) }
  }
  if (cfg.preset === 'ytd') {
    return { from: _toISO(new Date(today.getFullYear(), 0, 1)), to: _toISO(today) }
  }
  const from = new Date(today)
  from.setDate(today.getDate() - (cfg.days - 1))
  return { from: _toISO(from), to: _toISO(today) }
}

const _formatMonth = (ym) => {
  if (!ym || ym.length < 7) return ym || '—'
  const [y, m] = ym.split('-')
  const date = new Date(Number(y), Number(m) - 1, 1)
  return date.toLocaleString(undefined, { month: 'short', year: 'numeric' })
}

// ─── Visual sub-components (pure CSS/SVG — no chart library) ────────────────
// Soft-coded via HR_TIMESHEET_VISUALS: change colours / target / ring size
// in the config and these renderers update without a code change.

const _bandFor = (hours) => {
  for (const b of HR_TIMESHEET_VISUALS.hourBands) {
    if (hours <= b.upTo) return b
  }
  return HR_TIMESHEET_VISUALS.hourBands[HR_TIMESHEET_VISUALS.hourBands.length - 1]
}

const UtilisationRing = ({ value, max, label, sublabel }) => {
  const size   = HR_TIMESHEET_VISUALS.ringSize
  const stroke = HR_TIMESHEET_VISUALS.ringStroke
  const r      = (size - stroke) / 2
  const c      = 2 * Math.PI * r
  const pct    = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  const dash   = c * pct
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.18)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="white" strokeWidth={stroke} strokeLinecap="round" fill="none"
          strokeDasharray={`${dash} ${c}`}
          style={ANIM ? { transition: 'stroke-dasharray 600ms ease' } : undefined}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <div className="text-3xl font-extrabold leading-none tabular-nums">{value.toFixed(0)}</div>
        <div className="text-[10px] uppercase tracking-wider opacity-80 mt-0.5">{label}</div>
        {sublabel && <div className="text-[10px] opacity-70 mt-0.5">{sublabel}</div>}
      </div>
    </div>
  )
}

const ActivityBars = ({ rows }) => {
  const target = HR_TIMESHEET_VISUALS.targetHoursPerDay || 8
  if (!rows || rows.length === 0) {
    return <div className="text-sm text-slate-500 italic px-1 py-4">{HR_TIMESHEET_COPY.emptyActivity}</div>
  }
  // Show the most recent N days first (latest at top of the list, but we
  // sort ascending so the visual reads left-to-right by date naturally).
  const sorted = [...rows].sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const maxHours = Math.max(target * 1.25, ...sorted.map(r => Number(r.hours_worked ?? r.hours ?? 0)))
  return (
    <div className="space-y-1.5">
      {sorted.map(r => {
        const h = Number(r.hours_worked ?? r.hours ?? 0)
        const pct = maxHours > 0 ? (h / maxHours) * 100 : 0
        const band = _bandFor(h)
        const d = new Date(r.date)
        const dayName = isNaN(d) ? '' : d.toLocaleDateString(undefined, { weekday: 'short' })
        return (
          <div key={r.date} className="grid grid-cols-[80px_1fr_60px] items-center gap-2 group">
            <div className="text-[11px] text-slate-500 font-mono">
              <span className="text-slate-700 font-semibold">{r.date}</span>
              <span className="ml-1 opacity-60">{dayName}</span>
            </div>
            <div className="relative h-5 bg-slate-100 rounded overflow-hidden">
              <div
                className={`h-full ${band.color} ${anim('transition-all duration-500 ease-out')}`}
                style={{ width: `${pct}%` }}
                title={`${h.toFixed(2)}h — ${band.label}`}
              />
              {/* Target marker */}
              <div
                className="absolute top-0 bottom-0 w-px bg-slate-400/60"
                style={{ left: `${Math.min(100, (target / maxHours) * 100)}%` }}
              />
            </div>
            <div className="text-[11px] font-semibold text-slate-700 tabular-nums text-right">
              {h > 0 ? `${h.toFixed(1)}h` : '—'}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const HourBandLegend = () => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
    {HR_TIMESHEET_VISUALS.hourBands.map(b => (
      <div key={b.label} className="inline-flex items-center gap-1">
        <span className={`inline-block w-2.5 h-2.5 rounded ${b.color}`} />
        <span>{b.label}</span>
      </div>
    ))}
  </div>
)

const EmployeeTimesheetPanel = ({ emp }) => {
  const [rangeId, setRangeId] = useState(HR_TIMESHEET_DEFAULT_RANGE)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showPunches, setShowPunches] = useState(false)

  // Hand the backend every identifier we know about. It will OR-match on
  // biometric `employee_code` and `email`, and resolve any missing piece from
  // the RAD AI UserProfile via `user_id` — so even users whose RAD AI
  // `employee_id` doesn't equal their Matrix code still get their report.
  const lookup = useMemo(() => ({
    user_id:       emp?.id || emp?.user?.id || '',
    employee_code: emp?.employee_id || emp?.employee_code || '',
    email:         getEmail(emp),
  }), [emp])

  useEffect(() => {
    if (!emp) return
    if (!lookup.user_id && !lookup.employee_code && !lookup.email) {
      setData(null); setError(null); return
    }
    let cancelled = false
    const { from, to } = _rangeToDates(rangeId)
    setLoading(true); setError(null)
    fetchUserHistory({
      user_id:         lookup.user_id       || undefined,
      employee_code:   lookup.employee_code || undefined,
      email:           lookup.email         || undefined,
      from, to,
      include_punches: showPunches ? 'true' : undefined,
    })
      .then(res => { if (!cancelled) setData(res) })
      .catch(err => { if (!cancelled) setError(err?.response?.data?.error || err?.message || 'error') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [emp?.id, rangeId, showPunches, lookup.user_id, lookup.employee_code, lookup.email])

  const summary  = data?.summary  || {}
  const monthly  = data?.monthly_breakdown || []
  const daily    = data?.rows || []
  const punches  = data?.punches || []
  const resolved = data?.resolved || {}
  const diag     = data?.diagnostic || null
  const noMatch  = !loading && !error && data && daily.length === 0 && (summary.range_days || 0) > 0

  const exportCsv = () => {
    if (!daily.length) return
    const header = HR_TIMESHEET_DAILY_COLUMNS.map(c => c.label).join(',')
    const lines  = daily.map(r => HR_TIMESHEET_DAILY_COLUMNS.map(c => String(c.accessor(r)).replace(/,/g, ' ')).join(','))
    const blob   = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url    = URL.createObjectURL(blob)
    const a      = document.createElement('a')
    a.href = url
    a.download = `timesheet_${lookup.employee_code || lookup.email}_${data?.from || ''}_${data?.to || ''}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!lookup.user_id && !lookup.employee_code && !lookup.email) {
    return <div className="text-sm text-slate-500 italic">{HR_TIMESHEET_COPY.noMatchState}</div>
  }

  // ─── Derived metrics for hero band ──────────────────────────────────────
  const totalHours    = Number(summary.hours_worked || 0)
  const daysPresent   = Number(summary.days_present || 0)
  const rangeDays     = Number(summary.range_days || 0)
  const avgPerDay     = daysPresent > 0 ? totalHours / daysPresent : 0
  const targetHours   = rangeDays * HR_TIMESHEET_VISUALS.targetHoursPerDay
  const utilisationPc = targetHours > 0 ? Math.round((totalHours / targetHours) * 100) : 0

  return (
    <div className="space-y-5">
      {/* ─── Hero band ──────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white shadow-lg">
        {/* Decorative blobs */}
        <div className="absolute -top-12 -right-10 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-16 -left-12 w-56 h-56 rounded-full bg-fuchsia-400/20 blur-3xl" />

        <div className="relative p-5 flex flex-col lg:flex-row lg:items-center gap-5">
          {/* Ring */}
          <div className="flex-shrink-0 flex items-center justify-center">
            <UtilisationRing
              value={totalHours}
              max={targetHours || totalHours || 1}
              label="hours"
              sublabel={targetHours ? `${utilisationPc}% of target` : ''}
            />
          </div>

          {/* Stats row */}
          <div className="flex-1 grid grid-cols-3 gap-3 min-w-0">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/15">
              <div className="text-[10px] uppercase tracking-wider opacity-80">Total Hours</div>
              <div className="mt-1 text-3xl font-extrabold tabular-nums leading-none">{totalHours.toFixed(1)}</div>
              <div className="mt-1 text-[11px] opacity-75">across {rangeDays} day{rangeDays === 1 ? '' : 's'}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/15">
              <div className="text-[10px] uppercase tracking-wider opacity-80">Days Present</div>
              <div className="mt-1 text-3xl font-extrabold tabular-nums leading-none">{daysPresent}</div>
              <div className="mt-1 text-[11px] opacity-75">
                {rangeDays > 0 ? `${Math.round((daysPresent / rangeDays) * 100)}% attendance` : ''}
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/15">
              <div className="text-[10px] uppercase tracking-wider opacity-80">Avg per Day</div>
              <div className="mt-1 text-3xl font-extrabold tabular-nums leading-none">{avgPerDay.toFixed(2)}</div>
              <div className="mt-1 text-[11px] opacity-75">target {HR_TIMESHEET_VISUALS.targetHoursPerDay}h</div>
            </div>
          </div>
        </div>

        {/* Controls strip */}
        <div className="relative px-5 pb-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full pl-3 pr-1 py-1 border border-white/20">
            <span className="text-[10px] uppercase tracking-wider opacity-90 font-semibold">
              {HR_TIMESHEET_COPY.rangeLabel}
            </span>
            <select
              value={rangeId}
              onChange={(e) => setRangeId(e.target.value)}
              className="text-xs font-semibold bg-white/95 text-slate-800 rounded-full px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-white"
            >
              {HR_TIMESHEET_RANGES.map(r => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPunches(v => !v)}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 backdrop-blur-sm ${anim('transition')}`}
            >
              {showPunches ? HR_TIMESHEET_COPY.hidePunches : HR_TIMESHEET_COPY.showPunches}
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!daily.length}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-full bg-white text-indigo-700 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 shadow-sm ${anim('transition')}`}
            >
              <HeroIcons.ArrowDownTrayIcon className="w-3.5 h-3.5" />
              {HR_TIMESHEET_COPY.exportCsv}
            </button>
          </div>
        </div>
      </div>

      {/* Loading / error / empty states */}
      {loading && (
        <div className="text-sm text-slate-500 flex items-center gap-2 px-1">
          <Spinner className="w-4 h-4" />
          {HR_TIMESHEET_COPY.loadingState}
        </div>
      )}
      {error && !loading && (
        <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">
          {HR_TIMESHEET_COPY.errorState} <span className="opacity-70">({String(error)})</span>
        </div>
      )}
      {noMatch && !loading && !error && (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          <div>{HR_TIMESHEET_COPY.noMatchState}</div>
          {(resolved.employee_code || resolved.email) && (
            <div className="mt-1 text-[11px] text-amber-600 font-mono">
              Tried: {resolved.employee_code ? `code=${resolved.employee_code}` : ''}
              {resolved.employee_code && resolved.email ? '  ·  ' : ''}
              {resolved.email ? `email=${resolved.email}` : ''}
            </div>
          )}
          {diag && (
            <details className="mt-2 text-[11px]">
              <summary className="cursor-pointer text-amber-700 hover:text-amber-900 font-medium">
                Diagnostic details (for IT)
              </summary>
              <div className="mt-1.5 font-mono text-amber-800 space-y-0.5">
                <div>Input email: <span className="text-amber-900">{diag.input_email || '—'}</span></div>
                <div>Input code:  <span className="text-amber-900">{diag.input_code  || '—'}</span></div>
                <div>RAD profile matched: <span className="text-amber-900">{diag.profile_matched ? 'yes' : 'no'}</span></div>
                <div>Master rows by email: <span className="text-amber-900">{(diag.master_email_hits || []).length}</span></div>
                <div>Master rows by code:  <span className="text-amber-900">{(diag.master_code_hits  || []).length}</span></div>
                <div>Master rows by name:  <span className="text-amber-900">
                  {(diag.master_name_hits || []).length}
                  {diag.master_name_strategy ? ` (${diag.master_name_strategy})` : ''}
                </span></div>
                <div>Name-resolver used:   <span className="text-amber-900">{diag.name_resolver_used ? 'yes' : 'no'}</span></div>
                <div>Resolved aliases (emails): <span className="text-amber-900">{(diag.final_emails || []).join(', ') || '—'}</span></div>
                <div>Resolved aliases (codes):  <span className="text-amber-900">{(diag.final_codes  || []).join(', ') || '—'}</span></div>
                <div>Matched events in range:   <span className="text-amber-900">{diag.matched_events_in_range ?? '—'}</span></div>
                <div>Matched events all time:   <span className="text-amber-900">{diag.matched_events_all_time ?? '—'}</span></div>
                {(diag.master_email_hits || []).length === 0
                  && (diag.master_code_hits || []).length === 0
                  && (diag.master_name_hits || []).length === 0 && (
                  <div className="mt-1 text-rose-700">
                    Likely cause: BiometricUserMaster has no row matching this user&apos;s email, code, or name.
                    Run the office-side <span className="font-bold">timesheet_mirror_sync.py --users</span> backfill once
                    so OfficeEmail / FullName / Card1 columns are populated for every user.
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      )}

      {/* ─── KPI tiles (wider grid when drawer is large) ───────────────── */}
      {!loading && !error && data && daily.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
          {HR_TIMESHEET_KPIS.map(k => (
            <div
              key={k.id}
              className={`relative overflow-hidden rounded-xl border p-3 flex items-start gap-2.5 ${anim('hover:-translate-y-0.5 transition-transform')} ${HR_KPI_TONES[k.tone] || HR_KPI_TONES.blue}`}
            >
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-white/60 flex items-center justify-center">
                <Icon name={k.icon} className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80 truncate">{k.label}</div>
                <div className="text-xl font-extrabold leading-tight tabular-nums truncate">{k.accessor(summary)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Two-column body on wide drawers ────────────────────────────── */}
      {!loading && daily.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">

          {/* LEFT: Daily activity table + monthly breakdown table (plain text) */}
          <div className="xl:col-span-3 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="px-4 pt-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {HR_TIMESHEET_COPY.activityTitle}
              </div>
              <div className="max-h-80 overflow-y-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      {HR_TIMESHEET_ACTIVITY_COLUMNS.map(c => (
                        <th key={c.id} className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-slate-500">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...daily]
                      .map(r => {
                        // Attach the band label so the soft-coded accessor
                        // can render a plain-text status without re-running
                        // the band lookup in the component.
                        const h = Number(r.hours_worked ?? r.hours ?? 0)
                        return { ...r, __bandLabel: _bandFor(h)?.label || '' }
                      })
                      .sort((a, b) => {
                        const av = String(a.date || '')
                        const bv = String(b.date || '')
                        return HR_TIMESHEET_ACTIVITY_SORT === 'asc'
                          ? av.localeCompare(bv)
                          : bv.localeCompare(av)
                      })
                      .map(r => (
                        <tr key={r.date}>
                          {HR_TIMESHEET_ACTIVITY_COLUMNS.map(c => (
                            <td
                              key={c.id}
                              className={`px-3 py-1.5 text-slate-700 whitespace-nowrap ${c.mono ? 'font-mono' : ''}`}
                            >
                              {c.accessor(r)}
                            </td>
                          ))}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {monthly.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white">
                <div className="px-4 pt-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {HR_TIMESHEET_COPY.monthlyTitle}
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        {HR_TIMESHEET_MONTHLY_COLUMNS.map(c => (
                          <th key={c.id} className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-slate-500">
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {monthly.map(m => {
                        // Attach the human-readable month label so the
                        // accessor stays purely declarative.
                        const row = { ...m, __monthLabel: _formatMonth(m.month) }
                        return (
                          <tr key={m.month}>
                            {HR_TIMESHEET_MONTHLY_COLUMNS.map(c => (
                              <td
                                key={c.id}
                                className={`px-3 py-1.5 text-slate-700 whitespace-nowrap ${c.mono ? 'font-mono' : ''}`}
                              >
                                {c.accessor(row)}
                              </td>
                            ))}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Daily table */}
          <div className="xl:col-span-2">
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="px-4 pt-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {HR_TIMESHEET_COPY.dailyTitle}
              </div>
              <div className="max-h-[28rem] overflow-y-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      {HR_TIMESHEET_DAILY_COLUMNS.map(c => (
                        <th key={c.id} className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-slate-500">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {daily.map(r => (
                      <tr key={r.date} className="hover:bg-blue-50/40">
                        {HR_TIMESHEET_DAILY_COLUMNS.map(c => (
                          <td key={c.id} className="px-3 py-1.5 text-slate-700 whitespace-nowrap">
                            {c.accessor(r)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Hourly raw punches — plain text records (no chips/colours) ── */}
      {!loading && showPunches && punches.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="px-4 pt-3 pb-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {HR_TIMESHEET_COPY.punchesTitle}
            </div>
            {HR_TIMESHEET_COPY.punchesSubtitle && (
              <div className="text-[11px] text-slate-400 mt-0.5">
                {HR_TIMESHEET_COPY.punchesSubtitle} · {punches.length} record{punches.length === 1 ? '' : 's'}
              </div>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  {HR_TIMESHEET_PUNCH_COLUMNS.map(c => (
                    <th key={c.id} className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-slate-500">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...punches]
                  .sort((a, b) => {
                    const av = String(a.event_time || a.date || '')
                    const bv = String(b.event_time || b.date || '')
                    return HR_TIMESHEET_PUNCH_SORT === 'asc'
                      ? av.localeCompare(bv)
                      : bv.localeCompare(av)
                  })
                  .map((p, i) => (
                    <tr key={`${p.event_time}-${i}`}>
                      {HR_TIMESHEET_PUNCH_COLUMNS.map(c => (
                        <td
                          key={c.id}
                          className={`px-3 py-1.5 text-slate-700 whitespace-nowrap ${c.mono ? 'font-mono' : ''}`}
                        >
                          {c.accessor(p)}
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Compensation Panel Component — Salary & Payroll Management
// ─────────────────────────────────────────────────────────────────────────────
const CompensationPanel = ({ emp, isEditing, formData, formErrors, handleFieldChange, canEditSalary, onPayrollLoad }) => {
  const [payrollProfile, setPayrollProfile] = useState(null)
  const [loadingPayroll, setLoadingPayroll] = useState(false)
  const [creatingPayroll, setCreatingPayroll] = useState(false)

  // Load payroll profile when panel opens
  useEffect(() => {
    if (!emp?.employee_id) return
    let cancelled = false
    setLoadingPayroll(true)
    
    // Try to find payroll employee by employee_no
    payrollEngineService.listEmployees({ search: emp.employee_id })
      .then((data) => {
        if (cancelled) return
        const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : []
        const profile = results.find(p => p.employee_no === emp.employee_id)
        setPayrollProfile(profile || null)
        
        // Notify parent with payroll data for form initialization
        if (profile && onPayrollLoad) {
          onPayrollLoad(profile)
        }
      })
      .catch((err) => {
        console.error('[HR] Failed to load payroll profile:', err)
      })
      .finally(() => { if (!cancelled) setLoadingPayroll(false) })
    
    return () => { cancelled = true }
  }, [emp?.employee_id, onPayrollLoad])

  // Calculate total package
  const totalPackage = useMemo(() => {
    if (isEditing && formData) {
      const basic = parseFloat(formData['payroll.basic']) || 0
      const housing = parseFloat(formData['payroll.housing']) || 0
      const transport = parseFloat(formData['payroll.transport']) || 0
      const homeLeave = parseFloat(formData['payroll.home_leave']) || 0
      return basic + housing + transport + homeLeave
    }
    if (payrollProfile) {
      return parseFloat(payrollProfile.default_gross || 0)
    }
    return 0
  }, [isEditing, formData, payrollProfile])

  // Calculate salary increase percentage if editing
  const salaryIncreasePct = useMemo(() => {
    if (!isEditing || !payrollProfile) return 0
    const oldBasic = parseFloat(payrollProfile.basic) || 0
    const newBasic = parseFloat(formData['payroll.basic']) || 0
    if (oldBasic === 0) return 0
    return ((newBasic - oldBasic) / oldBasic) * 100
  }, [isEditing, formData, payrollProfile])

  // Handle create payroll profile
  const handleCreatePayrollProfile = async () => {
    setCreatingPayroll(true)
    try {
      const payload = {
        employee_no: emp.employee_id,
        user: emp.id,
        full_name: fullName(emp),
        department: emp.department || '',
        designation: emp.job_title || '',
        basic: 0,
        housing: 0,
        transport: 0,
        home_leave: 0,
        is_active: true,
      }
      const created = await payrollEngineService.createEmployee(payload)
      setPayrollProfile(created)
    } catch (err) {
      console.error('[HR] Failed to create payroll profile:', err)
      alert('Failed to create payroll profile. Please try again.')
    } finally {
      setCreatingPayroll(false)
    }
  }

  if (loadingPayroll) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="w-6 h-6 text-blue-600" />
        <span className="ml-2 text-sm text-slate-600">Loading salary information...</span>
      </div>
    )
  }

  if (!payrollProfile && !isEditing) {
    return (
      <div className="space-y-4">
        <div className="text-center py-12">
          <HeroIcons.ExclamationTriangleIcon className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <p className="text-sm text-slate-600 mb-4">{HR_EDIT_COPY.noPayrollProfile}</p>
          {canEditSalary && (
            <button
              type="button"
              onClick={handleCreatePayrollProfile}
              disabled={creatingPayroll}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium inline-flex items-center gap-2"
            >
              {creatingPayroll ? (
                <>
                  <Spinner className="w-4 h-4" />
                  Creating...
                </>
              ) : (
                <>
                  <HeroIcons.PlusIcon className="w-4 h-4" />
                  {HR_EDIT_COPY.createPayrollProfile}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Total Package Summary */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Total Monthly Package</div>
            <div className="text-3xl font-bold text-emerald-900 mt-1 tabular-nums">
              {HR_SALARY_CONFIG.currencySymbol} {totalPackage.toLocaleString(undefined, {
                minimumFractionDigits: HR_SALARY_CONFIG.decimalPlaces,
                maximumFractionDigits: HR_SALARY_CONFIG.decimalPlaces,
              })}
            </div>
          </div>
          <HeroIcons.BanknotesIcon className="w-12 h-12 text-emerald-600 opacity-50" />
        </div>
        
        {isEditing && salaryIncreasePct !== 0 && (
          <div className={`mt-3 pt-3 border-t border-emerald-200 flex items-center gap-2 text-sm ${
            salaryIncreasePct > 0 ? 'text-emerald-700' : 'text-red-700'
          }`}>
            {salaryIncreasePct > 0 ? (
              <HeroIcons.ArrowTrendingUpIcon className="w-4 h-4" />
            ) : (
              <HeroIcons.ArrowTrendingDownIcon className="w-4 h-4" />
            )}
            <span className="font-semibold">
              {salaryIncreasePct > 0 ? '+' : ''}{salaryIncreasePct.toFixed(1)}% change
            </span>
            {salaryIncreasePct > HR_SALARY_CONFIG.maxIncrementPercent && (
              <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                Exceeds limit ({HR_SALARY_CONFIG.maxIncrementPercent}%)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Salary Components */}
      <div className="grid grid-cols-2 gap-4">
        {(HR_EDITABLE_FIELDS.compensation || []).map(field => {
          // Skip notes field from grid, show it separately below
          if (field.id === 'payroll.notes') return null
          
          const fieldValue = isEditing 
            ? formData[field.id]
            : (field.id === 'payroll.basic' ? payrollProfile?.basic :
               field.id === 'payroll.housing' ? payrollProfile?.housing :
               field.id === 'payroll.transport' ? payrollProfile?.transport :
               field.id === 'payroll.home_leave' ? payrollProfile?.home_leave :
               field.id === 'payroll.designation' ? payrollProfile?.designation :
               field.id === 'payroll.grade' ? payrollProfile?.grade :
               field.id === 'payroll.joining_date' ? payrollProfile?.joining_date :
               '')
          
          return (
            <div key={field.id} className={field.type === 'currency' ? '' : 'col-span-2'}>
              <EditableField
                field={field}
                value={fieldValue}
                isEditing={isEditing && canEditSalary}
                onChange={handleFieldChange}
                error={formErrors[field.id]}
              />
            </div>
          )
        })}
      </div>

      {/* Notes (full width) */}
      <div>
        <EditableField
          field={HR_EDITABLE_FIELDS.compensation.find(f => f.id === 'payroll.notes') || {}}
          value={isEditing ? formData['payroll.notes'] : payrollProfile?.notes}
          isEditing={isEditing && canEditSalary}
          onChange={handleFieldChange}
          error={formErrors['payroll.notes']}
        />
      </div>

      {/* Payroll Details (Read-only) */}
      {!isEditing && payrollProfile && (
        <div className="pt-4 border-t border-slate-200">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Payroll Details</div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Employee No" value={payrollProfile.employee_no} mono />
            <Field label="Payment Mode" value={payrollProfile.default_payment_mode} />
            <Field label="Active Status" value={payrollProfile.is_active ? 'Active' : 'Inactive'} />
            <Field label="IBAN" value={payrollProfile.iban || '—'} mono />
            <Field label="Bank" value={payrollProfile.bank_name || '—'} />
            <Field label="Grade" value={payrollProfile.grade || '—'} />
          </div>
        </div>
      )}

      {!canEditSalary && !isEditing && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-sm text-amber-800">
          <HeroIcons.LockClosedIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{HR_EDIT_COPY.salaryNoPermission}</span>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail Drawer Component — Enhanced with Edit Mode & Salary Management
// ─────────────────────────────────────────────────────────────────────────────
const DetailDrawer = ({ emp, loading, onClose, initialTab = null, startEditing = false, onUpdate }) => {
  const [tab, setTab] = useState(initialTab || HR_DEFAULT_DETAIL_TAB)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({})
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  
  // Fetch dynamic options (roles, organizations, managers)
  const [roles, setRoles] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [managers, setManagers] = useState([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  
  // Current logged-in user for permission checks
  const [currentUser, setCurrentUser] = useState(null)
  const [currentUserLoading, setCurrentUserLoading] = useState(false)

  useEffect(() => { setTab(initialTab || HR_DEFAULT_DETAIL_TAB) }, [emp?.id, initialTab])
  useEffect(() => { setIsEditing(Boolean(startEditing)) }, [emp?.id, startEditing])

  // Load current user for permission checks
  useEffect(() => {
    let cancelled = false
    setCurrentUserLoading(true)
    rbacService.getCurrentUser()
      .then((resp) => {
        if (cancelled) return
        const user = resp?.data || resp
        setCurrentUser(user)
      })
      .catch((err) => {
        console.error('[HR] Failed to load current user:', err)
      })
      .finally(() => { if (!cancelled) setCurrentUserLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Load dynamic options when drawer opens
  useEffect(() => {
    if (!emp?.id || !HR_EDIT_CONFIG.enableEditMode) return
    let cancelled = false
    setOptionsLoading(true)
    Promise.all([
      rbacService.getRoles().catch(() => ({ data: [] })),
      rbacService.getOrganizations().catch(() => ({ data: [] })),
      rbacService.getUsers({ page_size: 500 }).catch(() => ({ data: [] })),  // Fetch potential managers
    ])
      .then(([rolesResp, orgsResp, managersResp]) => {
        if (cancelled) return
        
        // Extract roles array - handle both direct array and paginated response
        let rolesArray = []
        if (Array.isArray(rolesResp)) {
          rolesArray = rolesResp
        } else if (Array.isArray(rolesResp?.data)) {
          rolesArray = rolesResp.data
        } else if (Array.isArray(rolesResp?.data?.results)) {
          rolesArray = rolesResp.data.results
        } else if (rolesResp?.data && typeof rolesResp.data === 'object') {
          rolesArray = []
        }
        
        // Extract organizations array - handle both direct array and paginated response
        let orgsArray = []
        if (Array.isArray(orgsResp)) {
          orgsArray = orgsResp
        } else if (Array.isArray(orgsResp?.data)) {
          orgsArray = orgsResp.data
        } else if (Array.isArray(orgsResp?.data?.results)) {
          orgsArray = orgsResp.data.results
        } else if (orgsResp?.data && typeof orgsResp.data === 'object') {
          orgsArray = []
        }
        
        // Extract managers array
        let managersArray = []
        if (Array.isArray(managersResp)) {
          managersArray = managersResp
        } else if (Array.isArray(managersResp?.data)) {
          managersArray = managersResp.data
        } else if (Array.isArray(managersResp?.data?.results)) {
          managersArray = managersResp.data.results
        }
        
        setRoles(rolesArray)
        setOrganizations(orgsArray)
        setManagers(managersArray)
      })
      .finally(() => { if (!cancelled) setOptionsLoading(false) })
    return () => { cancelled = true }
  }, [emp?.id])

  // Initialize form data from employee when entering edit mode
  useEffect(() => {
    if (!isEditing || !emp) return
    const ep = emp.engineer_profile || {}
    const user = emp.user || {}
    setFormData({
      // User fields
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      is_active: user.is_active !== undefined ? user.is_active : true,
      // Profile fields
      employee_id: emp.employee_id || '',
      phone: emp.phone || '',
      location: emp.location ?? '',
      bio: emp.bio || '',
      is_mfa_enabled: emp.is_mfa_enabled || false,
      organization: emp.organization?.id || '',
      department: emp.department || '',
      job_title: emp.job_title || '',
      status: emp.status || 'active',
      manager: emp.manager?.id || emp.manager || '',
      roles: (emp.roles || []).map(r => r.id),
      'engineer_profile.discipline': ep.discipline || '',
      'engineer_profile.certifications': ep.certifications || '',
      'engineer_profile.skills': ep.skills || '',
      'engineer_profile.experience_years': ep.experience_years || '',
      // Payroll fields — will be populated by CompensationPanel
      'payroll.basic': '',
      'payroll.housing': '',
      'payroll.transport': '',
      'payroll.home_leave': '',
      'payroll.designation': '',
      'payroll.grade': '',
      'payroll.joining_date': '',
      'payroll.notes': '',
    })
    setFormErrors({})
    setSaveError(null)
    setSaveSuccess(false)
  }, [isEditing, emp])

  // Handle form field changes
  const handleFieldChange = useCallback((fieldId, value) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }))
    // Clear error for this field
    setFormErrors(prev => {
      const next = { ...prev }
      delete next[fieldId]
      return next
    })
    setSaveSuccess(false)
  }, [])

  // Validate form before save
  const validateForm = useCallback(() => {
    const errors = {}
    const allFields = [
      ...HR_EDITABLE_FIELDS.overview || [],
      ...HR_EDITABLE_FIELDS.employment || [],
      ...HR_EDITABLE_FIELDS.competency || [],
    ]
    
    allFields.forEach(field => {
      const value = formData[field.id]
      
      // Required field validation
      if (field.required && (!value || (typeof value === 'string' && !value.trim()))) {
        errors[field.id] = HR_EDIT_VALIDATION.required(field.label)
      }
      
      // Email validation
      if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        errors[field.id] = HR_EDIT_VALIDATION.email
      }
      
      // Phone validation (basic)
      if (field.type === 'tel' && value && value.length > 0 && value.length < 7) {
        errors[field.id] = HR_EDIT_VALIDATION.phone
      }
      
      // Min/max length
      if (field.minLength && value && value.length < field.minLength) {
        errors[field.id] = HR_EDIT_VALIDATION.minLength(field.label, field.minLength)
      }
      if (field.maxLength && value && value.length > field.maxLength) {
        errors[field.id] = HR_EDIT_VALIDATION.maxLength(field.label, field.maxLength)
      }
    })
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }, [formData])

  // Check if user has edit permission
  const canEdit = useMemo(() => {
    if (!HR_EDIT_CONFIG.enableEditMode) return false
    if (!currentUser || currentUserLoading) return false
    
    // Check if current logged-in user has any of the allowed roles
    const userRoles = (currentUser.roles || []).map(r => r.name || r.display_name)
    const hasRole = HR_EDIT_CONFIG.allowedRoles.some(role => userRoles.includes(role))
    
    // Debug logging (remove in production)
    console.log('[HR Edit] Permission check:', {
      currentUser: currentUser.username || currentUser.email,
      userRoles,
      allowedRoles: HR_EDIT_CONFIG.allowedRoles,
      hasRole
    })
    
    return hasRole
  }, [currentUser, currentUserLoading])

  // Check if user has salary edit permission (stricter than general edit)
  const canEditSalary = useMemo(() => {
    if (!currentUser || currentUserLoading) return false
    
    // Check if current logged-in user has any of the salary edit roles
    const userRoles = (currentUser.roles || []).map(r => r.name || r.display_name)
    return HR_EDIT_CONFIG.salaryEditRoles.some(role => userRoles.includes(role))
  }, [currentUser, currentUserLoading])

  // Handle save
  const handleSave = useCallback(async () => {
    if (!validateForm()) {
      setSaveError('Please fix validation errors before saving')
      return
    }

    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      // Prepare update payload
      const ep = emp.engineer_profile || {}
      const payload = {
        // User model fields
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        is_active: formData.is_active,
        // Profile fields
        employee_id: formData.employee_id,
        phone: formData.phone,
        location: formData.location,
        bio: formData.bio,
        department: formData.department,
        job_title: formData.job_title,
        status: formData.status,
        manager_id: formData.manager || null,  // Use manager_id for backend
        engineer_profile: {
          ...ep,
          discipline: formData['engineer_profile.discipline'],
          certifications: formData['engineer_profile.certifications'],
          skills: formData['engineer_profile.skills'],
          experience_years: formData['engineer_profile.experience_years'],
        },
      }

      // Update user profile
      await rbacService.updateUser(emp.id, payload)

      // Handle role changes (add/remove roles)
      const currentRoleIds = (emp.roles || []).map(r => r.id)
      const newRoleIds = formData.roles?.length > 0 ? formData.roles : (emp.roles || []).map(r => r.id)
      
      const rolesToAdd = newRoleIds.filter(id => !currentRoleIds.includes(id))
      const rolesToRemove = currentRoleIds.filter(id => !newRoleIds.includes(id))

      // Add new roles
      for (const roleId of rolesToAdd) {
        await rbacService.assignRole(emp.id, roleId, rolesToAdd.indexOf(roleId) === 0)
      }

      // Remove roles
      for (const roleId of rolesToRemove) {
        await rbacService.revokeRole(emp.id, roleId)
      }

      // Handle payroll updates if salary fields changed and user has permission
      if (canEditSalary && (
        formData['payroll.basic'] || 
        formData['payroll.housing'] || 
        formData['payroll.transport'] || 
        formData['payroll.home_leave']
      )) {
        // Fetch current payroll profile to check for increases
        const payrollList = await payrollEngineService.listEmployees({ search: emp.employee_id })
        const payrollResults = Array.isArray(payrollList?.results) ? payrollList.results : Array.isArray(payrollList) ? payrollList : []
        const currentPayroll = payrollResults.find(p => p.employee_no === emp.employee_id)

        const newBasic = parseFloat(formData['payroll.basic']) || 0
        
        // Validate salary increase if updating existing payroll
        if (currentPayroll) {
          const oldBasic = parseFloat(currentPayroll.basic) || 0
          if (oldBasic > 0) {
            const increasePct = ((newBasic - oldBasic) / oldBasic) * 100
            if (increasePct > HR_SALARY_CONFIG.maxIncrementPercent) {
              throw new Error(`Salary increase (${increasePct.toFixed(1)}%) exceeds maximum allowed (${HR_SALARY_CONFIG.maxIncrementPercent}%)`)
            }
            if (increasePct > HR_SALARY_CONFIG.requireNoteAbovePercent && !formData['payroll.notes']) {
              throw new Error(`Salary increase above ${HR_SALARY_CONFIG.requireNoteAbovePercent}% requires a note explaining the reason`)
            }
          }

          // Update existing payroll
          const payrollPayload = {
            basic: formData['payroll.basic'] || currentPayroll.basic,
            housing: formData['payroll.housing'] || currentPayroll.housing,
            transport: formData['payroll.transport'] || currentPayroll.transport,
            home_leave: formData['payroll.home_leave'] || currentPayroll.home_leave,
            designation: formData['payroll.designation'] || currentPayroll.designation,
            grade: formData['payroll.grade'] || currentPayroll.grade,
            joining_date: formData['payroll.joining_date'] || currentPayroll.joining_date,
            notes: formData['payroll.notes'] || currentPayroll.notes,
          }
          await payrollEngineService.updateEmployee(currentPayroll.id, payrollPayload)
        }
      }

      setSaveSuccess(true)
      setIsEditing(false)

      // Callback to parent — pass the full formData so the parent can apply
      // an optimistic update to every edited field, not just a hardcoded
      // subset, before the fresh getUserById() fetch resolves.
      if (onUpdate) {
        onUpdate({ ...formData })
      }

      // Show success briefly then close
      setTimeout(() => {
        setSaveSuccess(false)
      }, 3000)

    } catch (err) {
      console.error('[HR] Failed to update employee:', err)
      setSaveError(err?.response?.data?.error || err?.response?.data?.detail || err?.message || HR_EDIT_COPY.errorMessage)
    } finally {
      setSaving(false)
    }
  }, [emp, formData, validateForm, canEditSalary, onUpdate])

  // Handle payroll profile loaded — populate form with payroll data
  const handlePayrollLoad = useCallback((payrollProfile) => {
    if (!isEditing || !payrollProfile) return
    setFormData(prev => ({
      ...prev,
      'payroll.basic': payrollProfile.basic || '',
      'payroll.housing': payrollProfile.housing || '',
      'payroll.transport': payrollProfile.transport || '',
      'payroll.home_leave': payrollProfile.home_leave || '',
      'payroll.designation': payrollProfile.designation || '',
      'payroll.grade': payrollProfile.grade || '',
      'payroll.joining_date': payrollProfile.joining_date || '',
      'payroll.notes': payrollProfile.notes || '',
    }))
  }, [isEditing])

  // Handle cancel
  const handleCancel = useCallback(() => {
    const hasChanges = JSON.stringify(formData) !== JSON.stringify({
      employee_id: emp.employee_id || '',
      phone: emp.phone || '',
      location: emp.location ?? '',
      bio: emp.bio || '',
      organization: emp.organization?.id || '',
      department: emp.department || '',
      job_title: emp.job_title || '',
      status: emp.status || 'active',
      roles: (emp.roles || []).map(r => r.id),
      'engineer_profile.discipline': (emp.engineer_profile || {}).discipline || '',
      'engineer_profile.certifications': (emp.engineer_profile || {}).certifications || '',
      'engineer_profile.skills': (emp.engineer_profile || {}).skills || '',
      'engineer_profile.experience_years': (emp.engineer_profile || {}).experience_years || '',
    })

    if (hasChanges && !window.confirm(HR_EDIT_COPY.confirmCancelMessage)) {
      return
    }

    setIsEditing(false)
    setFormErrors({})
    setSaveError(null)
    setSaveSuccess(false)
  }, [emp, formData])

  // Get options for a field
  const getFieldOptions = useCallback((field) => {
    if (field.options) return field.options
    if (field.optionsFrom === 'roles') {
      if (!Array.isArray(roles)) return []
      return roles.map(r => ({ value: r.id, label: r.display_name || r.name }))
    }
    if (field.optionsFrom === 'organizations') {
      if (!Array.isArray(organizations)) return []
      return organizations.map(o => ({ value: o.id, label: o.name }))
    }
    if (field.optionsFrom === 'managers') {
      if (!Array.isArray(managers)) return []
      // Format managers for display: "Name (Job Title)"
      return managers
        .filter(m => m.id !== emp?.id)  // Don't allow self as manager
        .map(m => ({
          value: m.id,
          label: `${m.user?.first_name || ''} ${m.user?.last_name || ''} (${m.job_title || 'N/A'})`.trim()
        }))
    }
    return []
  }, [roles, organizations, managers, emp?.id])

  // Get field value for display (read-only mode)
  const getFieldValue = useCallback((field, emp) => {
    if (!emp) return ''
    const user = emp.user || {}
    
    // User model fields
    if (field.id === 'first_name') return user.first_name || ''
    if (field.id === 'last_name') return user.last_name || ''
    if (field.id === 'email') return user.email || ''
    if (field.id === 'is_active') return user.is_active !== undefined ? user.is_active : true
    
    // Overview fields
    if (field.id === 'employee_id') return emp.employee_id || ''
    if (field.id === 'phone') return emp.phone || ''
    if (field.id === 'location') return emp.location ?? ''
    if (field.id === 'bio') return emp.bio || ''
    if (field.id === 'is_mfa_enabled') return emp.is_mfa_enabled || false
    
    // Employment fields
    if (field.id === 'organization') {
      // For select fields in read-only mode, EditableField will look up the label from options
      // But we need to return the ID for the lookup to work
      return emp.organization?.id || emp.organization_id || ''
    }
    if (field.id === 'department') return emp.department || ''
    if (field.id === 'job_title') return emp.job_title || ''
    if (field.id === 'status') return emp.status || 'active'
    if (field.id === 'manager') return emp.manager?.id || emp.manager || ''
    if (field.id === 'roles') return (emp.roles || []).map(r => r.display_name || r.name || r.id)
    
    // Competency fields (engineer_profile)
    if (field.id.startsWith('engineer_profile.')) {
      const ep = emp.engineer_profile || {}
      const key = field.id.replace('engineer_profile.', '')
      return ep[key] || ''
    }
    
    return ''
  }, [])

  if (!emp) return null
  const ep = emp.engineer_profile || {}
  const widthClass = HR_DRAWER_WIDTH_DEFAULT

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="flex-1 bg-slate-900/40 backdrop-blur-sm"
      />
      <aside className={`w-full ${widthClass} bg-white shadow-2xl flex flex-col ${anim('transition-[max-width] duration-300 ease-out')}`}>
        {/* Header */}
        <div className="p-5 bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
          <div className="flex items-start gap-4">
            <Avatar emp={emp} size="lg" />
            <div className="flex-1 min-w-0">
              <div className="text-xl font-bold truncate">{fullName(emp)}</div>
              <div className="text-sm opacity-90 truncate">{emp.job_title || 'No designation'}</div>
              <div className="text-xs opacity-75 truncate">{getEmail(emp)}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <StatusBadge status={emp.status} />
                <DisciplineTag emp={emp} />
                {emp.organization_name && (
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-white/20 text-white">
                    {emp.organization_name}
                  </span>
                )}
              </div>
            </div>
            <button type="button" onClick={onClose} className="p-1 hover:bg-white/20 rounded">
              <HeroIcons.XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          {loading && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] opacity-80">
              <Spinner className="w-3 h-3" />
              Loading full profile…
            </div>
          )}
          {isEditing && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] bg-amber-500/20 border border-amber-300/30 rounded px-2 py-1">
              <HeroIcons.PencilIcon className="w-3 h-3" />
              <span>Edit Mode — Make your changes below</span>
            </div>
          )}
          {saveSuccess && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] bg-emerald-500/20 border border-emerald-300/30 rounded px-2 py-1">
              <HeroIcons.CheckCircleIcon className="w-3 h-3" />
              <span>{HR_EDIT_COPY.successMessage}</span>
            </div>
          )}
          {saveError && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] bg-red-500/20 border border-red-300/30 rounded px-2 py-1">
              <HeroIcons.XCircleIcon className="w-3 h-3" />
              <span>{saveError}</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 bg-slate-50">
          <div
            className="grid grid-cols-2 sm:grid-cols-5 xl:grid-cols-10"
            role="tablist"
            aria-label="Employee profile sections"
          >
            {HR_DETAIL_TABS.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                role="tab"
                aria-selected={tab === t.id}
                className={`flex min-h-14 min-w-0 items-center justify-center gap-1.5 border-b-2 px-2 py-2 text-center text-[11px] font-semibold leading-tight transition sm:border-r sm:border-slate-200 sm:last:border-r-0 ${
                  tab === t.id ? 'border-b-blue-600 bg-blue-50 text-blue-700' : 'border-b-transparent text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <Icon name={t.icon} className="h-4 w-4 shrink-0" />
                <span className="min-w-0">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {tab === 'overview' && (
            <div className="grid grid-cols-2 gap-4">
              {(HR_EDITABLE_FIELDS.overview || []).map(field => (
                <div key={field.id} className={field.type === 'textarea' ? 'col-span-2' : ''}>
                  <EditableField
                    field={field}
                    value={isEditing ? formData[field.id] : getFieldValue(field, emp)}
                    isEditing={isEditing}
                    onChange={handleFieldChange}
                    error={formErrors[field.id]}
                  />
                </div>
              ))}
              {!isEditing && (
                <>
                  <Field label="Years of Service" value={formatYearsOfService(emp.created_at)} />
                  <Field label="Joined" value={formatDate(emp.created_at)} />
                </>
              )}
            </div>
          )}

          {tab === 'employment' && (
            <div className="grid grid-cols-2 gap-4">
              {(HR_EDITABLE_FIELDS.employment || []).map(field => (
                <div key={field.id} className={field.id === 'roles' ? 'col-span-2' : ''}>
                  <EditableField
                    field={field}
                    value={isEditing ? formData[field.id] : getFieldValue(field, emp)}
                    isEditing={isEditing}
                    onChange={handleFieldChange}
                    options={getFieldOptions(field)}
                    error={formErrors[field.id]}
                  />
                </div>
              ))}
              {!isEditing && (
                <Field label="Manager" value={emp.manager_name || emp.manager_detail?.name || '—'} />
              )}
            </div>
          )}

          {tab === 'documents' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-3"><HeroIcons.FolderOpenIcon className="h-6 w-6 text-blue-700" /><div><h3 className="font-bold text-blue-950">Employee documents</h3><p className="mt-1 text-sm text-blue-800">Keep employment evidence, identity files, certificates and signed HR records together.</p></div></div>
              </div>
              {(emp.documents || emp.metadata?.documents || []).length > 0 ? (
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {(emp.documents || emp.metadata?.documents || []).map((document, index) => <div key={document.id || index} className="flex items-center justify-between gap-3 p-3"><span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-800"><HeroIcons.DocumentTextIcon className="h-5 w-5 shrink-0 text-slate-400" /><span className="truncate">{document.name || document.title || `Document ${index + 1}`}</span></span>{document.url && <a href={document.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-700 hover:underline">Open</a>}</div>)}
                </div>
              ) : <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No employee documents have been linked to this profile.</div>}
            </div>
          )}

          {tab === 'leave' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4"><h3 className="font-bold text-cyan-950">Leave management</h3><p className="mt-1 text-sm text-cyan-800">Review balances, requests and attendance from the leave workspace.</p></div>
              <Link to="/hr/leave" className="inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-800"><HeroIcons.CalendarDaysIcon className="h-4 w-4" /> Open Leave Workspace</Link>
            </div>
          )}

          {tab === 'performance' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Role" value={emp.job_title || '—'} />
                <Field label="Manager" value={emp.manager_name || emp.manager_detail?.name || '—'} />
                <Field label="Discipline" value={matchDiscipline(emp.engineer_profile?.discipline || emp.department)?.label || '—'} />
                <Field label="Experience" value={emp.engineer_profile?.years_experience ? `${emp.engineer_profile.years_experience} years` : '—'} />
              </div>
              <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900"><span className="font-bold">Performance snapshot:</span> competency and reporting information is shown here; formal review cycles can be attached as employee performance records become available.</div>
            </div>
          )}

          {tab === 'compensation' && (
            <CompensationPanel 
              emp={emp}
              isEditing={isEditing}
              formData={formData}
              formErrors={formErrors}
              handleFieldChange={handleFieldChange}
              canEditSalary={canEditSalary}
              onPayrollLoad={handlePayrollLoad}
            />
          )}

          {tab === 'timesheet' && (
            <EmployeeTimesheetPanel emp={emp} />
          )}

          {tab === 'competency' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                {(HR_EDITABLE_FIELDS.competency || []).map(field => (
                  <div key={field.id} className={field.type === 'textarea' ? 'col-span-2' : ''}>
                    <EditableField
                      field={field}
                      value={isEditing ? formData[field.id] : getFieldValue(field, emp)}
                      isEditing={isEditing}
                      onChange={handleFieldChange}
                      options={getFieldOptions(field)}
                      error={formErrors[field.id]}
                    />
                  </div>
                ))}
              </div>
              {!isEditing && Object.keys(ep).length === 0 && (
                <div className="text-sm text-slate-500 italic mt-4">No engineering competency profile recorded.</div>
              )}
            </div>
          )}

          {tab === 'access' && (
            <div className="space-y-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Assigned Roles</div>
                <div className="flex flex-wrap gap-1.5">
                  {(emp.roles || []).length === 0 && <span className="text-sm text-slate-400 italic">No roles assigned</span>}
                  {(emp.roles || []).map(r => (
                    <span key={r.id || r.name} className="px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                      {r.display_name || r.name}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Accessible Modules ({(emp.modules || []).length})</div>
                <div className="flex flex-wrap gap-1.5">
                  {(emp.modules || []).length === 0 && <span className="text-sm text-slate-400 italic">No modules</span>}
                  {(emp.modules || []).map(m => (
                    <span key={m.id || m.code} className="px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                      {m.name || m.code}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'security' && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="MFA Enabled" value={emp.is_mfa_enabled ? 'Yes' : 'No'} />
              <Field label="Must Change Password" value={emp.must_change_password ? 'Yes' : 'No'} />
              <Field label="Failed Login Attempts" value={String(emp.failed_login_attempts ?? 0)} />
              <Field label="Last Login" value={formatDateTime(emp.last_login_at)} />
              <Field label="Last Login IP" value={emp.last_login_ip} mono />
              <Field label="Account Created" value={formatDateTime(emp.created_at)} />
              <Field label="Last Updated" value={formatDateTime(emp.updated_at)} />
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          {isEditing ? (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50"
              >
                <HeroIcons.XMarkIcon className="w-4 h-4" />
                {HR_EDIT_COPY.cancelButton}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || Object.keys(formErrors).length > 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium inline-flex items-center gap-2 shadow-sm"
              >
                {saving ? (
                  <>
                    <Spinner className="w-4 h-4" />
                    {HR_EDIT_COPY.savingButton}
                  </>
                ) : (
                  <>
                    <HeroIcons.CheckIcon className="w-4 h-4" />
                    {HR_EDIT_COPY.saveButton}
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {HR_EDIT_CONFIG.showAdminLink && (
                  <Link
                    to={HR_ADMIN_USER_LINK(emp.id)}
                    className="text-sm font-medium text-blue-700 hover:text-blue-900 inline-flex items-center gap-1"
                  >
                    <HeroIcons.PencilSquareIcon className="w-4 h-4" /> Open in Admin
                  </Link>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <HeroIcons.PencilIcon className="w-4 h-4" />
                    {HR_EDIT_COPY.editButton}
                  </button>
                )}
              </div>
              {getEmail(emp) && (
                <a
                  href={`mailto:${getEmail(emp)}`}
                  className="text-sm font-medium text-slate-700 hover:text-slate-900 inline-flex items-center gap-1"
                >
                  <HeroIcons.EnvelopeIcon className="w-4 h-4" /> Email
                </a>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page component
// ─────────────────────────────────────────────────────────────────────────────
export default function HREmployees() {
  const navigate = useNavigate()
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterValues, setFilterValues] = useState({})
  const [viewMode, setViewMode] = useState(HR_DEFAULT_VIEW_MODE)
  const [pageSize, setPageSize] = useState(HR_DEFAULT_PAGE_SIZE)
  const [pageIndex, setPageIndex] = useState(0)
  const [selectedEmp, setSelectedEmp] = useState(null)
  const [selectedTab, setSelectedTab] = useState(null)  // optional initial tab when opening drawer
  const [selectedEdit, setSelectedEdit] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  const openEmp = useCallback((emp, tab = null, startEditing = false) => {
    setSelectedTab(tab)
    setSelectedEdit(startEditing)
    setSelectedEmp(emp)
  }, [])

  // ──────── Data load ────────
  // Always normalise so downstream code can rely on a single shape (nested
  // `user`, `roles`, `modules`, `engineer_profile`) regardless of whether
  // the backend served the lightweight list or the rich detail serializer.
  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await rbacService.getUsers({ page_size: HR_DATA_FETCH_PAGE_SIZE })
      const list = extractUserList(resp).map(normalizeEmployee)
      setEmployees(list)
    } catch (err) {
      console.error('[HR] Failed to load employees:', err)
      setError(err?.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchEmployees() }, [fetchEmployees])

  const handleEmployeeAction = useCallback(async (emp, action) => {
    const destinations = {
      view: ['overview', false],
      edit: ['overview', true],
      documents: ['documents', false],
      leave: ['leave', false],
      performance: ['performance', false],
      payroll: ['compensation', false],
      role_access: ['access', false],
    }
    if (destinations[action]) {
      const [tab, edit] = destinations[action]
      openEmp(emp, tab, edit)
      return
    }
    if (action !== 'deactivate') return
    if (!window.confirm(`Deactivate ${fullName(emp)}? They will lose access to the system.`)) return
    try {
      await rbacService.deactivateUser(emp.id, 'Manual deactivation from Employee Management')
      if (selectedEmp?.id === emp.id) setSelectedEmp(null)
      await fetchEmployees()
    } catch (actionError) {
      console.error('[HR] Employee deactivation failed:', actionError)
      window.alert(actionError?.response?.data?.error || actionError?.response?.data?.detail || 'Employee could not be deactivated.')
    }
  }, [fetchEmployees, openEmp, selectedEmp?.id])

  // ──────── Lazy-load full detail when drawer opens ────────
  // The list endpoint returns a thin payload (no roles list, modules,
  // engineer_profile, MFA, security fields). Fetch the full record on demand
  // so the drawer renders the rich detail tabs without bloating the list.
  const [detailLoading, setDetailLoading] = useState(false)
  useEffect(() => {
    if (!selectedEmp?.id) return
    let cancelled = false
    setDetailLoading(true)
    rbacService.getUserById(selectedEmp.id)
      .then((resp) => {
        if (cancelled) return
        const full = normalizeEmployee(resp?.data ?? resp)
        // Merge — keep any list-only fields, overlay the rich fields
        setSelectedEmp(prev => prev && prev.id === full.id ? { ...prev, ...full } : prev)
      })
      .catch((err) => console.error('[HR] Failed to load employee detail:', err))
      .finally(() => { if (!cancelled) setDetailLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmp?.id])

  // ──────── Filtering pipeline ────────
  const filteredEmployees = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return employees.filter(emp => {
      // Filter chips
      for (const f of HR_FILTERS) {
        const v = filterValues[f.id] || 'all'
        if (!f.match(emp, v)) return false
      }
      if (!q) return true
      // Search — `employee_id` covers RAD AI codes; if the user types a pure
      // numeric badge number the parent component additionally fires a
      // reverse-lookup against the biometric backend (see handleSubmitSearch).
      const hay = [
        fullName(emp),
        getEmail(emp),
        emp.employee_id,
        emp.department,
        emp.job_title,
        emp.location,
        emp.organization_name,
        emp.manager_name,
        emp.manager_detail?.name,
        ...(emp.roles || []).flatMap(role => [role.name, role.display_name, role.code]),
      ].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [employees, filterValues, searchTerm])

  // ──────── Pagination (cards/table modes only) ────────
  useEffect(() => { setPageIndex(0) }, [searchTerm, filterValues, viewMode, pageSize])

  const paginated = useMemo(() => {
    if (viewMode === 'dept' || viewMode === 'hierarchy') return filteredEmployees
    const start = pageIndex * pageSize
    return filteredEmployees.slice(start, start + pageSize)
  }, [filteredEmployees, pageIndex, pageSize, viewMode])

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / pageSize))

  // ──────── Filter helpers ────────
  const setFilterValue = useCallback((id, value) => {
    setFilterValues(prev => ({ ...prev, [id]: value }))
  }, [])
  const resetFilters = useCallback(() => {
    setFilterValues({})
    setSearchTerm('')
  }, [])

  // ──────── Biometric badge-code reverse lookup ────────
  // When the user types a pure-numeric query that doesn't match anything
  // locally (e.g. `22972`), ask the timesheet backend who owns that badge
  // and auto-open the matching RAD AI employee drawer. Pattern + copy come
  // from HR_COPY so the feature stays soft-coded.
  const [searching, setSearching] = useState(false)
  const [searchNotice, setSearchNotice] = useState(null)  // {kind:'info'|'warn'|'error', text}
  const handleSubmitSearch = useCallback(async (term) => {
    setSearchNotice(null)
    const t = (term || '').trim()
    if (!t || !HR_COPY.searchBiometricCodePattern.test(t)) return
    // If local list already finds it via employee_id, no need to call backend.
    const localHit = employees.find(e =>
      String(e.employee_id || '').toLowerCase() === t.toLowerCase()
    )
    if (localHit) { openEmp(localHit); return }
    setSearching(true)
    try {
      const resp = await lookupByCode(t)
      if (!resp?.found) {
        setSearchNotice({ kind: 'warn', text: `${HR_COPY.searchLookupMissingTitle}: ${HR_COPY.searchLookupMissingBody}` })
        return
      }
      const email = String(resp.employee_email || '').toLowerCase().trim()
      const name  = String(resp.employee_name  || '').toLowerCase().trim()
      // Try email exact first, then full-name fuzzy.
      let match = email ? employees.find(e => getEmail(e).toLowerCase() === email) : null
      if (!match && name) {
        const tokens = name.split(/\s+/).filter(t => t.length >= 3)
        match = employees.find(e => {
          const hay = `${fullName(e)}`.toLowerCase()
          return tokens.length && tokens.every(tok => hay.includes(tok))
        })
      }
      if (match) {
        openEmp(match)
      } else {
        const body = HR_COPY.searchLookupUnmappedBody
          .replace('{name}', resp.employee_name || '—')
          .replace('{email}', resp.employee_email || '—')
        setSearchNotice({ kind: 'warn', text: `${HR_COPY.searchLookupUnmappedTitle}: ${body}` })
      }
    } catch (err) {
      console.error('[HR] biometric lookup failed:', err)
      setSearchNotice({ kind: 'error', text: err?.response?.data?.error || err?.message || 'Lookup failed' })
    } finally {
      setSearching(false)
    }
  }, [employees, openEmp])

  // ──────── Export ────────
  const handleExport = async (format) => {
    setExportOpen(false)
    setExporting(true)
    try {
      const resp = await rbacService.exportUsers(format)
      const ext = HR_EXPORT_FORMATS.find(f => f.value === format)?.ext || format
      const filename = `employees_${new Date().toISOString().slice(0, 10)}.${ext}`
      const url = window.URL.createObjectURL(new Blob([resp.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[HR] Export failed:', err)
      alert('Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  // ──────── Render ────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 lg:p-6">
      <div className="max-w-[1600px] mx-auto space-y-4">
        {/* Cross-link nav (Profile / HR Directory / User Management) */}
        <PeopleNav activeId="hr" />

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <nav className="text-xs text-slate-500 mb-1">
              <Link to="/dashboard" className="hover:text-slate-700">Dashboard</Link>
              <span className="mx-1.5">/</span>
              <span>Human Resources</span>
              <span className="mx-1.5">/</span>
              <span className="text-slate-700 font-medium">Employees</span>
            </nav>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 flex items-center gap-2">
              <HeroIcons.UserGroupIcon className="w-7 h-7 text-blue-600" />
              {HR_COPY.pageTitle}
            </h1>
            <p className="text-sm text-slate-600">{HR_COPY.pageSubtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchEmployees}
              className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-sm font-medium text-slate-700 inline-flex items-center gap-1.5"
            >
              {loading
                ? <Spinner className="w-4 h-4" />
                : <HeroIcons.ArrowPathIcon className="w-4 h-4" />} Refresh
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setExportOpen(o => !o)}
                disabled={exporting || employees.length === 0}
                className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-sm font-medium text-slate-700 inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <HeroIcons.ArrowDownTrayIcon className="w-4 h-4" /> {exporting ? 'Exporting…' : 'Export'}
                <HeroIcons.ChevronDownIcon className="w-3 h-3" />
              </button>
              {exportOpen && (
                <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-10 overflow-hidden">
                  {HR_EXPORT_FORMATS.map(f => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => handleExport(f.value)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Link
              to={HR_ADMIN_USERS_LIST_LINK}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium inline-flex items-center gap-1.5 shadow-sm"
            >
              <HeroIcons.UserPlusIcon className="w-4 h-4" /> Add / Manage in Admin
            </Link>
          </div>
        </div>

        {/* KPI strip */}
        {viewMode !== 'timesheet' && <KpiStrip employees={employees} loading={loading} />}

        {/* Filters */}
        <FiltersBar
          employees={employees}
          filterValues={filterValues}
          setFilterValue={setFilterValue}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          viewMode={viewMode}
          setViewMode={setViewMode}
          onReset={resetFilters}
          onSubmitSearch={handleSubmitSearch}
          searching={searching}
        />

        {searchNotice && (
          <div className={`flex items-start gap-2 px-3 py-2 rounded-lg text-sm border ${
            searchNotice.kind === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <HeroIcons.ExclamationTriangleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span className="flex-1">{searchNotice.text}</span>
            <button
              type="button"
              onClick={() => setSearchNotice(null)}
              className="flex-shrink-0 p-0.5 hover:bg-black/5 rounded"
              aria-label="Dismiss"
            >
              <HeroIcons.XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Time Sheet view replaces the directory body entirely */}
        {viewMode === 'timesheet' && (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <TimeSheetAnalytics />
          </div>
        )}

        {viewMode !== 'timesheet' && (<>
        {/* Result count */}
        <div className="flex items-center justify-between text-xs text-slate-600">
          <div>
            Showing <span className="font-semibold text-slate-900">{filteredEmployees.length}</span> of {employees.length} employees
            {searchTerm && <span> matching &ldquo;<span className="font-medium">{searchTerm}</span>&rdquo;</span>}
          </div>
          {viewMode !== 'dept' && filteredEmployees.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-slate-500">Page size:</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2 py-1 border border-slate-300 rounded text-xs"
              >
                {HR_PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Body */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <HeroIcons.ExclamationTriangleIcon className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <div className="font-semibold text-red-900">{HR_COPY.errorTitle}</div>
            <div className="text-sm text-red-700 mt-1">{error}</div>
            <button
              type="button"
              onClick={fetchEmployees}
              className="mt-3 px-3 py-1.5 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}

        {loading && !error && (
          ANIM
            ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 h-44 animate-pulse" />
                ))}
              </div>
            )
            : (
              <div className="bg-white rounded-xl border border-slate-200 p-6 text-sm text-slate-500 inline-flex items-center gap-2">
                <Spinner className="w-4 h-4" />
                Loading employees…
              </div>
            )
        )}

        {!loading && !error && filteredEmployees.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <HeroIcons.UsersIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <div className="font-semibold text-slate-900">{HR_COPY.emptyTitle}</div>
            <div className="text-sm text-slate-500 mt-1">{HR_COPY.emptySubtitle}</div>
          </div>
        )}

        {!loading && !error && filteredEmployees.length > 0 && (
          <>
            {viewMode === 'cards' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {paginated.map(emp => (
                  <EmployeeCard key={emp.id} emp={emp} onSelect={openEmp} onAction={handleEmployeeAction} />
                ))}
              </div>
            )}
            {viewMode === 'table' && (
              <EmployeesTable employees={paginated} onSelect={openEmp} onAction={handleEmployeeAction} />
            )}
            {viewMode === 'dept' && (
              <DepartmentsView employees={filteredEmployees} onSelect={openEmp} navigate={navigate} />
            )}
            {viewMode === 'hierarchy' && (
              <WorkforceHierarchy employees={filteredEmployees} onSelect={openEmp} onAction={handleEmployeeAction} />
            )}

            {/* Pagination */}
            {!['dept', 'hierarchy'].includes(viewMode) && totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPageIndex(p => Math.max(0, p - 1))}
                  disabled={pageIndex === 0}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm disabled:opacity-50"
                >
                  Prev
                </button>
                <span className="text-sm text-slate-600">
                  Page <span className="font-semibold">{pageIndex + 1}</span> of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPageIndex(p => Math.min(totalPages - 1, p + 1))}
                  disabled={pageIndex >= totalPages - 1}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {/* Discipline legend (always visible footer) */}
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Discipline legend</div>
          <div className="flex flex-wrap gap-1.5">
            {HR_DISCIPLINES.map(d => (
              <span key={d.code} className={`px-2 py-0.5 rounded text-[10px] font-medium ${d.tone}`}>{d.label}</span>
            ))}
          </div>
        </div>
        </>)}
      </div>

      {/* Detail drawer */}
      {selectedEmp && (
        <DetailDrawer
          emp={selectedEmp}
          loading={detailLoading}
          initialTab={selectedTab}
          startEditing={selectedEdit}
          onClose={() => { setSelectedEmp(null); setSelectedTab(null); setSelectedEdit(false) }}
          onUpdate={(updated) => {
            // Optimistic update — apply immediately so the drawer/list reflect
            // the save before the network round-trip below completes.
            if (updated) setSelectedEmp(prev => prev ? { ...prev, ...updated } : prev)
            fetchEmployees()
            if (selectedEmp?.id) {
              rbacService.getUserById(selectedEmp.id + "?t=" + Date.now()).then(resp => {
                const full = normalizeEmployee(resp?.data ?? resp)
                setSelectedEmp(prev => prev && prev.id === full.id ? { ...prev, ...full } : prev)
              })
            }
          }}
        />
      )}
    </div>
  )
}

