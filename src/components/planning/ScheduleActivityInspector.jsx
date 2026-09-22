import { useEffect, useId, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { AlertTriangle, CalendarDays, Diamond, ExternalLink, FileText, Folder, GitBranch, User, X } from 'lucide-react'
import { EmployeeActivityLink } from './WorkBreakdownPanel'
import { ActivityDurationEvidence } from './PlanningDurationEvidence'
import { SourceLogicComparison } from './PlanningSourceLogic'
import PlanningFieldProvenance from './PlanningFieldProvenance'
import { dateEvidenceLabel, floatEvidenceLabel, missingDateLabel } from '../../utils/planningDateEvidence'
import { dependencyEvidenceLabel, durationEvidenceRow, durationReferences, durationUnitLabel, missingSourceDuration, sourceReferenceLabel } from '../../utils/planningDurationEvidence'
import { scheduleDependencyEntries } from '../../utils/primaveraDependencies'
import { isScheduleMilestone, scheduleNumber } from '../../utils/primaveraSchedule'
import './ScheduleActivityInspector.css'

const tabs = ['Details', 'Logic', 'Resources', 'History']
const relationshipNames = { FS: 'Finish to start', SS: 'Start to start', FF: 'Finish to finish', SF: 'Start to finish' }
const sameId = (left, right) => left != null && right != null && String(left) === String(right)
const date = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not Specified'
const provenanceFields = [
  ['title', 'Activity name'], ['assignee_id', 'Assigned to'], ['duration_days', 'Duration'],
  ['planned_start_date', 'Start'], ['planned_finish_date', 'Finish'], ['effort_hours', 'Planned effort'],
]

function References({ sources }) {
  return sources.length ? <ul className="sai-references">{sources.map((source, index) => <li key={index}>
    <span>{sourceReferenceLabel(source)}</span>
    {(source?.excerpt || source?.source_excerpt) && <q>{source.excerpt || source.source_excerpt}</q>}
  </li>)}</ul> : <p className="sai-muted">No source references recorded for this activity.</p>
}
References.propTypes = { sources: PropTypes.array.isRequired }

export default function ScheduleActivityInspector({ task, displayTask, plan, tasks, codes, sourceOnly = false, locked = false, logicLocked = locked, busy = false, onClose, onEdit, onEmployee, onEvidence }) {
  const [tab, setTab] = useState('Details')
  const inspectorRef = useRef(null)
  const tabRefs = useRef([])
  const id = useId()
  useEffect(() => {
    setTab('Details')
    inspectorRef.current?.focus({ preventScroll: true })
    inspectorRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [task.id])

  const activityCode = value => codes.get(value.id) || value.activity_code || value.external_id || String(value.id)
  const predecessorEntries = useMemo(() => scheduleDependencyEntries(task, { sourceOnly }), [task, sourceOnly])
  const successorEntries = useMemo(() => tasks.flatMap(successor => scheduleDependencyEntries(successor, { sourceOnly })
    .filter(entry => sameId(entry.predecessorId, task.id)).map(entry => ({ ...entry, successor }))), [tasks, task.id, sourceOnly])
  const durationRow = durationEvidenceRow(plan.duration_review, task)
  const provenanceReferences = Object.values(task.field_provenance || {}).flatMap(provenance => [
    ...(provenance?.source_references || []), ...(provenance?.lineage?.source_references || []),
  ])
  const references = [...(task.source_references || []), ...(task.source_date_references || []), ...(task.source_total_float_references || []), ...durationReferences(task, durationRow), ...provenanceReferences]
    .filter((reference, index, all) => all.findIndex(item => JSON.stringify(item) === JSON.stringify(reference)) === index)
  const wbs = (plan.wbs_nodes || []).find(node => sameId(node.id, task.wbs_node_id))
  const deliverable = (plan.deliverables || []).find(item => sameId(item.id, task.parent_deliverable_id)
    || (item.workflow_task_ids || item.task_ids || []).some(taskId => sameId(taskId, task.id)))
  const wbsName = deliverable?.title || wbs?.name || task.wbs_name || task.wbs_code || 'Not Specified'
  const milestone = isScheduleMilestone(task)
  const displayDate = field => displayTask[`display_${field}_date`]
    ? date(displayTask[`display_${field}_date`]) : missingDateLabel(displayTask, field, { sourceOnly })
  const owner = <span className="sai-owner"><User size={14} aria-hidden="true" />{task.assignee_id
    ? <EmployeeActivityLink task={task} onOpen={onEmployee} disabled={busy} />
    : 'Unassigned'}</span>
  const duration = missingSourceDuration(task) ? 'Not Specified' : milestone && Number(task.duration_days) === 0
    ? '0 d' : `${scheduleNumber(task.duration_days)} ${durationUnitLabel(task)}`
  const sourceDates = displayTask.display_date_basis === 'source'
  const warning = !predecessorEntries.length
    ? { title: 'No predecessors defined.', text: 'Add a predecessor unless this activity is an independent start.', action: 'Add predecessor', run: () => onEdit(task, 'dependencies'), logic: true }
    : missingSourceDuration(task)
      ? { title: 'Duration needs review', text: 'Confirm an activity duration before calculating its schedule.', action: 'Review activity timing', run: () => onEdit(task, 'duration_days') }
      : null

  const changeTab = event => {
    const index = tabs.indexOf(tab)
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
      : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null
    if (next == null) return
    event.preventDefault()
    setTab(tabs[next])
    tabRefs.current[next]?.focus()
  }
  const renderRelationship = (entry, related, direction) => {
    const evidence = { ...(typeof entry.reason === 'object' ? entry.reason : {}), ...entry.detail }
    const rationale = evidence.rationale || evidence.metadata?.rationale || evidence.message || evidence.description || (typeof entry.reason === 'string' ? entry.reason : null)
    return <li key={`${direction}:${related?.id || entry.predecessorId}:${entry.type}`}>
      <strong>{related ? activityCode(related) : entry.predecessorId}</strong>
      <span>{related?.title || 'Activity not available in this plan'}</span>
      <span className="sai-relationship-type">{relationshipNames[entry.type] || entry.type || 'Relationship Not Specified'}{entry.type && ` (${entry.type})`}</span>
      <span>Lag: {entry.lagValue == null || entry.lagValue === '' ? 'Not Specified' : `${scheduleNumber(entry.lagValue)} d`}</span>
      <details><summary>Relationship evidence</summary><p>{dependencyEvidenceLabel(evidence)}</p>{rationale && <p>{rationale}</p>}<References sources={evidence.source_references || []} /></details>
    </li>
  }

  return <aside ref={inspectorRef} tabIndex={-1} className="schedule-activity-inspector" aria-label="Activity details"
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() } }}>
    <header className="sai-header">
      {milestone ? <Diamond size={20} className="sai-activity-icon is-milestone" aria-hidden="true" /> : <Folder size={20} className="sai-activity-icon" aria-hidden="true" />}
      <div><h3 className="sai-sr-only">Activity details</h3><h4>{activityCode(task)} <span>— {task.title}</span></h4></div>
      <button type="button" className="sai-close" aria-label="Close activity details" onClick={onClose}><X size={18} /></button>
    </header>
    <div className="sai-tabs" role="tablist" aria-label="Activity information" onKeyDown={changeTab}>
      {tabs.map((label, index) => <button key={label} ref={node => { tabRefs.current[index] = node }} type="button" role="tab"
        id={`${id}-tab-${label}`} aria-selected={tab === label} aria-controls={`${id}-panel`} tabIndex={tab === label ? 0 : -1}
        onClick={() => setTab(label)}>{label}</button>)}
    </div>
    <div className="sai-content" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${tab}`} tabIndex={0}>
      {tab === 'Details' && <>
        <dl className="sai-fields">
          <div><dt>Activity ID</dt><dd>{activityCode(task)}</dd></div>
          <div><dt>Activity name</dt><dd>{task.title || 'Not Specified'}</dd></div>
          <div><dt>Duration</dt><dd>{duration}{task.duration_source === 'proposed' && <small className="sai-proposed">Proposed</small>}</dd></div>
          <div><dt>Start</dt><dd><span className="sai-date-value">{displayDate('start')}<CalendarDays size={14} aria-hidden="true" /></span>{sourceDates && displayTask.display_start_date && <small>Source date</small>}</dd></div>
          <div><dt>Finish</dt><dd><span className="sai-date-value">{displayDate('finish')}<CalendarDays size={14} aria-hidden="true" /></span>{sourceDates && displayTask.display_finish_date && <small>Source date</small>}</dd></div>
          <div><dt>Type</dt><dd>{milestone ? <span className="sai-owner sai-milestone-type"><Diamond size={14} aria-hidden="true" />Milestone</span> : 'Activity'}</dd></div>
          <div><dt>WBS</dt><dd><span className="sai-owner"><Folder size={14} aria-hidden="true" />{wbsName}</span></dd></div>
          <div><dt>Owner</dt><dd>{owner}</dd></div>
          {task.due_date && task.due_date !== task.planned_finish_date && <div><dt>Employee due date</dt><dd>{date(task.due_date)}</dd></div>}
        </dl>
        {warning && <section className="sai-notice" aria-label={warning.title}><AlertTriangle size={17} aria-hidden="true" /><div><strong>{warning.title}</strong><p>{warning.text}</p><button type="button" disabled={busy || (warning.logic ? logicLocked : locked)} onClick={warning.run}>{warning.action}</button></div></section>}
        {sourceDates && <section className="sai-source-note" aria-label="Source dates"><h5>Source dates</h5><p>{dateEvidenceLabel(displayTask)}</p></section>}
        <details className="sai-evidence"><summary>Duration evidence</summary><ActivityDurationEvidence task={task} row={durationRow} /></details>
        {plan.source_logic && <details className="sai-evidence"><summary>Source and calculated timing</summary><div className="sai-comparison-scroll" tabIndex={0} role="region" aria-label="Source and calculated timing"><SourceLogicComparison summary={{
          source_start_date: task.source_start_date, source_finish_date: task.source_finish_date,
          source_start_status: task.source_start_status, source_finish_status: task.source_finish_status,
          source_duration_days: task.original_duration_days ?? (['planner', 'manual', 'retained_manual', 'manual_unverified'].includes(task.duration_source) ? null : task.duration_days),
          source_duration_unit: task.duration_unit, calculated_duration_days: task.duration_days,
          source_total_float_status: task.source_total_float_status, source_total_float_days: task.source_total_float_days,
          calculated_total_float_days: displayTask.display_float_basis === 'calculated' ? displayTask.display_total_float_days : null,
          calculated_start_date: displayTask.display_date_basis === 'calculated' ? displayTask.display_start_date : null,
          calculated_finish_date: displayTask.display_date_basis === 'calculated' ? displayTask.display_finish_date : null,
        }} /></div></details>}
        <details className="sai-evidence"><summary>Field provenance</summary>{provenanceFields.map(([field, label]) => <section key={field}><h5>{label}</h5><PlanningFieldProvenance provenance={task.field_provenance?.[field]} /></section>)}</details>
        <details className="sai-evidence"><summary>Acceptance criteria</summary><p>{task.acceptance_criteria || 'Not Specified'}</p></details>
        <button type="button" className="sai-text-action" onClick={() => onEvidence(task)}><FileText size={14} />Review source evidence</button>
      </>}
      {tab === 'Logic' && <>
        <dl className="sai-fields sai-logic-timing"><div><dt>Total float</dt><dd title={floatEvidenceLabel(displayTask)}>{displayTask.display_total_float_days == null ? 'Not calculated' : `${scheduleNumber(displayTask.display_total_float_days)} days`}{displayTask.display_float_basis === 'source' && <small>Source value · not calculated</small>}</dd></div></dl>
        <div className="sai-section-heading"><h5>Predecessors</h5><span>{predecessorEntries.length}</span></div>
        <PlanningFieldProvenance provenance={task.field_provenance?.depends_on} />
        {predecessorEntries.length ? <ul className="sai-relationships">{predecessorEntries.map(entry => renderRelationship(entry, tasks.find(item => sameId(item.id, entry.predecessorId)), 'predecessor'))}</ul>
          : <p className="sai-muted">No predecessors recorded. Confirm whether this activity starts independently or needs a predecessor.</p>}
        <div className="sai-section-heading"><h5>Successors</h5><span>{successorEntries.length}</span></div>
        {successorEntries.length ? <ul className="sai-relationships">{successorEntries.map(entry => renderRelationship(entry, entry.successor, 'successor'))}</ul> : <p className="sai-muted">No successors recorded.</p>}
        <button type="button" className="sai-action" disabled={logicLocked || busy} onClick={() => onEdit(task, 'dependencies')}><GitBranch size={14} />Edit relationships</button>
      </>}
      {tab === 'Resources' && <>
        <dl className="sai-fields">
          <div><dt>Assigned to</dt><dd>{owner}<PlanningFieldProvenance provenance={task.field_provenance?.assignee_id} /></dd></div>
          <div><dt>Responsible role</dt><dd>{task.responsible_role || task.workflow_responsible_party || 'Not Specified'}</dd></div>
          <div><dt>Planned effort</dt><dd>{task.effort_hours == null ? 'Not Specified' : `${scheduleNumber(task.effort_hours)} hours`}<PlanningFieldProvenance provenance={task.field_provenance?.effort_hours} /></dd></div>
        </dl>
        <button type="button" className="sai-action" disabled={locked || busy} onClick={() => onEdit(task, 'owner')}><User size={14} />{task.assignee_id ? 'Edit assignment' : 'Assign employee'}</button>
      </>}
      {tab === 'History' && <>
        <p className="sai-muted">Activity change history is not available in this view.</p>
        <h5>Recorded source references</h5><References sources={references} />
        <button type="button" className="sai-text-action" onClick={() => onEvidence(task)}><FileText size={14} />Review source evidence</button>
        {task.assignee_id && <section className="sai-employee-history"><h5>Employee activity</h5><EmployeeActivityLink task={task} onOpen={onEmployee} disabled={busy} /></section>}
      </>}
    </div>
    <footer className="sai-footer"><button type="button" className="sai-action" aria-label="Edit activity" disabled={locked || busy} onClick={() => onEdit(task)}><ExternalLink size={14} />Open full activity</button></footer>
  </aside>
}

ScheduleActivityInspector.propTypes = {
  task: PropTypes.object.isRequired, displayTask: PropTypes.object.isRequired, plan: PropTypes.object.isRequired,
  tasks: PropTypes.array.isRequired, codes: PropTypes.instanceOf(Map).isRequired,
  sourceOnly: PropTypes.bool, locked: PropTypes.bool, logicLocked: PropTypes.bool, busy: PropTypes.bool,
  onClose: PropTypes.func.isRequired, onEdit: PropTypes.func.isRequired, onEmployee: PropTypes.func.isRequired, onEvidence: PropTypes.func.isRequired,
}
