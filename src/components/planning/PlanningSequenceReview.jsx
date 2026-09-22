import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { AlertTriangle, CalendarDays, GitBranch, Loader2, Search, X } from 'lucide-react'
import PrimaveraActivitiesGantt from './PrimaveraActivitiesGantt'
import PlanningDurationEvidence, { ActivityDurationEvidence } from './PlanningDurationEvidence'
import { dependencyEvidenceLabel, durationDisplayTask, durationEvidenceRow, durationUnitLabel, missingSourceDuration } from '../../utils/planningDurationEvidence'
import { scheduleDate, scheduleNumber } from '../../utils/primaveraSchedule'
import './PlanningSequenceReview.css'

const noop = () => {}
const EMPTY_TASKS = []
const message = value => typeof value === 'string' ? value : value?.message || value?.description || value?.rationale || ''
const dates = (task, sourceOnly = false) => [task?.planned_start_date, task?.planned_finish_date].map(value => sourceOnly && !value ? 'Not Specified' : scheduleDate(value)).join(' → ')
const sourceLabel = source => {
  const locator = source.locator || {}
  return [source.filename, locator.page != null ? `Page ${locator.page}` : null,
    locator.sheet, locator.line != null ? `Line ${locator.line}` : locator.row != null ? `Row ${locator.row}` : null].filter(Boolean).join(' · ')
}

export default function PlanningSequenceReview({ currentPlan, previewPlan, proposal, returnFocusElement, busy, error, onClose, onApply }) {
  const ref = useRef(null)
  const callbacks = useRef({ onClose, busy })
  callbacks.current = { onClose, busy }
  const [tab, setTab] = useState('changes')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const tasks = previewPlan.tasks || EMPTY_TASKS
  const byId = useMemo(() => new Map(tasks.map(task => [String(task.id), task])), [tasks])
  const original = useMemo(() => new Map((currentPlan.tasks || []).map(task => [String(task.id), task])), [currentPlan])
  const visible = tasks.filter(task => `${task.activity_code || ''} ${task.title}`.toLowerCase().includes(search.toLowerCase()))
  const assumptions = proposal.assumptions || []
  const constraints = proposal.source_constraints || []
  const warnings = proposal.warnings || []
  const horizon = proposal.horizon_fit
  const durationReview = proposal.duration_review || previewPlan.duration_review
  const sourceOnly = proposal.workflow_mode === 'source_only' || previewPlan.duration_policy === 'source_only' || Boolean(durationReview)
  const missingDurations = tasks.some(missingSourceDuration)
  const movedCount = horizon?.moved_activity_ids?.length || 0
  const resizedCount = horizon?.resized_activity_ids?.length || 0
  const deliverables = previewPlan.deliverables || []
  const deliverableCount = proposal.deliverable_count ?? (deliverables.length ? deliverables.length : null)
  const standardFive = proposal.workflow_mode === 'standard_five' || previewPlan.workflow_mode === 'standard_five'
  const expansionBlockers = [...new Map([
    ...(proposal.expansion_blockers || []), ...(previewPlan.expansion_blockers || []),
    ...deliverables.flatMap(item => item.expansion_blockers || []),
  ].map(item => [`${item.code || ''}:${item.task_id || item.deliverable_id || ''}:${message(item)}`, item])).values()]
  const proposedFinish = missingDurations ? null
    : previewPlan.project_summary?.planned_finish_date || tasks.map(task => durationDisplayTask(task).planned_finish_date).filter(Boolean).sort().at(-1)
  useEffect(() => {
    const trigger = returnFocusElement || document.activeElement
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => { dialog?.close(); if (trigger?.isConnected) trigger.focus() }
  }, [returnFocusElement])
  const dependencies = task => (task.depends_on || []).map(id => ({
    id, task: byId.get(String(id)), reason: task.dependency_rationales?.[id],
  }))
  const taskCode = task => task.activity_code || task.document_number || task.id
  return createPortal(<dialog ref={ref} className="psq-dialog" aria-labelledby="psq-title" aria-describedby="psq-description"
    onCancel={event => { event.preventDefault(); if (!callbacks.current.busy) callbacks.current.onClose() }}>
    <header className="psq-header"><div><h2 id="psq-title">Review proposed schedule</h2><p id="psq-description">{sourceOnly ? 'Review source evidence for activities, durations and dependency links. Missing information is Not Specified.' : 'These are planning estimates, not a verified import of the original schedule. Review dates, durations and inferred links before applying.'}</p></div><button type="button" className="psq-close" aria-label="Close proposed schedule" disabled={busy} onClick={onClose}><X size={20} /></button></header>
    <div className="psq-content">
      {error && <p className="psq-error" role="alert">{error}</p>}
      <PlanningDurationEvidence review={durationReview} />
      <div className="psq-summary">{deliverableCount != null && <span><strong>{deliverableCount}</strong> deliverables</span>}<span><strong>{proposal.task_count ?? tasks.length}</strong> activities</span>{standardFive && <span><strong>5</strong> stages per deliverable</span>}<span><strong>{proposal.changed_count ?? 0}</strong> proposed changes</span><span><GitBranch size={16} /><strong>{proposal.relationship_count ?? 0}</strong> predecessor links</span><span><CalendarDays size={16} />Proposed finish <strong>{scheduleDate(proposedFinish)}</strong></span><span>Project target <strong>{scheduleDate(previewPlan.project?.end_date || previewPlan.project?.planned_finish_date)}</strong></span></div>
      {horizon && <section className={`psq-horizon ${horizon.fits === false ? 'needs-review' : ''}`} aria-label="Fixed project dates">
        <div><strong>Fixed project dates</strong><span>{scheduleDate(horizon.start_date)} → {scheduleDate(horizon.finish_date)}</span><span>{missingDurations ? 'Timing not calculated · missing source durations' : horizon.fits ? 'Proposed timing fits' : 'Timing needs review · warning only'}</span></div>
        {sourceOnly ? <p>Project dates remain fixed. No template durations are added or shortened to fit the target.</p> : <p>Forecast: {scheduleDate(horizon.original_forecast_finish)} → <strong>{scheduleDate(horizon.forecast_finish)}</strong>. {movedCount} activity {movedCount === 1 ? 'start' : 'starts'} adjusted; {resizedCount} proposed {resizedCount === 1 ? 'duration' : 'durations'} adjusted.</p>}
        {horizon.source_values_changed === false && <p>Source values are retained. Review activity citations before applying.</p>}
      </section>}
      {standardFive && <p className="psq-workflow-sequence">User-configured workflow: IFR → Company Review → IFA → Company Approval → Final Issue</p>}
      {expansionBlockers.length > 0 && <section className="psq-error" role="alert" aria-label="Workflow expansion blockers"><strong>Resolve these items before applying the workflow.</strong><ul>{expansionBlockers.map((item, index) => <li key={index}>{message(item) || item.code || 'This workflow needs review.'}</li>)}</ul></section>}
      {warnings.length > 0 && <ul className="psq-warnings">{warnings.map((item, index) => <li key={index}><AlertTriangle size={16} /><span>{message(item)}</span></li>)}</ul>}
      {(assumptions.length > 0 || constraints.length > 0) && <details className="psq-assumptions"><summary>Scheduling assumptions and source requirements ({assumptions.length + constraints.length})</summary>
        {assumptions.length > 0 && <><h3>Planning assumptions</h3><ul>{assumptions.map((item, index) => <li key={index}>{message(item)}</li>)}</ul></>}
        {constraints.length > 0 && <><h3>Source requirements</h3><ul>{constraints.map((item, index) => <li key={index}>{message(item)}{(item.source_references || []).map((source, sourceIndex) => <small key={sourceIndex}>{sourceLabel(source)}{source.excerpt && <q>{source.excerpt}</q>}</small>)}</li>)}</ul></>}
      </details>}
      <div className="psq-toolbar"><div role="group" aria-label="Schedule proposal view"><button type="button" aria-pressed={tab === 'changes'} onClick={() => setTab('changes')}>Changes & logic</button><button type="button" aria-pressed={tab === 'gantt'} onClick={() => setTab('gantt')}>Gantt preview</button></div><label><Search size={15} /><input aria-label="Search proposed activities" placeholder="Search activity ID or name" value={search} onChange={event => setSearch(event.target.value)} /></label></div>
      {tab === 'changes' ? <div className="psq-table-scroll" tabIndex={0} role="region" aria-label="Proposed schedule changes"><table><thead><tr><th>Activity ID</th><th>Activity / deliverable</th><th>Current dates</th><th>Proposed dates</th><th>Duration (days)</th><th>Predecessors & rationale</th></tr></thead><tbody>{visible.map(task => {
        const previous = original.get(String(task.id))
        const incoming = dependencies(task)
        const evidence = durationEvidenceRow(durationReview, task)
        const displayed = durationDisplayTask(task)
        return <tr key={task.id}><td>{taskCode(task)}</td><th scope="row">{task.title}</th><td>{dates(previous)}</td><td>{dates(displayed, sourceOnly)}</td><td>{scheduleNumber(previous?.duration_days)} → <strong>{missingSourceDuration(task) ? 'Not Specified' : scheduleNumber(task.duration_days)}</strong>{sourceOnly && <ActivityDurationEvidence task={task} row={evidence} />}</td><td><p>{task.schedule_rationale || 'Existing planner settings retained.'}</p>{incoming.length ? <details><summary>{incoming.length} {incoming.length === 1 ? 'predecessor' : 'predecessors'}</summary><ul>{incoming.map(item => <li key={item.id}><strong>{item.task ? taskCode(item.task) : item.id}</strong> {item.task?.title}{item.reason && <><small>{dependencyEvidenceLabel(item.reason)} · {message(item.reason)}</small>{(item.reason.source_references || []).map((source, index) => <small key={index}>{sourceLabel(source)}{source.excerpt && <q>{source.excerpt}</q>}</small>)}</>}</li>)}</ul></details> : <small>{sourceOnly ? 'Not Specified: no documented or intentionally retained predecessor.' : 'No predecessor — can start independently.'}</small>}</td></tr>
      })}</tbody></table>{!visible.length && <p className="psq-empty">No activities match this search.</p>}</div>
        : <PrimaveraActivitiesGantt plan={previewPlan} tasks={tasks} disciplines={previewPlan.disciplines || []} search={search} fitTimeline locked selectedId={selected?.id} onSelect={setSelected} onEdit={noop} onInputs={noop} />}
      {tab === 'gantt' && selected && <section className="psq-selected" aria-label="Proposed activity details"><strong>{taskCode(selected)} · {selected.title}</strong><p>{selected.schedule_rationale || 'Existing planner settings retained.'}</p><p>{dates(durationDisplayTask(selected), sourceOnly)} · {missingSourceDuration(selected) ? 'Not Specified' : `${scheduleNumber(selected.duration_days)} ${durationUnitLabel(selected)}`}</p>{sourceOnly && <ActivityDurationEvidence task={selected} row={durationEvidenceRow(durationReview, selected)} />}<p>Predecessors: {dependencies(selected).map(item => item.task ? taskCode(item.task) : item.id).join(', ') || 'None'}</p></section>}
    </div>
    <footer className="psq-footer"><span>Applying saves a draft. Baseline approval remains a separate action.</span><button type="button" className="psq-button" disabled={busy} onClick={onClose}>Cancel</button><button type="button" className="psq-button psq-primary" disabled={busy || expansionBlockers.length > 0 || !proposal.token || proposal.changed_count === 0} onClick={onApply}>{busy && <Loader2 size={16} className="animate-spin" />}Apply draft schedule</button></footer>
  </dialog>, document.body)
}

PlanningSequenceReview.propTypes = {
  currentPlan: PropTypes.object.isRequired, previewPlan: PropTypes.object.isRequired, proposal: PropTypes.object.isRequired,
  returnFocusElement: PropTypes.object,
  busy: PropTypes.bool, error: PropTypes.string, onClose: PropTypes.func.isRequired, onApply: PropTypes.func.isRequired,
}
