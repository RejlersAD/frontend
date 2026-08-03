import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChartBarIcon, DocumentTextIcon, FolderIcon, SparklesIcon,
  ArrowTrendingUpIcon, ShieldCheckIcon,
  PlusIcon, PencilSquareIcon, TrashIcon,
  ArrowsPointingOutIcon, ArrowsPointingInIcon,
  CloudArrowDownIcon, Squares2X2Icon,
} from '@heroicons/react/24/outline'

import {
  PROJECT_VIEW_MODES, PROJECT_DEFAULT_VIEW, PROJECT_COPY,
  PROJECT_CONTROL_SUBFEATURES,
} from '../../config/projectControl.config'
import * as PC from '../../services/projectControl.service'
import { useNavigate, useLocation } from 'react-router-dom'

import ProjectSelector from './components/ProjectSelector'
import ProjectHeaderStrip from './components/ProjectHeaderStrip'
import PhaseStubCard from './components/PhaseStubCard'
import ProjectFormModal from './components/ProjectFormModal'
import QhseImportModal from './components/QhseImportModal'
import ProjectDashboardTab from './tabs/ProjectDashboardTab'
import CostDashboardTab from './tabs/CostDashboardTab'
import EstimatesTab from './tabs/EstimatesTab'
import DocumentsTab from './tabs/DocumentsTab'
import TakeoffTab from './tabs/TakeoffTab'
import EVMTab from './tabs/EVMTab'
import RiskTab from './tabs/RiskTab'

const ICONS = {
  squares:  Squares2X2Icon,
  chart:    ChartBarIcon,
  document: DocumentTextIcon,
  folder:   FolderIcon,
  sparkles: SparklesIcon,
  trending: ArrowTrendingUpIcon,
  shield:   ShieldCheckIcon,
}

const TAB_COMPONENTS = {
  'project-dashboard': ProjectDashboardTab,
  'cost-dashboard':    CostDashboardTab,
  'estimates':         EstimatesTab,
  'documents':         DocumentsTab,
  'ai-takeoff':        TakeoffTab,
  'evm':               EVMTab,
  'risk':              RiskTab,
}

export default function ProjectsPage() {
  const navigate = useNavigate()
  const location = useLocation()
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
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [qhseImportOpen, setQhseImportOpen] = useState(false)
  const rootRef = useRef(null)

  // Fullscreen API — toggle browser fullscreen on the page root
  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current
    if (!el) return
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement
    if (!fsEl) {
      const req = el.requestFullscreen || el.webkitRequestFullscreen
      req?.call(el)
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen
      exit?.call(document)
    }
  }, [])

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement || document.webkitFullscreenElement))
    }
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
    }
  }, [])

  // Keyboard shortcut: F key toggles fullscreen (ignored while typing in inputs)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'f' && e.key !== 'F') return
      const tag = (e.target?.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      e.preventDefault()
      toggleFullscreen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleFullscreen])

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

  const ActiveTab = TAB_COMPONENTS[view] || CostDashboardTab
  const activeMode = PROJECT_VIEW_MODES.find((m) => m.key === view)
  const isActiveFlagOn = activeMode ? phaseFlags[activeMode.phaseFlag] !== false : true

  return (
    <div
      ref={rootRef}
      className={[
        'min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30',
        isFullscreen ? 'overflow-y-auto h-screen' : '',
      ].join(' ')}
    >
      {/* Header band */}
      <div className="relative bg-white border-b border-slate-200 overflow-hidden">
        {/* Decorative AI gradient glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-400/20 via-purple-400/10 to-transparent blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-gradient-to-tr from-sky-400/10 via-emerald-300/10 to-transparent blur-3xl"
        />

        <div className="relative max-w-7xl mx-auto px-6 pt-6 pb-2">
          {/* Title row */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-sm ring-1 ring-white/30">
                  <SparklesIcon className="h-5 w-5" />
                </span>
                <h1 className="text-2xl font-semibold tracking-tight bg-gradient-to-r from-slate-900 via-indigo-700 to-violet-700 bg-clip-text text-transparent">
                  Project Control
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  AI&nbsp;Assisted
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1.5 max-w-2xl">
                Cost intelligence, estimates, documents and predictive analytics — phased rollout.
              </p>
              
              {/* SOFT-CODED: Sub-features navigation */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {PROJECT_CONTROL_SUBFEATURES.filter(sf => sf.isActive).map((subFeature) => {
                  const isCurrentPage = location.pathname === subFeature.route
                  return (
                    <button
                      key={subFeature.id}
                      onClick={() => !isCurrentPage && navigate(subFeature.route)}
                      className={[
                        'group relative inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all',
                        isCurrentPage
                          ? `${subFeature.bgColor} ${subFeature.textColor} ${subFeature.borderColor} border-2 shadow-sm`
                          : `bg-white text-slate-600 border border-slate-200 ${subFeature.hoverBg} hover:border-slate-300 hover:shadow`,
                      ].join(' ')}
                      disabled={isCurrentPage}
                    >
                      <span className="text-base">{subFeature.icon}</span>
                      <span className="font-mono text-[10px] opacity-60">{subFeature.number}</span>
                      <span>{subFeature.name}</span>
                      {subFeature.isNew && subFeature.badge && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${subFeature.badgeColor}`}>
                          {subFeature.badge}
                        </span>
                      )}
                      {!isCurrentPage && (
                        <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Primary CTA — always visible, never clipped */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQhseImportOpen(true)}
                title={PROJECT_COPY.importFromQhse}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-indigo-700 bg-white/80 backdrop-blur border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 rounded-lg transition-colors whitespace-nowrap"
              >
                <CloudArrowDownIcon className="h-4 w-4" />
                <span className="hidden md:inline">{PROJECT_COPY.importFromQhse}</span>
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Exit fullscreen (F)' : 'Enter fullscreen (F)'}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                aria-pressed={isFullscreen}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-slate-700 bg-white/80 backdrop-blur border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-lg transition-colors whitespace-nowrap"
              >
                {isFullscreen
                  ? <ArrowsPointingInIcon className="h-4 w-4" />
                  : <ArrowsPointingOutIcon className="h-4 w-4" />}
                <span className="hidden md:inline">{isFullscreen ? 'Exit Full' : 'Full Screen'}</span>
              </button>
              <button
                type="button"
                onClick={handleOpenCreate}
                title={PROJECT_COPY.newProject}
                className="group inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-lg bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 hover:from-indigo-500 hover:via-violet-500 hover:to-fuchsia-500 shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-violet-500/30 transition-all whitespace-nowrap"
              >
                <PlusIcon className="h-4 w-4 transition-transform group-hover:rotate-90" />
                <span>{PROJECT_COPY.newProject}</span>
              </button>
            </div>
          </div>

          {/* Selector + secondary actions */}
          <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex-1 min-w-0 sm:max-w-md">
              <ProjectSelector
                projects={projects}
                value={selectedProjectId}
                onChange={setSelectedProjectId}
                loading={loadingProjects}
                error={error}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleOpenEdit}
                disabled={!selectedProject}
                title="Edit selected project"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white/80 backdrop-blur border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                <PencilSquareIcon className="h-4 w-4" />
                <span className="hidden md:inline">Edit</span>
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!selectedProject}
                title="Delete selected project"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-rose-600 bg-white/80 backdrop-blur border border-rose-200 hover:bg-rose-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                <TrashIcon className="h-4 w-4" />
                <span className="hidden md:inline">Delete</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="relative max-w-7xl mx-auto px-6 mt-4">
          <nav className="flex gap-1 overflow-x-auto">
            {PROJECT_VIEW_MODES.map((mode) => {
              const Icon = ICONS[mode.icon] || ChartBarIcon
              const enabled = phaseFlags[mode.phaseFlag] !== false
              const active = view === mode.key
              return (
                <button
                  key={mode.key}
                  onClick={() => setView(mode.key)}
                  className={[
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                    active
                      ? 'border-indigo-600 text-indigo-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300',
                  ].join(' ')}
                >
                  <Icon className="h-4 w-4" />
                  <span>{mode.label}</span>
                  {!enabled && mode.phaseLabel && (
                    <span className="ml-1 text-[10px] uppercase tracking-wider bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                      {mode.phaseLabel}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {selectedProject && (
          <ProjectHeaderStrip project={selectedProject} />
        )}

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
          <ActiveTab project={selectedProject} phaseFlags={phaseFlags} />
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
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded shadow-lg text-sm text-white ${
            toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
