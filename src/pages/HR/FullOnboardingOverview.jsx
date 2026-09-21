import { useEffect, useRef, useState } from 'react'
import * as Icons from '@heroicons/react/24/outline'
import apiClient from '../../services/api.service'
import { CASE_STAGES, CASE_STATUSES, caseActivity, caseDate, caseError, caseProgress, isPastCaseDate, validCaseDate } from './onboardingCaseData'
import { getOnboardingInitials } from './onboardingDashboardData'
import './FullOnboardingOverview.css'

const API = '/onboarding/onboarding'
const BRANCHES = { RAD: 'Rejlers Abu Dhabi', RIN: 'Rejlers India' }

export default function FullOnboardingOverview({ employee = {}, recordId, focusItChecklist = false, focusedChecklistStage, onClose }) {
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [selected, setSelected] = useState(CASE_STAGES.some(stage => stage.id === focusedChecklistStage) ? focusedChecklistStage : focusItChecklist ? 'it_provisioning' : null)
  const [busy, setBusy] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [editor, setEditor] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [editError, setEditError] = useState('')
  const [owners, setOwners] = useState([])
  const [ownerState, setOwnerState] = useState('idle')
  const [ownerAttempt, setOwnerAttempt] = useState(0)
  const dialogRef = useRef(null)
  const tasksRef = useRef(null)
  const mutationLock = useRef(false)
  const progress = caseProgress(record)
  const active = progress.stages.find(stage => stage.id === selected) || progress.stages[progress.currentIndex]
  const currentStage = progress.stages[progress.currentIndex]
  const activeIndex = progress.stages.indexOf(active)
  const closed = ['completed', 'cancelled'].includes(record?.status)
  const permission = record?.checklist_stage_permissions?.[active.id]
  const canManage = !closed && Boolean(permission?.can_manage)
  const canStart = !closed && Boolean(permission?.can_start)
  const canEditCase = !closed && Boolean(record?.checklist_stage_permissions?.pre_hire?.can_manage)
  const ownerLabel = permission?.owner_label || active.owner
  const accessReason = permission?.disabled_reason || (closed ? 'This workflow is closed. Its checklist is read-only.' : 'HR Edit permission is required to manage this stage.')
  const name = record?.employee_name || `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || 'Employee'
  const activity = caseActivity(record)
  const pastJoining = !closed && isPastCaseDate(record?.joining_date)
  const unassigned = !record?.assigned_to && !record?.assigned_to_name
  const caseWarnings = !closed ? [unassigned && 'Case owner is unassigned', (!record?.joining_date || pastJoining) && 'Joining date requires review', !record?.reporting_manager && 'Reporting manager is not recorded'].filter(Boolean) : []

  useEffect(() => {
    if (!recordId && !employee.user_id) {
      setRecord(null); setLoading(false); setError('No employee or onboarding case was selected.')
      return undefined
    }
    let activeRequest = true
    setLoading(true); setError('')
    const request = recordId ? apiClient.get(`${API}/${recordId}/`) : apiClient.get(`${API}/`, { params: { user_id: employee.user_id } }).then(response => {
      const records = Array.isArray(response.data) ? response.data : response.data.results || []
      return records.length ? apiClient.get(`${API}/${records[0].id}/`) : { data: null }
    })
    request.then(response => { if (activeRequest) setRecord(response.data) })
      .catch(() => { if (activeRequest) setError('Unable to load the onboarding overview. Please try again.') })
      .finally(() => { if (activeRequest) setLoading(false) })
    return () => { activeRequest = false }
  }, [recordId, employee.user_id, loadAttempt])

  useEffect(() => {
    if (editor && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal()
  }, [editor])

  useEffect(() => {
    if (editor?.type !== 'owner') return undefined
    let live = true
    setOwnerState('loading')
    apiClient.get(`${API}/owner_options/`).then(response => {
      if (!live) return
      setOwners(Array.isArray(response.data) ? response.data : response.data.results || [])
      setOwnerState('ready')
    }).catch(() => { if (live) setOwnerState('error') })
    return () => { live = false }
  }, [editor?.type, ownerAttempt])

  const openEditor = (type, item) => {
    setEditError('')
    setEditValue(type === 'owner' ? String(record.assigned_to || '') : type === 'date' ? record.joining_date || '' : item?.description || '')
    setEditor({ type, item })
  }
  const closeEditor = () => {
    if (busy) return
    dialogRef.current?.close()
    setEditor(null)
  }
  const refresh = async () => {
    const response = await apiClient.get(`${API}/${record.id}/`)
    setRecord(response.data)
    return response.data
  }
  const mutate = async (key, operation, message) => {
    if (mutationLock.current) return false
    mutationLock.current = true; setBusy(key); setActionError(''); setNotice('')
    try {
      await operation()
      await refresh()
      setNotice(message)
      return true
    } catch (failure) {
      setActionError(caseError(failure, 'The change could not be saved. Refresh the case and try again.'))
      return false
    } finally { mutationLock.current = false; setBusy('') }
  }
  const startStage = () => {
    if (!canStart) return
    return mutate('start', () => apiClient.post(`${API}/${record.id}/start-checklist-stage/`, { stage: active.id }), `${active.title} checklist started.`)
  }
  const toggleTask = item => {
    if (!canManage) return
    return mutate(`task-${item.id}`, () => apiClient.patch(`/onboarding/checklist/${item.id}/`, { completed: !item.completed }), `${item.task_name}: ${item.completed ? 'marked as pending' : 'completed'}.`)
  }
  const saveEditor = async event => {
    event.preventDefault()
    if (mutationLock.current) return
    if (editor.type === 'owner' && !owners.some(owner => String(owner.user_id) === editValue)) { setEditError('Select an active case owner.'); return }
    if (editor.type === 'date' && !validCaseDate(editValue)) { setEditError('Enter a valid joining date.'); return }
    mutationLock.current = true; setBusy('editor'); setEditError(''); setNotice('')
    try {
      if (editor.type === 'task') await apiClient.patch(`/onboarding/checklist/${editor.item.id}/`, { description: editValue })
      else await apiClient.patch(`${API}/${record.id}/`, editor.type === 'owner' ? { assigned_to: editValue } : { joining_date: editValue })
      await refresh()
      setNotice(editor.type === 'owner' ? 'Case owner assigned.' : editor.type === 'date' ? 'Joining date updated.' : 'Task notes saved.')
      dialogRef.current?.close(); setEditor(null)
    } catch (failure) { setEditError(caseError(failure, 'The change could not be saved. Please try again.')) }
    finally { mutationLock.current = false; setBusy('') }
  }
  const printSummary = () => {
    const printWindow = window.open('', '_blank', 'width=1100,height=800')
    if (!printWindow) { setActionError('Allow pop-ups to open the print summary.'); return }
    const escape = value => String(value ?? '—').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
    const rows = progress.stages.map(stage => `<h2>${escape(stage.title)}</h2><table><thead><tr><th>Task</th><th>Due</th><th>Status</th><th>Notes / evidence</th></tr></thead><tbody>${stage.items.length ? stage.items.map(item => `<tr><td>${escape(item.task_name)}</td><td>${escape(caseDate(item.due_date))}</td><td>${item.completed ? 'Completed' : 'Pending'}${item.completed_by_name ? `<br>${escape(item.completed_by_name)}` : ''}</td><td>${escape(item.description || '—')}</td></tr>`).join('') : '<tr><td colspan="4">Checklist has not started</td></tr>'}</tbody></table>`).join('')
    printWindow.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escape(name)} — Onboarding summary</title><style>@page{size:A4;margin:16mm}body{font:12px Arial,sans-serif;color:#14284b}header{border-bottom:2px solid #14284b;padding-bottom:12px}h1{font-size:25px}h2{font-size:16px;margin-top:25px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #d7e0ed;padding:8px;text-align:left;vertical-align:top;white-space:pre-wrap}th{background:#f0f5fa}tr{break-inside:avoid}footer{margin-top:24px;color:#596c89;font-size:10px}</style></head><body><header><strong>REJLERS · CONFIDENTIAL HR DOCUMENT</strong><h1>${escape(name)}</h1><p>Full Onboarding Overview · Case ONB-${escape(record.id)}</p><p>${escape(CASE_STATUSES[record.status] || record.status)} · ${progress.percent}% readiness</p></header><p>Joining date: ${escape(caseDate(record.joining_date))}<br>Case owner: ${escape(record.assigned_to_name || 'Unassigned')}<br>Work email: ${escape(record.employee_email)}<br>Employee ID: ${escape(record.employee_id)}<br>Position: ${escape(record.position)}<br>Department: ${escape(record.department)}<br>Reporting manager: ${escape(record.reporting_manager || 'Not assigned')}</p>${rows}<h2>Activity</h2>${activity.map(event => `<p>${escape(caseDate(event.date))} · ${escape(event.title)} · ${escape(event.detail)}</p>`).join('')}<footer>Printed ${escape(caseDate(new Date().toISOString()))} · Rejlers Abu Dhabi</footer></body></html>`)
    printWindow.document.close()
    printWindow.addEventListener('afterprint', () => printWindow.close(), { once: true })
    printWindow.setTimeout(() => { printWindow.focus(); printWindow.print() }, 300)
  }
  const back = () => { if (!busy) onClose() }

  return <div className="onboarding-case" aria-label="Full Onboarding Overview">
    <nav className="onboarding-case-breadcrumb" aria-label="Breadcrumb"><a href="/hr">HR</a><span>/</span><button type="button" onClick={back} disabled={Boolean(busy)} aria-label="Back to onboarding">Onboarding</button><span>/</span><span aria-current="page">{name}</span></nav>
    {loading ? <div className="onboarding-case-state" role="status"><Icons.ArrowPathIcon className="animate-spin" aria-hidden="true" />Loading onboarding overview…</div> : error ? <div className="onboarding-case-state" role="alert"><p>{error}</p><button className="onboarding-case-button" onClick={() => setLoadAttempt(value => value + 1)}>Retry overview</button></div> : !record ? <div className="onboarding-case-state"><p>No onboarding workflow was found for this employee.</p><button className="onboarding-case-button" onClick={back}>Back to onboarding</button></div> : <>
      <header className="onboarding-case-header"><div className="onboarding-case-person"><span className="onboarding-case-avatar">{record.photo_url ? <img src={record.photo_url} alt="" /> : getOnboardingInitials(name)}</span><div><div className="onboarding-case-title"><h1>{name}</h1><span className={`onboarding-case-badge ${record.status === 'completed' ? 'is-green' : record.status === 'cancelled' ? 'is-gray' : 'is-blue'}`}>{CASE_STATUSES[record.status] || record.status}</span></div><p>{record.position || employee.job_title_uae || 'Position not set'}<span> · </span>{record.department || employee.division || 'Department not set'}</p></div></div><div className="onboarding-case-id"><span>Case ID</span><strong>ONB-{record.id}</strong></div><div className="onboarding-case-header-actions"><button type="button" className="onboarding-case-button" onClick={printSummary}><Icons.PrinterIcon aria-hidden="true" />Print summary</button><button type="button" className="onboarding-case-button is-icon" aria-label="Refresh overview" disabled={Boolean(busy)} onClick={() => setLoadAttempt(value => value + 1)}><Icons.ArrowPathIcon aria-hidden="true" /></button>{canEditCase && <button type="button" className="onboarding-case-button is-primary" disabled={Boolean(busy)} onClick={() => openEditor('owner')}><Icons.UserPlusIcon aria-hidden="true" />{unassigned ? 'Assign owner' : 'Change owner'}</button>}</div></header>
      <section className="onboarding-case-metrics" aria-label="Case summary"><div><Icons.CalendarDaysIcon className="is-violet" aria-hidden="true" /><div><span>Joining date</span><strong>{caseDate(record.joining_date)}{pastJoining && <b className="onboarding-case-badge is-red">Past date</b>}</strong></div></div><div><Icons.ChartBarIcon aria-hidden="true" /><div><span>Overall readiness</span><strong title="Completion across all four checklist stages">{progress.percent}%</strong></div></div><div><Icons.DocumentCheckIcon className="is-blue" aria-hidden="true" /><div><span>Current stage</span><strong>{record.status === 'completed' ? 'Complete' : currentStage.short}</strong></div></div><div><Icons.UserCircleIcon className="is-amber" aria-hidden="true" /><div><span>Case owner</span><strong>{unassigned ? <b className="onboarding-case-badge is-amber">Unassigned</b> : record.assigned_to_name || 'Assigned'}</strong></div></div></section>
      {caseWarnings.length > 0 && <section className="onboarding-case-attention"><Icons.ExclamationCircleIcon aria-hidden="true" /><div><h2>Onboarding needs attention</h2><p>{unassigned && pastJoining ? 'Assign a case owner and review the joining date while completing the onboarding tasks.' : caseWarnings.join('. ') + '.'}</p></div><div>{canEditCase && unassigned && <button type="button" className="onboarding-case-button is-primary" onClick={() => openEditor('owner')} disabled={Boolean(busy)}><Icons.UserPlusIcon aria-hidden="true" />Assign owner</button>}{canEditCase && <button type="button" className="onboarding-case-button" onClick={() => openEditor('date')} disabled={Boolean(busy)}><Icons.CalendarDaysIcon aria-hidden="true" />Review joining date</button>}</div></section>}
      {actionError && <div className="onboarding-case-message is-error" role="alert">{actionError}<button type="button" onClick={() => { setActionError(''); setLoadAttempt(value => value + 1) }}>Refresh case</button></div>}
      {notice && <p className="onboarding-case-message" role="status"><Icons.CheckCircleIcon aria-hidden="true" />{notice}</p>}
      <nav className="onboarding-case-stages" aria-label="Onboarding stages">{progress.stages.map((stage, index) => {
        const stagePermission = record.checklist_stage_permissions?.[stage.id]
        return <button type="button" key={stage.id} aria-label={stage.short} aria-current={stage.id === active.id ? 'step' : undefined} disabled={Boolean(busy)} onClick={() => { setSelected(stage.id); setActionError('') }} className={stage.complete ? 'is-complete' : ''}><span className="onboarding-case-step-number">{stage.complete ? <Icons.CheckIcon aria-hidden="true" /> : index + 1}</span><div><strong>{stage.short}</strong><small>Owner: {stagePermission?.owner_label || stage.owner}</small></div>{!stage.complete && !stagePermission?.can_manage && !stagePermission?.can_start && <Icons.LockClosedIcon className="onboarding-case-step-lock" aria-hidden="true" />}</button>
      })}</nav>
      <div className="onboarding-case-columns">
        <section className="onboarding-case-panel onboarding-case-tasks" ref={tasksRef} tabIndex={-1} aria-labelledby="onboarding-case-stage-title">
          <header className="onboarding-case-task-heading"><Icons.DocumentCheckIcon aria-hidden="true" /><div><h2 id="onboarding-case-stage-title">{active.title}</h2><p>{active.description}</p></div><dl><div><dt>Owner</dt><dd>{ownerLabel}</dd></div><div><dt>Completed</dt><dd>{active.done} of {active.items.length}</dd></div><div><dt>Due</dt><dd>{caseDate(record.target_completion_date || record.joining_date)}</dd></div></dl><span className={`onboarding-case-access ${canManage ? 'is-editable' : ''}`}>{canManage ? <Icons.PencilSquareIcon aria-hidden="true" /> : <Icons.EyeIcon aria-hidden="true" />}{canManage ? 'HR can edit this stage' : closed ? 'View only — case closed' : `View only — ${ownerLabel} owns this stage`}</span></header>
          {!canManage && <p className="onboarding-case-access-reason"><Icons.LockClosedIcon aria-hidden="true" />{accessReason}</p>}
          {active.items.length ? <div className="onboarding-case-table-scroll"><table className="onboarding-case-table"><thead><tr><th scope="col">#</th><th scope="col">Task</th><th scope="col">Owner</th><th scope="col">Due</th><th scope="col">Status</th><th scope="col">Evidence / Action</th></tr></thead><tbody>{active.items.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td><span>{item.task_name}</span></td><td>{ownerLabel}</td><td><span className={!item.completed && isPastCaseDate(item.due_date) ? 'onboarding-case-overdue' : ''}>{!item.completed && isPastCaseDate(item.due_date) && <Icons.CalendarDaysIcon aria-hidden="true" />}{item.due_date ? !item.completed && isPastCaseDate(item.due_date) ? 'Overdue' : caseDate(item.due_date) : 'Not set'}</span></td><td><button type="button" className={`onboarding-case-task-status ${item.completed ? 'is-complete' : ''}`} aria-label={`Mark ${item.task_name} as ${item.completed ? 'pending' : 'completed'}`} disabled={!canManage || Boolean(busy)} onClick={() => toggleTask(item)} title={canManage ? `Mark as ${item.completed ? 'pending' : 'completed'}` : accessReason}>{item.completed ? <Icons.CheckCircleIcon aria-hidden="true" /> : <i />}{busy === `task-${item.id}` ? 'Saving…' : item.completed ? 'Completed' : 'Not started'}</button></td><td><button type="button" className="onboarding-case-link" disabled={Boolean(busy)} onClick={() => openEditor('task', item)}><Icons.ArrowTopRightOnSquareIcon aria-hidden="true" />{item.completed ? 'View evidence' : 'View requirement'}</button></td></tr>)}</tbody></table></div> : <div className="onboarding-case-empty"><Icons.ClipboardDocumentListIcon aria-hidden="true" /><h3>{active.title} has not started</h3><p>{canStart ? 'Start the checklist to create this stage’s standard tasks.' : accessReason}</p><button type="button" className="onboarding-case-button is-primary" onClick={startStage} disabled={!canStart || Boolean(busy)}>{busy === 'start' ? 'Starting…' : canStart ? 'Start Checklist' : canEditCase ? 'Stage locked' : 'View Only'}</button></div>}
          {active.items.length > 0 && <footer className="onboarding-case-task-footer"><Icons.InformationCircleIcon aria-hidden="true" /><p>{closed ? 'This case is closed. Completed tasks and evidence remain available for review.' : 'Review the requirements and record completion for every task. The next stage unlocks when this checklist is complete.'}</p><div>{closed ? <span className={`onboarding-case-badge ${record.status === 'completed' ? 'is-green' : 'is-gray'}`}>{CASE_STATUSES[record.status]}</span> : activeIndex < 3 ? <button type="button" className="onboarding-case-button is-primary" disabled={!active.complete || Boolean(busy)} onClick={() => setSelected(progress.stages[activeIndex + 1].id)}>Continue to {progress.stages[activeIndex + 1].short}<Icons.ArrowRightIcon aria-hidden="true" /></button> : <button type="button" className="onboarding-case-button is-primary" disabled={!progress.allComplete || !canManage || Boolean(busy)} onClick={() => mutate('complete', () => apiClient.post(`${API}/${record.id}/mark_completed/`, {}), 'Onboarding completed.')}>Complete onboarding</button>}<small>{closed ? `${progress.percent}% readiness recorded` : active.items.length - active.done ? `${active.items.length - active.done} required tasks remain` : 'All stage tasks complete'}</small></div></footer>}
        </section>
        <aside className="onboarding-case-aside">
          <section className="onboarding-case-panel onboarding-case-readiness"><h2><Icons.ChartBarIcon aria-hidden="true" />Case readiness</h2><div className={`onboarding-case-readiness-status ${record.status === 'completed' ? 'is-complete' : record.status === 'cancelled' ? 'is-cancelled' : caseWarnings.length || active.items.some(item => !item.completed && isPastCaseDate(item.due_date)) ? 'is-attention' : ''}`}><Icons.ExclamationCircleIcon aria-hidden="true" />{record.status === 'completed' ? 'Completed' : record.status === 'cancelled' ? 'Cancelled' : caseWarnings.length ? 'Needs attention' : 'In progress'}</div><ul><li><Icons.ListBulletIcon aria-hidden="true" /><span>{active.items.length ? `${active.items.length - active.done} ${active.short.toLowerCase()} tasks incomplete` : `${active.short} checklist not started`}</span></li>{caseWarnings.map(warning => <li key={warning}><Icons.ExclamationCircleIcon aria-hidden="true" /><span>{warning}</span></li>)}{activeIndex < 3 && !active.complete && <li><Icons.LockClosedIcon aria-hidden="true" /><span>Complete this checklist to unlock {progress.stages[activeIndex + 1].short.toLowerCase()}</span></li>}</ul><button type="button" className="onboarding-case-button onboarding-case-review-button" onClick={() => { tasksRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); tasksRef.current?.focus({ preventScroll: true }) }}>Review tasks<Icons.ArrowRightIcon aria-hidden="true" /></button></section>
          <section className="onboarding-case-panel onboarding-case-activity"><header><h2><Icons.ClockIcon aria-hidden="true" />Activity</h2><button type="button" className="onboarding-case-button" onClick={() => openEditor('history')}>View full history</button></header><ol>{activity.slice(0, 3).map(event => <li key={event.id}><strong>{event.title}</strong><span>{caseDate(event.date)}{event.detail && ` · ${event.detail}`}</span></li>)}</ol>{!activity.length && <p className="onboarding-case-muted">No recorded activity yet.</p>}</section>
        </aside>
      </div>
      <details className="onboarding-case-panel onboarding-case-employee" open><summary><Icons.UserIcon aria-hidden="true" /><h2>Employee details</h2><Icons.ChevronDownIcon aria-hidden="true" /></summary><dl>{[['Work email', record.employee_email || employee.email], ['Employee ID', record.employee_id || employee.employee_number], ['Branch', BRANCHES[record.branch] || record.branch], ['Position', record.position], ['Department', record.department], ['Reporting manager', record.reporting_manager || 'Not assigned']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not set'}</dd></div>)}</dl><div className="onboarding-case-employee-actions">{record.user && <a className="onboarding-case-link" href={`/hr/employees?employee=${encodeURIComponent(record.user)}`}><Icons.ArrowTopRightOnSquareIcon aria-hidden="true" />Open employee record</a>}{canEditCase && <button type="button" className="onboarding-case-link" disabled={Boolean(busy)} onClick={() => openEditor('date')}>Review joining date</button>}</div></details>
      {editor && <dialog ref={dialogRef} className="onboarding-case-dialog" aria-labelledby="onboarding-case-dialog-title" onCancel={event => { event.preventDefault(); closeEditor() }} onClose={() => setEditor(null)}><header><h2 id="onboarding-case-dialog-title">{editor.type === 'owner' ? 'Assign case owner' : editor.type === 'date' ? 'Review joining date' : editor.type === 'task' ? editor.item.task_name : 'Activity history'}</h2><button type="button" className="onboarding-case-button is-icon" aria-label="Close dialog" onClick={closeEditor} disabled={Boolean(busy)}><Icons.XMarkIcon aria-hidden="true" /></button></header>
        {editor.type === 'history' ? <ol className="onboarding-case-history-list">{activity.map(event => <li key={event.id}><strong>{event.title}</strong><p>{event.detail}</p><small>{caseDate(event.date)}</small></li>)}</ol> : <form onSubmit={saveEditor}>
          {editor.type === 'owner' && <><p>Select the employee responsible for coordinating this onboarding case.</p><label htmlFor="onboarding-case-owner">Case owner</label><select id="onboarding-case-owner" name="assigned_to" value={editValue} onChange={event => setEditValue(event.target.value)} disabled={ownerState !== 'ready' || Boolean(busy)} required><option value="">{ownerState === 'loading' ? 'Loading owners…' : 'Select case owner'}</option>{owners.map(owner => <option value={owner.user_id} key={owner.user_id}>{`${owner.first_name || ''} ${owner.last_name || ''}`.trim()} · {owner.email || owner.employee_number}</option>)}</select>{ownerState === 'error' && <p className="onboarding-case-message is-error" role="alert">Case owners could not be loaded.<button type="button" onClick={() => setOwnerAttempt(value => value + 1)}>Retry owners</button></p>}</>}
          {editor.type === 'date' && <><p>Update the joining date on this case and the employee record. Existing task deadlines and the target completion date stay as recorded.</p><label htmlFor="onboarding-case-date">Joining date</label><input id="onboarding-case-date" name="joining_date" type="date" value={editValue} onChange={event => setEditValue(event.target.value)} required disabled={Boolean(busy)} /></>}
          {editor.type === 'task' && <><p>{active.title} · Owner: {ownerLabel} · Due {caseDate(editor.item.due_date)}</p><label htmlFor="onboarding-case-description">Requirement / evidence notes</label><textarea id="onboarding-case-description" name="description" rows="6" value={editValue} onChange={event => setEditValue(event.target.value)} readOnly={!canManage} disabled={Boolean(busy)} /><p className="onboarding-case-muted">Record the requirement, reference or completion evidence here. Task completion is recorded separately in the checklist.</p>{editor.item.completed && <p>Completed {caseDate(editor.item.completed_date)}{editor.item.completed_by_name && ` by ${editor.item.completed_by_name}`}.</p>}</>}
          {editError && <p className="onboarding-case-message is-error" role="alert">{editError}</p>}
          <footer><button type="button" className="onboarding-case-button" disabled={Boolean(busy)} onClick={closeEditor}>Cancel</button>{(editor.type !== 'task' || canManage) && <button type="submit" className="onboarding-case-button is-primary" disabled={Boolean(busy) || (editor.type === 'owner' && ownerState !== 'ready')}>{busy === 'editor' ? 'Saving…' : editor.type === 'owner' ? 'Save owner' : editor.type === 'date' ? 'Save joining date' : 'Save notes'}</button>}</footer>
        </form>}
      </dialog>}
    </>}
  </div>
}
