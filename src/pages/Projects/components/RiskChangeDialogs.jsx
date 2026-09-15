/* eslint-disable react/prop-types */
import React, { useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import planning from '../../../services/planningIntelligence.service'

export const RISK_CATEGORIES = ['Schedule', 'Procurement', 'Commercial', 'Resource', 'QHSE', 'Technical', 'Other']
export const RISK_STATUSES = ['open', 'in_review', 'approved', 'rejected', 'implemented', 'closed']
export const recordLabel = type => ({ risk: 'risk', issue: 'issue', change_request: 'change', action: 'action', decision: 'decision' })[type] || 'record'
export const titleCase = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
const errorMessage = error => {
  const details = error?.response?.data
  if (details?.error || details?.detail) return details.error || details.detail
  if (details && typeof details === 'object') return Object.entries(details).map(([key, value]) => `${titleCase(key)}: ${typeof value === 'object' && !Array.isArray(value) ? JSON.stringify(value) : String(value)}`).join(' ')
  return error?.message || 'The record could not be saved. Try again.'
}

export function RiskDialog({ title, onClose, busy = false, footer, children }) {
  const id = useId(), ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current, opener = document.activeElement
    dialog.showModal()
    return () => { dialog.close(); if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [])
  return <dialog className="rc-dialog" ref={ref} aria-labelledby={id} onCancel={event => { event.preventDefault(); if (!busy) onClose() }} onClick={event => { if (!busy && event.target === event.currentTarget) onClose() }}><div className="rc-dialog-header"><h2 id={id}>{title}</h2><button type="button" className="pp-button pp-icon-button" disabled={busy} aria-label="Close dialog" onClick={onClose}><X size={18} /></button></div><div className="rc-dialog-body">{children}</div>{footer && <div className="rc-dialog-footer">{footer}</div>}</dialog>
}

export function RiskRecordForm({ project, model, row, itemType, onClose, onSaved }) {
  const id = useId(), type = row?.type || itemType, label = recordLabel(type), risk = type === 'risk'
  const original = row?.raw?.metadata?.risk_control || {}
  const [form, setForm] = useState(() => ({
    title: row?.title || '', description: row?.description || '', priority: row?.priority || 'medium', status: row?.status || 'open',
    owner: row?.ownerId == null ? '' : String(row.ownerId), due_date: row?.dueDate || '', activity: String(row?.activityId ?? row?.linkedActivity?.id ?? ''),
    resolution: row?.resolution || '', category: original.category || '', cause: original.cause || '', event: original.event || '', effect: original.effect || '',
    response_strategy: original.response_strategy || 'unset', currency: original.currency || (row ? '' : project?.currency || project?.budget_currency || ''),
    inherent_probability: original.inherent_probability ?? '', inherent_impact: original.inherent_impact ?? '', residual_probability: original.residual_probability ?? '', residual_impact: original.residual_impact ?? '',
    inherent_cost_exposure: original.inherent_cost_exposure ?? '', residual_cost_exposure: original.residual_cost_exposure ?? '',
    cost_impact: row?.costImpact ?? '', schedule_impact_days: row?.scheduleImpactDays ?? '',
  }))
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const set = (key, value) => setForm(previous => ({ ...previous, [key]: value }))
  const submit = async event => {
    event.preventDefault()
    if (busy || !form.title.trim()) return
    setBusy(true); setError('')
    try {
      const assessment = { category: form.category, currency: form.currency.trim().toUpperCase() }
      if (risk) {
        for (const key of ['cause', 'event', 'effect', 'response_strategy']) assessment[key] = form[key]
        for (const key of ['inherent_probability', 'inherent_impact', 'residual_probability', 'residual_impact']) assessment[key] = form[key] === '' ? null : Number(form[key])
        for (const key of ['inherent_cost_exposure', 'residual_cost_exposure']) assessment[key] = form[key] === '' ? null : String(form[key])
      } else {
        assessment.cost_impact_assessed = form.cost_impact !== ''
        assessment.schedule_impact_assessed = form.schedule_impact_days !== ''
      }
      const body = { title: form.title.trim(), description: form.description, priority: form.priority, owner: form.owner ? Number(form.owner) : null, due_date: form.due_date || null, activity: form.activity ? Number(form.activity) : null, metadata: { risk_control: assessment } }
      if (!risk) { body.cost_impact = form.cost_impact === '' ? '0' : String(form.cost_impact); body.schedule_impact_days = form.schedule_impact_days === '' ? '0' : String(form.schedule_impact_days) }
      const result = row ? await planning.updateGovernanceItem(model.versionId, { ...body, item_id: row.sourceId, status: form.status, resolution: form.resolution }) : await planning.createGovernanceItem(model.versionId, { ...body, item_type: type })
      onSaved(result)
    } catch (failure) { setError(errorMessage(failure)); setBusy(false) }
  }
  const amountRequired = risk ? form.inherent_cost_exposure !== '' || form.residual_cost_exposure !== '' : form.cost_impact !== ''
  const members = model.members || [], activities = model.activityOptions || []
  const categories = [...new Set([...RISK_CATEGORIES, ...model.categories, form.category].filter(Boolean))]
  const textField = (key, name, options = {}) => <label className={options.wide ? 'rc-form-wide' : undefined}>{name}<input type={options.type || 'text'} value={form[key]} onChange={event => set(key, event.target.value)} {...options.props} /></label>
  const rating = (key, name, paired) => <label>{name}<select value={form[key]} required={form[paired] !== ''} onChange={event => set(key, event.target.value)}><option value="">Not assessed</option>{[1, 2, 3, 4, 5].map(number => <option key={number} value={number}>{number}</option>)}</select></label>
  return <RiskDialog title={`${row ? 'Edit' : 'Add'} ${label}`} onClose={onClose} busy={busy} footer={<><button type="button" className="pp-button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" form={id} className="pp-button pp-primary" disabled={busy || !form.title.trim()}>{busy ? 'Saving…' : row ? 'Save changes' : `Create ${label}`}</button></>}>
    <form id={id} className="rc-form-grid" onSubmit={submit}>
      {error && <div className="rc-form-error" role="alert">{error}</div>}
      {textField('title', 'Title', { wide: true, props: { required: true, maxLength: 255, autoFocus: true } })}
      <label className="rc-form-wide">Description<textarea value={form.description} onChange={event => set('description', event.target.value)} rows={2} /></label>
      <label>Priority<select value={form.priority} onChange={event => set('priority', event.target.value)}>{['low', 'medium', 'high', 'critical'].map(value => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label>
      <label>Owner<select value={form.owner} onChange={event => set('owner', event.target.value)}><option value="">Unassigned</option>{form.owner && !members.some(member => String(member.id) === form.owner) && <option value={form.owner}>{row?.owner || 'Current owner'}</option>}{members.map(member => <option key={member.id} value={member.id}>{member.name || member.email || `Member ${member.id}`}</option>)}</select></label>
      {textField('due_date', 'Due date', { type: 'date' })}
      <label>Category<select value={form.category} onChange={event => set('category', event.target.value)}><option value="">Uncategorized</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="rc-form-wide">Linked activity<select value={form.activity} onChange={event => set('activity', event.target.value)}><option value="">No linked activity</option>{form.activity && !activities.some(activity => String(activity.id) === form.activity) && <option value={form.activity}>Activity {form.activity} (details unavailable)</option>}{activities.map(activity => <option key={activity.id} value={activity.id}>{activity.code || activity.external_id} · {activity.name || activity.label}</option>)}</select></label>
      {risk && <>
        {['cause', 'event', 'effect'].map(key => <label className="rc-form-wide" key={key}>{titleCase(key)}<textarea rows={2} maxLength={2000} value={form[key]} onChange={event => set(key, event.target.value)} /></label>)}
        <label className="rc-form-wide">Response strategy<select value={form.response_strategy} onChange={event => set('response_strategy', event.target.value)}>{['unset', 'avoid', 'reduce', 'transfer', 'accept', 'exploit', 'enhance', 'share'].map(value => <option key={value} value={value}>{value === 'unset' ? 'Not selected' : value === 'reduce' ? 'Mitigate / reduce' : titleCase(value)}</option>)}</select></label>
        {rating('inherent_probability', 'Inherent probability', 'inherent_impact')}{rating('inherent_impact', 'Inherent impact', 'inherent_probability')}
        {rating('residual_probability', 'Residual probability', 'residual_impact')}{rating('residual_impact', 'Residual impact', 'residual_probability')}
        {textField('inherent_cost_exposure', 'Inherent cost exposure', { type: 'number', props: { min: 0, step: '0.01' } })}{textField('residual_cost_exposure', 'Residual cost exposure', { type: 'number', props: { min: 0, step: '0.01' } })}
      </>}
      {!risk && <>{textField('cost_impact', 'Cost impact', { type: 'number', props: { step: '0.01' } })}{textField('schedule_impact_days', 'Schedule impact (days)', { type: 'number', props: { step: '0.01' } })}</>}
      {textField('currency', 'Currency', { props: { required: amountRequired, pattern: '[A-Za-z]{3}', maxLength: 3, placeholder: 'e.g. AED' } })}
      {row && <><label>Status<select value={form.status} onChange={event => set('status', event.target.value)}>{RISK_STATUSES.map(value => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label><label className="rc-form-wide">Resolution<textarea maxLength={4000} rows={3} value={form.resolution} onChange={event => set('resolution', event.target.value)} /></label></>}
      <p className="rc-form-hint rc-form-wide">{risk ? 'Scores use the recorded 1–5 assessments. Cost exposure is entered separately and is not calculated from the score.' : 'Impacts are recorded estimates. Saving a change status does not update approved budgets or schedule baselines.'}</p>
    </form>
  </RiskDialog>
}

export function RiskUpdateForm({ model, row, onClose, onSaved }) {
  const id = useId(), [body, setBody] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const submit = async event => {
    event.preventDefault(); if (busy || !body.trim()) return
    setBusy(true); setError('')
    try { await planning.addGovernanceComment(model.versionId, { item: row.sourceId, body: body.trim() }); onSaved() } catch (failure) { setBusy(false); setError(errorMessage(failure)) }
  }
  return <RiskDialog title="Add update" onClose={onClose} busy={busy} footer={<><button type="button" className="pp-button" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" form={id} className="pp-button pp-primary" disabled={busy || !body.trim()}>{busy ? 'Saving…' : 'Save update'}</button></>}><p>{row.code} · {row.title}</p><form id={id} onSubmit={submit} className="rc-form-grid">{error && <div className="rc-form-error" role="alert">{error}</div>}<label className="rc-form-wide">Update<textarea required autoFocus rows={5} maxLength={8000} value={body} onChange={event => setBody(event.target.value)} /></label></form></RiskDialog>
}
