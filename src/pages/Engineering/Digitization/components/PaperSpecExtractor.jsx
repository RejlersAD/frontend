/**
 * PaperSpecExtractor
 * ──────────────────
 * Self-contained extractor panel: upload PDF → poll job → display
 * extracted Piping Classes + components. All knobs in `PANEL_CONFIG`.
 *
 * No core logic of any other feature is touched.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CloudArrowUpIcon,
  DocumentArrowDownIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  Cog6ToothIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  SparklesIcon,
  DocumentTextIcon,
  PhotoIcon,
  TableCellsIcon,
  MagnifyingGlassIcon,
  RectangleStackIcon,
  BeakerIcon,
  ShieldCheckIcon,
  CircleStackIcon,
} from '@heroicons/react/24/outline';
import specCustomizationAPI, { SPEC_API_CONFIG } from '../../../../services/specCustomizationAPI';
import WorkbookCanvas from './WorkbookCanvas';
import WrenchAiDocAssist from '../../../../components/Engineering/WrenchAiDocAssist';

// ─── Soft-coded helpers (file format detection) ──────────────────────────────
// Per-group icon (kept local because heroicons are JSX components and cannot
// live inside the plain-data API config module).
const GROUP_ICONS = {
  pdf:    DocumentTextIcon,
  image:  PhotoIcon,
  office: TableCellsIcon,
  text:   DocumentTextIcon,
};

/** Detect file format from filename, using the soft-coded API config maps. */
const detectFormat = (filename) => {
  const ext = (filename || '').split('.').pop()?.toLowerCase() || '';
  const group = SPEC_API_CONFIG.extToGroup?.[ext] || null;
  const meta  = group ? SPEC_API_CONFIG.formatGroups?.[group] : null;
  return { ext, group, meta };
};

// ─── Soft-coded class-summary panel (stats + filters) ────────────────────────
// Each stat card declares its metric, label, icon, gradient and value-formatter.
// Adding a new metric = adding one row here; the renderer is generic.
const CLASS_SUMMARY_CONFIG = {
  // ── Headline AI insight banner ─────────────────────────────────────
  aiBanner: {
    eyebrow:    'RAD AI · Spec Intelligence',
    title:      'AI extracted your Piping Material Specification',
    // Returns an array of inline tokens for the headline insight sentence.
    insight: (a) => ([
      { text: 'Analysed ' },
      { text: a.totalClasses.toLocaleString(),     tone: 'pink'    },
      { text: ' Piping Classes containing ' },
      { text: a.totalComponents.toLocaleString(),  tone: 'violet'  },
      { text: ' component rows across ' },
      { text: a.uniqueMaterials.toLocaleString(),  tone: 'sky'     },
      { text: ' unique materials and ' },
      { text: a.uniqueRatings.toLocaleString(),    tone: 'amber'   },
      { text: ' pressure ratings — overall confidence ' },
      { text: a.avgConfidence == null ? '—' : `${Math.round(a.avgConfidence * 100)}%`, tone: 'emerald' },
      { text: '.' },
    ]),
  },
  // Inline-token highlight tones used by the banner sentence above.
  highlightTones: {
    pink:    'text-pink-200 font-bold',
    violet:  'text-violet-200 font-bold',
    sky:     'text-sky-200 font-bold',
    amber:   'text-amber-200 font-bold',
    emerald: 'text-emerald-200 font-bold',
  },
  // ── KPI cards ──────────────────────────────────────────────────────
  stats: [
    {
      key: 'classes',
      label: 'Piping Classes',
      sublabel: 'distinct specs',
      icon: RectangleStackIcon,
      tone: 'from-pink-500 via-rose-500 to-fuchsia-600',
      ring: 'ring-pink-300/40',
      glow: 'shadow-pink-500/30',
      compute: (a) => a.totalClasses,
      format: (v) => v.toLocaleString(),
      barPct: () => 100,
    },
    {
      key: 'components',
      label: 'Component Rows',
      sublabel: 'individual items',
      icon: TableCellsIcon,
      tone: 'from-violet-500 via-purple-600 to-indigo-600',
      ring: 'ring-violet-300/40',
      glow: 'shadow-violet-500/30',
      compute: (a) => a.totalComponents,
      format: (v) => v.toLocaleString(),
      barPct: (a) => a.totalClasses ? Math.min(100, (a.totalComponents / (a.totalClasses * 30)) * 100) : 0,
    },
    {
      key: 'materials',
      label: 'Unique Materials',
      sublabel: 'grades detected',
      icon: BeakerIcon,
      tone: 'from-sky-500 via-cyan-500 to-blue-600',
      ring: 'ring-sky-300/40',
      glow: 'shadow-sky-500/30',
      compute: (a) => a.uniqueMaterials,
      format: (v) => v.toLocaleString(),
      barPct: (a) => a.totalClasses ? Math.min(100, (a.uniqueMaterials / a.totalClasses) * 100) : 0,
    },
    {
      key: 'ratings',
      label: 'Pressure Ratings',
      sublabel: 'class families',
      icon: CircleStackIcon,
      tone: 'from-amber-500 via-orange-500 to-red-500',
      ring: 'ring-amber-300/40',
      glow: 'shadow-amber-500/30',
      compute: (a) => a.uniqueRatings,
      format: (v) => v.toLocaleString(),
      barPct: (a) => Math.min(100, a.uniqueRatings * 12),
    },
    {
      key: 'confidence',
      label: 'Avg Confidence',
      sublabel: 'AI verified',
      icon: ShieldCheckIcon,
      tone: 'from-emerald-500 via-teal-500 to-green-600',
      ring: 'ring-emerald-300/40',
      glow: 'shadow-emerald-500/30',
      compute: (a) => a.avgConfidence,
      format: (v) => (v == null ? '—' : `${Math.round(v * 100)}%`),
      barPct: (a) => a.avgConfidence == null ? 0 : a.avgConfidence * 100,
      pulse: true,
    },
  ],
  // Quick-filter chips (rating) — populated from the data, capped at this many.
  maxRatingChips: 10,
  // Confidence colour bands (left-edge accent bar + label).
  confidenceBands: [
    { min: 0.85, className: 'bg-emerald-500', stroke: 'stroke-emerald-500', label: 'High',    text: 'text-emerald-700', bg: 'bg-emerald-50' },
    { min: 0.65, className: 'bg-lime-500',    stroke: 'stroke-lime-500',    label: 'Good',    text: 'text-lime-700',    bg: 'bg-lime-50'    },
    { min: 0.45, className: 'bg-amber-500',   stroke: 'stroke-amber-500',   label: 'Review',  text: 'text-amber-700',   bg: 'bg-amber-50'   },
    { min: 0.0,  className: 'bg-rose-500',    stroke: 'stroke-rose-500',    label: 'Low',     text: 'text-rose-700',    bg: 'bg-rose-50'    },
  ],
  emptyFilterMessage: 'No Piping Classes match your filters.',
  // Shown when a job completes but 0 piping classes were detected.
  emptyJobTitle:   'No Piping Classes detected',
  emptyJobMessage: 'The AI did not find any recognisable Piping Material Specification headers in this document. '
                 + 'You can still browse the SmartPlant 3D workbook template using the Workbook Canvas tab above, '
                 + 'or try uploading a higher-quality scan / digital-text PDF with clearly labelled Piping Spec sections.',
};

// ─── Soft-coded component-type colour map (used by detail panel chips) ───────
// Add a new type → add a row. Falls back to slate for unknowns.
const COMPONENT_TYPE_TONES = {
  pipe:        'bg-sky-100 text-sky-800 border-sky-200',
  flange:      'bg-violet-100 text-violet-800 border-violet-200',
  fitting:     'bg-indigo-100 text-indigo-800 border-indigo-200',
  valve:       'bg-rose-100 text-rose-800 border-rose-200',
  gasket:      'bg-amber-100 text-amber-800 border-amber-200',
  bolt:        'bg-stone-100 text-stone-800 border-stone-200',
  branch:      'bg-emerald-100 text-emerald-800 border-emerald-200',
  instrument:  'bg-pink-100 text-pink-800 border-pink-200',
  default:     'bg-slate-100 text-slate-700 border-slate-200',
};
const componentTone = (t) =>
  COMPONENT_TYPE_TONES[(t || '').toLowerCase()] || COMPONENT_TYPE_TONES.default;

// ─── Soft-coded detail-panel section configuration ───────────────────────────
// Each section is rendered only if `visible(cls)` returns true.
const DETAIL_CONFIG = {
  sections: [
    {
      key: 'services',
      title: 'Services',
      icon: SparklesIcon,
      accent: 'from-pink-500 to-rose-500',
      visible: (c) => (c.service_list || []).length > 0,
    },
    {
      key: 'pt',
      title: 'Pressure / Temperature Rating',
      icon: ShieldCheckIcon,
      accent: 'from-emerald-500 to-teal-500',
      visible: (c) => (c.pt_rating_table || []).length > 0,
    },
    {
      key: 'components',
      title: 'Components',
      icon: TableCellsIcon,
      accent: 'from-violet-500 to-indigo-600',
      visible: (c) => (c.components || []).length > 0,
    },
    {
      key: 'notes',
      title: 'AI Notes',
      icon: SparklesIcon,
      accent: 'from-amber-500 to-orange-500',
      visible: (c) => Boolean(c.raw_notes),
    },
  ],
  // Soft-coded component-table column definitions.
  componentColumns: [
    { key: 'component_type',     header: 'Type',     align: 'left',  render: (c) => (
        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded border ${componentTone(c.component_type)}`}>
          {c.component_type || '—'}
        </span>
      ) },
    { key: 'sub_type',           header: 'Sub-type',  align: 'left' },
    { key: 'size_from',          header: 'From',      align: 'center' },
    { key: 'size_to',            header: 'To',        align: 'center' },
    { key: 'schedule_or_rating', header: 'Sched / Rating', align: 'left' },
    { key: 'material_standard',  header: 'Material',  align: 'left' },
    { key: 'end_connection',     header: 'Ends',      align: 'left' },
    { key: 'description',        header: 'Description', align: 'left' },
  ],
};

// ─── Soft-coded panel configuration ──────────────────────────────────────────
const PANEL_CONFIG = {
  title:               'Paper Spec Extraction',
  subtitle:            'Upload a scanned or digital Piping Material Specification (PDF). RAD AI extracts every Piping Class, P/T rating, and component table — using a smart Gemini → OpenAI engine waterfall with cost-aware page skipping.',
  acceptStr:           '.pdf',
  maxFileSizeMB:       SPEC_API_CONFIG.maxFileSizeMB,
  pollIntervalMs:      SPEC_API_CONFIG.pollIntervalMs,
  helperPoints:        [
    'Chunked extraction (20 pages / chunk) so even 2,000+ page specs stay responsive.',
    'Native text-layer used first; AI vision only called when the page has no text — keeps cost down.',
    'Identical PDFs are auto-deduped by SHA-256; you instantly see the previous extraction.',
    'Export to Excel (one sheet per Piping Class) or JSON for downstream tools.',
  ],
};

// ─── AI Document Assist (Wrench) — soft-coded panel config ─────────────────
// Mirrors the panel already used on PID Verification / Non-TEFF Metadata /
// PMS / Instrument Index / CLL / PFD Quality Checker / Line List / Equipment
// List. Flip `enabled: false` to hide without touching JSX.
// Spec Customization currently ingests Paper Spec PDFs only — accepted
// extensions mirror that. When the upstream extractor learns to consume
// other formats, extend `acceptedExts` here in one place.
const SPEC_AI_ASSIST_CONFIG = {
  enabled:         true,
  title:           'AI Document Assist',
  subtitleTag:     '(Wrench · optional)',
  subtitle:        'Let RAD AI pick & recommend the right Piping Material Specification document for this project from Wrench DMS — drop it straight into the extractor below.',
  defaultHint:     'piping material specification',
  hintPlaceholder: 'e.g. PMS, piping spec, valve list',
  topN:            6,
  // Mirror the extractor's accepted formats so the panel's file-type
  // filter matches the page's <input accept=...>. PDF-only today.
  acceptedExts:    ['pdf'],
};

// ─── Soft-coded upload UX (animated console + rotating AI tips) ──────────────
// Tweak any of the below to change the live-upload experience without touching
// rendering logic. `tips` rotates one-per-tipRotateMs while uploading; `phases`
// label progress thresholds; `routes` describes the dispatch path that ended
// up being used (presigned-S3 vs legacy multipart) — purely cosmetic.
const UPLOAD_UX_CONFIG = {
  tipRotateMs: 4200,
  // Animated tooltips shown one at a time during upload. Add/edit freely.
  tips: [
    { icon: SparklesIcon,         tone: 'from-pink-500 to-rose-500',
      title: 'Tip · clean scans win',
      text:  'Higher-quality scans (300 dpi+) help the AI catch every component row — even small footnotes.' },
    { icon: BeakerIcon,           tone: 'from-fuchsia-500 to-purple-500',
      title: 'Did you know?',
      text:  'RAD AI runs Gemini first, then OpenAI as a fallback — you get speed AND accuracy without overpaying.' },
    { icon: TableCellsIcon,       tone: 'from-sky-500 to-cyan-500',
      title: 'Soon as it lands…',
      text:  'We split your spec into 20-page chunks and process them in parallel — even 2,000-page specs stay fluid.' },
    { icon: ShieldCheckIcon,      tone: 'from-emerald-500 to-teal-500',
      title: 'Safe by design',
      text:  'Your file is encrypted in-transit. Identical re-uploads are deduped by SHA-256 — no double-charging.' },
    { icon: CircleStackIcon,      tone: 'from-violet-500 to-indigo-500',
      title: 'Auto-export ready',
      text:  'Once extracted you can ship straight to SmartPlant 3D (SPEC + CAT workbooks) or plain Excel/JSON.' },
    { icon: MagnifyingGlassIcon,  tone: 'from-amber-500 to-orange-500',
      title: 'Smart page skipping',
      text:  'Index, TOC and blank pages are auto-skipped so the AI budget is spent only where it matters.' },
  ],
  // Phase label by progress percent (inclusive lower bound).
  phases: [
    { pct: 0,   label: 'Preparing secure transfer…',   icon: ShieldCheckIcon },
    { pct: 8,   label: 'Streaming bytes to the cloud…', icon: CloudArrowUpIcon },
    { pct: 60,  label: 'Almost there — finalising…',    icon: ArrowPathIcon },
    { pct: 96,  label: 'Handing off to RAD AI…',        icon: SparklesIcon },
  ],
  // Cosmetic badge describing which dispatch path was used.
  routes: {
    presigned: {
      label:   'Direct-to-S3 · Turbo',
      sublabel:'Bypassing the API edge for max throughput',
      badge:   'bg-emerald-100 text-emerald-700 border-emerald-300',
      glow:    'shadow-emerald-300/50',
    },
    legacy: {
      label:   'API Multipart',
      sublabel:'Standard upload — best for smaller files',
      badge:   'bg-sky-100 text-sky-700 border-sky-300',
      glow:    'shadow-sky-300/50',
    },
  },
  // Speed smoothing factor (EMA). 1 = use latest value only; 0.2 = smooth.
  speedSmoothing: 0.25,
};

// ─── Soft-coded AI-processing experience (post-upload) ──────────────────────
// Drives the ProcessingConsole shown while the Celery job is running. Tips
// rotate one-per-tipRotateMs; `phases` map progress thresholds to copy &
// icons. Pure data — add/edit a tip without touching rendering logic.
const PROCESSING_UX_CONFIG = {
  tipRotateMs: 4500,
  tips: [
    { icon: MagnifyingGlassIcon, tone: 'from-indigo-500 to-purple-500',
      title:    'Smart page scan',
      text:     'Indexing every page, skipping blanks and TOCs so the AI budget targets real spec content.' },
    { icon: SparklesIcon,        tone: 'from-pink-500 to-rose-500',
      title:    'Gemini × OpenAI waterfall',
      text:     'Gemini handles the bulk; OpenAI is reserved for hard pages — fast AND accurate.' },
    { icon: BeakerIcon,          tone: 'from-emerald-500 to-teal-500',
      title:    'Material recognition',
      text:     'A106-B, F316L, Duplex — your spec\'s metallurgy is being parsed grade-by-grade.' },
    { icon: TableCellsIcon,      tone: 'from-amber-500 to-orange-500',
      title:    'Component tables',
      text:     'Pipe, flanges, fittings, valves, gaskets — every row is being matched to its size band.' },
    { icon: ShieldCheckIcon,     tone: 'from-sky-500 to-cyan-500',
      title:    'Confidence scoring',
      text:     'Each extracted class gets a per-field confidence score so you know what to double-check.' },
    { icon: CircleStackIcon,     tone: 'from-fuchsia-500 to-purple-500',
      title:    'SmartPlant ready',
      text:     'On completion you\'ll get the 25-sheet SPEC and 23-sheet CAT workbooks — drop-in for SP3D.' },
    { icon: RectangleStackIcon,  tone: 'from-violet-500 to-indigo-500',
      title:    'Cross-class dedup',
      text:     'Identical component rows are de-duplicated across classes so your catalog stays clean.' },
    { icon: DocumentTextIcon,    tone: 'from-rose-500 to-pink-500',
      title:    'Footnote-aware',
      text:     'Asterisks, notes and overrides aren\'t lost — the AI reads them and applies them per row.' },
  ],
  // Phase label keyed by progress percent (inclusive lower bound).
  phases: [
    { pct: 0,   label: 'Queued — waiting for an AI worker',     icon: ArrowPathIcon },
    { pct: 1,   label: 'Splitting document into chunks',         icon: RectangleStackIcon },
    { pct: 15,  label: 'Extracting Piping Classes',              icon: SparklesIcon },
    { pct: 45,  label: 'Parsing component tables',               icon: TableCellsIcon },
    { pct: 75,  label: 'Scoring confidence & finalising',        icon: ShieldCheckIcon },
    { pct: 95,  label: 'Almost done — packaging results',        icon: CheckCircleIcon },
  ],
  // Soft-coded "live insights" — these pop in as numbers grow.
  insightThresholds: {
    classesUnlocked:    1,    // show "First class extracted!" at ≥1
    classesMomentum:    5,    // show "5+ classes — gathering steam"
    classesPower:       15,   // show "15+ — major spec detected"
  },
};

// Map status → tailwind/heroicon
const STATUS_META = {
  queued:     { color: 'bg-slate-100 text-slate-700 border-slate-300',     label: 'Queued' },
  processing: { color: 'bg-blue-50 text-blue-700 border-blue-300',         label: 'Processing' },
  completed:  { color: 'bg-emerald-50 text-emerald-700 border-emerald-300', label: 'Completed' },
  failed:     { color: 'bg-rose-50 text-rose-700 border-rose-300',         label: 'Failed' },
  cancelled:  { color: 'bg-amber-50 text-amber-800 border-amber-300',      label: 'Cancelled' },
};

const fmtBytes = (n) => {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = n; let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// ─── Animated upload console ────────────────────────────────────────────────
// Pure presentational component driven by props. All styling tokens / copy
// come from `UPLOAD_UX_CONFIG`, so changing the experience is config-only.
const UploadConsole = ({ file, progress, speedBps, etaSec, route, tipIndex }) => {
  // Find the latest phase whose threshold ≤ current progress.
  const phase = UPLOAD_UX_CONFIG.phases
    .slice()
    .reverse()
    .find((p) => progress >= p.pct) || UPLOAD_UX_CONFIG.phases[0];
  const PhaseIcon = phase.icon;

  const tip = UPLOAD_UX_CONFIG.tips[tipIndex % UPLOAD_UX_CONFIG.tips.length];
  const TipIcon = tip.icon;

  const routeMeta = route ? UPLOAD_UX_CONFIG.routes[route] : null;

  const speedHuman = (() => {
    if (!speedBps || speedBps <= 0) return '—';
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let v = speedBps, i = 0;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
    return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
  })();

  const etaHuman = (() => {
    if (etaSec == null || !isFinite(etaSec) || etaSec < 0) return '—';
    if (etaSec < 60)  return `${etaSec}s`;
    const m = Math.floor(etaSec / 60);
    const s = etaSec % 60;
    return m < 60 ? `${m}m ${s}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
  })();

  return (
    <div className="w-full max-w-2xl mx-auto mt-2 space-y-3">
      {/* Header row — phase + route badge */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-200 font-semibold">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-pink-500" />
          </span>
          <PhaseIcon className="w-4 h-4 text-pink-600 animate-pulse" />
          <span>{phase.label}</span>
        </div>
        {routeMeta && (
          <div
            className={`inline-flex items-center gap-2 text-[11px] font-semibold border rounded-full px-2.5 py-1 shadow-sm ${routeMeta.badge} ${routeMeta.glow}`}
            title={routeMeta.sublabel}
          >
            <SparklesIcon className="w-3.5 h-3.5" />
            {routeMeta.label}
          </div>
        )}
      </div>

      {/* Shimmering progress bar */}
      <div className="relative w-full h-3.5 rounded-full bg-pink-100 dark:bg-pink-900/30 overflow-hidden ring-1 ring-pink-200/60 dark:ring-pink-700/40">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-pink-500 via-fuchsia-500 to-rose-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
        {/* Moving sheen */}
        <div
          className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_1.6s_linear_infinite] pointer-events-none"
          style={{
            width: `${Math.max(15, progress)}%`,
            mixBlendMode: 'overlay',
          }}
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="rounded-lg bg-white/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Progress</div>
          <div className="font-bold text-slate-800 dark:text-slate-100 tabular-nums">{progress}%</div>
        </div>
        <div className="rounded-lg bg-white/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Speed</div>
          <div className="font-bold text-slate-800 dark:text-slate-100 tabular-nums">{speedHuman}</div>
        </div>
        <div className="rounded-lg bg-white/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Time left</div>
          <div className="font-bold text-slate-800 dark:text-slate-100 tabular-nums">{etaHuman}</div>
        </div>
        <div className="rounded-lg bg-white/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-3 py-2 truncate">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">File</div>
          <div className="font-bold text-slate-800 dark:text-slate-100 truncate" title={file?.name}>
            {file?.name || '—'}
          </div>
        </div>
      </div>

      {/* Rotating AI tip card — cross-fades softly */}
      <div
        key={tipIndex}
        className={`relative overflow-hidden rounded-xl p-3 text-white shadow-lg bg-gradient-to-br ${tip.tone} animate-[fadeInUp_500ms_ease-out]`}
      >
        <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -left-4 -bottom-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
        <div className="relative flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-white/20 ring-1 ring-white/20">
            <TipIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider font-bold text-white/80">
              {tip.title}
            </div>
            <div className="text-sm font-medium leading-snug mt-0.5">
              {tip.text}
            </div>
          </div>
        </div>
      </div>

      {/* Inline keyframes — local to component to avoid touching global CSS */}
      <style>{`
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

// ─── Animated AI-processing console ─────────────────────────────────────────
// Renders while the Celery job is running. All copy / colors / thresholds
// come from `PROCESSING_UX_CONFIG`. Pure presentational; no API calls.
const ProcessingConsole = ({ job, partialCount, tipIndex }) => {
  const pct = job?.progress_percent ?? 0;

  // Latest phase whose threshold ≤ current progress.
  const phase = PROCESSING_UX_CONFIG.phases
    .slice()
    .reverse()
    .find((p) => pct >= p.pct) || PROCESSING_UX_CONFIG.phases[0];
  const PhaseIcon = phase.icon;

  const tip = PROCESSING_UX_CONFIG.tips[tipIndex % PROCESSING_UX_CONFIG.tips.length];
  const TipIcon = tip.icon;

  // Live-insight chips (pop in based on partial-result counters).
  const insights = [];
  const T = PROCESSING_UX_CONFIG.insightThresholds;
  if (partialCount >= T.classesPower) {
    insights.push({ icon: SparklesIcon, tone: 'bg-violet-100 text-violet-700 border-violet-200',
      text: `${partialCount} classes detected — major spec` });
  } else if (partialCount >= T.classesMomentum) {
    insights.push({ icon: ArrowPathIcon, tone: 'bg-sky-100 text-sky-700 border-sky-200',
      text: `${partialCount} classes — gathering steam` });
  } else if (partialCount >= T.classesUnlocked) {
    insights.push({ icon: CheckCircleIcon, tone: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      text: `First class extracted` });
  }
  if (job?.pages_processed > 0) {
    insights.push({ icon: DocumentTextIcon, tone: 'bg-pink-100 text-pink-700 border-pink-200',
      text: `${job.pages_processed} pages analysed` });
  }
  if (job?.chunks_done > 0 && job?.chunks_total > 0) {
    insights.push({ icon: RectangleStackIcon, tone: 'bg-amber-100 text-amber-700 border-amber-200',
      text: `Chunk ${job.chunks_done}/${job.chunks_total}` });
  }

  return (
    <div className="mt-5 rounded-xl border border-fuchsia-100 dark:border-fuchsia-900/40 bg-gradient-to-br from-pink-50/60 via-white to-fuchsia-50/40 dark:from-fuchsia-900/10 dark:via-slate-900/40 dark:to-pink-900/10 p-4 space-y-3 animate-[fadeInUp_400ms_ease-out]">
      {/* Phase header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fuchsia-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-fuchsia-500" />
          </span>
          <PhaseIcon className="w-4 h-4 text-fuchsia-600 animate-spin-slow" style={{ animation: 'spin 6s linear infinite' }} />
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
            {phase.label}
          </span>
        </div>
        <div className="inline-flex items-center gap-2 text-[11px] font-semibold text-fuchsia-700 dark:text-fuchsia-300 bg-fuchsia-100/70 dark:bg-fuchsia-900/30 px-2.5 py-1 rounded-full">
          <SparklesIcon className="w-3.5 h-3.5 animate-pulse" />
          RAD AI · live
        </div>
      </div>

      {/* Live-insight chips */}
      {insights.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {insights.map((ins, i) => {
            const I = ins.icon;
            return (
              <span
                key={i}
                className={`inline-flex items-center gap-1 text-[11px] font-semibold border rounded-full px-2 py-0.5 ${ins.tone} animate-[fadeInUp_400ms_ease-out]`}
              >
                <I className="w-3 h-3" />
                {ins.text}
              </span>
            );
          })}
        </div>
      )}

      {/* Rotating AI insight card */}
      <div
        key={tipIndex}
        className={`relative overflow-hidden rounded-lg p-3 text-white shadow-md bg-gradient-to-br ${tip.tone} animate-[fadeInUp_500ms_ease-out]`}
      >
        <div className="absolute -right-8 -top-8 w-28 h-28 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -left-6 -bottom-6 w-20 h-20 bg-white/10 rounded-full blur-xl" />
        <div className="relative flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-white/20 ring-1 ring-white/20">
            <TipIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider font-bold text-white/80">
              {tip.title}
            </div>
            <div className="text-sm font-medium leading-snug mt-0.5">
              {tip.text}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

const PaperSpecExtractor = ({ projectId = null, jobId = null } = {}) => {
  const [file, setFile]                     = useState(null);
  const [uploading, setUploading]           = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError]       = useState('');
  // Live upload telemetry — soft-coded UX (speed/ETA/route/tip rotation).
  const [uploadSpeedBps, setUploadSpeedBps] = useState(0);
  const [uploadEtaSec, setUploadEtaSec]     = useState(null);
  const [uploadRoute, setUploadRoute]       = useState(null);    // 'presigned' | 'legacy' | null
  const [tipIndex, setTipIndex]             = useState(0);
  const [procTipIndex, setProcTipIndex]     = useState(0);
  const uploadStartRef                      = useRef(0);
  const lastTickRef                         = useRef({ t: 0, loaded: 0 });

  // BYOK (Bring Your Own Key) — optional user-supplied fields for attribution and custom AI usage.
  const [documentName, setDocumentName]     = useState('');
  const [engineerName, setEngineerName]     = useState('');
  const [userApiKey, setUserApiKey]         = useState(() => {
    try {
      return sessionStorage.getItem('radai_spec_user_openai_key') || '';
    } catch (_) { return ''; }
  });
  const [showApiKey, setShowApiKey]         = useState(false);

  const [job, setJob]                       = useState(null);
  const [document, setDocument]             = useState(null);
  const [classes, setClasses]               = useState([]);
  const [expandedClassId, setExpandedClassId] = useState(null);
  const [classDetailCache, setClassDetailCache] = useState({});
  const [config, setConfig]                 = useState(null);
  const [isDragging, setIsDragging]         = useState(false);
  const [classSearch, setClassSearch]       = useState('');
  const [ratingFilter, setRatingFilter]     = useState(null);
  // Top-level view tab inside the results section.
  // 'classes'  → original piping-class cards
  // 'canvas'   → editable SPEC/CAT workbook canvas (cross-check + edit)
  const [activeView, setActiveView]         = useState('classes');
  const pollRef = useRef(null);

  // Fetch backend config once for displaying caps to the user.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await specCustomizationAPI.getConfig();
        if (!cancelled) setConfig(c);
      } catch (e) { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Resume/view existing job if jobId prop provided (history table click).
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    (async () => {
      try {
        const jobData = await specCustomizationAPI.getJob(jobId);
        if (cancelled) return;
        setJob(jobData);
        setDocument(jobData.document || null);
        // If completed, load classes immediately
        if (['completed', 'failed', 'cancelled'].includes(jobData.status)) {
          const classList = await specCustomizationAPI.getJobClasses(jobId);
          if (!cancelled) setClasses(classList);
        }
      } catch (err) {
        console.error('[SpecExtractor] Failed to load job:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [jobId]);

  const isTerminal = useMemo(() => {
    if (!job) return false;
    return ['completed', 'failed', 'cancelled'].includes(job.status);
  }, [job]);

  // ── Polling ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!job || isTerminal) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return undefined;
    }
    pollRef.current = setInterval(async () => {
      try {
        const updated = await specCustomizationAPI.getJob(job.id);
        setJob(updated);
        if (['completed', 'failed', 'cancelled'].includes(updated.status)) {
          const list = await specCustomizationAPI.getJobClasses(updated.id);
          setClasses(list);
        }
      } catch (e) {
        // swallow transient polling errors
      }
    }, PANEL_CONFIG.pollIntervalMs);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [job, isTerminal]);

  // On completion, fetch final class list (extra safety net).
  useEffect(() => {
    if (job && job.status === 'completed' && classes.length === 0) {
      specCustomizationAPI.getJobClasses(job.id).then(setClasses).catch(() => {});
    }
  }, [job, classes.length]);

  // Rotate the AI tip cards while the upload is in flight. Cycles soft-coded
  // `UPLOAD_UX_CONFIG.tips` every `tipRotateMs` until the upload completes.
  useEffect(() => {
    if (!uploading) return undefined;
    const id = setInterval(() => {
      setTipIndex((i) => (i + 1) % UPLOAD_UX_CONFIG.tips.length);
    }, UPLOAD_UX_CONFIG.tipRotateMs);
    return () => clearInterval(id);
  }, [uploading]);

  // Rotate AI-processing tips while a job is running (post-upload).
  useEffect(() => {
    const running = job && !['completed', 'failed', 'cancelled'].includes(job.status);
    if (!running) return undefined;
    const id = setInterval(() => {
      setProcTipIndex((i) => (i + 1) % PROCESSING_UX_CONFIG.tips.length);
    }, PROCESSING_UX_CONFIG.tipRotateMs);
    return () => clearInterval(id);
  }, [job]);

  // Build the effective accept list — prefer server config if present.
  const acceptedExts = useMemo(() => {
    return config?.accepted_extensions || SPEC_API_CONFIG.acceptedExts;
  }, [config]);
  const acceptAttr = useMemo(
    () => config?.accept_attribute || acceptedExts.map((e) => `.${e}`).join(','),
    [acceptedExts, config]
  );

  const fileFormat = useMemo(() => (file ? detectFormat(file.name) : null), [file]);

  const validateFile = useCallback((f) => {
    if (!f) return 'No file selected.';
    const { ext } = detectFormat(f.name);
    if (!ext) return 'File has no extension; cannot detect format.';
    if (!acceptedExts.includes(ext)) {
      return `\u201C.${ext}\u201D is not supported. Accepted: ${acceptedExts.join(', ')}.`;
    }
    const maxBytes = PANEL_CONFIG.maxFileSizeMB * 1024 * 1024;
    if (f.size > maxBytes) {
      return `File exceeds ${PANEL_CONFIG.maxFileSizeMB} MB limit.`;
    }
    return '';
  }, [acceptedExts]);

  // ── Handlers ───────────────────────────────────────
  const handleFilePick = (e) => {
    const f = e.target.files?.[0];
    setUploadError('');
    if (!f) return;
    const err = validateFile(f);
    if (err) { setUploadError(err); return; }
    setFile(f);
  };

  const handleDragOver = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragging(false);
    const f = e.dataTransfer?.files?.[0];
    if (!f) return;
    setUploadError('');
    const err = validateFile(f);
    if (err) { setUploadError(err); return; }
    setFile(f);
  };

  const handleUpload = useCallback(async () => {
    if (!file) return;
    setUploading(true);
    // Soft-coded global busy flag — pollers (NotificationBell, etc.) skip
    // their ticks while this is true so the backend worker stays free.
    if (typeof window !== 'undefined') window.__RADAI_HEAVY_OP = true;
    setUploadError('');
    setUploadProgress(0);
    setUploadSpeedBps(0);
    setUploadEtaSec(null);
    setUploadRoute(null);
    setTipIndex(0);
    uploadStartRef.current = Date.now();
    lastTickRef.current    = { t: uploadStartRef.current, loaded: 0 };
    setClasses([]);
    setExpandedClassId(null);
    try {
      // Mirror the dispatcher's decision so the UI can show the actual route
      // — purely cosmetic; the service layer remains the source of truth.
      const willPresign =
        SPEC_API_CONFIG.presignedUpload?.enabled &&
        file.size >= (SPEC_API_CONFIG.presignedUpload?.minSizeBytes || 0);
      setUploadRoute(willPresign ? 'presigned' : 'legacy');

      const resp = await specCustomizationAPI.upload({
        file,
        projectId,
        title: documentName.trim(),                    // BYOK: document name
        engineerName: engineerName.trim(),             // BYOK: engineer attribution
        userOpenaiApiKey: userApiKey.trim(),           // BYOK: user's OpenAI API key
        onUploadProgress: (evt) => {
          if (!evt.total) return;
          const pct = Math.round((evt.loaded / evt.total) * 100);
          setUploadProgress(pct);

          // Smoothed instantaneous speed (EMA) + ETA.
          const now = Date.now();
          const dt  = (now - lastTickRef.current.t) / 1000;
          if (dt > 0.15) {
            const inst    = (evt.loaded - lastTickRef.current.loaded) / dt;
            const smooth  = UPLOAD_UX_CONFIG.speedSmoothing;
            setUploadSpeedBps((prev) =>
              prev > 0 ? prev * (1 - smooth) + inst * smooth : inst);
            const remaining = Math.max(0, evt.total - evt.loaded);
            setUploadEtaSec(inst > 0 ? Math.round(remaining / inst) : null);
            lastTickRef.current = { t: now, loaded: evt.loaded };
          }
        },
      });
      setDocument(resp.document);
      setJob(resp.job);
      if (resp.deduped) {
        // Already completed — load classes immediately.
        const list = await specCustomizationAPI.getJobClasses(resp.job.id);
        setClasses(list);
      }
    } catch (e) {
      setUploadError(e?.response?.data?.error || e?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (typeof window !== 'undefined') window.__RADAI_HEAVY_OP = false;
    }
  }, [file]);

  const handleCancel = async () => {
    if (!job) return;
    try {
      await specCustomizationAPI.cancelJob(job.id);
      const refreshed = await specCustomizationAPI.getJob(job.id);
      setJob(refreshed);
    } catch (e) { /* ignore */ }
  };

  const handleReset = () => {
    setFile(null);
    setUploadProgress(0);
    setUploadError('');
    setJob(null);
    setDocument(null);
    setClasses([]);
    setExpandedClassId(null);
    setClassDetailCache({});
  };

  const handleExpandClass = async (cls) => {
    if (expandedClassId === cls.id) { setExpandedClassId(null); return; }
    setExpandedClassId(cls.id);
    if (!classDetailCache[cls.id]) {
      try {
        const detail = await specCustomizationAPI.getClass(cls.id);
        setClassDetailCache((m) => ({ ...m, [cls.id]: detail }));
      } catch (e) { /* ignore */ }
    }
  };

  const handleExportXlsx = async () => {
    if (!job) return;
    try {
      const blob = await specCustomizationAPI.exportJob(job.id, 'xlsx');
      downloadBlob(blob, `paper_spec_${job.id}.xlsx`);
    } catch (e) { /* ignore */ }
  };

  const handleExportJson = async () => {
    if (!job) return;
    try {
      const data = await specCustomizationAPI.exportJob(job.id, 'json');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `paper_spec_${job.id}.json`);
    } catch (e) { /* ignore */ }
  };

  const handleExportSmartplantSpec = async () => {
    if (!job) return;
    try {
      const blob = await specCustomizationAPI.exportSmartplantSpec(job.id);
      downloadBlob(blob, `spec_customisation_${job.id}_SPEC.xlsx`);
    } catch (e) { /* ignore */ }
  };

  const handleExportSmartplantCat = async () => {
    if (!job) return;
    try {
      const blob = await specCustomizationAPI.exportSmartplantCat(job.id);
      downloadBlob(blob, `spec_customisation_${job.id}_CAT.xlsx`);
    } catch (e) { /* ignore */ }
  };

  // ── Derived UI bits ──────────────────────────────────────────────────
  const statusMeta = job ? (STATUS_META[job.status] || STATUS_META.queued) : null;
  const progressPct = job?.progress_percent ?? 0;
  const livePhase   = job?.current_phase || job?.live_progress?.status || '';
  const partialCount = job?.live_progress?.classes_found ?? classes.length;

  // ── Class aggregates (soft-coded; powers the stats strip) ────────────
  const classAggregates = useMemo(() => {
    if (!classes.length) {
      return { totalClasses: 0, totalComponents: 0, uniqueMaterials: 0,
               uniqueRatings: 0, avgConfidence: null, ratingCounts: [] };
    }
    const materials = new Set();
    const ratings   = new Map();   // rating → count
    let totalComponents = 0;
    let confSum = 0;
    let confN   = 0;
    classes.forEach((c) => {
      if (c.material_grade) materials.add(c.material_grade);
      if (c.pressure_rating) {
        ratings.set(c.pressure_rating, (ratings.get(c.pressure_rating) || 0) + 1);
      }
      totalComponents += (c.components_count || 0);
      if (typeof c.confidence_score === 'number') {
        confSum += c.confidence_score;
        confN   += 1;
      }
    });
    return {
      totalClasses:    classes.length,
      totalComponents,
      uniqueMaterials: materials.size,
      uniqueRatings:   ratings.size,
      avgConfidence:   confN ? confSum / confN : null,
      ratingCounts:    [...ratings.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [classes]);

  // Filtered class list — search text + active rating chip.
  const filteredClasses = useMemo(() => {
    const q = classSearch.trim().toLowerCase();
    if (!q && !ratingFilter) return classes;
    return classes.filter((c) => {
      if (ratingFilter && c.pressure_rating !== ratingFilter) return false;
      if (!q) return true;
      const blob = [
        c.class_code, c.class_full_code, c.material_grade,
        c.pressure_rating, c.flange_facing,
      ].filter(Boolean).join(' ').toLowerCase();
      return blob.includes(q);
    });
  }, [classes, classSearch, ratingFilter]);

  // Look up the full colour band for a class's confidence score.
  const confidenceBandFor = useCallback((score) => {
    if (typeof score !== 'number') {
      return { className: 'bg-slate-300', stroke: 'stroke-slate-300', label: 'N/A', text: 'text-slate-500', bg: 'bg-slate-50' };
    }
    const band = CLASS_SUMMARY_CONFIG.confidenceBands.find((b) => score >= b.min);
    return band || { className: 'bg-slate-300', stroke: 'stroke-slate-300', label: 'N/A', text: 'text-slate-500', bg: 'bg-slate-50' };
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-pink-100 dark:border-pink-900/40 overflow-hidden">
      {/* Header strip */}
      <div className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-rose-500 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <SparklesIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">{PANEL_CONFIG.title}</h2>
            <p className="text-pink-50 text-sm">AI-powered Piping Spec extraction</p>
          </div>
        </div>
        {config && (
          <div className="hidden md:flex items-center gap-2 text-white/90 text-xs bg-white/10 px-3 py-1.5 rounded-lg">
            <Cog6ToothIcon className="w-4 h-4" />
            <span>chunk={config.chunk_size_pages}p · AI cap={config.max_ai_pages_per_job}p</span>
          </div>
        )}
      </div>

      <div className="p-6 space-y-6">
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {PANEL_CONFIG.subtitle}
        </p>
        <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600 dark:text-slate-400 list-disc pl-5">
          {PANEL_CONFIG.helperPoints.map((p) => <li key={p}>{p}</li>)}
        </ul>

        {/* ── AI Document Assist (Wrench) — soft-coded, optional ─────── */}
        {SPEC_AI_ASSIST_CONFIG.enabled && !job && (
          <WrenchAiDocAssist
            title={SPEC_AI_ASSIST_CONFIG.title}
            subtitleTag={SPEC_AI_ASSIST_CONFIG.subtitleTag}
            subtitle={SPEC_AI_ASSIST_CONFIG.subtitle}
            defaultHint={SPEC_AI_ASSIST_CONFIG.defaultHint}
            hintPlaceholder={SPEC_AI_ASSIST_CONFIG.hintPlaceholder}
            topN={SPEC_AI_ASSIST_CONFIG.topN}
            acceptedExts={SPEC_AI_ASSIST_CONFIG.acceptedExts}
            projectName=""
            onFileSelected={(f) => {
              // Reuse the same validator the manual drop-zone uses so
              // size / extension errors surface identically.
              const err = validateFile(f);
              if (err) { setUploadError(err); return; }
              setUploadError('');
              setFile(f);
            }}
            onError={(msg) => setUploadError(msg)}
          />
        )}

        {/* ── Upload zone ─────────────────────────────────────────────── */}
        {!job && (
          <div
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative group border-2 border-dashed rounded-xl p-8 transition-all duration-300 ${
              isDragging
                ? 'border-pink-500 bg-pink-100/70 dark:bg-pink-900/30 scale-[1.01] shadow-lg shadow-pink-300/40'
                : 'border-pink-300 dark:border-pink-700 bg-pink-50/40 dark:bg-pink-900/10 hover:border-pink-400 hover:bg-pink-50/70'
            }`}
          >
            <div className="flex flex-col items-center text-center gap-3">
              {(() => {
                const Icon = fileFormat?.group ? (GROUP_ICONS[fileFormat.group] || CloudArrowUpIcon) : CloudArrowUpIcon;
                return <Icon className="w-12 h-12 text-pink-500" />;
              })()}
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  {file ? file.name : 'Drop a Paper Spec here, or click to browse'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {file
                    ? fmtBytes(file.size)
                    : `Max ${PANEL_CONFIG.maxFileSizeMB} MB · ${acceptedExts.length} formats supported`}
                </p>
                {file && fileFormat?.meta && (
                  <div className="mt-2 inline-flex items-center gap-2 text-xs">
                    <span className={`px-2 py-0.5 rounded font-semibold ${fileFormat.meta.badge}`}>
                      {fileFormat.meta.label} · .{fileFormat.ext}
                    </span>
                    <span className="text-slate-500">{fileFormat.meta.hint}</span>
                  </div>
                )}
              </div>
              <input
                id="paper-spec-file"
                type="file"
                accept={acceptAttr}
                onChange={handleFilePick}
                className="hidden"
              />

              {/* BYOK (Bring Your Own Key) — optional attribution & custom API key fields */}
              {file && (
                <div className="mt-4 p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Document Name <span className="text-slate-400 font-normal">(optional — helps identify this spec in history)</span>
                    </label>
                    <input
                      type="text"
                      value={documentName}
                      onChange={(e) => setDocumentName(e.target.value)}
                      placeholder="e.g. Q4 2026 Piping Spec Rev A"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Spec Engineer <span className="text-slate-400 font-normal">(optional — for attribution)</span>
                    </label>
                    <input
                      type="text"
                      value={engineerName}
                      onChange={(e) => setEngineerName(e.target.value)}
                      placeholder="e.g. John Smith, Lead Piping Engineer"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                      <span>
                        Your OpenAI API Key <span className="text-slate-400 font-normal">(optional — BYOK)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowApiKey(v => !v)}
                        className="text-xs text-pink-700 dark:text-pink-300 hover:text-pink-900 dark:hover:text-pink-100"
                      >
                        {showApiKey ? 'Hide' : 'Show'}
                      </button>
                    </label>
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={userApiKey}
                      onChange={(e) => {
                        const val = e.target.value;
                        setUserApiKey(val);
                        try {
                          if (val) sessionStorage.setItem('radai_spec_user_openai_key', val);
                          else sessionStorage.removeItem('radai_spec_user_openai_key');
                        } catch (_) { /* ignore */ }
                      }}
                      placeholder="sk-... (leave empty to use platform key)"
                      autoComplete="off"
                      spellCheck={false}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-sm font-mono ${
                        userApiKey.trim() && !/^sk-[A-Za-z0-9_\-]{18,}$/.test(userApiKey.trim())
                          ? 'border-red-400 bg-red-50 dark:bg-red-900/20'
                          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white'
                      }`}
                    />
                    {userApiKey.trim() && !/^sk-[A-Za-z0-9_\-]{18,}$/.test(userApiKey.trim()) && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400 font-medium">
                        This does not look like an OpenAI API key. Valid keys start with <code>sk-</code> and are 20+ characters. Your key will be ignored and the platform key will be used instead.
                      </p>
                    )}
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Your key is used for OpenAI GPT-4o Vision calls during extraction. Held in your browser session and wiped from our servers immediately after extraction completes.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-2 flex-wrap justify-center">
                <label
                  htmlFor="paper-spec-file"
                  className="px-4 py-2 bg-white border border-pink-300 text-pink-700 rounded-lg text-sm font-medium hover:bg-pink-50 cursor-pointer"
                >
                  Choose File
                </label>
                {file && (
                  <button
                    onClick={() => { setFile(null); setUploadError(''); }}
                    className="px-3 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={handleUpload}
                  disabled={!file || uploading}
                  className="px-4 py-2 bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-lg text-sm font-semibold shadow hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 inline-flex items-center gap-1.5"
                >
                  <SparklesIcon className={`w-4 h-4 ${uploading ? 'animate-spin' : 'group-hover:animate-pulse'}`} />
                  {uploading ? 'Uploading…' : 'Extract with AI'}
                </button>
              </div>

              {/* Supported-format chips */}
              <div className="flex flex-wrap gap-1.5 justify-center pt-1">
                {Object.entries(SPEC_API_CONFIG.formatGroups).map(([key, g]) => (
                  <span
                    key={key}
                    className={`px-2 py-0.5 text-[10px] font-semibold rounded ${g.badge}`}
                    title={g.hint}
                  >
                    {g.label}
                  </span>
                ))}
              </div>

              {uploading && (
                <UploadConsole
                  file={file}
                  progress={uploadProgress}
                  speedBps={uploadSpeedBps}
                  etaSec={uploadEtaSec}
                  route={uploadRoute}
                  tipIndex={tipIndex}
                />
              )}
              {uploadError && (
                <p className="text-rose-600 text-sm flex items-center gap-1">
                  <ExclamationTriangleIcon className="w-4 h-4" /> {uploadError}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Job status ──────────────────────────────────────────────── */}
        {job && (
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-5 bg-slate-50/60 dark:bg-slate-900/30">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${statusMeta.color}`}>
                  {statusMeta.label}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {document?.original_filename || 'Document'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {document?.total_pages || 0} pages · {fmtBytes(document?.file_size_bytes)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {isTerminal && job.status === 'completed' && (
                  <>
                    <button
                      onClick={handleExportSmartplantSpec}
                      title="SmartPlant 3D — Piping Spec Rules workbook (25 sheets)"
                      className="px-3 py-1.5 text-xs font-semibold bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200 rounded-lg hover:bg-fuchsia-100 inline-flex items-center gap-1"
                    >
                      <DocumentArrowDownIcon className="w-4 h-4" /> SPEC.xlsx
                    </button>
                    <button
                      onClick={handleExportSmartplantCat}
                      title="SmartPlant 3D — Component Catalog workbook (23 sheets)"
                      className="px-3 py-1.5 text-xs font-semibold bg-pink-50 text-pink-700 border border-pink-200 rounded-lg hover:bg-pink-100 inline-flex items-center gap-1"
                    >
                      <DocumentArrowDownIcon className="w-4 h-4" /> CAT.xlsx
                    </button>
                    <button
                      onClick={handleExportXlsx}
                      className="px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 inline-flex items-center gap-1"
                    >
                      <DocumentArrowDownIcon className="w-4 h-4" /> XLSX
                    </button>
                    <button
                      onClick={handleExportJson}
                      className="px-3 py-1.5 text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 rounded-lg hover:bg-sky-100 inline-flex items-center gap-1"
                    >
                      <DocumentArrowDownIcon className="w-4 h-4" /> JSON
                    </button>
                  </>
                )}
                {!isTerminal && (
                  <button
                    onClick={handleCancel}
                    className="px-3 py-1.5 text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-100 inline-flex items-center gap-1"
                  >
                    <XMarkIcon className="w-4 h-4" /> Cancel
                  </button>
                )}
                {isTerminal && (
                  <button
                    onClick={handleReset}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100 inline-flex items-center gap-1"
                  >
                    <ArrowPathIcon className="w-4 h-4" /> New
                  </button>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                <span>{livePhase || (isTerminal ? statusMeta.label : 'Starting…')}</span>
                <span>{progressPct}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    job.status === 'failed'    ? 'bg-rose-500' :
                    job.status === 'cancelled' ? 'bg-amber-500' :
                    job.status === 'completed' ? 'bg-emerald-500' :
                    'bg-gradient-to-r from-pink-500 to-rose-500 animate-pulse'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-500">
                <div>Chunks: {job.chunks_done}/{job.chunks_total}</div>
                <div>Pages: {job.pages_processed}</div>
                <div>Classes: {partialCount}</div>
              </div>
            </div>

            {/* Animated AI-processing insights (hidden when job is finished). */}
            {job && !isTerminal && (
              <ProcessingConsole
                job={job}
                partialCount={partialCount}
                tipIndex={procTipIndex}
              />
            )}

            {job.error_message && (
              <div className="mt-3 p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700">
                {job.error_message}
              </div>
            )}
          </div>
        )}

        {/* ── Extracted classes / Workbook Canvas ────────────────────── */}
        {job?.status === 'completed' && (
          <div className="space-y-4">
            {/* ── View tabs (Piping Classes ⇄ Workbook Canvas) ────── */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: 'classes', label: 'Piping Classes',  hint: 'Extracted spec cards' },
                { key: 'canvas',  label: 'Workbook Canvas', hint: 'Cross-check & edit SPEC / CAT data' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveView(tab.key)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-full border transition ${
                    activeView === tab.key
                      ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white border-transparent shadow'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-pink-300 hover:text-pink-600'
                  }`}
                  title={tab.hint}
                >
                  {tab.label}
                </button>
              ))}
              {activeView === 'canvas' && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                  Edit any cell — changes autosave and are baked into the downloaded xlsx.
                </span>
              )}
            </div>

            {activeView === 'canvas' ? (
              <WorkbookCanvas job={job} />
            ) : classes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/60 dark:bg-amber-900/10 dark:border-amber-700 px-6 py-10 text-center space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 mb-1">
                <ExclamationTriangleIcon className="w-6 h-6 text-amber-500" />
              </div>
              <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
                {CLASS_SUMMARY_CONFIG.emptyJobTitle}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300 max-w-xl mx-auto leading-relaxed">
                {CLASS_SUMMARY_CONFIG.emptyJobMessage}
              </p>
            </div>
            ) : (
            <>
            {/* ── 1. AI Insight Banner ──────────────────────────────── */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 shadow-xl">
              {/* Animated glow blobs */}
              <div className="absolute -top-16 -left-16 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl animate-pulse" />
              <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-violet-500/20 rounded-full blur-3xl animate-pulse"
                   style={{ animationDelay: '1.5s' }} />
              {/* Grid pattern overlay */}
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
              />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-pink-300">
                    {CLASS_SUMMARY_CONFIG.aiBanner.eyebrow}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                  <SparklesIcon className="w-5 h-5 text-pink-300" />
                  {CLASS_SUMMARY_CONFIG.aiBanner.title}
                </h3>
                <p className="text-sm text-slate-200 leading-relaxed max-w-3xl">
                  {CLASS_SUMMARY_CONFIG.aiBanner.insight(classAggregates).map((tok, i) => (
                    <span key={i} className={tok.tone ? CLASS_SUMMARY_CONFIG.highlightTones[tok.tone] : ''}>
                      {tok.text}
                    </span>
                  ))}
                </p>
              </div>
            </div>

            {/* ── 2. KPI Card Strip (soft-coded) ────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {CLASS_SUMMARY_CONFIG.stats.map((stat) => {
                const Icon  = stat.icon;
                const raw   = stat.compute(classAggregates);
                const value = stat.format(raw);
                const pct   = stat.barPct ? stat.barPct(classAggregates) : 0;
                return (
                  <div
                    key={stat.key}
                    className={`group relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br ${stat.tone} text-white shadow-lg ${stat.glow} ring-1 ${stat.ring} transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl`}
                  >
                    {/* Decorative giant icon */}
                    <Icon className="absolute -right-3 -bottom-3 w-20 h-20 opacity-10 group-hover:opacity-20 transition" />
                    {/* Diagonal sheen */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative">
                      <div className="flex items-start justify-between">
                        <div className="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg ring-1 ring-white/30">
                          <Icon className="w-4 h-4" />
                        </div>
                        {stat.pulse && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-white/25 backdrop-blur-sm rounded-full animate-pulse">
                            AI
                          </span>
                        )}
                      </div>
                      <p className="mt-3 text-3xl font-extrabold leading-none tracking-tight tabular-nums">
                        {value}
                      </p>
                      <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wider opacity-95">
                        {stat.label}
                      </p>
                      <p className="text-[10px] opacity-75">{stat.sublabel}</p>
                      {/* Activity bar */}
                      <div className="mt-3 h-1 bg-black/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white/70 rounded-full transition-all duration-700"
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── 3. Filter / search bar ────────────────────────────── */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={classSearch}
                    onChange={(e) => setClassSearch(e.target.value)}
                    placeholder="Search by class code, material grade, rating, flange facing…"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-pink-400"
                  />
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  Showing <strong className="text-slate-700 dark:text-slate-200">{filteredClasses.length}</strong>
                  {' '}of {classes.length}
                </span>
              </div>

              {classAggregates.ratingCounts.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-1">
                    Rating:
                  </span>
                  <button
                    onClick={() => setRatingFilter(null)}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border transition ${
                      !ratingFilter
                        ? 'bg-pink-600 text-white border-pink-600'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-pink-50'
                    }`}
                  >
                    All
                  </button>
                  {classAggregates.ratingCounts
                    .slice(0, CLASS_SUMMARY_CONFIG.maxRatingChips)
                    .map(([rating, count]) => (
                      <button
                        key={rating}
                        onClick={() => setRatingFilter(ratingFilter === rating ? null : rating)}
                        className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border transition ${
                          ratingFilter === rating
                            ? 'bg-pink-600 text-white border-pink-600'
                            : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-pink-50'
                        }`}
                      >
                        {rating} <span className="opacity-70">· {count}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* ── 4. Class cards ─────────────────────────────────────── */}
            {filteredClasses.length === 0 ? (
              <div className="border border-dashed border-slate-300 rounded-xl px-4 py-8 text-sm text-slate-500 dark:text-slate-400 text-center">
                {CLASS_SUMMARY_CONFIG.emptyFilterMessage}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredClasses.map((cls) => {
                  const expanded = expandedClassId === cls.id;
                  const detail = classDetailCache[cls.id];
                  const band   = confidenceBandFor(cls.confidence_score);
                  const score  = typeof cls.confidence_score === 'number' ? cls.confidence_score : null;
                  return (
                    <div
                      key={cls.id}
                      className={`group relative overflow-hidden rounded-xl border bg-white dark:bg-slate-800 transition-all duration-300 hover:shadow-lg ${
                        expanded
                          ? 'md:col-span-2 border-pink-300 shadow-lg ring-1 ring-pink-200'
                          : 'border-slate-200 dark:border-slate-700 hover:-translate-y-0.5'
                      }`}
                    >
                      {/* Left confidence rail */}
                      <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${band.className}`} />
                      <button
                        onClick={() => handleExpandClass(cls)}
                        className="w-full text-left pl-5 pr-4 py-3"
                      >
                        <div className="flex items-start gap-3">
                          {/* Class code monogram */}
                          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 text-white font-mono font-extrabold flex items-center justify-center shadow-md text-base">
                            {cls.class_code}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                                {cls.class_full_code || cls.material_grade || '—'}
                              </p>
                              {score !== null && (
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {/* Mini radial confidence */}
                                  <svg className="w-7 h-7 -rotate-90" viewBox="0 0 32 32">
                                    <circle cx="16" cy="16" r="13" fill="none"
                                      className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="3" />
                                    <circle cx="16" cy="16" r="13" fill="none"
                                      className={band.stroke}
                                      strokeWidth="3" strokeLinecap="round"
                                      strokeDasharray={`${2 * Math.PI * 13}`}
                                      strokeDashoffset={`${2 * Math.PI * 13 * (1 - score)}`} />
                                  </svg>
                                  <span className={`text-[11px] font-bold ${band.text}`}>
                                    {Math.round(score * 100)}%
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Meta chips */}
                            <div className="mt-1.5 flex flex-wrap items-center gap-1">
                              {cls.material_grade && (
                                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 rounded">
                                  {cls.material_grade}
                                </span>
                              )}
                              {cls.pressure_rating && (
                                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 rounded">
                                  {cls.pressure_rating}
                                </span>
                              )}
                              {cls.flange_facing && (
                                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-violet-50 text-violet-700 border border-violet-200 rounded">
                                  {cls.flange_facing}
                                </span>
                              )}
                              {cls.source_pages?.length === 2 && (
                                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-50 text-slate-600 border border-slate-200 rounded">
                                  p.{cls.source_pages[0]}–{cls.source_pages[1]}
                                </span>
                              )}
                              <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded ${band.bg} ${band.text}`}>
                                {band.label}
                              </span>
                            </div>

                            {/* Footer: components count + engine + expand hint */}
                            <div className="mt-2 flex items-center justify-between">
                              <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                                <span className="inline-flex items-center gap-1">
                                  <TableCellsIcon className="w-3.5 h-3.5" />
                                  <strong className="text-slate-700 dark:text-slate-200">{cls.components_count}</strong>
                                  rows
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <SparklesIcon className="w-3.5 h-3.5 text-pink-500" />
                                  {cls.extraction_engine || 'AI'}
                                </span>
                              </div>
                              <span className="text-[10px] font-semibold text-pink-600 dark:text-pink-300 group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-0.5">
                                {expanded ? 'Collapse' : 'Open detail'}
                                {expanded ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Expanded detail */}
                      {expanded && (
                        <div className="border-t border-pink-200 bg-gradient-to-b from-pink-50/40 to-white dark:from-slate-900/40 dark:to-slate-800 px-4 py-3">
                          {!detail ? (
                            <div className="flex items-center gap-2 text-xs text-slate-500 italic">
                              <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                              Loading detail…
                            </div>
                          ) : (
                            <ClassDetailPanel cls={detail} />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Subcomponent: per-class detail (soft-coded sections) ────────────────────
const SectionHeader = ({ icon: Icon, title, accent, count }) => (
  <div className="flex items-center gap-2 mb-2">
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md bg-gradient-to-br ${accent} text-white shadow-sm`}>
      <Icon className="w-3.5 h-3.5" />
    </span>
    <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-slate-700 dark:text-slate-200">
      {title}
    </h4>
    {typeof count === 'number' && (
      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full">
        {count}
      </span>
    )}
    <div className={`flex-1 h-px bg-gradient-to-r ${accent} opacity-30`} />
  </div>
);

const ClassDetailPanel = ({ cls }) => {
  if (!cls) return null;
  const sections = DETAIL_CONFIG.sections.filter((s) => s.visible(cls));

  if (sections.length === 0) {
    return (
      <p className="text-xs text-slate-500 italic">No additional detail captured for this class.</p>
    );
  }

  const renderBody = (key) => {
    if (key === 'services') {
      return (
        <div className="flex flex-wrap gap-1">
          {(cls.service_list || []).map((s, i) => (
            <span
              key={`${s}-${i}`}
              className="px-2 py-1 text-xs font-medium bg-gradient-to-r from-pink-50 to-rose-50 text-pink-700 border border-pink-200 rounded-full shadow-sm"
            >
              {s}
            </span>
          ))}
        </div>
      );
    }
    if (key === 'pt') {
      const rows = cls.pt_rating_table || [];
      return (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="text-xs w-full">
            <thead>
              <tr className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-slate-700 dark:to-slate-700">
                <th className="px-3 py-2 text-left font-bold text-emerald-800 dark:text-emerald-200">Pressure (bar-g)</th>
                <th className="px-3 py-2 text-left font-bold text-emerald-800 dark:text-emerald-200">Temperature (°C)</th>
                <th className="px-3 py-2 text-left font-bold text-emerald-800 dark:text-emerald-200">Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="odd:bg-white even:bg-slate-50/40 dark:odd:bg-slate-800 dark:even:bg-slate-900/30">
                  <td className="px-3 py-1.5 font-mono tabular-nums">{r.pressure_bar_g ?? '—'}</td>
                  <td className="px-3 py-1.5 font-mono tabular-nums">{r.temperature_c ?? '—'}</td>
                  <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300">{r.notes || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    if (key === 'components') {
      const rows = cls.components || [];
      const cols = DETAIL_CONFIG.componentColumns;
      return (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="text-xs w-full">
            <thead className="sticky top-0">
              <tr className="bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-slate-700 dark:to-slate-700">
                {cols.map((c) => (
                  <th
                    key={c.key}
                    className={`px-3 py-2 font-bold text-violet-800 dark:text-violet-200 text-${c.align || 'left'} whitespace-nowrap`}
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr
                  key={c.id}
                  className="odd:bg-white even:bg-slate-50/40 dark:odd:bg-slate-800 dark:even:bg-slate-900/30 hover:bg-pink-50/30 dark:hover:bg-pink-900/10 transition-colors"
                >
                  {cols.map((col) => (
                    <td
                      key={col.key}
                      className={`px-3 py-1.5 text-${col.align || 'left'} ${col.key === 'description' ? 'text-slate-600 dark:text-slate-300' : ''}`}
                    >
                      {col.render ? col.render(c) : (c[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    if (key === 'notes') {
      return (
        <div className="relative bg-gradient-to-br from-amber-50 to-orange-50 dark:from-slate-900 dark:to-slate-900 border-l-4 border-amber-400 rounded-r-lg p-3">
          <p className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
            {cls.raw_notes}
          </p>
        </div>
      );
    }
    return null;
  };

  // Counts used in section headers (where meaningful).
  const counts = {
    services:   (cls.service_list   || []).length,
    pt:         (cls.pt_rating_table|| []).length,
    components: (cls.components     || []).length,
    notes:      undefined,
  };

  return (
    <div className="space-y-4">
      {sections.map((s) => (
        <div key={s.key}>
          <SectionHeader icon={s.icon} title={s.title} accent={s.accent} count={counts[s.key]} />
          {renderBody(s.key)}
        </div>
      ))}
    </div>
  );
};

export default PaperSpecExtractor;
