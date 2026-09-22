import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, ClipboardCheck, Clock3, FileText, Loader2, RefreshCw, Send, ShieldCheck, Sparkles, User } from 'lucide-react'
import apiClient from '../../services/api.service'
import { PLANNING_ENDPOINTS } from '../../config/planningIntelligence.config'
import { TaskDialog, WorkstreamDialog } from './WorkBreakdownPanel'
import PlanningScheduleCanvas from './PlanningScheduleCanvas'
import PlanningSequenceReview from './PlanningSequenceReview'
import PlanningSourceVerification from './PlanningSourceVerification'
import PlanningScheduleChecks from './PlanningScheduleChecks'
import { scheduleChecks } from './scheduleCheckPolicy'
import ScheduleNotice from './ScheduleNotice'
import PlanningEmployeeActivity from './PlanningEmployeeActivity'
import GanttLogicDialog from './GanttLogicDialog'
import './PlanningReviewPanel.css'

const formatNumber = value => new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(Number(value || 0))
const dateLabel = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not set'
const messageFor = reason => {
  const body = reason?.response?.data
  const flatten = value => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(flatten) : []
  return body?.error || body?.detail || flatten(body).join(' ') || reason?.message || 'The plan could not be saved. Please try again.'
}
const newTask = discipline => ({
  id: `task-${crypto.randomUUID()}`, discipline, title: '', owner: '', assignee_id: null, assignee: null,
  reviewer_id: null, reviewer_user: null, reviewer: '', task_type: 'deliverable', priority: 'medium',
  due_date: null, status: 'todo', progress_percent: 0, effort_hours: null, duration_days: null,
  planned_start_date: null, depends_on: [], acceptance_criteria: '', source_references: [],
})
const editableTask = task => ({
  id: task.id, discipline: task.discipline, title: task.title, owner: task.owner || '',
  assignee_id: task.assignee_id ?? null, reviewer_id: task.reviewer_id ?? null, reviewer: task.reviewer || '',
  task_type: task.task_type || 'deliverable', priority: task.priority || 'medium', due_date: task.due_date || null,
  effort_hours: task.effort_hours ?? null, duration_days: task.duration_days ?? null,
  planned_start_date: task.planned_start_date || null, depends_on: task.depends_on || [],
  ...(task.timing_edit ? { timing_edit: task.timing_edit } : {}),
  ...(task.dependency_details?.every(link => ['FS', 'SS', 'FF', 'SF'].includes(link.type) && link.lag_days != null)
    ? { dependency_details: task.dependency_details } : {}),
  ...(task.constraint_type !== undefined ? { constraint_type: task.constraint_type, constraint_date: task.constraint_date || null } : {}),
  wbs_phase: task.wbs_phase || '', wbs_deliverable: task.wbs_deliverable || '',
  acceptance_criteria: task.acceptance_criteria || '', source_references: task.source_references || [],
})
const stateLabel = { inputs: 'Inputs required', review: 'Draft plan', submitted: 'Awaiting approval', baselined: 'Baseline published' }

export default function PlanningReviewPanel({ projectId, enterpriseProject, stage = 'review', planningMode = 'document', canEdit = true, refreshKey = 0, selectedVersionId: controlledVersionId, onVersionChange, onBack, onInputs, onAnalyze, onRebuild, onCompare, onOpenAdvanced, onContinue, onLoaded, onSavingChanged }) {
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [buildingSchedule, setBuildingSchedule] = useState(false)
  const [error, setError] = useState('')
  const [submissionChecks, setSubmissionChecks] = useState(null)
  const [checksOpenRequest, setChecksOpenRequest] = useState(0)
  const [notice, setNotice] = useState('')
  const dismissNotice = useCallback(() => setNotice(''), [])
  const [refresh, setRefresh] = useState(0)
  const [localVersionId, setLocalVersionId] = useState('current')
  const selectedVersionId = controlledVersionId ?? localVersionId
  const setSelectedVersionId = value => { if (onVersionChange) onVersionChange(String(value)); else setLocalVersionId(String(value)) }
  const [approverId, setApproverId] = useState('')
  const [dialog, setDialog] = useState(null)
  const pending = useRef(false)
  const sequenceTrigger = useRef(null)
  const alive = useRef(true)
  const callbacks = useRef({ onLoaded, onSavingChanged })
  callbacks.current = { onLoaded, onSavingChanged }
  const endpoint = `${PLANNING_ENDPOINTS.project(projectId)}simple-plan/`
  const currentEndpoint = useRef(endpoint)
  currentEndpoint.current = endpoint
  const viewContext = `${endpoint}:${stage}:${selectedVersionId}:${refreshKey}:${plan?.revision ?? ''}`
  const currentViewContext = useRef(viewContext)
  currentViewContext.current = viewContext
  const approval = stage === 'approval'
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => { setNotice('') }, [endpoint])
  useEffect(() => { setSubmissionChecks(null); setChecksOpenRequest(0) }, [endpoint, stage, selectedVersionId])
  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setDialog(null)
    if (!projectId) {
      setPlan({ state: 'inputs', revision: 0, tasks: [], disciplines: [], permissions: { can_edit: false } })
      setLoading(false)
      return () => { active = false }
    }
    apiClient.get(endpoint, { params: selectedVersionId === 'current' ? {} : { version_id: selectedVersionId } }).then(response => {
      if (!active) return
      setPlan(response.data)
      setSubmissionChecks(current => current?.endpoint === endpoint && current.revision === response.data.revision ? current : null)
      callbacks.current.onLoaded?.(response.data)
    }).catch(reason => { if (active) setError(messageFor(reason)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [endpoint, projectId, refresh, refreshKey, stage, selectedVersionId])
  useEffect(() => { callbacks.current.onSavingChanged?.(saving || buildingSchedule); return () => callbacks.current.onSavingChanged?.(false) }, [saving, buildingSchedule])

  const tasks = plan?.tasks || []
  const disciplines = useMemo(() => {
    const source = plan?.disciplines || []
    const rows = Array.isArray(source) ? [...source] : Object.entries(source).map(([code, info]) => ({ code, name: info.name || code }))
    for (const task of plan?.tasks || []) if (!rows.some(row => row.code === task.discipline)) rows.push({ code: task.discipline, name: task.discipline.replaceAll('_', ' ') })
    return rows.length ? rows : [{ code: 'general', name: 'General' }]
  }, [plan])
  const groups = disciplines.map(group => ({ ...group, tasks: tasks.filter(task => task.discipline === group.code) })).filter(group => group.tasks.length)
  const recentChecks = submissionChecks?.endpoint === endpoint && submissionChecks.revision === plan?.revision ? submissionChecks.blockers : []
  const { blockers, warnings, otherWarnings } = scheduleChecks(plan || {}, recentChecks || [])
  const unassigned = tasks.filter(task => !task.assignee_id)
  const proposed = tasks.filter(task => task.duration_source === 'proposed')
  const dates = tasks.flatMap(task => [task.planned_start_date, task.planned_finish_date]).filter(Boolean).sort()
  const start = dates[0], finish = dates.at(-1)
  const editLocked = loading || saving || buildingSchedule || !canEdit || !plan?.permissions?.can_edit || plan?.state === 'baselined' || plan?.viewing_history || plan?.legacy_read_only || selectedVersionId !== 'current'
  const locked = editLocked || approval
  const ganttLocked = loading || saving || buildingSchedule || !canEdit || approval || !(plan?.permissions?.can_edit_gantt || plan?.permissions?.can_edit)
    || plan?.state === 'baselined' || plan?.viewing_history || plan?.legacy_read_only || selectedVersionId !== 'current'
  const repairLocked = editLocked || plan?.state !== 'review'
  const canSubmit = Boolean(plan?.permissions?.can_submit && !plan?.stale_inputs && tasks.length && !blockers.length)
  const canPublish = Boolean(plan?.permissions?.can_approve_publish && plan?.state === 'submitted' && !plan?.stale_inputs && !blockers.length)
  const edit = (task, field) => { if (!(field === 'dependencies' ? ganttLocked : approval ? repairLocked : locked)) { setError(''); setDialog({ type: field === 'dependencies' ? 'logic' : 'task', task: { ...task, depends_on: task.depends_on || [] }, field }) } }
  const employee = task => setDialog({ type: 'employee', task })
  const accept = data => { setPlan(data); setSubmissionChecks(null); callbacks.current.onLoaded?.(data) }
  const mutate = async (request, success, preserveEditor = false) => {
    if (pending.current) return null
    const requestEndpoint = endpoint
    const requestContext = viewContext
    pending.current = true; setSaving(true); setError(''); setNotice('')
    try {
      const response = await request()
      if (!alive.current || currentEndpoint.current !== requestEndpoint || currentViewContext.current !== requestContext) return null
      accept(response.data); setNotice(success)
      return response.data
    } catch (reason) {
      if (alive.current && currentEndpoint.current === requestEndpoint && currentViewContext.current === requestContext) {
        const findings = reason?.response?.data?.blockers
        if (Array.isArray(findings) && findings.length) {
          setSubmissionChecks({ endpoint: requestEndpoint, revision: plan.revision, blockers: findings })
          if (!preserveEditor) setChecksOpenRequest(value => value + 1)
          setError(preserveEditor ? messageFor(reason) : 'Review the schedule issues below before submitting.')
        } else setError(messageFor(reason))
      }
      return null
    }
    finally { pending.current = false; if (alive.current) setSaving(false) }
  }
  const saveTasks = (nextTasks, nextDisciplines = disciplines) => mutate(() => apiClient.put(endpoint, { revision: plan.revision, tasks: nextTasks.map(editableTask), disciplines: nextDisciplines }), 'All changes saved.')
  const saveCell = (task, field, value) => {
    if (ganttLocked) return Promise.resolve(null)
    const changes = field === 'duration' ? { duration_days: value } : { timing_edit: { field, value } }
    return mutate(() => apiClient.post(`${endpoint}edit-activity/`, { revision: plan.revision, task_id: task.id, ...changes }), 'Activity change saved.', true)
  }
  const saveLogic = nextTasks => {
    if (ganttLocked) return Promise.resolve(null)
    const currentTasks = new Map(tasks.map(task => [task.id, task]))
    const updates = nextTasks.filter(row => row !== currentTasks.get(row.id))
      .map(row => ({ task_id: row.id, dependency_details: row.dependency_details.map(link => ({ task_id: link.task_id, type: link.type, lag_days: link.lag_days })) }))
    if (!updates.length) return Promise.resolve(plan)
    return mutate(() => apiClient.post(`${endpoint}edit-activity/`, { revision: plan.revision, updates }), 'Activity logic saved.', true)
  }
  const submit = async () => {
    const result = await mutate(() => apiClient.post(`${endpoint}submit/`, { revision: plan.revision, ...(approverId ? { approver_id: Number(approverId) } : {}) }), 'Plan submitted for approval.')
    if (result) onContinue?.(result)
  }
  const publish = () => mutate(() => apiClient.post(`${endpoint}approve-publish/`, { revision: plan.revision }), 'Plan approved and baseline published.')
  const reopen = () => mutate(() => apiClient.post(`${endpoint}reopen/`, { revision: plan.revision }), 'A new draft version is ready. The published baseline is retained.')
  const calculate = () => mutate(() => apiClient.post(`${endpoint}calculate/`, { revision: plan.revision }), 'Schedule calculation completed. Review the dates and float before approval.')
  const validate = () => mutate(() => apiClient.post(`${endpoint}validate/`, { revision: plan.revision }), 'Schedule validation completed. Review the findings before approval.')
  const activateVersion = async versionId => {
    const result = await mutate(() => apiClient.post(`${endpoint}select-version/`, { revision: plan.master_revision, version_id: versionId }), versionId == null ? 'The preserved working draft is open.' : 'This schedule version is now active in Master Schedule.')
    if (result) { setSelectedVersionId('current'); setRefresh(value => value + 1) }
  }
  const buildSchedule = async event => {
    if (pending.current || locked || !tasks.length) return
    sequenceTrigger.current = event?.currentTarget || document.activeElement
    const requestEndpoint = endpoint
    const requestContext = viewContext
    pending.current = true; setBuildingSchedule(true); setError(''); setNotice('')
    try {
      const response = await apiClient.post(`${endpoint}propose-schedule/`, { revision: plan.revision, workflow_mode: 'source_only' })
      if (!alive.current || currentEndpoint.current !== requestEndpoint || currentViewContext.current !== requestContext) return
      setDialog({ type: 'sequence', proposal: response.data.proposal, preview: response.data.plan })
    } catch (reason) { if (alive.current && currentViewContext.current === requestContext) setError(messageFor(reason)) }
    finally { pending.current = false; if (alive.current) setBuildingSchedule(false) }
  }
  const inputs = onInputs || onBack || (() => {})
  const saveCurrent = () => {
    if (!plan || locked || !projectId) return
    // Task edits save on completion. A redundant Save must not cancel a review.
    if (plan.state === 'submitted') { setNotice('The plan is saved and awaiting approval.'); return }
    saveTasks(tasks)
  }
  const saveCurrentRef = useRef(saveCurrent)
  saveCurrentRef.current = saveCurrent
  useEffect(() => {
    const saveEvent = () => { if (!document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) saveCurrentRef.current() }
    window.addEventListener('radai:save-master-schedule', saveEvent)
    return () => window.removeEventListener('radai:save-master-schedule', saveEvent)
  }, [])

  if (loading && !plan) return <section className="planning-review work-breakdown"><div className="wbd-loading" role="status"><Loader2 size={18} className="animate-spin" />Loading project plan…</div></section>
  if (!plan) return <section className="planning-review work-breakdown"><div className={error ? 'wbd-error' : 'wbd-loading'} role={error ? 'alert' : 'status'}>{error || 'Add your project inputs and build a plan to begin the review.'}</div><div className="wbd-actions"><button type="button" className="wbd-button" onClick={onBack}><ArrowLeft size={16} />Back to inputs</button><button type="button" className="wbd-button" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={16} />Refresh</button></div></section>

  return <section className="planning-review work-breakdown" aria-label={approval ? 'Approve and publish plan' : 'Review project plan'} aria-busy={saving || loading || buildingSchedule}>
    {error && !['task', 'sequence', 'logic'].includes(dialog?.type) && <p className="wbd-error" role="alert">{error}</p>}
    {buildingSchedule && <div className="prv-build-notice" role="status"><Loader2 size={18} className="animate-spin" />Reviewing source activities, durations, dates and dependencies…</div>}
    {notice && <ScheduleNotice message={notice} onClose={dismissNotice} />}
    {plan.stale_inputs && <p className="prv-stale" role="alert"><AlertTriangle size={18} /><span>Project inputs have changed. Return to inputs and rebuild the plan before submitting or publishing.</span><button type="button" className="wbd-link" disabled={saving} onClick={onBack}>Review inputs<ArrowRight size={15} /></button></p>}
    {approval && plan.state !== 'baselined' && <div className="prv-schedule-checks"><PlanningScheduleChecks plan={{ ...plan, blockers, warnings }} tasks={tasks} locked={repairLocked} busy={saving || loading || buildingSchedule} onEdit={edit} onInputs={inputs} onRefresh={() => setRefresh(value => value + 1)} onVerifySources={() => setDialog({ type: 'sources' })} /></div>}
    {approval && <div className="prv-metrics" aria-label="Plan summary"><div><ClipboardCheck size={20} /><span><strong>{tasks.length}</strong>Tasks / deliverables</span></div><div><CalendarDays size={20} /><span><strong>{start ? dateLabel(start) : 'Not set'}</strong>Planned start</span></div><div><Clock3 size={20} /><span><strong>{finish ? dateLabel(finish) : 'Not set'}</strong>Planned finish</span></div><div className={unassigned.length ? 'prv-warning' : 'prv-good'}><User size={20} /><span><strong>{unassigned.length}</strong>Unassigned tasks</span></div></div>}
    {approval ? <div className="prv-approval-grid">
      <section className="wbd-card prv-approval-card"><div className="prv-approval-icon"><ShieldCheck size={27} /></div><header><h2>{plan.state === 'baselined' ? 'Baseline published' : 'Approve & publish'}</h2><p>{plan.state === 'baselined' ? 'The approved plan is available for project control.' : 'Review the project plan before publishing its baseline.'}</p></header><dl><div><dt>Status</dt><dd>{stateLabel[plan.state] || plan.state}</dd></div><div><dt>Plan revision</dt><dd>{plan.revision}</dd></div><div><dt>Workstreams / disciplines</dt><dd>{groups.length}</dd></div><div><dt>Planned effort</dt><dd>{formatNumber(tasks.reduce((sum, task) => sum + Number(task.effort_hours || 0), 0))} hours</dd></div><div><dt>Proposed durations</dt><dd>{proposed.length}</dd></div></dl>{plan.state === 'submitted' && !canPublish && <p className="prv-note"><ShieldCheck size={17} />Awaiting an authorized approver.</p>}{plan.state === 'baselined' && <p className="prv-published"><CheckCircle2 size={18} />{plan.baseline?.name || 'Project baseline'} published</p>}</section>
      <section className="wbd-card"><h2>Included in this plan</h2><ul className="prv-discipline-list">{groups.map(group => <li key={group.code}><span>{group.name}</span><strong>{group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'}</strong></li>)}</ul><div className="prv-sources"><h3>Source documents</h3>{(plan.source_documents || []).length ? plan.source_documents.map(file => <p key={file.id}><FileText size={16} />{file.name || file.original_filename}</p>) : <p>Project scope and planning inputs</p>}</div></section>
    </div> : <PlanningScheduleCanvas plan={{ ...plan, blockers, warnings, project: {
      id: projectId, code: enterpriseProject?.code || '', name: enterpriseProject?.name || '',
      phase: enterpriseProject?.custom_fields?.project_phase || '',
      start_date: enterpriseProject?.start_date || null, end_date: enterpriseProject?.end_date || null,
      ...(plan.project || {}),
    } }} tasks={tasks} disciplines={disciplines} saving={saving} saveError={error} locked={locked} ganttLocked={ganttLocked} onBuildSchedule={buildSchedule} buildingSchedule={buildingSchedule}
      onEdit={edit} onCellEdit={saveCell} onLogicEdit={task => edit(task, 'dependencies')} onEmployee={employee} onAdd={() => { setError(''); setDialog({ type: 'task', task: newTask(disciplines[0].code), isNew: true }) }}
      onInputs={inputs} onAnalyze={onAnalyze} onRebuild={planningMode === 'document' && !locked ? onRebuild : undefined} onRefresh={() => setRefresh(value => value + 1)} onSave={saveCurrent} onNewVersion={reopen} onCompare={onCompare}
      onVerifySources={() => setDialog({ type: 'sources' })}
      onOpenCreatedSchedule={result => { setSelectedVersionId('current'); setRefresh(value => value + 1); setNotice(result?.notice || 'Accepted inputs opened in Master Schedule. Calculate and review this draft before approval.') }}
      onCalculate={calculate} onValidate={validate} onActivateVersion={activateVersion}
      selectedVersionId={selectedVersionId} onVersionChange={setSelectedVersionId} onOpenAdvanced={onOpenAdvanced ? () => onOpenAdvanced(plan) : undefined} onAddWorkstream={planningMode === 'manual' ? () => { setError(''); setDialog({ type: 'workstream' }) } : undefined}
      onApproval={plan.state === 'baselined' || plan.viewing_history || plan.legacy_read_only || selectedVersionId !== 'current' ? null : () => onContinue ? onContinue(plan) : submit()}
      checksOpenRequest={checksOpenRequest} checking={loading}
      approvalDisabled={!tasks.length || (!onContinue && !canSubmit)} approvalLabel="Review & approve" />}
    {approval && (otherWarnings.length > 0 || (plan.assumptions || []).length > 0) && <section className="wbd-card prv-review-notes"><h2>{otherWarnings.length ? 'Review warnings' : 'Planning assumptions'}</h2>{otherWarnings.length > 0 && <ul className="prv-blockers">{otherWarnings.map((item, index) => <li key={index}><AlertTriangle size={17} /><span>{item.message || item.description || item.detail || item.code}</span></li>)}</ul>}{(plan.assumptions || []).length > 0 && <ul className="prv-assumptions">{plan.assumptions.map((item, index) => <li key={index}><Sparkles size={15} /><span>{typeof item === 'string' ? item : item.message || item.description || item.label}</span></li>)}</ul>}</section>}
    {approval && plan.state === 'review' && plan.approvers?.length > 0 && <label className="prv-approver">Approver<select aria-label="Plan approver" value={approverId} disabled={saving} onChange={event => setApproverId(event.target.value)}><option value="">Project approval authority</option>{plan.approvers.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>}
    {approval && <footer className="prv-footer"><button type="button" className="wbd-button wbd-secondary" disabled={saving} onClick={onBack}><ArrowLeft size={16} />{approval ? 'Back to review' : 'Back to inputs'}</button><span>{stateLabel[plan.state] || 'Draft plan'} · Revision {plan.revision}</span>{plan.state === 'baselined' ? <span className="prv-published"><CheckCircle2 size={18} />Baseline published</span> : approval && plan.state === 'submitted' ? <button type="button" className="wbd-button wbd-primary" disabled={saving || !canPublish} onClick={publish}>{saving ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={17} />}Approve & publish baseline</button> : plan.state === 'submitted' ? <button type="button" className="wbd-button wbd-primary" disabled={saving} onClick={() => onContinue?.(plan)}>View approval<ArrowRight size={16} /></button> : <button type="button" className="wbd-button wbd-primary" disabled={saving || !canSubmit} onClick={submit}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}Submit for approval</button>}</footer>}
    {dialog?.type === 'sequence' && <PlanningSequenceReview currentPlan={plan} previewPlan={dialog.preview} proposal={dialog.proposal} returnFocusElement={sequenceTrigger.current} busy={saving} error={error} onClose={() => { if (!saving) { setDialog(null); setError('') } }} onApply={async () => {
      const result = await mutate(() => apiClient.post(`${endpoint}apply-schedule/`, { revision: dialog.proposal.revision, proposal_token: dialog.proposal.token }), 'Proposed schedule saved as a draft. Review the timing and logic before approval.')
      if (result) setDialog(null)
    }} />}
    {dialog?.type === 'logic' && <GanttLogicDialog task={dialog.task} tasks={tasks} sourceOnly={plan.duration_policy === 'source_only' || plan.evidence_policy === 'document_driven' || Boolean(plan.duration_review)} busy={saving} saveError={error} onClose={() => { if (!saving) { setDialog(null); setError('') } }} onSave={saveLogic} />}
    {dialog?.type === 'task' && <TaskDialog projectId={projectId} task={dialog.task} tasks={tasks} disciplines={disciplines} manual={planningMode === 'manual'} scheduleEditing isNew={dialog.isNew} initialField={dialog.field} busy={saving} saveError={error} onClose={() => setDialog(null)} onSave={async task => {
      const result = await saveTasks(dialog.isNew ? [...tasks, task] : tasks.map(row => row.id === task.id ? task : row))
      if (result) { setDialog(null); setNotice(task.assignee_id ? 'Task saved and assigned in My Work Hub.' : 'Task saved.') }
    }} onDelete={async id => {
      const result = await saveTasks(tasks.filter(task => task.id !== id).map(task => ({ ...task, depends_on: (task.depends_on || []).filter(value => value !== id), ...(task.dependency_details ? { dependency_details: task.dependency_details.filter(link => link.task_id !== id) } : {}) })))
      if (result) { setDialog(null); setNotice('Task removed from this plan and My Work Hub.') }
    }} />}
    {dialog?.type === 'sources' && <PlanningSourceVerification plan={plan} onClose={() => setDialog(null)} onInputs={() => { setDialog(null); inputs() }} />}
    {dialog?.type === 'employee' && <PlanningEmployeeActivity projectId={projectId} employeeId={dialog.task.assignee_id} employeeName={dialog.task.assignee?.name || dialog.task.owner || 'Employee'} initialTaskId={dialog.task.project_task_id} onClose={() => setDialog(null)} />}
    {dialog?.type === 'workstream' && <WorkstreamDialog disciplines={disciplines} busy={saving} saveError={error} onClose={() => { if (!saving) setDialog(null) }} onAdd={async row => { const result = await saveTasks(tasks, [...disciplines, row]); if (result) { setDialog(null); setNotice('Workstream saved. Add activities to build its schedule.') } }} />}
  </section>
}

PlanningReviewPanel.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  enterpriseProject: PropTypes.object,
  stage: PropTypes.oneOf(['review', 'approval']), planningMode: PropTypes.oneOf(['document', 'manual']), canEdit: PropTypes.bool,
  refreshKey: PropTypes.oneOfType([PropTypes.number, PropTypes.string]), onBack: PropTypes.func, onInputs: PropTypes.func, onAnalyze: PropTypes.func, onRebuild: PropTypes.func, onCompare: PropTypes.func, onOpenAdvanced: PropTypes.func,
  onContinue: PropTypes.func, onLoaded: PropTypes.func, onSavingChanged: PropTypes.func, selectedVersionId: PropTypes.string, onVersionChange: PropTypes.func,
}
