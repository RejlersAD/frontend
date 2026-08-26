import React, { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import planningIntelligenceService from '../../services/planningIntelligence.service'
import usePlanningJob from '../../hooks/usePlanningJob'

const runningStatuses = new Set(['queued', 'running'])
const errorText = (error, fallback) => error?.response?.data?.error || error?.message || fallback
const BUILD_STAGES = [
  { label: 'Documents reviewed', startsAt: 5, completesAt: 12 },
  { label: 'Scope and deliverables identified', startsAt: 12, completesAt: 30 },
  { label: 'Workflows assigned', startsAt: 30, completesAt: 50 },
  { label: 'Building activity logic', startsAt: 50, completesAt: 70 },
  { label: 'Calculating CPM', startsAt: 70, completesAt: 86 },
  { label: 'Running final checks', startsAt: 86, completesAt: 100 },
]
const APPROVAL_STAGES = [
  { label: 'Approving final assurance', startsAt: 5, completesAt: 60 },
  { label: 'Creating controlled baseline snapshot', startsAt: 60, completesAt: 95 },
  { label: 'Finalizing baseline', startsAt: 95, completesAt: 100 },
]

const StageTracker = ({ job }) => {
  const progress = Number(job.progress || 0)
  const phases = (job.progress_log || []).map(item => item.phase)
  const approval = phases.some(phase => ['assurance_approval', 'baseline_snapshot'].includes(phase))
  const stages = approval ? APPROVAL_STAGES : BUILD_STAGES
  const context = job.result_data?.progress_context || {}
  return <div className="mt-4 grid gap-1.5">
    {stages.map(stage => {
      const complete = progress >= stage.completesAt
      const active = !complete && progress >= stage.startsAt
      return <div key={stage.label} className={`flex items-center gap-2 text-sm font-semibold ${complete ? 'text-emerald-700' : active ? 'text-blue-900' : 'text-slate-400'}`}>
        <span className="w-4 text-center" aria-hidden="true">{complete ? '✓' : active ? '●' : '○'}</span>
        <span>{stage.label}</span>
      </div>
    })}
    {!approval && context.deliverable_count && <p className="mt-3 text-sm font-semibold text-blue-800">
      Processing {context.deliverable_count} deliverables{context.relationship_count ? ` and ${context.relationship_count} relationships` : ''}…
    </p>}
    {!approval && context.activity_count && <p className="text-xs text-blue-700">{context.activity_count} activities in the generated network.</p>}
  </div>
}

StageTracker.propTypes = { job: PropTypes.object.isRequired }

export default function WorkablePlanBuilder({ projectId, intelligenceRunId, onOpenPlanner }) {
  const [job, setJob] = useState(null)
  const [baseline, setBaseline] = useState(null)
  const [error, setError] = useState('')
  const [approving, setApproving] = useState(false)
  const [included, setIncluded] = useState(new Set())
  const [conflictFacts, setConflictFacts] = useState({})
  const [scenario, setScenario] = useState('')
  const [basisUpdates, setBasisUpdates] = useState({})
  const { activeJob, runJob } = usePlanningJob({ storageKey: `radai-workable-plan-job-${projectId}` })

  useEffect(() => {
    if (!projectId) return
    planningIntelligenceService.getWorkablePlanStatus(projectId).then(data => {
      setJob(data.job || null)
      setBaseline(data.baseline || null)
    }).catch(error => setError(errorText(error, 'Could not load the workable-plan status.')))
  }, [projectId])

  useEffect(() => {
    if (activeJob?.job_type === 'workable_plan') setJob(activeJob)
  }, [activeJob])

  const result = job?.result_data || {}
  const sheet = result.decision_sheet || {}
  const inputDecisionKey = useMemo(() => JSON.stringify({
    job: job?.id, deliverables: (sheet.deliverables || []).map(item => item.id),
    conflicts: (sheet.conflicts || []).map(item => item.id), scenarios: sheet.scenario_options || [],
  }), [job?.id, sheet.deliverables, sheet.conflicts, sheet.scenario_options])

  useEffect(() => {
    const deliverables = sheet.deliverables || []
    setIncluded(new Set(deliverables.map(item => item.id)))
    setConflictFacts(Object.fromEntries(
      (sheet.conflicts || []).map(item => [item.id, item.recommended_fact_id || '']),
    ))
    setScenario((sheet.scenario_options || []).length === 1 ? sheet.scenario_options[0] : '')
    setBasisUpdates(Object.fromEntries((sheet.missing_fields || []).map(item => [item.field, item.value || ''])))
  // Reset defaults only when a new decision sheet arrives.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputDecisionKey])

  const execute = async decisions => {
    setError('')
    try {
      const completed = await runJob(() => planningIntelligenceService.buildWorkablePlan(projectId, decisions))
      if (completed) setJob(completed)
    } catch (error) {
      setError(errorText(error, 'Could not build the workable project plan.'))
    }
  }

  const confirmDecisions = () => execute({
    confirmed: true,
    included_deliverable_ids: [...included],
    conflict_fact_ids: conflictFacts,
    selected_scenario: scenario,
    basis_updates: basisUpdates,
  })

  const approveBaseline = async () => {
    setApproving(true)
    setError('')
    try {
      const completed = await runJob(() => planningIntelligenceService.approveWorkableBaseline(
        projectId, result.summary?.schedule_version_id,
      ))
      if (completed) {
        setJob(completed)
        setBaseline(completed.result_data?.baseline || null)
      }
    } catch (error) {
      setError(errorText(error, 'Could not approve the plan as baseline.'))
    } finally {
      setApproving(false)
    }
  }

  if (!intelligenceRunId) return null
  const isRunning = job?.job_type === 'workable_plan' && runningStatuses.has(job.status)
  const canStart = !job || ['failed', 'cancelled'].includes(job.status)
  const scheduleBlockers = sheet.schedule_blockers || []
  const needsInput = result.state === 'needs_decisions' && !scheduleBlockers.length
  const conflictsComplete = (sheet.conflicts || []).every(item => conflictFacts[item.id])
  const fieldsComplete = (sheet.missing_fields || []).every(item => basisUpdates[item.field])
  const scenarioComplete = !(sheet.scenario_options || []).length || Boolean(scenario)

  return (
    <section id="workable-plan-builder" className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-wider text-violet-600">One-step planning</p><h3 className="mt-1 text-xl font-bold text-slate-900">Build Workable Project Plan</h3><p className="mt-1 text-sm text-slate-600">RADAI handles the controlled basis, workflow logic, schedule generation, CPM and assurance automatically. You review only exceptions.</p></div>
        {canStart && <button type="button" onClick={() => execute(null)} className="rounded-xl bg-violet-700 px-5 py-3 text-sm font-bold text-white shadow">{job ? 'Retry Workable Project Plan' : 'Build Workable Project Plan'}</button>}
      </div>

      {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}

      {isRunning && <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4" aria-live="polite">
        <div className="flex justify-between text-sm font-bold text-blue-900"><span>{job.message || 'Building your project plan'}</span><span>{job.progress || 0}%</span></div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-blue-100" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={job.progress || 0}><div className="h-full rounded-full bg-blue-700 transition-all duration-500" style={{ width: `${job.progress || 0}%` }} /></div>
        <StageTracker job={job} />
        <p className="mt-2 text-xs text-blue-700">Processing continues safely if you leave or refresh this page. Editing is disabled until this stage finishes.</p>
      </div>}

      {needsInput && <div className="mt-5 space-y-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
        <div><h4 className="font-bold text-amber-950">Confirm only the detected exceptions</h4><p className="text-sm text-amber-800">Recommended selections are pre-filled. Review them once, then rebuild.</p></div>
        {(sheet.deliverables || []).length > 0 && <div><h5 className="text-sm font-bold text-slate-800">Uncertain deliverables</h5><div className="mt-2 max-h-56 space-y-2 overflow-auto">{sheet.deliverables.map(item => <label key={item.id} className="flex items-start gap-3 rounded-lg border border-amber-200 bg-white p-3"><input type="checkbox" checked={included.has(item.id)} onChange={() => setIncluded(current => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next })} className="mt-1"/><span><b className="text-sm text-slate-800">{item.name}</b><span className="block text-xs text-slate-500">{item.discipline || 'General'} · confidence {Math.round((item.confidence || 0) * 100)}%</span></span></label>)}</div></div>}
        {(sheet.conflicts || []).map(item => <div key={item.id}><label className="text-sm font-bold text-slate-800">{item.description}</label><select value={conflictFacts[item.id] || ''} onChange={event => setConflictFacts(current => ({ ...current, [item.id]: event.target.value }))} className="mt-2 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"><option value="">Select the correct evidence</option>{item.candidates.map(candidate => <option key={candidate.id} value={candidate.id}>{String(candidate.value)} ({Math.round((candidate.confidence || 0) * 100)}% confidence)</option>)}</select></div>)}
        {(sheet.missing_fields || []).map(item => <label key={item.field} className="block text-sm font-bold text-slate-800">{item.label}<input type="date" value={basisUpdates[item.field] || ''} onChange={event => setBasisUpdates(current => ({ ...current, [item.field]: event.target.value }))} className="mt-2 block w-full rounded-lg border border-amber-200 bg-white px-3 py-2"/></label>)}
        {(sheet.scenario_options || []).length > 0 && <label className="block text-sm font-bold text-slate-800">Execution scenario<select value={scenario} onChange={event => setScenario(event.target.value)} className="mt-2 block w-full rounded-lg border border-amber-200 bg-white px-3 py-2 capitalize"><option value="">Select the contractual scenario</option>{sheet.scenario_options.map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>}
        <button type="button" disabled={!conflictsComplete || !fieldsComplete || !scenarioComplete || isRunning} onClick={confirmDecisions} className="rounded-xl bg-amber-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-40">Confirm Decisions and Rebuild</button>
      </div>}

      {scheduleBlockers.length > 0 && <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4"><h4 className="font-bold text-rose-900">The generated plan has critical scheduling exceptions</h4>{scheduleBlockers.map((item, index) => <p key={`${item.code}-${index}`} className="mt-2 text-sm text-rose-800">• {item.message}</p>)}<button type="button" onClick={onOpenPlanner} className="mt-4 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-bold text-white">Open Plan to Resolve Exceptions</button></div>}

      {result.state === 'ready_for_approval' && !baseline && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><h4 className="font-bold text-emerald-900">Workable plan ready</h4><div className="mt-3 grid gap-3 text-sm sm:grid-cols-4"><div><span className="block text-emerald-700">Activities</span><b>{result.summary?.activity_count}</b></div><div><span className="block text-emerald-700">Relationships</span><b>{result.summary?.relationship_count}</b></div><div><span className="block text-emerald-700">Forecast finish</span><b>{result.summary?.forecast_finish || '—'}</b></div><div><span className="block text-emerald-700">Contract finish</span><b>{result.summary?.contractual_finish || '—'}</b></div></div><button type="button" disabled={approving} onClick={approveBaseline} className="mt-4 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-40">{approving ? 'Approving…' : 'Approve Plan as Baseline'}</button></div>}

      {baseline && <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50 p-4"><h4 className="font-bold text-violet-900">Plan approved as baseline</h4><p className="mt-1 text-sm text-violet-700">{baseline.name} is now the controlled project baseline.</p><button type="button" onClick={onOpenPlanner} className="mt-3 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white">Open Project Plan</button></div>}
    </section>
  )
}

WorkablePlanBuilder.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  intelligenceRunId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onOpenPlanner: PropTypes.func.isRequired,
}
