/* eslint-disable react/prop-types */
import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Loader2, RefreshCw, X } from 'lucide-react'
import apiClient, { apiClientLongTimeout } from '../../services/api.service'
import { CLAUDE_MODEL_OPTIONS, DEFAULT_CLAUDE_MODEL, PLANNING_ENDPOINTS } from '../../config/planningIntelligence.config'
import PlanningInputsPanel from './PlanningInputsPanel'
import PlanningReviewPanel from './PlanningReviewPanel'
import PlannerWorkspacePage from '../../pages/PlannerWorkspacePage'
import './SimplePlanningWorkspace.css'

const list = response => response.data?.results ?? response.data ?? []
const errorText = error => {
  const flatten = value => typeof value === 'string' ? value : Array.isArray(value) ? value.map(flatten).join(' ') : value && typeof value === 'object' ? Object.values(value).map(flatten).join(' ') : ''
  return flatten(error?.response?.data) || error?.message || 'The schedule could not be loaded. Please retry.'
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
  const [enabled, setEnabled] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  useEffect(() => {
    let active = true
    apiClient.get(PLANNING_ENDPOINTS.aiSettings(projectId)).then(({ data }) => { if (active) { setSettings(data); setModel(data.model || DEFAULT_CLAUDE_MODEL); setEnabled(data.enabled) } }).catch(reason => { if (active) setError(errorText(reason)) })
    return () => { active = false }
  }, [projectId])
  const act = async action => {
    setBusy(true); setError(''); setNotice('')
    try {
      if (action === 'test') {
        const { data } = await apiClientLongTimeout.post(PLANNING_ENDPOINTS.aiSettingsTest(projectId))
        if (data.success === false) setError(data.message || 'Connection test failed.'); else setNotice(data.message || 'Connection verified.')
      } else {
        const { data } = action === 'remove' ? await apiClient.delete(PLANNING_ENDPOINTS.aiSettings(projectId)) : await apiClient.post(PLANNING_ENDPOINTS.aiSettings(projectId), { enabled, model, ...(key.trim() ? { api_key: key.trim() } : {}) })
        setSettings(data); setEnabled(data.enabled); setKey(''); setNotice(action === 'remove' ? 'Saved key removed.' : 'AI settings saved.')
      }
    } catch (reason) { setError(errorText(reason)) }
    finally { setBusy(false) }
  }
  return <form className="ssd-settings" onSubmit={event => { event.preventDefault(); act('save') }}>
    <p>Optional Anthropic connection for document analysis. Register extraction and manual scheduling do not require a key.</p>
    {error && <p className="ssd-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <label><input type="checkbox" checked={enabled} disabled={!settings || busy} onChange={event => setEnabled(event.target.checked)} /> Use AI for document analysis</label>
    <label>Model<select value={model} disabled={!settings || busy} onChange={event => setModel(event.target.value)}>{CLAUDE_MODEL_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <label>API key<input type="password" autoComplete="new-password" value={key} disabled={!settings || busy} onChange={event => setKey(event.target.value)} placeholder={settings?.key_configured ? 'Key saved — enter to replace' : 'Enter Anthropic API key'} /></label>
    <div className="ssd-actions"><button type="submit" disabled={!settings || busy}>Save settings</button><button type="button" disabled={!settings?.key_configured || busy || Boolean(key)} onClick={() => act('test')}>Test connection</button>{settings?.key_configured && <button type="button" disabled={busy} onClick={() => act('remove')}>Remove key</button>}</div>
  </form>
}

function EvidencePreview({ projectId }) {
  const [run, setRun] = useState(null), [facts, setFacts] = useState([]), [error, setError] = useState(''), [loading, setLoading] = useState(true)
  useEffect(() => {
    const controller = new AbortController()
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
  }, [projectId])
  if (loading) return <p role="status">Loading document intelligence…</p>
  if (error) return <p className="ssd-error" role="alert">{error}</p>
  return <section className="ssd-evidence"><p>{run ? `${facts.length} extracted findings. Review the resulting activities in Master Schedule before approval.` : 'Analyze the reference documents to see their extracted content.'}</p><div className="ssd-table"><table><thead><tr><th>Finding</th><th>Type</th><th>Source</th><th>Status</th></tr></thead><tbody>{facts.map(fact => <tr key={fact.id}><td><strong>{typeof fact.value === 'object' && fact.value !== null ? fact.value.name || fact.value.title || fact.value.description || fact.normalized_value || JSON.stringify(fact.value) : String(fact.value ?? fact.normalized_value ?? '')}</strong>{fact.source_excerpt && <details><summary>Source excerpt</summary><blockquote>{fact.source_excerpt}</blockquote></details>}</td><td>{fact.fact_type?.replaceAll('_', ' ')}</td><td>{fact.source_filename}<small>{Object.entries(fact.source_locator || {}).filter(([, value]) => typeof value !== 'object').map(([name, value]) => `${name} ${value}`).join(' · ')}</small></td><td>{fact.status?.replaceAll('_', ' ')}</td></tr>)}</tbody></table></div></section>
}

export default function SimplePlanningWorkspace({ enterpriseProject, comparison, onRefreshComparison }) {
  const [project, setProject] = useState(null), [loading, setLoading] = useState(true), [loadAttempt, setLoadAttempt] = useState(0)
  const [connectionFailed, setConnectionFailed] = useState(false)
  const [files, setFiles] = useState([]), [contract, setContract] = useState(null), [loadingContract, setLoadingContract] = useState(false)
  const [error, setError] = useState(''), [uploading, setUploading] = useState(false), [analyzing, setAnalyzing] = useState(false)
  const [category, setCategory] = useState('sow'), [dialog, setDialog] = useState(null), [overlay, setOverlay] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0), [plan, setPlan] = useState(null), [panelBusy, setPanelBusy] = useState(false), [rebuild, setRebuild] = useState(null)
  const [advancedPlan, setAdvancedPlan] = useState(null)
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
  const analyze = async ({ projectId, replace = false }) => {
    if (operation.current) return null
    operation.current = true; setAnalyzing(true); setError('')
    try {
      const endpoint = `${PLANNING_ENDPOINTS.project(projectId)}simple-plan/`
      const current = (await apiClient.get(endpoint)).data
      // Rebuilding an edited draft must be an explicit decision inside the workspace.
      if (!replace && current.stale_inputs && current.tasks?.length) {
        setRebuild({ projectId, revision: current.revision }); return { requires_rebuild: true }
      }
      const { data } = await apiClientLongTimeout.post(`${endpoint}analyse/`, { revision: current.revision, rebuild: replace || Boolean(current.stale_inputs) })
      if (alive.current) { setPlan(data); setRebuild(null); setRefreshKey(value => value + 1); setDialog(null) }
      return data
    } catch (reason) { if (alive.current) setError(errorText(reason)); return null }
    finally { operation.current = false; if (alive.current) setAnalyzing(false) }
  }
  const close = () => { setDialog(null); setRebuild(null); setRefreshKey(value => value + 1) }
  const busy = uploading || analyzing || panelBusy
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('radai:master-schedule-state', { detail: {
      projectId: enterpriseProject.id, state: plan?.state, updatedAt: plan?.updated_at,
      canSave: Boolean(project && plan?.permissions?.can_edit && !loading && !busy),
    } }))
  }, [enterpriseProject.id, project, plan, loading, busy])
  if (loading) return <div className="simple-planning-loading" role="status"><Loader2 size={18} className="animate-spin" />Loading Master Schedule…</div>
  if (connectionFailed) return <div className="ssd-error" role="alert">{error}<button type="button" onClick={() => setLoadAttempt(value => value + 1)}><RefreshCw size={15} />Retry</button></div>
  return <div className="simple-planning-workspace">
    {error && !dialog && <div className="ssd-error" role="alert"><AlertTriangle size={17} />{error}<button type="button" onClick={() => { setLoadAttempt(value => value + 1); setRefreshKey(value => value + 1) }}><RefreshCw size={15} />Retry</button></div>}
    <PlanningReviewPanel key={`${project?.id || 'new'}:${refreshKey}`} projectId={project?.id || null} enterpriseProject={enterpriseProject} planningMode={project?.planning_mode || 'document'} stage="review" onInputs={() => setDialog('inputs')} onAnalyze={() => setDialog('inputs')} onBack={() => setDialog('inputs')} onCompare={comparison ? () => { onRefreshComparison?.(); setDialog('compare') } : undefined} onOpenAdvanced={selected => { setAdvancedPlan(selected); setDialog('advanced') }} onContinue={() => setDialog('approval')} onLoaded={setPlan} onSavingChanged={setPanelBusy} />
    {dialog && <ScheduleDialog title={{ inputs: 'Documents & project inputs', approval: 'Review & publish baseline', compare: 'Schedule comparison', advanced: 'Schedule Controls' }[dialog]} onClose={close} busy={busy}>
      {error && <div className="ssd-error" role="alert">{error}</div>}
      {dialog === 'inputs' && <>
        {rebuild && <div className="ssd-rebuild" role="alert"><strong>Update the draft from these inputs?</strong><p>Analysis will refresh activities from the current documents. Matching activities retain their assignments and edits; removed source activities will leave this draft. Published baselines stay unchanged.</p><div className="ssd-actions"><button type="button" disabled={analyzing} onClick={() => setRebuild(null)}>Keep current draft</button><button type="button" disabled={analyzing} onClick={() => analyze({ projectId: rebuild.projectId, replace: true })}>Rebuild draft from inputs</button></div></div>}
        <PlanningInputsPanel simple project={project} enterpriseProject={enterpriseProject} contract={contract} loadingContract={loadingContract} files={files} uploading={uploading} analyzing={analyzing} analysisRevision={refreshKey} uploadCategory={category} onUploadCategory={setCategory} onUpload={upload} onDeleteFile={removeFile} onSaved={setProject} onAnalyze={analyze} onBack={close} onOpenIntelligencePreview={() => setOverlay('evidence')} onAiSettings={() => setOverlay('ai')} />
      </>}
      {dialog === 'approval' && project && <PlanningReviewPanel projectId={project.id} enterpriseProject={enterpriseProject} planningMode={project.planning_mode || 'document'} stage="approval" onBack={close} onInputs={() => setDialog('inputs')} onLoaded={setPlan} onSavingChanged={setPanelBusy} />}
      {dialog === 'compare' && (React.isValidElement(comparison) ? React.cloneElement(comparison, { onScheduleMode: close }) : comparison)}
      {dialog === 'advanced' && project && <PlannerWorkspacePage embedded planningProjectId={project.id} initialVersionId={advancedPlan?.version_id} initialScheduleId={advancedPlan?.schedule_id || advancedPlan?.versions?.find(version => version.id === advancedPlan.version_id)?.schedule_id} onBack={close} />}
    </ScheduleDialog>}
    {overlay && project && <ScheduleDialog title={overlay === 'ai' ? 'Document analysis AI settings' : 'Document Intelligence Preview'} compact={overlay === 'ai'} onClose={() => setOverlay(null)}>{overlay === 'ai' ? <ProjectAISettings projectId={project.id} /> : <EvidencePreview projectId={project.id} />}</ScheduleDialog>}
    <output className="sr-only" aria-live="polite">{plan?.state === 'baselined' ? 'Baseline published' : ''}</output>
  </div>
}
