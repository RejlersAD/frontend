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
import CommercialDashboardTab from './tabs/CommercialDashboardTab'
import EstimatesTab from './tabs/EstimatesTab'
import DocumentsTab from './tabs/DocumentsTab'
import TakeoffTab from './tabs/TakeoffTab'
import EVMTab from './tabs/EVMTab'
import RiskTab from './tabs/RiskTab'
import PlanBaselineTab from './tabs/PlanBaselineTab'
import ControlsPeriodsTab from './tabs/ControlsPeriodsTab'
import PortfolioExceptionsTab from './tabs/PortfolioExceptionsTab'
import Notification from '../../components/ui/Notification'

const TAB_COMPONENTS = {
  'project-dashboard': ProjectDashboardTab,
  'plan-baseline':     PlanBaselineTab,
  'controls-periods':  ControlsPeriodsTab,
  'portfolio-exceptions': PortfolioExceptionsTab,
  'cost-dashboard':    CostDashboardTab,
  'commercial-dashboard': CommercialDashboardTab,
  'estimates':         EstimatesTab,
  'documents':         DocumentsTab,
  'ai-takeoff':        TakeoffTab,
  'evm':               EVMTab,
  'risk':              RiskTab,
}

export default function ProjectsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState(null)
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

  const reloadProjects = useCallback(async ({ selectId } = {}) => {
    setLoadingProjects(true)
    try {
      const data = await PC.listProjects()
      const list = Array.isArray(data) ? data : (data?.results || [])
      setProjects(list)
      if (selectId) {
        setSelectedProjectId(selectId)
      } else if (list.length && !list.find((p) => String(p.id) === String(selectedProjectId))) {
        setSelectedProjectId(list[0].id)
      } else if (!list.length) {
        setSelectedProjectId(null)
      }
      setError(null)
    } catch (e) {
      setError(e?.message || 'Failed to load projects')
    } finally {
      setLoadingProjects(false)
    }
  }, [selectedProjectId])

  // Initial load: projects + phase flags in parallel
  useEffect(() => {
    let cancelled = false
    setLoadingProjects(true)
    setLoadingFlags(true)
    setError(null)

    Promise.allSettled([PC.listProjects(), PC.getPhaseFlags()])
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
  }, [selectedProjectId])

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
    if (!window.confirm(PROJECT_COPY.deleteConfirm(selectedProject.name))) return
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

  const handleSelectView = useCallback((nextView) => {
    setView(nextView)
    const nextParams = new URLSearchParams(searchParams)
    if (nextView === PROJECT_DEFAULT_VIEW) nextParams.delete('view')
    else nextParams.set('view', nextView)
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

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

  return (
    <div className="project-control-workspace min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <ProjectControlHeader
        projects={projects}
        selectedProject={selectedProject}
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
        loading={loadingProjects}
        error={error}
        phaseFlags={phaseFlags}
        activeView={view}
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
        onExport={() => window.print()}
      />

      {/* Body */}
      <div className="w-full space-y-6 px-3 py-3 sm:px-4 sm:py-4">
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
            project={selectedProject}
            projects={projects}
            phaseFlags={phaseFlags}
            onSelectView={handleSelectView}
            onSelectProject={setSelectedProjectId}
            onNavigate={navigate}
            onEdit={handleOpenEdit}
          />
        )}
      </div>

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
