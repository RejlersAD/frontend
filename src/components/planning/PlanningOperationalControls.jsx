import { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { AlertTriangle, ClipboardList, Loader2, RefreshCw } from 'lucide-react'
import { planningIntelligenceService as service } from '../../services/planningIntelligence.service'
import PlanningControlsEntry from './PlanningControlsEntry'
import PlanningControlsPolicy from './PlanningControlsPolicy'
import PlanningControlsTrends from './PlanningControlsTrends'
import { controlsError, controlsLabel as label, controlsList as list, controlsValue as value } from './planningControlsPresentation'
import './PlanningOperationalControls.css'

const views = [['weekly', 'Weekly update'], ['actuals', 'Source actuals'], ['review', 'Review & publish'], ['policy', 'Earning policy'], ['trends', 'Trends & forecast']]

function SourceActuals({ data }) {
  const sources = data.report?.source_actuals || {}, canCosts = data.permissions?.can_view_costs === true
  const activityLinks = row => <><span>{list(row.account_activity_ids).map(id => list(data.activities).find(activity => String(activity.id) === String(id))?.external_id || id).join(', ') || 'Not Specified'}</span>{row.activity_allocation_status && <small>{label(row.activity_allocation_status)}</small>}</>
  return <section className="poc-section" aria-label="Source actuals"><header><div><h3>Approved source actuals</h3><p>Review the underlying approved hours and posted costs. Reporting decisions do not modify these source records.</p></div></header>
    <dl className="poc-metrics"><div><dt>Approved hours</dt><dd>{value(sources.total_hours, ' h')}</dd></div>{canCosts && Object.entries(sources.costs_by_currency || {}).map(([currency, amount]) => <div key={currency}><dt>Actual cost · {currency}</dt><dd>{value(amount)}</dd></div>)}</dl>
    {!data.report && <p>Select a weekly report to review source actuals for its data date.</p>}
    {list(sources.issues).length > 0 && <ul className="poc-issues">{sources.issues.map((issue, index) => <li key={issue.code || index}>{issue.message || label(issue.code || issue)}</li>)}</ul>}
    <div className="poc-table" role="region" aria-label="Approved timesheet records" tabIndex={0}><table><thead><tr>{['Reference', 'Source', 'Work date', 'Hours', 'Control account', 'Activity links', 'Approved by', 'Approved at'].map(text => <th key={text}>{text}</th>)}</tr></thead><tbody>{list(sources.hours).map(row => <tr key={`${row.source_type}-${row.id}`}><th scope="row">{row.source_reference || row.id}{row.employee_code && <small>{row.employee_code}</small>}</th><td>{label(row.source_type)}</td><td>{label(row.work_date)}</td><td>{value(row.hours)}</td><td>{label(row.control_account_id)}</td><td>{activityLinks(row)}</td><td>{label(row.approved_by_id)}</td><td>{label(row.approved_at)}</td></tr>)}{!list(sources.hours).length && <tr><td colSpan={8}>No approved hour records reported for this selection.</td></tr>}</tbody></table></div>
    {canCosts && <div className="poc-table" role="region" aria-label="Posted cost records" tabIndex={0}><table><thead><tr>{['Reference', 'Entry date', 'Amount', 'Currency', 'Control account', 'WBS', 'Activity links'].map(text => <th key={text}>{text}</th>)}</tr></thead><tbody>{list(sources.costs).map(row => <tr key={row.id}><th scope="row">{row.entry_key || row.id}</th><td>{label(row.entry_date)}</td><td>{value(row.amount)}</td><td>{label(row.currency)}</td><td>{label(row.control_account_id)}</td><td>{label(row.wbs_node_id)}</td><td>{activityLinks(row)}</td></tr>)}{!list(sources.costs).length && <tr><td colSpan={7}>No posted costs reported for this selection. Missing cost coverage is not treated as zero.</td></tr>}</tbody></table></div>}
    {sources.fingerprint && <details><summary>Source snapshot reference</summary><code>{sources.fingerprint}</code></details>}
  </section>
}
SourceActuals.propTypes = { data: PropTypes.object.isRequired }

function ReviewReport({ data, busy, readOnly, dirty, onCommand, onView }) {
  const [reason, setReason] = useState('')
  const report = data.report, metrics = report?.preview?.metrics || {}, permissions = report?.permissions || {}
  useEffect(() => setReason(''), [report?.id, report?.revision])
  if (!report) return <p>Create or select a weekly report before review.</p>
  const issues = [...list(data.issues), ...list(report.preview?.issues)]
  const fields = [['progress_pct', 'Earned progress', '%'], ['planned_progress_pct', 'Planned progress', '%'], ...(data.permissions?.can_view_costs === true ? [['bac', 'Budget at completion', ''], ['planned_value', 'Planned value', ''], ['earned_value', 'Earned value', ''], ['actual_cost', 'Actual cost', ''], ['spi', 'SPI', ''], ['cpi', 'CPI', ''], ['schedule_variance', 'Schedule variance', ''], ['cost_variance', 'Cost variance', ''], ['eac', 'Estimate at completion', ''], ['etc', 'Estimate to complete', ''], ['vac', 'Variance at completion', '']] : [])]
  const allowed = key => !readOnly && !busy && !dirty && permissions[key] === true
  const decide = async action => {
    const result = await onCommand(action, { report_id: report.id, ...(action === 'correction_report' ? {} : { revision: report.revision, source_fingerprint: report.source_fingerprint }), reason: reason.trim() }, action === 'publish_report' ? 'Operational report published. Its values and source references are preserved.' : action === 'submit_report' ? 'Weekly report submitted for independent review.' : action === 'correction_report' ? 'A correction draft is open. The published report remains unchanged.' : 'Report returned to draft with the review reason.')
    if (result) { setReason(''); if (action === 'return_report' || action === 'correction_report') onView('weekly') }
  }
  return <section className="poc-section" aria-label="Review operational report"><header><div><h3>Review & publish</h3><p>Revision {report.revision} · {label(report.status)} · Data date {label(report.data_date)}</p></div></header>
    <p>Operational publication records this weekly report. It does not lock a finance period or change the approved schedule baseline.</p>
    {dirty && <p className="poc-message is-warning">Save the weekly changes before submitting or publishing.</p>}
    <dl className="poc-metrics">{fields.map(([field, text, unit]) => <div key={field}><dt>{text}{!unit && !['spi', 'cpi'].includes(field) && metrics.currency ? ` · ${metrics.currency}` : ''}</dt><dd>{value(metrics[field], unit)}</dd>{list(metrics.null_reasons?.[field]).map((reason, index) => <small key={index}>{label(reason)}</small>)}</div>)}</dl>
    <h4>Review findings</h4>{issues.length ? <ul className="poc-issues">{issues.map((issue, index) => <li key={index}><AlertTriangle size={15} /><span>{issue.message || label(issue.code || issue)}{issue.activity_id != null && <small>Activity {issue.activity_id}</small>}</span><button type="button" onClick={() => onView(issue.section === 'policy' || String(issue.code || '').includes('policy') ? 'policy' : issue.section === 'actuals' || String(issue.code || '').includes('cost') ? 'actuals' : 'weekly')}>Review input</button></li>)}</ul> : <p>No review findings reported.</p>}
    <p>Missing information and forecast overruns remain visible. Publish eligibility is determined by the server’s review rules.</p>
    {!readOnly && Object.values(permissions).some(Boolean) && <><label>Decision reason<textarea aria-label="Operational report decision reason" value={reason} onChange={event => setReason(event.target.value)} /></label><div className="poc-actions">
      {report.status === 'draft' && permissions.can_submit && <button type="button" className="poc-primary" disabled={!allowed('can_submit') || !reason.trim()} onClick={() => decide('submit_report')}>Submit weekly report</button>}
      {report.status === 'submitted' && permissions.can_publish && <button type="button" className="poc-primary" disabled={!allowed('can_publish') || !reason.trim()} onClick={() => decide('publish_report')}>Publish operational period</button>}
      {report.status === 'submitted' && permissions.can_return && <button type="button" disabled={!allowed('can_return') || !reason.trim()} onClick={() => decide('return_report')}>Return for correction</button>}
      {report.status === 'published' && permissions.can_correct && <button type="button" disabled={!allowed('can_correct') || !reason.trim()} onClick={() => decide('correction_report')}>Create correction draft</button>}
    </div></>}
    {report.status === 'submitted' && !permissions.can_publish && <p>Publication requires an authorised independent reviewer.</p>}
    {report.source_fingerprint && <details><summary>Reviewed source fingerprint</summary><code>{report.source_fingerprint}</code></details>}
  </section>
}
ReviewReport.propTypes = { data: PropTypes.object.isRequired, busy: PropTypes.bool, readOnly: PropTypes.bool, dirty: PropTypes.bool, onCommand: PropTypes.func.isRequired, onView: PropTypes.func.isRequired }

export default function PlanningOperationalControls({ projectId, baselineId, readOnly = false }) {
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [reload, setReload] = useState(0), [view, setView] = useState('weekly')
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [dirty, setDirty] = useState(false), [creating, setCreating] = useState(false)
  const [reportForm, setReportForm] = useState({ policy_id: '', reporting_period_id: '', mode: 'existing', name: '', start_date: '', end_date: '', data_date: '' })
  const query = useRef(baselineId ? { baseline_id: baselineId } : {}), inFlight = useRef(false), alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const install = result => { setData(result); query.current = { ...(result.baseline?.id ? { baseline_id: result.baseline.id } : {}), ...(result.report?.id ? { report_id: result.report.id } : {}) } }
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('')
    service.getOperationalControls(projectId, query.current, controller.signal).then(result => { if (!controller.signal.aborted) install(result) }).catch(caught => { if (!controller.signal.aborted) setError(controlsError(caught)) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [projectId, reload])
  const command = async (action, payload, message) => {
    if (readOnly || inFlight.current) return null
    inFlight.current = true; setBusy(true); setError(''); setNotice('')
    try { const result = await service.actOnOperationalControls(projectId, { action, ...payload }); if (alive.current) { install(result); setNotice(message) } return result }
    catch (caught) { if (alive.current) setError(controlsError(caught)); return null }
    finally { inFlight.current = false; if (alive.current) setBusy(false) }
  }
  const select = next => { query.current = next; setCreating(false); setNotice(''); setReload(value => value + 1) }
  const startReport = () => { setCreating(true); setReportForm({ policy_id: '', reporting_period_id: '', mode: 'existing', name: '', start_date: '', end_date: '', data_date: '' }) }
  const createReport = async event => {
    event.preventDefault()
    const result = await command('create_report', { baseline_id: data.baseline.id, policy_id: reportForm.policy_id, ...(reportForm.mode === 'existing' ? { reporting_period_id: reportForm.reporting_period_id } : { period: { name: reportForm.name.trim(), start_date: reportForm.start_date, end_date: reportForm.end_date, data_date: reportForm.data_date } }) }, 'Weekly report draft created. Enter the observed progress and supporting references.')
    if (result) { setCreating(false); setView('weekly') }
  }
  const canWrite = !readOnly && data?.permissions?.can_write === true
  const field = key => event => setReportForm(current => ({ ...current, [key]: event.target.value }))
  return <section className="planning-operational-controls" aria-label="Operational controls" aria-busy={loading || busy}>
    <header className="poc-header"><div><h2><ClipboardList size={18} />Operational controls</h2><p>Update work, review approved actuals and publish a traceable weekly report.</p></div><div className="poc-actions"><button type="button" disabled={busy || dirty || loading} onClick={() => { setNotice(''); setReload(value => value + 1) }}><RefreshCw size={15} />Refresh operational controls</button>{canWrite && data.baseline && <button type="button" className="poc-primary" disabled={busy || dirty} onClick={startReport}>New weekly report</button>}</div></header>
    {error && <p className="poc-message is-error" role="alert"><AlertTriangle size={16} />{error}</p>}{notice && <p className="poc-message" role="status">{notice}</p>}
    {loading ? <p role="status"><Loader2 size={16} className="animate-spin" />Loading operational controls…</p> : data && <>
      <div className="poc-toolbar"><label>Approved baseline<select aria-label="Operational baseline" disabled={busy || dirty} value={data.baseline?.id || ''} onChange={event => select(event.target.value ? { baseline_id: event.target.value } : {})}><option value="">Select a baseline</option>{list(data.baselines).map(row => <option key={row.id} value={row.id}>{row.name || `Baseline ${row.id}`} · Schedule {row.version_id}</option>)}</select></label><label>Weekly report<select aria-label="Operational weekly report" disabled={busy || dirty || !data.baseline} value={data.report?.id || ''} onChange={event => select({ baseline_id: data.baseline.id, ...(event.target.value ? { report_id: event.target.value } : {}) })}><option value="">Select report</option>{list(data.reports).map(row => <option key={row.id} value={row.id}>{row.data_date} · {label(row.status)} · Revision {row.revision}</option>)}</select></label>{data.report && <p className="poc-report-state">{label(data.report.status)} · Data date {label(data.report.data_date)} · Revision {data.report.revision}</p>}</div>
      {dirty && <p className="poc-note">Unsaved weekly changes. Save or discard them before switching reports.</p>}
      {readOnly && <p className="poc-message">This schedule view is read only. Open the current Master Schedule to manage operational reports.</p>}
      {!data.baseline ? <p className="poc-message">An approved baseline is required for operational reporting. No schedule dates or progress are assumed.</p> : <>
        {creating && <form className="poc-section" aria-label="Create weekly report" onSubmit={createReport}><h3>New weekly report</h3><fieldset disabled={busy || !canWrite}><div className="poc-fields"><label>Approved earning policy<select aria-label="Weekly report earning policy" required value={reportForm.policy_id} onChange={field('policy_id')}><option value="">Select approved policy</option>{list(data.policies).filter(row => row.status === 'approved').map(row => <option key={row.id} value={row.id}>{row.name} · Revision {row.revision}</option>)}</select></label><label>Reporting period<select aria-label="Weekly report period mode" value={reportForm.mode} onChange={field('mode')}><option value="existing">Use existing period</option><option value="new">Create new period</option></select></label></div>
          {reportForm.mode === 'existing' ? <label>Existing reporting period<select aria-label="Weekly report existing period" required value={reportForm.reporting_period_id} onChange={field('reporting_period_id')}><option value="">Select a reporting period</option>{list(data.reporting_periods).map(row => <option key={row.id} value={row.id}>{row.name} · {label(row.status)} · {row.start_date} — {row.end_date} · Data date {row.data_date}</option>)}</select></label> : <div className="poc-fields"><label>Period name<input aria-label="New reporting period name" required value={reportForm.name} onChange={field('name')} /></label>{[['start_date', 'Period start'], ['end_date', 'Period end'], ['data_date', 'Data date']].map(([key, text]) => <label key={key}>{text}<input type="date" required aria-label={`New reporting ${text.toLowerCase()}`} value={reportForm[key]} onChange={field(key)} /></label>)}</div>}
          {!list(data.policies).some(row => row.status === 'approved') && <p>Approve an earning policy before creating a weekly report. <button type="button" onClick={() => { setCreating(false); setView('policy') }}>Review earning policies</button></p>}
        </fieldset><div className="poc-actions"><button type="submit" className="poc-primary" disabled={busy || !canWrite || !reportForm.policy_id}>Create weekly report draft</button><button type="button" disabled={busy} onClick={() => setCreating(false)}>Cancel new report</button></div></form>}
        <div className="poc-tabs" role="tablist" aria-label="Operational control sections">{views.map(([key, text], index) => <button type="button" role="tab" key={key} aria-selected={view === key} tabIndex={view === key ? 0 : -1} aria-controls={`operational-view-${projectId}`} onClick={() => setView(key)} onKeyDown={event => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? views.length - 1 : (index + (event.key === 'ArrowLeft' ? -1 : 1) + views.length) % views.length; setView(views[next][0]); event.currentTarget.parentElement.querySelectorAll('[role=tab]')[next].focus() }}>{text}</button>)}</div>
        <div role="tabpanel" id={`operational-view-${projectId}`} aria-label={views.find(([key]) => key === view)?.[1]}>
          <div hidden={view !== 'weekly'}><PlanningControlsEntry data={data} busy={busy} readOnly={readOnly} onCommand={command} onDirty={setDirty} /></div>
          {view === 'actuals' && <SourceActuals data={data} />}
          {view === 'review' && <ReviewReport data={data} busy={busy} readOnly={readOnly} dirty={dirty} onCommand={command} onView={setView} />}
          <div hidden={view !== 'policy'}><PlanningControlsPolicy data={data} busy={busy} readOnly={readOnly} onCommand={command} /></div>
          {view === 'trends' && <PlanningControlsTrends data={data} />}
        </div>
      </>}
    </>}
  </section>
}
PlanningOperationalControls.propTypes = { projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired, baselineId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), readOnly: PropTypes.bool }
