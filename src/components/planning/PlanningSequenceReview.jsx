import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { AlertTriangle, CalendarDays, GitBranch, Loader2, Search, X } from 'lucide-react'
import PrimaveraActivitiesGantt from './PrimaveraActivitiesGantt'
import { scheduleDate, scheduleNumber } from '../../utils/primaveraSchedule'
import './PlanningSequenceReview.css'

const noop = () => {}
const EMPTY_TASKS = []
const message = value => typeof value === 'string' ? value : value?.message || value?.description || value?.rationale || ''
const dates = task => `${scheduleDate(task?.planned_start_date)} → ${scheduleDate(task?.planned_finish_date)}`
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
  const deliverables = previewPlan.deliverables || []
  const deliverableCount = proposal.deliverable_count ?? (deliverables.length ? deliverables.length : null)
  const standardFive = proposal.workflow_mode === 'standard_five' || previewPlan.workflow_mode === 'standard_five'
    || (deliverables.length > 0 && deliverables.every(item => (item.workflow_task_ids || item.task_ids || []).length === 5))
  const expansionBlockers = [...new Map([
    ...(proposal.expansion_blockers || []), ...(previewPlan.expansion_blockers || []),
    ...deliverables.flatMap(item => item.expansion_blockers || []),
  ].map(item => [`${item.code || ''}:${item.task_id || item.deliverable_id || ''}:${message(item)}`, item])).values()]
  const proposedFinish = previewPlan.project_summary?.planned_finish_date
    || tasks.map(task => task.planned_finish_date).filter(Boolean).sort().at(-1)
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
    <header className="psq-header"><div><h2 id="psq-title">Review proposed schedule</h2><p id="psq-description">These are planning estimates, not a verified import of the original schedule. Review dates, durations and inferred links before applying.</p></div><button type="button" className="psq-close" aria-label="Close proposed schedule" disabled={busy} onClick={onClose}><X size={20} /></button></header>
    <div className="psq-content">
      {error && <p className="psq-error" role="alert">{error}</p>}
      <div className="psq-summary">{deliverableCount != null && <span><strong>{deliverableCount}</strong> deliverables</span>}<span><strong>{proposal.task_count ?? tasks.length}</strong> activities</span>{standardFive && <span><strong>5</strong> stages per deliverable</span>}<span><strong>{proposal.changed_count ?? 0}</strong> proposed changes</span><span><GitBranch size={16} /><strong>{proposal.relationship_count ?? 0}</strong> predecessor links</span><span><CalendarDays size={16} />Proposed finish <strong>{scheduleDate(proposedFinish)}</strong></span><span>Project target <strong>{scheduleDate(previewPlan.project?.end_date || previewPlan.project?.planned_finish_date)}</strong></span></div>
      {standardFive && <p className="psq-workflow-sequence">IFR → Company Review → IFA → Company Approval → Final Issue</p>}
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
        return <tr key={task.id}><td>{taskCode(task)}</td><th scope="row">{task.title}</th><td>{dates(previous)}</td><td>{dates(task)}</td><td>{scheduleNumber(previous?.duration_days)} → <strong>{scheduleNumber(task.duration_days)}</strong></td><td><p>{task.schedule_rationale || 'Existing planner settings retained.'}</p>{incoming.length ? <details><summary>{incoming.length} {incoming.length === 1 ? 'predecessor' : 'predecessors'}</summary><ul>{incoming.map(item => <li key={item.id}><strong>{item.task ? taskCode(item.task) : item.id}</strong> {item.task?.title}{item.reason && <><small>{item.reason.evidence_type === 'planning_inference' ? 'Planning inference · ' : ''}{message(item.reason)}</small>{(item.reason.source_references || []).map((source, index) => <small key={index}>{sourceLabel(source)}{source.excerpt && <q>{source.excerpt}</q>}</small>)}</>}</li>)}</ul></details> : <small>No predecessor — can start independently.</small>}</td></tr>
      })}</tbody></table>{!visible.length && <p className="psq-empty">No activities match this search.</p>}</div>
        : <PrimaveraActivitiesGantt plan={previewPlan} tasks={tasks} disciplines={previewPlan.disciplines || []} search={search} fitTimeline locked selectedId={selected?.id} onSelect={setSelected} onEdit={noop} onInputs={noop} />}
      {tab === 'gantt' && selected && <section className="psq-selected" aria-label="Proposed activity details"><strong>{taskCode(selected)} · {selected.title}</strong><p>{selected.schedule_rationale || 'Existing planner settings retained.'}</p><p>{dates(selected)} · {scheduleNumber(selected.duration_days)} working days</p><p>Predecessors: {dependencies(selected).map(item => item.task ? taskCode(item.task) : item.id).join(', ') || 'None'}</p></section>}
    </div>
    <footer className="psq-footer"><span>Applying saves a draft. Baseline approval remains a separate action.</span><button type="button" className="psq-button" disabled={busy} onClick={onClose}>Cancel</button><button type="button" className="psq-button psq-primary" disabled={busy || expansionBlockers.length > 0 || !proposal.token || proposal.changed_count === 0} onClick={onApply}>{busy && <Loader2 size={16} className="animate-spin" />}Apply draft schedule</button></footer>
  </dialog>, document.body)
}

PlanningSequenceReview.propTypes = {
  currentPlan: PropTypes.object.isRequired, previewPlan: PropTypes.object.isRequired, proposal: PropTypes.object.isRequired,
  returnFocusElement: PropTypes.object,
  busy: PropTypes.bool, error: PropTypes.string, onClose: PropTypes.func.isRequired, onApply: PropTypes.func.isRequired,
}
