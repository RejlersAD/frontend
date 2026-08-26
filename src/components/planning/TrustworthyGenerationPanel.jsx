import React, { useCallback, useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import planningIntelligenceService from '../../services/planningIntelligence.service'
import usePlanningJob from '../../hooks/usePlanningJob'

const FAMILIES = [
  ['engineering_document', 'Engineering document'], ['inspection_report', 'Inspection report'],
  ['technical_study', 'Technical study'], ['drawing', 'Drawing'],
  ['plan_procedure', 'Plan / procedure'], ['recurring_report', 'Recurring report'],
  ['tender_package', 'Tender package'], ['final_dossier', 'Final dossier'],
  ['cost_estimate', 'Cost estimate'],
]

const messageFor = (error, fallback) => error?.response?.data?.error || error?.response?.data?.detail || error?.message || fallback

export default function TrustworthyGenerationPanel({ projectId, scheduleBasisStatus }) {
  const [basis, setBasis] = useState(null)
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const { activeJob: buildJob, runJob: runBuildJob } = usePlanningJob({
    storageKey: `radai-generation-plan-job-${projectId}`,
  })

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const [bases, plans] = await Promise.all([
        planningIntelligenceService.listScheduleBases(projectId),
        planningIntelligenceService.listGenerationPlans(projectId),
      ])
      const approvedBasis = bases.find(item => item.status === 'approved') || null
      setBasis(approvedBasis)
      setPlan(plans.find(item => item.basis === approvedBasis?.id) || null)
      setError('')
    } catch (err) {
      setError(messageFor(err, 'Could not load the Generation Plan.'))
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    load()
    const refresh = () => load()
    window.addEventListener('planning-basis-changed', refresh)
    return () => window.removeEventListener('planning-basis-changed', refresh)
  }, [load, scheduleBasisStatus])

  useEffect(() => {
    if (buildJob?.job_type === 'build_plan' && buildJob.status === 'succeeded') load()
  }, [buildJob?.id, buildJob?.status, buildJob?.job_type, load])

  const run = async (operation, fallback) => {
    setWorking(true)
    setError('')
    try {
      await operation()
      await load()
    } catch (err) {
      setError(messageFor(err, fallback))
    } finally {
      setWorking(false)
    }
  }

  if (loading) return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Loading Trustworthy Generation Plan…</div>
  if (!basis) return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Approve the Schedule Basis to unlock Phase 2 generation planning.</div>
  const buildInProgress = buildJob?.job_type === 'build_plan' && ['queued', 'running'].includes(buildJob.status)
  if (!plan) return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
      <h3 className="font-semibold text-blue-900">Trustworthy Generation Plan required</h3>
      <p className="mt-1 text-sm text-blue-800">Classify workflows, generate technical logic, phases, recurrence and conditional scenarios from Schedule Basis v{basis.version}.</p>
      {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
      {buildInProgress && <div className="mt-3" aria-live="polite">
        <div className="flex justify-between text-xs font-medium text-blue-800"><span>{buildJob.message || 'Building Generation Plan'}</span><span>{buildJob.progress || 0}%</span></div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-blue-100" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={buildJob.progress || 0}><div className="h-full rounded-full bg-blue-700 transition-all duration-500" style={{ width: `${buildJob.progress || 0}%` }} /></div>
        <p className="mt-1 text-xs text-blue-700">This job continues on the server if you refresh or leave this page.</p>
      </div>}
      <button type="button" disabled={working || buildInProgress} onClick={() => run(
        () => runBuildJob(() => planningIntelligenceService.buildGenerationPlan(basis.id)),
        'Could not build the Generation Plan.',
      )} className="mt-3 rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">{working || buildInProgress ? 'Building…' : 'Build Generation Plan'}</button>
    </div>
  )

  const immutable = ['approved', 'superseded'].includes(plan.status)
  const readiness = plan.readiness || {}
  const scenarios = readiness.available_scenarios || []

  return (
    <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="flex items-center gap-2"><h3 className="font-semibold text-slate-900">Trustworthy Generation Plan</h3><span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">v{plan.version}</span><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${plan.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{plan.status.replaceAll('_', ' ')}</span></div><p className="mt-1 text-sm text-slate-500">Reviewed translation from contractual inputs to workflows and CPM logic.</p></div>
      </div>
      {error && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      <div className="mt-4 flex flex-wrap gap-2">{(plan.phases || []).map(phase => <span key={phase.id} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">{phase.sequence}. {phase.name}{phase.duration_months ? ` · ${Number(phase.duration_months)} months` : ''}</span>)}</div>

      {(plan.decision_gates || []).length > 0 && (
        <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
          <h4 className="text-sm font-semibold text-violet-900">Decision gate: {plan.decision_gates[0].name}</h4>
          <p className="mt-1 text-xs text-violet-700">Only the selected branch will be generated into the CPM network.</p>
          <div className="mt-2 flex items-center gap-2">
            <select disabled={immutable || working} value={plan.selected_scenario || ''} onChange={event => run(
              () => planningIntelligenceService.updateGenerationPlan(plan.id, { selected_scenario: event.target.value }),
              'Could not save the selected scenario.',
            )} className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm">
              <option value="">Select scenario…</option>
              {scenarios.map(code => <option key={code} value={code}>{code.replaceAll('_', ' ')}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="mt-5"><h4 className="text-sm font-semibold text-slate-800">Workflow classification</h4><p className="text-xs text-slate-500">Each deliverable receives the workflow appropriate to its type.</p></div>
      <div className="mt-2 max-h-80 overflow-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-left text-xs"><thead className="sticky top-0 bg-slate-50 text-slate-500"><tr><th className="px-3 py-2">Deliverable</th><th className="px-3 py-2">Workflow</th><th className="px-3 py-2">Recurrence</th><th className="px-3 py-2">Scenario</th><th className="px-3 py-2">Reason</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{(plan.deliverables || []).map(item => <tr key={item.id}><td className="px-3 py-2"><div className="font-semibold text-slate-800">{item.canonical_name}</div><div className="text-slate-500">{item.discipline} · {item.document_number || 'no document number'}</div></td><td className="px-3 py-2"><select disabled={immutable || working} value={item.workflow_family} onChange={event => run(() => planningIntelligenceService.updatePlanDeliverable(item.id, { workflow_family: event.target.value }), 'Could not update the workflow family.')} className="rounded border border-slate-200 px-2 py-1">{FAMILIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td className="px-3 py-2">{item.recurrence === 'none' ? '—' : `${item.recurrence} × ${item.recurrence_count}`}</td><td className="px-3 py-2 capitalize">{item.scenario_code.replaceAll('_', ' ')}</td><td className="px-3 py-2 text-slate-600">{item.classification_reason}</td></tr>)}</tbody>
        </table>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><div><h4 className="text-sm font-semibold text-slate-800">Evidence-backed technical logic</h4><p className="text-xs text-slate-500">{readiness.confirmed_dependencies || 0} confirmed · {readiness.proposed_dependencies || 0} proposed · {readiness.rejected_dependencies || 0} rejected</p></div>{!immutable && readiness.proposed_dependencies > 0 && <button type="button" disabled={working} onClick={() => run(() => planningIntelligenceService.reviewGenerationDependencies(plan.id, 'confirmed', plan.dependencies.filter(item => item.status === 'proposed').map(item => item.id)), 'Could not confirm dependency logic.')} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Confirm all proposed links</button>}</div>
      <div className="mt-2 max-h-80 overflow-auto rounded-xl border border-slate-200"><table className="min-w-full text-left text-xs"><thead className="sticky top-0 bg-slate-50 text-slate-500"><tr><th className="px-3 py-2">Predecessor</th><th className="px-3 py-2">Successor</th><th className="px-3 py-2">Basis</th><th className="px-3 py-2">Decision</th></tr></thead><tbody className="divide-y divide-slate-100">{(plan.dependencies || []).map(link => <tr key={link.id}><td className="px-3 py-2 font-medium">{link.predecessor_name}</td><td className="px-3 py-2 font-medium">{link.successor_name}</td><td className="px-3 py-2 text-slate-600">{link.rationale}<div className="text-slate-400">{link.relationship_type} · {link.source_type}</div></td><td className="px-3 py-2">{immutable ? <span className="capitalize">{link.status}</span> : <div className="flex gap-1"><button type="button" disabled={working} onClick={() => run(() => planningIntelligenceService.updateGenerationDependency(link.id, { status: 'confirmed' }), 'Could not confirm the dependency.')} className={`rounded px-2 py-1 ${link.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 'border border-emerald-200 text-emerald-700'}`}>Confirm</button><button type="button" disabled={working} onClick={() => run(() => planningIntelligenceService.updateGenerationDependency(link.id, { status: 'rejected' }), 'Could not reject the dependency.')} className={`rounded px-2 py-1 ${link.status === 'rejected' ? 'bg-slate-200 text-slate-700' : 'border border-slate-200 text-slate-600'}`}>Reject</button></div>}</td></tr>)}</tbody></table></div>

      <div className={`mt-4 rounded-xl border p-4 ${readiness.ready ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className={`text-sm font-semibold ${readiness.ready ? 'text-emerald-900' : 'text-amber-900'}`}>{readiness.ready ? 'Generation Plan is ready' : 'Generation Plan needs review'}</h4>{(readiness.blockers || []).map(blocker => <p key={blocker} className="mt-1 text-xs text-amber-800">• {blocker}</p>)}</div>{!immutable && <button type="button" disabled={working || !readiness.ready} onClick={() => run(() => planningIntelligenceService.approveGenerationPlan(plan.id), 'Could not approve the Generation Plan.')} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Approve Generation Plan</button>}</div></div>
    </section>
  )
}

TrustworthyGenerationPanel.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  scheduleBasisStatus: PropTypes.string,
}
