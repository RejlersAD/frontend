/**
 * Instrument IO List Workflow — CRS-style multi-revision page.
 *
 * Replaces the default content at /engineering/instrument/datasheet/io-list.
 * The legacy "Generate from P&ID" wizard remains untouched and is reachable
 * via the "Legacy generator" link → /engineering/instrument/datasheet/io-list/generator
 *
 * Architecture:
 *   - All copy, colours, columns, endpoints, status codes live in
 *     frontend/src/config/ioListWorkflow.config.js (soft-coded).
 *   - This file is pure composition: header banner → toolbar → grid/cards
 *     → detail tabs. No business strings hardcoded.
 *
 * View modes:
 *   - list    → toolbar + card grid of uploaded I/O List documents
 *   - detail  → tabbed view: Overview · Comments · I/O Table · Metadata
 */

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Upload, RefreshCw, Download, Trash2, ArrowLeft, FileText, Search,
  Filter, X, AlertTriangle, CheckCircle2, Clock, Loader2, Tag,
  MessageSquare, Table2, BarChart3, Info, MessagesSquare, List, Link2,
  Sparkles, Zap, FolderOpen, Hash, Layers, Calendar, User as UserIcon,
  ExternalLink, Plus, ChevronRight, Edit3, Folder, Edit2, Trash, Save,
} from 'lucide-react'

import ioListWorkflowService from '../../../../services/ioListWorkflowService'
import ioListWorkflowProjectsService from '../../../../services/ioListWorkflowProjectsService'
import {
  IO_LIST_WORKFLOW_API,
  THEME, PAGE_COPY,
  COMMENT_DISPLAY_COLUMNS, IO_PREVIEW_COLUMNS,
  STATUS_BADGE_COLOURS, DOC_STATUS_BADGE, UNKNOWN_STATUS_STYLE,
  DETAIL_TABS, UPLOAD_CONFIG, STATS_CARDS, TONE_CLASSES,
  COST_BADGES, ROUTES, SORT_OPTIONS, STATUS_FILTER_OPTIONS,
  IO_LIST_EDIT_CONFIG,
} from '../../../../config/ioListWorkflow.config'
import {
  IO_LIST_WORKFLOW_PROJECT_STATUSES,
  IO_LIST_WORKFLOW_PROJECT_CATEGORIES,
  IO_LIST_WORKFLOW_PROJECT_STATUS_BADGE,
  IO_LIST_WORKFLOW_PROJECT_CATEGORY_BADGE,
  IO_LIST_WORKFLOW_PROJECT_FIELDS,
  IO_LIST_WORKFLOW_PROJECT_COPY,
  IO_LIST_WORKFLOW_PROJECT_THEME,
  IO_LIST_WORKFLOW_PROJECT_FEATURES,
} from '../../../../config/ioListWorkflowProjects.config'

// ─────────────────────────────────────────────────────────────────────
// Icon registry — drives soft-coded icon names from the config
// ─────────────────────────────────────────────────────────────────────
const ICONS = {
  FileText, MessageSquare, Table2, BarChart3, Info,
  MessagesSquare, List, Link2,
}
const Icon = ({ name, className }) => {
  const C = ICONS[name] || FileText
  return <C className={className} />
}

// ─────────────────────────────────────────────────────────────────────
// Small presentational atoms
// ─────────────────────────────────────────────────────────────────────
const Badge = ({ children, tone = 'slate', dot = false }) => {
  const t = TONE_CLASSES[tone] || TONE_CLASSES.slate
  return (
    <span className={`${THEME.badge} ${t.bg} ${t.fg}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${t.bar}`} />}
      {children}
    </span>
  )
}

const RawBadge = ({ children, bg, fg, dot }) => (
  <span className={`${THEME.badge} ${bg} ${fg}`}>
    {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
    {children}
  </span>
)

const StatusPill = ({ code }) => {
  const s = STATUS_BADGE_COLOURS[code]
  if (!s) return <span className="text-xs text-slate-400">—</span>
  return <RawBadge bg={s.bg} fg={s.fg} dot={s.dot}>{code} · {s.label}</RawBadge>
}

const DocStatusPill = ({ status }) => {
  const s = DOC_STATUS_BADGE[status] || DOC_STATUS_BADGE.uploaded
  return <RawBadge bg={s.bg} fg={s.fg} dot={s.dot}>{s.label}</RawBadge>
}

const CostBadge = ({ profile }) => {
  if (!profile) return null
  const key = profile.cache_hit ? 'cached'
            : profile.vision_fallback_used ? 'vision'
            : 'free'
  const c = COST_BADGES[key]
  return (
    <Badge tone={c.tone}>
      <Sparkles className="w-3 h-3" />
      {c.label}
    </Badge>
  )
}

const StatCard = ({ stat, value }) => {
  const t = TONE_CLASSES[stat.tone] || TONE_CLASSES.indigo
  return (
    <div className={`${THEME.card} p-4 flex items-center gap-3`}>
      <div className={`${THEME.iconBox} ${t.bg}`}>
        <Icon name={stat.icon} className={`w-5 h-5 ${t.icon}`} />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-slate-500 uppercase tracking-wide font-medium truncate">{stat.label}</div>
        <div className="text-2xl font-bold text-slate-900 leading-tight">{value ?? '—'}</div>
        {stat.hint && <div className="text-[10px] text-slate-400 truncate">{stat.hint}</div>}
      </div>
    </div>
  )
}

const Skeleton = ({ rows = 4 }) => (
  <div className="space-y-2">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
    ))}
  </div>
)

// ─────────────────────────────────────────────────────────────────────
// Projects Panel — Full-featured project management modal
// ─────────────────────────────────────────────────────────────────────
const ProjectsPanel = ({ open, onClose, onProjectSelected }) => {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const loadProjects = useCallback(async () => {
    if (!open) return
    setLoading(true); setError('')
    try {
      const data = await ioListWorkflowProjectsService.listProjects({
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
        search: searchQuery.length >= 2 ? searchQuery : undefined,
      })
      setProjects(Array.isArray(data) ? data : (data.results || []))
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [open, statusFilter, categoryFilter, searchQuery])

  useEffect(() => { loadProjects() }, [loadProjects])

  const handleCreate = () => {
    setEditingId(null)
    setFormData({
      project_name: '',
      category: 'oil_gas',
      status: 'draft',
      client_name: '',
      location: '',
      project_code: '',
      tags: '',
      description: '',
    })
    setShowForm(true)
  }

  const handleEdit = (project) => {
    setEditingId(project.id)
    setFormData({ ...project })
    setShowForm(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      if (editingId) {
        const updated = await ioListWorkflowProjectsService.updateProject(editingId, formData)
        setProjects(prev => prev.map(p => p.id === updated.id ? updated : p))
      } else {
        const created = await ioListWorkflowProjectsService.createProject(formData)
        setProjects(prev => [created, ...prev])
      }
      setShowForm(false)
      setFormData({})
      setEditingId(null)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save project')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id, projectName) => {
    if (!window.confirm(`Delete project "${projectName}"? Documents will be unlinked but not deleted.`)) return
    try {
      await ioListWorkflowProjectsService.deleteProject(id)
      setProjects(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to delete project')
    }
  }

  const ProjectStatusBadge = ({ status }) => {
    const s = IO_LIST_WORKFLOW_PROJECT_STATUS_BADGE[status] || IO_LIST_WORKFLOW_PROJECT_STATUS_BADGE.draft
    return <RawBadge bg={s.bg} fg={s.fg} dot={s.dot}>{s.label}</RawBadge>
  }

  const ProjectCategoryBadge = ({ category }) => {
    const c = IO_LIST_WORKFLOW_PROJECT_CATEGORY_BADGE[category] || IO_LIST_WORKFLOW_PROJECT_CATEGORY_BADGE.other
    const catLabel = IO_LIST_WORKFLOW_PROJECT_CATEGORIES.find(x => x.value === category)?.label || category
    const catIcon = IO_LIST_WORKFLOW_PROJECT_CATEGORIES.find(x => x.value === category)?.icon || '📦'
    return <RawBadge bg={c.bg} fg={c.fg}>{catIcon} {catLabel}</RawBadge>
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`${IO_LIST_WORKFLOW_PROJECT_THEME.headerBg} ${IO_LIST_WORKFLOW_PROJECT_THEME.headerText} px-6 py-5 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{IO_LIST_WORKFLOW_PROJECT_COPY.panelTitle}</h2>
              <p className="text-xs text-indigo-100 mt-0.5">Organize your IO List documents by project</p>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-white/10 rounded-lg p-2 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-6 mt-4 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Toolbar */}
        {!showForm && (
          <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={IO_LIST_WORKFLOW_PROJECT_COPY.filterPlaceholder}
                className="w-full text-sm border border-slate-300 rounded-lg pl-9 pr-3 py-2 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
              />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                    className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none">
              <option value="">{IO_LIST_WORKFLOW_PROJECT_COPY.allLabel} Statuses</option>
              {IO_LIST_WORKFLOW_PROJECT_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
                    className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none">
              <option value="">{IO_LIST_WORKFLOW_PROJECT_COPY.allLabel} Categories</option>
              {IO_LIST_WORKFLOW_PROJECT_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <div className="flex-1" />
            <button onClick={handleCreate}
                    className="text-sm font-semibold px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg hover:from-indigo-700 hover:to-blue-700 flex items-center gap-1.5 shadow-sm">
              <Plus className="w-4 h-4" /> {IO_LIST_WORKFLOW_PROJECT_COPY.createBtn}
            </button>
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {showForm ? (
            /* Project form */
            <form onSubmit={handleSave} className="max-w-3xl mx-auto space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                {editingId ? IO_LIST_WORKFLOW_PROJECT_COPY.editModalTitle : IO_LIST_WORKFLOW_PROJECT_COPY.createModalTitle}
              </h3>
              
              {IO_LIST_WORKFLOW_PROJECT_FIELDS.map(field => (
                <div key={field.key}>
                  <label className={`block ${IO_LIST_WORKFLOW_PROJECT_THEME.labelText} mb-1`}>
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      value={formData[field.key] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      required={field.required}
                      className={`w-full text-sm border ${IO_LIST_WORKFLOW_PROJECT_THEME.inputBorder} rounded-lg px-3 py-2 outline-none`}
                    >
                      {field.options.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={formData[field.key] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      placeholder={field.placeholder}
                      rows={field.rows}
                      maxLength={field.maxLength}
                      required={field.required}
                      className={`w-full text-sm border ${IO_LIST_WORKFLOW_PROJECT_THEME.inputBorder} rounded-lg px-3 py-2 outline-none`}
                    />
                  ) : (
                    <input
                      type="text"
                      value={formData[field.key] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      placeholder={field.placeholder}
                      maxLength={field.maxLength}
                      required={field.required}
                      className={`w-full text-sm border ${IO_LIST_WORKFLOW_PROJECT_THEME.inputBorder} rounded-lg px-3 py-2 outline-none`}
                    />
                  )}
                  {field.helpText && <p className="text-xs text-slate-500 mt-1">{field.helpText}</p>}
                </div>
              ))}

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className={`${IO_LIST_WORKFLOW_PROJECT_THEME.primaryBtn} flex items-center gap-2 disabled:opacity-50`}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingId ? IO_LIST_WORKFLOW_PROJECT_COPY.updateBtn : IO_LIST_WORKFLOW_PROJECT_COPY.saveBtn}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setFormData({}); setEditingId(null) }}
                  className={IO_LIST_WORKFLOW_PROJECT_THEME.secondaryBtn}
                >
                  {IO_LIST_WORKFLOW_PROJECT_COPY.cancelBtn}
                </button>
              </div>
            </form>
          ) : loading ? (
            <Skeleton rows={6} />
          ) : projects.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-indigo-50 mx-auto flex items-center justify-center mb-4">
                <Folder className="w-8 h-8 text-indigo-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{IO_LIST_WORKFLOW_PROJECT_COPY.emptyTitle}</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">{IO_LIST_WORKFLOW_PROJECT_COPY.emptySubtitle}</p>
            </div>
          ) : (
            /* Projects grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map(project => (
                <div key={project.id}
                     className={`${IO_LIST_WORKFLOW_PROJECT_THEME.card} p-4 space-y-3 ${IO_LIST_WORKFLOW_PROJECT_THEME.cardHover}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-slate-900 text-sm truncate">{project.project_name}</h4>
                      {project.project_code && (
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{project.project_code}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(project)}
                        title={IO_LIST_WORKFLOW_PROJECT_COPY.editTooltip}
                        className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                      <button
                        onClick={() => handleDelete(project.id, project.project_name)}
                        title={IO_LIST_WORKFLOW_PROJECT_COPY.deleteTooltip}
                        className="p-1.5 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-1.5">
                    <ProjectStatusBadge status={project.status} />
                    <ProjectCategoryBadge category={project.category} />
                  </div>
                  
                  {(project.client_name || project.location) && (
                    <div className="text-xs text-slate-600 space-y-0.5">
                      {project.client_name && <div>🏢 {project.client_name}</div>}
                      {project.location && <div>📍 {project.location}</div>}
                    </div>
                  )}
                  
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                      <FileText className="w-3 h-3 inline mr-1" />
                      {project.document_count || 0} document{(project.document_count || 0) !== 1 ? 's' : ''}
                    </div>
                    {onProjectSelected && (
                      <button
                        onClick={() => { onProjectSelected(project); onClose() }}
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        Filter →
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Upload Modal
// ─────────────────────────────────────────────────────────────────────
const UploadModal = ({ open, onClose, onUploaded }) => {
  const [file, setFile]         = useState(null)
  const [meta, setMeta]         = useState({})
  const [progress, setProgress] = useState(0)
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState('')

  const reset = () => {
    setFile(null); setMeta({}); setProgress(0); setBusy(false); setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) { setError('Please select a PDF file.'); return }
    setBusy(true); setError(''); setProgress(0)
    try {
      const result = await ioListWorkflowService.uploadDocument({
        file, metadata: meta,
        onUploadProgress: (evt) => {
          if (evt.total) setProgress(Math.round((evt.loaded * 100) / evt.total))
        },
      })
      onUploaded(result); reset(); onClose()
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.error || err.message || 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className={`bg-gradient-to-r ${THEME.bannerFrom} ${THEME.bannerVia} ${THEME.bannerTo} px-6 py-4 rounded-t-2xl flex items-center justify-between`}>
          <div className="flex items-center gap-3 text-white">
            <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Upload Instrument I/O List PDF</h3>
              <p className="text-xs text-indigo-100">Multi-revision document workflow</p>
            </div>
          </div>
          <button onClick={() => { reset(); onClose() }} className="text-white/70 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Drop zone */}
          <label className="block">
            <div className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
                            ${file ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/40'}`}>
              <input type="file" accept={UPLOAD_CONFIG.acceptedTypes} className="hidden"
                     onChange={(e) => setFile(e.target.files?.[0] || null)} />
              {file ? (
                <div className="flex items-center justify-center gap-2 text-sm text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">{file.name}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                </div>
              ) : (
                <div className="text-slate-500">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                  <div className="text-sm font-medium">Click to choose a PDF</div>
                  <div className="text-xs text-slate-400 mt-1">Max {UPLOAD_CONFIG.maxSizeMB} MB</div>
                </div>
              )}
            </div>
          </label>

          {/* Hints */}
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 mb-1.5">
              <Info className="w-3.5 h-3.5" /> What gets extracted
            </div>
            <ul className="text-xs text-slate-600 list-disc pl-5 space-y-0.5">
              {UPLOAD_CONFIG.hints.map((h, i) => <li key={i}>{h}</li>)}
            </ul>
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-3">
            {UPLOAD_CONFIG.fields.map(f => (
              <div key={f.key} className={f.key === 'project_name' ? 'col-span-2' : ''}>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {f.label} {f.required && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  value={meta[f.key] || ''}
                  placeholder={f.placeholder}
                  required={f.required}
                  onChange={(e) => setMeta({ ...meta, [f.key]: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                />
              </div>
            ))}
          </div>

          {/* Progress / error */}
          {busy && (
            <div>
              <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                <span className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading & extracting…</span>
                <span className="font-semibold">{progress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Server-side PyMuPDF extraction — no AI cost incurred.</div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => { reset(); onClose() }}
                    className="px-4 py-2 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={busy || !file}
                    className="px-5 py-2 text-sm font-semibold bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
              {busy
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Extracting…</>
                : <><Upload className="w-4 h-4" /> Upload & Extract</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Toolbar (search + filters + sort)
// ─────────────────────────────────────────────────────────────────────
const Toolbar = ({ search, setSearch, statusFilter, setStatusFilter, sortBy, setSortBy, onRefresh, onUpload, onProjects, totalCount }) => (
  <div className={`${THEME.card} p-3 flex flex-wrap items-center gap-2`}>
    <div className="relative flex-1 min-w-[240px]">
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search document number, project, plant, unit…"
        className="w-full text-sm border border-slate-300 rounded-lg pl-9 pr-3 py-2 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
      />
    </div>
    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none">
      {STATUS_FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none">
      {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    <div className="text-xs text-slate-500 px-2">{totalCount} document{totalCount !== 1 ? 's' : ''}</div>
    <div className="flex-1" />
    {IO_LIST_WORKFLOW_PROJECT_FEATURES.enableProjectManagement && onProjects && (
      <button onClick={onProjects}
              className="text-sm px-3 py-2 border border-indigo-300 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 flex items-center gap-1.5">
        <Folder className="w-4 h-4" /> Projects
      </button>
    )}
    <button onClick={onRefresh}
            className="text-sm px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-1.5">
      <RefreshCw className="w-4 h-4" /> Refresh
    </button>
    <button onClick={onUpload}
            className="text-sm font-semibold px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg hover:from-indigo-700 hover:to-blue-700 flex items-center gap-1.5 shadow-sm">
      <Plus className="w-4 h-4" /> Upload PDF
    </button>
  </div>
)

// ─────────────────────────────────────────────────────────────────────
// Document Card
// ─────────────────────────────────────────────────────────────────────
const DocumentCard = ({ doc, onOpen }) => {
  const stats = doc.extraction_stats || {}
  return (
    <button onClick={() => onOpen(doc.id)}
            className={`${THEME.card} text-left p-4 flex flex-col gap-3 group hover:border-indigo-300`}>
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className={`${THEME.iconBox} bg-indigo-50 text-indigo-600 flex-shrink-0`}>
          <FileText className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-xs text-slate-500 truncate">{doc.document_number || `#${doc.id}`}</div>
          <div className="text-sm font-semibold text-slate-900 truncate">{doc.project_name || 'Untitled project'}</div>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-transform" />
      </div>

      {/* Meta line */}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <Badge tone="indigo"><Layers className="w-3 h-3" /> Rev {doc.revision_label || '—'}</Badge>
        {doc.plant && <Badge tone="slate">{doc.plant}</Badge>}
        {doc.unit  && <Badge tone="slate">{doc.unit}</Badge>}
        <DocStatusPill status={doc.status} />
        {stats.cost_profile && <CostBadge profile={stats.cost_profile} />}
      </div>

      {/* Inline stats */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-400">Pages</div>
          <div className="text-sm font-semibold text-slate-800">{stats.total_pages ?? '—'}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-400">Comments</div>
          <div className="text-sm font-semibold text-slate-800">{stats.comments_found ?? '—'}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-400">I/O Rows</div>
          <div className="text-sm font-semibold text-slate-800">{stats.io_rows_found ?? '—'}</div>
        </div>
      </div>

      {/* Footer line */}
      <div className="flex items-center gap-2 text-[10px] text-slate-400">
        <Calendar className="w-3 h-3" />
        {doc.created_at ? new Date(doc.created_at).toLocaleString() : '—'}
        {doc.uploaded_by_email && <>
          <span>·</span>
          <UserIcon className="w-3 h-3" />
          <span className="truncate">{doc.uploaded_by_email}</span>
        </>}
      </div>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────
// List View
// ─────────────────────────────────────────────────────────────────────
const ListView = ({ documents, loading, onOpen, onUploadClick, onRefresh, onProjects, activeProjectFilter,
                    search, setSearch, statusFilter, setStatusFilter, sortBy, setSortBy }) => {
  const filtered = useMemo(() => {
    let rows = [...documents]
    if (statusFilter) rows = rows.filter(d => d.status === statusFilter)
    if (activeProjectFilter) rows = rows.filter(d => d.project === activeProjectFilter.id)
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(d =>
        (d.document_number || '').toLowerCase().includes(q)
        || (d.project_name  || '').toLowerCase().includes(q)
        || (d.plant         || '').toLowerCase().includes(q)
        || (d.unit          || '').toLowerCase().includes(q)
        || (d.revision_label|| '').toLowerCase().includes(q),
      )
    }
    const dir = sortBy.startsWith('-') ? -1 : 1
    const key = sortBy.replace('-', '')
    rows.sort((a, b) => {
      const av = a[key] ?? ''
      const bv = b[key] ?? ''
      return av > bv ? dir : av < bv ? -dir : 0
    })
    return rows
  }, [documents, search, statusFilter, sortBy, activeProjectFilter])

  return (
    <div className="space-y-4">
      {activeProjectFilter && (
        <div className="flex items-center gap-2 text-sm bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2">
          <Folder className="w-4 h-4 text-indigo-600" />
          <span className="text-indigo-900 font-medium">Filtered by project:</span>
          <span className="text-indigo-700">{activeProjectFilter.project_name}</span>
          <button
            onClick={() => window.location.reload()} 
            className="ml-auto text-indigo-600 hover:text-indigo-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      <Toolbar
        search={search} setSearch={setSearch}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        sortBy={sortBy} setSortBy={setSortBy}
        totalCount={filtered.length}
        onRefresh={onRefresh} onUpload={onUploadClick} onProjects={onProjects}
      />

      {loading ? (
        <Skeleton rows={6} />
      ) : filtered.length === 0 ? (
        <div className={`${THEME.card} py-16 text-center`}>
          <div className="w-16 h-16 rounded-full bg-indigo-50 mx-auto flex items-center justify-center mb-4">
            <FolderOpen className="w-8 h-8 text-indigo-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">{PAGE_COPY.emptyTitle}</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">{PAGE_COPY.emptySubtitle}</p>
          <button onClick={onUploadClick}
                  className="mt-5 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg font-semibold flex items-center gap-2 mx-auto hover:from-indigo-700 hover:to-blue-700 shadow-sm">
            <Upload className="w-4 h-4" /> Upload your first PDF
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(d => <DocumentCard key={d.id} doc={d} onOpen={onOpen} />)}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Detail — Overview tab
// ─────────────────────────────────────────────────────────────────────
const OverviewPanel = ({ doc }) => {
  const stats = doc.extraction_stats || {}

  // Primary: use the precomputed breakdown stored in extraction_stats by the orchestrator.
  // Fallback: compute dynamically from the embedded extracted_comments array.
  // Both paths count ALL unique codes (not just the hard-coded 1–4) so the
  // chart always reflects what is actually in the data.
  const statusBreakdown = useMemo(() => {
    const precomputed = stats.status_code_breakdown
    if (precomputed && typeof precomputed === 'object' && Object.keys(precomputed).length > 0) {
      return precomputed
    }
    const counts = {}
    ;(doc.extracted_comments || []).forEach(c => {
      const code = (c.status_code || '').trim() || 'unknown'
      counts[code] = (counts[code] || 0) + 1
    })
    return counts
  }, [doc.extracted_comments, stats.status_code_breakdown])

  // Prefer the backend-reported count (includes comments whose status_code is empty)
  const totalComments = stats.comments_found ?? doc.extracted_comments?.length ?? 0

  return (
    <div className="space-y-5">
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {STATS_CARDS.map(s => (
          <StatCard key={s.key} stat={s} value={stats[s.key]} />
        ))}
      </div>

      {/* Two-column: Status breakdown + Extraction details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status breakdown */}
        <div className={THEME.card}>
          <div className={`${THEME.cardHeader} flex items-center gap-2`}>
            <MessagesSquare className="w-4 h-4 text-indigo-600" />
            <h4 className="text-sm font-semibold text-slate-900">Comments by Status</h4>
          </div>
          <div className="p-5 space-y-3">
            {totalComments === 0 ? (
              /* ── Empty state: no comments extracted ───────────────── */
              <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
                <MessagesSquare className="w-8 h-8 text-slate-300" />
                <p className="text-sm font-medium text-slate-600">No comments extracted</p>
                <p className="text-xs text-slate-400 max-w-xs">
                  {(stats.comment_pages ?? 0) > 0
                    ? `${stats.comment_pages} page${stats.comment_pages !== 1 ? 's' : ''} were identified as comment sheets but no table structure could be parsed.`
                    : 'No Comments Resolution Sheet pages were detected in this PDF.'}
                </p>
              </div>
            ) : (
              <>
                {/* Known ADNOC status codes 1–4 */}
                {Object.entries(STATUS_BADGE_COLOURS).map(([code, s]) => {
                  const n = statusBreakdown[code] || 0
                  const pct = (n / totalComments) * 100
                  return (
                    <div key={code}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-slate-700">{code} · {s.label}</span>
                        <span className="text-slate-500">{n} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${s.dot} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
                {/* Extra codes that appear in the data but aren't in STATUS_BADGE_COLOURS */}
                {Object.entries(statusBreakdown)
                  .filter(([code]) => !STATUS_BADGE_COLOURS[code] && code !== 'unknown' && code)
                  .map(([code, n]) => {
                    const pct = (n / totalComments) * 100
                    return (
                      <div key={code}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className={`font-medium ${UNKNOWN_STATUS_STYLE.fg}`}>{code}</span>
                          <span className="text-slate-500">{n} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full ${UNKNOWN_STATUS_STYLE.dot} transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                {(statusBreakdown.unknown || 0) > 0 && (
                  <div className="text-[11px] text-slate-400 pt-1">
                    {statusBreakdown.unknown} comment{statusBreakdown.unknown !== 1 ? 's' : ''} without a recognised status code.
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Extraction details */}
        <div className={THEME.card}>
          <div className={`${THEME.cardHeader} flex items-center gap-2`}>
            <Zap className="w-4 h-4 text-indigo-600" />
            <h4 className="text-sm font-semibold text-slate-900">Extraction Details</h4>
          </div>
          <div className="p-5 space-y-2 text-sm">
            <Row label="Elapsed time"     value={stats.elapsed_seconds ? `${stats.elapsed_seconds}s` : '—'} />
            <Row label="Cost profile"     value={<CostBadge profile={stats.cost_profile} />} />
            <Row label="SHA-256"          value={<span className="font-mono text-[10px] text-slate-500 truncate">{doc.pdf_sha256 || '—'}</span>} />
            <Row label="CRS chain"        value={doc.crs_chain_id || <span className="text-slate-400">Not linked</span>} />
            <Row label="Uploaded by"      value={doc.uploaded_by_email || '—'} />
            <Row label="Uploaded at"      value={doc.created_at ? new Date(doc.created_at).toLocaleString() : '—'} />
            {doc.extraction_error && (
              <div className="mt-3 flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span className="break-all">{doc.extraction_error}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const Row = ({ label, value }) => (
  <div className="flex items-start justify-between gap-3">
    <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
    <span className="text-sm text-slate-800 text-right max-w-[60%] truncate">{value}</span>
  </div>
)

// ─────────────────────────────────────────────────────────────────────
// Detail — Comments tab
// ─────────────────────────────────────────────────────────────────────
const CommentsPanel = ({ doc, filterTag, setFilterTag }) => {
  const filtered = useMemo(() => {
    if (!filterTag) return doc.extracted_comments || []
    const t = filterTag.toUpperCase()
    return (doc.extracted_comments || []).filter(c =>
      (c.linked_tags || []).some(tag => tag.includes(t))
      || (c.company_comment   || '').toUpperCase().includes(t)
      || (c.contractor_reply  || '').toUpperCase().includes(t)
      || (c.company_decision  || '').toUpperCase().includes(t),
    )
  }, [doc.extracted_comments, filterTag])

  return (
    <div className={THEME.card}>
      <div className={`${THEME.cardHeader} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-600" />
          <h4 className="text-sm font-semibold text-slate-900">Comments Resolution Sheet</h4>
          <Badge tone="indigo">{filtered.length} rows</Badge>
        </div>
        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={filterTag} onChange={(e) => setFilterTag(e.target.value)}
                 placeholder="Filter by tag or text…"
                 className="w-full text-xs border border-slate-300 rounded-md pl-8 pr-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400" />
        </div>
      </div>
      <div className="overflow-x-auto max-h-[68vh] overflow-y-auto">
        <table className="text-xs w-full">
          <thead className={`${THEME.tableHead} sticky top-0 z-10`}>
            <tr>
              {COMMENT_DISPLAY_COLUMNS.map(c => (
                <th key={c.key} className="text-left px-3 py-2.5" style={{ minWidth: c.width }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className={`${THEME.tableRow} align-top`}>
                <td className="px-3 py-2 font-medium text-slate-700">{c.s_no}</td>
                <td className="px-3 py-2 text-slate-700 whitespace-pre-wrap">{c.company_comment}</td>
                <td className="px-3 py-2 text-slate-700 whitespace-pre-wrap">{c.contractor_reply}</td>
                <td className="px-3 py-2 text-slate-700 whitespace-pre-wrap">{c.company_decision}</td>
                <td className="px-3 py-2"><StatusPill code={c.status_code} /></td>
                <td className="px-3 py-2 text-slate-500">{c.page_number}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {(c.linked_tags || []).map(tag => (
                      <button key={tag} onClick={() => setFilterTag(tag)}
                              className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-mono hover:bg-indigo-100 inline-flex items-center gap-1">
                        <Tag className="w-2.5 h-2.5" />{tag}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={COMMENT_DISPLAY_COLUMNS.length}
                      className="text-center py-10 text-slate-400">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                No comments match the current filter.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Editable cell — click-to-edit input used inside I/O List Table
// ─────────────────────────────────────────────────────────────────────
const EditableCell = ({ value, onSave, cellKey, savingState, isSticky, editingCell, setEditingCell }) => {
  const isEditing = editingCell === cellKey
  const [draft, setDraft] = useState(String(value ?? ''))
  const inputRef = useRef(null)

  // Keep draft in sync when an external save updates the value
  useEffect(() => {
    if (!isEditing) setDraft(String(value ?? ''))
  }, [value, isEditing])

  // Focus & select-all when edit starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const commit = () => {
    setEditingCell(null)
    const next = draft.trim()
    if (next !== String(value ?? '').trim()) onSave(next)
  }

  const cancel = () => {
    setDraft(String(value ?? ''))
    setEditingCell(null)
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); commit() }
          if (e.key === 'Escape') cancel()
        }}
        className="w-full text-xs border border-indigo-400 rounded-md px-1.5 py-0.5 bg-indigo-50 outline-none ring-1 ring-indigo-300 min-w-[60px]"
      />
    )
  }

  return (
    <div
      onClick={() => setEditingCell(cellKey)}
      title="Click to edit"
      className={`cursor-pointer min-h-[16px] flex items-center gap-1 px-1 rounded -mx-1
                  hover:bg-amber-50 hover:ring-1 hover:ring-amber-200 transition-colors
                  ${isSticky ? 'font-mono font-semibold text-indigo-700' : 'text-slate-700'}`}
    >
      <span className="flex-1 min-w-0 truncate">
        {value != null && value !== '' ? String(value) : <span className="text-slate-300">—</span>}
      </span>
      {savingState === 'saving' && <Loader2 className="w-2.5 h-2.5 text-indigo-400 animate-spin flex-shrink-0" />}
      {savingState === 'saved'  && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 flex-shrink-0" />}
      {savingState === 'error'  && <AlertTriangle className="w-2.5 h-2.5 text-red-400 flex-shrink-0" />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Detail — I/O List tab
// ─────────────────────────────────────────────────────────────────────
const IOListPanel = ({ doc, filterTag, setFilterTag }) => {
  const [editMode, setEditMode]       = useState(false)
  const [localRows, setLocalRows]     = useState(null)   // optimistic overrides
  const [editingCell, setEditingCell] = useState(null)   // active cell key: 'rowId_field'
  const [savingCells, setSavingCells] = useState({})     // { 'rowId_field': 'saving'|'saved'|'error' }

  // Reset when the user navigates to a different document
  useEffect(() => {
    setLocalRows(null)
    setEditMode(false)
    setEditingCell(null)
    setSavingCells({})
  }, [doc.id])

  const rows = localRows || doc.extracted_rows || []

  const handleCellSave = useCallback(async (rowId, field, newValue) => {
    const cellKey = `${rowId}_${field}`
    // Optimistic update so the UI reflects the change immediately
    setLocalRows(prev => {
      const src = prev || doc.extracted_rows || []
      return src.map(r => {
        if (r.id !== rowId) return r
        if (field === 'tag_number')  return { ...r, tag_number: newValue }
        if (field === 'page_number') return { ...r, page_number: newValue }
        return { ...r, data: { ...(r.data || {}), [field]: newValue } }
      })
    })
    setSavingCells(p => ({ ...p, [cellKey]: 'saving' }))
    try {
      await ioListWorkflowService.updateRow(doc.id, rowId, { [field]: newValue })
      setSavingCells(p => ({ ...p, [cellKey]: 'saved' }))
      setTimeout(
        () => setSavingCells(p => { const n = { ...p }; delete n[cellKey]; return n }),
        IO_LIST_EDIT_CONFIG.savedIndicatorMs,
      )
    } catch {
      // Revert to original value on failure
      setSavingCells(p => ({ ...p, [cellKey]: 'error' }))
      setLocalRows(prev => {
        const src = prev || doc.extracted_rows || []
        const original = (doc.extracted_rows || []).find(r => r.id === rowId)
        return original ? src.map(r => r.id === rowId ? original : r) : src
      })
    }
  }, [doc.id, doc.extracted_rows])

  const filtered = useMemo(() => {
    if (!filterTag) return rows
    const t = filterTag.toUpperCase()
    return rows.filter(r =>
      (r.tag_number || '').toUpperCase().includes(t)
      || Object.values(r.data || {}).some(v => String(v ?? '').toUpperCase().includes(t)),
    )
  }, [rows, filterTag])

  return (
    <div className={THEME.card}>
      {/* Header */}
      <div className={`${THEME.cardHeader} flex items-center justify-between gap-2 flex-wrap`}>
        <div className="flex items-center gap-2 flex-wrap">
          <Table2 className="w-4 h-4 text-indigo-600" />
          <h4 className="text-sm font-semibold text-slate-900">I/O List Table</h4>
          <Badge tone="emerald">{filtered.length} rows</Badge>
          <span className="text-[11px] text-slate-400">Preview · full 40 columns in Excel export</span>
          {/* Edit mode toggle — controlled by IO_LIST_EDIT_CONFIG.enabled */}
          {IO_LIST_EDIT_CONFIG.enabled && (
            <button
              onClick={() => { setEditMode(e => !e); setEditingCell(null) }}
              className={`text-xs px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 border transition-all
                          ${editMode
                            ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600 shadow-sm'
                            : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
            >
              {editMode
                ? <><X className="w-3 h-3" /> Done editing</>
                : <><Edit3 className="w-3 h-3" /> Edit cells</>}
            </button>
          )}
        </div>
        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={filterTag} onChange={(e) => setFilterTag(e.target.value)}
                 placeholder="Filter by tag, service, type…"
                 className="w-full text-xs border border-slate-300 rounded-md pl-8 pr-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400" />
        </div>
      </div>

      {/* Hint bar shown only when edit mode is active */}
      {editMode && (
        <div className="px-5 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2 text-xs text-amber-700">
          <Edit3 className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            Click any cell to edit ·{' '}
            <kbd className="px-1 py-0.5 bg-amber-100 rounded font-mono">Enter</kbd> or{' '}
            <kbd className="px-1 py-0.5 bg-amber-100 rounded font-mono">Tab</kbd> to confirm ·{' '}
            <kbd className="px-1 py-0.5 bg-amber-100 rounded font-mono">Esc</kbd> to cancel
          </span>
          {Object.keys(savingCells).length > 0 && (
            <span className="ml-auto flex items-center gap-1 text-indigo-600 font-medium">
              <Loader2 className="w-3 h-3 animate-spin" /> Saving…
            </span>
          )}
        </div>
      )}

      <div className="overflow-x-auto max-h-[68vh] overflow-y-auto">
        <table className="text-xs w-full">
          <thead className={`${THEME.tableHead} sticky top-0 z-10`}>
            <tr>
              {IO_PREVIEW_COLUMNS.map(c => (
                <th key={c.key}
                    className={`text-left px-3 py-2.5 ${c.sticky ? 'sticky left-0 bg-slate-50 z-20' : ''}`}
                    style={{ minWidth: c.width }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className={THEME.tableRow}>
                {IO_PREVIEW_COLUMNS.map(c => {
                  const val = c.key === 'tag_number' ? r.tag_number
                            : c.key === 'page_number' ? r.page_number
                            : (r.data || {})[c.key]
                  const cellKey = `${r.id}_${c.key}`
                  const canEdit = editMode
                    && IO_LIST_EDIT_CONFIG.enabled
                    && !IO_LIST_EDIT_CONFIG.nonEditableColumns.includes(c.key)
                  return (
                    <td key={c.key}
                        className={`px-3 py-2 ${c.sticky ? 'sticky left-0 bg-white z-10' : ''}`}>
                      {canEdit
                        ? <EditableCell
                            value={val}
                            onSave={(v) => handleCellSave(r.id, c.key, v)}
                            cellKey={cellKey}
                            savingState={savingCells[cellKey]}
                            isSticky={c.sticky}
                            editingCell={editingCell}
                            setEditingCell={setEditingCell}
                          />
                        : <span className={c.sticky ? 'font-mono font-semibold text-indigo-700' : 'text-slate-700'}>
                            {val ?? <span className="text-slate-300">—</span>}
                          </span>
                      }
                    </td>
                  )
                })}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={IO_PREVIEW_COLUMNS.length}
                      className="text-center py-10 text-slate-400">
                <Table2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                No rows match the current filter.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Detail — Metadata tab
// ─────────────────────────────────────────────────────────────────────
const MetadataPanel = ({ doc }) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <div className={THEME.card}>
      <div className={`${THEME.cardHeader} flex items-center gap-2`}>
        <Hash className="w-4 h-4 text-indigo-600" />
        <h4 className="text-sm font-semibold text-slate-900">Document</h4>
      </div>
      <div className="p-5 space-y-2 text-sm">
        <Row label="ID"             value={doc.id} />
        <Row label="Document No"    value={doc.document_number || '—'} />
        <Row label="Revision"       value={doc.revision_label  || '—'} />
        <Row label="Project"        value={doc.project_name    || '—'} />
        <Row label="Plant"          value={doc.plant           || '—'} />
        <Row label="Unit"           value={doc.unit            || '—'} />
        <Row label="Status"         value={<DocStatusPill status={doc.status} />} />
      </div>
    </div>
    <div className={THEME.card}>
      <div className={`${THEME.cardHeader} flex items-center gap-2`}>
        <Info className="w-4 h-4 text-indigo-600" />
        <h4 className="text-sm font-semibold text-slate-900">File & Audit</h4>
      </div>
      <div className="p-5 space-y-2 text-sm">
        <Row label="SHA-256"        value={<span className="font-mono text-[10px]">{doc.pdf_sha256 || '—'}</span>} />
        <Row label="CRS chain"      value={doc.crs_chain_id    || <span className="text-slate-400">Not linked</span>} />
        <Row label="Uploaded by"    value={doc.uploaded_by_email || '—'} />
        <Row label="Uploaded at"    value={doc.created_at ? new Date(doc.created_at).toLocaleString() : '—'} />
        <Row label="Updated at"     value={doc.updated_at ? new Date(doc.updated_at).toLocaleString() : '—'} />
        {doc.pdf_url && (
          <div className="pt-2">
            <a href={doc.pdf_url} target="_blank" rel="noreferrer"
               className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700">
              <ExternalLink className="w-3.5 h-3.5" /> Open original PDF
            </a>
          </div>
        )}
      </div>
    </div>
  </div>
)

// ─────────────────────────────────────────────────────────────────────
// Detail View — tabbed
// ─────────────────────────────────────────────────────────────────────
const DetailView = ({ doc, onBack, onReExtract, onDownload, onDelete, busyAction }) => {
  const [activeTab, setActiveTab] = useState('overview')
  const [filterTag, setFilterTag] = useState('')

  return (
    <div className="space-y-4">
      {/* Header banner */}
      <div className={`bg-gradient-to-r ${THEME.bannerFrom} ${THEME.bannerVia} ${THEME.bannerTo} rounded-2xl shadow-lg overflow-hidden`}>
        <div className="px-6 py-5 text-white">
          <button onClick={onBack}
                  className="text-xs text-indigo-200 hover:text-white flex items-center gap-1 mb-2">
            <ArrowLeft className="w-3.5 h-3.5" /> {PAGE_COPY.detailBack}
          </button>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-bold truncate">{doc.document_number || `Document #${doc.id}`}</h2>
                <RawBadge bg="bg-white/15" fg="text-white" dot="bg-emerald-300">
                  Rev {doc.revision_label || '—'}
                </RawBadge>
                <DocStatusPill status={doc.status} />
                {doc.extraction_stats?.cost_profile && <CostBadge profile={doc.extraction_stats.cost_profile} />}
              </div>
              <p className="text-sm text-indigo-100 mt-1 truncate">
                {[doc.project_name, doc.plant, doc.unit].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={onReExtract} disabled={busyAction === 're'}
                      className="px-3 py-2 text-sm bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center gap-1.5 disabled:opacity-50">
                {busyAction === 're' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Re-extract
              </button>
              <button onClick={onDownload}
                      className="px-3 py-2 text-sm bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg flex items-center gap-1.5 shadow-sm">
                <Download className="w-4 h-4" /> Download xlsx
              </button>
              <button onClick={onDelete}
                      className="px-3 py-2 text-sm bg-red-500/80 hover:bg-red-500 text-white rounded-lg flex items-center gap-1.5">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 border-t border-white/10 flex gap-1">
          {DETAIL_TABS.map(t => {
            const active = activeTab === t.id
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5
                                  ${active ? 'border-white text-white' : 'border-transparent text-indigo-200 hover:text-white'}`}>
                <Icon name={t.icon} className="w-4 h-4" /> {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Active panel */}
      {activeTab === 'overview' && <OverviewPanel doc={doc} />}
      {activeTab === 'comments' && <CommentsPanel doc={doc} filterTag={filterTag} setFilterTag={setFilterTag} />}
      {activeTab === 'iolist'   && <IOListPanel   doc={doc} filterTag={filterTag} setFilterTag={setFilterTag} />}
      {activeTab === 'metadata' && <MetadataPanel doc={doc} />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Page root
// ─────────────────────────────────────────────────────────────────────
export default function IOListWorkflowPage() {
  const [documents, setDocuments]     = useState([])
  const [loading, setLoading]         = useState(false)
  const [showUpload, setShowUpload]   = useState(false)
  const [activeDoc, setActiveDoc]     = useState(null)
  const [pageError, setPageError]     = useState('')
  const [busyAction, setBusyAction]   = useState('')
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy]           = useState(SORT_OPTIONS[0].value)
  
  // Project management state
  const [showProjects, setShowProjects] = useState(false)
  const [activeProjectFilter, setActiveProjectFilter] = useState(null)

  const loadDocuments = useCallback(async () => {
    setLoading(true); setPageError('')
    try {
      const data = await ioListWorkflowService.listDocuments()
      setDocuments(Array.isArray(data) ? data : (data.results || []))
    } catch (err) {
      setPageError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadDocuments() }, [loadDocuments])

  const handleUploaded = (result) => {
    if (result?.document) {
      setActiveDoc(result.document)
      loadDocuments()
    }
  }
  
  const handleProjectSelected = (project) => {
    setActiveProjectFilter(project)
  }

  const handleOpen = async (id) => {
    setLoading(true)
    try {
      const doc = await ioListWorkflowService.getDocument(id)
      setActiveDoc(doc)
    } catch (err) {
      setPageError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleReExtract = async () => {
    if (!activeDoc) return
    setBusyAction('re')
    try {
      const doc = await ioListWorkflowService.reExtract(activeDoc.id)
      setActiveDoc(doc)
      loadDocuments()
    } catch (err) {
      setPageError(err.response?.data?.error || err.message)
    } finally {
      setBusyAction('')
    }
  }

  const handleDownload = () => {
    if (!activeDoc) return
    const name = `IOList_${activeDoc.document_number || activeDoc.id}_${activeDoc.revision_label || 'rev'}.xlsx`
    ioListWorkflowService.downloadXlsx(activeDoc.id, name)
  }

  const handleDelete = async () => {
    if (!activeDoc) return
    if (!window.confirm('Delete this document and all extracted rows? This action cannot be undone.')) return
    await ioListWorkflowService.deleteDocument(activeDoc.id)
    setActiveDoc(null)
    loadDocuments()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-[1700px] mx-auto px-4 py-6 space-y-4">

        {/* Page banner (visible only on list view) */}
        {!activeDoc && (
          <div className={`bg-gradient-to-r ${THEME.bannerFrom} ${THEME.bannerVia} ${THEME.bannerTo} rounded-2xl shadow-lg`}>
            <div className="px-6 py-6 text-white flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-14 h-14 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                  <Table2 className="w-7 h-7" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-indigo-200 mb-0.5">
                    <Sparkles className="w-3 h-3" /> Engineering · Instrument
                  </div>
                  <h1 className="text-2xl font-bold truncate">{PAGE_COPY.title}</h1>
                  <p className="text-sm text-indigo-100 max-w-3xl mt-1">{PAGE_COPY.subtitle}</p>
                </div>
              </div>
              <Link to={ROUTES.legacyGenerator}
                    title={PAGE_COPY.legacyHint}
                    className="text-xs text-white/80 hover:text-white border border-white/30 rounded-lg px-3 py-2 flex items-center gap-1.5 whitespace-nowrap">
                <ExternalLink className="w-3.5 h-3.5" /> {PAGE_COPY.legacyLink}
              </Link>
            </div>
            <div className="px-6 py-2 bg-black/20 text-[11px] text-indigo-100 flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-300" /> {PAGE_COPY.costBanner}
            </div>
          </div>
        )}

        {/* Inline error */}
        {pageError && (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="flex-1">{pageError}</span>
            <button onClick={() => setPageError('')} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Body */}
        {!activeDoc ? (
          <ListView
            documents={documents}
            loading={loading}
            onOpen={handleOpen}
            onUploadClick={() => setShowUpload(true)}
            onRefresh={loadDocuments}
            onProjects={() => setShowProjects(true)}
            activeProjectFilter={activeProjectFilter}
            search={search} setSearch={setSearch}
            statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            sortBy={sortBy} setSortBy={setSortBy}
          />
        ) : (
          <DetailView
            doc={activeDoc}
            onBack={() => setActiveDoc(null)}
            onReExtract={handleReExtract}
            onDownload={handleDownload}
            onDelete={handleDelete}
            busyAction={busyAction}
          />
        )}

        <UploadModal
          open={showUpload}
          onClose={() => setShowUpload(false)}
          onUploaded={handleUploaded}
        />
        
        {IO_LIST_WORKFLOW_PROJECT_FEATURES.enableProjectManagement && (
          <ProjectsPanel
            open={showProjects}
            onClose={() => setShowProjects(false)}
            onProjectSelected={handleProjectSelected}
          />
        )}
      </div>
    </div>
  )
}
