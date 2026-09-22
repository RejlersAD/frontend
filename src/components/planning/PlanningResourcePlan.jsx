import { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
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
  const pending = useRef(false), alive = useRef(true)
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
  const begin = (type, row = null) => { setEditing({ type, row }); setDraft(type === 'resource' ? resourceDraft(row) : assignmentDraft(row)); setError(''); setNotice('') }
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
  return <section className="planning-resource-plan" aria-label="Resource planning" aria-busy={loading || busy}>
    <header><div><h3>Labor, equipment &amp; materials</h3><p>Record resource units, daily capacity and output rates, then allocate them to schedule activities.</p></div><button type="button" disabled={busy} onClick={() => setReload(value => value + 1)}>Refresh resources</button></header>
    {error && <p role="alert" className="prp-error">{error}</p>}{notice && <p role="status">{notice}</p>}
    {loading ? <p role="status">Loading resource plan…</p> : data && <>
      {data.basis === 'approved_baseline' && <p>Resource inputs frozen in the approved baseline.</p>}{data.notice && <p>{data.notice}</p>}
      {!versionId && <p>Create or select a schedule version to allocate resources to activities.</p>}
      <div className="prp-actions">{canManage && <button type="button" disabled={busy} onClick={() => begin('resource')}>Add resource</button>}{canAllocate && <button type="button" disabled={busy || !resources.length || !activities.length} onClick={() => begin('assignment')}>Allocate resource</button>}</div>
      <div className="sc-secondary-table"><table><caption>Project resource catalog</caption><thead><tr><th>Resource</th><th>Type</th><th>Unit</th><th>Capacity / working day</th><th>Productivity</th><th>Actions</th></tr></thead><tbody>{resources.map(row => <tr key={row.id}><td><strong>{row.code}</strong><p>{row.name}</p></td><td>{row.resource_type}</td><td>{row.unit}</td><td>{show(row.capacity_units_per_day)}</td><td>{row.productivity_rate == null ? 'Not specified' : `${row.productivity_rate} ${row.productivity_unit} / ${row.unit}`}</td><td>{canManage && row.can_edit ? <><button type="button" disabled={busy} onClick={() => begin('resource', row)}>Edit {row.code}</button><button type="button" disabled={busy || assignments.some(item => item.resource === row.id)} onClick={() => mutate(() => service.deleteResource(row.id), 'Resource removed from the catalog.')}>Delete {row.code}</button></> : 'Read only'}</td></tr>)}{!resources.length && <tr><td colSpan={6}>No resources recorded.</td></tr>}</tbody></table></div>
      <div className="sc-secondary-table"><table><caption>Activity allocations</caption><thead><tr><th>Activity</th><th>Resource</th><th>Planned resource units</th><th>Planned output</th><th>Required resource units</th><th>Actions</th></tr></thead><tbody>{assignments.map(row => {
        const allocated = resources.find(item => item.id === row.resource), activity = activities.find(item => item.id === row.activity)
        return <tr key={row.id}><td>{activity ? `${activity.external_id} · ${activity.name}` : `Activity ${row.activity}`}</td><td>{allocated?.name || `Resource ${row.resource}`}</td><td>{show(row.planned_units)} {allocated?.unit}</td><td>{row.planned_output_quantity == null ? 'Not specified' : `${row.planned_output_quantity} ${allocated?.productivity_unit || ''}`}</td><td>{row.required_units == null ? 'Not specified' : `${row.required_units} ${allocated?.unit || ''}`}</td><td>{canAllocate ? <><button type="button" disabled={busy} onClick={() => begin('assignment', row)}>Edit allocation {activity?.external_id || row.id}</button><button type="button" disabled={busy} onClick={() => mutate(() => service.deleteAssignment(row.id), 'Allocation removed.')}>Remove allocation {activity?.external_id || row.id}</button></> : 'Read only'}</td></tr>
      })}{!assignments.length && <tr><td colSpan={6}>No allocations recorded for this version.</td></tr>}</tbody></table></div>
      <p className="prp-help">Required units = planned output ÷ productivity, rounded up to 0.01 unit. Rates do not change activity durations or planned allocations automatically.</p>
      {editing && <form aria-label={editing.type === 'resource' ? 'Resource details' : 'Resource allocation'} onSubmit={save}><h4>{editing.row ? 'Edit' : 'New'} {editing.type === 'resource' ? 'resource' : 'allocation'}</h4><fieldset disabled={busy}>
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
      </fieldset><div className="prp-actions"><button type="submit" disabled={busy}>Save {editing.type === 'resource' ? 'resource' : 'allocation'}</button><button type="button" disabled={busy} onClick={() => setEditing(null)}>Cancel</button></div></form>}
    </>}
  </section>
}
PlanningResourcePlan.propTypes = { projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired, versionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), readOnly: PropTypes.bool, onChanged: PropTypes.func }
