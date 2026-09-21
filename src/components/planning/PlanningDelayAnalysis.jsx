import { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { AlertTriangle, GitCompare, Loader2, RefreshCw } from 'lucide-react'
import { planningIntelligenceService as service } from '../../services/planningIntelligence.service'
import PlanningDelayEventForm from './PlanningDelayEventForm'
import PlanningDelayCaseEditor from './PlanningDelayCaseEditor'
import PlanningDelayReview from './PlanningDelayReview'
import { controlsList as list, controlsLabel as label, controlsError } from './planningControlsPresentation'
import './PlanningOperationalControls.css'
import './PlanningDelayAnalysis.css'

const views = [['events', 'Event register'], ['inputs', 'Impact & recovery inputs'], ['review', 'Compare & review']]
export default function PlanningDelayAnalysis({ projectId, baselineId, readOnly = false }) {
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [reload, setReload] = useState(0), [view, setView] = useState('events')
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [caseDirty, setCaseDirty] = useState(false), [eventForm, setEventForm] = useState(null), [creatingCase, setCreatingCase] = useState(false)
  const [caseForm, setCaseForm] = useState({ name: '', reference_report_id: '', event_ids: [] }), [search, setSearch] = useState(''), [page, setPage] = useState(0)
  const query = useRef(baselineId ? { baseline_id: baselineId } : {}), inFlight = useRef(false), alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const install = result => { setData(result); query.current = { ...(result.baseline?.id ? { baseline_id: result.baseline.id } : {}), ...(result.case?.id ? { case_id: result.case.id } : {}) } }
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('')
    service.getDelayAnalysis(projectId, query.current, controller.signal).then(result => { if (!controller.signal.aborted) install(result) }).catch(caught => { if (!controller.signal.aborted) setError(controlsError(caught)) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [projectId, reload])
  const command = async (action, payload, message) => {
    if (readOnly || inFlight.current) return null
    inFlight.current = true; setBusy(true); setError(''); setNotice('')
    try { const result = await service.actOnDelayAnalysis(projectId, { action, ...payload }); if (alive.current) { install(result); setNotice(message) } return result }
    catch (caught) { if (alive.current) setError(controlsError(caught)); return null }
    finally { inFlight.current = false; if (alive.current) setBusy(false) }
  }
  const dirty = caseDirty || Boolean(eventForm) || creatingCase
  const select = params => { query.current = params; setNotice(''); setPage(0); setReload(value => value + 1) }
  const canWrite = !readOnly && data?.permissions?.can_write === true
  const matchingEvents = list(data?.events).filter(row => `${row.title} ${row.description}`.toLowerCase().includes(search.trim().toLowerCase()))
  const createCase = async e => {
    e.preventDefault()
    const result = await command('create_case', { baseline_id: data.baseline.id, reference_report_id: caseForm.reference_report_id, name: caseForm.name.trim(), event_ids: caseForm.event_ids }, 'Case created against the selected published report. Enter impact and recovery changes for review.')
    if (result) { setCreatingCase(false); setView('inputs') }
  }
  const download = async format => {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const response = await service.downloadDelayCase(projectId, data.case.id, format)
      const disposition = response.headers?.['content-disposition'] || ''
      const name = (disposition.match(/filename="([^"]+)"/i)?.[1] || `delay-case-${data.case.id}.${format}`).split(/[\\/]/).at(-1)
      const url = URL.createObjectURL(response.data), anchor = document.createElement('a')
      anchor.href = url; anchor.download = name; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice(`Case ${format.toUpperCase()} export prepared. The export records analysis and review; it does not change schedule dates.`)
    } catch (caught) { if (caught.response?.data instanceof Blob) { try { caught.response.data = JSON.parse(await caught.response.data.text()) } catch { /* Preserve the request error if the response is not JSON. */ } } setError(controlsError(caught)) }
    finally { inFlight.current = false; if (alive.current) setBusy(false) }
  }
  return <section className="planning-operational-controls planning-delay-analysis" aria-label="Delay and recovery analysis" aria-busy={loading || busy}><header className="poc-header"><div><h2><GitCompare size={18} />Delay & recovery</h2><p>Record events, compare technical impacts and review recovery recommendations against a published report.</p></div><div className="poc-actions"><button type="button" disabled={loading || busy || dirty} onClick={() => { setNotice(''); setReload(value => value + 1) }}><RefreshCw size={15} />Refresh delay analysis</button>{canWrite && data.baseline && <><button type="button" disabled={busy || dirty} onClick={() => { setEventForm({ creating: true }); setView('events') }}>Record delay event</button><button type="button" className="poc-primary" disabled={busy || dirty || !data.published_reports?.length} onClick={() => { setCreatingCase(true); setCaseForm({ name: '', reference_report_id: '', event_ids: [] }) }}>New impact case</button></>}</div></header>
    {error && <p className="poc-message is-error" role="alert"><AlertTriangle size={16} />{error}</p>}{notice && <p className="poc-message" role="status">{notice}</p>}
    {loading ? <p role="status"><Loader2 size={16} className="animate-spin" />Loading delay analysis…</p> : data && <><div className="poc-toolbar"><label>Approved baseline<select aria-label="Delay analysis baseline" disabled={busy || dirty} value={data.baseline?.id || ''} onChange={e => select(e.target.value ? { baseline_id: e.target.value } : {})}><option value="">Select baseline</option>{list(data.baselines).map(row => <option key={row.id} value={row.id}>{row.name || `Baseline ${row.id}`}</option>)}</select></label><label>Impact case<select aria-label="Delay analysis case" disabled={busy || dirty || !data.baseline} value={data.case?.id || ''} onChange={e => select({ baseline_id: data.baseline.id, ...(e.target.value ? { case_id: e.target.value } : {}) })}><option value="">Select case</option>{list(data.cases).map(row => <option key={row.id} value={row.id}>{row.name} · {label(row.status)} · Revision {row.revision}</option>)}</select></label>{data.case && <p className="poc-report-state">{label(data.case.status)} · Reference report {data.case.reference_report_id} · Revision {data.case.revision}</p>}</div>
      {dirty && <p className="poc-note">Unsaved delay inputs. Save or discard them before refreshing or switching cases.</p>}{readOnly && <p className="poc-message">This historical schedule view is read only. Open the current Master Schedule to manage delay cases.</p>}
      {!data.baseline ? <p className="poc-message">An approved baseline is required for delay analysis. No impact or recovery dates are assumed.</p> : <>{!data.published_reports?.length && <p className="poc-message">Publish an operational report before creating an impact case. The selected report will provide the frozen reference.</p>}
        {creatingCase && <form className="poc-section" aria-label="Create delay impact case" onSubmit={createCase}><h3>New impact case</h3><fieldset disabled={busy || !canWrite}><div className="poc-fields"><label>Case name<input aria-label="Delay case name" required value={caseForm.name} onChange={e => setCaseForm({ ...caseForm, name: e.target.value })} /></label><label>Published reference report<select aria-label="Delay case published report" required value={caseForm.reference_report_id} onChange={e => setCaseForm({ ...caseForm, reference_report_id: e.target.value })}><option value="">Choose a published report</option>{list(data.published_reports).filter(row => String(row.baseline_id) === String(data.baseline.id)).map(row => <option key={row.id} value={row.id}>{row.name || `Report ${row.id}`} · {row.data_date} · Revision {row.revision}</option>)}</select></label></div><fieldset><legend>Included events</legend>{list(data.events).map(row => <label className="poc-check" key={row.id}><input type="checkbox" aria-label={`Include delay event ${row.title}`} checked={caseForm.event_ids.includes(row.id)} onChange={e => setCaseForm({ ...caseForm, event_ids: e.target.checked ? [...caseForm.event_ids, row.id] : caseForm.event_ids.filter(id => id !== row.id) })} />{row.title}</label>)}{!data.events?.length && <p>Record an event before creating an impact case.</p>}</fieldset></fieldset><div className="poc-actions"><button type="submit" className="poc-primary" disabled={busy || !caseForm.name.trim() || !caseForm.reference_report_id || !caseForm.event_ids.length}>Create impact case</button><button type="button" disabled={busy} onClick={() => setCreatingCase(false)}>Cancel new case</button></div></form>}
        <div className="poc-tabs" role="tablist" aria-label="Delay analysis sections">{views.map(([key, title], index) => <button type="button" role="tab" key={key} aria-selected={view === key} tabIndex={view === key ? 0 : -1} aria-controls={`delay-view-${projectId}`} onClick={() => setView(key)} onKeyDown={e => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return; e.preventDefault(); const next = e.key === 'Home' ? 0 : e.key === 'End' ? views.length - 1 : (index + (e.key === 'ArrowLeft' ? -1 : 1) + views.length) % views.length; setView(views[next][0]); e.currentTarget.parentElement.querySelectorAll('[role=tab]')[next].focus() }}>{title}</button>)}</div>
        <div role="tabpanel" id={`delay-view-${projectId}`} aria-label={views.find(([key]) => key === view)?.[1]}>
          <div hidden={view !== 'events'}>{eventForm && <PlanningDelayEventForm key={eventForm.id || 'new'} data={data} event={eventForm.creating ? null : eventForm} busy={busy} onCommand={command} onClose={() => setEventForm(null)} />}<section className="poc-section" aria-label="Delay event register"><h3>Event register</h3><label>Search events<input aria-label="Search delay events" value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} /></label><div className="poc-table" role="region" aria-label="Recorded delay events" tabIndex={0}><table><thead><tr><th>Event</th><th>Dates</th><th>Status</th><th>Affected activities</th><th>Evidence</th><th>Review</th></tr></thead><tbody>{matchingEvents.slice(page * 25, (page + 1) * 25).map(row => <tr key={row.id}><th scope="row">{row.title}<span>{row.description}</span><small>Revision {row.revision}</small></th><td>{label(row.start_date)} → {label(row.end_date)}</td><td>{label(row.status)}</td><td>{list(row.activity_ids).map(id => <div key={id}>{list(data.activities).find(activity => String(activity.id) === String(id))?.external_id || id}</div>)}</td><td>{list(row.evidence).map((item, index) => <p key={index}>{item.reference}{item.document_version_id && <small>Document version {item.document_version_id}</small>}{item.fact_id && <small>Evidence fact {item.fact_id}</small>}</p>)}</td><td>{!readOnly && row.permissions?.can_edit && <button type="button" disabled={busy || dirty} onClick={() => setEventForm(row)}>Edit event {row.id}</button>}</td></tr>)}{!matchingEvents.length && <tr><td colSpan={6}>No recorded delay events match this selection.</td></tr>}</tbody></table></div><div className="poc-pagination"><span>{matchingEvents.length} events · Page {page + 1}</span><button type="button" aria-label="Previous delay events" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><button type="button" aria-label="Next delay events" disabled={(page + 1) * 25 >= matchingEvents.length} onClick={() => setPage(page + 1)}>Next</button></div></section></div>
          <div hidden={view !== 'inputs'}>{data.case ? <PlanningDelayCaseEditor key={`${data.case.id}:${data.case.revision}`} data={data} busy={busy || Boolean(eventForm) || creatingCase} readOnly={readOnly} onCommand={command} onDirty={setCaseDirty} /> : <p>Create or select an impact case to enter proposed changes.</p>}</div>
          {view === 'review' && <PlanningDelayReview data={data} busy={busy} dirty={dirty} readOnly={readOnly} onCommand={command} onExport={download} />}
        </div>
      </>}
    </>}
  </section>
}
PlanningDelayAnalysis.propTypes = { projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired, baselineId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), readOnly: PropTypes.bool }
