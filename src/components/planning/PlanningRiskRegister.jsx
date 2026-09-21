import { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { AlertTriangle, Loader2, Plus, RefreshCw } from 'lucide-react'
import { planningIntelligenceService as service } from '../../services/planningIntelligence.service'
import PlanningFieldProvenance from './PlanningFieldProvenance'
import './PlanningRiskRegister.css'

const list = value => Array.isArray(value) ? value : []
const label = value => value == null || value === '' ? 'Not Specified' : String(value).replaceAll('_', ' ')
const draftFor = item => ({ title: item?.title || '', description: item?.description || '', status: item?.status || 'open', priority: item?.priority || '', owner_id: item?.owner_id ?? '', response: item?.response || '', resolution: item?.resolution || '', reason: '' })
const errorText = error => {
  const data = error.response?.data
  const messages = (value, field = '') => typeof value === 'string' ? [`${field ? `${label(field)}: ` : ''}${value}`] : Array.isArray(value) ? value.flatMap(item => messages(item, field)) : value && typeof value === 'object' ? Object.entries(value).filter(([key]) => key !== 'code').flatMap(([key, item]) => messages(item, ['detail', 'error', 'message', 'non_field_errors'].includes(key) ? field : key)) : []
  return messages(data).slice(0, 8).join(' ') || error.message || 'The risk register could not be loaded.'
}

export default function PlanningRiskRegister({ projectId, versionId, readOnly = false, onChanged }) {
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [reload, setReload] = useState(0)
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [editing, setEditing] = useState(null), [draft, setDraft] = useState(() => draftFor(null))
  const pending = useRef(false), alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(''); setEditing(null)
    service.getPlanningRiskRegister(projectId, versionId, controller.signal).then(result => { if (!controller.signal.aborted) setData(result) }).catch(caught => { if (!controller.signal.aborted) setError(String(errorText(caught))) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [projectId, versionId, reload])
  const begin = item => { setEditing(item || 'new'); setDraft(draftFor(item)); setNotice(''); setError('') }
  const save = async event => {
    event.preventDefault()
    if (pending.current || readOnly || !draft.reason.trim()) return
    const creating = editing === 'new'
    if (creating ? !data.permissions?.can_create : !data.permissions?.can_edit) return
    pending.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const management = { priority: draft.priority || null, owner_id: draft.owner_id === '' ? null : draft.owner_id, response: draft.response, reason: draft.reason.trim() }
      const result = creating ? await service.createPlanningRisk(projectId, { version_id: data.version_id ?? versionId ?? null, title: draft.title.trim(), description: draft.description.trim(), ...management })
        : await service.updatePlanningRisk(projectId, { version_id: data.version_id ?? versionId ?? null, item_id: editing.id, revision: editing.revision, status: draft.status, resolution: draft.resolution, ...management })
      if (alive.current) { setData(result); setEditing(null); setNotice('Risk register decision saved. Source evidence is preserved.'); onChanged?.(result) }
    } catch (caught) { if (alive.current) setError(String(errorText(caught))) }
    finally { pending.current = false; if (alive.current) setBusy(false) }
  }
  const change = field => event => setDraft(current => ({ ...current, [field]: event.target.value }))
  return <section className="planning-risk-register" aria-label="Planning risk register" aria-busy={loading || busy}>
    <header><div><h3>Risk register</h3><p>Review source findings and record the responsible person, response and resolution.</p></div><div className="prr-actions"><button type="button" disabled={busy} onClick={() => setReload(value => value + 1)}><RefreshCw size={15} />Refresh risks</button>{!readOnly && data?.permissions?.can_create && <button type="button" disabled={busy} onClick={() => begin(null)}><Plus size={15} />Add planning risk</button>}</div></header>
    {error && <p className="prr-message is-error" role="alert"><AlertTriangle size={16} />{error}</p>}{notice && <p className="prr-message" role="status">{notice}</p>}
    {readOnly && <p className="prr-message">This schedule view is read only. Risk responses below belong to the selected version.</p>}
    {loading ? <p role="status"><Loader2 size={16} className="animate-spin" />Loading risk register…</p> : data && <>
      <div className="sc-secondary-table"><table><thead><tr><th>Risk / finding</th><th>Status</th><th>Priority</th><th>Owner</th><th>Response</th><th>Basis</th><th>Review</th></tr></thead><tbody>{list(data.items).map(item => <tr key={item.id}><td><strong>{item.title}</strong><p>{item.description}</p></td><td>{label(item.status)}</td><td>{label(item.priority)}</td><td>{label(item.owner_name)}</td><td>{label(item.response)}{item.resolution && <p>Resolution: {item.resolution}</p>}</td><td><PlanningFieldProvenance provenance={item.provenance} />{item.provenance?.source && <details><summary>Recorded source</summary><pre>{JSON.stringify(item.provenance.source, null, 2)}</pre></details>}</td><td><button type="button" disabled={busy || readOnly || !data.permissions?.can_edit} onClick={() => begin(item)}>Review {item.title}</button></td></tr>)}{!list(data.items).length && <tr><td colSpan={7}>No risk entries recorded for this schedule version.</td></tr>}</tbody></table></div>
      {editing && <form className="prr-form" aria-label={editing === 'new' ? 'New planning risk' : 'Review planning risk'} onSubmit={save}><h3>{editing === 'new' ? 'Add planning risk' : editing.title}</h3><fieldset disabled={busy}>
        {editing === 'new' ? <><label>Risk title<input aria-label="Risk title" required maxLength={255} value={draft.title} onChange={change('title')} /></label><label>Description<textarea aria-label="Risk description" required value={draft.description} onChange={change('description')} /></label></> : <><p>{editing.description}</p><PlanningFieldProvenance provenance={editing.provenance} /><label>Status<select aria-label="Risk status" value={draft.status} onChange={change('status')}>{['open', 'monitoring', 'mitigated', 'closed'].map(status => <option key={status} value={status}>{label(status)}</option>)}</select></label></>}
        <div className="prr-fields"><label>Priority<select aria-label="Risk priority" value={draft.priority} onChange={change('priority')}><option value="">Not Specified</option>{['low', 'medium', 'high', 'critical'].map(priority => <option key={priority} value={priority}>{label(priority)}</option>)}</select></label><label>Owner<select aria-label="Risk owner" value={draft.owner_id} onChange={change('owner_id')}><option value="">Not Specified</option>{list(data.owners).map(owner => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select></label></div>
        <label>Response<textarea aria-label="Risk response" value={draft.response} onChange={change('response')} /></label>{editing !== 'new' && <label>Resolution<textarea aria-label="Risk resolution" required={draft.status === 'closed'} value={draft.resolution} onChange={change('resolution')} /></label>}<label>Decision reason<textarea aria-label="Risk decision reason" required value={draft.reason} onChange={change('reason')} /></label>
      </fieldset><div className="prr-actions"><button type="submit" disabled={busy || !draft.reason.trim()}>Save risk review</button><button type="button" disabled={busy} onClick={() => setEditing(null)}>Cancel risk review</button></div></form>}
    </>}
  </section>
}
PlanningRiskRegister.propTypes = { projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired, versionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), readOnly: PropTypes.bool, onChanged: PropTypes.func }
