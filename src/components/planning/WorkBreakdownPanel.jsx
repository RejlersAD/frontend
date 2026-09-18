import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, ChevronRight, ClipboardList, Clock3, FileSpreadsheet, FileText, Info, Loader2, Pencil, Plus, RefreshCw, Save, Sparkles, Trash2, User, X } from 'lucide-react'
import planningIntelligenceService from '../../services/planningIntelligence.service'
import useModalAccessibility from '../../hooks/useModalAccessibility'
import PlanningEmployeePicker from './PlanningEmployeePicker'
import PlanningEmployeeActivity from './PlanningEmployeeActivity'
import { isScheduleMilestone } from '../../utils/primaveraSchedule'
import './WorkBreakdownPanel.css'

const hours = value => new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value)
const newId = () => `task-${crypto.randomUUID()}`
const errorMessage = error => {
  const data = error?.response?.data
  const flatten = value => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(flatten) : []
  return data?.error || data?.detail || flatten(data).join(' ') || error?.message || 'Unable to save work breakdown. Please try again.'
}
const emptyTask = discipline => ({ id: newId(), discipline, title: '', owner: '', assignee_id: null, assignee: null, reviewer_id: null, reviewer_user: null, task_type: 'task', due_date: null, priority: 'medium', status: 'todo', progress_percent: 0, effort_hours: null, depends_on: [], acceptance_criteria: '', reviewer: '', source_references: [] })
const statusLabels = { todo: 'Not started', in_progress: 'In progress', review: 'In review', completed: 'Completed', blocked: 'Blocked' }
const dueLabel = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Set date'
const assigned = task => Boolean(task.assignee_id)
const employeeName = task => task.assignee?.name || task.owner || 'Employee'
const summarizeGroup = tasks => {
  const people = [...new Map(tasks.filter(assigned).map(task => [String(task.assignee_id), task])).values()]
  const completed = tasks.filter(task => task.status === 'completed').length
  const status = completed === tasks.length ? 'completed' : tasks.some(task => task.status === 'blocked') ? 'blocked'
    : tasks.some(task => task.status === 'review') ? 'review'
      : completed || tasks.some(task => task.status === 'in_progress' || task.progress_percent > 0) ? 'in_progress' : 'todo'
  const dueDates = tasks.map(task => task.due_date).filter(Boolean).sort()
  return { people, completed, status, due: dueDates.at(-1), dated: dueDates.length }
}

export function EmployeeActivityLink({ task, onOpen, disabled }) {
  const name = employeeName(task)
  return <button type="button" className="wbd-owner" disabled={disabled} aria-label={`View activity for ${name}`} onClick={() => onOpen(task)}>
    <span className="wbd-person-avatar" aria-hidden="true">{name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span><span>{name}</span>
  </button>
}
EmployeeActivityLink.propTypes = { task: PropTypes.object.isRequired, onOpen: PropTypes.func.isRequired, disabled: PropTypes.bool }

function Dialog({ title, children, onClose, footer, busy = false }) {
  // Keep the editor inside an open native modal; portals outside it are inert.
  const portalHost = useRef(document.activeElement?.closest('dialog[open]') || document.body)
  const ref = useModalAccessibility(true, onClose, busy)
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])
  return createPortal(<div className="wbd-backdrop" onMouseDown={event => { if (!busy && event.target === event.currentTarget) onClose() }}>
    <section ref={ref} className="wbd-dialog" role="dialog" aria-modal="true" aria-busy={busy} aria-labelledby="wbd-dialog-title" tabIndex={-1}>
      <header><h2 id="wbd-dialog-title">{title}</h2><button type="button" disabled={busy} className="wbd-icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button></header>
      <div className="wbd-dialog-body">{children}</div><footer>{footer}</footer>
    </section>
  </div>, portalHost.current)
}
Dialog.propTypes = { title: PropTypes.string.isRequired, children: PropTypes.node, onClose: PropTypes.func.isRequired, footer: PropTypes.node, busy: PropTypes.bool }

export function TaskDialog({ projectId, task, tasks, disciplines, manual, scheduleEditing = false, isNew, initialField, onSave, onDelete, onClose, busy, saveError }) {
  const [draft, setDraft] = useState({ task_type: 'deliverable', due_date: null, priority: 'medium', assignee_id: null, reviewer_id: null, ...task, depends_on: [...task.depends_on] })
  const [error, setError] = useState('')
  const workflowStage = task.parent_deliverable_id != null || Boolean(task.workflow_stage_code || task.metadata?.workflow_stage_code)
  const milestone = isScheduleMilestone(task)
  useEffect(() => {
    const selectors = { owner: '[role="combobox"]', planned_start_date: '[name="planned_start_date"]', duration_days: '[name="duration_days"]', dependencies: '.wbd-dependencies input' }
    if (selectors[initialField]) document.querySelector(`#wbd-task-form ${selectors[initialField]}`)?.focus()
  }, [initialField])
  const change = (key, value) => setDraft(current => ({ ...current, [key]: value }))
  const save = event => {
    event.preventDefault()
    if (busy) return
    const value = { ...draft, title: draft.title.trim(), owner: (draft.owner || '').trim(), reviewer: (draft.reviewer || '').trim(), due_date: draft.due_date || null, effort_hours: draft.effort_hours === '' || draft.effort_hours == null ? null : Number(draft.effort_hours) }
    if (!value.title) { setError('Enter a task or deliverable name.'); return }
    if (value.effort_hours !== null && (!Number.isFinite(value.effort_hours) || value.effort_hours < 0)) { setError('Enter a valid planned effort of zero or more hours.'); return }
    if (manual && !scheduleEditing && value.planned_start_date && value.due_date && value.planned_start_date > value.due_date) { setError('Due date must be on or after the planned start.'); return }
    if (scheduleEditing && value.due_date !== task.due_date && value.planned_start_date && value.due_date && value.planned_start_date > value.due_date) { setError('Due date must be on or after the planned start.'); return }
    if ((manual || scheduleEditing) && value.duration_days != null && (!Number.isFinite(value.duration_days) || value.duration_days < 0)) { setError('Enter a duration of zero or more working days.'); return }
    const graph = new Map([...tasks.filter(row => row.id !== value.id), value].map(row => [row.id, row.depends_on]))
    const visiting = new Set(), visited = new Set()
    const cycle = id => { if (visiting.has(id)) return true; if (visited.has(id)) return false; visiting.add(id); if ((graph.get(id) || []).some(cycle)) return true; visiting.delete(id); visited.add(id); return false }
    if ([...graph.keys()].some(cycle)) { setError('These dependencies create a circular sequence. Select an earlier task.'); return }
    onSave(value)
  }
  return <Dialog title={isNew ? 'Add task' : 'Edit task'} onClose={onClose} busy={busy} footer={<>
    {!isNew && !workflowStage && <button type="button" disabled={busy} className="wbd-button wbd-delete" onClick={() => onDelete(task.id)}><Trash2 size={15} />Remove task</button>}
    <button type="button" disabled={busy} className="wbd-button" onClick={onClose}>Cancel</button><button type="submit" disabled={busy} form="wbd-task-form" className="wbd-button wbd-primary">{busy ? <><Loader2 size={15} className="animate-spin" />Saving…</> : isNew ? 'Add task' : 'Save task'}</button>
  </>}>
    <form id="wbd-task-form" onSubmit={save}>
      {(error || saveError) && <p className="wbd-error" role="alert">{error || saveError}</p>}
      <fieldset className="wbd-task-fields" disabled={busy}>
      <label>Task / deliverable<input required maxLength={500} value={draft.title} onChange={event => change('title', event.target.value)} /></label>
      <div className="wbd-form-grid"><label>Work type<select value={draft.task_type} onChange={event => change('task_type', event.target.value)}><option value="task">Task</option><option value="deliverable">Deliverable</option></select></label>
        <label>{manual ? 'Workstream' : 'Discipline'}<select value={draft.discipline} onChange={event => change('discipline', event.target.value)}>{disciplines.map(row => <option key={row.code} value={row.code}>{row.name}</option>)}</select></label>
        <PlanningEmployeePicker projectId={projectId} label="Assigned to" value={draft.assignee} disabled={busy} legacyName={draft.assignee_id ? '' : draft.owner} onChange={employee => setDraft(current => ({ ...current, assignee: employee, assignee_id: employee?.user_id ?? null, owner: employee?.name || '' }))} />
        <PlanningEmployeePicker projectId={projectId} label="Reviewer" value={draft.reviewer_user} disabled={busy} legacyName={draft.reviewer_id ? '' : draft.reviewer} onChange={employee => setDraft(current => ({ ...current, reviewer_user: employee, reviewer_id: employee?.user_id ?? null, reviewer: employee?.name || '' }))} />
        <label>Due date<input type="date" value={draft.due_date || ''} onChange={event => change('due_date', event.target.value)} /></label>
        {(manual || scheduleEditing) && <label>Planned start<input name="planned_start_date" type="date" value={draft.planned_start_date || ''} onChange={event => change('planned_start_date', event.target.value || null)} /></label>}
        {(manual || scheduleEditing) && <label>Duration (working days)<input name="duration_days" type="number" min={scheduleEditing && !milestone ? '0.25' : '0'} readOnly={scheduleEditing && milestone} title={scheduleEditing && milestone ? 'Milestones have zero duration.' : undefined} step="0.25" value={draft.duration_days ?? ''} onChange={event => change('duration_days', event.target.value === '' ? null : Number(event.target.value))} placeholder="Calculated from effort if blank" /></label>}
        {scheduleEditing && <p className="wbd-note">Finish dates recalculate from durations, dependencies and the project calendar when saved.</p>}
        <label>Priority<select value={draft.priority} onChange={event => change('priority', event.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label>
        <label>Planned effort (hours)<input type="number" min="0" step="0.01" value={draft.effort_hours ?? ''} onChange={event => change('effort_hours', event.target.value)} placeholder="Enter hours" /></label>
        <div className="wbd-task-status"><span>Status</span><span className={`wbd-task-badge is-${draft.status || 'todo'}`}>{statusLabels[draft.status] || statusLabels.todo}</span></div></div>
      <fieldset className="wbd-dependencies"><legend>Depends on</legend>{tasks.filter(row => row.id !== task.id).length ? tasks.filter(row => row.id !== task.id).map(row => <label key={row.id}><input type="checkbox" checked={draft.depends_on.includes(row.id)} onChange={event => change('depends_on', event.target.checked ? [...draft.depends_on, row.id] : draft.depends_on.filter(id => id !== row.id))} />{row.title}</label>) : <p>No other tasks yet.</p>}</fieldset>
      <label>Acceptance criteria<textarea rows={3} maxLength={5000} value={draft.acceptance_criteria} onChange={event => change('acceptance_criteria', event.target.value)} placeholder="Describe what must be checked before this task is complete" /></label>
      <p className="wbd-note"><Info size={15} />{draft.assignee_id ? 'Saving assigns this work to the employee’s My Work Hub immediately.' : 'Select an employee to assign this work, or save it as unassigned.'}</p>
      </fieldset>
    </form>
  </Dialog>
}
TaskDialog.propTypes = { projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired, task: PropTypes.object.isRequired, tasks: PropTypes.array.isRequired, disciplines: PropTypes.array.isRequired, manual: PropTypes.bool, scheduleEditing: PropTypes.bool, isNew: PropTypes.bool, initialField: PropTypes.string, onSave: PropTypes.func.isRequired, onDelete: PropTypes.func.isRequired, onClose: PropTypes.func.isRequired, busy: PropTypes.bool, saveError: PropTypes.string }

function TemplateDialog({ disciplines, manual, onApply, onClose }) {
  const [discipline, setDiscipline] = useState(disciplines[0]?.code || 'general')
  const [name, setName] = useState('')
  return <Dialog title="Use template" onClose={onClose} footer={<><button type="button" className="wbd-button" onClick={onClose}>Cancel</button><button type="submit" form="wbd-template-form" className="wbd-button wbd-primary">Add template tasks</button></>}>
    <form id="wbd-template-form" onSubmit={event => { event.preventDefault(); onApply(discipline, name.trim()) }}>
      <p className="wbd-muted">{manual ? 'Project delivery: prepare, review and complete a deliverable.' : 'Engineering delivery: prepare, review and issue a deliverable.'}</p>
      <label>Deliverable name<input required maxLength={400} value={name} onChange={event => setName(event.target.value)} placeholder={manual ? 'e.g. Employee onboarding process' : 'e.g. Design package'} /></label>
      <label>{manual ? 'Workstream' : 'Discipline'}<select value={discipline} onChange={event => setDiscipline(event.target.value)}>{disciplines.map(row => <option key={row.code} value={row.code}>{row.name}</option>)}</select></label>
      <ol className="wbd-template-preview"><li>Prepare {name || 'deliverable'}</li><li>Review {name || 'deliverable'}</li><li>{manual ? 'Complete' : 'Issue'} {name || 'deliverable'}</li></ol>
      <p className="wbd-note"><Info size={15} />Set owners and effort after adding these tasks.</p>
    </form>
  </Dialog>
}
TemplateDialog.propTypes = { disciplines: PropTypes.array.isRequired, manual: PropTypes.bool, onApply: PropTypes.func.isRequired, onClose: PropTypes.func.isRequired }

export function WorkstreamDialog({ disciplines, onAdd, onClose, busy = false, saveError = '' }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  return <Dialog title="Add workstream" onClose={onClose} busy={busy} footer={<><button type="button" disabled={busy} className="wbd-button" onClick={onClose}>Cancel</button><button type="submit" disabled={busy} form="wbd-workstream-form" className="wbd-button wbd-primary">{busy ? 'Saving…' : 'Add workstream'}</button></>}><form id="wbd-workstream-form" onSubmit={event => {
    event.preventDefault()
    if (busy) return
    const trimmed = name.trim()
    if (!trimmed) { setError('Enter a workstream name.'); return }
    if (disciplines.some(row => row.name.toLowerCase() === trimmed.toLowerCase())) { setError('This workstream already exists.'); return }
    onAdd({ code: `workstream_${crypto.randomUUID().slice(0, 8)}`, name: trimmed })
  }}>{(error || saveError) && <p className="wbd-error" role="alert">{error || saveError}</p>}<label>Workstream name<input autoFocus required disabled={busy} maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Development, Testing, Launch" /></label></form></Dialog>
}
WorkstreamDialog.propTypes = { disciplines: PropTypes.array.isRequired, onAdd: PropTypes.func.isRequired, onClose: PropTypes.func.isRequired, busy: PropTypes.bool, saveError: PropTypes.string }

export default function WorkBreakdownPanel({ projectId, intelligenceRunId, previewConfirmedAt, planningMode = 'document', canEdit = true, baselinePublished = false, onBack, onContinue, onLoaded, onDirtyChanged, onSavingChanged }) {
  const manual = planningMode === 'manual'
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dirty, setDirty] = useState(false)
  const [collapsed, setCollapsed] = useState(new Set())
  const [details, setDetails] = useState(false)
  const [dialog, setDialog] = useState(null)
  const [loadRevision, setLoadRevision] = useState(0)
  const inFlight = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    const request = manual ? planningIntelligenceService.getManualWorkBreakdown(projectId) : planningIntelligenceService.getWorkBreakdown(projectId, intelligenceRunId)
    request.then(data => {
      if (!active) return
      if (!manual && data.preview_confirmed_at !== previewConfirmedAt) throw new Error('Review and confirm the latest Document Intelligence Preview before editing this work breakdown.')
      setDraft(data); setDirty(false); onLoaded?.(data)
    }).catch(reason => { if (active) setError(errorMessage(reason)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [projectId, intelligenceRunId, previewConfirmedAt, loadRevision, manual, onLoaded])
  useEffect(() => { onDirtyChanged?.(dirty); return () => onDirtyChanged?.(false) }, [dirty, onDirtyChanged])
  useEffect(() => { onSavingChanged?.(saving); return () => onSavingChanged?.(false) }, [saving, onSavingChanged])
  useEffect(() => {
    const beforeUnload = event => { if (dirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty])
  const tasks = draft?.tasks || []
  const disciplines = useMemo(() => {
    const rows = [...(draft?.disciplines || [])]
    for (const task of draft?.tasks || []) if (!rows.some(row => row.code === task.discipline)) rows.push({ code: task.discipline, name: task.discipline.replaceAll('_', ' ') })
    if (!rows.length) rows.push({ code: 'general', name: 'General' })
    return rows
  }, [draft])
  const groups = [...new Set(tasks.map(task => task.discipline))].map(code => ({
    ...disciplines.find(row => row.code === code), tasks: tasks.filter(task => task.discipline === code),
    summary: summarizeGroup(tasks.filter(task => task.discipline === code)),
  }))
  const codes = new Map(groups.flatMap((group, groupIndex) => group.tasks.map((task, index) => [task.id, `${groupIndex + 1}.${index + 1}`])))
  const unassigned = tasks.filter(task => !assigned(task))
  const unestimated = tasks.filter(task => task.effort_hours == null)
  const totalEffort = tasks.reduce((sum, task) => sum + Number(task.effort_hours || 0), 0)
  const checks = tasks.flatMap(task => [!assigned(task) && { task, kind: 'owner', label: 'Employee required', action: 'Assign' }, task.effort_hours == null && { task, kind: 'effort', label: 'Effort required', action: 'Estimate' }].filter(Boolean))
  const hasReview = tasks.some(task => /interdisciplin|multi.disciplin|cross.team/i.test(task.title) && /review/i.test(task.title))
  const suggestReview = groups.length > 1 && !hasReview
  const locked = !canEdit || draft?.permissions?.can_assign === false || saving || loading
  const updateTasks = next => { setDraft(current => ({ ...current, tasks: next })); setDirty(true); setNotice(''); setError('') }
  const editTask = (task, field) => { if (!locked) { setError(''); setDialog({ type: 'task', task, field, isNew: false }) } }
  const openEmployee = (task, scopeToTask = true) => {
    if (!saving) setDialog({ type: 'employee', userId: task.assignee_id, name: employeeName(task), taskId: scopeToTask ? task.project_task_id : undefined })
  }
  const save = async (advance, nextTasks = tasks) => {
    if (!draft || locked || inFlight.current) return
    inFlight.current = true; setSaving(true); setError(''); setNotice('')
    try {
      const saveWorkBreakdown = manual ? planningIntelligenceService.saveManualWorkBreakdown : planningIntelligenceService.saveWorkBreakdown
      const result = await saveWorkBreakdown(projectId, {
        intelligence_run_id: intelligenceRunId, preview_confirmed_at: previewConfirmedAt,
        ...(manual ? { disciplines } : {}),
        revision: draft.revision,
        tasks: nextTasks.map(({ id, discipline, title, owner, assignee_id, reviewer_id, task_type, due_date, priority, effort_hours, depends_on, acceptance_criteria, reviewer, source_references, duration_days, planned_start_date }) => ({
          id, discipline, title, owner, assignee_id: assignee_id ?? null, reviewer_id: reviewer_id ?? null,
          task_type: task_type || 'deliverable', due_date: due_date || null, priority: priority || 'medium',
          effort_hours, depends_on, acceptance_criteria, reviewer, source_references,
          ...(manual ? { duration_days: duration_days ?? null, planned_start_date: planned_start_date || null } : {}),
        })), ...(advance ? { advance: true } : {}),
      })
      if (!mounted.current) return
      setDraft(result); setDirty(false); setNotice('Work breakdown saved.')
      if (advance) onContinue(result)
      return result
    } catch (reason) { if (mounted.current) setError(errorMessage(reason)) }
    finally { inFlight.current = false; if (mounted.current) setSaving(false) }
  }
  const leave = action => { if (dirty) setDialog({ type: 'leave', action }); else action() }
  const applyTemplate = (discipline, name) => {
    const rows = ['Prepare', 'Review', manual ? 'Complete' : 'Issue'].map(verb => ({ ...emptyTask(discipline), title: `${verb} ${name}` }))
    rows[1].depends_on = [rows[0].id]; rows[2].depends_on = [rows[1].id]
    updateTasks([...tasks, ...rows]); setDialog(null)
  }
  if (loading) return <section className="work-breakdown"><form id="project-planning-work-breakdown-form" onSubmit={event => event.preventDefault()} /><div className="wbd-loading" role="status"><Loader2 size={19} className="animate-spin" />Loading work breakdown…</div></section>
  if (!draft) return <section className="work-breakdown"><div className="wbd-error" role="alert">{error || 'Work breakdown is unavailable.'}</div><div className="wbd-actions"><button type="button" className="wbd-button" onClick={onBack}><ArrowLeft size={16} />Back to inputs</button><button type="button" className="wbd-button" onClick={() => setLoadRevision(value => value + 1)}>Retry</button></div></section>
  return <section className="work-breakdown" aria-label="Work breakdown planning" aria-busy={saving}>
    <form id="project-planning-work-breakdown-form" onSubmit={event => { event.preventDefault(); save(false) }} />
    {error && dialog?.type !== 'task' && <div className="wbd-error" role="alert">{error}</div>}
    {notice && <div className="wbd-success" role="status"><CheckCircle2 size={16} />{notice}</div>}
    <div className="wbd-metrics" aria-label="Work breakdown totals"><span><ClipboardList size={20} /><strong>{tasks.length}</strong>Planned tasks</span><span><Clock3 size={20} /><strong>{hours(totalEffort)} h</strong>Planned effort</span><span className={unassigned.length ? 'wbd-warning' : 'wbd-good'}>{unassigned.length ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}<strong>{unassigned.length}</strong>Unassigned tasks</span></div>
    <div className="wbd-columns">
      <div className="wbd-card wbd-main"><header className="wbd-card-header"><div><h2>Work breakdown</h2><p>Define deliverables, effort and responsibility.</p></div><div className="wbd-actions"><button type="button" className="wbd-button" disabled={locked} onClick={() => { setError(''); setDialog({ type: 'task', task: emptyTask(disciplines[0].code), isNew: true }) }}><Plus size={17} />Add task</button><button type="button" className="wbd-button wbd-secondary" disabled={locked} onClick={() => setDialog({ type: 'template' })}><FileText size={17} />Use template</button></div></header>
        <div className="wbd-table-tools">{manual && <button type="button" className="wbd-link" disabled={locked} onClick={() => setDialog({ type: 'workstream' })}><Plus size={15} />Add workstream</button>}<button type="button" className="wbd-link" disabled={!collapsed.size} onClick={() => setCollapsed(new Set())}><ChevronDown size={15} />Expand all</button><button type="button" className="wbd-link" disabled={!groups.length || groups.every(group => collapsed.has(group.code))} onClick={() => setCollapsed(new Set(groups.map(group => group.code)))}><ChevronRight size={15} />Collapse all</button></div>
        <div className="wbd-table-scroll" tabIndex={0} role="region" aria-label="Work breakdown tasks"><table className="wbd-table"><thead><tr><th scope="col">WBS</th><th scope="col">Task / deliverable</th><th scope="col">Assigned to</th><th scope="col">Status</th><th scope="col">Due date</th><th scope="col">Effort</th><th scope="col">Depends on</th></tr></thead><tbody>
          {groups.map((group, groupIndex) => <React.Fragment key={group.code}><tr className="wbd-group">
            <th scope="row"><button type="button" aria-label={`${collapsed.has(group.code) ? 'Expand' : 'Collapse'} ${group.name}`} aria-expanded={!collapsed.has(group.code)} onClick={() => setCollapsed(current => { const next = new Set(current); if (next.has(group.code)) next.delete(group.code); else next.add(group.code); return next })}>{collapsed.has(group.code) ? <ChevronRight size={17} /> : <ChevronDown size={17} />}{groupIndex + 1}.0</button></th>
            <td>{group.name}<small className="wbd-group-note">{group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'}</small></td>
            <td><div className="wbd-group-people">{group.summary.people.slice(0, 2).map(task => <EmployeeActivityLink key={task.assignee_id} task={task} onOpen={value => openEmployee(value, false)} disabled={saving} />)}
              {group.summary.people.length > 2 && <button type="button" className="wbd-link" aria-label={`Show all ${group.summary.people.length} employees in ${group.name}`} onClick={() => setCollapsed(current => { const next = new Set(current); next.delete(group.code); return next })}>+{group.summary.people.length - 2} more</button>}
              {!group.summary.people.length && <span className="wbd-muted">Unassigned</span>}
            </div></td>
            <td><span className={`wbd-task-badge is-${group.summary.status}`}>{statusLabels[group.summary.status]}</span><small className="wbd-group-note">{group.summary.completed} / {group.tasks.length} complete</small></td>
            <td title={group.summary.due ? `Latest task due date: ${group.summary.due}` : 'No task due dates set'}>{group.summary.due ? dueLabel(group.summary.due) : <span className="wbd-muted">Not set</span>}{group.summary.due && <small className="wbd-group-note">Latest due</small>}</td>
            <td>{hours(group.tasks.reduce((sum, task) => sum + Number(task.effort_hours || 0), 0))} h</td><td />
          </tr>
            {!collapsed.has(group.code) && group.tasks.map(task => <React.Fragment key={task.id}><tr>
              <td>{codes.get(task.id)}</td>
              <td><button type="button" className="wbd-task-title" disabled={locked} onClick={() => editTask(task)}>{task.title}</button><div className="wbd-task-meta"><span>{task.task_type === 'task' ? 'Task' : 'Deliverable'}</span>{['high', 'critical'].includes(task.priority) && <span className={`wbd-priority is-${task.priority}`}>{task.priority} priority</span>}</div></td>
              <td>{assigned(task) ? <div className="wbd-assignee-cell"><EmployeeActivityLink task={task} onOpen={openEmployee} disabled={saving} /><button type="button" className="wbd-change-assignee" disabled={locked} aria-label={`Change assignee for ${task.title}`} title="Change assignee" onClick={() => editTask(task, 'owner')}><Pencil size={14} /></button></div> : <button type="button" className="wbd-assign" disabled={locked} aria-label={`Assign employee for ${task.title}`} onClick={() => editTask(task, 'owner')}><User size={15} />Assign employee</button>}</td>
              <td><span className={`wbd-task-badge is-${task.status || 'todo'}`}>{statusLabels[task.status] || statusLabels.todo}</span>{task.project_task_id && task.progress_percent > 0 && <small className="wbd-progress">{task.progress_percent}% complete</small>}</td>
              <td><button type="button" className="wbd-effort" disabled={locked} aria-label={`Edit due date for ${task.title}`} onClick={() => editTask(task, 'due_date')}>{dueLabel(task.due_date)}</button></td>
              <td><button type="button" className={`wbd-effort ${task.effort_hours == null ? 'wbd-missing' : ''}`} disabled={locked} aria-label={`Edit effort for ${task.title}`} onClick={() => editTask(task, 'effort')}>{task.effort_hours == null ? 'Set effort' : `${hours(task.effort_hours)} h`}</button></td>
              <td className="wbd-muted">{task.depends_on.map(id => codes.get(id)).filter(Boolean).join(', ') || '\u2014'}</td></tr>
              {details && <tr className="wbd-detail-row"><td /><td colSpan={6}><div><strong>Acceptance criteria</strong><span>{task.acceptance_criteria || 'Not specified'}</span></div><div><strong>Reviewer</strong><span>{task.reviewer_user?.name || (task.reviewer_id ? task.reviewer : 'Not assigned')}</span></div></td></tr>}</React.Fragment>)}
          </React.Fragment>)}
          {!tasks.length && <tr><td colSpan={7} className="wbd-empty">Add a task or use a template to begin the work breakdown.</td></tr>}
        </tbody><tfoot><tr><th colSpan={5} scope="row">Total planned effort</th><td>{hours(totalEffort)} h</td><td /></tr></tfoot></table></div>
        <div className="wbd-table-footer"><button type="button" className="wbd-link" aria-expanded={details} onClick={() => setDetails(value => !value)}>{details ? 'Hide' : 'Show'} acceptance criteria and reviewers<ChevronDown size={15} /></button><div className="wbd-actions"><button type="button" className="wbd-link" disabled={saving || dirty || Boolean(dialog)} title={dirty ? "Save your changes before refreshing progress" : "Refresh employee progress"} onClick={() => { setNotice(''); setLoadRevision(value => value + 1) }}><RefreshCw size={15} />Refresh</button><button type="submit" form="project-planning-work-breakdown-form" className="wbd-link" disabled={locked} aria-label="Save work breakdown">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}{saving ? 'Saving…' : dirty ? 'Save changes' : 'Save draft'}</button></div></div>
      </div>
      <aside className="wbd-side"><section className="wbd-card"><header className="wbd-side-heading"><h2>Planning checks</h2><span className={`wbd-badge ${checks.length ? 'is-warning' : 'is-good'}`}>{checks.length ? <User size={13} /> : <Check size={13} />}{checks.length} {checks.length === 1 ? 'action' : 'actions'}</span></header>
        <ul className="wbd-checks">{checks.slice(0, 6).map(({ task, kind, label, action }) => <li key={`${task.id}-${kind}`}><AlertTriangle size={20} /><div><strong>{task.title}</strong><small>{label}</small></div><button type="button" className="wbd-link" disabled={locked} aria-label={`${action} ${task.title}`} onClick={() => editTask(task, kind)}>{action}</button></li>)}</ul>
        {checks.length > 6 && <p className="wbd-muted wbd-more">{checks.length - 6} more actions in the task table.</p>}
        <p className={`wbd-check-result ${unestimated.length ? 'wbd-muted' : 'wbd-good'}`}>{unestimated.length ? <Info size={18} /> : <CheckCircle2 size={20} />}<span>{unestimated.length ? `${unestimated.length} ${unestimated.length === 1 ? 'task needs' : 'tasks need'} an effort estimate.` : tasks.length ? 'Task effort totals verified' : 'Add tasks to begin planning checks.'}</span></p>
      </section><section className="wbd-card"><header className="wbd-side-heading"><h2>AI planning assistant</h2><span className="wbd-badge is-suggestion"><Sparkles size={13} />Suggestion</span></header>
        <div className="wbd-suggestion"><Sparkles size={28} /><div><p>{suggestReview ? manual ? 'Add a cross-team review before completion.' : 'Add an interdisciplinary review before final issue.' : hasReview ? 'An interdisciplinary review is included in your plan.' : 'Review deliverable acceptance criteria before scheduling.'}</p><small>{suggestReview ? 'Proposed task · Estimate needs review' : 'Based on the current work breakdown'}</small></div></div>
        {suggestReview && <><p className="wbd-info"><Info size={15} />This is a suggestion, not an applied change.</p><button type="button" className="wbd-button wbd-review-suggestion" disabled={locked} onClick={() => setDialog({ type: 'task', isNew: true, task: { ...emptyTask(disciplines[0].code), title: manual ? 'Cross-team review' : 'Interdisciplinary review', depends_on: tasks.filter(task => !tasks.some(other => other.depends_on.includes(task.id))).map(task => task.id), acceptance_criteria: manual ? 'Record and close review comments before completion.' : 'Record and close interdisciplinary comments before final issue.' } })}>Review suggestion</button></>}
        <div className="wbd-sources"><h3>Source documents</h3><ul>{(draft.source_documents || []).map(file => <li key={file.id}>{/xlsx?|csv|mdr/i.test(`${file.name} ${file.category}`) ? <FileSpreadsheet size={22} className="wbd-sheet-icon" /> : <FileText size={22} className="wbd-pdf-icon" />}<span title={file.name}>{file.name}</span><small>{manual ? <><FileText size={14} />Reference</> : <><CheckCircle2 size={14} />Reviewed</>}</small></li>)}</ul>{!draft.source_documents?.length && <p className="wbd-muted">{manual ? 'Reference documents are optional for this plan.' : 'No source documents in the confirmed preview.'}</p>}<button type="button" className="wbd-link" disabled={saving} onClick={() => leave(onBack)}>Manage inputs<ArrowRight size={14} /></button></div>
      </section></aside>
    </div>
    <footer className="wbd-bottom"><button type="button" className="wbd-button wbd-secondary" disabled={saving} onClick={() => leave(onBack)}><ArrowLeft size={17} />Back to inputs</button><div><span>{baselinePublished ? 'Draft revision · Published baseline retained' : 'Draft plan · No baseline published'}</span><small>{dirty ? 'Unsaved changes' : draft.saved_at ? 'Work breakdown saved' : manual ? 'From project scope and tasks' : 'From confirmed Document Intelligence'}</small></div><button type="button" className="wbd-button wbd-primary" disabled={locked || !tasks.length} onClick={() => save(true)}>{saving ? <Loader2 size={17} className="animate-spin" /> : null}Continue to schedule<ArrowRight size={17} /></button></footer>
    {dialog?.type === 'task' && <TaskDialog manual={manual} projectId={projectId} task={dialog.task} tasks={tasks} disciplines={disciplines} isNew={dialog.isNew} initialField={dialog.field} busy={saving} saveError={error} onClose={() => setDialog(null)} onSave={async task => {
      const result = await save(false, dialog.isNew ? [...tasks, task] : tasks.map(row => row.id === task.id ? task : row))
      if (result) {
        setCollapsed(current => { const next = new Set(current); next.delete(task.discipline); return next })
        setDialog(null); setNotice(task.assignee_id ? 'Task saved and assigned in My Work Hub.' : 'Task saved as unassigned.')
      }
    }} onDelete={async id => {
      const result = await save(false, tasks.filter(task => task.id !== id).map(task => ({ ...task, depends_on: task.depends_on.filter(value => value !== id) })))
      if (result) { setDialog(null); setNotice('Task removed from this work breakdown and My Work Hub.') }
    }} />}
    {dialog?.type === 'workstream' && <WorkstreamDialog disciplines={disciplines} onClose={() => setDialog(null)} onAdd={row => { setDraft(current => ({ ...current, disciplines: [...disciplines, row] })); setDirty(true); setDialog(null); setNotice('Workstream added. Add tasks or save draft to keep it.'); }} />}
    {dialog?.type === 'template' && <TemplateDialog manual={manual} disciplines={disciplines} onApply={applyTemplate} onClose={() => setDialog(null)} />}
    {dialog?.type === 'employee' && <PlanningEmployeeActivity projectId={projectId} employeeId={dialog.userId} employeeName={dialog.name} initialTaskId={dialog.taskId} onClose={() => setDialog(null)} />}
    {dialog?.type === 'leave' && <Dialog title="Save work breakdown?" onClose={() => setDialog(null)} footer={<><button type="button" className="wbd-button" onClick={() => { const action = dialog.action; setDialog(null); action() }}>Discard changes</button><button type="button" className="wbd-button wbd-primary" onClick={() => setDialog(null)}>Keep editing</button></>}><p>Your task changes have not been saved. Save the work breakdown before leaving to keep them.</p></Dialog>}
  </section>
}
WorkBreakdownPanel.propTypes = { projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired, intelligenceRunId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), previewConfirmedAt: PropTypes.string, planningMode: PropTypes.oneOf(['document', 'manual']), canEdit: PropTypes.bool, baselinePublished: PropTypes.bool, onBack: PropTypes.func.isRequired, onContinue: PropTypes.func.isRequired, onLoaded: PropTypes.func, onDirtyChanged: PropTypes.func, onSavingChanged: PropTypes.func }
