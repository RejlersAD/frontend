/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, Baseline, CalendarDays, Check, ChevronLeft, ClipboardList, Database, Download,
  ChevronRight, PlusCircle, GitBranch, LayoutList, Loader2, MessageSquare, Network,
  RefreshCw, Save, Search, ShieldCheck, Trash2, TrendingUp, Users, X,
} from 'lucide-react'

import ProjectControlsPanel from '../components/planning/ProjectControlsPanel'
import DailyFieldUpdatePanel from '../components/planning/DailyFieldUpdatePanel'
import GovernancePanel from '../components/planning/GovernancePanel'
import IntegrationsExportsPanel from '../components/planning/IntegrationsExportsPanel'
import EnterpriseReadinessPanel from '../components/planning/EnterpriseReadinessPanel'
import PlannerActivitiesGantt from '../components/planning/PlannerActivitiesGantt'
import PlannerLogicAssurance from '../components/planning/PlannerLogicAssurance'
import SchedulingDefaultsApprovalPanel from '../components/planning/SchedulingDefaultsApprovalPanel'
import TrustworthySchedulingPanel from '../components/planning/TrustworthySchedulingPanel'
import planningIntelligenceService from '../services/planningIntelligence.service'
import usePlanningJob from '../hooks/usePlanningJob'

const TABS = [
  { id: 'activities', label: 'Activities & Gantt', icon: LayoutList },
  { id: 'field', label: 'Daily Field Update', icon: ClipboardList },
  { id: 'wbs', label: 'WBS', icon: Network },
  { id: 'logic', label: 'Logic', icon: GitBranch },
  { id: 'resources', label: 'Resources', icon: Users },
  { id: 'controls', label: 'Project Controls', icon: TrendingUp },
  { id: 'assurance', label: 'Schedule Assurance', icon: ShieldCheck },
  { id: 'governance', label: 'Governance', icon: MessageSquare },
  { id: 'integrations', label: 'Integrations & Exports', icon: Download },
  { id: 'enterprise', label: 'Enterprise', icon: Database },
  { id: 'evidence', label: 'Evidence', icon: ShieldCheck },
]
const EDITABLE_ACTIVITY_FIELDS = [
  'id', 'wbs_node', 'calendar', 'external_id', 'name', 'activity_type',
  'duration_days', 'discipline', 'responsible_role', 'constraint_type',
  'constraint_date', 'sort_order', 'metadata',
]
const PAGE_SIZE = 100

const unwrapError = (error, fallback) => (
  error?.response?.data?.error || error?.response?.data?.detail || error?.message || fallback
)
const dateValue = (value) => value ? new Date(`${value}T00:00:00Z`).getTime() : null
const dateDays = (start, end) => Math.round((end - start) / 86400000)

const StatusBadge = ({ status }) => {
  const styles = {
    draft: 'bg-slate-100 text-slate-700', calculated: 'bg-blue-100 text-blue-700',
    approved: 'bg-emerald-100 text-emerald-700', baselined: 'bg-violet-100 text-violet-700',
    superseded: 'bg-slate-100 text-slate-400',
  }
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${styles[status] || styles.draft}`}>{status}</span>
}

const PlannerWorkspacePage = () => {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [schedules, setSchedules] = useState([])
  const [generations, setGenerations] = useState([])
  const [defaultProposals, setDefaultProposals] = useState([])
  const [versions, setVersions] = useState([])
  const [scheduleId, setScheduleId] = useState('')
  const [versionId, setVersionId] = useState('')
  const [workspace, setWorkspace] = useState(null)
  const [draftActivities, setDraftActivities] = useState([])
  const [dirtyIds, setDirtyIds] = useState(new Set())
  const [tab, setTab] = useState('activities')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState(null)
  const [search, setSearch] = useState('')
  const [discipline, setDiscipline] = useState('all')
  const [criticalOnly, setCriticalOnly] = useState(false)
  const [activityView, setActivityView] = useState('deliverables')
  const [page, setPage] = useState(1)
  const [showNewActivity, setShowNewActivity] = useState(false)
  const [newActivity, setNewActivity] = useState({ external_id: '', name: '', duration_days: 1, activity_type: 'task' })
  const [logicDraft, setLogicDraft] = useState({ predecessor: '', successor: '', relationship_type: 'FS', lag_days: 0 })
  const [newResource, setNewResource] = useState({ code: '', name: '', role: '', capacity_units_per_day: 8 })
  const [facts, setFacts] = useState([])
  const [conflicts, setConflicts] = useState([])
  const [upgradingLegacy, setUpgradingLegacy] = useState(false)
  const [calculationProgress, setCalculationProgress] = useState(0)
  const [calculationPhase, setCalculationPhase] = useState('')
  const { activeJob: scheduleJob, runJob: runScheduleJob } = usePlanningJob({
    storageKey: `radai-schedule-job-${projectId}`,
  })

  useEffect(() => {
    if (!scheduleJob || !['calculate', 'assurance'].includes(scheduleJob.job_type)) return
    if (['queued', 'running'].includes(scheduleJob.status)) {
      setCalculationProgress(scheduleJob.progress || 1)
      setCalculationPhase(scheduleJob.message || 'Background scheduling job in progress')
    }
  }, [scheduleJob])

  useEffect(() => {
    if (!['save-calculate', 'rebuild-calculate'].includes(busy)) return undefined
    const timer = window.setInterval(() => {
      setCalculationProgress(value => Math.min(82, value + (value < 35 ? 4 : 1)))
    }, 800)
    return () => window.clearInterval(timer)
  }, [busy])

  const loadWorkspace = useCallback(async (id, quiet = false) => {
    if (!id) return
    if (!quiet) setLoading(true)
    try {
      const data = await planningIntelligenceService.getScheduleWorkspace(id)
      setWorkspace(data)
      setDraftActivities(data.activities || [])
      setDirtyIds(new Set())
      setNotice(null)
    } catch (error) {
      setNotice({ type: 'error', message: unwrapError(error, 'Unable to load the planner workspace.') })
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    const initialize = async () => {
      setLoading(true)
      try {
        const [projectData, scheduleRows, generationRows, proposalRows] = await Promise.all([
          planningIntelligenceService.getProject(projectId),
          planningIntelligenceService.listSchedules(projectId),
          planningIntelligenceService.listGenerations(projectId),
          planningIntelligenceService.listScheduleDefaultProposals(projectId),
        ])
        if (!active) return
        setProject(projectData)
        setSchedules(scheduleRows)
        setGenerations(generationRows)
        setDefaultProposals(proposalRows)
        if (scheduleRows.length) setScheduleId(String(scheduleRows[0].id))
        else setLoading(false)
      } catch (error) {
        if (active) {
          setNotice({ type: 'error', message: unwrapError(error, 'Unable to open this planning project.') })
          setLoading(false)
        }
      }
    }
    initialize()
    return () => { active = false }
  }, [projectId])

  useEffect(() => {
    if (!scheduleId) return
    let active = true
    const loadVersions = async () => {
      setLoading(true)
      try {
        const rows = await planningIntelligenceService.listScheduleVersions(scheduleId)
        if (!active) return
        setVersions(rows)
        const nextId = rows[0]?.id ? String(rows[0].id) : ''
        setVersionId(nextId)
        if (!nextId) setLoading(false)
      } catch (error) {
        if (active) {
          setNotice({ type: 'error', message: unwrapError(error, 'Unable to load schedule versions.') })
          setLoading(false)
        }
      }
    }
    loadVersions()
    return () => { active = false }
  }, [scheduleId])

  useEffect(() => {
    if (versionId) loadWorkspace(versionId)
  }, [versionId, loadWorkspace])

  useEffect(() => {
    if (tab !== 'evidence' || !workspace?.intelligence?.run_id) return
    Promise.all([
      planningIntelligenceService.listIntelligenceFacts(workspace.intelligence.run_id),
      planningIntelligenceService.listIntelligenceConflicts(workspace.intelligence.run_id, { status: 'open' }),
    ]).then(([factRows, conflictRows]) => {
      setFacts(factRows)
      setConflicts(conflictRows)
    }).catch(error => setNotice({ type: 'error', message: unwrapError(error, 'Unable to load evidence.') }))
  }, [tab, workspace?.intelligence?.run_id])

  const disciplines = useMemo(() => (
    [...new Set(draftActivities.map(item => item.discipline).filter(Boolean))].sort()
  ), [draftActivities])
  const filteredActivities = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return draftActivities.filter(item => (
      (!needle || item.external_id.toLowerCase().includes(needle) || item.name.toLowerCase().includes(needle))
      && (discipline === 'all' || item.discipline === discipline)
      && (!criticalOnly || item.is_critical)
    ))
  }, [draftActivities, search, discipline, criticalOnly])
  const pageCount = Math.max(1, Math.ceil(filteredActivities.length / PAGE_SIZE))
  const pageRows = filteredActivities.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  useEffect(() => setPage(1), [search, discipline, criticalOnly])

  const ganttRange = useMemo(() => {
    const starts = pageRows.map(row => dateValue(row.planned_start)).filter(value => value !== null)
    const finishes = pageRows.map(row => dateValue(row.planned_finish)).filter(value => value !== null)
    if (!starts.length || !finishes.length) return null
    const start = Math.min(...starts)
    const finish = Math.max(...finishes)
    return { start, finish, span: Math.max(1, dateDays(start, finish) + 1) }
  }, [pageRows])

  const stats = useMemo(() => {
    const activities = workspace?.activities || []
    const contractualFinish = workspace?.project?.planned_end_date || project?.planned_end_date
    const forecastFinish = workspace?.version?.calculated_finish
    const finishVariance = contractualFinish && forecastFinish
      ? dateDays(dateValue(contractualFinish), dateValue(forecastFinish))
      : null
    return {
      activities: activities.length,
      critical: activities.filter(item => item.is_critical).length,
      milestones: activities.filter(item => item.is_milestone).length,
      finish: workspace?.version?.calculated_finish || 'Not calculated',
      contractualFinish: contractualFinish || 'Not set',
      finishVariance,
    }
  }, [workspace, project])

  const updateDraft = (id, field, value) => {
    setDraftActivities(rows => rows.map(row => row.id === id ? { ...row, [field]: value } : row))
    setDirtyIds(current => new Set(current).add(id))
  }

  const runAction = async (key, action, message) => {
    setBusy(key)
    try {
      await action()
      await loadWorkspace(versionId, true)
      const rows = await planningIntelligenceService.listScheduleVersions(scheduleId)
      setVersions(rows)
      setNotice({ type: 'success', message })
    } catch (error) {
      setNotice({ type: 'error', message: unwrapError(error, 'The action could not be completed.') })
    } finally {
      setBusy('')
    }
  }

  const saveActivities = async () => {
    const changed = draftActivities.filter(row => dirtyIds.has(row.id)).map(row => (
      Object.fromEntries(EDITABLE_ACTIVITY_FIELDS.map(field => [field, row[field]]).filter(([, value]) => value !== undefined))
    ))
    if (!changed.length) return
    setBusy('save')
    try {
      await planningIntelligenceService.bulkUpdateActivities(versionId, workspace.version.updated_at, changed)
      await loadWorkspace(versionId, true)
      setNotice({ type: 'success', message: `${changed.length} activit${changed.length === 1 ? 'y' : 'ies'} saved. Recalculate to refresh dates and float.` })
    } catch (error) {
      setNotice({ type: 'error', message: unwrapError(error, 'Activity changes could not be saved.') })
    } finally {
      setBusy('')
    }
  }

  const saveAndCalculate = async () => {
    const changed = draftActivities.filter(row => dirtyIds.has(row.id)).map(row => (
      Object.fromEntries(EDITABLE_ACTIVITY_FIELDS.map(field => [field, row[field]]).filter(([, value]) => value !== undefined))
    ))
    setBusy('save-calculate')
    setCalculationProgress(5)
    setCalculationPhase(changed.length ? 'Saving activity changes' : 'Preparing CPM network')
    try {
      if (changed.length) {
        await planningIntelligenceService.bulkUpdateActivities(
          versionId, workspace.version.updated_at, changed,
        )
      }
      setCalculationProgress(30)
      setCalculationPhase('Calculating dates, float, and critical path')
      await runScheduleJob(() => planningIntelligenceService.calculateScheduleVersion(versionId))
      setCalculationProgress(86)
      setCalculationPhase('Loading calculated activity dates')
      await loadWorkspace(versionId, true)
      setCalculationProgress(95)
      setCalculationPhase('Refreshing schedule version')
      const rows = await planningIntelligenceService.listScheduleVersions(scheduleId)
      setVersions(rows)
      setCalculationProgress(100)
      setCalculationPhase('Calculation complete')
      setNotice({
        type: 'success',
        message: `${changed.length ? `${changed.length} activity changes saved and ` : ''}CPM dates, float, and critical path recalculated.`,
      })
    } catch (error) {
      setCalculationProgress(0)
      setCalculationPhase('')
      setNotice({ type: 'error', message: unwrapError(error, 'Changes could not be saved and calculated.') })
    } finally {
      setBusy('')
      window.setTimeout(() => {
        setCalculationProgress(0)
        setCalculationPhase('')
      }, 1400)
    }
  }

  const rebuildLogicAndCalculate = async () => {
    if (!window.confirm(
      'Replace this draft revision’s predecessor network with the current generated logic, then recalculate CPM? Activity names and durations will be preserved.',
    )) return
    setBusy('rebuild-calculate')
    setCalculationProgress(5)
    setCalculationPhase('Rebuilding predecessor network')
    try {
      const result = await planningIntelligenceService.rebuildScheduleLogic(versionId)
      setCalculationProgress(35)
      setCalculationPhase('Calculating dates, float, and critical path')
      await runScheduleJob(() => planningIntelligenceService.calculateScheduleVersion(versionId))
      setCalculationProgress(86)
      setCalculationPhase('Loading rebuilt schedule dates')
      await loadWorkspace(versionId, true)
      setCalculationProgress(95)
      setCalculationPhase('Refreshing schedule version')
      setVersions(await planningIntelligenceService.listScheduleVersions(scheduleId))
      setCalculationProgress(100)
      setCalculationPhase('Logic rebuild complete')
      setNotice({
        type: 'success',
        message: `${result.relationship_count} generated relationships applied and CPM recalculated. The contract warning will remain if the configured durations still exceed the contractual finish.`,
      })
    } catch (error) {
      setCalculationProgress(0)
      setCalculationPhase('')
      setNotice({ type: 'error', message: unwrapError(error, 'Generated logic could not be rebuilt.') })
    } finally {
      setBusy('')
      window.setTimeout(() => {
        setCalculationProgress(0)
        setCalculationPhase('')
      }, 1400)
    }
  }

  const createRevision = async () => {
    const summary = window.prompt('Revision summary', 'Planner workspace revision')
    if (summary === null) return
    setBusy('revision')
    try {
      const version = await planningIntelligenceService.createScheduleVersion(scheduleId, summary)
      const rows = await planningIntelligenceService.listScheduleVersions(scheduleId)
      setVersions(rows)
      setVersionId(String(version.id))
      setNotice({ type: 'success', message: `Version ${version.version} created.` })
    } catch (error) {
      setNotice({ type: 'error', message: unwrapError(error, 'Unable to create a revision.') })
    } finally {
      setBusy('')
    }
  }

  const createActivity = async event => {
    event.preventDefault()
    setBusy('new-activity')
    try {
      await planningIntelligenceService.createActivity({
        ...newActivity, version: Number(versionId), calendar: workspace.calendar?.id || null,
        wbs_node: workspace.wbs?.[0]?.id || null, sort_order: draftActivities.length,
      })
      setNewActivity({ external_id: '', name: '', duration_days: 1, activity_type: 'task' })
      setShowNewActivity(false)
      await loadWorkspace(versionId, true)
      setNotice({ type: 'success', message: 'Activity added.' })
    } catch (error) {
      setNotice({ type: 'error', message: unwrapError(error, 'Unable to add the activity.') })
    } finally {
      setBusy('')
    }
  }

  const deleteActivity = async activity => {
    if (!window.confirm(`Delete ${activity.external_id} - ${activity.name}?`)) return
    await runAction('delete', () => planningIntelligenceService.deleteActivity(activity.id), 'Activity removed.')
  }

  const createLogic = async event => {
    event.preventDefault()
    await runAction('logic', () => planningIntelligenceService.createRelationship({
      ...logicDraft, version: Number(versionId), predecessor: Number(logicDraft.predecessor),
      successor: Number(logicDraft.successor), lag_days: Number(logicDraft.lag_days || 0),
    }), 'Relationship added. Recalculate to refresh the network.')
    setLogicDraft({ predecessor: '', successor: '', relationship_type: 'FS', lag_days: 0 })
  }

  const createResource = async event => {
    event.preventDefault()
    await runAction('resource', () => planningIntelligenceService.createResource({
      ...newResource, project: Number(projectId), resource_type: 'labor', unit: 'hour', unit_cost: 0,
    }), 'Resource added.')
    setNewResource({ code: '', name: '', role: '', capacity_units_per_day: 8 })
  }

  const saveWbsName = async (node, name) => {
    if (name.trim() === node.name || !name.trim()) return
    await runAction(`wbs-${node.id}`, () => planningIntelligenceService.updateWbsNode(node.id, { name: name.trim() }), 'WBS updated.')
  }

  const resolveConflict = async (conflict, factId) => {
    await runAction(`conflict-${conflict.id}`, () => planningIntelligenceService.resolveIntelligenceConflict(
      conflict.id, { action: 'select_fact', selected_fact_id: factId },
    ), 'Evidence conflict resolved.')
    setConflicts(rows => rows.filter(row => row.id !== conflict.id))
  }

  const showControlsNotice = useCallback((type, message) => setNotice({ type, message }), [])

  const upgradeLatestGeneration = async () => {
    setUpgradingLegacy(true)
    setNotice(null)
    try {
      const generationRows = await planningIntelligenceService.listGenerations(projectId)
      setGenerations(generationRows)
      if (!generationRows.length) {
        setNotice({ type: 'error', message: 'No generated schedule exists. Run the Schedule Generation Wizard first.' })
        return
      }
      const result = await planningIntelligenceService.materializeGeneration(generationRows[0].id)
      const rows = await planningIntelligenceService.listSchedules(projectId)
      setSchedules(rows)
      if (result.schedule_id) setScheduleId(String(result.schedule_id))
      else if (rows[0]?.id) setScheduleId(String(rows[0].id))
      setNotice({
        type: 'success',
        message: `Generation v${generationRows[0].version} upgraded to the relational planner workspace${result.issues?.length ? ` with ${result.issues.length} migration warning(s)` : ''}.`,
      })
    } catch (error) {
      setNotice({ type: 'error', message: unwrapError(error, 'Unable to upgrade the generated schedule.') })
    } finally {
      setUpgradingLegacy(false)
    }
  }

  if (loading && !workspace) {
    return <div className="min-h-[70vh] flex items-center justify-center bg-slate-50 p-6"><div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" role="status" aria-live="polite"><div className="flex items-center gap-3"><Loader2 className="h-6 w-6 animate-spin text-violet-600" /><div><p className="font-bold text-slate-800">Loading Planner Workspace</p><p className="text-sm text-slate-500">Checking schedules, generated versions, and project-level approvals…</p></div></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-violet-100"><div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-violet-600 via-indigo-500 to-violet-600" /></div></div></div>
  }

  if (!schedules.length) {
    const hasLegacyGeneration = generations.length > 0
    const pendingDefaultProposal = defaultProposals.find(row => row.status === 'proposed')
    if (pendingDefaultProposal) {
      return <div className="min-h-screen bg-slate-100/70 p-4 sm:p-6">
        <div className="mx-auto max-w-6xl space-y-5">
          <div className="flex flex-wrap items-center gap-3"><button onClick={() => navigate('/planning-packages')} className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700"><ArrowLeft className="h-4 w-4" /> Back to planning package</button><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Project-level governance</span></div>
          <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-amber-700">Final approval required before generation</p><h1 className="mt-1 text-2xl font-bold text-slate-900">{project?.name} — Scheduling Default Approval</h1><p className="mt-2 text-sm text-slate-600">Proposal #{pendingDefaultProposal.id} is governed at project level because no schedule version exists yet. Approve it below, then return to the Generation Wizard to create the first relational schedule.</p></section>
          {notice && <div className={`rounded-xl border px-4 py-3 text-sm ${notice.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{notice.message}</div>}
          <SchedulingDefaultsApprovalPanel projectId={projectId} onNotice={showControlsNotice} onChanged={async () => setDefaultProposals(await planningIntelligenceService.listScheduleDefaultProposals(projectId))} />
          <div className="flex justify-end"><button type="button" onClick={() => navigate('/planning-packages', { state: { openGenerationWizardFor: Number(projectId) } })} className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow hover:bg-violet-700">Return to Generation Wizard →</button></div>
        </div>
      </div>
    }
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <button onClick={() => navigate('/planning-packages')} className="inline-flex items-center gap-2 text-sm text-violet-700"><ArrowLeft className="w-4 h-4" /> Back to planning packages</button>
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-slate-800">{hasLegacyGeneration ? 'Legacy generation ready to upgrade' : 'No schedule has been generated yet'}</h1>
          <p className="text-sm text-slate-500 mt-2">{hasLegacyGeneration ? `Generation v${generations[0].version} can be upgraded into the relational planner to unlock CPM, controls, governance, integrations, and enterprise tools.` : 'Complete the Schedule Generation Wizard first. It will validate the five-stage workflow and Process logic, then create the relational planner workspace automatically.'}</p>
          {notice && <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${notice.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>{notice.message}</div>}
          {hasLegacyGeneration ? <button type="button" onClick={upgradeLatestGeneration} disabled={upgradingLegacy} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50">{upgradingLegacy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}{upgradingLegacy ? 'Upgrading schedule…' : `Upgrade Generation v${generations[0].version}`}</button> : <button type="button" onClick={() => navigate('/planning-packages', { state: { openGenerationWizardFor: Number(projectId) } })} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-700"><PlusCircle className="h-4 w-4" />Open Schedule Generation Wizard</button>}
          {upgradingLegacy && <div className="mx-auto mt-5 max-w-md" role="status"><div className="mb-1 flex justify-between text-xs font-semibold text-violet-700"><span>Materializing activities and CPM logic…</span><span>In progress</span></div><div className="h-2 overflow-hidden rounded-full bg-violet-100"><div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-violet-600 via-indigo-500 to-violet-600" /></div></div>}
        </div>
      </div>
    )
  }

  const immutable = !workspace?.can_edit
  const approvalBlocked = (workspace?.dependency_assumptions || []).some(item => item.requires_confirmation)
    || (workspace?.generation_validation || []).some(item => item.severity === 'critical')
    || workspace?.schedule_assurance?.status !== 'approved'
  return (
    <div className="min-h-screen bg-slate-100/70">
      <header className="bg-slate-950 text-white border-b border-slate-800 sticky top-0 z-30">
        <div className="px-4 lg:px-6 py-3 flex flex-wrap items-center gap-3">
          <button onClick={() => navigate('/planning-packages')} className="p-2 rounded-lg hover:bg-white/10" title="Back"><ArrowLeft className="w-5 h-5" /></button>
          <div className="min-w-0 mr-auto">
            <div className="text-xs uppercase tracking-widest text-violet-300">Planner Workspace</div>
            <h1 className="font-semibold truncate">{workspace?.project?.name || project?.name}</h1>
          </div>
          <select value={scheduleId} onChange={event => setScheduleId(event.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm">
            {schedules.map(schedule => <option key={schedule.id} value={schedule.id}>{schedule.code} - {schedule.name}</option>)}
          </select>
          <select value={versionId} onChange={event => setVersionId(event.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm">
            {versions.map(version => <option key={version.id} value={version.id}>Version {version.version} - {version.status}</option>)}
          </select>
          <StatusBadge status={workspace?.version?.status} />
          <button onClick={createRevision} disabled={Boolean(busy)} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-semibold">New Revision</button>
          <button onClick={() => loadWorkspace(versionId)} className="p-2 rounded-lg hover:bg-white/10" title="Reload"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </header>

      <main className="p-3 lg:p-5 space-y-4">
        {notice && (
          <div className={`rounded-xl border px-4 py-3 flex items-start gap-2 text-sm ${notice.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
            {notice.type === 'error' ? <AlertTriangle className="w-4 h-4 mt-0.5" /> : <Check className="w-4 h-4 mt-0.5" />}
            <span className="flex-1">{notice.message}</span><button onClick={() => setNotice(null)}><X className="w-4 h-4" /></button>
          </div>
        )}

        <section className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-9 gap-2.5">
          {[
            ['Activities', stats.activities], ['Critical', stats.critical], ['Milestones', stats.milestones],
            ['Forecast Finish', stats.finish], ['Contract Finish', stats.contractualFinish],
            ['WBS Nodes', workspace?.wbs?.length || 0],
            ['Logic Ties', workspace?.relationships?.length || 0], ['Resources', workspace?.resources?.length || 0],
            ['Open Evidence', workspace?.intelligence?.conflict_count || 0],
          ].map(([label, value]) => (
            <div key={label} className="bg-white border border-slate-200 rounded-xl px-3 py-3 shadow-sm min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">{label}</div>
              <div className={`mt-1 font-bold truncate ${label === 'Critical' && value ? 'text-rose-600' : 'text-slate-800'}`}>{value}</div>
            </div>
          ))}
        </section>

        {stats.finishVariance > 0 && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <span className="font-bold">Contract finish overrun:</span> the current CPM network forecasts {stats.finish} against the {stats.contractualFinish} contractual finish ({stats.finishVariance} calendar days late). Recalculate CPM validates the stored network; it does not automatically shorten activities or force the finish date. Negative float now uses the contractual finish, so revise logic, durations, or scope before approval.
          </div>
        )}

        {workspace?.scheduling_configuration && (
          <section className="grid gap-3 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 p-4 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-center">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-600">Controlled scheduling configuration</p>
              <p className="mt-1 font-bold text-slate-900">{workspace.scheduling_configuration.workflow_template} · {workspace.scheduling_configuration.standard_task_count} tasks per standard deliverable</p>
              <p className="mt-1 text-xs text-slate-600">{(workspace.scheduling_configuration.workflow_stages || []).map(stage => stage.name).join(' → ')}</p>
            </div>
            <div className="rounded-xl bg-white/80 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Process network</p><p className="mt-1 text-sm font-bold text-slate-800">{workspace.scheduling_configuration.dependency_template || 'Not selected'}</p><p className="text-xs text-slate-500">{workspace.scheduling_configuration.confirmed_dependency_rule_count} / {workspace.scheduling_configuration.dependency_rule_count} gates confirmed</p></div>
            <div className="rounded-xl bg-white/80 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Date authority</p><p className="mt-1 text-sm font-bold uppercase text-blue-700">Relational CPM</p><p className="text-xs text-slate-500">Configuration v{workspace.scheduling_configuration.configuration_version}</p></div>
            <button type="button" onClick={() => navigate('/planning-packages', { state: { openGenerationWizardFor: Number(projectId) } })} className="rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-50">Generation Wizard</button>
          </section>
        )}

        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 flex flex-wrap items-center gap-1 px-3 pt-2">
            {TABS.map(item => {
              const Icon = item.icon
              return <button key={item.id} onClick={() => setTab(item.id)} className={`inline-flex items-center gap-2 px-3 py-2.5 text-sm font-semibold border-b-2 ${tab === item.id ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}><Icon className="w-4 h-4" />{item.label}</button>
            })}
            <div className="ml-auto flex items-center gap-2 pb-2">
              {dirtyIds.size > 0 && <span className="text-xs text-amber-600">{dirtyIds.size} unsaved</span>}
              <button onClick={saveActivities} disabled={!dirtyIds.size || busy === 'save' || immutable} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold disabled:opacity-40"><Save className="w-4 h-4" /> Save</button>
              <button onClick={saveAndCalculate} disabled={Boolean(busy) || immutable} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-40">{busy === 'save-calculate' ? 'Calculating…' : dirtyIds.size ? 'Save & Calculate' : 'Recalculate CPM'}</button>
              <button type="button" onClick={rebuildLogicAndCalculate} disabled={Boolean(busy) || immutable || dirtyIds.size > 0} title={dirtyIds.size ? 'Save activity changes first.' : 'Replace all predecessors with the latest generated network, then calculate CPM. Use only when you want to discard manual logic edits.'} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 disabled:opacity-40"><GitBranch className="h-4 w-4" />{busy === 'rebuild-calculate' ? 'Resetting…' : 'Rest & Calculate'}</button>
              <button title={approvalBlocked ? 'Complete and approve Phase 3 assurance before schedule approval.' : 'Approve this calculated version'} onClick={() => runAction('approve', () => planningIntelligenceService.approveScheduleVersion(versionId), 'Schedule version approved.')} disabled={Boolean(busy) || workspace?.version?.status !== 'calculated' || approvalBlocked} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-40">Approve</button>
              <button onClick={() => {
                const name = window.prompt('Baseline name', `Baseline ${workspace?.version?.version}`)
                if (name) runAction('baseline', () => planningIntelligenceService.baselineScheduleVersion(versionId, name), 'Baseline created and locked.')
              }} disabled={Boolean(busy) || workspace?.version?.status !== 'approved' || workspace?.schedule_assurance?.status !== 'approved'} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold disabled:opacity-40"><Baseline className="w-4 h-4" /> Baseline</button>
            </div>
          </div>

          {calculationProgress > 0 && (
            <div className="border-b border-blue-200 bg-blue-50 px-4 py-3" role="status" aria-live="polite">
              <div className="mb-1.5 flex items-center justify-between gap-3 text-xs font-semibold text-blue-800">
                <span className="inline-flex items-center gap-2"><Loader2 className={`h-4 w-4 ${calculationProgress < 100 ? 'animate-spin' : ''}`} />{calculationPhase}</span>
                <span>{calculationProgress}%</span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-blue-100"
                role="progressbar"
                aria-label="CPM calculation progress"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={calculationProgress}
              >
                <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-violet-600 transition-all duration-500" style={{ width: `${calculationProgress}%` }} />
              </div>
            </div>
          )}

          {tab === 'activities' && (
            <div>
              <div className="p-3 border-b border-slate-200 flex flex-wrap gap-2 items-center">
                <div className="relative min-w-[240px] flex-1 max-w-md"><Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search ID or activity name" className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
                <select value={discipline} onChange={event => setDiscipline(event.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm"><option value="all">All disciplines</option>{disciplines.map(value => <option key={value}>{value}</option>)}</select>
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"><button type="button" onClick={() => setActivityView('deliverables')} className={`rounded-md px-3 py-1.5 text-xs font-bold ${activityView === 'deliverables' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500'}`}>Deliverables</button><button type="button" onClick={() => setActivityView('activities')} className={`rounded-md px-3 py-1.5 text-xs font-bold ${activityView === 'activities' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500'}`}>Flat activities</button></div>
                <label className="inline-flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={criticalOnly} onChange={event => setCriticalOnly(event.target.checked)} className="accent-rose-600" /> Critical only</label>
                <button onClick={() => setShowNewActivity(value => !value)} disabled={immutable} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-violet-200 text-violet-700 text-sm font-semibold disabled:opacity-40"><PlusCircle className="w-4 h-4" /> Add Activity</button>
              </div>
              {showNewActivity && (
                <form onSubmit={createActivity} className="p-3 bg-violet-50/60 border-b border-violet-100 flex flex-wrap gap-2">
                  <input required value={newActivity.external_id} onChange={event => setNewActivity(value => ({ ...value, external_id: event.target.value }))} placeholder="Activity ID" className="border rounded-lg px-3 py-2 text-sm w-36" />
                  <input required value={newActivity.name} onChange={event => setNewActivity(value => ({ ...value, name: event.target.value }))} placeholder="Activity name" className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[240px]" />
                  <input type="number" min="0" step="0.25" value={newActivity.duration_days} onChange={event => setNewActivity(value => ({ ...value, duration_days: event.target.value }))} className="border rounded-lg px-3 py-2 text-sm w-28" />
                  <button className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold">Create</button>
                </form>
              )}
              {activityView === 'deliverables' ? (
                <PlannerActivitiesGantt
                  activities={draftActivities}
                  summaries={workspace?.deliverable_summaries || []}
                  relationships={workspace?.relationships || []}
                  search={search}
                  discipline={discipline}
                  criticalOnly={criticalOnly}
                  immutable={immutable}
                  dirtyIds={dirtyIds}
                  onUpdate={updateDraft}
                  onDelete={deleteActivity}
                  projectName={workspace?.project?.name}
                  scheduleName={workspace?.schedule?.name}
                  versionLabel={`Version ${workspace?.version?.version || '—'} · ${workspace?.version?.status || 'draft'}`}
                  dataDate={workspace?.schedule?.data_date || workspace?.schedule?.planned_start}
                  calculatedFinish={workspace?.version?.calculated_finish}
                />
              ) : <>
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(760px,1.3fr)_minmax(520px,1fr)] overflow-auto max-h-[64vh]">
                <table className="min-w-[920px] text-xs border-r border-slate-200">
                  <thead className="sticky top-0 z-10 bg-slate-100 text-slate-500"><tr>{['ID', 'Activity Name', 'Type', 'Duration', 'Start', 'Finish', 'Float', 'Role', ''].map(label => <th key={label} className="text-left px-2 py-2 font-semibold">{label}</th>)}</tr></thead>
                  <tbody>{pageRows.map(row => (
                    <tr key={row.id} className={`border-t border-slate-100 h-10 ${row.is_critical ? 'bg-rose-50/60' : dirtyIds.has(row.id) ? 'bg-amber-50' : 'hover:bg-slate-50'}`}>
                      <td className="px-2 font-mono font-semibold text-slate-700">{row.external_id}</td>
                      <td className="px-2"><input disabled={immutable} value={row.name} onChange={event => updateDraft(row.id, 'name', event.target.value)} className="w-full min-w-[230px] bg-transparent border-0 focus:ring-1 focus:ring-violet-400 rounded px-1 py-1 disabled:text-slate-700" /></td>
                      <td className="px-2"><select disabled={immutable} value={row.activity_type} onChange={event => updateDraft(row.id, 'activity_type', event.target.value)} className="bg-transparent"><option value="task">Task</option><option value="start_milestone">Start MS</option><option value="finish_milestone">Finish MS</option><option value="level_of_effort">LOE</option></select></td>
                      <td className="px-2"><input disabled={immutable} type="number" min="0" step="0.25" value={row.duration_days} onChange={event => updateDraft(row.id, 'duration_days', event.target.value)} className="w-16 bg-transparent rounded px-1" /></td>
                      <td className="px-2 whitespace-nowrap">{row.planned_start || '-'}</td><td className="px-2 whitespace-nowrap">{row.planned_finish || '-'}</td>
                      <td className={`px-2 font-semibold ${Number(row.total_float_days) <= 0 ? 'text-rose-600' : 'text-slate-500'}`}>{row.total_float_days ?? '-'}</td>
                      <td className="px-2"><input disabled={immutable} value={row.responsible_role || ''} onChange={event => updateDraft(row.id, 'responsible_role', event.target.value)} className="w-32 bg-transparent rounded px-1" /></td>
                      <td className="px-2"><button disabled={immutable} onClick={() => deleteActivity(row)} className="text-slate-300 hover:text-rose-600 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button></td>
                    </tr>
                  ))}</tbody>
                </table>
                <div className="min-w-[520px] bg-slate-50">
                  <div className="sticky top-0 z-10 h-[33px] bg-slate-100 border-b border-slate-200 px-3 flex items-center text-xs text-slate-500">{ganttRange ? `${new Date(ganttRange.start).toISOString().slice(0, 10)} to ${new Date(ganttRange.finish).toISOString().slice(0, 10)}` : 'Calculate the schedule to display the Gantt chart'}</div>
                  {pageRows.map(row => {
                    const start = dateValue(row.planned_start); const finish = dateValue(row.planned_finish)
                    const left = ganttRange && start !== null ? (dateDays(ganttRange.start, start) / ganttRange.span) * 100 : 0
                    const width = ganttRange && finish !== null && start !== null ? Math.max(0.8, ((dateDays(start, finish) + 1) / ganttRange.span) * 100) : 0
                    return <div key={row.id} className="h-10 border-b border-slate-200/70 relative px-2 bg-[linear-gradient(to_right,rgba(148,163,184,.12)_1px,transparent_1px)] bg-[size:10%_100%]">{width > 0 && <div title={`${row.external_id}: ${row.planned_start} - ${row.planned_finish}`} className={`absolute top-3 h-4 rounded-sm ${row.is_milestone ? 'rotate-45 w-4 bg-amber-500' : row.is_critical ? 'bg-rose-500' : 'bg-blue-500'}`} style={row.is_milestone ? { left: `calc(${left}% - 4px)` } : { left: `${left}%`, width: `${width}%` }} />}</div>
                  })}
                </div>
              </div>
              <div className="p-3 border-t border-slate-200 flex items-center justify-between text-sm text-slate-500"><span>{filteredActivities.length} activities</span><div className="flex items-center gap-2"><button disabled={page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft className="w-4 h-4" /></button><span>Page {page} of {pageCount}</span><button disabled={page >= pageCount} onClick={() => setPage(value => value + 1)}><ChevronRight className="w-4 h-4" /></button></div></div>
              </>}
            </div>
          )}

          {tab === 'field' && (
            <DailyFieldUpdatePanel
              versionId={versionId}
              activities={draftActivities}
              canReport={Boolean(workspace?.can_control)}
              canApprove={Boolean(workspace?.can_approve_field_updates)}
              selectedActivityId={null}
              onNotice={showControlsNotice}
              onControlsChanged={() => loadWorkspace(versionId, true)}
            />
          )}

          {tab === 'wbs' && <div className="p-4 space-y-1 max-w-5xl">{workspace?.wbs?.map(node => <div key={node.id} className="flex items-center gap-3 rounded-lg border border-slate-100 hover:bg-slate-50 px-3 py-2" style={{ marginLeft: `${Math.min(node.level, 5) * 22}px` }}><span className="font-mono text-xs text-violet-700 w-24 shrink-0">{node.code}</span><input disabled={immutable} defaultValue={node.name} onBlur={event => saveWbsName(node, event.target.value)} className="flex-1 bg-transparent text-sm font-medium text-slate-700" /><span className="text-xs text-slate-400">{node.discipline}</span></div>)}</div>}

          {tab === 'logic' && <PlannerLogicAssurance configuration={workspace?.scheduling_configuration} assumptions={workspace?.dependency_assumptions || []} validation={workspace?.generation_validation || []} />}

          {tab === 'logic' && <div className="p-4 space-y-4"><form onSubmit={createLogic} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_100px_100px_auto] gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3"><select required value={logicDraft.predecessor} onChange={event => setLogicDraft(value => ({ ...value, predecessor: event.target.value }))} className="border rounded-lg px-2 py-2 text-sm"><option value="">Predecessor</option>{workspace?.activities?.map(row => <option key={row.id} value={row.id}>{row.external_id} - {row.name}</option>)}</select><select required value={logicDraft.successor} onChange={event => setLogicDraft(value => ({ ...value, successor: event.target.value }))} className="border rounded-lg px-2 py-2 text-sm"><option value="">Successor</option>{workspace?.activities?.map(row => <option key={row.id} value={row.id}>{row.external_id} - {row.name}</option>)}</select><select value={logicDraft.relationship_type} onChange={event => setLogicDraft(value => ({ ...value, relationship_type: event.target.value }))} className="border rounded-lg px-2 py-2 text-sm">{['FS', 'SS', 'FF', 'SF'].map(value => <option key={value}>{value}</option>)}</select><input type="number" value={logicDraft.lag_days} onChange={event => setLogicDraft(value => ({ ...value, lag_days: event.target.value }))} className="border rounded-lg px-2 py-2 text-sm" /><button disabled={immutable} className="bg-violet-600 text-white rounded-lg px-3 text-sm font-semibold disabled:opacity-40">Add Tie</button></form><div className="divide-y divide-slate-100 border rounded-xl">{workspace?.relationships?.map(link => { const pred = workspace.activities.find(row => row.id === link.predecessor); const succ = workspace.activities.find(row => row.id === link.successor); return <div key={link.id} className="flex items-center gap-3 px-4 py-3 text-sm"><span className="font-mono text-slate-700">{pred?.external_id}</span><span className="rounded bg-blue-50 text-blue-700 px-2 py-0.5 font-semibold">{link.relationship_type}{Number(link.lag_days) ? ` ${Number(link.lag_days) > 0 ? '+' : ''}${link.lag_days}d` : ''}</span><span className="font-mono text-slate-700">{succ?.external_id}</span><span className="text-slate-400 truncate">{pred?.name} to {succ?.name}</span><button disabled={immutable} onClick={() => runAction('delete-logic', () => planningIntelligenceService.deleteRelationship(link.id), 'Relationship removed.')} className="ml-auto text-slate-300 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button></div> })}</div></div>}

          {tab === 'resources' && <div className="p-4 space-y-4"><form onSubmit={createResource} className="grid grid-cols-1 md:grid-cols-[140px_1fr_1fr_140px_auto] gap-2 bg-slate-50 border rounded-xl p-3"><input required value={newResource.code} onChange={event => setNewResource(value => ({ ...value, code: event.target.value }))} placeholder="Resource code" className="border rounded-lg px-3 py-2 text-sm" /><input required value={newResource.name} onChange={event => setNewResource(value => ({ ...value, name: event.target.value }))} placeholder="Resource name" className="border rounded-lg px-3 py-2 text-sm" /><input value={newResource.role} onChange={event => setNewResource(value => ({ ...value, role: event.target.value }))} placeholder="Role" className="border rounded-lg px-3 py-2 text-sm" /><input type="number" min="0.01" step="0.25" required value={newResource.capacity_units_per_day} onChange={event => setNewResource(value => ({ ...value, capacity_units_per_day: event.target.value }))} placeholder="Capacity/day" title="Maximum available units per working day" className="border rounded-lg px-3 py-2 text-sm" /><button disabled={immutable} className="bg-violet-600 text-white px-4 rounded-lg text-sm font-semibold disabled:opacity-40">Add Resource</button></form><div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">{workspace?.resources?.map(resource => { const assignments = workspace.assignments.filter(item => item.resource === resource.id); const hours = assignments.reduce((sum, item) => sum + Number(item.budgeted_hours || 0), 0); return <div key={resource.id} className="border rounded-xl p-4"><div className="flex items-center gap-2"><div className="w-9 h-9 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center font-bold">{resource.code.slice(0, 2)}</div><div><div className="font-semibold text-slate-800">{resource.name}</div><div className="text-xs text-slate-400">{resource.role || resource.resource_type}</div></div></div><div className="grid grid-cols-3 gap-2 mt-3 text-sm"><div className="bg-slate-50 rounded-lg p-2"><div className="text-xs text-slate-400">Assignments</div><b>{assignments.length}</b></div><div className="bg-slate-50 rounded-lg p-2"><div className="text-xs text-slate-400">Budget hours</div><b>{hours.toFixed(1)}</b></div><div className="bg-slate-50 rounded-lg p-2"><div className="text-xs text-slate-400">Capacity/day</div><b>{Number(resource.capacity_units_per_day || 0).toFixed(1)}</b></div></div></div> })}</div></div>}

          {tab === 'controls' && <ProjectControlsPanel versionId={versionId} canEdit={workspace?.can_control} canBudget={workspace?.can_edit} resources={workspace?.resources} assignments={workspace?.assignments} onWorkspaceRefresh={() => loadWorkspace(versionId, true)} onNotice={showControlsNotice} />}

          {tab === 'assurance' && <TrustworthySchedulingPanel assurance={workspace?.schedule_assurance} versionStatus={workspace?.version?.status} busy={['assurance', 'approve-assurance'].includes(busy) || ['queued', 'running'].includes(scheduleJob?.status)} canControl={workspace?.can_control} onRun={() => runAction('assurance', () => runScheduleJob(() => planningIntelligenceService.runScheduleAssurance(versionId)), 'Phase 3 schedule assurance completed.')} onApprove={() => runAction('approve-assurance', () => planningIntelligenceService.approveScheduleAssurance(versionId), 'Phase 3 schedule assurance approved.')} />}

          {tab === 'governance' && <GovernancePanel projectId={projectId} versionId={versionId} versionStatus={workspace?.version?.status} activities={workspace?.activities} onWorkspaceRefresh={() => loadWorkspace(versionId, true)} onNotice={showControlsNotice} />}

          {tab === 'integrations' && <IntegrationsExportsPanel projectId={projectId} projectName={workspace?.project?.name || project?.name} scheduleCode={workspace?.schedule?.code} versionId={versionId} versionNumber={workspace?.version?.version} canManage={workspace?.can_control} onNotice={showControlsNotice} />}

          {tab === 'enterprise' && <EnterpriseReadinessPanel projectId={projectId} projectName={workspace?.project?.name || project?.name} canManage={workspace?.can_control} onNotice={showControlsNotice} />}

          {tab === 'evidence' && <div className="p-4 grid lg:grid-cols-[1fr_1.4fr] gap-4"><div><h3 className="font-semibold text-slate-800 mb-2">Open conflicts</h3>{!conflicts.length && <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-700">No open evidence conflicts.</div>}{conflicts.map(conflict => <div key={conflict.id} className="border border-amber-200 bg-amber-50 rounded-xl p-4 mb-3"><div className="font-semibold text-amber-900">{conflict.description}</div><div className="mt-3 space-y-2">{(conflict.facts || []).map(fact => <button key={fact.id} onClick={() => resolveConflict(conflict, fact.id)} className="w-full text-left rounded-lg bg-white border border-amber-200 hover:border-violet-400 p-3"><div className="flex justify-between gap-2"><b className="text-sm text-slate-800">{typeof fact.value === 'object' ? JSON.stringify(fact.value) : String(fact.value)}</b><span className="text-xs text-slate-400">{Math.round(fact.confidence * 100)}%</span></div><div className="text-xs text-slate-500 mt-1">{fact.source_filename || fact.extraction_method} · line {fact.source_locator?.line || '-'}</div><div className="text-xs text-slate-400 mt-1 line-clamp-2">{fact.source_excerpt}</div></button>)}</div></div>)}</div><div><h3 className="font-semibold text-slate-800 mb-2">Extracted facts</h3><div className="border rounded-xl divide-y max-h-[60vh] overflow-auto">{facts.map(fact => <div key={fact.id} className="p-3 text-sm"><div className="flex items-center gap-2"><span className="rounded bg-slate-100 text-slate-600 px-2 py-0.5 text-xs">{fact.fact_type.replaceAll('_', ' ')}</span><b className="text-slate-800 truncate">{typeof fact.value === 'object' ? JSON.stringify(fact.value) : String(fact.value)}</b><span className="ml-auto text-xs text-slate-400">{Math.round(fact.confidence * 100)}%</span></div><div className="text-xs text-slate-400 mt-1">{fact.source_filename || fact.extraction_method} · {fact.status}</div></div>)}</div></div></div>}
        </section>
      </main>
    </div>
  )
}

export default PlannerWorkspacePage
