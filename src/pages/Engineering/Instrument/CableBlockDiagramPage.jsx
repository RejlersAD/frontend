/**
 * Cable Block Diagram — single-screen ADNOC tool
 * ===============================================
 *
 * Replaces the previous 3-stage wizard + projects/history clone.
 *
 * Flow (no wizard, no React Router context):
 *   1. User drops drawing metadata + P&ID PDF (optional legend) into form
 *   2. POST → /api/v1/pid/cable-block-diagram/analyze/
 *   3. Backend returns 17-column ADNOC rows (JB / multicore / cabinets all
 *      computed server-side via cable_block_service.py — single source of
 *      truth for naming patterns).
 *   4. Table renders + "Download Excel" hits cached server-side workbook.
 *
 * All UI thresholds and labels live in the soft-coded constants block at
 * the top.  No business logic in this file.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  BoltIcon,
  ChartBarSquareIcon,
  CheckBadgeIcon,
  CloudArrowUpIcon,
  CpuChipIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TableCellsIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'

import { getApiBaseUrl } from '../../../config/environment.config'
import { STORAGE_KEYS } from '../../../config/app.config'

// ════════════════════════════════════════════════════════════════════════════
// Soft-coded UI configuration  (single place to retune look & feel)
// ════════════════════════════════════════════════════════════════════════════
const API_BASE              = getApiBaseUrl()
// URL prefix matches the IO List page (`/pid/instrument-index/analyze/`).
// `apps.pid_analysis.urls` is mounted at `/api/v1/pid/` in backend/config/urls.py.
const CBD_URL_PREFIX        = '/pid/cable-block-diagram'
const CBD_ENDPOINT          = `${CBD_URL_PREFIX}/analyze/`
const CBD_ACCEPT_PDF        = 'application/pdf,.pdf'

// Soft-coded extraction behaviour — mirrors IO List's PID_EXTRACT_CONFIG so
// both pages share the same retry / timeout / transient-error contract.
// Tune any value here without touching submit().
const CBD_EXTRACT_CONFIG = {
  uploadTimeoutMs:    5 * 60 * 1000,            // 5 min for big P&IDs
  maxRetries:         2,
  retryBackoffBaseMs: 1500,
  retryBackoffFactor: 2,
  transientMarkers:   ['Failed to fetch', 'ERR_CONNECTION_RESET', 'NetworkError', 'network error'],
}
// Kept for backward-compat with any existing references in this file.
const CBD_UPLOAD_TIMEOUT_MS = CBD_EXTRACT_CONFIG.uploadTimeoutMs

function isTransientNetworkError(err) {
  const msg = String(err?.message || err || '')
  return CBD_EXTRACT_CONFIG.transientMarkers.some((m) => msg.includes(m))
}

const PAGE_CONFIG = {
  title:               'Cable Block Diagram',
  subtitle:            'AI-assisted JB / multicore / cabinet allocation in ADNOC plant style',
  aiBadge:             'AI-Powered',
  brandGradient:       'from-indigo-600 via-blue-600 to-cyan-600',
  brandRingGradient:   'from-indigo-500/30 via-blue-500/30 to-cyan-500/30',
  instrumentIndexLink: '/engineering/instrument/datasheet/io-list',
  backHref:            '/engineering/instrument',
}

// Page is rendered inside the app shell's <Outlet> — must NOT claim min-h-screen.
const LAYOUT_CONFIG = {
  wrapper:       'w-full bg-gradient-to-br from-slate-50 via-white to-blue-50/40',
  contentMaxW:   'max-w-6xl mx-auto px-4 sm:px-6 lg:px-8',
  heroPaddingY:  'pt-4 pb-3 sm:pt-5 sm:pb-4',
  sectionGapY:   'pt-2',
  cardGapY:      'py-5',
  heroBlurClass: 'absolute inset-x-0 top-0 h-full pointer-events-none blur-3xl opacity-40',
}

// Soft-coded section visibility — flip a flag to show/hide a whole block.
// `*WhenResults` flags drive an auto-collapse: e.g. once we have rows, the
// feature-highlights strip hides so the table dominates the viewport.
const SECTIONS = {
  showBackLink:                true,
  showAiBadge:                 true,
  showFeatureHighlights:       true,
  hideFeatureHighlightsOnDone: true,   // collapse marketing strip after extraction
  showStatsStrip:              true,   // single strip ABOVE results (not in hero)
  showIoListTip:               false,  // keep hero clean by default
  showLegendUploadSlot:        false,  // mirrors UPLOAD_SLOTS.legend.enabled
}

const FEATURE_HIGHLIGHTS = [
  { icon: CpuChipIcon,         title: 'Smart tag parsing',  desc: 'ISA function letters decode every tag → system, IS/NIS, signal class automatically.' },
  { icon: BoltIcon,            title: 'JB allocation',      desc: 'A / D / C letter codes assigned by system × signal class, capped to 12 IO per JB.' },
  { icon: ShieldCheckIcon,     title: 'Multicore sizing',   desc: 'Pair count auto-tiered (10 / 20 / 30) from JB density — no manual math required.' },
  { icon: ChartBarSquareIcon,  title: 'ADNOC workbook',     desc: '17-column Excel with cabinets keyed to your IES area — ready for review.' },
]

const FORM_DEFAULTS = {
  revision:    '0',
  plant_unit:  '113',   // ADNOC Habshan reference: drawing unit
  ies_area:    '15',    // ADNOC Habshan reference: IES sub-area
}

// Soft-coded form fields — mirrors IO List's PID_EXTRACT_CONFIG.metaFields.
// Add / reorder / remove entries here and the form grid + FormData submit
// will pick them up automatically.
const META_FIELDS = [
  { key: 'drawing_number', label: 'Drawing No.',   placeholder: 'auto from filename',              required: false },
  { key: 'drawing_title',  label: 'Drawing Title', placeholder: 'e.g. LP Steam Generator',         required: false },
  { key: 'revision',       label: 'Revision',      placeholder: FORM_DEFAULTS.revision,            required: false },
  { key: 'project_name',   label: 'Project Name',  placeholder: 'e.g. ADNOC Habshan',              required: false },
  { key: 'plant_unit',     label: 'Plant Unit',    placeholder: FORM_DEFAULTS.plant_unit,          required: false,
    hint: `First segment of JB number — e.g. "${FORM_DEFAULTS.plant_unit}" → "${FORM_DEFAULTS.plant_unit} A ${FORM_DEFAULTS.ies_area} 001"` },
  { key: 'ies_area',       label: 'IES Area',      placeholder: FORM_DEFAULTS.ies_area,            required: false,
    hint: `IES sub-area — drives cabinet tags, e.g. "${FORM_DEFAULTS.ies_area}" → "${FORM_DEFAULTS.ies_area}-DT-01"` },
]

// Soft-coded upload slots. Flip `enabled` to false to hide a slot from the UI
// AND skip its FormData append + state plumbing — no other edits required.
const UPLOAD_SLOTS = {
  pid:    { enabled: true,  label: 'Cable Block Diagram (P&ID PDF)', required: true,  formField: 'pid_file' },
  legend: { enabled: false, label: 'Legend Sheet (optional)',         required: false, formField: 'legend_file' },
}

// 17-column schema (mirrors backend cable_block_service.CABLE_BLOCK_COLUMNS)
// `pill` flag → cell rendered as coloured chip (system / IS-NIS / signal type)
const CBD_COLUMNS = [
  { key: 's_no',                label: '#',                   align: 'center', mono: false, width: 'w-10' },
  { key: 'tag_number',          label: 'Instrument Tag',      align: 'center', mono: true,  width: 'w-32' },
  { key: 'service_description', label: 'Service',             align: 'left',   mono: false, width: 'w-56' },
  { key: 'system',              label: 'System',              align: 'center', mono: false, width: 'w-24', pill: 'system' },
  { key: 'is_nis',              label: 'IS / NIS',            align: 'center', mono: false, width: 'w-20', pill: 'is_nis' },
  { key: 'signal_type',         label: 'Signal Type',         align: 'center', mono: false, width: 'w-24', pill: 'signal' },
  { key: 'jb_no',               label: 'Junction Box',        align: 'center', mono: true,  width: 'w-28' },
  { key: 'field_cable_no',      label: 'Field Cable Tag',     align: 'center', mono: true,  width: 'w-32' },
  { key: 'field_cable_size',    label: 'Field Cable Size',    align: 'center', mono: true,  width: 'w-24' },
  { key: 'multicore_cable_no',  label: 'Multicore Tag',       align: 'center', mono: true,  width: 'w-32' },
  { key: 'multicore_size',      label: 'Multicore Size',      align: 'center', mono: true,  width: 'w-24' },
  { key: 'marsh_cab_no',        label: 'Marshalling Cabinet', align: 'center', mono: true,  width: 'w-28' },
  { key: 'sys_cab_no',          label: 'System Cabinet',      align: 'center', mono: true,  width: 'w-28' },
  { key: 'function',            label: 'Function',            align: 'center', mono: true,  width: 'w-20' },
  { key: 'pid_no',              label: 'P&ID No.',            align: 'center', mono: true,  width: 'w-28' },
  { key: 'rev',                 label: 'Rev',                 align: 'center', mono: false, width: 'w-12' },
  { key: 'remarks',             label: 'Remarks',             align: 'left',   mono: false, width: 'w-40' },
]

// ─── Soft-coded Cable-Schedule Report (mirrors IO List's Instrument Index Report) ─
// Compact, summary-first presentation. Tune chips / colours / preview cap here
// without touching JSX.
const CBD_REPORT_CONFIG = {
  title:          'Cable Schedule Report',
  subtitle:       'AI-allocated JB, multicore and cabinet assignments',
  maxPreviewRows: 50,                            // table preview cap (Excel has all rows)
  downloadLabel:  'Download Cable Schedule (.xlsx)',
  emptyHint:      'Run extraction from a P&ID PDF (Stage 1) to populate this report.',
  // Summary chips shown above the table — first-match per row.
  // `field` is the row key whose distinct values become chips.
  summaryChips: [
    { field: 'system',      label: 'System',      palette: 'system' },
    { field: 'signal_type', label: 'Signal Type', palette: 'signal' },
    { field: 'is_nis',      label: 'IS / NIS',    palette: 'is_nis' },
  ],
}

// Pill colour palettes — keys are exact cell values, `default` is fallback.
const PILL_PALETTES = {
  is_nis: {
    IS:      'bg-emerald-100 text-emerald-800 border-emerald-200',
    NIS:     'bg-amber-100   text-amber-800   border-amber-200',
    default: 'bg-slate-100   text-slate-700   border-slate-200',
  },
  system: {
    DCS:     'bg-indigo-100  text-indigo-800  border-indigo-200',
    ESD:     'bg-rose-100    text-rose-800    border-rose-200',
    'F&G':   'bg-orange-100  text-orange-800  border-orange-200',
    FGS:     'bg-orange-100  text-orange-800  border-orange-200',
    PSS:     'bg-rose-100    text-rose-800    border-rose-200',
    default: 'bg-slate-100   text-slate-700   border-slate-200',
  },
  signal: {
    AI:      'bg-cyan-100    text-cyan-800    border-cyan-200',
    AO:      'bg-blue-100    text-blue-800    border-blue-200',
    DI:      'bg-violet-100  text-violet-800  border-violet-200',
    DO:      'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
    default: 'bg-slate-100   text-slate-700   border-slate-200',
  },
}

function pillClass(palette, value) {
  const p = PILL_PALETTES[palette] || {}
  return p[value] || p.default || 'bg-slate-100 text-slate-700 border-slate-200'
}

// Build {value: count} for a given row field — used by summary chips.
function countByField(rows, field) {
  return rows.reduce((acc, r) => {
    const v = (r?.[field] ?? '').toString().trim()
    if (!v) return acc
    acc[v] = (acc[v] || 0) + 1
    return acc
  }, {})
}

// ════════════════════════════════════════════════════════════════════════════
// Component
// ════════════════════════════════════════════════════════════════════════════
export default function CableBlockDiagramPage() {
  const [pidFile,    setPidFile]    = useState(null)
  const [legendFile, setLegendFile] = useState(null) // unused when UPLOAD_SLOTS.legend.enabled=false
  const [meta, setMeta] = useState({
    drawing_number: '',
    drawing_title:  '',
    revision:       FORM_DEFAULTS.revision,
    project_name:   '',
    plant_unit:     FORM_DEFAULTS.plant_unit,
    ies_area:       FORM_DEFAULTS.ies_area,
  })
  const [busy,     setBusy]     = useState(false)
  const [error,    setError]    = useState('')
  const [rows,     setRows]     = useState([])
  const [excelUrl, setExcelUrl] = useState('')
  const [stats,    setStats]    = useState(null)
  const abortRef = useRef(null)

  const onMeta = useCallback((field) => (e) => {
    setMeta((m) => ({ ...m, [field]: e.target.value }))
  }, [])

  const onPidPick = useCallback((e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      toast.error('P&ID must be a PDF file')
      return
    }
    setPidFile(f)
    setMeta((m) => ({
      ...m,
      drawing_number: m.drawing_number || f.name.replace(/\.pdf$/i, ''),
    }))
  }, [])

  const onLegendPick = useCallback((e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Legend must be a PDF file')
      return
    }
    setLegendFile(f)
  }, [])

  const reset = useCallback(() => {
    setPidFile(null); setLegendFile(null)
    setRows([]); setExcelUrl(''); setStats(null); setError('')
  }, [])

  const submit = useCallback(async () => {
    if (!pidFile) {
      toast.error('Please select a P&ID PDF first')
      return
    }
    setBusy(true); setError(''); setRows([]); setExcelUrl(''); setStats(null)

    const fd = new FormData()
    fd.append(UPLOAD_SLOTS.pid.formField, pidFile)
    if (UPLOAD_SLOTS.legend.enabled && legendFile) {
      fd.append(UPLOAD_SLOTS.legend.formField, legendFile)
    }
    Object.entries(meta).forEach(([k, v]) => fd.append(k, v ?? ''))

    const controller = new AbortController()
    abortRef.current = controller
    const timer = setTimeout(() => controller.abort(), CBD_EXTRACT_CONFIG.uploadTimeoutMs)

    try {
      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)
      const url   = `${API_BASE}${CBD_ENDPOINT}`
      const doFetch = () => fetch(url, {
        method: 'POST',
        body: fd,
        signal: controller.signal,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })

      // Retry on transient network errors — same pattern as IOListPage.runFromPid
      let resp
      let attempt = 0
      // eslint-disable-next-line no-constant-condition
      while (true) {
        try {
          resp = await doFetch()
          break
        } catch (netErr) {
          if (attempt < CBD_EXTRACT_CONFIG.maxRetries && isTransientNetworkError(netErr)) {
            attempt += 1
            const delay = CBD_EXTRACT_CONFIG.retryBackoffBaseMs *
                          Math.pow(CBD_EXTRACT_CONFIG.retryBackoffFactor, attempt - 1)
            setError(`Network blip — retrying (${attempt}/${CBD_EXTRACT_CONFIG.maxRetries})…`)
            await new Promise((r) => setTimeout(r, delay))
            continue
          }
          throw netErr
        }
      }
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok || data?.success === false) {
        throw new Error(data?.error || `Server returned ${resp.status}`)
      }
      setRows(data.rows || [])
      setStats({
        total_instruments: data.total_instruments ?? 0,
        total_rows:        data.total_rows ?? (data.rows?.length || 0),
        upload_id:         data.upload_id || '',
      })
      if (data.excel_url) {
        const base = API_BASE.replace(/\/api\/v1\/?$/, '')
        setExcelUrl(`${base}${data.excel_url}`)
      }
      toast.success(`Generated ${data.rows?.length || 0} cable rows`)
    } catch (err) {
      const msg = err.name === 'AbortError'
        ? 'Upload timed out — try a smaller drawing or split into pages.'
        : (err.message || 'Extraction failed')
      setError(msg)
      toast.error(msg)
    } finally {
      clearTimeout(timer)
      abortRef.current = null
      setBusy(false)
    }
  }, [pidFile, legendFile, meta])

  const cancel = useCallback(() => {
    if (abortRef.current) abortRef.current.abort()
  }, [])

  const hasResults = rows.length > 0
  const totalInstruments = stats?.total_instruments ?? 0
  const totalRows        = stats?.total_rows ?? rows.length

  return (
    <div className={LAYOUT_CONFIG.wrapper}>
      {/* ─── Hero (io-list style: blurred glass + gradient text) ───────── */}
      <section className="relative overflow-hidden">
        <div
          className={`${LAYOUT_CONFIG.heroBlurClass} bg-gradient-to-br ${PAGE_CONFIG.brandRingGradient}`}
          aria-hidden
        />
        <div className={`relative ${LAYOUT_CONFIG.contentMaxW} ${LAYOUT_CONFIG.heroPaddingY}`}>
          <Link
            to={PAGE_CONFIG.backHref}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/80 backdrop-blur border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-white shadow-sm"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" /> Back to Instrument
          </Link>

          <div className="mt-3 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 backdrop-blur border border-indigo-200 text-indigo-700 text-xs font-semibold shadow-sm">
                <SparklesIcon className="h-3.5 w-3.5" />
                {PAGE_CONFIG.aiBadge}
                <span className="opacity-50">•</span>
                <span className="opacity-80">Soft-coded ADNOC naming rules</span>
              </div>
              <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
                <span className={`bg-gradient-to-r ${PAGE_CONFIG.brandGradient} bg-clip-text text-transparent`}>
                  {PAGE_CONFIG.title}
                </span>
              </h1>
              <p className="mt-1.5 text-sm text-gray-600 max-w-2xl">
                {PAGE_CONFIG.subtitle}. Drop a P&amp;ID — the server allocates Junction Boxes,
                multicore tags and marshalling / system cabinets in a single pass and ships an
                ADNOC-style Excel workbook.
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Need an IO List first?{' '}
                <Link
                  to={PAGE_CONFIG.instrumentIndexLink}
                  className="font-semibold text-indigo-700 hover:text-indigo-900 underline underline-offset-2"
                >
                  Generate it on the IO List page →
                </Link>
              </p>
            </div>

            {/* live stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3 min-w-[280px]">
              <StatCard label="Instruments" value={totalInstruments}      accent="indigo" />
              <StatCard label="Cable rows"  value={totalRows}             accent="blue"   />
              <StatCard label="Plant unit"  value={meta.plant_unit || '—'} accent="cyan"   />
              <StatCard label="IES area"    value={meta.ies_area   || '—'} accent="emerald" />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Feature highlights ───────────────────────────────────────── */}
      <section className={`${LAYOUT_CONFIG.contentMaxW} ${LAYOUT_CONFIG.sectionGapY}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {FEATURE_HIGHLIGHTS.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl bg-white/80 backdrop-blur border border-gray-200 p-4 shadow-sm hover:shadow-md hover:-translate-y-px transition-all"
            >
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-100 to-blue-100 text-indigo-700">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="text-sm font-semibold text-gray-800">{title}</div>
              </div>
              <p className="text-xs text-gray-600 mt-2 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Body: Form + Results ─────────────────────────────────────── */}
      <div className={`${LAYOUT_CONFIG.contentMaxW} ${LAYOUT_CONFIG.cardGapY} space-y-6`}>
        <section className="rounded-2xl bg-white border border-gray-200 shadow-lg overflow-hidden">
          <header className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white">
            <div>
              <h2 className="text-base font-semibold text-gray-800">Stage 1 — Drawing input</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {UPLOAD_SLOTS.legend.enabled
                  ? 'P&ID PDF + optional Legend sheet + drawing metadata.'
                  : 'P&ID PDF + drawing metadata.'}
              </p>
            </div>
            {hasResults && (
              <button
                onClick={reset}
                className="inline-flex items-center px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-md text-xs font-semibold text-gray-700 shadow-sm"
              >
                <ArrowPathIcon className="h-3.5 w-3.5 mr-1" /> Start over
              </button>
            )}
          </header>

          <div className="px-6 py-5">
            <div className={`grid grid-cols-1 ${UPLOAD_SLOTS.legend.enabled ? 'lg:grid-cols-2' : ''} gap-6`}>
              {UPLOAD_SLOTS.pid.enabled && (
                <FileDrop
                  label={UPLOAD_SLOTS.pid.label} required={UPLOAD_SLOTS.pid.required}
                  file={pidFile} onPick={onPidPick} onClear={() => setPidFile(null)}
                />
              )}
              {UPLOAD_SLOTS.legend.enabled && (
                <FileDrop
                  label={UPLOAD_SLOTS.legend.label} required={UPLOAD_SLOTS.legend.required}
                  file={legendFile} onPick={onLegendPick} onClear={() => setLegendFile(null)}
                />
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
              {META_FIELDS.map((f) => (
                <TextField
                  key={f.key}
                  label={f.label}
                  value={meta[f.key] ?? ''}
                  onChange={onMeta(f.key)}
                  placeholder={f.placeholder}
                  required={f.required}
                  hint={f.hint}
                />
              ))}
            </div>

            <div className="mt-6 flex items-center gap-3 flex-wrap">
              <button
                onClick={submit}
                disabled={busy || !pidFile}
                className={`inline-flex items-center px-5 py-2.5 rounded-md text-white font-medium text-sm shadow
                  bg-gradient-to-r ${PAGE_CONFIG.brandGradient} disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md transition`}
              >
                {busy
                  ? <><ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" /> Extracting…</>
                  : <><CloudArrowUpIcon className="h-4 w-4 mr-2" /> Analyze drawing</>}
              </button>
              {busy && (
                <button
                  onClick={cancel}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                >
                  <XCircleIcon className="h-4 w-4 mr-1" /> Cancel
                </button>
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          </div>
        </section>

        {hasResults && SECTIONS.showStatsStrip && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Instruments" value={totalInstruments}       accent="indigo" />
            <StatCard label="Cable rows"  value={totalRows}              accent="blue"   />
            <StatCard label="Plant unit"  value={meta.plant_unit || '—'} accent="cyan"   />
            <StatCard label="IES area"    value={meta.ies_area   || '—'} accent="emerald" />
          </div>
        )}

        {hasResults && (
          <ResultsTable rows={rows} stats={stats} excelUrl={excelUrl} />
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────
const STAT_ACCENTS = {
  indigo:  'from-indigo-50 to-indigo-100 text-indigo-700 border-indigo-200',
  blue:    'from-blue-50 to-blue-100 text-blue-700 border-blue-200',
  cyan:    'from-cyan-50 to-cyan-100 text-cyan-700 border-cyan-200',
  emerald: 'from-emerald-50 to-emerald-100 text-emerald-700 border-emerald-200',
}
function StatCard({ label, value, accent = 'indigo' }) {
  const cls = STAT_ACCENTS[accent] || STAT_ACCENTS.indigo
  return (
    <div className={`rounded-xl bg-gradient-to-br ${cls} border px-3 py-2 shadow-sm`}>
      <div className="text-[10px] uppercase tracking-wide opacity-70 font-semibold">{label}</div>
      <div className="text-xl font-bold leading-tight mt-0.5 truncate">{value}</div>
    </div>
  )
}
function FileDrop({ label, required, file, onPick, onClear }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 hover:border-indigo-400 hover:bg-indigo-50/30 transition">
        {file ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <DocumentTextIcon className="h-5 w-5 text-indigo-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <button onClick={onClear} className="text-gray-400 hover:text-red-500">
              <XCircleIcon className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center cursor-pointer py-4">
            <CloudArrowUpIcon className="h-8 w-8 text-gray-400 mb-1" />
            <span className="text-sm text-gray-600">Click to select PDF</span>
            <input type="file" accept={CBD_ACCEPT_PDF} className="hidden" onChange={onPick} />
          </label>
        )}
      </div>
    </div>
  )
}

function TextField({ label, value, onChange, hint, placeholder, required }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      />
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  )
}

function ResultsTable({ rows, stats, excelUrl }) {
  const cols = useMemo(() => CBD_COLUMNS, [])
  const previewRows = useMemo(
    () => rows.slice(0, CBD_REPORT_CONFIG.maxPreviewRows),
    [rows],
  )
  // Pre-compute summary chip groups once per render.
  const summaryGroups = useMemo(
    () =>
      CBD_REPORT_CONFIG.summaryChips.map((s) => ({
        ...s,
        counts: countByField(rows, s.field),
      })),
    [rows],
  )

  return (
    <section className="rounded-2xl bg-white border border-gray-200 shadow-lg overflow-hidden">
      {/* Report header — icon + title + subtitle + total badge + download (IO List style) */}
      <div className="px-6 pt-5 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <CpuChipIcon className="h-5 w-5 text-indigo-600" />
          <h3 className="text-sm font-bold text-gray-800">
            {CBD_REPORT_CONFIG.title}
          </h3>
          <span className="text-[11px] text-gray-500">— {CBD_REPORT_CONFIG.subtitle}</span>

          <span className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <CheckBadgeIcon className="h-3.5 w-3.5" />
            {stats?.total_instruments ?? 0} instruments
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <TableCellsIcon className="h-3.5 w-3.5" />
            {stats?.total_rows ?? rows.length} cable rows
          </span>

          {excelUrl && (
            <a
              href={excelUrl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white shadow-sm bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 hover:shadow-md transition-all"
            >
              <ArrowDownTrayIcon className="h-3.5 w-3.5" />
              {CBD_REPORT_CONFIG.downloadLabel}
            </a>
          )}
        </div>

        {/* Summary chips — distinct values per configured field, with counts */}
        {summaryGroups.some((g) => Object.keys(g.counts).length > 0) && (
          <div className="mt-3 space-y-2">
            {summaryGroups.map((g) => {
              const entries = Object.entries(g.counts).sort((a, b) => b[1] - a[1])
              if (entries.length === 0) return null
              return (
                <div key={g.field} className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-20 shrink-0">
                    {g.label}
                  </span>
                  {entries.map(([val, count]) => (
                    <span
                      key={val}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${pillClass(g.palette, val)}`}
                    >
                      {val}
                      <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-white/70 text-[10px] font-bold">
                        {count}
                      </span>
                    </span>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Compact table — IO List style: text-xs, divide-y, gradient header, hover rows */}
      <div className="px-6 pb-6">
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="min-w-full text-xs">
            <thead className="bg-gradient-to-r from-indigo-50 via-blue-50 to-cyan-50 text-gray-700 sticky top-0 z-10">
              <tr>
                {cols.map((c) => (
                  <th
                    key={c.key}
                    className={`px-2.5 py-2 font-semibold whitespace-nowrap border-b border-indigo-100 ${c.width || ''} ${c.align === 'left' ? 'text-left' : 'text-center'}`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {previewRows.map((r, idx) => (
                <tr key={idx} className="hover:bg-indigo-50/40 transition-colors">
                  {cols.map((c) => {
                    const val = r[c.key] ?? ''
                    if (c.pill && val) {
                      return (
                        <td key={c.key} className="px-2.5 py-1.5 text-center whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${pillClass(c.pill, String(val))}`}>
                            {val}
                          </span>
                        </td>
                      )
                    }
                    return (
                      <td
                        key={c.key}
                        className={`px-2.5 py-1.5 whitespace-nowrap ${c.align === 'left' ? 'text-left' : 'text-center'} ${c.mono ? 'font-mono text-[11px] text-gray-800' : 'text-gray-700'}`}
                      >
                        {val}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > CBD_REPORT_CONFIG.maxPreviewRows && (
          <p className="mt-2 text-[11px] text-gray-500 italic">
            Showing first {CBD_REPORT_CONFIG.maxPreviewRows} of {rows.length} rows — full set is in the Excel download.
          </p>
        )}
      </div>
    </section>
  )
}
