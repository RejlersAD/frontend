import React, { useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, FileText, GitBranch, GitCompare, ListTree, Loader2, MoreHorizontal, MoveHorizontal, PanelLeftClose, Pencil, Plus, RefreshCw, Save, Search, ShieldCheck, SlidersHorizontal, Sparkles, Users, X } from 'lucide-react'
import { EmployeeActivityLink } from './WorkBreakdownPanel'
import PrimaveraActivitiesGantt from './PrimaveraActivitiesGantt'
import ScheduleToolbarMenu from './ScheduleToolbarMenu'
import useScheduleViewport from './useScheduleViewport'
import './PlanningScheduleCanvas.css'

const number = value => new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(Number(value || 0))
const date = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'
const sourceLabel = source => {
  if (typeof source === 'string') return source
  const locator = source.locator || source.source_locator || source
  const row = locator.row ?? locator.line
  return [source.filename || source.source_filename, locator.sheet,
    row != null ? `Row ${row}` : null, locator.page != null ? `Page ${locator.page}` : null,
  ].filter(Boolean).join(' · ') || `Source ${source.file_id || source.source_file_id || source.source_file || ''}`
}
const tabs = [
  ['activities', 'Activities & Gantt', CalendarDays], ['wbs', 'WBS', ListTree], ['logic', 'Logic', GitBranch],
  ['resources', 'Resources', Users], ['assurance', 'Schedule assurance', ShieldCheck], ['evidence', 'Evidence', FileText],
]

export default function PlanningScheduleCanvas({ plan, tasks, disciplines, saving, locked, onEdit, onEmployee, onAdd, onInputs, onAnalyze, onRefresh, onSave, onNewVersion, onCompare, onApproval, approvalDisabled, approvalLabel, selectedVersionId = 'current', onVersionChange, onAddWorkstream, onOpenAdvanced, onBuildSchedule, buildingSchedule = false, onVerifySources }) {
  const [tab, setTab] = useState('activities')
  const [search, setSearch] = useState('')
  const [discipline, setDiscipline] = useState('all')
  const [criticalOnly, setCriticalOnly] = useState(false)
  const [display, setDisplay] = useState('deliverables')
  const [zoom, setZoom] = useState('week')
  const [selectedId, setSelectedId] = useState(null)
  const [fitTimeline, setFitTimeline] = useState(false)
  const [timelineFocus, setTimelineFocus] = useState(false)
  const [showLogic, setShowLogic] = useState(true)
  const canvasRef = useRef(null)
  useScheduleViewport(canvasRef, tab)
  const drawerRef = useRef(null)
  const triggerRef = useRef(null)
  const selectTask = id => { triggerRef.current = document.activeElement; setSelectedId(id) }
  const closeDetails = () => { setSelectedId(null); triggerRef.current?.focus() }
  useEffect(() => {
    if (selectedId && drawerRef.current) { drawerRef.current.focus(); drawerRef.current.scrollIntoView({ block: 'nearest', inline: 'nearest' }) }
  }, [selectedId, tab])
  const groups = disciplines.map((group, index) => ({ ...group, index, tasks: tasks.filter(task => task.discipline === group.code) }))
  const deliverables = plan.deliverables || []
  const deliverableWbsIds = new Set(deliverables.map(item => item.wbs_node_id).filter(id => id != null).map(String))
  const wbsGroupCount = plan.wbs_nodes?.filter(node => !node.is_deliverable && !deliverableWbsIds.has(String(node.id))).length ?? groups.length
  const codes = new Map(groups.flatMap(group => group.tasks.map((task, index) => [task.id, task.activity_code || task.external_id || `${group.index + 1}.${index + 1}`])))
  const selected = tasks.find(task => task.id === selectedId)
  const criticalCalculated = plan.calculation_available === true || tasks.some(task => typeof task.is_critical === 'boolean')
  const blockers = (plan.blockers || []).map(row => typeof row === 'string' ? { message: row } : row)
  const warnings = (plan.warnings || []).map(row => typeof row === 'string' ? { message: row } : row)
  const resources = useMemo(() => {
    const people = new Map()
    for (const task of tasks) {
      const key = task.assignee_id || 'unassigned'
      if (!people.has(key)) people.set(key, { id: key, task, tasks: [], effort: 0 })
      people.get(key).tasks.push(task)
      people.get(key).effort += Number(task.effort_hours || 0)
    }
    return [...people.values()]
  }, [tasks])
  const versions = plan.versions || (plan.schedule_versions || []).map(version => ({ ...version, version_number: version.version }))
  const selectedDependencies = (selected?.depends_on || []).map(id => tasks.find(task => task.id === id)).filter(Boolean)
  const sequenceStatus = plan.scheduling_status || {}
  const unsequenced = sequenceStatus.state === 'unsequenced'
  const proposedSequence = sequenceStatus.state === 'proposed'
  const isGrid = tab === 'activities' || tab === 'wbs'
  const filterCount = (discipline !== 'all' ? 1 : 0) + (criticalOnly ? 1 : 0) + (display !== 'deliverables' ? 1 : 0)
  const canBuild = onBuildSchedule && tasks.length > 0 && !plan.viewing_history && !plan.legacy_read_only && plan.state !== 'baselined'


  return <section ref={canvasRef} className="schedule-canvas" aria-label="Master schedule workspace">
    <header className="sc-commandbar" aria-label="Schedule toolbar">
      <div className="sc-heading"><CalendarDays size={18} /><h2>Master Schedule</h2>
        <span className="sc-state" title={sequenceStatus.message}>{plan.viewing_history ? 'Read only' : plan.state === 'baselined' ? 'Baseline' : plan.state === 'submitted' ? 'In review' : proposedSequence ? 'Proposed' : 'Draft'}</span>
        {onVerifySources && <button type="button" className="sc-source-check" aria-label="Verify schedule sources" title="Original schedule dates, calendar and logic are not verified. Review source coverage." onClick={onVerifySources}><AlertTriangle size={14} /><span>Unverified</span></button>}
      </div>
      <select className="sc-area-select" aria-label="Schedule workspace area" value={tab} onChange={event => setTab(event.target.value)}>
        {tabs.map(([id, label]) => <option key={id} value={id}>{label}{id === 'assurance' && blockers.length + warnings.length > 0 ? ` (${blockers.length + warnings.length})` : ''}</option>)}
      </select>
      {isGrid && <>
        <label className="sc-search"><Search size={15} /><input aria-label="Search schedule activities" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search activities" /></label>
        <ScheduleToolbarMenu name="Schedule filters" className={`sc-filters-menu ${filterCount ? 'has-filters' : ''}`} label={<><SlidersHorizontal size={15} /><span>Filters</span>{filterCount > 0 && <b>{filterCount}</b>}</>}>
          <label>Discipline<select aria-label="Schedule discipline" value={discipline} onChange={event => setDiscipline(event.target.value)}><option value="all">All disciplines</option>{groups.map(group => <option key={group.code} value={group.code}>{group.name}</option>)}</select></label>
          <div className="sc-segment" role="group" aria-label="Activity grouping"><button type="button" aria-pressed={display === 'deliverables'} onClick={() => setDisplay('deliverables')}>Deliverables</button><button type="button" aria-pressed={display === 'activities'} onClick={() => setDisplay('activities')}>All activities</button></div>
          <label className="sc-check-option"><input type="checkbox" checked={criticalOnly} disabled={!criticalCalculated} title={criticalCalculated ? 'Show activities on the calculated critical path' : 'Critical path has not been calculated'} onChange={event => setCriticalOnly(event.target.checked)} />Critical only</label>
          <label className="sc-check-option"><input type="checkbox" checked={showLogic} onChange={event => setShowLogic(event.target.checked)} />Show dependency links</label>
          {filterCount > 0 && <button type="button" onClick={() => { setDiscipline('all'); setCriticalOnly(false); setDisplay('deliverables') }}>Reset filters</button>}
        </ScheduleToolbarMenu>
        <button type="button" className="sc-tool-icon" title="Add activity" aria-label="Add activity" disabled={locked} onClick={onAdd}><Plus size={17} /></button>
        <select className="sc-scale-select" aria-label="Timeline scale" value={zoom} onChange={event => { setZoom(event.target.value); setFitTimeline(false) }}>{['day', 'week', 'month'].map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select>
        <button type="button" className="sc-tool-icon sc-fit" title="Fit timeline" aria-label="Fit timeline" aria-pressed={fitTimeline} onClick={() => setFitTimeline(value => !value)}><MoveHorizontal size={17} /></button>
        <button type="button" className="sc-tool-icon" title="Focus timeline" aria-label="Focus timeline" aria-pressed={timelineFocus} onClick={() => setTimelineFocus(value => !value)}><PanelLeftClose size={17} /></button>
      </>}
      <div className="sc-command-actions">
        {canBuild && <button type="button" aria-label="Build schedule" className={`sc-build ${unsequenced ? 'needs-sequence' : ''}`} disabled={locked || plan.stale_inputs} title={sequenceStatus.message || 'Review proposed durations and dependencies before applying'} onClick={onBuildSchedule}>{buildingSchedule ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}<span>Build schedule</span></button>}
        <button type="button" className="sc-primary" disabled={locked} onClick={onSave}>{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}Save</button>
        <ScheduleToolbarMenu name="Schedule actions" className="sc-actions-menu" disabled={saving || buildingSchedule} label={<MoreHorizontal size={19} />}>
          <label>Version<select aria-label="Schedule version" disabled={saving || buildingSchedule || !versions.length} title={versions.length ? 'Select a saved schedule version' : 'Saved versions appear after submission'} value={selectedVersionId} onChange={event => onVersionChange?.(event.target.value)}><option value="current">Current plan{selectedVersionId === 'current' && plan.version_number ? ` \u00b7 v${plan.version_number}` : ''}</option>{versions.map(version => <option key={version.id} value={String(version.id)}>{version.label || `Version ${version.version_number} \u00b7 ${version.status}`}</option>)}</select></label>
          <button type="button" data-close-menu disabled={!onCompare} onClick={onCompare}><GitCompare size={16} />Compare</button>
          <button type="button" data-close-menu disabled={plan.state !== 'baselined' || !plan.permissions?.can_reopen} onClick={onNewVersion}><Plus size={16} />New version</button>
          <button type="button" data-close-menu onClick={() => { setTab('assurance'); onRefresh() }}><ShieldCheck size={16} />Validate</button>
          {onVerifySources && <button type="button" data-close-menu onClick={onVerifySources}><FileText size={16} />Verify sources</button>}
          <button type="button" data-close-menu onClick={onInputs}><FileText size={16} />Project inputs</button>
          {!tasks.length && onAnalyze && <button type="button" data-close-menu onClick={onAnalyze}><Sparkles size={16} />Analyze & build</button>}
          {onAddWorkstream && <button type="button" data-close-menu disabled={locked} onClick={onAddWorkstream}><Plus size={16} />Add workstream</button>}
        </ScheduleToolbarMenu>
      </div>
    </header>
    {(plan.legacy_read_only || plan.viewing_history) && <div className="sc-read-only"><ShieldCheck size={16} /><span>{plan.read_only_reason || 'This saved schedule version is read only. Select the current plan to edit.'}</span>{plan.legacy_read_only && onOpenAdvanced && <button type="button" onClick={onOpenAdvanced}>Open Schedule Controls<ArrowRight size={14} /></button>}</div>}
    {isGrid && <>
      <div className={`sc-body ${selected ? 'has-selection' : ''}`}>
        <PrimaveraActivitiesGantt plan={plan} tasks={tasks} disciplines={disciplines} search={search} discipline={discipline}
          criticalOnly={criticalOnly} display={display} zoom={zoom} fitTimeline={fitTimeline} selectedId={selectedId} locked={locked}
          timelineFocus={timelineFocus} onTimelineFocusChange={setTimelineFocus}
          showTimeline={tab === 'activities'} showLogic={showLogic} onSelect={task => selectTask(task.id)} onEdit={onEdit} onInputs={onInputs} />
      {selected && <aside ref={drawerRef} tabIndex={-1} className="sc-detail-drawer" aria-label="Activity details" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeDetails() } }}><header><h3>Activity details</h3><button type="button" aria-label="Close activity details" onClick={closeDetails}><X size={18} /></button></header><span className="sc-detail-code">Activity ID {codes.get(selected.id)}</span><h4>{selected.title}</h4><dl><div><dt>Assigned to</dt><dd>{selected.assignee_id ? <EmployeeActivityLink task={selected} onOpen={onEmployee} disabled={saving || buildingSchedule} /> : 'Unassigned'}</dd></div>{(selected.responsible_role || selected.workflow_responsible_party) && <div><dt>Responsible role</dt><dd>{selected.responsible_role || selected.workflow_responsible_party}</dd></div>}<div><dt>Duration</dt><dd>{selected.duration_days == null ? 'Not set' : `${number(selected.duration_days)} working days`}{selected.duration_source === 'proposed' && <span className="sc-proposed">Proposed</span>}</dd></div><div><dt>Start</dt><dd>{date(selected.planned_start_date)}</dd></div><div><dt>Finish</dt><dd>{date(selected.planned_finish_date)}</dd></div>{selected.due_date && selected.due_date !== selected.planned_finish_date && <div><dt>Employee due date</dt><dd>{date(selected.due_date)}</dd></div>}<div><dt>Total float</dt><dd>{selected.total_float_days == null ? 'Not calculated' : `${number(selected.total_float_days)} days`}</dd></div><div><dt>Planned effort</dt><dd>{selected.effort_hours == null ? 'Not set' : `${number(selected.effort_hours)} hours`}</dd></div></dl><h5>Depends on</h5>{selectedDependencies.length ? <ul>{selectedDependencies.map(task => <li key={task.id}>{codes.get(task.id)} · {task.title}</li>)}</ul> : <p className="sc-muted">No predecessors</p>}<h5>Acceptance criteria</h5><p className="sc-muted">{selected.acceptance_criteria || 'Not specified'}</p><button type="button" className="sc-detail-edit" disabled={locked} onClick={() => onEdit(selected)}><Pencil size={15} />Edit activity</button></aside>}</div>
    </>}
    {tab === 'logic' && <div className="sc-tab-content"><h3>Activity dependencies</h3><p className="sc-muted">Review predecessor relationships before approving the schedule.</p><div className="sc-secondary-table"><table><thead><tr><th>Predecessor</th><th>Successor</th><th>Relationship</th><th /></tr></thead><tbody>{tasks.flatMap(task => (task.depends_on || []).map(id => { const predecessor = tasks.find(item => item.id === id); const relationship = task.dependency_details?.find(item => item.task_id === id); return <tr key={`${task.id}-${id}`}><td>{predecessor?.title || id}</td><td>{task.title}</td><td>{({ FS: 'Finish to start', SS: 'Start to start', FF: 'Finish to finish', SF: 'Start to finish' })[relationship?.type || 'FS'] || relationship?.type}{Number(relationship?.lag_days) ? ` \u00b7 ${Number(relationship.lag_days) > 0 ? '+' : ''}${number(relationship.lag_days)} d lag` : ''}</td><td><button type="button" disabled={locked} onClick={() => onEdit(task, 'dependencies')}>Edit</button></td></tr> }))}{!tasks.some(task => task.depends_on?.length) && <tr><td colSpan={4}>No dependencies set. Edit an activity to add its predecessors.</td></tr>}</tbody></table></div></div>}
    {tab === 'resources' && <div className="sc-tab-content"><h3>Resource assignments</h3><p className="sc-muted">Assigned work is available in each employee’s My Work Hub.</p><div className="sc-secondary-table"><table><thead><tr><th>Employee</th><th>Activities</th><th>Planned effort</th><th /></tr></thead><tbody>{resources.map(person => <tr key={person.id}><td>{person.id === 'unassigned' ? <span className="sc-resource-missing">Unassigned</span> : <EmployeeActivityLink task={person.task} onOpen={onEmployee} disabled={saving || buildingSchedule} />}</td><td>{person.tasks.length}</td><td>{number(person.effort)} hours</td><td><button type="button" disabled={locked} onClick={() => onEdit(person.task, 'owner')}>{person.id === 'unassigned' ? 'Assign employee' : 'Review assignment'}</button></td></tr>)}</tbody></table></div></div>}
    {tab === 'assurance' && <div className="sc-tab-content"><header className="sc-assurance-heading"><h3>Schedule assurance</h3><button type="button" disabled={saving || buildingSchedule} onClick={onRefresh}><RefreshCw size={15} />Refresh checks</button></header>{blockers.length ? <ul className="sc-checks">{blockers.map((item, index) => { const task = tasks.find(row => row.id === item.task_id); return <li key={index}><AlertTriangle size={18} /><span>{item.message || item.detail || item.code}</span>{task && <button type="button" disabled={locked} onClick={() => onEdit(task, item.field)}>Review activity<ArrowRight size={14} /></button>}</li> })}</ul> : <p className={warnings.length ? "sc-check-warning" : "sc-check-success"}>{warnings.length ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}{warnings.length ? `No blocking issues. Review ${warnings.length} ${warnings.length === 1 ? 'warning' : 'warnings'} below.` : 'No blocking issues in the current plan.'}</p>}{warnings.length > 0 && <><h4>Warnings</h4><ul className="sc-checks">{warnings.map((item, index) => <li key={index}><AlertTriangle size={17} /><span>{item.message || item.description || item.detail || item.code}</span></li>)}</ul></>}{(plan.assumptions || []).length > 0 && <><h4>Planning assumptions</h4><ul className="sc-assumptions">{plan.assumptions.map((item, index) => <li key={index}><Sparkles size={15} />{typeof item === 'string' ? item : item.message || item.description || item.label}</li>)}</ul></>}</div>}
    {tab === 'evidence' && <div className="sc-tab-content"><header className="sc-assurance-heading"><h3>Source evidence</h3><button type="button" disabled={saving || buildingSchedule} onClick={onInputs}><FileText size={15} />Manage inputs</button></header>{(plan.source_documents || []).map(file => <p className="sc-source" key={file.id}><FileText size={16} />{file.name || file.original_filename}</p>)}<div className="sc-secondary-table"><table><thead><tr><th>Deliverable</th><th>Source reference</th></tr></thead><tbody>{tasks.filter(task => task.source_references?.length).map(task => <tr key={task.id}><td>{task.title}</td><td>{task.source_references.map((source, index) => <p key={index}>{sourceLabel(source)}</p>)}</td></tr>)}{!tasks.some(task => task.source_references?.length) && <tr><td colSpan={2}>No document source references. Activities may be created directly from project scope.</td></tr>}</tbody></table></div></div>}
    <footer className="sc-footer">{deliverables.length > 0 && <span><strong>{deliverables.length}</strong> deliverables</span>}<span><strong>{tasks.length}</strong> activities</span><span><strong>{wbsGroupCount}</strong> WBS groups</span><span title={criticalCalculated ? 'From the calculated schedule' : 'Critical path has not been calculated'}><strong>{criticalCalculated ? tasks.filter(task => task.is_critical).length : '\u2014'}</strong> critical</span><span><strong>{tasks.reduce((sum, task) => sum + (task.depends_on || []).length, 0)}</strong> relationships</span><span className="sc-save-status" role="status">{saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : <><CheckCircle2 size={14} />Changes saved</>}</span>{onApproval && <button type="button" className="sc-primary" disabled={saving || buildingSchedule || approvalDisabled} onClick={onApproval}>{approvalLabel || 'Submit for approval'}<ArrowRight size={15} /></button>}</footer>
  </section>
}

PlanningScheduleCanvas.propTypes = {
  plan: PropTypes.object.isRequired, tasks: PropTypes.array.isRequired, disciplines: PropTypes.array.isRequired,
  saving: PropTypes.bool, locked: PropTypes.bool, onEdit: PropTypes.func.isRequired, onEmployee: PropTypes.func.isRequired,
  onAdd: PropTypes.func.isRequired, onInputs: PropTypes.func.isRequired, onAnalyze: PropTypes.func, onRefresh: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired, onNewVersion: PropTypes.func.isRequired, onCompare: PropTypes.func,
  onApproval: PropTypes.func, approvalDisabled: PropTypes.bool, approvalLabel: PropTypes.string,
  selectedVersionId: PropTypes.string, onVersionChange: PropTypes.func, onAddWorkstream: PropTypes.func, onOpenAdvanced: PropTypes.func,
  onBuildSchedule: PropTypes.func, buildingSchedule: PropTypes.bool, onVerifySources: PropTypes.func,
}
