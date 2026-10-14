/* eslint-disable react/prop-types */
import React, { useState } from 'react'
import { AlertCircle, Building2, CheckCircle2, ListTree, ShieldCheck } from 'lucide-react'
import * as EPC from '../../../services/epcLifecycle.service'
import { EPCEmpty, EPCNotice, EPCPanel, EPCScroll, EPCStatus, epcControlScope, epcControlRole, epcControlRoleLabel, epcWbsPhase, epcError, epcId } from './EPCLifecycleCommon'

export default function EPCSetupPanel({ project, data, onSaved, onEditProject }) {
  const original = data.project || project
  const [form, setForm] = useState(() => ({ code: original.code || '', name: original.name || '', client_name: original.client_name || '', owner: String(epcId(original.owner)), start_date: original.start_date || '', end_date: original.end_date || '', currency: original.currency || '', scope_type: original.scope_type || '' }))
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const canEdit = data.capabilities?.can_setup === true
  const scopeOptions = data.scope_options || [{ value: 'epc', label: 'Full EPC' }, { value: 'detailed_engineering', label: 'Detailed Engineering' }]
  const savedScope = epcControlScope(original, data.control_scope)
  const previewScope = form.scope_type === original.scope_type ? savedScope : epcControlScope({ scope_type: form.scope_type })
  const field = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const save = async event => {
    event.preventDefault()
    if (!canEdit || busy) return
    setBusy(true); setError('')
    try { await EPC.saveSetup(project.id, { ...form, code: form.code.trim(), name: form.name.trim(), client_name: form.client_name.trim() }); await onSaved('Project setup saved with the selected delivery scope.', true) }
    catch (failure) { setError(epcError(failure)) }
    finally { setBusy(false) }
  }
  return <div className="epc-section-grid"><EPCPanel title="Project setup" icon={Building2} actions={<EPCStatus value={data.ready ? 'ready' : 'required'} label={data.ready ? 'Ready' : 'Setup required'} />}>
    <p className="epc-note">Confirm the project master data and delivery scope. The four phase WBS roots distinguish controlled work from external dependencies.</p>
    <form className="epc-form" onSubmit={save}><div className="epc-wide"><EPCNotice error>{error}</EPCNotice></div>
      <label>Project code<input required maxLength={50} value={form.code} disabled={!canEdit || busy} onChange={event => field('code', event.target.value)} /></label>
      <label>Project name<input required maxLength={255} value={form.name} disabled={!canEdit || busy} onChange={event => field('name', event.target.value)} /></label>
      <label>Client<input required maxLength={255} value={form.client_name} disabled={!canEdit || busy} onChange={event => field('client_name', event.target.value)} /></label>
      <label>Project owner<select required value={form.owner} disabled={!canEdit || busy} onChange={event => field('owner', event.target.value)}><option value="">Select an active owner</option>{(data.owners || []).map(person => <option key={person.id} value={person.id}>{person.label}</option>)}</select></label>
      <label>Planned start<input type="date" required value={form.start_date} max={form.end_date || undefined} disabled={!canEdit || busy} onChange={event => field('start_date', event.target.value)} /></label>
      <label>Planned finish<input type="date" required value={form.end_date} min={form.start_date || undefined} disabled={!canEdit || busy} onChange={event => field('end_date', event.target.value)} /></label>
      <label>Project currency<select required value={form.currency} disabled={!canEdit || busy} onChange={event => field('currency', event.target.value)}><option value="">Select currency</option>{(data.currencies || []).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label>Delivery scope<select required value={form.scope_type} disabled={!canEdit || busy} onChange={event => field('scope_type', event.target.value)}><option value="">Select delivery scope</option>{form.scope_type && !scopeOptions.some(option => option.value === form.scope_type) && <option value={form.scope_type} disabled>{form.scope_type.replaceAll('_', ' ')} — select a supported scope</option>}{scopeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <p className="epc-note epc-wide">{previewScope.description}{form.scope_type !== original.scope_type && ' Save setup to apply this scope.'}</p>
      <div className="epc-actions epc-wide"><button type="submit" className="pp-button pp-primary" disabled={!canEdit || busy}>{busy ? 'Saving setup…' : 'Save EPC setup'}</button><button type="button" className="pp-button" disabled={busy} onClick={onEditProject}>Open project details</button></div>
      {!canEdit && <p className="epc-note epc-wide">Your account can view this setup. Project setup changes require the permission shown by the server.</p>}
    </form>
  </EPCPanel><div className="epc-stack"><EPCPanel title="Setup readiness" icon={ShieldCheck}><ul className="epc-readiness">{(data.checks || []).map(check => <li key={check.id} className={check.ready ? 'is-ready' : ''}>{check.ready ? <CheckCircle2 aria-hidden="true" /> : <AlertCircle aria-hidden="true" />}<div><strong>{check.label}</strong><small>{check.detail}</small></div></li>)}</ul>{!data.checks?.length && <EPCEmpty>No readiness checks were returned.</EPCEmpty>}</EPCPanel>
    <EPCPanel title="Phase WBS" icon={ListTree}><p className="epc-note">{savedScope.description}</p><EPCScroll label="EPC work breakdown structure"><table className="epc-table"><thead><tr><th>Code</th><th>Work package</th><th>Responsibility</th></tr></thead><tbody>{(data.wbs || []).map(row => <tr key={row.id}><td>{row.code}</td><td>{row.name}</td><td><EPCStatus value={epcControlRole(savedScope, epcWbsPhase(row, data.wbs))} label={epcControlRoleLabel(epcControlRole(savedScope, epcWbsPhase(row, data.wbs)))} /></td></tr>)}</tbody></table></EPCScroll>{!data.wbs?.length && <EPCEmpty>Save the validated setup to create the four phase WBS roots.</EPCEmpty>}</EPCPanel></div></div>
}
