import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, ChevronDown, FileText, GitBranch, GitCompare, ListTree, Loader2, MoreHorizontal, Plus, Save, Search, ShieldCheck, SlidersHorizontal, Sparkles, Users } from 'lucide-react'
import { EmployeeActivityLink } from './WorkBreakdownPanel'
import PrimaveraActivitiesGantt from './PrimaveraActivitiesGantt'
import PlanningScheduleChecks from './PlanningScheduleChecks'
import PlanningDurationEvidence from './PlanningDurationEvidence'
import PlanningEvidenceReview from './PlanningEvidenceReview'
import PlanningSourceEvidenceTable from './PlanningSourceEvidenceTable'
import PlanningSourceSchedule from './PlanningSourceSchedule'
import PlanningSourceLogic, { PlanningSourceLogicSummary } from './PlanningSourceLogic'
import PlanningProfilePanel from './PlanningProfilePanel'
import PlanningBuildDrawer from './PlanningBuildDrawer'
import PlanningContextDrawer from './PlanningContextDrawer'
import PlanningExportPanel from './PlanningExportPanel'
import GanttPdfExportPanel from './GanttPdfExportPanel'
import PlanningRiskRegister from './PlanningRiskRegister'
import PlanningResourceRequirements from './PlanningResourceRequirements'
import PlanningResourcePlan from './PlanningResourcePlan'
import PlanningOperationalControls from './PlanningOperationalControls'
import PlanningDelayAnalysis from './PlanningDelayAnalysis'
import ScheduleActivityInspector from './ScheduleActivityInspector'
import ScheduleWarnings from './ScheduleWarnings'
import { dependencyEvidenceLabel } from '../../utils/planningDurationEvidence'
import { dateDisplayTask } from '../../utils/planningDateEvidence'
import { scheduleDependencyEntries } from '../../utils/primaveraDependencies'
import { scheduleChecks, scheduleIssueGroups } from './scheduleCheckPolicy'
import ScheduleToolbarMenu from './ScheduleToolbarMenu'
import useScheduleViewport from './useScheduleViewport'
import './PlanningScheduleCanvas.css'

const number = value => new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(Number(value || 0))
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

export default function PlanningScheduleCanvas({ plan, tasks, disciplines, saving, saveError, locked, ganttLocked = locked, onEdit, onDelete, onEditWbs, onDeleteWbs, canEditWbs, onCellEdit, onLogicEdit, onEmployee, onAdd, onInputs, onAnalyze, onRebuild, onRefresh, onSave, onNewVersion, onCompare, onApproval, approvalDisabled, approvalLabel, selectedVersionId = 'current', onVersionChange, onAddWorkstream, onOpenAdvanced, onOpenCreatedSchedule, onBuildSchedule, onCalculate, onValidate, onActivateVersion, onReviewLogic, buildingSchedule = false, onVerifySources, checksOpenRequest = 0, checking = false, generationRequest = null, onGenerationOpened }) {
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
  const [ganttToolbar, setGanttToolbar] = useState(null)
  const [ganttLegend, setGanttLegend] = useState(null)
  const [ganttDisplayOptions, setGanttDisplayOptions] = useState(null)
  const [showBaseline, setShowBaseline] = useState(false)
  const [warningsOpen, setWarningsOpen] = useState(false)
  const closeWarnings = useCallback(() => setWarningsOpen(false), [])
  useEffect(() => {
    const review = () => setWarningsOpen(true)
    const exportSchedule = () => setExportOpen(true)
    window.addEventListener('radai:review-schedule-issues', review)
    window.addEventListener('radai:export-master-schedule', exportSchedule)
    return () => {
      window.removeEventListener('radai:review-schedule-issues', review)
      window.removeEventListener('radai:export-master-schedule', exportSchedule)
    }
  }, [])
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
  const triggerRef = useRef(null)
  const selectTask = id => { triggerRef.current = document.activeElement; setSelectedId(id) }
  const closeDetails = () => { setSelectedId(null); triggerRef.current?.focus() }
  const groups = disciplines.map((group, index) => ({ ...group, index, tasks: tasks.filter(task => task.discipline === group.code) }))
  const deliverables = plan.deliverables || []
  const manualHierarchy = plan.hierarchy_source === 'manual_wbs'
  const deliverableCount = deliverables.length + (plan.wbs_nodes || []).filter(node => node.kind === 'deliverable').length
  const deliverableWbsIds = new Set(deliverables.map(item => item.wbs_node_id).filter(id => id != null).map(String))
  const wbsGroupCount = plan.wbs_nodes?.filter(node => !node.is_deliverable && node.kind !== 'deliverable' && !deliverableWbsIds.has(String(node.id))).length ?? groups.length
  const codes = new Map(groups.flatMap(group => group.tasks.map((task, index) => [task.id, task.activity_code || task.external_id || `${group.index + 1}.${index + 1}`])))
  const selected = tasks.find(task => task.id === selectedId)
  const selectedDisplay = selected ? dateDisplayTask(selected) : null
  const displayTasks = useMemo(() => tasks.map(task => dateDisplayTask(task)), [tasks])
  const criticalCalculated = plan.calculation_available === true || displayTasks.some(task => typeof task.is_critical === 'boolean')
  const { blockers, warnings, otherWarnings } = scheduleChecks(plan)
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
  const sequenceStatus = plan.scheduling_status || {}
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
  const baselineAvailable = tasks.some(task => {
    const dates = [task.baseline_start_date, task.baseline_finish_date].map(value => String(value || '').slice(0, 10))
    return dates.every(value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value) && dates[0] <= dates[1]
  })
  const issueCount = blockerGroups.length + warnings.length + Number(Boolean(plan.stale_inputs)) + Number(Boolean(sourceTimingGap))
  const logicReviewCount = plan.logic_quality?.summary?.unreviewed_group_count ?? plan.logic_quality?.summary?.requires_review_count
    ?? plan.logic_quality?.groups?.filter(group => group.requires_review).length ?? 0
  const logicIssues = [...blockers, ...warnings].filter(issue => /dependency|logic|predecessor|successor|cycle|sequence/.test(issue.code || ''))


  return <section ref={canvasRef} className="schedule-canvas" aria-label="Master schedule workspace">
    <header className="sc-commandbar" aria-label="Schedule toolbar">
      <div className="sc-heading"><CalendarDays size={17} /><h2>Master Schedule</h2>
        <span className="sc-state" title={sequenceStatus.message}>{plan.viewing_history ? 'Read only' : plan.state === 'baselined' ? 'Baseline' : plan.state === 'submitted' ? 'In review' : proposedSequence ? 'Proposed' : 'Draft'}</span>
        {sourcesVerified ? <span className="sc-source-check is-verified" title={sourceVerificationLabel} aria-label={sourceVerificationLabel}><ShieldCheck size={13} /><span>{sourceVerificationLabel}</span></span> : onVerifySources && <button type="button" className="sc-source-check" aria-label="Verify schedule sources" title="Original schedule dates, calendar and logic are not verified. Review source coverage." onClick={onVerifySources}><AlertTriangle size={13} /><span>Unverified</span></button>}
      </div>
      <div className="sc-command-actions">
        {plan.logic_quality && onReviewLogic && <button type="button" className={logicReviewCount ? 'sc-issues-button' : undefined} aria-label="Review schedule logic" title={`${logicReviewCount} groups require review`} disabled={saving || checking || buildingSchedule} onClick={onReviewLogic}><GitBranch size={16} />Review schedule logic ({logicReviewCount})</button>}
        {isWorkingPlanArea && <button type="button" className="sc-calculate" disabled={saving || checking || buildingSchedule || !plan.canonical_version || !plan.permissions?.can_calculate} title={!plan.canonical_version ? 'Build and review a schedule version before calculating' : undefined} onClick={onCalculate}>Calculate schedule</button>}
        <button type="button" className="sc-issues-button" aria-expanded={warningsOpen} onClick={() => setWarningsOpen(value => !value)}><AlertTriangle size={16} />{issueCount ? `Review ${issueCount} ${issueCount === 1 ? 'issue' : 'issues'}` : 'Review issues'}</button>
        <span className={`sc-saved ${saveError ? 'has-error' : ''}`} role="status">{saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : saveError ? <><AlertTriangle size={14} />Not saved</> : <><CheckCircle2 size={14} />Saved</>}</span>

      </div>
    </header>
    <div className="sc-filterbar">
      <select className="sc-area-select" aria-label="Schedule workspace area" value={tab} onChange={event => setTab(event.target.value)}>
        {tabs.map(([id, label]) => <option key={id} value={id}>{label}{id === 'assurance' && blockerGroups.length + warnings.length > 0 ? ` (${blockerGroups.length + warnings.length})` : ''}</option>)}
      </select>
      {isGrid && <>
        <select className="sc-level-select" aria-label="Schedule detail level" value={viewLevel} onChange={event => { setViewLevel(event.target.value); setSelectedId(null) }}><option value="project">{manualHierarchy ? 'Project' : 'L1 Project'}</option><option value="wbs">{manualHierarchy ? 'Phases & deliverables' : 'L2 WBS'}</option><option value="activities">{manualHierarchy ? 'Activities' : 'L3 Activities'}</option></select>
        <label className="sc-search"><Search size={14} /><input aria-label="Search schedule activities" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search activity ID or name" /></label>
        <ScheduleToolbarMenu name="Schedule filters" className={`sc-filters-menu ${filterCount ? 'has-filters' : ''}`} label={<><SlidersHorizontal size={14} /><span>Filters</span>{filterCount > 0 && <b>{filterCount}</b>}</>}>
          <label>Discipline<select aria-label="Schedule discipline" value={discipline} onChange={event => setDiscipline(event.target.value)}><option value="all">All disciplines</option>{groups.map(group => <option key={group.code} value={group.code}>{group.name}</option>)}</select></label>
          <div className="sc-segment" role="group" aria-label="Activity grouping"><button type="button" aria-pressed={display === 'deliverables'} onClick={() => setDisplay('deliverables')}>Deliverables</button><button type="button" aria-label="All activities" aria-pressed={display === 'activities'} onClick={() => setDisplay('activities')}>Flat activities</button></div>
          <label className="sc-check-option"><input type="checkbox" checked={showLogic} onChange={event => setShowLogic(event.target.checked)} />Show dependency links</label>
          {filterCount > 0 && <button type="button" onClick={() => { setDiscipline('all'); setCriticalOnly(false); setDisplay('deliverables') }}>Reset filters</button>}
        </ScheduleToolbarMenu>
        <label className="sc-check-option sc-critical"><input type="checkbox" aria-label="Critical only" checked={criticalOnly} disabled={!criticalCalculated} title={criticalCalculated ? 'Show activities on the calculated critical path' : 'Critical path has not been calculated'} onChange={event => setCriticalOnly(event.target.checked)} /><span>Critical path</span></label>
        <label className="sc-check-option sc-critical sc-baseline" title={baselineAvailable ? 'Show approved baseline dates alongside the working schedule' : 'Approved baseline activity dates are not available in this view'}><input type="checkbox" aria-label="Baseline" checked={showBaseline} disabled={!baselineAvailable} onChange={event => setShowBaseline(event.target.checked)} /><span>Baseline</span></label>
        <div className="sc-timeline-tools" ref={setGanttToolbar} />
      </>}
        <ScheduleToolbarMenu name="Schedule actions" className="sc-actions-menu" disabled={saving || buildingSchedule} label={<MoreHorizontal size={19} />}>
          {isGrid && <div ref={setGanttDisplayOptions} className="sc-display-options" />}
          {isWorkingPlanArea && canBuild && <button type="button" data-close-menu disabled={locked || plan.stale_inputs} onClick={onBuildSchedule}><Sparkles size={16} />Build schedule</button>}
          {isWorkingPlanArea && hasApprovedProfile && !contextReadOnly && <button type="button" data-close-menu disabled={saving || checking || buildingSchedule} onClick={() => setBuildOpen(true)}><Sparkles size={16} />Generate plan</button>}
          {isWorkingPlanArea && canBuildSourceLogic && <button type="button" data-close-menu disabled={saving || checking || buildingSchedule} onClick={() => setSourceLogicOpen(true)}><GitBranch size={16} />Build logic &amp; sequence</button>}
          <button type="button" data-close-menu disabled={locked} onClick={onAdd}><Plus size={16} />Add activity</button>
          <button type="button" data-close-menu disabled={locked} onClick={onSave}><Save size={16} />Save draft</button>
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
    {(plan.legacy_read_only || plan.viewing_history) && <div className="sc-read-only"><ShieldCheck size={16} /><span>{plan.read_only_reason || 'This saved schedule version is read only. Select the current plan to edit.'}</span>{plan.legacy_read_only && onOpenAdvanced && <button type="button" onClick={onOpenAdvanced}>Open Schedule Controls<ArrowRight size={14} /></button>}</div>}
    {isGrid && <>
      <div className={`sc-body ${selected ? 'has-selection' : ''}`}>
        <PrimaveraActivitiesGantt key={`${plan.project_id || plan.project?.id}:${plan.version_id || "draft"}:${selectedVersionId}`} plan={plan} tasks={tasks} disciplines={disciplines} search={search} discipline={discipline}
          criticalOnly={criticalOnly} display={display} level={viewLevel} zoom={zoom} fitTimeline={fitTimeline} selectedId={selectedId} locked={ganttLocked}
          timelineFocus={timelineFocus} onTimelineFocusChange={setTimelineFocus}
          toolbarTarget={ganttToolbar} legendTarget={ganttLegend} displayOptionsTarget={ganttDisplayOptions} showBaseline={showBaseline && baselineAvailable} onShowLogicChange={setShowLogic} onZoomChange={value => { setZoom(value); setFitTimeline(false) }} onFitTimelineChange={setFitTimeline}
          showTimeline={tab === 'activities'} showLogic={showLogic} onSelect={task => selectTask(task.id)} onEdit={onEdit} onDelete={onDelete} onEditWbs={onEditWbs} onDeleteWbs={onDeleteWbs} canEditWbs={canEditWbs} onCellEdit={onCellEdit} onLogicEdit={onLogicEdit} onInputs={onInputs} />
      {selected && <ScheduleActivityInspector task={selected} displayTask={selectedDisplay} plan={plan} tasks={tasks} codes={codes} sourceOnly={sourceOnly} locked={locked} logicLocked={ganttLocked} busy={saving || buildingSchedule} onClose={closeDetails} onEdit={onEdit} onEmployee={onEmployee} onEvidence={task => { setEvidenceFactId(task.evidence_fact_id || task.evidence_fact_ids?.[0] || task.source_fact_id || null); setTab('evidence') }} />}</div>
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
    {tab === 'assurance' && <div className="sc-tab-content"><PlanningScheduleChecks plan={plan} tasks={tasks} locked={locked} busy={saving || buildingSchedule || checking} onEdit={onEdit} onInputs={onInputs} onRefresh={onRefresh} onVerifySources={onVerifySources} onEvidence={() => setTab('evidence')} onSources={() => setTab('source-schedule')} onReviewLogic={onReviewLogic} />{otherWarnings.length > 0 && <><h4>Warnings</h4><ul className="sc-checks">{otherWarnings.map((item, index) => <li key={index}><AlertTriangle size={17} /><span>{item.message || item.description || item.detail || item.code}</span></li>)}</ul></>}{(plan.assumptions || []).length > 0 && <><h4>Planning assumptions</h4><ul className="sc-assumptions">{plan.assumptions.map((item, index) => <li key={index}><Sparkles size={15} />{typeof item === 'string' ? item : item.message || item.description || item.label}</li>)}</ul></>}</div>}
    {tab === 'source-schedule' && <PlanningSourceSchedule key={plan.project_id || plan.project?.id} projectId={plan.project_id || plan.project?.id} projectName={[plan.project?.code, plan.project?.name].filter(Boolean).join(' - ')} masterRevision={plan.master_revision} readOnly={contextReadOnly || saving || buildingSchedule} onApplied={result => { onOpenCreatedSchedule?.(result); setTab('activities'); setSelectedId(null) }} onBack={() => setTab('activities')} onInputs={onInputs} onEvidence={() => { setEvidenceFactId(null); setTab('evidence') }} />}
    {tab === 'evidence' && <div className="sc-tab-content"><header className="sc-assurance-heading"><h3>Source evidence</h3><button type="button" disabled={saving || buildingSchedule} onClick={onInputs}><FileText size={15} />Manage inputs</button></header><PlanningEvidenceReview projectId={plan.project_id || plan.project?.id} readOnly={contextReadOnly || saving || buildingSchedule} focusFactId={evidenceFactId} scheduleVersionId={plan.version_id} onScheduleCreated={result => { onOpenCreatedSchedule?.(result); setTab('activities'); setSelectedId(null) }} /><PlanningDurationEvidence review={plan.duration_review} />{(plan.source_documents || []).map(file => <p className="sc-source" key={file.id}><FileText size={16} />{file.name || file.original_filename}</p>)}<PlanningSourceEvidenceTable tasks={tasks} review={plan.duration_review} sourceDocuments={plan.source_documents} /></div>}
    {isWorkingPlanArea && <footer className="sc-footer">
      <span title={deliverableCount ? `${deliverableCount} deliverables` : undefined}><strong>{number(tasks.length)}</strong> activities</span>
      <span><strong>{number(wbsGroupCount)}</strong> WBS groups</span>
      <span><strong>{number(tasks.reduce((sum, task) => sum + scheduleDependencyEntries(task, { sourceOnly }).length, 0))}</strong> relationships</span>
      {logicIssues.length > 0 && <button type="button" className="sc-logic-issues" onClick={() => setWarningsOpen(true)}><strong>{number(logicIssues.length)}</strong> logic issues</button>}
      <span className={criticalCalculated ? 'sc-critical-count' : 'sc-critical-unavailable'}>{criticalCalculated ? <><strong>{displayTasks.filter(task => task.is_critical).length}</strong> critical activities</> : <><AlertTriangle size={15} />Critical path unavailable</>}</span>
      {isGrid && <div className="sc-legend-slot" ref={setGanttLegend} />}
      <span className="sc-save-status" role="status">{saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : saveError ? <><AlertTriangle size={14} />Changes not saved</> : <><CheckCircle2 size={14} />Changes saved</>}</span>
      {onApproval && <button type="button" className="sc-approval" disabled={saving || buildingSchedule || approvalDisabled} onClick={onApproval}>{approvalLabel || 'Review & approve'}<ChevronDown size={14} /></button>}
    </footer>}
    {warningsOpen && <ScheduleWarnings issues={[...blockerGroups, ...warnings]} staleInputs={Boolean(plan.stale_inputs)} sourceTimingGap={Boolean(sourceTimingGap)} onClose={closeWarnings} onReview={() => setTab('assurance')} onInputs={onInputs} onSources={() => setTab('source-schedule')}>
      {plan.source_logic && <PlanningSourceLogicSummary logic={plan.source_logic} onViewSource={onVersionChange} />}
    </ScheduleWarnings>}
    {exportOpen && <PlanningContextDrawer title="Export schedule" onClose={() => setExportOpen(false)}><GanttPdfExportPanel plan={plan} tasks={tasks} disciplines={disciplines} filters={{ search, discipline, criticalOnly }} zoom={zoom} showLogic={showLogic} showBaseline={showBaseline} /><PlanningExportPanel versionId={plan.version_id} /></PlanningContextDrawer>}
    {sourceLogicOpen && <PlanningSourceLogic key={`${plan.version_id}:${plan.master_revision}`} projectId={plan.project_id || plan.project?.id} sourceVersionId={plan.version_id} masterRevision={plan.master_revision} readOnly={!canBuildSourceLogic || saving || buildingSchedule} onClose={() => setSourceLogicOpen(false)} onApplied={result => { setSourceLogicOpen(false); setSelectedId(null); setTab('activities'); onOpenCreatedSchedule?.(result) }} />}
    {buildOpen && <PlanningBuildDrawer projectId={plan.project_id || plan.project?.id} readOnly={contextReadOnly} onClose={() => setBuildOpen(false)} onProfile={() => { setBuildOpen(false); setProfileOpen(true) }} onEvidence={id => { setBuildOpen(false); setEvidenceFactId(id); setTab('evidence') }} onApplied={result => { setBuildOpen(false); setSelectedId(null); setTab('activities'); onOpenCreatedSchedule?.(result) }} />}
    {profileOpen && <PlanningProfilePanel projectId={plan.project_id || plan.project?.id} readOnly={contextReadOnly} onClose={() => setProfileOpen(false)} onChanged={onRefresh} />}
  </section>
}

PlanningScheduleCanvas.propTypes = {
  plan: PropTypes.object.isRequired, tasks: PropTypes.array.isRequired, disciplines: PropTypes.array.isRequired,
  saving: PropTypes.bool, saveError: PropTypes.string, locked: PropTypes.bool, ganttLocked: PropTypes.bool, onCellEdit: PropTypes.func, onLogicEdit: PropTypes.func, onEdit: PropTypes.func.isRequired, onDelete: PropTypes.func, onEditWbs: PropTypes.func, onDeleteWbs: PropTypes.func, canEditWbs: PropTypes.func, onEmployee: PropTypes.func.isRequired,
  onAdd: PropTypes.func.isRequired, onInputs: PropTypes.func.isRequired, onAnalyze: PropTypes.func, onRebuild: PropTypes.func, onRefresh: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired, onNewVersion: PropTypes.func.isRequired, onCompare: PropTypes.func,
  onApproval: PropTypes.func, approvalDisabled: PropTypes.bool, approvalLabel: PropTypes.string,
  selectedVersionId: PropTypes.string, onVersionChange: PropTypes.func, onAddWorkstream: PropTypes.func, onOpenAdvanced: PropTypes.func,
  onBuildSchedule: PropTypes.func, buildingSchedule: PropTypes.bool, onVerifySources: PropTypes.func,
  generationRequest: PropTypes.oneOf(['plan', 'source_logic']), onGenerationOpened: PropTypes.func,
  checksOpenRequest: PropTypes.number, checking: PropTypes.bool, onOpenCreatedSchedule: PropTypes.func, onCalculate: PropTypes.func, onValidate: PropTypes.func, onActivateVersion: PropTypes.func, onReviewLogic: PropTypes.func,
}
