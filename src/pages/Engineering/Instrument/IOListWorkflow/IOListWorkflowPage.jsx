import { radaiConfirm } from '../../../../services/radaiDialog'
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
import { toast } from 'react-toastify'
import {
  Upload, RefreshCw, Download, Trash2, ArrowLeft, FileText, Search,
  Filter, X, AlertTriangle, CheckCircle2, Clock, Loader2, Tag,
  MessageSquare, Table2, BarChart3, Info, MessagesSquare, List, Link2,
  Sparkles, Zap, FolderOpen, Hash, Calendar, BookOpen, Settings,
  ExternalLink, Plus, Edit3, Folder, Edit2, Trash, Save,
} from 'lucide-react'

import ioListWorkflowService from '../../../../services/ioListWorkflowService'
import ioListWorkflowProjectsService from '../../../../services/ioListWorkflowProjectsService'
import { listLegends as listIoLegends } from '../../../../services/ioListLegendService'
import LegendSheetsModal from './components/LegendSheetsModal'
import AddToLegendModal from './components/AddToLegendModal'
import {
  IO_LIST_WORKFLOW_API,
  THEME, PAGE_COPY,
  COMMENT_DISPLAY_COLUMNS, IO_PREVIEW_COLUMNS, getIoPreviewColumns,
  STATUS_BADGE_COLOURS, DOC_STATUS_BADGE, UNKNOWN_STATUS_STYLE,
  DOCUMENT_TYPE_BADGE, PID_VISION_CONFIG, SCAN_CALLS_PER_PAGE_QUICK, SCAN_CALLS_PER_PAGE_THOROUGH,
  VISION_ESTIMATE,
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
  MessagesSquare, List, Link2, BookOpen,
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

const DocTypePill = ({ documentType }) => {
  const t = DOCUMENT_TYPE_BADGE[documentType] || DOCUMENT_TYPE_BADGE.io_list
  return <RawBadge bg={t.bg} fg={t.fg} dot={t.dot}>{t.label}</RawBadge>
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
// Background processing progress — every number here is real, live
// backend state (see each field's own comment below); no fake timers, no
// simulated animation, no rotating cosmetic text. Two real percentage
// sources, finer one preferred:
//   - vision_calls_done/vision_calls_total (P&ID Vision path only): ticks
//     on EVERY individual Vision API call finishing (tasks.py's
//     process_pid_vision_page, via pid_vision_extractor's
//     on_call_complete) — far more granular than whole-page completion,
//     which is what made this sit visibly frozen at 0% for minutes on a
//     small page count (a real, reported symptom).
//   - pages_processed/pages_total: the fallback for a regular I/O List
//     table document, or a P&ID page falling back to local OCR (no
//     per-call concept there).
// Before the first poll tick returns (nothing to divide by yet), shows an
// indeterminate "starting" state rather than a bar frozen at 0% or
// jumping straight to some number.
//
// UI FIX: this used to render at the very top of the page, above the
// project header / legend section / everything — so on a scrolled-down
// view it was completely out of sight from the "Upload & Extract" button
// that started the very upload it's reporting on. Extracted into its own
// component so ListView can render it immediately next to UploadCard, and
// DetailView can render it next to its own "Re-extract" button — both
// upload and re-extract now show the identical engaging panel.
const ProcessingBanner = ({ processingDoc, processingMeta }) => {
  // Forces a re-render once a second while something is actively
  // extracting, purely so "Time elapsed" visibly counts up smoothly
  // (2:30 → 2:31 → 2:32) instead of only refreshing on the ~2s poll
  // cadence. NOT a fake progress timer — it doesn't invent or advance
  // any number itself; elapsedLabel below is still always computed fresh
  // from the real extraction_started_at server timestamp vs the real
  // current time. This tick just makes that real computation visible
  // more often.
  const [, forceTick] = useState(0)
  const isDone = processingDoc?.status === 'completed'
  useEffect(() => {
    if (!processingDoc || isDone) return undefined
    const iv = setInterval(() => forceTick(t => t + 1), 1000)
    return () => clearInterval(iv)
  }, [processingDoc?.id, isDone])

  if (!processingDoc) return null
  const pagesTotal = processingDoc.pages_total || 0
  const pagesDone = Math.min(processingDoc.pages_processed || 0, pagesTotal)
  const callsTotal = processingDoc.vision_calls_total || 0
  const callsDone = Math.min(processingDoc.vision_calls_done || 0, callsTotal)

  // Finer P&ID-Vision-call percentage when it's actually available,
  // otherwise the coarser whole-page one — never both, never guessed.
  let pct = null
  if (isDone) {
    pct = 100
  } else if (callsTotal > 0) {
    pct = Math.round((callsDone / callsTotal) * 100)
  } else if (pagesTotal > 0) {
    pct = Math.round((pagesDone / pagesTotal) * 100)
  }

  // Message driven ENTIRELY by real backend fields — current_phase (see
  // IOListDocument.PHASE_CHOICES), plus, when the finer per-call counter
  // is running, exactly which pass/tile that counter is on right now
  // (derived by real arithmetic on real counts, not invented). Falls
  // back to a phase-agnostic "Processing…" only for a brand-new poll
  // tick that hasn't returned a phase yet.
  const phase = processingDoc.current_phase || ''
  const callsPerPage = pagesTotal > 0 && callsTotal > 0 ? callsTotal / pagesTotal : 0
  let label
  if (isDone) {
    const found = processingDoc.current_rows ?? 0
    label = processingMeta.usingVision
      ? `Complete! ${found} tag${found === 1 ? '' : 's'} found!`
      : `Complete! ${found} row${found === 1 ? '' : 's'} found${processingDoc.current_comments ? ` and ${processingDoc.current_comments} comment${processingDoc.current_comments === 1 ? '' : 's'}` : ''}!`
  } else if (phase === 'detecting_type') {
    label = processingMeta.usingVision ? 'Detecting document type and preparing AI Vision…' : 'Detecting document type…'
  } else if (phase === 'processing_pages') {
    if (callsPerPage > 0) {
      // currentPageIdx: which page is actively being worked (0-indexed) —
      // real, from pagesDone (pages that have FULLY finished so far).
      const currentPageIdx = Math.min(pagesDone, Math.max(pagesTotal - 1, 0))
      const callsIntoCurrentPage = Math.max(0, callsDone - currentPageIdx * callsPerPage)
      const callIdx = Math.min(Math.floor(callsIntoCurrentPage), Math.max(callsPerPage - 1, 0))
      label = processingMeta.thorough
        ? `Analyzing page ${currentPageIdx + 1} of ${pagesTotal} with AI Vision — tile scan ${callIdx + 1} of ${callsPerPage} (Thorough Scan)…`
        : `Analyzing page ${currentPageIdx + 1} of ${pagesTotal} with AI Vision — pass ${callIdx + 1} of ${callsPerPage}…`
    } else if (pagesTotal > 0) {
      label = processingMeta.usingVision
        ? `Analyzing page ${Math.min(pagesDone + 1, pagesTotal)} of ${pagesTotal} with AI Vision…`
        : `Reading page ${Math.min(pagesDone + 1, pagesTotal)} of ${pagesTotal}…`
    } else {
      label = 'Processing pages…'
    }
  } else if (phase === 'linking_comments') {
    label = 'Linking comments to instrument tags…'
  } else if (phase === 'validating_legend') {
    label = 'Validating tags against legend…'
  } else {
    label = 'Processing…'
  }

  // Real elapsed time — a genuine wall-clock delta between now and
  // extraction_started_at (set once, server-side, at dispatch; never
  // touched again during the run — see the model field's own comment).
  // No client-side fake timer: this recomputes fresh on every render,
  // and this component already re-renders every ~2s from the real poll
  // loop, so the clock advances from real ticks, not a simulated one.
  let elapsedLabel = null
  let etaLabel = null
  if (processingDoc.extraction_started_at) {
    const startMs = new Date(processingDoc.extraction_started_at).getTime()
    const elapsedS = Math.max(0, Math.round((Date.now() - startMs) / 1000))
    const mm = Math.floor(elapsedS / 60)
    const ss = String(elapsedS % 60).padStart(2, '0')
    elapsedLabel = `${mm}:${ss}`
    // ETA — a plain derived estimate (elapsed / fraction-done * fraction-
    // remaining), same idea any download manager uses. Only shown once
    // there's enough real progress to make it more than a guess, and
    // never once already done.
    const fraction = pct !== null ? pct / 100 : 0
    if (!isDone && fraction >= 0.08 && elapsedS >= 3) {
      const remainingS = Math.round((elapsedS / fraction) * (1 - fraction))
      if (remainingS > 0) {
        const rmm = Math.floor(remainingS / 60)
        const rss = remainingS % 60
        etaLabel = rmm > 0 ? `~${rmm}m ${rss}s remaining` : `~${rss}s remaining`
      } else {
        etaLabel = 'almost done…'
      }
    }
  }

  const tagsOrRowsLabel = processingMeta.usingVision ? 'Tags found' : 'I/O Rows found'
  const tokensTotal = processingDoc.tokens_used_total || 0

  // Real stat cards — each one hidden until there's genuinely something
  // to show it (no card ever renders a fabricated 0/placeholder value).
  const cards = []
  if (pagesTotal > 0) {
    cards.push({ key: 'pages', icon: FileText, label: 'Pages', value: `${pagesDone} of ${pagesTotal}` })
  }
  if (processingDoc.current_rows > 0 || isDone) {
    cards.push({ key: 'tags', icon: Tag, label: tagsOrRowsLabel, value: processingDoc.current_rows ?? 0 })
  }
  if (processingDoc.current_comments > 0) {
    cards.push({ key: 'comments', icon: MessageSquare, label: 'Comments', value: processingDoc.current_comments })
  }
  if (elapsedLabel) {
    cards.push({ key: 'elapsed', icon: Clock, label: 'Time elapsed', value: elapsedLabel })
  }
  if (etaLabel) {
    cards.push({ key: 'eta', icon: Zap, label: 'Est. remaining', value: etaLabel })
  }
  if (tokensTotal > 0) {
    cards.push({ key: 'tokens', icon: Sparkles, label: 'Tokens used', value: tokensTotal.toLocaleString() })
  }

  return (
    <div className={`rounded-xl border p-4 space-y-3 shadow-sm transition-colors ${
      isDone ? 'bg-emerald-50 border-emerald-200' : 'bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-200'
    }`}>
      {/* Headline */}
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isDone ? 'bg-emerald-500' : 'bg-indigo-500'
        }`}>
          {isDone
            ? <CheckCircle2 className="w-5 h-5 text-white" />
            : <Loader2 className="w-5 h-5 text-white animate-spin" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-semibold truncate ${isDone ? 'text-emerald-800' : 'text-indigo-900'}`}>
            {processingDoc.document_number ? `"${processingDoc.document_number}"` : 'Document'}
          </div>
          <div className={`text-xs truncate ${isDone ? 'text-emerald-700' : 'text-indigo-600'}`}>{label}</div>
        </div>
        {pct !== null && (
          <span className={`text-lg font-bold tabular-nums flex-shrink-0 ${isDone ? 'text-emerald-600' : 'text-indigo-600'}`}>
            {pct}%
          </span>
        )}
      </div>

      {/* Animated progress bar */}
      <div className="w-full h-2.5 bg-white/70 rounded-full overflow-hidden border border-indigo-100">
        {pct !== null ? (
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${isDone ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-blue-500'}`}
            style={{ width: `${pct}%` }}
          />
        ) : (
          <div className="h-full w-1/3 bg-indigo-400 rounded-full animate-pulse" />
        )}
      </div>

      {/* Live stats — real grid cards, not plain text. Each one is real,
          live backend state; the grid only ever shows cards that have
          something genuine to display (see `cards` above). */}
      {cards.length > 0 && (
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(110px,1fr))]">
          {cards.map(({ key, icon: CardIcon, label: cardLabel, value }) => (
            <div key={key} className="bg-white rounded-lg border border-indigo-100 px-3 py-2 flex flex-col gap-0.5 shadow-sm">
              <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-400">
                <CardIcon className="w-3 h-3" /> {cardLabel}
              </div>
              <div className="text-sm font-bold text-slate-800 tabular-nums truncate">{value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Projects Panel — Full-featured project management modal
// ─────────────────────────────────────────────────────────────────────
// Full-page project workspace — landing view of the module (not a modal).
// Reuses the exact same CRUD logic/service calls the old modal panel used;
// only the wrapper markup and layout changed.
const ProjectsPanel = ({ onProjectSelected, documents = [] }) => {
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
  }, [statusFilter, categoryFilter, searchQuery])

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
        // BUG FIX: a newly created project was never auto-selected, so
        // activeProjectFilter stayed null and the next upload's UploadCard
        // got no projectId — the document landed as Unassigned even though
        // the user had just created (and presumably meant to use) this
        // project. Land the user directly in the new project's workspace.
        if (onProjectSelected) onProjectSelected(created)
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
    if (!(await radaiConfirm(`Delete project "${projectName}"? Documents will be unlinked but not deleted.`))) return
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

  return (
    <div className="space-y-4">
      {/* Section header — title + New Project (top right) */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <Folder className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{IO_LIST_WORKFLOW_PROJECT_COPY.panelTitle}</h2>
            <p className="text-xs text-slate-500 mt-0.5">Organize your IO List documents by project</p>
          </div>
        </div>
        {!showForm && (
          <button onClick={handleCreate}
                  className="text-sm font-semibold px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg hover:from-indigo-700 hover:to-blue-700 flex items-center gap-1.5 shadow-sm flex-shrink-0">
            <Plus className="w-4 h-4" /> {IO_LIST_WORKFLOW_PROJECT_COPY.createBtn}
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Search/filter toolbar */}
      {!showForm && (
        <div className={`${THEME.card} p-3 flex flex-wrap gap-2 items-center`}>
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
        </div>
      )}

      {/* Content area */}
      {showForm ? (
        /* Project form */
        <div className={THEME.card}>
          <form onSubmit={handleSave} className="max-w-3xl mx-auto space-y-4 p-6">
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
        </div>
      ) : loading ? (
        <Skeleton rows={6} />
      ) : projects.length === 0 ? (
        <div className={`${THEME.card} py-16 text-center`}>
          <div className="w-16 h-16 rounded-full bg-indigo-50 mx-auto flex items-center justify-center mb-4">
            <Folder className="w-8 h-8 text-indigo-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">{IO_LIST_WORKFLOW_PROJECT_COPY.emptyTitle}</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">{IO_LIST_WORKFLOW_PROJECT_COPY.emptySubtitle}</p>
          <button onClick={handleCreate}
                  className="mt-5 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg font-semibold flex items-center gap-2 mx-auto hover:from-indigo-700 hover:to-blue-700 shadow-sm">
            <Plus className="w-4 h-4" /> {IO_LIST_WORKFLOW_PROJECT_COPY.createBtn}
          </button>
        </div>
      ) : (
        /* Projects grid */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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

              {/* Created date */}
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <Calendar className="w-3 h-3" />
                {project.created_at ? new Date(project.created_at).toLocaleDateString() : '—'}
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  <FileText className="w-3 h-3 inline mr-1" />
                  {project.document_count || 0} document{(project.document_count || 0) !== 1 ? 's' : ''}
                </div>
                {onProjectSelected && (
                  <button
                    onClick={() => onProjectSelected(project)}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Open →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Upload card — inline, always visible inside a project's workspace
// (not a modal). I/O List only: no engine/OCR picker, no API key.
// ─────────────────────────────────────────────────────────────────────
const UploadCard = ({ onUploaded, projectId, projectName }) => {
  const [file, setFile]         = useState(null)
  const [meta, setMeta]         = useState({})
  const [progress, setProgress] = useState(0)
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState('')

  // Page count for the pre-extraction time/token ESTIMATE below the
  // Quick/Thorough Scan toggle — a real number from the backend
  // (getPdfPageCount, PyMuPDF-based — see its own comment for why a
  // client-side-only guess was tried and rejected as unreliable), not
  // detected locally. null while the check is running or if it failed —
  // the estimate simply doesn't render in that case rather than ever
  // showing a guess.
  const [pageCount, setPageCount] = useState(null)
  useEffect(() => {
    let cancelled = false
    setPageCount(null)
    if (!file) return undefined
    ioListWorkflowService.getPdfPageCount(file).then((n) => { if (!cancelled) setPageCount(n) })
    return () => { cancelled = true }
  }, [file])

  // P&ID drawing BYOK Vision options — collapsed by default (most uploads
  // are plain I/O List PDFs, which never touch these). sessionStorage-
  // persisted under I/O List's own keys (PID_VISION_CONFIG), cleared when
  // the tab closes — never sent anywhere except this one upload request.
  // BUG FIX: these were persisted under one GLOBAL key for the whole tab,
  // so a key entered for one project leaked into every other project
  // (including a brand-new one that had never seen a key) and showed up
  // pre-filled/"activated" before the user typed anything. Scoping the
  // storage key by project id gives each project its own independent
  // key — a genuinely new project reads nothing and starts clean.
  const visionApiKeyStorageKey = `${PID_VISION_CONFIG.sessionStorageApiKeyKey}::${projectId || 'unassigned'}`
  const visionProviderStorageKey = `${PID_VISION_CONFIG.sessionStorageProviderKey}::${projectId || 'unassigned'}`
  // Quick Scan (1 Vision call/page, fast/cheap) vs Thorough Scan (2x2
  // tiled, ~4 calls/page, more accurate on dense drawings) — same
  // project-scoped sessionStorage pattern as provider/key above, and same
  // UI convention as PIDVerification.jsx's own quick/thorough toggle.
  const thoroughScanStorageKey = `${PID_VISION_CONFIG.sessionStorageThoroughKey}::${projectId || 'unassigned'}`
  const [showPidOptions, setShowPidOptions] = useState(false)
  const [visionProvider, setVisionProvider] = useState(
    () => sessionStorage.getItem(visionProviderStorageKey) || PID_VISION_CONFIG.defaultProvider,
  )
  const [visionApiKey, setVisionApiKey] = useState(
    () => sessionStorage.getItem(visionApiKeyStorageKey) || '',
  )
  const [thoroughScan, setThoroughScan] = useState(
    () => sessionStorage.getItem(thoroughScanStorageKey) === 'true',
  )
  const [testingKey, setTestingKey] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const apiKeyInputRef = useRef(null)

  // A friendly, non-blocking nudge toward adding an API key — never a
  // hard requirement (basic OCR must stay a real, working option; a
  // sweet suggestion, not a wall). Only relevant once the user has
  // opened the P&ID options panel themselves (the one real, honest
  // signal available before upload that this is likely a P&ID drawing —
  // document_type itself isn't known until extraction finishes
  // server-side, so this can never be a hard "P&ID detected" check).
  // Gates the confirmation dialog below, not the button itself.
  const [showNoKeyConfirm, setShowNoKeyConfirm] = useState(false)

  const reset = () => {
    setFile(null); setMeta({}); setProgress(0); setBusy(false); setError('')
  }

  const handleTestConnection = async () => {
    if (!visionApiKey.trim()) { setTestResult({ valid: false, message: 'Enter an API key first.' }); return }
    setTestingKey(true); setTestResult(null)
    try {
      const res = await ioListWorkflowService.testVisionApiKey(visionProvider, visionApiKey.trim())
      setTestResult(res)
    } catch (err) {
      setTestResult({ valid: false, message: err.response?.data?.message || err.message })
    } finally {
      setTestingKey(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    // Project is required — there is no more "Unassigned" fallback.
    // Belt-and-suspenders alongside the disabled submit button below
    // (also covers a form submit triggered any other way, e.g. Enter key).
    if (!projectId) { setError('Please select or create a project first.'); return }
    if (!file) { setError('Please select a PDF file.'); return }
    // Friendly speed bump, not a wall — see showNoKeyConfirm's own
    // comment. Only asks once per click; "Continue with Basic OCR" in the
    // dialog calls doUpload() directly, bypassing this gate.
    if (showPidOptions && !visionApiKey.trim()) {
      setShowNoKeyConfirm(true)
      return
    }
    doUpload()
  }

  const doUpload = async () => {
    setBusy(true); setError(''); setProgress(0)
    try {
      // Scope the upload to the open project (if any) — the backend links
      // it via IOListDocument.project, and project_name is auto-filled from
      // the active project rather than typed (no visible field for it).
      // uploadDocument() forwards every metadata entry as a form field, so
      // no service-layer or backend change needed.
      const uploadMeta = projectId ? { ...meta, project: projectId } : { ...meta }
      if (projectName) uploadMeta.project_name = projectName
      // Only relevant if the backend detects a P&ID drawing PDF — ignored
      // otherwise. Sent whenever a key is present, whether or not the
      // "P&ID options" section is open, since detection happens server-side
      // after upload (the user may not know in advance which kind of PDF
      // they're dropping in).
      if (visionApiKey.trim()) {
        uploadMeta.vision_provider = visionProvider
        uploadMeta.vision_api_key = visionApiKey.trim()
        uploadMeta.thorough = thoroughScan ? 'true' : 'false'
        sessionStorage.setItem(visionProviderStorageKey, visionProvider)
        sessionStorage.setItem(visionApiKeyStorageKey, visionApiKey.trim())
        sessionStorage.setItem(thoroughScanStorageKey, thoroughScan ? 'true' : 'false')
      }
      const result = await ioListWorkflowService.uploadDocument({
        file, metadata: uploadMeta,
        onUploadProgress: (evt) => {
          if (evt.total) setProgress(Math.round((evt.loaded * 100) / evt.total))
        },
      })
      // Client-side-only hints (never from the server — underscore-
      // prefixed so they're visually distinct from the real API
      // response) so the processing banner can show accurate,
      // mode-aware text ("Analyzing with AI Vision" / "Thorough Scan")
      // while this document is still extracting, before its own
      // document_type is known (that's only decided once extraction
      // finishes — see orchestrator._detect_document_type).
      onUploaded({ ...result, _usingVision: Boolean(visionApiKey.trim()), _thorough: thoroughScan })
      reset()
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.error || err.message || 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={THEME.card}>
      {/* Header */}
      <div className={`bg-gradient-to-r ${THEME.bannerFrom} ${THEME.bannerVia} ${THEME.bannerTo} px-6 py-4 rounded-t-2xl flex items-center gap-3 text-white`}>
        <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center">
          <Upload className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold">{UPLOAD_CONFIG.title}</h3>
          <p className="text-xs text-indigo-100">Multi-revision document workflow</p>
        </div>
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
                <div className="text-sm font-medium">Drag & drop or click to select an I/O List PDF or P&ID drawing</div>
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

        {/* P&ID Drawing options — collapsible, off by default */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setShowPidOptions(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-violet-500" /> P&ID Drawing options
              {visionApiKey.trim() && <Badge tone="emerald">Key set</Badge>}
            </span>
            <span className="text-slate-400">{showPidOptions ? '▲' : '▼'}</span>
          </button>
          {showPidOptions && (
            <div className="p-3 space-y-2.5 border-t border-slate-200">
              <p className="text-[11px] text-slate-500">{PID_VISION_CONFIG.hint}</p>
              {/* Friendly, non-blocking nudge — API key stays genuinely
                  optional (basic OCR is a real, working fallback, not a
                  dead end), this just makes the trade-off pleasant to
                  understand up front rather than a surprise later. */}
              {!visionApiKey.trim() && (
                <p className="text-[11px] text-violet-700 bg-violet-50 border border-violet-100 rounded-lg px-2.5 py-2 flex items-start gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-px text-violet-500" />
                  <span>
                    For best results, add your Claude API key above! Without it,
                    we&apos;ll use basic OCR, which may miss many tags.
                  </span>
                </p>
              )}
              <div className="flex gap-2">
                <select
                  value={visionProvider}
                  onChange={(e) => { setVisionProvider(e.target.value); setTestResult(null) }}
                  className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                >
                  {PID_VISION_CONFIG.providers.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                <input
                  ref={apiKeyInputRef}
                  type="password"
                  value={visionApiKey}
                  onChange={(e) => { setVisionApiKey(e.target.value); setTestResult(null) }}
                  placeholder="API key (optional)"
                  className="flex-1 min-w-0 text-xs border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                />
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingKey || !visionApiKey.trim()}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1 flex-shrink-0"
                >
                  {testingKey ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Test
                </button>
              </div>
              {testResult && (
                <p className={`text-[11px] ${testResult.valid ? 'text-emerald-600' : 'text-red-600'}`}>
                  {testResult.message}
                </p>
              )}
              {/* Scan mode toggle — quick (1 call/page) vs thorough (2x2
                  tiled, ~4 calls/page) — same segmented-button pattern
                  PIDVerification.jsx uses for its own quick/thorough
                  toggle. */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setThoroughScan(false)}
                    className={`px-3 py-1.5 text-xs font-semibold ${!thoroughScan ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    Quick Scan
                  </button>
                  <button
                    type="button"
                    onClick={() => setThoroughScan(true)}
                    className={`px-3 py-1.5 text-xs font-semibold border-l border-slate-300 ${thoroughScan ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    Thorough Scan
                  </button>
                </div>
                <span className="text-[11px] text-slate-500">
                  {thoroughScan
                    ? `~${SCAN_CALLS_PER_PAGE_THOROUGH} API calls · ~${VISION_ESTIMATE.thorough.tokensPerPage.toLocaleString()} tokens/page (tiled — more accurate on dense drawings)`
                    : `~${SCAN_CALLS_PER_PAGE_QUICK} API calls · ~${VISION_ESTIMATE.quick.tokensPerPage.toLocaleString()} tokens/page (fast and cheap)`}
                </span>
              </div>
              {/* Pre-extraction ESTIMATE — updates once the backend's real
                  page count (getPdfPageCount) comes back for the selected
                  file, and again immediately on any scan-mode toggle. A
                  clearly-labelled prediction, not measured data — the
                  real, live numbers (ProcessingBanner) only exist once
                  extraction is actually running. Hidden entirely until a
                  page count is known, rather than ever showing a guess. */}
              {pageCount != null && (
                <p className="text-[11px] font-medium text-violet-700 bg-violet-50 border border-violet-100 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                  <Zap className="w-3 h-3 flex-shrink-0" />
                  {(() => {
                    const est = thoroughScan ? VISION_ESTIMATE.thorough : VISION_ESTIMATE.quick
                    const minutes = pageCount * est.minutesPerPage
                    const tokens = pageCount * est.tokensPerPage
                    return `Estimated: ~${minutes} min · ~${tokens.toLocaleString()} tokens (${pageCount} page${pageCount === 1 ? '' : 's'} detected)`
                  })()}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-3">
          {UPLOAD_CONFIG.fields.map(f => (
            <div key={f.key} className={f.key === 'crs_chain_id' ? 'col-span-2' : ''}>
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

        {/* Progress / error. BUG FIX: `progress` only ever tracked the
            FILE TRANSFER (axios onUploadProgress) — for a small PDF that
            reaches 100% in under a second, then just sat there frozen at
            "100%" for however long server-side extraction actually took,
            reading as "jumped to 100% instantly" / done-but-not-done.
            Split into two honestly-labelled phases: while the file is
            still going up, show its real transfer %; once transfer hits
            100% but the request hasn't resolved yet, switch to an
            explicitly INDETERMINATE "server is still working" state
            instead of a bar frozen at a number that looks complete. A
            genuinely large/slow request (page-fanout or a Vision key)
            goes through the async path instead — see UploadCard's own
            note — which gets REAL per-page percentage via
            pages_processed/pages_total; this bar can never show that for
            the synchronous path because the whole response only arrives
            once everything is already done. */}
        {busy && (
          <div>
            {progress < 100 ? (
              <>
                <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                  <span className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading document…</span>
                  <span className="font-semibold tabular-nums">{progress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all" style={{ width: `${progress}%` }} />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Extracting & analyzing — this can take a few seconds…
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full w-1/3 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full animate-pulse" />
                </div>
              </>
            )}
            <div className="text-[11px] text-slate-400 mt-1">Server-side PyMuPDF extraction — no AI cost incurred.</div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> <span>{error}</span>
          </div>
        )}

        {/* Project is required — no more "Unassigned" fallback. In normal
            navigation UploadCard is only reached after selecting/creating
            a project (see the projectId prop / IOListWorkflowPage's own
            routing), so this is a defensive message for any other path
            that might still land here without one. */}
        {!projectId && (
          <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Please select or create a project first.</span>
          </div>
        )}

        {/* Action — button stays enabled with no key (basic OCR is a
            real, working option, never blocked); its label just says so
            honestly once the P&ID options panel is open with no key
            entered, matching the friendly nudge above instead of quietly
            saying "Upload & Extract" and surprising the user later. */}
        <div className="flex justify-end pt-3 border-t border-slate-200">
          <button type="submit" disabled={busy || !file || !projectId}
                  className="px-5 py-2 text-sm font-semibold bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
            {busy
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Extracting…</>
              : showPidOptions && !visionApiKey.trim()
                ? <>Extract with Basic OCR ⚠️</>
                : <><Upload className="w-4 h-4" /> Upload & Extract</>}
          </button>
        </div>
      </form>

      {/* Sweet, non-blocking confirmation — appears once, only when the
          user has opened P&ID options and left the key blank, right when
          they click the button. Never a hard stop: "Continue with Basic
          OCR" always works. */}
      {showNoKeyConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setShowNoKeyConfirm(false)}>
          <div
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-violet-500" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Are you sure?</h4>
                <p className="text-sm text-slate-600 mt-1">
                  Without an API key, accuracy will be significantly lower.
                  Add a key for much better results!
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowNoKeyConfirm(false)
                  // Nice touch, not load-bearing — the field is already
                  // visible (P&ID options is open, or this dialog
                  // couldn't have appeared), just puts the cursor there.
                  apiKeyInputRef.current?.focus()
                }}
                className="flex-1 px-4 py-2 text-sm font-semibold bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg hover:from-indigo-700 hover:to-blue-700"
              >
                Add API Key
              </button>
              <button
                type="button"
                onClick={() => { setShowNoKeyConfirm(false); doUpload() }}
                className="flex-1 px-4 py-2 text-sm font-semibold border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                Continue with Basic OCR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Toolbar (search + filters + sort)
// ─────────────────────────────────────────────────────────────────────
const Toolbar = ({ search, setSearch, statusFilter, setStatusFilter, sortBy, setSortBy, onRefresh, totalCount }) => (
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
    <button onClick={onRefresh}
            className="text-sm px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-1.5">
      <RefreshCw className="w-4 h-4" /> Refresh
    </button>
  </div>
)

// ─────────────────────────────────────────────────────────────────────
// Assign-to-Project picker — small popover, no separate modal. Lists
// existing projects (click to assign) plus an inline "create new" field.
// ─────────────────────────────────────────────────────────────────────
const AssignProjectPicker = ({ onAssign, onClose }) => {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    ioListWorkflowProjectsService.listProjects()
      .then(data => setProjects(Array.isArray(data) ? data : (data.results || [])))
      .catch(err => setError(err.response?.data?.error || err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const onClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [onClose])

  const assignExisting = async (projectId) => {
    setBusy(true); setError('')
    try {
      await onAssign(projectId)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
      setBusy(false)
    }
  }

  const createAndAssign = async () => {
    if (!newName.trim()) return
    setBusy(true); setError('')
    try {
      const created = await ioListWorkflowProjectsService.createProject({ project_name: newName.trim() })
      await onAssign(created.id)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
      setBusy(false)
    }
  }

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 z-20 w-72 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-100 text-xs font-semibold text-slate-600">Assign to project</div>
      {error && <div className="px-3 py-2 text-xs text-red-600 bg-red-50 border-b border-red-100">{error}</div>}
      <div className="max-h-48 overflow-y-auto">
        {loading ? (
          <div className="px-3 py-3 text-xs text-slate-400">Loading projects…</div>
        ) : projects.length === 0 ? (
          <div className="px-3 py-3 text-xs text-slate-400">No existing projects yet.</div>
        ) : (
          projects.map(p => (
            <button
              key={p.id}
              onClick={() => assignExisting(p.id)}
              disabled={busy}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 disabled:opacity-50 flex items-center gap-2"
            >
              <Folder className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span className="truncate">{p.project_name}</span>
            </button>
          ))
        )}
      </div>
      <div className="p-2 border-t border-slate-100 flex items-center gap-1.5">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') createAndAssign() }}
          placeholder="New project name…"
          disabled={busy}
          className="flex-1 min-w-0 text-xs border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <button
          onClick={createAndAssign}
          disabled={busy || !newName.trim()}
          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-1 flex-shrink-0"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Create
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Document Row — one row in the "Previous Uploads" list inside a project
// ─────────────────────────────────────────────────────────────────────
const DocumentRow = ({ doc, onOpen, busy, onReExtract, onDownload, onAssignProject }) => {
  const stats = doc.extraction_stats || {}
  const [pickerOpen, setPickerOpen] = useState(false)
  return (
    <div className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50/60 transition-colors">
      <div className={`${THEME.iconBox} bg-indigo-50 text-indigo-600 flex-shrink-0`}>
        <FileText className="w-4 h-4" />
      </div>
      <button onClick={() => onOpen(doc.id)} className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium text-slate-800 truncate">{doc.document_number || `#${doc.id}`}</p>
        <p className="text-xs text-slate-400">
          {doc.created_at ? new Date(doc.created_at).toLocaleString() : '—'}
          {' · '}{stats.io_rows_found ?? 0} I/O rows{' · '}{stats.comments_found ?? 0} comments
        </p>
      </button>
      <DocStatusPill status={doc.status} />
      <DocTypePill documentType={doc.document_type} />
      {!doc.project && onAssignProject && (
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setPickerOpen(v => !v)}
            title="Assign this document to a project"
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:-translate-y-px transition-all"
          >
            <Folder className="w-3 h-3" /> Assign to Project
          </button>
          {pickerOpen && (
            <AssignProjectPicker
              onClose={() => setPickerOpen(false)}
              onAssign={async (projectId) => {
                await onAssignProject(doc.id, projectId)
                setPickerOpen(false)
              }}
            />
          )}
        </div>
      )}
      <button
        onClick={() => onDownload(doc)}
        title="Download xlsx"
        className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:-translate-y-px transition-all flex-shrink-0"
      >
        <Download className="w-3 h-3" /> Download xlsx
      </button>
      <button
        onClick={() => onReExtract(doc.id)}
        disabled={busy}
        title="Re-run extraction on this PDF"
        className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border border-violet-200 bg-violet-50 text-violet-700 hover:-translate-y-px transition-all disabled:opacity-50 flex-shrink-0"
      >
        {busy
          ? <><Loader2 className="w-3 h-3 animate-spin" /> Extracting…</>
          : <><RefreshCw className="w-3 h-3" /> Re-extract</>}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// List View
// ─────────────────────────────────────────────────────────────────────
const ListView = ({ documents, loading, onOpen, onUploaded, onRefresh, onBackToProjects, activeProjectFilter,
                    search, setSearch, statusFilter, setStatusFilter, sortBy, setSortBy,
                    rowBusyId, onRowReExtract, onRowDownload, onAssignProject,
                    processingDoc, processingMeta }) => {
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

  // Legend Sheets — isolated I/O List legend system (own backend table,
  // own copy of the modal, full 21-section parity with P&ID). Not
  // project-scoped (same as its P&ID counterpart) — one active legend per
  // (user, section). The card summary shows the 'instrument_index' section
  // specifically, since that's the one services/legend_comparison.py
  // actually reads at extraction time (IO_LEGEND_SECTION in models.py) —
  // the other 20 sections exist for browsing/parity but aren't wired into
  // the automated check.
  const [legendModalOpen, setLegendModalOpen] = useState(false)
  const [activeLegend, setActiveLegend] = useState(null)
  const refreshActiveLegend = useCallback(async () => {
    try {
      const rows = await listIoLegends('instrument_index')
      setActiveLegend((Array.isArray(rows) ? rows : []).find(l => l.is_active) || null)
    } catch {
      setActiveLegend(null)
    }
  }, [])
  useEffect(() => { refreshActiveLegend() }, [refreshActiveLegend])

  return (
    <div className="space-y-4">
      {/* Header — back button, icon, project name (no P&ID-style feature badges) */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBackToProjects}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg px-3 py-2 bg-white hover:bg-slate-50 flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" /> Projects
        </button>
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <Folder className="w-5 h-5 text-indigo-600" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 truncate">
          {activeProjectFilter?.project_name || 'Unassigned'}
        </h2>
      </div>

      {/* Project Legend Sheets — I/O List's own, independent legend system */}
      <div className={THEME.card}>
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-4 rounded-t-2xl flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Project Legend Sheets</h3>
              <p className="text-xs text-white/80">Tag-format rules applied when uploading I/O List PDFs</p>
            </div>
          </div>
          <button
            onClick={() => setLegendModalOpen(true)}
            className="text-sm font-semibold px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded-lg flex items-center gap-1.5"
          >
            <Settings className="w-4 h-4" /> Manage Legends
          </button>
        </div>
        <div className="px-5 py-3 flex items-center gap-2 text-sm">
          <span className={`w-2 h-2 rounded-full ${activeLegend ? 'bg-emerald-500' : 'bg-slate-300'}`} />
          {activeLegend ? (
            <>
              <span className="font-medium text-slate-900">Custom Legend Active</span>
              <span className="text-slate-400">—</span>
              <span className="text-slate-600">{activeLegend.name}</span>
              <span className="text-slate-400">
                ({(activeLegend.definition?.fields?.length) || 0} custom field{(activeLegend.definition?.fields?.length) !== 1 ? 's' : ''})
              </span>
            </>
          ) : (
            <span className="text-slate-500">No legend active — uploads won&apos;t be checked against a tag format</span>
          )}
        </div>
      </div>
      <LegendSheetsModal
        open={legendModalOpen}
        onClose={() => { setLegendModalOpen(false); refreshActiveLegend() }}
        onActiveChange={setActiveLegend}
      />

      {/* Upload I/O List PDF — always visible inside a project */}
      <UploadCard onUploaded={onUploaded} projectId={activeProjectFilter?.id} projectName={activeProjectFilter?.project_name} />

      {/* Live extraction progress — rendered right beneath the upload
          card (not at the very top of the page) so it's next to the
          "Upload & Extract" button that started it, visible without
          scrolling back up. */}
      <ProcessingBanner processingDoc={processingDoc} processingMeta={processingMeta} />

      <Toolbar
        search={search} setSearch={setSearch}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        sortBy={sortBy} setSortBy={setSortBy}
        totalCount={filtered.length}
        onRefresh={onRefresh}
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
        </div>
      ) : (
        <div className={THEME.card}>
          <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">Previous Uploads</h3>
            <span className="text-xs text-slate-400">({filtered.length})</span>
          </div>
          <div className="divide-y divide-slate-100">
            {filtered.map(d => (
              <DocumentRow
                key={d.id}
                doc={d}
                onOpen={onOpen}
                busy={rowBusyId === d.id}
                onReExtract={onRowReExtract}
                onDownload={onRowDownload}
                onAssignProject={onAssignProject}
              />
            ))}
          </div>
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
        {STATS_CARDS.map(s => {
          // Some cards read a different stats key/label for a P&ID drawing
          // document — e.g. io_table_pages is always 0 there (no page ever
          // gets classified 'io_table'), so 'I/O Pages' would misleadingly
          // read 0 even though the document has real pages. See
          // STATS_CARDS' pidDrawing override in ioListWorkflow.config.js.
          const override = doc.document_type === 'pid_drawing' ? s.pidDrawing : null
          const resolved = override ? { ...s, label: override.label } : s
          const valueKey = override ? override.key : s.key
          return <StatCard key={s.key} stat={resolved} value={stats[valueKey]} />
        })}
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
            <Row label="Time taken"       value={stats.elapsed_seconds != null ? formatMinSec(stats.elapsed_seconds) : '—'} />
            {/* Only meaningful for a P&ID drawing extracted via AI Vision
                (see tasks.py's finalize_io_document — scan_mode is only
                ever added to extraction_stats for document_type
                'pid_drawing'); absent entirely for a plain I/O List table
                document, so this row doesn't render for one. */}
            {stats.scan_mode && (
              <Row label="Scan mode" value={stats.scan_mode === 'thorough' ? 'Thorough Scan' : 'Quick Scan'} />
            )}
            {/* Real, cumulative token count summed across every Vision API
                call this run made (pid_vision_extractor's on_call_complete
                -> IOListDocument.tokens_used_total) — 0/absent for a plain
                I/O List table document, which never calls Vision. */}
            {stats.tokens_used_total > 0 && (
              <Row label="Total tokens used" value={<span className="tabular-nums">{stats.tokens_used_total.toLocaleString()}</span>} />
            )}
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

// Formats a real elapsed-seconds number (stats.elapsed_seconds, computed
// server-side — see orchestrator.combine_and_finalize) as "m:ss", same
// convention ProcessingBanner's own live elapsed clock uses while
// extraction is still running, so the metadata tab's final "Time taken"
// reads consistently with what the user watched count up during the run.
const formatMinSec = (totalSeconds) => {
  const s = Math.max(0, Math.round(totalSeconds))
  const mm = Math.floor(s / 60)
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

const Row = ({ label, value }) => (
  <div className="flex items-start justify-between gap-3">
    <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
    <span className="text-sm text-slate-800 text-right max-w-[60%] truncate">{value}</span>
  </div>
)

// ─────────────────────────────────────────────────────────────────────
// Detail — Legend Check tab
// ─────────────────────────────────────────────────────────────────────
const LegendFindingsPanel = ({ doc }) => {
  const findings = doc.legend_findings || []
  // Older extractions (persisted before typo-tolerant fuzzy matching was
  // added) never wrote a 'severity' key — treat those as 'error', same as
  // every hard mismatch always was before this distinction existed.
  const warningCount = findings.filter(f => f.severity === 'warning').length
  // "+ Add to Legend" only makes sense for a lookup-code miss (a value
  // genuinely absent from that section's lookup table) — every finding
  // shaped that way shares this exact substring (see
  // legend_comparison._lookup_code_finding); a tag-FORMAT mismatch is a
  // different kind of problem (nothing to add a row for) and doesn't say
  // this, so the button naturally doesn't show for those.
  const [addToLegend, setAddToLegend] = useState(null)

  // Detected symbols — informational only, NEVER flagged/validated (no
  // legend section exists to check a free-text symbol name against).
  // Aggregates every extracted row carrying a symbol_type: untagged
  // valve/piping symbols (kind 'symbol', no tag_number/equipment_tag/
  // line_tag at all) AND tagged instrument/equipment rows Vision also
  // gave a descriptive type to (e.g. tag 'PT-1600' + symbol_type
  // 'PRESSURE TRANSMITTER'). Grouped by type so 12 gate valves show as
  // one row with a count, not 12 separate lines.
  const symbolGroups = useMemo(() => {
    const groups = new Map()
    for (const row of doc.extracted_rows || []) {
      const symbolType = row.data?.symbol_type
      if (!symbolType) continue
      if (!groups.has(symbolType)) groups.set(symbolType, [])
      groups.get(symbolType).push({
        tag: row.tag_number || row.data?.equipment_tag || row.data?.line_tag || '',
        location: row.data?.location || '',
      })
    }
    return Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length)
  }, [doc.extracted_rows])
  const symbolTotal = symbolGroups.reduce((sum, [, items]) => sum + items.length, 0)

  return (
    <div className="space-y-4">
      {symbolGroups.length > 0 && (
        <div className={THEME.card}>
          <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
            <Tag className="w-4 h-4 text-violet-500" />
            <h3 className="text-sm font-semibold text-slate-900">Detected Symbols</h3>
            <span className="text-xs text-slate-400">
              ({symbolTotal} found — informational only, not validated)
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {symbolGroups.map(([symbolType, items]) => (
              <div key={symbolType} className="px-5 py-3 flex items-start gap-3">
                <Badge tone="violet">{items.length}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 font-medium">{symbolType}</p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {items.slice(0, 6).map((it, i) => (
                      <span key={i}>
                        {i > 0 && ' · '}
                        {it.tag || it.location || '—'}
                      </span>
                    ))}
                    {items.length > 6 && <> · +{items.length - 6} more</>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {findings.length === 0 ? (
        <div className={`${THEME.card} py-16 text-center`}>
          <div className="w-16 h-16 rounded-full bg-emerald-50 mx-auto flex items-center justify-center mb-4">
            <BookOpen className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">No legend issues found</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
            Either every checked row/comment matched the active legend&apos;s tag format, or
            no legend was active when this document was extracted.
          </p>
        </div>
      ) : (
        <div className={THEME.card}>
          <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">Legend Check</h3>
            <span className="text-xs text-slate-400">
              ({findings.length} issue{findings.length !== 1 ? 's' : ''}
              {warningCount > 0 && <>, {warningCount} possible typo{warningCount !== 1 ? 's' : ''}</>})
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {findings.map((f, i) => {
              const isWarning = f.severity === 'warning'
              const canAddToLegend = f.section && /not a recognised/i.test(f.issue || '')
              return (
                <div key={i} className="px-5 py-3 flex items-start gap-3">
                  <Badge tone={isWarning ? 'amber' : 'rose'}>
                    {isWarning ? 'Possible typo' : 'Error'}
                  </Badge>
                  <Badge tone={f.source === 'comment' ? 'sky' : 'slate'}>
                    {f.source === 'comment' ? 'Comment' : 'I/O Row'}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800">{f.issue}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      <span className="font-mono">{f.field}</span>: <span className="font-mono">{f.value || '—'}</span>
                      {f.section && <> · <span className="text-slate-400">{f.section}</span></>}
                      {f.expected && <> · expected <span className="font-mono">{f.expected}</span></>}
                    </p>
                  </div>
                  {canAddToLegend && (
                    <button
                      onClick={() => setAddToLegend({ section: f.section, code: f.value })}
                      className="flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:-translate-y-px transition-all flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add to Legend
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <AddToLegendModal
        isOpen={!!addToLegend}
        onClose={() => setAddToLegend(null)}
        initialSection={addToLegend?.section || ''}
        initialCode={addToLegend?.code || ''}
        lockSection
        lockCode
        onSaved={() => {}}
      />
    </div>
  )
}

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
const IOListPanel = ({ doc, filterTag, setFilterTag, showAllColumns, setShowAllColumns }) => {
  const [editMode, setEditMode]       = useState(false)
  const [localRows, setLocalRows]     = useState(null)   // optimistic overrides
  const [editingCell, setEditingCell] = useState(null)   // active cell key: 'rowId_field'
  const [savingCells, setSavingCells] = useState({})     // { 'rowId_field': 'saving'|'saved'|'error' }

  // Reset when the user navigates to a different document, AND whenever
  // this document's own data is refreshed from the server (re-extract) —
  // doc.id alone isn't enough: re-extract keeps the same document id but
  // wipes and recreates every extracted row with new ids (see
  // orchestrator.persist_extraction), so a stale localRows optimistic
  // override captured before the re-extract would otherwise keep masking
  // the freshly re-extracted rows indefinitely (the table looked like
  // re-extract "did nothing" even though the backend had genuinely
  // reprocessed). updated_at changes on every persist_extraction() save,
  // so it's a reliable signal that the underlying data actually refreshed.
  useEffect(() => {
    setLocalRows(null)
    setEditMode(false)
    setEditingCell(null)
    setSavingCells({})
  }, [doc.id, doc.updated_at])

  const rows = localRows || doc.extracted_rows || []
  // "Show relevant columns" (default) picks the right column set for THIS
  // document's actual extraction path — was a fixed 16-column list shown
  // for every document, and an io_list table document never populates
  // the 4 P&ID-only columns while a pid_drawing document never populates
  // the 8 io_list-only columns, so roughly half the visible columns were
  // guaranteed blank on every row. "Show all columns" is an explicit
  // opt-out back to the full 16-column list for anyone who wants to see
  // every column regardless (e.g. checking a genuinely-blank field isn't
  // hiding something).
  // BUG FIX: this used to be local state, invisible outside this
  // component — the "Download xlsx" button lives in DetailView's header,
  // a sibling, so it had no way to know which mode was selected and
  // always exported every column regardless. Lifted up to DetailView
  // (passed down as props) so both the on-screen toggle and the download
  // button share the exact same selection.
  const previewColumns = useMemo(
    () => (showAllColumns ? IO_PREVIEW_COLUMNS : getIoPreviewColumns(doc.document_type)),
    [showAllColumns, doc.document_type],
  )

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
          {/* Column toggle — "Show relevant columns" (default, adaptive to
              this document's document_type) vs "Show all columns" (the
              full fixed 16-column list) — same segmented-button pattern
              as the P&ID options' own Quick/Thorough Scan toggle. */}
          <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAllColumns(false)}
              className={`px-2.5 py-1 text-xs font-semibold ${!showAllColumns ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              Show relevant columns
            </button>
            <button
              type="button"
              onClick={() => setShowAllColumns(true)}
              className={`px-2.5 py-1 text-xs font-semibold border-l border-slate-300 ${showAllColumns ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              Show all columns
            </button>
          </div>
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
              {previewColumns.map(c => (
                <th key={c.key}
                    className={`text-left px-3 py-2.5 ${c.sticky ? 'sticky left-0 bg-slate-50 z-20' : ''}`}
                    style={{ minWidth: c.width }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className={THEME.tableRow}>
                {previewColumns.map(c => {
                  const val = c.key === 'tag_number' ? r.tag_number
                            : c.key === 'page_number' ? r.page_number
                            : (r.data || {})[c.key]
                  const cellKey = `${r.id}_${c.key}`
                  const canEdit = editMode
                    && IO_LIST_EDIT_CONFIG.enabled
                    && !IO_LIST_EDIT_CONFIG.nonEditableColumns.includes(c.key)
                  // BUG FIX: was 'val ?? <dash>' — the backend always fills
                  // an unset field with '' (empty string), never null/
                  // undefined, and '' ?? x evaluates to '' (nullish
                  // coalescing doesn't treat '' as nullish) — so the "—"
                  // placeholder never actually rendered; blank cells were
                  // genuinely empty <td>s with zero visual content.
                  const isBlank = val === null || val === undefined || val === ''
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
                        : <span className={`${c.sticky ? 'font-mono font-semibold text-indigo-700' : 'text-slate-700'} ${c.key === 'kind' ? 'capitalize' : ''}`}>
                            {isBlank ? <span className="text-slate-300">—</span> : val}
                          </span>
                      }
                    </td>
                  )
                })}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={previewColumns.length}
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
const MetadataPanel = ({ doc, onPreviewPdf }) => (
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
            <button type="button" onClick={onPreviewPdf}
                    className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700">
              <ExternalLink className="w-3.5 h-3.5" /> Open original PDF
            </button>
          </div>
        )}
      </div>
    </div>
  </div>
)

// ─────────────────────────────────────────────────────────────────────
// Detail View — tabbed
// ─────────────────────────────────────────────────────────────────────
const DetailView = ({ doc, onBack, onReExtract, onDownload, onDelete, busyAction, processingDoc, processingMeta }) => {
  const [activeTab, setActiveTab] = useState('overview')
  const [filterTag, setFilterTag] = useState('')
  // Lifted up from IOListPanel — see its own comment on this same state
  // for why (the "Download xlsx" button below needs to read it too).
  const [showAllColumns, setShowAllColumns] = useState(false)
  const [showPdfPreview, setShowPdfPreview] = useState(false)
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('')
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false)
  const [pdfPreviewError, setPdfPreviewError] = useState('')

  const closePdfPreview = useCallback(() => {
    setShowPdfPreview(false)
    setPdfPreviewUrl('')
    setPdfPreviewError('')
  }, [])

  const openPdfPreview = useCallback(async () => {
    setShowPdfPreview(true)
    setPdfPreviewLoading(true)
    setPdfPreviewError('')
    try {
      const blob = await ioListWorkflowService.getOriginalPdf(doc.id)
      setPdfPreviewUrl(window.URL.createObjectURL(blob))
    } catch (error) {
      setPdfPreviewError(
        error.response?.data?.detail
        || error.response?.data?.error
        || error.message
        || 'Unable to load the original PDF.',
      )
    } finally {
      setPdfPreviewLoading(false)
    }
  }, [doc.id])

  useEffect(() => () => {
    if (pdfPreviewUrl) window.URL.revokeObjectURL(pdfPreviewUrl)
  }, [pdfPreviewUrl])

  useEffect(() => {
    if (!showPdfPreview) return undefined
    const handleEscape = (event) => {
      if (event.key === 'Escape') closePdfPreview()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [showPdfPreview, closePdfPreview])

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
                <DocTypePill documentType={doc.document_type} />
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
              <button onClick={() => onDownload(showAllColumns ? 'all' : 'relevant')}
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

        {/* Tabs — a P&ID drawing has no Comments Resolution Sheet, so that
            tab is hidden for that document type only. */}
        <div className="px-6 border-t border-white/10 flex gap-1">
          {DETAIL_TABS
            .filter(t => !(t.id === 'comments' && doc.document_type === 'pid_drawing'))
            .map(t => {
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

      {/* Live re-extract progress — same engaging panel UploadCard's
          "Upload & Extract" shows, right next to this view's own
          "Re-extract" button up in the header, so both entry points give
          identical real-time feedback. Only shown when it's genuinely
          THIS document re-extracting (processingDoc.id matches). */}
      {processingDoc?.id === doc.id && (
        <ProcessingBanner processingDoc={processingDoc} processingMeta={processingMeta} />
      )}

      {/* Extraction warnings (e.g. "Add an API key for better accuracy"
          for a P&ID drawing extracted via basic OCR) — additive, never
          blocks viewing the extracted data. */}
      {doc.extraction_stats?.warnings?.length > 0 && (
        <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="flex-1">{doc.extraction_stats.warnings.join(' · ')}</span>
        </div>
      )}

      {/* Active panel */}
      {activeTab === 'overview' && <OverviewPanel doc={doc} />}
      {activeTab === 'comments' && <CommentsPanel doc={doc} filterTag={filterTag} setFilterTag={setFilterTag} />}
      {activeTab === 'iolist'   && <IOListPanel   doc={doc} filterTag={filterTag} setFilterTag={setFilterTag} showAllColumns={showAllColumns} setShowAllColumns={setShowAllColumns} />}
      {activeTab === 'legend'   && <LegendFindingsPanel doc={doc} />}
      {activeTab === 'metadata' && <MetadataPanel doc={doc} onPreviewPdf={openPdfPreview} />}

      {showPdfPreview && doc.pdf_url && (
        <div className="fixed inset-0 z-[100] bg-slate-950/75 p-3 sm:p-6 flex items-center justify-center"
             role="dialog" aria-modal="true" aria-label="Original PDF preview"
             onMouseDown={(event) => {
               if (event.target === event.currentTarget) closePdfPreview()
             }}>
          <div className="w-full h-full max-w-[1600px] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 truncate">
                  {doc.document_number || `Document #${doc.id}`} · Original PDF
                </h3>
                <p className="text-xs text-slate-500 truncate">{doc.pdf_url.split('/').pop()}</p>
              </div>
              <button type="button" onClick={closePdfPreview}
                      aria-label="Close PDF preview"
                      className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative w-full flex-1 bg-slate-100">
              {pdfPreviewLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-600">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                  <span className="text-sm">Loading original PDF…</span>
                </div>
              )}
              {!pdfPreviewLoading && pdfPreviewError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <AlertTriangle className="w-9 h-9 text-red-500" />
                  <p className="text-sm font-medium text-slate-800">PDF preview could not be loaded</p>
                  <p className="text-xs text-slate-500 max-w-xl">{pdfPreviewError}</p>
                  <button type="button" onClick={openPdfPreview}
                          className="px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
                    Try again
                  </button>
                </div>
              )}
              {pdfPreviewUrl && !pdfPreviewError && (
                <iframe
                  title={`${doc.document_number || 'Document'} original PDF`}
                  src={pdfPreviewUrl}
                  className="absolute inset-0 w-full h-full border-0"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Page root
// ─────────────────────────────────────────────────────────────────────
export default function IOListWorkflowPage() {
  const [documents, setDocuments]     = useState([])
  const [loading, setLoading]         = useState(false)
  const [activeDoc, setActiveDoc]     = useState(null)
  const [pageError, setPageError]     = useState('')
  const [busyAction, setBusyAction]   = useState('')
  // Per-row Re-extract loading state, for the document list inside a project
  // (separate from busyAction, which tracks the same action inside DetailView)
  const [rowBusyId, setRowBusyId]     = useState(null)
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy]           = useState(SORT_OPTIONS[0].value)
  
  // Project workspace state — no project selected = show the project card
  // grid (the module's landing view); a selected project scopes the
  // document list and new uploads to it.
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

  // Large-PDF background processing (services/tasks.py's Celery fan-out —
  // backend dispatches this instead of extracting inline when a PDF has
  // more than PAGE_FANOUT_THRESHOLD pages, per instrument_io_workflow's
  // services/config.py). Poll until the document leaves 'extracting'.
  const [processingDoc, setProcessingDoc] = useState(null)

  // Merges one document into `documents` state synchronously (add or
  // update by id) — used so the list is correct the INSTANT a screen that
  // reads it renders, rather than only after loadDocuments()'s background
  // GET resolves. Without this, clicking "back" right after an upload
  // could briefly (or, on a first-ever upload, indefinitely until a full
  // reload) show the pre-upload — possibly empty — list, since
  // loadDocuments() below is fire-and-forget, not awaited.
  const upsertDocument = (doc) => {
    if (!doc?.id) return
    setDocuments(prev => {
      const idx = prev.findIndex(d => d.id === doc.id)
      if (idx === -1) return [doc, ...prev]
      const next = [...prev]
      next[idx] = { ...next[idx], ...doc }
      return next
    })
  }

  // BUG FIX: a fresh upload that goes through the async/background path
  // (over PAGE_FANOUT_THRESHOLD pages — see the uploadDocument()
  // processing-flag fix this pairs with) correctly showed the "Processing
  // large PDF…" banner, but never actually opened the document once
  // finished — the user had to go back to the list and click in
  // manually. Tracks which document (if any) should auto-open its detail
  // view the instant background processing completes; set ONLY by a
  // fresh upload (the user is actively waiting on this specific result),
  // never by handleRowReExtract (a list-row re-extract must not hijack
  // whatever the user is currently looking at).
  const [autoOpenDocId, setAutoOpenDocId] = useState(null)

  // Client-side hints for the processing banner's mode-aware text —
  // see handleSubmit's own comment (_usingVision/_thorough on `result`).
  // Not authoritative (the server hasn't decided document_type yet while
  // this is still 'extracting') — purely cosmetic wording.
  const [processingMeta, setProcessingMeta] = useState({ usingVision: false, thorough: false })

  const handleUploaded = (result) => {
    if (!result?.document) return
    upsertDocument(result.document)
    if (result.processing) {
      setProcessingDoc(result.document)
      setProcessingMeta({ usingVision: Boolean(result._usingVision), thorough: Boolean(result._thorough) })
      setAutoOpenDocId(result.document.id)
      loadDocuments()
    } else {
      setActiveDoc(result.document)
      loadDocuments()
    }
  }

  useEffect(() => {
    if (!processingDoc?.id) return
    // 2s — real requirement: "poll every 2 seconds" for live progress.
    // status_view (views.py) is deliberately lightweight (no nested
    // rows/comments serialization) specifically so polling this
    // frequently is cheap.
    const POLL_INTERVAL_MS = 2000
    const POLL_MAX_DURATION_MS = 30 * 60 * 1000
    const startTs = Date.now()
    const docId = processingDoc.id

    const interval = setInterval(async () => {
      if (Date.now() - startTs > POLL_MAX_DURATION_MS) {
        clearInterval(interval)
        setProcessingDoc(null)
        setPageError('Processing is taking longer than expected — it may still be running on the server. Refresh to check later.')
        return
      }
      try {
        // Lightweight poll every tick — real numbers straight off the DB
        // (pages_processed/pages_total/current_rows/current_comments),
        // nothing estimated or animated. Merged onto the existing
        // processingDoc rather than replacing it outright, since the
        // status payload doesn't carry document_number/project etc.
        const stats = await ioListWorkflowService.getDocumentStatus(docId)
        setProcessingDoc(prev => (prev ? { ...prev, ...stats } : stats))

        if (stats.status === 'completed' || stats.status === 'failed') {
          clearInterval(interval)
          // Only NOW fetch the full document (rows/comments included) —
          // once, on the transition out of 'extracting', not on every
          // 2s tick.
          const doc = await ioListWorkflowService.getDocument(docId)
          upsertDocument(doc)
          // If this document is also the one open in DetailView (e.g. a
          // re-extract triggered from there), keep it in sync too —
          // swaps in the final result automatically, no manual re-open.
          setActiveDoc(prev => (prev?.id === docId ? doc : prev))
          if (stats.status === 'completed') {
            // Real final counts straight from the completed document's
            // own extraction_stats (already computed server-side after
            // dedup/backfill — see orchestrator.combine_and_finalize) —
            // not the mid-run provisional current_rows/current_comments
            // this same banner showed a moment ago.
            const rowsFound = doc.extraction_stats?.io_rows_found ?? doc.extracted_rows?.length ?? 0
            const commentsFound = doc.extraction_stats?.comments_found ?? doc.extracted_comments?.length ?? 0
            toast.success(`Complete! Found ${rowsFound} row${rowsFound === 1 ? '' : 's'} and ${commentsFound} comment${commentsFound === 1 ? '' : 's'}`)
            // Real, brief "Complete!" state in the ProcessingBanner itself
            // (not just the toast) — the same panel the user was watching
            // switches to its done state with the final real counts,
            // then clears after a couple of real seconds so it doesn't
            // linger forever. Not a fake progress tick — the numbers
            // shown are the genuine final ones, this is only a dismissal
            // delay.
            setProcessingDoc(prev => (prev ? {
              ...prev, status: 'completed', current_rows: rowsFound, current_comments: commentsFound,
            } : prev))
            setTimeout(() => setProcessingDoc(prev => (prev?.id === docId ? null : prev)), 2500)
            // Auto-open only for the document a fresh upload is waiting
            // on — see autoOpenDocId's own comment above.
            if (autoOpenDocId === docId) {
              setActiveDoc(doc)
              setAutoOpenDocId(null)
            }
          } else {
            setProcessingDoc(null)
            if (autoOpenDocId === docId) setAutoOpenDocId(null)
            setPageError(doc.extraction_error || 'Extraction failed.')
          }
          loadDocuments()
        }
      } catch {
        // transient network/error — next tick retries
      }
    }, POLL_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [processingDoc?.id])


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

  // reExtract() always returns {processing, document} now (see views.py's
  // re_extract — both its sync and async branches wrap the same way, same
  // envelope create()/uploadDocument() already use). A large document
  // (> PAGE_FANOUT_THRESHOLD pages) re-extracts asynchronously, same as a
  // large upload — hand it to the same processingDoc polling flow rather
  // than treating the 202 response as if it were the finished document.
  // Re-extract had no way to ever supply a BYOK Vision key — it was a
  // bare POST with no body, so a P&ID drawing document always fell back
  // to local OCR on re-extract even when the user had already typed a
  // working key in during upload. Reuses the SAME sessionStorage entry
  // UploadCard reads/writes (PID_VISION_CONFIG's keys), so re-extract
  // "just works" with whatever key was last provided, without needing
  // its own separate key-entry UI on this page.
  // Reads the SAME project-scoped sessionStorage keys UploadCard writes to
  // (see its BUG FIX comment) — re-extract runs inside a selected project's
  // workspace, so activeProjectFilter is the right scope to look under.
  const getPersistedVisionMeta = () => {
    const scope = activeProjectFilter?.id || 'unassigned'
    const apiKey = sessionStorage.getItem(`${PID_VISION_CONFIG.sessionStorageApiKeyKey}::${scope}`) || ''
    if (!apiKey.trim()) return {}
    const provider = sessionStorage.getItem(`${PID_VISION_CONFIG.sessionStorageProviderKey}::${scope}`) || PID_VISION_CONFIG.defaultProvider
    const thorough = sessionStorage.getItem(`${PID_VISION_CONFIG.sessionStorageThoroughKey}::${scope}`) === 'true'
    return { vision_provider: provider, vision_api_key: apiKey.trim(), thorough: thorough ? 'true' : 'false' }
  }

  const handleReExtract = async () => {
    if (!activeDoc) return
    setBusyAction('re')
    try {
      const visionMeta = getPersistedVisionMeta()
      const result = await ioListWorkflowService.reExtract(activeDoc.id, visionMeta)
      upsertDocument(result.document)
      if (result.processing) {
        setProcessingDoc(result.document)
        setProcessingMeta({ usingVision: Boolean(visionMeta.vision_api_key), thorough: visionMeta.thorough === 'true' })
      } else {
        setActiveDoc(result.document)
      }
      loadDocuments()
    } catch (err) {
      setPageError(err.response?.data?.error || err.message)
    } finally {
      setBusyAction('')
    }
  }

  // Row-level actions for the document list inside a project — same service
  // calls as above, callable per-row without first opening the document.
  const handleRowReExtract = async (id) => {
    setRowBusyId(id)
    try {
      const visionMeta = getPersistedVisionMeta()
      const result = await ioListWorkflowService.reExtract(id, visionMeta)
      upsertDocument(result.document)
      if (result.processing) {
        setProcessingDoc(result.document)
        // BUG FIX: this used to leave processingMeta at whatever a
        // PREVIOUS upload/re-extract had set it to — a stale
        // usingVision/thorough flag now visibly wrong in ProcessingBanner's
        // labeling (e.g. showing "Analyzing with AI Vision" for a plain
        // I/O List table re-extract, or vice versa). Same fix
        // handleReExtract already applies for the DetailView button.
        setProcessingMeta({ usingVision: Boolean(visionMeta.vision_api_key), thorough: visionMeta.thorough === 'true' })
      }
      loadDocuments()
    } catch (err) {
      setPageError(err.response?.data?.error || err.message)
    } finally {
      setRowBusyId(null)
    }
  }

  // Assign an unassigned document to an existing or newly-created project.
  const handleAssignProject = async (docId, projectId) => {
    try {
      const updated = await ioListWorkflowService.assignProject(docId, projectId)
      upsertDocument(updated)
      loadDocuments()
    } catch (err) {
      setPageError(err.response?.data?.error || err.message)
    }
  }

  const handleRowDownload = (doc) => {
    const name = `IOList_${doc.document_number || doc.id}_${doc.revision_label || 'rev'}.xlsx`
    ioListWorkflowService.downloadXlsx(doc.id, name)
  }

  // columns: 'relevant' | 'all' — forwarded from DetailView's own
  // "Show relevant/all columns" toggle so the download matches whatever
  // the I/O List Table preview currently shows. Defaults to 'all' (the
  // service's own default) when called without an argument.
  const handleDownload = (columns) => {
    if (!activeDoc) return
    const name = `IOList_${activeDoc.document_number || activeDoc.id}_${activeDoc.revision_label || 'rev'}.xlsx`
    ioListWorkflowService.downloadXlsx(activeDoc.id, name, columns)
  }

  const handleDelete = async () => {
    if (!activeDoc) return
    if (!(await radaiConfirm('Delete this document and all extracted rows? This action cannot be undone.'))) return
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
        {activeDoc ? (
          <DetailView
            doc={activeDoc}
            onBack={() => setActiveDoc(null)}
            onReExtract={handleReExtract}
            onDownload={handleDownload}
            onDelete={handleDelete}
            busyAction={busyAction}
            processingDoc={processingDoc}
            processingMeta={processingMeta}
          />
        ) : !activeProjectFilter && IO_LIST_WORKFLOW_PROJECT_FEATURES.enableProjectManagement ? (
          /* Landing view: project workspace (cards, New Project, Edit/Delete) */
          <ProjectsPanel onProjectSelected={handleProjectSelected} documents={documents} />
        ) : (
          /* Inside a project (or project management disabled): document list */
          <ListView
            documents={documents}
            loading={loading}
            onOpen={handleOpen}
            onUploaded={handleUploaded}
            onRefresh={loadDocuments}
            onBackToProjects={() => setActiveProjectFilter(null)}
            activeProjectFilter={activeProjectFilter}
            search={search} setSearch={setSearch}
            statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            sortBy={sortBy} setSortBy={setSortBy}
            rowBusyId={rowBusyId}
            onRowReExtract={handleRowReExtract}
            onRowDownload={handleRowDownload}
            onAssignProject={handleAssignProject}
            processingDoc={processingDoc}
            processingMeta={processingMeta}
          />
        )}
      </div>
    </div>
  )
}
