/* eslint-disable react/prop-types */
import { useEffect, useId, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, FileText, Loader2, RefreshCw, Sparkles, Upload, X } from 'lucide-react'
import { agreementError, agreementWorkspaceService } from '../../../services/agreementWorkspace.service'
import './AgreementWorkspace.css'

export const AGREEMENT_AREAS = [
  { key: 'overview', view: 'project-dashboard', label: 'Overview' },
  { key: 'schedule', view: 'plan-baseline', label: 'Schedule' },
  { key: 'commercials', view: 'commercial-dashboard', label: 'Cost & Commercial' },
  { key: 'milestones', view: 'milestones', label: 'Milestones' },
  { key: 'risks', view: 'risk', label: 'Risks & Changes' },
  { key: 'estimates', view: 'estimates', label: 'Estimates' },
  { key: 'documents', view: 'documents', label: 'Documents' },
  { key: 'activity', view: 'activity', label: 'Activity & Audit' },
]
const BASIS = { document_fact: 'Document fact', ai_proposal: 'AI proposal', calculated: 'Calculated', recorded: 'Recorded activity', missing: 'Missing input', conflict: 'Conflicting input' }
const NOTES = {
  schedule: 'Contractual timing and draft work breakdown. Confirm durations, calendars and dependency logic before calculating dates and float.',
  commercials: 'Contract price and payment terms. Cost budgets, actual costs and earned value require their own records.',
  milestones: 'Relative milestones retain their stated starting event. Completion needs actual acceptance evidence.',
  risks: 'Proposed risks need owners, impact assessments and responses. Approved changes require a variation record.',
  estimates: 'Estimate requirements and contractual allowances. An accuracy requirement is separate from a completed cost estimate.',
  documents: 'Uploaded agreement and required deliverables. Referenced documents may still need to be uploaded.',
  activity: 'Agreement upload, analysis and acceptance history. Existing project activity appears below.',
}
const textValue = value => value == null ? 'Not recorded' : typeof value === 'string' || typeof value === 'number' ? String(value) : Array.isArray(value) ? value.map(textValue).join(' · ') : Object.entries(value).map(([key, item]) => `${key.replaceAll('_', ' ')}: ${textValue(item)}`).join(' · ')
const number = value => Number(value || 0).toLocaleString('en-GB')
const active = job => ['queued', 'running'].includes(job?.status)
const requestId = () => window.crypto.randomUUID()
const fileError = file => !file ? '' : file.size > 100 * 1024 * 1024 ? 'Choose an agreement smaller than 100 MB.' : !/\.(pdf|docx|xlsx|csv|txt)$/i.test(file.name) ? 'Choose a PDF, Word document, spreadsheet, CSV or text file.' : ''

function SourceReferences({ sources = [], files = [] }) {
  if (!sources.length) return <span className="aw-muted">No document citation</span>
  return <details className="aw-sources"><summary><FileText size={13} aria-hidden="true" />{sources.map(source => `${source.filename || 'Agreement'}${source.page ? ` · p. ${source.page}` : ''}`).join('; ')}</summary><div>{sources.map((source, index) => {
    const file = files.find(item => String(item.id) === String(source.file_id))
    const url = file?.url && /^(https?:\/\/|\/(?!\/))/.test(file.url) ? `${file.url.split('#')[0]}${source.page ? `#page=${encodeURIComponent(source.page)}` : ''}` : null
    return <blockquote key={`${source.file_id || 'source'}:${source.page}:${index}`}><strong>{source.filename || 'Agreement'}{source.page ? ` · PDF page ${source.page}` : ''}</strong><p>{source.quote || 'No quoted passage is available.'}</p>{source.quote_verified === false && <small>Source passage needs verification.</small>}{url && <a href={url} target="_blank" rel="noopener noreferrer">Open source{source.page ? ` page ${source.page}` : ''}</a>}</blockquote>
  })}</div></details>
}

function WorkBreakdown({ phases }) {
  const count = phases.reduce((total, phase) => total + (phase.disciplines ? phase.disciplines.reduce((sum, discipline) => sum + (discipline.deliverables?.length || 0), 0) : 1), 0)
  return <details className="aw-wbs"><summary>Draft work breakdown · {number(count)} {count === 1 ? 'deliverable' : 'deliverables'}</summary><div className="aw-wbs-scroll"><ul>{phases.map((phase, index) => <li key={phase.id || `${phase.name}:${index}`}><strong>{phase.code || phase.wbs_code || ''} {phase.name || phase.label || phase.title}</strong> <span className="aw-badge aw-ai_proposal">{BASIS[phase.basis] || 'AI proposal'}</span>{phase.disciplines?.length > 0 && <ul>{phase.disciplines.map((discipline, position) => <li key={`${discipline.name}:${position}`}><strong>{discipline.name}</strong><ul>{(discipline.deliverables || []).map((deliverable, itemIndex) => <li key={deliverable.id || itemIndex}><span>{deliverable.name || deliverable.label}</span> <span className={`aw-badge aw-${deliverable.status === 'proposed' ? 'ai_proposal' : 'document_fact'}`}>{deliverable.status === 'proposed' ? 'AI proposal' : 'Document fact'}</span>{deliverable.status === 'accepted' && <span className="aw-badge aw-accepted">Accepted</span>}</li>)}</ul></li>)}</ul>}</li>)}</ul></div></details>
}

export function AgreementSection({ draft, area, files, compact = false }) {
  const section = draft?.projection?.[area]
  if (!section) return null
  const descriptor = AGREEMENT_AREAS.find(item => item.key === area)
  const rows = section.items || []
  const uploads = area === 'documents' ? section.uploads || [] : []
  return <section className={`aw-section${compact ? ' aw-section-compact' : ''}`} aria-label={`Agreement ${descriptor?.label || area}`}>
    <div className="aw-section-title"><h3>{descriptor?.label || area} from agreement</h3><span>{number(rows.length)} {rows.length === 1 ? 'input' : 'inputs'}</span></div>
    {NOTES[area] && <p className="aw-note">{NOTES[area]}</p>}
    {rows.length ? <div className="aw-table-wrap" role="region" aria-label={`${descriptor?.label || area} agreement inputs`} tabIndex={0}><table className="aw-table" data-table-typography="preserve"><thead><tr><th scope="col">Input</th><th scope="col">Value / requirement</th><th scope="col">Basis</th><th scope="col">Source reference</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.id || index}><th scope="row">{row.label || row.field?.replaceAll('_', ' ') || 'Agreement input'}</th><td><span>{row.display_value || textValue(row.value)}</span>{row.status === 'conflict' && <small className="aw-conflict">Decision required</small>}{row.status === 'not_selected' && <small>Alternative retained in source history</small>}</td><td><span className={`aw-badge aw-${row.status === 'conflict' ? 'conflict' : row.basis || 'document_fact'}`}>{row.status === 'conflict' ? 'Conflicting input' : BASIS[row.basis] || 'Source input'}</span>{row.status === 'accepted' && <small className="aw-accepted"><CheckCircle2 size={12} aria-hidden="true" />Accepted</small>}</td><td><SourceReferences sources={row.sources} files={files} /></td></tr>)}</tbody></table></div> : <p className="aw-empty">No supported {descriptor?.label.toLowerCase() || area} inputs were extracted. Add the missing project information when it is available.</p>}
    {uploads.length > 0 && <ul className="aw-uploads">{uploads.map((file, index) => <li key={file.file_id || file.id || index}><FileText size={15} aria-hidden="true" /><span>{file.filename || file.name || 'Uploaded agreement'}</span>{file.page_count && <small>{file.page_count} pages</small>}</li>)}</ul>}
    {area === 'schedule' && section.wbs?.length > 0 && <WorkBreakdown phases={section.wbs} />}
  </section>
}

function Exceptions({ exceptions = [], draft, selected, onSelect, disabled }) {
  if (!exceptions.length) return null
  const facts = new Map(Object.values(draft?.projection || {}).flatMap(section => section.items || []).map(item => [item.id, item]))
  return <details className="aw-exceptions" open><summary><AlertTriangle size={16} aria-hidden="true" /><strong>{number(exceptions.length)} exception {exceptions.length === 1 ? 'group' : 'groups'} need attention</strong><span>Supported inputs can still be accepted together.</span><ChevronDown size={15} aria-hidden="true" /></summary><ul>{exceptions.map((item, index) => {
    const key = item.key || `${item.code}:${index}`
    const candidates = item.code === 'source_conflicts' ? (item.fact_ids || []).map(id => facts.get(id)).filter(candidate => candidate?.status === 'conflict') : []
    return <li key={key}><div><strong>{item.label || item.code?.replaceAll('_', ' ') || 'Input to confirm'}</strong>{item.count > 1 && <span className="aw-count">{number(item.count)}</span>}</div>{item.details && <p>{textValue(item.details)}</p>}{candidates.length > 1 && <details className="aw-conflict-options"><summary>Review source options</summary><fieldset disabled={disabled}><legend>{item.label}</legend><label><input type="radio" name={key} checked={!selected[key]} onChange={() => onSelect(key, null)} />Keep unresolved</label>{candidates.map(candidate => <label key={candidate.id}><input type="radio" name={key} checked={selected[key] === candidate.id} onChange={() => onSelect(key, candidate.id)} /><span>{candidate.display_value || textValue(candidate.value)}<small>{candidate.sources?.map(source => `${source.filename} · p. ${source.page}`).join('; ')}</small></span></label>)}</fieldset></details>}</li>
  })}</ul></details>
}

function AgreementFileInput({ file, onChange, disabled, label = 'Agreement document' }) {
  const id = useId()
  return <label className="aw-file" htmlFor={id}><span><Upload size={16} aria-hidden="true" />{file?.name || 'Choose agreement document'}</span><input id={id} aria-label={label} type="file" accept=".pdf,.docx,.xlsx,.csv,.txt" disabled={disabled} onChange={event => onChange(event.target.files?.[0] || null)} /></label>
}

export default function AgreementWorkspace({ workspace, view, embedded = false }) {
  const { data, loading, error, busy, running, reload, analyze, accept } = workspace
  const [file, setFile] = useState(null)
  const [savedFile, setSavedFile] = useState('')
  const [token, setToken] = useState(requestId)
  const [replace, setReplace] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [selected, setSelected] = useState({})
  const [reason, setReason] = useState('')
  const draft = data?.workspace
  const job = data?.active_job || data?.latest_job
  const area = AGREEMENT_AREAS.find(item => item.view === view)?.key || (view === 'cost-dashboard' ? 'commercials' : 'overview')
  const canAnalyze = data?.permissions?.can_analyze === true
  const canAccept = data?.permissions?.can_accept === true
  const locked = loading || Boolean(busy) || running
  const accepted = draft?.status === 'accepted'
  const supported = draft?.counts?.supported ?? draft?.counts?.supported_facts
  const hasConflictChoices = draft?.exceptions?.some(item => item.code === 'source_conflicts' && item.fact_ids?.length > 1)
  const selectedIds = Object.values(selected).filter(Boolean)
  const sourceFiles = (data?.files || []).filter(item => /\.(pdf|docx|xlsx|csv|txt)$/i.test(item.original_filename || ''))
  useEffect(() => { setSelected({}); setReason('') }, [draft?.id, draft?.revision])
  const chooseFile = value => { setFile(value); setSavedFile(''); setToken(requestId()) }
  const submit = async () => { if ((file || savedFile) && !fileError(file) && await analyze(file || Number(savedFile), token)) { setFile(null); setSavedFile(''); setReplace(false) } }
  const acceptInputs = () => accept(selectedIds.length ? { selected_fact_ids: selectedIds, reason: reason.trim() } : undefined)
  return <section className="aw-workspace" aria-label="Agreement project setup" aria-busy={Boolean(busy || loading)}>
    {(!embedded || draft) && <>
    <header className="aw-header"><div className="aw-heading"><Sparkles size={18} aria-hidden="true" /><div><h2>{draft ? 'Agreement project draft' : 'Set up project from an agreement'}</h2><p>{draft ? 'One source, shared across all project work areas.' : 'Upload once to extract scope, timing, commercial terms, milestones and requirements.'}</p></div>{accepted && <span className="aw-badge aw-accepted"><CheckCircle2 size={13} aria-hidden="true" />Supported inputs accepted</span>}</div><div className="aw-actions">{draft && (!accepted || hasConflictChoices) && <button type="button" className="aw-button aw-primary" disabled={locked || !canAccept || (supported === 0 && !selectedIds.length) || (selectedIds.length > 0 && reason.trim().length < 20)} onClick={acceptInputs}>{busy === 'accept' ? <><Loader2 size={15} className="aw-spin" aria-hidden="true" />Building draft…</> : 'Accept supported inputs & build draft'}</button>}{draft && <button type="button" className="aw-button aw-icon" aria-label={expanded ? 'Collapse agreement draft' : 'Expand agreement draft'} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}><ChevronDown size={17} className={expanded ? 'aw-chevron-open' : ''} aria-hidden="true" /></button>}</div></header>
    </>}
    {error && <div className="aw-error" role="alert"><AlertTriangle size={16} aria-hidden="true" /><span>{error}</span><button type="button" className="aw-button" onClick={reload} disabled={Boolean(busy)}><RefreshCw size={14} aria-hidden="true" />Check progress</button></div>}
    {draft?.stale && <div className="aw-error" role="alert"><AlertTriangle size={16} aria-hidden="true" /><span>Agreement sources have changed. Analyze the current document to refresh these inputs.</span></div>}
    {loading && !data && <p className="aw-status" role="status"><Loader2 size={16} className="aw-spin" aria-hidden="true" />Loading saved agreement workspace…</p>}
    {job && active(job) && <div className="aw-progress" role="status"><div><Loader2 size={16} className="aw-spin" aria-hidden="true" /><strong>{job.message || 'Analyzing agreement and preparing project inputs…'}</strong><span>{number(job.progress)}%</span></div><progress aria-label="Agreement analysis progress" value={Number(job.progress || 0)} max="100" /><p>You can use other project tabs while analysis continues. Progress is saved.</p></div>}
    {job && ['failed', 'cancelled'].includes(job.status) && !running && <div className="aw-error" role="alert"><AlertTriangle size={16} aria-hidden="true" /><span>{job.error_message || job.message || 'Agreement analysis did not finish. Choose the document to retry.'}</span></div>}
    {fileError(file) && <p className="aw-error" role="alert">{fileError(file)}</p>}
    {(!draft || replace) && !running && data && <div className="aw-upload"><AgreementFileInput file={file} onChange={chooseFile} disabled={locked || !canAnalyze} />{sourceFiles.length > 0 && <label className="aw-saved-file">Or use saved agreement<select aria-label="Saved agreement" value={savedFile} disabled={locked || !canAnalyze} onChange={event => { setSavedFile(event.target.value); setFile(null); setToken(requestId()) }}><option value="">Select uploaded agreement</option>{sourceFiles.map(item => <option key={item.id} value={item.id}>{item.original_filename}</option>)}</select></label>}<button type="button" className="aw-button aw-primary" disabled={(!file && !savedFile) || locked || !canAnalyze || Boolean(fileError(file))} onClick={submit}>{busy === 'analyze' ? <><Loader2 size={16} className="aw-spin" aria-hidden="true" />Uploading agreement…</> : <><Sparkles size={16} aria-hidden="true" />Analyze &amp; set up project</>}</button>{replace && <button type="button" className="aw-button" onClick={() => { setReplace(false); setFile(null); setSavedFile('') }} disabled={locked}>Cancel</button>}<p>{!canAnalyze ? data.permissions?.analyze_reason || 'Project update permission is required to analyze an agreement.' : 'Text and scanned pages are checked. Review grouped exceptions before establishing a baseline.'}</p>{data.ai?.available === false && <p>AI suggestions: {data.ai.reason || 'Project AI connection is not configured.'} Source-supported extraction remains available.</p>}</div>}
    {draft && expanded && <div className="aw-content">
      <div className="aw-coverage" aria-label="Agreement coverage"><span><strong>{number(draft.counts?.document_facts)}</strong> document facts</span><span><strong>{number(draft.counts?.proposals)}</strong> AI proposals</span><span><strong>{number(draft.counts?.accepted)}</strong> accepted</span><span>Shared across the project tabs above</span></div>
      <Exceptions exceptions={draft.exceptions} draft={draft} selected={selected} onSelect={(key, value) => setSelected(current => ({ ...current, [key]: value }))} disabled={locked || !canAccept} />
      {selectedIds.length > 0 && <label className="aw-decision-reason">Reason for choosing source values<input aria-label="Source decision reason" value={reason} onChange={event => setReason(event.target.value)} disabled={locked} minLength={20} maxLength={4000} placeholder="Explain which source governs these choices (at least 20 characters)." /><span>{selectedIds.length} conflict {selectedIds.length === 1 ? 'choice' : 'choices'} will be accepted with the supported inputs.</span></label>}
      <AgreementSection draft={draft} area={area} files={data.files} />
      <footer className="aw-footer"><span>{accepted ? 'Accepted document inputs are available across the project. Proposals and exceptions retain their review status.' : `${supported == null ? 'Document-supported' : number(supported)} inputs can be accepted together. AI proposals and missing information retain their review status.`}</span><button type="button" className="aw-text-button" onClick={() => setReplace(value => !value)} disabled={locked || !canAnalyze}>Analyze another agreement</button></footer>
      {!canAccept && !accepted && <p className="aw-note">{data.permissions?.accept_reason || (draft.stale ? 'Analyze the current source files before accepting inputs.' : running ? 'Agreement analysis is in progress.' : 'Project update permission is required to accept supported inputs.')}</p>}
    </div>}
  </section>
}

export function AgreementSetupDialog({ open, workspace, view, onClose }) {
  const ref = useRef(null)
  const id = useId()
  useEffect(() => {
    if (!open) return undefined
    const dialog = ref.current, opener = document.activeElement
    dialog.showModal()
    return () => { dialog.close(); if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [open])
  return <dialog className="aw-dialog aw-setup-dialog" ref={ref} aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); onClose() }}>
    <header><div><h2 id={`${id}-title`}>Analyze &amp; set up project</h2><p>Choose an agreement to prepare project inputs, or review the saved analysis.</p></div><button type="button" className="aw-button aw-icon" aria-label="Close agreement setup" onClick={onClose}><X size={18} aria-hidden="true" /></button></header>
    <div className="aw-setup-body"><AgreementWorkspace workspace={workspace} view={view} embedded /></div>
  </dialog>
}

export function AgreementCreateDialog({ initialValues = {}, onClose, onCreated }) {
  const ref = useRef(null)
  const controller = useRef(null)
  const id = useId()
  const [file, setFile] = useState(null)
  const [values, setValues] = useState({ name: initialValues.name || '', code: initialValues.code || '', ai_api_key: '', ai_model: '' })
  const [token, setToken] = useState(requestId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const dialog = ref.current, opener = document.activeElement
    dialog.showModal()
    return () => { controller.current?.abort(); dialog.close(); if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [])
  const updateValue = (field, value) => { setValues(current => ({ ...current, [field]: value })); setToken(requestId()) }
  const create = async event => {
    event.preventDefault()
    if (!file || fileError(file) || controller.current) return
    const request = new AbortController()
    controller.current = request; setBusy(true); setError('')
    try {
      const data = await agreementWorkspaceService.create(file, values, token, request.signal)
      if (!request.signal.aborted) await onCreated(data)
    } catch (reason) {
      if (!request.signal.aborted) setError(agreementError(reason))
    } finally {
      if (!request.signal.aborted) { controller.current = null; setBusy(false) }
    }
  }
  return <dialog className="aw-dialog" ref={ref} aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <header><div><h2 id={`${id}-title`}>Create project from an agreement</h2><p>Upload once to prepare all eight project work areas.</p></div><button type="button" className="aw-button aw-icon" aria-label="Close agreement setup" disabled={busy} onClick={onClose}><X size={18} aria-hidden="true" /></button></header>
    <form onSubmit={create}><div className="aw-dialog-body">
      {(error || fileError(file)) && <p className="aw-error" role="alert">{fileError(file) || error}</p>}
      <AgreementFileInput file={file} onChange={value => { setFile(value); setToken(requestId()) }} disabled={busy} />
      <div className="aw-fields"><label>Project name <span>(optional)</span><input value={values.name} maxLength={255} disabled={busy} onChange={event => updateValue('name', event.target.value)} /></label><label>Project code <span>(optional)</span><input value={values.code} maxLength={50} disabled={busy} onChange={event => updateValue('code', event.target.value)} /></label></div>
      <details className="aw-connection"><summary>Connect Anthropic for AI suggestions (optional)</summary><p>Use a key for this project. RADAI stores it securely; existing projects use their own saved connection.</p><div className="aw-fields"><label>Anthropic API key<input type="password" autoComplete="new-password" spellCheck={false} value={values.ai_api_key} disabled={busy} onChange={event => updateValue('ai_api_key', event.target.value)} /></label><label>Anthropic model <span>(optional)</span><input autoComplete="off" spellCheck={false} value={values.ai_model} maxLength={100} disabled={busy} placeholder="Use configured project default" onChange={event => updateValue('ai_model', event.target.value)} /></label></div></details>
      <p className="aw-note">RADAI saves a draft project and analyzes the agreement in the background. Document facts include page references; unresolved dates and other exceptions stay visible for review.</p>
    </div><footer><button type="button" className="aw-button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="aw-button aw-primary" disabled={busy || !file || Boolean(fileError(file))}>{busy ? <><Loader2 size={16} className="aw-spin" aria-hidden="true" />Uploading agreement…</> : <><Sparkles size={16} aria-hidden="true" />Analyze &amp; set up project</>}</button></footer></form>
  </dialog>
}
