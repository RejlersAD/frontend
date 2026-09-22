import { useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { ArrowLeft, FileText, Loader2, RefreshCw, Search, X } from 'lucide-react'
import { planningIntelligenceService as service } from '../../services/planningIntelligence.service'
import PrimaveraActivitiesGantt from './PrimaveraActivitiesGantt'
import PlanningSourceScheduleImport from './PlanningSourceScheduleImport'
import { dateDisplayTask, floatEvidenceLabel } from '../../utils/planningDateEvidence'
import './PlanningSourceSchedule.css'

const date = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not Specified'
const sourceDate = (row, endpoint) => ['explicit_none', 'blank'].includes(row[`source_${endpoint}_status`]) ? '\u2014'
  : ['ambiguous', 'invalid', 'conflicting'].includes(row[`source_${endpoint}_status`]) ? 'Review source'
    : date(row[`source_${endpoint}_date`])
const sourceLabel = ref => {
  const locator = ref.locator || ref.source_locator || {}
  return [ref.filename || ref.source_filename || `Source ${ref.file_id || ''}`, locator.page != null ? `Page ${locator.page}` : null,
    locator.sheet, locator.row != null ? `Row ${locator.row}` : locator.line != null ? `Line ${locator.line}` : null].filter(Boolean).join(' · ')
}

const requestError = caught => {
  const body = caught.response?.data, message = body?.error || body?.detail
  return typeof message === 'string' ? message : caught.message || 'The source schedule request failed. Review the latest source and try again.'
}

export default function PlanningSourceSchedule({ projectId, projectName, masterRevision, readOnly = false, onEvidence, onInputs, onBack, onApplied }) {
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('')
  const [offset, setOffset] = useState(0), [query, setQuery] = useState(''), [search, setSearch] = useState(''), [reload, setReload] = useState(0)
  const [selectedId, setSelectedId] = useState(null)
  const [sourceFileId, setSourceFileId] = useState('')
  const [importOpen, setImportOpen] = useState(false), [proposal, setProposal] = useState(null), [importBusy, setImportBusy] = useState(false)
  const [importError, setImportError] = useState(''), [importStale, setImportStale] = useState(false)
  const alive = useRef(true), inFlight = useRef(false)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(''); setData(null); setSelectedId(null)
    service.getSourceSchedulePreview(projectId, { offset, limit: 100, search, ...(sourceFileId ? { source_file_id: Number(sourceFileId) } : {}) }, controller.signal)
      .then(result => { if (!controller.signal.aborted) setData(result) })
      .catch(caught => { if (!controller.signal.aborted) {
        const message = caught.response?.data?.error || caught.response?.data?.detail
        setError(typeof message === 'string' ? message : 'The extracted schedule could not be loaded. Retry or review project inputs.')
      } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [projectId, offset, search, sourceFileId, reload])
  const canImport = !readOnly && data?.can_import === true && Boolean(sourceFileId) && (data?.master_revision ?? masterRevision) != null
  const reviewImport = async () => {
    if (!canImport || inFlight.current) return
    inFlight.current = true; setImportBusy(true); setImportOpen(true); setProposal(null); setImportError(''); setImportStale(false)
    try {
      const latest = await service.getSourceSchedulePreview(projectId, { offset, limit: 100, search, source_file_id: Number(sourceFileId) })
      if (!alive.current) return
      setData(latest)
      if (latest.can_import !== true) throw new Error('Your permission to import this source has changed. Refresh the Master Schedule.')
      const result = await service.previewSourceScheduleImport(projectId, { source_file_id: Number(sourceFileId), master_revision: latest.master_revision ?? masterRevision })
      if (alive.current) setProposal(result)
    } catch (caught) { if (alive.current) setImportError(requestError(caught)) }
    finally { inFlight.current = false; if (alive.current) setImportBusy(false) }
  }
  const applyImport = async reason => {
    if (!canImport || inFlight.current || importStale || proposal?.can_apply !== true) return
    inFlight.current = true; setImportBusy(true); setImportError('')
    try {
      const result = await service.applySourceScheduleImport(projectId, { proposal_token: proposal.proposal_token, reason, acknowledge_scope: true })
      if (alive.current) { setImportOpen(false); onApplied?.(result) }
    } catch (caught) { if (alive.current) { setImportError(requestError(caught)); if (caught.response?.status === 409) setImportStale(true) } }
    finally { inFlight.current = false; if (alive.current) setImportBusy(false) }
  }
  const tasks = useMemo(() => (data?.rows || []).map(row => ({ ...row, activity_code: row.source_activity_id || 'Not Specified',
    discipline: 'source', duration_source: row.duration_days == null ? 'missing_source' : 'source_document', duration_calendar_verified: false,
    source_date_references: row.source_references, planned_start_date: null, planned_finish_date: null,
    total_float_days: null, is_critical: null, calculated: false,
    depends_on: (row.predecessors || []).map(link => link.id), dependency_details: (row.predecessors || []).map(link => ({
      task_id: link.id, type: link.type, lag_days: link.lag_days, lag_unit: link.lag_unit, source: 'source_document', source_references: link.source_references,
    })),
  })), [data])
  const plan = useMemo(() => ({ project: { name: 'Extracted source activities' }, evidence_policy: 'document_driven', duration_policy: 'source_only', calculation_available: false }), [])
  const selected = tasks.find(row => row.id === selectedId)
  const selectedDisplay = selected ? dateDisplayTask(selected) : null
  const summary = data?.summary || {}, page = data?.pagination || {}
  return <section className="psp-preview" aria-label="Extracted source schedule">
    <header className="psp-heading"><div><h3>Extracted source schedule</h3><p>Current uploaded documents. These rows have not replaced your MDR or calculated the working plan.</p></div><button type="button" onClick={onBack}><ArrowLeft size={15} />Working plan</button></header>
    <div className="psp-actions"><form onSubmit={event => { event.preventDefault(); setOffset(0); setSearch(query.trim()) }}><label><Search size={15} /><input aria-label="Search extracted schedule" value={query} onChange={event => setQuery(event.target.value)} placeholder="Activity ID or name" /></label><button type="submit" disabled={loading}>Search</button></form><button type="button" disabled={loading} onClick={() => setReload(value => value + 1)}><RefreshCw size={15} />Refresh</button><button type="button" onClick={onInputs}>Project inputs</button><button type="button" className="psp-primary" onClick={onEvidence}><FileText size={15} />Review & link source evidence</button></div>
    {data && <div className="psp-source-choice"><label>Source document<select aria-label="Source schedule document" value={sourceFileId} onChange={event => { setSourceFileId(event.target.value); setOffset(0); setQuery(''); setSearch(''); setProposal(null) }}><option value="">All source documents</option>{(data.source_files || []).filter(file => file.activity_count > 0 || String(file.id) === sourceFileId).map(file => <option key={file.id} value={file.id}>{file.original_filename} ({file.activity_count ?? 0} activities)</option>)}</select></label>{!readOnly && data.can_import === true && <button type="button" className="psp-primary" disabled={!canImport || loading || importBusy || !summary.activity_count} onClick={reviewImport}>Review & use in Master Schedule</button>}{!sourceFileId && !readOnly && data.can_import === true && <span>Select one source document to review its import.</span>}</div>}
    {loading && <p className="psp-status" role="status"><Loader2 size={17} className="animate-spin" />Loading extracted schedule…</p>}
    {error && <p className="psp-error" role="alert">{error}</p>}
    {data && <>
      <div className="psp-summary"><span><strong>{summary.activity_count ?? 0}</strong> recovered rows</span><span><strong>{summary.duration_count ?? 0}</strong> with durations</span><span><strong>{summary.relationship_count ?? 0}</strong> explicit relationships</span><span><strong>{summary.unmapped_register_count ?? 0}</strong> MDR rows awaiting source links</span></div>
      <p className="psp-boundary">Project window: <strong>{date(data.project_window?.start_date)} — {date(data.project_window?.finish_date)}</strong>. Source dates remain as printed; dates outside this window require review.</p>
      {summary.activity_count > 0 && <p className="psp-guidance">Review the extracted rows and confirm which activities belong to the MDR scope in Evidence. {summary.relationship_count === 0 ? 'No explicit predecessor relationships were recovered. Review the original logic or record approved planning rules before calculating float.' : 'Review extracted relationships and the working calendar before calculating float.'}</p>}
      <div className="psp-pagination"><span>{page.total ? `${offset + 1}–${Math.min(offset + tasks.length, page.total)} of ${page.total} rows${search ? ' matching search' : ''}` : 'No matching source rows'}</span><button type="button" disabled={loading || offset === 0} onClick={() => setOffset(value => Math.max(0, value - 100))}>Previous</button><button type="button" disabled={loading || !page.has_next} onClick={() => setOffset(value => value + 100)}>Next</button></div>
      {tasks.length > 0 ? <PrimaveraActivitiesGantt plan={plan} tasks={tasks} disciplines={[]} display="activities" zoom="month" fitTimeline locked selectedId={selectedId} onSelect={task => setSelectedId(task.id)} onEdit={() => {}} onInputs={onInputs} /> : <p className="psp-status">{search ? 'No source activities match this search.' : 'No supported schedule activity rows were recovered. Review extraction coverage and the uploaded schedule.'}</p>}
      {selected && <aside className="psp-citation" aria-label="Extracted activity evidence"><header><h4>{selected.source_activity_id} · {selected.title}</h4><button type="button" aria-label="Close source activity evidence" onClick={() => setSelectedId(null)}><X size={17} /></button></header><p>Duration: {selected.duration_days == null ? 'Not Specified' : `${selected.duration_days} ${selected.duration_unit || '(unit Not Specified)'}`} · Start: {sourceDate(selected, 'start')} · Finish: {sourceDate(selected, 'finish')}</p>{selectedDisplay.display_float_basis === 'source' && <p title={floatEvidenceLabel(selectedDisplay)}>Source total float: {selectedDisplay.display_total_float_days} days as printed. This is not a RADAI calculation.</p>}{(selected.source_references || []).map((ref, index) => <div key={index}><strong>{sourceLabel(ref)}</strong>{(ref.excerpt || ref.source_excerpt) && <blockquote>{ref.excerpt || ref.source_excerpt}</blockquote>}</div>)}<p>{selected.printed_single_date && <>Printed date: {date(selected.printed_single_date)}. Its Start or Finish column needs verification. </>}Source values require review; total float has not been calculated.</p></aside>}
      <details className="psp-findings"><summary>Extraction coverage and review findings</summary>{(data.extraction_reports || []).map((report, index) => <p key={index}>{report.filename || report.source_filename || report.name || `Source ${report.file_id || index + 1}`}: {report.status || 'Review required'}{report.row_count != null ? ` · ${report.row_count} rows` : ''}</p>)}{(data.validation || []).map((item, index) => <p key={index}>{item.message || item.code}{item.count > 1 ? ` (${item.count} rows)` : ''}</p>)}</details>
    </>}
    {importOpen && <PlanningSourceScheduleImport proposal={proposal} projectName={projectName} projectWindow={data?.project_window} busy={importBusy} error={importError} stale={importStale} onClose={() => { if (!importBusy) setImportOpen(false) }} onRetry={reviewImport} onApply={applyImport} />}
  </section>
}
PlanningSourceSchedule.propTypes = { projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired, projectName: PropTypes.string, masterRevision: PropTypes.number, readOnly: PropTypes.bool, onEvidence: PropTypes.func.isRequired, onInputs: PropTypes.func.isRequired, onBack: PropTypes.func.isRequired, onApplied: PropTypes.func }
