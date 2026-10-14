import { useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { controlsList as list, controlsInput as input, controlsLabel as label, controlsNumber as numeric, hasObservation } from './planningControlsPresentation'

const PAGE_SIZE = 25
const empty = activity => ({ activity_id: activity.id, actual_start: '', actual_finish: '', physical_progress_pct: '', installed_quantity: '', remaining_duration_days: '', evidence: '', notes: '' })

export default function PlanningControlsEntry({ data, busy, readOnly, onCommand, onDirty }) {
  const report = data.report
  const [rows, setRows] = useState({}), [notes, setNotes] = useState(''), [coverage, setCoverage] = useState(false), [dirty, setDirty] = useState(false), [query, setQuery] = useState(''), [page, setPage] = useState(0)
  const loaded = useRef(null)
  const canCosts = data.permissions?.can_view_costs === true
  const editable = !readOnly && report?.permissions?.can_save === true && report?.status === 'draft' && !busy
  useEffect(() => {
    const identity = `${report?.id}:${report?.revision}`
    if (loaded.current === identity) return
    loaded.current = identity
    setRows(Object.fromEntries(list(report?.observations).map(row => [row.activity_id, { ...row }])))
    setNotes(report?.notes || ''); setCoverage(report?.cost_coverage_confirmed === true); setDirty(false); onDirty(false); setPage(0)
  }, [report?.id, report?.revision, report?.observations, report?.notes, report?.cost_coverage_confirmed, onDirty])
  const touch = () => { setDirty(true); onDirty(true) }
  const update = (activity, field, next) => { setRows(current => ({ ...current, [activity.id]: { ...(current[activity.id] || empty(activity)), [field]: next } })); touch() }
  const activities = list(data.activities), policy = list(data.policies).find(item => item.id === report?.policy_id)
  const matched = useMemo(() => activities.filter(row => `${row.external_id} ${row.name}`.toLowerCase().includes(query.trim().toLowerCase())), [activities, query])
  const shown = matched.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const missingEvidence = Object.values(rows).filter(row => hasObservation(row) && !String(row.evidence || '').trim())
  const save = event => {
    event.preventDefault()
    if (!editable || missingEvidence.length) return
    const observations = Object.values(rows).filter(row => hasObservation(row) || row.evidence?.trim() || row.notes?.trim()).map(row => ({ activity_id: row.activity_id, actual_start: row.actual_start || null, actual_finish: row.actual_finish || null, physical_progress_pct: numeric(row.physical_progress_pct), installed_quantity: numeric(row.installed_quantity), remaining_duration_days: numeric(row.remaining_duration_days), evidence: String(row.evidence || '').trim(), notes: String(row.notes || '') }))
    onCommand('save_report', { report_id: report.id, revision: report.revision, observations, ...(canCosts ? { cost_coverage_confirmed: coverage } : {}), notes }, 'Weekly update saved. Review the inputs before submitting.')
  }
  if (!report) return <p>Create or select a weekly report to enter activity updates.</p>
  return <form className="poc-section" aria-label="Weekly activity update" onSubmit={save}><header><div><h3>Weekly activity update</h3><p>Record cumulative progress as of {report.data_date || 'Not Specified'}. Actual hours and costs come from approved source records.</p></div><div className="poc-actions"><button type="submit" className="poc-primary" disabled={!editable || !dirty || missingEvidence.length > 0}>Save weekly update</button>{dirty && <button type="button" disabled={busy} onClick={() => { setRows(Object.fromEntries(list(report.observations).map(row => [row.activity_id, { ...row }]))); setNotes(report.notes || ''); setCoverage(report.cost_coverage_confirmed === true); setDirty(false); onDirty(false) }}>Discard weekly changes</button>}</div></header>
    {report.status !== 'draft' && <p className="poc-message">This {label(report.status)} report is read only. Corrections retain the published history.</p>}
    {missingEvidence.length > 0 && <p className="poc-message is-warning" role="status">{missingEvidence.length} reported {missingEvidence.length === 1 ? 'activity needs' : 'activities need'} an evidence reference. A document, inspection, timesheet or report reference can be entered directly.</p>}
    <label>Find activity<input aria-label="Find weekly activity" value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} /></label>
    <div className="poc-table" tabIndex={0} role="region" aria-label="Weekly activity observations"><table><thead><tr>{['Activity', 'Earning basis / progress', 'Actual start', 'Actual finish', 'Remaining work (working days)', 'Evidence and notes'].map(text => <th scope="col" key={text}>{text}</th>)}</tr></thead><tbody>{shown.map(activity => {
      const row = rows[activity.id] || empty(activity), title = activity.external_id || activity.name, rule = list(policy?.definition?.activities).find(item => String(item.activity_id) === String(activity.id))
      const reportValue = (field, type, attrs = {}) => <input {...attrs} disabled={!editable} type={type} aria-label={`${field.replaceAll('_', ' ')} ${title}`} value={input(row[field])} onChange={event => update(activity, field, event.target.value)} />
      return <tr key={activity.id}><th scope="row"><strong>{activity.external_id}</strong><span>{activity.name}</span></th><td><small>{rule?.method ? label(rule.method) : 'Earning method: Not Specified'}</small>{rule?.method === 'quantity' ? <>{reportValue('installed_quantity', 'number', { min: 0, step: 'any', placeholder: 'Not Specified' })}<small>{rule.quantity_unit || 'Quantity unit: Not Specified'}</small></> : rule?.method === 'zero_hundred' || rule?.method === 'fifty_fifty' ? <span>Derived from reported start / finish under this policy.</span> : <>{reportValue('physical_progress_pct', 'number', { min: 0, max: 100, step: 'any', placeholder: 'Not Specified' })}<small>Reported percent</small></>}</td><td>{reportValue('actual_start', 'date')}</td><td>{reportValue('actual_finish', 'date')}</td><td>{reportValue('remaining_duration_days', 'number', { min: 0, step: 'any', placeholder: 'Not Specified' })}</td><td><textarea aria-label={`Evidence ${title}`} disabled={!editable} required={hasObservation(row)} placeholder="Document or report reference" value={input(row.evidence)} onChange={event => update(activity, 'evidence', event.target.value)} /><textarea aria-label={`Activity notes ${title}`} disabled={!editable} placeholder="Notes" value={input(row.notes)} onChange={event => update(activity, 'notes', event.target.value)} /></td></tr>
    })}{!shown.length && <tr><td colSpan={6}>No activities match this search.</td></tr>}</tbody></table></div>
    <div className="poc-pagination"><span>{matched.length} matching activities · Page {page + 1}</span><button type="button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous weekly activities</button><button type="button" disabled={(page + 1) * PAGE_SIZE >= matched.length} onClick={() => setPage(value => value + 1)}>Next weekly activities</button></div>
    <label>Report notes<textarea aria-label="Weekly report notes" disabled={!editable} value={notes} onChange={event => { setNotes(event.target.value); touch() }} /></label>
    {canCosts && <label className="poc-check"><input type="checkbox" disabled={!editable} checked={coverage} onChange={event => { setCoverage(event.target.checked); touch() }} />I reviewed the source actuals and confirm cost coverage through this data date.</label>}
    <p>Blank values remain Not Specified. Cost coverage is an explicit reporting decision; it does not approve or modify source transactions.</p>
  </form>
}
PlanningControlsEntry.propTypes = { data: PropTypes.object.isRequired, busy: PropTypes.bool, readOnly: PropTypes.bool, onCommand: PropTypes.func.isRequired, onDirty: PropTypes.func.isRequired }
