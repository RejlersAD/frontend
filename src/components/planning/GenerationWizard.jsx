import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import planningIntelligenceService from '../../services/planningIntelligence.service'
import PlanningExtractionCoverage from './PlanningExtractionCoverage'
import useModalAccessibility from '../../hooks/useModalAccessibility'
import { durationUnitLabel, sourceReferenceLabel } from '../../utils/planningDurationEvidence'

const STEPS = ['Inputs', 'Workflow families', 'Evidence logic', 'Review', 'Complete']
const TERMINAL_JOB_STATUSES = new Set(['succeeded', 'failed', 'cancelled'])

const familyLabel = value => !value || value === 'not_specified' ? 'Not Specified' : value.replaceAll('_', ' ')

const messageFor = (error, fallback) => {
  const data = error?.response?.data
  if (typeof data?.error === 'string') return data.error
  if (typeof data?.detail === 'string') return data.detail
  if (data && typeof data === 'object') {
    const details = Object.entries(data).flatMap(([field, value]) => {
      const messages = Array.isArray(value) ? value : [value]
      return messages.map(message => `${field.replaceAll('_', ' ')}: ${String(message)}`)
    })
    if (details.length) return details.join(' · ')
  }
  return error?.message || fallback
}

export default function GenerationWizard({
  open, project, files = [], intelligence, intelligenceOverrides,
  onClose, onGenerate, onOpenPlanner, onReviewEvidence, generationMode = 'document',
}) {
  const planningPackage = generationMode === 'planning_package'
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [previewFailed, setPreviewFailed] = useState(false)
  const [previewConflict, setPreviewConflict] = useState(false)
  const [previewJob, setPreviewJob] = useState(null)
  const [previewElapsed, setPreviewElapsed] = useState(0)
  const previewRequest = useRef(null)
  const pendingPreview = useRef(null)
  const previewStarted = useRef(0)
  const previewContext = JSON.stringify([project?.id, project?.updated_at, generationMode, intelligence?.document_intelligence_run_id,
    files.map(file => [file.id, file.updated_at, file.parse_status]), intelligenceOverrides])
  const [error, setError] = useState('')
  const [configuration, setConfiguration] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [generationPlan, setGenerationPlan] = useState(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError] = useState('')
  const [planRevision, setPlanRevision] = useState(0)
  const closeWizard = () => {
    previewRequest.current?.abort()
    setPreviewing(false)
    setPreviewFailed(false)
    onClose()
  }
  const dialogRef = useModalAccessibility(open, closeWizard, saving)

  useEffect(() => {
    setPreviewing(false)
    setPreviewFailed(false)
    setPreviewConflict(false)
    setPreviewElapsed(0)
    if (pendingPreview.current?.context !== previewContext) pendingPreview.current = null
    setPreviewJob(pendingPreview.current?.job || null)
    return () => { previewRequest.current?.abort() }
  }, [open, previewContext])

  useEffect(() => {
    if (!previewing) return undefined
    const timer = window.setInterval(() => setPreviewElapsed(Math.floor((Date.now() - previewStarted.current) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [previewing])

  useEffect(() => {
    if (!open || !project?.id) return
    let cancelled = false
    setStep(0)
    setError('')
    setPreview(null)
    setResult(null)
    setConfiguration(null)
    setLoading(true)
    planningIntelligenceService.listScheduleConfigurations(project.id).then(configurationRows => {
      if (!cancelled) setConfiguration(configurationRows[0] || null)
    }).catch(err => {
      if (!cancelled) setError(messageFor(err, 'Could not load scheduling configuration.'))
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [open, project?.id, previewContext])

  useEffect(() => {
    if (!open || !project?.id || planningPackage) return
    let cancelled = false
    setGenerationPlan(null)
    setPlanError('')
    setPlanLoading(true)
    planningIntelligenceService.listGenerationPlans(project.id).then(plans => {
      if (!cancelled) setGenerationPlan([...plans].sort((left, right) => Number(right.version) - Number(left.version))[0] || null)
    }).catch(() => {
      if (!cancelled) setPlanError('The recorded workflow family reference is unavailable. Source activities remain available for review.')
    }).finally(() => {
      if (!cancelled) setPlanLoading(false)
    })
    return () => { cancelled = true }
  }, [open, project?.id, planRevision, planningPackage])

  const parsedFiles = files.filter(item => item.parse_status === 'done')
  const failedFiles = files.filter(item => item.parse_status === 'failed')
  const disciplines = Object.entries(intelligence?.disciplines || {})
    .filter(([, item]) => item?.in_scope !== false)
  const deliverableCount = disciplines.reduce((total, [, item]) => {
    const excluded = new Set(item?.excluded_deliverables || [])
    return total + (item?.deliverables || []).filter(name => !excluded.has(name)).length
  }, 0)
  const scheduleVersionId = result?.job?.result_data?.schedule_version_id
  const evidenceReviewRequired = !scheduleVersionId || result?.job?.result_data?.state === 'needs_evidence_review'
  const generatedEvidenceId = result?.generation?.id || result?.job?.result_generation || result?.job?.result_data?.generation_id
  const sourceActivities = preview?.sample_activities || []
  const sourceNames = new Map(sourceActivities.map(item => [String(item.id), item.name || item.title || item.id]))
  const sourceRelationships = preview?.sample_logic_matrix || preview?.logic_matrix || sourceActivities.flatMap(item => (item.predecessors || []).map(link => ({ ...link, predecessor: link.id, successor: item.id })))

  if (!open) return null

  const blockerForStep = () => {
    if (step === 0) {
      if (previewConflict) return 'The preview inputs changed. Review the current source evidence before preparing another preview.'
      if (!parsedFiles.length) return 'No parsed source document is available. Wait for parsing to finish or correct the failed upload.'
      if (!intelligence) return 'Document Intelligence has not completed. Run Document Intelligence before schedule generation.'
      if (planningPackage && !intelligence.document_intelligence_run_id) return 'Save a Document Intelligence analysis before building the planning package.'
    }
    if (step === 3) {
      if (!preview) return 'The generation preview has not completed.'

    }
    return ''
  }

  const canContinue = () => !blockerForStep()

  const prepareReview = async (nextStep = 3, retryQueued = false) => {
    if (previewRequest.current && !previewRequest.current.signal.aborted) {
      if (!retryQueued) return
      previewRequest.current.abort()
    }
    const controller = new AbortController()
    previewRequest.current = controller
    const current = () => previewRequest.current === controller && !controller.signal.aborted
    const remembered = pendingPreview.current?.context === previewContext ? pendingPreview.current.job : null
    previewStarted.current = Date.now()
    setPreviewing(true)
    setPreviewElapsed(0)
    setPreviewJob(remembered)
    setPreviewFailed(false)
    setPreviewConflict(false)
    setError('')
    try {
      const generatedPreview = await planningIntelligenceService.previewGeneration(project.id, {
        ...(planningPackage ? { generation_options: { mode: 'planning_package', intelligence_run_id: intelligence.document_intelligence_run_id,
          ...(configuration?.configuration_version != null ? { expected_configuration_version: configuration.configuration_version } : {}) } }
          : { intelligence_overrides: intelligenceOverrides }),
        ...(retryQueued && remembered?.id ? { retry_queued_job_id: remembered.id } : {}),
      }, {
        signal: controller.signal,
        jobId: !retryQueued && remembered && !TERMINAL_JOB_STATUSES.has(remembered.status) ? remembered.id : undefined,
        onJob: job => {
          if (!current()) return
          setPreviewJob(job)
          pendingPreview.current = TERMINAL_JOB_STATUSES.has(job.status) ? null : { context: previewContext, job }
        },
      })
      if (!current()) return
      pendingPreview.current = null
      setPreview(generatedPreview)
      setStep(nextStep)
    } catch (err) {
      if (!current()) return
      setPreviewFailed(true)
      if (err.job) {
        setPreviewJob(err.job)
        pendingPreview.current = TERMINAL_JOB_STATUSES.has(err.job.status) ? null : { context: previewContext, job: err.job }
      }
      if (err.response?.data?.code === 'preview_retry_conflict') {
        pendingPreview.current = null
        setPreviewJob(null)
        setPreviewConflict(true)
      }
      setError(messageFor(err, 'Could not prepare the generation preview.'))
    } finally {
      if (current()) {
        previewRequest.current = null
        setPreviewing(false)
      }
    }
  }

  const next = () => {
    setError('')
    const blocker = blockerForStep()
    if (blocker) {
      setError(blocker)
      return
    }
    if (step === 0) {
      prepareReview(1)
      return
    }
    setStep(value => Math.min(4, value + 1))
  }

  const generate = async () => {
    setSaving(true)
    setPreviewFailed(false)
    setError('')
    try {
      const generated = await onGenerate({
        ...(planningPackage ? { mode: 'planning_package', intelligence_run_id: intelligence.document_intelligence_run_id } : {}),
        ...(configuration?.configuration_version != null ? { expected_configuration_version: configuration.configuration_version } : {}),
      })
      if (!generated) throw new Error(planningPackage ? 'The planning package has not opened. Finish any pending edits or saves, then retry.' : 'Generation did not return a document evidence snapshot.')
      setResult(generated)
      setStep(4)
    } catch (err) {
      setError(messageFor(err, 'Schedule generation failed.'))
    } finally {
      setSaving(false)
    }
  }

  const retryPreview = () => prepareReview(step === 0 ? 1 : step)
  const previewLabel = previewJob?.status === 'queued' ? 'Preview queued — waiting for a worker'
    : previewJob?.status === 'running' ? (previewJob.message || 'Preparing source evidence preview…')
      : 'Requesting source evidence preview…'
  const reportedProgress = Number.isFinite(previewJob?.progress) ? Math.min(100, Math.max(0, previewJob.progress)) : null

  return (
    <div ref={dialogRef} tabIndex={-1} className="fixed inset-0 z-[120] bg-slate-950/55 backdrop-blur-sm p-3 sm:p-6" role="dialog" aria-modal="true" aria-busy={loading || saving || previewing} aria-label="Schedule generation wizard">
      <div className="mx-auto flex h-full max-w-7xl flex-col overflow-hidden rounded-3xl bg-slate-50 shadow-2xl ring-1 ring-white/20">
        <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-xl text-white">✦</div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Phase C · Controlled generation</p>
            <h2 className="truncate text-xl font-bold text-slate-950">Schedule Generation Wizard — {project?.name}</h2>
          </div>
          <button type="button" onClick={closeWizard} disabled={saving} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40">Close</button>
        </header>

        <div className="border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
          <div className="grid grid-cols-5 gap-2">
            {(planningPackage ? ['Inputs', 'Workflow plan', 'Logic & sequence', 'Review', 'Complete'] : STEPS).map((label, index) => (
              <div key={label} className="min-w-0">
                <div className={`h-1.5 rounded-full ${index <= step ? 'bg-violet-600' : 'bg-slate-200'}`} />
                <p className={`mt-2 truncate text-xs font-bold ${index === step ? 'text-violet-700' : 'text-slate-400'}`}>{index + 1}. {label}</p>
              </div>
            ))}
          </div>
          {(loading || saving || previewing) && <ProcessingBar label={loading ? 'Loading source evidence…' : previewing ? previewLabel : planningPackage ? 'Building the editable planning package…' : 'Preparing the document evidence draft…'} progress={previewing ? reportedProgress : null} elapsed={previewing ? previewElapsed : null} />}
          {previewing && <div className="mt-3 text-sm text-slate-600"><p>You can close this preview and return to check its result. Closing does not cancel the background job or create a schedule.</p>{previewJob?.status === 'queued' && previewElapsed >= 15 && <div className="mt-2 flex flex-wrap items-center gap-3"><p>The preview is still waiting for a worker; processing has not started.</p><button type="button" onClick={() => prepareReview(step === 0 ? 1 : step, true)} className="rounded-lg border border-violet-300 bg-white px-3 py-2 font-semibold text-violet-700">Retry queued preview</button></div>}</div>}
        </div>

        <main className="flex-1 overflow-y-auto p-5 sm:p-7">
          {loading ? <div className="flex h-full items-center justify-center text-slate-500">Loading project configuration…</div> : (
            <div className="mx-auto max-w-5xl space-y-5">
              {step === 0 && <PlanningExtractionCoverage coverage={intelligence?.processing_coverage} aiCoverage={intelligence?.ai_processing_coverage} />}
              {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}{previewConflict && onReviewEvidence ? <button type="button" onClick={onReviewEvidence} className="ml-3 rounded-lg border border-rose-300 bg-white px-3 py-2">Review current source evidence</button> : !previewing && !saving && previewFailed && !previewConflict && step < 4 && <button type="button" onClick={retryPreview} className="ml-3 rounded-lg border border-rose-300 bg-white px-3 py-2">Retry preview</button>}</div>}

              {step === 0 && (
                <>
                  <div><h3 className="text-2xl font-bold text-slate-950">Confirm generation scope</h3><p className="mt-1 text-slate-600">{planningPackage ? `The preview resolves source deliverables from saved analysis #${intelligence?.document_intelligence_run_id}. The catalogue counts below may be incomplete. Building a proposal does not confirm findings or approve a baseline.` : 'The wizard uses the reviewed Document Intelligence selection. It does not silently add excluded disciplines or deliverables.'}</p></div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Metric label="Parsed source files" value={parsedFiles.length} tone={parsedFiles.length ? 'green' : 'red'} />
                    <Metric label={planningPackage ? 'Recorded catalogue disciplines' : 'In-scope disciplines'} value={disciplines.length} />
                    <Metric label={planningPackage ? 'Recorded catalogue deliverables' : 'Selected deliverables'} value={deliverableCount} />
                  </div>
                  {failedFiles.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{failedFiles.length} failed file(s) will not be used. Correct or remove them before generation if they contain required scope.</div>}
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    {disciplines.map(([code, item]) => {
                      const excluded = new Set(item.excluded_deliverables || [])
                      const count = (item.deliverables || []).filter(name => !excluded.has(name)).length
                      return <div key={code} className="flex items-center justify-between border-b border-slate-100 px-4 py-3 last:border-0"><span className="font-semibold capitalize text-slate-800">{code.replaceAll('_', ' ')}</span><span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">{count} deliverables</span></div>
                    })}
                  </div>
                </>
              )}

              {step === 1 && <>
                {planningPackage ? <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4" aria-label="Planned workflow families">
                  <h3 className="text-2xl font-bold text-slate-950">Planned workflow families</h3>
                  <p className="text-sm text-slate-600">These workflows belong to the proposed planning package. Their stages and durations are planning assumptions for review, not additional extracted source facts.</p>
                  <div className="grid gap-3 sm:grid-cols-2"><Metric label="Resolved source deliverables" value={preview?.deliverable_count ?? 'Not Specified'} /><Metric label="Planned activities" value={preview?.activity_count ?? 'Not Specified'} /></div>
                  <div className="grid gap-3 sm:grid-cols-2">{Object.entries(preview?.workflow_family_counts || {}).map(([family, count]) => <Metric key={family} label={familyLabel(family)} value={count} />)}</div>
                </section> : <>
                <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4" aria-label="Recorded workflow families">
                  <div><h3 className="text-2xl font-bold text-slate-950">Recorded workflow families</h3><p className="mt-1 text-sm text-slate-600">Recorded families are reference only. This draft uses source activities and does not apply workflow templates or grant approvals.</p></div>
                  {planLoading ? <p role="status" className="text-sm text-slate-600">Loading recorded workflow families…</p> : planError ? <div role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800"><p>{planError}</p><button type="button" onClick={() => setPlanRevision(value => value + 1)} disabled={saving} className="mt-2 rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold">Retry workflow reference</button></div> : generationPlan ? <>
                    <dl className="space-y-2 text-sm"><Row label="Recorded plan" value={`Version ${generationPlan.version ?? 'Not Specified'}`}/><Row label="Recorded status" value={generationPlan.status || 'Not Specified'}/><Row label="Recorded scenario" value={familyLabel(generationPlan.selected_scenario)}/></dl>
                    {generationPlan.deliverables?.length ? <div className="overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">Recorded deliverable</th><th className="p-3">Workflow family</th></tr></thead><tbody>{generationPlan.deliverables.map((item, index) => <tr key={item.id || index}><td className="p-3">{item.canonical_name || 'Not Specified'}</td><td className="p-3">{familyLabel(item.workflow_family)}</td></tr>)}</tbody></table></div> : <p className="text-sm text-slate-600">No workflow family assignments are recorded in this plan.</p>}
                  </> : <p className="text-sm text-slate-600">No generation plan is recorded. Workflow families are Not Specified; review the source activities below.</p>}
                </section></>}
                <div><h3 className="text-2xl font-bold text-slate-950">{planningPackage ? 'Review planned activities' : 'Review source activities'}</h3><p className="mt-1 text-slate-600">{planningPackage ? 'Review the generated tasks, their recorded sources and proposed durations before creating the editable draft.' : 'Activities and durations come from the extracted source evidence. Missing information remains Not Specified.'}</p></div>
                <p className="text-sm text-slate-600">Showing {sourceActivities.length} of {preview?.activity_count ?? 'Not Specified'} {planningPackage ? 'planned' : 'extracted'} activities.</p>{preview?.activity_count === 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p>No source activities were extracted. Text extraction alone does not establish schedule activities. Review the source evidence or add an activity schedule before calculation.</p>{onReviewEvidence && <button type="button" onClick={onReviewEvidence} className="mt-2 rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold">Review source evidence</button>}</div>}<div className="overflow-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">Activity / deliverable</th><th className="p-3">{planningPackage ? 'Planning duration' : 'Source duration'}</th><th className="p-3">Source reference</th></tr></thead><tbody>{sourceActivities.map((item, index) => <tr key={item.id || index}><td className="p-3">{item.canonical_name || item.name || item.title || 'Not Specified'}</td><td className="p-3">{item.original_duration_days == null ? 'Not Specified' : `${item.original_duration_days} ${durationUnitLabel({ ...item, duration_source: planningPackage ? item.duration_source || 'planning_assumption' : 'source_document' })}`}</td><td className="p-3">{item.source_references?.length ? item.source_references.map(sourceReferenceLabel).join('; ') : 'Not Specified'}</td></tr>)}</tbody></table></div>
                <p className="text-sm text-slate-600">{planningPackage ? 'Workflow stages are proposed planning tasks. Confirm their suitability in the editable planner.' : 'Workflow stages and task counts are not added from templates.'}</p>
              </>}
              {step === 2 && <>
                <div><h3 className="text-2xl font-bold text-slate-950">{planningPackage ? 'Review planned logic and sequence' : 'Review source logic'}</h3><p className="mt-1 text-slate-600">{planningPackage ? 'Review workflow-stage links and technical sequence proposals. Planning assumptions remain distinct from source evidence and require review.' : 'Review relationships extracted from the documents. Document order, names and templates do not establish a dependency.'}</p></div>
                <div className="grid gap-3 sm:grid-cols-2"><Metric label={planningPackage ? 'Planned relationships' : 'Extracted relationships'} value={preview?.relationship_count ?? 'Not Specified'}/><Metric label="Shown in this preview" value={sourceRelationships.length}/></div>
                <div className="overflow-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">Predecessor</th><th className="p-3">Successor</th><th className="p-3">Type</th><th className="p-3">Lag</th><th className="p-3">Source reference</th></tr></thead><tbody>{sourceRelationships.map((item, index) => <tr key={item.id || index}><td className="p-3">{item.predecessor_name || sourceNames.get(String(item.predecessor ?? item.predecessor_id)) || item.predecessor || item.predecessor_id || 'Not Specified'}</td><td className="p-3">{item.successor_name || sourceNames.get(String(item.successor ?? item.successor_id)) || item.successor || item.successor_id || 'Not Specified'}</td><td className="p-3">{item.relationship_type || item.type || 'Not Specified'}</td><td className="p-3">{item.lag_days == null ? 'Not Specified' : `${item.lag_days} d`}</td><td className="p-3">{item.source_references?.length ? item.source_references.map(sourceReferenceLabel).join('; ') : 'Not Specified'}</td></tr>)}{!sourceRelationships.length && <tr><td colSpan={5} className="p-3">Not Specified: no extracted source relationships.</td></tr>}</tbody></table></div>
              </>}

              {step === 3 && preview && (
                <>
                  <div><h3 className="text-2xl font-bold text-slate-950">Review the exact generation plan</h3><p className="mt-1 text-slate-600">Review the extracted evidence and validation findings before creating a draft. Dates and float require complete durations, relationships and calendar information.</p></div>
                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4"><Metric label="WBS nodes" value={preview.wbs_node_count ?? 'Not Specified'}/><Metric label="Deliverables" value={preview.deliverable_count ?? 'Not Specified'}/><Metric label="Activities" value={preview.activity_count ?? 'Not Specified'}/><Metric label="Workflow tasks" value={preview.configured_workflow_activity_count ?? 'Not Specified'}/><Metric label="Source gaps" value={preview.missing_information?.length ?? 'Not Specified'}/><Metric label="Relationships" value={preview.relationship_count ?? 'Not Specified'}/><Metric label="Milestones" value={preview.milestone_count ?? 'Not Specified'}/></div>
                  <div className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-4"><h4 className="font-bold text-slate-900">Configuration snapshot</h4><dl className="mt-3 space-y-2 text-sm"><Row label="Activity authority" value={planningPackage ? 'Saved analysis and proposed planning workflows' : 'Extracted source evidence'}/><Row label={planningPackage ? 'Relationships planned' : 'Relationships extracted'} value={`${preview.relationship_count ?? 'Not Specified'}`}/><Row label="Missing source values" value="Not Specified"/></dl></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><h4 className="font-bold text-slate-900">Pre-generation validation</h4><div className="mt-3 space-y-2">{(preview.validation || []).map((item, index) => <div key={`${item.rule}-${index}`} className={`rounded-lg px-3 py-2 text-xs font-semibold ${['critical', 'error'].includes(item.severity) ? 'bg-rose-50 text-rose-700' : item.severity === 'warning' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>{item.message}</div>)}</div></div></div>
                  {planningPackage && (preview.assumptions || []).length > 0 && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><h4 className="font-bold">Planning assumptions to review</h4><ul className="mt-2 list-disc pl-5">{preview.assumptions.map((item, index) => <li key={index}>{typeof item === 'string' ? item : item.message || item.description || item.label || item.code}</li>)}</ul></section>}
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">{planningPackage ? 'Generate creates a separate editable planning package with WBS, workflow tasks and proposed logic. It does not approve source facts, planning assumptions or a baseline.' : 'Generate saves a document evidence draft for review. Schedule calculation requires complete source durations, relationships and calendar information.'}</div>
                </>
              )}

              {step === 3 && !preview && (
                <div className="mx-auto max-w-2xl rounded-3xl border border-blue-200 bg-white p-7 text-center shadow-sm"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-2xl text-blue-700">↻</div><h3 className="mt-4 text-2xl font-bold text-slate-950">Source preview pending</h3><p className="mt-2 text-sm text-slate-600">Retry the preview using the source evidence. A retry does not create a schedule version.</p><button type="button" onClick={retryPreview} disabled={saving || previewing} className="mt-5 rounded-xl bg-violet-600 px-5 py-3 font-bold text-white disabled:opacity-40">{previewing ? 'Preparing preview…' : 'Retry schedule preview'}</button></div>
              )}

              {step === 4 && (
                <div className="py-12 text-center"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl text-emerald-700">✓</div><h3 className="mt-5 text-3xl font-bold text-slate-950"> {evidenceReviewRequired ? 'Document evidence ready for review' : planningPackage ? 'Editable planning package ready' : 'Schedule generated successfully'}</h3><p className="mt-2 text-slate-600">{evidenceReviewRequired ? 'Review Not Specified values and source relationships before schedule calculation.' : `Generation v${result?.generation?.version} and schedule version ${scheduleVersionId} are ready.`}</p><div className="mt-7 flex flex-wrap justify-center gap-3">{evidenceReviewRequired && generatedEvidenceId && <button type="button" onClick={() => onOpenPlanner({ generationId: generatedEvidenceId })} className="rounded-xl bg-violet-600 px-5 py-3 font-bold text-white shadow hover:bg-violet-700">Open draft workspace</button>}<button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-bold text-slate-700 hover:bg-slate-50">Return to package</button><button type="button" onClick={evidenceReviewRequired ? onReviewEvidence || onClose : () => onOpenPlanner({ versionId: scheduleVersionId, scheduleId: result?.job?.result_data?.schedule_id })} className="rounded-xl bg-violet-600 px-5 py-3 font-bold text-white shadow hover:bg-violet-700">{evidenceReviewRequired ? 'Review source evidence' : 'Open Planner Workspace →'}</button></div></div>
              )}
            </div>
          )}
        </main>

        {!loading && step < 4 && <footer className="flex items-center justify-between border-t border-slate-200 bg-white px-5 py-4 sm:px-7"><button type="button" onClick={() => previewing ? closeWizard() : step ? setStep(value => value - 1) : closeWizard()} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40">{previewing ? 'Close preview' : step ? '← Back' : 'Cancel'}</button><div className="flex items-center gap-3"><span className="hidden text-xs font-semibold text-slate-400 sm:inline">Configuration v{configuration?.configuration_version || '—'}</span>{step === 3 ? <button type="button" onClick={generate} disabled={saving || previewing || !canContinue()} className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-700 px-5 py-2.5 text-sm font-bold text-white shadow disabled:opacity-40">{saving ? 'Generating…' : 'Generate new draft'}</button> : <button type="button" onClick={next} disabled={saving || previewing} className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-slate-800 disabled:opacity-40">{previewing ? 'Preparing preview…' : 'Continue →'}</button>}</div></footer>}
      </div>
    </div>
  )
}

function Metric({ label, value, tone = 'violet' }) {
  const tones = { violet: 'bg-violet-50 text-violet-700', green: 'bg-emerald-50 text-emerald-700', red: 'bg-rose-50 text-rose-700' }
  return <div className={`rounded-2xl p-4 ${tones[tone] || tones.violet}`}><p className="text-2xl font-black">{value}</p><p className="mt-1 text-xs font-bold uppercase tracking-wide opacity-75">{label}</p></div>
}

function Row({ label, value }) {
  return <div className="flex items-start justify-between gap-4"><dt className="text-slate-500">{label}</dt><dd className="text-right font-bold text-slate-800">{value}</dd></div>
}

function ProcessingBar({ label, progress = null, elapsed = null }) {
  return <div className="mt-4"><div role="status" aria-live="polite" className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-violet-700"><span>{label}</span><span>{progress == null ? 'In progress' : `${progress}%`}</span></div><div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} {...(progress == null ? {} : { 'aria-valuenow': progress })} className="h-2 overflow-hidden rounded-full bg-violet-100"><div style={progress == null ? undefined : { width: `${progress}%` }} className={`h-full rounded-full bg-violet-600 ${progress == null ? 'w-full animate-pulse' : ''}`} /></div>{elapsed != null && <p className="mt-1 text-xs text-slate-600">Elapsed: {elapsed}s</p>}</div>
}

GenerationWizard.propTypes = {
  open: PropTypes.bool.isRequired,
  project: PropTypes.shape({ id: PropTypes.number, name: PropTypes.string, updated_at: PropTypes.string }),
  files: PropTypes.arrayOf(PropTypes.object),
  intelligence: PropTypes.shape({ document_intelligence_run_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]), disciplines: PropTypes.object, processing_coverage: PropTypes.object, ai_processing_coverage: PropTypes.object }),
  intelligenceOverrides: PropTypes.object,
  generationMode: PropTypes.oneOf(['document', 'planning_package']),
  onClose: PropTypes.func.isRequired,
  onGenerate: PropTypes.func.isRequired,
  onOpenPlanner: PropTypes.func.isRequired,
  onReviewEvidence: PropTypes.func,
}

Metric.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  tone: PropTypes.string,
}

Row.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
}

ProcessingBar.propTypes = { label: PropTypes.string.isRequired, progress: PropTypes.number, elapsed: PropTypes.number }
