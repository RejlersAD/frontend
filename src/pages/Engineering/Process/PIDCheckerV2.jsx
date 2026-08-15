import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { RefreshCw, BookOpen, FileText, Maximize2, Eraser, ArrowLeft, Layers, FolderPlus, Edit, Trash2, Clock, ChevronRight } from 'lucide-react'
import { ROUTES } from '../../../config/routes.config'

import {
  extractLineTags, listExtractions, getExtraction, deleteExtraction,
  listLegends, listLineLists, listEquipmentLists, listInstrumentIndexes,
  MODE_OCR, MODE_VISION, VISION_PROVIDERS,
} from '../../../services/pidCheckerV2API'
import { listProjects, createProject, updateProject, deleteProject, getProjectHistory } from '../../../services/pidProjectsService'
import LegendSheetsModal from './components/LegendSheetsModal'
import InputsPanel from './components/InputsPanel'
import ResultsTabs from './components/ResultsTabs'

// ═════════════════════════════════════════════════════════════════════
// P&ID Checker V2 — Line-List Extractor
// All strings, colours, and thresholds are soft-coded here.
// ═════════════════════════════════════════════════════════════════════
const PAGE_TITLE = 'P&ID Checker V2'
const PAGE_SUBTITLE = 'Extract composite pipeline line tags from any P&ID or Line-List PDF'
const DOCS_ROUTE = '/engineering/process/pid-checker-v2/docs'
const LEGENDS_CANVAS_ROUTE = '/engineering/process/pid-checker-v2/legends'
const BACK_TO_V1_LABEL = 'Back to V1'
const BACK_TO_V1_TITLE = 'Return to P&ID Verification V1 (Quality Checker)'
const DOCS_BUTTON_LABEL = 'Docs & Workflow'
const DOCS_BUTTON_TITLE = 'Open documentation and recommended workflow'
const CLEAR_BUTTON_LABEL = 'Clear All'
const CLEAR_BUTTON_TITLE = 'Clear the uploaded file and current results so you can start over'
const CLEAR_CONFIRM_MSG = 'Clear the uploaded file and current results? This does not affect saved history or legends.'
const ACCEPTED_EXTENSIONS = '.pdf'
const MAX_UPLOAD_MB = 25

const THEME_PRIMARY = '#7c3aed'
const THEME_ACCENT = '#ec4899'
const THEME_TEXT = '#0f172a'
const THEME_MUTED = '#64748b'
const THEME_BORDER = '#e2e8f0'
const THEME_BG_SOFT = '#f8fafc'
const THEME_GRADIENT = `linear-gradient(135deg, ${THEME_PRIMARY} 0%, ${THEME_ACCENT} 100%)`

// Two-column workspace geometry (soft-coded)
const PAGE_MAX_WIDTH = 1440
const LEFT_COL_WIDTH = 460
const LAYOUT_BREAKPOINT_PX = 960
// Offset for the app's fixed top navigation so the page header doesn't overlap it
const TOP_NAV_OFFSET_PX = 64

const CSV_HEADER = ['tag', 'size', 'service', 'spec', 'serial', 'service_group']

// BYOK — sessionStorage keys (cleared when the browser tab closes)
const SS_KEY_PROVIDER = 'radai_pidv2_byok_provider'
const SS_KEY_APIKEY   = 'radai_pidv2_byok_apikey'
const SS_KEY_REMEMBER = 'radai_pidv2_byok_remember'


function toCsv(tags) {
  const rows = [CSV_HEADER.join(',')]
  for (const t of tags) {
    rows.push(CSV_HEADER.map((k) => `"${String(t[k] ?? '').replace(/"/g, '""')}"`).join(','))
  }
  return rows.join('\n')
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}


export default function PIDCheckerV2() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const [result, setResult] = useState(null) // { filename, tags, summary }
  const [error, setError] = useState(null)
  const [forceOcr, setForceOcr] = useState(false)

  // ── Mode + BYOK (Bring Your Own Key) ──────────────────────────────
  const [mode, setMode] = useState(MODE_OCR)
  const [visionProvider, setVisionProvider] = useState(
    () => sessionStorage.getItem(SS_KEY_PROVIDER) || VISION_PROVIDERS[0].id
  )
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem(SS_KEY_APIKEY) || '')
  const [showKey, setShowKey] = useState(false)
  const [rememberKey, setRememberKey] = useState(
    () => sessionStorage.getItem(SS_KEY_REMEMBER) === '1'
  )

  // ── History (auto-saved extractions) ──────────────────────────────
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // ── Project Management (Shared with V1) ───────────────────────────
  // IMPORTANT: V1 and V2 share the same projects, so users can switch between
  // versions seamlessly without losing context or duplicating setup.
  const [projects, setProjects] = useState([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [selectedProject, setSelectedProject] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDesc, setNewProjectDesc] = useState('')
  const [editingProject, setEditingProject] = useState(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [deletingProject, setDeletingProject] = useState(null)
  const [creatingProject, setCreatingProject] = useState(false)
  const [updatingProject, setUpdatingProject] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // ── Legend Sheets ─────────────────────────────────────────────────
  // IMPORTANT: V1 and V2 share the same legend section ('line_list'), so legends are 
  // synchronized across both versions. Any legend created in V1 is available in V2 and vice versa.
  const LEGEND_SECTION = 'line_list'
  const [legendModalOpen, setLegendModalOpen] = useState(false)
  const [activeLegend, setActiveLegend] = useState(null)
  const [effectiveLegend, setEffectiveLegend] = useState(null) // active OR most-recent

  // ── Master Line List (Excel) ──────────────────────────────────────
  const [activeLineList, setActiveLineList] = useState(null)

  const refreshLineList = useCallback(async () => {
    try {
      const rows = await listLineLists()
      const list = Array.isArray(rows) ? rows : (rows?.results || [])
      setActiveLineList(list.find(r => r.is_active) || null)
    } catch (err) {
      console.warn('[PIDCheckerV2] line list fetch failed', err)
    }
  }, [])
  // ── Master Equipment List (Excel) ─────────────────────────
  const [activeEquipmentList, setActiveEquipmentList] = useState(null)

  const refreshEquipmentList = useCallback(async () => {
    try {
      const rows = await listEquipmentLists()
      const list = Array.isArray(rows) ? rows : (rows?.results || [])
      setActiveEquipmentList(list.find(r => r.is_active) || null)
    } catch (err) {
      console.warn('[PIDCheckerV2] equipment list fetch failed', err)
    }
  }, [])
  // ── Master Instrument Index (Excel) ─────────────────
  const [activeInstrumentIndex, setActiveInstrumentIndex] = useState(null)

  const refreshInstrumentIndex = useCallback(async () => {
    try {
      const rows = await listInstrumentIndexes()
      const list = Array.isArray(rows) ? rows : (rows?.results || [])
      setActiveInstrumentIndex(list.find(r => r.is_active) || null)
    } catch (err) {
      console.warn('[PIDCheckerV2] instrument index fetch failed', err)
    }
  }, [])

  // ── Project Management Functions ──────────────────────────────────
  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true)
    try {
      const data = await listProjects()
      setProjects(data)
    } catch (err) {
      toast.error('Failed to load projects')
      console.error('[PIDCheckerV2] fetchProjects error:', err)
    } finally {
      setLoadingProjects(false)
    }
  }, [])

  const handleCreateProject = useCallback(async (e) => {
    e?.preventDefault?.()
    if (!newProjectName.trim()) return
    setCreatingProject(true)
    try {
      const project = await createProject(newProjectName, newProjectDesc)
      setProjects(prev => [project, ...prev])
      setShowCreateModal(false)
      setNewProjectName('')
      setNewProjectDesc('')
      toast.success(`Project "${project.project_name}" created`)
    } catch (err) {
      toast.error(err.response?.data?.project_name?.[0] || 'Failed to create project')
      console.error('[PIDCheckerV2] createProject error:', err)
    } finally {
      setCreatingProject(false)
    }
  }, [newProjectName, newProjectDesc])

  const handleUpdateProject = useCallback(async (e) => {
    e?.preventDefault?.()
    if (!editName.trim() || !editingProject) return
    setUpdatingProject(true)
    try {
      const updated = await updateProject(editingProject.project_id, editName, editDesc)
      setProjects(prev => prev.map(p => p.project_id === editingProject.project_id ? updated : p))
      if (selectedProject?.project_id === editingProject.project_id) {
        setSelectedProject(updated)
      }
      setShowEditModal(false)
      toast.success('Project updated')
    } catch (err) {
      toast.error('Failed to update project')
      console.error('[PIDCheckerV2] updateProject error:', err)
    } finally {
      setUpdatingProject(false)
    }
  }, [editName, editDesc, editingProject, selectedProject])

  const confirmDelete = useCallback(async () => {
    if (!deletingProject) return
    setIsDeleting(true)
    try {
      await deleteProject(deletingProject.project_id)
      setProjects(prev => prev.filter(p => p.project_id !== deletingProject.project_id))
      if (selectedProject?.project_id === deletingProject.project_id) {
        setSelectedProject(null)
      }
      setShowDeleteConfirm(false)
      toast.success('Project deleted')
    } catch (err) {
      toast.error('Failed to delete project')
      console.error('[PIDCheckerV2] deleteProject error:', err)
    } finally {
      setIsDeleting(false)
    }
  }, [deletingProject, selectedProject])

  const handleSelectProject = useCallback((project) => {
    setSelectedProject(project)
    setFile(null)
    setResult(null)
    setError(null)
    setHistory([])
    // Fetch project-specific history
    getProjectHistory(project.project_id)
      .then(data => setHistory(data))
      .catch(err => console.warn('[PIDCheckerV2] Failed to load project history:', err))
  }, [])

  const handleBackToProjects = useCallback(() => {
    setSelectedProject(null)
    setFile(null)
    setResult(null)
    setError(null)
    setHistory([])
  }, [])

  const refreshActiveLegend = useCallback(async () => {
    try {
      const rows = await listLegends(LEGEND_SECTION)
      const list = rows || []
      const active = list.find(l => l.is_active) || null
      setActiveLegend(active)
      // "Effective" = what the backend will actually compare against.
      // Falls back to the most-recently-updated legend when nothing is active.
      const latest = list.slice().sort((a, b) =>
        String(b.updated_at || '').localeCompare(String(a.updated_at || ''))
      )[0] || null
      setEffectiveLegend(active || latest)
    } catch {
      // silent — auxiliary
    }
  }, [])

  useEffect(() => { refreshActiveLegend() }, [refreshActiveLegend])
  useEffect(() => { refreshLineList() }, [refreshLineList])
  useEffect(() => { refreshEquipmentList() }, [refreshEquipmentList])
  useEffect(() => { refreshInstrumentIndex() }, [refreshInstrumentIndex])
  useEffect(() => { fetchProjects() }, [fetchProjects])

  const refreshHistory = useCallback(async () => {
    // Only fetch global history when no project is selected
    // When a project is selected, history is project-specific
    if (selectedProject) return
    
    setHistoryLoading(true)
    try {
      const rows = await listExtractions()
      setHistory(Array.isArray(rows) ? rows : (rows?.results || []))
    } catch (err) {
      // silent — history is auxiliary
      console.warn('[PIDCheckerV2] history fetch failed', err)
    } finally {
      setHistoryLoading(false)
    }
  }, [selectedProject])

  useEffect(() => { refreshHistory() }, [refreshHistory])

  const onPickFile = useCallback((e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please choose a PDF file')
      return
    }
    if (f.size > MAX_UPLOAD_MB * 1024 * 1024) {
      toast.error(`File exceeds ${MAX_UPLOAD_MB} MB limit`)
      return
    }
    setFile(f)
    setResult(null)
    setError(null)
  }, [])

  const onExtract = useCallback(async () => {
    if (!file) {
      toast.warn('Choose a PDF first')
      return
    }
    if (mode === MODE_VISION && !apiKey.trim()) {
      toast.warn('Paste your AI API key to use Vision mode')
      return
    }
    // Persist / clear BYOK preference (sessionStorage only — cleared on tab close)
    if (mode === MODE_VISION && rememberKey) {
      sessionStorage.setItem(SS_KEY_PROVIDER, visionProvider)
      sessionStorage.setItem(SS_KEY_APIKEY, apiKey)
      sessionStorage.setItem(SS_KEY_REMEMBER, '1')
    } else {
      sessionStorage.removeItem(SS_KEY_APIKEY)
      sessionStorage.removeItem(SS_KEY_REMEMBER)
    }

    setLoading(true)
    setError(null)
    setUploadPct(0)
    try {
      const data = await extractLineTags(file, {
        mode,
        forceOcr,
        provider: visionProvider,
        apiKey: apiKey.trim(),
        projectId: selectedProject?.project_id,
        onProgress: setUploadPct,
      })
      setResult(data)
      toast.success(`Extracted ${data?.tags?.length ?? 0} line tag(s)`)
      refreshHistory()   // auto-saved on server — refresh the panel
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Extraction failed'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [file, mode, forceOcr, visionProvider, apiKey, rememberKey, refreshHistory, selectedProject])

  const onReset = useCallback(() => {
    setFile(null)
    setResult(null)
    setError(null)
    setUploadPct(0)
    setForceOcr(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const onClearAll = useCallback(() => {
    if (loading) {
      toast.info('Extraction is still running — please wait for it to finish.')
      return
    }
    if (!window.confirm(CLEAR_CONFIRM_MSG)) return
    onReset()
    toast.success('Inputs cleared — ready for a new upload')
  }, [loading, onReset])

  const onLoadHistory = useCallback(async (extractionId) => {
    try {
      const data = await getExtraction(extractionId)
      // detail endpoint uses `tags` array — shape matches result
      setResult({
        extraction_id: data.extraction_id,
        filename: data.filename,
        mode: data.mode,
        provider: data.provider,
        model: data.model,
        tags: data.tags || [],
        summary: data.summary_json || {},
        created_at: data.created_at,
      })
      setError(null)
      toast.info(`Loaded ${data.tag_count} tag(s) from history`)
    } catch (err) {
      toast.error('Failed to load extraction')
    }
  }, [])

  const onDeleteHistory = useCallback(async (extractionId) => {
    if (!window.confirm('Delete this saved extraction?')) return
    try {
      await deleteExtraction(extractionId)
      // if it was the currently displayed one, clear the results card
      setResult((r) => (r?.extraction_id === extractionId ? null : r))
      refreshHistory()
      toast.success('Extraction deleted')
    } catch (err) {
      toast.error('Delete failed')
    }
  }, [refreshHistory])

  const onExportCsv = useCallback(() => {
    if (!result?.tags?.length) return
    const base = (result.filename || 'pid').replace(/\.pdf$/i, '')
    downloadBlob(toCsv(result.tags), `${base}_line_tags.csv`, 'text/csv')
  }, [result])

  const onExportJson = useCallback(() => {
    if (!result) return
    const base = (result.filename || 'pid').replace(/\.pdf$/i, '')
    downloadBlob(JSON.stringify(result, null, 2), `${base}_line_tags.json`, 'application/json')
  }, [result])

  const grouped = useMemo(() => {
    const tags = result?.tags || []
    if (!tags.length) return []
    const map = new Map()
    for (const t of tags) {
      const g = t.service_group || t.service || 'Other'
      if (!map.has(g)) map.set(g, [])
      map.get(g).push(t)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [result])

  // ═════════════════════════════════════════════════════════════════════
  // PROJECT SELECTION VIEW (when no project is selected)
  // ═════════════════════════════════════════════════════════════════════
  if (!selectedProject) {
    return (
      <div style={{
        minHeight: `calc(100vh - ${TOP_NAV_OFFSET_PX}px)`,
        marginTop: TOP_NAV_OFFSET_PX,
        background: THEME_BG_SOFT,
        padding: '24px',
      }}>
        {/* Header */}
        <div style={{
          background: '#fff',
          borderRadius: 12,
          padding: '20px 24px',
          marginBottom: 24,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          border: `1px solid ${THEME_BORDER}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: THEME_GRADIENT,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(124,58,237,0.3)',
            }}>
              <Layers size={20} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME_TEXT, margin: 0, lineHeight: 1.2 }}>
                {PAGE_TITLE}
              </h1>
              <p style={{ fontSize: 13, color: THEME_MUTED, margin: '4px 0 0', lineHeight: 1.3 }}>
                Select a project to start extracting line tags, or create a new one
              </p>
            </div>
            <button
              onClick={() => navigate(ROUTES.PID_VERIFICATION)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8,
                border: `1px solid ${THEME_PRIMARY}`,
                background: 'white',
                fontSize: 12, fontWeight: 600, color: THEME_PRIMARY,
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={14} /> Back to V1
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8,
                border: 'none',
                background: THEME_GRADIENT,
                fontSize: 12, fontWeight: 600, color: '#fff',
                cursor: 'pointer',
                boxShadow: '0 4px 10px rgba(124,58,237,0.25)',
              }}
            >
              <FolderPlus size={14} /> New Project
            </button>
          </div>
        </div>

        {/* Projects Grid */}
        {loadingProjects ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <RefreshCw size={32} color={THEME_PRIMARY} style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: 12, color: THEME_MUTED }}>Loading projects...</p>
          </div>
        ) : projects.length === 0 ? (
          <div style={{
            background: '#fff',
            borderRadius: 12,
            padding: 60,
            textAlign: 'center',
            border: `2px dashed ${THEME_BORDER}`,
          }}>
            <Layers size={48} color={THEME_MUTED} style={{ opacity: 0.5 }} />
            <h3 style={{ fontSize: 18, fontWeight: 600, color: THEME_TEXT, margin: '16px 0 8px' }}>
              No Projects Yet
            </h3>
            <p style={{ fontSize: 14, color: THEME_MUTED, marginBottom: 20 }}>
              Create your first project to organize P&ID extractions
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', borderRadius: 8,
                border: 'none',
                background: THEME_GRADIENT,
                fontSize: 13, fontWeight: 600, color: '#fff',
                cursor: 'pointer',
              }}
            >
              <FolderPlus size={16} /> Create Project
            </button>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 20,
          }}>
            {projects.map(p => (
              <div
                key={p.project_id}
                onClick={() => handleSelectProject(p)}
                style={{
                  background: '#fff',
                  borderRadius: 12,
                  padding: 20,
                  border: `1px solid ${THEME_BORDER}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(124,58,237,0.12)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.borderColor = THEME_PRIMARY
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.borderColor = THEME_BORDER
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
                    border: `1px solid ${THEME_BORDER}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Layers size={18} color={THEME_PRIMARY} />
                  </div>
                  <ChevronRight size={20} color={THEME_MUTED} />
                </div>
                <h3 style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: THEME_TEXT,
                  margin: '0 0 6px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {p.project_name}
                </h3>
                {p.description && (
                  <p style={{
                    fontSize: 12,
                    color: THEME_MUTED,
                    margin: '0 0 12px',
                    lineHeight: 1.5,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {p.description}
                  </p>
                )}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 12,
                  marginTop: 12,
                  borderTop: `1px solid ${THEME_BORDER}`,
                  fontSize: 11,
                  color: THEME_MUTED,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <FileText size={12} />
                    <span style={{ fontWeight: 500, color: THEME_TEXT }}>{p.document_count ?? 0}</span> extractions
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} />
                    {new Date(p.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      setEditingProject(p)
                      setEditName(p.project_name)
                      setEditDesc(p.description || '')
                      setShowEditModal(true)
                    }}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      padding: '6px',
                      border: `1px solid ${THEME_BORDER}`,
                      borderRadius: 6,
                      background: 'white',
                      fontSize: 11,
                      color: THEME_TEXT,
                      cursor: 'pointer',
                    }}
                  >
                    <Edit size={12} /> Edit
                  </button>
                  <button
                    onClick={() => {
                      setDeletingProject(p)
                      setShowDeleteConfirm(true)
                    }}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      padding: '6px',
                      border: '1px solid #fee2e2',
                      borderRadius: 6,
                      background: 'white',
                      fontSize: 11,
                      color: '#dc2626',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Project Modal */}
        {showCreateModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
            onClick={() => setShowCreateModal(false)}
          >
            <div
              style={{
                background: 'white',
                borderRadius: 12,
                padding: 24,
                width: '100%',
                maxWidth: 480,
                boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ fontSize: 18, fontWeight: 700, color: THEME_TEXT, marginBottom: 16 }}>
                Create New Project
              </h2>
              <form onSubmit={handleCreateProject}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: THEME_TEXT, marginBottom: 6 }}>
                    Project Name *
                  </label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="e.g., Refinery Unit 100"
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: `1px solid ${THEME_BORDER}`,
                      borderRadius: 8,
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: THEME_TEXT, marginBottom: 6 }}>
                    Description
                  </label>
                  <textarea
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    placeholder="Optional project description"
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: `1px solid ${THEME_BORDER}`,
                      borderRadius: 8,
                      fontSize: 13,
                      outline: 'none',
                      resize: 'vertical',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: `1px solid ${THEME_BORDER}`,
                      borderRadius: 8,
                      background: 'white',
                      fontSize: 13,
                      fontWeight: 600,
                      color: THEME_TEXT,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingProject}
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: 'none',
                      borderRadius: 8,
                      background: THEME_GRADIENT,
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'white',
                      cursor: creatingProject ? 'not-allowed' : 'pointer',
                      opacity: creatingProject ? 0.6 : 1,
                    }}
                  >
                    {creatingProject ? 'Creating...' : 'Create Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Project Modal */}
        {showEditModal && editingProject && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
            onClick={() => setShowEditModal(false)}
          >
            <div
              style={{
                background: 'white',
                borderRadius: 12,
                padding: 24,
                width: '100%',
                maxWidth: 480,
                boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ fontSize: 18, fontWeight: 700, color: THEME_TEXT, marginBottom: 16 }}>
                Edit Project
              </h2>
              <form onSubmit={handleUpdateProject}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: THEME_TEXT, marginBottom: 6 }}>
                    Project Name *
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: `1px solid ${THEME_BORDER}`,
                      borderRadius: 8,
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: THEME_TEXT, marginBottom: 6 }}>
                    Description
                  </label>
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: `1px solid ${THEME_BORDER}`,
                      borderRadius: 8,
                      fontSize: 13,
                      outline: 'none',
                      resize: 'vertical',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: `1px solid ${THEME_BORDER}`,
                      borderRadius: 8,
                      background: 'white',
                      fontSize: 13,
                      fontWeight: 600,
                      color: THEME_TEXT,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatingProject}
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: 'none',
                      borderRadius: 8,
                      background: THEME_GRADIENT,
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'white',
                      cursor: updatingProject ? 'not-allowed' : 'pointer',
                      opacity: updatingProject ? 0.6 : 1,
                    }}
                  >
                    {updatingProject ? 'Updating...' : 'Update Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && deletingProject && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
            onClick={() => setShowDeleteConfirm(false)}
          >
            <div
              style={{
                background: 'white',
                borderRadius: 12,
                padding: 24,
                width: '100%',
                maxWidth: 400,
                boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#dc2626', marginBottom: 12 }}>
                Delete Project?
              </h2>
              <p style={{ fontSize: 13, color: THEME_MUTED, marginBottom: 20 }}>
                Are you sure you want to delete <strong>{deletingProject.project_name}</strong>? 
                All extractions in this project will become unassigned. This action cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  style={{
                    flex: 1,
                    padding: '10px',
                    border: `1px solid ${THEME_BORDER}`,
                    borderRadius: 8,
                    background: 'white',
                    fontSize: 13,
                    fontWeight: 600,
                    color: THEME_TEXT,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  style={{
                    flex: 1,
                    padding: '10px',
                    border: 'none',
                    borderRadius: 8,
                    background: '#dc2626',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'white',
                    cursor: isDeleting ? 'not-allowed' : 'pointer',
                    opacity: isDeleting ? 0.6 : 1,
                  }}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Project'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ═════════════════════════════════════════════════════════════════════
  // MAIN EXTRACTION VIEW (when a project is selected)
  // ═════════════════════════════════════════════════════════════════════
  return (
    <div style={{
      height: `calc(100vh - ${TOP_NAV_OFFSET_PX}px)`,
      marginTop: TOP_NAV_OFFSET_PX,
      overflow: 'hidden',
      background: THEME_BG_SOFT,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* ── Compact header (fixed) ──────────────────────────────── */}
      <div style={{
        flex: '0 0 auto',
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 20px',
        background: '#fff', borderBottom: `1px solid ${THEME_BORDER}`,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8,
          background: THEME_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 10px rgba(124,58,237,0.25)',
        }}>
          <BookOpen size={16} color="#fff" />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: THEME_TEXT, lineHeight: 1.15 }}>
            {PAGE_TITLE}
          </div>
          <div style={{ fontSize: 11, color: THEME_MUTED, lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Layers size={10} />
            <span style={{ fontWeight: 600, color: THEME_PRIMARY }}>{selectedProject?.project_name}</span>
          </div>
        </div>

        {/* Back to Projects Button */}
        <button
          type="button"
          onClick={handleBackToProjects}
          title="Back to Projects"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 8,
            border: `1px solid ${THEME_BORDER}`,
            background: 'white',
            fontSize: 11, fontWeight: 600, color: THEME_TEXT,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <ArrowLeft size={12} />
          <span>Projects</span>
        </button>

        {/* Back to V1 Button - Navigate to P&ID Verification V1 (SOFT-CODED) */}
        <button
          type="button"
          onClick={() => navigate(ROUTES.PID_VERIFICATION)}
          title={BACK_TO_V1_TITLE}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 8,
            border: `1.5px solid ${THEME_PRIMARY}`,
            background: 'linear-gradient(135deg, #f8f9ff 0%, #f3f4ff 100%)',
            fontSize: 11, fontWeight: 600, color: THEME_PRIMARY,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 6px rgba(124,58,237,0.12)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 10px rgba(124,58,237,0.2)';
            e.currentTarget.style.background = THEME_PRIMARY;
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 6px rgba(124,58,237,0.12)';
            e.currentTarget.style.background = 'linear-gradient(135deg, #f8f9ff 0%, #f3f4ff 100%)';
            e.currentTarget.style.color = THEME_PRIMARY;
          }}
        >
          <ArrowLeft size={12} />
          <span>{BACK_TO_V1_LABEL}</span>
        </button>

        {/* Docs & Workflow — opens standalone documentation page */}
        <button
          type="button"
          onClick={() => navigate(DOCS_ROUTE)}
          title={DOCS_BUTTON_TITLE}
          style={{
            marginLeft: 'auto',
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 10px', borderRadius: 999,
            border: `1px solid ${THEME_BORDER}`, background: '#fff',
            fontSize: 11, color: THEME_TEXT, cursor: 'pointer',
          }}
        >
          <FileText size={12} color={THEME_PRIMARY} />
          <span style={{ color: THEME_TEXT, fontWeight: 600 }}>{DOCS_BUTTON_LABEL}</span>
        </button>

        {/* Legend status pill */}
        <button
          type="button" onClick={() => setLegendModalOpen(true)}
          title="Manage Legend Sheets (Synced with V1)"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 10px', borderRadius: 999,
            border: `1px solid ${activeLegend ? '#a7f3d0' : (effectiveLegend ? '#fcd34d' : THEME_BORDER)}`,
            background: activeLegend ? '#ecfdf5' : (effectiveLegend ? '#fffbeb' : '#fff'),
            fontSize: 11, color: THEME_TEXT, cursor: 'pointer',
          }}
        >
          <BookOpen size={12} color={activeLegend ? '#047857' : (effectiveLegend ? '#b45309' : THEME_MUTED)} />
          <span style={{ color: THEME_MUTED }}>Legend:</span>
          <b style={{
            color: activeLegend ? '#047857' : (effectiveLegend ? '#b45309' : THEME_MUTED),
            maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {activeLegend?.name || effectiveLegend?.name || 'built-in default'}
          </b>
          <span style={{ fontSize: 10, color: THEME_MUTED, marginLeft: 2 }}>🔄</span>
        </button>

        <button
          type="button"
          onClick={() => setLegendModalOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8, border: 'none',
            background: THEME_GRADIENT, color: '#fff', fontWeight: 600, fontSize: 12,
            cursor: 'pointer', boxShadow: '0 4px 10px rgba(124,58,237,0.25)',
          }}
        >
          <BookOpen size={14} /> Legend Sheets
        </button>

        <button
          type="button"
          onClick={() => navigate(`${LEGENDS_CANVAS_ROUTE}?section=${LEGEND_SECTION}`)}
          title="Open the full-page Legend Sheets canvas"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 8,
            border: `1px solid ${THEME_BORDER}`, background: '#fff',
            color: THEME_TEXT, fontWeight: 600, fontSize: 12, cursor: 'pointer',
          }}
        >
          <Maximize2 size={13} color={THEME_PRIMARY} /> Open Canvas
        </button>

        <button
          type="button"
          onClick={onClearAll}
          disabled={loading}
          title={CLEAR_BUTTON_TITLE}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 8,
            border: `1px solid ${THEME_BORDER}`,
            background: loading ? '#f1f5f9' : '#fff',
            color: loading ? THEME_MUTED : '#b91c1c',
            fontWeight: 600, fontSize: 12,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          <Eraser size={13} /> {CLEAR_BUTTON_LABEL}
        </button>
      </div>

      {/* ── Two-column workspace (fills remaining viewport) ─────── */}
      <div className="pidcv2-workspace" style={{
        flex: '1 1 auto', minHeight: 0,
        display: 'grid',
        gridTemplateColumns: `${LEFT_COL_WIDTH}px 1fr`,
        gap: 16, padding: 16,
        overflow: 'hidden',
      }}>
        {/* ── Left column: inputs (scrolls internally if needed) ── */}
        <div className="pidcv2-left" style={{
          minHeight: 0, overflow: 'auto', paddingRight: 4,
        }}>
          <InputsPanel
            fileInputRef={fileInputRef}
            file={file}
            onPickFile={onPickFile}
            activeLineList={activeLineList}
            onLineListUploaded={refreshLineList}
            activeEquipmentList={activeEquipmentList}
            onEquipmentListUploaded={refreshEquipmentList}
            activeInstrumentIndex={activeInstrumentIndex}
            onInstrumentIndexUploaded={refreshInstrumentIndex}
            mode={mode}
            setMode={setMode}
            forceOcr={forceOcr}
            setForceOcr={setForceOcr}
            visionProvider={visionProvider}
            setVisionProvider={setVisionProvider}
            apiKey={apiKey}
            setApiKey={setApiKey}
            showKey={showKey}
            setShowKey={setShowKey}
            rememberKey={rememberKey}
            setRememberKey={setRememberKey}
            onSubmit={onExtract}
            loading={loading}
            uploadPct={uploadPct}
            activeLegend={activeLegend}
            effectiveLegend={effectiveLegend}
          />
          {loading && uploadPct >= 100 && (
            <p style={{ marginTop: 10, color: THEME_MUTED, fontSize: 12 }}>
              Upload complete — server is running {mode === MODE_VISION ? 'AI Vision extraction' : 'OCR'}.
              This can take {mode === MODE_VISION ? '1–2 minutes' : 'a few minutes'}.
            </p>
          )}
          {(file || result) && !loading && (
            <button
              type="button" onClick={onReset}
              style={{
                marginTop: 10, width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 8, border: `1px solid ${THEME_BORDER}`,
                background: '#fff', color: THEME_TEXT, cursor: 'pointer', fontSize: 12,
              }}
            >
              <RefreshCw size={12} /> Reset inputs
            </button>
          )}
        </div>

        {/* ── Right column: tabbed results ───────────────────────── */}
        <div className="pidcv2-right" style={{ minHeight: 0, minWidth: 0 }}>
          <ResultsTabs
            result={result}
            error={error}
            loading={loading}
            grouped={grouped}
            LEGEND_SECTION={LEGEND_SECTION}
            onExportCsv={onExportCsv}
            onExportJson={onExportJson}
            pdfFile={file}
            activeLegend={activeLegend}
            effectiveLegend={effectiveLegend}
            activeLineList={activeLineList}
            refreshLineList={refreshLineList}
            activeEquipmentList={activeEquipmentList}
            refreshEquipmentList={refreshEquipmentList}
            activeInstrumentIndex={activeInstrumentIndex}
            refreshInstrumentIndex={refreshInstrumentIndex}
            visionProvider={visionProvider}
            apiKey={apiKey}
            history={history}
            historyLoading={historyLoading}
            refreshHistory={refreshHistory}
            onLoadHistory={onLoadHistory}
            onDeleteHistory={onDeleteHistory}
          />
        </div>
      </div>

      {/* keyframes for loader spin + responsive workspace */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: ${LAYOUT_BREAKPOINT_PX}px) {
          .pidcv2-workspace { grid-template-columns: 1fr !important; grid-template-rows: auto 1fr !important; }
        }
      `}</style>

      {/* Legend Sheets modal */}
      <LegendSheetsModal
        open={legendModalOpen}
        section={LEGEND_SECTION}
        onClose={() => { setLegendModalOpen(false); refreshActiveLegend() }}
        onActiveChange={(a) => setActiveLegend(a)}
      />
    </div>
  )
}
