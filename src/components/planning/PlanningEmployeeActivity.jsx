import React, { useEffect, useId, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { AlertCircle, CheckCircle2, ClipboardList, Clock3, History, Loader2, RefreshCw, User, X } from 'lucide-react'
import planningIntelligenceService from '../../services/planningIntelligence.service'
import useModalAccessibility from '../../hooks/useModalAccessibility'
import './PlanningEmployeeActivity.css'

const statusLabels = { todo: 'Not started', in_progress: 'In progress', review: 'In review', completed: 'Completed', blocked: 'Blocked' }
const actionLabels = { assigned: 'Work assigned', reassigned: 'Assignment changed', unassigned: 'Assignment removed', updated: 'Task updated', status_changed: 'Status changed', progress_updated: 'Progress updated', submitted_for_review: 'Submitted for review', review_returned: 'Returned for changes', completed: 'Task completed' }
const humanize = value => value ? String(value).replaceAll('_', ' ').replace(/^./, char => char.toUpperCase()) : 'Not recorded'
const formatDate = (value, includeTime = false) => {
  if (!value) return 'Not recorded'
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value)
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}
const taskKey = task => task.project_task_id == null ? `wbs:${task.wbs_task_id}` : String(task.project_task_id)
const progressValue = value => Number.isFinite(Number(value)) && value !== null && value !== '' ? Math.max(0, Math.min(100, Number(value))) : null
const errorMessage = error => {
  if ([403, 404].includes(error?.response?.status)) return 'Employee activity is not available for this project or your access has changed.'
  return error?.response?.data?.detail || error?.response?.data?.error || 'Employee activity could not be loaded. Please try again.'
}

function ActivityChanges({ entry, people }) {
  const before = entry.before || {}, after = entry.after || {}
  const fields = [
    ['status', 'Status', value => statusLabels[value] || humanize(value)],
    ['progress_percent', 'Progress', value => value == null ? 'Not recorded' : `${value}%`],
    ['assignee_id', 'Assigned to', (value, source) => value == null ? 'Unassigned' : source.assignee_name || people.get(String(value)) || 'Another employee'],
    ['reviewer_id', 'Reviewer', (value, source) => value == null ? 'Not assigned' : source.reviewer_name || people.get(String(value)) || 'Another employee'],
    ['due_date', 'Due date', value => value ? formatDate(value) : 'Not set'],
    ['priority', 'Priority', humanize],
    ['title', 'Task', value => value || 'Not recorded'],
    ['task_type', 'Work type', humanize],
  ]
  const changes = fields.filter(([key]) => Object.hasOwn(after, key) && after[key] !== before[key])
  if (!changes.length) return null
  return <dl className="pea-changes">{changes.map(([key, label, format]) => <div key={key}><dt>{label}</dt><dd>{Object.hasOwn(before, key) && <><span>{format(before[key], before)}</span><span className="pea-change-arrow" aria-label="changed to"> → </span></>}<strong>{format(after[key], after)}</strong></dd></div>)}</dl>
}
ActivityChanges.propTypes = { entry: PropTypes.object.isRequired, people: PropTypes.instanceOf(Map).isRequired }

function AssignmentCard({ task }) {
  const progress = progressValue(task.progress_percent)
  return <article className="pea-assignment">
    <div className="pea-task-heading"><span className="pea-task-type">{task.task_type === 'deliverable' ? 'Deliverable' : 'Task'}{task.role === 'reviewer' ? ' · Reviewer' : ''}</span><span className={`pea-status is-${task.status || 'unknown'}`}>{statusLabels[task.status] || humanize(task.status)}</span></div>
    <h4>{task.title}</h4>
    {task.assignment_state === 'historical' && <p className="pea-historical">Previous assignment · Last recorded status</p>}
    <div className="pea-progress">{progress == null ? <span className="pea-progress-track" aria-hidden="true" /> : <progress max="100" value={progress} aria-label={`${task.title} progress`} />}<span>{progress == null ? 'Not recorded' : `${progress}%`}</span></div>
    <dl className="pea-task-facts"><div><dt>Due date</dt><dd>{task.due_date ? formatDate(task.due_date) : 'Not set'}</dd></div><div><dt>Priority</dt><dd>{humanize(task.priority)}</dd></div><div><dt>Assigned by</dt><dd>{task.assigned_by?.name || 'Not recorded'}</dd></div><div><dt>Assigned at</dt><dd>{formatDate(task.assigned_at, true)}</dd></div></dl>
  </article>
}
AssignmentCard.propTypes = { task: PropTypes.object.isRequired }

export default function PlanningEmployeeActivity({ projectId, employeeId, employeeName = '', initialTaskId = null, onClose }) {
  const id = useId()
  const dialogRef = useModalAccessibility(true, onClose)
  const requestKey = `${projectId}:${employeeId}`
  const [result, setResult] = useState({ key: requestKey, data: null, loading: true, error: '' })
  const [revision, setRevision] = useState(0)
  const [selectedTask, setSelectedTask] = useState(initialTaskId == null ? '' : String(initialTaskId))
  const current = result.key === requestKey ? result : { data: null, loading: true, error: '' }
  const data = current.data
  const reload = () => {
    // Refresh replaces the content; keep keyboard focus inside the dialog.
    dialogRef.current?.querySelector('.pea-icon-button')?.focus()
    setRevision(value => value + 1)
  }

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])
  useEffect(() => { setSelectedTask(initialTaskId == null ? '' : String(initialTaskId)) }, [projectId, employeeId, initialTaskId])
  useEffect(() => {
    const controller = new AbortController()
    setResult({ key: requestKey, data: null, loading: true, error: '' })
    planningIntelligenceService.getEmployeeActivity(projectId, employeeId, controller.signal).then(response => {
      if (controller.signal.aborted) return
      if (!response?.employee || !Array.isArray(response.tasks) || !Array.isArray(response.activity)) throw new Error('Employee activity could not be loaded.')
      setResult({ key: requestKey, data: response, loading: false, error: '' })
    }).catch(error => { if (!controller.signal.aborted) setResult({ key: requestKey, data: null, loading: false, error: errorMessage(error) }) })
    return () => controller.abort()
  }, [projectId, employeeId, requestKey, revision])

  const people = useMemo(() => {
    const entries = new Map()
    for (const person of [data?.employee, ...(data?.tasks || []).flatMap(task => [task.assigned_to, task.reviewer])]) {
      if (person?.user_id != null && person.name) entries.set(String(person.user_id), person.name)
    }
    return entries
  }, [data])
  const options = useMemo(() => {
    const tasks = new Map()
    for (const task of [...(data?.tasks || []), ...(data?.activity || [])]) if ((task.project_task_id != null || task.wbs_task_id) && !tasks.has(taskKey(task))) tasks.set(taskKey(task), task.title)
    return tasks
  }, [data])
  const filter = options.has(selectedTask) ? selectedTask : ''
  const tasks = (data?.tasks || []).filter(task => !filter || taskKey(task) === filter)
  const activity = (data?.activity || []).filter(entry => !filter || taskKey(entry) === filter)
  const name = data?.employee?.name || employeeName || 'Employee'
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()

  return createPortal(<div className="pea-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialogRef} className="pea-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} tabIndex={-1}>
      <header className="pea-header"><div><h2 id={`${id}-title`}>Employee activity</h2><p>Assignments and recorded history in this project.</p></div><button type="button" className="pea-icon-button" aria-label="Close employee activity" onClick={onClose}><X size={20} aria-hidden="true" /></button></header>
      <div className="pea-body" aria-busy={current.loading}>
        {current.loading && <div className="pea-loading" role="status"><Loader2 size={20} className="pea-spin" aria-hidden="true" />Loading {employeeName ? `${employeeName}’s` : 'employee'} activity…</div>}
        {current.error && <div className="pea-error" role="alert"><AlertCircle size={20} aria-hidden="true" /><div><p>{current.error}</p><button type="button" className="pea-button" onClick={reload}>Retry employee activity</button></div></div>}
        {data && <>
          <div className="pea-employee"><span className="pea-avatar" aria-hidden="true">{initials || <User size={24} />}</span><div><h3>{name}</h3><p>{[data.employee.employee_code, data.employee.job_title || data.employee.department].filter(Boolean).join(' · ')}</p><p className="pea-project">{[data.project?.code, data.project?.name].filter(Boolean).join(' · ') || 'Project not recorded'}</p></div><button type="button" className="pea-button pea-refresh" onClick={reload}><RefreshCw size={15} aria-hidden="true" />Refresh activity</button></div>
          <dl className="pea-summary"><div><ClipboardList size={20} aria-hidden="true" /><dt>Active tasks</dt><dd>{data.summary?.open ?? '—'}</dd></div><div><CheckCircle2 size={20} aria-hidden="true" /><dt>Completed</dt><dd>{data.summary?.completed ?? '—'}</dd></div><div><Clock3 size={20} aria-hidden="true" /><dt>Overdue</dt><dd>{data.summary?.overdue ?? '—'}</dd></div></dl>
          <div className="pea-toolbar"><label htmlFor={`${id}-task`}>Task</label><select id={`${id}-task`} value={filter} onChange={event => setSelectedTask(event.target.value)}><option value="">All tasks</option>{[...options].map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></div>
          <div className="pea-columns"><section className="pea-assignments" aria-labelledby={`${id}-assignments`}><h3 id={`${id}-assignments`}><ClipboardList size={18} aria-hidden="true" />Assigned work <span>{tasks.length}</span></h3>{tasks.length ? tasks.map(task => <AssignmentCard key={`${taskKey(task)}:${task.role}`} task={task} />) : <p className="pea-empty">No assignments recorded for this selection.</p>}</section>
            <section className="pea-history" aria-labelledby={`${id}-history`}><h3 id={`${id}-history`}><History size={18} aria-hidden="true" />Activity history <span>{activity.length}</span></h3>{activity.length ? <ol className="pea-timeline">{activity.map(entry => <li key={entry.id}><span className={`pea-event-dot${entry.action === 'completed' ? ' is-complete' : ''}`} aria-hidden="true" /><div className="pea-event"><div className="pea-event-heading"><h4>{actionLabels[entry.action] || humanize(entry.action)}</h4><time dateTime={entry.timestamp || undefined}>{formatDate(entry.timestamp, true)}</time></div><p className="pea-event-task">{entry.title}</p><p className="pea-event-actor">{entry.actor?.name ? `By ${entry.actor.name}` : 'Actor not recorded'}</p><ActivityChanges entry={entry} people={people} /></div></li>)}</ol> : <p className="pea-empty">No recorded activity for this selection.</p>}</section></div>
        </>}
      </div><footer className="pea-footer"><button type="button" className="pea-button" onClick={onClose}>Close</button></footer>
    </section>
  </div>, document.body)
}
PlanningEmployeeActivity.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  employeeId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  employeeName: PropTypes.string,
  initialTaskId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onClose: PropTypes.func.isRequired,
}
