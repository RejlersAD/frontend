/**
 * InstrumentToolHub
 * ────────────────────────────────────────────────────────────────────────────
 * Engaging, animated AI-powered workspace shared by the three Instrument Tools:
 *   • IO List
 *   • Cable Block Diagram
 *   • Cable Schedule
 *
 * The parent passes a `tool` object describing the client (generate/qc),
 * label, accepted columns, and accent gradient. Nothing here is hardcoded
 * to a specific tool — soft-coded constants govern animation timings,
 * accepted file types, preview caps, severity styles, and the visual feel.
 */
import { useEffect, useMemo, useRef, useState, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import InstrumentQualityReport from './InstrumentQualityReport'
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  BeakerIcon,
  BoltIcon,
  CheckBadgeIcon,
  ChevronRightIcon,
  ClipboardDocumentCheckIcon,
  CloudArrowUpIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  HomeIcon,
  RocketLaunchIcon,
  SparklesIcon,
  TableCellsIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'react-toastify'

// ── Soft-coded constants ────────────────────────────────────────────────────
const MODE_GENERATE = 'generate'
const MODE_QC = 'qc'
// QC sub-view (only meaningful when mode === MODE_QC).
//   'data'    — visualisation-first: data grid + summary + inline issues (preferred default).
//   'report'  — sophisticated, PID-Verification-styled quality report.
const QC_VIEW_DATA    = 'data'
const QC_VIEW_REPORT  = 'report'
const QC_VIEW_DEFAULT = QC_VIEW_DATA   // user-preferred default
const ACCEPTED_FILE_EXT = '.xlsx,.xlsm,.xls,.csv,.pdf,.json,.html,.htm,.txt,.tsv,.png,.jpg,.jpeg,.gif,.tif,.tiff,.bmp,.webp'
const MAX_PREVIEW_ROWS = 200          // table preview cap (UI only)
const MAX_ISSUE_PREVIEW = 500         // issue list cap (UI only)

// Animation tuning (single source of truth)
const COUNTUP_DURATION_MS = 900
const PARTICLE_COUNT = 14
const PARTICLE_MIN_SIZE = 4           // px
const PARTICLE_MAX_SIZE = 11          // px
const PARTICLE_MIN_DURATION = 8       // s
const PARTICLE_MAX_DURATION = 18      // s
const TYPEWRITER_PHRASES = [
  'Parsing headers…',
  'Normalising columns…',
  'Running rule engine…',
  'Cross-checking duplicates…',
  'Composing results…',
]
const TYPEWRITER_INTERVAL_MS = 1100

const SEVERITY_STYLES = {
  error:   'bg-red-100 text-red-800 border-red-200',
  warning: 'bg-amber-100 text-amber-800 border-amber-200',
  info:    'bg-blue-100 text-blue-800 border-blue-200',
}

// Soft-coded breadcrumb trail shared by all three tools. Each tool can
// override the last entry via `tool.breadcrumb` if desired.
const DEFAULT_BREADCRUMB = [
  { label: 'Engineering',         path: '/dashboard' },
  { label: 'Instrument',          path: '/engineering/instrument/datasheet' },
  { label: 'Instrument Datasheets', path: '/engineering/instrument/datasheet' },
]

// Soft-coded default destination for the primary "Back" button.
const DEFAULT_BACK_PATH  = '/engineering/instrument/datasheet'
const DEFAULT_BACK_LABEL = 'Back to Instrument Datasheets'

// Soft-coded "AI capability" badges shown under the hero.
const AI_CAPABILITY_BADGES = [
  { icon: SparklesIcon,      label: 'AI-Assisted Schema Mapping' },
  { icon: CpuChipIcon,        label: 'Deterministic Rule Engine' },
  { icon: BeakerIcon,         label: 'Header Alias Detection' },
  { icon: BoltIcon,           label: 'Instant QC Feedback' },
]

function _humanize(key) {
  return String(key || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// Safe stringifier — some backend AI fields can legitimately be objects/arrays.
// Never let React try to render one directly.
function _str(v, fallback = '') {
  if (v == null) return fallback
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return v.map(x => _str(x)).filter(Boolean).join(', ') || fallback
  if (typeof v === 'object') {
    for (const k of ['label', 'name', 'value', 'method', 'pattern', 'text']) {
      if (v[k] != null && (typeof v[k] === 'string' || typeof v[k] === 'number')) return String(v[k])
    }
    try {
      const j = JSON.stringify(v)
      return (j && j !== '{}') ? j : fallback
    } catch { return fallback }
  }
  return String(v)
}

function _downloadBase64Xlsx(download) {
  if (!download?.base64) return
  const binary = atob(download.base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: download.content_type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = download.filename || 'instrument-tool.xlsx'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Pre-generate particle positions once per mount — keeps render cheap and
// avoids re-randomising on every state change.
function _useParticles() {
  return useMemo(() => {
    const range = PARTICLE_MAX_SIZE - PARTICLE_MIN_SIZE
    const durRange = PARTICLE_MAX_DURATION - PARTICLE_MIN_DURATION
    return Array.from({ length: PARTICLE_COUNT }).map((_, i) => ({
      id: i,
      left:     Math.random() * 100,
      delay:    Math.random() * 6,
      duration: PARTICLE_MIN_DURATION + Math.random() * durRange,
      size:     PARTICLE_MIN_SIZE + Math.random() * range,
      opacity:  0.18 + Math.random() * 0.35,
    }))
  }, [])
}

// ── Animated numeric counter ────────────────────────────────────────────────
function useCountUp(target) {
  const [value, setValue] = useState(0)
  const rafRef = useRef(null)
  useEffect(() => {
    const start = performance.now()
    const to = Number(target) || 0
    const step = (now) => {
      const t = Math.min(1, (now - start) / COUNTUP_DURATION_MS)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      setValue(Math.round(to * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => rafRef.current && cancelAnimationFrame(rafRef.current)
  }, [target])
  return value
}

// ── Rotating processing phrase ──────────────────────────────────────────────
function useRotatingPhrase(active) {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    if (!active) return undefined
    const t = setInterval(
      () => setIdx((i) => (i + 1) % TYPEWRITER_PHRASES.length),
      TYPEWRITER_INTERVAL_MS,
    )
    return () => clearInterval(t)
  }, [active])
  return TYPEWRITER_PHRASES[idx]
}

export default function InstrumentToolHub({ tool }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState(MODE_GENERATE)
  const [qcView, setQcView] = useState(QC_VIEW_DEFAULT)
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  // Soft-coded back-navigation config — `tool` can override either field.
  const backPath  = tool.backPath  || DEFAULT_BACK_PATH
  const backLabel = tool.backLabel || DEFAULT_BACK_LABEL
  const breadcrumb = [
    ...(tool.breadcrumb || DEFAULT_BREADCRUMB),
    { label: tool.title, current: true },
  ]
  const handleBack = () => {
    // Prefer real history when available; otherwise fall back to the soft-coded path.
    if (window.history.length > 1) navigate(-1)
    else navigate(backPath)
  }

  const particles = _useParticles()
  const processingPhrase = useRotatingPhrase(busy)

  const columns = useMemo(
    () => result?.columns || tool.columns || [],
    [result, tool.columns],
  )
  const rows = result?.rows || []
  const issues = result?.issues || []
  const summary = result?.summary
  const aiMeta  = result?.ai || null

  const handleFile = (f) => {
    setFile(f || null)
    setResult(null)
  }

  const onFileChange = (e) => handleFile(e.target.files?.[0])

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }

  const onRun = async (downloadAfter = false) => {
    if (!file) {
      toast.warn('Please choose a spreadsheet first.')
      return
    }
    setBusy(true)
    try {
      const fn = mode === MODE_QC ? tool.client.qc : tool.client.generate
      const resp = await fn({ file, download: downloadAfter && mode === MODE_GENERATE })
      const data = resp?.data || resp
      setResult(data)
      if (downloadAfter && data?.download) {
        _downloadBase64Xlsx(data.download)
      }
      const msg = mode === MODE_QC
        ? `QC complete — ${data?.summary?.errors || 0} error(s), ${data?.summary?.warnings || 0} warning(s).`
        : `Generated ${data?.rows?.length || 0} row(s).`
      toast.success(msg)
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'Request failed'
      toast.error(detail)
    } finally {
      setBusy(false)
    }
  }

  const accent = tool.accent || 'from-purple-600 to-indigo-600'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 py-8 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Local component-scoped keyframes & helpers */}
      <style>{`
        @keyframes itAurora {
          0%, 100% { transform: translate3d(0,0,0) scale(1); }
          50%      { transform: translate3d(2%, -3%, 0) scale(1.08); }
        }
        @keyframes itFloat {
          0%   { transform: translateY(0)        scale(1);   opacity: 0; }
          10%  { opacity: var(--it-op, .35); }
          50%  { transform: translateY(-60vh)    scale(1.1); }
          90%  { opacity: var(--it-op, .35); }
          100% { transform: translateY(-110vh)   scale(0.9); opacity: 0; }
        }
        @keyframes itShimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes itPulseRing {
          0%   { transform: scale(.85); opacity: .8; }
          80%  { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes itFadeUp {
          0%   { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes itBarSweep {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .it-aurora      { animation: itAurora 16s ease-in-out infinite; }
        .it-particle    { animation: itFloat var(--it-dur, 12s) linear infinite; }
        .it-shimmer-txt {
          background-image: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.85) 50%, rgba(255,255,255,0) 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          animation: itShimmer 2.4s linear infinite;
        }
        .it-pulse-ring::before {
          content:''; position:absolute; inset:0; border-radius: 9999px;
          border:2px solid currentColor;
          animation: itPulseRing 1.6s ease-out infinite;
        }
        .it-fade-up     { animation: itFadeUp .45s ease-out both; }
        .it-bar-sweep   {
          position:absolute; inset:0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent);
          animation: itBarSweep 1.6s linear infinite;
        }
      `}</style>

      {/* Animated aurora blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-0">
        <div className={`absolute -top-32 -left-20 w-[28rem] h-[28rem] rounded-full blur-3xl opacity-30 bg-gradient-to-br ${accent} it-aurora`} />
        <div className={`absolute -bottom-40 -right-24 w-[32rem] h-[32rem] rounded-full blur-3xl opacity-25 bg-gradient-to-tr ${accent} it-aurora`} style={{ animationDelay: '4s' }} />
      </div>

      {/* Floating particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-0">
        {particles.map((p) => (
          <span
            key={p.id}
            className={`it-particle absolute rounded-full bg-gradient-to-br ${accent} blur-[1px]`}
            style={{
              left:    `${p.left}%`,
              bottom:  '-3rem',
              width:   `${p.size}px`,
              height:  `${p.size}px`,
              ['--it-dur']: `${p.duration}s`,
              ['--it-op']: p.opacity,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Back navigation + breadcrumb */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 it-fade-up">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 bg-white/80 backdrop-blur-sm border border-gray-200 shadow-sm hover:bg-white hover:border-purple-300 hover:text-purple-700 transition-all"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            {backLabel}
          </button>

          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-gray-600">
            <HomeIcon className="h-3.5 w-3.5 text-gray-400" />
            {breadcrumb.map((b, i) => (
              <span key={`${b.label}-${i}`} className="flex items-center gap-1.5">
                {b.current
                  ? <span className="font-semibold text-gray-800">{b.label}</span>
                  : (
                    <button
                      type="button"
                      onClick={() => b.path && navigate(b.path)}
                      className="hover:text-purple-700 transition-colors"
                    >
                      {b.label}
                    </button>
                  )
                }
                {i < breadcrumb.length - 1 && (
                  <ChevronRightIcon className="h-3.5 w-3.5 text-gray-300" />
                )}
              </span>
            ))}
          </nav>
        </div>

        {/* Hero */}
        <div className={`relative rounded-3xl bg-gradient-to-r ${accent} p-8 text-white shadow-2xl overflow-hidden it-fade-up`}>
          <div className="absolute inset-0 opacity-30 mix-blend-overlay" style={{
            backgroundImage:
              'radial-gradient(circle at 20% 30%, rgba(255,255,255,.5), transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,.4), transparent 35%)',
          }} />
          <div className="relative flex items-start gap-5">
            <div className="relative text-white">
              <div className="p-4 rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/30 relative it-pulse-ring">
                <SparklesIcon className="h-9 w-9" />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-white/90">
                <RocketLaunchIcon className="h-4 w-4" />
                AI-Powered Engineering Toolkit
              </div>
              <h1 className="mt-2 text-4xl font-extrabold leading-tight">
                {tool.title}
                <span className="ml-2 inline-block it-shimmer-txt text-transparent">✦</span>
              </h1>
              <p className="mt-2 text-white/90 max-w-3xl">{tool.description}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {AI_CAPABILITY_BADGES.map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm ring-1 ring-white/25 text-xs font-medium"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="mt-6 inline-flex rounded-xl border border-gray-200 bg-white/80 backdrop-blur-sm p-1 shadow-sm it-fade-up">
          {[
            { id: MODE_GENERATE, label: 'Generator',     icon: SparklesIcon },
            { id: MODE_QC,       label: 'Quality Check', icon: ClipboardDocumentCheckIcon },
          ].map((t) => {
            const Icon = t.icon
            const active = mode === t.id
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => { setMode(t.id); setResult(null); setQcView(QC_VIEW_DEFAULT) }}
                className={`relative flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  active
                    ? `bg-gradient-to-r ${accent} text-white shadow-md scale-[1.02]`
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? 'animate-pulse' : ''}`} />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Upload card */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`mt-4 bg-white/90 backdrop-blur-sm rounded-2xl border shadow-sm p-6 transition-all duration-200 it-fade-up ${
            dragOver ? 'border-purple-400 ring-4 ring-purple-100 scale-[1.005]' : 'border-gray-200'
          }`}
        >
          <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <CloudArrowUpIcon className="h-5 w-5 text-purple-600" />
            Upload {mode === MODE_QC ? 'a list to validate' : 'source data'} — drag &amp; drop or click to browse
          </span>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className={`group flex items-center gap-2 px-4 py-3 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
              dragOver
                ? 'border-purple-500 bg-purple-50/60'
                : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50/40'
            }`}>
              <CloudArrowUpIcon className="h-5 w-5 text-gray-500 group-hover:text-purple-600 transition-colors" />
              <span className="text-sm text-gray-700">
                {file
                  ? <span className="font-medium text-purple-700">{file.name}</span>
                  : 'Choose file or drop here…'}
              </span>
              <input
                type="file"
                accept={ACCEPTED_FILE_EXT}
                className="hidden"
                onChange={onFileChange}
              />
            </label>

            <button
              type="button"
              disabled={busy || !file}
              onClick={() => onRun(false)}
              className={`relative overflow-hidden inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r ${accent} shadow-md hover:shadow-xl hover:scale-[1.03] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100`}
            >
              {busy && <span className="it-bar-sweep" />}
              {busy
                ? <ArrowPathIcon className="h-4 w-4 animate-spin relative" />
                : (mode === MODE_QC
                    ? <ClipboardDocumentCheckIcon className="h-4 w-4 relative" />
                    : <SparklesIcon className="h-4 w-4 relative" />)
              }
              <span className="relative">{mode === MODE_QC ? 'Run QC' : 'Generate'}</span>
            </button>

            {mode === MODE_GENERATE && (
              <button
                type="button"
                disabled={busy || !file}
                onClick={() => onRun(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 hover:border-purple-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                Generate + Download
              </button>
            )}

            {busy && (
              <span className="ml-2 inline-flex items-center gap-2 text-xs text-purple-700 font-medium">
                <CpuChipIcon className="h-4 w-4 animate-pulse" />
                {processingPhrase}
              </span>
            )}
          </div>

          <p className="mt-3 text-xs text-gray-500">
            Accepts spreadsheets (xlsx/xlsm/xls/csv), PDFs, JSON, HTML tables, plain text/TSV and even images (OCR).
            Headers are auto-matched against the canonical schema — common aliases are recognised automatically.
          </p>
        </div>

        {/* QC Mode — user-friendly view switcher (Visualisation ↔ Report) */}
        {mode === MODE_QC && result && (
          <div className="mt-6 flex items-center justify-between flex-wrap gap-3 it-fade-up">
            <div className="text-xs text-slate-500">
              Quality Check completed — choose how to view the results:
            </div>
            <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 shadow-inner">
              {[
                { id: QC_VIEW_DATA,   label: 'Visualisation', icon: TableCellsIcon, hint: 'Data grid + summary' },
                { id: QC_VIEW_REPORT, label: 'Report',        icon: ChartBarIcon,   hint: 'Sophisticated quality report' },
              ].map(v => {
                const active = qcView === v.id
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setQcView(v.id)}
                    title={v.hint}
                    className={[
                      'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all',
                      active
                        ? 'bg-white text-purple-700 shadow-sm border border-purple-200'
                        : 'text-slate-500 hover:text-slate-800',
                    ].join(' ')}
                  >
                    <v.icon className="h-4 w-4" />
                    {v.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* QC Mode — sophisticated quality report (only when user picks 'Report') */}
        {mode === MODE_QC && result && qcView === QC_VIEW_REPORT && (
          <InstrumentQualityReport result={result} tool={tool} accent={accent} />
        )}

        {/* Visualisation-style summary (shown for Generate mode AND for QC 'Data' view) */}
        {((mode !== MODE_QC) || (mode === MODE_QC && qcView === QC_VIEW_DATA)) && summary && (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 it-fade-up">
            <SummaryCard label="Rows"     value={summary.total_rows} tone="neutral" />
            <SummaryCard label="Errors"   value={summary.errors}     tone="error" />
            <SummaryCard label="Warnings" value={summary.warnings}   tone="warning" />
            <SummaryCard
              label="Status"
              value={summary.pass ? 'PASS' : 'FAIL'}
              tone={summary.pass ? 'ok' : 'error'}
              icon={summary.pass ? CheckBadgeIcon : ExclamationTriangleIcon}
              raw
            />
          </div>
        )}

        {/* AI Insights — visible in Generate mode AND in QC 'Data' view */}
        {((mode !== MODE_QC) || (mode === MODE_QC && qcView === QC_VIEW_DATA)) && aiMeta && (
          <div className="mt-6 bg-gradient-to-br from-purple-50 via-white to-fuchsia-50 rounded-2xl border border-purple-200 shadow-sm p-4 it-fade-up">
            <div className="flex items-center gap-2 mb-3">
              <SparklesIcon className="h-5 w-5 text-purple-600" />
              <h2 className="text-sm font-semibold text-gray-800">AI Insights</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {aiMeta.header_confidence != null && (
                <AIChip
                  label="Header mapping"
                  value={`${Math.round((aiMeta.header_confidence || 0) * 100)}% match`}
                  detail={aiMeta.header_method}
                />
              )}
              {aiMeta.tag_pattern?.pattern && (
                <AIChip
                  label="Tag pattern learned"
                  value={aiMeta.tag_pattern.label || aiMeta.tag_pattern.pattern}
                  detail={`coverage ${Math.round((aiMeta.tag_pattern.coverage || 0) * 100)}%`}
                />
              )}
              {Array.isArray(aiMeta.unmapped_headers) && aiMeta.unmapped_headers.length > 0 && (
                <AIChip
                  label="Unmapped headers"
                  value={`${aiMeta.unmapped_headers.length}`}
                  detail={aiMeta.unmapped_headers.slice(0, 3).join(', ')}
                />
              )}
              {Array.isArray(aiMeta.cabinet_utilisation) && aiMeta.cabinet_utilisation.length > 0 && (
                <AIChip
                  label="Cabinets allocated"
                  value={`${aiMeta.cabinet_utilisation.length}`}
                  detail={`max ${Math.round(Math.max(0, ...aiMeta.cabinet_utilisation.map(c => c.utilisation || 0)) * 100)}% used`}
                />
              )}
              {aiMeta.loop_expansion?.families && Object.keys(aiMeta.loop_expansion.families).length > 0 && (
                <AIChip
                  label="Loops expanded"
                  value={Object.values(aiMeta.loop_expansion.families).reduce((a, b) => a + b, 0)}
                  detail={Object.keys(aiMeta.loop_expansion.families).join(', ')}
                />
              )}
            </div>
          </div>
        )}

        {/* Issues table — visible in Generate mode AND in QC 'Data' view */}
        {((mode !== MODE_QC) || (mode === MODE_QC && qcView === QC_VIEW_DATA)) && issues.length > 0 && (
          <div className="mt-6 bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-sm overflow-hidden it-fade-up">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
                Issues ({issues.length})
              </h2>
              <span className="text-xs text-gray-500">
                Showing first {Math.min(issues.length, MAX_ISSUE_PREVIEW)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <Th>Row</Th><Th>Field</Th><Th>Severity</Th><Th>Message</Th><Th>Value</Th>
                  </tr>
                </thead>
                <tbody>
                  {issues.slice(0, MAX_ISSUE_PREVIEW).map((it, i) => (
                    <Fragment key={i}>
                    <tr
                      key={i}
                      className="border-t border-gray-100 hover:bg-purple-50/40 transition-colors"
                      style={{ animation: `itFadeUp .3s ease-out both`, animationDelay: `${Math.min(i, 30) * 12}ms` }}
                    >
                      <Td>{_str(it.row)}</Td>
                      <Td className="font-mono text-xs">{_str(it.field)}</Td>
                      <Td>
                        <span className={`px-2 py-0.5 text-xs rounded-full border ${SEVERITY_STYLES[it.severity] || ''}`}>
                          {_str(it.severity)}
                        </span>
                      </Td>
                      <Td>{_str(it.message)}</Td>
                      <Td className="text-gray-500">{_str(it.value)}</Td>
                    </tr>
                    {(it.explanation || it.suggested_fix) && (
                      <tr key={`${i}-ai`} className="bg-purple-50/40">
                        <Td colSpan={5} className="text-xs text-gray-700">
                          {it.explanation && (
                            <div className="mb-1">
                              <span className="font-semibold text-purple-700">Why: </span>
                              {_str(it.explanation)}
                            </div>
                          )}
                          {it.suggested_fix && (
                            <div>
                              <span className="font-semibold text-purple-700">Fix: </span>
                              {_str(it.suggested_fix)}
                            </div>
                          )}
                        </Td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Result rows */}
        {rows.length > 0 && (
          <div className="mt-6 bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-sm overflow-hidden it-fade-up">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <SparklesIcon className="h-4 w-4 text-purple-600" />
                {mode === MODE_QC ? 'Normalised Data' : 'Generated Rows'} ({rows.length})
              </h2>
              <span className="text-xs text-gray-500">
                Previewing first {Math.min(rows.length, MAX_PREVIEW_ROWS)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    {columns.map((c) => <Th key={c}>{_humanize(c)}</Th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, MAX_PREVIEW_ROWS).map((r, i) => (
                    <tr
                      key={i}
                      className="border-t border-gray-100 hover:bg-purple-50/40 transition-colors"
                      style={{ animation: `itFadeUp .3s ease-out both`, animationDelay: `${Math.min(i, 30) * 10}ms` }}
                    >
                      {columns.map((c) => (
                        <Td key={c} className="whitespace-nowrap">
                          {_str(r[c])}
                        </Td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty hint when no result */}
        {!result && !busy && (
          <div className="mt-8 text-center text-sm text-gray-500 it-fade-up">
            <CpuChipIcon className="h-10 w-10 mx-auto text-gray-300" />
            <p className="mt-2">
              Drop a spreadsheet above and let the AI rule engine do the heavy lifting.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function Th({ children }) {
  return <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-xs">{children}</th>
}

function Td({ children, className = '', colSpan }) {
  return <td colSpan={colSpan} className={`px-3 py-2 align-top text-gray-800 ${className}`}>{children}</td>
}

function AIChip({ label, value, detail }) {
  const safeValue  = _str(value, '—')
  const safeDetail = detail == null ? '' : _str(detail)
  return (
    <div className="rounded-xl border border-purple-200 bg-white/70 backdrop-blur-sm p-3 shadow-sm hover:shadow-md transition-all">
      <div className="text-[10px] uppercase tracking-widest text-purple-700 font-semibold">{_str(label)}</div>
      <div className="text-lg font-bold text-gray-900 mt-0.5">{safeValue}</div>
      {safeDetail && <div className="text-xs text-gray-500 mt-0.5 truncate" title={safeDetail}>{safeDetail}</div>}
    </div>
  )
}

function SummaryCard({ label, value, tone = 'neutral', icon: Icon, raw = false }) {
  const numeric = typeof value === 'number'
  const animated = useCountUp(numeric ? value : 0)
  const display = raw || !numeric ? value : animated

  const styles = {
    neutral: 'bg-white text-gray-800 border-gray-200',
    ok:      'bg-gradient-to-br from-green-50 to-emerald-100 text-green-800 border-green-200',
    error:   'bg-gradient-to-br from-red-50 to-rose-100 text-red-800 border-red-200',
    warning: 'bg-gradient-to-br from-amber-50 to-yellow-100 text-amber-800 border-amber-200',
  }[tone]
  return (
    <div className={`relative rounded-2xl border p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all ${styles}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-widest opacity-70 font-semibold">{label}</span>
        {Icon && <Icon className="h-5 w-5 opacity-80" />}
      </div>
      <div className="mt-1 text-3xl font-extrabold tabular-nums">{display}</div>
    </div>
  )
}
