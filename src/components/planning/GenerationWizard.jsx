import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import planningIntelligenceService from '../../services/planningIntelligence.service'
import PlanningExtractionCoverage from './PlanningExtractionCoverage'
import { durationUnitLabel, sourceReferenceLabel } from '../../utils/planningDurationEvidence'

const STEPS = ['Inputs', 'Source activities', 'Source logic', 'Review', 'Complete']

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
  onClose, onGenerate, onOpenPlanner, onReviewEvidence,
}) {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [configuration, setConfiguration] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!open || !project?.id) return
    let cancelled = false
    setStep(0)
    setError('')
    setPreview(null)
    setResult(null)
    setLoading(true)
    planningIntelligenceService.listScheduleConfigurations(project.id).then(configurationRows => {
      if (!cancelled) setConfiguration(configurationRows[0] || null)
    }).catch(err => {
      if (!cancelled) setError(messageFor(err, 'Could not load scheduling configuration.'))
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [open, project?.id])

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
  const sourceActivities = preview?.sample_activities || []
  const sourceNames = new Map(sourceActivities.map(item => [String(item.id), item.name || item.title || item.id]))
  const sourceRelationships = preview?.sample_logic_matrix || preview?.logic_matrix || sourceActivities.flatMap(item => (item.predecessors || []).map(link => ({ ...link, predecessor: link.id, successor: item.id })))

  if (!open) return null

  const blockerForStep = () => {
    if (step === 0) {
      if (!parsedFiles.length) return 'No parsed source document is available. Wait for parsing to finish or correct the failed upload.'
      if (!intelligence) return 'Document Intelligence has not completed. Run Document Intelligence before schedule generation.'
    }
    if (step === 3) {
      if (!preview) return 'The generation preview has not completed.'

    }
    return ''
  }

  const canContinue = () => !blockerForStep()

  const prepareReview = async (nextStep = 3) => {
    setSaving(true)
    setError('')
    try {
      const generatedPreview = await planningIntelligenceService.previewGeneration(project.id, {
        intelligence_overrides: intelligenceOverrides,
      })
      setPreview(generatedPreview)
      setStep(nextStep)
    } catch (err) {
      setError(messageFor(err, 'Could not prepare the generation preview.'))
    } finally {
      setSaving(false)
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
    setError('')
    try {
      const generated = await onGenerate({
        ...(configuration?.configuration_version != null ? { expected_configuration_version: configuration.configuration_version } : {}),
      })
      if (!generated) throw new Error('Generation did not return a document evidence snapshot.')
      setResult(generated)
      setStep(4)
    } catch (err) {
      setError(messageFor(err, 'Schedule generation failed.'))
    } finally {
      setSaving(false)
    }
  }

  const retryPreview = async () => {
    setSaving(true)
    setError('')
    try {
      const generatedPreview = await planningIntelligenceService.previewGeneration(project.id, {
        intelligence_overrides: intelligenceOverrides,
      })
      setPreview(generatedPreview)
    } catch (err) {
      setError(messageFor(err, 'The schedule preview could not be prepared.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/55 backdrop-blur-sm p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Schedule generation wizard">
      <div className="mx-auto flex h-full max-w-7xl flex-col overflow-hidden rounded-3xl bg-slate-50 shadow-2xl ring-1 ring-white/20">
        <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-xl text-white">✦</div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Phase C · Controlled generation</p>
            <h2 className="truncate text-xl font-bold text-slate-950">Schedule Generation Wizard — {project?.name}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40">Close</button>
        </header>

        <div className="border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
          <div className="grid grid-cols-5 gap-2">
            {STEPS.map((label, index) => (
              <div key={label} className="min-w-0">
                <div className={`h-1.5 rounded-full ${index <= step ? 'bg-violet-600' : 'bg-slate-200'}`} />
                <p className={`mt-2 truncate text-xs font-bold ${index === step ? 'text-violet-700' : 'text-slate-400'}`}>{index + 1}. {label}</p>
              </div>
            ))}
          </div>
          {(loading || saving) && <ProcessingBar label={loading ? 'Loading source evidence…' : step === 2 ? 'Reviewing source evidence and preparing the schedule preview…' : step === 3 ? 'Preparing the document evidence draft…' : 'Processing…'} />}
        </div>

        <main className="flex-1 overflow-y-auto p-5 sm:p-7">
          {loading ? <div className="flex h-full items-center justify-center text-slate-500">Loading project configuration…</div> : (
            <div className="mx-auto max-w-5xl space-y-5">
              {step === 0 && <PlanningExtractionCoverage coverage={intelligence?.processing_coverage} aiCoverage={intelligence?.ai_processing_coverage} />}
              {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}

              {step === 0 && (
                <>
                  <div><h3 className="text-2xl font-bold text-slate-950">Confirm generation scope</h3><p className="mt-1 text-slate-600">The wizard uses the reviewed Document Intelligence selection. It does not silently add excluded disciplines or deliverables.</p></div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Metric label="Parsed source files" value={parsedFiles.length} tone={parsedFiles.length ? 'green' : 'red'} />
                    <Metric label="In-scope disciplines" value={disciplines.length} />
                    <Metric label="Selected deliverables" value={deliverableCount} />
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
                <div><h3 className="text-2xl font-bold text-slate-950">Review source activities</h3><p className="mt-1 text-slate-600">Activities and durations come from the extracted source evidence. Missing information remains Not Specified.</p></div>
                <p className="text-sm text-slate-600">Showing {sourceActivities.length} of {preview?.activity_count ?? 'Not Specified'} extracted activities.</p><div className="overflow-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">Activity / deliverable</th><th className="p-3">Source duration</th><th className="p-3">Source reference</th></tr></thead><tbody>{sourceActivities.map((item, index) => <tr key={item.id || index}><td className="p-3">{item.canonical_name || item.name || item.title || 'Not Specified'}</td><td className="p-3">{item.original_duration_days == null ? 'Not Specified' : `${item.original_duration_days} ${durationUnitLabel({ ...item, duration_source: 'source_document' })}`}</td><td className="p-3">{item.source_references?.length ? item.source_references.map(sourceReferenceLabel).join('; ') : 'Not Specified'}</td></tr>)}</tbody></table></div>
                <p className="text-sm text-slate-600">Workflow stages and task counts are not added from templates.</p>
              </>}
              {step === 2 && <>
                <div><h3 className="text-2xl font-bold text-slate-950">Review source logic</h3><p className="mt-1 text-slate-600">Review relationships extracted from the documents. Document order, names and templates do not establish a dependency.</p></div>
                <div className="grid gap-3 sm:grid-cols-2"><Metric label="Extracted relationships" value={preview?.relationship_count ?? 'Not Specified'}/><Metric label="Shown in this preview" value={sourceRelationships.length}/></div>
                <div className="overflow-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">Predecessor</th><th className="p-3">Successor</th><th className="p-3">Type</th><th className="p-3">Lag</th><th className="p-3">Source reference</th></tr></thead><tbody>{sourceRelationships.map((item, index) => <tr key={item.id || index}><td className="p-3">{item.predecessor_name || sourceNames.get(String(item.predecessor ?? item.predecessor_id)) || item.predecessor || item.predecessor_id || 'Not Specified'}</td><td className="p-3">{item.successor_name || sourceNames.get(String(item.successor ?? item.successor_id)) || item.successor || item.successor_id || 'Not Specified'}</td><td className="p-3">{item.relationship_type || item.type || 'Not Specified'}</td><td className="p-3">{item.lag_days == null ? 'Not Specified' : `${item.lag_days} d`}</td><td className="p-3">{item.source_references?.length ? item.source_references.map(sourceReferenceLabel).join('; ') : 'Not Specified'}</td></tr>)}{!sourceRelationships.length && <tr><td colSpan={5} className="p-3">Not Specified: no extracted source relationships.</td></tr>}</tbody></table></div>
              </>}

              {step === 3 && preview && (
                <>
                  <div><h3 className="text-2xl font-bold text-slate-950">Review the source generation plan</h3><p className="mt-1 text-slate-600">Review the extracted evidence and validation findings before creating a draft. Dates and float require complete durations, relationships and calendar information.</p></div>
                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6"><Metric label="WBS nodes" value={preview.wbs_node_count}/><Metric label="Deliverables" value={preview.deliverable_count}/><Metric label="Activities" value={preview.activity_count}/><Metric label="Source gaps" value={preview.missing_information?.length ?? 'Not Specified'}/><Metric label="Relationships" value={preview.relationship_count}/><Metric label="Milestones" value={preview.milestone_count}/></div>
                  <div className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-4"><h4 className="font-bold text-slate-900">Configuration snapshot</h4><dl className="mt-3 space-y-2 text-sm"><Row label="Activity authority" value="Extracted source evidence"/><Row label="Relationships extracted" value={`${preview.relationship_count ?? 'Not Specified'}`}/><Row label="Missing source values" value="Not Specified"/></dl></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><h4 className="font-bold text-slate-900">Pre-generation validation</h4><div className="mt-3 space-y-2">{(preview.validation || []).map((item, index) => <div key={`${item.rule}-${index}`} className={`rounded-lg px-3 py-2 text-xs font-semibold ${item.severity === 'critical' ? 'bg-rose-50 text-rose-700' : item.severity === 'warning' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>{item.message}</div>)}</div></div></div>
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">Generate saves a document evidence draft for review. Schedule calculation requires complete source durations, relationships and calendar information.</div>
                </>
              )}

              {step === 3 && !preview && (
                <div className="mx-auto max-w-2xl rounded-3xl border border-blue-200 bg-white p-7 text-center shadow-sm"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-2xl text-blue-700">↻</div><h3 className="mt-4 text-2xl font-bold text-slate-950">Source preview pending</h3><p className="mt-2 text-sm text-slate-600">Retry the preview using the source evidence. A retry does not create a schedule version.</p><button type="button" onClick={retryPreview} disabled={saving} className="mt-5 rounded-xl bg-violet-600 px-5 py-3 font-bold text-white disabled:opacity-40">{saving ? 'Preparing preview…' : 'Retry schedule preview'}</button></div>
              )}

              {step === 4 && (
                <div className="py-12 text-center"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl text-emerald-700">✓</div><h3 className="mt-5 text-3xl font-bold text-slate-950"> {evidenceReviewRequired ? 'Document evidence ready for review' : 'Schedule generated successfully'}</h3><p className="mt-2 text-slate-600">{evidenceReviewRequired ? 'Review Not Specified values and source relationships before schedule calculation.' : `Generation v${result?.generation?.version} and schedule version ${scheduleVersionId} are ready.`}</p><div className="mt-7 flex justify-center gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-bold text-slate-700 hover:bg-slate-50">Return to package</button><button type="button" onClick={evidenceReviewRequired ? onReviewEvidence || onClose : onOpenPlanner} className="rounded-xl bg-violet-600 px-5 py-3 font-bold text-white shadow hover:bg-violet-700">{evidenceReviewRequired ? 'Review source evidence' : 'Open Planner Workspace →'}</button></div></div>
              )}
            </div>
          )}
        </main>

        {!loading && step < 4 && <footer className="flex items-center justify-between border-t border-slate-200 bg-white px-5 py-4 sm:px-7"><button type="button" onClick={() => step ? setStep(value => value - 1) : onClose()} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40">{step ? '← Back' : 'Cancel'}</button><div className="flex items-center gap-3"><span className="hidden text-xs font-semibold text-slate-400 sm:inline">Configuration v{configuration?.configuration_version || '—'}</span>{step === 3 ? <button type="button" onClick={generate} disabled={saving || !canContinue()} className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-700 px-5 py-2.5 text-sm font-bold text-white shadow disabled:opacity-40">{saving ? 'Generating…' : 'Generate new draft'}</button> : <button type="button" onClick={next} disabled={saving} className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-slate-800 disabled:opacity-40">{saving ? 'Preparing preview…' : 'Continue →'}</button>}</div></footer>}
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

function ProcessingBar({ label }) {
  return <div className="mt-4" role="status" aria-live="polite"><div className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-violet-700"><span>{label}</span><span>In progress</span></div><div className="h-2 overflow-hidden rounded-full bg-violet-100"><div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-violet-600 via-indigo-500 to-violet-600" /></div></div>
}

GenerationWizard.propTypes = {
  open: PropTypes.bool.isRequired,
  project: PropTypes.shape({ id: PropTypes.number, name: PropTypes.string }),
  files: PropTypes.arrayOf(PropTypes.object),
  intelligence: PropTypes.shape({ disciplines: PropTypes.object, processing_coverage: PropTypes.object, ai_processing_coverage: PropTypes.object }),
  intelligenceOverrides: PropTypes.object,
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

ProcessingBar.propTypes = { label: PropTypes.string.isRequired }
