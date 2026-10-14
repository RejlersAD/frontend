import { radaiConfirm, radaiPrompt } from '../services/radaiDialog'
/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, Baseline, CalendarDays, Check, ChevronLeft, ClipboardList, Database, Download,
  ChevronRight, PlusCircle, GitBranch, LayoutList, Loader2, MessageSquare, Network,
  RefreshCw, Save, Search, Settings2, ShieldCheck, Trash2, TrendingUp, Users, X,
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
import PlanningResourcePlan from '../components/planning/PlanningResourcePlan'
import PlanningRiskRegister from '../components/planning/PlanningRiskRegister'
import PlanningOperationalControls from '../components/planning/PlanningOperationalControls'
import PlanningDelayAnalysis from '../components/planning/PlanningDelayAnalysis'
import GenerationEvidenceWorkspace from '../components/planning/GenerationEvidenceWorkspace'
import planningIntelligenceService from '../services/planningIntelligence.service'
import usePlanningJob from '../hooks/usePlanningJob'
import './PlannerWorkspacePage.css'

const TABS = [
  { id: 'activities', label: 'Activities & Gantt', icon: LayoutList },
  { id: 'field', label: 'Daily Field Update', icon: ClipboardList },
  { id: 'wbs', label: 'WBS', icon: Network },
  { id: 'logic', label: 'Logic', icon: GitBranch },
  { id: 'resources', label: 'Resources', icon: Users },
  { id: 'risks', label: 'Risk register', icon: AlertTriangle },
  { id: 'controls', label: 'Project Controls', icon: TrendingUp },
  { id: 'reports', label: 'Progress reports', icon: ClipboardList },
  { id: 'delay', label: 'Delay & recovery', icon: CalendarDays },
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

const ScheduleSettingsDialog = ({ busy, onClose, restoreFocus, children }) => {
  const dialogRef = useRef(null)
  useEffect(() => {
    const dialog = dialogRef.current, opener = document.activeElement
    dialog.showModal()
    return () => {
      dialog.close()
      if (!restoreFocus() && opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [restoreFocus])
  return <dialog ref={dialogRef} className="planner-workspace pw-settings-dialog" aria-label="Schedule settings" onCancel={event => { if (busy) event.preventDefault(); else onClose() }}>
    <header><h2>Schedule settings</h2><button type="button" className="pw-icon-button" aria-label="Close schedule settings" disabled={busy} onClick={onClose}><X size={18} /></button></header>
    <div className="pw-settings-body">{children}</div>
  </dialog>
}

const PlannerWorkspacePage = ({ embedded = false, planningProjectId = null, initialScheduleId = null, initialVersionId = null, initialGenerationId = null, initialAnalysisRunId = null, analysisState = null, initialTab = 'activities', onBack, onOpenGenerationWizard, onOpenDocumentStep, performancePanel, onSelectionChange, onWorkspaceChanged, onTabChange, onDirtyChange, compactHeader = false, headerContainer = null, workspaceActive = true }) => {
  const { projectId: routeProjectId } = useParams()
  const location = useLocation()
  const requestedGenerationId = initialGenerationId || (!embedded ? new URLSearchParams(location.search).get('generationId') : null)
  const requestedAnalysisRunId = initialAnalysisRunId || (!embedded ? new URLSearchParams(location.search).get('analysisRunId') : null)
  const projectId = planningProjectId || routeProjectId
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [schedules, setSchedules] = useState([])
  const [evidenceGeneration, setEvidenceGeneration] = useState(null)
  const [materializationIssues, setMaterializationIssues] = useState([])
  const [refreshingEvidence, setRefreshingEvidence] = useState(false)
  const generationRequestRef = useRef(0)
  const upgradeRequestRef = useRef(false)
  const materializedVersionRef = useRef(null)
  const [defaultProposals, setDefaultProposals] = useState([])
  const [versions, setVersions] = useState([])
  const [scheduleId, setScheduleId] = useState('')
  const [versionId, setVersionId] = useState('')
  const [workspace, setWorkspace] = useState(null)
  const [draftActivities, setDraftActivities] = useState([])
  const [dirtyIds, setDirtyIds] = useState(new Set())
  const hasPerformance = Boolean(performancePanel)
  const tabs = useMemo(() => hasPerformance ? [TABS[0], { id: 'performance', label: 'Performance', icon: TrendingUp }, ...TABS.slice(1)] : TABS, [hasPerformance])
  const [tab, setTab] = useState(() => tabs.some(item => item.id === initialTab) ? initialTab : 'activities')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsTriggerRef = useRef(null)
  const settingsSelectionFocusPending = useRef(false)
  const restoreSettingsFocus = useCallback(() => {
    const target = settingsTriggerRef.current
    if (!target?.isConnected) return false
    target.focus({ preventScroll: true })
    return true
  }, [])
  useEffect(() => {
    if (!workspaceActive || !compactHeader) {
      setSettingsOpen(false)
      settingsSelectionFocusPending.current = false
    }
  }, [workspaceActive, compactHeader])
  useEffect(() => {
    if (!settingsSelectionFocusPending.current || settingsOpen || loading || !workspaceActive) return
    if (workspace && (String(workspace.version?.id) !== versionId || String(workspace.schedule?.id) !== scheduleId)) return
    if (restoreSettingsFocus()) settingsSelectionFocusPending.current = false
  }, [settingsOpen, loading, workspaceActive, workspace, scheduleId, versionId, restoreSettingsFocus])
  const [search, setSearch] = useState('')
  const [discipline, setDiscipline] = useState('all')
  const [criticalOnly, setCriticalOnly] = useState(false)
  const [activityView, setActivityView] = useState('deliverables')
  const [page, setPage] = useState(1)
  const [showNewActivity, setShowNewActivity] = useState(false)
  const [newActivity, setNewActivity] = useState({ external_id: '', name: '', duration_days: 1, activity_type: 'task' })
  const [logicDraft, setLogicDraft] = useState({ predecessor: '', successor: '', relationship_type: 'FS', lag_days: 0 })
  const [facts, setFacts] = useState([])
  const [conflicts, setConflicts] = useState([])
  const [upgradingLegacy, setUpgradingLegacy] = useState(false)
  const [calculationProgress, setCalculationProgress] = useState(0)
  const [calculationPhase, setCalculationPhase] = useState('')
  const [initializationRevision, setInitializationRevision] = useState(0)
  const [metadataNotice, setMetadataNotice] = useState('')
  const workspaceRequest = useRef(0)
  const contextRef = useRef(null)
  contextRef.current = { projectId: String(projectId), scheduleId, versionId, workspace, draftActivities, dirtyIds, busy, onSelectionChange, onWorkspaceChanged, onDirtyChange }
  useEffect(() => { contextRef.current.onDirtyChange?.(dirtyIds.size > 0) }, [dirtyIds.size])
  useEffect(() => { setTab(tabs.some(item => item.id === initialTab) ? initialTab : 'activities') }, [initialTab, tabs])
  useEffect(() => () => { workspaceRequest.current += 1; generationRequestRef.current += 1 }, [])
  useEffect(() => {
    // Synchronize the selected, scoped version before loading its activities.
    // Header/export must not continue reporting the old version on a failed load.
    if (!versions.some(row => String(row.id) === versionId && String(row.schedule) === scheduleId)) return
    contextRef.current.onSelectionChange?.({ scheduleId: Number(scheduleId), versionId: Number(versionId) })
  }, [scheduleId, versionId, versions])
  const { activeJob: scheduleJob, runJob: runScheduleJob } = usePlanningJob({
    storageKey: `radai-schedule-job-${projectId}`,
  })

  const selectTab = next => { setTab(next); onTabChange?.(next) }
  const confirmDiscard = async () => !dirtyIds.size || await radaiConfirm('Discard unsaved activity changes and continue?')
  const handleBack = async () => {
    if (busy || !(await confirmDiscard())) return
    if (embedded && onBack) onBack()
    else navigate('/projects?view=plan-baseline')
  }

  const handleOpenGenerationWizard = async () => {
    if (busy || !(await confirmDiscard())) return
    if (embedded && onOpenGenerationWizard) onOpenGenerationWizard()
    else navigate('/projects?view=plan-baseline')
  }

  const openDocumentStep = (step, analysisAction) => {
    if (upgradingLegacy || refreshingEvidence) return
    const selection = { step, generationId: evidenceGeneration?.id, analysisRunId: evidenceGeneration?.analysis_run_id || requestedAnalysisRunId, analysisAction, planningProjectId: projectId }
    if (onOpenDocumentStep) onOpenDocumentStep(selection)
    else navigate(`/projects?view=plan-baseline&scheduleMode=documents&project=${project?.enterprise_project?.id ?? project?.enterprise_project ?? ''}`, { state: { documentReview: selection } })
  }

  const readGeneration = async (id, ownerProjectId) => {
    if (!/^[1-9]\d*$/.test(String(id))) throw new Error('Select a valid saved generation.')
    const detail = await planningIntelligenceService.getGeneration(id)
    if (String(detail?.id) !== String(id) || String(detail?.project?.id ?? detail?.project) !== String(ownerProjectId)) throw new Error('The saved generation does not belong to this planning project.')
    return detail
  }

  const readAnalysisWorkspace = async (id, ownerProjectId) => {
    if (!/^[1-9]\d*$/.test(String(id))) throw new Error('Select a valid document analysis.')
    const detail = await planningIntelligenceService.getAnalysisWorkspace(id)
    if (detail?.state !== 'analysis_evidence' || String(detail.analysis_run_id) !== String(id)
      || String(detail.project?.id ?? detail.project) !== String(ownerProjectId)) throw new Error('The analysis does not belong to this planning project.')
    return detail
  }

  const refreshGeneration = async () => {
    if (!evidenceGeneration || refreshingEvidence || upgradingLegacy) return
    const request = ++generationRequestRef.current, owner = String(projectId), id = evidenceGeneration.analysis_run_id || evidenceGeneration.id
    const current = () => generationRequestRef.current === request && contextRef.current.projectId === owner
    setRefreshingEvidence(true)
    try {
      const detail = await (evidenceGeneration.analysis_run_id ? readAnalysisWorkspace(id, owner) : readGeneration(id, owner))
      if (current()) { setEvidenceGeneration(detail); setNotice(null) }
    } catch (error) {
      if (current()) setNotice({ type: 'error', message: unwrapError(error, 'Unable to refresh this saved generation.') })
    } finally { if (current()) setRefreshingEvidence(false) }
  }

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

  const loadWorkspace = useCallback(async (id, quiet = false, { preserveDraft = false, discardActivityIds = [] } = {}) => {
    if (!id || String(id) !== contextRef.current.versionId) return
    const request = ++workspaceRequest.current
    const owner = { ...contextRef.current }
    const current = () => request === workspaceRequest.current
      && owner.projectId === contextRef.current.projectId
      && owner.scheduleId === contextRef.current.scheduleId
      && String(id) === contextRef.current.versionId
    if (!quiet) setLoading(true)
    try {
      const data = await planningIntelligenceService.getScheduleWorkspace(id)
      if (!current()) return
      if (String(data?.version?.id) !== String(id) || String(data?.schedule?.id) !== owner.scheduleId) throw new Error('The returned workspace does not match the selected schedule version.')
      const latest = contextRef.current
      const keptDirtyIds = preserveDraft ? new Set([...latest.dirtyIds].filter(activityId => !discardActivityIds.includes(activityId))) : new Set()
      const unsaved = new Map(latest.draftActivities.filter(row => keptDirtyIds.has(row.id)).map(row => [row.id, row]))
      const previous = new Map((latest.workspace?.activities || []).map(row => [row.id, row]))
      const conflictingActivities = []
      const refreshed = (data.activities || []).map(row => {
        const draft = unsaved.get(row.id)
        if (!draft) return row
        unsaved.delete(row.id)
        const changedFields = EDITABLE_ACTIVITY_FIELDS.filter(field => field !== 'id'
          && JSON.stringify(draft[field]) !== JSON.stringify(previous.get(row.id)?.[field]))
        if (changedFields.some(field => JSON.stringify(row[field]) !== JSON.stringify(previous.get(row.id)?.[field])
          && JSON.stringify(row[field]) !== JSON.stringify(draft[field]))) conflictingActivities.push(row.external_id || row.id)
        return { ...row, ...Object.fromEntries(changedFields.map(field => [field, draft[field]])) }
      })
      if (conflictingActivities.length || unsaved.size) {
        setNotice({ type: 'error', message: 'The schedule changed while you had unsaved activity edits. Your values and original version are retained. Review the changes or reload the schedule before saving.' })
        return false
      }
      setWorkspace(data)
      setDraftActivities(refreshed)
      setDirtyIds(keptDirtyIds)
      setNotice(null)
      if (quiet) contextRef.current.onWorkspaceChanged?.()
      return true
    } catch (error) {
      if (!current()) return
      if (!quiet) { setWorkspace(null); setDraftActivities([]); setDirtyIds(new Set()) }
      setNotice({ type: 'error', message: unwrapError(error, 'Unable to load the planner workspace.') })
      return false
    } finally {
      if (current()) setLoading(false)
    }
  }, [])

  const refreshWorkspacePreservingDraft = (options = {}) => loadWorkspace(versionId, true, { preserveDraft: true, ...options })

  useEffect(() => {
    let active = true
    const initialize = async () => {
      setLoading(true)
      workspaceRequest.current += 1
      generationRequestRef.current += 1
      upgradeRequestRef.current = false
      materializedVersionRef.current = null
      setEvidenceGeneration(null); setMaterializationIssues([]); setRefreshingEvidence(false); setUpgradingLegacy(false)
      setWorkspace(null); setSchedules([]); setVersions([]); setScheduleId(''); setVersionId('')
      setDraftActivities([]); setDirtyIds(new Set()); setNotice(null); setMetadataNotice('')
      if (requestedAnalysisRunId || requestedGenerationId) contextRef.current.onSelectionChange?.({ scheduleId: null, versionId: null, generationId: requestedAnalysisRunId ? null : requestedGenerationId, analysisRunId: requestedAnalysisRunId })
      try {
        if (requestedAnalysisRunId) {
          const [projectData, detail] = await Promise.all([
            planningIntelligenceService.getProject(projectId), readAnalysisWorkspace(requestedAnalysisRunId, projectId),
          ])
          if (!active) return
          if (String(projectData?.id) !== String(projectId)) throw new Error('The returned planning project does not match this workspace.')
          setProject(projectData)
          setEvidenceGeneration(detail)
          setLoading(false)
          return
        }
        const [projectResult, scheduleResult, generationResult, proposalResult] = await Promise.allSettled([
          planningIntelligenceService.getProject(projectId),
          planningIntelligenceService.listSchedules(projectId),
          planningIntelligenceService.listGenerations(projectId),
          planningIntelligenceService.listScheduleDefaultProposals(projectId),
        ])
        if (!active) return
        if (projectResult.status === 'rejected') throw projectResult.reason
        if (scheduleResult.status === 'rejected') throw scheduleResult.reason
        const projectData = projectResult.value, scheduleRows = scheduleResult.value
        if (String(projectData?.id) !== String(projectId)) throw new Error('The returned planning project does not match this workspace.')
        if (!scheduleRows.length && !requestedGenerationId && generationResult.status === 'rejected') throw generationResult.reason
        const generationRows = generationResult.status === 'fulfilled' ? generationResult.value : []
        const proposalRows = proposalResult.status === 'fulfilled' ? proposalResult.value : []
        if (generationResult.status === 'rejected' || proposalResult.status === 'rejected') setMetadataNotice('Some generation history or scheduling approval details could not be loaded. Available stored schedules remain accessible.')
        setProject(projectData)
        setSchedules(scheduleRows)
        setDefaultProposals(proposalRows)
        const generationId = requestedGenerationId || (!scheduleRows.length ? generationRows[0]?.id : null)
        if (generationId) {
          contextRef.current.onSelectionChange?.({ scheduleId: null, versionId: null, generationId })
          const detail = await readGeneration(generationId, projectId)
          if (!active) return
          setEvidenceGeneration(detail)
          contextRef.current.onSelectionChange?.({ scheduleId: null, versionId: null, generationId: detail.id })
          setLoading(false)
        }
        else if (scheduleRows.length) setScheduleId(String(scheduleRows.find(row => String(row.id) === String(initialScheduleId))?.id || scheduleRows[0].id))
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
  }, [projectId, initialScheduleId, requestedGenerationId, requestedAnalysisRunId, initializationRevision])

  useEffect(() => {
    if (!scheduleId) return
    let active = true
    const loadVersions = async () => {
      setLoading(true)
      workspaceRequest.current += 1
      if (String(contextRef.current.workspace?.schedule?.id) !== scheduleId) { setWorkspace(null); setDraftActivities([]); setVersionId('') }
      try {
        const rows = await planningIntelligenceService.listScheduleVersions(scheduleId)
        if (!active) return
        setVersions(rows)
        const materializedVersion = String(materializedVersionRef.current?.scheduleId) === scheduleId ? materializedVersionRef.current.versionId : null
        const requestedVersion = rows.find(row => String(row.id) === String(materializedVersion || initialVersionId));
        if (materializedVersion && !requestedVersion) throw new Error('The created schedule version is no longer available. Refresh the workspace before continuing.')
        const nextId = requestedVersion ? String(requestedVersion.id) : rows[0]?.id ? String(rows[0].id) : ''
        setVersionId(nextId)
        if (!nextId) { setWorkspace(null); setDraftActivities([]); setLoading(false) }
        else if (String(contextRef.current.workspace?.version?.id) === nextId && String(contextRef.current.workspace?.schedule?.id) === scheduleId) setLoading(false)
      } catch (error) {
        if (active) {
          setWorkspace(null); setVersions([]); setVersionId(''); setDraftActivities([])
          setNotice({ type: 'error', message: unwrapError(error, 'Unable to load schedule versions.') })
          setLoading(false)
        }
      }
    }
    loadVersions()
    return () => { active = false }
  }, [scheduleId, initialVersionId])

  useEffect(() => {
    if (versionId) { setWorkspace(null); setDraftActivities([]); setDirtyIds(new Set()); loadWorkspace(versionId) }
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
    const contractualFinish = workspace?.planning_package?.contractual_finish || workspace?.project?.planned_end_date || project?.planned_end_date
    const forecastFinish = workspace?.version?.calculated_finish
    const finishVariance = contractualFinish && forecastFinish
      ? dateDays(dateValue(contractualFinish), dateValue(forecastFinish))
      : null
    return {
      activities: workspace ? activities.length : 'Unavailable',
      critical: !workspace ? 'Unavailable' : activities.some(item => item.total_float_days != null) || ['calculated', 'approved', 'baselined'].includes(workspace.version?.status) ? activities.filter(item => item.is_critical).length : 'Not calculated',
      milestones: workspace ? activities.filter(item => item.is_milestone).length : 'Unavailable',
      finish: workspace?.version?.calculated_finish || 'Not calculated',
      contractualFinish: contractualFinish || 'Not set',
      finishVariance,
    }
  }, [workspace, project])

  const updateDraft = (id, field, value) => {
    if (contextRef.current.busy || !contextRef.current.workspace?.can_edit) return
    setDraftActivities(rows => rows.map(row => row.id === id ? { ...row, [field]: value } : row))
    setDirtyIds(current => new Set(current).add(id))
  }

  const runAction = async (key, action, message, refreshOptions = {}) => {
    setBusy(key)
    try {
      await action()
      if (!(await refreshWorkspacePreservingDraft(refreshOptions))) return
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
      if (!(await loadWorkspace(versionId, true))) return
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
      if (!(await loadWorkspace(versionId, true))) return
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
    if (!(await radaiConfirm(
      'Replace this draft revision’s predecessor network with the current generated logic, then recalculate CPM? Activity names and durations will be preserved.',
    ))) return
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
      if (!(await loadWorkspace(versionId, true))) return
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
    const summary = (await radaiPrompt('Revision summary', 'Planner workspace revision'))
    if (summary === null) return
    setBusy('revision')
    try {
      const version = await planningIntelligenceService.createScheduleVersion(scheduleId, summary)
      const rows = await planningIntelligenceService.listScheduleVersions(scheduleId)
      setVersions(rows)
      setVersionId(String(version.id))
      contextRef.current.onWorkspaceChanged?.()
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
      if (!(await refreshWorkspacePreservingDraft())) return
      setNotice({ type: 'success', message: 'Activity added.' })
    } catch (error) {
      setNotice({ type: 'error', message: unwrapError(error, 'Unable to add the activity.') })
    } finally {
      setBusy('')
    }
  }

  const deleteActivity = async activity => {
    if (!(await radaiConfirm(`Delete ${activity.external_id} - ${activity.name}?`))) return
    await runAction('delete', () => planningIntelligenceService.deleteActivity(activity.id), 'Activity removed.', { discardActivityIds: [activity.id] })
  }

  const createLogic = async event => {
    event.preventDefault()
    await runAction('logic', () => planningIntelligenceService.createRelationship({
      ...logicDraft, version: Number(versionId), predecessor: Number(logicDraft.predecessor),
      successor: Number(logicDraft.successor), lag_days: Number(logicDraft.lag_days || 0),
    }), 'Relationship added. Recalculate to refresh the network.')
    setLogicDraft({ predecessor: '', successor: '', relationship_type: 'FS', lag_days: 0 })
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
    if (upgradeRequestRef.current || refreshingEvidence || !evidenceGeneration) return
    upgradeRequestRef.current = true
    const request = ++generationRequestRef.current, owner = String(projectId), selectedGeneration = evidenceGeneration
    const current = () => request === generationRequestRef.current && contextRef.current.projectId === owner
    setUpgradingLegacy(true)
    setNotice(null)
    try {
      const result = await planningIntelligenceService.materializeGeneration(selectedGeneration.id)
      if (!current()) return
      if (String(result?.generation_id) !== String(selectedGeneration.id)) throw new Error('The upgrade response does not match the selected generation.')
      setMaterializationIssues(result.materialization_issues || result.issues || [])
      if (result.state === 'needs_evidence_review' || !result.schedule_version_id || !result.schedule_id) {
        setNotice({ type: 'info', message: 'This generation still needs evidence review. Its saved activities remain available below; no calculated schedule was created.' })
        return
      }
      const [rows, version] = await Promise.all([
        planningIntelligenceService.listSchedules(owner),
        planningIntelligenceService.getScheduleVersion(result.schedule_version_id),
      ])
      if (!current()) return
      const schedule = rows.find(row => String(row.id) === String(result.schedule_id) && String(row.project?.id ?? row.project) === owner)
      if (!schedule || String(version?.id) !== String(result.schedule_version_id) || String(version?.schedule?.id ?? version?.schedule) !== String(schedule.id)) throw new Error('The created schedule version could not be verified for this project. The saved generation is retained; refresh before trying again.')
      materializedVersionRef.current = { scheduleId: schedule.id, versionId: version.id }
      setSchedules(rows)
      setEvidenceGeneration(null)
      setScheduleId(String(schedule.id))
      contextRef.current.onWorkspaceChanged?.()
      setNotice({
        type: 'success',
        message: `Generation v${selectedGeneration.version} created schedule version ${version.version}.`,
      })
    } catch (error) {
      if (current()) setNotice({ type: 'error', message: unwrapError(error, 'Unable to upgrade the generated schedule.') })
    } finally {
      if (current()) { setUpgradingLegacy(false); upgradeRequestRef.current = false }
    }
  }

  if (loading && !workspace) {
    return <div className={`${embedded ? 'min-h-96' : 'min-h-[70vh]'} flex items-center justify-center bg-slate-50 p-6`}><div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" role="status" aria-live="polite"><div className="flex items-center gap-3"><Loader2 className="h-6 w-6 animate-spin text-violet-600" /><div><p className="font-bold text-slate-800">Loading Planner Workspace</p><p className="text-sm text-slate-500">Checking schedules, generated versions, and project-level approvals…</p></div></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-violet-100"><div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-violet-600 via-indigo-500 to-violet-600" /></div></div></div>
  }

  if (evidenceGeneration) {
    const analysisEvidence = Boolean(evidenceGeneration.analysis_run_id)
    const evidenceTabs = TABS.filter(item => ['activities', 'wbs', 'logic', 'evidence'].includes(item.id))
    const evidenceTab = evidenceTabs.some(item => item.id === tab) ? tab : 'activities'
    const evidenceCounts = [
      ['Activities', evidenceGeneration.activities?.length || 0],
      ['WBS nodes', evidenceGeneration.wbs?.length || 0],
      ['Recorded relationships', evidenceGeneration.logic_matrix?.length || 0],
      ['Review findings', evidenceGeneration.validation?.length || 0],
    ]
    const evidenceNavigation = analysisEvidence ? <section className="pw-work-area">
      <nav aria-label="Planning workspace areas" className="pw-tabs">{evidenceTabs.map(item => {
        const Icon = item.icon
        return <button type="button" key={item.id} aria-current={evidenceTab === item.id ? 'page' : undefined} onClick={() => selectTab(item.id)}><Icon aria-hidden="true" size={16} />{item.label}</button>
      })}</nav>
      <div className="pw-action-bar"><div className="pw-edit-state"><strong>{evidenceTabs.find(item => item.id === evidenceTab).label}</strong><span>Evidence draft · Review-only</span></div>
        <dl className="gew-metrics" aria-label="Selected analysis summary">{evidenceCounts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      </div>
    </section> : undefined
    return <section className="planner-workspace pw-embedded" aria-label="Master Schedule">
      {metadataNotice && <p role="status" className="pw-metadata-notice">{metadataNotice}</p>}
      {notice && <p role={notice.type === 'error' ? 'alert' : 'status'} className="pw-metadata-notice">{notice.message}</p>}
      <GenerationEvidenceWorkspace generation={evidenceGeneration} issues={materializationIssues} navigation={evidenceNavigation} view={analysisEvidence ? evidenceTab : 'all'} analysisState={analysisState}
        onReviewEvidence={() => openDocumentStep('intelligence')}
        onEditActivities={evidenceGeneration.analysis_run_id ? undefined : () => openDocumentStep('schedule')}
        onBuildWorkBreakdown={evidenceGeneration.analysis_run_id ? undefined : () => openDocumentStep('wbs')}
        onAiSettings={() => openDocumentStep('intelligence', 'settings')} onRetryAnalysis={() => openDocumentStep('intelligence', 'retry')}
        onRefresh={refreshGeneration} refreshing={refreshingEvidence || upgradingLegacy} />
      <div className="pw-settings-actions">
        {!evidenceGeneration.analysis_run_id && (evidenceGeneration.intelligence?.schedule_engine?.policy !== 'document_driven' || evidenceGeneration.intelligence?.schedule_engine?.ready_for_calculation === true) && <button type="button" className="pw-button" disabled={upgradingLegacy || refreshingEvidence} onClick={upgradeLatestGeneration}>{upgradingLegacy ? 'Checking generation readiness…' : `Upgrade Generation v${evidenceGeneration.version}`}</button>}
        {schedules.length > 0 && <button type="button" className="pw-button" disabled={upgradingLegacy || refreshingEvidence} onClick={() => { setEvidenceGeneration(null); setNotice(null); setScheduleId(String(schedules.find(row => String(row.id) === String(initialScheduleId))?.id || schedules[0].id)) }}>Open stored schedule</button>}
      </div>
    </section>
  }

  if ((!schedules.length || ((requestedGenerationId || requestedAnalysisRunId) && !scheduleId)) && notice?.type === 'error') {
    return <section className="planner-workspace pw-load-error" aria-label="Master Schedule"><AlertTriangle size={28} /><h2>Schedule workspace unavailable</h2><p role="alert">{notice.message}</p><button type="button" className="pw-button" onClick={() => setInitializationRevision(value => value + 1)}>Retry workspace</button>{requestedAnalysisRunId && <button type="button" className="pw-button" onClick={() => openDocumentStep('intelligence')}>Review source evidence</button>}</section>
  }

  if (!schedules.length) {
    const pendingDefaultProposal = defaultProposals.find(row => row.status === 'proposed')
    if (pendingDefaultProposal) {
      return <div className={`${embedded ? 'rounded-xl' : 'min-h-screen'} bg-slate-100/70 p-4 sm:p-6`}>
        <div className="mx-auto max-w-6xl space-y-5">
          <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={handleBack} className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700"><ArrowLeft className="h-4 w-4" /> Back to Plan &amp; Baseline</button><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Project-level governance</span></div>
          <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-amber-700">Final approval required before generation</p><h1 className="mt-1 text-2xl font-bold text-slate-900">{project?.name} — Scheduling Default Approval</h1><p className="mt-2 text-sm text-slate-600">Proposal #{pendingDefaultProposal.id} is governed at project level because no schedule version exists yet. Approve it below, then return to the Generation Wizard to create the first relational schedule.</p></section>
          {notice && <div className={`rounded-xl border px-4 py-3 text-sm ${notice.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{notice.message}</div>}
          <SchedulingDefaultsApprovalPanel projectId={projectId} onNotice={showControlsNotice} onChanged={async () => setDefaultProposals(await planningIntelligenceService.listScheduleDefaultProposals(projectId))} />
          <div className="flex justify-end"><button type="button" onClick={handleOpenGenerationWizard} className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow hover:bg-violet-700">Return to Generation Wizard →</button></div>
        </div>
      </div>
    }
    return (
      <div className={`${embedded ? 'rounded-xl bg-slate-100/70' : ''} p-6 max-w-3xl mx-auto`}>
        <button type="button" onClick={handleBack} className="inline-flex items-center gap-2 text-sm text-violet-700"><ArrowLeft className="w-4 h-4" /> Back to Plan &amp; Baseline</button>
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-slate-800">No schedule has been generated yet</h1>
          <p className="text-sm text-slate-500 mt-2">Review source documents and required planning inputs in the Schedule Generation Wizard before creating a schedule.</p>
          {metadataNotice && <p role="status" className="pw-metadata-notice">{metadataNotice}<button type="button" className="pw-button" onClick={() => setInitializationRevision(value => value + 1)}>Retry workspace</button></p>}
          {notice && <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${notice.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>{notice.message}</div>}
          <button type="button" onClick={handleOpenGenerationWizard} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-700"><PlusCircle className="h-4 w-4" />Open Schedule Generation Wizard</button>
        </div>
      </div>
    )
  }

  const summaryCounts = [
    ['Activities', stats.activities], ['Critical', stats.critical], ['Milestones', stats.milestones],
    ['WBS Nodes', workspace?.wbs?.length ?? 'Unavailable'], ['Logic Ties', workspace?.relationships?.length ?? 'Unavailable'],
    ['Resources', workspace?.resources?.length ?? 'Unavailable'], ['Open Evidence', workspace?.intelligence?.conflict_count ?? 'Not available'],
  ]
  const selectedVersion = versions.find(version => String(version.id) === versionId)
  const selectionControls = (<div className="pw-selection-row">
          <label>Schedule<select aria-label="Schedule" value={scheduleId} disabled={Boolean(busy)} onChange={async event => { const value = event.target.value; if (await confirmDiscard()) { settingsSelectionFocusPending.current = compactHeader; setSettingsOpen(false); setScheduleId(value) } }}>
            {schedules.map(schedule => <option key={schedule.id} value={schedule.id}>{schedule.code} - {schedule.name}</option>)}
          </select></label>
          <label>Version<select aria-label="Schedule version" value={versionId} disabled={Boolean(busy) || !versions.length} onChange={async event => { const value = event.target.value; if (await confirmDiscard()) { settingsSelectionFocusPending.current = compactHeader; setSettingsOpen(false); setVersionId(value) } }}>
            {!versions.length && <option value="">No version available</option>}
            {versions.map(version => <option key={version.id} value={version.id}>Version {version.version} - {version.status}</option>)}
          </select></label>
          <div className="pw-version-tools"><button type="button" onClick={async () => { if (await confirmDiscard()) { setSettingsOpen(false); createRevision() } }} disabled={Boolean(busy)} className="pw-button"><PlusCircle size={16} />New Revision</button>
          <button type="button" disabled={Boolean(busy) || !scheduleId} onClick={async () => { if (!(await confirmDiscard())) return; setSettingsOpen(false); if (!versionId) { setInitializationRevision(value => value + 1); return } setBusy('reload'); await loadWorkspace(versionId, true); setBusy('') }} className="pw-icon-button" title="Reload schedule" aria-label="Reload schedule"><RefreshCw size={17} /></button></div>
        </div>)
  const schedulingConfiguration = workspace?.scheduling_configuration ? (<details className="pw-configuration"><summary>Scheduling configuration <span>Version {workspace.scheduling_configuration.configuration_version}</span></summary><section className="pw-configuration-body">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-600">Controlled scheduling configuration</p>
              <p className="mt-1 font-bold text-slate-900">{workspace.scheduling_configuration.workflow_template} · {workspace.scheduling_configuration.standard_task_count} tasks per standard deliverable</p>
              <p className="mt-1 text-xs text-slate-600">{(workspace.scheduling_configuration.workflow_stages || []).map(stage => stage.name).join(' → ')}</p>
            </div>
            <div className="rounded-xl bg-white/80 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Process network</p><p className="mt-1 text-sm font-bold text-slate-800">{workspace.scheduling_configuration.dependency_template || 'Not selected'}</p><p className="text-xs text-slate-500">{workspace.scheduling_configuration.confirmed_dependency_rule_count} / {workspace.scheduling_configuration.dependency_rule_count} gates confirmed</p></div>
            <div className="rounded-xl bg-white/80 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Date authority</p><p className="mt-1 text-sm font-bold uppercase text-blue-700">Relational CPM</p><p className="text-xs text-slate-500">Configuration v{workspace.scheduling_configuration.configuration_version}</p></div>
            <button type="button" onClick={handleOpenGenerationWizard} className="rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-50">Generation Wizard</button>
          </section></details>) : null
  const settingsControl = <button ref={settingsTriggerRef} type="button" className="pw-settings-trigger" aria-label="Schedule settings" aria-haspopup="dialog" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(true)}>
    <Settings2 size={16} aria-hidden="true" /><span>Schedule settings</span><small>{selectedVersion ? `Version ${selectedVersion.version} - ${selectedVersion.status}` : 'No version selected'}</small>
  </button>

  const immutable = !workspace?.can_edit || Boolean(busy) || loading
  const approvalBlocked = (workspace?.dependency_assumptions || []).some(item => item.requires_confirmation)
    || (workspace?.generation_validation || []).some(item => item.severity === 'critical')
    || workspace?.schedule_assurance?.status !== 'approved'
  return (
    <div className={`project-control-workspace planner-workspace ${embedded ? 'pw-embedded' : 'pw-page'}${compactHeader ? ' pw-compact' : ''}`} role="region" aria-label="Master Schedule">
      {!compactHeader && <header className="pw-header">
        <div className="pw-heading-row">
          <button type="button" onClick={handleBack} disabled={Boolean(busy)} className="pw-icon-button" title="Back to Plan & Baseline" aria-label="Back to Plan & Baseline"><ArrowLeft className="w-5 h-5" /></button>
          <div className="pw-heading">
            <p>Planner workspace</p>
            <h1>Master Schedule</h1>
            <span>{workspace?.project?.name || project?.name}</span>
          </div>
          <div className="pw-header-tools"><StatusBadge status={workspace?.version?.status || 'Not loaded'} /><button type="button" onClick={handleOpenGenerationWizard} disabled={Boolean(busy)} className="pw-button">Document Intelligence</button></div>
        </div>
        {selectionControls}
      </header>}
      {compactHeader && workspaceActive && (headerContainer ? createPortal(settingsControl, headerContainer) : <div className="pw-settings-fallback">{settingsControl}</div>)}
      {compactHeader && workspaceActive && settingsOpen && <ScheduleSettingsDialog busy={Boolean(busy)} onClose={() => setSettingsOpen(false)} restoreFocus={restoreSettingsFocus}>
        <p className="pw-settings-project">{workspace?.project?.name || project?.name}</p>
        {selectionControls}
        <dl className="pw-settings-dates"><div><dt>Forecast Finish</dt><dd>{stats.finish}</dd></div><div><dt>Contract Finish</dt><dd>{stats.contractualFinish}</dd></div></dl>
        {schedulingConfiguration}
        <div className="pw-settings-actions"><button type="button" className="pw-button" onClick={handleOpenGenerationWizard} disabled={Boolean(busy)}>Document Intelligence</button><button type="button" className="pw-button" onClick={() => setSettingsOpen(false)} disabled={Boolean(busy)}>Done</button></div>
      </ScheduleSettingsDialog>}

      <main className="pw-main">
        {metadataNotice && <p role="status" className="pw-metadata-notice">{metadataNotice}</p>}
        {workspace?.planning_package && <section aria-label="Planning package assumptions" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p><strong>Proposed planning package</strong> · Saved analysis #{workspace.planning_package.intelligence_run_id}. Review workflow durations, technical sequence and calendar assumptions before approval.</p>
          <p className="mt-1">Registered start: {workspace.planning_package.project_start || 'Not specified'}. Calendar: {workspace.planning_package.calendar?.name || 'Not specified'}{Array.isArray(workspace.planning_package.calendar?.working_weekdays) ? ` · ${workspace.planning_package.calendar.working_weekdays.length} working days/week` : ''}{workspace.planning_package.calendar?.hours_per_day != null ? ` · ${workspace.planning_package.calendar.hours_per_day} hours/day` : ''}. These planning values are not verified document facts.</p>
          {workspace.planning_package.assumptions?.length > 0 && <details className="mt-2"><summary className="cursor-pointer font-semibold">Review planning assumptions</summary><ul className="mt-2 list-disc space-y-1 pl-5">{workspace.planning_package.assumptions.map((item, index) => <li key={index}>{typeof item === 'string' ? item : item.message || `${String(item.field || 'Assumption').replaceAll('_', ' ')}: ${typeof item.value === 'object' ? item.value?.name || 'Recorded configuration' : item.value ?? item.status ?? 'Review required'}`}</li>)}</ul></details>}
        </section>}
        {notice && (
          <div role={notice.type === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 flex items-start gap-2 text-sm ${notice.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
            {notice.type === 'error' ? <AlertTriangle className="w-4 h-4 mt-0.5" /> : <Check className="w-4 h-4 mt-0.5" />}
            <span className="flex-1">{notice.message}</span><button type="button" aria-label="Dismiss workspace notice" onClick={() => setNotice(null)}><X className="w-4 h-4" /></button>
          </div>
        )}

        {!compactHeader && <section className="pw-metrics" aria-label="Selected schedule summary">
          {[
            ['Activities', stats.activities], ['Critical', stats.critical], ['Milestones', stats.milestones],
            ['Forecast Finish', stats.finish], ['Contract Finish', stats.contractualFinish],
            ['WBS Nodes', workspace?.wbs?.length ?? 'Unavailable'],
            ['Logic Ties', workspace?.relationships?.length ?? 'Unavailable'], ['Resources', workspace?.resources?.length ?? 'Unavailable'],
            ['Open Evidence', workspace?.intelligence?.conflict_count ?? 'Not available'],
          ].map(([label, value]) => (
            <div key={label} className="pw-metric">
              <span>{label}</span>
              <strong className={label === 'Critical' && Number(value) > 0 ? 'pw-critical' : ''}>{value}</strong>
            </div>
          ))}
        </section>}

        {stats.finishVariance > 0 && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <span className="font-bold">Contract finish overrun:</span> the current CPM network forecasts {stats.finish} against the {stats.contractualFinish} contractual finish ({stats.finishVariance} calendar days late). Recalculate CPM validates the stored network; it does not automatically shorten activities or force the finish date. Negative float now uses the contractual finish, so revise logic, durations, or scope before approval.
          </div>
        )}

        {!compactHeader && schedulingConfiguration}

        <section className="pw-work-area">
          <nav aria-label="Planning workspace areas" className="pw-tabs">
            {tabs.map(item => {
              const Icon = item.icon
              return <button type="button" key={item.id} aria-current={tab === item.id ? 'page' : undefined} onClick={() => selectTab(item.id)}><Icon aria-hidden="true" size={16} />{item.label}</button>
            })}
          </nav>
          <div className="pw-action-bar"><div className="pw-edit-state"><strong>{tabs.find(item => item.id === tab)?.label}</strong><span>{immutable ? 'Read-only schedule version' : 'Editable draft version'}</span></div>{compactHeader && <dl className="pw-inline-metrics" aria-label="Selected schedule summary">{summaryCounts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className={label === 'Critical' && Number(value) > 0 ? 'pw-critical' : undefined}>{value}</dd></div>)}</dl>}<div className="pw-actions">
              {dirtyIds.size > 0 && <span className="text-xs text-amber-600">{dirtyIds.size} unsaved</span>}
              <button onClick={saveActivities} disabled={!dirtyIds.size || Boolean(busy) || immutable} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold disabled:opacity-40"><Save className="w-4 h-4" /> Save</button>
              <button onClick={saveAndCalculate} disabled={Boolean(busy) || immutable} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-40">{busy === 'save-calculate' ? 'Calculating…' : dirtyIds.size ? 'Save & Calculate' : 'Recalculate CPM'}</button>
              <button type="button" onClick={rebuildLogicAndCalculate} disabled={Boolean(busy) || immutable || dirtyIds.size > 0} title={dirtyIds.size ? 'Save activity changes first.' : 'Replace all predecessors with the latest generated network, then calculate CPM. Use only when you want to discard manual logic edits.'} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 disabled:opacity-40"><GitBranch className="h-4 w-4" />{busy === 'rebuild-calculate' ? 'Resetting…' : 'Reset logic & calculate'}</button>
              <button title={dirtyIds.size ? 'Save and calculate first before approving this version.' : approvalBlocked ? 'Complete and approve Phase 3 assurance before schedule approval.' : 'Approve this calculated version'} onClick={() => runAction('approve', () => planningIntelligenceService.approveScheduleVersion(versionId), 'Schedule version approved.')} disabled={Boolean(busy) || dirtyIds.size > 0 || workspace?.version?.status !== 'calculated' || workspace?.version?.can_approve !== true || approvalBlocked} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-40">Approve</button>
              <button onClick={async () => {
                const name = (await radaiPrompt('Baseline name', `Baseline ${workspace?.version?.version}`))
                if (name) runAction('baseline', () => planningIntelligenceService.baselineScheduleVersion(versionId, name), 'Baseline created and locked.')
              }} title={dirtyIds.size ? 'Save and calculate first before creating a baseline.' : 'Create a baseline from this approved version'} disabled={Boolean(busy) || dirtyIds.size > 0 || workspace?.version?.status !== 'approved' || workspace?.version?.can_baseline !== true || workspace?.schedule_assurance?.status !== 'approved'} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold disabled:opacity-40"><Baseline className="w-4 h-4" /> Baseline</button>
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

          {!workspace ? <p className="pw-content-empty">{versions.length ? 'The selected schedule version is unavailable. Reload the schedule to retry.' : 'This schedule has no versions. Create a revision to begin.'}</p> : <>
          {tab === 'activities' && (
            <div>
              <div className="p-3 border-b border-slate-200 flex flex-wrap gap-2 items-center">
                <div className="relative min-w-[240px] flex-1 max-w-md"><Search aria-hidden="true" className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" /><label htmlFor="activity-search" className="sr-only">Search activities</label><input id="activity-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search ID or activity name" className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
                <label htmlFor="discipline-filter" className="sr-only">Filter by discipline</label><select id="discipline-filter" value={discipline} onChange={event => setDiscipline(event.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm"><option value="all">All disciplines</option>{disciplines.map(value => <option key={value}>{value}</option>)}</select>
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"><button type="button" onClick={() => setActivityView('deliverables')} className={`rounded-md px-3 py-1.5 text-xs font-bold ${activityView === 'deliverables' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500'}`}>Deliverables</button><button type="button" onClick={() => setActivityView('activities')} className={`rounded-md px-3 py-1.5 text-xs font-bold ${activityView === 'activities' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500'}`}>Flat activities</button></div>
                <label className="inline-flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={criticalOnly} onChange={event => setCriticalOnly(event.target.checked)} className="accent-rose-600" /> Critical only</label>
                <button onClick={() => setShowNewActivity(value => !value)} disabled={immutable} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-violet-200 text-violet-700 text-sm font-semibold disabled:opacity-40"><PlusCircle className="w-4 h-4" /> Add Activity</button>
              </div>
              {showNewActivity && (
                <form onSubmit={createActivity} className="p-3 bg-violet-50/60 border-b border-violet-100 flex flex-wrap gap-2">
                  <input aria-label="Activity ID" required value={newActivity.external_id} onChange={event => setNewActivity(value => ({ ...value, external_id: event.target.value }))} placeholder="Activity ID" className="border rounded-lg px-3 py-2 text-sm w-36" />
                  <input aria-label="Activity name" required value={newActivity.name} onChange={event => setNewActivity(value => ({ ...value, name: event.target.value }))} placeholder="Activity name" className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[240px]" />
                  <input aria-label="Duration in days" type="number" min="0" step="0.25" value={newActivity.duration_days} onChange={event => setNewActivity(value => ({ ...value, duration_days: event.target.value }))} className="border rounded-lg px-3 py-2 text-sm w-28" />
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
                  dataDate={workspace?.schedule?.data_date || workspace?.planning_package?.project_start || workspace?.schedule?.planned_start}
                  calculatedFinish={workspace?.version?.calculated_finish}
                />
              ) : <>
              <div role="region" aria-label="Editable activity table and Gantt chart" tabIndex="0" className="grid grid-cols-1 xl:grid-cols-[minmax(760px,1.3fr)_minmax(520px,1fr)] overflow-auto max-h-[64vh]">
                <table className="min-w-[920px] text-xs border-r border-slate-200">
                  <thead className="sticky top-0 z-10 bg-slate-100 text-slate-500"><tr>{['ID', 'Activity Name', 'Type', 'Duration', 'Start', 'Finish', 'Float', 'Role', ''].map(label => <th key={label} className="text-left px-2 py-2 font-semibold">{label}</th>)}</tr></thead>
                  <tbody>{pageRows.map(row => (
                    <tr key={row.id} className={`border-t border-slate-100 h-10 ${row.is_critical ? 'bg-rose-50/60' : dirtyIds.has(row.id) ? 'bg-amber-50' : 'hover:bg-slate-50'}`}>
                      <td className="px-2 font-mono font-semibold text-slate-700">{row.external_id}</td>
                      <td className="px-2"><input aria-label={`${row.external_id} activity name`} disabled={immutable} value={row.name} onChange={event => updateDraft(row.id, 'name', event.target.value)} className="w-full min-w-[230px] bg-transparent border-0 focus:ring-1 focus:ring-violet-400 rounded px-1 py-1 disabled:text-slate-700" /></td>
                      <td className="px-2"><select aria-label={`${row.external_id} activity type`} disabled={immutable} value={row.activity_type} onChange={event => updateDraft(row.id, 'activity_type', event.target.value)} className="bg-transparent"><option value="task">Task</option><option value="start_milestone">Start MS</option><option value="finish_milestone">Finish MS</option><option value="level_of_effort">LOE</option></select></td>
                      <td className="px-2"><input aria-label={`${row.external_id} duration in days`} disabled={immutable} type="number" min="0" step="0.25" value={row.duration_days} onChange={event => updateDraft(row.id, 'duration_days', event.target.value)} className="w-16 bg-transparent rounded px-1" /></td>
                      <td className="px-2 whitespace-nowrap">{row.planned_start || '-'}</td><td className="px-2 whitespace-nowrap">{row.planned_finish || '-'}</td>
                      <td className={`px-2 font-semibold ${Number(row.total_float_days) <= 0 ? 'text-rose-600' : 'text-slate-500'}`}>{row.total_float_days ?? '-'}</td>
                      <td className="px-2"><input aria-label={`${row.external_id} responsible role`} disabled={immutable} value={row.responsible_role || ''} onChange={event => updateDraft(row.id, 'responsible_role', event.target.value)} className="w-32 bg-transparent rounded px-1" /></td>
                      <td className="px-2"><button type="button" aria-label={`Delete ${row.external_id}`} disabled={immutable} onClick={() => deleteActivity(row)} className="min-h-10 min-w-10 text-slate-400 hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 disabled:opacity-30"><Trash2 aria-hidden="true" className="mx-auto w-4 h-4" /></button></td>
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
              <div className="p-3 border-t border-slate-200 flex items-center justify-between text-sm text-slate-500"><span>{filteredActivities.length} activities</span><div className="flex items-center gap-2"><button type="button" aria-label="Previous activity page" className="min-h-10 min-w-10 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600" disabled={page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft aria-hidden="true" className="mx-auto w-4 h-4" /></button><span>Page {page} of {pageCount}</span><button type="button" aria-label="Next activity page" className="min-h-10 min-w-10 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600" disabled={page >= pageCount} onClick={() => setPage(value => value + 1)}><ChevronRight aria-hidden="true" className="mx-auto w-4 h-4" /></button></div></div>
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
              onControlsChanged={() => refreshWorkspacePreservingDraft()}
            />
          )}

          {tab === 'wbs' && <div className="p-4 space-y-1 max-w-5xl">{workspace?.wbs?.map(node => <div key={node.id} className="flex items-center gap-3 rounded-lg border border-slate-100 hover:bg-slate-50 px-3 py-2" style={{ marginLeft: `${Math.min(node.level, 5) * 22}px` }}><span className="font-mono text-xs text-violet-700 w-24 shrink-0">{node.code}</span><input disabled={immutable} defaultValue={node.name} onBlur={event => saveWbsName(node, event.target.value)} className="flex-1 bg-transparent text-sm font-medium text-slate-700" /><span className="text-xs text-slate-400">{node.discipline}</span></div>)}</div>}

          {tab === 'logic' && <PlannerLogicAssurance configuration={workspace?.scheduling_configuration} assumptions={workspace?.dependency_assumptions || []} validation={workspace?.generation_validation || []} />}

          {tab === 'logic' && <div className="p-4 space-y-4"><form onSubmit={createLogic} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_100px_100px_auto] gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3"><select required value={logicDraft.predecessor} onChange={event => setLogicDraft(value => ({ ...value, predecessor: event.target.value }))} className="border rounded-lg px-2 py-2 text-sm"><option value="">Predecessor</option>{workspace?.activities?.map(row => <option key={row.id} value={row.id}>{row.external_id} - {row.name}</option>)}</select><select required value={logicDraft.successor} onChange={event => setLogicDraft(value => ({ ...value, successor: event.target.value }))} className="border rounded-lg px-2 py-2 text-sm"><option value="">Successor</option>{workspace?.activities?.map(row => <option key={row.id} value={row.id}>{row.external_id} - {row.name}</option>)}</select><select value={logicDraft.relationship_type} onChange={event => setLogicDraft(value => ({ ...value, relationship_type: event.target.value }))} className="border rounded-lg px-2 py-2 text-sm">{['FS', 'SS', 'FF', 'SF'].map(value => <option key={value}>{value}</option>)}</select><input type="number" value={logicDraft.lag_days} onChange={event => setLogicDraft(value => ({ ...value, lag_days: event.target.value }))} className="border rounded-lg px-2 py-2 text-sm" /><button disabled={immutable} className="bg-violet-600 text-white rounded-lg px-3 text-sm font-semibold disabled:opacity-40">Add Tie</button></form><div className="divide-y divide-slate-100 border rounded-xl">{workspace?.relationships?.map(link => { const pred = workspace.activities.find(row => row.id === link.predecessor); const succ = workspace.activities.find(row => row.id === link.successor); return <div key={link.id} className="flex items-center gap-3 px-4 py-3 text-sm"><span className="font-mono text-slate-700">{pred?.external_id}</span><span className="rounded bg-blue-50 text-blue-700 px-2 py-0.5 font-semibold">{link.relationship_type}{Number(link.lag_days) ? ` ${Number(link.lag_days) > 0 ? '+' : ''}${link.lag_days}d` : ''}</span><span className="font-mono text-slate-700">{succ?.external_id}</span><span className="text-slate-400 truncate">{pred?.name} to {succ?.name}</span><button disabled={immutable} onClick={() => runAction('delete-logic', () => planningIntelligenceService.deleteRelationship(link.id), 'Relationship removed.')} className="ml-auto text-slate-300 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button></div> })}</div></div>}

          {tab === 'resources' && <PlanningResourcePlan projectId={projectId} versionId={versionId} readOnly={immutable} onChanged={() => refreshWorkspacePreservingDraft()} />}
          {tab === 'risks' && <PlanningRiskRegister projectId={projectId} versionId={versionId} readOnly={immutable} onChanged={() => refreshWorkspacePreservingDraft()} />}
          {tab === 'reports' && <PlanningOperationalControls key={projectId} projectId={projectId} readOnly={!workspace?.can_control} />}
          {tab === 'delay' && <PlanningDelayAnalysis key={projectId} projectId={projectId} readOnly={!workspace?.can_control} />}
          {tab === 'performance' && performancePanel && <div className="pw-performance">{typeof performancePanel === 'function' ? performancePanel({ scheduleId: Number(scheduleId), versionId: Number(versionId), onOpenActivities: () => selectTab('activities') }) : performancePanel}</div>}

          {tab === 'controls' && <ProjectControlsPanel versionId={versionId} canEdit={workspace?.can_control} canBudget={workspace?.can_edit} resources={workspace?.resources} assignments={workspace?.assignments} onWorkspaceRefresh={() => refreshWorkspacePreservingDraft()} onNotice={showControlsNotice} />}

          {tab === 'assurance' && <TrustworthySchedulingPanel assurance={workspace?.schedule_assurance} versionStatus={workspace?.version?.status} busy={['assurance', 'approve-assurance'].includes(busy) || ['queued', 'running'].includes(scheduleJob?.status)} canControl={workspace?.can_control} onRun={() => runAction('assurance', () => runScheduleJob(() => planningIntelligenceService.runScheduleAssurance(versionId)), 'Phase 3 schedule assurance completed.')} onApprove={() => runAction('approve-assurance', () => planningIntelligenceService.approveScheduleAssurance(versionId), 'Phase 3 schedule assurance approved.')} />}

          {tab === 'governance' && <GovernancePanel projectId={projectId} versionId={versionId} versionStatus={workspace?.version?.status} activities={workspace?.activities} onWorkspaceRefresh={() => refreshWorkspacePreservingDraft()} onNotice={showControlsNotice} />}

          {tab === 'integrations' && <IntegrationsExportsPanel projectId={projectId} projectName={workspace?.project?.name || project?.name} scheduleCode={workspace?.schedule?.code} versionId={versionId} versionNumber={workspace?.version?.version} canManage={workspace?.can_control} onNotice={showControlsNotice} />}

          {tab === 'enterprise' && <EnterpriseReadinessPanel projectId={projectId} projectName={workspace?.project?.name || project?.name} canManage={workspace?.can_control} onNotice={showControlsNotice} />}

          {tab === 'evidence' && <div className="p-4 grid lg:grid-cols-[1fr_1.4fr] gap-4"><div><h3 className="font-semibold text-slate-800 mb-2">Open conflicts</h3>{!conflicts.length && <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-700">No open evidence conflicts.</div>}{conflicts.map(conflict => <div key={conflict.id} className="border border-amber-200 bg-amber-50 rounded-xl p-4 mb-3"><div className="font-semibold text-amber-900">{conflict.description}</div><div className="mt-3 space-y-2">{(conflict.facts || []).map(fact => <button key={fact.id} onClick={() => resolveConflict(conflict, fact.id)} className="w-full text-left rounded-lg bg-white border border-amber-200 hover:border-violet-400 p-3"><div className="flex justify-between gap-2"><b className="text-sm text-slate-800">{typeof fact.value === 'object' ? JSON.stringify(fact.value) : String(fact.value)}</b><span className="text-xs text-slate-400">{Math.round(fact.confidence * 100)}%</span></div><div className="text-xs text-slate-500 mt-1">{fact.source_filename || fact.extraction_method} · line {fact.source_locator?.line || '-'}</div><div className="text-xs text-slate-400 mt-1 line-clamp-2">{fact.source_excerpt}</div></button>)}</div></div>)}</div><div><h3 className="font-semibold text-slate-800 mb-2">Extracted facts</h3><div className="border rounded-xl divide-y max-h-[60vh] overflow-auto">{facts.map(fact => <div key={fact.id} className="p-3 text-sm"><div className="flex items-center gap-2"><span className="rounded bg-slate-100 text-slate-600 px-2 py-0.5 text-xs">{fact.fact_type.replaceAll('_', ' ')}</span><b className="text-slate-800 truncate">{typeof fact.value === 'object' ? JSON.stringify(fact.value) : String(fact.value)}</b><span className="ml-auto text-xs text-slate-400">{Math.round(fact.confidence * 100)}%</span></div><div className="text-xs text-slate-400 mt-1">{fact.source_filename || fact.extraction_method} · {fact.status}</div></div>)}</div></div></div>}
          </>}
        </section>
      </main>
    </div>
  )
}

PlannerWorkspacePage.propTypes = {
  embedded: PropTypes.bool,
  planningProjectId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  initialScheduleId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  initialVersionId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  initialGenerationId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  initialAnalysisRunId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  initialTab: PropTypes.string,
  onBack: PropTypes.func,
  onOpenGenerationWizard: PropTypes.func,
  onOpenDocumentStep: PropTypes.func,
  performancePanel: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
  onSelectionChange: PropTypes.func,
  onWorkspaceChanged: PropTypes.func,
  onTabChange: PropTypes.func,
  onDirtyChange: PropTypes.func,
  compactHeader: PropTypes.bool,
  headerContainer: PropTypes.object,
  workspaceActive: PropTypes.bool,
}

export default PlannerWorkspacePage
