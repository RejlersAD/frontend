import React, { useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, FileText, GitBranch, GitCompare, ListTree, Loader2, MoreHorizontal, MoveHorizontal, PanelLeftClose, Pencil, Plus, Save, Search, ShieldCheck, SlidersHorizontal, Sparkles, Users, X } from 'lucide-react'
import { EmployeeActivityLink } from './WorkBreakdownPanel'
import PrimaveraActivitiesGantt from './PrimaveraActivitiesGantt'
import PlanningScheduleChecks from './PlanningScheduleChecks'
import PlanningDurationEvidence, { ActivityDurationEvidence } from './PlanningDurationEvidence'
import PlanningEvidenceReview from './PlanningEvidenceReview'
import PlanningSourceEvidenceTable from './PlanningSourceEvidenceTable'
import PlanningSourceSchedule from './PlanningSourceSchedule'
import PlanningSourceLogic, { PlanningSourceLogicSummary, SourceLogicComparison } from './PlanningSourceLogic'
import PlanningProfilePanel from './PlanningProfilePanel'
import PlanningBuildDrawer from './PlanningBuildDrawer'
import PlanningContextDrawer from './PlanningContextDrawer'
import PlanningExportPanel from './PlanningExportPanel'
import PlanningRiskRegister from './PlanningRiskRegister'
import PlanningResourceRequirements from './PlanningResourceRequirements'
import PlanningResourcePlan from './PlanningResourcePlan'
import PlanningOperationalControls from './PlanningOperationalControls'
import PlanningDelayAnalysis from './PlanningDelayAnalysis'
import PlanningFieldProvenance from './PlanningFieldProvenance'
import { dependencyEvidenceLabel, durationEvidenceRow, durationUnitLabel, missingSourceDuration } from '../../utils/planningDurationEvidence'
import { dateDisplayTask, dateEvidenceLabel, floatEvidenceLabel, missingDateLabel } from '../../utils/planningDateEvidence'
import { scheduleDependencyEntries } from '../../utils/primaveraDependencies'
import { scheduleChecks, scheduleIssueGroups } from './scheduleCheckPolicy'
import ScheduleToolbarMenu from './ScheduleToolbarMenu'
import useScheduleViewport from './useScheduleViewport'
import './PlanningScheduleCanvas.css'

const number = value => new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(Number(value || 0))
const date = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Not Specified'
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
  ['resources', 'Resources', Users], ['controls', 'Operational controls', CalendarDays], ['delay', 'Delay & recovery', GitCompare], ['risks', 'Risk register', AlertTriangle], ['assurance', 'Schedule assurance', ShieldCheck], ['evidence', 'Evidence', FileText], ['source-schedule', 'Extracted source schedule', FileText],
]
const relationshipNames = { FS: 'Finish to start', SS: 'Start to start', FF: 'Finish to finish', SF: 'Start to finish' }

export default function PlanningScheduleCanvas({ plan, tasks, disciplines, saving, saveError, locked, ganttLocked = locked, onEdit, onCellEdit, onLogicEdit, onEmployee, onAdd, onInputs, onAnalyze, onRebuild, onRefresh, onSave, onNewVersion, onCompare, onApproval, approvalDisabled, approvalLabel, selectedVersionId = 'current', onVersionChange, onAddWorkstream, onOpenAdvanced, onOpenCreatedSchedule, onBuildSchedule, onCalculate, onValidate, onActivateVersion, buildingSchedule = false, onVerifySources, checksOpenRequest = 0, checking = false, generationRequest = null, onGenerationOpened }) {
  const [tab, setTab] = useState('activities')
  const [controlsVisited, setControlsVisited] = useState(false)
  const [delayVisited, setDelayVisited] = useState(false)
  useEffect(() => { if (tab === 'controls') setControlsVisited(true) }, [tab])
  useEffect(() => { if (tab === 'delay') setDelayVisited(true) }, [tab])
  const [search, setSearch] = useState('')
  const [discipline, setDiscipline] = useState('all')
  const [criticalOnly, setCriticalOnly] = useState(false)
  const [display, setDisplay] = useState('deliverables')
  const [zoom, setZoom] = useState('week')
  const [viewLevel, setViewLevel] = useState('activities')
  const [selectedId, setSelectedId] = useState(null)
  const [evidenceFactId, setEvidenceFactId] = useState(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [buildOpen, setBuildOpen] = useState(false)
  const [sourceLogicOpen, setSourceLogicOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [fitTimeline, setFitTimeline] = useState(false)
  const [timelineFocus, setTimelineFocus] = useState(false)
  const [showLogic, setShowLogic] = useState(true)
  const sourceOnly = plan.duration_policy === 'source_only' || plan.evidence_policy === 'document_driven' || Boolean(plan.duration_review)
  const canvasRef = useRef(null)
  useEffect(() => { if (checksOpenRequest) setTab('assurance') }, [checksOpenRequest])
  useEffect(() => {
    if (generationRequest) {
      if (generationRequest === 'source_logic') setSourceLogicOpen(true)
      else setBuildOpen(true)
      onGenerationOpened?.()
    }
  }, [generationRequest, onGenerationOpened])
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
  const manualHierarchy = plan.hierarchy_source === 'manual_wbs'
  const deliverableCount = deliverables.length + (plan.wbs_nodes || []).filter(node => node.kind === 'deliverable').length
  const deliverableWbsIds = new Set(deliverables.map(item => item.wbs_node_id).filter(id => id != null).map(String))
  const wbsGroupCount = plan.wbs_nodes?.filter(node => !node.is_deliverable && node.kind !== 'deliverable' && !deliverableWbsIds.has(String(node.id))).length ?? groups.length
  const codes = new Map(groups.flatMap(group => group.tasks.map((task, index) => [task.id, task.activity_code || task.external_id || `${group.index + 1}.${index + 1}`])))
  const selected = tasks.find(task => task.id === selectedId)
  const selectedDisplay = selected ? dateDisplayTask(selected) : null
  const selectedDate = field => selectedDisplay?.[`display_${field}_date`]
    ? date(selectedDisplay[`display_${field}_date`]) : missingDateLabel(selectedDisplay, field, { sourceOnly })
  const displayTasks = useMemo(() => tasks.map(task => dateDisplayTask(task)), [tasks])
  const criticalCalculated = plan.calculation_available === true || displayTasks.some(task => typeof task.is_critical === 'boolean')
  const { blockers, warnings, timingWarnings, otherWarnings } = scheduleChecks(plan)
  const blockerGroups = scheduleIssueGroups(blockers)
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
  const isWorkingPlanArea = !['controls', 'delay', 'source-schedule'].includes(tab)
  const filterCount = (discipline !== 'all' ? 1 : 0) + (criticalOnly ? 1 : 0) + (display !== 'deliverables' ? 1 : 0)
  const hasApprovedProfile = plan.planning_profile?.valid === true
  const sourcesVerified = plan.source_verification?.status === 'verified'
  const sourceVerificationLabel = plan.source_verification?.label || 'Sources verified'
  const canBuild = !hasApprovedProfile && onBuildSchedule && !plan.canonical_version && tasks.length > 0 && !plan.viewing_history && !plan.legacy_read_only && plan.state !== 'baselined'
  const contextReadOnly = Boolean(plan.viewing_history || plan.legacy_read_only || selectedVersionId !== 'current' || plan.state === 'baselined')
  const canBuildSourceLogic = !contextReadOnly && plan.permissions?.can_build_source_logic === true && plan.version_id != null && plan.master_revision != null
  const sourceTimingGap = !contextReadOnly && !plan.canonical_version && plan.source_preview_available && tasks.length > 0
    && tasks.every(task => !dateDisplayTask(task).display_start_date && !dateDisplayTask(task).display_finish_date)


  return <section ref={canvasRef} className="schedule-canvas" aria-label="Master schedule workspace">
    <header className="sc-commandbar" aria-label="Schedule toolbar">
      <div className="sc-heading"><CalendarDays size={18} /><h2>Master Schedule</h2>
        <span className="sc-state" title={sequenceStatus.message}>{plan.viewing_history ? 'Read only' : plan.state === 'baselined' ? 'Baseline' : plan.state === 'submitted' ? 'In review' : proposedSequence ? 'Proposed' : 'Draft'}</span>
        {sourcesVerified ? <span className="sc-source-check is-verified" title={sourceVerificationLabel} aria-label={sourceVerificationLabel}><ShieldCheck size={14} /><span>{sourceVerificationLabel}</span></span> : onVerifySources && <button type="button" className="sc-source-check" aria-label="Verify schedule sources" title="Original schedule dates, calendar and logic are not verified. Review source coverage." onClick={onVerifySources}><AlertTriangle size={14} /><span>Unverified</span></button>}
      </div>
      <select className="sc-area-select" aria-label="Schedule workspace area" value={tab} onChange={event => setTab(event.target.value)}>
        {tabs.map(([id, label]) => <option key={id} value={id}>{label}{id === 'assurance' && blockerGroups.length + warnings.length > 0 ? ` (${blockerGroups.length + warnings.length})` : ''}</option>)}
      </select>
      {isGrid && <>
        <select className="sc-level-select" aria-label="Schedule detail level" value={viewLevel} onChange={event => { setViewLevel(event.target.value); setSelectedId(null) }}><option value="project">{manualHierarchy ? 'Project' : 'L1 Project'}</option><option value="wbs">{manualHierarchy ? 'Phases & deliverables' : 'L2 WBS'}</option><option value="activities">{manualHierarchy ? 'Activities' : 'L3 Activities'}</option></select>
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
        {isWorkingPlanArea && canBuildSourceLogic && <button type="button" className="sc-build" disabled={saving || checking || buildingSchedule} onClick={() => setSourceLogicOpen(true)}><GitBranch size={15} /><span>Build logic &amp; sequence</span></button>}
        {isWorkingPlanArea && hasApprovedProfile && !contextReadOnly && <button type="button" className="sc-build" aria-label="Generate plan" disabled={saving || checking || buildingSchedule} onClick={() => setBuildOpen(true)}><Sparkles size={15} /><span>Generate plan</span></button>}
        {isWorkingPlanArea && plan.canonical_version && onCalculate && <button type="button" disabled={saving || checking || !plan.permissions?.can_calculate} onClick={onCalculate}>Calculate schedule</button>}
        {blockers.length > 0 && isWorkingPlanArea && tab !== 'assurance' && <button type="button" className="sc-issues-button" onClick={() => setTab('assurance')}><AlertTriangle size={15} />Review {blockerGroups.length} {blockerGroups.length === 1 ? 'action' : 'actions'}</button>}
        {!blockers.length && timingWarnings.length > 0 && isWorkingPlanArea && tab !== 'assurance' && <button type="button" className="sc-issues-button" onClick={() => setTab('assurance')}><AlertTriangle size={15} />Review {timingWarnings.length} timing {timingWarnings.length === 1 ? 'warning' : 'warnings'}</button>}
        {isWorkingPlanArea && canBuild && <button type="button" aria-label="Build schedule" className={`sc-build ${unsequenced ? 'needs-sequence' : ''}`} disabled={locked || plan.stale_inputs} title={sequenceStatus.message || 'Review source evidence and missing information before applying'} onClick={onBuildSchedule}>{buildingSchedule ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}<span>Build schedule</span></button>}
        {isWorkingPlanArea && <button type="button" className="sc-primary" disabled={locked} onClick={onSave}>{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}Save</button>}
        <ScheduleToolbarMenu name="Schedule actions" className="sc-actions-menu" disabled={saving || buildingSchedule} label={<MoreHorizontal size={19} />}>
          <label>Version<select aria-label="Schedule version" disabled={saving || buildingSchedule || !versions.length} title={versions.length ? 'Select a saved schedule version' : 'Saved versions appear after submission'} value={selectedVersionId} onChange={event => onVersionChange?.(event.target.value)}><option value="current">Current plan{selectedVersionId === 'current' && plan.version_number ? ` \u00b7 v${plan.version_number}` : ''}</option>{versions.map(version => <option key={version.id} value={String(version.id)}>{version.label || `Version ${version.version_number} \u00b7 ${version.status}`}</option>)}</select></label>
          <button type="button" data-close-menu onClick={() => setExportOpen(true)}><FileText size={16} />Export schedule</button>
          <button type="button" data-close-menu disabled={!onCompare} onClick={onCompare}><GitCompare size={16} />Compare</button>
          {plan.permissions?.can_select_version && onActivateVersion && selectedVersionId !== 'current' && <button type="button" data-close-menu disabled={saving || checking || plan.master_revision == null} onClick={() => onActivateVersion(plan.version_id)}>Use this version in Master Schedule</button>}
          {plan.canonical_version && plan.permissions?.can_select_version && onActivateVersion && <button type="button" data-close-menu disabled={saving || checking || plan.master_revision == null} onClick={() => onActivateVersion(null)}>Open preserved working draft</button>}
          <button type="button" data-close-menu disabled={plan.state !== 'baselined' || !plan.permissions?.can_reopen} onClick={onNewVersion}><Plus size={16} />New version</button>
          <button type="button" data-close-menu disabled={plan.canonical_version && !plan.permissions?.can_validate} onClick={() => { setTab('assurance'); if (plan.canonical_version) onValidate?.(); else onRefresh() }}><ShieldCheck size={16} />Validate</button>
          {onVerifySources && <button type="button" data-close-menu onClick={onVerifySources}><FileText size={16} />Verify sources</button>}
          <button type="button" data-close-menu onClick={onInputs}><FileText size={16} />Project inputs</button>
          {plan.project_id || plan.project?.id ? <button type="button" data-close-menu disabled={contextReadOnly} onClick={() => setBuildOpen(true)}><Sparkles size={16} />Generate project plan</button> : null}
          {plan.project_id || plan.project?.id ? <button type="button" data-close-menu onClick={() => setProfileOpen(true)}><ShieldCheck size={16} />Planning profile</button> : null}
          {tasks.length > 0 && onRebuild && <button type="button" data-close-menu disabled={locked} onClick={onRebuild}><Sparkles size={16} />Rebuild draft from inputs</button>}
          {!tasks.length && onAnalyze && <button type="button" data-close-menu onClick={onAnalyze}><Sparkles size={16} />Analyze & build</button>}
          {onAddWorkstream && <button type="button" data-close-menu disabled={locked} onClick={onAddWorkstream}><Plus size={16} />Add workstream</button>}
        </ScheduleToolbarMenu>
      </div>
    </header>
    {(plan.legacy_read_only || plan.viewing_history) && <div className="sc-read-only"><ShieldCheck size={16} /><span>{plan.read_only_reason || 'This saved schedule version is read only. Select the current plan to edit.'}</span>{plan.legacy_read_only && onOpenAdvanced && <button type="button" onClick={onOpenAdvanced}>Open Schedule Controls<ArrowRight size={14} /></button>}</div>}
    {isGrid && sourceTimingGap && <div className="sc-source-gap"><p><strong>Source timing needs linking.</strong> The project dates set the planning window. Review the recovered schedule rows and link them to the MDR before calculating the plan.</p><button type="button" onClick={() => setTab('source-schedule')}>Review extracted schedule</button></div>}
    {isGrid && plan.source_logic && <PlanningSourceLogicSummary logic={plan.source_logic} onViewSource={onVersionChange} />}
    {isGrid && <>
      <div className={`sc-body ${selected ? 'has-selection' : ''}`}>
        <PrimaveraActivitiesGantt key={`${plan.project_id || plan.project?.id}:${plan.version_id || "draft"}:${selectedVersionId}`} plan={plan} tasks={tasks} disciplines={disciplines} search={search} discipline={discipline}
          criticalOnly={criticalOnly} display={display} level={viewLevel} zoom={zoom} fitTimeline={fitTimeline} selectedId={selectedId} locked={ganttLocked}
          timelineFocus={timelineFocus} onTimelineFocusChange={setTimelineFocus}
          showTimeline={tab === 'activities'} showLogic={showLogic} onSelect={task => selectTask(task.id)} onEdit={onEdit} onCellEdit={onCellEdit} onLogicEdit={onLogicEdit} onInputs={onInputs} />
      {selected && <aside ref={drawerRef} tabIndex={-1} className="sc-detail-drawer" aria-label="Activity details" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeDetails() } }}><header><h3>Activity details</h3><button type="button" aria-label="Close activity details" onClick={closeDetails}><X size={18} /></button></header><span className="sc-detail-code">Activity ID {codes.get(selected.id)}</span><h4>{selected.title}</h4><PlanningFieldProvenance provenance={selected.field_provenance?.title} /><dl><div><dt>Assigned to</dt><dd>{selected.assignee_id ? <EmployeeActivityLink task={selected} onOpen={onEmployee} disabled={saving || buildingSchedule} /> : 'Unassigned'}<PlanningFieldProvenance provenance={selected.field_provenance?.assignee_id} /></dd></div>{(selected.responsible_role || selected.workflow_responsible_party) && <div><dt>Responsible role</dt><dd>{selected.responsible_role || selected.workflow_responsible_party}</dd></div>}<div><dt>Duration</dt><dd>{missingSourceDuration(selected) ? 'Not Specified' : selected.duration_days == null ? 'Not Specified' : `${number(selected.duration_days)} ${durationUnitLabel(selected)}`}{selected.duration_source === 'proposed' && <span className="sc-proposed">Proposed</span>}<PlanningFieldProvenance provenance={selected.field_provenance?.duration_days} /></dd></div><div><dt>Start</dt><dd>{selectedDate('start')}<PlanningFieldProvenance provenance={selected.field_provenance?.planned_start_date} /></dd></div><div><dt>Finish</dt><dd>{selectedDate('finish')}<PlanningFieldProvenance provenance={selected.field_provenance?.planned_finish_date} /></dd></div>{selected.due_date && selected.due_date !== selected.planned_finish_date && <div><dt>Employee due date</dt><dd>{date(selected.due_date)}</dd></div>}<div><dt>Total float</dt><dd title={floatEvidenceLabel(selectedDisplay)}>{selectedDisplay.display_total_float_days == null ? 'Not calculated' : `${number(selectedDisplay.display_total_float_days)} days`}{selectedDisplay.display_float_basis === 'source' && <small>Source value &middot; not calculated</small>}</dd></div><div><dt>Planned effort</dt><dd>{selected.effort_hours == null ? 'Not Specified' : `${number(selected.effort_hours)} hours`}<PlanningFieldProvenance provenance={selected.field_provenance?.effort_hours} /></dd></div></dl>{selectedDisplay.display_date_basis === 'source' && <section aria-label="Source dates"><h5>Source dates</h5><p className="sc-muted">{dateEvidenceLabel(selectedDisplay)}</p></section>}{plan.source_logic && <SourceLogicComparison summary={{ source_start_date: selected.source_start_date, source_finish_date: selected.source_finish_date, source_start_status: selected.source_start_status, source_finish_status: selected.source_finish_status, source_duration_days: selected.original_duration_days ?? (['planner', 'manual', 'retained_manual', 'manual_unverified'].includes(selected.duration_source) ? null : selected.duration_days), source_duration_unit: selected.duration_unit, calculated_duration_days: selected.duration_days, source_total_float_status: selected.source_total_float_status, source_total_float_days: selected.source_total_float_days, calculated_total_float_days: selectedDisplay.display_float_basis === 'calculated' ? selectedDisplay.display_total_float_days : null, calculated_start_date: selectedDisplay.display_date_basis === 'calculated' ? selectedDisplay.display_start_date : null, calculated_finish_date: selectedDisplay.display_date_basis === 'calculated' ? selectedDisplay.display_finish_date : null }} />}<button type="button" className="sc-detail-edit" onClick={() => { setEvidenceFactId(selected.evidence_fact_id || selected.evidence_fact_ids?.[0] || null); setTab('evidence') }}><FileText size={15} />Review source evidence</button><h5>Duration evidence</h5><ActivityDurationEvidence task={selected} row={durationEvidenceRow(plan.duration_review, selected)} /><h5>Depends on</h5><PlanningFieldProvenance provenance={selected.field_provenance?.depends_on} />{selectedDependencies.length ? <ul>{selectedDependencies.map(task => <li key={task.id}>{codes.get(task.id)} · {task.title}</li>)}</ul> : <p className="sc-muted">Not Specified</p>}<h5>Acceptance criteria</h5><p className="sc-muted">{selected.acceptance_criteria || 'Not Specified'}</p><button type="button" className="sc-detail-edit" disabled={locked} onClick={() => onEdit(selected)}><Pencil size={15} />Edit activity</button></aside>}</div>
    </>}
    {tab === 'logic' && <div className="sc-tab-content"><h3>Activity dependencies</h3><p className="sc-muted">Review predecessor evidence before approving the schedule.</p><div className="sc-secondary-table"><table><thead><tr><th>Predecessor</th><th>Successor</th><th>Relationship</th><th>Evidence</th><th /></tr></thead><tbody>{tasks.flatMap(task => scheduleDependencyEntries(task, { sourceOnly }).map(({ predecessorId: id, detail, reason, type, lagValue: lag }) => {
      const predecessor = tasks.find(item => String(item.id) === String(id))
      const evidence = { ...(typeof reason === 'object' ? reason : {}), ...detail }
      return <tr key={`${task.id}-${id}-${type}`}><td>{predecessor?.title || id}</td><td>{task.title}</td><td>{relationshipNames[type] || type || 'Not Specified'}{sourceOnly || lag != null ? <small>Lag: {lag == null || lag === '' ? 'Not Specified' : `${number(lag)} d`}</small> : null}</td><td><strong>{dependencyEvidenceLabel(evidence)}</strong>{(evidence.source_references || []).map((source, index) => <p key={index}>{sourceLabel(source)}{source.excerpt && <q>{source.excerpt}</q>}</p>)}</td><td><button type="button" disabled={ganttLocked} onClick={() => onEdit(task, 'dependencies')}>Edit</button></td></tr>
    }))}{!tasks.some(task => scheduleDependencyEntries(task, { sourceOnly }).length) && <tr><td colSpan={5}>Not Specified: no predecessor relationships recorded.</td></tr>}</tbody></table></div></div>}
    {tab === 'resources' && <div className="sc-tab-content"><PlanningResourceRequirements requirements={plan.resource_requirements} tasks={tasks} /><PlanningResourcePlan projectId={plan.project_id || plan.project?.id} versionId={plan.version_id} readOnly={contextReadOnly || saving || buildingSchedule} onChanged={onRefresh} /><h3>Employee assignments</h3><p className="sc-muted">Assigned work is available in each employee’s My Work Hub.</p><div className="sc-secondary-table"><table><thead><tr><th>Employee</th><th>Activities</th><th>Planned effort</th><th /></tr></thead><tbody>{resources.map(person => <tr key={person.id}><td>{person.id === 'unassigned' ? <span className="sc-resource-missing">Unassigned</span> : <EmployeeActivityLink task={person.task} onOpen={onEmployee} disabled={saving || buildingSchedule} />}</td><td>{person.tasks.length}</td><td>{number(person.effort)} hours</td><td><button type="button" disabled={locked} onClick={() => onEdit(person.task, 'owner')}>{person.id === 'unassigned' ? 'Assign employee' : 'Review assignment'}</button></td></tr>)}</tbody></table></div></div>}
    {tab === 'risks' && <div className="sc-tab-content">{plan.project_id || plan.project?.id ? <PlanningRiskRegister projectId={plan.project_id || plan.project?.id} versionId={plan.version_id} readOnly={Boolean(plan.viewing_history || plan.legacy_read_only || selectedVersionId !== 'current')} onChanged={onRefresh} /> : <p>Link a project to review its risk register.</p>}</div>}
    {(tab === 'controls' || controlsVisited) && <div className="sc-tab-content" hidden={tab !== 'controls'} style={tab !== 'controls' ? { display: 'none' } : undefined}><PlanningOperationalControls key={`${plan.project_id || plan.project?.id}:${plan.version_id || 'draft'}`} projectId={plan.project_id || plan.project?.id} baselineId={plan.baseline?.id} readOnly={Boolean(plan.viewing_history || plan.legacy_read_only || selectedVersionId !== 'current')} /></div>}
    {(tab === 'delay' || delayVisited) && <div className="sc-tab-content" hidden={tab !== 'delay'} style={tab !== 'delay' ? { display: 'none' } : undefined}><PlanningDelayAnalysis key={`${plan.project_id || plan.project?.id}:${plan.version_id || 'draft'}`} projectId={plan.project_id || plan.project?.id} baselineId={plan.baseline?.id} readOnly={Boolean(plan.viewing_history || plan.legacy_read_only || selectedVersionId !== 'current')} /></div>}
    {tab === 'assurance' && <div className="sc-tab-content"><PlanningScheduleChecks plan={plan} tasks={tasks} locked={locked} busy={saving || buildingSchedule || checking} onEdit={onEdit} onInputs={onInputs} onRefresh={onRefresh} onVerifySources={onVerifySources} onEvidence={() => setTab('evidence')} onSources={() => setTab('source-schedule')} />{otherWarnings.length > 0 && <><h4>Warnings</h4><ul className="sc-checks">{otherWarnings.map((item, index) => <li key={index}><AlertTriangle size={17} /><span>{item.message || item.description || item.detail || item.code}</span></li>)}</ul></>}{(plan.assumptions || []).length > 0 && <><h4>Planning assumptions</h4><ul className="sc-assumptions">{plan.assumptions.map((item, index) => <li key={index}><Sparkles size={15} />{typeof item === 'string' ? item : item.message || item.description || item.label}</li>)}</ul></>}</div>}
    {tab === 'source-schedule' && <PlanningSourceSchedule key={plan.project_id || plan.project?.id} projectId={plan.project_id || plan.project?.id} projectName={[plan.project?.code, plan.project?.name].filter(Boolean).join(' - ')} masterRevision={plan.master_revision} readOnly={contextReadOnly || saving || buildingSchedule} onApplied={result => { onOpenCreatedSchedule?.(result); setTab('activities'); setSelectedId(null) }} onBack={() => setTab('activities')} onInputs={onInputs} onEvidence={() => { setEvidenceFactId(null); setTab('evidence') }} />}
    {tab === 'evidence' && <div className="sc-tab-content"><header className="sc-assurance-heading"><h3>Source evidence</h3><button type="button" disabled={saving || buildingSchedule} onClick={onInputs}><FileText size={15} />Manage inputs</button></header><PlanningEvidenceReview projectId={plan.project_id || plan.project?.id} readOnly={contextReadOnly || saving || buildingSchedule} focusFactId={evidenceFactId} scheduleVersionId={plan.version_id} onScheduleCreated={result => { onOpenCreatedSchedule?.(result); setTab('activities'); setSelectedId(null) }} /><PlanningDurationEvidence review={plan.duration_review} />{(plan.source_documents || []).map(file => <p className="sc-source" key={file.id}><FileText size={16} />{file.name || file.original_filename}</p>)}<PlanningSourceEvidenceTable tasks={tasks} review={plan.duration_review} sourceDocuments={plan.source_documents} /></div>}
    {isWorkingPlanArea && <footer className="sc-footer">{deliverableCount > 0 && <span><strong>{deliverableCount}</strong> deliverables</span>}<span><strong>{tasks.length}</strong> activities</span><span><strong>{wbsGroupCount}</strong> WBS groups</span><span title={criticalCalculated ? plan.source_logic ? 'Calculated using the partial stage network and declared planning calendar; dependency review remains open' : 'From the calculated schedule' : 'Critical path has not been calculated'}><strong>{criticalCalculated ? displayTasks.filter(task => task.is_critical).length : '\u2014'}</strong> critical</span><span><strong>{tasks.reduce((sum, task) => sum + scheduleDependencyEntries(task, { sourceOnly }).length, 0)}</strong> relationships</span><span className="sc-save-status" role="status">{saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : saveError ? <><AlertTriangle size={14} />Changes not saved</> : <><CheckCircle2 size={14} />Changes saved</>}</span>{onApproval && <button type="button" className="sc-primary" disabled={saving || buildingSchedule || approvalDisabled} onClick={onApproval}>{approvalLabel || 'Submit for approval'}<ArrowRight size={15} /></button>}</footer>}
    {exportOpen && <PlanningContextDrawer title="Export schedule" onClose={() => setExportOpen(false)}><PlanningExportPanel versionId={plan.version_id} /></PlanningContextDrawer>}
    {sourceLogicOpen && <PlanningSourceLogic key={`${plan.version_id}:${plan.master_revision}`} projectId={plan.project_id || plan.project?.id} sourceVersionId={plan.version_id} masterRevision={plan.master_revision} readOnly={!canBuildSourceLogic || saving || buildingSchedule} onClose={() => setSourceLogicOpen(false)} onApplied={result => { setSourceLogicOpen(false); setSelectedId(null); setTab('activities'); onOpenCreatedSchedule?.(result) }} />}
    {buildOpen && <PlanningBuildDrawer projectId={plan.project_id || plan.project?.id} readOnly={contextReadOnly} onClose={() => setBuildOpen(false)} onProfile={() => { setBuildOpen(false); setProfileOpen(true) }} onEvidence={id => { setBuildOpen(false); setEvidenceFactId(id); setTab('evidence') }} onApplied={result => { setBuildOpen(false); setSelectedId(null); setTab('activities'); onOpenCreatedSchedule?.(result) }} />}
    {profileOpen && <PlanningProfilePanel projectId={plan.project_id || plan.project?.id} readOnly={contextReadOnly} onClose={() => setProfileOpen(false)} onChanged={onRefresh} />}
  </section>
}

PlanningScheduleCanvas.propTypes = {
  plan: PropTypes.object.isRequired, tasks: PropTypes.array.isRequired, disciplines: PropTypes.array.isRequired,
  saving: PropTypes.bool, saveError: PropTypes.string, locked: PropTypes.bool, ganttLocked: PropTypes.bool, onCellEdit: PropTypes.func, onLogicEdit: PropTypes.func, onEdit: PropTypes.func.isRequired, onEmployee: PropTypes.func.isRequired,
  onAdd: PropTypes.func.isRequired, onInputs: PropTypes.func.isRequired, onAnalyze: PropTypes.func, onRebuild: PropTypes.func, onRefresh: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired, onNewVersion: PropTypes.func.isRequired, onCompare: PropTypes.func,
  onApproval: PropTypes.func, approvalDisabled: PropTypes.bool, approvalLabel: PropTypes.string,
  selectedVersionId: PropTypes.string, onVersionChange: PropTypes.func, onAddWorkstream: PropTypes.func, onOpenAdvanced: PropTypes.func,
  onBuildSchedule: PropTypes.func, buildingSchedule: PropTypes.bool, onVerifySources: PropTypes.func,
  generationRequest: PropTypes.oneOf(['plan', 'source_logic']), onGenerationOpened: PropTypes.func,
  checksOpenRequest: PropTypes.number, checking: PropTypes.bool, onOpenCreatedSchedule: PropTypes.func, onCalculate: PropTypes.func, onValidate: PropTypes.func, onActivateVersion: PropTypes.func,
}
