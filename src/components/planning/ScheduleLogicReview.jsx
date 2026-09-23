import { useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { AlertTriangle, CheckCircle2, GitBranch, Loader2 } from 'lucide-react'
import { scheduleDependencyEntries } from '../../utils/primaveraDependencies'
import { scheduleDate } from '../../utils/primaveraSchedule'
import './ScheduleLogicReview.css'

const TYPES = { FS: 'Finish to start', SS: 'Start to start', FF: 'Finish to finish', SF: 'Start to finish' }
const key = value => String(value)
const taskLabel = task => [task?.activity_code || task?.external_id || task?.id, task?.title].filter(Boolean).join(' · ')
const numeric = value => value != null && value !== '' && Number.isFinite(Number(value))
const durationLabel = (value, unit = 'working_days') => numeric(value) ? `${value} ${String(unit || 'unit not specified').replaceAll('_', ' ')}` : 'Not specified'
const groupLabel = group => `${group.discipline || 'Unassigned discipline'} · ${group.deliverable_count ?? 0} deliverables · ${{ parallel_workflow: 'Parallel workflows', unconnected_workflow_start: 'Open workflow starts', terminal_branch: 'Terminal branches' }[group.kind] || 'Logic finding'}`
const errorMessage = error => error?.response?.data?.error || error?.response?.data?.detail || error?.message || 'The change could not be saved. Please try again.'
const linksFor = (task, sourceOnly = false) => scheduleDependencyEntries(task, { sourceOnly: true }).map(link => ({
  task_id: link.predecessorId, type: link.type, lag_days: link.lagValue,
  lag_unit: link.detail.lag_unit ?? link.detail.metadata?.lag_unit ?? link.reason?.lag_unit ?? (sourceOnly ? null : 'working_days'),
}))
const sameLinks = (left, right) => JSON.stringify(left.map(link => [key(link.task_id), link.type, Number(link.lag_days)]).sort()) === JSON.stringify(right.map(link => [key(link.task_id), link.type, Number(link.lag_days)]).sort())

function createsCycle(tasks, updates) {
  const changed = new Map(updates.filter(update => update.dependency_details).map(update => [key(update.task_id), update.dependency_details]))
  const indegree = new Map(tasks.map(task => [key(task.id), 0])), successors = new Map()
  for (const task of tasks) {
    const predecessors = new Set((changed.get(key(task.id)) || linksFor(task)).map(link => key(link.task_id)))
    for (const predecessor of predecessors) {
      if (!indegree.has(predecessor)) continue
      indegree.set(key(task.id), indegree.get(key(task.id)) + 1)
      if (!successors.has(predecessor)) successors.set(predecessor, [])
      successors.get(predecessor).push(key(task.id))
    }
  }
  const ready = [...indegree.keys()].filter(id => indegree.get(id) === 0)
  let visited = 0
  for (let index = 0; index < ready.length; index += 1) {
    visited += 1
    for (const id of successors.get(ready[index]) || []) {
      indegree.set(id, indegree.get(id) - 1)
      if (!indegree.get(id)) ready.push(id)
    }
  }
  return visited !== tasks.length
}

function LogicGroupEditor({ group, plan, tasks, busy, readOnly, onApplyUpdates, onConfirmParallel, onEditTask }) {
  const sourceOnly = plan.duration_policy === 'source_only' || plan.evidence_policy === 'document_driven' || Boolean(plan.duration_review)
  const currentDurationLabel = task => durationLabel(task.duration_days, task.duration_unit ?? (sourceOnly ? null : 'working_days'))
  const taskMap = useMemo(() => new Map(tasks.map(task => [key(task.id), task])), [tasks])
  const firstTasks = (group.first_task_ids || []).map(id => taskMap.get(key(id))).filter(Boolean)
  const [selected, setSelected] = useState(() => new Set(firstTasks.map(task => key(task.id))))
  const [operation, setOperation] = useState('keep'), [predecessor, setPredecessor] = useState('')
  const [relationship, setRelationship] = useState('FS'), [lag, setLag] = useState('0')
  const [editDuration, setEditDuration] = useState(false), [duration, setDuration] = useState('')
  const [preview, setPreview] = useState(null), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [working, setWorking] = useState('')
  const [rationale, setRationale] = useState(''), [durationBasis, setDurationBasis] = useState(''), [capacityBasis, setCapacityBasis] = useState(''), [capacity, setCapacity] = useState('')
  const mounted = useRef(false), pending = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const disabled = Boolean(busy || working || readOnly)
  const selectedTasks = firstTasks.filter(task => selected.has(key(task.id)))
  const memberships = useMemo(() => {
    const result = new Map()
    for (const task of tasks) {
      const id = task.parent_deliverable_id ?? task.metadata?.parent_deliverable_id
      if (id != null) result.set(key(task.id), key(id))
    }
    for (const deliverable of plan.deliverables || []) for (const id of deliverable.workflow_task_ids || deliverable.task_ids || []) {
      if (!result.has(key(id))) result.set(key(id), key(deliverable.id))
    }
    return result
  }, [tasks, plan.deliverables])
  const internal = (task, id) => memberships.has(key(task.id)) && memberships.get(key(task.id)) === memberships.get(key(id))
  const selectedWorkflows = new Set(selectedTasks.map(task => memberships.get(key(task.id))).filter(id => id != null))
  const availablePredecessors = tasks.filter(task => !selected.has(key(task.id)) && !selectedWorkflows.has(memberships.get(key(task.id))))
  const describeLinks = links => links.length ? links.map(link => `${taskLabel(taskMap.get(key(link.task_id))) || link.task_id}: ${TYPES[link.type] ? link.type : 'type not specified'}, ${numeric(link.lag_days) ? `${Number(link.lag_days)} ${String(link.lag_unit || 'unit not specified').replaceAll('_', ' ')} lag` : 'lag not specified'}`).join('; ') : 'No predecessors'
  const change = callback => { callback(); setPreview(null); setError(''); setNotice('') }

  const makePreview = () => {
    setError(''); setNotice(''); setPreview(null)
    if (disabled) return
    try {
      if (!selectedTasks.length) throw new Error('Select at least one first-stage activity.')
      if (operation === 'keep' && !editDuration) throw new Error('Choose a predecessor change or a first-stage duration change.')
      if (operation !== 'keep' && !availablePredecessors.some(task => key(task.id) === predecessor)) throw new Error('Choose an external predecessor outside the selected workflows.')
      if (['add', 'replace'].includes(operation) && (!TYPES[relationship] || !numeric(lag) || Math.abs(Number(lag)) > 365)) throw new Error('Choose a relationship type and a lag between -365 and 365 working days.')
      if (editDuration && (!numeric(duration) || Number(duration) <= 0)) throw new Error('Enter a positive first-stage duration in working days.')
      const rows = selectedTasks.map(task => {
        const before = linksFor(task, sourceOnly), update = { task_id: task.id }
        let after = before
        if (operation !== 'keep') {
          if (before.some(link => !TYPES[link.type] || !numeric(link.lag_days) || !taskMap.has(key(link.task_id)))) throw new Error(`${taskLabel(task)} has an unspecified relationship type, lag or predecessor. Open the activity for individual review before changing its links in bulk.`)
          if (before.some(link => link.lag_unit !== 'working_days')) throw new Error(`${taskLabel(task)} has a lag in a non-working-day or unspecified unit. Review the source and calendar individually before changing these links.`)
          if (operation === 'remove') after = before.filter(link => internal(task, link.task_id) || key(link.task_id) !== predecessor)
          else {
            const added = { task_id: taskMap.get(predecessor).id, type: relationship, lag_days: Number(lag), lag_unit: 'working_days' }
            if (operation === 'add' && before.some(link => key(link.task_id) === predecessor && link.type === relationship)) throw new Error(`${taskLabel(task)} already has this relationship. Review it individually or choose replacement.`)
            after = [...(operation === 'replace' ? before.filter(link => internal(task, link.task_id)) : before), added]
          }
          if (!sameLinks(before, after)) update.dependency_details = after.map(link => ({ task_id: taskMap.get(key(link.task_id))?.id ?? link.task_id, type: link.type, lag_days: Number(link.lag_days) }))
        }
        if (editDuration && (!numeric(task.duration_days) || Number(task.duration_days) !== Number(duration))) update.duration_days = Number(duration)
        return { task, before, after, update }
      }).filter(row => row.update.dependency_details || row.update.duration_days != null)
      if (!rows.length) throw new Error('The selected settings do not change any activities.')
      const updates = rows.map(row => row.update)
      if (operation !== 'keep' && createsCycle(tasks, updates)) throw new Error('These relationships leave a circular sequence. Review the affected activities before applying changes.')
      setPreview({ rows, updates })
    } catch (caught) { setError(caught.message) }
  }
  const run = async (name, action, message) => {
    if (pending.current || disabled) return
    pending.current = true; setWorking(name); setError(''); setNotice('')
    try {
      const result = await action()
      if (mounted.current) {
        if (result) { setPreview(null); setNotice(message) }
        else setError('The change was not saved. Review the reported issue and try again.')
      }
    } catch (caught) { if (mounted.current) setError(errorMessage(caught)) }
    finally { pending.current = false; if (mounted.current) setWorking('') }
  }
  const confirm = event => {
    event.preventDefault()
    if ([rationale, durationBasis, capacityBasis].some(value => value.trim().length < 20) || !Number.isInteger(Number(capacity)) || Number(capacity) < group.deliverable_count) {
      setError('Provide at least 20 characters for each review basis and a whole-number capacity covering all deliverables in this group.'); return
    }
    run('confirm', () => onConfirmParallel({ fingerprint: plan.logic_quality.fingerprint, group_id: group.id, rationale: rationale.trim(), duration_basis: durationBasis.trim(), capacity_basis: capacityBasis.trim(), max_parallel_deliverables: Number(capacity) }), 'Parallel-work assumption recorded. Calculation and schedule assurance still require review.')
  }

  return <div className="slr-group">
    <header><h4>{groupLabel(group)}</h4>{group.status === 'reviewed' ? <span className="slr-reviewed"><CheckCircle2 size={14} />Assumption recorded</span> : <span className="slr-warning"><AlertTriangle size={14} />{group.requires_review ? 'Review required' : 'Review warning'}</span>}</header>
    <p>{group.message}</p>
    <dl className="slr-facts"><div><dt>Workflow activities</dt><dd>{group.task_ids?.length ?? 0}</dd></div><div><dt>First-stage activities</dt><dd>{firstTasks.length}</dd></div><div><dt>{group.date_basis === 'source' ? 'Source date window' : group.date_basis === 'calculated' ? 'Calculated date window' : 'Recorded date window'}</dt><dd>{group.start_date || group.finish_date ? `${scheduleDate(group.start_date)} → ${scheduleDate(group.finish_date)}` : 'Not available'}</dd></div></dl>
    <details><summary>Group evidence and stage durations</summary><p>{(group.deliverable_titles || []).join('; ') || 'Deliverable titles are not available.'}</p><h5>Common external predecessors</h5>{group.common_predecessors?.length ? <ul>{group.common_predecessors.map((link, index) => <li key={`${link.task_id}:${link.type}:${index}`}>{taskLabel(taskMap.get(key(link.task_id))) || link.title || link.task_id} · {TYPES[link.type] ? link.type : 'Type not specified'} · {numeric(link.lag_days) ? `${link.lag_days} ${String(link.lag_unit || 'unit not specified').replaceAll('_', ' ')} lag` : 'Lag not specified'}{link.successor_stage_code && ` · Into ${link.successor_stage_code}`}</li>)}</ul> : <p>No common external predecessors recorded.</p>}
      <table><caption>Recorded stage durations</caption><thead><tr><th>Stage</th><th>Duration</th><th>Unit</th></tr></thead><tbody>{(group.stage_durations || []).map((stage, index) => <tr key={`${stage.stage_code}:${index}`}><td>{stage.stage_code || 'Not specified'}</td><td>{stage.duration_days ?? 'Not specified'}</td><td>{String(stage.duration_unit || 'Not specified').replaceAll('_', ' ')}</td></tr>)}</tbody></table>
    </details>
    {group.review && <div className="slr-recorded" aria-label="Recorded parallel-work assumption"><h5>Recorded review basis</h5><dl><dt>Rationale</dt><dd>{group.review.rationale}</dd><dt>Duration basis</dt><dd>{group.review.duration_basis}</dd><dt>Capacity basis</dt><dd>{group.review.capacity_basis}</dd><dt>Maximum parallel deliverables</dt><dd>{group.review.max_parallel_deliverables}</dd></dl><p>This records a planning assumption. Calculation and schedule assurance still require review.</p></div>}
    <h5>First-stage activities</h5>
    <p className="slr-muted">Bulk changes affect only selected first-stage activities. Internal stage relationships and all other activities remain unchanged.</p>
    <label className="slr-check"><input type="checkbox" aria-label="Select all first-stage activities" disabled={disabled || !firstTasks.length} checked={Boolean(firstTasks.length && selectedTasks.length === firstTasks.length)} ref={node => { if (node) node.indeterminate = selectedTasks.length > 0 && selectedTasks.length < firstTasks.length }} onChange={event => change(() => setSelected(new Set(event.target.checked ? firstTasks.map(task => key(task.id)) : [])))} />Select all first-stage activities</label>
    <div className="slr-table"><table><thead><tr><th>Select</th><th>Activity</th><th>Duration</th><th>Existing predecessors</th><th>Review</th></tr></thead><tbody>{firstTasks.map(task => <tr key={task.id}><td><input type="checkbox" aria-label={`Select first-stage activity ${taskLabel(task)}`} disabled={disabled} checked={selected.has(key(task.id))} onChange={event => change(() => setSelected(current => { const next = new Set(current); if (event.target.checked) next.add(key(task.id)); else next.delete(key(task.id)); return next }))} /></td><td>{taskLabel(task)}</td><td>{currentDurationLabel(task)}</td><td>{describeLinks(linksFor(task, sourceOnly))}</td><td><button type="button" disabled={Boolean(busy || working) || !onEditTask} onClick={() => onEditTask(task)} aria-label={`Open activity ${taskLabel(task)}`}>Open activity</button></td></tr>)}</tbody></table></div>
    {!firstTasks.length && <p>No first-stage activities are available for bulk changes in this group.</p>}
    <fieldset className="slr-controls" disabled={disabled || !firstTasks.length}><legend>Review changes for {selectedTasks.length} selected activities</legend>
      <label>Predecessor change<select aria-label="Predecessor change" value={operation} onChange={event => change(() => setOperation(event.target.value))}><option value="keep">Keep existing predecessors</option><option value="add">Add predecessor</option><option value="remove">Remove predecessor</option><option value="replace">Replace external predecessors</option></select></label>
      {operation !== 'keep' && <label>External predecessor<select aria-label="External predecessor" value={predecessor} onChange={event => change(() => setPredecessor(event.target.value))}><option value="">Choose activity</option>{availablePredecessors.map(task => <option key={task.id} value={key(task.id)}>{taskLabel(task)}</option>)}</select></label>}
      {['add', 'replace'].includes(operation) && <><label>Relationship type<select aria-label="Relationship type" value={relationship} onChange={event => change(() => setRelationship(event.target.value))}>{Object.entries(TYPES).map(([type, label]) => <option key={type} value={type}>{type} — {label}</option>)}</select></label><label>Lag (working days)<input aria-label="Lag (working days)" type="number" min="-365" max="365" step="any" value={lag} onChange={event => change(() => setLag(event.target.value))} /></label></>}
      {operation === 'remove' && <p className="slr-muted">Remove all external relationships from this predecessor. Other predecessor links are retained.</p>}
      {operation === 'replace' && <p className="slr-muted">Replace all external predecessors of each selected activity with the chosen link. Internal workflow links are retained.</p>}
      <label className="slr-check slr-wide"><input type="checkbox" checked={editDuration} onChange={event => change(() => setEditDuration(event.target.checked))} />Change first-stage duration</label>
      {editDuration && <label>First-stage duration (working days)<input aria-label="First-stage duration (working days)" type="number" min="0.01" step="any" value={duration} onChange={event => change(() => setDuration(event.target.value))} /></label>}
      <div className="slr-wide"><button type="button" disabled={!selectedTasks.length || operation === 'keep' && !editDuration || !onApplyUpdates} onClick={makePreview}>Preview changes</button></div>
    </fieldset>
    {preview && <section className="slr-preview" aria-label="Reviewed changes"><h5>Before and after</h5><p>{preview.updates.length} activities will change. Review every change before applying it.</p><div className="slr-table"><table><thead><tr><th>Activity</th><th>Before</th><th>After</th></tr></thead><tbody>{preview.rows.map(row => <tr key={row.task.id}><td>{taskLabel(row.task)}</td><td>{describeLinks(row.before)}<small>Duration: {currentDurationLabel(row.task)}</small></td><td>{describeLinks(row.after)}<small>Duration: {row.update.duration_days != null ? durationLabel(row.update.duration_days) : currentDurationLabel(row.task)}</small></td></tr>)}</tbody></table></div><button type="button" className="slr-primary" disabled={disabled || !onApplyUpdates} onClick={() => run('apply', () => onApplyUpdates(preview.updates), 'Reviewed changes saved. Calculate the schedule and review the resulting dates and logic.')}>Apply reviewed changes</button></section>}
    {group.kind === 'parallel_workflow' && <details className="slr-parallel"><summary>Keep these deliverables in parallel</summary><p>Confirm that resources can support this concurrency and explain the duration basis. Recording an assumption does not approve or baseline the schedule.</p><form onSubmit={confirm}><fieldset disabled={disabled || !onConfirmParallel}><legend>Parallel-work review basis</legend><label>Parallel-work rationale<textarea aria-label="Parallel-work rationale" required minLength={20} maxLength={2000} value={rationale} onChange={event => setRationale(event.target.value)} /></label><label>Duration basis<textarea aria-label="Duration basis" required minLength={20} maxLength={2000} value={durationBasis} onChange={event => setDurationBasis(event.target.value)} /></label><label>Capacity basis<textarea aria-label="Capacity basis" required minLength={20} maxLength={2000} value={capacityBasis} onChange={event => setCapacityBasis(event.target.value)} /></label><label>Maximum parallel deliverables<input aria-label="Maximum parallel deliverables" required type="number" min={group.deliverable_count} step="1" value={capacity} onChange={event => setCapacity(event.target.value)} /></label><button type="submit">Record parallel-work assumption</button></fieldset></form></details>}
    {working && <p className="slr-progress" role="status"><Loader2 size={15} className="animate-spin" />{working === 'apply' ? 'Saving reviewed changes…' : 'Recording parallel-work assumption…'}</p>}
    {error && <p className="slr-error" role="alert">{typeof error === 'string' ? error : 'The change could not be saved. Review the inputs and try again.'}</p>}
    {notice && <p className="slr-success" role="status">{notice}</p>}
  </div>
}

export default function ScheduleLogicReview({ plan, tasks, busy = false, readOnly = false, canCreateDraft = false, onCreateDraft, onApplyUpdates, onConfirmParallel, onEditTask, onCalculate }) {
  const quality = plan.logic_quality || {}, groups = quality.groups || [], summary = quality.summary || {}
  const [groupId, setGroupId] = useState(''), [creating, setCreating] = useState(false), [error, setError] = useState('')
  const mounted = useRef(false), pending = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const group = groups.find(item => key(item.id) === groupId) || groups.find(item => item.kind === 'parallel_workflow' && item.requires_review) || groups[0]
  const context = JSON.stringify([plan.project_id || plan.project?.id, plan.version_id, plan.revision, quality.fingerprint])
  useEffect(() => { setError('') }, [context])
  const createDraft = async () => {
    if (pending.current || busy || !canCreateDraft || !onCreateDraft) return
    pending.current = true; setCreating(true); setError('')
    try { if (!await onCreateDraft() && mounted.current) setError('The correction draft could not be created. Review the reported issue and try again.') }
    catch (caught) { if (mounted.current) setError(errorMessage(caught)) }
    finally { pending.current = false; if (mounted.current) setCreating(false) }
  }
  return <section className="schedule-logic-review" aria-label="Schedule logic review">
    <header className="slr-heading"><div><GitBranch size={18} /><h3>Review schedule logic</h3></div>{onCalculate && <button type="button" disabled={busy || creating || readOnly} onClick={onCalculate}>Calculate schedule</button>}</header>
    <p>Check why deliverables run in parallel. Add evidence-based predecessors or review the duration and resource assumptions before relying on the schedule.</p>
    <dl className="slr-counts"><div><dt>Parallel groups</dt><dd>{summary.parallel_group_count ?? 0}</dd></div><div><dt>Parallel deliverables</dt><dd>{summary.parallel_deliverable_count ?? 0}</dd></div><div><dt>Groups requiring review</dt><dd>{summary.unreviewed_group_count ?? summary.requires_review_count ?? 0}</dd></div><div><dt>Open workflow starts</dt><dd>{summary.unconnected_workflow_start_count ?? 0}</dd></div><div><dt>Terminal branches</dt><dd>{summary.terminal_branch_count ?? 0}</dd></div></dl>
    {(summary.unconnected_workflow_start_count > 0 || summary.terminal_branch_count > 0) && <p className="slr-warning"><AlertTriangle size={16} />Open starts and terminal branches need review. Independent starts and final deliverables may be intentional.</p>}
    {readOnly && <div className="slr-readonly"><p>This schedule is read only. Create a correction draft to review changes while retaining the existing baseline or source version.</p>{canCreateDraft && onCreateDraft && <button type="button" className="slr-primary" disabled={busy || creating} onClick={createDraft}>{creating ? 'Creating correction draft…' : 'Create correction draft'}</button>}</div>}
    {error && <p className="slr-error" role="alert">{typeof error === 'string' ? error : 'The correction draft could not be created.'}</p>}
    {!plan.logic_quality ? <p>Logic diagnostics are not available for this schedule.</p> : !groups.length ? <p>No parallel-workflow or open-branch findings are recorded. This does not establish schedule approval.</p> : <><label className="slr-group-select">Logic review group<select aria-label="Logic review group" disabled={busy || creating} value={key(group.id)} onChange={event => setGroupId(event.target.value)}>{groups.map(item => <option key={item.id} value={key(item.id)}>{groupLabel(item)}{item.status === 'reviewed' ? ' · Assumption recorded' : ''}</option>)}</select></label><LogicGroupEditor key={`${context}:${group.id}`} group={group} plan={plan} tasks={tasks} busy={busy || creating} readOnly={readOnly} onApplyUpdates={onApplyUpdates} onConfirmParallel={onConfirmParallel} onEditTask={onEditTask} /></>}
  </section>
}

const commonProps = { plan: PropTypes.object.isRequired, tasks: PropTypes.array.isRequired, busy: PropTypes.bool, readOnly: PropTypes.bool, onApplyUpdates: PropTypes.func, onConfirmParallel: PropTypes.func, onEditTask: PropTypes.func }
LogicGroupEditor.propTypes = { ...commonProps, group: PropTypes.object.isRequired }
ScheduleLogicReview.propTypes = { ...commonProps, canCreateDraft: PropTypes.bool, onCreateDraft: PropTypes.func, onCalculate: PropTypes.func }
