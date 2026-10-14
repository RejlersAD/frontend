/* eslint-disable react/prop-types */
import React, { useEffect, useRef, useState } from 'react'
import { ArrowPathIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { assignedTaskService } from '../../services/assignedTask.service'
import { displayDate, humanize } from './workHubPresentation'

const statusLabel = value => ({ todo: 'To do', in_progress: 'In progress', review: 'In review', completed: 'Completed', blocked: 'Blocked' }[value] || humanize(value))
const personName = value => value?.name || value?.email || 'Not assigned'
const messageFor = error => {
  if ([403, 404].includes(error?.response?.status)) return 'This task is no longer available to you. Your assignment or access may have changed.'
  if (error?.response?.status === 409) return 'This task has changed. Reload the task before updating your progress.'
  const data = error?.response?.data
  return typeof data?.error === 'string' ? data.error : typeof data?.detail === 'string' ? data.detail
    : Object.values(data || {}).find(value => Array.isArray(value) && typeof value[0] === 'string')?.[0]
      || 'The task could not be saved. Please try again.'
}

export default function AssignedTaskDetail({ taskId, onSaved, onClose, onBusyChange }) {
  const [task, setTask] = useState(null)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState(false)
  const [success, setSuccess] = useState('')
  const request = useRef(null)
  const saveInFlight = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    request.current = controller
    setLoading(true); setError(''); setSuccess(''); setTask(null); setConflict(false)
    assignedTaskService.get(taskId, controller.signal).then(data => {
      if (controller.signal.aborted) return
      setTask(data); setStatus(data.status); setProgress(String(data.progress_percent ?? 0))
    }).catch(failure => {
      if (!controller.signal.aborted) setError([403, 404].includes(failure?.response?.status) ? messageFor(failure) : 'Your task details could not be loaded. Please retry.')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => { controller.abort(); onBusyChange(false) }
  }, [taskId, revision, onBusyChange])

  const allowed = Array.isArray(task?.allowed_statuses) ? task.allowed_statuses : []
  const canUpdateStatus = allowed.some(value => value !== task?.status)
  const canUpdateProgress = task?.can_update_progress === true
  const changed = task && (status !== task.status || canUpdateProgress && Number(progress) !== Number(task.progress_percent ?? 0))
  const save = async event => {
    event.preventDefault()
    if (!task || !changed || saving || saveInFlight.current || conflict) return
    const controller = request.current
    saveInFlight.current = true; setSaving(true); onBusyChange(true); setError(''); setSuccess('')
    try {
      const payload = { expected_updated_at: task.updated_at }
      if (status !== task.status) payload.status = status
      if (canUpdateProgress && Number(progress) !== Number(task.progress_percent ?? 0)) payload.progress_percent = Number(progress)
      const saved = await assignedTaskService.update(taskId, payload, controller.signal)
      if (controller.signal.aborted) return
      setTask(saved); setStatus(saved.status); setProgress(String(saved.progress_percent ?? 0))
      setSuccess(saved.status === 'review' ? (saved.task_type === 'deliverable' ? 'Deliverable submitted for review.' : 'Task submitted for review.') : saved.status === 'completed' ? 'Task completed.' : 'Task progress saved.')
      onSaved(saved)
    } catch (failure) {
      if (controller.signal.aborted) return
      setError(messageFor(failure))
      setConflict(failure?.response?.status === 409)
      if ([403, 404].includes(failure?.response?.status)) setTask(null)
    } finally {
      saveInFlight.current = false
      if (!controller.signal.aborted) { setSaving(false); onBusyChange(false) }
    }
  }

  if (loading) return <div className="wh-task-loading" role="status"><ArrowPathIcon className="wh-spin" aria-hidden="true" />Loading your task…</div>
  return <div className="wh-task-detail">
    {error && <div className="wh-task-alert" role="alert"><p>{error}</p>{(!task || conflict) && <button className="wh-button" onClick={() => setRevision(value => value + 1)}>Reload task</button>}</div>}
    {success && <div className="wh-task-success" role="status"><CheckCircleIcon aria-hidden="true" />{success}</div>}
    {task && <>
      <div className="wh-task-heading"><span className="wh-status wh-status--blue">{task.task_type === 'deliverable' ? 'Deliverable task' : 'Task'}</span>{task.role === 'reviewer' && <span className="wh-status wh-status--amber">Assigned to you for review</span>}<h3>{task.title}</h3><p>{[task.project?.code, task.project?.name].filter(Boolean).join(' · ')}</p></div>
      <dl className="wh-task-facts"><div><dt>Due date</dt><dd>{displayDate(task.due_date)}</dd></div><div><dt>Priority</dt><dd>{humanize(task.priority)}</dd></div><div><dt>Assigned employee</dt><dd>{personName(task.assigned_to)}{task.assigned_to?.employee_code && <small>{task.assigned_to.employee_code}</small>}</dd></div><div><dt>Reviewer</dt><dd>{personName(task.reviewer)}</dd></div></dl>
      {!(task.task_type === 'deliverable' && task.description === task.acceptance_criteria) && <section className="wh-task-copy"><h4>Description</h4><p>{task.description || 'No description recorded.'}</p></section>}
      {(task.task_type === 'deliverable' || task.acceptance_criteria && task.acceptance_criteria !== task.description) && <section className="wh-task-copy"><h4>Acceptance criteria</h4><p>{task.acceptance_criteria || 'No acceptance criteria recorded.'}</p></section>}
      <form onSubmit={save} className="wh-task-form">
        <fieldset disabled={saving || conflict}><legend>Task progress</legend><div className="wh-task-fields"><label>Status<select value={status} onChange={event => { setStatus(event.target.value); setSuccess('') }} disabled={!canUpdateStatus}>{[...new Set([task.status, ...allowed])].map(value => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label><label>Progress (%)<input type="number" min="0" max="100" step="1" required value={progress} disabled={!canUpdateProgress} onChange={event => { setProgress(event.target.value); setSuccess('') }} /></label></div></fieldset>
        {task.task_type === 'deliverable' && task.reviewer && task.role === 'assignee' && task.status !== 'completed' && <p className="wh-task-hint">Submit for review when the deliverable meets the acceptance criteria.</p>}
        {task.role === 'reviewer' && task.status === 'review' && <p className="wh-task-hint">Review the acceptance criteria, then complete the task or return it to In progress.</p>}
        <footer><button type="button" className="wh-button" onClick={onClose} disabled={saving}>Close</button>{(canUpdateStatus || canUpdateProgress) && <button type="submit" className="wh-button wh-button--primary" disabled={saving || conflict || !changed}>{saving ? 'Saving…' : status === 'review' && status !== task.status ? 'Submit for review' : status === 'completed' && status !== task.status ? 'Confirm completion' : 'Save progress'}</button>}</footer>
      </form>
    </>}
  </div>
}
