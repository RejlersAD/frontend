/* eslint-disable react/prop-types */
// HR-UI-22: main-content reference design; API/domain rules stay in the existing builders.
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, FileText, Layers, MoreHorizontal, Search, AlertTriangle as TriangleAlert, User, Users, X, RefreshCw } from 'lucide-react'
import apiClient from '../../services/api.service'
import { buildOnboardingDashboard, loadOnboardingDashboardRecords, getOnboardingFilterOptions, getOnboardingInitials, formatOnboardingDate } from './onboardingDashboardData'
import { buildOffboardingDashboard, loadOffboardingDashboardRecords } from './offboardingDashboardData'
import './LifecycleWorkspace.css'

const keyOf = record => `${record.workflow}-${record.id}`
function Avatar({ name, large = false }) { return <span className={`lw-avatar${large ? ' lw-avatar-large' : ''}`}>{getOnboardingInitials(name)}</span> }
function Person({ record }) { return <span className="lw-person"><Avatar name={record.employee_name} /><span><strong>{record.employee_name || 'Employee'}</strong><small>{record.position || record.department || 'Role not set'}</small></span></span> }
function Owner({ name }) { return <span className="lw-owner"><span className={`lw-owner-icon lw-owner-${name?.toLowerCase()}`}><Users size={13} /></span>{name}</span> }
function Status({ overdue }) { return overdue ? <span className="lw-status"><i />Overdue</span> : null }
function Select({ label, icon: Icon, value, onChange, children }) { return <label className="lw-filter"><span>{Icon && <Icon size={14} />}{label}</span><span className="lw-select"><select aria-label={label} value={value} onChange={e => onChange(e.target.value)}>{children}</select><ChevronDown size={14} /></span></label> }

export default function LifecycleWorkspace({ onOpenOnboarding, onOpenOffboarding, onOpenRegister, onStart, refreshKey }) {
  const [data, setData] = useState({ onboarding: [], offboarding: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [tab, setTab] = useState('overview')
  const [filters, setFilters] = useState({ entity: 'all', department: 'all', dateRange: '30' })
  const [workflow, setWorkflow] = useState('all')
  const [query, setQuery] = useState('')
  const [segment, setSegment] = useState('all')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const [checked, setChecked] = useState(new Set())
  const [allTasks, setAllTasks] = useState(false)
  const [sortAsc, setSortAsc] = useState(true)
  const templatesRef = useRef(null)
  useEffect(() => {
    const controller = new AbortController()
    let current = true
    setLoading(true); setError('')
    Promise.all([loadOnboardingDashboardRecords(apiClient, { signal: controller.signal }), loadOffboardingDashboardRecords(apiClient, { signal: controller.signal })])
      .then(([onboarding, offboarding]) => { if (current) setData({ onboarding, offboarding }) })
      .catch(() => { if (current) setError('Unable to load employee workflows. Please try again.') })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false; controller.abort() }
  }, [refreshKey, retry])
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
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  const onboarding = useMemo(() => buildOnboardingDashboard(data.onboarding, filters), [data.onboarding, filters])
  const offboarding = useMemo(() => buildOffboardingDashboard(data.offboarding, filters), [data.offboarding, filters])
  const options = useMemo(() => getOnboardingFilterOptions([...data.onboarding, ...data.offboarding]), [data])
  const workflows = useMemo(() => [
    ...onboarding.activeRecords.map(record => ({ ...record, workflow: 'onboarding', date: record.joining_date })),
    ...offboarding.activeRecords.map(record => ({ ...record, workflow: 'offboarding', date: record.last_working_day })),
  ], [onboarding, offboarding])
  const actions = useMemo(() => [...onboarding.actions.map(action => ({ ...action, record: { ...action.record, workflow: 'onboarding' } })), ...offboarding.actions.map(action => ({ ...action, record: { ...action.record, workflow: 'offboarding' } }))].sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999')), [onboarding, offboarding])
  const overdueKeys = new Set(actions.filter(action => action.severity === 'overdue').map(action => keyOf(action.record)))
  const matches = record => (workflow === 'all' || record.workflow === workflow) && (!['onboarding', 'offboarding'].includes(tab) || record.workflow === tab) && `${record.employee_name} ${record.position} ${record.department}`.toLowerCase().includes(query.toLowerCase())
  const upcomingKeys = new Set([...onboarding.joiners.map(item => `onboarding-${item.record.id}`), ...offboarding.joiners.map(item => `offboarding-${item.record.id}`)])
  const filtered = workflows.filter(record => matches(record) && (segment !== 'attention' || overdueKeys.has(keyOf(record))) && (segment !== 'upcoming' || upcomingKeys.has(keyOf(record))))
    .sort((a, b) => (sortAsc ? 1 : -1) * (a.date || '9999').localeCompare(b.date || '9999'))
  const pages = Math.max(1, Math.ceil(filtered.length / 7))
  const currentPage = Math.min(page, pages)
  const visible = filtered.slice((currentPage - 1) * 7, currentPage * 7)
  const selectedRecord = filtered.find(record => keyOf(record) === selected) || filtered[0]
  const selectedTasks = selectedRecord?.checklist_items || []
  const nextTask = selectedTasks.find(task => !task.completed)
  const ownerFor = (record, task) => actions.find(action => keyOf(action.record) === keyOf(record) && (task ? String(action.id).endsWith(`-${task.id}`) : true))?.owner || 'Unassigned'
  const workloadOwners = [...new Map([...onboarding.workload, ...offboarding.workload].map(owner => [owner.id, owner])).values()]
  const taskRows = actions.filter(action => matches(action.record))
  const completed = selectedTasks.filter(task => task.completed).length
  const changeFilter = (key, value) => { setFilters(current => ({ ...current, [key]: value })); setPage(1) }
  const review = (record, task) => record.workflow === 'offboarding' ? onOpenOffboarding(record, false, task?.stage) : onOpenOnboarding(record, task?.stage === 'it_provisioning')
  const metrics = [
    { label: 'Active onboarding', value: onboarding.activeCount, icon: Users, tone: 'blue', click: () => { setTab('onboarding'); setSegment('all') } },
    { label: 'Active offboarding', value: offboarding.activeCount, icon: Users, tone: 'purple', click: () => { setTab('offboarding'); setSegment('all') } },
    { label: 'Overdue tasks', value: onboarding.overdueCount + offboarding.overdueCount, icon: TriangleAlert, tone: 'red', click: () => { setTab('tasks'); setAllTasks(true) } },
    { label: 'Day-one ready', value: onboarding.dayOneReadyPercent == null ? '—' : `${onboarding.dayOneReadyPercent}%`, icon: CalendarDays, tone: 'amber', click: () => { setTab('onboarding'); setSegment('upcoming') } },
  ]
  return <div className="lw-workspace" data-table-typography="preserve">
    <div className="lw-heading"><div><h1>Onboarding &amp; Offboarding</h1><p>Coordinate people, access, assets, and employee transitions.</p></div><div className="lw-heading-actions"><button className="lw-button" onClick={() => templatesRef.current?.showModal()}><FileText size={17} />Manage templates</button><details className="lw-start-menu"><summary className="lw-button lw-primary"><span className="lw-plus">＋</span>Start workflow<ChevronDown size={14} /></summary><div><button onClick={e => { e.currentTarget.closest('details').removeAttribute('open'); onStart('onboarding') }}>Start onboarding</button><button onClick={e => { e.currentTarget.closest('details').removeAttribute('open'); onStart('offboarding') }}>Start offboarding</button></div></details></div></div>
    <div className="lw-tabs" role="tablist" aria-label="Employee lifecycle views">{[['overview', 'Overview'], ['onboarding', 'Onboarding', onboarding.activeCount], ['offboarding', 'Offboarding', offboarding.activeCount], ['tasks', 'Tasks', actions.length]].map(([id, label, count]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setPage(1) }}>{label}{count != null && <span>{count}</span>}</button>)}</div>
    <div className="lw-filters"><Select label="Entity" icon={CalendarDays} value={filters.entity} onChange={value => changeFilter('entity', value)}><option value="all">All entities</option>{options.entities.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</Select><Select label="Department" icon={Users} value={filters.department} onChange={value => changeFilter('department', value)}><option value="all">All departments</option>{options.departments.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</Select><Select label="Workflow" icon={Layers} value={workflow} onChange={value => { setWorkflow(value); setPage(1) }}><option value="all">All workflows</option><option value="onboarding">Onboarding</option><option value="offboarding">Offboarding</option></Select><Select label="Date range" icon={CalendarDays} value={filters.dateRange} onChange={value => changeFilter('dateRange', value)}><option value="30">Next 30 days</option><option value="7">Next 7 days</option><option value="90">Next 90 days</option><option value="all">All dates</option></Select><label className="lw-search"><Search size={17} /><input aria-label="Search employee" placeholder="Search employee..." value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} /></label></div>
    {error ? <div className="lw-state" role="alert"><TriangleAlert />{error}<button className="lw-button" onClick={() => setRetry(value => value + 1)}>Try again</button></div> : loading ? <div className="lw-state" role="status"><RefreshCw className="animate-spin" />Loading employee workflows…</div> : <>
      <div className="lw-metrics">{metrics.map(({ label, value, icon: Icon, tone, click }) => <button key={label} className={`lw-metric lw-${tone}`} onClick={() => { click(); setPage(1) }}><span className="lw-metric-icon"><Icon size={24} /></span><span><small>{label}</small><strong>{value}<ChevronRight size={16} /></strong></span></button>)}</div>
      <div className="lw-grid"><div className="lw-left">
        {tab !== 'tasks' && <section className="lw-panel lw-workflows" aria-label="Employee workflows"><div className="lw-panel-heading"><h2>Employee workflows</h2><div className="lw-segments">{[['all', `All (${workflows.filter(matches).length})`], ['attention', `Needs attention (${workflows.filter(record => matches(record) && overdueKeys.has(keyOf(record))).length})`], ['upcoming', `Upcoming (${workflows.filter(record => matches(record) && upcomingKeys.has(keyOf(record))).length})`]].map(([id, label]) => <button key={id} aria-pressed={segment === id} onClick={() => { setSegment(id); setPage(1) }}>{label}</button>)}</div></div>
          <div className="lw-table-scroll"><table className="lw-workflow-table"><thead><tr><th><input type="checkbox" aria-label="Select visible workflows" checked={visible.length > 0 && visible.every(record => checked.has(keyOf(record)))} onChange={e => setChecked(current => { const result = new Set(current); visible.forEach(record => e.target.checked ? result.add(keyOf(record)) : result.delete(keyOf(record))); return result })} /></th><th>Employee</th><th>Workflow</th><th><button className="lw-sort" onClick={() => setSortAsc(value => !value)}>Key date<ArrowDown size={13} style={{ transform: sortAsc ? undefined : 'rotate(180deg)' }} /></button></th><th>Progress</th><th>Owner</th><th>Action</th></tr></thead><tbody>{visible.map(record => {
            const tasks = record.checklist_items || []; const done = tasks.filter(task => task.completed).length; const owner = ownerFor(record, tasks.find(task => !task.completed)); const overdue = overdueKeys.has(keyOf(record))
            return <tr key={keyOf(record)} className={selectedRecord && keyOf(selectedRecord) === keyOf(record) ? 'lw-selected' : ''} onClick={() => setSelected(keyOf(record))}><td><input type="checkbox" aria-label={`Select ${record.employee_name}`} checked={checked.has(keyOf(record))} onChange={e => setChecked(current => { const result = new Set(current); e.target.checked ? result.add(keyOf(record)) : result.delete(keyOf(record)); return result })} /></td><td><button className="lw-person-button" onClick={() => setSelected(keyOf(record))}><Person record={record} /></button></td><td><span className={`lw-badge lw-badge-${record.workflow}`}>{record.workflow === 'onboarding' ? 'Onboarding' : 'Offboarding'}</span></td><td className={overdue ? 'lw-overdue' : ''}>{formatOnboardingDate(record.date)}</td><td><span className="lw-progress-cell"><span className="lw-progress"><i style={{ width: `${tasks.length ? done / tasks.length * 100 : 0}%`, background: overdue ? '#ffab00' : done / tasks.length >= .6 ? '#10b981' : '#3085ff' }} /></span>{done}/{tasks.length}</span></td><td><Owner name={owner} /></td><td><div className="lw-row-actions"><Status overdue={overdue} /><button className="lw-review" onClick={e => { e.stopPropagation(); review(record) }}>Review</button><button aria-label={`More actions for ${record.employee_name}`} title="Open workflow register and actions" onClick={e => { e.stopPropagation(); onOpenRegister(record.workflow) }}><MoreHorizontal size={16} /></button></div></td></tr>
          })}{!visible.length && <tr><td colSpan={7} className="lw-empty">No employee workflows match your filters.</td></tr>}</tbody></table></div>
          <div className="lw-pagination"><span>Showing {filtered.length ? (currentPage - 1) * 7 + 1 : 0}–{Math.min(currentPage * 7, filtered.length)} of {filtered.length}</span><div><button aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16} /></button>{Array.from({ length: Math.min(pages, 5) }, (_, index) => Math.max(1, Math.min(currentPage - 2, pages - 4)) + index).map(number => <button key={number} aria-label={`Page ${number}`} aria-current={currentPage === number ? 'page' : undefined} onClick={() => setPage(number)}>{number}</button>)}{pages > 5 && <span>… {pages}</span>}<button aria-label="Next page" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}><ChevronRight size={16} /></button></div></div>
        </section>}
        <section className="lw-panel lw-attention"><div className="lw-panel-heading"><h2>Tasks requiring attention</h2><button className="lw-link" onClick={() => setAllTasks(value => !value)}>{allTasks ? 'View fewer tasks' : `View all tasks (${taskRows.length})`}</button></div><div className="lw-table-scroll"><table><thead><tr><th>Employee</th><th>Task</th><th>Owner</th><th>Due date</th><th>Action</th></tr></thead><tbody>{(allTasks || tab === 'tasks' ? taskRows : taskRows.slice(0, 3)).map(action => <tr key={`${action.record.workflow}-${action.id}`}><td><Person record={action.record} /></td><td>{action.title}</td><td><Owner name={action.owner} /></td><td className={action.severity === 'overdue' ? 'lw-overdue' : ''}>{formatOnboardingDate(action.dueDate)}</td><td><div className="lw-row-actions"><button className="lw-review" onClick={() => review(action.record, action)}>Review</button><button aria-label={`Open ${action.title}`} onClick={() => review(action.record, action)}><MoreHorizontal size={16} /></button></div></td></tr>)}{!taskRows.length && <tr><td colSpan={5} className="lw-empty">No tasks requiring attention.</td></tr>}</tbody></table></div></section>
      </div><div className="lw-right"><section className="lw-panel lw-details"><div className="lw-panel-heading"><h2>Workflow details</h2>{selectedRecord && <button aria-label="Open selected workflow register and actions" onClick={() => onOpenRegister(selectedRecord.workflow)}><MoreHorizontal size={17} /></button>}</div>{selectedRecord ? <>
        <div className="lw-detail-person"><Avatar name={selectedRecord.employee_name} large /><div><h3>{selectedRecord.employee_name}</h3><p>{selectedRecord.position || selectedRecord.department || 'Role not set'}</p></div><Status overdue={overdueKeys.has(keyOf(selectedRecord))} /></div><div className="lw-detail-meta"><span><CalendarDays size={15} /><span><small>{selectedRecord.workflow === 'offboarding' ? 'Last working day' : 'Start date'}</small>{formatOnboardingDate(selectedRecord.date)}</span></span><span><User size={16} /><span><small>Owner</small>{ownerFor(selectedRecord, nextTask)}</span></span></div>
        <div className="lw-checklist-heading"><h3>{selectedRecord.workflow === 'offboarding' ? 'Offboarding' : 'Onboarding'} checklist</h3><span>{completed} / {selectedTasks.length} complete</span></div><ol className="lw-checklist">{selectedTasks.map((task, index) => <li key={task.id || index} className={task.completed ? 'is-complete' : task === nextTask ? 'is-current' : ''}><span className="lw-check-circle">{task.completed && <Check size={11} strokeWidth={3} />}</span><button onClick={() => review(selectedRecord, task)}>{task.task_name}</button><small>{task.completed ? 'Completed' : task === nextTask ? 'In progress' : 'Pending'}</small></li>)}</ol>{!selectedTasks.length && <p className="lw-empty">No checklist items recorded.</p>}
        <div className="lw-next"><h3>Next action</h3>{nextTask ? <><p><span className="lw-document"><FileText size={17} /></span>{nextTask.task_name}</p><div className="lw-next-bottom"><span><small>Owner</small>{ownerFor(selectedRecord, nextTask)}</span><span><small>Due date</small>{formatOnboardingDate(nextTask.due_date)}</span><Status overdue={actions.some(action => keyOf(action.record) === keyOf(selectedRecord) && String(action.id).endsWith(`-${nextTask.id}`) && action.severity === 'overdue')} /><button className="lw-review lw-primary" onClick={() => review(selectedRecord, nextTask)}>Review task</button></div></> : <p>All recorded tasks are complete.</p>}</div>
      </> : <p className="lw-empty">Select a workflow to see its details.</p>}</section>
      <section className="lw-panel lw-workload"><div className="lw-panel-heading"><h2>Team workload</h2></div><table><thead><tr><th>Team</th><th>Active workflows</th><th>Overdue</th></tr></thead><tbody>{workloadOwners.map(owner => { const owned = actions.filter(action => action.ownerId === owner.id); const count = new Set(owned.map(action => keyOf(action.record))).size; const overdue = owned.filter(action => action.severity === 'overdue').length; return <tr key={owner.id}><td><Owner name={owner.label} /></td><td>{owner.id === 'workplace' && !owned.length ? '—' : count}</td><td className={overdue ? 'lw-overdue' : ''}>{owner.id === 'workplace' && !owned.length ? '—' : overdue}</td></tr> })}</tbody></table></section></div></div>
    </>}
    <dialog className="lw-template-dialog" ref={templatesRef}><div className="lw-panel-heading"><h2>Workflow checklist templates</h2><button aria-label="Close templates" onClick={() => templatesRef.current.close()}><X size={20} /></button></div><p>Checklist definitions currently used by your workflows. Template editing is not available in this workspace.</p>{['onboarding', 'offboarding'].map(type => <div key={type}><h3>{type === 'onboarding' ? 'Onboarding' : 'Offboarding'}</h3><ul>{[...new Set(data[type].flatMap(record => (record.checklist_items || []).map(task => task.task_name)))].map(name => <li key={name}><FileText size={14} />{name}</li>)}</ul>{!data[type].some(record => record.checklist_items?.length) && <p>No checklist definitions loaded.</p>}</div>)}</dialog>
  </div>
}

