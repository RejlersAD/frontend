import { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { AlertTriangle, FileText, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { planningIntelligenceService as service } from '../../services/planningIntelligence.service'
import PlanningContextDrawer from './PlanningContextDrawer'
import PlanningFieldProvenance, { factProvenance } from './PlanningFieldProvenance'
import './PlanningBuildDrawer.css'

const list = value => Array.isArray(value) ? value : []
const text = value => value == null || value === '' ? 'Not Specified' : typeof value === 'object' ? JSON.stringify(value) : String(value)
const label = value => text(value).replaceAll('_', ' ')
const quantity = value => value == null ? 'Not Specified' : typeof value === 'object' ? `${text(value.value)} ${label(value.unit)}` : text(value)
const errorText = error => {
  const data = error.response?.data
  return typeof data?.error === 'string' ? data.error : typeof data?.detail === 'string' ? data.detail : data ? JSON.stringify(data) : error.message || 'The planning build could not be loaded.'
}

function Lineage({ value, onEvidence }) {
  if (!value || !Object.keys(value).length) return <PlanningFieldProvenance />
  return <details className="pbd-lineage"><summary>Planning basis</summary>{Object.entries(value).map(([property, origin]) => <div key={property}><strong>{label(property)}</strong><PlanningFieldProvenance provenance={{ ...origin, type: factProvenance({ provenance_type: origin.type }).type }} />{list(origin.fact_ids).map(id => <button type="button" className="pbd-link" key={id} onClick={() => onEvidence?.(id)}>Review source {id}</button>)}</div>)}</details>
}
Lineage.propTypes = { value: PropTypes.object, onEvidence: PropTypes.func }

function BuildPreview({ build, onEvidence }) {
  const [tab, setTab] = useState('activities')
  const plan = build.plan || {}
  const names = new Map(list(plan.activities).map(activity => [String(activity.id), activity.name || activity.title || activity.id]))
  const categories = [['activities', 'Activities'], ['wbs', 'WBS'], ['relationships', 'Logic'], ['resources', 'Resources'], ['risks', 'Risks'], ['project_inputs', 'Project inputs']]
  const rows = list(plan[tab])
  return <section className="pbd-preview" aria-label="Generated plan preview">
    <div className="pbd-summary">{Object.entries(build.summary || {}).filter(([, value]) => typeof value !== 'object').map(([key, value]) => <span key={key}><strong>{text(value)}</strong> {label(key)}</span>)}</div>
    <p>Review the proposed plan. Applying creates a schedule draft; calculation and baseline approval are separate.</p>
    <div className="pbd-tabs" role="tablist" aria-label="Generated plan content">{categories.map(([key, name], index) => <button key={key} type="button" role="tab" aria-selected={tab === key} tabIndex={tab === key ? 0 : -1} onKeyDown={event => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? categories.length - 1 : (index + (event.key === 'ArrowLeft' ? -1 : 1) + categories.length) % categories.length; setTab(categories[next][0]); event.currentTarget.parentElement.querySelectorAll('[role=tab]')[next].focus() }} aria-controls={`build-preview-${build.id}`} onClick={() => setTab(key)}>{name}{Array.isArray(plan[key]) ? ` (${plan[key].length})` : ''}</button>)}</div>
    <div id={`build-preview-${build.id}`} role="tabpanel" aria-label={categories.find(([key]) => key === tab)?.[1]}>
      {tab === 'project_inputs' ? <dl className="pbd-values">{Object.entries(plan.project_inputs || {}).map(([key, value]) => <div key={key}><dt>{label(key)}</dt><dd>{text(value)}</dd></div>)}</dl>
        : <div className="pbd-table"><table><thead><tr>{(tab === 'activities' ? ['Activity', 'Duration', 'Role', 'Dates', 'Basis'] : tab === 'wbs' ? ['WBS', 'Name', 'Parent', 'Basis'] : tab === 'relationships' ? ['Predecessor', 'Successor', 'Relationship', 'Lag', 'Basis'] : ['Requirement / finding', 'Details', 'Basis']).map(heading => <th scope="col" key={heading}>{heading}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id || index}>
          {tab === 'activities' ? <><td><strong>{text(row.name || row.title)}</strong><small>{text(row.workflow_stage_code || row.activity_type)}</small><small>{text(row.id)}</small><details><summary>Activity inputs</summary><dl className="pbd-values">{['activity_type', 'calendar', 'constraints', 'progress_weight'].map(field => <div key={field}><dt>{label(field)}</dt><dd>{text(row[field])}</dd></div>)}</dl></details></td><td>{quantity(row.duration)}</td><td>{text(row.responsible_role)}</td><td>{text(row.start_date)}<br />{text(row.finish_date)}</td></>
            : tab === 'wbs' ? <><td>{text(row.code || row.id)}</td><td>{text(row.name)}</td><td>{text(row.parent_id)}</td></>
              : tab === 'relationships' ? <><td>{text(names.get(String(row.predecessor_id)) || row.predecessor_id)}</td><td>{text(names.get(String(row.successor_id)) || row.successor_id)}</td><td>{text(row.type || row.relationship_type)}</td><td>{typeof row.lag === 'object' ? quantity(row.lag) : `${text(row.lag)} ${label(row.lag_unit)}`}</td></>
                : <><td>{text(row.name || row.title || row.role || row.description || row.id)}</td><td><dl className="pbd-values">{Object.entries(row).filter(([key]) => !['id', 'name', 'title', 'property_lineage', 'provenance', 'source_references', 'lineage'].includes(key)).map(([key, value]) => <div key={key}><dt>{label(key)}</dt><dd>{text(value)}</dd></div>)}</dl></td></>}
          <td><Lineage value={row.property_lineage || (row.lineage ? { [row.lineage.property || tab]: row.lineage } : null)} onEvidence={onEvidence} />{row.provenance && <PlanningFieldProvenance provenance={row.provenance} />}</td>
        </tr>)}{!rows.length && <tr><td colSpan={5}>No {label(tab)} reported in this preview.</td></tr>}</tbody></table></div>}
    </div>
    <section aria-label="Plan generation issues"><h3>Review findings</h3>{list(build.issues).length ? <ul className="pbd-issues">{build.issues.map((issue, index) => <li key={issue.id || index}><AlertTriangle size={15} /><div><strong>{text(issue.message)}</strong><small>{label(issue.severity)}{issue.field ? ` · ${label(issue.field)}` : ''}{issue.entity_id ? ` · ${issue.entity_id}` : ''}</small>{list(issue.blocks).length > 0 && <small>Blocks: {issue.blocks.map(label).join(', ')}</small>}</div></li>)}</ul> : <p>No generation issues reported. Schedule validation remains required.</p>}</section>
  </section>
}
BuildPreview.propTypes = { build: PropTypes.object.isRequired, onEvidence: PropTypes.func }

export default function PlanningBuildDrawer({ projectId, readOnly = false, onClose, onApplied, onEvidence, onProfile }) {
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [reload, setReload] = useState(0), [build, setBuild] = useState(null)
  const [deliverables, setDeliverables] = useState([]), [activities, setActivities] = useState([]), [independent, setIndependent] = useState([]), [bindings, setBindings] = useState({}), [reason, setReason] = useState('')
  const alive = useRef(true), inFlight = useRef(false)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(''); setBuild(null)
    service.listPlanningBuilds(projectId, controller.signal).then(result => { if (!controller.signal.aborted) setData(result) }).catch(caught => { if (!controller.signal.aborted) setError(errorText(caught)) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [projectId, reload])
  const options = data?.options || {}, permissions = data?.permissions || {}
  const selectedIds = [...deliverables, ...activities]
  const selectedEntities = list(options.deliverables).filter(item => selectedIds.includes(item.entity_id))
  const endpointCodes = [...new Set(list(options.dependency_rules).flatMap(rule => [(rule.value || rule).predecessor_code, (rule.value || rule).successor_code]).filter(Boolean))]
  const profileReady = options.profile?.valid === true
  const locked = readOnly || loading || busy
  const select = (setter, values, id, checked) => { setter(checked ? [...values, id] : values.filter(value => value !== id)); setIndependent(current => current.filter(value => value !== id)); if (!checked) setBindings(current => Object.fromEntries(Object.entries(current).filter(([, value]) => value !== id))); setBuild(null) }
  const request = async (action, success) => {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setError('')
    try { const result = await action(); if (alive.current) success(result) } catch (caught) { if (alive.current) setError(errorText(caught)) }
    finally { inFlight.current = false; if (alive.current) setBusy(false) }
  }
  const preview = event => {
    event.preventDefault()
    if (locked || !profileReady || permissions.can_preview !== true || !selectedIds.length || !reason.trim()) return
    request(() => service.previewPlanningBuild(projectId, { evidence_revision: options.evidence_revision ?? options.graph_revision, profile_selection_revision: options.profile_selection_revision, options: { deliverable_entity_ids: deliverables, source_activity_entity_ids: activities, dependency_bindings: bindings, independent_entity_ids: independent.filter(id => selectedIds.includes(id)) }, reason: reason.trim() }), result => setBuild(result.build || result))
  }
  const apply = () => {
    if (locked || !reason.trim() || permissions.can_apply !== true || build?.ready_to_apply !== true) return
    request(() => service.applyPlanningBuild(projectId, build.id, { fingerprint: build.fingerprint, master_revision: data.master_revision ?? options.master_revision, reason: reason.trim() }), result => onApplied?.(result))
  }
  return <PlanningContextDrawer title="Generate project plan" busy={busy} onClose={onClose}><section className="planning-build-drawer" aria-label="Project plan generation" aria-busy={loading || busy}>
    <p>Choose accepted document scope and the approved planning profile. Review every generated activity and relationship before applying the draft.</p>
    {onEvidence && <button type="button" className="pbd-link" disabled={busy} onClick={() => onEvidence()}>Review source evidence</button>}
    {error && <div className="pbd-message is-error" role="alert"><AlertTriangle size={16} /><span>{error}</span><button type="button" disabled={busy} onClick={() => setReload(value => value + 1)}>Reload build inputs</button></div>}
    {loading ? <p role="status"><Loader2 size={16} className="animate-spin" />Loading accepted scope and approved profile…</p> : data && <>
      <div className="pbd-profile"><strong>Approved profile</strong><span>{text(options.profile?.name)}{(options.profile?.profile_version ?? options.profile?.version) != null && ` · Version ${options.profile.profile_version ?? options.profile.version}`}</span>{onProfile && <button type="button" disabled={busy} onClick={onProfile}>Review profile</button>}</div>
      {!profileReady && <p className="pbd-message">Select a valid approved planning profile before generating a plan.</p>}
      <p className="pbd-note">Evidence revision {text(options.graph_revision)} · Profile selection revision {text(options.profile_selection_revision)}</p>
      {readOnly && <p className="pbd-message">This saved schedule view is read only. Open the current Master Schedule to generate a draft.</p>}
      <form aria-label="Plan generation scope" onSubmit={preview}><fieldset disabled={locked}>
        {[['Deliverables', options.deliverables, deliverables, setDeliverables], ['Source activities', options.source_activities, activities, setActivities]].map(([name, items, selected, setter]) => <fieldset key={name}><legend>{name}</legend>{list(items).length ? list(items).map(item => <div className="pbd-source" key={item.entity_id}><label><input type="checkbox" checked={selected.includes(item.entity_id)} onChange={event => select(setter, selected, item.entity_id, event.target.checked)} /><span>{item.name || item.entity_id}<small>{item.entity_id}</small></span></label>{item.fact_id && onEvidence && <button type="button" className="pbd-link" onClick={() => onEvidence(item.fact_id)}><FileText size={14} />Evidence</button>}</div>) : <p>No accepted {name.toLowerCase()} are available.</p>}</fieldset>)}
        {endpointCodes.length > 0 && <details><summary>Approved dependency rule bindings</summary><p>Match each exact rule endpoint to a selected deliverable. Missing or ambiguous bindings remain unresolved.</p>{list(options.dependency_rules).map(rule => { const value = rule.value || rule; return <p key={rule.id || JSON.stringify(value)}>{text(value.predecessor_code)} / {text(value.predecessor_stage_code)} → {text(value.successor_code)} / {text(value.successor_stage_code)} · {text(value.relationship_type)} · Lag {quantity(value.lag)}</p> })}{endpointCodes.map(code => <label key={code}>Rule endpoint {code}<select aria-label={`Rule endpoint ${code}`} value={bindings[code] || ''} onChange={event => { const value = event.target.value; setBindings(current => { const next = { ...current }; if (value) next[code] = value; else delete next[code]; return next }); setBuild(null) }}><option value="">Not Specified</option>{list(options.deliverables).filter(item => deliverables.includes(item.entity_id)).map(item => <option key={item.entity_id} value={item.entity_id}>{item.name || item.entity_id}</option>)}</select></label>)}</details>}
        {selectedEntities.length > 0 && <details><summary>Confirm independent starting work</summary><p>Select only work that has no external predecessor in the reviewed project logic.</p>{selectedEntities.map(item => <label className="pbd-checkbox" key={item.entity_id}><input type="checkbox" checked={independent.includes(item.entity_id)} onChange={event => { setIndependent(current => event.target.checked ? [...current, item.entity_id] : current.filter(id => id !== item.entity_id)); setBuild(null) }} />{item.name || item.entity_id} has no external predecessor</label>)}</details>}
        <label>Planning reason<textarea aria-label="Planning reason" required maxLength={4000} value={reason} onChange={event => setReason(event.target.value)} /></label>
      </fieldset><div className="pbd-actions"><button type="submit" className="pbd-primary" disabled={locked || !profileReady || permissions.can_preview !== true || !selectedIds.length || !reason.trim()}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}Preview generated plan</button><button type="button" disabled={busy} onClick={() => setReload(value => value + 1)}><RefreshCw size={15} />Refresh inputs</button></div></form>
      {list(data.builds).length > 0 && <label>Previous previews<select aria-label="Previous planning builds" disabled={busy} value={build?.id || ''} onChange={event => { const id = event.target.value; if (id) { setReason(''); request(() => service.getPlanningBuild(projectId, id), result => setBuild(result.build || result)) } else setBuild(null) }}><option value="">Select a preview</option>{data.builds.map(item => <option key={item.id} value={item.id}>{item.id} · {label(item.status)} · {text(item.created_at)}</option>)}</select></label>}
      {build && <><BuildPreview build={build} onEvidence={onEvidence} /><div className="pbd-actions"><button type="button" className="pbd-primary" disabled={locked || !reason.trim() || permissions.can_apply !== true || build.ready_to_apply !== true || (data.master_revision ?? options.master_revision) == null} onClick={apply}>Apply reviewed plan</button><span>{build.ready_to_apply === true ? 'Opens the generated draft in this Master Schedule.' : 'Resolve the reported generation issues before applying.'}</span></div></>}
    </>}
  </section></PlanningContextDrawer>
}
PlanningBuildDrawer.propTypes = { projectId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired, readOnly: PropTypes.bool, onClose: PropTypes.func.isRequired, onApplied: PropTypes.func.isRequired, onEvidence: PropTypes.func, onProfile: PropTypes.func }
