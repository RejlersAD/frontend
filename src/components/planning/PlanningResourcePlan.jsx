import { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { Info, Link2, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { planningIntelligenceService as service } from '../../services/planningIntelligence.service'
import './PlanningResourcePlan.css'

const show = value => value == null || value === '' ? 'Not specified' : value
const resourceDraft = row => ({ code: row?.code || '', name: row?.name || '', resource_type: row?.resource_type || 'labor', unit: row?.unit || '', capacity_units_per_day: row?.capacity_units_per_day ?? '', productivity_rate: row?.productivity_rate ?? '', productivity_unit: row?.productivity_unit || '' })
const assignmentDraft = row => ({ activity: row?.activity || '', resource: row?.resource || '', planned_units: row?.planned_units ?? '', planned_output_quantity: row?.planned_output_quantity ?? '' })
const errorText = error => {
  const flatten = value => typeof value === 'string' ? value : Array.isArray(value) ? value.map(flatten).join(' ') : value && typeof value === 'object' ? Object.values(value).map(flatten).join(' ') : ''
  return flatten(error.response?.data) || error.message || 'The resource plan could not be saved.'
}

export default function PlanningResourcePlan({ projectId, versionId, readOnly = false, onChanged }) {
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false)
  const [reload, setReload] = useState(0), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [editing, setEditing] = useState(null), [draft, setDraft] = useState({})
  const pending = useRef(false), alive = useRef(true), formRef = useRef(null), launchRef = useRef(null)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(''); setData(null); setEditing(null)
    service.getResourcePlan(projectId, versionId, controller.signal).then(result => {
      if (!controller.signal.aborted) setData(result)
    }).catch(caught => { if (!controller.signal.aborted) setError(errorText(caught)) }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [projectId, versionId, reload])
  const canManage = !readOnly && data?.permissions?.can_manage_resources
  const canAllocate = !readOnly && data?.permissions?.can_allocate
  const resources = data?.resources || [], assignments = data?.assignments || [], activities = data?.activities || []
  const resource = resources.find(row => String(row.id) === String(draft.resource))
  const begin = (type, row = null) => { launchRef.current = document.activeElement; setEditing({ type, row }); setDraft(type === 'resource' ? resourceDraft(row) : assignmentDraft(row)); setError(''); setNotice('') }
  useEffect(() => {
    if (!editing) return
    formRef.current?.scrollIntoView({ block: 'nearest' })
    formRef.current?.querySelector('input:not(:disabled), select:not(:disabled)')?.focus({ preventScroll: true })
  }, [editing])
  const cancel = () => { setEditing(null); if (launchRef.current?.isConnected) launchRef.current.focus() }
  const inUse = id => assignments.some(item => String(item.resource) === String(id))
  const change = field => event => setDraft(current => ({ ...current, [field]: event.target.value }))
  const mutate = async (operation, message) => {
    if (pending.current) return
    pending.current = true; setBusy(true); setError(''); setNotice('')
    try {
      await operation()
      if (alive.current) { setEditing(null); setNotice(message); setReload(value => value + 1); onChanged?.() }
    } catch (caught) { if (alive.current) setError(errorText(caught)) }
    finally { pending.current = false; if (alive.current) setBusy(false) }
  }
  const save = event => {
    event.preventDefault()
    if (!editing || (editing.type === 'resource' ? !canManage : !canAllocate)) return
    if (editing.type === 'resource') {
      const payload = { ...draft, project: projectId, productivity_rate: draft.productivity_rate === '' ? null : draft.productivity_rate }
      mutate(() => editing.row ? service.updateResource(editing.row.id, payload) : service.createResource(payload), 'Resource saved. Review and recalculate affected schedules before approval.')
    } else {
      const payload = { ...draft, planned_output_quantity: draft.planned_output_quantity === '' ? null : draft.planned_output_quantity }
      mutate(() => editing.row ? service.updateAssignment(editing.row.id, payload) : service.createAssignment(payload), 'Allocation saved. Activity duration is unchanged; review capacity in Schedule assurance.')
    }
  }
  return <section className="planning-resource-plan" aria-label="Resource planning" aria-busy={loading || busy} data-table-typography="preserve">
    <header><div><h2>Labor, equipment &amp; materials</h2><p>Record resource units, daily capacity and output rates, then allocate them to schedule activities.</p></div>
      <div className="prp-actions prp-header-actions">
        {canManage && <button type="button" className="prp-primary" disabled={busy} onClick={() => begin('resource')}><Plus size={16} />Add resource</button>}
        {canAllocate && <button type="button" disabled={busy || !resources.length || !activities.length} onClick={() => begin('assignment')}><Link2 size={16} />Allocate resource</button>}
        <button type="button" disabled={busy || loading} onClick={() => setReload(value => value + 1)}><RefreshCw size={15} className={loading ? 'animate-spin' : undefined} />Refresh resources</button>
      </div>
    </header>
    {error && <p role="alert" className="prp-error">{error}</p>}{notice && <p role="status" className="prp-notice">{notice}</p>}
    {loading ? <p role="status">Loading resource plan…</p> : data && <>
      {data.basis === 'approved_baseline' && <p className="prp-notice">Resource inputs frozen in the approved baseline.</p>}{data.notice && <p className="prp-notice">{data.notice}</p>}
      {!versionId && <p>Create or select a schedule version to allocate resources to activities.</p>}
      {editing && <form ref={formRef} aria-label={editing.type === 'resource' ? 'Resource details' : 'Resource allocation'} onSubmit={save}><h3>{editing.row ? 'Edit' : 'New'} {editing.type === 'resource' ? 'resource' : 'allocation'}</h3><fieldset disabled={busy}>
        {editing.type === 'resource' ? <>
          <label>Resource code<input aria-label="Resource code" required maxLength={64} value={draft.code} onChange={change('code')} /></label><label>Resource name<input aria-label="Resource name" required maxLength={255} value={draft.name} onChange={change('name')} /></label>
          <label>Resource type<select aria-label="Resource type" value={draft.resource_type} onChange={change('resource_type')}><option value="labor">Labor</option><option value="equipment">Equipment</option><option value="material">Material</option></select></label>
          <label>Resource unit<input aria-label="Resource unit" required placeholder="hour, day, tonne…" maxLength={32} value={draft.unit} onChange={change('unit')} /></label>
          <label>Daily capacity<input aria-label="Daily capacity" required type="number" min="0" step="0.01" value={draft.capacity_units_per_day} onChange={change('capacity_units_per_day')} /></label>
          <label>Productivity rate<input aria-label="Productivity rate" type="number" min="0.0001" step="0.0001" required={Boolean(draft.productivity_unit)} value={draft.productivity_rate} onChange={change('productivity_rate')} /><small>Output quantity per one {draft.unit || 'resource unit'}</small></label>
          <label>Output unit<input aria-label="Output unit" maxLength={32} required={draft.productivity_rate !== ''} placeholder="m3, drawings…" value={draft.productivity_unit} onChange={change('productivity_unit')} /></label>
        </> : <>
          <label>Allocation activity<select aria-label="Allocation activity" required disabled={Boolean(editing.row)} value={draft.activity} onChange={change('activity')}><option value="">Select activity</option>{activities.map(row => <option key={row.id} value={row.id}>{row.external_id} · {row.name}</option>)}</select></label>
          <label>Allocation resource<select aria-label="Allocation resource" required disabled={Boolean(editing.row)} value={draft.resource} onChange={event => setDraft(current => ({ ...current, resource: event.target.value, planned_output_quantity: '' }))}><option value="">Select resource</option>{resources.map(row => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></label>
          <label>Planned resource units<input aria-label="Planned resource units" required type="number" min="0" step="0.01" value={draft.planned_units} onChange={change('planned_units')} /><small>{resource?.unit || 'Select a resource to see its unit'}</small></label>
          <label>Planned output quantity<input aria-label="Planned output quantity" type="number" min="0" step="0.001" disabled={!resource?.productivity_rate} value={draft.planned_output_quantity} onChange={change('planned_output_quantity')} /><small>{resource?.productivity_rate ? resource.productivity_unit : 'Add a productivity rate to this resource first.'}</small></label>

    </>}
      </fieldset><div className="prp-actions"><button type="submit" className="prp-primary" disabled={busy}>Save {editing.type === 'resource' ? 'resource' : 'allocation'}</button><button type="button" disabled={busy} onClick={cancel}>Cancel</button></div></form>}
          <div className="prp-table-wrap" role="region" aria-label="Project resource catalog table" tabIndex={0}><table className="prp-resource-table"><caption>Project resource catalog <span className="prp-count">{resources.length} resources</span></caption><thead><tr><th scope="col">Resource</th><th scope="col">Type</th><th scope="col">Unit</th><th scope="col">Capacity / working day</th><th scope="col">Productivity</th><th scope="col">Actions</th></tr></thead><tbody>{resources.map(row => <tr key={row.id}>
        <td><strong>{row.name}</strong><p className="prp-code">{row.code}</p></td>
        <td><span className="prp-resource-type" data-type={row.resource_type}>{row.resource_type}</span></td>
        <td>{show(row.unit)}</td><td>{show(row.capacity_units_per_day)}</td>
        <td>{row.productivity_rate == null ? <span className="prp-muted">Not specified</span> : `${row.productivity_rate} ${row.productivity_unit} / ${row.unit}`}</td>
        <td>{canManage && row.can_edit ? <><div className="prp-row-actions">
          <button type="button" aria-label={`Edit ${row.code}`} disabled={busy} onClick={() => begin('resource', row)}><Pencil size={14} />Edit</button>
          <button type="button" className="prp-delete" aria-label={`Delete ${row.code}`} title={inUse(row.id) ? 'Remove this resource allocation before deleting the resource.' : `Delete ${row.name}`} disabled={busy || inUse(row.id)} onClick={() => mutate(() => service.deleteResource(row.id), 'Resource removed from the catalog.')}><Trash2 size={14} />Delete</button>
        </div>{inUse(row.id) && <small className="prp-action-note">Allocated to activities</small>}</> : <span className="prp-muted">Read only</span>}</td>
      </tr>)}{!resources.length && <tr><td className="prp-empty" colSpan={6}>No resources recorded.</td></tr>}</tbody></table></div>
      <div className="prp-table-wrap" role="region" aria-label="Activity allocations table" tabIndex={0}><table className="prp-allocation-table"><caption>Activity allocations <span className="prp-count">{assignments.length} allocations</span></caption><thead><tr><th scope="col">Activity</th><th scope="col">Resource</th><th scope="col">Planned resource units</th><th scope="col">Planned output</th><th scope="col">Required resource units</th><th scope="col">Actions</th></tr></thead><tbody>{assignments.map(row => {
        const allocated = resources.find(item => String(item.id) === String(row.resource)), activity = activities.find(item => String(item.id) === String(row.activity))
        return <tr key={row.id}><td>{activity ? `${activity.external_id} · ${activity.name}` : `Activity ${row.activity}`}</td><td>{allocated?.name || `Resource ${row.resource}`}</td><td>{show(row.planned_units)} {allocated?.unit}</td><td>{row.planned_output_quantity == null ? 'Not specified' : `${row.planned_output_quantity} ${allocated?.productivity_unit || ''}`}</td><td>{row.required_units == null ? 'Not specified' : `${row.required_units} ${allocated?.unit || ''}`}</td><td>{canAllocate ? <div className="prp-row-actions"><button type="button" aria-label={`Edit allocation ${activity?.external_id || row.id}`} disabled={busy} onClick={() => begin('assignment', row)}><Pencil size={14} />Edit</button><button type="button" className="prp-delete" aria-label={`Remove allocation ${activity?.external_id || row.id}`} disabled={busy} onClick={() => mutate(() => service.deleteAssignment(row.id), 'Allocation removed.')}><Trash2 size={14} />Remove</button></div> : 'Read only'}</td></tr>
      })}{!assignments.length && <tr><td className="prp-empty" colSpan={6}>No allocations recorded for this version.</td></tr>}</tbody></table></div>
      <p className="prp-help"><Info size={14} />Required units = planned output ÷ productivity, rounded up to 0.01 unit. Rates do not change activity durations or planned allocations automatically.</p>
    </>}
  </section>
}
PlanningResourcePlan.propTypes = { projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired, versionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), readOnly: PropTypes.bool, onChanged: PropTypes.func }

