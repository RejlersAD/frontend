import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { GitBranch, Loader2, X } from 'lucide-react'
import { planningIntelligenceService as service } from '../../services/planningIntelligence.service'
import './PlanningSourceLogic.css'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const date = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not Specified'
const message = value => typeof value === 'string' ? value : value?.message || value?.description || value?.label || value?.code
const errorMessage = error => {
  const body = error.response?.data
  return message(body?.error || body?.detail) || error.message || 'The logic request failed. Review the inputs and try again.'
}
const calendarLabel = calendar => calendar ? `${(calendar.working_weekdays || []).map(day => WEEKDAYS[day]?.slice(0, 3)).filter(Boolean).join(', ')}; ${calendar.hours_per_day} hours/day; ${calendar.timezone || 'Asia/Dubai'}` : 'Calendar details unavailable'

export function SourceLogicComparison({ summary }) {
  if (!summary || !summary.source_start_date && !summary.source_finish_date && summary.source_total_float_days == null && summary.source_duration_days == null) return null
  const sourceDate = endpoint => ['explicit_none', 'blank'].includes(summary[`source_${endpoint}_status`]) ? '\u2014'
    : ['ambiguous', 'invalid', 'conflicting'].includes(summary[`source_${endpoint}_status`]) ? 'Review source' : date(summary[`source_${endpoint}_date`])
  const calculated = Boolean(summary.calculated_start_date || summary.calculated_finish_date || summary.calculated_total_float_days != null)
  const hasFloat = summary.source_total_float_status === 'extracted' && summary.source_total_float_days != null
  const hasDuration = summary.source_duration_days != null || summary.calculated_duration_days != null
  const sourceUnit = ({ working_days: 'working days', calendar_days: 'calendar days', hours: 'hours', weeks: 'weeks' })[summary.source_duration_unit] || 'days as printed'
  return <table className="psl-comparison"><caption>Source and calculated timing</caption><thead><tr><th scope="col">Schedule</th><th scope="col">Start</th><th scope="col">Finish</th>{hasDuration && <th scope="col">Duration</th>}{hasFloat && <th scope="col">Total float (days)</th>}</tr></thead><tbody>
    <tr><th scope="row">Printed source</th><td>{sourceDate('start')}</td><td>{sourceDate('finish')}</td>{hasDuration && <td>{summary.source_duration_days == null ? 'Not Specified' : `${summary.source_duration_days} ${sourceUnit}`}</td>}{hasFloat && <td>{summary.source_total_float_days}</td>}</tr>
    {calculated && <tr><th scope="row">Calculated draft</th><td>{date(summary.calculated_start_date)}</td><td>{date(summary.calculated_finish_date)}</td>{hasDuration && <td>{summary.calculated_duration_days == null ? 'Not calculated' : `${summary.calculated_duration_days} working days`}</td>}{hasFloat && <td>{summary.calculated_total_float_days ?? 'Not calculated'}</td>}</tr>}
  </tbody></table>
}
SourceLogicComparison.propTypes = { summary: PropTypes.object }

export function PlanningSourceLogicSummary({ logic, onViewSource }) {
  const summary = logic.summary || logic
  return <details className="psl-summary"><summary><GitBranch size={14} />{logic.status === 'inputs_changed' ? 'Planning draft · calculation pending' : 'Calculated planning draft'} · {summary.relationship_count ?? 'Recorded'} stage relationships · {summary.unsequenced_activity_count ?? 'Other'} activities need dependency review</summary>
    <div><p>IFR → Company Review → IFA → Company Approval → IFT/IFM, finish-to-start with zero lag. This is a partial network; cross-discipline, procurement and milestone links still need review.</p>
      <p>Source durations are retained. Printed starts are planning release dates. {logic.calendar_origin === 'user_selected' ? 'Planner-selected calendar' : 'Draft calendar assumption'}: {calendarLabel(logic.calendar)}. {logic.calendar?.exceptions?.length ? 'Calendar exceptions are included.' : 'No holiday exceptions are included.'} This draft is not an approved baseline.</p>
      <SourceLogicComparison summary={summary} />
      {(logic.assumptions || []).length > 0 && <ul>{logic.assumptions.map((item, index) => <li key={index}>{message(item)}</li>)}</ul>}
      {onViewSource && logic.source_version_id != null && <button type="button" onClick={() => onViewSource(String(logic.source_version_id))}>View original source version</button>}
    </div>
  </details>
}
PlanningSourceLogicSummary.propTypes = { logic: PropTypes.object.isRequired, onViewSource: PropTypes.func }

export default function PlanningSourceLogic({ projectId, sourceVersionId, masterRevision, readOnly = false, onClose, onApplied }) {
  const dialogRef = useRef(null), titleId = useId(), alive = useRef(true), inFlight = useRef(false)
  const [weekdays, setWeekdays] = useState([0, 1, 2, 3, 4]), [hours, setHours] = useState('8')
  const [origin, setOrigin] = useState('scenario_assumption'), [timezone, setTimezone] = useState('Asia/Dubai')
  const [reason, setReason] = useState('Build deterministic stage logic from the imported schedule for planning review.')
  const [proposal, setProposal] = useState(null), [busy, setBusy] = useState(''), [error, setError] = useState(''), [stale, setStale] = useState(false)
  useEffect(() => {
    const dialog = dialogRef.current, opener = document.activeElement
    alive.current = true; dialog.showModal()
    return () => { alive.current = false; dialog.close(); if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [])
  useEffect(() => { setProposal(null); setStale(false) }, [sourceVersionId, masterRevision])
  const change = callback => { callback(); setProposal(null); setError(''); setStale(false) }
  const calendarValid = weekdays.length > 0 && Number.isFinite(Number(hours)) && Number(hours) > 0 && Number(hours) <= 24 && timezone.trim()
  const review = async () => {
    if (inFlight.current || readOnly || !calendarValid || !reason.trim()) return
    inFlight.current = true; setBusy('preview'); setError(''); setProposal(null); setStale(false)
    try {
      const revision = stale ? (await service.getCurrentMasterSchedule(projectId)).master_revision : masterRevision
      const result = await service.previewSourceLogic(projectId, { source_version_id: sourceVersionId, revision,
        calendar_spec: { working_weekdays: weekdays, hours_per_day: Number(hours), timezone: timezone.trim(), exceptions: [], origin }, reason: reason.trim() })
      if (alive.current) setProposal(result)
    } catch (caught) { if (alive.current) setError(errorMessage(caught)) }
    finally { inFlight.current = false; if (alive.current) setBusy('') }
  }
  const apply = async () => {
    if (inFlight.current || readOnly || stale || proposal?.can_apply !== true || !proposal.preview_token || !reason.trim()) return
    inFlight.current = true; setBusy('apply'); setError('')
    try {
      const result = await service.applySourceLogic(projectId, { preview_token: proposal.preview_token, reason: reason.trim() })
      if (alive.current) onApplied(result)
    } catch (caught) { if (alive.current) { setError(errorMessage(caught)); if (caught.response?.status === 409) setStale(true) } }
    finally { inFlight.current = false; if (alive.current) setBusy('') }
  }
  const summary = proposal?.summary || {}, disabled = Boolean(busy) || readOnly
  return createPortal(<dialog ref={dialogRef} className="psl-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <header><h2 id={titleId}>Build logic &amp; sequence</h2><button type="button" aria-label="Close logic review" disabled={Boolean(busy)} onClick={onClose}><X size={19} /></button></header>
    <form onSubmit={event => { event.preventDefault(); if (proposal && !stale) apply(); else review() }}>
      <div className="psl-content">
        <p>Create a separate calculated planning draft from this source version. The original source schedule remains available in version history.</p>
        <p><strong>Stage rule:</strong> IFR → Company Review → IFA → Company Approval → IFT/IFM. Each link is finish-to-start with zero lag. Source durations are retained; printed starts become planning release dates.</p>
        <fieldset disabled={disabled}><legend>Planning calendar</legend>
          <p>This calendar is a draft assumption until reviewed. It can change calculated dates and float. No holiday exceptions are included.</p>
          <div className="psl-weekdays">{WEEKDAYS.map((day, index) => <label key={day}><input type="checkbox" checked={weekdays.includes(index)} onChange={event => change(() => setWeekdays(current => event.target.checked ? [...current, index].sort((a, b) => a - b) : current.filter(value => value !== index)))} />{day}</label>)}</div>
          <div className="psl-calendar-fields"><label>Hours per working day<input type="number" min="0.01" max="24" step="0.01" required value={hours} onChange={event => change(() => setHours(event.target.value))} /></label>
            <label>Timezone<input required value={timezone} onChange={event => change(() => setTimezone(event.target.value))} /></label>
            <label>Calendar basis<select value={origin} onChange={event => change(() => setOrigin(event.target.value))}><option value="scenario_assumption">Draft scenario assumption</option><option value="user_selected">Planner-selected calendar</option></select></label></div>
        </fieldset>
        <label className="psl-reason">Planning note<textarea required maxLength={2000} value={reason} disabled={disabled} onChange={event => setReason(event.target.value)} /></label>
        {busy && <p role="status"><Loader2 size={16} className="animate-spin" />{busy === 'preview' ? 'Preparing logic preview...' : 'Creating calculated draft...'}</p>}
        {error && <p className="psl-error" role="alert">{error}</p>}
        {stale && <p role="status">The preview is out of date. Review the latest inputs before creating a draft.</p>}
        {proposal && <section aria-label="Logic preview"><h3>Logic preview</h3><dl className="psl-counts">
          <div><dt>Activities retained</dt><dd>{summary.activity_count ?? 'Not Specified'}</dd></div><div><dt>Stage groups</dt><dd>{summary.workflow_group_count ?? 'Not Specified'}</dd></div>
          <div><dt>Stage relationships</dt><dd>{summary.relationship_count ?? 'Not Specified'}</dd></div><div><dt>Activities needing dependency review</dt><dd>{summary.unsequenced_activity_count ?? 'Not Specified'}</dd></div>
          {summary.critical_activity_count != null && <div><dt>Calculated critical activities</dt><dd>{summary.critical_activity_count}</dd></div>}
        </dl><SourceLogicComparison summary={summary} /><p>{calendarLabel(proposal.calendar)}</p>
          <p>This is a partial project network. Activities without a matching stage rule remain without inferred cross-discipline or milestone links. Review them before relying on the project critical path. Dates may differ from the printed source.</p>
          {[...(proposal.assumptions || []), ...(proposal.warnings || []), ...(proposal.blockers || [])].length > 0 && <ul>{[...(proposal.assumptions || []), ...(proposal.warnings || []), ...(proposal.blockers || [])].map((item, index) => <li key={index}>{message(item)}</li>)}</ul>}
          {proposal.can_apply !== true && <p className="psl-error">Resolve the preview findings before creating the draft.</p>}
        </section>}
      </div>
      <footer><button type="button" disabled={Boolean(busy)} onClick={onClose}>Cancel</button><button type="submit" className="psl-primary" disabled={disabled || !calendarValid || !reason.trim() || Boolean(proposal && !stale && (proposal.can_apply !== true || !proposal.preview_token))}>{proposal && !stale ? 'Create calculated draft' : stale ? 'Review latest inputs' : 'Preview logic & sequence'}</button></footer>
    </form>
  </dialog>, document.body)
}
PlanningSourceLogic.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  sourceVersionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  masterRevision: PropTypes.number.isRequired, readOnly: PropTypes.bool,
  onClose: PropTypes.func.isRequired, onApplied: PropTypes.func.isRequired,
}
