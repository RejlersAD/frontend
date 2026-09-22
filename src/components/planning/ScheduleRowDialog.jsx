import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { Dialog } from './WorkBreakdownPanel'
import { scheduleDependencyEntries } from '../../utils/primaveraDependencies'
import './ScheduleRowDialog.css'

export default function ScheduleRowDialog({ row, tasks, busy, saveError, onSave, onClose }) {
  const [name, setName] = useState(row.title || '')
  const deleting = row.action === 'delete'
  const activity = row.kind === 'activity'
  const label = activity ? 'activity' : 'WBS'
  const selectedIds = new Set(row.taskIds.map(String))
  const affectedTasks = tasks.filter(task => selectedIds.has(String(task.id)))
  const relationshipCount = tasks.reduce((count, task) => count + scheduleDependencyEntries(task)
    .filter(link => selectedIds.has(String(task.id)) || selectedIds.has(link.predecessorId)).length, 0)
  const submit = event => {
    event.preventDefault()
    if (!busy && (deleting || name.trim())) onSave(deleting ? undefined : name.trim())
  }
  return <Dialog title={`${deleting ? 'Delete' : 'Edit'} ${label}`} busy={busy} onClose={onClose} footer={<>
    <button type="button" className="wbd-button" disabled={busy} onClick={onClose}>Cancel</button>
    <button type="submit" form="schedule-row-form" className={`wbd-button ${deleting ? 'schedule-row-delete' : 'wbd-primary'}`} disabled={busy || (!deleting && !name.trim())}>
      {busy ? 'Saving…' : deleting ? `Delete ${label}` : 'Save changes'}
    </button>
  </>}>
    <form id="schedule-row-form" onSubmit={submit}>
      {saveError && <p className="wbd-error" role="alert">{saveError}</p>}
      {deleting ? <>
        <p className="schedule-row-title">{row.code && <span>{row.code} · </span>}{row.title}</p>
        <p className="schedule-row-impact">{affectedTasks.length} {affectedTasks.length === 1 ? 'activity' : 'activities'} and {relationshipCount} dependency {relationshipCount === 1 ? 'relationship' : 'relationships'} will be removed from this draft.</p>
        {!activity && affectedTasks.length > 0 && <ul className="schedule-row-affected" aria-label="Activities to delete">
          {affectedTasks.map(task => <li key={task.id}>{task.activity_code && <span>{task.activity_code} · </span>}{task.title}</li>)}
        </ul>}
        <p className="wbd-note">Review the remaining schedule and calculate it again after deletion.</p>
      </> : <>
        <label>{activity ? 'Activity name' : 'WBS name'}<input required maxLength={activity ? 500 : 255} value={name} disabled={busy} onChange={event => setName(event.target.value)} /></label>
        <p className="wbd-note">{activity ? 'Edit duration, start and finish in the activity row. Use its logic button to update dependencies.' : 'WBS timing may come from an independent source summary or from its child activities. Edit the activity rows to change their dates and durations; calculate the schedule to update its rollups.'}</p>
      </>}
    </form>
  </Dialog>
}

ScheduleRowDialog.propTypes = {
  row: PropTypes.shape({ kind: PropTypes.string.isRequired, action: PropTypes.string.isRequired, title: PropTypes.string, code: PropTypes.string, taskIds: PropTypes.array.isRequired }).isRequired,
  tasks: PropTypes.array.isRequired, busy: PropTypes.bool, saveError: PropTypes.string,
  onSave: PropTypes.func.isRequired, onClose: PropTypes.func.isRequired,
}
