import { useMemo, useState, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { toast } from 'react-toastify'
import {
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  CircleStackIcon,
  SparklesIcon,
  TableCellsIcon,
  CheckBadgeIcon,
  DocumentArrowUpIcon,
  CodeBracketIcon,
  CpuChipIcon,
  BoltIcon,
  ChartBarSquareIcon,
  ShieldCheckIcon,
  FolderPlusIcon,
  FolderOpenIcon,
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  ArrowLeftIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

import {
  buildCableScheduleRowsFromInstruments,
  CABLE_SCHEDULE_COLUMNS,
} from '../../../utils/instrumentIndexToCableScheduleRows'
import {
  CABLE_SCHEDULE_PROJECT_STATUSES,
  CABLE_SCHEDULE_PROJECT_FIELDS,
  CABLE_SCHEDULE_PROJECT_COPY,
  CABLE_SCHEDULE_PROJECT_CATEGORIES,
} from '../../../config/cableScheduleProjects.config'
import {
  listProjects   as listCableBlockProjects,
  createProject  as createCableBlockProject,
  updateProject  as updateCableBlockProject,
  deleteProject  as deleteCableBlockProject,
  attachCableScheduleToProject,
} from '../../../services/cableScheduleProjectsService'
import { getApiBaseUrl } from '../../../config/environment.config'
import { STORAGE_KEYS } from '../../../config/app.config'

// ─── Soft-coded UI configuration ─────────────────────────────────────────────
const PAGE_CONFIG = {
  title:               'Cable Schedule Generator',
  subtitle:            'AI-assisted Instrument Cable Schedule built from your Instrument Index',
  aiBadge:             'AI-Powered',
  brandGradient:       'from-emerald-600 via-teal-600 to-cyan-600',
  brandRingGradient:   'from-emerald-500/30 via-blue-500/30 to-cyan-500/30',
  instrumentIndexLink: '/engineering/instrument/index',
}
// ─── Layout (soft-coded — page is rendered inside the app shell's <Outlet>) ─
// The parent layout already provides its own fixed top nav + height, so this
// page must NOT claim min-h-screen (that would push the hero below the fold).
// Adjust here without touching JSX. Values intentionally compact so the hero
// is fully visible on a 768-px viewport without any scroll.
const LAYOUT_CONFIG = {
  wrapper:        'w-full bg-gradient-to-br from-slate-50 via-white to-purple-50/40',
  contentMaxW:    'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
  heroPaddingY:   'pt-4 pb-5 sm:pt-5 sm:pb-6',
  sectionGapY:    'pt-2',
  cardGapY:       'py-6',
  // Blur background — absolute, but clamped to the hero so it can never
  // overflow above the parent navbar.
  heroBlurClass:  'absolute inset-x-0 top-0 h-full pointer-events-none blur-3xl opacity-50',
}
const FEATURE_HIGHLIGHTS = [
  {
    icon: CpuChipIcon,
    title: 'Cable code library',
    desc:  'Soft-coded cable-type lookup (A10 / A11 / A12 / B7 / B10) — tune the catalogue in one place.',
  },
  {
    icon: BoltIcon,
    title: 'From / To routing',
    desc:  'Field-cable rows (instrument → JB) + multicore rows (JB → Marshalling Cabinet) auto-emitted.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Gland & voltage defaults',
    desc:  'Gland sizes (M20 / M25 / M32) and signal voltage assigned per role and IS / NIS.',
  },
  {
    icon: ChartBarSquareIcon,
    title: 'ADNOC Schedule template',
    desc:  'Excel export ready for review against the standard ADNOC Instrument Cable Schedule.',
  },
]

const DEFAULT_INCLUDE_INDICATORS = false
const MAX_PREVIEW_ROWS           = 25
const PREVIEW_COLUMN_COUNT       = 12
const DOWNLOAD_FILENAME          = 'Cable_Schedule_from_Instrument_Index.xlsx'
const ACCEPTED_EXCEL_EXT         = '.xlsx,.xls,.csv'

// ─── Soft-coded Instrument Index report (mirrors /engineering/instrument/index) ─
// Rendered after a P&ID extraction so the user gets the SAME report on this page
// without leaving — no core logic duplicated, just the read-only display layer.
const INSTRUMENT_INDEX_REPORT_CONFIG = {
  title:           'Instrument Index Report',
  subtitle:        'AI-extracted instrument tags from the uploaded P&ID',
  maxPreviewRows:  50,                       // table preview cap (download has all rows)
  downloadLabel:   'Download Instrument Index (.xlsx)',
  emptyHint:       'Run extraction from a P&ID PDF (Stage 1) to populate this report.',
  // Column projection — keeps the table readable on narrow screens. Add/remove
  // freely; falls back to the instrument key if no value found.
  columns: [
    { key: 'index_no',         label: '#',           width: 'w-12' },
    { key: 'tag_number',       label: 'Tag No.',     width: 'w-32' },
    { key: 'category',         label: 'Category',    width: 'w-28' },
    { key: 'service',          label: 'Service',     width: 'w-56' },
    { key: 'line_or_equipment',label: 'Line / Equipment', width: 'w-40' },
    { key: 'function',         label: 'Function',    width: 'w-32' },
    { key: 'signal_type',      label: 'Signal',      width: 'w-24' },
    { key: 'location',         label: 'Location',    width: 'w-24' },
    { key: 'remarks',          label: 'Remarks',     width: 'w-48' },
  ],
  // Tailwind colour palette per category — first-match wins, default last.
  categoryColors: {
    Flow:        'bg-cyan-100 text-cyan-800 border-cyan-200',
    Pressure:    'bg-rose-100 text-rose-800 border-rose-200',
    Temperature: 'bg-orange-100 text-orange-800 border-orange-200',
    Level:       'bg-emerald-100 text-emerald-800 border-emerald-200',
    Analysis:    'bg-violet-100 text-violet-800 border-violet-200',
    Valve:       'bg-amber-100 text-amber-800 border-amber-200',
    Safety:      'bg-red-100 text-red-800 border-red-200',
    default:     'bg-slate-100 text-slate-700 border-slate-200',
  },
}

// ─── Soft-coded P&ID → Instrument Index extraction config ───────────────────
// Mirrors the same backend endpoint and form fields used by the Instrument
// Index page so the user can go straight to IO List without a detour.
// Tune anything below without touching the runFromPid() handler.
const PID_EXTRACT_CONFIG = {
  endpoint:           '/pid/instrument-index/analyze/',
  acceptedPidExt:     '.pdf',
  acceptedLegendExt:  '.pdf',
  uploadTimeoutMs:    600_000,                       // 10 min — large P&IDs
  maxRetries:         2,
  retryBackoffBaseMs: 1500,
  retryBackoffFactor: 2,
  transientMarkers:   ['Failed to fetch', 'ERR_CONNECTION_RESET', 'NetworkError', 'network error'],
  defaultRevision:    '0',
  // Optional metadata fields rendered into the form. Add/remove freely.
  metaFields: [
    { key: 'drawing_number', label: 'Drawing Number',          placeholder: 'auto from filename', required: false },
    { key: 'drawing_title',  label: 'Drawing Title (optional)', placeholder: 'e.g. LP Steam Generator',  required: false },
  ],
}

// ─── Soft-coded 3-stage wizard ───────────────────────────────────────────────
// Stage 1 → "Instrument Index" source docs — P&ID PDF (+ optional Legend) that
//           the AI-vision extractor turns into the instrument register.
// Stage 2 → "IO List" source — the Instrument Index workbook (or pasted JSON)
//           that seeds the IO routing engine directly.
// Stage 3 → generator knobs + run/download
// Add / reorder stages here without touching the JSX.
const WIZARD_STAGES = [
  {
    id:       1,
    key:      'index',
    label:    'Instrument Index',
    title:    'Stage 1 — Instrument Index source documents',
    subtitle: 'Drop the P&ID PDF (and optional Legend PDF) — the AI-vision extractor builds the instrument register for you.',
    icon:     CpuChipIcon,
    accent:   'from-fuchsia-100 to-pink-100 text-fuchsia-700',
  },
  {
    id:       2,
    key:      'iolist',
    label:    'IO List',
    title:    'Stage 2 — Source workbook (Instrument Index)',
    subtitle: 'Already have an Instrument Index workbook (or JSON payload)? Drop it here to feed the IO routing engine directly.',
    icon:     DocumentArrowUpIcon,
    accent:   'from-violet-100 to-purple-100 text-purple-700',
  },
  {
    id:       3,
    key:      'tune',
    label:    'Tune & Generate',
    title:    'Stage 3 — Tune the generator',
    subtitle: 'Set the project context, then generate and download the Cable Schedule.',
    icon:     SparklesIcon,
    accent:   'from-indigo-100 to-blue-100 text-emerald-700',
  },
]

// Sub-modes inside Stage 2 (workbook vs JSON paste). Soft-coded so adding a new
// register source (e.g. Google Sheet) is a one-line change.
const IOLIST_SOURCE_MODES = [
  { id: 'file', label: 'Excel / CSV Upload', icon: DocumentArrowUpIcon },
  { id: 'json', label: 'Paste JSON Payload', icon: CodeBracketIcon },
]

const API_BASE = getApiBaseUrl()

function isTransientNetworkError(err) {
  const msg = String(err?.message || err || '')
  return PID_EXTRACT_CONFIG.transientMarkers.some((m) => msg.includes(m))
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function parseSheetToInstruments(workbook) {
  for (const name of workbook.SheetNames) {
    const ws   = workbook.Sheets[name]
    const json = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false })
    if (Array.isArray(json) && json.length > 0) return json
  }
  return []
}

function downloadIoListXlsx(rows) {
  const wb       = XLSX.utils.book_new()
  const header   = CABLE_SCHEDULE_COLUMNS.map((c) => c.label)
  const dataRows = rows.map((r) => CABLE_SCHEDULE_COLUMNS.map((c) => r[c.key] ?? ''))
  const ws       = XLSX.utils.aoa_to_sheet([header, ...dataRows])
  ws['!cols']    = CABLE_SCHEDULE_COLUMNS.map((c) => ({ wch: Math.max(10, c.label.length + 2) }))
  XLSX.utils.book_append_sheet(wb, ws, 'Cable Schedule')
  XLSX.writeFile(wb, DOWNLOAD_FILENAME)
}

// ─── Stat card (soft-coded mini KPI) ─────────────────────────────────────────
function StatCard({ label, value, accent = 'purple' }) {
  const ring = {
    purple:  'from-violet-100 to-purple-100 text-purple-700',
    indigo:  'from-indigo-100 to-blue-100 text-emerald-700',
    emerald: 'from-emerald-100 to-teal-100 text-emerald-700',
    amber:   'from-amber-100 to-orange-100 text-amber-700',
  }[accent] || 'from-gray-100 to-gray-200 text-gray-700'
  return (
    <div className={`rounded-xl px-4 py-3 bg-gradient-to-br ${ring} border border-white/60 shadow-sm`}>
      <div className="text-[11px] uppercase tracking-wider font-semibold opacity-80">{label}</div>
      <div className="text-2xl font-bold mt-0.5">{value}</div>
    </div>
  )
}

// ─── Project shell (soft-coded, fully self-contained) ────────────────────────
function ProjectsShell({ onOpen }) {
  const [search, setSearch]               = useState('')
  const [projects, setProjects]           = useState(() => listCableBlockProjects())
  const [showCreate, setShowCreate]       = useState(false)
  const [editing, setEditing]             = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [form, setForm]                   = useState(() =>
    Object.fromEntries(CABLE_SCHEDULE_PROJECT_FIELDS.map((f) => [f.key, f.defaultValue || ''])),
  )

  const refresh = (q = search) => setProjects(listCableBlockProjects({ search: q }))

  useEffect(() => { refresh() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const onSearch = (e) => {
    const v = e.target.value
    setSearch(v)
    refresh(v)
  }

  const resetForm = () => setForm(
    Object.fromEntries(CABLE_SCHEDULE_PROJECT_FIELDS.map((f) => [f.key, f.defaultValue || ''])),
  )

  const submitCreate = (e) => {
    e.preventDefault()
    try {
      const required = CABLE_SCHEDULE_PROJECT_FIELDS.filter((f) => f.required)
      for (const f of required) {
        if (!String(form[f.key] || '').trim()) {
          toast.warn(`${f.label} is required.`)
          return
        }
      }
      if (editing) {
        updateCableBlockProject(editing.id, form)
        toast.success('Project updated.')
      } else {
        createCableBlockProject(form)
        toast.success('Project created.')
      }
      setShowCreate(false)
      setEditing(null)
      resetForm()
      refresh()
    } catch (err) {
      toast.error(err?.message || 'Failed to save project.')
    }
  }

  const openEdit = (p) => {
    setEditing(p)
    setForm(Object.fromEntries(CABLE_SCHEDULE_PROJECT_FIELDS.map((f) => [f.key, p[f.key] ?? f.defaultValue ?? ''])))
    setShowCreate(true)
  }

  const doDelete = () => {
    if (!confirmDelete) return
    deleteCableBlockProject(confirmDelete.id)
    setConfirmDelete(null)
    toast.success('Project deleted.')
    refresh()
  }

  return (
    <section className={`${LAYOUT_CONFIG.contentMaxW} ${LAYOUT_CONFIG.cardGapY}`}>
      <div className="rounded-2xl bg-white border border-gray-200 shadow-lg overflow-hidden">
        <div className={`px-6 py-5 bg-gradient-to-r ${PAGE_CONFIG.brandGradient} text-white flex items-center gap-4`}>
          <div className="p-3 rounded-xl bg-white/15 backdrop-blur">
            <FolderOpenIcon className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">{CABLE_SCHEDULE_PROJECT_COPY.panelTitle}</h2>
            <p className="text-xs text-purple-100 mt-0.5">{CABLE_SCHEDULE_PROJECT_COPY.panelSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => { setEditing(null); resetForm(); setShowCreate(true) }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold backdrop-blur transition"
          >
            <FolderPlusIcon className="h-4 w-4" />
            {CABLE_SCHEDULE_PROJECT_COPY.createButton}
          </button>
        </div>

        <div className="px-6 py-4 border-b border-gray-100">
          <div className="relative">
            <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={onSearch}
              placeholder={CABLE_SCHEDULE_PROJECT_COPY.searchPlaceholder}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
        </div>

        <div className="p-6">
          {projects.length === 0 ? (
            <div className="text-center py-10">
              <div className="mx-auto h-14 w-14 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center text-purple-700">
                <FolderOpenIcon className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-gray-800">{CABLE_SCHEDULE_PROJECT_COPY.emptyHeading}</h3>
              <p className="mt-1 text-xs text-gray-500 max-w-md mx-auto">{CABLE_SCHEDULE_PROJECT_COPY.emptyBody}</p>
              <button
                type="button"
                onClick={() => { setEditing(null); resetForm(); setShowCreate(true) }}
                className={`mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow bg-gradient-to-r ${PAGE_CONFIG.brandGradient} hover:shadow-md transition`}
              >
                <FolderPlusIcon className="h-4 w-4" />
                {CABLE_SCHEDULE_PROJECT_COPY.createButton}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((p) => {
                const st  = CABLE_SCHEDULE_PROJECT_STATUSES[p.status] || CABLE_SCHEDULE_PROJECT_STATUSES.draft
                const cat = CABLE_SCHEDULE_PROJECT_CATEGORIES.find((c) => c.id === p.category) || CABLE_SCHEDULE_PROJECT_CATEGORIES[0]
                return (
                  <div
                    key={p.id}
                    className="group rounded-xl border border-gray-200 bg-white hover:border-purple-300 hover:shadow-md transition-all p-4 flex flex-col"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-gradient-to-br from-violet-100 to-purple-100 text-purple-700">
                        <FolderOpenIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{p.project_name}</h3>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {p.pid_no ? `P&ID ${p.pid_no} · ` : ''}Rev {p.revision || '0'}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${st.bg} ${st.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                    </div>
                    {cat && (
                      <span className={`mt-2 self-start inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cat.badgeBg} ${cat.badgeText} ${cat.badgeBorder}`}>
                        <span>{cat.icon}</span>
                        {cat.label}
                      </span>
                    )}
                    {p.description && (
                      <p className="mt-2 text-xs text-gray-600 line-clamp-2">{p.description}</p>
                    )}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-gray-500">
                      <div><span className="font-semibold text-gray-700">{p.cable_schedule_rows?.length || 0}</span> Schedule rows</div>
                      <div><span className="font-semibold text-gray-700">{p.source_count || 0}</span> source rows</div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpen(p)}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm bg-gradient-to-r ${PAGE_CONFIG.brandGradient} hover:shadow transition`}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        title="Edit"
                        onClick={() => openEdit(p)}
                        className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        onClick={() => setConfirmDelete(p)}
                        className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setShowCreate(false); setEditing(null) }}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitCreate}
            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden"
          >
            <div className={`px-5 py-4 bg-gradient-to-r ${PAGE_CONFIG.brandGradient} text-white flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <FolderPlusIcon className="h-5 w-5" />
                <h3 className="text-sm font-bold">{editing ? 'Edit Cable Schedule Project' : CABLE_SCHEDULE_PROJECT_COPY.createButton}</h3>
              </div>
              <button type="button" onClick={() => { setShowCreate(false); setEditing(null) }} className="p-1 rounded hover:bg-white/15">
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {CABLE_SCHEDULE_PROJECT_FIELDS.map((f) => (
                <label key={f.key} className="block text-sm">
                  <span className="block text-xs font-semibold text-gray-700 mb-1">
                    {f.label}{f.required && <span className="text-red-500"> *</span>}
                  </span>
                  {f.type === 'textarea' ? (
                    <textarea
                      value={form[f.key] || ''}
                      onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  ) : f.type === 'select' ? (
                    <>
                      <select
                        value={form[f.key] || f.defaultValue || ''}
                        onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
                      >
                        {(f.options || []).map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.icon ? `${opt.icon}  ` : ''}{opt.label}
                          </option>
                        ))}
                      </select>
                      {f.helpText && (
                        <span className="block mt-1 text-[11px] text-gray-500">{f.helpText}</span>
                      )}
                    </>
                  ) : (
                    <input
                      type="text"
                      value={form[f.key] || ''}
                      onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
              <button type="button" onClick={() => { setShowCreate(false); setEditing(null) }} className="px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">
                Cancel
              </button>
              <button type="submit" className={`px-4 py-2 rounded-lg text-sm font-semibold text-white shadow bg-gradient-to-r ${PAGE_CONFIG.brandGradient} hover:shadow-md transition`}>
                {editing ? 'Save changes' : 'Create project'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="px-5 py-4 bg-red-600 text-white">
              <h3 className="text-sm font-bold">{CABLE_SCHEDULE_PROJECT_COPY.deleteConfirmTitle}</h3>
            </div>
            <div className="p-5 text-sm text-gray-700">
              <p>{CABLE_SCHEDULE_PROJECT_COPY.deleteConfirmBody}</p>
              <p className="mt-3 text-xs text-gray-500">
                <span className="font-semibold text-gray-800">{confirmDelete.project_name}</span>
              </p>
            </div>
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">Cancel</button>
              <button type="button" onClick={doDelete} className="px-4 py-2 rounded-lg text-sm font-semibold text-white shadow bg-red-600 hover:bg-red-700 transition">Delete</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function CableSchedulePage() {
  // Project context (null = list view; object = working inside a project)
  const [activeProject, setActiveProject] = useState(null)

  // Wizard navigation (soft-coded — stages defined in WIZARD_STAGES)
  const [stage, setStage]             = useState(1)
  // Sub-mode for Stage 2 (IO List workbook source): 'file' or 'json'
  const [iolistMode, setIolistMode]   = useState('file')

  const [file, setFile]               = useState(null)
  const [rawJson, setRawJson]         = useState('')
  const [includeInd, setIncludeInd]   = useState(DEFAULT_INCLUDE_INDICATORS)
  const [pidNo, setPidNo]             = useState('')
  const [rev, setRev]                 = useState('0')
  const [busy, setBusy]               = useState(false)
  const [generated, setGenerated]     = useState([])
  const [sourceCount, setSourceCount] = useState(0)

  // ─── P&ID-PDF extraction state (soft-coded; matches Instrument Index form) ────
  const [pidPdfFile,    setPidPdfFile]    = useState(null)
  const [legendPdfFile, setLegendPdfFile] = useState(null)
  const [pidMeta, setPidMeta] = useState(() =>
    Object.fromEntries(PID_EXTRACT_CONFIG.metaFields.map((f) => [f.key, ''])),
  )
  const [extractStatus, setExtractStatus] = useState('')

  // Full backend payload from the P&ID extraction (instruments + drawing_info
  // + category_summary + excel_url). Powers the on-page Instrument Index
  // Report — identical data to the standalone /engineering/instrument/index page.
  const [pidIndexResult, setPidIndexResult] = useState(null)

  // When a project is opened, hydrate the generator form with its defaults
  // and any previously generated snapshot.
  const openProject = useCallback((p) => {
    setActiveProject(p)
    setPidNo(p.pid_no || '')
    setRev(p.revision || '0')
    setGenerated(Array.isArray(p.cable_schedule_rows) ? p.cable_schedule_rows : [])
    setSourceCount(p.source_count || 0)
    setFile(null)
    setRawJson('')
    setPidPdfFile(null)
    setLegendPdfFile(null)
    setPidMeta(Object.fromEntries(PID_EXTRACT_CONFIG.metaFields.map((f) => [f.key, ''])))
    setExtractStatus('')
  }, [])

  const exitProject = useCallback(() => {
    setActiveProject(null)
    setFile(null)
    setRawJson('')
    setGenerated([])
    setSourceCount(0)
    setPidPdfFile(null)
    setLegendPdfFile(null)
    setPidMeta(Object.fromEntries(PID_EXTRACT_CONFIG.metaFields.map((f) => [f.key, ''])))
    setExtractStatus('')
  }, [])

  const previewRows = useMemo(
    () => generated.slice(0, MAX_PREVIEW_ROWS),
    [generated],
  )

  const dcsCount = useMemo(
    () => generated.filter((r) => String(r.system || '').toUpperCase() === 'DCS').length,
    [generated],
  )
  const esdCount = useMemo(
    () => generated.filter((r) => String(r.system || '').toUpperCase() === 'ESD').length,
    [generated],
  )

  const handleFile = (e) => {
    const f = e.target.files?.[0]
    setFile(f || null)
    setGenerated([])
    setSourceCount(0)
  }

  const runFromFile = useCallback(async () => {
    if (!file) {
      toast.warn('Choose an Instrument Index spreadsheet first.')
      return
    }
    setBusy(true)
    try {
      const buf         = await file.arrayBuffer()
      const wb          = XLSX.read(buf, { type: 'array' })
      const instruments = parseSheetToInstruments(wb)
      if (!instruments.length) {
        toast.error('No rows found in the spreadsheet.')
        return
      }
      const rows = buildCableScheduleRowsFromInstruments(instruments, {
        pid_no: pidNo,
        rev,
        includeIndicators: includeInd,
      })
      setGenerated(rows)
      setSourceCount(instruments.length)
      if (activeProject) {
        try {
          const updated = attachCableScheduleToProject(activeProject.id, {
            rows,
            source_count: instruments.length,
            last_source_name: file?.name || '',
          })
          setActiveProject(updated)
        } catch (e) { console.warn('[CableBlock] snapshot save failed:', e) }
      }
      toast.success(`Generated ${rows.length} cable row(s) from ${instruments.length} instrument(s).`)
    } catch (err) {
      toast.error(`Failed to parse spreadsheet: ${err?.message || err}`)
    } finally {
      setBusy(false)
    }
  }, [file, pidNo, rev, includeInd, activeProject])

  const runFromJson = useCallback(() => {
    if (!rawJson.trim()) {
      toast.warn('Paste Instrument Index JSON first.')
      return
    }
    setBusy(true)
    try {
      const parsed      = JSON.parse(rawJson)
      const instruments = Array.isArray(parsed) ? parsed : (parsed?.instruments || [])
      if (!instruments.length) {
        toast.error('JSON did not contain any instruments.')
        return
      }
      const rows = buildCableScheduleRowsFromInstruments(instruments, {
        pid_no: pidNo,
        rev,
        includeIndicators: includeInd,
      })
      setGenerated(rows)
      setSourceCount(instruments.length)
      if (activeProject) {
        try {
          const updated = attachCableScheduleToProject(activeProject.id, {
            rows,
            source_count: instruments.length,
            last_source_name: 'JSON payload',
          })
          setActiveProject(updated)
        } catch (e) { console.warn('[CableBlock] snapshot save failed:', e) }
      }
      toast.success(`Generated ${rows.length} cable row(s) from ${instruments.length} instrument(s).`)
    } catch (err) {
      toast.error(`Invalid JSON: ${err?.message || err}`)
    } finally {
      setBusy(false)
    }
  }, [rawJson, pidNo, rev, includeInd, activeProject])

  // ─── runFromPid — upload the same files Instrument Index accepts ───────
  // Posts P&ID PDF (+ optional legend PDF) + metadata to the same backend
  // endpoint used by InstrumentIndex.jsx, then pipes the extracted
  // instruments straight into buildCableScheduleRowsFromInstruments.
  const runFromPid = useCallback(async () => {
    if (!pidPdfFile) {
      toast.warn('Upload a P&ID PDF first.')
      return
    }
    // NOTE: activeProject is optional here — matches runFromFile / runFromJson.
    // Generation must never silently bail just because no project is open;
    // the snapshot save below is wrapped in try/catch and skipped if absent.

    setBusy(true)
    setExtractStatus('Uploading P&ID…')

    const url   = `${API_BASE}${PID_EXTRACT_CONFIG.endpoint}`
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)
    const ctrl  = new AbortController()
    const abort = setTimeout(() => ctrl.abort(), PID_EXTRACT_CONFIG.uploadTimeoutMs)

    try {
      const fd = new FormData()
      fd.append('pid_file', pidPdfFile)
      if (legendPdfFile) fd.append('legend_file', legendPdfFile)
      fd.append(
        'drawing_number',
        pidMeta.drawing_number || pidNo || pidPdfFile.name.replace(/\.pdf$/i, ''),
      )
      fd.append('drawing_title',  pidMeta.drawing_title || '')
      fd.append('revision',        rev || PID_EXTRACT_CONFIG.defaultRevision)
      // Project context is optional — extractor accepts blanks.
      fd.append('project_name',     activeProject?.project_name || '')
      fd.append('project_id',       activeProject?.id || '')
      fd.append('project_code',     activeProject?.code || '')
      fd.append('project_category', activeProject?.category || '')
      fd.append('project_client',   activeProject?.client || '')
      fd.append('project_unit',     activeProject?.unit || '')

      setExtractStatus('AI scanning P&ID for all instrument tags…')

      const doFetch = () => fetch(url, {
        method:  'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body:    fd,
        signal:  ctrl.signal,
      })

      let resp
      let attempt = 0
      // eslint-disable-next-line no-constant-condition
      while (true) {
        try {
          resp = await doFetch()
          break
        } catch (netErr) {
          if (attempt < PID_EXTRACT_CONFIG.maxRetries && isTransientNetworkError(netErr)) {
            attempt += 1
            const delay = PID_EXTRACT_CONFIG.retryBackoffBaseMs *
                          Math.pow(PID_EXTRACT_CONFIG.retryBackoffFactor, attempt - 1)
            setExtractStatus(`Network blip — retrying (${attempt}/${PID_EXTRACT_CONFIG.maxRetries})…`)
            await new Promise((r) => setTimeout(r, delay))
            continue
          }
          throw netErr
        }
      }
      clearTimeout(abort)

      if (!resp.ok) {
        let detail = `HTTP ${resp.status}`
        try { const j = await resp.json(); detail = j.error || j.detail || detail } catch (_) {}
        throw new Error(detail)
      }

      const data        = await resp.json()
      // Persist the full payload so the on-page Instrument Index Report can
      // mirror the standalone Instrument Index page (table + summary + Excel).
      setPidIndexResult(data || null)
      const instruments = (
        Array.isArray(data?.instruments) ? data.instruments
        : Array.isArray(data?.results?.instruments) ? data.results.instruments
        : Array.isArray(data) ? data
        : []
      )

      if (!instruments.length) {
        toast.error('Extractor returned 0 instruments.')
        setExtractStatus('No instruments found in the drawing.')
        return
      }

      setExtractStatus(`Extraction complete — building Cable Schedule from ${instruments.length} instruments…`)
      const rows = buildCableScheduleRowsFromInstruments(instruments, {
        pid_no: pidMeta.drawing_number || pidNo,
        rev,
        includeIndicators: includeInd,
      })
      setGenerated(rows)
      setSourceCount(instruments.length)

      if (activeProject) {
        try {
          const updated = attachCableScheduleToProject(activeProject.id, {
            rows,
            source_count: instruments.length,
            last_source_name: pidPdfFile.name,
          })
          setActiveProject(updated)
        } catch (e) { console.warn('[CableBlock] snapshot save failed:', e) }
      }

      toast.success(`Generated ${rows.length} cable row(s) from ${instruments.length} extracted instrument(s).`)
      setExtractStatus('')
    } catch (err) {
      clearTimeout(abort)
      const msg = err?.name === 'AbortError'
        ? `Upload timed out after ${Math.round(PID_EXTRACT_CONFIG.uploadTimeoutMs / 60000)} min.`
        : (err?.message || 'Extraction failed — please try again.')
      toast.error(msg)
      setExtractStatus('')
    } finally {
      setBusy(false)
    }
  }, [pidPdfFile, legendPdfFile, pidMeta, pidNo, rev, includeInd, activeProject])

  const resetAll = () => {
    setFile(null)
    setRawJson('')
    setGenerated([])
    setSourceCount(0)
    setPidPdfFile(null)
    setLegendPdfFile(null)
    setPidMeta(Object.fromEntries(PID_EXTRACT_CONFIG.metaFields.map((f) => [f.key, ''])))
    setExtractStatus('')
    setPidIndexResult(null)
  }

  // Resolve which generator path to use based on the inputs the user filled in.
  // Priority: explicit workbook > pasted JSON > P&ID PDF extraction.
  // Soft-coded so adding a new source means appending one entry below.
  const resolvedSource = (
    file               ? 'file'
    : rawJson.trim()   ? 'json'
    : pidPdfFile       ? 'pid'
    :                    null
  )
  const canGenerate = resolvedSource !== null
  // Per-stage completion flags drive the stepper visual & Next button enablement.
  // Stage 1 = Instrument Index source (P&ID PDF), Stage 2 = IO List workbook/JSON.
  const stageComplete = {
    1: !!pidPdfFile,
    2: !!file || !!rawJson.trim(),
    3: false,
  }

  return (
    <div className={LAYOUT_CONFIG.wrapper}>
      {/* ─── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          className={`${LAYOUT_CONFIG.heroBlurClass} bg-gradient-to-br ${PAGE_CONFIG.brandRingGradient}`}
          aria-hidden
        />
        <div className={`relative ${LAYOUT_CONFIG.contentMaxW} ${LAYOUT_CONFIG.heroPaddingY}`}>
          {activeProject && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={exitProject}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/80 backdrop-blur border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-white shadow-sm"
              >
                <ArrowLeftIcon className="h-3.5 w-3.5" />
                Back to projects
              </button>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-violet-600/10 to-indigo-600/10 border border-purple-200 text-purple-800 text-xs font-semibold">
                <FolderOpenIcon className="h-3.5 w-3.5" />
                {activeProject.project_name}
              </span>
              {(() => {
                const cat = CABLE_SCHEDULE_PROJECT_CATEGORIES.find((c) => c.id === activeProject.category)
                return cat ? (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cat.badgeBg} ${cat.badgeText} ${cat.badgeBorder}`}>
                    <span>{cat.icon}</span>
                    {cat.label}
                  </span>
                ) : null
              })()}
              {activeProject.pid_no && (
                <span className="text-[11px] text-gray-500">P&amp;ID {activeProject.pid_no} · Rev {activeProject.revision || '0'}</span>
              )}
            </div>
          )}
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 backdrop-blur border border-purple-200 text-purple-700 text-xs font-semibold shadow-sm">
                <SparklesIcon className="h-3.5 w-3.5" />
                {PAGE_CONFIG.aiBadge}
                <span className="opacity-50">•</span>
                <span className="opacity-80">Soft-coded ADNOC rule set</span>
              </div>
              <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
                <span className={`bg-gradient-to-r ${PAGE_CONFIG.brandGradient} bg-clip-text text-transparent`}>
                  {PAGE_CONFIG.title}
                </span>
              </h1>
              <p className="mt-1.5 text-sm text-gray-600 max-w-2xl">
                {PAGE_CONFIG.subtitle}. Drop in an Instrument Index extraction, let the engine group
                instruments into junction boxes, derive field &amp; multicore cable tags / sizes and
                marshalling + system cabinet IDs, then download the ADNOC-template workbook.
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Need a source register first?{' '}
                <Link
                  to={PAGE_CONFIG.instrumentIndexLink}
                  className="font-semibold text-purple-700 hover:text-purple-900 underline underline-offset-2"
                >
                  Generate it on the Instrument Index page →
                </Link>
              </p>
            </div>

            {/* live stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3 min-w-[280px]">
              <StatCard label="Source rows" value={sourceCount}      accent="indigo" />
              <StatCard label="Schedule rows"     value={generated.length} accent="purple" />
              <StatCard label="DCS signals" value={dcsCount}         accent="emerald" />
              <StatCard label="ESD signals" value={esdCount}         accent="amber" />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Feature highlights ─────────────────────────────────────────── */}
      <section className={`${LAYOUT_CONFIG.contentMaxW} ${LAYOUT_CONFIG.sectionGapY}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {FEATURE_HIGHLIGHTS.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl bg-white/80 backdrop-blur border border-gray-200 p-4 shadow-sm hover:shadow-md hover:-translate-y-px transition-all"
            >
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-100 to-purple-100 text-purple-700">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="text-sm font-semibold text-gray-800">{title}</div>
              </div>
              <p className="text-xs text-gray-600 mt-2 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* ─── Generator card OR Projects shell ──────────────────────── */}
      {!activeProject ? (
        <ProjectsShell onOpen={openProject} />
      ) : (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="rounded-2xl bg-white border border-gray-200 shadow-lg overflow-hidden">
          {/* card header — current stage title */}
          <div className={`px-6 py-5 bg-gradient-to-r ${PAGE_CONFIG.brandGradient} text-white flex items-center gap-4`}>
            <div className="p-3 rounded-xl bg-white/15 backdrop-blur">
              <CircleStackIcon className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold">
                {WIZARD_STAGES.find((s) => s.id === stage)?.title}
              </h2>
              <p className="text-xs text-purple-100 mt-0.5">
                {WIZARD_STAGES.find((s) => s.id === stage)?.subtitle}
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur text-xs font-semibold">
              Step {stage} of {WIZARD_STAGES.length}
            </div>
          </div>

          {/* stepper — soft-coded from WIZARD_STAGES */}
          <div className="px-6 pt-5 pb-2">
            <ol className="flex items-center gap-2 sm:gap-4">
              {WIZARD_STAGES.map(({ id, label, icon: StageIcon }, idx) => {
                const isActive    = stage === id
                const isComplete  = stageComplete[id] && stage > id
                const isReachable = id <= stage || stageComplete[id - 1] || id === 2
                return (
                  <li key={id} className="flex-1 flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      disabled={!isReachable}
                      onClick={() => isReachable && setStage(id)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all w-full min-w-0 ${
                        isActive
                          ? `bg-gradient-to-r ${PAGE_CONFIG.brandGradient} text-white shadow-sm`
                          : isComplete
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed'
                      }`}
                    >
                      <span className={`flex items-center justify-center h-6 w-6 rounded-full text-[11px] font-bold flex-shrink-0 ${
                        isActive ? 'bg-white/20' : isComplete ? 'bg-emerald-100' : 'bg-white border border-gray-300'
                      }`}>
                        {isComplete ? <CheckBadgeIcon className="h-3.5 w-3.5" /> : id}
                      </span>
                      <StageIcon className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{label}</span>
                    </button>
                    {idx < WIZARD_STAGES.length - 1 && (
                      <span className="hidden sm:block h-px flex-1 bg-gray-200" aria-hidden />
                    )}
                  </li>
                )
              })}
            </ol>
          </div>

          {/* ─── Stage 1: Instrument Index — P&ID + Legend PDFs ─────── */}
          {stage === 1 && (
          <div className="px-6 pt-4 pb-6">
            <div className="rounded-xl border-2 border-dashed border-fuchsia-200 bg-fuchsia-50/40 p-6">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-white shadow-sm border border-fuchsia-200">
                  <CpuChipIcon className="h-5 w-5 text-fuchsia-600" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-800">
                    Upload Instrument Index source documents (P&amp;ID)
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Drop the P&amp;ID PDF (and optional Legend PDF). We run the same AI-vision extractor used by{' '}
                    <Link to={PAGE_CONFIG.instrumentIndexLink} className="font-semibold text-fuchsia-700 hover:underline">
                      Instrument Index
                    </Link>{' '}
                    and pipe the result straight into the Cable Schedule.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[11px] font-semibold text-gray-700 mb-1">P&amp;ID PDF (required)</span>
                  <input
                    type="file"
                    accept={PID_EXTRACT_CONFIG.acceptedPidExt}
                    onChange={(e) => { setPidPdfFile(e.target.files?.[0] || null); setGenerated([]); setSourceCount(0); }}
                    className="w-full text-xs text-gray-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-fuchsia-600 file:text-white hover:file:bg-fuchsia-700 cursor-pointer"
                  />
                  {pidPdfFile && (
                    <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white border border-fuchsia-200 text-[11px] text-gray-700">
                      <CheckBadgeIcon className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="font-mono truncate max-w-[200px]">{pidPdfFile.name}</span>
                      <span className="text-gray-500">({Math.round(pidPdfFile.size / 1024)} KB)</span>
                    </div>
                  )}
                </label>
                <label className="block">
                  <span className="block text-[11px] font-semibold text-gray-700 mb-1">Legend PDF (optional)</span>
                  <input
                    type="file"
                    accept={PID_EXTRACT_CONFIG.acceptedLegendExt}
                    onChange={(e) => setLegendPdfFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-gray-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-fuchsia-100 file:text-fuchsia-800 hover:file:bg-fuchsia-200 cursor-pointer"
                  />
                  {legendPdfFile && (
                    <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white border border-fuchsia-200 text-[11px] text-gray-700">
                      <CheckBadgeIcon className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="font-mono truncate max-w-[200px]">{legendPdfFile.name}</span>
                    </div>
                  )}
                </label>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {PID_EXTRACT_CONFIG.metaFields.map((f) => (
                  <label key={f.key} className="block">
                    <span className="block text-[11px] font-semibold text-gray-700 mb-1">{f.label}</span>
                    <input
                      type="text"
                      value={pidMeta[f.key] || ''}
                      onChange={(e) => setPidMeta((m) => ({ ...m, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full px-2.5 py-1.5 rounded-md border border-gray-300 text-xs focus:ring-2 focus:ring-fuchsia-500 focus:border-fuchsia-500"
                    />
                  </label>
                ))}
              </div>

              {extractStatus && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-fuchsia-200 text-xs text-gray-700">
                  <ArrowPathIcon className="h-3.5 w-3.5 text-fuchsia-600 animate-spin" />
                  {extractStatus}
                </div>
              )}
            </div>

            <div className="mt-3 text-[11px] text-gray-500">
              No P&amp;ID handy? Skip ahead to{' '}
              <button type="button" onClick={() => setStage(2)} className="font-semibold text-purple-700 hover:underline">
                Stage 2
              </button>{' '}
              and feed the engine with an existing Instrument Index workbook.
            </div>
          </div>
          )}

          {/* ─── Stage 2: IO List — Instrument Index workbook / JSON ── */}
          {stage === 2 && (
          <div className="px-6 pt-4 pb-6">
            <div className="inline-flex p-1 rounded-xl bg-gray-100 border border-gray-200 mb-4">
              {IOLIST_SOURCE_MODES.map(({ id, label, icon: Icon }) => {
                const active = iolistMode === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setIolistMode(id)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      active ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                )
              })}
            </div>

            {iolistMode === 'file' ? (
              <div className="rounded-xl border-2 border-dashed border-purple-200 bg-purple-50/40 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="p-3 rounded-xl bg-white shadow-sm border border-purple-200">
                    <ArrowUpTrayIcon className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-800">Upload the Instrument Index workbook</div>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Accepted formats: <span className="font-mono">{ACCEPTED_EXCEL_EXT}</span>. The first sheet
                      with data is auto-detected — headers are flexible (tag_number / Tag No. / Tag, etc).
                    </p>
                  </div>
                  <input
                    type="file"
                    accept={ACCEPTED_EXCEL_EXT}
                    onChange={handleFile}
                    className="text-xs text-gray-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700 cursor-pointer"
                  />
                </div>
                {file && (
                  <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-purple-200 text-xs text-gray-700">
                    <CheckBadgeIcon className="h-4 w-4 text-emerald-600" />
                    <span className="font-mono">{file.name}</span>
                    <span className="text-gray-500">({Math.round(file.size / 1024)} KB)</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-white shadow-sm border border-emerald-200">
                    <CodeBracketIcon className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-800">Paste Instrument Index JSON</div>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Array of instrument objects, or <span className="font-mono">{'{ instruments: […] }'}</span>.
                    </p>
                  </div>
                </div>
                <textarea
                  value={rawJson}
                  onChange={(e) => setRawJson(e.target.value)}
                  rows={6}
                  placeholder='[{"tag_number":"113-PT-3191","instrument_type":"PRESSURE TRANSMITTER","service_description":"…"}]'
                  className="block w-full text-xs font-mono p-3 rounded-lg border border-emerald-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            )}

            <div className="mt-3 text-[11px] text-gray-500">
              Already extracted the register in Stage 1? You can skip this and go straight to{' '}
              <button type="button" onClick={() => setStage(3)} className="font-semibold text-emerald-700 hover:underline">
                Stage 3
              </button>.
            </div>
          </div>
          )}

          {/* ─── Stage 3: Tune the generator ───────────────────────── */}
          {stage === 3 && (
          <div className="px-6 pt-4 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="text-sm">
                <span className="block text-xs font-semibold text-gray-700 mb-1">P&amp;ID No. (fallback)</span>
                <input
                  type="text"
                  value={pidNo}
                  onChange={(e) => setPidNo(e.target.value)}
                  placeholder="e.g. NM-…-001"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </label>
              <label className="text-sm">
                <span className="block text-xs font-semibold text-gray-700 mb-1">Revision</span>
                <input
                  type="text"
                  value={rev}
                  onChange={(e) => setRev(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </label>
              <label className="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={includeInd}
                  onChange={(e) => setIncludeInd(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <div className="text-xs">
                  <div className="font-semibold text-gray-800">Include HMI indicators</div>
                  <div className="text-gray-500">FI / PI / TI… (off by default)</div>
                </div>
              </label>
            </div>

            {/* Source summary so the user knows which path will run */}
            <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-700">
              <span className="font-semibold">Source detected:</span>{' '}
              {resolvedSource === 'file' ? (
                <>Excel/CSV workbook — <span className="font-mono">{file?.name}</span></>
              ) : resolvedSource === 'json' ? (
                <>Pasted JSON ({rawJson.trim().length} chars)</>
              ) : resolvedSource === 'pid' ? (
                <>P&amp;ID PDF — <span className="font-mono">{pidPdfFile?.name}</span> (AI extract)</>
              ) : (
                <span className="text-amber-700">
                  No source provided yet. Go back to Stage 1 or Stage 2 to add one.
                </span>
              )}
            </div>
          </div>
          )}

          {/* ─── Wizard navigation footer ──────────────────────────── */}
          <div className="px-6 pb-6 pt-2 border-t border-gray-100">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={stage === 1}
                onClick={() => setStage((s) => Math.max(1, s - 1))}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Back
              </button>

              {stage < WIZARD_STAGES.length ? (
                <>
                  <button
                    type="button"
                    onClick={() => setStage((s) => Math.min(WIZARD_STAGES.length, s + 1))}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white shadow-md bg-gradient-to-r ${PAGE_CONFIG.brandGradient} hover:shadow-lg hover:-translate-y-px transition-all`}
                  >
                    Next: {WIZARD_STAGES[stage]?.label}
                    <ArrowUpTrayIcon className="h-4 w-4 rotate-90" />
                  </button>
                  {/* Shortcut — fire generation directly from any stage once a source is ready */}
                  {canGenerate && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={
                        resolvedSource === 'file' ? runFromFile
                        : resolvedSource === 'pid' ? runFromPid
                        : resolvedSource === 'json' ? runFromJson
                        : undefined
                      }
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Skip ahead and generate using the source you've already provided"
                    >
                      {busy ? (
                        <><ArrowPathIcon className="h-4 w-4 animate-spin" /> Processing…</>
                      ) : (
                        <><SparklesIcon className="h-4 w-4" /> Generate now</>
                      )}
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  disabled={!canGenerate || busy}
                  onClick={
                    resolvedSource === 'file' ? runFromFile
                    : resolvedSource === 'pid' ? runFromPid
                    : resolvedSource === 'json' ? runFromJson
                    : undefined
                  }
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white shadow-md bg-gradient-to-r ${PAGE_CONFIG.brandGradient} hover:shadow-lg hover:-translate-y-px transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0`}
                >
                  {busy ? (
                    <>
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      Processing…
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="h-4 w-4" />
                      Generate Cable Schedule
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                disabled={!generated.length}
                onClick={() => downloadIoListXlsx(generated)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold shadow hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                Download .xlsx
              </button>
              <button
                type="button"
                onClick={() => { resetAll(); setStage(1) }}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <ArrowPathIcon className="h-4 w-4" />
                Reset
              </button>
              {generated.length > 0 && (
                <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                  <CheckBadgeIcon className="h-4 w-4" />
                  {generated.length} row(s) ready
                </span>
              )}
            </div>
          </div>


          {/* ─── Instrument Index Report (mirrors /engineering/instrument/index) ─── */}
          {pidIndexResult && Array.isArray(pidIndexResult.instruments) && pidIndexResult.instruments.length > 0 && (
            <div className="px-6 pb-6">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <CpuChipIcon className="h-5 w-5 text-violet-600" />
                <h3 className="text-sm font-bold text-gray-800">
                  {INSTRUMENT_INDEX_REPORT_CONFIG.title}
                </h3>
                <span className="text-[11px] text-gray-500">— {INSTRUMENT_INDEX_REPORT_CONFIG.subtitle}</span>
                <span className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                  <CheckBadgeIcon className="h-3.5 w-3.5" />
                  {pidIndexResult.total ?? pidIndexResult.instruments.length} instruments
                </span>
                {pidIndexResult.excel_url && (
                  <button
                    type="button"
                    onClick={() => {
                      const token   = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)
                      const base    = API_BASE.replace(/\/api\/v1\/?$/, '')
                      let fullUrl   = `${base}${pidIndexResult.excel_url}`
                      if (token) fullUrl += (fullUrl.includes('?') ? '&' : '?') + `token=${encodeURIComponent(token)}`
                      const safeName = (pidIndexResult?.drawing_info?.drawing_number || pidNo || 'export')
                        .replace(/[^a-zA-Z0-9_-]/g, '_')
                      const a = document.createElement('a')
                      a.href = fullUrl
                      a.download = `instrument_index_${safeName}.xlsx`
                      document.body.appendChild(a); a.click(); document.body.removeChild(a)
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white shadow-sm bg-gradient-to-r from-violet-600 to-indigo-600 hover:shadow-md transition-all"
                  >
                    <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                    {INSTRUMENT_INDEX_REPORT_CONFIG.downloadLabel}
                  </button>
                )}
              </div>

              {/* Category summary chips */}
              {pidIndexResult.category_summary && Object.keys(pidIndexResult.category_summary).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {Object.entries(pidIndexResult.category_summary).sort().map(([cat, count]) => {
                    const cls = INSTRUMENT_INDEX_REPORT_CONFIG.categoryColors[cat]
                            || INSTRUMENT_INDEX_REPORT_CONFIG.categoryColors.default
                    return (
                      <span
                        key={cat}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${cls}`}
                      >
                        {cat}
                        <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/70 text-[10px] font-bold">{count}</span>
                      </span>
                    )
                  })}
                </div>
              )}

              {/* Instrument table */}
              <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                <table className="min-w-full text-xs">
                  <thead className="bg-gradient-to-r from-violet-50 to-indigo-50 text-gray-700">
                    <tr>
                      {INSTRUMENT_INDEX_REPORT_CONFIG.columns.map((c) => (
                        <th
                          key={c.key}
                          className={`px-2.5 py-2 text-left font-semibold whitespace-nowrap border-b border-violet-100 ${c.width || ''}`}
                        >
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pidIndexResult.instruments
                      .slice(0, INSTRUMENT_INDEX_REPORT_CONFIG.maxPreviewRows)
                      .map((inst, i) => {
                        const cat = inst.category || 'Unknown'
                        const catCls = INSTRUMENT_INDEX_REPORT_CONFIG.categoryColors[cat]
                                    || INSTRUMENT_INDEX_REPORT_CONFIG.categoryColors.default
                        return (
                          <tr key={`${inst.tag_number || 'tag'}-${i}`} className="hover:bg-violet-50/40 transition-colors">
                            {INSTRUMENT_INDEX_REPORT_CONFIG.columns.map((c) => {
                              const raw = c.key === 'index_no'
                                ? (inst.index_no ?? i + 1)
                                : (inst[c.key] ?? '')
                              if (c.key === 'category') {
                                return (
                                  <td key={c.key} className="px-2.5 py-1.5 whitespace-nowrap">
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${catCls}`}>
                                      {String(raw || '—')}
                                    </span>
                                  </td>
                                )
                              }
                              return (
                                <td key={c.key} className="px-2.5 py-1.5 whitespace-nowrap text-gray-700">
                                  {String(raw ?? '')}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
              {pidIndexResult.instruments.length > INSTRUMENT_INDEX_REPORT_CONFIG.maxPreviewRows && (
                <p className="mt-2 text-[11px] text-gray-500 italic">
                  Showing first {INSTRUMENT_INDEX_REPORT_CONFIG.maxPreviewRows} of {pidIndexResult.instruments.length} rows — full set is in the Excel download.
                </p>
              )}
            </div>
          )}

          {/* preview */}
          {generated.length > 0 && (
            <div className="px-6 pb-6">
              <div className="flex items-center gap-2 mb-3">
                <TableCellsIcon className="h-5 w-5 text-purple-600" />
                <h3 className="text-sm font-bold text-gray-800">
                  Preview — first {previewRows.length} of {generated.length} row(s)
                </h3>
                <span className="ml-auto text-[11px] text-gray-500">
                  Showing {PREVIEW_COLUMN_COUNT} of {CABLE_SCHEDULE_COLUMNS.length} columns — full schema lands in the download.
                </span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                <table className="min-w-full text-xs">
                  <thead className="bg-gradient-to-r from-purple-50 to-indigo-50 text-gray-700">
                    <tr>
                      {CABLE_SCHEDULE_COLUMNS.slice(0, PREVIEW_COLUMN_COUNT).map((c) => (
                        <th
                          key={c.key}
                          className="px-2.5 py-2 text-left font-semibold whitespace-nowrap border-b border-purple-100"
                        >
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewRows.map((r, i) => (
                      <tr key={`${r.tag_number}-${i}`} className="hover:bg-purple-50/40 transition-colors">
                        {CABLE_SCHEDULE_COLUMNS.slice(0, PREVIEW_COLUMN_COUNT).map((c) => (
                          <td key={c.key} className="px-2.5 py-1.5 whitespace-nowrap text-gray-700">
                            {String(r[c.key] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
      )}
    </div>
  )
}
