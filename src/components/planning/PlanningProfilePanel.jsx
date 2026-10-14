import { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { AlertTriangle, CheckCircle2, Loader2, Plus, RefreshCw, ShieldCheck } from 'lucide-react'
import { planningIntelligenceService as service } from '../../services/planningIntelligence.service'
import PlanningContextDrawer from './PlanningContextDrawer'
import PlanningProfileCalendar, { emptyProfileCalendar } from './PlanningProfileCalendar'
import './PlanningProfilePanel.css'

const rows = value => Array.isArray(value) ? value : []
const label = value => String(value || '').replaceAll('_', ' ')
const display = value => value == null || value === '' || value === 'not_specified' ? 'Not Specified' : Array.isArray(value) ? value.length ? value.map(display).join(', ') : 'Not Specified' : typeof value === 'object' ? Object.entries(value).map(([key, item]) => `${label(key)}: ${display(item)}`).join('; ') : String(value)
const errorText = error => {
  const data = error.response?.data
  if (typeof data?.error === 'string' || typeof data?.detail === 'string') return data.error || data.detail
  return data && typeof data === 'object' ? Object.entries(data).filter(([key]) => key !== 'code').map(([key, value]) => `${label(key)}: ${display(value)}`).join(' ') : error.message || 'Planning profiles could not be loaded.'
}
const emptyDraft = () => ({ code: '', name: '', workflow_template_id: '', dependency_template_id: '', final_gate_label: '', approved_dependency_rule_ids: [], levels: '', calendar_mode: 'not_specified', calendar_id: '', progress_mode: 'not_specified', resource_mode: 'not_specified', stage_duration_overrides: {}, calendar: emptyProfileCalendar() })
const profileDraft = profile => {
  const definition = profile.definition?.configuration || {}
  return { ...emptyDraft(), code: profile.code, name: profile.name,
    workflow_template_id: definition.workflow_template_id ?? '', dependency_template_id: definition.dependency_template_id ?? '',
    final_gate_label: definition.final_gate_label || '', approved_dependency_rule_ids: rows(definition.approved_dependency_rule_ids),
    levels: rows(definition.wbs_convention?.levels).join(', '), calendar_mode: definition.calendar_policy?.mode || 'not_specified',
    calendar_id: definition.calendar_policy?.calendar_id ?? '', calendar: structuredClone(definition.calendar_policy?.calendar || emptyProfileCalendar()), progress_mode: definition.progress_policy?.mode || 'not_specified',
    resource_mode: definition.resource_policy?.mode || 'not_specified', stage_duration_overrides: structuredClone(definition.stage_duration_overrides || {}), original_configuration: definition }
}
const actionNames = { propose: 'Submit profile for review', approve: 'Approve profile version', reject: 'Reject profile version', revise: 'Create revised draft', select: 'Use approved profile' }
const allowedLevels = ['project', 'phase', 'area', 'package', 'discipline', 'deliverable', 'workflow_stage']
const durationUnits = { working_days: 'Working days', calendar_days: 'Calendar days', hours: 'Hours' }

function WorkflowStages({ stages, overrides = {}, onChange }) {
  return <div className="ppf-stage-table"><table><caption>Workflow stage durations</caption><thead><tr><th scope="col">Stage</th><th scope="col">Duration</th><th scope="col">Unit</th><th scope="col">Role</th></tr></thead><tbody>{rows(stages).map(stage => {
    const quantity = overrides[stage.code] || stage.duration || {}
    return <tr key={stage.code}><th scope="row">{stage.name || stage.code}{Object.hasOwn(overrides, stage.code) && <small>Profile override</small>}</th>
      <td>{onChange ? <input aria-label={`${stage.code} duration`} type="number" required min={['start_milestone', 'finish_milestone'].includes(stage.activity_type) ? 0 : 0.000001} step="any" value={quantity.value ?? ''} onChange={event => onChange(stage.code, { ...quantity, value: event.target.value })} /> : display(quantity.value)}</td>
      <td>{onChange ? <select aria-label={`${stage.code} duration unit`} required value={quantity.unit || ''} onChange={event => onChange(stage.code, { ...quantity, unit: event.target.value })}><option value="">Not Specified</option>{Object.entries(durationUnits).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select> : durationUnits[quantity.unit] || display(quantity.unit)}</td>
      <td>{display(stage.role)}</td></tr>
  })}</tbody></table></div>
}
WorkflowStages.propTypes = { stages: PropTypes.array, overrides: PropTypes.object, onChange: PropTypes.func }


function ProfileDefinition({ profile }) {
  const definition = profile.approved_snapshot?.definition || profile.definition || {}
  const configuration = definition.configuration || {}
  return <section className="ppf-definition" aria-label="Profile version details"><div className="ppf-heading"><h3>{profile.name}</h3><span className={`ppf-status is-${profile.status}`}>{label(profile.status)} · Version {profile.version}</span></div>
    <dl><div><dt>Workflow template</dt><dd>{display(definition.workflow?.name || definition.workflow?.code || configuration.workflow_template_id)}</dd></div>
      <div><dt>Final gate label</dt><dd>{display(configuration.final_gate_label)}</dd></div>
      <div><dt>WBS levels</dt><dd>{display(definition.wbs_convention?.levels)}</dd></div>
      <div><dt>Calendar policy</dt><dd>{display(definition.calendar_policy)}</dd></div>
      <div><dt>Progress policy</dt><dd>{display(definition.progress_policy)}</dd></div>
      <div><dt>Resource policy</dt><dd>{display(definition.resource_policy)}</dd></div></dl>
    <details><summary>Workflow stages and selected dependency rules</summary>
      {rows(definition.workflow?.stages).length ? <WorkflowStages stages={definition.workflow.stages} overrides={configuration.stage_duration_overrides} /> : <p>Stage details are not included in this version response.</p>}
      <details><summary>Stage relationships and progress weights</summary><ol>{rows(definition.workflow?.stages).map(stage => <li key={stage.code}>{stage.name || stage.code}: {display({ relationship_to_previous: stage.relationship_to_previous, lag_days: stage.lag_days, progress_weight: stage.progress_weight })}</li>)}</ol></details>
      <h4>Selected dependency rules</h4>{rows(configuration.approved_dependency_rule_ids).length ? <ul>{rows(configuration.approved_dependency_rule_ids).map(id => <li key={id}>{display(rows(definition.dependency_template?.rules || definition.dependency_rules).find(rule => String(rule.id) === String(id)) || id)}</li>)}</ul> : <p>Not Specified</p>}
    </details>
    <p className="ppf-note">These are planning rules. Source document values remain separately identified.</p>
    {profile.content_fingerprint && <details><summary>Version identity and approval</summary><p>Revision {profile.revision}</p><p>Fingerprint: {profile.content_fingerprint}</p><p>Approved by: {display(profile.approved_by_id)}</p></details>}
  </section>
}
ProfileDefinition.propTypes = { profile: PropTypes.object.isRequired }

export default function PlanningProfilePanel({ projectId, readOnly = false, onClose, onChanged }) {
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false)
  const [selectedId, setSelectedId] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState(''), [reload, setReload] = useState(0)
  const [editing, setEditing] = useState(null), [draft, setDraft] = useState(emptyDraft), [action, setAction] = useState(''), [reason, setReason] = useState('')
  const inFlight = useRef(false), alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    service.getPlanningProfiles(projectId, controller.signal).then(result => {
      if (controller.signal.aborted) return
      setData(result); setSelectedId(current => rows(result.profiles).some(item => String(item.id) === current) ? current : result.selection?.profile_id == null ? '' : String(result.selection.profile_id))
    }).catch(caught => { if (!controller.signal.aborted) setError(errorText(caught)) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [projectId, reload])
  const profiles = rows(data?.profiles), profile = profiles.find(item => String(item.id) === selectedId)
  const locked = readOnly || loading || busy
  const options = data?.options || {}, workflows = rows(options.workflow_templates), dependencies = rows(options.dependency_templates)
  const selectedDependency = dependencies.find(item => String(item.id) === String(draft.dependency_template_id))
  const selectedWorkflow = workflows.find(item => String(item.id) === String(draft.workflow_template_id))
  const change = key => event => setDraft(current => ({ ...current, [key]: event.target.value, ...(key === 'dependency_template_id' ? { approved_dependency_rule_ids: [] } : {}), ...(key === 'workflow_template_id' ? { stage_duration_overrides: {}, overrides_changed: Boolean(current.original_configuration) } : {}) }))
  const begin = next => { setAction(next); setReason(''); setError(''); setNotice('') }
  const mutate = async (request, success) => {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const result = await request()
      if (!alive.current) return
      setData(result); if (result.profile?.id != null) setSelectedId(String(result.profile.id))
      setEditing(null); setAction(''); setReason(''); setNotice(success); onChanged?.(result)
    } catch (caught) { if (alive.current) setError(errorText(caught)) }
    finally { inFlight.current = false; if (alive.current) setBusy(false) }
  }
  const save = event => {
    event.preventDefault()
    const levels = draft.levels.split(',').map(value => value.trim()).filter(Boolean)
    if (levels.some(level => !allowedLevels.includes(level)) || new Set(levels).size !== levels.length) { setError('Use distinct WBS levels from the listed choices, separated by commas.'); return }
    const payload = { name: draft.name.trim(), workflow_template_id: Number(draft.workflow_template_id), dependency_template_id: draft.dependency_template_id ? Number(draft.dependency_template_id) : null,
      ...(draft.overrides_changed || Object.keys(draft.stage_duration_overrides).length ? { stage_duration_overrides: Object.fromEntries(Object.entries(draft.stage_duration_overrides).map(([code, quantity]) => [code, { value: Number(quantity.value), unit: quantity.unit }])) } : {}),
      final_gate_label: draft.final_gate_label.trim(), approved_dependency_rule_ids: draft.approved_dependency_rule_ids,
      wbs_convention: { ...(draft.original_configuration?.wbs_convention || {}), levels }, calendar_policy: draft.calendar_mode === 'explicit' ? { mode: 'explicit', calendar: draft.calendar } : { mode: draft.calendar_mode, ...(draft.calendar_mode === 'project_calendar' ? { calendar_id: Number(draft.calendar_id) } : {}) },
      progress_policy: draft.progress_mode === 'explicit_weights' ? draft.original_configuration.progress_policy : { mode: draft.progress_mode }, resource_policy: draft.resource_mode === 'explicit_roles' ? draft.original_configuration.resource_policy : { mode: draft.resource_mode } }
    mutate(() => editing === 'new' ? service.createPlanningProfile(projectId, { ...payload, code: draft.code.trim() }) : service.updatePlanningProfile(projectId, editing.id, { ...payload, revision: editing.revision }), 'Profile draft saved. Submit it for review before selection.')
  }
  const decide = event => {
    event.preventDefault()
    if (!reason.trim() || !profile) return
    mutate(() => action === 'select'
      ? service.selectPlanningProfile(projectId, { profile_id: profile.id, selection_revision: data.selection.revision, reason: reason.trim() })
      : service.actOnPlanningProfile(projectId, profile.id, action, { revision: profile.revision, reason: reason.trim() }),
    action === 'select' ? 'Approved profile selected. Review its rules before applying them to a schedule.' : action === 'approve' ? 'Profile version approved. Schedule approval remains separate.' : action === 'revise' ? 'A revised profile draft is available.' : action === 'reject' ? 'Profile version rejected.' : 'Profile version submitted for review.')
  }
  return <PlanningContextDrawer title="Planning profile" busy={busy} onClose={onClose}><section className="planning-profile-panel" aria-label="Project planning profiles" aria-busy={busy || loading}>
    <p>Choose a reviewed workflow and planning policy for this project. Profile versions are approved separately from schedules.</p>
    {readOnly && <p className="ppf-message"><ShieldCheck size={16} />Profile selection is read only for this schedule view.</p>}
    {error && <div className="ppf-message is-error" role="alert"><AlertTriangle size={16} /><span>{error}</span><button type="button" disabled={busy} onClick={() => { setEditing(null); setAction(''); setReload(value => value + 1) }}>Reload profiles</button></div>}
    {notice && <p className="ppf-message is-success" role="status"><CheckCircle2 size={16} />{notice}</p>}
    {loading ? <p role="status"><Loader2 size={17} className="animate-spin" />Loading planning profiles…</p> : data && <>
      <div className="ppf-current"><strong>Project selection</strong><span>{profiles.find(item => item.id === data.selection?.profile_id)?.name || data.selection?.snapshot?.name || 'Not Specified'}{data.selection?.profile_version != null && ` · Version ${data.selection.profile_version}`}</span></div>
      {data.selection?.profile_id != null && data.selection.valid === false && <p className="ppf-message is-error">The selected profile needs review. Select a valid approved version before using its rules.</p>}
      <div className="ppf-tools"><label>Profile version<select aria-label="Profile version" value={selectedId} disabled={busy || Boolean(editing)} onChange={event => { setSelectedId(event.target.value); setAction(''); setError('') }}><option value="">Select a profile version</option>{profiles.map(item => <option key={item.id} value={item.id}>{item.name} · v{item.version} · {label(item.status)}</option>)}</select></label><button type="button" aria-label="Refresh planning profiles" disabled={busy} onClick={() => setReload(value => value + 1)}><RefreshCw size={16} /></button></div>
      {!profiles.length && <p>No planning profiles are available for this project.</p>}
      {!editing && !readOnly && data.permissions?.can_create && <button type="button" disabled={busy} onClick={() => { setEditing('new'); setDraft(emptyDraft()); setAction(''); setError('') }}><Plus size={16} />New profile draft</button>}
      {profile && !editing && <><ProfileDefinition profile={profile} /><div className="ppf-actions">
        {!readOnly && profile.permissions?.can_edit && <button type="button" disabled={locked} onClick={() => { setEditing(profile); setDraft(profileDraft(profile)); setAction('') }}>Edit profile draft</button>}
        {!readOnly && Object.entries(actionNames).filter(([key]) => key !== 'select' && profile.permissions?.[`can_${key}`]).map(([key, name]) => <button key={key} type="button" disabled={locked} onClick={() => begin(key)}>{name}</button>)}
        {!readOnly && profile.status === 'approved' && data.permissions?.can_select && <button type="button" className="ppf-primary" disabled={locked || data.selection?.valid && data.selection.profile_id === profile.id} onClick={() => begin('select')}>Use approved profile</button>}
      </div></>}
      {editing && <form className="ppf-form" aria-label="Planning profile draft" onSubmit={save}><h3>{editing === 'new' ? 'New profile draft' : 'Edit profile draft'}</h3><fieldset disabled={busy}>
        <div className="ppf-fields"><label>Profile code<input required value={draft.code} disabled={editing !== 'new'} onChange={change('code')} maxLength={80} /></label><label>Profile name<input required value={draft.name} onChange={change('name')} maxLength={200} /></label></div>
        <label>Workflow template<select aria-label="Workflow template" required value={draft.workflow_template_id} onChange={change('workflow_template_id')}><option value="">Choose a workflow template</option>{workflows.map(item => <option key={item.id} value={item.id}>{item.name} · v{item.version}</option>)}</select></label>
        {selectedWorkflow && <><WorkflowStages stages={selectedWorkflow.stages} overrides={draft.stage_duration_overrides} onChange={(code, quantity) => setDraft(current => ({ ...current, overrides_changed: true, stage_duration_overrides: { ...current.stage_duration_overrides, [code]: quantity } }))} /><p className="ppf-note">Values come from the selected workflow. Edits become profile rules after review and approval.</p></>}
        <label>Final gate label<input required value={draft.final_gate_label} onChange={change('final_gate_label')} placeholder="Not Specified" /></label>
        <label>Dependency template<select aria-label="Dependency template" value={draft.dependency_template_id} onChange={change('dependency_template_id')}><option value="">Not Specified</option>{dependencies.map(item => <option key={item.id} value={item.id}>{item.name} · v{item.version}</option>)}</select></label>
        {selectedDependency && <fieldset className="ppf-rules"><legend>Select dependency rules to review</legend>{rows(selectedDependency.rules).map(rule => <label key={rule.id}><input type="checkbox" checked={draft.approved_dependency_rule_ids.some(id => String(id) === String(rule.id))} onChange={event => setDraft(current => ({ ...current, approved_dependency_rule_ids: event.target.checked ? [...current.approved_dependency_rule_ids, rule.id] : current.approved_dependency_rule_ids.filter(id => String(id) !== String(rule.id)) }))} /><span>{display(rule)}</span></label>)}{!rows(selectedDependency.rules).length && <p>No rules are available in this template.</p>}</fieldset>}
        <label>WBS levels<input aria-label="WBS levels" value={draft.levels} onChange={change('levels')} placeholder="Not Specified" /><small>Choose an order using: {allowedLevels.join(', ')}.</small></label>
        <label>Calendar policy<select aria-label="Calendar policy" value={draft.calendar_mode} onChange={change('calendar_mode')}><option value="not_specified">Not Specified</option><option value="project_calendar">Use a selected project calendar</option><option value="explicit">Enter an explicit calendar</option></select></label>
        {draft.calendar_mode === 'project_calendar' && <label>Project calendar<select aria-label="Project calendar" required value={draft.calendar_id} onChange={change('calendar_id')}><option value="">Choose a calendar</option>{rows(options.calendars).map(item => <option key={item.id} value={item.id}>{item.name || item.code}</option>)}</select></label>}
        {draft.calendar_mode === 'explicit' && <PlanningProfileCalendar value={draft.calendar} onChange={calendar => setDraft(current => ({ ...current, calendar }))} />}
        <label>Progress policy<select aria-label="Progress policy" value={draft.progress_mode} onChange={change('progress_mode')}><option value="not_specified">Not Specified</option><option value="workflow_weights">Use reviewed workflow weights</option>{draft.original_configuration?.progress_policy?.mode === 'explicit_weights' && <option value="explicit_weights">Retain explicit weights</option>}</select></label>
        <label>Resource policy<select aria-label="Resource policy" value={draft.resource_mode} onChange={change('resource_mode')}><option value="not_specified">Not Specified</option><option value="workflow_roles">Use reviewed workflow roles</option>{draft.original_configuration?.resource_policy?.mode === 'explicit_roles' && <option value="explicit_roles">Retain explicit roles</option>}</select></label>
      </fieldset><div className="ppf-actions"><button type="submit" className="ppf-primary" disabled={busy}>Save profile draft</button><button type="button" disabled={busy} onClick={() => setEditing(null)}>Cancel edit</button></div></form>}
      {action && profile && <form className="ppf-form" aria-label="Profile review decision" onSubmit={decide}><h3>{actionNames[action]}</h3><p>{profile.name} · Version {profile.version} · Revision {profile.revision}</p><label>Decision reason<textarea required maxLength={4000} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} /></label><div className="ppf-actions"><button type="submit" className="ppf-primary" disabled={busy || !reason.trim()}>{busy && <Loader2 size={15} className="animate-spin" />}Confirm {action === 'select' ? 'selection' : action}</button><button type="button" disabled={busy} onClick={() => setAction('')}>Cancel decision</button></div></form>}
    </>}
  </section></PlanningContextDrawer>
}
PlanningProfilePanel.propTypes = { projectId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired, readOnly: PropTypes.bool, onClose: PropTypes.func.isRequired, onChanged: PropTypes.func }
