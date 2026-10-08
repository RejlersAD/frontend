import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../../config/api.config';
import {
  Upload as UploadIcon, FileText, Table, CheckCircle, AlertTriangle,
  Loader, X, Download, Zap, Search, Eye, EyeOff, Info,
  FolderPlus, Package, ArrowLeft, HelpCircle, ChevronDown,
  ChevronLeft, ChevronRight, Plus, Settings2, ChevronUp, RefreshCw,
  MoreVertical, Pencil, Trash2, Calendar, BarChart3, ArrowRight,
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
    label: 'P&ID vs Equipment List',
    primaryLabel: 'In P&ID',
    referenceLabel: 'In Equipment List',
    exportPrefix: 'pid_vs_equipment',
  },
  pid_vs_loadlist: {
    source: 'load_list',
    label: 'P&ID vs Load List',
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
const UploadBox = ({ label, icon: Icon, accept, required, file, onSelect, onRemove }) => {
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
        <span
          className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider"
          style={required
            ? { background: C.errorBg, color: '#991b1b', border: `1px solid ${C.errorBorder}` }
            : { background: C.greyBg, color: C.grey, border: `1px solid ${C.greyBorder}` }}
        >
          {required ? 'Required' : 'Optional'}
        </span>
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

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
const SingleLineDiagram = () => {
  // ── Project selection — same state-driven view switch as
  // PIDVerificationV2.jsx (not a separate route): selectedProject === null
  // shows the project-selection screen; same component/URL either way. ──
  const [selectedProject, setSelectedProject] = useState(null);
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
    setPidFile(null); setEquipmentFile(null); setLoadListFile(null);
    setResults(null); setError(''); setPidFileNameUsed('');
    setKeyTestResult(null);
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
  const [provider, setProvider] = useState('claude');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState(MODELS_BY_PROVIDER.claude[0]);
  const [testingKey, setTestingKey] = useState(false);
  const [keyTestResult, setKeyTestResult] = useState(null); // { valid, error }

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
  const [pidFile, setPidFile] = useState(null);
  const [equipmentFile, setEquipmentFile] = useState(null);
  const [loadListFile, setLoadListFile] = useState(null);

  // Any combination works except Equipment-only or Load-List-only (see
  // backend's own validation, mirrored here so the button disables BEFORE
  // a doomed request round-trips).
  const hasPid = Boolean(pidFile);
  const hasEquip = Boolean(equipmentFile);
  const hasLoad = Boolean(loadListFile);
  const canAnalyse = hasPid || (hasEquip && hasLoad);
  const excelOnlyOneSided = (hasEquip && !hasLoad && !hasPid) || (hasLoad && !hasEquip && !hasPid);

  // ── Analysis state ────────────────────────────────────────────────────
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null); // full upload response
  const [pidFileNameUsed, setPidFileNameUsed] = useState(''); // snapshot — pidFile itself may be cleared on reset

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
    if (!canAnalyse) {
      setError(excelOnlyOneSided
        ? (hasEquip ? 'Please also upload Load List to compare' : 'Please also upload Equipment List to compare')
        : 'Upload at least P&ID or both Excel files');
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

  const handleDeleteHistoryJob = async (jobId) => {
    setHistoryActionBusyId(jobId);
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
  const [helpOpen, setHelpOpen] = useState(false);
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
    const cfg = TAB_CONFIG[tabId];
    setDownloadingTab(tabId);
    try {
      const response = await axios.get(`${API_PREFIX}/export/${results.job_id}/`, {
        headers: authHeader(), responseType: 'blob',
        params: { source: cfg.source },
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${cfg.exportPrefix}_${results.job_id}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Failed to export Excel.');
    } finally {
      setDownloadingTab(null);
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
    <div className="min-h-screen" style={{ background: C.bg, fontFamily: FONT_STACK }}>
      {/* ───────────────────────── TOP HEADER ───────────────────────── */}
      <div style={{ background: C.header }}>
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.primary }}>
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-white leading-tight truncate">Electrical Equipment Comparison</h1>
              <p className="text-xs leading-tight truncate" style={{ color: '#94a3b8' }}>
                {selectedProject
                  ? `${selectedProject.project_name}${selectedProject.description ? ' — ' + selectedProject.description : ''}`
                  : 'Manage your electrical comparison projects'}
              </p>
              {!selectedProject && (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <FolderPlus className="w-3 h-3" style={{ color: '#94a3b8' }} />
                    <span className="text-[11px] font-semibold" style={{ color: '#cbd5e1' }}>
                      {projects.length} {projects.length === 1 ? 'Project' : 'Projects'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <Calendar className="w-3 h-3" style={{ color: '#94a3b8' }} />
                    <span className="text-[11px] font-semibold" style={{ color: '#cbd5e1' }}>
                      Last Analysis: {overallLastAnalysisAt ? overallLastAnalysisAt.toLocaleDateString() : 'None yet'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {results?.job_id && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <span className="text-[11px] font-mono" style={{ color: '#94a3b8' }}>
                  {results.job_id.slice(0, 8)}…
                </span>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                  style={{ background: results.status === 'completed' ? C.successBg : C.warningBg, color: results.status === 'completed' ? '#166534' : '#92400e' }}
                >
                  {results.status || 'pending'}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
              style={{ color: '#cbd5e1', background: 'transparent' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <HelpCircle className="w-4 h-4" /> Help
            </button>

            {selectedProject && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setActionsOpen((o) => !o)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{ background: C.primary }}
                >
                  Actions <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {actionsOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setActionsOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border shadow-xl z-50 overflow-hidden" style={{ background: '#fff', borderColor: C.border }}>
                      <button
                        type="button"
                        disabled={!results || !activeTab}
                        onClick={() => { setActionsOpen(false); if (activeTab) downloadExcel(activeTab); }}
                        className="w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                        style={{ color: C.textPrimary }}
                      >
                        <Download className="w-4 h-4" /> Export Excel
                      </button>
                      <button
                        type="button"
                        disabled
                        title="PDF export is not available on the backend yet"
                        className="w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-2 opacity-40 cursor-not-allowed"
                        style={{ color: C.textPrimary }}
                      >
                        <FileText className="w-4 h-4" /> Export PDF <span className="text-[10px] ml-auto">(coming soon)</span>
                      </button>
                      <div className="border-t" style={{ borderColor: C.border }} />
                      <button
                        type="button"
                        onClick={startNewAnalysis}
                        className="w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-2 hover:bg-slate-50"
                        style={{ color: C.primary }}
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
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-6">
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
                className="flex items-center gap-2 text-white px-4 py-2.5 rounded-lg font-semibold transition-colors"
                style={{ background: PS.primary }}
                onMouseEnter={(e) => { e.currentTarget.style.background = PS.primaryHover; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = PS.primary; }}
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
                  className="inline-flex items-center gap-2 text-white px-5 py-3 rounded-lg font-semibold transition-colors"
                  style={{ background: PS.primary }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = PS.primaryHover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = PS.primary; }}
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
                          className="w-full flex items-center justify-center gap-1.5 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
                          style={{ background: PS.primary }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = PS.primaryHover; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = PS.primary; }}
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
            {/* ── Back button ── */}
            <button
              type="button"
              onClick={handleBackToProjects}
              className="flex items-center gap-1.5 text-sm font-semibold mb-5 px-3 py-2 rounded-lg border transition-colors"
              style={{ color: C.textSecondary, borderColor: C.border }}
            >
              <ArrowLeft className="w-4 h-4" />
              Projects
            </button>

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
                  {/* AI Vision API Key */}
                  <div className="pt-5">
                    <h3 className="text-sm font-bold mb-1" style={{ color: C.textPrimary }}>AI Vision API Key</h3>
                    <p className="text-xs mb-2" style={{ color: C.textSecondary }}>
                      Uses admin-configured key by default. Add your own Claude or OpenAI key to use it instead.
                      Only needed if you are uploading a P&ID drawing — comparing two Excel files alone doesn&apos;t use AI Vision at all.
                    </p>

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
                          {MODELS_BY_PROVIDER[provider].map((m) => <option key={m} value={m}>{m}</option>)}
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
                            onChange={(e) => { setApiKey(e.target.value); setKeyTestResult(null); }}
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
                      {keyTestResult && (
                        <p className="mt-2 text-xs font-semibold" style={{ color: keyTestResult.valid ? C.success : C.error }}>
                          {keyTestResult.valid ? '✅ Connected' : `❌ ${keyTestResult.error || 'Invalid API key'}`}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* File Upload */}
                  <div>
                    <h3 className="text-sm font-bold mb-1" style={{ color: C.textPrimary }}>Upload Files</h3>
                    <p className="text-xs mb-4 flex items-center gap-1.5" style={{ color: C.textSecondary }}>
                      <Info className="w-3.5 h-3.5 flex-shrink-0" />
                      Upload at least P&ID or both Excel files
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

                    <div className="mt-5">
                      <button
                        type="button"
                        onClick={handleAnalyse}
                        disabled={!canAnalyse || analysing}
                        className="w-full flex items-center justify-center gap-2 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: C.primary }}
                        onMouseEnter={(e) => { if (!analysing && canAnalyse) e.currentTarget.style.background = C.primaryHover; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = C.primary; }}
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

            {/* ───────────────────────── PREVIOUS ANALYSES (history) ───────────────────────── */}
            <div className="rounded-lg border mb-6" style={{ borderColor: C.border }}>
              <div className="px-5 py-3.5 border-b" style={{ borderColor: C.border }}>
                <span className="text-sm font-bold" style={{ color: C.textPrimary }}>
                  Previous Analyses ({filteredHistory.length})
                </span>
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
                    <StatCard label="Tags Found in P&ID" value={results.pid_tags_found || 0} tone="blue" />
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
                        onClick={() => downloadExcel(activeTab)}
                        disabled={downloadingTab === activeTab}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 text-sm font-semibold text-white ml-auto"
                        style={{ background: C.success }}
                      >
                        {downloadingTab === activeTab ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Export
                      </button>
                    </div>

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

      {/* ── Help modal ── */}
      {helpOpen && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50" style={{ background: 'rgba(15,23,42,0.45)' }}>
          <div className="rounded-lg max-w-lg w-full p-6" style={{ background: '#fff', border: `1px solid ${C.border}` }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold flex items-center gap-2" style={{ color: C.textPrimary }}>
                <HelpCircle className="w-5 h-5" style={{ color: C.primary }} /> How Electrical Comparison Works
              </h3>
              <button type="button" onClick={() => setHelpOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5" style={{ color: C.textSecondary }} />
              </button>
            </div>
            <ul className="space-y-2.5 text-sm" style={{ color: C.textSecondary }}>
              <li>• Upload a P&ID drawing (PDF) alone to extract electrical tags via AI Vision — no comparison, just the tag list.</li>
              <li>• Upload Equipment List + Load List (Excel or PDF) alone to compare them directly — no AI Vision needed.</li>
              <li>• Upload any combination with a P&ID to run full MATCHED / MISSING / EXTRA comparisons.</li>
              <li>• For &ldquo;Equipment List vs Load List&rdquo;, the Load List PDF&apos;s own &ldquo;PANEL TAG:&rdquo; header is used to verify the panel exists in the Equipment List — not a direct tag match, since panels and motors are different equipment classes.</li>
              <li>• Click any row in the results table to see its full breakdown (area / type code / sequence) in the detail panel.</li>
            </ul>
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
