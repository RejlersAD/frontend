/* eslint-disable react/prop-types */
import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { emptyScheduleAnalysis } from '../../utils/planningAnalysisResult'
import { editablePlanningPreview } from '../../utils/planningPreview'
import { createPortal } from 'react-dom'
import { AlertTriangle, Loader2, RefreshCw, X } from 'lucide-react'
import apiClient, { apiClientLongTimeout } from '../../services/api.service'
import { planningIntelligenceService as planningService } from '../../services/planningIntelligence.service'
import { CLAUDE_MODEL_OPTIONS, DEFAULT_CLAUDE_MODEL, PLANNING_ENDPOINTS } from '../../config/planningIntelligence.config'
import PlanningInputsPanel from './PlanningInputsPanel'
import PlanningReviewPanel from './PlanningReviewPanel'
import PlanningExtractionCoverage from './PlanningExtractionCoverage'
import PlanningExtractionSummary from './PlanningExtractionSummary'
import { ProvenanceBadge, factProvenance } from './PlanningFieldProvenance'
import ScheduleNotice from './ScheduleNotice'
import { scheduleChecks, scheduleIssueGroups } from './scheduleCheckPolicy'
import { dateDisplayTask } from '../../utils/planningDateEvidence'
import PlannerWorkspacePage from '../../pages/PlannerWorkspacePage'
import './SimplePlanningWorkspace.css'

const list = response => response.data?.results ?? response.data ?? []
const errorText = error => {
  const flatten = value => typeof value === 'string' ? value : Array.isArray(value) ? value.map(flatten).join(' ') : value && typeof value === 'object' ? Object.values(value).map(flatten).join(' ') : ''
  const body = error?.response?.data
  return flatten(body?.error || body?.detail || body) || error?.message || 'The schedule could not be loaded. Please retry.'
}
async function allRows(endpoint, params, signal) {
  const rows = []
  for (let page = 1; page <= 1000; page += 1) {
    const response = await apiClient.get(endpoint, { params: { ...params, page }, signal })
    rows.push(...list(response))
    if (!response.data?.next) return rows
  }
  throw new Error('The complete document list could not be loaded.')
}

function ScheduleDialog({ title, children, onClose, busy = false, compact = false }) {
  const ref = useRef(null), id = useId()
  useEffect(() => {
    const dialog = ref.current, opener = document.activeElement
    dialog.showModal()
    return () => { dialog.close(); if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [])
  return createPortal(<dialog ref={ref} className={`simple-schedule-dialog${compact ? ' is-compact' : ''}`} aria-labelledby={id} onCancel={event => { if (busy) event.preventDefault(); else onClose() }}>
    <header><h2 id={id}>{title}</h2><button type="button" aria-label={`Close ${title}`} disabled={busy} onClick={onClose}><X size={20} /></button></header>
    <div className="ssd-body">{children}</div>
  </dialog>, document.body)
}

function ProjectAISettings({ projectId }) {
  const [settings, setSettings] = useState(null), [key, setKey] = useState(''), [model, setModel] = useState(DEFAULT_CLAUDE_MODEL)
  const [provider, setProvider] = useState('anthropic')
  const [enabled, setEnabled] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const providerChoices = settings?.provider_choices || [{ value: 'anthropic', label: 'Anthropic (Claude)', default_model: DEFAULT_CLAUDE_MODEL, model_choices: settings?.model_choices || CLAUDE_MODEL_OPTIONS }]
  const selectedProvider = providerChoices.find(option => option.value === provider) || providerChoices[0]
  const modelChoices = selectedProvider.model_choices || []
  const savedProvider = settings?.provider || 'anthropic'
  const providerChanged = Boolean(settings) && provider !== savedProvider
  const savedKeyForProvider = Boolean(settings?.key_configured) && !providerChanged
  const unsaved = providerChanged || model !== settings?.model || enabled !== Boolean(settings?.enabled) || Boolean(key)
  const keyProviderLabel = provider === 'gemini' ? 'Google Gemini' : 'Anthropic'
  const update = setter => event => { setter(event.target.type === 'checkbox' ? event.target.checked : event.target.value); setNotice(''); setError('') }
  const changeProvider = event => {
    const value = event.target.value, option = providerChoices.find(choice => choice.value === value)
    setProvider(value); setModel(value === savedProvider ? settings.model : option.default_model || option.model_choices?.[0]?.value || '')
    setKey(''); setNotice(''); setError('')
  }
  useEffect(() => {
    let active = true
    apiClient.get(PLANNING_ENDPOINTS.aiSettings(projectId)).then(({ data }) => { if (active) { setSettings(data); setProvider(data.provider || 'anthropic'); setModel(data.model || DEFAULT_CLAUDE_MODEL); setEnabled(Boolean(data.enabled)) } }).catch(reason => { if (active) setError(errorText(reason)) })
    return () => { active = false }
  }, [projectId])
  const act = async action => {
    setBusy(true); setError(''); setNotice('')
    try {
      if (action === 'test') {
        const { data } = await apiClientLongTimeout.post(PLANNING_ENDPOINTS.aiSettingsTest(projectId))
        if (data.success === false) setError(data.message || 'Connection test failed.'); else setNotice(data.message || 'Connection verified.')
      } else {
        const { data } = action === 'remove' ? await apiClient.delete(PLANNING_ENDPOINTS.aiSettings(projectId)) : await apiClient.post(PLANNING_ENDPOINTS.aiSettings(projectId), { provider, enabled, model, ...(key.trim() ? { api_key: key.trim() } : {}) })
        setSettings(data); setProvider(data.provider || 'anthropic'); setModel(data.model || DEFAULT_CLAUDE_MODEL); setEnabled(Boolean(data.enabled)); setKey(''); setNotice(action === 'remove' ? 'Saved key removed.' : 'AI settings saved.')
      }
    } catch (reason) { setError(errorText(reason)) }
    finally { setBusy(false) }
  }
  return <form className="ssd-settings" onSubmit={event => { event.preventDefault(); act('save') }}>
    <p>Connect an AI provider for document analysis. Register extraction and manual scheduling do not require a key.</p>
    {error && <p className="ssd-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <label><input type="checkbox" checked={enabled} disabled={!settings || busy} onChange={update(setEnabled)} /> Use AI for document analysis</label>
    <label>Provider<select value={provider} disabled={!settings || busy} onChange={changeProvider}>{providerChoices.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <label>Model<select value={model} disabled={!settings || busy} onChange={update(setModel)}>{modelChoices.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <label>{keyProviderLabel} API key<input type="password" autoComplete="new-password" value={key} disabled={!settings || busy} onChange={update(setKey)} required={providerChanged} placeholder={savedKeyForProvider ? 'Key saved — enter to replace' : `Enter ${keyProviderLabel} API key`} /></label>
    {providerChanged && <p>Enter a {keyProviderLabel} API key to switch providers.{settings.key_configured && ` The saved key belongs to ${providerChoices.find(option => option.value === savedProvider)?.label || savedProvider}.`}</p>}
    {unsaved && settings && <p>Save your changes before testing the connection.</p>}
    <div className="ssd-actions"><button type="submit" disabled={!settings || busy || (providerChanged && !key.trim())}>Save settings</button><button type="button" disabled={!settings?.enabled || !savedKeyForProvider || busy || unsaved} onClick={() => act('test')}>Test connection</button>{settings?.key_configured && <button type="button" disabled={busy} onClick={() => act('remove')}>Remove key</button>}</div>
  </form>
}

function EvidencePreview({ projectId, onBusyChanged, onConfirmed }) {
  const [run, setRun] = useState(null), [facts, setFacts] = useState([]), [error, setError] = useState(''), [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false), [loadAttempt, setLoadAttempt] = useState(0)
  const saveInFlight = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    ;(async () => {
      try {
        const runs = await allRows(PLANNING_ENDPOINTS.intelligenceRuns, { project: projectId }, controller.signal)
        const latest = runs.find(row => row.status === 'succeeded')
        const findings = latest ? await allRows(PLANNING_ENDPOINTS.intelligenceFacts, { run: latest.id }, controller.signal) : []
        if (!controller.signal.aborted) { setRun(latest); setFacts(findings) }
      } catch (reason) { if (!controller.signal.aborted) setError(errorText(reason)) }
      finally { if (!controller.signal.aborted) setLoading(false) }
    })()
    return () => controller.abort()
  }, [projectId, loadAttempt])
  const confirmed = run?.preview_confirmation?.is_current === true
  const preview = editablePlanningPreview(run?.intelligence)
  const confirm = async () => {
    if (saveInFlight.current || !run?.intelligence || confirmed) return
    saveInFlight.current = true
    setSaving(true); setError(''); onBusyChanged(true)
    try {
      const saved = await planningService.confirmIntelligencePreview(run.id, preview)
      if (!saved.preview_confirmation?.is_current) throw new Error('The preview could not be confirmed. Reload the preview and try again.')
      setRun(saved)
      // The confirmation command confirms detected findings and preserves
      // rejected/superseded findings in the same transaction.
      setFacts(rows => rows.map(fact => fact.status === 'detected' ? { ...fact, status: 'confirmed' } : fact))
      onConfirmed()
    } catch (reason) { setError(errorText(reason)) }
    finally { saveInFlight.current = false; setSaving(false); onBusyChanged(false) }
  }
  if (loading) return <p role="status">Loading document intelligence…</p>
  return <section className="ssd-evidence">
    {error && <div className="ssd-error" role="alert">{error}<button type="button" disabled={saving} onClick={() => setLoadAttempt(value => value + 1)}>Reload preview</button></div>}
    {confirmed && <p role="status">Preview confirmed and saved.</p>}
    {!confirmed && run?.preview_confirmation && <p role="status">Preview confirmation is out of date. Review and confirm again.</p>}
    <PlanningExtractionSummary summary={run?.intelligence?.extraction_summary} />
    {run && <PlanningExtractionCoverage coverage={run.intelligence?.processing_coverage} aiCoverage={run.intelligence?.ai_processing_coverage} />}
    {run?.intelligence && <details className="ssd-preview-selection" open><summary>Preview selections</summary>
      <dl><dt>Project</dt><dd>{preview.detected_project_name || 'Not specified'}</dd><dt>Project start</dt><dd>{preview.detected_effective_date_text || 'Not specified'}</dd><dt>Duration (months)</dt><dd>{preview.detected_duration_months ?? 'Not specified'}</dd></dl>
      {Object.entries(preview.disciplines).map(([code, selection]) => <div key={code}><strong>{run.intelligence.disciplines[code].name || code} — {selection.in_scope ? 'In scope' : 'Excluded'}</strong>
        <ul>{selection.deliverables.map((title, index) => <li key={`${index}:${title}`}>{title}{selection.excluded_deliverables.includes(title) ? ' — Excluded' : ''}</li>)}</ul>
      </div>)}
      {preview.hse_studies.length > 0 && <div><strong>HSE studies</strong><ul>{preview.hse_studies.map((title, index) => <li key={`${index}:${title}`}>{title}</li>)}</ul></div>}
    </details>}
    <p>{run ? `${facts.length} extracted findings. Review the resulting activities in Master Schedule before approval.` : 'Analyze the reference documents to see their extracted content.'}</p>
    <div className="ssd-table"><table><thead><tr><th>Finding</th><th>Type</th><th>Source</th><th>Planning basis</th><th>Status</th></tr></thead><tbody>{facts.map(fact => <tr key={fact.id}><td><strong>{typeof fact.value === 'object' && fact.value !== null ? fact.value.name || fact.value.title || fact.value.description || fact.normalized_value || JSON.stringify(fact.value) : String(fact.value ?? fact.normalized_value ?? '')}</strong>{fact.source_excerpt && <details><summary>Source excerpt</summary><blockquote>{fact.source_excerpt}</blockquote></details>}</td><td>{fact.fact_type?.replaceAll('_', ' ')}</td><td>{fact.source_filename}<small>{Object.entries(fact.source_locator || {}).filter(([, value]) => typeof value !== 'object').map(([name, value]) => `${name} ${value}`).join(' · ')}</small></td><td><ProvenanceBadge provenance={factProvenance(fact)} />{fact.extraction_method && <small>{fact.extraction_method.replaceAll('_', ' ')}</small>}</td><td>{fact.status?.replaceAll('_', ' ')}</td></tr>)}</tbody></table></div>
    {run?.intelligence && <div className="ssd-actions"><button type="button" disabled={saving || confirmed} onClick={confirm}>{saving ? 'Saving preview…' : 'Confirm & save preview'}</button></div>}
  </section>
}

export default function SimplePlanningWorkspace({ enterpriseProject, comparison, onRefreshComparison }) {
  const [project, setProject] = useState(null), [loading, setLoading] = useState(true), [loadAttempt, setLoadAttempt] = useState(0)
  const [connectionFailed, setConnectionFailed] = useState(false)
  const [files, setFiles] = useState([]), [contract, setContract] = useState(null), [loadingContract, setLoadingContract] = useState(false)
  const [error, setError] = useState(''), [uploading, setUploading] = useState(false), [analyzing, setAnalyzing] = useState(false)
  const [creatingProgrammatic, setCreatingProgrammatic] = useState(false)
  const [category, setCategory] = useState('sow'), [dialog, setDialog] = useState(null), [overlay, setOverlay] = useState(null)
  const [previewBusy, setPreviewBusy] = useState(false), [reviewRevision, setReviewRevision] = useState(0)
  const previewConfirmed = useCallback(() => setReviewRevision(value => value + 1), [])
  const [refreshKey, setRefreshKey] = useState(0), [plan, setPlan] = useState(null), [panelBusy, setPanelBusy] = useState(false), [rebuild, setRebuild] = useState(null)
  const [advancedPlan, setAdvancedPlan] = useState(null)
  const [generationRequest, setGenerationRequest] = useState(null)
  const generationOpened = useCallback(() => setGenerationRequest(null), [])
  const [selectedVersionId, setSelectedVersionId] = useState('current')
  const [notice, setNotice] = useState('')
  const dismissNotice = useCallback(() => setNotice(''), [])
  const alive = useRef(true), operation = useRef(false)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(''); setConnectionFailed(false)
    allRows(PLANNING_ENDPOINTS.projects, { enterprise_project: enterpriseProject.id }, controller.signal).then(rows => {
      if (!controller.signal.aborted) setProject(rows.find(row => String(row.enterprise_project) === String(enterpriseProject.id)) || null)
    }).catch(reason => { if (!controller.signal.aborted) { setError(errorText(reason)); setConnectionFailed(true) } }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [enterpriseProject.id, loadAttempt])
  const loadFiles = useCallback(async projectId => {
    const rows = await allRows(PLANNING_ENDPOINTS.files, { project: projectId })
    if (alive.current) setFiles(rows)
    return rows
  }, [])
  useEffect(() => {
    if (!project?.id) return undefined
    let active = true
    setLoadingContract(true)
    apiClient.get(PLANNING_ENDPOINTS.enterpriseContract(project.id)).then(({ data }) => { if (active) setContract(data) }).catch(reason => { if (active) { setContract(null); setError(errorText(reason)) } }).finally(() => { if (active) setLoadingContract(false) })
    return () => { active = false }
  }, [project])
  useEffect(() => {
    if (!project?.id) return undefined
    let active = true, timer
    const poll = async () => {
      try {
        const rows = await allRows(PLANNING_ENDPOINTS.files, { project: project.id })
        if (active) {
          setFiles(rows)
          if (rows.some(row => ['pending', 'processing'].includes(row.parse_status))) timer = window.setTimeout(poll, 2000)
        }
      } catch (reason) { if (active) setError(errorText(reason)) }
    }
    poll()
    return () => { active = false; window.clearTimeout(timer) }
  }, [project?.id, uploading])
  useEffect(() => {
    const save = () => { if (dialog === 'inputs' && !overlay) document.getElementById('project-planning-inputs-form')?.requestSubmit() }
    window.addEventListener('radai:save-master-schedule', save)
    return () => window.removeEventListener('radai:save-master-schedule', save)
  }, [dialog, overlay])
  const upload = async (selectedFiles, { projectId }) => {
    setUploading(true); setError('')
    try {
      for (const file of selectedFiles) {
        const form = new FormData()
        form.append('project', projectId); form.append('category', category); form.append('file', file)
        await apiClient.post(PLANNING_ENDPOINTS.files, form)
      }
    } catch (reason) { if (alive.current) setError(errorText(reason)); throw reason }
    finally { try { await loadFiles(projectId) } finally { if (alive.current) setUploading(false) } }
  }
  const removeFile = async fileId => {
    setError('')
    try { await apiClient.delete(PLANNING_ENDPOINTS.file(fileId)); await loadFiles(project.id) }
    catch (reason) { if (alive.current) setError(errorText(reason)) }
  }
  const analyze = async ({ projectId, replace = false, revision, confirmRebuild = false }) => {
    if (operation.current) return null
    operation.current = true; setAnalyzing(true); setError(''); setNotice('')
    try {
      const endpoint = `${PLANNING_ENDPOINTS.project(projectId)}simple-plan/`
      // The confirmation is bound to the reviewed revision. Do not quietly
      // replace a newer draft if another user edits it while confirmation is open.
      let request
      if (replace) {
        if (!Number.isInteger(revision)) throw new Error('Open Rebuild draft from inputs and review the current draft before rebuilding.')
        request = { revision, rebuild: true }
      } else {
        const current = (await apiClient.get(endpoint)).data
        if (selectedVersionId !== 'current' || current.state === 'baselined' || current.viewing_history || current.legacy_read_only) {
          throw new Error('This schedule is read only. Open a current editable draft before rebuilding.')
        }
        if (current.canonical_version) {
          // Saved schedule drafts use reviewed generation, not the independent
          // working-draft analysis endpoint. can_edit only describes that editor.
          if (current.state === 'submitted') throw new Error('Complete the current schedule review before generating a new draft.')
          const canBuildSourceLogic = current.permissions?.can_build_source_logic === true
          let canGenerate = current.permissions?.can_generate_plan
          // Older schedule responses omit this capability. Ask the generation
          // endpoint instead of mistaking a missing field for an access denial.
          // An explicit denial must never fall back to a different permission.
          if (canGenerate === undefined && !canBuildSourceLogic) {
            const generation = await planningService.listPlanningBuilds(projectId)
            canGenerate = generation.permissions?.can_preview === true
          }
          if (canGenerate !== true && !canBuildSourceLogic) throw new Error('Your access does not permit generating a schedule draft.')
          if (alive.current) {
            setRebuild(null); setDialog(null)
            setGenerationRequest(canBuildSourceLogic ? 'source_logic' : 'plan')
            setRefreshKey(value => value + 1)
          }
          return { requires_generation: true }
        }
        if (current.tasks?.length && (confirmRebuild || current.stale_inputs || project?.planning_mode !== 'manual')) {
          if (!current.permissions?.can_edit) throw new Error('This schedule is read only. Open a current editable draft before rebuilding.')
          setRebuild({ projectId, revision: current.revision }); return { requires_rebuild: true }
        }
        request = { revision: current.revision, rebuild: Boolean(current.stale_inputs) }
      }
      const { data } = await apiClientLongTimeout.post(`${endpoint}analyse/`, request)
      if (alive.current) {
        const emptyAnalysis = emptyScheduleAnalysis(data)
        setPlan(data); setRebuild(null); setRefreshKey(value => value + 1); setDialog(emptyAnalysis ? 'inputs' : null)
        if (replace && !emptyAnalysis) setNotice('Draft rebuilt from current documents. Review the updated activities before approval.')
      }
      return data
    } catch (reason) { if (alive.current) setError(errorText(reason)); return null }
    finally { operation.current = false; if (alive.current) setAnalyzing(false) }
  }
  const createProgrammatic = async ({ projectId }) => {
    if (operation.current) return null
    operation.current = true; setCreatingProgrammatic(true); setError(''); setNotice('')
    try {
      const endpoint = `${PLANNING_ENDPOINTS.project(projectId)}simple-plan/`
      const current = (await apiClient.get(endpoint)).data
      if (selectedVersionId !== 'current' || current.viewing_history || current.legacy_read_only || current.canonical_version || ['baselined', 'submitted'].includes(current.state) || !current.permissions?.can_edit) {
        throw new Error('Open an empty editable current draft before creating activities from requirements.')
      }
      if (current.tasks?.length) throw new Error('This draft already contains activities. Review the current schedule before creating another draft.')
      const { data } = await apiClientLongTimeout.post(`${endpoint}programmatic-draft/`, { revision: current.revision, requirement_scope: 'all' })
      if (alive.current) {
        setPlan(data); setRebuild(null); setRefreshKey(value => value + 1); setDialog(null)
      }
      return data
    } catch (reason) { if (alive.current) setError(errorText(reason)); return null }
    finally { operation.current = false; if (alive.current) setCreatingProgrammatic(false) }
  }
  const close = () => { setDialog(null); setRebuild(null); setRefreshKey(value => value + 1) }
  const requestRebuild = () => {
    if (!project?.id || operation.current) return
    setDialog('inputs')
    analyze({ projectId: project.id, confirmRebuild: true })
  }
  const busy = uploading || analyzing || creatingProgrammatic || panelBusy
  const canCreateProgrammatic = plan && selectedVersionId === 'current' && !plan.tasks?.length
    && !plan.canonical_version && !plan.viewing_history && !plan.legacy_read_only
    && !['baselined', 'submitted'].includes(plan.state) && plan.permissions?.can_edit === true
  useEffect(() => {
    const { blockers, warnings } = scheduleChecks(plan || {})
    const timingGap = plan && !plan.viewing_history && !plan.legacy_read_only && selectedVersionId === 'current' && plan.state !== 'baselined'
      && !plan.canonical_version && plan.source_preview_available && plan.tasks?.length > 0
      && plan.tasks.every(task => { const display = dateDisplayTask(task); return !display.display_start_date && !display.display_finish_date })
    window.dispatchEvent(new CustomEvent('radai:master-schedule-state', { detail: {
      projectId: enterpriseProject.id, state: plan?.state, updatedAt: plan?.updated_at,
      issueCount: scheduleIssueGroups(blockers).length + warnings.length + Number(Boolean(plan?.stale_inputs)) + Number(Boolean(timingGap)),
      hasActivities: Boolean(plan?.tasks?.length),
      canSave: Boolean(project && plan?.permissions?.can_edit && !loading && !busy),
    } }))
  }, [enterpriseProject.id, project, plan, loading, busy, selectedVersionId])
  if (loading) return <div className="simple-planning-loading" role="status"><Loader2 size={18} className="animate-spin" />Loading Master Schedule…</div>
  if (connectionFailed) return <div className="ssd-error" role="alert">{error}<button type="button" onClick={() => setLoadAttempt(value => value + 1)}><RefreshCw size={15} />Retry</button></div>
  return <div className="simple-planning-workspace">
    {notice && <ScheduleNotice message={notice} onClose={dismissNotice} />}
    {plan?.programmatic_summary && <p className="ssd-programmatic-summary" role="status">Created {plan.programmatic_summary.activity_count} draft activities from all {plan.programmatic_summary.requirement_count} requirement statements without AI, including contract clauses. Dates and durations are provisional; no dependency links were inferred.{plan.document_deliverables?.length > 0 && <> {plan.document_deliverables.length} source deliverables are available in Project inputs.</>}</p>}
    {error && !dialog && <div className="ssd-error" role="alert"><AlertTriangle size={17} />{error}<button type="button" onClick={() => { setLoadAttempt(value => value + 1); setRefreshKey(value => value + 1) }}><RefreshCw size={15} />Retry</button></div>}
    <PlanningReviewPanel key={`${project?.id || 'new'}:${refreshKey}`} projectId={project?.id || null} enterpriseProject={enterpriseProject} planningMode={project?.planning_mode || 'document'} stage="review" selectedVersionId={selectedVersionId} onVersionChange={setSelectedVersionId} onInputs={() => setDialog('inputs')} onAnalyze={() => setDialog('inputs')} onRebuild={requestRebuild} onBack={() => setDialog('inputs')} onCompare={comparison ? () => { onRefreshComparison?.(); setDialog('compare') } : undefined} onOpenAdvanced={selected => { setAdvancedPlan(selected); setDialog('advanced') }} onContinue={() => setDialog('approval')} onLoaded={setPlan} onSavingChanged={setPanelBusy} generationRequest={generationRequest} onGenerationOpened={generationOpened} />
    {dialog && <ScheduleDialog title={{ inputs: 'Documents & project inputs', approval: 'Review & publish baseline', compare: 'Schedule comparison', advanced: 'Schedule Controls' }[dialog]} onClose={close} busy={busy}>
      {error && <div className="ssd-error" role="alert">{error}</div>}
      {dialog === 'inputs' && <>
        {rebuild && <div className="ssd-rebuild" role="alert"><strong>Rebuild this draft from current inputs?</strong><p>Rebuild using the current uploaded documents and saved project inputs. Existing workflows, assignments and progress are kept only for matching source rows in the same document version. New, changed or ambiguous rows become unassigned draft activities.</p><p>Replaced or removed work is archived with its employee history. Published baselines stay unchanged.</p><div className="ssd-actions"><button type="button" disabled={analyzing} onClick={() => setRebuild(null)}>Keep current draft</button><button type="button" disabled={analyzing} onClick={() => analyze({ projectId: rebuild.projectId, revision: rebuild.revision, replace: true })}>{analyzing ? 'Rebuilding draft…' : 'Rebuild draft from inputs'}</button></div></div>}
        <PlanningInputsPanel simple generateSchedule={Boolean(plan?.canonical_version)} analysisResult={emptyScheduleAnalysis(plan)} programmaticSummary={plan?.programmatic_summary} documentDeliverables={plan?.document_deliverables} project={project} enterpriseProject={enterpriseProject} contract={contract} loadingContract={loadingContract} files={files} uploading={uploading} analyzing={analyzing} creatingProgrammatic={creatingProgrammatic} analysisRevision={`${refreshKey}:${reviewRevision}`} uploadCategory={category} onUploadCategory={setCategory} onUpload={upload} onDeleteFile={removeFile} onSaved={setProject} onAnalyze={analyze} onCreateProgrammatic={canCreateProgrammatic ? createProgrammatic : undefined} onBack={close} onOpenIntelligencePreview={() => setOverlay('evidence')} onAiSettings={() => setOverlay('ai')} />
      </>}
      {dialog === 'approval' && project && <PlanningReviewPanel projectId={project.id} enterpriseProject={enterpriseProject} planningMode={project.planning_mode || 'document'} stage="approval" selectedVersionId={selectedVersionId} onVersionChange={setSelectedVersionId} onBack={close} onInputs={() => setDialog('inputs')} onLoaded={setPlan} onSavingChanged={setPanelBusy} />}
      {dialog === 'compare' && (React.isValidElement(comparison) ? React.cloneElement(comparison, { onScheduleMode: close }) : comparison)}
      {dialog === 'advanced' && project && <PlannerWorkspacePage embedded planningProjectId={project.id} initialVersionId={advancedPlan?.version_id} initialScheduleId={advancedPlan?.schedule_id || advancedPlan?.versions?.find(version => version.id === advancedPlan.version_id)?.schedule_id} onBack={close} />}
    </ScheduleDialog>}
    {overlay && project && <ScheduleDialog title={overlay === 'ai' ? 'Document analysis AI settings' : 'Document Intelligence Preview'} compact={overlay === 'ai'} busy={previewBusy} onClose={() => setOverlay(null)}>{overlay === 'ai' ? <ProjectAISettings projectId={project.id} /> : <EvidencePreview projectId={project.id} onBusyChanged={setPreviewBusy} onConfirmed={previewConfirmed} />}</ScheduleDialog>}
    <output className="sr-only" aria-live="polite">{plan?.state === 'baselined' ? 'Baseline published' : ''}</output>
  </div>
}
