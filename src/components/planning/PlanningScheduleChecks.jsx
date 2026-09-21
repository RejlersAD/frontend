import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { AlertTriangle, CheckCircle2, FileText, Pencil, RefreshCw } from 'lucide-react'
import { isTimingWarning, scheduleChecks, scheduleIssueGroups } from './scheduleCheckPolicy'
import './PlanningScheduleChecks.css'

const labels = {
  negative_float: 'Activity timing needs review',
  contract_finish_overrun: 'The schedule finishes after the required date',
  contractual_finish_overrun: 'The schedule finishes after the required date',
  duration_required: 'Review activity durations against the documents',
  reference_schedule_not_imported: 'Review the uploaded schedule',
  source_import_review_required: 'Review the imported schedule evidence',
  zero_duration_tasks: 'Activity duration must be greater than zero',
  dependency_cycle: 'Dependencies form a loop',
  start_to_finish: 'Review the dependency type',
  resource_overallocation: 'Assigned work exceeds resource capacity',
}
const resolutions = {
  negative_float: 'Review the documented durations, working calendar and predecessor links against the MDR and SOW. Keep the required project finish unchanged.',
  contract_finish_overrun: 'Review the documented timing and predecessors against the MDR and SOW. The required project finish remains unchanged.',
  contractual_finish_overrun: 'Review the documented timing and predecessors against the MDR and SOW. The required project finish remains unchanged.',
  duration_required: 'Review the uploaded schedule and link each activity to its source duration. Keep information not stated in the documents as Not Specified; any planner-entered duration needs a reviewed basis.',
  reference_schedule_not_imported: 'Review the recovered source rows, dates, calendar and relationships before applying them to this project.',
  source_import_review_required: 'Source activities and dates are visible in Master Schedule. Review scope links, the working calendar and predecessor evidence before calculation and baseline approval.',
  zero_duration_tasks: 'Enter a positive working duration for each task. Keep zero duration only for genuine milestones.',
  dependency_cycle: 'Review Depends on and remove the incorrect relationship that links an activity back to itself.',
  start_to_finish: 'Review the predecessor connection. Remove an incorrect dependency or use Schedule Controls to correct its relationship type.',
  resource_overallocation: 'Review the listed assignments, planned effort and timing. Reassign or reschedule work within the resource’s available capacity.',
}
const inputIssues = new Set(['tasks_required', 'dates_required', 'dates_invalid', 'inputs_changed', 'documents_processing'])
const date = value => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not set'
const number = value => value == null ? '—' : new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(Number(value))

function affectedRows(issue, tasks, taskAliases) {
  const aliases = taskAliases || new Map(tasks.flatMap(task => [task.id, task.external_id, task.activity_code].filter(value => value != null).map(value => [String(value), task])))
  if (issue.grouped_issues) return [...new Map(issue.grouped_issues.flatMap(item => affectedRows(item, tasks, aliases)).map(row => [String(row.id), row])).values()]
  const evidence = [...(issue.affected_activities || []), ...(issue.activities || [])]
  const keys = [...(issue.task_id != null ? [issue.task_id] : []), ...(issue.task_ids || []), ...evidence.map(item => typeof item === 'object' ? item.task_id ?? item.external_id ?? item.id : item)]
  const rows = new Map()
  for (const key of keys) {
    if (key == null) continue
    const task = aliases.get(String(key))
    const source = evidence.find(item => typeof item === 'object' && String(item.task_id ?? item.external_id ?? item.id) === String(key))
    const row = task ? { ...task, ...source, id: task.id, title: task.title } : { ...source, id: String(key), title: source?.title || source?.name || String(key), unavailable: true }
    rows.set(String(row.id), row)
  }
  // Older submit responses contain only a message for aggregate checks.
  if (!rows.size && issue.code === 'negative_float') for (const task of tasks) {
    if (task.total_float_days != null && Number(task.total_float_days) < 0) rows.set(String(task.id), task)
  }
  if (!rows.size && ['contract_finish_overrun', 'contractual_finish_overrun'].includes(issue.code) && issue.target_finish_date) for (const task of tasks) {
    if (task.planned_finish_date > issue.target_finish_date) rows.set(String(task.id), task)
  }
  return [...rows.values()]
}

function IssueCard({ issue, tasks, locked, busy, onEdit, onInputs, onVerifySources, onEvidence, onSources, hideActivities }) {
  const [expanded, setExpanded] = useState(false)
  const rows = affectedRows(issue, tasks)
  const visible = expanded ? rows : rows.slice(0, 25)
  const sourceIssue = issue.code === 'duration_required' || /reference_schedule|source_verification|source_schedule/.test(issue.code || '')
  const evidenceIssue = sourceIssue || /source_import|calendar_not_specified|evidence_graph_not_current/.test(issue.code || '')
  const needsInputs = inputIssues.has(issue.code) || evidenceIssue
  const field = issue.field === 'assignee_id' ? 'owner' : issue.field === 'depends_on' ? 'dependencies' : issue.field
  return <article className="psc-issue">
    <div className="psc-issue-title"><AlertTriangle size={18} /><h4>{labels[issue.code] || issue.message || 'Schedule issue'}</h4></div>
    {isTimingWarning(issue) && <p className="psc-advisory">Warning only. This does not prevent submission or baseline approval.</p>}
    {labels[issue.code] && <p>{issue.grouped_issues?.length > 1 ? `${rows.length} activities need this review. Their individual records are listed below.` : issue.message || issue.detail}</p>}
    {(issue.resolution || resolutions[issue.code]) && <p className="psc-resolution">{issue.resolution || resolutions[issue.code]}</p>}
    {needsInputs && <div className="psc-actions">{sourceIssue && onSources && <button type="button" disabled={busy} onClick={onSources}><FileText size={15} />Review extracted schedule</button>}{evidenceIssue && (onEvidence || onVerifySources) && <button type="button" disabled={busy} onClick={onEvidence || onVerifySources}><FileText size={15} />Review source evidence</button>}<button type="button" disabled={locked || busy} onClick={onInputs}><FileText size={15} />Project inputs</button></div>}
    {issue.resources?.length > 0 && <ul className="psc-resource-list">{issue.resources.map((resource, index) => <li key={resource.resource_id || index}><strong>{resource.resource_name || resource.resource_code || 'Resource'}</strong>: peak demand {number(resource.peak_demand)} / capacity {number(resource.capacity_per_day)} per day{resource.peak_date ? ` on ${date(resource.peak_date)}` : ''}.</li>)}</ul>}
    {rows.length > 0 && !hideActivities && <>
      <p className="psc-affected">{rows.length} affected {rows.length === 1 ? 'activity' : 'activities'}</p>
      <div className="psc-table"><table><thead><tr><th>Activity</th><th>Start</th><th>Finish</th><th>Duration</th><th>Total float</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>
        {visible.map(task => <tr key={task.id}><td>{(task.activity_code || task.external_id) && <small>{task.activity_code || task.external_id}</small>}<strong>{task.title}</strong></td><td>{date(task.planned_start_date)}</td><td>{date(task.planned_finish_date)}</td><td>{number(task.duration_days)}{task.duration_days != null && ' d'}</td><td className={task.total_float_days != null && Number(task.total_float_days) < 0 ? 'psc-negative' : undefined}>{number(task.total_float_days)}{task.total_float_days != null && ' d'}</td><td><button type="button" aria-label={`Edit activity ${task.title}`} disabled={locked || busy || task.unavailable} onClick={() => onEdit(tasks.find(original => original.id === task.id), field)}><Pencil size={14} />Edit activity</button></td></tr>)}
      </tbody></table></div>
      {rows.length > 25 && <button type="button" className="psc-show-all" onClick={() => setExpanded(value => !value)}>{expanded ? 'Show first 25 activities' : `Show all ${rows.length} affected activities`}</button>}
    </>}
    {!rows.length && !needsInputs && <p className="psc-resolution">Check again to load the latest activity details.{!isTimingWarning(issue) && ' Review the named issue before submitting.'}</p>}
  </article>
}
IssueCard.propTypes = { issue: PropTypes.object.isRequired, tasks: PropTypes.array.isRequired, locked: PropTypes.bool, busy: PropTypes.bool, onEdit: PropTypes.func.isRequired, onInputs: PropTypes.func.isRequired, onVerifySources: PropTypes.func, onEvidence: PropTypes.func, onSources: PropTypes.func, hideActivities: PropTypes.bool }

export default function PlanningScheduleChecks({ plan, tasks, locked, busy, onEdit, onInputs, onRefresh, onVerifySources, onEvidence, onSources }) {
  const { blockers, timingWarnings } = scheduleChecks(plan)
  const blockerGroups = scheduleIssueGroups(blockers)
  const issues = [...blockerGroups, ...timingWarnings]
  const targetIssue = issues.find(issue => issue.target_finish_date)
  const target = targetIssue?.target_finish_date || plan.project?.end_date
  const forecast = targetIssue?.forecast_finish_date || tasks.map(task => task.planned_finish_date).filter(Boolean).sort().at(-1)
  const negative = issues.find(issue => issue.code === 'negative_float')
  const minFloat = Math.min(0, ...(negative ? affectedRows(negative, tasks) : tasks).map(task => Number(task.total_float_days) || 0))
  const recovery = negative?.minimum_float_days ?? minFloat
  return <section className="planning-schedule-checks" aria-label="Schedule issues">
    <header className="psc-header"><div><h3 tabIndex={-1}>{blockers.length ? 'Resolve schedule issues' : timingWarnings.length ? 'Review timing warnings' : 'Schedule checks'}</h3><p>{blockers.length ? `${blockerGroups.length} review ${blockerGroups.length === 1 ? 'action needs' : 'actions need'} attention before submission. Repeated findings are grouped below; every affected activity remains available for review.` : timingWarnings.length ? 'Timing warnings do not prevent submission or baseline approval. Review the source evidence; the required project dates stay unchanged.' : 'No blocking issues in the current draft. Submission checks the complete schedule again.'}</p></div><button type="button" disabled={busy} onClick={onRefresh}><RefreshCw size={15} />Check again</button></header>
    {blockers.some(issue => issue.code === 'duration_required') && <p className="psc-resolution">Project start and finish define the planning window. Activity timing still needs source durations, a working calendar and verified sequence links.</p>}
    {issues.length > 0 && target && forecast && <dl className="psc-dates"><div><dt>Required finish</dt><dd>{date(target)}</dd></div><div><dt>Calculated finish</dt><dd className={forecast > target ? 'psc-negative' : undefined}>{date(forecast)}</dd></div>{Number(recovery) < 0 && <div><dt>Time to recover</dt><dd className="psc-negative">{number(Math.abs(recovery))} working days</dd></div>}</dl>}
    {!issues.length && <p className="psc-clear"><CheckCircle2 size={18} />Current draft checks are clear.</p>}
    {issues.map((issue, index) => <IssueCard key={`${issue.code}-${index}`} issue={issue} tasks={tasks} locked={locked} busy={busy} onEdit={onEdit} onInputs={onInputs} onVerifySources={onVerifySources} onEvidence={onEvidence} onSources={onSources} hideActivities={Boolean(negative && ['contract_finish_overrun', 'contractual_finish_overrun'].includes(issue.code))} />)}
  </section>
}
PlanningScheduleChecks.propTypes = { plan: PropTypes.object.isRequired, tasks: PropTypes.array.isRequired, locked: PropTypes.bool, busy: PropTypes.bool, onEdit: PropTypes.func.isRequired, onInputs: PropTypes.func.isRequired, onRefresh: PropTypes.func.isRequired, onVerifySources: PropTypes.func, onEvidence: PropTypes.func, onSources: PropTypes.func }
