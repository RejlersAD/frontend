/* eslint-disable react/prop-types */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowPathIcon, BanknotesIcon, CalendarDaysIcon, CheckCircleIcon, ChevronDownIcon,
  ExclamationTriangleIcon, HomeModernIcon, InformationCircleIcon,
  UserGroupIcon, UserIcon, UsersIcon, XMarkIcon,
} from '@heroicons/react/24/outline'
import apiClient from '../../services/api.service'
import {
  buildOnboardingDashboard, formatOnboardingDate, getOnboardingFilterOptions,
  getOnboardingInitials, loadOnboardingDashboardRecords,
} from './onboardingDashboardData'
import { buildOffboardingDashboard, loadOffboardingDashboardRecords } from './offboardingDashboardData'

const ownerIcons = { hr: UserIcon, it: UsersIcon, managers: UserGroupIcon, workplace: HomeModernIcon, finance: BanknotesIcon }
const severityLabels = { overdue: 'Overdue', soon: 'Due soon', pending: 'Pending' }
const DASHBOARD_MODES = {
  onboarding: {
    load: loadOnboardingDashboardRecords, build: buildOnboardingDashboard, dateField: 'joining_date',
    active: 'Active onboardings', activeDescription: 'Employees currently onboarding',
    upcomingMetric: 'Joining in 7 days', upcomingDescription: 'Employees starting within 7 days',
    ready: 'Day-one ready', readyDescription: 'Joiners with every critical item ready',
    attention: 'Onboarding actions requiring attention', upcoming: 'Upcoming joiners', dateColumn: 'Start date',
    readiness: 'Onboarding readiness', greenCategory: 'employee',
    footnote: 'Day-one ready requires employee data, documents, access and equipment.',
    notice: count => `${count} joiner${count === 1 ? '' : 's'} require${count === 1 ? 's' : ''} account or equipment setup before their start date.`,
    clearNotice: 'No pending account or equipment setup in the tracked checklists.',
    emptyActions: 'No onboarding actions requiring attention.', emptyUpcoming: 'No upcoming joiners in this date range.',
  },
  offboarding: {
    load: loadOffboardingDashboardRecords, build: buildOffboardingDashboard, dateField: 'last_working_day',
    active: 'Active exits', activeDescription: 'Employees in offboarding',
    upcomingMetric: 'Leaving in 7 days', upcomingDescription: 'Employees with last working day in 7 days',
    ready: 'Clearance complete', readyDescription: 'Exits with all clearance items completed',
    attention: 'Exit actions requiring attention', upcoming: 'Upcoming departures', dateColumn: 'Last working day',
    readiness: 'Clearance readiness', greenCategory: 'documents',
    footnote: 'Case closes only after access, assets, payroll and documents are cleared.',
    notice: count => `${count} departure${count === 1 ? '' : 's'} require${count === 1 ? 's' : ''} access revocation before their last working day.`,
    clearNotice: 'No pending access revocation in the tracked checklists.',
    emptyActions: 'No exit actions requiring attention.', emptyUpcoming: 'No upcoming departures in this date range.',
  },
}

function Employee({ record, onOpen, mode }) {
  return (
    <button type="button" className="onboarding-employee" onClick={() => onOpen(record)} aria-label={`View ${record.employee_name || 'employee'} ${mode} details`}>
      <span className="onboarding-avatar" aria-hidden="true">{getOnboardingInitials(record.employee_name)}</span>
      <span className="onboarding-identity"><strong>{record.employee_name || 'Employee'}</strong><small>{record.position || record.department || 'Role not set'}</small></span>
    </button>
  )
}

function Filter({ label, ariaLabel = label, value, onChange, children, calendar }) {
  return (
    <label className={`lifecycle-filter${calendar ? ' lifecycle-filter--date' : ''}`}>
      <span>{label}</span>
      <span className="lifecycle-select">
        {calendar && <CalendarDaysIcon aria-hidden="true" />}
        <select aria-label={ariaLabel} value={value} onChange={event => onChange(event.target.value)}>{children}</select>
        <ChevronDownIcon aria-hidden="true" />
      </span>
    </label>
  )
}

function PanelHeading({ title, expanded, onToggle, label }) {
  return (
    <div className="onboarding-panel-heading">
      <h2>{title}</h2>
      {onToggle && <button type="button" className="onboarding-view-all" aria-label={`${expanded ? 'View fewer' : 'View all'} ${label}`} aria-expanded={expanded} onClick={onToggle}>{expanded ? 'View less' : 'View all'}</button>}
    </div>
  )
}

export default function OnboardingDashboard({ navigation, startButton, onOpenRecord, onOpenRegister, refreshKey, mode = 'onboarding' }) {
  const config = DASHBOARD_MODES[mode]
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [filters, setFilters] = useState({ entity: 'all', department: 'all', dateRange: '30' })
  const [allActions, setAllActions] = useState(false)
  const [allJoiners, setAllJoiners] = useState(false)
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [recordSearch, setRecordSearch] = useState('')
  const attentionRef = useRef(null)
  const upcomingRef = useRef(null)
  const readinessRef = useRef(null)
  const recordsDialogRef = useRef(null)

  useEffect(() => {
    let current = true
    const controller = new AbortController()
    setLoading(true)
    setError('')
    config.load(apiClient, { signal: controller.signal })
      .then(data => { if (current) setRecords(data) })
      .catch(() => { if (current) setError(`Unable to load ${mode}. Please try again.`) })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false; controller.abort() }
  }, [refreshKey, retry, config, mode])

  useEffect(() => {
    let lastRefresh = 0
    const refresh = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRefresh > 1000) {
        lastRefresh = Date.now()
        setRetry(value => value + 1)
      }
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  const options = useMemo(() => getOnboardingFilterOptions(records), [records])
  const dashboard = useMemo(() => config.build(records, filters), [records, filters, config])
  const updateFilter = (key, value) => {
    setFilters(current => ({ ...current, [key]: value }))
    setAllActions(false)
    setAllJoiners(false)
    setOverdueOnly(false)
  }
  const reveal = ref => { ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); ref.current?.focus({ preventScroll: true }) }
  const openActiveRecords = () => { setRecordSearch(''); recordsDialogRef.current?.showModal() }
  const metrics = [
    { id: 'active', label: config.active, value: dashboard.activeCount, description: config.activeDescription, icon: UsersIcon, tone: 'blue', onClick: openActiveRecords },
    { id: 'overdue', label: 'Actions overdue', value: dashboard.overdueCount, description: 'Required actions past due', icon: ExclamationTriangleIcon, tone: 'red', onClick: () => { setOverdueOnly(true); setAllActions(true); reveal(attentionRef) } },
    { id: 'joining', label: config.upcomingMetric, value: dashboard.joiningSoonCount, description: config.upcomingDescription, icon: CalendarDaysIcon, tone: 'amber', onClick: () => { updateFilter('dateRange', '7'); setAllJoiners(true); reveal(upcomingRef) } },
    { id: 'ready', label: config.ready, value: dashboard.dayOneReadyPercent == null ? '—' : `${dashboard.dayOneReadyPercent}%`, description: config.readyDescription, icon: CheckCircleIcon, tone: 'green', onClick: () => reveal(readinessRef) },
  ]
  const actions = dashboard.actions.filter(action => !overdueOnly || action.severity === 'overdue')
  const visibleActions = allActions ? actions : actions.slice(0, 4)
  const visibleJoiners = allJoiners ? dashboard.joiners : dashboard.joiners.slice(0, 4)
  const search = recordSearch.trim().toLowerCase()
  const visibleRecords = dashboard.activeRecords.filter(record => !search || [record.employee_name, record.employee_email, record.employee_id, record.position, record.department].some(value => String(value || '').toLowerCase().includes(search)))
  const joinerGroups = visibleJoiners.reduce((groups, item) => {
    const date = item.record[config.dateField]
    const previous = groups[groups.length - 1]
    if (previous?.date === date) previous.items.push(item)
    else groups.push({ date, items: [item] })
    return groups
  }, [])

  return (
    <div className={`onboarding-dashboard lifecycle-dashboard--${mode}`} data-table-typography="preserve">
      <div className="lifecycle-toolbar">
        {navigation}
        <div className="lifecycle-filters">
          <Filter label="Entity" value={filters.entity} onChange={value => updateFilter('entity', value)}>
            <option value="all">All entities</option>{options.entities.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Filter>
          <Filter label="Department" value={filters.department} onChange={value => updateFilter('department', value)}>
            <option value="all">All departments</option>{options.departments.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Filter>
          <Filter label="Upcoming date range" ariaLabel="Date range" value={filters.dateRange} calendar onChange={value => updateFilter('dateRange', value)}>
            <option value="30">Next 30 days</option><option value="7">Next 7 days</option><option value="90">Next 90 days</option><option value="all">All dates</option>
          </Filter>
          <button type="button" className="lifecycle-refresh" aria-label={`Refresh ${mode} dashboard`} title="Refresh employees" disabled={loading} onClick={() => setRetry(value => value + 1)}><ArrowPathIcon aria-hidden="true" /></button>
        </div>
        {startButton}
      </div>

      {error ? (
        <div className="onboarding-state onboarding-state--error" role="alert">
          <ExclamationTriangleIcon aria-hidden="true" /><p>{error}</p>
          <button type="button" onClick={() => setRetry(value => value + 1)}><ArrowPathIcon aria-hidden="true" />Try again</button>
        </div>
      ) : loading ? (
        <div className="onboarding-state" role="status"><ArrowPathIcon className="onboarding-loading" aria-hidden="true" /><p>Loading {mode}…</p></div>
      ) : (
        <>
          <div className="onboarding-kpis">
            {metrics.map(({ id, label, value, description, icon: Icon, tone, onClick }) => (
              <button type="button" key={id} className={`onboarding-kpi onboarding-kpi--${tone}`} data-metric={id} onClick={onClick}>
                <span className="onboarding-kpi-icon"><Icon aria-hidden="true" /></span>
                <span className="onboarding-kpi-copy"><span className="onboarding-kpi-label">{label}</span><strong>{value}</strong><span className="onboarding-kpi-description">{description}</span>{id === 'active' && <span className="onboarding-kpi-link">View employees →</span>}</span>
              </button>
            ))}
          </div>

          <div className="onboarding-main-grid">
            <section className="onboarding-panel onboarding-panel--attention" ref={attentionRef} tabIndex={-1} aria-label={config.attention}>
              <PanelHeading title={config.attention} expanded={allActions} label={`${mode} actions`} onToggle={() => { setAllActions(value => !value); setOverdueOnly(false) }} />
              <div className={`onboarding-notice${dashboard.setupNeededCount ? '' : ' onboarding-notice--clear'}`}>
                {dashboard.setupNeededCount ? <ExclamationTriangleIcon aria-hidden="true" /> : <InformationCircleIcon aria-hidden="true" />}
                <span>{dashboard.setupNeededCount ? config.notice(dashboard.setupNeededCount) : config.clearNotice}</span>
              </div>
              {overdueOnly && <button className="onboarding-clear-filter" type="button" onClick={() => setOverdueOnly(false)}>Showing overdue actions · Show all</button>}
              <div className="onboarding-table-scroll">
                <table className="onboarding-attention-table">
                  <thead><tr><th scope="col">Employee</th><th scope="col">Action</th><th scope="col">Owner</th><th scope="col">Due date</th><th scope="col">Severity</th><th scope="col"><span className="sr-only">Review action</span></th></tr></thead>
                  <tbody>
                    {visibleActions.map(action => (
                      <tr key={action.id}>
                        <td><Employee record={action.record} onOpen={onOpenRecord} mode={mode} /></td>
                        <td>{action.title}</td>
                        <td><span className="onboarding-owner" title="Responsible checklist team"><span className="onboarding-avatar" aria-hidden="true">{action.ownerInitials}</span>{action.owner}</span></td>
                        <td className={`onboarding-due onboarding-due--${action.severity}`}>{formatOnboardingDate(action.dueDate)}</td>
                        <td><span className={`onboarding-status onboarding-status--${action.severity}`}><i aria-hidden="true" />{severityLabels[action.severity] || 'Pending'}</span></td>
                        <td><button type="button" className="onboarding-row-action" onClick={() => onOpenRecord(action.record, action.focusItChecklist, action.stage)} aria-label={`${action.actionLabel} for ${action.record.employee_name}`}>{action.actionLabel}</button></td>
                      </tr>
                    ))}
                    {!visibleActions.length && <tr><td colSpan={6} className="onboarding-empty">{overdueOnly ? 'No overdue actions.' : config.emptyActions}</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="onboarding-panel onboarding-panel--upcoming" ref={upcomingRef} tabIndex={-1} aria-label={config.upcoming}>
              <PanelHeading title={config.upcoming} expanded={allJoiners} label={config.upcoming.toLowerCase()} onToggle={() => setAllJoiners(value => !value)} />
              <div className="onboarding-table-scroll">
                <table className="onboarding-joiners-table">
                  <thead><tr><th scope="col" colSpan={2}><span className="onboarding-joiner-columns"><span>Employee</span><span>Role</span></span></th><th scope="col">{config.dateColumn}</th><th scope="col">Readiness</th></tr></thead>
                  <tbody>
                    {joinerGroups.map(group => (
                      <Fragment key={group.date}>
                        <tr className="onboarding-date-group"><th scope="rowgroup" colSpan={4}>{formatOnboardingDate(group.date)} ({dashboard.joiners.filter(item => item.record[config.dateField] === group.date).length})</th></tr>
                        {group.items.map(item => (
                          <tr key={item.record.id}>
                            <td colSpan={2}><Employee record={item.record} onOpen={onOpenRecord} mode={mode} /></td>
                            <td className="onboarding-join-date">{formatOnboardingDate(item.record[config.dateField])}</td>
                            <td><span className={`onboarding-status onboarding-status--${item.tone}`}><i aria-hidden="true" />{item.readiness}</span></td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                    {!visibleJoiners.length && <tr><td colSpan={4} className="onboarding-empty">{config.emptyUpcoming}</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="onboarding-upcoming-context">
                {!!dashboard.joiners.length && <p>Showing {visibleJoiners.length} of {dashboard.joiners.length} {config.upcoming.toLowerCase()}.</p>}
                {!!dashboard.upcomingOutsideRangeCount && <p>{dashboard.upcomingOutsideRangeCount} active {dashboard.upcomingOutsideRangeCount === 1 ? 'case falls' : 'cases fall'} after this date range. <button type="button" onClick={() => { updateFilter('dateRange', 'all'); setAllJoiners(true) }}>Show all upcoming</button></p>}
                {!!(dashboard.pastActiveCount + dashboard.undatedActiveCount) && <p>{dashboard.pastActiveCount > 0 && `${dashboard.pastActiveCount} active ${dashboard.pastActiveCount === 1 ? 'case has a past date' : 'cases have past dates'}`}{dashboard.pastActiveCount > 0 && dashboard.undatedActiveCount > 0 && '; '}{dashboard.undatedActiveCount > 0 && `${dashboard.undatedActiveCount} ${dashboard.pastActiveCount ? '' : 'active '}${dashboard.undatedActiveCount === 1 ? 'case has no date' : 'cases have no date'}`}. <button type="button" onClick={openActiveRecords}>View active employees</button></p>}
              </div>
            </section>
          </div>

          <div className="onboarding-bottom-grid">
            <section className="onboarding-panel onboarding-panel--readiness" ref={readinessRef} tabIndex={-1} aria-label={config.readiness}>
              <PanelHeading title={config.readiness} />
              <div className="onboarding-readiness-bars">
                {dashboard.readiness.map(item => (
                  <div key={item.id} className="onboarding-readiness-row">
                    <span>{item.label}</span>
                    <div className={`onboarding-progress${item.id === config.greenCategory ? ' onboarding-progress--green' : ''}`} role="progressbar" aria-label={item.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.percent ?? undefined} aria-valuetext={item.percent == null ? 'Not tracked' : `${item.percent}%`}>
                      <span style={{ width: `${item.percent ?? 0}%` }} />
                    </div>
                    <span className="onboarding-readiness-value" title={item.percent == null ? 'No checklist evidence available' : undefined}>{item.percent == null ? '—' : `${item.percent}%`}</span>
                  </div>
                ))}
              </div>
              <p className="onboarding-footnote"><InformationCircleIcon aria-hidden="true" />{config.footnote}</p>
            </section>

            <section className="onboarding-panel onboarding-panel--workload" aria-label="Owner workload">
              <PanelHeading title="Owner workload" />
              <table className="onboarding-workload-table">
                <thead><tr><th scope="col" title="Responsible teams based on checklist stages">Owner</th><th scope="col">Open</th><th scope="col">Overdue</th></tr></thead>
                <tbody>{dashboard.workload.map(item => {
                  const Icon = ownerIcons[item.id] || UserGroupIcon
                  return <tr key={item.id}><td><span className="onboarding-workload-owner"><span className={`onboarding-workload-icon onboarding-workload-icon--${item.tone}`}><Icon aria-hidden="true" /></span>{item.label}</span></td><td title={item.open == null ? 'No owner assignment available' : undefined}>{item.open ?? '—'}</td><td className={item.overdue ? 'onboarding-workload-overdue' : ''}>{item.overdue ?? '—'}</td></tr>
                })}</tbody>
              </table>
            </section>
          </div>
          <dialog ref={recordsDialogRef} className="onboarding-records-dialog" aria-labelledby="onboarding-records-title" onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close() }}>
            <div className="onboarding-dialog-heading"><h2 id="onboarding-records-title">{config.active} ({dashboard.activeCount})</h2><button type="button" aria-label={`Close ${config.active.toLowerCase()}`} onClick={() => recordsDialogRef.current.close()}><XMarkIcon aria-hidden="true" /></button></div>
            <div className="onboarding-dialog-search"><p>All open cases matching Entity and Department, across all dates. Newest cases first.</p><label htmlFor="onboarding-active-search">Search active employees</label><input id="onboarding-active-search" type="search" value={recordSearch} onChange={event => setRecordSearch(event.target.value)} placeholder="Name, email, employee ID or role" /></div>
            <div className="onboarding-dialog-records">
              {visibleRecords.map(record => <div key={record.id} className="onboarding-dialog-record"><Employee record={record} mode={mode} onOpen={item => { recordsDialogRef.current.close(); onOpenRecord(item) }} /><span>{formatOnboardingDate(record[config.dateField])}</span></div>)}
              {!visibleRecords.length && <p className="onboarding-empty">No {config.active.toLowerCase()} match {search ? 'your search' : 'these filters'}.</p>}
            </div>
            {onOpenRegister && <div className="onboarding-dialog-footer"><button type="button" className="onboarding-row-action" onClick={() => { recordsDialogRef.current.close(); onOpenRegister() }}>Manage exits and history</button></div>}
          </dialog>
        </>
      )}
    </div>
  )
}
