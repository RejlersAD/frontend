import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { API_BASE_URL } from '../../../config/api.config';
import { listLegends } from '../../../services/pidCheckerV2API';
import {
  Upload as UploadIcon, FileText, Table, CheckCircle, AlertTriangle,
  Loader, X, Download, Zap, Search, Eye, EyeOff, Info,
  FolderPlus, Package, ArrowLeft, ChevronDown,
  ChevronLeft, ChevronRight, Plus, Settings2, ChevronUp, RefreshCw,
  MoreVertical, Pencil, Trash2, Calendar, BarChart3, ArrowRight,
  ExternalLink, Sparkles, Folder,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Enterprise color tokens — per explicit design spec (white bg, navy header,
// blue primary, green/amber/red status, light-grey borders/alt rows).
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg: '#ffffff',
  header: '#1a2332',
  headerText: '#e2e8f0',
  primary: '#2563eb',
  primaryHover: '#1d4ed8',
  primarySoft: '#eff6ff',
  success: '#16a34a',
  successBg: '#dcfce7',
  successBorder: '#86efac',
  warning: '#d97706',
  warningBg: '#fef3c7',
  warningBorder: '#fde68a',
  error: '#dc2626',
  errorBg: '#fee2e2',
  errorBorder: '#fca5a5',
  grey: '#6b7280',
  greyBg: '#f3f4f6',
  greyBorder: '#e5e7eb',
  border: '#e5e7eb',
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  rowAlt: '#f9fafb',
};

// ─────────────────────────────────────────────────────────────────────────────
// Project Selection screen palette — per explicit design spec (slate bg/
// border/text, same blue primary as C.primary above). Deliberately a
// separate token set rather than folded into C: C is used by every OTHER
// screen in this file (the analysis/upload/results views), and this redesign
// is scoped to the project-selection screen only — reusing C.primary for the
// shared brand blue, but keeping the slate neutrals local so the rest of the
// page's grey/gray tones are untouched.
// ─────────────────────────────────────────────────────────────────────────────
const PS = {
  bg: '#F8FAFC',
  cardBorder: '#E2E8F0',
  primary: C.primary,
  primaryHover: C.primaryHover,
  primarySoft: '#EFF6FF',
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  danger: '#DC2626',
  dangerSoft: '#FEF2F2',
};

const FONT_STACK = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const PAGE_SIZE = 10;

// ─────────────────────────────────────────────────────────────────────────────
// Constants (unchanged — same API surface as before)
// ─────────────────────────────────────────────────────────────────────────────
const API_PREFIX = `${API_BASE_URL}/electrical-comparison`;

const MODELS_BY_PROVIDER = {
  claude: ['claude-sonnet-5', 'claude-opus-5', 'claude-sonnet-4-5-20250929'],
  openai: ['gpt-4o'],
};

// Friendly dropdown labels — display only; the raw model id above is
// still what's actually sent to the backend (see the Model <select>'s
// value/onChange, unchanged).
const MODEL_LABELS = {
  'claude-sonnet-5': 'Claude Sonnet 5 (Recommended)',
  'claude-opus-5': 'Claude Opus 5 (Most accurate)',
  'claude-sonnet-4-5-20250929': 'Claude Sonnet 4.5 (Legacy)',
  'gpt-4o': 'GPT-4o',
};

// ─────────────────────────────────────────────────────────────────────────────
// Step-by-step unlock flow — same STAGE_FLOW pattern as ValveMTO.jsx
// (src/pages/Engineering/Piping/ValveMTO.jsx): each stage carries its own
// isUnlocked(state)/isComplete(state) gate, read against a plain
// stageState object built from component state (sldStage1Complete etc.
// below), never cross-referencing other stage entries directly.
// ─────────────────────────────────────────────────────────────────────────────

// Legend Manager page — same section/returnTo/from query-param contract
// ValveMTO's own VM_LEGEND_MANAGER_ROUTE uses, so LegendManagerPage.jsx's
// existing "Return to <from>" banner works unchanged for SLD Checker too.
// 'electrical' is the real, already-registered Legend Manager section id
// (apps/pid_checker_v2 discipline 1.4) — confirmed by reading
// src/services/pidCheckerV2API.js's own LEGEND_SECTIONS/LEGEND_DISCIPLINES.
const SLD_LEGEND_MANAGER_ROUTE = '/engineering/legends?section=electrical&returnTo=/engineering/electrical/sld&from=SLD%20Checker';
// MyEnquiries.jsx no longer reads returnTo/from (its own return banner
// was removed), so this stays a plain route.
const SLD_ICT_ROUTE = '/my-enquiries';
// One-shot flag, set right before navigating to Legend Manager and
// consumed by the mount effect below — a plain boolean survives
// sessionStorage fine (unlike a File object, which is why pidFile etc.
// below use module memory, not sessionStorage, to survive the same
// round-trip).
const SLD_LEGEND_NAV_FLAG = 'sld_legend_nav_flag';
// DEVIATION (flagged, necessary): the requested fix was to stash the
// project on SLD_SESSION_CACHE (the plain module-scope object above)
// before navigating to ICT. That works for Legend Manager because
// navigate(SLD_LEGEND_MANAGER_ROUTE) is a SAME-TAB route change — the JS
// module (and SLD_SESSION_CACHE with it) never unloads. The ICT link is
// different: it opens via window.open(..., '_blank') in a NEW browser
// tab, which is a wholly separate JS realm — SLD_SESSION_CACHE there
// starts back at its module defaults; the original tab's object is
// simply unreachable. sessionStorage IS copied into a same-origin tab
// opened with window.open (the one thing that does survive that
// boundary), so the project id is round-tripped through it instead —
// same mechanism SLD_LEGEND_NAV_FLAG above already relies on.
const SLD_ICT_RETURN_PROJECT_KEY = 'sld_ict_return_project_id';

// Module-scope in-memory cache — same pattern as ValveMTO's
// VM_SESSION_CACHE. Navigating to Legend Manager is a real route change
// to a DIFFERENT <Route>, which unmounts this whole component;
// sessionStorage can't hold a File object, but a plain object declared
// here at module scope survives the unmount untouched (the JS module
// itself stays loaded for the whole SPA session). useState reads it as
// each field's initial value below, and a write-through effect keeps it
// in sync on every change.
const SLD_SESSION_CACHE = {
  enabled: true,
  projectId: null,
  selectedProject: null,
  pidFile: null,
  equipmentFile: null,
  loadListFile: null,
  provider: 'claude',
  model: '',
  apiKey: '',
  keyTestResult: null,
  scanMode: 'thorough',
  legendsActivatedFromManager: false,
};

// sldStage1Complete/sldStage2Complete/sldStage3Complete are computed in
// the component body (from live state) and passed in as a plain object —
// SLD_STAGE_FLOW itself never reads component state directly, exactly
// mirroring ValveMTO's VM_STAGE_FLOW.
const SLD_STAGE_FLOW = [
  {
    id: 'upload',
    num: 1,
    title: 'Upload Files',
    optional: false,
    isUnlocked: () => true,
    isComplete: (s) => Boolean(s.stage1Complete),
    instruction: {
      heading: 'Upload files',
      bullets: [
        'Upload at least 2 files to start:',
        'P&ID Drawing + Equipment List',
        'P&ID Drawing + Load List',
        'Equipment List + Load List',
        'All 3 files for full comparison',
        'P&ID Drawing requires AI Vision API key (Stage 2).',
        'Equipment List + Load List only — no API key needed (free!).',
      ],
    },
  },
  {
    id: 'engine',
    num: 2,
    title: '⚡ RADAI AI Engine',
    subtitle: 'Only required when a P&ID is uploaded',
    optional: false,
    isUnlocked: (s) => Boolean(s.stage1Complete),
    isComplete: (s) => Boolean(s.stage2Complete),
    instruction: {
      heading: 'RADAI AI Engine',
      bullets: [
        'RADAI AI Engine reads your SLD drawing to extract electrical tags.',
        'Provide your personal API key — it is never stored on the server.',
        "Don't have a key? Raise a ticket with ICT via My Enquiries.",
      ],
    },
  },
  {
    id: 'legend',
    num: 3,
    title: 'Electrical Legend',
    optional: false,
    isUnlocked: (s) => Boolean(s.stage1Complete) && Boolean(s.stage2Complete),
    isComplete: (s) => Boolean(s.stage3Complete),
    instruction: {
      heading: 'Activate your electrical legend',
      bullets: [
        "Click 'Activate Legends' to open Legend Manager.",
        'Go to Electrical section (1.4).',
        'Activate at least one legend and save changes.',
        "Click 'Return to SLD Checker' banner to come back.",
        'Analyse button enables only after completing these steps.',
      ],
      note: 'Required — activate an electrical legend in Legend Manager and return here. Analyse button stays disabled until this step is completed.',
    },
  },
];

// Submit-gate checklist copy — same role as ValveMTO's VM_SUBMIT_GATE_STAGES.
const SLD_SUBMIT_GATE_STAGES = [
  { id: 'upload', label: 'Files uploaded (at least 2)' },
  { id: 'engine', label: 'RADAI AI Engine configured' },
  { id: 'legend', label: 'Electrical legend activated' },
];

// Soft-coded per-stage "User Instruction" panel — identical styling to
// ValveMTO's own VmStageInstruction. `actions`: optional array of
// {label, route} (navigates within the SPA), {label, route, newTab: true}
// (opens route in a new browser tab via window.open — same-tab navigate()
// would otherwise replace the current SLD page, losing in-progress
// uploads/stage state), or {label, onClick} (runs a callback instead).
function SldStageInstruction({ stage, instruction, actions }) {
  const navigate = useNavigate();
  const { heading, bullets = [], note } = instruction || stage?.instruction || {};
  if (!heading) return null;
  const runAction = (a) => {
    if (a.onClick) { a.onClick(); return; }
    if (a.newTab) { window.open(a.route, '_blank', 'noopener,noreferrer'); return; }
    navigate(a.route);
  };
  return (
    <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50/60 p-3.5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-sky-700 mb-1.5">
        📘 User Instruction — {heading}
      </p>
      <ul className="list-disc list-inside space-y-0.5 text-xs text-slate-600">
        {bullets.map((b, i) => <li key={i}>{b}</li>)}
      </ul>
      {!!actions?.length && (
        <div className="flex flex-wrap gap-2 mt-2.5">
          {actions.map((a) => (
            a.variant === 'link' ? (
              <button
                key={a.label}
                type="button"
                onClick={() => runAction(a)}
                className="text-[11px] font-semibold text-indigo-600 hover:underline"
              >
                {a.label}
              </button>
            ) : (
              <button
                key={a.label}
                type="button"
                onClick={() => runAction(a)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-700 bg-white hover:bg-sky-50 border border-sky-300 rounded-md transition-colors"
              >
                {a.label} <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )
          ))}
        </div>
      )}
      {note && <p className="mt-1.5 text-[11px] italic text-slate-400">{note}</p>}
    </div>
  );
}

// Soft-coded locked placeholder — identical styling to ValveMTO's own
// VmStageGate — shown in place of a stage's content until its
// isUnlocked(state) gate passes.
function SldStageGate({ stage }) {
  return (
    <div className="border border-dashed border-slate-200 rounded-lg p-3.5 mb-4 bg-slate-50/60 flex items-center gap-3 opacity-80">
      <span className="flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 text-slate-400 text-xs font-bold border border-slate-200 shrink-0">
        🔒
      </span>
      <div>
        <p className="text-sm font-semibold text-slate-400">
          {stage.num}. {stage.title}
          {stage.optional && <span className="ml-1 text-[10px] font-normal text-slate-400">(optional)</span>}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">Complete the previous step to unlock this stage.</p>
      </div>
    </div>
  );
}

// Per-stage numbered badge — same visual language as ValveMTO's own
// VmStageHeading (coloured when unlocked, grey when locked), plus a green
// check once the stage is complete.
function SldStageHeading({ stage, unlocked, complete, colourClass }) {
  return (
    <div className="mb-3">
      <h2 className={`text-lg font-bold flex items-center gap-2 ${unlocked ? 'text-slate-900' : 'text-slate-400'}`}>
        <span className={`h-6 w-6 rounded-full text-xs font-bold flex items-center justify-center ${unlocked ? colourClass : 'bg-slate-100 text-slate-400'}`}>
          {stage.num}
        </span>
        {stage.title}
        {stage.optional && <span className="text-xs font-normal text-slate-400">(optional)</span>}
        {complete && <CheckCircle className="h-4 w-4 text-emerald-500" />}
        {!unlocked && <span className="text-xs">🔒</span>}
      </h2>
      {stage.subtitle && unlocked && (
        <p className="text-xs text-slate-500 mt-0.5 ml-8">{stage.subtitle}</p>
      )}
    </div>
  );
}

// How often the progress screen polls GET /status/<job_id>/ while a job
// is 'processing'.
const POLL_INTERVAL_MS = 3000;
// After a network/transient error on a poll request, wait this long
// before retrying — never shown to the user as an error, never stops
// polling (see pollJobStatus's catch block).
const POLL_ERROR_RETRY_MS = 5000;
// Hard ceiling on how long polling keeps going — matches
// apps/electrical_comparison/tasks.py's own @shared_task(time_limit=1200)
// hard limit on process_electrical_comparison, so the frontend never
// gives up before the backend genuinely could have.
const POLL_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes

// Staged "still waiting" messaging shown while status stays 'processing'
// — replaces showing an error during a long-running analysis. Checked
// from the longest elapsed threshold down, so the most urgent message
// that applies always wins.
const getWaitingMessage = (elapsedMs) => {
  const minutes = elapsedMs / 60000;
  if (minutes >= 10) return 'Still working... Please wait.';
  if (minutes >= 5) return 'Almost done... Large drawings take up to 20 minutes.';
  if (minutes >= 2) return 'Still processing large PDF...';
  return 'Analysis in progress... This may take several minutes for large PDF files.';
};

// "2.4 MB" / "340 KB" — used by UploadBox to show a selected file's size
// alongside its name.
const formatFileSize = (bytes) => {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// "2m 30s" — used by the elapsed-time counter shown on the progress screen.
const formatElapsedTime = (ms) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}m ${secs}s`;
};

// ── Persisted "analysis still running" marker, per project ─────────────
// Survives a page reload / navigating away and back — without this, an
// analysis that's genuinely still running on the backend (Celery task,
// independent of this browser tab) would otherwise look exactly like a
// stuck/dead one the moment this component remounts, since all the
// polling state (activePollJobIdRef, pollStartTimeRef) lives only in
// memory. Scoped per-project since that's the unit the user navigates
// by (project list → a project's analysis screen).
const ACTIVE_JOB_STORAGE_PREFIX = 'ec_active_job_';

const _activeJobStorageKey = (projectId) => `${ACTIVE_JOB_STORAGE_PREFIX}${projectId}`;

const saveActiveJobToStorage = (projectId, jobId, startedAt) => {
  if (!projectId) return;
  try {
    localStorage.setItem(_activeJobStorageKey(projectId), JSON.stringify({ job_id: jobId, started_at: startedAt }));
  } catch {
    // localStorage unavailable (private browsing, quota, disabled) —
    // non-fatal; it only means resume-after-reload won't work this time.
  }
};

const getActiveJobFromStorage = (projectId) => {
  if (!projectId) return null;
  try {
    const raw = localStorage.getItem(_activeJobStorageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.job_id || !parsed.started_at) return null;
    return parsed;
  } catch {
    return null;
  }
};

const clearActiveJobFromStorage = (projectId) => {
  if (!projectId) return;
  try {
    localStorage.removeItem(_activeJobStorageKey(projectId));
  } catch {
    // non-fatal
  }
};

// Stage display labels — keys MUST match tasks.py's STAGE_* constants
// exactly (apps/electrical_comparison/tasks.py), since job.current_stage
// is saved there verbatim and read back here unchanged.
const getStageLabel = (stage, pagesDone, pagesTotal, elapsedMs = 0) => {
  switch (stage) {
    case 'uploading':
      // FIX 4 — in local dev (CELERY_TASK_ALWAYS_EAGER=True) the whole
      // task runs synchronously INSIDE the upload request, so no poll
      // tick can observe a later backend stage until that request
      // finally returns — the backend can legitimately report
      // 'uploading' for the entire run. Advance the label with elapsed
      // time instead of leaving it frozen; liveElapsedMs (ticking every
      // second independently of polling — see the liveTick effect)
      // keeps this moving even while that request is still in flight.
      if (elapsedMs > 30000) return '🤖 AI Vision processing...';
      if (elapsedMs > 10000) return '📄 Preparing analysis...';
      return '📤 Uploading files...';
    case 'reading_pages': return '📄 Reading PDF pages...';
    case 'ai_vision':
      return pagesTotal > 0
        ? `🤖 AI Vision analysing page ${pagesDone} of ${pagesTotal}...`
        : '🤖 AI Vision analysing drawing...';
    case 'parsing_excel': return '📊 Parsing Excel files...';
    case 'comparing': return '🔍 Comparing equipment tags...';
    case 'saving_results': return '💾 Saving results...';
    case 'completed': return '✅ Analysis complete! Loading results...';
    default: return '⏳ Processing...';
  }
};

// Jobs with no P&ID file (Equipment List vs Load List only) never have
// a pages_total — the backend's progress_percentage stays null for the
// whole run (JobStatusView only computes it when pages_total > 0), so
// the bar would otherwise sit frozen at its flat default the entire
// time. This maps current_stage to an approximate percentage instead,
// for exactly that case.
const STAGE_PROGRESS_FALLBACK = {
  uploading: 10,
  parsing_excel: 40,
  comparing: 70,
  saving_results: 90,
  completed: 100,
};

// Single source of truth for "what % should the bar show right now" —
// used by both the bar's width and its numeric label, so they can never
// disagree. Real progress_percentage wins when the backend has one;
// otherwise falls back to the stage map above; otherwise a flat 8%
// "something is happening" sliver.
const getProgressBarPercentage = (p, elapsedMs = 0) => {
  if (!p) return 8;
  if (p.progressPercentage != null) return p.progressPercentage;
  if (p.currentStage && STAGE_PROGRESS_FALLBACK[p.currentStage] != null) {
    const base = STAGE_PROGRESS_FALLBACK[p.currentStage];
    // FIX 3 — while still sitting at the earliest ('uploading') fallback
    // value with no real progress_percentage yet, nudge it up with
    // elapsed time so the bar visibly moves even when the backend
    // hasn't reported a later stage (same EAGER-mode reasoning as
    // getStageLabel above — elapsedMs here is the live per-second tick,
    // not the poll-only progress.elapsedMs, so this keeps moving even
    // while the upload request itself is still in flight).
    if (p.currentStage === 'uploading') {
      if (elapsedMs > 60000) return Math.max(base, 25);
      if (elapsedMs > 30000) return Math.max(base, 20);
      if (elapsedMs > 5000) return Math.max(base, 15);
    }
    return base;
  }
  return 8;
};

// Rotating facts shown during analysis — purely cosmetic, filling the
// wait between polls with something genuinely relevant to what's
// happening rather than a static spinner.
const ELECTRICAL_FACTS = [
  'Electrical tags follow the AREA-TYPECODE-SEQUENCE format, e.g. 285-PM-411B.',
  'PM = Pump Motor, U = Switchboard/MCC, JB = Junction Box — all defined in your project’s Electrical legend.',
  'Legend/symbol-key pages are read for context only — their illustrative example tags are never counted as real equipment.',
  'Notes, revision-history and bill-of-material pages are skipped automatically before they ever reach AI Vision.',
  'A tag found on both sides is marked MATCHED — only real discrepancies show up as MISSING or EXTRA.',
];

// Enterprise pill badges — same status keys/semantics as before, restyled.
const STATUS_STYLES = {
  matched:  { bg: C.successBg, text: '#166534', border: C.successBorder, label: 'MATCHED' },
  missing:  { bg: C.warningBg, text: '#92400e', border: C.warningBorder, label: 'MISSING' },
  extra:    { bg: C.errorBg,   text: '#991b1b', border: C.errorBorder,   label: 'EXTRA' },
  mismatch: { bg: C.errorBg,   text: '#991b1b', border: C.errorBorder,   label: 'MISMATCH' },
  uncertain:{ bg: '#e0e7ff',   text: '#3730a3', border: '#c7d2fe',       label: 'UNCERTAIN' },
};
const GREY_BADGE = { bg: C.greyBg, text: '#374151', border: C.greyBorder, label: 'NO LOAD LIST' };

// Panel-verification statuses — a DIFFERENT vocabulary than matched/
// missing/extra (see backend views.py's _build_panel_verification):
// Equipment List holds panels, Load List holds motors fed FROM a panel,
// so what's actually checked is "does the panel the Load List names
// exist in the Equipment List", not a direct tag-to-tag match.
const PANEL_STATUS_STYLES = {
  panel_verified:     { bg: C.successBg, text: '#166534', border: C.successBorder, label: 'VERIFIED' },
  panel_missing:       { bg: C.errorBg,   text: '#991b1b', border: C.errorBorder,   label: 'MISSING' },
  panel_no_load_list:  { bg: C.greyBg,    text: '#374151', border: C.greyBorder,    label: 'NO LOAD LIST' },
};
const MOTOR_STATUS_STYLES = {
  motor_verified:     { bg: C.successBg, text: '#166534', border: C.successBorder, label: 'Panel Verified' },
  motor_not_verified: { bg: C.errorBg,   text: '#991b1b', border: C.errorBorder,   label: 'Panel Not Verified' },
};

// Tab 4 "Full Comparison" statuses — a tag's presence across ALL 3
// sources at once (see backend views.py's _build_combined_comparison),
// a different vocabulary again from both the generic matched/missing/
// extra and the panel-verification ones above.
const COMBINED_STATUS_STYLES = {
  fully_matched: { bg: C.successBg, text: '#166534', border: C.successBorder, label: '✅ ALL MATCHED' },
  partial:       { bg: C.warningBg, text: '#92400e', border: C.warningBorder, label: '⚠️ PARTIAL MATCH' },
  single_source: { bg: C.errorBg,   text: '#991b1b', border: C.errorBorder,   label: '❌ SINGLE SOURCE' },
};

// The backend encodes a combined row's per-source presence only in its
// `remarks` text ("Found in: P&ID, Equipment List") — there's no
// separate in_pid/in_equipment/in_load_list column on the flat
// ElectricalComparisonResult model (no migration was in scope for this
// feature). Parsed here the same way _reconstruct_panel_verification
// already parses remarks text server-side for motor_count/panel.
const combinedPresence = (remarks) => {
  const text = remarks || '';
  return {
    inPid: text.includes('P&ID'),
    inEquipment: text.includes('Equipment List'),
    inLoadList: text.includes('Load List'),
  };
};

// FIX 3 — a suspicious tag's remarks (views.py's _collect_comparison_
// rows) carry tag_extractor.py's own "⚠️ Needs Review —" marker
// verbatim; rendered here as a yellow warning badge instead of plain
// text so it actually stands out in the results table, rather than
// reading identically to a normal remarks string.
const NEEDS_REVIEW_MARKER = '⚠️ Needs Review';

const RemarksCell = ({ remarks }) => {
  if (!remarks) return <span style={{ color: C.textSecondary }}>—</span>;
  if (!remarks.includes(NEEDS_REVIEW_MARKER)) {
    return <span style={{ color: C.textSecondary }}>{remarks}</span>;
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold"
      style={{ background: C.warningBg, color: '#92400e', border: `1px solid ${C.warningBorder}` }}
    >
      {remarks}
    </span>
  );
};

const authHeader = () => {
  const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Which (primary, reference) side a row's tag is present on, derived from
// its status — the backend doesn't persist two separate booleans, just
// `status`, and this mapping is exhaustive for every status the
// comparison engine can produce (matched/mismatch/uncertain = both
// sides; missing = reference only; extra = primary only).
const presenceForStatus = (st) => {
  if (st === 'missing') return [false, true];
  if (st === 'extra') return [true, false];
  return [true, true]; // matched / mismatch / uncertain
};

// Splits a tag like "285-PM-411B" into {area, typeCode, sequence} for the
// detail panel's breakdown — display-only, not re-validated here (the
// backend's legend-derived regex already did that).
const parseTagParts = (tag) => {
  const m = /^(\d{1,5})-([A-Za-z]{1,4})-(.+)$/.exec(tag || '');
  if (!m) return { area: '', typeCode: '', sequence: '' };
  return { area: m[1], typeCode: m[2], sequence: m[3] };
};

// One entry per possible comparison — keyed by the backend's own
// `comparisons_done` id, in the fixed display order the tabs should
// appear in. `source` is the ElectricalComparisonResult.source value to
// filter rows/export by.
const TAB_CONFIG = {
  pid_vs_equipment: {
    source: 'equipment_list',
    label: 'P&ID vs Equipment List (Panels/Switchboards)',
    primaryLabel: 'In P&ID',
    referenceLabel: 'In Equipment List',
    exportPrefix: 'pid_vs_equipment',
  },
  pid_vs_loadlist: {
    source: 'load_list',
    label: 'P&ID vs Load List (Motors/Loads)',
    primaryLabel: 'In P&ID',
    referenceLabel: 'In Load List',
    exportPrefix: 'pid_vs_loadlist',
  },
  equipment_vs_loadlist: {
    source: 'equipment_vs_loadlist',
    label: 'Equipment List vs Load List',
    primaryLabel: 'Equipment List',
    referenceLabel: 'Load List',
    exportPrefix: 'equipment_vs_loadlist',
  },
  combined: {
    source: 'combined',
    label: 'Full Comparison',
    exportPrefix: 'full_comparison',
  },
};
// Tab visibility is already fully data-driven — availableTabs (below)
// filters this list down to whatever comparisons_done the backend
// actually reports, and 'combined' is only ever included there when all
// 3 files were uploaded (see tasks.py's own "if pid_file_path and
// equipment_tags and load_list_tags" gate) — so Tab 4 showing only for
// a 3-file analysis falls out of the existing mechanism for free, no
// separate visibility check needed here.
const TAB_ORDER = ['pid_vs_equipment', 'pid_vs_loadlist', 'equipment_vs_loadlist', 'combined'];

// ─────────────────────────────────────────────────────────────────────────────
// Small reusable pieces
// ─────────────────────────────────────────────────────────────────────────────
const UploadBox = ({ label, icon: Icon, accept, file, onSelect, onRemove }) => {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      className="rounded-lg p-5 border-2 border-dashed text-center relative overflow-hidden transition-all"
      style={{ borderColor: file ? C.success : (dragOver ? C.primary : C.greyBorder), background: file ? C.successBg : '#fafafa' }}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) onSelect(f); }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
    >
      <div className="flex items-center justify-center gap-2 mb-2">
        <span className="text-sm font-bold" style={{ color: C.textPrimary }}>{label}</span>
      </div>

      {file ? (
        <div className="relative">
          <CheckCircle className="w-8 h-8 mx-auto mb-2" style={{ color: C.success }} />
          <p className="text-sm font-medium truncate px-2" style={{ color: C.textPrimary }}>
            ✅ {file.name} <span className="font-normal" style={{ color: C.textSecondary }}>({formatFileSize(file.size)})</span>
          </p>
          <button
            type="button"
            onClick={onRemove}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold"
            style={{ color: C.error }}
          >
            <X className="w-3.5 h-3.5" /> Remove
          </button>
        </div>
      ) : (
        <div className="cursor-pointer" onClick={() => inputRef.current?.click()}>
          <Icon className="w-8 h-8 mx-auto mb-2" style={{ color: '#9ca3af' }} />
          <p className="text-xs" style={{ color: C.textSecondary }}>Drag & drop or <em>click to browse</em></p>
        </div>
      )}
      <input
        ref={inputRef} type="file" accept={accept} className="hidden"
        onChange={(e) => { const f = e.target.files[0]; if (f) onSelect(f); }}
      />
    </div>
  );
};

const StatCard = ({ label, value, icon, tone }) => {
  const tones = {
    grey:  { bg: C.greyBg,    border: C.greyBorder,    text: C.textPrimary,  iconBg: '#e5e7eb' },
    green: { bg: C.successBg, border: C.successBorder, text: '#166534',      iconBg: '#bbf7d0' },
    amber: { bg: C.warningBg, border: C.warningBorder, text: '#92400e',      iconBg: '#fde68a' },
    red:   { bg: C.errorBg,   border: C.errorBorder,   text: '#991b1b',      iconBg: '#fecaca' },
    blue:  { bg: C.primarySoft,border: '#bfdbfe',       text: '#1e40af',      iconBg: '#dbeafe' },
    purple:{ bg: '#f3e8ff',   border: '#e9d5ff',        text: '#6b21a8',      iconBg: '#e9d5ff' },
  };
  const t = tones[tone] || tones.grey;
  return (
    <div className="rounded-lg p-4 border flex items-center gap-3" style={{ background: t.bg, borderColor: t.border }}>
      {icon && (
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: t.iconBg }}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <div className="text-2xl font-extrabold tabular-nums leading-none" style={{ color: t.text }}>{value}</div>
        <div className="text-xs font-semibold mt-1 uppercase tracking-wide truncate" style={{ color: t.text, opacity: 0.85 }}>{label}</div>
      </div>
    </div>
  );
};

const Badge = ({ style: st }) => (
  <span
    className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border tracking-wide"
    style={{ background: st.bg, color: st.text, borderColor: st.border }}
  >
    {st.label}
  </span>
);

// One rendered P&ID/SLD page with the comparison-result tag boxes drawn
// over it. The backend sends the page PNG + boxes in image-pixel
// coordinates (see pdf_annotator.get_annotated_pages); this draws the
// image at canvas resolution and the boxes on top, scaled to whatever
// width the container gives it.
const AnnotatedPageCanvas = ({ page, statusFilter }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !page) return;

    const img = new Image();
    img.src = page.image;
    img.onload = () => {
      const displayWidth = container.clientWidth;
      const scale = displayWidth / page.width;
      const displayHeight = Math.round(page.height * scale);
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, displayWidth, displayHeight);

      const visibleBoxes = (page.boxes || []).filter((b) => statusFilter[b.status]);
      for (const b of visibleBoxes) {
        const x = b.x0 * scale;
        const y = b.y0 * scale;
        const w = (b.x1 - b.x0) * scale;
        const h = (b.y1 - b.y0) * scale;
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
        // Small status label above the box, same as the PDF annotator's
        const label = `[${b.status.toUpperCase()}]`;
        ctx.font = 'bold 10px sans-serif';
        const labelWidth = ctx.measureText(label).width;
        const labelY = Math.max(y - 3, 10);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(x, labelY - 10, labelWidth + 4, 12);
        ctx.fillStyle = b.color;
        ctx.fillText(label, x + 2, labelY);
      }
    };
  }, [page, statusFilter]);

  const boxCount = (page.boxes || []).filter((b) => statusFilter[b.status]).length;
  return (
    <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
      <div className="px-3 py-2 text-xs font-semibold flex items-center justify-between"
           style={{ background: '#f9fafb', color: '#374151' }}>
        <span>Page {page.page}</span>
        <span>{boxCount} highlighted tag(s)</span>
      </div>
      <div ref={containerRef} className="w-full overflow-auto" style={{ maxHeight: '70vh' }}>
        <canvas ref={canvasRef} className="block w-full" style={{ height: 'auto' }} />
      </div>
    </div>
  );
};

// One rendered Equipment List / Load List Excel document as a canvas
// table — each row highlighted by its comparison status (red = missing
// from P&ID, green = matched, yellow = extra). The backend sends the
// sheet as a grid (excel_parser.extract_table_grid); row rectangles
// are the "marked coordinates" equivalent for a spreadsheet.
const TABLE_STATUS_COLORS = {
  matched: { stroke: '#16a34a', fill: 'rgba(22,163,74,0.10)' },
  missing: { stroke: '#dc2626', fill: 'rgba(220,38,38,0.12)' },
  extra: { stroke: '#ca8a04', fill: 'rgba(202,138,4,0.12)' },
};

const DocumentTableCanvas = ({ grid, statusFilter }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !grid) return;

    const ROW_H = 24;
    const HEADER_H = 28;
    const PAD = 8;
    const width = container.clientWidth;
    const colCount = Math.max(grid.headers.length, 1);
    const colWidth = Math.max((width - PAD * 2) / colCount, 60);
    const rows = grid.rows || [];
    const height = HEADER_H + rows.length * ROW_H + PAD * 2;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Header
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, width, HEADER_H);
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#374151';
    grid.headers.forEach((h, i) => {
      ctx.fillText(String(h).slice(0, 24), PAD + i * colWidth + 4, HEADER_H / 2 + 4, colWidth - 8);
    });

    // Rows
    ctx.font = '10px sans-serif';
    rows.forEach((row, ri) => {
      const y = HEADER_H + ri * ROW_H;
      const colors = row.status && statusFilter[row.status] ? TABLE_STATUS_COLORS[row.status] : null;
      if (colors) {
        ctx.fillStyle = colors.fill;
        ctx.fillRect(0, y, width, ROW_H);
        ctx.strokeStyle = colors.stroke;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(1, y + 1, width - 2, ROW_H - 2);
        // Status chip on the right edge so the highlight says WHY
        const label = `[${row.status.toUpperCase()}]`;
        ctx.font = 'bold 9px sans-serif';
        ctx.fillStyle = colors.stroke;
        ctx.fillText(label, width - PAD - ctx.measureText(label).width - 4, y + ROW_H / 2 + 3);
        ctx.font = '10px sans-serif';
      }
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, y, width, ROW_H);
      ctx.fillStyle = '#111827';
      row.cells.forEach((cell, ci) => {
        ctx.fillText(String(cell).slice(0, 28), PAD + ci * colWidth + 4, y + ROW_H / 2 + 3, colWidth - 8);
      });
    });
  }, [grid, statusFilter]);

  const highlighted = (grid.rows || []).filter((r) => r.status && statusFilter[r.status]).length;
  return (
    <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
      <div className="px-3 py-2 text-xs font-semibold flex items-center justify-between"
           style={{ background: '#f9fafb', color: '#374151' }}>
        <span>{(grid.rows || []).length} row(s)</span>
        <span>{highlighted} highlighted row(s)</span>
      </div>
      <div ref={containerRef} className="w-full overflow-auto" style={{ maxHeight: '70vh' }}>
        <canvas ref={canvasRef} className="block w-full" style={{ height: 'auto' }} />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
const SingleLineDiagram = () => {
  const navigate = useNavigate();

  // ── Project selection — same state-driven view switch as
  // PIDVerificationV2.jsx (not a separate route): selectedProject === null
  // shows the project-selection screen; same component/URL either way.
  // Restored from SLD_SESSION_CACHE (not plain useState(null)) so a
  // Legend Manager round-trip doesn't dump the user back on the project
  // list — unlike ValveMTO's activeProject, this component has no
  // localStorage-backed hydration hook, so there's no async "starts null,
  // re-hydrates one tick later" race to guard against here; the cache
  // read below is synchronous and correct from the very first render. ──
  const [selectedProject, setSelectedProject] = useState(SLD_SESSION_CACHE.enabled ? SLD_SESSION_CACHE.selectedProject : null);
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

  // ── Per-project stats (Created/Last Analysis/Analyses count) for the
  // redesigned project cards — derived entirely from the EXISTING
  // ProjectHistoryView endpoint (same one fetchHistory below already
  // calls for the selected project), never fabricated. Keyed by
  // project_id: { count, lastAnalysisAt }. ──
  const [projectStats, setProjectStats] = useState({});
  const [projectMenuOpenId, setProjectMenuOpenId] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingProject, setDeletingProject] = useState(false);

  const fetchProjectStats = async (projectList) => {
    const entries = await Promise.all(
      (projectList || []).map(async (p) => {
        try {
          const { data } = await axios.get(`${API_PREFIX}/projects/${p.project_id}/history/`, { headers: authHeader() });
          const jobs = data || [];
          // ProjectHistoryView already returns jobs newest-first.
          return [p.project_id, { count: jobs.length, lastAnalysisAt: jobs.length ? jobs[0].created_at : null }];
        } catch {
          return [p.project_id, { count: 0, lastAnalysisAt: null }];
        }
      })
    );
    setProjectStats(Object.fromEntries(entries));
  };

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const { data } = await axios.get(`${API_PREFIX}/projects/`, { headers: authHeader() });
      setProjects(data || []);
      fetchProjectStats(data || []);
    } catch {
      // non-fatal — selection screen just shows the empty state
    } finally {
      setLoadingProjects(false);
    }
  };
  useEffect(() => { fetchProjects(); }, []);

  // ICT return detection — consumes SLD_ICT_RETURN_PROJECT_KEY (set right
  // before window.open()'ing the ICT link — see the "Raise a ticket/
  // Request (ICT)" actions further down). Restoring selectedProject can't
  // happen synchronously on mount the way Legend Manager's same-tab
  // round-trip does (SLD_SESSION_CACHE doesn't carry into a new tab — see
  // SLD_ICT_RETURN_PROJECT_KEY's own comment) — it has to wait for THIS
  // tab's own fetchProjects() to resolve so there's a projects list to
  // look the saved id up against. Guarded on selectedProject already
  // being null so it never clobbers a genuine in-progress selection (e.g.
  // the original tab, where selectedProject never actually left state).
  useEffect(() => {
    if (selectedProject || projects.length === 0) return;
    const savedId = sessionStorage.getItem(SLD_ICT_RETURN_PROJECT_KEY);
    if (!savedId) return;
    sessionStorage.removeItem(SLD_ICT_RETURN_PROJECT_KEY);
    const match = projects.find((p) => p.project_id === savedId);
    if (match) handleSelectProject(match);
  }, [projects]);

  const openRenameModal = (p) => { setProjectMenuOpenId(null); setRenameTarget(p); setRenameValue(p.project_name); };
  const openDeleteModal = (p) => { setProjectMenuOpenId(null); setDeleteTarget(p); };

  const handleRenameProject = async (e) => {
    e.preventDefault();
    if (!renameTarget || !renameValue.trim()) return;
    setRenaming(true);
    try {
      const { data } = await axios.put(
        `${API_PREFIX}/projects/${renameTarget.project_id}/`,
        { project_name: renameValue.trim() },
        { headers: authHeader() },
      );
      setProjects((prev) => prev.map((p) => (p.project_id === renameTarget.project_id ? { ...p, project_name: data.project_name } : p)));
      setRenameTarget(null);
    } catch {
      // non-fatal — modal stays open so the user can see it didn't save and retry
    } finally {
      setRenaming(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!deleteTarget) return;
    setDeletingProject(true);
    try {
      await axios.delete(`${API_PREFIX}/projects/${deleteTarget.project_id}/`, { headers: authHeader() });
      setProjects((prev) => prev.filter((p) => p.project_id !== deleteTarget.project_id));
      if (selectedProject?.project_id === deleteTarget.project_id) setSelectedProject(null);
      setDeleteTarget(null);
    } catch {
      // non-fatal — modal stays open so the user can see it didn't delete and retry
    } finally {
      setDeletingProject(false);
    }
  };

  // ── History ("Previous Analyses") — one ElectricalComparisonJob row per
  // past analysis run in this project, same per-project upload-history
  // pattern as IOListWorkflowPage.jsx's own "Previous Uploads" list. ──
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all'); // all | completed | failed
  const [historySort, setHistorySort] = useState('newest'); // newest | oldest
  const [selectedJobId, setSelectedJobId] = useState(null); // which job's results are currently shown
  const [historyActionBusyId, setHistoryActionBusyId] = useState(null); // job_id with a download/delete in flight
  const [loadingCombinedView, setLoadingCombinedView] = useState(false);
  // Project Comment History — per-tag discrepancy lifecycle across all
  // SLD uploads (ProjectCommentsView): which comments are still open and
  // which were killed by a later SLD covering the tag.
  const [commentHistory, setCommentHistory] = useState(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const fetchHistory = async (projectId) => {
    if (!projectId) { setHistory([]); return; }
    setLoadingHistory(true);
    try {
      const { data } = await axios.get(`${API_PREFIX}/projects/${projectId}/history/`, { headers: authHeader() });
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSelectProject = (p) => {
    // Stop tracking whatever project's poll loop was previously active —
    // without this, a dangling poll from the PREVIOUS project would keep
    // running (its closure's jobId still matches activePollJobIdRef) and
    // could overwrite results/progress state for the project the user is
    // now looking at. Re-armed below if this project has its own saved
    // in-progress job to resume.
    activePollJobIdRef.current = null;
    pollStartTimeRef.current = null;
    setAnalysing(false);
    setProgress(null);

    setSelectedProject(p);
    // Reset all file/results/key-test state to empty — same reasoning as
    // PIDVerificationV2.jsx's own handleSelectProject: switching projects
    // must never leave a previous project's in-progress analysis visible.
    // handleSelectProject is ONLY ever invoked by a genuine, deliberate
    // user action (clicking a project card, or auto-select after create)
    // — never by a remount/hydration effect — so every call here IS a
    // real project switch; the whole upload-stage flow resets every time.
    setPidFile(null); setEquipmentFile(null); setLoadListFile(null);
    setResults(null); setError(''); setPidFileNameUsed('');
    setApiKey(''); setKeyTestResult(null);
    setProvider('claude'); setModel(MODELS_BY_PROVIDER.claude[0]);
    setLegendsActivatedFromManager(false);
    if (SLD_SESSION_CACHE.enabled) {
      Object.assign(SLD_SESSION_CACHE, {
        projectId: p.project_id,
        selectedProject: p,
        pidFile: null, equipmentFile: null, loadListFile: null,
        provider: 'claude', model: MODELS_BY_PROVIDER.claude[0],
        apiKey: '', keyTestResult: null, scanMode: 'thorough',
        legendsActivatedFromManager: false,
      });
    }
    setSelectedJobId(null);
    fetchHistory(p.project_id);

    // FIX 2 — resume polling an analysis that was still running when the
    // user navigated away or reloaded the page (the backend Celery task
    // itself never stopped — only this component's in-memory state did).
    const saved = getActiveJobFromStorage(p.project_id);
    if (saved) {
      const age = Date.now() - saved.started_at;
      if (age < POLL_TIMEOUT_MS) {
        setSelectedJobId(saved.job_id);
        setAnalysing(true);
        setProgress({ pagesTotal: 0, pagesDone: 0, currentStage: '', progressPercentage: null });
        setFactIndex(0);
        activePollJobIdRef.current = saved.job_id;
        pollStartTimeRef.current = saved.started_at;
        pollJobStatus(saved.job_id, p.project_id);
      } else {
        // FIX 3 — stale beyond the 20-minute ceiling; nothing to resume.
        clearActiveJobFromStorage(p.project_id);
      }
    }
  };

  const handleBackToProjects = () => {
    // Stop the in-memory poll loop (but deliberately leave the
    // localStorage entry alone) — re-selecting this same project later
    // resumes it via handleSelectProject's own logic above; this just
    // prevents it from running unobserved while the project grid is shown.
    activePollJobIdRef.current = null;
    setAnalysing(false);
    setProgress(null);

    setSelectedProject(null);
    setPidFile(null); setEquipmentFile(null); setLoadListFile(null);
    setResults(null); setError(''); setPidFileNameUsed('');
    setApiKey(''); setKeyTestResult(null);
    setProvider('claude'); setModel(MODELS_BY_PROVIDER.claude[0]);
    setLegendsActivatedFromManager(false);
    if (SLD_SESSION_CACHE.enabled) {
      Object.assign(SLD_SESSION_CACHE, {
        projectId: null,
        selectedProject: null,
        pidFile: null, equipmentFile: null, loadListFile: null,
        provider: 'claude', model: MODELS_BY_PROVIDER.claude[0],
        apiKey: '', keyTestResult: null, scanMode: 'thorough',
        legendsActivatedFromManager: false,
      });
    }
    setHistory([]); setSelectedJobId(null);
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setCreatingProject(true);
    try {
      const { data } = await axios.post(`${API_PREFIX}/projects/`, {
        project_name: newProjectName.trim(), description: newProjectDesc,
      }, { headers: authHeader() });
      setProjects((prev) => [data, ...prev]);
      setShowCreateModal(false);
      setNewProjectName(''); setNewProjectDesc('');
      // Auto-select the new project immediately — same reasoning as
      // PIDVerificationV2.jsx: leaving selectedProject pointing at
      // whatever was open before (or null) reads like the new project
      // either didn't get created or is showing stale content.
      handleSelectProject(data);
    } catch {
      // non-fatal — modal just stays open so the user can retry
    } finally {
      setCreatingProject(false);
    }
  };

  // ── AI Vision API key ──────────────────────────────────────────────────
  // Every field below that's also tracked in SLD_SESSION_CACHE reads that
  // cache as its initial value — same reasoning as ValveMTO's own state
  // block: on a fresh session the cache is still at its defaults, but on
  // a remount within the same tab (returning from Legend Manager) it
  // carries the real in-memory values straight through.
  const [provider, setProvider] = useState(SLD_SESSION_CACHE.enabled ? SLD_SESSION_CACHE.provider : 'claude');
  const [apiKey, setApiKey] = useState(SLD_SESSION_CACHE.enabled ? SLD_SESSION_CACHE.apiKey : '');
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState(() => {
    if (SLD_SESSION_CACHE.enabled && SLD_SESSION_CACHE.model) return SLD_SESSION_CACHE.model;
    const initialProvider = SLD_SESSION_CACHE.enabled ? SLD_SESSION_CACHE.provider : 'claude';
    return MODELS_BY_PROVIDER[initialProvider][0];
  });
  const [testingKey, setTestingKey] = useState(false);
  const [keyTestResult, setKeyTestResult] = useState(SLD_SESSION_CACHE.enabled ? SLD_SESSION_CACHE.keyTestResult : null); // { valid, error }
  // Scan mode is fixed to 'thorough' — the Quick/Thorough toggle was
  // removed from the UI; the state is kept (rather than a bare constant)
  // so the existing write-through-to-cache effect and handleAnalyse's
  // fd.append('scan_mode', scanMode) below need no further changes.
  const [scanMode] = useState('thorough');
  // Step-by-step unlock flow (Stage 3 — Electrical Legend). Restored from
  // the cache the same way as everything else above; only ever actually
  // SET to true by the Legend Manager return-detection effect below,
  // never just because a legend happens to already be active (same
  // "must actually visit Legend Manager" guarantee ValveMTO's own
  // legendsActivatedFromManager enforces).
  const [legendsActivatedFromManager, setLegendsActivatedFromManager] = useState(
    SLD_SESSION_CACHE.enabled ? SLD_SESSION_CACHE.legendsActivatedFromManager : false
  );

  const onProviderChange = (next) => {
    setProvider(next);
    setModel(MODELS_BY_PROVIDER[next][0]);
    setKeyTestResult(null);
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      setKeyTestResult({ valid: false, error: 'Enter an API key first.' });
      return;
    }
    setTestingKey(true);
    setKeyTestResult(null);
    try {
      const { data } = await axios.post(`${API_PREFIX}/test-key/`, { provider, api_key: apiKey.trim() }, { headers: authHeader() });
      setKeyTestResult(data);
    } catch (err) {
      setKeyTestResult(err?.response?.data || { valid: false, error: 'Connection test failed.' });
    } finally {
      setTestingKey(false);
    }
  };

  // ── File uploads ──────────────────────────────────────────────────────
  // pidFile is a real File object — safe to restore from SLD_SESSION_CACHE
  // (plain module memory, no serialization limit) the same way ValveMTO's
  // own pidDocument is, unlike sessionStorage which can't hold one.
  const [pidFile, setPidFile] = useState(SLD_SESSION_CACHE.enabled ? SLD_SESSION_CACHE.pidFile : null);
  const [equipmentFile, setEquipmentFile] = useState(SLD_SESSION_CACHE.enabled ? SLD_SESSION_CACHE.equipmentFile : null);
  const [loadListFile, setLoadListFile] = useState(SLD_SESSION_CACHE.enabled ? SLD_SESSION_CACHE.loadListFile : null);

  // Any combination works except Equipment-only or Load-List-only (see
  // backend's own validation, mirrored here so the button disables BEFORE
  // a doomed request round-trips).
  const hasPid = Boolean(pidFile);
  const hasEquip = Boolean(equipmentFile);
  const hasLoad = Boolean(loadListFile);
  const excelOnlyOneSided = (hasEquip && !hasLoad && !hasPid) || (hasLoad && !hasEquip && !hasPid);

  // ── Stage-flow state — fed into SLD_STAGE_FLOW's isUnlocked/isComplete,
  // same shape/role as ValveMTO's own stageFlowState. ───────────────────
  // BUG FIX (stricter requirement, deliberate): the original canAnalyse
  // (hasPid || (hasEquip && hasLoad)) allowed a P&ID alone — the new
  // stage-flow gate requires AT LEAST 2 FILES always, so canAnalyse was
  // removed rather than kept as an unused, now-looser parallel check.
  const sldStage1Complete = Boolean(
    (pidFile && (equipmentFile || loadListFile)) || (equipmentFile && loadListFile)
  );
  // Stage 2 can only be complete once Stage 1 itself is complete — BUG FIX:
  // previously this ignored sldStage1Complete entirely, so with zero files
  // uploaded (!pidFile is true) it read as auto-complete and showed a green
  // tick before Stage 1 had even been satisfied. Now: Stage 1 incomplete →
  // always false; no P&ID → auto-complete (no AI Vision call needed);
  // P&ID present → requires a tested-valid key.
  const sldStage2Complete = !sldStage1Complete ? false : !pidFile ? true : keyTestResult?.valid === true;
  // Stage 3 complete = legendsActivatedFromManager alone — it only ever
  // becomes true via an actual Legend-Manager round-trip with active
  // legends found (see the mount effect below), never merely because a
  // legend happens to already exist.
  const sldStage3Complete = Boolean(legendsActivatedFromManager);
  const sldStageState = {
    stage1Complete: sldStage1Complete,
    stage2Complete: sldStage2Complete,
    stage3Complete: sldStage3Complete,
  };

  // ── Submit gate (soft-coded; mirrors ValveMTO's own vmStageVerified) ──
  const sldStageVerified = {
    upload: sldStage1Complete,
    engine: sldStage2Complete,
    legend: sldStage3Complete,
  };
  const sldAllStagesVerified = Object.values(sldStageVerified).every(Boolean);

  // Cascade reset — removing a Stage 1 file (pidFile/equipmentFile/
  // loadListFile) can make sldStage1Complete go from true back to false;
  // when that happens, any already-tested Stage 2 key result and any
  // already-activated Stage 3 legend are stale with respect to the NEW
  // (incomplete) file set, so both are cleared here rather than left
  // showing a green tick for a stage whose prerequisite no longer holds.
  // Runs on every pidFile/equipmentFile/loadListFile change, not just on
  // removal, but only ever actually resets anything when sldStage1Complete
  // is currently false, so adding/swapping files while still complete is
  // a no-op.
  useEffect(() => {
    if (!sldStage1Complete) {
      setKeyTestResult(null);
      setLegendsActivatedFromManager(false);
    }
  }, [pidFile, equipmentFile, loadListFile]);

  // Write-through: mirror the live upload-form state into SLD_SESSION_CACHE
  // on every change, so it's always current by the time the user clicks
  // "Activate Legends" (or navigates away for any other reason) — no
  // separate save-on-navigate call needed.
  useEffect(() => {
    if (!SLD_SESSION_CACHE.enabled) return;
    Object.assign(SLD_SESSION_CACHE, {
      projectId: selectedProject?.project_id || null,
      selectedProject,
      pidFile,
      equipmentFile,
      loadListFile,
      provider,
      model,
      apiKey,
      keyTestResult,
      scanMode,
      legendsActivatedFromManager,
    });
  }, [
    selectedProject, pidFile, equipmentFile, loadListFile,
    provider, model, apiKey, keyTestResult, scanMode, legendsActivatedFromManager,
  ]);

  // Legend Manager return detection — consumes SLD_LEGEND_NAV_FLAG (set
  // right before navigating to Legend Manager — see the "Activate
  // Legends" action further down) and, only when it was actually set,
  // re-checks whether an electrical legend is genuinely active before
  // marking Stage 3 complete. BUG FIX (same lesson learned building this
  // exact flow for ValveMTO): blindly trusting the nav flag alone — i.e.
  // setting legendsActivatedFromManager(true) just because the flag was
  // present, without checking real legend state — would let a legend
  // left active from a PREVIOUS visit silently satisfy Stage 3 with no
  // actual activation during THIS round-trip. Verifying via listLegends
  // here closes that gap.
  useEffect(() => {
    const flag = sessionStorage.getItem(SLD_LEGEND_NAV_FLAG);
    if (flag !== '1') return;
    sessionStorage.removeItem(SLD_LEGEND_NAV_FLAG);
    (async () => {
      try {
        const rows = await listLegends('electrical');
        const active = Array.isArray(rows) ? rows.filter((l) => l.is_active) : [];
        setLegendsActivatedFromManager(active.length > 0);
      } catch {
        // non-fatal — legend status just can't be confirmed right now;
        // leave legendsActivatedFromManager as whatever it already was.
      }
    })();
  }, []);

  // ── Analysis state ────────────────────────────────────────────────────
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null); // full upload response
  const [pidFileNameUsed, setPidFileNameUsed] = useState(''); // snapshot — pidFile itself may be cleared on reset

  // BUG FIX: Project Combined View used to be tracked as its own
  // isCombinedView useState, set/reset by hand at every setResults(...)
  // call site. Two async handlers (the upload-poll-completion callback
  // and handleViewCombinedResults) can resolve out of order — e.g. the
  // user opens Combined Results, then quickly clicks "View Results" on
  // a history row before the combined fetch resolves; whichever request
  // wins the race last would clobber the OTHER's isCombinedView value,
  // leaving it permanently (and invisibly) stuck true even though
  // `results` now held a normal single-job payload — which is exactly
  // what disabled the Export button (disabled={... || isCombinedView})
  // on an ordinary analysis, with no way to recover short of a full
  // page reload. Derived from `results` itself instead, so it can never
  // desync: ProjectCombinedResultsView's response always has project_id
  // and never job_id; every single-job response (JobResultsView) always
  // has job_id and never project_id.
  const isCombinedView = Boolean(results?.project_id && !results?.job_id);

  // Real progress — polled from GET /status/<job_id>/ every
  // POLL_INTERVAL_MS while a job is 'processing' (backend now runs the
  // upload as a Celery task instead of inline, so the upload response
  // itself is just a job_id — see handleAnalyse below).
  const [progress, setProgress] = useState(null); // { pagesTotal, pagesDone, currentStage, progressPercentage }
  const [factIndex, setFactIndex] = useState(0);
  // Guards a stale poll loop from a job the user has since abandoned
  // (e.g. clicked "New Analysis" mid-poll) from overwriting state for
  // whatever the NEW job_id is.
  const activePollJobIdRef = useRef(null);
  // When the current poll loop started — used to compute elapsed time
  // for the waiting-message staging and the 20-minute hard ceiling.
  const pollStartTimeRef = useRef(null);

  useEffect(() => {
    if (!analysing) return;
    const id = setInterval(() => setFactIndex((i) => (i + 1) % ELECTRICAL_FACTS.length), 4000);
    return () => clearInterval(id);
  }, [analysing]);

  // Live "Analysis running: Xm Ys" ticker — updates every second
  // independent of the (slower, 3s) poll cadence, purely to force a
  // re-render; the actual elapsed value is always computed fresh from
  // pollStartTimeRef.current, never from this counter's value itself.
  const [, setLiveTick] = useState(0);
  useEffect(() => {
    if (!analysing) return;
    const id = setInterval(() => setLiveTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [analysing]);
  const liveElapsedMs = analysing && pollStartTimeRef.current
    ? Date.now() - pollStartTimeRef.current
    : null;

  // Auto-refresh "Previous Analyses" every 30s while an analysis is in
  // progress — so a job that finishes (or shows up) server-side appears
  // in the list on its own, without the user needing to reload the page
  // or click Refresh manually.
  useEffect(() => {
    if (!analysing || !selectedProject) return;
    const id = setInterval(() => fetchHistory(selectedProject.project_id), 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysing, selectedProject]);

  // `projectId` is taken as an explicit argument (not read from the
  // `selectedProject` closure) so this is safe to call from
  // handleSelectProject right after setSelectedProject(p) — React state
  // updates aren't synchronous, so `selectedProject` inside this
  // function's closure could still be the PREVIOUS project at that point.
  const pollJobStatus = (jobId, projectId) => {
    pollStartTimeRef.current = pollStartTimeRef.current || Date.now();

    const poll = async () => {
      if (activePollJobIdRef.current !== jobId) return; // abandoned — a newer job (or none) is now active

      const elapsedMs = Date.now() - pollStartTimeRef.current;

      try {
        const { data } = await axios.get(`${API_PREFIX}/status/${jobId}/`, { headers: authHeader() });
        if (activePollJobIdRef.current !== jobId) return;

        // FIX 1 — debug visibility into what each poll tick actually
        // returns (current_stage / pages_done / progress_percentage),
        // to confirm whether the backend itself is advancing between
        // polls or whether it's sitting on one value for a long stretch.
        console.log('Poll response:', data);

        setProgress({
          pagesTotal: data.pages_total || 0,
          pagesDone: data.pages_done || 0,
          currentStage: data.current_stage || '',
          progressPercentage: data.progress_percentage,
          elapsedMs,
          waitingMessage: getWaitingMessage(elapsedMs),
        });

        if (data.status === 'completed') {
          // FIX 2 — show 100% + a completion message for a beat instead
          // of the progress panel just vanishing the instant 'completed'
          // arrives. activePollJobIdRef is deliberately NOT cleared yet
          // — the deferred callback below still needs its own
          // "is this still the active job" guard to stay valid.
          setProgress((prev) => ({
            ...(prev || { pagesTotal: 0, pagesDone: 0 }),
            progressPercentage: 100,
            currentStage: 'completed',
          }));
          setTimeout(async () => {
            if (activePollJobIdRef.current !== jobId) return;
            try {
              const { data: resultsData } = await axios.get(`${API_PREFIX}/results/${jobId}/`, { headers: authHeader() });
              if (activePollJobIdRef.current !== jobId) return;
              setPidFileNameUsed(pidFile?.name || '');
              setResults(resultsData);
              setAnalysing(false);
              setProgress(null);
              activePollJobIdRef.current = null;
              pollStartTimeRef.current = null;
              clearActiveJobFromStorage(projectId);
              // New analysis just completed — this project's history
              // list is now stale (missing this run), so refresh it
              // immediately rather than waiting for the user to notice.
              if (projectId) fetchHistory(projectId);
            } catch {
              // The job itself completed, but fetching its results
              // failed — a real error, since there's no further
              // "processing" state left to keep polling for.
              if (activePollJobIdRef.current !== jobId) return;
              setError('Analysis completed, but failed to load results. Please refresh or check Previous Analyses.');
              setAnalysing(false);
              setProgress(null);
              activePollJobIdRef.current = null;
              pollStartTimeRef.current = null;
              clearActiveJobFromStorage(projectId);
            }
          }, 800);
        } else if (data.status === 'failed') {
          // The ONLY other case an error is shown: a REAL failure
          // reported by the backend itself, with a real message — never
          // just because status happens to say 'failed' with nothing to
          // explain it (defensive only; every failure path in tasks.py
          // always sets error_message alongside status='failed', so
          // this is not expected to actually happen in practice).
          if (data.error_message) {
            setError(data.error_message);
          }
          setAnalysing(false);
          setProgress(null);
          activePollJobIdRef.current = null;
          pollStartTimeRef.current = null;
          clearActiveJobFromStorage(projectId);
        } else if (elapsedMs >= POLL_TIMEOUT_MS) {
          // The backend itself still hasn't reported a terminal status
          // after the full 20 minutes — ONLY now is a timeout treated as
          // a failure, never just because wall-clock time since the
          // ORIGINAL start (which matters for a resumed job — see
          // handleSelectProject) has passed 20 minutes while the real
          // status, fetched above, might already be 'completed'.
          if (projectId) fetchHistory(projectId);
          setError('Analysis is taking longer than expected. Check Previous Analyses below for results.');
          setAnalysing(false);
          setProgress(null);
          activePollJobIdRef.current = null;
          pollStartTimeRef.current = null;
          clearActiveJobFromStorage(projectId);
        } else {
          // 'processing' (or any other non-terminal status) — keep
          // polling. Never shown as an error.
          setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch {
        // A network/transient error during polling must NEVER show an
        // error or stop polling — the backend job may still be happily
        // running. Just update the waiting message and retry after a
        // longer delay than the normal cadence, UNLESS we've now also
        // exceeded the 20-minute ceiling with no successful status check
        // at all (so there's genuinely nothing left to show progress
        // against) — same ceiling as the non-terminal-status case above.
        if (activePollJobIdRef.current !== jobId) return;
        if (elapsedMs >= POLL_TIMEOUT_MS) {
          if (projectId) fetchHistory(projectId);
          setError('Analysis is taking longer than expected. Check Previous Analyses below for results.');
          setAnalysing(false);
          setProgress(null);
          activePollJobIdRef.current = null;
          pollStartTimeRef.current = null;
          clearActiveJobFromStorage(projectId);
          return;
        }
        setProgress((prev) => ({
          pagesTotal: prev?.pagesTotal || 0,
          pagesDone: prev?.pagesDone || 0,
          currentStage: prev?.currentStage || '',
          progressPercentage: prev?.progressPercentage ?? null,
          elapsedMs,
          waitingMessage: getWaitingMessage(elapsedMs),
        }));
        setTimeout(poll, POLL_ERROR_RETRY_MS);
      }
    };
    poll();
  };

  const handleAnalyse = async () => {
    if (!sldAllStagesVerified) {
      setError(
        !sldStage1Complete
          ? (excelOnlyOneSided
            ? (hasEquip ? 'Please also upload Load List to compare' : 'Please also upload Equipment List to compare')
            : 'Upload at least 2 files to start (P&ID + one Excel file, or both Excel files).')
          : !sldStage2Complete
            ? 'Enter and test your AI Vision API key (Stage 2) before analysing.'
            : 'Activate an electrical legend in Legend Manager (Stage 3) before analysing.'
      );
      return;
    }
    setError(''); setAnalysing(true); setResults(null);
    setProgress({ pagesTotal: 0, pagesDone: 0, currentStage: 'uploading', progressPercentage: null });
    setFactIndex(0);
    pollStartTimeRef.current = null; // fresh elapsed-time clock for this analysis

    const fd = new FormData();
    if (pidFile) fd.append('pid_file', pidFile);
    if (equipmentFile) fd.append('equipment_list', equipmentFile);
    if (loadListFile) fd.append('load_list', loadListFile);
    fd.append('api_key', apiKey.trim());
    fd.append('provider', provider);
    fd.append('model', model);
    // scanMode is fixed to 'thorough' (toggle removed from the UI) —
    // always sent, same as every other analysis parameter below. Harmless
    // if the backend ignores it (frontend-only addition, no backend
    // wiring confirmed/touched here).
    fd.append('scan_mode', scanMode);
    if (selectedProject) fd.append('project_id', selectedProject.project_id);

    try {
      // Upload normally only validates + enqueues, returning job_id
      // immediately (202) — the actual work (AI Vision, parsing,
      // comparisons) runs in a background Celery task, with progress
      // reported by polling /status/<job_id>/ below, not by this call.
      //
      // CRITICAL: in any environment where Celery runs in EAGER mode
      // (no Redis/broker configured — confirmed true for local dev via
      // config/settings.py's CELERY_TASK_ALWAYS_EAGER), the task runs
      // SYNCHRONOUSLY inside this exact request — the backend doesn't
      // respond until the ENTIRE 3-5+ minute analysis has finished. A
      // short client-side timeout here would then fire this catch block
      // (falsely reporting "Analysis failed") while the backend is
      // still genuinely working — this was the actual root cause of
      // "Analysis failed" appearing during normal processing. The
      // timeout is set to the same 20-minute ceiling used for polling
      // so it's never shorter than the backend's own worst case, in
      // EAGER mode or otherwise; a fast real-worker response (202 in
      // milliseconds) is completely unaffected by raising this.
      const { data } = await axios.post(`${API_PREFIX}/upload/`, fd, {
        headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' },
        timeout: POLL_TIMEOUT_MS,
      });
      const jobId = data.job_id;
      const startedAt = Date.now();
      setSelectedJobId(jobId);
      activePollJobIdRef.current = jobId;
      pollStartTimeRef.current = startedAt;
      // FIX 1 — persist this job so it can be resumed (see
      // handleSelectProject's own resume logic) if the user reloads the
      // page or navigates away and back while it's still running.
      if (selectedProject) saveActiveJobToStorage(selectedProject.project_id, jobId, startedAt);
      pollJobStatus(jobId, selectedProject?.project_id);
    } catch (err) {
      // Even with the generous timeout above, if this request still
      // fails/times out, the job may well have been created and could
      // already be running or even finished server-side (especially
      // under EAGER mode) — refresh history immediately so the user can
      // check for it right away instead of only seeing an error.
      if (selectedProject) fetchHistory(selectedProject.project_id);
      setError(
        err?.response?.data?.error
        || 'Upload is taking longer than expected — the analysis may still be processing in the background. Check Previous Analyses below for results.'
      );
      setAnalysing(false);
      setProgress(null);
    }
  };

  const resetAnalysis = () => {
    activePollJobIdRef.current = null; // cancel any in-flight poll loop
    pollStartTimeRef.current = null;
    // The user is explicitly abandoning whatever job was being tracked
    // for this project — stop offering to resume it later.
    if (selectedProject) clearActiveJobFromStorage(selectedProject.project_id);
    setResults(null); setError(''); setPidFileNameUsed('');
    setPidFile(null); setEquipmentFile(null); setLoadListFile(null);
    setAnalysing(false); setProgress(null);
  };

  // "View Results" on a history row — loads that job's saved results with
  // NO re-upload, same results section the live-analysis flow renders
  // (JobResultsView's response now carries the same comparisons_done /
  // panel_verification shape the upload response does).
  const handleViewResults = async (jobId) => {
    setError('');
    setSelectedJobId(jobId);
    try {
      const { data } = await axios.get(`${API_PREFIX}/results/${jobId}/`, { headers: authHeader() });
      setResults(data);
      setUploadSectionOpen(false);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load this analysis.');
    }
  };

  // Project Combined View — see ProjectCombinedResultsView's own
  // docstring. Reuses the exact same `results` shape/state as a single
  // job (so the existing tab-rendering logic needs no branching), just
  // sourced from a different, project-scoped, read-only endpoint.
  const handleViewCombinedResults = async () => {
    if (!selectedProject) return;
    setError('');
    setSelectedJobId(null);
    setLoadingCombinedView(true);
    try {
      const { data } = await axios.get(
        `${API_PREFIX}/projects/${selectedProject.project_id}/combined-results/`,
        { headers: authHeader() },
      );
      setResults(data);
      setUploadSectionOpen(false);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load combined results.');
    } finally {
      setLoadingCombinedView(false);
    }
  };

  // Project Comment History — see ProjectCommentsView's own docstring.
  const handleViewComments = async () => {
    if (!selectedProject) return;
    if (showComments) {
      setShowComments(false);
      return;
    }
    setShowComments(true);
    if (commentHistory) return; // cached — just re-show
    setLoadingComments(true);
    try {
      const { data } = await axios.get(
        `${API_PREFIX}/projects/${selectedProject.project_id}/comments/`,
        { headers: authHeader() },
      );
      setCommentHistory(data);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load comment history.');
      setShowComments(false);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleDeleteHistoryJob = async (jobId) => {    setHistoryActionBusyId(jobId);
    try {
      await axios.delete(`${API_PREFIX}/results/${jobId}/`, { headers: authHeader() });
      setHistory((prev) => prev.filter((h) => h.job_id !== jobId));
      if (selectedJobId === jobId) {
        setSelectedJobId(null);
        setResults(null);
      }
    } catch {
      // non-fatal — row just stays in the list so the user can retry
    } finally {
      setHistoryActionBusyId(null);
    }
  };

  const handleDownloadHistoryJob = async (job) => {
    setHistoryActionBusyId(job.job_id);
    try {
      const response = await axios.get(`${API_PREFIX}/export/${job.job_id}/`, {
        headers: authHeader(), responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `electrical_comparison_${job.job_id}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Failed to export Excel.');
    } finally {
      setHistoryActionBusyId(null);
    }
  };

  // ── Results view state ────────────────────────────────────────────────
  const comparisonsDone = results?.comparisons_done || [];
  const availableTabs = TAB_ORDER.filter((id) => comparisonsDone.includes(id));
  const [activeTab, setActiveTab] = useState(null);
  // Keep activeTab valid whenever the result set changes (new analysis).
  useEffect(() => {
    if (results && availableTabs.length && (!activeTab || !availableTabs.includes(activeTab))) {
      setActiveTab(availableTabs[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | matched | missing | extra
  const [typeFilter, setTypeFilter] = useState('all');
  const [downloadingTab, setDownloadingTab] = useState(null); // which tab's export is in flight
  const [sortAsc, setSortAsc] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [detailRow, setDetailRow] = useState(null);
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState({ equipmentType: true, description: true, remarks: true });
  const [actionsOpen, setActionsOpen] = useState(false);
  const [uploadSectionOpen, setUploadSectionOpen] = useState(true);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  const activeConfig = activeTab ? TAB_CONFIG[activeTab] : null;
  const showingPanelVerification = activeTab === 'equipment_vs_loadlist' && Boolean(results?.panel_verification);
  const showingCombinedTab = activeTab === 'combined';

  // Reset page/selection whenever the visible data set changes.
  useEffect(() => {
    setCurrentPage(1);
    setSelectedRows(new Set());
  }, [activeTab, search, statusFilter, typeFilter]);

  const filteredPanels = (results?.panel_verification?.panels || []).filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (p.panel_tag || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
  });
  const filteredMotors = (results?.panel_verification?.motors || []).filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (m.motor_tag || '').toLowerCase().includes(q) || (m.description || '').toLowerCase().includes(q);
  });

  const sourceResults = activeConfig ? (results?.results || []).filter((r) => r.source === activeConfig.source) : [];
  const equipmentTypeOptions = Array.from(new Set(sourceResults.map((r) => r.equipment_type).filter(Boolean))).sort();
  let filteredResults = sourceResults.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (typeFilter !== 'all' && r.equipment_type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (r.tag_number || '').toLowerCase().includes(q)
        || (r.description || '').toLowerCase().includes(q)
        || (r.equipment_type || '').toLowerCase().includes(q);
    }
    return true;
  });
  filteredResults = [...filteredResults].sort((a, b) => {
    const cmp = (a.tag_number || '').localeCompare(b.tag_number || '');
    return sortAsc ? cmp : -cmp;
  });
  const totalPages = Math.max(1, Math.ceil(filteredResults.length / PAGE_SIZE));
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageResults = filteredResults.slice(pageStart, pageStart + PAGE_SIZE);

  const downloadExcel = async (tabId) => {
    if (!results?.job_id) return;
    // tabId === 'all' → no source filter: backend returns one workbook with
    // a sheet per comparison (all four options in a single download).
    const exportAll = tabId === 'all';
    const cfg = exportAll ? null : TAB_CONFIG[tabId];
    setDownloadingTab(tabId);
    try {
      const response = await axios.get(`${API_PREFIX}/export/${results.job_id}/`, {
        headers: authHeader(), responseType: 'blob',
        params: exportAll ? {} : { source: cfg.source },
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = exportAll
        ? `electrical_comparison_all_${results.job_id}.xlsx`
        : `${cfg.exportPrefix}_${results.job_id}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Failed to export Excel.');
    } finally {
      setDownloadingTab(null);
    }
  };

  // Client-side Excel export for Combined Results — the combined view has
  // no single job_id (ExportExcelView's backend endpoint requires one,
  // since it reads ElectricalComparisonResult rows via job__project), so
  // there's nothing for downloadExcel() above to call there. This exports
  // the SAME rows the table itself is currently rendering (filteredResults
  // — already merged across every SLD upload in the project, and already
  // filtered by the active tab/search/status/type), entirely in-browser
  // via SheetJS. Column set mirrors the backend export's own
  // (excel_export.py's _TAB_COLUMNS: Tag, Equipment Type, Description,
  // Status, Remarks).
  const downloadExcelClientSide = () => {
    if (!filteredResults.length) return;
    const rows = filteredResults.map((r) => ({
      Tag: r.tag_number || '',
      'Equipment Type': r.equipment_type || '',
      Description: r.description || '',
      Status: r.status || '',
      Remarks: r.remarks || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Electrical Comparison');
    const prefix = activeConfig?.exportPrefix || 'combined_results';
    const projectPart = selectedProject?.project_id || 'project';
    XLSX.writeFile(wb, `${prefix}_combined_${projectPart}.xlsx`);
  };

  // "View on Drawing" canvas viewer — replaces the old "Download
  // Annotated PDF" button. Fetches each P&ID/SLD page as a PNG plus the
  // comparison-result tag boxes (image-pixel coordinates) from the
  // backend's AnnotatedPagesView (apps.electrical_comparison.views),
  // then draws color-coded highlights on a <canvas> per page — same
  // matched=green/missing=red/extra=yellow semantics as the old
  // annotated PDF, but interactive (status toggles) and nothing to
  // download. Only ever available for a single job (results.job_id),
  // never Combined Results; results.has_pid_file gates the button.
  const [annotatedPages, setAnnotatedPages] = useState(null);
  const [loadingAnnotatedPages, setLoadingAnnotatedPages] = useState(false);
  const [showCanvasViewer, setShowCanvasViewer] = useState(false);
  const [canvasStatusFilter, setCanvasStatusFilter] = useState({ matched: true, missing: true, extra: true, located: true });
  const toggleCanvasViewer = async () => {
    if (!results?.job_id) return;
    if (showCanvasViewer) {
      setShowCanvasViewer(false);
      return;
    }
    setShowCanvasViewer(true);
    if (annotatedPages) return; // already fetched — just re-show
    setLoadingAnnotatedPages(true);
    try {
      const { data } = await axios.get(`${API_PREFIX}/jobs/${results.job_id}/annotated-pages/`, {
        headers: authHeader(),
        timeout: 300000, // rendering every page server-side can take a while on big drawings
      });
      setAnnotatedPages(data.documents || {});
    } catch {
      setError('Failed to load the annotated drawing viewer.');
      setShowCanvasViewer(false);
    } finally {
      setLoadingAnnotatedPages(false);
    }
  };

  // AI Vision only ran when a P&ID was part of this analysis — used to
  // decide whether to show the "Tags Found in P&ID" / "Provider Used"
  // cards and the P&ID-only extracted-tags card at all.
  const pidWasUsed = Boolean(results?.model) || comparisonsDone.some((c) => c.startsWith('pid_')) || Boolean(results?.pid_tags);
  const pidOnlyNoComparison = Boolean(results?.pid_tags) && comparisonsDone.length === 0;
  // A P&ID-only analysis (no Equipment/Load List) never saves any
  // ElectricalComparisonResult rows — there's nothing to compare, so
  // nothing to persist. Re-opening one from history therefore has no
  // comparisons_done AND no pid_tags (that raw list was only ever in the
  // original upload response, never written to the DB) — shown as an
  // honest "nothing was saved" message rather than a blank results panel.
  const historicalNoDataSaved = Boolean(results) && Boolean(selectedJobId) && comparisonsDone.length === 0 && !pidOnlyNoComparison;

  // Stats bar — scoped to the currently active tab's data (same scope as
  // the table below it), same generic Total/Matched/Missing/Extra shape
  // required by the design spec regardless of which tab is active.
  let tabStats = { total: 0, matched: 0, missing: 0, extra: 0 };
  if (showingCombinedTab && results?.combined_comparison) {
    // Tab 4's own summary shape (Total / Fully Matched / Partial /
    // Single Source) — read directly from the backend's exact counts
    // rather than re-deriving them client-side, since
    // _build_combined_comparison already computed them from real
    // set-membership (never guessed — see its own docstring).
    const cc = results.combined_comparison;
    tabStats = {
      total: cc.total,
      matched: cc.fully_matched,
      missing: cc.partial,
      extra: cc.single_source,
    };
  } else if (showingPanelVerification && results?.panel_verification) {
    const pv = results.panel_verification;
    // Tab 3's own 3 metrics (Panels Verified / Panels No Load List /
    // Total Motors) — panels_no_load_list isn't a precomputed backend
    // count, so it's derived here from the panels array itself.
    const panelsNoLoadList = pv.panels.filter((p) => p.status === 'panel_no_load_list').length;
    tabStats = {
      total: pv.panels.length + pv.motors.length,
      matched: pv.counts.panels_verified,
      missing: panelsNoLoadList,
      extra: pv.counts.total_motors,
    };
  } else if (sourceResults.length) {
    // "Total Tags" = every DISTINCT tag across BOTH sides of this
    // comparison (matched + missing + extra + any other status the
    // backend saved), not a raw row count or a findings-only count —
    // the backend now always saves one row per unique tag (including
    // clean matches, which the comparison engine itself never produced
    // a row for before), so this is simply the number of unique
    // tag_number values present.
    tabStats = {
      total: new Set(sourceResults.map((r) => r.tag_number)).size,
      matched: sourceResults.filter((r) => r.status === 'matched').length,
      missing: sourceResults.filter((r) => r.status === 'missing').length,
      extra: sourceResults.filter((r) => r.status === 'extra').length,
    };
  }

  // Per-tab stat-card labels — each comparison answers a genuinely
  // different question, so the generic "Total/Matched/Missing/Extra"
  // wording doesn't fit all 4 tabs equally well.
  const statCardLabels = (() => {
    if (showingCombinedTab) {
      return {
        total: 'Total Unique Tags', matched: 'Fully Matched (all 3 files)',
        missing: 'Partial (2 of 3 files)', extra: 'Single Source (1 file only)',
      };
    }
    if (showingPanelVerification) {
      return { total: 'Total Items', matched: 'Panels Verified', missing: 'Panels No Load List', extra: 'Total Motors' };
    }
    if (activeTab === 'pid_vs_equipment') {
      // BUG FIX: 'total' here is matched+missing+extra UNIONED across
      // BOTH sides of this comparison (tabStats.total, below) — it was
      // mislabeled 'P&ID Tags Found', which it is NOT: 'extra' rows are
      // tags that exist ONLY in the Equipment List, never seen on the
      // P&ID at all, so that label overcounted. The genuine "found on
      // the P&ID" number is results.pid_tags_found (a real backend
      // count — see _derive_pid_tags_found in views.py), shown as its
      // own separate stat card now instead of reusing this one.
      return { total: 'Total Tags (Both Sides)', matched: 'Matched with Equipment List', missing: 'Missing from P&ID', extra: 'Extra in P&ID' };
    }
    if (activeTab === 'pid_vs_loadlist') {
      return { total: 'Total Tags (Both Sides)', matched: 'Matched with Load List', missing: 'Missing from P&ID', extra: 'Extra in P&ID' };
    }
    return { total: 'Total Tags', matched: 'Matched', missing: 'Missing', extra: 'Extra' };
  })();

  const allOnPageSelected = pageResults.length > 0 && pageResults.every((_, i) => selectedRows.has(pageStart + i));
  const toggleSelectAllOnPage = () => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        pageResults.forEach((_, i) => next.delete(pageStart + i));
      } else {
        pageResults.forEach((_, i) => next.add(pageStart + i));
      }
      return next;
    });
  };
  const toggleSelectRow = (idx) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const startNewAnalysis = () => {
    setActionsOpen(false);
    setDetailRow(null);
    setSelectedJobId(null);
    setUploadSectionOpen(true);
    resetAnalysis();
  };

  // Most recent analysis across ALL projects, for the project-selection
  // screen's stats bar — derived from projectStats (never fabricated);
  // null until fetchProjectStats resolves or if no project has ever run one.
  const overallLastAnalysisAt = Object.values(projectStats).reduce((latest, s) => {
    if (!s.lastAnalysisAt) return latest;
    const d = new Date(s.lastAnalysisAt);
    return !latest || d > latest ? d : latest;
  }, null);

  const filteredHistory = history
    .filter((h) => {
      if (historyStatusFilter !== 'all' && h.status !== historyStatusFilter) return false;
      if (historySearch) {
        const q = historySearch.toLowerCase();
        return (h.pid_file_name || '').toLowerCase().includes(q) || h.job_id.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      const diff = new Date(b.created_at) - new Date(a.created_at);
      return historySort === 'newest' ? diff : -diff;
    });

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f8faff 0%, #eef2ff 45%, #f0f9ff 75%, #fffbeb 100%)', fontFamily: FONT_STACK }}>
      <div className="w-full px-2 sm:px-4 lg:px-6 py-6 space-y-4 relative">
        <div className="pointer-events-none absolute -top-10 -left-10 w-72 h-72 rounded-full blur-3xl" style={{ background: 'rgba(59,130,246,0.12)' }} aria-hidden="true" />
        <div className="pointer-events-none absolute top-20 right-0 w-80 h-80 rounded-full blur-3xl" style={{ background: 'rgba(99,102,241,0.12)' }} aria-hidden="true" />

        {/* ───────────────────────── TOP HEADER ───────────────────────── */}
        <section className="relative rounded-2xl border border-slate-200 bg-white/85 backdrop-blur shadow-lg">
          {/* Decorative blur layer clipped to the card's rounded corners —
              kept in its own overflow-hidden wrapper (rather than on the
              section itself) so the Actions dropdown below, which is
              absolutely positioned and can extend past the card's edge,
              is never clipped along with it. */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" aria-hidden="true">
            <div className="absolute -left-20 -top-24 w-72 h-72 rounded-full bg-blue-200/35 blur-3xl" />
            <div className="absolute -right-24 -bottom-20 w-80 h-80 rounded-full bg-indigo-200/30 blur-3xl" />
          </div>
          <div className="relative px-6 py-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
                <Zap className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-blue-200 bg-white/70 text-xs font-semibold text-blue-700 mb-1">
                  <Sparkles className="w-3 h-3" /> Engineering · Electrical
                </div>
                <h1 className="text-2xl font-bold truncate">
                  <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
                    Electrical Equipment Comparison
                  </span>
                </h1>
                <p className="text-sm text-slate-600 max-w-3xl mt-1 truncate">
                  {selectedProject
                    ? `${selectedProject.project_name}${selectedProject.description ? ' — ' + selectedProject.description : ''}`
                    : 'Manage your electrical comparison projects'}
                </p>
                {!selectedProject && (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                      <FolderPlus className="w-3 h-3" />
                      {projects.length} {projects.length === 1 ? 'Project' : 'Projects'}
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                      <Calendar className="w-3 h-3" />
                      Last Analysis: {overallLastAnalysisAt ? overallLastAnalysisAt.toLocaleDateString() : 'None yet'}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {results?.job_id && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50">
                  <span className="text-[11px] font-mono text-slate-500">
                    {results.job_id.slice(0, 8)}…
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${results.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}
                  >
                    {results.status || 'pending'}
                  </span>
                </div>
              )}

              {selectedProject && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setActionsOpen((o) => !o)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-sm"
                  >
                    Actions <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  {actionsOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setActionsOpen(false)} />
                      <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-slate-200 bg-white shadow-xl z-50 overflow-hidden">
                        <button
                          type="button"
                          onClick={startNewAnalysis}
                          className="w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-2 text-indigo-600 hover:bg-slate-50"
                        >
                          <Plus className="w-4 h-4" /> New Analysis
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <div className="max-w-[95vw] mx-auto px-6 py-6">
        {!selectedProject ? (
          /* ─────────────────── Project Selection Screen ─────────────────── */
          <div className="space-y-5 -mx-6 -mt-6 px-6 pt-6 pb-10" style={{ background: PS.bg, minHeight: 'calc(100vh - 73px)' }}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-bold" style={{ color: PS.textPrimary }}>Electrical Comparison Projects</h2>
                <p className="text-sm mt-0.5" style={{ color: PS.textSecondary }}>
                  {projects.length} {projects.length === 1 ? 'project' : 'projects'} total
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="text-sm font-semibold px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg hover:from-indigo-700 hover:to-blue-700 flex items-center gap-1.5 shadow-sm flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
                New Project
              </button>
            </div>

            {loadingProjects ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <Loader className="w-8 h-8 animate-spin" style={{ color: PS.primary }} />
                <p className="text-sm" style={{ color: PS.textSecondary }}>Loading projects…</p>
              </div>
            ) : projects.length === 0 ? (
              /* ── Empty state ── */
              <div className="rounded-xl py-20 px-8 text-center" style={{ background: '#fff', border: `1px solid ${PS.cardBorder}` }}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: PS.primarySoft }}>
                  <Zap className="w-8 h-8" style={{ color: PS.primary }} />
                </div>
                <h3 className="text-lg font-bold mb-1.5" style={{ color: PS.textPrimary }}>No projects yet</h3>
                <p className="text-sm max-w-sm mx-auto mb-6" style={{ color: PS.textSecondary }}>
                  Create your first electrical comparison project to get started
                </p>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg hover:from-indigo-700 hover:to-blue-700 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Create Project
                </button>
              </div>
            ) : (
              /* ── Project cards grid ── */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {projects.map((p) => {
                  const stats = projectStats[p.project_id] || {};
                  return (
                    <div
                      key={p.project_id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectProject(p)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSelectProject(p); }}
                      className="group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-200"
                      style={{
                        background: '#fff',
                        border: `1px solid ${PS.cardBorder}`,
                        borderLeft: `4px solid ${PS.primary}`,
                        boxShadow: '0 1px 2px rgba(15,23,42,0.05)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 16px 28px -10px rgba(15,23,42,0.18)';
                        e.currentTarget.style.transform = 'translateY(-3px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = '0 1px 2px rgba(15,23,42,0.05)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: PS.primary }}>
                              <Zap className="w-5 h-5 text-white" />
                            </div>
                            <h3 className="text-base font-bold truncate" style={{ color: PS.textPrimary }}>{p.project_name}</h3>
                          </div>
                          <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setProjectMenuOpenId((id) => (id === p.project_id ? null : p.project_id))}
                              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                              <MoreVertical className="w-4 h-4" style={{ color: PS.textSecondary }} />
                            </button>
                            {projectMenuOpenId === p.project_id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setProjectMenuOpenId(null)} />
                                <div
                                  className="absolute right-0 top-full mt-1 w-36 rounded-lg border shadow-xl z-50 overflow-hidden"
                                  style={{ background: '#fff', borderColor: PS.cardBorder }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => openRenameModal(p)}
                                    className="w-full text-left px-3.5 py-2.5 text-sm font-medium flex items-center gap-2 hover:bg-slate-50"
                                    style={{ color: PS.textPrimary }}
                                  >
                                    <Pencil className="w-3.5 h-3.5" /> Rename
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openDeleteModal(p)}
                                    className="w-full text-left px-3.5 py-2.5 text-sm font-medium flex items-center gap-2 hover:bg-red-50"
                                    style={{ color: PS.danger }}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Delete
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {p.description && (
                          <p className="text-xs mb-3 line-clamp-2" style={{ color: PS.textSecondary }}>{p.description}</p>
                        )}

                        <div className="space-y-1.5 mb-4 pb-4 border-b" style={{ borderColor: PS.cardBorder }}>
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5" style={{ color: PS.textSecondary }}>
                              <Calendar className="w-3 h-3" /> Created
                            </span>
                            <span className="font-semibold" style={{ color: PS.textPrimary }}>
                              {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5" style={{ color: PS.textSecondary }}>
                              <Calendar className="w-3 h-3" /> Last Analysis
                            </span>
                            <span className="font-semibold" style={{ color: PS.textPrimary }}>
                              {stats.lastAnalysisAt ? new Date(stats.lastAnalysisAt).toLocaleDateString() : 'None yet'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5" style={{ color: PS.textSecondary }}>
                              <BarChart3 className="w-3 h-3" /> Analyses
                            </span>
                            <span className="font-semibold" style={{ color: PS.textPrimary }}>{stats.count ?? 0}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleSelectProject(p); }}
                          className="w-full flex items-center justify-center gap-1.5 text-white text-sm font-semibold py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"
                        >
                          Open Project <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* ── Back button + active project name ── */}
            <div className="flex items-center gap-3 mb-5">
              <button
                type="button"
                onClick={handleBackToProjects}
                className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg px-3 py-2 bg-white hover:bg-slate-50 flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Projects
              </button>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <Folder className="w-5 h-5 text-indigo-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 truncate">
                {selectedProject?.project_name || 'Unassigned'}
              </h2>
            </div>

            {error && !results && (
              <div className="mb-5 rounded-lg border p-4 flex items-start gap-3" style={{ background: C.errorBg, borderColor: C.errorBorder }}>
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: C.error }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: '#991b1b' }}>{error}</p>
                  {/* The analysis may genuinely have completed server-side
                      even though this message is showing (e.g. it was
                      still running when the 20-minute ceiling or a slow
                      upload request gave up on it) — a one-click way to
                      check, right here, instead of requiring the user to
                      already know to scroll down to Previous Analyses. */}
                  <button
                    type="button"
                    onClick={() => selectedProject && fetchHistory(selectedProject.project_id)}
                    className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg border"
                    style={{ borderColor: C.errorBorder, color: C.error, background: '#fff' }}
                  >
                    Check Results
                  </button>
                </div>
              </div>
            )}

            {/* ───────────────────────── UPLOAD SECTION (collapsible) ───────────────────────── */}
            {(!results || uploadSectionOpen) && (
              <div className="rounded-lg border mb-6" style={{ borderColor: C.border }}>
                <button
                  type="button"
                  onClick={() => results && setUploadSectionOpen((o) => !o)}
                  className="w-full flex items-center justify-between px-5 py-3.5"
                  style={{ cursor: results ? 'pointer' : 'default' }}
                >
                  <span className="text-sm font-bold" style={{ color: C.textPrimary }}>New Analysis</span>
                  {results && (uploadSectionOpen ? <ChevronUp className="w-4 h-4" style={{ color: C.textSecondary }} /> : <ChevronDown className="w-4 h-4" style={{ color: C.textSecondary }} />)}
                </button>

                <div className="px-5 pb-5 space-y-5 border-t" style={{ borderColor: C.border }}>
                  {/* ── Stage 1 · Upload Files — always unlocked ── */}
                  <div className="pt-5">
                    <SldStageHeading stage={SLD_STAGE_FLOW[0]} unlocked complete={sldStageVerified.upload} colourClass="bg-blue-100 text-blue-700" />
                    <SldStageInstruction stage={SLD_STAGE_FLOW[0]} />
                    <p className="text-xs mb-4 flex items-center gap-1.5" style={{ color: C.textSecondary }}>
                      <Info className="w-3.5 h-3.5 flex-shrink-0" />
                      Upload at least 2 files to start
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <UploadBox
                        label="P&ID Drawing (PDF)" icon={FileText} accept=".pdf"
                        file={pidFile} onSelect={setPidFile} onRemove={() => setPidFile(null)}
                      />
                      <UploadBox
                        label="Equipment List (Excel or PDF)" icon={Table} accept=".xlsx,.pdf"
                        file={equipmentFile} onSelect={setEquipmentFile} onRemove={() => setEquipmentFile(null)}
                      />
                      <UploadBox
                        label="Load List (Excel or PDF)" icon={Table} accept=".xlsx,.pdf"
                        file={loadListFile} onSelect={setLoadListFile} onRemove={() => setLoadListFile(null)}
                      />
                    </div>

                    {/* ── CHANGE 2 — tab preview, derived from the SAME
                        hasPid/hasEquip/hasLoad combination tasks.py's own
                        comparisons_done logic uses, so a chip is only ever
                        shown for a tab that will actually be generated. ── */}
                    {(hasPid || hasEquip || hasLoad) && (() => {
                      const tabChips = [];
                      if (hasPid && hasEquip) tabChips.push('P&ID vs Equipment List tab');
                      if (hasPid && hasLoad) tabChips.push('P&ID vs Load List tab');
                      if (hasEquip && hasLoad) tabChips.push('Equipment vs Load List tab');
                      if (hasPid && hasEquip && hasLoad) tabChips.push('Full Comparison tab (all 3)');
                      if (tabChips.length === 0) return null;
                      return (
                        <div className="mt-4 flex items-center gap-2 flex-wrap">
                          <span
                            className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                            style={{ background: C.header, color: '#fff' }}
                          >
                            📊 {tabChips.length} tab{tabChips.length === 1 ? '' : 's'} will be generated
                          </span>
                          {tabChips.map((label) => (
                            <span
                              key={label}
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                              style={{ background: C.primarySoft, color: C.primary, border: '1px solid #bfdbfe' }}
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      );
                    })()}

                    {error && results && (
                      <div className="mt-4 rounded-lg p-4 flex items-start gap-3" style={{ background: C.errorBg, border: `1px solid ${C.errorBorder}` }}>
                        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: C.error }} />
                        <p className="text-sm" style={{ color: '#991b1b' }}>{error}</p>
                      </div>
                    )}
                  </div>

                  {/* ── Stage 2 · RADAI AI Engine (gated) — only functionally
                      required when a P&ID was uploaded; auto-completes
                      otherwise (see sldStage2Complete above). ── */}
                  {!SLD_STAGE_FLOW[1].isUnlocked(sldStageState) ? (
                    <SldStageGate stage={SLD_STAGE_FLOW[1]} />
                  ) : (
                    <div>
                      <SldStageHeading stage={SLD_STAGE_FLOW[1]} unlocked complete={sldStageVerified.engine} colourClass="bg-cyan-100 text-cyan-700" />
                      {!pidFile ? (
                        <div className="rounded-lg p-4 flex items-center gap-3" style={{ background: C.successBg, border: `1px solid ${C.successBorder}` }}>
                          <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: C.success }} />
                          <p className="text-sm font-semibold" style={{ color: '#166534' }}>
                            ✅ No P&ID uploaded — AI Engine not required. Stage complete.
                          </p>
                        </div>
                      ) : (
                        <>
                          <SldStageInstruction stage={SLD_STAGE_FLOW[1]} actions={[{
                            label: 'Raise a ticket with ICT',
                            onClick: () => {
                              // See SLD_ICT_RETURN_PROJECT_KEY's own comment above —
                              // ICT opens in a new tab, so the project has to be
                              // handed over via sessionStorage, not SLD_SESSION_CACHE.
                              if (selectedProject?.project_id) {
                                sessionStorage.setItem(SLD_ICT_RETURN_PROJECT_KEY, selectedProject.project_id);
                              }
                              window.open(SLD_ICT_ROUTE, '_blank', 'noopener,noreferrer');
                            },
                          }]} />

                          {/* ── Collapsible "How it works" info box ── */}
                          <button
                            type="button"
                            onClick={() => setHowItWorksOpen((o) => !o)}
                            className="flex items-center gap-1.5 text-xs font-semibold mb-3"
                            style={{ color: C.primary }}
                          >
                            <Info className="w-3.5 h-3.5" />
                            ℹ️ How it works
                            {howItWorksOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                          {howItWorksOpen && (
                            <div className="rounded-lg p-4 mb-4 text-xs space-y-3" style={{ background: C.primarySoft, border: `1px solid #bfdbfe` }}>
                              <div>
                                <p className="font-bold mb-1.5" style={{ color: C.textPrimary }}>When do you need AI Vision?</p>
                                <p className="mb-1" style={{ color: C.textPrimary }}>
                                  ⚡ P&ID Drawing uploaded → AI Vision reads the drawing to extract tags <span className="font-semibold">(requires API key)</span>
                                </p>
                                <p style={{ color: C.textPrimary }}>
                                  📊 Equipment List + Load List only → No AI Vision needed, completely <span className="font-semibold">FREE</span>
                                </p>
                              </div>
                              <div>
                                <p className="font-bold mb-1.5" style={{ color: C.textPrimary }}>For best results upload all 3 files:</p>
                                <p style={{ color: C.textPrimary }}>✅ P&ID Drawing — extracts all equipment tags</p>
                                <p style={{ color: C.textPrimary }}>✅ Equipment List — validates panels/switchboards</p>
                                <p style={{ color: C.textPrimary }}>✅ Load List — validates motors/pumps</p>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-semibold mb-1" style={{ color: C.textSecondary }}>Provider</label>
                              <select
                                value={provider}
                                onChange={(e) => onProviderChange(e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 text-sm"
                                style={{ borderColor: C.greyBorder }}
                              >
                                <option value="claude">Claude</option>
                                <option value="openai">OpenAI</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold mb-1" style={{ color: C.textSecondary }}>Model</label>
                              <select
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 text-sm"
                                style={{ borderColor: C.greyBorder }}
                              >
                                {MODELS_BY_PROVIDER[provider].map((m) => <option key={m} value={m}>{MODEL_LABELS[m] || m}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="mt-4">
                            <label className="block text-xs font-semibold mb-1" style={{ color: C.textSecondary }}>API Key</label>
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <input
                                  type={showKey ? 'text' : 'password'}
                                  value={apiKey}
                                  onChange={(e) => {
                                    const next = e.target.value;
                                    setApiKey(next);
                                    setKeyTestResult(null);
                                    // Cascade reset — an already-activated Stage 3
                                    // legend was gated on the key that just got
                                    // cleared; it's stale the moment the key is
                                    // emptied out, same reasoning as the file-removal
                                    // cascade effect above.
                                    if (!next.trim()) setLegendsActivatedFromManager(false);
                                  }}
                                  placeholder={provider === 'claude' ? 'sk-ant-...' : 'sk-...'}
                                  className="w-full border rounded-lg px-3 py-2 pr-9 text-sm font-mono"
                                  style={{ borderColor: C.greyBorder }}
                                />
                                <button type="button" onClick={() => setShowKey(s => !s)}
                                  className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: C.textSecondary }}>
                                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={handleTestConnection}
                                disabled={testingKey}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
                                style={{ background: C.header, color: '#fff' }}
                              >
                                {testingKey ? <Loader className="w-4 h-4 animate-spin" /> : null}
                                Test Connection
                              </button>
                            </div>
                            {(() => {
                              // Notification states, built from THIS file's
                              // real testingKey/apiKey/keyTestResult shape
                              // (an object { valid, error }, not ValveMTO's
                              // own single string-status field) — same 4
                              // states requested, adapted to the state
                              // already in this file rather than
                              // introducing a parallel representation.
                              let display;
                              if (testingKey) display = { icon: '🔄', text: 'Testing...', cls: 'text-slate-500' };
                              else if (keyTestResult?.valid === true) display = { icon: '✅', text: 'Connected', cls: 'text-emerald-700' };
                              else if (keyTestResult && keyTestResult.valid === false) display = { icon: '❌', text: keyTestResult.error || 'Invalid API key', cls: 'text-red-700' };
                              else if (!apiKey.trim()) display = { icon: '⚠️', text: 'Please enter API key', cls: 'text-amber-600' };
                              else display = { icon: '○', text: 'Not tested yet', cls: 'text-slate-400' };
                              return (
                                <p role="status" className={`mt-2 text-xs font-semibold flex items-center gap-1.5 ${display.cls}`}>
                                  <span className={testingKey ? 'inline-block animate-spin' : 'inline-block'}>{display.icon}</span>
                                  {display.text}
                                </p>
                              );
                            })()}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* ── Stage 3 · Electrical Legend (gated, required) ── */}
                  {!SLD_STAGE_FLOW[2].isUnlocked(sldStageState) ? (
                    <SldStageGate stage={SLD_STAGE_FLOW[2]} />
                  ) : (
                    <div>
                      <SldStageHeading stage={SLD_STAGE_FLOW[2]} unlocked complete={sldStageVerified.legend} colourClass="bg-indigo-100 text-indigo-700" />

                      {/* Legend Sheets banner — title/subtitle + active-
                          indicator dot row only, same teal/blue gradient
                          as IOListWorkflowPage's own Legend section. The
                          "Activate Legends" button itself now lives below
                          the USER INSTRUCTION box (same Stage-card layout
                          ValveMTO's own Stage 3 uses), not in this banner. */}
                      <div className="rounded-2xl border border-slate-200 bg-white/85 backdrop-blur-sm shadow-[0_8px_24px_rgba(15,23,42,0.08)] overflow-hidden mb-4">
                        <div className="bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 px-5 py-4 rounded-t-2xl flex items-center gap-3 text-white">
                          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold">Electrical Legend Sheets</h3>
                            <p className="text-xs text-white/80">Tag-format rules applied when extracting SLD tags</p>
                          </div>
                        </div>
                        {legendsActivatedFromManager && (
                          <div className="px-5 py-3 flex items-center gap-2 text-sm">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="font-medium text-slate-900">Custom Legend Active</span>
                          </div>
                        )}
                      </div>

                      <SldStageInstruction
                        stage={SLD_STAGE_FLOW[2]}
                        actions={[
                          {
                            label: 'Activate Legends',
                            onClick: () => {
                              // Set BEFORE navigating — a plain boolean
                              // survives sessionStorage across the
                              // unmount/remount this route change causes;
                              // consumed by the mount effect above.
                              sessionStorage.setItem(SLD_LEGEND_NAV_FLAG, '1');
                              navigate(SLD_LEGEND_MANAGER_ROUTE);
                            },
                          },
                          {
                            label: 'Raise a Request (ICT)',
                            onClick: () => {
                              // See SLD_ICT_RETURN_PROJECT_KEY's own comment above —
                              // ICT opens in a new tab, so the project has to be
                              // handed over via sessionStorage, not SLD_SESSION_CACHE.
                              if (selectedProject?.project_id) {
                                sessionStorage.setItem(SLD_ICT_RETURN_PROJECT_KEY, selectedProject.project_id);
                              }
                              window.open(SLD_ICT_ROUTE, '_blank', 'noopener,noreferrer');
                            },
                          },
                        ]}
                      />
                    </div>
                  )}

                  {/* ── Submit gate checklist — same role as ValveMTO's own
                      VM_SUBMIT_GATE checklist ── */}
                  {!sldAllStagesVerified && (
                    <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Verify each step to enable analysis:
                      </p>
                      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
                        {SLD_SUBMIT_GATE_STAGES.map(s => (
                          <li key={s.id} className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${sldStageVerified[s.id] ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {sldStageVerified[s.id]
                              ? <CheckCircle className="h-3.5 w-3.5" />
                              : <span className="inline-block h-3.5 w-3.5 rounded-full border border-slate-300" />}
                            {s.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* File Upload — action row */}
                  <div>
                    <div className="mt-5">
                      <button
                        type="button"
                        onClick={handleAnalyse}
                        disabled={!sldAllStagesVerified || analysing}
                        title={!sldAllStagesVerified ? 'Verify each step above before analysing.' : ''}
                        className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-white rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {analysing ? (
                          <>
                            <Loader className="w-5 h-5 animate-spin" />
                            Analysing...
                          </>
                        ) : (
                          <>
                            <UploadIcon className="w-5 h-5" />
                            Analyse Drawing
                          </>
                        )}
                      </button>

                      {/* ── Real progress screen — polled from
                          GET /status/<job_id>/ every POLL_INTERVAL_MS
                          while the Celery task runs (see tasks.py's
                          STAGE_* constants / pollJobStatus above).
                          Never shows an error while 'processing' — only
                          a real backend 'failed' status or the 20-minute
                          poll ceiling does that (see pollJobStatus). ── */}
                      {analysing && (
                        <div className="mt-4 rounded-lg border p-5" style={{ borderColor: C.border, background: C.greyBg }}>
                          <div className="flex items-center justify-between mb-2 gap-3">
                            <span className="text-sm font-semibold" style={{ color: C.textPrimary }}>
                              {getStageLabel(progress?.currentStage, progress?.pagesDone, progress?.pagesTotal, liveElapsedMs ?? progress?.elapsedMs ?? 0)}
                            </span>
                            {progress && (
                              <span className="text-sm font-bold flex-shrink-0" style={{ color: C.primary }}>
                                {getProgressBarPercentage(progress, liveElapsedMs ?? progress?.elapsedMs ?? 0)}%
                              </span>
                            )}
                          </div>
                          <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: '#e5e7eb' }}>
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${getProgressBarPercentage(progress, liveElapsedMs ?? progress?.elapsedMs ?? 0)}%`,
                                background: C.primary,
                              }}
                            />
                          </div>
                          {progress?.currentStage === 'ai_vision' && progress?.pagesTotal > 0 && (
                            <p className="text-xs mt-2" style={{ color: C.textSecondary }}>
                              Analysing page {progress.pagesDone} of {progress.pagesTotal}
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-3 gap-3">
                            <p className="text-xs font-medium" style={{ color: C.textPrimary }}>
                              {getWaitingMessage(liveElapsedMs ?? progress?.elapsedMs ?? 0)}
                            </p>
                            {liveElapsedMs != null && (
                              <span className="text-xs font-mono flex-shrink-0" style={{ color: C.textSecondary }}>
                                Analysis running: {formatElapsedTime(liveElapsedMs)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs mt-2 italic" style={{ color: C.textSecondary }}>
                            💡 {ELECTRICAL_FACTS[factIndex]}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ───────────────────────── COMMENT HISTORY (per-tag lifecycle across SLD uploads) ───────────────────────── */}
            {showComments && commentHistory && (
              <div className="rounded-lg border mb-6" style={{ borderColor: C.border }}>
                <div className="px-5 py-3.5 border-b flex items-center justify-between gap-3" style={{ borderColor: C.border }}>
                  <span className="text-sm font-bold" style={{ color: C.textPrimary }}>
                    Comment History — {commentHistory.summary.open} open · {commentHistory.summary.resolved} killed · {commentHistory.summary.jobs_analysed} SLD(s) analysed
                  </span>
                </div>
                <div className="p-4 space-y-4">
                  {commentHistory.summary.total_comments === 0 && (
                    <p className="text-sm" style={{ color: C.textSecondary }}>
                      No discrepancy comments yet — every comparison so far came back clean.
                    </p>
                  )}

                  {commentHistory.open_comments.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#dc2626' }}>
                        🔴 Open comments ({commentHistory.open_comments.length})
                      </p>
                      <div className="space-y-2">
                        {commentHistory.open_comments.map((c, i) => (
                          <div key={i} className="rounded-lg border-l-4 px-3 py-2 text-sm" style={{ borderColor: '#dc2626', background: '#fef2f2' }}>
                            <span className="font-bold">{c.tag_number}</span>
                            <span className="mx-2 px-1.5 py-0.5 rounded text-[10px] font-bold text-white" style={{ background: '#dc2626' }}>{c.issue.replace(/_/g, ' ').toUpperCase()}</span>
                            {c.reopen_count > 0 && <span className="mr-2 text-[10px] font-semibold" style={{ color: '#b91c1c' }}>(re-opened ×{c.reopen_count})</span>}
                            <span style={{ color: C.textSecondary }}>{c.description}</span>
                            <div className="text-xs mt-0.5" style={{ color: C.textSecondary }}>
                              Raised by <b>{c.opened_in.file}</b> · {new Date(c.opened_in.at).toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {commentHistory.resolved_comments.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#16a34a' }}>
                        ✅ Killed comments ({commentHistory.resolved_comments.length})
                      </p>
                      <div className="space-y-2">
                        {commentHistory.resolved_comments.map((c, i) => (
                          <div key={i} className="rounded-lg border-l-4 px-3 py-2 text-sm" style={{ borderColor: '#16a34a', background: '#f0fdf4' }}>
                            <span className="font-bold">{c.tag_number}</span>
                            <span className="mx-2 px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: '#dcfce7', color: '#166534' }}>{c.issue.replace(/_/g, ' ').toUpperCase()}</span>
                            <span style={{ color: C.textSecondary }}>{c.description}</span>
                            <div className="text-xs mt-0.5" style={{ color: C.textSecondary }}>
                              Raised by <b>{c.opened_in.file}</b> ({new Date(c.opened_in.at).toLocaleDateString()})
                              → killed by <b>{c.resolved_in.file}</b> ({new Date(c.resolved_in.at).toLocaleDateString()})
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ───────────────────────── PREVIOUS ANALYSES (history) ───────────────────────── */}
            <div className="rounded-lg border mb-6" style={{ borderColor: C.border }}>
              <div className="px-5 py-3.5 border-b flex items-center justify-between gap-3" style={{ borderColor: C.border }}>
                <span className="text-sm font-bold" style={{ color: C.textPrimary }}>
                  Previous Analyses ({filteredHistory.length})
                </span>
                {history.filter((h) => h.status === 'completed').length >= 2 && (
                  <button
                    type="button"
                    onClick={handleViewCombinedResults}
                    disabled={loadingCombinedView}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                    style={{ background: C.primarySoft, color: C.primary }}
                    title="Merge results across every completed SLD upload in this project"
                  >
                    {loadingCombinedView ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}
                    Combined Results
                  </button>
                )}
                {history.filter((h) => h.status === 'completed').length >= 1 && (
                  <button
                    type="button"
                    onClick={handleViewComments}
                    disabled={loadingComments}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                    style={{ background: showComments ? '#ede9fe' : C.primarySoft, color: showComments ? '#7c3aed' : C.primary }}
                    title="Track every discrepancy comment across SLD uploads — see which are still open and which were killed by a later SLD"
                  >
                    {loadingComments ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                    {showComments ? 'Hide Comment History' : 'Comment History'}
                  </button>
                )}
              </div>

              <div className="p-4 flex flex-wrap items-center gap-2.5 border-b" style={{ borderColor: C.border }}>
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9ca3af' }} />
                  <input
                    type="text" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Search document number..."
                    className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm"
                    style={{ borderColor: C.greyBorder }}
                  />
                </div>
                <select
                  value={historyStatusFilter} onChange={(e) => setHistoryStatusFilter(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm font-medium"
                  style={{ borderColor: C.greyBorder, color: C.textPrimary }}
                >
                  <option value="all">All statuses</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
                <select
                  value={historySort} onChange={(e) => setHistorySort(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm font-medium"
                  style={{ borderColor: C.greyBorder, color: C.textPrimary }}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
                <button
                  type="button"
                  onClick={() => fetchHistory(selectedProject.project_id)}
                  className="flex items-center gap-1.5 border rounded-lg px-3 py-2 text-sm font-semibold ml-auto"
                  style={{ borderColor: C.greyBorder, color: C.textSecondary }}
                >
                  <RefreshCw className="w-4 h-4" /> Refresh
                </button>
              </div>

              {loadingHistory ? (
                <div className="px-5 py-10 flex items-center justify-center">
                  <Loader className="w-6 h-6 animate-spin" style={{ color: C.primary }} />
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm" style={{ color: '#9ca3af' }}>
                  No previous analyses yet — run your first analysis above.
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: C.border }}>
                  {filteredHistory.map((h) => (
                    <HistoryRow
                      key={h.job_id}
                      item={h}
                      isSelected={selectedJobId === h.job_id}
                      busy={historyActionBusyId === h.job_id}
                      onView={() => handleViewResults(h.job_id)}
                      onDownload={() => handleDownloadHistoryJob(h)}
                      onDelete={() => handleDeleteHistoryJob(h.job_id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {historicalNoDataSaved && (
              <div className="rounded-lg p-6 border mb-6 flex items-start gap-3" style={{ borderColor: C.greyBorder, background: C.greyBg }}>
                <Info className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: C.textSecondary }} />
                <p className="text-sm" style={{ color: C.textSecondary }}>
                  This was a P&ID-only analysis (no Equipment List or Load List to compare against), so nothing was saved for it beyond the file name and status — there are no comparison rows to show here. Run a new analysis with at least one Excel/PDF reference file to see results you can revisit later.
                </p>
              </div>
            )}

            {results && (
              /* ───────────────────────── RESULTS ───────────────────────── */
              <div className="space-y-5">
                {isCombinedView && (
                  <div
                    className="rounded-lg border px-4 py-3 text-sm font-semibold flex flex-wrap items-center gap-2"
                    style={{ background: C.primarySoft, borderColor: C.border, color: C.primary }}
                  >
                    <span>
                      📊 Combined results from {(results.sld_files || []).length} SLD drawing{(results.sld_files || []).length === 1 ? '' : 's'}
                    </span>
                    {(results.sld_files || []).length > 0 && (
                      <span className="font-normal" style={{ color: C.textSecondary }}>
                        {results.sld_files.join(' · ')}
                      </span>
                    )}
                  </div>
                )}
                {/* ── STATS BAR ──
                    'pid_vs_equipment'/'pid_vs_loadlist' get a 5th card
                    (results.pid_tags_found — the real, backend-derived
                    "found on the P&ID" count) since tabStats.total for
                    those two tabs is a DIFFERENT number (total unique
                    tags across both sides of the comparison, not a
                    P&ID-only count) — see statCardLabels above for why
                    these must never share one card/label again. ── */}
                {(activeTab === 'pid_vs_equipment' || activeTab === 'pid_vs_loadlist') ? (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <StatCard
                      label={activeTab === 'pid_vs_equipment' ? 'P&ID Panel Tags Found' : 'P&ID Motor Tags Found'}
                      value={results.pid_tags_found || 0}
                      tone="blue"
                    />
                    <StatCard label={statCardLabels.matched} value={tabStats.matched} tone="green" icon={<CheckCircle className="w-4 h-4" style={{ color: C.success }} />} />
                    <StatCard label={statCardLabels.missing} value={tabStats.missing} tone="amber" icon={<AlertTriangle className="w-4 h-4" style={{ color: C.warning }} />} />
                    <StatCard label={statCardLabels.extra} value={tabStats.extra} tone="red" icon={<X className="w-4 h-4" style={{ color: C.error }} />} />
                    <StatCard label={statCardLabels.total} value={tabStats.total} tone="grey" icon={<Table className="w-4 h-4" style={{ color: C.textSecondary }} />} />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard label={statCardLabels.total} value={tabStats.total} tone="grey" icon={<Table className="w-4 h-4" style={{ color: C.textSecondary }} />} />
                    <StatCard label={statCardLabels.matched} value={tabStats.matched} tone="green" icon={<CheckCircle className="w-4 h-4" style={{ color: C.success }} />} />
                    <StatCard label={statCardLabels.missing} value={tabStats.missing} tone="amber" icon={<AlertTriangle className="w-4 h-4" style={{ color: C.warning }} />} />
                    <StatCard label={statCardLabels.extra} value={tabStats.extra} tone="red" icon={<X className="w-4 h-4" style={{ color: C.error }} />} />
                  </div>
                )}

                {/* Provider Used — shown whenever a P&ID was part of this
                    analysis, regardless of active tab. The P&ID tag
                    count itself now lives in the 5-card bar above for
                    the two tabs where it matters most; kept out of this
                    row for those tabs to avoid showing the same number
                    twice on screen at once. */}
                {pidWasUsed && activeTab !== 'pid_vs_equipment' && activeTab !== 'pid_vs_loadlist' && (
                  <div className="flex flex-wrap gap-3">
                    <StatCard label="Tags Found in P&ID" value={results.pid_tags_found || 0} tone="blue" />
                    <StatCard label="Provider Used" value="RADAI" tone="purple" />
                  </div>
                )}
                {pidWasUsed && (activeTab === 'pid_vs_equipment' || activeTab === 'pid_vs_loadlist') && (
                  <div className="flex flex-wrap gap-3">
                    <StatCard label="Provider Used" value="RADAI" tone="purple" />
                  </div>
                )}

                {/* ── AGPS-SP-EDS-002 Drafting Check — per-page
                    pass/fail/review checklist produced by
                    services/drafting_check.py during the analysis
                    (single-job view only; combined view has no single
                    drawing to check). ── */}
                {!isCombinedView && results?.drafting_check?.pages?.length > 0 && (
                  <div className="rounded-lg border overflow-hidden" style={{ borderColor: C.border }}>
                    <div className="px-5 py-3.5 border-b flex items-center justify-between gap-3" style={{ borderColor: C.border, background: C.greyBg }}>
                      <span className="text-sm font-bold" style={{ color: C.textPrimary }}>
                        📐 Drafting Check (AGPS-SP-EDS-002)
                      </span>
                      <span className="text-xs font-semibold" style={{ color: C.textSecondary }}>
                        ✅ {results.drafting_check.summary?.pass || 0} pass · ❌ {results.drafting_check.summary?.fail || 0} fail · ⚠️ {results.drafting_check.summary?.review || 0} needs review
                      </span>
                    </div>
                    <div className="p-4 space-y-4">
                      {results.drafting_check.pages.map((p) => (
                        <div key={p.page}>
                          <p className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: C.textSecondary }}>Page {p.page}</p>
                          <div className="space-y-1.5">
                            {p.checks.map((chk, ci) => {
                              const badge = chk.status === 'pass'
                                ? { bg: '#f0fdf4', border: '#16a34a', text: '#166534', label: 'PASS' }
                                : chk.status === 'fail'
                                  ? { bg: '#fef2f2', border: '#dc2626', text: '#991b1b', label: 'FAIL' }
                                  : { bg: '#fffbeb', border: '#d97706', text: '#92400e', label: 'REVIEW' };
                              return (
                                <div key={ci} className="rounded-lg border-l-4 px-3 py-2" style={{ borderColor: badge.border, background: badge.bg }}>
                                  <div className="flex items-start gap-2 text-sm">
                                    <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-black" style={{ background: badge.border, color: '#fff' }}>{badge.label}</span>
                                    <div>
                                      <div style={{ color: badge.text }}>{chk.rule}</div>
                                      {chk.evidence && <div className="text-xs mt-0.5" style={{ color: C.textSecondary }}>{chk.evidence}</div>}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {pidOnlyNoComparison ? (
                  /* P&ID-only: nothing to compare against — just show the extracted tags. */
                  <div className="rounded-lg p-6 border" style={{ borderColor: C.border }}>
                    <h3 className="text-sm font-bold mb-4" style={{ color: C.textPrimary }}>
                      {results.pid_tags.length} electrical tags extracted from P&ID drawing
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs uppercase tracking-wide" style={{ color: C.textSecondary, background: C.greyBg }}>
                            <th className="px-4 py-3 text-left">#</th>
                            <th className="px-4 py-3 text-left">Tag</th>
                            <th className="px-4 py-3 text-left">Area</th>
                            <th className="px-4 py-3 text-left">Type Code</th>
                            <th className="px-4 py-3 text-left">Equipment Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.pid_tags.map((t, i) => (
                            <tr key={i} className="border-t" style={{ borderColor: C.border, background: i % 2 ? C.rowAlt : '#fff' }}>
                              <td className="px-4 py-3" style={{ color: '#9ca3af' }}>{i + 1}</td>
                              <td className="px-4 py-3 font-mono font-semibold" style={{ color: C.textPrimary }}>{t.tag}</td>
                              <td className="px-4 py-3" style={{ color: C.textSecondary }}>{t.area}</td>
                              <td className="px-4 py-3" style={{ color: C.textSecondary }}>{t.type_code}</td>
                              <td className="px-4 py-3" style={{ color: C.textSecondary }}>{t.equipment_type}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : availableTabs.length > 0 && (
                  <div className="rounded-lg border overflow-hidden" style={{ borderColor: C.border }}>
                    {/* ── TABS — dynamic, only comparisons that actually ran ── */}
                    <div className="flex border-b" style={{ borderColor: C.border, background: C.greyBg }}>
                      {availableTabs.map((tabId) => {
                        const cfg = TAB_CONFIG[tabId];
                        const count = (results.results || []).filter((r) => r.source === cfg.source).length;
                        const on = activeTab === tabId;
                        return (
                          <button
                            key={tabId}
                            onClick={() => { setActiveTab(tabId); setSearch(''); setStatusFilter('all'); setTypeFilter('all'); setDetailRow(null); }}
                            className="flex-1 py-3 text-sm font-bold transition-all border-b-2"
                            style={{
                              color: on ? C.primary : C.textSecondary,
                              borderBottomColor: on ? C.primary : 'transparent',
                              background: on ? '#fff' : 'transparent',
                            }}
                          >
                            {cfg.label}
                            <span
                              className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-black"
                              style={{ background: on ? C.primarySoft : '#e5e7eb', color: on ? C.primary : C.textSecondary }}
                            >
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* ── FILTER BAR ── */}
                    <div className="p-4 flex flex-wrap items-center gap-2.5 border-b" style={{ borderColor: C.border }}>
                      <div className="relative flex-1 min-w-[220px]">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9ca3af' }} />
                        <input
                          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                          placeholder="Search equipment tags or descriptions..."
                          className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm"
                          style={{ borderColor: C.greyBorder }}
                        />
                      </div>

                      {!showingPanelVerification && (
                        <>
                          <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="border rounded-lg px-3 py-2 text-sm font-medium"
                            style={{ borderColor: C.greyBorder, color: C.textPrimary }}
                          >
                            <option value="all">All Types</option>
                            {equipmentTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="border rounded-lg px-3 py-2 text-sm font-medium"
                            style={{ borderColor: C.greyBorder, color: C.textPrimary }}
                          >
                            {showingCombinedTab ? (
                              <>
                                <option value="all">All</option>
                                <option value="fully_matched">Fully Matched</option>
                                <option value="partial">Partial</option>
                                <option value="single_source">Single Source</option>
                              </>
                            ) : (
                              <>
                                <option value="all">All Status</option>
                                <option value="matched">Matched</option>
                                <option value="missing">Missing</option>
                                <option value="extra">Extra</option>
                              </>
                            )}
                          </select>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setColumnsMenuOpen((o) => !o)}
                              className="flex items-center gap-1.5 border rounded-lg px-3 py-2 text-sm font-medium"
                              style={{ borderColor: C.greyBorder, color: C.textPrimary }}
                            >
                              <Settings2 className="w-4 h-4" /> Columns
                            </button>
                            {columnsMenuOpen && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setColumnsMenuOpen(false)} />
                                <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border shadow-xl z-50 p-2" style={{ background: '#fff', borderColor: C.border }}>
                                  {[
                                    { key: 'equipmentType', label: 'Equipment Type' },
                                    { key: 'description', label: 'Description' },
                                    { key: 'remarks', label: 'Remarks' },
                                  ].map((col) => (
                                    <label key={col.key} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 text-sm cursor-pointer" style={{ color: C.textPrimary }}>
                                      <input
                                        type="checkbox"
                                        checked={visibleCols[col.key]}
                                        onChange={() => setVisibleCols((v) => ({ ...v, [col.key]: !v[col.key] }))}
                                      />
                                      {col.label}
                                    </label>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        </>
                      )}

                      <button
                        onClick={() => (isCombinedView ? downloadExcelClientSide() : downloadExcel(activeTab))}
                        disabled={downloadingTab === activeTab || (isCombinedView && filteredResults.length === 0)}
                        title={isCombinedView ? 'Exports the currently visible tab\'s combined rows (generated in your browser).' : undefined}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 text-sm font-semibold text-white ml-auto"
                        style={{ background: C.success }}
                      >
                        {downloadingTab === activeTab ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Export
                      </button>

                      {!isCombinedView && results?.has_pid_file && results?.status === 'completed' && (
                        <button
                          onClick={toggleCanvasViewer}
                          disabled={loadingAnnotatedPages}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 text-sm font-semibold text-white"
                          style={{ background: C.primary }}
                        >
                          {loadingAnnotatedPages ? <Loader className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                          {showCanvasViewer ? '🙈 Hide Document Viewer' : '🗂️ View Documents (Canvas)'}
                        </button>
                      )}
                    </div>

                    {showCanvasViewer && !isCombinedView && (
                      <div className="px-4 pt-4 space-y-4">
                        {/* Legend + status toggles */}
                        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
                          <span style={{ color: C.textSecondary }}>Highlight:</span>
                          {[
                            { key: 'matched', label: 'Matched', color: '#16a34a' },
                            { key: 'missing', label: 'Missing', color: '#dc2626' },
                            { key: 'extra', label: 'Extra', color: '#ca8a04' },
                            { key: 'located', label: 'Located on Drawing', color: '#7c3aed' },
                          ].map((s) => (
                            <button
                              key={s.key}
                              onClick={() => setCanvasStatusFilter((prev) => ({ ...prev, [s.key]: !prev[s.key] }))}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-opacity"
                              style={{
                                borderColor: s.color,
                                color: s.color,
                                opacity: canvasStatusFilter[s.key] ? 1 : 0.35,
                              }}
                            >
                              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: s.color }} />
                              {s.label}
                            </button>
                          ))}
                        </div>

                        {loadingAnnotatedPages && (
                          <div className="flex items-center gap-2 text-sm" style={{ color: C.textSecondary }}>
                            <Loader className="w-4 h-4 animate-spin" />
                            Rendering documents…
                          </div>
                        )}

                        {annotatedPages && Object.keys(annotatedPages).length === 0 && !loadingAnnotatedPages && (
                          <p className="text-sm" style={{ color: C.textSecondary }}>No documents to display.</p>
                        )}

                        {annotatedPages && [
                          { key: 'pid', title: '📄 P&ID / SLD Drawing' },
                          { key: 'equipment_list', title: '📊 Equipment List' },
                          { key: 'load_list', title: '📊 Load List' },
                        ].filter((d) => annotatedPages[d.key]).map((d) => {
                          const docData = annotatedPages[d.key];
                          return (
                            <div key={d.key} className="space-y-2">
                              <h4 className="text-sm font-bold" style={{ color: C.textPrimary }}>{d.title}</h4>
                              {docData.type === 'pages'
                                ? docData.pages.map((p) => (
                                    <AnnotatedPageCanvas key={p.page} page={p} statusFilter={canvasStatusFilter} />
                                  ))
                                : <DocumentTableCanvas grid={docData.grid} statusFilter={canvasStatusFilter} />}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {(activeTab === 'pid_vs_equipment' || activeTab === 'pid_vs_loadlist') && (
                      <p className="px-4 pt-3 text-xs" style={{ color: C.textSecondary }}>
                        {activeTab === 'pid_vs_equipment'
                          ? 'Showing panel & switchboard tags only (U, SB, TF, GEN, JB, BD, AB, TSG...)'
                          : 'Showing motor & load tags only (PM, NPM, RM, MTR)'}
                      </p>
                    )}

                    <div className="flex">
                      <div className="flex-1 min-w-0">
                        {showingCombinedTab ? (
                          /* ── Tab 4 "Full Comparison" — dedicated 3-presence-column
                              table (In P&ID / In Equipment List / In Load List),
                              a different shape than the generic 2-column table
                              below (which only ever has one primary + one
                              reference side). ── */
                          <>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-xs uppercase tracking-wide" style={{ color: C.textSecondary, background: C.greyBg }}>
                                    <th className="px-4 py-3 text-left">#</th>
                                    <th className="px-4 py-3 text-left">Tag</th>
                                    <th className="px-4 py-3 text-left">Equipment Type</th>
                                    <th className="px-4 py-3 text-left">In P&ID</th>
                                    <th className="px-4 py-3 text-left">In Equipment List</th>
                                    <th className="px-4 py-3 text-left">In Load List</th>
                                    <th className="px-4 py-3 text-left">Status</th>
                                    <th className="px-4 py-3 text-left">Remarks</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {pageResults.length === 0 ? (
                                    <tr><td colSpan={8} className="px-4 py-8 text-center" style={{ color: '#9ca3af' }}>No results to show.</td></tr>
                                  ) : pageResults.map((r, i) => {
                                    const rowIdx = pageStart + i;
                                    const st = COMBINED_STATUS_STYLES[r.status] || GREY_BADGE;
                                    const { inPid, inEquipment, inLoadList } = combinedPresence(r.remarks);
                                    return (
                                      <tr
                                        key={rowIdx}
                                        className="border-t"
                                        style={{ borderColor: C.border, background: i % 2 ? C.rowAlt : '#fff' }}
                                      >
                                        <td className="px-4 py-3" style={{ color: '#9ca3af' }}>{rowIdx + 1}</td>
                                        <td className="px-4 py-3 font-mono font-semibold" style={{ color: C.textPrimary }}>{r.tag_number}</td>
                                        <td className="px-4 py-3" style={{ color: C.textSecondary }}>{r.equipment_type || '—'}</td>
                                        <td className="px-4 py-3">{inPid ? '✅ Yes' : '❌ No'}</td>
                                        <td className="px-4 py-3">{inEquipment ? '✅ Yes' : '❌ No'}</td>
                                        <td className="px-4 py-3">{inLoadList ? '✅ Yes' : '❌ No'}</td>
                                        <td className="px-4 py-3"><Badge style={st} /></td>
                                        <td className="px-4 py-3"><RemarksCell remarks={r.remarks} /></td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            {/* ── PAGINATION (same mechanism as the generic table) ── */}
                            <div className="px-4 py-3 flex items-center justify-between border-t" style={{ borderColor: C.border }}>
                              <span className="text-xs" style={{ color: C.textSecondary }}>
                                {filteredResults.length === 0 ? '0 results' :
                                  `${pageStart + 1}-${Math.min(pageStart + PAGE_SIZE, filteredResults.length)} of ${filteredResults.length} results`}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={currentPage === 1}
                                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                  className="p-1.5 rounded border disabled:opacity-40"
                                  style={{ borderColor: C.greyBorder }}
                                >
                                  <ChevronLeft className="w-4 h-4" style={{ color: C.textSecondary }} />
                                </button>
                                {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                                  .map((p, idx, arr) => (
                                    <React.Fragment key={p}>
                                      {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-xs" style={{ color: '#9ca3af' }}>…</span>}
                                      <button
                                        type="button"
                                        onClick={() => setCurrentPage(p)}
                                        className="w-7 h-7 rounded text-xs font-semibold"
                                        style={p === currentPage
                                          ? { background: C.primary, color: '#fff' }
                                          : { color: C.textSecondary }}
                                      >
                                        {p}
                                      </button>
                                    </React.Fragment>
                                  ))}
                                <button
                                  type="button"
                                  disabled={currentPage === totalPages}
                                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                  className="p-1.5 rounded border disabled:opacity-40"
                                  style={{ borderColor: C.greyBorder }}
                                >
                                  <ChevronRight className="w-4 h-4" style={{ color: C.textSecondary }} />
                                </button>
                              </div>
                            </div>
                          </>
                        ) : showingPanelVerification ? (
                          /* ── Panel Coverage + Motors — dedicated 2-section layout ── */
                          <div className="divide-y" style={{ borderColor: C.border }}>
                            <div className="p-5">
                              <h3 className="text-sm font-bold mb-3" style={{ color: C.textPrimary }}>Panel Verification</h3>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-xs uppercase tracking-wide" style={{ color: C.textSecondary, background: C.greyBg }}>
                                      <th className="px-4 py-3 text-left">#</th>
                                      <th className="px-4 py-3 text-left">Panel Tag</th>
                                      <th className="px-4 py-3 text-left">Description</th>
                                      <th className="px-4 py-3 text-left">In Equipment List</th>
                                      <th className="px-4 py-3 text-left">Motors in Load List</th>
                                      <th className="px-4 py-3 text-left">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {filteredPanels.length === 0 ? (
                                      <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: '#9ca3af' }}>No panels to show.</td></tr>
                                    ) : filteredPanels.map((p, i) => {
                                      const st = PANEL_STATUS_STYLES[p.status] || GREY_BADGE;
                                      return (
                                        <tr key={i} className="border-t" style={{ borderColor: C.border, background: i % 2 ? C.rowAlt : '#fff' }}>
                                          <td className="px-4 py-3" style={{ color: '#9ca3af' }}>{i + 1}</td>
                                          <td className="px-4 py-3 font-mono font-semibold" style={{ color: C.textPrimary }}>{p.panel_tag}</td>
                                          <td className="px-4 py-3" style={{ color: C.textSecondary }}>{p.description || '—'}</td>
                                          <td className="px-4 py-3">{p.in_equipment_list ? '✅ Found' : '❌ Not Found'}</td>
                                          <td className="px-4 py-3" style={{ color: C.textSecondary }}>{p.motor_count !== null ? `${p.motor_count} motor${p.motor_count === 1 ? '' : 's'}` : 'No load list'}</td>
                                          <td className="px-4 py-3"><Badge style={st} /></td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            <div className="p-5">
                              <h3 className="text-sm font-bold mb-3" style={{ color: C.textPrimary }}>
                                Load List Motors{results.panel_verification.motors[0]?.panel ? ` — Panel ${results.panel_verification.motors[0].panel}` : ''}
                              </h3>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-xs uppercase tracking-wide" style={{ color: C.textSecondary, background: C.greyBg }}>
                                      <th className="px-4 py-3 text-left">#</th>
                                      <th className="px-4 py-3 text-left">Motor Tag</th>
                                      <th className="px-4 py-3 text-left">Description</th>
                                      <th className="px-4 py-3 text-left">Panel</th>
                                      <th className="px-4 py-3 text-left">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {filteredMotors.length === 0 ? (
                                      <tr><td colSpan={5} className="px-4 py-8 text-center" style={{ color: '#9ca3af' }}>No motors to show.</td></tr>
                                    ) : filteredMotors.map((m, i) => {
                                      const st = MOTOR_STATUS_STYLES[m.status] || GREY_BADGE;
                                      return (
                                        <tr key={i} className="border-t" style={{ borderColor: C.border, background: i % 2 ? C.rowAlt : '#fff' }}>
                                          <td className="px-4 py-3" style={{ color: '#9ca3af' }}>{i + 1}</td>
                                          <td className="px-4 py-3 font-mono font-semibold" style={{ color: C.textPrimary }}>{m.motor_tag}</td>
                                          <td className="px-4 py-3" style={{ color: C.textSecondary }}>{m.description || '—'}</td>
                                          <td className="px-4 py-3 font-mono" style={{ color: C.textSecondary }}>{m.panel || '—'}</td>
                                          <td className="px-4 py-3"><Badge style={st} /></td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* ── RESULTS TABLE ── */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-xs uppercase tracking-wide" style={{ color: C.textSecondary, background: C.greyBg }}>
                                    <th className="px-4 py-3 text-left w-10">
                                      <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAllOnPage} />
                                    </th>
                                    <th className="px-4 py-3 text-left">#</th>
                                    <th className="px-4 py-3 text-left cursor-pointer select-none" onClick={() => setSortAsc((s) => !s)}>
                                      <span className="inline-flex items-center gap-1">Tag {sortAsc ? '↑' : '↓'}</span>
                                    </th>
                                    {visibleCols.description && <th className="px-4 py-3 text-left">Description</th>}
                                    {visibleCols.equipmentType && <th className="px-4 py-3 text-left">Type</th>}
                                    <th className="px-4 py-3 text-left">{activeConfig?.primaryLabel}</th>
                                    <th className="px-4 py-3 text-left">{activeConfig?.referenceLabel}</th>
                                    <th className="px-4 py-3 text-left">Status</th>
                                    {visibleCols.remarks && <th className="px-4 py-3 text-left">Remarks</th>}
                                    <th className="px-4 py-3 text-left">Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {pageResults.length === 0 ? (
                                    <tr><td colSpan={10} className="px-4 py-8 text-center" style={{ color: '#9ca3af' }}>No results to show.</td></tr>
                                  ) : pageResults.map((r, i) => {
                                    const rowIdx = pageStart + i;
                                    const st = STATUS_STYLES[r.status] || GREY_BADGE;
                                    const [primaryPresent, referencePresent] = presenceForStatus(r.status);
                                    return (
                                      <tr
                                        key={rowIdx}
                                        className="border-t cursor-pointer transition-colors"
                                        style={{ borderColor: C.border, background: detailRow === r ? C.primarySoft : (i % 2 ? C.rowAlt : '#fff') }}
                                        onClick={() => setDetailRow(r)}
                                      >
                                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                          <input type="checkbox" checked={selectedRows.has(rowIdx)} onChange={() => toggleSelectRow(rowIdx)} />
                                        </td>
                                        <td className="px-4 py-3" style={{ color: '#9ca3af' }}>{rowIdx + 1}</td>
                                        <td className="px-4 py-3 font-mono font-semibold" style={{ color: C.textPrimary }}>{r.tag_number}</td>
                                        {visibleCols.description && <td className="px-4 py-3" style={{ color: C.textSecondary }}>{r.description || '—'}</td>}
                                        {visibleCols.equipmentType && <td className="px-4 py-3" style={{ color: C.textSecondary }}>{r.equipment_type || '—'}</td>}
                                        <td className="px-4 py-3">{primaryPresent ? '✓' : '—'}</td>
                                        <td className="px-4 py-3">{referencePresent ? '✓' : '—'}</td>
                                        <td className="px-4 py-3"><Badge style={st} /></td>
                                        {visibleCols.remarks && <td className="px-4 py-3"><RemarksCell remarks={r.remarks} /></td>}
                                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                          <button
                                            type="button"
                                            onClick={() => setDetailRow(r)}
                                            className="text-xs font-semibold"
                                            style={{ color: C.primary }}
                                          >
                                            View
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            {/* ── PAGINATION ── */}
                            <div className="px-4 py-3 flex items-center justify-between border-t" style={{ borderColor: C.border }}>
                              <span className="text-xs" style={{ color: C.textSecondary }}>
                                {filteredResults.length === 0 ? '0 results' :
                                  `${pageStart + 1}-${Math.min(pageStart + PAGE_SIZE, filteredResults.length)} of ${filteredResults.length} results`}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={currentPage === 1}
                                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                  className="p-1.5 rounded border disabled:opacity-40"
                                  style={{ borderColor: C.greyBorder }}
                                >
                                  <ChevronLeft className="w-4 h-4" style={{ color: C.textSecondary }} />
                                </button>
                                {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                                  .map((p, idx, arr) => (
                                    <React.Fragment key={p}>
                                      {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-xs" style={{ color: '#9ca3af' }}>…</span>}
                                      <button
                                        type="button"
                                        onClick={() => setCurrentPage(p)}
                                        className="w-7 h-7 rounded text-xs font-semibold"
                                        style={p === currentPage
                                          ? { background: C.primary, color: '#fff' }
                                          : { color: C.textSecondary }}
                                      >
                                        {p}
                                      </button>
                                    </React.Fragment>
                                  ))}
                                <button
                                  type="button"
                                  disabled={currentPage === totalPages}
                                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                  className="p-1.5 rounded border disabled:opacity-40"
                                  style={{ borderColor: C.greyBorder }}
                                >
                                  <ChevronRight className="w-4 h-4" style={{ color: C.textSecondary }} />
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* ── DETAIL PANEL (right side) ── */}
                      {detailRow && !showingPanelVerification && !showingCombinedTab && (
                        <DetailPanel row={detailRow} config={activeConfig} onClose={() => setDetailRow(null)} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── New Project modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50" style={{ background: 'rgba(15,23,42,0.45)' }}>
          <form
            onSubmit={handleCreateProject}
            className="rounded-xl max-w-lg w-full p-7"
            style={{ background: '#fff', border: `1px solid ${PS.cardBorder}`, boxShadow: '0 24px 48px -12px rgba(15,23,42,0.35)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: PS.primarySoft }}>
                  <Zap className="w-4 h-4" style={{ color: PS.primary }} />
                </div>
                <h3 className="text-lg font-bold" style={{ color: PS.textPrimary }}>Create New Project</h3>
              </div>
              <button type="button" onClick={() => setShowCreateModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5" style={{ color: PS.textSecondary }} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: PS.textSecondary }}>Project Name</label>
                <input
                  type="text" required value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full border rounded-lg px-3.5 py-2.5 text-sm"
                  style={{ borderColor: PS.cardBorder }}
                  placeholder="e.g. Platform 285 - ACPT Upgrade"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: PS.textSecondary }}>Description</label>
                <textarea
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  className="w-full border rounded-lg px-3.5 py-2.5 text-sm"
                  style={{ borderColor: PS.cardBorder }}
                  placeholder="Optional project description..."
                  rows={3}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2.5 rounded-lg font-semibold transition-colors"
                style={{ background: '#F1F5F9', color: PS.textPrimary }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingProject || !newProjectName.trim()}
                className="flex-1 flex items-center justify-center gap-2 text-white py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
                style={{ background: PS.primary }}
              >
                {creatingProject ? <Loader className="w-4 h-4 animate-spin" /> : null}
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Rename Project modal ── */}
      {renameTarget && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50" style={{ background: 'rgba(15,23,42,0.45)' }}>
          <form
            onSubmit={handleRenameProject}
            className="rounded-xl max-w-md w-full p-6"
            style={{ background: '#fff', border: `1px solid ${PS.cardBorder}`, boxShadow: '0 24px 48px -12px rgba(15,23,42,0.35)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold" style={{ color: PS.textPrimary }}>Rename Project</h3>
              <button type="button" onClick={() => setRenameTarget(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5" style={{ color: PS.textSecondary }} />
              </button>
            </div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: PS.textSecondary }}>Project Name</label>
            <input
              type="text" required value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="w-full border rounded-lg px-3.5 py-2.5 text-sm"
              style={{ borderColor: PS.cardBorder }}
              autoFocus
            />
            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="flex-1 py-2.5 rounded-lg font-semibold transition-colors"
                style={{ background: '#F1F5F9', color: PS.textPrimary }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={renaming || !renameValue.trim()}
                className="flex-1 flex items-center justify-center gap-2 text-white py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
                style={{ background: PS.primary }}
              >
                {renaming ? <Loader className="w-4 h-4 animate-spin" /> : null}
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Delete Project confirm modal ── */}
      {deleteTarget && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50" style={{ background: 'rgba(15,23,42,0.45)' }}>
          <div
            className="rounded-xl max-w-md w-full p-6"
            style={{ background: '#fff', border: `1px solid ${PS.cardBorder}`, boxShadow: '0 24px 48px -12px rgba(15,23,42,0.35)' }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: PS.dangerSoft }}>
                <Trash2 className="w-4 h-4" style={{ color: PS.danger }} />
              </div>
              <h3 className="text-base font-bold" style={{ color: PS.textPrimary }}>Delete Project</h3>
            </div>
            <p className="text-sm mb-5" style={{ color: PS.textSecondary }}>
              Delete <span className="font-semibold" style={{ color: PS.textPrimary }}>{deleteTarget.project_name}</span>? Its past
              analyses are kept but will no longer be grouped under this project. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-lg font-semibold transition-colors"
                style={{ background: '#F1F5F9', color: PS.textPrimary }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteProject}
                disabled={deletingProject}
                className="flex-1 flex items-center justify-center gap-2 text-white py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
                style={{ background: PS.danger }}
              >
                {deletingProject ? <Loader className="w-4 h-4 animate-spin" /> : null}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// History row — one past ElectricalComparisonJob in the "Previous
// Analyses" list. pid_file_name is blank for an Equipment-List-vs-Load-
// List-only job (no P&ID uploaded), so that case falls back to a
// descriptive label instead of showing nothing.
// ─────────────────────────────────────────────────────────────────────────────
const HISTORY_STATUS_STYLES = {
  completed: { bg: C.successBg, text: '#166534', border: C.successBorder, label: 'COMPLETED' },
  failed: { bg: C.errorBg, text: '#991b1b', border: C.errorBorder, label: 'FAILED' },
};

const HistoryRow = ({ item, isSelected, busy, onView, onDownload, onDelete }) => {
  const st = HISTORY_STATUS_STYLES[item.status] || { bg: C.greyBg, text: '#374151', border: C.greyBorder, label: (item.status || 'PENDING').toUpperCase() };
  const fileLabel = item.pid_file_name || 'Equipment + Load List';
  return (
    <div
      className="px-5 py-3.5 flex items-center gap-4 flex-wrap transition-colors"
      style={{ background: isSelected ? C.primarySoft : 'transparent' }}
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.greyBg }}>
        <FileText className="w-4 h-4" style={{ color: C.textSecondary }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: C.textPrimary }}>{fileLabel}</p>
        <p className="text-xs" style={{ color: C.textSecondary }}>
          {item.created_at ? new Date(item.created_at).toLocaleString() : '—'}
          {' · '}{item.pid_tags_found || 0} tag{item.pid_tags_found === 1 ? '' : 's'} found
        </p>
      </div>
      <Badge style={st} />
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button" onClick={onView}
          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border"
          style={{ borderColor: C.primary, color: C.primary }}
        >
          View Results
        </button>
        <button
          type="button" onClick={onDownload} disabled={busy}
          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border disabled:opacity-50"
          style={{ borderColor: C.successBorder, color: C.success }}
        >
          <Download className="w-3.5 h-3.5" /> Download xlsx
        </button>
        <button
          type="button"
          onClick={() => {
            // eslint-disable-next-line no-alert
            if (window.confirm('Delete this analysis? This cannot be undone.')) onDelete();
          }}
          disabled={busy}
          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border disabled:opacity-50"
          style={{ borderColor: C.errorBorder, color: C.error }}
        >
          <X className="w-3.5 h-3.5" /> Delete
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Detail panel — opens on row click, shows the tag breakdown + presence on
// each side. Only used for the generic comparison tables (pid_vs_equipment /
// pid_vs_loadlist / the Excel-fallback equipment_vs_loadlist) — the
// dedicated Panel Verification view has its own distinct row shape
// (panels/motors, not a flat tag comparison) so a detail panel built
// around "area/type/sequence + 2-sided presence" doesn't apply there.
// ─────────────────────────────────────────────────────────────────────────────
const DetailPanel = ({ row, config, onClose }) => {
  const [tab, setTab] = useState('details');
  const { area, typeCode, sequence } = parseTagParts(row.tag_number);
  const [primaryPresent, referencePresent] = presenceForStatus(row.status);
  const st = STATUS_STYLES[row.status] || GREY_BADGE;

  return (
    <div className="w-80 flex-shrink-0 border-l" style={{ borderColor: C.border, background: '#fff' }}>
      <div className="p-5 border-b flex items-start justify-between" style={{ borderColor: C.border }}>
        <div>
          <p className="text-lg font-extrabold font-mono" style={{ color: C.textPrimary }}>{row.tag_number}</p>
          {row.equipment_type && (
            <span className="inline-block mt-1.5 px-2 py-0.5 rounded text-[11px] font-bold" style={{ background: C.primarySoft, color: C.primary }}>
              {row.equipment_type}
            </span>
          )}
        </div>
        <button type="button" onClick={onClose} className="p-1 hover:bg-slate-100 rounded transition-colors">
          <X className="w-4 h-4" style={{ color: C.textSecondary }} />
        </button>
      </div>

      <div className="flex border-b" style={{ borderColor: C.border }}>
        {['details', 'history'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="flex-1 py-2.5 text-xs font-bold uppercase tracking-wide border-b-2 capitalize"
            style={{ color: tab === t ? C.primary : C.textSecondary, borderBottomColor: tab === t ? C.primary : 'transparent' }}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === 'details' ? (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#9ca3af' }}>Equipment Type</dt>
              <dd style={{ color: C.textPrimary }}>{typeCode} {row.equipment_type ? `→ ${row.equipment_type}` : ''}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#9ca3af' }}>Area Code</dt>
              <dd className="font-mono" style={{ color: C.textPrimary }}>{area || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#9ca3af' }}>Type Code</dt>
              <dd className="font-mono" style={{ color: C.textPrimary }}>{typeCode || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#9ca3af' }}>Sequence</dt>
              <dd className="font-mono" style={{ color: C.textPrimary }}>{sequence || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#9ca3af' }}>{config?.primaryLabel}</dt>
              <dd style={{ color: C.textPrimary }}>{primaryPresent ? '✅ Yes' : '❌ No'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#9ca3af' }}>{config?.referenceLabel}</dt>
              <dd style={{ color: C.textPrimary }}>{referencePresent ? '✅ Yes' : '❌ No'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#9ca3af' }}>Status</dt>
              <dd><Badge style={st} /></dd>
            </div>
            {row.description && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#9ca3af' }}>Description</dt>
                <dd style={{ color: C.textPrimary }}>{row.description}</dd>
              </div>
            )}
            {row.remarks && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#9ca3af' }}>Remarks</dt>
                <dd style={{ color: C.textSecondary }}>{row.remarks}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-sm" style={{ color: C.textSecondary }}>No history available — this comparison was run once and has not been re-analyzed.</p>
        )}
      </div>
    </div>
  );
};

export default SingleLineDiagram;

