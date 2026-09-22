/* eslint-disable react/prop-types */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, ArrowLeft, ArrowRight, Calculator, Check, CheckCircle2, ClipboardList, Download, FileSpreadsheet, FileText, Info, ListChecks, Loader2, MoreHorizontal, Settings2, Trash2, Upload, X } from 'lucide-react'
import apiClient from '../../services/api.service'
import planningService from '../../services/planningIntelligence.service'
import { PLANNING_ENDPOINTS, PLANNING_FILE_CATEGORIES, PLANNING_MAX_FILE_MB } from '../../config/planningIntelligence.config'
import { calculatePlanningDuration } from '../../utils/planningProjectDates'
import './PlanningInputsPanel.css'

const draftFrom = (project, enterprise) => ({
  planning_mode: project?.planning_mode || enterprise?.custom_fields?.planning_mode || (enterprise?.custom_fields?.project_type && enterprise.custom_fields.project_type !== 'engineering' ? 'manual' : 'document'),
  scope_summary: (project ? project.scope_summary : enterprise?.description) || '', exclusions: project?.exclusions || '',
  phase: (project ? project.phase : enterprise?.custom_fields?.project_phase) || '',
  effective_date: (project ? project.effective_date : enterprise?.start_date) || '',
  planned_end_date: (project ? project.planned_end_date : enterprise?.end_date) || '',
  budgeted_effort_hours: project?.budgeted_effort_hours ?? '',
})
const factText = fact => typeof fact.value === 'object' && fact.value !== null
  ? fact.value.name || fact.value.title || fact.value.description || fact.normalized_value || JSON.stringify(fact.value)
  : String(fact.value ?? fact.normalized_value ?? '')
const sourceText = fact => {
  const locator = fact.source_locator || {}
  const location = [['page', 'p.'], ['sheet', 'sheet'], ['row', 'row'], ['line', 'line'], ['paragraph', 'paragraph']]
    .filter(([key]) => locator[key] !== undefined && locator[key] !== null)
    .map(([key, label]) => `${label} ${locator[key]}`).join(' · ')
  return [fact.source_filename || (fact.extraction_method === 'manual' ? 'Planner input' : 'Source document'), location].filter(Boolean).join(' · ')
}
const errorText = (error, fallback) => {
  const data = error?.response?.data
  if (typeof data?.detail === 'string') return data.detail
  if (typeof data?.error === 'string') return data.error
  if (data && typeof data === 'object') return Object.entries(data).map(([key, value]) => `${key.replaceAll('_', ' ')}: ${Array.isArray(value) ? value.join(' ') : String(value)}`).join(' · ')
  return fallback
}
async function allRecords(endpoint, params, signal) {
  let page = 1, rows = []
  do {
    const response = await apiClient.get(endpoint, { params: { ...params, page }, signal })
    rows = rows.concat(response.data?.results ?? response.data ?? [])
    if (!response.data?.next) return rows
    page += 1
  } while (page <= 1000)
  throw new Error('The complete input review could not be loaded.')
}

async function latestCompletedRun(projectId, signal) {
  // Runs are returned newest first. Avoid loading older, fully compiled previews
  // once the completed analysis used by this panel has been found.
  for (let page = 1; page <= 1000; page += 1) {
    const response = await apiClient.get(PLANNING_ENDPOINTS.intelligenceRuns, { params: { project: projectId, page }, signal })
    const run = (response.data?.results ?? response.data ?? []).find(item => item.status === 'succeeded')
    if (run || !response.data?.next) return run || null
  }
  throw new Error('The latest completed input analysis could not be loaded.')
}

function InputReviewDialog({ facts, conflicts, busy, error, stale, previewAvailable, onPreview, onReview, onResolve, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current, opener = document.activeElement
    dialog.showModal()
    return () => { dialog.close(); if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [])
  return <dialog ref={ref} className="planning-input-dialog" aria-labelledby="planning-review-title" onCancel={event => { if (busy) event.preventDefault(); else onClose() }}>
    <header><div><h2 id="planning-review-title">Review &amp; confirm inputs</h2><p>Review the source evidence before confirming each finding.</p></div><button type="button" className="pln-icon-button" aria-label="Close input review" disabled={busy} onClick={onClose}><X size={20} /></button></header>
    <div className="pln-dialog-body">
      {error && <p className="pln-error" role="alert">{error}</p>}
      {stale && <p className="pln-error">Source documents have changed. Close this review and analyze the documents again before continuing.</p>}
      {conflicts.length > 0 && <section className="pln-clarification"><h3><AlertTriangle size={19} />Clarifications required</h3>{conflicts.map(conflict => <div className="pln-conflict" key={conflict.id}><p>{conflict.description}</p>{(conflict.facts || facts.filter(fact => conflict.fact_ids?.includes(fact.id))).map(fact => <div className="pln-conflict-value" key={fact.id}><div><strong>{factText(fact)}</strong><small>{sourceText(fact)}</small></div><button type="button" className="pln-button" disabled={busy} onClick={() => onResolve(conflict.id, fact.id)}>Use this value</button></div>)}</div>)}</section>}
      <ul className="pln-review-list">{facts.map(fact => <li key={fact.id}><FileText size={19} aria-hidden="true" /><div><strong>{factText(fact)}</strong><small>{sourceText(fact)}</small>{fact.source_excerpt && <blockquote>{fact.source_excerpt}</blockquote>}<span className={`pln-status ${fact.status === 'confirmed' ? 'is-done' : ''}`}>{fact.status.replaceAll('_', ' ')}</span></div><div className="pln-review-actions"><button type="button" className="pln-button" disabled={busy || fact.status === 'confirmed' || fact.status === 'conflicted' || fact.status === 'superseded'} onClick={() => onReview(fact.id, 'confirmed')}><Check size={14} />Confirm</button><button type="button" className="pln-text-button" disabled={busy || fact.status === 'rejected' || fact.status === 'conflicted' || fact.status === 'superseded'} onClick={() => onReview(fact.id, 'rejected')}>Reject</button></div></li>)}</ul>
      {!facts.length && <p className="pln-empty">No extracted inputs yet. Analyze the reference documents to begin.</p>}
    </div><footer><button type="button" className="pln-button" disabled={busy} onClick={onClose}>Close</button><button type="button" className="pln-button" disabled={busy || !previewAvailable} onClick={onPreview}><FileText size={16} />Document Intelligence Preview</button></footer>
  </dialog>
}

export default function PlanningInputsPanel({ project, enterpriseProject, contract, loadingContract, files, uploading, analyzing, analysisRevision, uploadCategory, onUploadCategory, onUpload, onDeleteFile, onAnalyze, onSaved, onOpenWorkBreakdown, onOpenIntelligencePreview, onPreviewStaleChanged, onReviewStateChanged, reviewRequest = 0, onReadinessChanged, onBack, onAiSettings, onRevealInputs, onIntelligenceLoaded, hidden = false, simple = false, generateSchedule = false }) {
  const [draft, setDraft] = useState(() => draftFrom(project, enterpriseProject))
  const [saving, setSaving] = useState(false)
  const [preparingUpload, setPreparingUpload] = useState(false)
  const [notice, setNotice] = useState(null)
  const [review, setReview] = useState({ run: null, facts: [], conflicts: [] })
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewBusy, setReviewBusy] = useState(false)
  const [analysisNeeded, setAnalysisNeeded] = useState(false)
  const inputRef = useRef(null), endDateRef = useRef(null), requestSequence = useRef(0), saveInFlight = useRef(false)
  const uploadDraftRef = useRef(null)
  const reviewController = useRef(null)
  const baselineLocked = Boolean(contract?.baseline_locked)
  const manual = draft.planning_mode === 'manual'
  const duration = calculatePlanningDuration(draft.effective_date, draft.planned_end_date)
  const savedDraft = draftFrom(project, enterpriseProject)
  const hasChanges = Object.keys(draft).some(key => String(draft[key]) !== String(savedDraft[key]))
  const editingDisabled = saving || analyzing || preparingUpload
  const documentsProcessing = files.some(file => ['pending', 'processing'].includes(file.parse_status))
  useEffect(() => {
    const pending = uploadDraftRef.current
    if (pending && pending.projectId === project?.id && pending.enterpriseId === enterpriseProject?.id) {
      setDraft(pending.draft)
      uploadDraftRef.current = null
    } else setDraft(draftFrom(project, enterpriseProject))
  }, [project, enterpriseProject])
  useEffect(() => {
    endDateRef.current?.setCustomValidity(draft.effective_date && draft.planned_end_date && !calculatePlanningDuration(draft.effective_date, draft.planned_end_date)
      ? 'Project end date must be after the project start date.' : '')
  }, [draft.effective_date, draft.planned_end_date])

  const loadReview = useCallback(async () => {
    reviewController.current?.abort()
    const controller = new AbortController()
    reviewController.current = controller
    const sequence = ++requestSequence.current
    if (!project?.id) { setReview({ run: null, facts: [], conflicts: [] }); setReviewLoading(false); setReviewError(''); return }
    setReviewLoading(true); setReviewError(''); setReview({ run: null, facts: [], conflicts: [] })
    try {
      const run = await latestCompletedRun(project.id, controller.signal)
      if (sequence !== requestSequence.current || controller.signal.aborted) return
      // Parsing and analysis are different states. A completed run already proves
      // these files were analyzed, even while its large findings list is loading.
      setReview({ run, facts: [], conflicts: [] })
      const [facts, conflicts] = run ? await Promise.all([
        allRecords(PLANNING_ENDPOINTS.intelligenceFacts, { run: run.id }, controller.signal),
        allRecords(PLANNING_ENDPOINTS.intelligenceConflicts, { run: run.id, status: 'open' }, controller.signal),
      ]) : [[], []]
      if (sequence === requestSequence.current) {
        setReview({ run, facts, conflicts: conflicts.filter(item => item.status === 'open') })
        onIntelligenceLoaded?.(run?.intelligence || null, run?.preview_confirmation || null)
      }
    } catch (error) {
      if (sequence === requestSequence.current && !controller.signal.aborted) setReviewError(errorText(error, 'Input review could not be loaded. Please retry.'))
    } finally { if (sequence === requestSequence.current) setReviewLoading(false) }
  }, [project?.id, onIntelligenceLoaded])
  useEffect(() => { loadReview(); return () => { requestSequence.current += 1; reviewController.current?.abort() } }, [loadReview, analysisRevision])
  useEffect(() => { if (reviewRequest) setReviewOpen(true) }, [reviewRequest])

  const save = async event => {
    event.preventDefault()
    if (saveInFlight.current || analyzing || uploading) return
    onRevealInputs?.()
    const runAnalysis = event.nativeEvent?.submitter?.value === 'analyze'
    const continueManual = event.nativeEvent?.submitter?.value === 'manual-continue'
    if (project && (loadingContract || !contract)) { setNotice({ error: true, text: 'Wait for the project connection check to finish, then save again. Your inputs are still here.' }); return }
    if (!duration) { setNotice({ error: true, text: 'Enter a project start date and a later project end date.' }); return }
    if (continueManual && (!draft.scope_summary.trim() || !draft.phase.trim())) { setNotice({ error: true, text: 'Enter the project scope and phase before continuing to Work breakdown.' }); return }
    if (runAnalysis && documentsProcessing) { setNotice({ error: true, text: 'Wait for the reference documents to finish processing before running Document Intelligence.' }); return }
    if (runAnalysis && !simple && !files.some(file => file.parse_status === 'done')) { setNotice({ error: true, text: 'Upload a reference document and wait for parsing to finish before running Document Intelligence.' }); return }
    saveInFlight.current = true; setSaving(true); setNotice(null)
    try {
      const payload = { ...draft, effective_date: draft.effective_date || null, planned_end_date: draft.planned_end_date || null, budgeted_effort_hours: draft.budgeted_effort_hours === '' ? null : draft.budgeted_effort_hours }
      if (baselineLocked) { delete payload.effective_date; delete payload.planned_end_date }
      const response = project?.id ? runAnalysis && !hasChanges ? { data: project } : await apiClient.patch(PLANNING_ENDPOINTS.project(project.id), payload) : await apiClient.post(PLANNING_ENDPOINTS.projects, {
        ...payload, enterprise_project: enterpriseProject.id, name: enterpriseProject.name,
        client: enterpriseProject.client_name || '', location: enterpriseProject.location || '',
      })
      onSaved(response.data)
      setDraft(draftFrom(response.data, enterpriseProject))
      if (hasChanges) setAnalysisNeeded(true)
      setNotice({ error: false, text: 'Planning draft saved.' })
      if (continueManual) onOpenWorkBreakdown?.(response.data)
      if (runAnalysis) {
        const result = await onAnalyze({ projectId: response.data.id })
        if (result?.requires_rebuild || result?.requires_generation) {
          setNotice(null)
        } else if (result) {
          setAnalysisNeeded(false)
          setNotice({ error: false, text: simple ? 'Schedule updated. Review the activities, dates and assignments in Master Schedule.' : 'Document Intelligence completed. Review the full preview, then confirm and save.' })
        } else {
          setAnalysisNeeded(true)
          setNotice({ error: true, text: 'Your draft is saved. Document Intelligence did not complete; review the message above and retry.' })
        }
      }
    } catch (error) { setNotice({ error: true, text: errorText(error, 'The draft could not be saved. Your inputs are still here; please retry.') }) }
    finally { setSaving(false); saveInFlight.current = false }
  }
  const change = key => event => setDraft(previous => ({ ...previous, [key]: event.target.value }))
  const upload = async fileList => {
    // Snapshot the FileList before the input is cleared and workspace creation awaits.
    const selectedFiles = Array.from(fileList || [])
    if ((!project?.id && !enterpriseProject?.id) || saveInFlight.current || uploading || editingDisabled || !selectedFiles.length) return
    const oversized = selectedFiles.find(file => file.size > PLANNING_MAX_FILE_MB * 1024 * 1024)
    if (oversized) { setNotice({ error: true, text: `${oversized.name} exceeds ${PLANNING_MAX_FILE_MB} MB. Choose a smaller file.` }); return }
    saveInFlight.current = true; setPreparingUpload(true); setNotice(null)
    try {
      let workspace = project
      if (!workspace?.id) {
        // Uploading must not require dates or implicitly save unfinished scope edits.
        const response = await apiClient.post(PLANNING_ENDPOINTS.projects, {
          enterprise_project: enterpriseProject.id, name: enterpriseProject.name,
          client: enterpriseProject.client_name || '', location: enterpriseProject.location || '',
          planning_mode: draft.planning_mode,
        }, { suppressErrorToast: true })
        workspace = response.data
        uploadDraftRef.current = { projectId: workspace.id, enterpriseId: enterpriseProject.id, draft }
        onSaved(workspace)
      }
      await onUpload(selectedFiles, { projectId: workspace.id })
    } catch (error) {
      setNotice({ error: true, text: errorText(error, 'The project could not be prepared for upload. Your inputs are still here; please retry.') })
    } finally { setPreparingUpload(false); saveInFlight.current = false }
  }
  const reviewAction = async operation => {
    setReviewBusy(true); setReviewError('')
    try { await operation(); await loadReview() }
    catch (error) { setReviewError(errorText(error, 'The review could not be saved. Please retry.')) }
    finally { setReviewBusy(false) }
  }
  const requirements = review.facts.filter(fact => ['requirement', 'deliverable', 'hse_study', 'milestone'].includes(fact.fact_type) && !['rejected', 'superseded'].includes(fact.status))
  const needsReview = review.facts.some(fact => ['detected', 'conflicted'].includes(fact.status)) || review.conflicts.length > 0
  const analyzedIds = new Set((review.run?.source_file_ids || []).map(String))
  const analyzedCount = files.filter(file => analyzedIds.has(String(file.id))).length
  const stale = Boolean(review.run) && (files.some(file => !analyzedIds.has(String(file.id))) || analyzedIds.size !== analyzedCount)
  const unknown = reviewLoading || Boolean(reviewError)
  const savedAfterAnalysis = Boolean(review.run?.started_at && project?.updated_at && Date.parse(project.updated_at) > Date.parse(review.run.started_at))
  useEffect(() => { onPreviewStaleChanged?.(stale || savedAfterAnalysis || hasChanges) }, [stale, savedAfterAnalysis, hasChanges, onPreviewStaleChanged])
  const canOpenWorkBreakdown = manual
    ? Boolean(project?.id && project.planning_mode === 'manual' && duration && draft.scope_summary.trim() && draft.phase.trim()) && !hasChanges
    : Boolean(review.run) && !unknown && !stale && !analysisNeeded && !hasChanges && !savedAfterAnalysis && !documentsProcessing && Boolean(duration)
  useEffect(() => { onReadinessChanged?.(canOpenWorkBreakdown && !editingDisabled && !uploading) }, [canOpenWorkBreakdown, editingDisabled, uploading, onReadinessChanged])
  useEffect(() => { onReviewStateChanged?.({ conflicts: review.conflicts.length, unavailable: unknown }) }, [review.conflicts.length, unknown, onReviewStateChanged])
  const openReview = () => { setReviewOpen(true) }
  return <div className={`planning-inputs${simple ? ' planning-inputs-simple' : ''}`} hidden={hidden}>
    <div className="pln-metrics" aria-label="Planning input summary"><span><ClipboardList size={21} /><strong>{unknown ? '—' : analyzedCount}</strong>documents analyzed</span><span><ListChecks size={22} /><strong>{unknown ? '—' : requirements.length}</strong>requirements extracted</span><span className={review.conflicts.length ? 'pln-warning' : ''}><AlertTriangle size={21} /><strong>{unknown ? '—' : review.conflicts.length}</strong>{review.conflicts.length === 1 ? 'clarification open' : 'clarifications open'}</span></div>
    {notice && <div className={notice.error ? 'pln-error' : 'pln-success'} role={notice.error ? 'alert' : 'status'}>{notice.text}</div>}
    <div className="pln-columns"><div className="pln-main-column">
      {!simple && <section className="pln-card pln-method" aria-labelledby="planning-method-heading"><div><h2 id="planning-method-heading">Planning method</h2><p>{manual ? 'Create tasks and assign employees. Reference documents are optional.' : 'Extract inputs from documents, then review and confirm the full preview.'}</p></div><label>Plan from<select aria-label="Planning method" value={draft.planning_mode} disabled={editingDisabled || uploading} onChange={change('planning_mode')}><option value="manual">Scope and tasks — no upload required</option><option value="document">Reference documents</option></select></label></section>}
      <section className="pln-card pln-documents" aria-labelledby="planning-documents-heading"><header className="pln-card-heading"><div><h2 id="planning-documents-heading">Reference documents</h2></div></header>
        <div className="pln-upload-controls"><label className="pln-category">Document type<select value={uploadCategory} onChange={event => onUploadCategory(event.target.value)} disabled={uploading || editingDisabled}>{PLANNING_FILE_CATEGORIES.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label><button type="button" className="pln-button" disabled={(!project?.id && !enterpriseProject?.id) || uploading || editingDisabled} onClick={() => inputRef.current?.click()}><Upload size={17} />{uploading ? 'Uploading…' : preparingUpload ? 'Preparing upload…' : 'Upload'}</button></div>
        <input ref={inputRef} type="file" aria-label="Upload reference documents" multiple accept=".pdf,.docx,.xlsx,.xlsm,.csv,.xer,.txt" className="sr-only" disabled={(!project?.id && !enterpriseProject?.id) || uploading || editingDisabled} onChange={event => { upload(event.target.files); event.target.value = '' }} />
        <div className="pln-doc-table-wrap"><table className="pln-doc-table"><thead><tr><th>Document</th><th>Type</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{files.map(file => {
          const extension = file.original_filename?.split('.').pop()?.toUpperCase() || 'FILE', spreadsheet = ['XLS', 'XLSX', 'CSV'].includes(extension), Icon = spreadsheet ? FileSpreadsheet : FileText
          const analyzed = file.parse_status === 'done' && analyzedIds.has(String(file.id))
          return <tr key={file.id}><td><div className="pln-document-name"><span className={`pln-file-icon ${spreadsheet ? 'is-sheet' : extension === 'PDF' ? 'is-pdf' : ''}`}><Icon size={24} /><small>{extension}</small></span><div><strong>{file.original_filename}</strong><small>{extension}{file.size_bytes ? ` · ${(file.size_bytes / 1024).toLocaleString('en-GB', { maximumFractionDigits: 0 })} KB` : ''}</small>{file.parse_status === 'failed' && <small className="pln-error-text">{file.parse_error || 'Document parsing failed.'}</small>}</div></div></td><td>{PLANNING_FILE_CATEGORIES.find(category => category.value === file.category)?.label || file.category}</td><td><span className={`pln-status ${file.parse_status === 'done' ? 'is-done' : file.parse_status === 'failed' ? 'is-failed' : ''}`}>{file.parse_status === 'done' ? <CheckCircle2 size={17} /> : ['pending', 'processing'].includes(file.parse_status) ? <Loader2 size={15} className="animate-spin" /> : <AlertTriangle size={16} />}{analyzed ? 'Analyzed' : file.parse_status === 'done' ? 'Ready to analyze' : file.parse_status === 'failed' ? 'Failed' : file.parse_status === 'processing' ? 'Processing' : 'Queued'}</span></td><td><details className="pln-file-menu"><summary className="pln-icon-button" aria-label={`Actions for ${file.original_filename}`}><MoreHorizontal size={18} /></summary><div>{file.file && <a href={file.file} target="_blank" rel="noopener noreferrer"><Download size={15} />Open document</a>}<button type="button" disabled={editingDisabled || uploading} onClick={() => onDeleteFile(file.id)}><Trash2 size={15} />Remove document</button></div></details></td></tr>
        })}{!files.length && <tr><td colSpan={4}><p className="pln-empty">No reference documents uploaded yet.</p></td></tr>}</tbody></table></div>
      </section>
      <section className="pln-card pln-registration" aria-label="Project scope">
        <form id="project-planning-inputs-form" onSubmit={save} onInvalid={onRevealInputs} aria-busy={saving}>
          <fieldset disabled={editingDisabled}>
            <label>Scope summary<textarea rows={2} value={draft.scope_summary} required={manual || simple} onChange={change('scope_summary')} placeholder="Describe the project objective and expected deliverables" /></label>
            <div className="pln-phase-row"><label>Phase<input type="text" maxLength={100} required={manual} value={draft.phase} onChange={change('phase')} placeholder="e.g. Phase 1, implementation, detailed engineering" /></label><label>Budgeted effort<span className="pln-input-unit"><input type="number" min="0" step="0.01" value={draft.budgeted_effort_hours} onChange={change('budgeted_effort_hours')} placeholder="Enter hours" /><span>hours</span></span></label></div>
            <div className="pln-scope-dates"><label htmlFor="planning-project-start"><span>Project start date <span className="pln-required" aria-hidden="true">*</span></span><input id="planning-project-start" aria-label="Project start date" required type="date" value={draft.effective_date} max={draft.planned_end_date || undefined} disabled={baselineLocked || Boolean(project && (loadingContract || !contract))} onChange={change('effective_date')} /></label><label htmlFor="planning-project-end"><span>Project end date <span className="pln-required" aria-hidden="true">*</span></span><input ref={endDateRef} id="planning-project-end" aria-label="Project end date" required type="date" value={draft.planned_end_date} min={draft.effective_date || undefined} disabled={baselineLocked || Boolean(project && (loadingContract || !contract))} onChange={change('planned_end_date')} /></label><div className="pln-duration-field"><label htmlFor="planning-calculated-duration">Calculated project duration</label><output id="planning-calculated-duration" htmlFor="planning-project-start planning-project-end" className="pln-duration" aria-live="polite"><Calculator size={17} aria-hidden="true" /><span><strong>{duration ? `${duration.days.toLocaleString('en-GB')} calendar ${duration.days === 1 ? 'day' : 'days'}` : 'Select project dates'}</strong><small>{duration ? `${duration.months.toLocaleString('en-GB', { maximumFractionDigits: 2 })} calendar months` : 'Calculated automatically'}</small></span></output></div></div>
            <p className="pln-date-help">Duration is calculated from the start and end dates, including weekends.</p>
            <label>Exclusions<input value={draft.exclusions} onChange={change('exclusions')} placeholder="Record activities outside the project scope" /></label>
          </fieldset>
          {saving && <p className="pln-note" role="status"><Loader2 size={15} className="animate-spin" />Saving draft…</p>}
          {baselineLocked && <p className="pln-note"><Info size={15} />Baseline dates are locked. Scope notes and planned effort remain editable.</p>}
          {!project && <p className="pln-note"><Info size={15} />Save draft to create this project’s planning workspace.</p>}
        </form>
      </section>
    </div><aside className="pln-card pln-review-card" aria-labelledby="planning-ai-heading" aria-busy={reviewLoading}><header><h2 id="planning-ai-heading">AI input review</h2><span className={`pln-review-badge ${review.run && !unknown && !needsReview && !stale ? 'is-confirmed' : ''}`}>{reviewLoading ? 'Loading review' : reviewError ? 'Review unavailable' : stale ? 'Analysis out of date' : review.run ? needsReview ? 'Needs confirmation' : 'Inputs reviewed' : 'Awaiting documents'}</span></header>
      <p>{reviewLoading ? 'Loading extracted inputs…' : review.run ? `Extracted from ${analyzedCount} source ${analyzedCount === 1 ? 'document' : 'documents'}` : 'Analyze source documents to extract project requirements.'}</p>
      {reviewError && <div className="pln-error" role="alert">{reviewError}<button type="button" className="pln-text-button" onClick={loadReview}>Retry input review</button></div>}
      {stale && <p className="pln-note"><Info size={15} />Documents have changed. Analyze again to refresh the findings.</p>}
      <h3>Requirements found</h3><ul className="pln-requirements">{requirements.slice(0, 3).map(fact => <li key={fact.id}><span className="pln-evidence-icon"><FileText size={19} /></span><div><strong>{factText(fact)}</strong><small>{sourceText(fact)}</small></div></li>)}</ul>
      {!requirements.length && <div className="pln-empty pln-review-empty"><FileText size={25} /><p>{reviewLoading ? 'Loading extracted requirements…' : reviewError ? 'Requirements could not be loaded. Retry input review.' : review.run ? 'No requirements were extracted. Review the source documents and other findings.' : 'Your extracted requirements will appear here with their source references.'}</p></div>}
      {review.facts.length > 0 && <button type="button" className="pln-text-button pln-view-all" onClick={openReview}>View all {requirements.length || review.facts.length} {requirements.length ? 'requirements' : 'findings'}<ArrowRight size={15} /></button>}
      <div className={`pln-clarification ${!review.conflicts.length && !unknown ? 'is-clear' : ''}`}><h3>{review.conflicts.length ? <AlertTriangle size={21} /> : reviewLoading ? <Loader2 size={20} className="animate-spin" /> : reviewError ? <Info size={20} /> : <CheckCircle2 size={20} />}{review.conflicts.length ? 'Clarification required' : 'Clarifications'}</h3>{review.conflicts.length ? <><p>{review.conflicts[0].description}</p>{review.conflicts[0].facts?.[0] && <small><FileText size={14} />{sourceText(review.conflicts[0].facts[0])}</small>}<button type="button" className="pln-button" onClick={openReview}>Review clarification<ArrowRight size={14} /></button></> : <p>{reviewLoading ? 'Loading clarification status…' : reviewError ? 'Clarification status is unavailable.' : review.run ? 'No open clarifications in the latest analysis.' : 'Any missing or conflicting inputs will be listed after analysis.'}</p>}</div>
      <p className="pln-note"><Info size={16} />AI findings remain draft until reviewed.</p>
      <button type="button" className="pln-text-button pln-ai-settings" disabled={!project} onClick={onAiSettings}><Settings2 size={14} />AI settings</button>
    </aside></div>
    {simple && generateSchedule && <p className="pln-note">Build a new draft from the schedule’s source inputs. Review the preview before applying; existing schedule versions are retained.</p>}
    {simple ? <footer className="pln-bottom-bar"><button type="button" className="pln-button" disabled={editingDisabled || uploading} onClick={onBack}><ArrowLeft size={17} />Back to schedule</button><div className="pln-stage-actions"><button type="submit" form="project-planning-inputs-form" className="pln-button" disabled={editingDisabled || uploading}>Save inputs</button><button type="submit" form="project-planning-inputs-form" name="planning-action" value="analyze" className="pln-button pln-primary" disabled={editingDisabled || uploading || documentsProcessing || Boolean(project && (loadingContract || !contract))}>{analyzing ? <Loader2 size={17} className="animate-spin" /> : <ListChecks size={17} />}{generateSchedule ? analyzing ? 'Opening plan generation…' : 'Generate new schedule draft' : analyzing ? 'Analyzing…' : files.length ? 'Analyze & update schedule' : 'Open schedule'}</button></div></footer> : <footer className="pln-bottom-bar"><button type="button" className="pln-button" onClick={onBack}><ArrowLeft size={17} />Back to portfolio</button><div><span>Scope &amp; inputs</span><small>{analyzing ? 'Document Intelligence is running…' : saving ? 'Saving draft…' : manual ? 'Define scope → Add tasks → Build schedule' : 'Register project → Upload documents → Analyze'}</small></div><div className="pln-stage-actions">{manual ? <button type="submit" form="project-planning-inputs-form" name="planning-action" value="manual-continue" className="pln-button pln-primary" disabled={editingDisabled || uploading || Boolean(project && (loadingContract || !contract))}>{saving ? <Loader2 size={17} className="animate-spin" /> : null}Save &amp; continue to Work breakdown<ArrowRight size={17} /></button> : <><button type="submit" form="project-planning-inputs-form" name="planning-action" value="analyze" className="pln-button pln-primary" disabled={!project || loadingContract || !contract || editingDisabled || uploading || documentsProcessing || !files.some(file => file.parse_status === 'done')}>{analyzing ? <Loader2 size={17} className="animate-spin" /> : <ListChecks size={17} />}{analyzing ? 'Running Document Intelligence…' : 'Run Document Intelligence'}</button><button type="button" className="pln-button" disabled={!review.run?.intelligence || unknown || editingDisabled || uploading} onClick={onOpenIntelligencePreview}>Next: Document Intelligence Preview<ArrowRight size={17} /></button></>}</div></footer>}
    {reviewOpen && createPortal(<InputReviewDialog facts={review.facts} conflicts={review.conflicts} busy={reviewBusy} error={reviewError} stale={stale} previewAvailable={Boolean(review.run?.intelligence)} onPreview={() => { setReviewOpen(false); onOpenIntelligencePreview() }} onClose={() => setReviewOpen(false)} onReview={(id, status) => reviewAction(() => planningService.reviewIntelligenceFact(id, status))} onResolve={(id, factId) => reviewAction(() => planningService.resolveIntelligenceConflict(id, { action: 'select_fact', selected_fact_id: factId }))} />, document.body)}
  </div>
}
