import React, { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import planningIntelligenceService from '../../services/planningIntelligence.service'
import SchedulingDefaultsApprovalPanel from './SchedulingDefaultsApprovalPanel'

const STEPS = ['Scope', 'Workflow', 'Process logic', 'Review', 'Complete']

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
  onClose, onGenerate, onOpenPlanner,
}) {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [configuration, setConfiguration] = useState(null)
  const [workflows, setWorkflows] = useState([])
  const [dependencies, setDependencies] = useState([])
  const [workflowId, setWorkflowId] = useState('')
  const [dependencyId, setDependencyId] = useState('')
  const [customCount, setCustomCount] = useState(false)
  const [requestedCount, setRequestedCount] = useState(5)
  const [confirmedRules, setConfirmedRules] = useState(new Set())
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [pendingProposal, setPendingProposal] = useState(null)
  const [showInlineApproval, setShowInlineApproval] = useState(false)
  const [approvalNotice, setApprovalNotice] = useState(null)

  useEffect(() => {
    if (!open || !project?.id) return
    let cancelled = false
    setStep(0)
    setError('')
    setPreview(null)
    setResult(null)
    setPendingProposal(null)
    setShowInlineApproval(false)
    setApprovalNotice(null)
    setLoading(true)
    Promise.all([
      planningIntelligenceService.listScheduleConfigurations(project.id),
      planningIntelligenceService.listWorkflowTemplates(project.id),
      planningIntelligenceService.listDependencyTemplates(project.id),
    ]).then(([configurationRows, workflowRows, dependencyRows]) => {
      if (cancelled) return
      const current = configurationRows[0] || null
      const activeWorkflows = workflowRows.filter(item => item.status === 'active')
      const activeDependencies = dependencyRows.filter(item => item.status === 'active')
      const selectedWorkflow = activeWorkflows.find(item => item.id === current?.workflow_template)
        || activeWorkflows.find(item => item.is_default)
        || activeWorkflows[0]
      const selectedDependency = activeDependencies.find(item => item.id === current?.dependency_template)
        || activeDependencies.find(item => item.is_default)
        || activeDependencies[0]
      setConfiguration(current)
      setWorkflows(activeWorkflows)
      setDependencies(activeDependencies)
      setWorkflowId(selectedWorkflow?.id || '')
      setDependencyId(selectedDependency?.id || '')
      setRequestedCount(selectedWorkflow?.stage_count || 5)
      setCustomCount((selectedWorkflow?.stage_count || 5) !== 5)
      setConfirmedRules(new Set((current?.settings?.confirmed_dependency_rule_ids || []).map(Number)))
    }).catch(err => {
      if (!cancelled) setError(messageFor(err, 'Could not load scheduling configuration.'))
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [open, project?.id])

  const selectedWorkflow = workflows.find(item => item.id === Number(workflowId)) || null
  const selectedDependency = dependencies.find(item => item.id === Number(dependencyId)) || null
  const parsedFiles = files.filter(item => item.parse_status === 'done')
  const failedFiles = files.filter(item => item.parse_status === 'failed')
  const disciplines = Object.entries(intelligence?.disciplines || {})
    .filter(([, item]) => item?.in_scope !== false)
  const deliverableCount = disciplines.reduce((total, [, item]) => {
    const excluded = new Set(item?.excluded_deliverables || [])
    return total + (item?.deliverables || []).filter(name => !excluded.has(name)).length
  }, 0)
  const matchingWorkflows = useMemo(
    () => workflows.filter(item => Number(item.stage_count) === Number(requestedCount)),
    [workflows, requestedCount],
  )
  const requiredRules = (selectedDependency?.rules || []).filter(item => item.requires_confirmation)
  const outstandingRules = requiredRules.filter(item => !confirmedRules.has(item.id))

  if (!open) return null

  const selectStandard = () => {
    const standard = workflows.find(item => item.is_default && Number(item.stage_count) === 5)
      || workflows.find(item => Number(item.stage_count) === 5)
    setCustomCount(false)
    setRequestedCount(5)
    if (standard) setWorkflowId(standard.id)
  }

  const selectCustomCount = value => {
    const count = Math.max(1, Math.min(50, Number(value) || 1))
    setRequestedCount(count)
    const matching = workflows.find(item => Number(item.stage_count) === count)
    setWorkflowId(matching?.id || '')
  }

  const toggleRule = id => {
    setConfirmedRules(previous => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const blockerForStep = () => {
    if (step === 0) {
      if (!parsedFiles.length) return 'No parsed source document is available. Wait for parsing to finish or correct the failed upload.'
      if (!intelligence) return 'Document Intelligence has not completed. Run Document Intelligence before schedule generation.'
      if (!deliverableCount) return 'Document Intelligence contains no selected deliverables. Include at least one deliverable.'
    }
    if (step === 1) {
      if (!workflows.length) return 'No active workflow template is available for this project.'
      if (!selectedWorkflow) {
        return matchingWorkflows.length
          ? `Select one of the ${matchingWorkflows.length} active ${requestedCount}-task workflow templates.`
          : `No active workflow contains exactly ${requestedCount} tasks. Select the standard five-stage workflow or activate a matching template.`
      }
      const actualCount = Number(selectedWorkflow.stage_count)
      if (actualCount !== Number(requestedCount)) return `Selected workflow “${selectedWorkflow.name}” contains ${actualCount} tasks, but ${requestedCount} tasks were requested.`
    }
    if (step === 2 && selectedDependency && outstandingRules.length) {
      const first = outstandingRules[0]
      return `${outstandingRules.length} Process release gate${outstandingRules.length === 1 ? '' : 's'} still require confirmation. First outstanding gate: ${first.predecessor_name} → ${first.successor_name}.`
    }
    if (step === 3) {
      if (!preview) return 'The generation preview has not completed.'
      const critical = (preview.validation || []).filter(item => item.severity === 'critical')
      if (critical.length) return `${critical.length} critical validation finding${critical.length === 1 ? '' : 's'} block generation: ${critical.map(item => item.message).join(' · ')}`
    }
    return ''
  }

  const canContinue = () => !blockerForStep()

  const prepareReview = async () => {
    setSaving(true)
    setError('')
    try {
      if (!configuration) throw new Error('This project has no schedule configuration.')
      const settings = {
        ...(configuration.settings || {}),
        date_authority: 'relational_cpm',
        confirmed_dependency_rule_ids: [...confirmedRules].sort((a, b) => a - b),
      }
      const previousConfirmations = (configuration.settings?.confirmed_dependency_rule_ids || [])
        .map(Number).sort((a, b) => a - b)
      const configurationChanged = configuration.workflow_template !== selectedWorkflow.id
        || configuration.dependency_template !== (selectedDependency?.id || null)
        || configuration.standard_task_count !== selectedWorkflow.stage_count
        || JSON.stringify(previousConfirmations) !== JSON.stringify(settings.confirmed_dependency_rule_ids)
        || configuration.settings?.date_authority !== 'relational_cpm'
      if (configurationChanged) {
        const proposal = await planningIntelligenceService.createScheduleDefaultProposal({
          project: project.id,
          title: `${selectedWorkflow.name} scheduling defaults`,
          rationale: 'Proposed through the controlled schedule generation wizard.',
          workflow_template: selectedWorkflow.id,
          dependency_template: selectedDependency?.id || null,
          confirmed_dependency_rule_ids: settings.confirmed_dependency_rule_ids,
        })
        setPendingProposal(proposal)
        setPreview(null)
        setStep(3)
        return
      }
      const generatedPreview = await planningIntelligenceService.previewGeneration(project.id, {
        intelligence_overrides: intelligenceOverrides,
      })
      setPreview(generatedPreview)
      setStep(3)
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
    if (step === 2) {
      prepareReview()
      return
    }
    setStep(value => Math.min(4, value + 1))
  }

  const generate = async () => {
    setSaving(true)
    setError('')
    try {
      const generated = await onGenerate({
        expected_configuration_version: configuration.configuration_version,
      })
      if (!generated) throw new Error('Generation did not return a schedule version.')
      setResult(generated)
      setStep(4)
    } catch (err) {
      setError(messageFor(err, 'Schedule generation failed.'))
    } finally {
      setSaving(false)
    }
  }

  const refreshAfterDefaultDecision = async () => {
    const [configurationRows, proposals] = await Promise.all([
      planningIntelligenceService.listScheduleConfigurations(project.id),
      planningIntelligenceService.listScheduleDefaultProposals(project.id),
    ])
    const updatedConfiguration = configurationRows[0] || null
    setConfiguration(updatedConfiguration)
    const decided = proposals.find(item => item.id === pendingProposal?.id)
    if (decided?.status === 'approved') {
      setPendingProposal(null)
      setShowInlineApproval(false)
      setApprovalNotice(null)
      setSaving(true)
      try {
        const generatedPreview = await planningIntelligenceService.previewGeneration(project.id, {
          intelligence_overrides: intelligenceOverrides,
        })
        setPreview(generatedPreview)
      } catch (err) {
        setError(messageFor(err, 'Defaults were approved, but the generation preview could not be prepared.'))
      } finally {
        setSaving(false)
      }
    } else if (decided?.status === 'rejected') {
      setApprovalNotice({ type: 'error', message: 'The proposed defaults were rejected. Return to Workflow or Process logic and revise the selection.' })
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

  const approvePendingProposal = async () => {
    if (!pendingProposal?.id || !pendingProposal.can_approve) return
    setSaving(true)
    setError('')
    setApprovalNotice(null)
    try {
      await planningIntelligenceService.decideScheduleDefaultProposal(
        pendingProposal.id, 'approved', 'Approved by project authority in the controlled generation wizard.',
      )
      await refreshAfterDefaultDecision()
    } catch (err) {
      setError(messageFor(err, 'The scheduling defaults could not be approved.'))
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
          {(loading || saving) && <ProcessingBar label={loading ? 'Loading workflow configuration and engineering logic…' : step === 2 ? 'Running Phase E checks and preparing the exact schedule preview…' : step === 3 ? 'Generating and calculating the relational CPM schedule…' : 'Processing…'} />}
        </div>

        <main className="flex-1 overflow-y-auto p-5 sm:p-7">
          {loading ? <div className="flex h-full items-center justify-center text-slate-500">Loading project configuration…</div> : (
            <div className="mx-auto max-w-5xl space-y-5">
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

              {step === 1 && (
                <>
                  <div><h3 className="text-2xl font-bold text-slate-950">Choose the deliverable workflow</h3><p className="mt-1 text-slate-600">The standard is five visible Primavera-style tasks. A different count requires an active template with exactly that number of defined stages.</p></div>
                  <button type="button" onClick={selectStandard} className={`w-full rounded-2xl border-2 p-5 text-left ${!customCount ? 'border-violet-500 bg-violet-50' : 'border-slate-200 bg-white'}`}>
                    <div className="flex items-center justify-between"><span className="font-bold text-slate-900">Standard five-stage workflow</span><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Recommended</span></div>
                    <p className="mt-2 text-sm text-slate-600">IFR → COMPANY REVIEW → IFA → COMPANY APPROVAL → FINAL ISSUE</p>
                  </button>
                  <button type="button" onClick={() => setCustomCount(true)} className={`w-full rounded-2xl border-2 p-5 text-left ${customCount ? 'border-violet-500 bg-violet-50' : 'border-slate-200 bg-white'}`}>
                    <span className="font-bold text-slate-900">Use a different number of tasks</span>
                    <p className="mt-1 text-sm text-slate-600">Select this only where the contract or deliverable class requires a different workflow.</p>
                  </button>
                  {customCount && <div className="rounded-2xl border border-violet-200 bg-white p-5"><label className="text-sm font-bold text-slate-700">How many workflow tasks are required?</label><input type="number" min="1" max="50" value={requestedCount} onChange={event => selectCustomCount(event.target.value)} className="mt-2 w-40 rounded-xl border-2 border-slate-200 px-3 py-2 focus:border-violet-500 focus:outline-none" />
                    <div className="mt-4 space-y-2">{matchingWorkflows.length ? matchingWorkflows.map(template => <label key={template.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50"><input type="radio" name="workflow" checked={Number(workflowId) === template.id} onChange={() => setWorkflowId(template.id)} className="mt-1 accent-violet-600"/><span><span className="block font-bold text-slate-800">{template.name}</span><span className="text-xs text-slate-500">{template.stage_count} stages · v{template.version}</span></span></label>) : <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">No active {requestedCount}-task template exists. Create and activate the workflow in Configuration before generating.</p>}</div>
                  </div>}
                  {selectedWorkflow && <div className="grid gap-2 sm:grid-cols-5">{selectedWorkflow.stages.map(stage => <div key={stage.id} className="rounded-xl border border-slate-200 bg-white p-3"><span className="text-xs font-bold text-violet-600">{stage.sequence}</span><p className="mt-1 text-sm font-bold text-slate-800">{stage.name}</p><p className="mt-1 text-xs text-slate-500">{stage.duration_days} days</p></div>)}</div>}
                  {!blockerForStep() && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Workflow validated: {selectedWorkflow.name} contains exactly {Number(selectedWorkflow.stage_count)} configured tasks.</div>}
                  {blockerForStep() && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{blockerForStep()}</div>}
                </>
              )}

              {step === 2 && (
                <>
                  <div><h3 className="text-2xl font-bold text-slate-950">Confirm Process release gates</h3><p className="mt-1 text-slate-600">These relationships came from the engineer’s Process flow. Confirmation makes the assumption controlled and traceable.</p></div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4"><label className="text-sm font-bold text-slate-700">Engineering dependency template</label><select value={dependencyId} onChange={event => { setDependencyId(event.target.value); setConfirmedRules(new Set()) }} className="mt-2 w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none"><option value="">No dependency template</option>{dependencies.map(template => <option key={template.id} value={template.id}>{template.name} · v{template.version}</option>)}</select></div>
                  {!selectedDependency ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">No dependency template is selected.</div> : <>
                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4"><div><p className="font-bold text-slate-900">{selectedDependency.name}</p><p className="text-sm text-slate-500">{selectedDependency.rule_count} rules · {requiredRules.length} require confirmation</p></div><button type="button" onClick={() => setConfirmedRules(new Set(requiredRules.map(item => item.id)))} className="rounded-xl bg-violet-100 px-3 py-2 text-sm font-bold text-violet-700 hover:bg-violet-200">Confirm all</button></div>
                    <div className="max-h-[46vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white">
                      {selectedDependency.rules.map(rule => <label key={rule.id} className="flex cursor-pointer gap-3 border-b border-slate-100 p-3 last:border-0 hover:bg-slate-50"><input type="checkbox" checked={!rule.requires_confirmation || confirmedRules.has(rule.id)} disabled={!rule.requires_confirmation} onChange={() => toggleRule(rule.id)} className="mt-1 accent-violet-600"/><span className="min-w-0"><span className="block text-sm font-bold text-slate-800">{rule.predecessor_name} · {rule.predecessor_stage_code} → {rule.successor_name} · {rule.successor_stage_code}</span><span className="text-xs text-slate-500">{rule.relationship_type}{Number(rule.lag_days) ? ` + ${rule.lag_days}d` : ''} · {rule.source_reference || 'Configured engineering logic'}</span></span></label>)}
                    </div>
                  </>}
                </>
              )}

              {step === 3 && preview && (
                <>
                  <div><h3 className="text-2xl font-bold text-slate-950">Review the exact generation plan</h3><p className="mt-1 text-slate-600">This preview is deterministic and has not created a schedule version. Final dates will come from relational CPM.</p></div>
                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6"><Metric label="WBS nodes" value={preview.wbs_node_count}/><Metric label="Deliverables" value={preview.deliverable_count}/><Metric label="Activities" value={preview.activity_count}/><Metric label="Workflow tasks" value={preview.configured_workflow_activity_count}/><Metric label="Relationships" value={preview.relationship_count}/><Metric label="Milestones" value={preview.milestone_count}/></div>
                  <div className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-4"><h4 className="font-bold text-slate-900">Configuration snapshot</h4><dl className="mt-3 space-y-2 text-sm"><Row label="Workflow" value={`${selectedWorkflow?.name} (${selectedWorkflow?.stage_count} tasks)`}/><Row label="Process network" value={selectedDependency?.name || 'None'}/><Row label="Confirmed gates" value={`${confirmedRules.size}`}/><Row label="Date authority" value="Relational CPM"/></dl></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><h4 className="font-bold text-slate-900">Pre-generation validation</h4><div className="mt-3 space-y-2">{(preview.validation || []).map((item, index) => <div key={`${item.rule}-${index}`} className={`rounded-lg px-3 py-2 text-xs font-semibold ${item.severity === 'critical' ? 'bg-rose-50 text-rose-700' : item.severity === 'warning' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>{item.message}</div>)}</div></div></div>
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">Generating creates a new immutable JSON generation and a new relational draft schedule version. Existing approved or baselined versions remain unchanged.</div>
                </>
              )}

              {step === 3 && !preview && !pendingProposal && (
                <div className="mx-auto max-w-2xl rounded-3xl border border-blue-200 bg-white p-7 text-center shadow-sm"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-2xl text-blue-700">↻</div><h3 className="mt-4 text-2xl font-bold text-slate-950">Configuration approved — preview pending</h3><p className="mt-2 text-sm text-slate-600">Approval is safely stored. Retry only the deterministic preview; the wizard will not repeat analysis or create another approval proposal.</p><button type="button" onClick={retryPreview} disabled={saving} className="mt-5 rounded-xl bg-violet-600 px-5 py-3 font-bold text-white disabled:opacity-40">{saving ? 'Preparing preview…' : 'Retry schedule preview'}</button></div>
              )}

              {step === 3 && pendingProposal && !showInlineApproval && (
                <div className="mx-auto max-w-3xl rounded-3xl border border-amber-200 bg-white p-7 shadow-sm">
                  <div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-2xl text-amber-700">⌛</div><div><p className="text-xs font-bold uppercase tracking-wider text-amber-700">Final approval required</p><h3 className="mt-1 text-2xl font-bold text-slate-950">Proposed defaults are not effective yet</h3><p className="mt-2 text-sm text-slate-600">Proposal #{pendingProposal.id} passed {pendingProposal.test_results.filter(item => item.status === 'passed').length} of {pendingProposal.test_results.length} Phase E checks. A project manager, project owner, or administrator must approve it in Planner Workspace → Governance → Default approvals.</p></div></div>
                  <div className="mt-5 space-y-2">{pendingProposal.test_results.map(test => <div key={test.code} className={`rounded-xl px-3 py-2 text-sm ${test.status === 'passed' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}><b>{test.status === 'passed' ? 'Passed' : 'Failed'} · {test.code.replaceAll('_', ' ')}</b><div className="mt-0.5 text-xs opacity-80">{test.message}</div></div>)}</div>
                  <div className="mt-6 flex flex-wrap gap-3">{pendingProposal.can_approve && <button type="button" onClick={approvePendingProposal} disabled={saving || !pendingProposal.tests_passed} className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-40">{saving ? 'Approving and preparing preview…' : 'Approve defaults & continue'}</button>}<button type="button" onClick={() => setShowInlineApproval(true)} className="rounded-xl bg-violet-600 px-5 py-3 font-bold text-white">{pendingProposal.can_approve ? 'Open full governance' : 'Open Governance →'}</button><button type="button" onClick={onClose} className="rounded-xl border px-5 py-3 font-bold text-slate-700">Return to package</button></div>
                </div>
              )}

              {step === 3 && pendingProposal && showInlineApproval && (
                <div className="space-y-4"><div className="flex flex-wrap items-center gap-3"><div className="mr-auto"><p className="text-xs font-bold uppercase tracking-wider text-violet-600">Project-level governance</p><h3 className="text-2xl font-bold text-slate-950">Final approval — Proposal #{pendingProposal.id}</h3><p className="mt-1 text-sm text-slate-600">Approve the tested defaults here. No schedule version is required for this decision.</p></div><button type="button" onClick={() => setShowInlineApproval(false)} className="rounded-xl border px-4 py-2 text-sm font-bold text-slate-700">Back to summary</button></div>{approvalNotice && <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${approvalNotice.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{approvalNotice.message}</div>}<SchedulingDefaultsApprovalPanel projectId={project.id} onNotice={(type, message) => setApprovalNotice({ type, message })} onChanged={refreshAfterDefaultDecision} /></div>
              )}

              {step === 4 && (
                <div className="py-12 text-center"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl text-emerald-700">✓</div><h3 className="mt-5 text-3xl font-bold text-slate-950">Schedule generated successfully</h3><p className="mt-2 text-slate-600">Generation v{result?.generation?.version} and relational CPM schedule version {result?.job?.result_data?.schedule_version_id} are ready.</p><div className="mt-7 flex justify-center gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-bold text-slate-700 hover:bg-slate-50">Return to package</button><button type="button" onClick={onOpenPlanner} className="rounded-xl bg-violet-600 px-5 py-3 font-bold text-white shadow hover:bg-violet-700">Open Planner Workspace →</button></div></div>
              )}
            </div>
          )}
        </main>

        {!loading && step < 4 && !pendingProposal && <footer className="flex items-center justify-between border-t border-slate-200 bg-white px-5 py-4 sm:px-7"><button type="button" onClick={() => step ? setStep(value => value - 1) : onClose()} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40">{step ? '← Back' : 'Cancel'}</button><div className="flex items-center gap-3"><span className="hidden text-xs font-semibold text-slate-400 sm:inline">Configuration v{configuration?.configuration_version || '—'}</span>{step === 3 ? <button type="button" onClick={generate} disabled={saving || !canContinue()} className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-700 px-5 py-2.5 text-sm font-bold text-white shadow disabled:opacity-40">{saving ? 'Generating…' : 'Generate new draft'}</button> : <button type="button" onClick={next} disabled={saving} className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-slate-800 disabled:opacity-40">{saving ? 'Preparing preview…' : 'Continue →'}</button>}</div></footer>}
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
  intelligence: PropTypes.shape({ disciplines: PropTypes.object }),
  intelligenceOverrides: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onGenerate: PropTypes.func.isRequired,
  onOpenPlanner: PropTypes.func.isRequired,
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
