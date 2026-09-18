/* eslint-disable react/prop-types */
import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, ClipboardList, KeyRound, Loader2, Search, Sparkles, Users, X } from 'lucide-react'
import { projectSetupService } from '../../../services/projectSetup.service'
import './AIProjectSetupDialog.css'

const blankBrief = initial => ({
  description: initial?.description || '', code: initial?.code || '', name: initial?.name || '',
  project_type: initial?.project_type || initial?.custom_fields?.project_type || 'internal',
  department: initial?.department || initial?.custom_fields?.department || '', phase: initial?.phase || 'Phase 1',
  start_date: initial?.start_date || '', end_date: initial?.end_date || '',
  project_manager_id: initial?.project_manager_id || '', team_member_ids: [],
})
const humanError = error => {
  const flatten = value => typeof value === 'string' ? value : Array.isArray(value) ? value.map(flatten).join(' ') : value && typeof value === 'object' ? Object.entries(value).map(([key, item]) => `${['detail', 'error', 'non_field_errors'].includes(key) ? '' : `${key.replaceAll('_', ' ')}: `}${flatten(item)}`).join(' ') : ''
  return flatten(error?.response?.data) || error?.message || 'The request could not be completed. Please try again.'
}
const personId = person => String(person.user_id ?? person.id)
const personLabel = person => `${person.name || person.display_name || person.email}${person.department ? ` · ${person.department}` : ''}`
const noteText = note => typeof note === 'string' ? note : note?.description || note?.message || note?.title || note?.name || ''
const workingDaysBetween = (start, finish) => {
  if (!start || !finish || finish < start) return null
  let days = 0
  const cursor = new Date(`${start}T00:00:00Z`), end = new Date(`${finish}T00:00:00Z`)
  if (!Number.isFinite(cursor.getTime()) || !Number.isFinite(end.getTime()) || end - cursor > 3660 * 86400000) return null
  while (cursor <= end) { if (![0, 6].includes(cursor.getUTCDay())) days += 1; cursor.setUTCDate(cursor.getUTCDate() + 1) }
  return days
}
const finishForDuration = (start, duration) => {
  if (!start || !Number.isInteger(Number(duration)) || Number(duration) < 1 || Number(duration) > 3650) return ''
  const cursor = new Date(`${start}T00:00:00Z`)
  if (!Number.isFinite(cursor.getTime())) return ''
  let remaining = Number(duration)
  while (remaining) { if (![0, 6].includes(cursor.getUTCDay())) remaining -= 1; if (remaining) cursor.setUTCDate(cursor.getUTCDate() + 1) }
  return cursor.toISOString().slice(0, 10)
}

function EmployeeSelect({ label, employees, value, onChange, required = false, disabled = false }) {
  const id = useId()
  return <label className="aps-field" htmlFor={id}><span>{label}{required ? ' *' : ''}</span><select id={id} value={value ?? ''} onChange={event => onChange(event.target.value ? Number(event.target.value) : null)} required={required} disabled={disabled}><option value="">{required ? 'Select employee' : 'Unassigned'}</option>{employees.map(person => <option key={personId(person)} value={personId(person)}>{personLabel(person)}</option>)}</select></label>
}

function TaskPreview({ task, index, tasks, disciplines, employees, onChange, busy, startDate }) {
  const label = `Task ${index + 1}`
  return <article className="aps-task">
    <div className="aps-task-number">{task.wbs_code || index + 1}</div>
    <div className="aps-task-fields">
      <label className="aps-field aps-task-title"><span>{label} / deliverable</span><input value={task.title || ''} onChange={event => onChange('title', event.target.value)} required maxLength={500} disabled={busy} /></label>
      <div className="aps-task-grid">
        <label className="aps-field"><span>{label} workstream</span><select value={task.discipline || ''} onChange={event => onChange('discipline', event.target.value)} required disabled={busy}>{disciplines.map(group => <option key={group.code} value={group.code}>{group.name}</option>)}</select></label>
        <EmployeeSelect label={`${label} assigned to`} employees={employees} value={task.assignee_id} onChange={value => onChange('assignee_id', value)} disabled={busy} />
        <label className="aps-field"><span>{label} effort (hours)</span><input type="number" min="0" step="0.01" value={task.effort_hours ?? ''} onChange={event => onChange('effort_hours', event.target.value === '' ? null : Number(event.target.value))} required disabled={busy} /></label>
        <label className="aps-field"><span>{label} start date</span><input type="date" min={startDate} value={task.planned_start_date || ''} onChange={event => onChange('planned_start_date', event.target.value)} required disabled={busy} /></label>
        <label className="aps-field"><span>{label} due date</span><input type="date" min={task.planned_start_date || startDate} value={task.due_date || ''} onChange={event => onChange('due_date', event.target.value)} required disabled={busy} /></label>
      </div>
      <details className="aps-task-details"><summary>Acceptance criteria, reviewer and dependencies</summary><div className="aps-grid">
        <label className="aps-field"><span>{label} acceptance criteria</span><textarea rows={2} value={task.acceptance_criteria || ''} onChange={event => onChange('acceptance_criteria', event.target.value)} disabled={busy} /></label>
        <EmployeeSelect label={`${label} reviewer`} employees={employees} value={task.reviewer_id} onChange={value => onChange('reviewer_id', value)} disabled={busy} />
        <label className="aps-field"><span>{label} duration (working days)</span><input type="number" min="1" max="3650" step="1" value={task.duration_days ?? ''} required onChange={event => onChange('duration_days', event.target.value === '' ? null : Number(event.target.value))} disabled={busy} /></label>
        <label className="aps-field"><span>{label} work type</span><select value={task.task_type || 'deliverable'} onChange={event => onChange('task_type', event.target.value)} disabled={busy}><option value="deliverable">Deliverable task</option><option value="task">Task</option></select></label>
        <fieldset className="aps-dependencies"><legend>{label} depends on</legend>{tasks.filter(other => other.id !== task.id).map(other => <label key={other.id}><input type="checkbox" checked={(task.depends_on || []).includes(other.id)} disabled={busy} onChange={event => onChange('depends_on', event.target.checked ? [...(task.depends_on || []), other.id] : (task.depends_on || []).filter(id => id !== other.id))} />{other.title}</label>)}{tasks.length === 1 && <p>No other tasks.</p>}</fieldset>
      </div></details>
    </div>
  </article>
}

export default function AIProjectSetupDialog({ initialValues, onClose, onCreated }) {
  const dialogRef = useRef(null), busyRef = useRef(false), id = useId()
  const [brief, setBrief] = useState(() => blankBrief(initialValues))
  const [options, setOptions] = useState(null), [loading, setLoading] = useState(true)
  const [optionsError, setOptionsError] = useState(''), [reload, setReload] = useState(0)
  const [error, setError] = useState(''), [busy, setBusy] = useState('')
  const [preview, setPreview] = useState(null), [plan, setPlan] = useState(null)
  const [teamSearch, setTeamSearch] = useState('')
  const [apiKey, setApiKey] = useState(''), [aiModel, setAIModel] = useState('gpt-4o')
  const [connectionError, setConnectionError] = useState(''), [connectionMessage, setConnectionMessage] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current, opener = document.activeElement
    dialog.showModal()
    return () => { dialog.close(); if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setOptionsError('')
    projectSetupService.options(controller.signal).then(data => {
      if (!Array.isArray(data.employees) || !Array.isArray(data.project_types)) throw new Error('Project setup options could not be loaded.')
      setOptions(data)
      setAIModel(data.ai_settings?.model || 'gpt-4o')
    }).catch(reason => { if (!controller.signal.aborted) setOptionsError(humanError(reason)) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [reload])

  const employees = useMemo(() => options?.employees || [], [options])
  const connectionDirty = Boolean(apiKey.trim()) || aiModel.trim() !== (options?.ai_settings?.model || 'gpt-4o')
  const filteredTeam = useMemo(() => employees.filter(person => `${personLabel(person)} ${person.email || ''} ${person.employee_code || ''}`.toLowerCase().includes(teamSearch.toLowerCase())), [employees, teamSearch])
  const setField = (name, value) => setBrief(current => ({ ...current, [name]: value }))
  const toggleTeam = value => setBrief(current => ({ ...current, team_member_ids: current.team_member_ids.includes(value) ? current.team_member_ids.filter(item => item !== value) : [...current.team_member_ids, value] }))
  const updateTask = (index, field, value) => setPlan(current => ({ ...current, tasks: current.tasks.map((task, position) => {
    if (position !== index) return task
    const edited = { ...task, [field]: value }
    if (field === 'planned_start_date' || field === 'duration_days') edited.due_date = finishForDuration(edited.planned_start_date, edited.duration_days) || edited.due_date
    if (field === 'due_date') edited.duration_days = workingDaysBetween(edited.planned_start_date, edited.due_date)
    return edited
  }) }))
  const close = () => { if (!busyRef.current) { setApiKey(''); onClose() } }
  const updateConnection = data => {
    setOptions(current => ({ ...current, ...data }))
    setAIModel(data.ai_settings?.model || 'gpt-4o')
  }
  const saveConnection = async () => {
    if (busyRef.current || !options || options.ai_settings?.storage_available === false) return
    if (!apiKey.trim() && !options.ai_settings?.key_configured) { setConnectionError('Enter your OpenAI API key to test the connection.'); return }
    if (!aiModel.trim()) { setConnectionError('Enter the OpenAI model to use.'); return }
    busyRef.current = true; setBusy('connection'); setConnectionError(''); setConnectionMessage('')
    try {
      const data = await projectSetupService.saveAISettings({ model: aiModel.trim(), ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}) })
      updateConnection(data); setApiKey(''); setConnectionMessage('Connection tested. Your personal AI key is saved.')
    } catch (reason) {
      const message = humanError(reason)
      setConnectionError(apiKey.trim() ? message.replaceAll(apiKey.trim(), '[hidden]') : message)
    } finally { busyRef.current = false; setBusy('') }
  }
  const removeConnection = async () => {
    if (busyRef.current || !options?.ai_settings?.key_configured) return
    busyRef.current = true; setBusy('connection-remove'); setConnectionError(''); setConnectionMessage('')
    try {
      const data = await projectSetupService.removeAISettings()
      updateConnection(data); setApiKey(''); setConnectionMessage('Your saved AI key was removed.')
    } catch (reason) { setConnectionError(humanError(reason)) } finally { busyRef.current = false; setBusy('') }
  }
  const generate = async (event, generationMode) => {
    event.preventDefault()
    if (busyRef.current || !options) return
    if (generationMode === 'ai' && (connectionDirty || !options.ai_available)) { setConnectionError(connectionDirty ? 'Test & save your connection changes before generating.' : options.ai_message || 'Add and test your API key before generating with AI.'); return }
    if (brief.end_date <= brief.start_date) { setError('Project end date must be after the start date.'); return }
    busyRef.current = true; setBusy('preview'); setError('')
    try {
      const result = await projectSetupService.preview({ ...brief, project_manager_id: Number(brief.project_manager_id), generation_mode: generationMode })
      if (!result.preview_token || !result.plan?.project || !Array.isArray(result.plan?.tasks) || !result.plan.tasks.length) throw new Error('No usable project plan was returned. Update the brief and try again.')
      setPreview(result); setPlan(result.plan)
      dialogRef.current?.querySelector('.aps-body')?.scrollTo(0, 0)
    } catch (reason) { setError(humanError(reason)) } finally { busyRef.current = false; setBusy('') }
  }
  const create = async event => {
    event.preventDefault()
    if (busyRef.current || !preview || !plan) return
    busyRef.current = true; setBusy('create'); setError('')
    try {
      const result = await projectSetupService.create({ preview_token: preview.preview_token, plan })
      if (!result.enterprise_project?.id || !result.planning_project?.id) throw new Error('The project setup response was incomplete. Refresh the portfolio before retrying.')
      await onCreated(result)
    } catch (reason) { setError(humanError(reason)) } finally { busyRef.current = false; setBusy('') }
  }
  const isTemplate = (plan?.source || preview?.source) === 'template'
  const plannedHours = (plan?.tasks || []).reduce((total, task) => total + Number(task.effort_hours || 0), 0)
  const forecastFinish = (plan?.tasks || []).reduce((latest, task) => task.due_date > latest ? task.due_date : latest, '')
  const datesChanged = Boolean(plan && preview && plan.tasks.some((task, index) => task.planned_start_date !== preview.plan.tasks[index]?.planned_start_date || task.due_date !== preview.plan.tasks[index]?.due_date))
  const warnings = [...(preview?.warnings || []), ...(plan?.warnings || [])].filter((value, index, rows) => rows.findIndex(row => noteText(row) === noteText(value)) === index)

  return <dialog ref={dialogRef} className="aps-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={event => { event.preventDefault(); close() }}>
    <header className="aps-header"><div><div className="aps-eyebrow"><Sparkles size={16} aria-hidden="true" /> Project setup</div><h2 id={`${id}-title`}>{preview ? 'Review your project plan' : 'Create a project with AI'}</h2><p id={`${id}-description`}>{preview ? 'Review the tasks, assignments and dates, then create everything together.' : 'Describe your project to prepare its scope, work breakdown, assignments and schedule.'}</p></div><button type="button" className="aps-icon-button" aria-label="Close project setup" onClick={close} disabled={Boolean(busy)}><X size={21} aria-hidden="true" /></button></header>
    <form id={`${id}-form`} className="aps-form" onSubmit={preview ? create : event => generate(event, event.nativeEvent.submitter?.value || 'ai')}>
      <div className="aps-body">
        {error && <div className="aps-notice aps-error" role="alert">{error}</div>}
        {loading && <p role="status" className="aps-loading"><Loader2 className="aps-spin" size={18} aria-hidden="true" /> Loading project types and employees…</p>}
        {optionsError && <div role="alert" className="aps-notice aps-error">{optionsError}<button type="button" className="aps-button" onClick={() => setReload(value => value + 1)}>Retry loading</button></div>}
        {!preview && options && !loading && !optionsError && <>
          <section className="aps-connection" aria-labelledby={`${id}-connection`}>
            <div className="aps-connection-heading"><div><h3 id={`${id}-connection`}><KeyRound size={17} aria-hidden="true" /> AI connection</h3><p>Bring your own key (BYOK) · OpenAI</p></div><span className={`aps-connection-status${options.ai_settings?.key_configured && options.ai_available ? ' aps-connected' : ''}`}>{options.ai_settings?.key_configured ? options.ai_available ? <><CheckCircle2 size={14} aria-hidden="true" /> Personal key connected</> : 'Saved key needs attention' : options.ai_available ? 'Server AI available' : 'Key required for AI'}</span></div>
            <div className="aps-connection-fields" onKeyDown={event => { if (event.key === 'Enter' && event.target.tagName === 'INPUT' && !event.nativeEvent.isComposing) { event.preventDefault(); saveConnection() } }}>
              <label className="aps-field"><span>OpenAI API key</span><input type="password" autoComplete="new-password" autoCapitalize="off" spellCheck={false} value={apiKey} onChange={event => { setApiKey(event.target.value); setConnectionError(''); setConnectionMessage('') }} placeholder={options.ai_settings?.key_configured ? 'Saved securely · enter a key to replace it' : 'Enter your OpenAI API key'} disabled={Boolean(busy) || options.ai_settings?.storage_available === false} aria-describedby={`${id}-key-help`} /></label>
              <label className="aps-field"><span>AI model</span><input value={aiModel} maxLength={100} onChange={event => { setAIModel(event.target.value); setConnectionError(''); setConnectionMessage('') }} placeholder="gpt-4o" autoComplete="off" spellCheck={false} disabled={Boolean(busy) || options.ai_settings?.storage_available === false} /></label>
              <button type="button" className="aps-button" onClick={saveConnection} disabled={Boolean(busy) || options.ai_settings?.storage_available === false || (!apiKey.trim() && !options.ai_settings?.key_configured) || !aiModel.trim()}>{busy === 'connection' ? <><Loader2 size={16} className="aps-spin" aria-hidden="true" /> Testing connection…</> : 'Test & save key'}</button>
            </div>
            <div className="aps-connection-help"><p id={`${id}-key-help`}>Your personal key is encrypted on the server and available next time. Testing makes a small request billed by your provider.</p>{options.ai_settings?.key_configured && <button type="button" className="aps-text-button" onClick={removeConnection} disabled={Boolean(busy)}>{busy === 'connection-remove' ? 'Removing key…' : 'Remove saved key'}</button>}</div>
            {connectionDirty && <p className="aps-connection-pending" role="status">Test &amp; save your connection changes before generating.</p>}
            {options.ai_settings?.storage_available === false && <div className="aps-notice" role="status">Secure key storage is not available. Ask an administrator to enable BYOK encryption, or use the standard template.</div>}
            {connectionError && <div className="aps-notice aps-error" role="alert">{connectionError}</div>}
            {connectionMessage && <p className="aps-connection-message" role="status"><CheckCircle2 size={16} aria-hidden="true" />{connectionMessage}</p>}
          </section>
          <label className="aps-field aps-brief"><span>What do you want to achieve? *</span><textarea rows={3} required maxLength={16000} value={brief.description} onChange={event => setField('description', event.target.value)} placeholder="Describe the outcome, work to include and launch requirements. No document upload is required." disabled={Boolean(busy)} /></label>
          <div className="aps-grid">
            <label className="aps-field"><span>Project name *</span><input required maxLength={255} value={brief.name} onChange={event => setField('name', event.target.value)} disabled={Boolean(busy)} /></label>
            <label className="aps-field"><span>Project code *</span><input required maxLength={50} value={brief.code} onChange={event => setField('code', event.target.value)} disabled={Boolean(busy)} /></label>
            <label className="aps-field"><span>Project type *</span><select required value={brief.project_type} onChange={event => setField('project_type', event.target.value)} disabled={Boolean(busy)}>{options.project_types.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
            <label className="aps-field"><span>Department</span><input maxLength={120} value={brief.department} onChange={event => setField('department', event.target.value)} placeholder="For example, IT or Human Resources" disabled={Boolean(busy)} /></label>
            <label className="aps-field"><span>Project start date *</span><input type="date" required value={brief.start_date} onChange={event => setField('start_date', event.target.value)} disabled={Boolean(busy)} /></label>
            <label className="aps-field"><span>Project end date *</span><input type="date" required min={brief.start_date || undefined} value={brief.end_date} onChange={event => setField('end_date', event.target.value)} disabled={Boolean(busy)} /></label>
            <label className="aps-field"><span>Phase *</span><input required maxLength={100} value={brief.phase} onChange={event => setField('phase', event.target.value)} disabled={Boolean(busy)} /></label>
            <EmployeeSelect label="Project manager" required employees={employees} value={brief.project_manager_id} onChange={value => setField('project_manager_id', value)} disabled={Boolean(busy)} />
          </div>
          <fieldset className="aps-team"><legend><Users size={17} aria-hidden="true" /> Team members <span>{brief.team_member_ids.length} selected</span></legend><label className="aps-search"><Search size={16} aria-hidden="true" /><input aria-label="Search team members" value={teamSearch} onChange={event => setTeamSearch(event.target.value)} placeholder="Search name, department or email" disabled={Boolean(busy)} /></label><div className="aps-team-list">{filteredTeam.map(person => <label key={personId(person)}><input type="checkbox" checked={brief.team_member_ids.includes(Number(personId(person)))} onChange={() => toggleTeam(Number(personId(person)))} disabled={Boolean(busy)} /><span>{person.name}<small>{person.department || person.email}</small></span></label>)}{!filteredTeam.length && <p>No employees match your search.</p>}</div></fieldset>
          {!options.ai_available && <div className="aps-notice" role="status">{options.ai_message || 'Add and test your API key above to generate with AI, or use a standard planning template.'}</div>}
        </>}
        {preview && plan && <>
          <div className="aps-preview-heading"><div><h3>{plan.project.code} · {plan.project.name}</h3><p>{plan.project.start_date} → {plan.project.end_date} · {plan.project.phase}</p></div><span className={`aps-source${isTemplate ? ' aps-template' : ''}`}>{isTemplate ? 'Standard template · not AI generated' : 'AI draft · review required'}</span></div>
          <div className="aps-metrics"><span><ClipboardList size={18} aria-hidden="true" /><strong>{plan.tasks.length}</strong> tasks</span><span><CalendarDays size={18} aria-hidden="true" /><strong>{plannedHours}</strong> estimated hours</span><span><Users size={18} aria-hidden="true" /><strong>{plan.tasks.filter(task => task.assignee_id).length}</strong> assigned</span></div>
          {warnings.length > 0 && <div className="aps-notice">{datesChanged && <p>Original preview notes. Dates have changed; review dependencies and capacity before creating.</p>}<ul>{warnings.map((warning, index) => <li key={index}>{noteText(warning)}</li>)}</ul></div>}
          {forecastFinish > plan.project.end_date && <div className="aps-notice" role="status">The draft task forecast finishes on {forecastFinish}, after the project target of {plan.project.end_date}. Review scope, dependencies and employee capacity.</div>}
          <section className="aps-section" aria-labelledby={`${id}-scope`}><h3 id={`${id}-scope`}>Scope</h3><div className="aps-grid"><label className="aps-field"><span>Scope summary</span><textarea rows={3} value={plan.project.scope_summary || ''} required disabled={Boolean(busy)} onChange={event => setPlan(current => ({ ...current, project: { ...current.project, scope_summary: event.target.value } }))} /></label><label className="aps-field"><span>Exclusions</span><textarea rows={3} value={plan.project.exclusions || ''} disabled={Boolean(busy)} onChange={event => setPlan(current => ({ ...current, project: { ...current.project, exclusions: event.target.value } }))} /></label></div></section>
          <section className="aps-section" aria-labelledby={`${id}-wbs`}><h3 id={`${id}-wbs`}>Work breakdown and schedule</h3><p className="aps-muted">Draft estimates use Monday–Friday working days. Review employee availability, dates and dependencies.</p><div className="aps-task-list">{plan.tasks.map((task, index) => <TaskPreview key={task.id || index} task={task} index={index} tasks={plan.tasks} disciplines={plan.disciplines || []} employees={employees.filter(person => [...brief.team_member_ids, brief.project_manager_id].map(String).includes(personId(person)))} startDate={plan.project.start_date} endDate={plan.project.end_date} busy={Boolean(busy)} onChange={(field, value) => updateTask(index, field, value)} />)}</div></section>
          {plan.milestones?.length > 0 && <section className="aps-section" aria-labelledby={`${id}-milestones`}><h3 id={`${id}-milestones`}>Milestones</h3>{plan.milestones.map((milestone, index) => <div className="aps-milestone" key={index}><label className="aps-field"><span>Milestone {index + 1}</span><input value={milestone.name || ''} required disabled={Boolean(busy)} onChange={event => setPlan(current => ({ ...current, milestones: current.milestones.map((item, position) => position === index ? { ...item, name: event.target.value } : item) }))} /></label><label className="aps-field"><span>Milestone {index + 1} target date</span><input type="date" required min={plan.project.start_date} max={plan.project.end_date} value={milestone.target_date || ''} disabled={Boolean(busy)} onChange={event => setPlan(current => ({ ...current, milestones: current.milestones.map((item, position) => position === index ? { ...item, target_date: event.target.value } : item) }))} /></label></div>)}</section>}
          <div className="aps-grid">{[['Assumptions', plan.assumptions], ['Risks to review', plan.risks]].filter(([, notes]) => notes?.length).map(([title, notes]) => <section className="aps-section" key={title}><h3>{title}</h3><ul>{notes.map((note, index) => <li key={index}>{noteText(note)}</li>)}</ul></section>)}</div>
          <p className="aps-create-note"><CheckCircle2 size={18} aria-hidden="true" /> Create the project, draft plan, schedule and employee tasks together. Assigned work appears immediately in My Work.</p>
        </>}
      </div>
    </form>
    <footer className="aps-footer"><button type="button" className="aps-button" disabled={Boolean(busy)} onClick={preview ? () => { setPreview(null); setPlan(null); setError('') } : close}>{preview ? <><ArrowLeft size={16} aria-hidden="true" /> Edit project details</> : 'Cancel'}</button><div className="aps-footer-actions">{preview ? <button type="submit" form={`${id}-form`} className="aps-button aps-primary" disabled={Boolean(busy)}>{busy === 'create' ? <><Loader2 size={17} className="aps-spin" aria-hidden="true" /> Creating project…</> : <>Create project &amp; plan <ArrowRight size={17} aria-hidden="true" /></>}</button> : <><button type="submit" form={`${id}-form`} value="template" className="aps-button" disabled={Boolean(busy) || loading || !options || Boolean(optionsError)}>{busy === 'preview' ? 'Preparing preview…' : 'Use standard template'}</button><button type="submit" form={`${id}-form`} value="ai" className="aps-button aps-primary" disabled={Boolean(busy) || loading || !options?.ai_available || connectionDirty || Boolean(optionsError)}>{busy === 'preview' ? <Loader2 size={17} className="aps-spin" aria-hidden="true" /> : <Sparkles size={17} aria-hidden="true" />} Generate plan preview</button></>}</div></footer>
  </dialog>
}
