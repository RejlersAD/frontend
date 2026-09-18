import { radaiConfirm } from '../../services/radaiDialog'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { PlusIcon, SparklesIcon } from '@heroicons/react/24/outline'

import {
  PROJECT_VIEW_MODES, PROJECT_DEFAULT_VIEW, PROJECT_COPY,
} from '../../config/projectControl.config'
import * as PC from '../../services/projectControl.service'
import { useNavigate, useSearchParams } from 'react-router-dom'

import ProjectControlHeader from './components/ProjectControlHeader'
import PhaseStubCard from './components/PhaseStubCard'
import ProjectFormModal from './components/ProjectFormModal'
import QhseImportModal from './components/QhseImportModal'
import ProjectDashboardTab from './tabs/ProjectDashboardTab'
import CostDashboardTab from './tabs/CostDashboardTab'
import CommercialDashboardTab, { downloadCommercialCsv } from './tabs/CommercialDashboardTab'
import MilestoneControlTab, { downloadMilestoneCsv } from './tabs/MilestoneControlTab'
import EstimatesTab, { downloadEstimateCsv } from './tabs/EstimatesTab'
import useEstimateControl from './useEstimateControl'
import DocumentsTab, { downloadDocumentRegisterCsv } from './tabs/DocumentsTab'
import useDocumentControl from './useDocumentControl'
import TakeoffTab from './tabs/TakeoffTab'
import EVMTab from './tabs/EVMTab'
import RiskChangeControlTab, { downloadRiskRegisterCsv } from './tabs/RiskChangeControlTab'
import useRiskChangeControl from './useRiskChangeControl'
import PlanBaselineTab, { downloadScheduleCsv } from './tabs/PlanBaselineTab'
import ControlsPeriodsTab from './tabs/ControlsPeriodsTab'
import EPCLifecycleTab from './tabs/EPCLifecycleTab'
import PortfolioExceptionsTab from './tabs/PortfolioExceptionsTab'
import Notification from '../../components/ui/Notification'
import useProjectPerformance from './useProjectPerformance'
import useSchedulePerformance from './useSchedulePerformance'
import useCommercialPerformance from './useCommercialPerformance'
import useMilestoneControl from './useMilestoneControl'
import ProjectPerformanceDialogs from './components/ProjectPerformanceDialogs'
import './ProjectPerformance.css'
import './SchedulePerformance.css'
import './CommercialPerformance.css'
import './MilestoneControl.css'
import './RiskChangeControl.css'
import './EstimateControl.css'
import './DocumentControl.css'
import './ProjectPlanningHeader.css'

const loadProjectList = async () => {
  const projects = []
  let page = 1
  let next = true
  while (next) {
    const data = await PC.listProjects({ page, page_size: 100 })
    projects.push(...(Array.isArray(data) ? data : data?.results || []))
    next = Boolean(data?.next)
    page += 1
  }
  return projects
}

const TAB_COMPONENTS = {
  'project-dashboard': ProjectDashboardTab,
  'plan-baseline':     PlanBaselineTab,
  'controls-periods':  ControlsPeriodsTab,
  'epc-lifecycle': EPCLifecycleTab,
  'portfolio-exceptions': PortfolioExceptionsTab,
  'cost-dashboard':    CostDashboardTab,
  'commercial-dashboard': CommercialDashboardTab,
  'milestones':           MilestoneControlTab,
  'estimates':         EstimatesTab,
  'documents':         DocumentsTab,
  'ai-takeoff':        TakeoffTab,
  'evm':               EVMTab,
  'risk':              RiskChangeControlTab,
}

export default function ProjectsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState(() => searchParams.get('project'))
  const [phaseFlags, setPhaseFlags] = useState({})
  const [view, setView] = useState(PROJECT_DEFAULT_VIEW)
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [loadingFlags, setLoadingFlags] = useState(true)
  const [error, setError] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState('create')
  const [editingProject, setEditingProject] = useState(null)
  const [toast, setToast] = useState(null)
  const [qhseImportOpen, setQhseImportOpen] = useState(false)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [lastRefreshed, setLastRefreshed] = useState(null)
  const [overviewDialog, setOverviewDialog] = useState(null)
  const [milestoneDialog, setMilestoneDialog] = useState(null)
  const [riskDialog, setRiskDialog] = useState(null)
  const [estimateDialog, setEstimateDialog] = useState(null)
  const [documentDialog, setDocumentDialog] = useState(null)
  const [documentId, setDocumentId] = useState(null)
  const [estimateId, setEstimateId] = useState(null)
  const [compareEstimateId, setCompareEstimateId] = useState(null)
  const [scheduleBaselineId, setScheduleBaselineId] = useState('')
  const [scheduleVersionId, setScheduleVersionId] = useState('')
  const scheduleMode = searchParams.get('scheduleMode') === 'planner' ? 'planner' : 'management'
  const commercialMode = searchParams.get('commercialMode') === 'controls' ? 'controls' : 'management'

  const reloadProjects = useCallback(async ({ selectId } = {}) => {
    setLoadingProjects(true)
    try {
      const list = await loadProjectList()
      setProjects(list)
      if (selectId) {
        setSelectedProjectId(selectId)
        const nextParams = new URLSearchParams(searchParams)
        nextParams.set('project', selectId)
        setSearchParams(nextParams, { replace: true })
      } else if (list.length && !list.find((p) => String(p.id) === String(selectedProjectId))) {
        setSelectedProjectId(list[0].id)
      } else if (!list.length) {
        setSelectedProjectId(null)
      }
      setError(null)
      setRefreshVersion(value => value + 1)
    } catch (e) {
      setError(e?.message || 'Failed to load projects')
    } finally {
      setLoadingProjects(false)
    }
  }, [selectedProjectId, searchParams, setSearchParams])

  // Initial load: projects + phase flags in parallel
  useEffect(() => {
    let cancelled = false
    setLoadingProjects(true)
    setLoadingFlags(true)
    setError(null)

    Promise.allSettled([loadProjectList(), PC.getPhaseFlags()])
      .then(([projectsRes, flagsRes]) => {
        if (cancelled) return
        if (projectsRes.status === 'fulfilled') {
          const data = projectsRes.value
          const list = Array.isArray(data) ? data : (data?.results || [])
          setProjects(list)
          if (list.length && !selectedProjectId) setSelectedProjectId(list[0].id)
        } else {
          setError(projectsRes.reason?.message || 'Failed to load projects')
        }
        if (flagsRes.status === 'fulfilled') {
          setPhaseFlags(flagsRes.value?.phase_flags || {})
        }
      })
      .finally(() => {
        if (cancelled) return
        setLoadingProjects(false)
        setLoadingFlags(false)
      })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The portfolio endpoint returns a compact row. Hydrate the selected project
  // so the overview and header receive the complete controlled record.
  useEffect(() => {
    if (!selectedProjectId) return
    let cancelled = false
    PC.getProject(selectedProjectId)
      .then((detail) => {
        if (cancelled) return
        setProjects((current) => current.map((project) => (
          String(project.id) === String(selectedProjectId) ? { ...project, ...detail } : project
        )))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [selectedProjectId, refreshVersion])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const handleOpenCreate = () => {
    setFormMode('create')
    setEditingProject(null)
    setFormOpen(true)
  }
  const handleOpenEdit = () => {
    if (!selectedProject) return
    setFormMode('edit')
    setEditingProject(selectedProject)
    setFormOpen(true)
  }
  const handleSubmitForm = async (payload) => {
    if (formMode === 'edit' && editingProject) {
      const updated = await PC.updateProject(editingProject.id, payload)
      setToast({ type: 'success', message: `Updated “${updated.name || payload.name}”.` })
      await reloadProjects({ selectId: editingProject.id })
    } else {
      const created = await PC.createProject(payload)
      setToast({ type: 'success', message: `Created project “${created.name || payload.name}”.` })
      await reloadProjects({ selectId: created.id })
    }
  }
  const handleDelete = async () => {
    if (!selectedProject) return
    if (!(await radaiConfirm(PROJECT_COPY.deleteConfirm(selectedProject.name)))) return
    try {
      await PC.deleteProject(selectedProject.id)
      setToast({ type: 'success', message: `Deleted “${selectedProject.name}”.` })
      await reloadProjects({ selectId: null })
    } catch (e) {
      setToast({ type: 'error', message: e?.message || 'Delete failed.' })
    }
  }

  const selectedProject = useMemo(
    () => projects.find((p) => String(p.id) === String(selectedProjectId)) || null,
    [projects, selectedProjectId]
  )
  const performance = useProjectPerformance(selectedProject, refreshVersion)
  const schedulePerformance = useSchedulePerformance(selectedProject, performance, refreshVersion, {
    enabled: view === 'plan-baseline' || view === 'milestones' || view === 'risk', baselineId: scheduleBaselineId, versionId: scheduleVersionId,
  })
  const commercialPerformance = useCommercialPerformance(selectedProject, performance, refreshVersion, {
    enabled: view === 'commercial-dashboard',
  })
  const milestoneControl = useMilestoneControl(selectedProject, performance, schedulePerformance, { enabled: view === 'milestones' })
  const riskControl = useRiskChangeControl(selectedProject, performance, schedulePerformance, { enabled: view === 'risk' })
  const estimateControl = useEstimateControl(selectedProject, refreshVersion, { enabled: view === 'estimates', estimateId, compareId: compareEstimateId })
  const documentControl = useDocumentControl(selectedProject, refreshVersion, { enabled: view === 'documents', documentId })
  useEffect(() => { setMilestoneDialog(null); setRiskDialog(null); setEstimateDialog(null); setEstimateId(null); setCompareEstimateId(null); setDocumentDialog(null); setDocumentId(null) }, [selectedProjectId])
  useEffect(() => { setScheduleBaselineId(''); setScheduleVersionId('') }, [selectedProjectId])
  useEffect(() => {
    if (selectedProject && !performance.loading && performance.model) setLastRefreshed(new Date().toISOString())
  }, [selectedProject, performance.loading, performance.model])
  useEffect(() => { setOverviewDialog(null); setLastRefreshed(null) }, [selectedProjectId])

  const handleSelectProject = useCallback(id => {
    setSelectedProjectId(id)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('project', id)
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    const requested = searchParams.get('project')
    if (requested && String(selectedProjectId) !== requested) setSelectedProjectId(requested)
  }, [searchParams, selectedProjectId])

  const handleSelectView = useCallback((nextView) => {
    if (view === 'project-dashboard' && ['risk', 'plan-baseline'].includes(nextView)) setScheduleVersionId('')
    setView(nextView)
    const nextParams = new URLSearchParams(searchParams)
    if (nextView === PROJECT_DEFAULT_VIEW) nextParams.delete('view')
    else nextParams.set('view', nextView)
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams, view])

  const handleScheduleMode = nextMode => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('view', 'plan-baseline')
    if (nextMode === 'planner') nextParams.set('scheduleMode', 'planner')
    else nextParams.delete('scheduleMode')
    setSearchParams(nextParams, { replace: true })
    if (nextMode !== 'planner') schedulePerformance.reload()
  }

  const handleCommercialMode = nextMode => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('view', 'commercial-dashboard')
    if (nextMode === 'controls') nextParams.set('commercialMode', 'controls')
    else nextParams.delete('commercialMode')
    setSearchParams(nextParams, { replace: true })
    if (nextMode !== 'controls') {
      commercialPerformance.reload()
    }
  }

  useEffect(() => {
    const requestedView = searchParams.get('view')
    if (PROJECT_VIEW_MODES.some((mode) => mode.key === requestedView)) {
      setView(requestedView)
    } else if (!requestedView) {
      setView(PROJECT_DEFAULT_VIEW)
    }
  }, [searchParams])

  const ActiveTab = TAB_COMPONENTS[view] || CostDashboardTab
  const activeMode = PROJECT_VIEW_MODES.find((m) => m.key === view)
  const isActiveFlagOn = activeMode ? phaseFlags[activeMode.phaseFlag] !== false : true
  const handlePerformanceAction = nextView => {
    if (nextView === 'edit-project') handleOpenEdit()
    else if (['actions', 'activity', 'data-quality', 'reporting-source'].includes(nextView)) setOverviewDialog(nextView)
    else handleSelectView(nextView || PROJECT_DEFAULT_VIEW)
  }

  return (
    <div className={`project-control-workspace project-performance-workspace${view === 'plan-baseline' ? ` pp-schedule-workspace${scheduleMode === 'planner' ? ' pp-planning-workspace' : ''}` : view === 'commercial-dashboard' ? ' pp-commercial-workspace' : view === 'milestones' ? ' pp-milestone-workspace' : view === 'risk' ? ' pp-risk-workspace' : view === 'estimates' ? ' pp-estimate-workspace' : view === 'documents' ? ' pp-document-workspace' : ''}`}>
      <ProjectControlHeader
        projects={projects}
        selectedProject={selectedProject}
        selectedProjectId={selectedProjectId}
        onSelectProject={handleSelectProject}
        loading={loadingProjects}
        error={error}
        phaseFlags={phaseFlags}
        activeView={view}
        scheduleMode={scheduleMode}
        onSelectView={handleSelectView}
        onNavigate={navigate}
        onCreate={handleOpenCreate}
        onEdit={handleOpenEdit}
        onImport={() => setQhseImportOpen(true)}
        onArchive={handleDelete}
        onRefresh={async () => {
          await reloadProjects({ selectId: selectedProjectId })
          setToast({ type: 'success', message: 'Project data refreshed.' })
        }}
        onExport={() => view === 'documents' ? downloadDocumentRegisterCsv(documentControl.model, selectedProject) : view === 'estimates' ? downloadEstimateCsv(estimateControl.model, selectedProject) : view === 'risk' ? downloadRiskRegisterCsv(riskControl.model, selectedProject) : view === 'plan-baseline' ? downloadScheduleCsv(schedulePerformance.model, selectedProject) : view === 'commercial-dashboard' ? downloadCommercialCsv(commercialPerformance.model, selectedProject) : view === 'milestones' ? downloadMilestoneCsv(milestoneControl.model, selectedProject) : window.print()}
        performance={performance}
        schedulePerformance={schedulePerformance}
        onUpdateSchedule={() => handleScheduleMode('planner')}
        commercialPerformance={commercialPerformance}
        onUpdateCommercial={() => handleCommercialMode('controls')}
        milestoneControl={milestoneControl}
        onAddMilestone={() => setMilestoneDialog({ type: 'create' })}
        documentControl={documentControl}
        onAddDocument={() => setDocumentDialog({ type: 'create' })}
        estimateControl={estimateControl}
        onNewEstimate={type => setEstimateDialog({ type })}
        riskControl={riskControl}
        onAddRiskRecord={itemType => setRiskDialog({ type: 'create', itemType })}
        lastRefreshed={lastRefreshed}
        onOpenDialog={setOverviewDialog}
      />

      {/* Body */}
      <div className="pp-body">
        {loadingProjects || loadingFlags ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
            {PROJECT_COPY.loadingProjects}
          </div>
        ) : !projects.length ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <div className="mx-auto inline-flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-md shadow-indigo-500/20">
              <SparklesIcon className="h-6 w-6" />
            </div>
            <p className="mt-3 text-slate-500">{PROJECT_COPY.noProjects}</p>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="group mt-4 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-lg bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 hover:from-indigo-500 hover:via-violet-500 hover:to-fuchsia-500 shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-violet-500/30 transition-all"
            >
              <PlusIcon className="h-4 w-4 transition-transform group-hover:rotate-90" />
              {PROJECT_COPY.newProject}
            </button>
          </div>
        ) : !selectedProject ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
            {PROJECT_COPY.selectorPlaceholder}
          </div>
        ) : !isActiveFlagOn ? (
          <PhaseStubCard mode={activeMode} />
        ) : (
          <ActiveTab
            key={['milestones', 'risk', 'estimates', 'documents', 'epc-lifecycle'].includes(view) ? selectedProject.id : undefined}
            project={selectedProject}
            projects={projects}
            phaseFlags={phaseFlags}
            onSelectView={handleSelectView}
            onSelectProject={handleSelectProject}
            onNavigate={navigate}
            onEdit={handleOpenEdit}
            onProjectUpdated={async () => {
              const detail = await PC.getProject(selectedProject.id)
              setProjects(current => current.map(row => String(row.id) === String(selectedProject.id) ? { ...row, ...detail } : row))
              setRefreshVersion(value => value + 1)
            }}
            onOpenDocument={id => { setDocumentId(id); handleSelectView('documents') }}
            performance={performance}
            onOpenDialog={setOverviewDialog}
            schedulePerformance={schedulePerformance}
            scheduleMode={scheduleMode}
            onScheduleMode={handleScheduleMode}
            onSelectBaseline={setScheduleBaselineId}
            onSelectVersion={setScheduleVersionId}
            commercialPerformance={commercialPerformance}
            commercialMode={commercialMode}
            onCommercialMode={handleCommercialMode}
            documentControl={documentControl}
            documentDialog={documentDialog}
            onDocumentDialog={setDocumentDialog}
            onSelectDocument={setDocumentId}
            refreshVersion={refreshVersion}
            estimateControl={estimateControl}
            estimateDialog={estimateDialog}
            onEstimateDialog={setEstimateDialog}
            onSelectEstimate={setEstimateId}
            onCompareEstimate={setCompareEstimateId}
            riskControl={riskControl}
            riskDialog={riskDialog}
            onRiskDialog={setRiskDialog}
            milestoneControl={milestoneControl}
            milestoneDialog={milestoneDialog}
            onMilestoneDialog={setMilestoneDialog}
            onOpenSchedule={() => handleScheduleMode('planner')}
          />
        )}
      </div>
      {overviewDialog && selectedProject && <ProjectPerformanceDialogs key={`${selectedProject.id}:${overviewDialog}`} type={overviewDialog} model={performance.model} onClose={() => setOverviewDialog(null)} onAction={handlePerformanceAction} />}

      <ProjectFormModal
        open={formOpen}
        mode={formMode}
        project={editingProject}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmitForm}
      />

      <QhseImportModal
        open={qhseImportOpen}
        existingProjects={projects}
        onClose={() => setQhseImportOpen(false)}
        onImported={async (result) => {
          if (result?.created || result?.updated) {
            await reloadProjects({})
            setToast({
              type: result.failed ? 'error' : 'success',
              message: PROJECT_COPY.importQhseDone(result.created, result.updated, result.failed),
            })
          } else if (result?.failed) {
            setToast({ type: 'error', message: `Import failed for ${result.failed} row(s).` })
          }
        }}
      />

      {toast && (
        <Notification tone={toast.type} className="fixed bottom-6 right-6 z-50">
          {toast.message}
        </Notification>
      )}
    </div>
  )
}
