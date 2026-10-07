/**
 * 🎯 LINE LIST - BASE EXTRACTION LAYER ONLY
 *
 * Purpose: Extract base 11 columns from P&ID (no enrichment)
 * Route: /engineering/process/line-list
 * Format: 2"-D-6152-033842-X-N
 *   → Size | Service Code | Sequence No | Piping Spec | Dept Deviation | Insulation
 *
 * Features:
 * - P&ID upload only (PDF)
 * - Async processing with polling (fixes Railway production timeout)
 * - 8 locked columns output
 * - No HMB/PMS/NACE/Stress documents
 * - Stable, production-ready
 *
 * Why async?
 * Railway's reverse proxy drops HTTP connections after ~60 s.
 * OCR takes several minutes, so we submit the file as a background job and
 * poll for progress — the same pattern used by upload_pid_status.
 *
 * Why fetch + AbortController for the upload?
 * Axios' per-request timeout can be silently bypassed by the shared
 * api.service.js interceptor (which remaps errors) and by Axios instance
 * defaults set to API_TIMEOUT_LONG (300 s).  A native AbortController
 * fires at exactly UPLOAD_TIMEOUT_MS regardless of any Axios config,
 * guaranteeing the user is never frozen for 5 minutes.
 *
 * Build: v2.1.0 — AbortController upload timeout
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DocumentTextIcon, CloudArrowUpIcon, CheckCircleIcon, ArrowsPointingOutIcon, ArrowsPointingInIcon, BookOpenIcon, Cog6ToothIcon, MagnifyingGlassIcon, XMarkIcon, ClockIcon, ExclamationTriangleIcon, ExclamationCircleIcon, PlusIcon, ArrowUpTrayIcon, ArrowDownTrayIcon, QuestionMarkCircleIcon, EllipsisHorizontalIcon, ArrowTopRightOnSquareIcon, ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon, ClipboardDocumentListIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import apiClient from '../../../services/api.service';
import * as XLSX from 'xlsx';
import envConfig from '../../../config/environment.config';
import WrenchAiDocAssist from '../../../components/Engineering/WrenchAiDocAssist';
import LineListWorkflowDocs from './components/LineListWorkflowDocs';
import LegendSheetsModal from './components/LegendSheetsModal';
import ProjectLegendPanel from '../../../components/Engineering/ProjectLegendPanel';
import { listLegends } from '../../../services/pidCheckerV2API';
import { publishChatContext, clearChatContext } from '../../../services/chatContext.store';
import { CHAT_PAGE_PROFILES } from '../../../config/radaiChatPages.config';
import { getApiBaseUrl } from '../../../config/environment.config';
import { STORAGE_KEYS } from '../../../config/app.config';
// Shared Project Organizer — soft-coded workspace (same pattern as HMB Extractor)
import { PROJECT_ORGANIZER_CONFIG } from '../../../config/projectOrganizer.config';
import projectOrganizerService from '../../../services/projectOrganizerService';
import { ProjectCard, ProjectFormModal, useActiveProject } from '../../../components/ProjectOrganizer';
import { FolderIcon, FolderPlusIcon } from '@heroicons/react/24/outline';

// ---------------------------------------------------------------------------
// Soft-coded config — all timing values flow from environments.json.
// Hardcoded fallbacks ensure correct behaviour even if the JSON entry is
// missing or the Vercel build uses an old cached bundle.
// ---------------------------------------------------------------------------
const API_CONFIG = envConfig.getApiConfig();

// How often to poll for OCR progress (ms)
// SOFT-CODED: environments.json → api.retry_delay
const POLL_INTERVAL_MS   = Number(API_CONFIG.retry_delay)              || 3000;

// Maximum total polling window — give up after this (ms)
// SOFT-CODED: environments.json → api.timeout_extraction_poll
// Default 100 min — dense/scanned multi-page P&IDs (25+ pages) can exceed 60 min.
// Must stay >= backend DESIGNIQ_TASK_HARD_LIMIT (Celery, 6000 s).
// Change this in environments.json without touching code.
const POLL_MAX_WAIT_MS   = Number(API_CONFIG.timeout_extraction_poll)  || 6000000;  // 100 min

// Timeout for the initial filing POST (upload + broker dispatch, NOT OCR time).
// Uses AbortController so it cannot be bypassed by Axios instance settings.
  // HARD-CODED: 10 minutes for Line List extraction (overrides environments.json)
const UPLOAD_TIMEOUT_MS  = 600000;   // 600 s (10 minutes for Line List extraction - complex document processing)

// Timeout for each individual status-poll GET
// SOFT-CODED: environments.json → api.timeout_poll
const POLL_REQ_TIMEOUT   = Number(API_CONFIG.timeout_poll)      || 10000;   // 10 s

// How many times to retry the initial POST before giving up
// SOFT-CODED: environments.json → api.max_upload_retries
const MAX_POST_RETRIES   = Number(API_CONFIG.max_upload_retries) || 3;

// Base delay between POST retries (doubles each attempt: 4 s, 8 s)
// SOFT-CODED: environments.json → api.upload_retry_delay
const POST_RETRY_BASE_MS = Number(API_CONFIG.upload_retry_delay) || 4000;

// Resolved API base-URL (e.g. https://aiflowbackend-production.up.railway.app/api/v1)
const API_BASE = getApiBaseUrl();

console.log('[LineList] Config loaded:', {
  UPLOAD_TIMEOUT_MS, POLL_INTERVAL_MS, MAX_POST_RETRIES, POST_RETRY_BASE_MS, API_BASE,
});

// ---------------------------------------------------------------------------
// Soft-coded format options — add/remove formats here only, no JSX changes needed.
// ---------------------------------------------------------------------------
const FORMAT_OPTIONS = [
  { value: 'onshore',    label: 'Onshore',               hint: 'SIZE-FLUID-SEQ-CLASS'              },
  { value: 'industrial', label: 'Industrial/Project',    hint: 'SIZE\"-UNIT-SERVICE-SEQ-CLASS'     },
  { value: 'offshore',   label: 'Offshore',               hint: 'AREA-FLUID-SIZE-CLASS-SEQ'         },
  { value: 'general',    label: 'General (Auto-detect)',  hint: 'Tries all formats automatically'   },
  { value: 'adnoc',      label: 'SIZE\"-FLUID-CLASS-SEQ', hint: 'ADNOC / compact format'           },
  { value: 'linelist',   label: 'Line List',              hint: 'SIZE-UNIT-FLUID-SERIAL-CLASS-COAT (Phase 2)' },
];

// Soft-coded table columns — key maps directly to row fields.
// Format: 2"-D-6152-033842-X-N
//   original_detection → full string
//   size               → 2"
//   fluid_code         → D         (service / fluid code)
//   fluid_description  → Drain     (from legend sheet, if uploaded)
//   sequence_no        → 6152      (line sequence identifier)
//   piping_spec        → 033842    (piping specification number)
//   dept_deviation     → X         (department deviation / modifier)
//   insulation         → N         (insulation class)
//   insulation_desc    → No Insul. (from legend sheet, if uploaded)
// `fallbackKeys` (optional) lets a single column resolve from the first
// non-empty backend field — useful for From/To which the backend exposes as
// `from_line`/`from_equipment` (and `to_line`/`to_equipment`) depending on
// whether spatial matching produced a line tag or an equipment tag.
const COLUMNS = [
  { key: 'original_detection', label: 'Line Designation',        width: 36 },
  { key: 'size',               label: 'Size',                    width: 8  },
  { key: 'fluid_code',         label: 'Service Code',            width: 12 },
  { key: 'fluid_description',  label: 'Service Description',     width: 22 },
  { key: 'sequence_no',        label: 'Sequence No.',            width: 12 },
  { key: 'piping_spec',        label: 'Piping Specification',    width: 16 },
  { key: 'dept_deviation',     label: 'Dept Deviation',          width: 14 },
  { key: 'insulation',         label: 'Insulation',              width: 12 },
  { key: 'insulation_desc',    label: 'Insulation Description',  width: 22 },
  { key: 'from_line',          label: 'From',                    width: 22, fallbackKeys: ['from_equipment', 'from'] },
  { key: 'to_line',            label: 'To',                      width: 22, fallbackKeys: ['to_equipment', 'to'] },
  { key: 'pid_no',             label: 'P&ID No.',                width: 24 },
];

// Soft-coded value resolver — returns first non-empty value across primary
// key + optional fallbackKeys. Used by both the table render and Excel export.
const resolveCellValue = (row, col) => {
  const keys = [col.key, ...(col.fallbackKeys || [])];
  for (const k of keys) {
    const v = row?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return '';
};

// Soft-coded format reference examples shown in the info card.
const FORMAT_EXAMPLES = [
  {
    group: 'Industrial / Project',
    color: '#b45309',
    bg: 'rgba(180,83,9,0.06)',
    border: 'rgba(180,83,9,0.25)',
    examples: ['2"-2600-FL-352-32070R-E', '8"-2600-P-381-31051XR-E', '3/4"-2600-HD-430-32070R-E'],
    note: 'Unit · Service · Seq · PipingClass · EndDesig  (Samsung/Foster Wheeler & similar)',
  },
  {
    group: 'Offshore',
    color: '#1d4ed8',
    bg: 'rgba(29,78,216,0.06)',
    border: 'rgba(29,78,216,0.18)',
    examples: ['604-LFG-3-AC2GA0-2012', '604-PW-2\"-AE2LOD-FA-2779'],
  },
  {
    group: 'General (Auto-detect)',
    color: '#7c3aed',
    bg: 'rgba(124,58,237,0.06)',
    border: 'rgba(124,58,237,0.2)',
    examples: ['4\"-41-SWR-64313-A2AU16-V', '16\"-41-SWS-65324-A2AU16-V'],
    note: 'Tries all formats — useful when format is unknown',
  },
  {
    group: 'Onshore',
    color: '#0369a1',
    bg: 'rgba(3,105,161,0.06)',
    border: 'rgba(3,105,161,0.18)',
    examples: ['2\"-D-6152-033842-X-N', '4\"-D-5690-013842-X-N', '16\"-PG-4667-031441-X'],
    note: 'Size · Service · Seq · PipingSpec · DeptDev · Insulation',
  },
  {
    group: 'SIZE\"-FLUID-CLASS-SEQ',
    color: '#0f766e',
    bg: 'rgba(15,118,110,0.06)',
    border: 'rgba(15,118,110,0.18)',
    examples: ['6\"-CD-AC3N-8256', '8\"-HO-BD2A-1023'],
  },
];

// ---------------------------------------------------------------------------
// Soft-coded hero/visual theme — edit freely, no core logic depends on this.
// Pure styling constants consumed by the header + feature tiles. Changing any
// value here only affects looks, never extraction / polling / export behaviour.
// ---------------------------------------------------------------------------

// HEADER STYLE SWITCH — 'v1' = light card identical to P&ID Verification V1;
// 'dark' = legacy dark gradient banner. Soft-coded, flip anytime.
const LL_HEADER_STYLE = 'v1';

// SOFT-CODED: visibility toggles for optional page sections.
const LL_SHOW_FORMATS_REFERENCE = false;   // "Supported Line Number Formats" card — hidden
const LL_SHOW_WHAT_GETS_EXTRACTED = false; // "What Gets Extracted" info panel — hidden

// SOFT-CODED: upload rules — shown in the "Before you upload" card on the
// upload step AND enforced client-side (page count) + server-side
// (BASE_EXTRACTION_MAX_PAGES in designiq/views.py — keep both in sync).
const LL_UPLOAD_RULES = {
  enabled: true,
  maxPages: 12,                 // hard cap — matches backend BASE_EXTRACTION_MAX_PAGES
  title: 'Before you upload',
  rules: [
    { icon: '📄', text: 'Upload a maximum of {maxPages} pages per P&ID document. Split larger packages into single-sheet or smaller PDFs.' },
    { icon: '🧭', text: 'Line tags at any angle are supported (horizontal and vertical).' },
  ],
  formatsTitle: 'Supported Line List formats',
  formats: [
    { key: 'a', label: 'Phase 1',            pattern: 'XX-XX-XXXX-XXXX-X' },
    { key: 'b', label: 'Phase 2 (Line List)', pattern: 'XX-XX-XX-AXXXX-XXXXXXX-XX' },
  ],
};

// Count PDF pages client-side (dependency-free heuristic: counts page
// objects in the raw file). Returns null when the count can't be read.
const countPdfPages = async (file) => {
  try {
    const buf = await file.arrayBuffer();
    const text = new TextDecoder('latin1').decode(buf);
    const matches = text.match(/\/Type\s*\/Page(?![sA-Za-z])/g);
    return matches ? matches.length : null;
  } catch {
    return null;
  }
};

// V1-style light header config (mirrors PIDVerification.jsx header constants)
const LL_HEADER = {
  icon:         'doc',          // 'doc' | 'layers' — header icon tile
  title:        'Line List',
  subtitle:     'AI-powered line extraction from P&ID drawings — line designation, service codes, piping spec and FROM→TO flow, validated against your naming convention.',
  badgeText:    'Production Ready',
  badgeColor:   '#10b981',
  iconSize:     40,
  // Feature pills under the subtitle (colour-coded like V1)
  featureBadges: [
    { label: 'AI-Powered OCR',     color: '#3b82f6' },
    { label: 'Async Processing',   color: '#6366f1' },
    { label: '5 Format Profiles',  color: '#8b5cf6' },
    { label: 'Excel Export',       color: '#f59e0b' },
    { label: 'Vision FROM→TO',     color: '#06b6d4' },
  ],
  // Quick stats shown on the right (values resolved at render)
  stats: [
    { key: 'columns', label: 'Columns' },
    { key: 'formats', label: 'Formats' },
  ],
};

// Legacy dark hero banner (kept for rollback via LL_HEADER_STYLE = 'dark')
const LL_HERO = {
  gradient:    'linear-gradient(135deg, #1e40af 0%, #2563eb 40%, #4f46e5 75%, #7c3aed 100%)',
  accentGlow:  'radial-gradient(circle at 20% 20%, rgba(96,165,250,0.35), transparent 55%), radial-gradient(circle at 80% 30%, rgba(167,139,250,0.3), transparent 50%)',
  chipBg:      'rgba(255,255,255,0.12)',
  chipBorder:  '1px solid rgba(255,255,255,0.25)',
};

// Hero capability chips — short, marketing-style.
const LL_HERO_CHIPS = [
  { icon: '🤖', label: 'AI-Powered OCR' },
  { icon: '🔀', label: 'Async Processing' },
  { icon: '🧭', label: '5 Format Profiles' },
  { icon: '📥', label: 'Excel Export' },
  { icon: '🧠', label: 'Vision FROM-TO' },
];

// Pipeline stages shown during processing — keyed to percent bands that the
// backend task already emits.  Pure display layer; status messages still flow
// from the backend unchanged.
const LL_PIPELINE_STAGES = [
  { key: 'upload',   label: 'Upload',    icon: '📤', from: 0,  to: 10  },
  { key: 'ocr',      label: 'OCR',       icon: '🔍', from: 10, to: 45  },
  { key: 'parse',    label: 'Parse',     icon: '🧩', from: 45, to: 75  },
  { key: 'fromto',   label: 'From → To', icon: '🧠', from: 75, to: 95  },
  { key: 'finalize', label: 'Finalize',  icon: '✅', from: 95, to: 100 },
];

// Feature tiles displayed in the idle state — each has an accent colour so the
// grid feels alive. Descriptions are computed at render time from COLUMNS /
// FORMAT_OPTIONS so nothing goes stale if those lists change.
const LL_FEATURE_ACCENTS = [
  { bg: 'rgba(37,99,235,0.07)',  border: 'rgba(37,99,235,0.22)',  fg: '#1d4ed8' },
  { bg: 'rgba(16,185,129,0.07)', border: 'rgba(16,185,129,0.22)', fg: '#047857' },
  { bg: 'rgba(139,92,246,0.07)', border: 'rgba(139,92,246,0.22)', fg: '#6d28d9' },
  { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', fg: '#b45309' },
  { bg: 'rgba(236,72,153,0.07)', border: 'rgba(236,72,153,0.22)', fg: '#be185d' },
  { bg: 'rgba(14,165,233,0.07)', border: 'rgba(14,165,233,0.22)', fg: '#0369a1' },
  { bg: 'rgba(217,70,239,0.07)', border: 'rgba(217,70,239,0.22)', fg: '#a21caf' },
];

// Rotating tips shown during processing — educate the user while they wait.
// Soft-coded: add/remove freely, component rotates them on an interval.
const LL_PROC_TIPS = [
  '💡 Multi-page P&IDs are OCR-scanned in sequence — keep this tab open.',
  '🧠 AI detects line numbers in any format: hyphens, spaces, periods.',
  '📐 Computer Vision correlates text with line geometries to infer FROM→TO.',
  '🔍 Embedded vector text is preferred over OCR for speed on CAD-native PDFs.',
  '⚙️ Optional legend sheets unlock service-code & insulation descriptions.',
  '✨ Complex drawings (like this one) may take longer — quality stays high.',
];
const LL_PROC_TIP_ROTATE_MS = 5000;

// ---------------------------------------------------------------------------
// ─── Enterprise Line Register (management view) — pure design layer ────────
// Renders the extracted rows as an enterprise register (search, filters,
// status badges, KPI cards, pagination, detail panel, revision history).
// SOFT-CODED: every value here is display-only — extraction, polling and
// export logic never read from this block.
// ---------------------------------------------------------------------------
const LL_REGISTER = {
  enabled:        true,
  registerNo:     'LL-001',
  revision:       '03',
  revisionStatus: 'In Review',
  pageSize:       10,
  breadcrumbRoot: 'Projects',
  tabs:           ['Overview', 'Line List', 'Changes', 'Validation', 'Reviews', 'Documents'],
  accent:         '#0f766e',   // enterprise teal (matches reference template)
};

// Status badge palette — keyed by computed row status.
const LL_STATUS_STYLES = {
  New:       { bg: 'rgba(59,130,246,0.10)',  fg: '#1d4ed8', border: 'rgba(59,130,246,0.28)'  },
  Changed:   { bg: 'rgba(245,158,11,0.12)',  fg: '#b45309', border: 'rgba(245,158,11,0.30)'  },
  Reviewed:  { bg: 'rgba(16,185,129,0.10)',  fg: '#047857', border: 'rgba(16,185,129,0.28)'  },
  Unchanged: { bg: 'rgba(100,116,139,0.08)', fg: '#475569', border: 'rgba(100,116,139,0.22)' },
  Error:     { bg: 'rgba(239,68,68,0.10)',   fg: '#b91c1c', border: 'rgba(239,68,68,0.28)'   },
  Warning:   { bg: 'rgba(245,158,11,0.14)',  fg: '#b45309', border: 'rgba(245,158,11,0.32)'  },
};

// Revision history (newest first). `live: true` marks the current working
// revision — its metadata is enriched at render time from the real extraction.
const LL_REVISIONS = [
  { rev: '03', status: 'In Review',          by: 'Process Lead',       note: 'Current extraction — pending engineering review', live: true },
  { rev: '02', status: 'Approved',           by: 'Engineering Manager', note: 'Issued for design — Phase 1 lines incorporated' },
  { rev: '01', status: 'Issued for Review',  by: 'Process Engineer',    note: 'First issue from P&ID base extraction' },
];

// Fields shown in the detail panel's "Engineering specifications" group.
const LL_SPEC_FIELDS = [
  { key: 'size',              label: 'Size' },
  { key: 'fluid_code',        label: 'Service code' },
  { key: 'fluid_description', label: 'Service description' },
  { key: 'sequence_no',       label: 'Sequence no.' },
  { key: 'piping_spec',       label: 'Piping specification' },
  { key: 'dept_deviation',    label: 'Dept deviation' },
  { key: 'insulation',        label: 'Insulation' },
  { key: 'insulation_desc',   label: 'Insulation description' },
];

// ─── AI Document Assist (Wrench) — soft-coded panel config ─────────────────
// Mirrors the pattern used on PID Verification / PMS / Instrument Index /
// CLL / PFD Quality Checker.  Flip `enabled: false` to hide without
// touching JSX.  Line List only consumes PDFs.
const LL_AI_ASSIST_CONFIG = {
  enabled:         false,   // "AI Document Assist" section hidden — flip to true to restore
  title:           'AI Document Assist',
  subtitleTag:     '(Wrench · optional)',
  subtitle:        'Let RAD AI pick & recommend the right P&ID PDF for this Line List from Wrench DMS',
  defaultHint:     'line list p&id',
  hintPlaceholder: 'e.g. line list, p&id, unit 100',
  topN:            5,
  acceptedExts:    ['pdf'],
};

// ---------------------------------------------------------------------------
// Soft-coded layout config — change widths/padding here without touching JSX.
// FULL CANVAS: mirrors P&ID Verification V1 (w-full + px-2/4/6), so the page
// uses the entire viewport instead of a centred 1280px column.
// ---------------------------------------------------------------------------
const LAYOUT_CONFIG = {
  // Normal mode: full-width canvas like PID Verification V1
  normalMaxWidth:      '100%',
  normalPaddingX:      '1.5rem',   // ~px-6 on desktop (inner wrapper also has mx-0)
  normalPaddingY:      '2rem',     // py-8
  // Fullscreen mode: fills the whole viewport
  fullscreenMaxWidth:  '100%',
  fullscreenPaddingX:  '2rem',
  fullscreenPaddingY:  '2rem',
};

// Helper — returns patience message based on elapsed time.
const getPatienceMsg = (secs) => {
  if (secs < 60)  return 'OCR extraction running in the background — usually 2–10 min for standard P&IDs.';
  if (secs < 60)  return 'OCR extraction running in the background — usually 2–10 min for standard P&IDs.';
  if (secs < 180) return 'Still working… multi-page or high-density P&IDs take longer. Please keep this tab open.';
  if (secs < 600) return `Running for ${Math.floor(secs/60)}m ${secs%60}s — complex drawings can take 10–30 min on the server. You can safely leave this tab open.`;
  return `Running for ${Math.floor(secs/60)}m ${secs%60}s — still processing. For very large files consider splitting into single-sheet P&IDs.`;
};

// ---------------------------------------------------------------------------
// SOFT-CODED: Project Organizer integration for Line List
// true = require a project before extraction (V1-style workspace);
// false = legacy single-shot mode (no projects).
// ---------------------------------------------------------------------------
const LL_PROJECTS = {
  enabled:    true,
  toolCode:   'pid_line_list',                 // matches moduleCode in engineeringStructure.config
  storageKey: 'lineListActiveProject',
  theme:      PROJECT_ORGANIZER_CONFIG.defaultTheme,
  createTitle:'New Line List Project',
};

const LL_LEGENDS = {
  enabled: true,                 // false → restore legacy manual legend upload card
  section: 'line_list',          // backend legend section (pidCheckerV2API.LEGEND_SECTIONS)
};

const LineList = () => {
  // ── Project Organizer state (soft-coded — see LL_PROJECTS) ─────────────
  const { activeProject, setActiveProject, hydrated: projHydrated } = useActiveProject(LL_PROJECTS.storageKey);
  const [projects, setProjects]               = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [projectBusy, setProjectBusy]         = useState(false);
  const [projectError, setProjectError]       = useState('');

  // State management
  const [pidDocument, setPidDocument] = useState(null);
  const [legendDocument, setLegendDocument] = useState(null);

  // ── Managed Legend Sheets (shared V1 system — soft-coded via LL_LEGENDS) ──
  const [legendModalOpen, setLegendModalOpen] = useState(false);
  const [activeLegend, setActiveLegend]       = useState(null);

  const refreshActiveLegend = useCallback(async () => {
    try {
      const rows = await listLegends(LL_LEGENDS.section);
      const list = rows || [];
      setActiveLegend(list.find(l => l.is_active) || null);
    } catch { /* non-fatal — legend is optional */ }
  }, []);

  // Stable handler for the modal's active-legend callback. MUST be a
  // useCallback — an inline arrow here is a new reference every render, which
  // retriggers the modal's refresh effect (its `refresh` depends on this) and
  // caused the legends endpoint to be hammered in a loop ("bouncing" UI).
  const handleLegendActiveChange = useCallback((legend) => {
    setActiveLegend(legend);
    refreshActiveLegend();
  }, [refreshActiveLegend]);

  useEffect(() => { if (LL_LEGENDS.enabled) refreshActiveLegend(); }, [refreshActiveLegend]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [extractedData, setExtractedData] = useState(null);
  const [error, setError] = useState(null);
  const [formatType, setFormatType] = useState('general');
  const [includeArea, setIncludeArea] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isFullscreen, setIsFullscreen]     = useState(false);
  // Per-page progress from backend (null until backend reports the first page)
  // Shape: { currentPage, totalPages, linesSoFar, phase }
  const [pageInfo, setPageInfo] = useState(null);
  // Rotating tip index for processing card
  const [procTipIdx, setProcTipIdx] = useState(0);

  // ── Enterprise register UI state (design layer only) ────────────────────
  // None of this feeds extraction / polling / export — it only shapes how
  // completed results are presented and interacted with.
  const [regTab, setRegTab]             = useState('Line List');
  const [regSearch, setRegSearch]       = useState('');
  const [regFilters, setRegFilters]     = useState({ fluid_code: '', status: '', insulation: '', pid_no: '' });
  const [regPage, setRegPage]           = useState(1);
  const [regSelectedRow, setRegSelectedRow] = useState(null);   // row object reference
  const [regChecked, setRegChecked]     = useState(() => new Set());
  const [regActionsOpen, setRegActionsOpen] = useState(false);
  const [regExtraRows, setRegExtraRows] = useState([]);         // added / imported lines (UI layer)
  const [regOverrides, setRegOverrides] = useState(() => new Map()); // row → status after review actions
  const [regDetailTab, setRegDetailTab] = useState('Details');
  const regImportRef = useRef(null);

  // ── Edit-line modal state ──
  const [regEditRow, setRegEditRow]   = useState(null);   // row being edited
  const [regEditForm, setRegEditForm] = useState({});

  // ── View switch: 'extract' = upload/processing workspace, 'register' = results page
  // Auto-switches to the register when extraction completes; the register
  // header offers "New extraction" to go back without losing results.
  const [regView, setRegView] = useState('extract');
  useEffect(() => { if (extractedData) setRegView('register'); }, [extractedData]);

  // ── Saved outputs (persist & re-download later) ─────────────────────────
  // Uses the existing backend endpoints: save_output / previous_outputs /
  // download_output / output_data. Fail-safe: saving never blocks export.
  const [savedOutputs, setSavedOutputs]     = useState([]);
  const [savedLoading, setSavedLoading]     = useState(false);
  const [savedOpen, setSavedOpen]           = useState(false);
  const [savedNotice, setSavedNotice]       = useState('');
  const [savedBusyId, setSavedBusyId]       = useState(null);

  const fetchSavedOutputs = useCallback(async () => {
    setSavedLoading(true);
    try {
      const { data } = await apiClient.get('/designiq/lists/previous_outputs/', { params: { list_type: 'line_list' } });
      setSavedOutputs(data?.outputs || []);
    } catch { setSavedOutputs([]); }
    finally { setSavedLoading(false); }
  }, []);

  useEffect(() => { fetchSavedOutputs(); }, [fetchSavedOutputs]);
  useEffect(() => {
    if (!savedNotice) return;
    const t = setTimeout(() => setSavedNotice(''), 6000);
    return () => clearTimeout(t);
  }, [savedNotice]);

  // Download a previously saved output (blob → browser download)
  const downloadSavedOutput = useCallback(async (output) => {
    setSavedBusyId(output.id);
    try {
      const resp = await apiClient.get(`/designiq/lists/download_output/${output.id}/`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([resp.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = output.excel_filename || `line_list_${output.id}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch { setError('Download failed — the saved file may no longer exist.'); }
    finally { setSavedBusyId(null); }
  }, []);

  // Load a saved output back into the register view (no re-extraction needed)
  const openSavedOutput = useCallback(async (output) => {
    setSavedBusyId(output.id);
    try {
      const { data } = await apiClient.get(`/designiq/lists/output_data/${output.id}/`);
      const headers = (data.headers || []).map(h => String(h).trim().toLowerCase());
      const rows = (data.rows || []).map(r => {
        const obj = {};
        COLUMNS.forEach(c => {
          const i = headers.indexOf(c.label.toLowerCase());
          if (i >= 0 && r[i] !== '' && r[i] != null) obj[c.key] = r[i];
        });
        return obj;
      });
      setRegExtraRows([]);
      setRegOverrides(new Map());
      setRegChecked(new Set());
      setRegSelectedRow(null);
      setRegSearch('');
      setRegFilters({ fluid_code: '', status: '', insulation: '', pid_no: '' });
      setRegPage(1);
      setExtractedData({
        success: true,
        total_lines: rows.length,
        columns: COLUMNS.length,
        data: rows,
        message: `Loaded saved output: ${output.excel_filename}`,
      });
      setSavedOpen(false);
    } catch { setError('Could not load the saved output.'); }
    finally { setSavedBusyId(null); }
  }, []);

  // Persist the current workbook server-side (called automatically on export)
  const saveOutputToServer = useCallback(async (wb, filename) => {
    if (!extractedData?.data?.length) return;
    try {
      const wbArray = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const fd = new FormData();
      fd.append('excel_file', blob, filename);
      fd.append('pid_number', extractedData.data.find(r => r.pid_no)?.pid_no || pidDocument?.name || 'Line List');
      fd.append('list_type', 'line_list');
      fd.append('format_type', formatType);
      fd.append('total_lines', String(extractedData.total_lines ?? extractedData.data.length));
      fd.append('total_columns', String(COLUMNS.length));
      await apiClient.post('/designiq/lists/save_output/', fd);
      setSavedNotice('Output saved — re-download anytime from Saved outputs.');
      fetchSavedOutputs();
    } catch (e) {
      console.warn('[LineList] save_output failed (download unaffected):', e);
    }
  }, [extractedData, pidDocument, formatType, fetchSavedOutputs]);

  const pidRef = useRef(null);
  const legendRef = useRef(null);
  const pollTimerRef = useRef(null);
  const pollStartRef = useRef(null);
  const elapsedTimerRef = useRef(null);

  // ── RADAI Chat context — publish the current page's data so the floating
  // assistant can answer questions about it. Re-publishes whenever the
  // extracted rows, uploaded P&ID, or active project change; clears on unmount.
  useEffect(() => {
    const rows = extractedData?.data || [];
    publishChatContext({
      page: 'Line List',
      domain_prompt: CHAT_PAGE_PROFILES.line_list.domainPrompt,
      row_name: CHAT_PAGE_PROFILES.line_list.rowName,
      project: activeProject
        ? { id: activeProject.project_id, name: activeProject.name || '', code: activeProject.code || '' }
        : null,
      document: pidDocument
        ? { name: pidDocument.name, type: 'P&ID PDF', sizeLabel: `${(pidDocument.size / 1024 / 1024).toFixed(2)} MB` }
        : null,
      columns: COLUMNS.map(c => ({ key: c.key, label: c.label })),
      rows,
      row_count: extractedData?.total_lines ?? rows.length,
      summary: extractedData ? {
        total_lines: extractedData.total_lines,
        columns: extractedData.columns,
        format: formatType,
      } : null,
      notes: 'Line list extracted from a P&ID. Columns: ' + COLUMNS.map(c => c.label).join(', '),
    })
    return () => clearChatContext()
  }, [extractedData, pidDocument, activeProject, formatType])

  // -------------------------------------------------------------------------
  // File selection
  // -------------------------------------------------------------------------
  const handlePIDSelect = async (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      // Soft-coded page limit (LL_UPLOAD_RULES.maxPages) — client-side guard
      const pages = await countPdfPages(file);
      if (LL_UPLOAD_RULES.enabled && pages !== null && pages > LL_UPLOAD_RULES.maxPages) {
        setPidDocument(null);
        setError(`This PDF has ${pages} pages — the maximum is ${LL_UPLOAD_RULES.maxPages} pages per upload. Please split the document and try again.`);
        return;
      }
      setPidDocument(file);
      setError(null);
      setExtractedData(null);
    } else {
      setError('Please select a valid PDF file');
    }
  };

  const handleLegendSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setLegendDocument(file);
      setError(null);
    } else if (file) {
      setError('Legend file must be a PDF');
    }
  };

  // -------------------------------------------------------------------------
  // Elapsed-time ticker (runs while processing, so users know it's alive)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (isProcessing) {
      setElapsedSeconds(0);
      elapsedTimerRef.current = setInterval(() => {
        setElapsedSeconds(s => s + 1);
      }, 1000);
    } else {
      clearInterval(elapsedTimerRef.current);
    }
    return () => clearInterval(elapsedTimerRef.current);
  }, [isProcessing]);

  // -------------------------------------------------------------------------
  // Project Organizer — load projects + handlers (soft-coded via LL_PROJECTS)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!LL_PROJECTS.enabled) { setLoadingProjects(false); return; }
    let live = true;
    (async () => {
      try {
        const items = await projectOrganizerService.listProjects();
        if (live) setProjects(items);
      } catch {
        if (live) setProjectError('Failed to load projects');
      } finally {
        if (live) setLoadingProjects(false);
      }
    })();
    return () => { live = false; };
  }, []);

  const handleCreateProject = async (payload) => {
    setProjectBusy(true); setProjectError('');
    try {
      const p = await projectOrganizerService.createProject(payload);
      setProjects(prev => [p, ...prev]);
      setShowCreateProject(false);
      setActiveProject(p);
    } catch (e) {
      setProjectError(e?.response?.data?.error || 'Failed to create project');
    } finally {
      setProjectBusy(false);
    }
  };

  // Fire-and-forget cross-tool activity log (never blocks extraction UX)
  const logExtractionActivity = (fileName, lineCount) => {
    if (!LL_PROJECTS.enabled || !activeProject) return;
    projectOrganizerService.logProjectActivity(activeProject.project_id, {
      toolCode: LL_PROJECTS.toolCode,
      summary: `Line list extracted from "${fileName}" — ${lineCount} line${lineCount === 1 ? '' : 's'}`,
      metadata: { file: fileName, lines: lineCount, format: formatType },
    }).catch(() => {});
  };

  // Friendly elapsed-time string e.g. "2m 34s"
  const formatElapsed = (secs) => {
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  };

  // Rotate tips while processing
  useEffect(() => {
    if (!isProcessing) return;
    const id = setInterval(
      () => setProcTipIdx(i => (i + 1) % LL_PROC_TIPS.length),
      LL_PROC_TIP_ROTATE_MS,
    );
    return () => clearInterval(id);
  }, [isProcessing]);

  // -------------------------------------------------------------------------
  // Polling helper
  // -------------------------------------------------------------------------
  const pollStatus = useCallback((taskId) => {
    if (Date.now() - pollStartRef.current > POLL_MAX_WAIT_MS) {
      clearTimeout(pollTimerRef.current);
      const waited = Math.round(POLL_MAX_WAIT_MS / 60000);
      setError(
        `Extraction is taking longer than ${waited} minutes. The server is still working — ` +
        `please refresh the page and try again, or contact support if the problem persists. ` +
        `(Tip: reduce PDF size or split into single-sheet P&IDs for faster results.)`
      );
      setIsProcessing(false);
      return;
    }

    apiClient
      .get(`/designiq/lists/base_extraction_status/${taskId}/`, { timeout: POLL_REQ_TIMEOUT })
      .then(({ data }) => {
        const state = data.state || data.status;

        if (state === 'SUCCESS') {
          clearTimeout(pollTimerRef.current);
          setProgress(100);
          setStatusMessage('Extraction complete!');
          setExtractedData(data.result);
          setIsProcessing(false);
          logExtractionActivity(pidDocument?.name || 'P&ID', data.result?.lines?.length ?? 0);

        } else if (state === 'FAILURE') {
          clearTimeout(pollTimerRef.current);
          setError(data.error || 'Extraction failed on the server.');
          setIsProcessing(false);

        } else {
          // PENDING or PROGRESS — keep polling
          setProgress(data.percent || 0);
          setStatusMessage(data.status || 'Processing…');
          // Capture richer backend fields (per-page tracker). Optional — only
          // set when the backend actually reports them, so we never flash an
          // empty tracker on an older server.
          if (data.current_page && data.total_pages) {
            setPageInfo({
              currentPage: data.current_page,
              totalPages:  data.total_pages,
              linesSoFar:  data.lines_so_far ?? 0,
              phase:       data.phase || 'start',
            });
          }
          pollTimerRef.current = setTimeout(() => pollStatus(taskId), POLL_INTERVAL_MS);
        }
      })
      .catch((err) => {
        console.error('Poll error:', err);
        // Network blip — retry rather than fail immediately
        pollTimerRef.current = setTimeout(() => pollStatus(taskId), POLL_INTERVAL_MS * 2);
      });
  }, []);

  // -------------------------------------------------------------------------
  // Submit extraction job — uses native fetch + AbortController so the
  // UPLOAD_TIMEOUT_MS deadline is enforced regardless of Axios instance
  // settings or api.service.js interceptor behaviour.
  // -------------------------------------------------------------------------
  const handleExtract = async () => {
    if (!pidDocument) {
      setError('Please upload a P&ID document first');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setExtractedData(null);
    setProgress(0);
    setPageInfo(null);
    setStatusMessage('Uploading P&ID…');

    // Build FormData (same fields used by the backend)
    const formData = new FormData();
    formData.append('pid_file', pidDocument);
    formData.append('format_type', formatType);
    formData.append('include_area', includeArea);
    // Soft-coded: project label so the backend archives source + output to the
    // project's S3 folder (s3_utils ARCHIVE layout)
    if (activeProject) {
      formData.append('project_code', activeProject.code || '');
      formData.append('project_name', activeProject.name || '');
    }
    if (legendDocument) {
      formData.append('legend_file', legendDocument);
    }

    // JWT token for Authorization header
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);

    // Determine the full upload URL (relative for local, absolute for prod)
    // SOFT-CODED: API_BASE comes from environments.json → backend.api_url
    const uploadUrl = `${API_BASE}/designiq/lists/base_extraction/`;
    console.log(`[LineList] upload URL: ${uploadUrl}  timeout: ${UPLOAD_TIMEOUT_MS}ms`);

    // ------------------------------------------------------------------
    // Smart retry loop — up to MAX_POST_RETRIES attempts with exponential
    // back-off.  Each attempt is independently aborted after UPLOAD_TIMEOUT_MS
    // using the AbortController API (browser-native, cannot be overridden).
    // SOFT-CODED: MAX_POST_RETRIES, POST_RETRY_BASE_MS from environments.json
    // ------------------------------------------------------------------
    let lastErr = null;

    for (let attempt = 1; attempt <= MAX_POST_RETRIES; attempt++) {
      if (attempt > 1) {
        // Exponential back-off: 4 s, 8 s, …
        const delay = POST_RETRY_BASE_MS * Math.pow(2, attempt - 2);
        setStatusMessage(
          `Retrying upload (attempt ${attempt}/${MAX_POST_RETRIES})… waiting ${Math.round(delay / 1000)}s`
        );
        await new Promise((r) => setTimeout(r, delay));
      }

      setStatusMessage(
        attempt === 1
          ? 'Uploading P&ID…'
          : `Sending request (attempt ${attempt}/${MAX_POST_RETRIES})…`
      );

      // AbortController gives us a true hard deadline — no Axios involved
      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

      try {
        const fetchResp = await fetch(uploadUrl, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
          signal: controller.signal,
        });
        clearTimeout(abortTimer);

        if (!fetchResp.ok) {
          // HTTP error — read body for detail
          let errDetail = `HTTP ${fetchResp.status}`;
          try {
            const errJson = await fetchResp.json();
            errDetail = errJson.error || errJson.detail || errDetail;
          } catch (_) { /* ignore parse error */ }
          throw Object.assign(new Error(errDetail), { isHttpError: true, status: fetchResp.status });
        }

        const data = await fetchResp.json();

        // EAGER mode (local dev): synchronous result returned with HTTP 200
        if (fetchResp.status === 200 && data.success) {
          setExtractedData(data);
          setProgress(100);
          setStatusMessage('Extraction complete!');
          setIsProcessing(false);
          logExtractionActivity(pidDocument?.name || 'P&ID', data?.lines?.length ?? 0);
          return;
        }

        // Async mode (production): HTTP 202 with task_id — start polling
        const { task_id } = data;
        if (!task_id) {
          throw new Error('Server did not return a task_id. Please try again.');
        }

        console.log(`[LineList] task dispatched: ${task_id} (mode: ${data.dispatch_mode || 'unknown'})`);
        setStatusMessage('Processing in background — checking progress…');
        pollStartRef.current = Date.now();
        pollStatus(task_id);
        return; // SUCCESS — exit retry loop

      } catch (err) {
        clearTimeout(abortTimer);
        lastErr = err;

        const isAborted   = err.name === 'AbortError';
        const isNetworkErr = err instanceof TypeError && err.message.includes('fetch');
        const isRetryable  = isAborted || isNetworkErr;

        if (isAborted) {
          console.warn(
            `[LineList] attempt ${attempt}: upload aborted after ${UPLOAD_TIMEOUT_MS}ms`
          );
        } else {
          console.warn(`[LineList] attempt ${attempt} failed:`, err.message || err);
        }

        if (!isRetryable || attempt === MAX_POST_RETRIES) break;
        // Otherwise loop for the next attempt
      }
    }

    // All retries exhausted — show a user-friendly message
    console.error('[LineList] upload failed after all retries:', lastErr);
    const isTimeout = lastErr?.name === 'AbortError';
    const friendlyMsg =
      (isTimeout
        ? `Upload timed out after ${Math.round(UPLOAD_TIMEOUT_MS / 1000)}s — the server is busy. Please try again.`
        : null) ||
      lastErr?.message ||
      'Extraction failed — please try again.';
    setError(friendlyMsg);
    setIsProcessing(false);
  };

  // -------------------------------------------------------------------------
  // Export to Excel
  // -------------------------------------------------------------------------
  const handleExport = () => {
    if (!extractedData?.data) return;

    // Derive headers + row values from the soft-coded COLUMNS array for easy extensibility.
    const headers = COLUMNS.map(c => c.label);

    const wsData = [
      headers,
      ...extractedData.data.map(item =>
        COLUMNS.map(c => resolveCellValue(item, c) || '')
      ),
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    const colWidths = COLUMNS.map((col, colIndex) => {
      let maxWidth = col.label.length;
      for (let rowIndex = 1; rowIndex < wsData.length; rowIndex++) {
        const cellValue = wsData[rowIndex][colIndex];
        if (cellValue) maxWidth = Math.max(maxWidth, String(cellValue).length);
      }
      return { wch: Math.min(Math.max(maxWidth + 2, col.width ?? 12), 60) };
    });
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Line List');
    XLSX.writeFile(wb, 'line_list_base_extraction.xlsx');
    // Persist a copy server-side so it can be re-downloaded later (fail-safe —
    // the local download above has already happened and is never affected).
    saveOutputToServer(wb, 'line_list_base_extraction.xlsx');
  };

  // -------------------------------------------------------------------------
  // Enterprise register — derived data + UI-only handlers (design layer)
  // -------------------------------------------------------------------------

  // Data-quality driven status: Error = unusable row, Warning = incomplete
  // FROM/TO, otherwise Reviewed. Review actions can override per row.
  const getLineStatus = useCallback((row) => {
    const override = regOverrides.get(row);
    if (override) return override;
    if (row.__added) return 'New';
    if (!row.original_detection || !row.size) return 'Error';
    const from = row.from_line || row.from_equipment || row.from;
    const to   = row.to_line   || row.to_equipment   || row.to;
    if (!from || !to) return 'Warning';
    return 'Reviewed';
  }, [regOverrides]);

  // Data-quality issues for a row — drives the Validation tab + detail alerts.
  const getLineIssues = useCallback((row) => {
    const issues = [];
    if (!row.original_detection) issues.push('Missing line designation');
    if (!row.size)               issues.push('Missing size');
    if (!(row.from_line || row.from_equipment || row.from)) issues.push('FROM not detected');
    if (!(row.to_line   || row.to_equipment   || row.to))   issues.push('TO not detected');
    if (!row.piping_spec)        issues.push('Missing piping specification');
    return issues;
  }, []);

  const regAllRows = extractedData?.data ? [...extractedData.data, ...regExtraRows] : [];

  // Distinct filter options derived from live data.
  const regFilterOptions = {
    fluid_code: [...new Set(regAllRows.map(r => r.fluid_code).filter(Boolean))].sort(),
    insulation: [...new Set(regAllRows.map(r => r.insulation).filter(Boolean))].sort(),
    pid_no:     [...new Set(regAllRows.map(r => r.pid_no).filter(Boolean))].sort(),
  };

  const regQuery = regSearch.trim().toLowerCase();
  const regRows = regAllRows.filter(row => {
    const status = getLineStatus(row);
    if (regFilters.status     && status !== regFilters.status) return false;
    if (regFilters.fluid_code && row.fluid_code !== regFilters.fluid_code) return false;
    if (regFilters.insulation && row.insulation !== regFilters.insulation) return false;
    if (regFilters.pid_no     && row.pid_no     !== regFilters.pid_no)     return false;
    if (regQuery) {
      const haystack = COLUMNS.map(c => resolveCellValue(row, c)).join(' ').toLowerCase();
      if (!haystack.includes(regQuery)) return false;
    }
    return true;
  });

  const regTotalPages = Math.max(1, Math.ceil(regRows.length / LL_REGISTER.pageSize));
  const regPageSafe   = Math.min(regPage, regTotalPages);
  const regPageRows   = regRows.slice((regPageSafe - 1) * LL_REGISTER.pageSize, regPageSafe * LL_REGISTER.pageSize);

  // KPI counts across ALL rows (unfiltered) so cards stay stable while filtering.
  const regKpis = regAllRows.reduce((acc, row) => {
    const s = getLineStatus(row);
    acc.total += 1;
    if (s === 'New')     acc.newCount += 1;
    if (s === 'Error')   acc.errors += 1;
    if (s === 'Warning') acc.warnings += 1;
    if (s === 'Changed') acc.changed += 1;
    return acc;
  }, { total: 0, newCount: 0, errors: 0, warnings: 0, changed: 0 });
  regKpis.reviewPending = regKpis.errors + regKpis.warnings + regKpis.newCount + regKpis.changed;

  const regResetPage = () => setRegPage(1);

  const handleRegAddLine = () => {
    const row = { __added: true, original_detection: `NEW-LINE-${String(regExtraRows.length + 1).padStart(3, '0')}` };
    setRegExtraRows(prev => [...prev, row]);
    setRegSelectedRow(row);
    setRegDetailTab('Details');
    setRegActionsOpen(false);
  };

  // Import CSV/XLSX — maps columns by matching the register's column labels.
  // Purely additive to the UI layer; the extraction pipeline is untouched.
  const handleRegImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setRegActionsOpen(false);
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf);
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (aoa.length < 2) { setError('Import file has no data rows.'); return; }
      const headers = aoa[0].map(h => String(h).trim().toLowerCase());
      const imported = aoa.slice(1)
        .filter(r => r.some(c => String(c).trim() !== ''))
        .map(r => {
          const obj = { __added: true };
          COLUMNS.forEach(c => {
            const i = headers.indexOf(c.label.toLowerCase());
            if (i >= 0 && r[i] !== '') obj[c.key] = r[i];
          });
          return obj;
        });
      if (!imported.length) { setError('Import failed — no rows matched the register column headers.'); return; }
      setRegExtraRows(prev => [...prev, ...imported]);
      setError(null);
    } catch {
      setError('Import failed — please provide a CSV/XLSX with the register column headers.');
    }
  };

  const handleRegReviewRow = (row) => {
    setRegOverrides(prev => new Map(prev).set(row, 'Reviewed'));
    setSavedNotice(`"${row.original_detection || 'Line'}" marked as Reviewed.`);
  };

  // Open the edit modal prefilled with the row's current values
  const handleRegEditOpen = (row) => {
    const form = {};
    COLUMNS.forEach(c => { form[c.key] = resolveCellValue(row, c) || ''; });
    setRegEditForm(form);
    setRegEditRow(row);
  };

  // Save edits in place (object identity preserved → selection, overrides and
  // checkboxes keep working). Edited rows are flagged 'Changed' for review.
  const handleRegEditSave = () => {
    if (!regEditRow) return;
    Object.keys(regEditForm).forEach(k => { regEditRow[k] = regEditForm[k]; });
    if (regEditRow.__added) {
      setRegExtraRows(prev => [...prev]);
    } else if (extractedData) {
      setExtractedData({ ...extractedData, data: [...extractedData.data] });
    }
    setRegOverrides(prev => new Map(prev).set(regEditRow, 'Changed'));
    setRegEditRow(null);
    setSavedNotice(`"${regEditForm.original_detection || 'Line'}" updated — marked as Changed for review.`);
  };

  const regToggleCheck = (row) => {
    setRegChecked(prev => {
      const next = new Set(prev);
      if (next.has(row)) next.delete(row); else next.add(row);
      return next;
    });
  };

  const regToggleAllOnPage = () => {
    setRegChecked(prev => {
      const next = new Set(prev);
      const allChecked = regPageRows.every(r => next.has(r));
      regPageRows.forEach(r => { if (allChecked) next.delete(r); else next.add(r); });
      return next;
    });
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  // ── PROJECT GATE — V1-style workspace: select/create a project first ─────
  // SOFT-CODED: disable via LL_PROJECTS.enabled = false (legacy single-shot).
  if (LL_PROJECTS.enabled && (!projHydrated || loadingProjects)) {
    return <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f8faff 0%, #eef2ff 45%, #f0f9ff 75%, #fffbeb 100%)' }} />;
  }

  if (LL_PROJECTS.enabled && !activeProject) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f8faff 0%, #eef2ff 45%, #f0f9ff 75%, #fffbeb 100%)', padding: '32px 24px' }}>
        <div className="w-full" style={{ maxWidth: 1400, margin: '0 auto' }}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)', boxShadow: '0 4px 14px rgba(59,130,246,0.3)' }}>
              <DocumentTextIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900" style={{ margin: 0 }}>Line List — Project Workspace</h1>
              <p className="text-sm text-slate-500" style={{ margin: 0 }}>Select or create a project to organise your P&ID line-list extractions.</p>
            </div>
          </div>

          <div className="mt-6 mb-5">
            <button onClick={() => setShowCreateProject(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl transition-all hover:-translate-y-px"
              style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)', boxShadow: '0 4px 12px rgba(59,130,246,0.25)', border: 'none', cursor: 'pointer' }}>
              <FolderPlusIcon className="h-4 w-4" /> New Project
            </button>
          </div>

          {projectError && (
            <div role="alert" className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b' }}>
              {projectError}
            </div>
          )}

          {projects.length === 0 ? (
            <div className="rounded-2xl p-16 text-center" style={{ background: '#fff', border: '1px dashed rgba(59,130,246,0.3)' }}>
              <FolderIcon className="h-12 w-12 mx-auto mb-3" style={{ color: '#3b82f6', opacity: 0.45 }} />
              <h2 className="text-lg font-bold text-slate-900" style={{ margin: 0 }}>No projects yet</h2>
              <p className="text-sm text-slate-500 mt-1">Create your first project to start extracting line lists.</p>
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
              {projects.map(p => (
                <ProjectCard key={p.project_id} project={p} theme={LL_PROJECTS.theme}
                  onOpen={() => setActiveProject(p)} />
              ))}
            </div>
          )}

          {showCreateProject && (
            <ProjectFormModal theme={LL_PROJECTS.theme} busy={projectBusy}
              onClose={() => setShowCreateProject(false)} onSubmit={handleCreateProject} />
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes ll-scan-line {
          0%   { top: 0%;   opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes ll-float {
          0%, 100% { transform: translateY(0)    scale(1);   opacity: 0.15; }
          50%       { transform: translateY(-20px) scale(1.2); opacity: 0.38; }
        }
        @keyframes ll-glow {
          0%, 100% { box-shadow: 0 0 7px  rgba(37,99,235,0.2); }
          50%       { box-shadow: 0 0 20px rgba(37,99,235,0.42), 0 0 40px rgba(37,99,235,0.1); }
        }
        @keyframes ll-shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        @keyframes ll-row-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ll-fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ll-bar-glow {
          0%, 100% { filter: brightness(1); }
          50%       { filter: brightness(1.2) drop-shadow(0 0 5px rgba(37,99,235,0.5)); }
        }
        @keyframes ll-dot-wave {
          0%, 100% { transform: scaleY(0.5); opacity: 0.4; }
          50%       { transform: scaleY(1.5); opacity: 1; }
        }
        @keyframes ll-spin-slow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes ll-pulse-badge {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.55; }
        }
        @keyframes ll-fs-in {
          from { opacity: 0; transform: scale(0.98); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes ll-hero-shift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes ll-orbit {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes ll-blob {
          0%, 100% { transform: translate(0,0) scale(1); }
          33%      { transform: translate(18px,-12px) scale(1.08); }
          66%      { transform: translate(-14px,10px) scale(0.95); }
        }
        .ll-hero-animated {
          background-size: 240% 240%;
          animation: ll-hero-shift 12s ease infinite;
        }
        .ll-fullscreen-wrap {
          position: fixed; inset: 0; z-index: 9990;
          overflow-y: auto;
          animation: ll-fs-in 0.2s ease both;
        }
        .ll-scan-line {
          position: absolute; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent, rgba(37,99,235,0.4), transparent);
          animation: ll-scan-line 3.2s ease-in-out infinite;
          pointer-events: none;
        }
        .ll-particle {
          position: absolute; border-radius: 50%;
          background: rgba(37,99,235,0.28);
          animation: ll-float ease-in-out infinite;
        }
        .ll-row-animate {
          animation: ll-row-in 0.3s ease forwards;
          opacity: 0;
        }
        .ll-section { animation: ll-fade-up 0.5s ease both; }
      `}</style>

      {/* Light blue/indigo gradient page — wraps in fixed overlay when fullscreen
          SOFT-CODED: background aligned with P&ID Verification V1 (T.bg) */}
      <div
        className={`min-h-screen relative overflow-x-hidden${isFullscreen ? ' ll-fullscreen-wrap' : ''}`}
        style={{ background: 'linear-gradient(135deg, #f8faff 0%, #eef2ff 45%, #f0f9ff 75%, #fffbeb 100%)' }}
      >

        {/* Subtle dot grid */}
        <div className="fixed inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(37,99,235,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.04) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
        }} />

        {/* Ambient particles */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {[
            { l: '5%',  t: '16%', s: 4, d: '0s',   dur: '3.5s' },
            { l: '14%', t: '70%', s: 5, d: '0.8s', dur: '4.3s' },
            { l: '65%', t: '11%', s: 3, d: '1.2s', dur: '4.0s' },
            { l: '82%', t: '55%', s: 6, d: '0.4s', dur: '4.8s' },
            { l: '48%', t: '80%', s: 4, d: '1.9s', dur: '3.7s' },
            { l: '90%', t: '30%', s: 3, d: '2.1s', dur: '5.0s' },
          ].map((p, i) => (
            <div key={i} className="ll-particle" style={{
              left: p.l, top: p.t, width: p.s, height: p.s,
              animationDelay: p.d, animationDuration: p.dur,
            }} />
          ))}
        </div>

        <div
          className="relative z-10"
          style={{
            maxWidth:  isFullscreen ? LAYOUT_CONFIG.fullscreenMaxWidth : LAYOUT_CONFIG.normalMaxWidth,
            padding:   `${isFullscreen ? LAYOUT_CONFIG.fullscreenPaddingY : LAYOUT_CONFIG.normalPaddingY} ${isFullscreen ? LAYOUT_CONFIG.fullscreenPaddingX : LAYOUT_CONFIG.normalPaddingX}`,
          }}
        >

          {/* ── Page Header — V1-style light card (soft-coded; flip LL_HEADER_STYLE to 'dark' for legacy banner) ── */}
          <div className="mb-8 ll-section" style={{ animationDelay: '0s' }}>
          {LL_HEADER_STYLE === 'v1' ? (
            /* ═══ V1 LIGHT HEADER — identical layout to P&ID Verification V1 ═══ */
            <div className="rounded-2xl" style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.03) 0%, rgba(99,102,241,0.06) 100%)',
              border: '1px solid #e2e8f0',
              padding: '32px',
            }}>
              <div className="flex items-start justify-between gap-6 flex-wrap">
                {/* Left: Icon + Title + Description + feature pills */}
                <div className="flex items-start gap-5 flex-1" style={{ minWidth: 0 }}>
                  {/* Icon tile — V1 blue→indigo gradient */}
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '14px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                    boxShadow: '0 4px 14px rgba(59,130,246,0.3)',
                  }}>
                    <DocumentTextIcon className="h-5 w-5 text-white" />
                  </div>

                  <div className="flex-1" style={{ minWidth: 0 }}>
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight" style={{ margin: 0, lineHeight: 1.2 }}>
                        {LL_HEADER.title}
                      </h1>
                      {/* Status badge — V1 pattern */}
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
                        background: `${LL_HEADER.badgeColor}15`, color: LL_HEADER.badgeColor,
                        border: `1px solid ${LL_HEADER.badgeColor}30`,
                      }}>
                        <CheckCircleIcon className="h-3.5 w-3.5" />
                        {LL_HEADER.badgeText}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.95rem', color: '#64748b', margin: 0, maxWidth: '680px', lineHeight: 1.6 }}>
                      {LL_HEADER.subtitle}
                    </p>

                    {/* Feature pills — V1 colour-coded */}
                    <div className="flex flex-wrap gap-2 mt-4">
                      {LL_HEADER.featureBadges.map((b) => (
                        <span key={b.label} style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          padding: '6px 14px', borderRadius: '20px',
                          fontSize: '0.75rem', fontWeight: 500,
                          background: `${b.color}08`, color: b.color, border: `1px solid ${b.color}20`,
                        }}>
                          {b.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right: project chip + fullscreen toggle + quick stats — V1 pattern */}
                <div className="flex items-center gap-4 flex-wrap">
                  {LL_PROJECTS.enabled && activeProject && (
                    <button onClick={() => setActiveProject(null)}
                      title="Switch project"
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-all">
                      <FolderIcon className="h-4 w-4" />
                      <span className="max-w-[180px] truncate">{activeProject.name || activeProject.code || 'Project'}</span>
                      <span className="text-blue-400">·</span>
                      <span className="text-blue-500">Switch</span>
                    </button>
                  )}
                  <button
                    onClick={() => setIsFullscreen(fs => !fs)}
                    title={isFullscreen ? 'Exit fullscreen' : 'Expand to fullscreen'}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 shadow-sm transition-all"
                  >
                    {isFullscreen
                      ? <><ArrowsPointingInIcon className="h-4 w-4" /> Exit</>
                      : <><ArrowsPointingOutIcon className="h-4 w-4" /> Fullscreen</>}
                  </button>
                  <div className="flex gap-6">
                    <div className="text-center">
                      <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#3b82f6', lineHeight: 1 }}>{COLUMNS.length}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Columns</div>
                    </div>
                    <div className="text-center">
                      <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#10b981', lineHeight: 1 }}>{FORMAT_OPTIONS.length}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Formats</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              className="ll-hero-animated relative overflow-hidden rounded-3xl px-7 py-8 text-white"
              style={{
                background: LL_HERO.gradient,
                boxShadow: '0 18px 48px -16px rgba(37,99,235,0.45)',
              }}
            >
              {/* Ambient glow blobs */}
              <div className="absolute inset-0 pointer-events-none" style={{ background: LL_HERO.accentGlow }} />
              <div className="absolute -top-10 -left-8 w-52 h-52 rounded-full pointer-events-none"
                style={{ background: 'rgba(96,165,250,0.35)', filter: 'blur(42px)', animation: 'll-blob 10s ease infinite' }} />
              <div className="absolute -bottom-12 right-4 w-60 h-60 rounded-full pointer-events-none"
                style={{ background: 'rgba(167,139,250,0.3)', filter: 'blur(52px)', animation: 'll-blob 13s ease-in-out infinite reverse' }} />

              {/* Badge */}
              <div className="relative flex items-center justify-between gap-4 flex-wrap">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
                  style={{ background: LL_HERO.chipBg, border: LL_HERO.chipBorder, backdropFilter: 'blur(6px)' }}>
                  <span className="w-2 h-2 rounded-full bg-white" style={{ animation: 'll-pulse-badge 2s ease infinite' }} />
                  <span className="text-[10px] font-semibold tracking-[0.22em] uppercase">AI-Powered · P&amp;ID Analysis</span>
                </div>
                <button
                  onClick={() => setIsFullscreen(fs => !fs)}
                  title={isFullscreen ? 'Exit fullscreen' : 'Expand to fullscreen'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{
                    background: LL_HERO.chipBg,
                    border: LL_HERO.chipBorder,
                    color: 'white',
                    backdropFilter: 'blur(6px)',
                    transition: 'all 0.2s',
                  }}
                >
                  {isFullscreen
                    ? <><ArrowsPointingInIcon className="h-4 w-4" /> Exit Fullscreen</>
                    : <><ArrowsPointingOutIcon className="h-4 w-4" /> Fullscreen</>
                  }
                </button>
              </div>

              {/* Title + description */}
              <div className="relative mt-5 flex items-center gap-4">
                <div className="p-3 rounded-2xl flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.25)', animation: 'll-glow 3s ease infinite' }}>
                  <DocumentTextIcon className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
                    Line <span className="text-amber-300">List</span>
                  </h1>
                  <p className="text-white/80 text-sm md:text-base leading-relaxed max-w-2xl mt-1">
                    Extract <span className="font-semibold text-white">{COLUMNS.length} columns</span> from P&amp;ID drawings —
                    line designation, service codes, piping spec, and FROM→TO flow. Upload an optional legend sheet to resolve code descriptions.
                  </p>
                </div>
              </div>

              {/* Capability chips */}
              <div className="relative mt-6 flex flex-wrap gap-2">
                {LL_HERO_CHIPS.map(chip => (
                  <span key={chip.label}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                    style={{ background: LL_HERO.chipBg, border: LL_HERO.chipBorder, backdropFilter: 'blur(6px)' }}>
                    <span>{chip.icon}</span>{chip.label}
                  </span>
                ))}
              </div>

              {/* Quick stats strip */}
              <div className="relative mt-6 grid grid-cols-3 gap-3 max-w-md">
                {[
                  { k: COLUMNS.length, v: 'Columns' },
                  { k: FORMAT_OPTIONS.length, v: 'Formats' },
                  { k: '≤ 100m', v: 'Time Budget' },
                ].map((s, i) => (
                  <div key={i} className="px-3 py-2 rounded-xl text-center"
                    style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.22)', backdropFilter: 'blur(6px)' }}>
                    <div className="text-xl font-bold tabular-nums">{s.k}</div>
                    <div className="text-[10px] tracking-wider uppercase opacity-80">{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          </div>

          {/* ═══ EXTRACTION WORKSPACE VIEW — shown until results are ready ═══ */}
          {regView === 'extract' && (<>
          {/* ═══ VERIFICATION WORKFLOW + SMART DOCUMENTATION — V1 split-screen ═══
              Soft-coded: components/LineListWorkflowDocs.jsx (LL_DOCS_CONFIG) */}
          <LineListWorkflowDocs />

          {/* ── Supported Formats Reference card — soft-coded off (LL_SHOW_FORMATS_REFERENCE) ── */}
          {LL_SHOW_FORMATS_REFERENCE && (
          <div className="rounded-2xl p-5 mb-4 ll-section" style={{
            background: 'rgba(254,243,199,0.65)',
            border: '1px solid rgba(217,119,6,0.2)',
            boxShadow: '0 2px 12px rgba(217,119,6,0.06)',
            animationDelay: '0.06s',
          }}>
            <div className="flex items-center gap-2.5 mb-4">
              <span className="text-lg">⚠️</span>
              <h3 className="text-sm font-semibold text-amber-800 tracking-wide">Supported Line Number Formats</h3>
              <span className="text-xs text-amber-600 italic ml-1">Upload drawings matching one of these formats only</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {FORMAT_EXAMPLES.map(f => (
                <div key={f.group} className="rounded-xl p-3" style={{
                  background: f.bg,
                  border: `1px solid ${f.border}`,
                }}>
                  <p className="text-xs font-bold mb-2" style={{ color: f.color }}>{f.group}</p>
                  {f.examples.map(ex => (
                    <p key={ex} className="font-mono text-xs text-slate-600 leading-relaxed">{ex}</p>
                  ))}
                  {f.note && (
                    <p className="text-[10px] mt-1.5 italic" style={{ color: f.color }}>{f.note}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
          )}

          {/* ── Upload + Options Card ── */}
          {/* ═══ PROJECT WORKSPACE section header — V1 pattern ═══ */}
          <div className="flex items-center justify-between mb-6 mt-2 flex-wrap gap-4 ll-section" style={{ animationDelay: '0.1s' }}>
            <div>
              <h2 className="text-xl font-bold text-slate-900" style={{ margin: 0, marginBottom: '4px' }}>Project Workspace</h2>
              <p className="text-sm text-slate-500" style={{ margin: 0 }}>Upload a P&ID drawing to extract the line list — then review and export.</p>
            </div>
            <button
              onClick={() => setSavedOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 shadow-sm transition-all"
              style={{ cursor: 'pointer' }}>
              <FolderIcon className="h-4 w-4" /> Saved outputs
              {savedOutputs.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: 'rgba(15,118,110,0.1)', color: '#0f766e' }}>
                  {savedOutputs.length}
                </span>
              )}
            </button>
          </div>

          <div className="rounded-2xl p-6 mb-4 ll-section" style={{
            background: 'white',
            border: '1px solid rgba(37,99,235,0.13)',
            boxShadow: '0 2px 16px rgba(37,99,235,0.07)',
            animationDelay: '0.12s',
          }}>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              }}>1</div>
              <h2 className="text-sm font-semibold text-slate-700 tracking-wide">Upload P&amp;ID Document</h2>
            </div>

            {/* ── Upload rules card — soft-coded (LL_UPLOAD_RULES) ────────── */}
            {LL_UPLOAD_RULES.enabled && (
              <div className="mb-5 rounded-xl px-4 py-3.5" style={{
                background: 'rgba(245,158,11,0.06)',
                border: '1px solid rgba(245,158,11,0.28)',
              }}>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2">
                  {LL_UPLOAD_RULES.title}
                </p>
                <ul className="space-y-1.5 mb-3">
                  {LL_UPLOAD_RULES.rules.map((rule, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                      <span>{rule.icon}</span>
                      <span>{rule.text.replace('{maxPages}', LL_UPLOAD_RULES.maxPages)}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  {LL_UPLOAD_RULES.formatsTitle}
                </p>
                <div className="space-y-1">
                  {LL_UPLOAD_RULES.formats.map(f => (
                    <div key={f.key} className="flex items-center gap-2 text-xs">
                      <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                        style={{ background: '#2563eb' }}>
                        {f.key}
                      </span>
                      <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[11px]">
                        {f.pattern}
                      </code>
                      <span className="text-slate-400">— {f.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── AI Document Assist (Wrench) — soft-coded, optional ─────── */}
            {LL_AI_ASSIST_CONFIG.enabled && (
              <div className="mb-5">
                <WrenchAiDocAssist
                  title={LL_AI_ASSIST_CONFIG.title}
                  subtitleTag={LL_AI_ASSIST_CONFIG.subtitleTag}
                  subtitle={LL_AI_ASSIST_CONFIG.subtitle}
                  defaultHint={LL_AI_ASSIST_CONFIG.defaultHint}
                  hintPlaceholder={LL_AI_ASSIST_CONFIG.hintPlaceholder}
                  topN={LL_AI_ASSIST_CONFIG.topN}
                  acceptedExts={LL_AI_ASSIST_CONFIG.acceptedExts}
                  projectName=""
                  onFileSelected={async (f) => {
                    // Same soft-coded page limit as the manual picker
                    const pages = await countPdfPages(f);
                    if (LL_UPLOAD_RULES.enabled && pages !== null && pages > LL_UPLOAD_RULES.maxPages) {
                      setPidDocument(null);
                      setError(`This PDF has ${pages} pages — the maximum is ${LL_UPLOAD_RULES.maxPages} pages per upload. Please split the document and try again.`);
                      return;
                    }
                    setPidDocument(f);
                    setError(null);
                    setExtractedData(null);
                  }}
                  onError={(msg) => setError(msg)}
                />
              </div>
            )}

            {/* Drop zone */}
            <div
              className="relative rounded-xl cursor-pointer overflow-hidden mb-5"
              style={{
                border: pidDocument ? '2px solid rgba(37,99,235,0.45)' : '2px dashed rgba(37,99,235,0.22)',
                background: pidDocument ? 'rgba(37,99,235,0.04)' : 'rgba(37,99,235,0.015)',
                minHeight: 136,
                transition: 'border-color 0.3s, background 0.3s',
              }}
              onClick={() => !isProcessing && pidRef.current?.click()}
            >
              {/* Corner brackets */}
              {['top-0 left-0 border-t-2 border-l-2', 'top-0 right-0 border-t-2 border-r-2',
                'bottom-0 left-0 border-b-2 border-l-2', 'bottom-0 right-0 border-b-2 border-r-2',
              ].map((cls, i) => (
                <div key={i} className={`absolute ${cls} w-5 h-5 pointer-events-none`}
                  style={{ borderColor: 'rgba(37,99,235,0.32)' }} />
              ))}
              {!pidDocument && !isProcessing && <div className="ll-scan-line" />}
              <input ref={pidRef} type="file" accept=".pdf" onChange={handlePIDSelect} className="hidden" />
              <div className="flex flex-col items-center justify-center gap-3 py-8 px-6">
                {pidDocument ? (
                  <>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{
                      background: 'rgba(37,99,235,0.09)',
                      border: '2px solid rgba(37,99,235,0.32)',
                      animation: 'll-glow 2.2s ease infinite',
                    }}>
                      <CheckCircleIcon className="h-7 w-7 text-blue-600" />
                    </div>
                    <div className="text-center">
                      <p className="text-slate-800 font-medium text-sm">{pidDocument.name}</p>
                      <p className="text-slate-400 text-xs mt-1">
                        {(pidDocument.size / 1024 / 1024).toFixed(2)} MB · Ready for extraction
                      </p>
                    </div>
                    <div className="px-3 py-1 rounded-full text-xs font-semibold text-blue-700" style={{
                      background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.18)',
                    }}>✓ PDF Loaded</div>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{
                      background: 'rgba(37,99,235,0.05)',
                      border: '1px solid rgba(37,99,235,0.13)',
                    }}>
                      <CloudArrowUpIcon className="h-8 w-8 text-blue-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-slate-600 font-medium text-sm">Drop a P&amp;ID PDF or click to browse</p>
                      <p className="text-slate-400 text-xs mt-1">PDF only · Multi-page drawings supported</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Format options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
                  Line Number Format
                </label>
                <select
                  value={formatType}
                  onChange={(e) => setFormatType(e.target.value)}
                  disabled={isProcessing}
                  className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                  style={{
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    color: '#334155',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  onFocus={e  => { e.target.style.borderColor = 'rgba(37,99,235,0.45)'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                  onBlur={e   => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                >
                  {FORMAT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label} — {opt.hint}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-2" style={{ margin: '0.5rem 0 0' }}>
                  Line List sequence not available?{' '}
                  <Link
                    to="/my-enquiries"
                    style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}
                    onMouseEnter={e => { e.target.style.textDecoration = 'underline'; }}
                    onMouseLeave={e => { e.target.style.textDecoration = 'none'; }}
                  >
                    Send us an enquiry
                  </Link>
                  {' '}to align a new sequence for extraction.
                </p>
              </div>

              <div className="flex items-center">
                <div
                  className="flex items-center gap-3 p-3.5 rounded-xl cursor-pointer w-full"
                  style={{
                    background: includeArea ? 'rgba(37,99,235,0.06)' : '#f8fafc',
                    border: includeArea ? '1px solid rgba(37,99,235,0.25)' : '1px solid #e2e8f0',
                    transition: 'all 0.2s',
                    opacity: isProcessing ? 0.5 : 1,
                    pointerEvents: isProcessing ? 'none' : 'auto',
                  }}
                  onClick={() => setIncludeArea(a => !a)}
                >
                  <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{
                    background: includeArea ? '#2563eb' : 'white',
                    border: includeArea ? 'none' : '2px solid #cbd5e1',
                    transition: 'all 0.2s',
                  }}>
                    {includeArea && (
                      <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-700">Include Area Code</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">SIZE&quot;-AREA-FLUID-SEQ-CLASS · General format only</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Legend Sheets — shared ProjectLegendPanel (project inheritance) ── */}
          {LL_LEGENDS.enabled ? (
          <ProjectLegendPanel
            section={LL_LEGENDS.section}
            projectId={activeProject?.project_id}
            projectName={activeProject?.name || activeProject?.code || ''}
            onManage={() => setLegendModalOpen(true)}
            refreshToken={legendModalOpen ? 0 : 1}
          />
          ) : (
          <div className="rounded-2xl p-6 mb-4 ll-section" style={{
            background: 'white',
            border: '1px solid rgba(16,185,129,0.18)',
            boxShadow: '0 2px 16px rgba(16,185,129,0.06)',
            animationDelay: '0.16s',
          }}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              }}>2</div>
              <h2 className="text-sm font-semibold text-slate-700 tracking-wide">
                Upload Legend Sheet <span className="text-slate-400 font-normal">(optional)</span>
              </h2>
              <span className="text-[11px] text-emerald-700 ml-auto bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                Adds service &amp; insulation descriptions
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Upload the project legend sheet (PDF) to resolve service codes, insulation classes, and piping spec descriptions.
              Each project may have different legend sheets — upload per extraction as needed.
            </p>

            <div
              className="relative rounded-xl cursor-pointer overflow-hidden"
              style={{
                border: legendDocument ? '2px solid rgba(16,185,129,0.5)' : '2px dashed rgba(16,185,129,0.25)',
                background: legendDocument ? 'rgba(16,185,129,0.04)' : 'rgba(16,185,129,0.01)',
                minHeight: 90,
                transition: 'border-color 0.3s, background 0.3s',
              }}
              onClick={() => !isProcessing && legendRef.current?.click()}
            >
              <input ref={legendRef} type="file" accept=".pdf" onChange={handleLegendSelect} className="hidden" />
              <div className="flex flex-col items-center justify-center gap-2 py-5 px-6">
                {legendDocument ? (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(16,185,129,0.12)', border: '1.5px solid rgba(16,185,129,0.35)' }}>
                        <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-slate-700 font-medium text-sm">{legendDocument.name}</p>
                        <p className="text-slate-400 text-xs">{(legendDocument.size / 1024).toFixed(0)} KB · Legend sheet ready</p>
                      </div>
                      <button
                        className="ml-4 text-xs text-red-400 hover:text-red-600"
                        onClick={e => { e.stopPropagation(); setLegendDocument(null); }}
                      >✕ Remove</button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-2xl">📋</span>
                    <p className="text-slate-500 text-sm">Drop legend sheet PDF or click to browse</p>
                    <p className="text-xs text-slate-400">Optional · Enables service &amp; insulation code descriptions</p>
                  </>
                )}
              </div>
            </div>
          </div>
          )}

          {/* ── Action Buttons ── */}
          <div className="flex gap-3 mb-4 ll-section" style={{ animationDelay: '0.2s' }}>
            <button
              onClick={handleExtract}
              disabled={!pidDocument || isProcessing}
              className="flex-1 py-3.5 px-6 rounded-xl font-semibold text-sm relative overflow-hidden"
              style={!pidDocument || isProcessing ? {
                background: '#f1f5f9', color: '#94a3b8',
                cursor: 'not-allowed', border: '1px solid #e2e8f0',
              } : {
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: 'white', border: 'none',
                boxShadow: '0 4px 18px rgba(37,99,235,0.32)',
              }}
            >
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2.5">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 24 24"
                    style={{ animation: 'll-spin-slow 1.2s linear infinite' }}>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-slate-400">Processing…</span>
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">⚡ Extract Line List</span>
              )}
            </button>

            {extractedData && (
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-5 py-3.5 rounded-xl font-semibold text-sm"
                style={{
                  background: 'rgba(37,99,235,0.07)',
                  color: '#1e40af',
                  border: '1px solid rgba(37,99,235,0.2)',
                  boxShadow: '0 2px 8px rgba(37,99,235,0.08)',
                }}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Download Excel
              </button>
            )}
          </div>

          {/* ── Processing Card — cosmic multi-page visualization ── */}
          {isProcessing && (
            <div className="relative rounded-3xl p-6 mb-4 overflow-hidden ll-section" style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #312e81 100%)',
              border: '1px solid rgba(99,102,241,0.28)',
              boxShadow: '0 20px 60px -20px rgba(79,70,229,0.5)',
              animationDelay: '0s',
            }}>
              {/* Ambient gradient blobs */}
              <div className="absolute -top-10 -left-8 w-60 h-60 rounded-full pointer-events-none"
                style={{ background: 'rgba(96,165,250,0.28)', filter: 'blur(50px)', animation: 'll-blob 10s ease infinite' }} />
              <div className="absolute -bottom-12 -right-8 w-72 h-72 rounded-full pointer-events-none"
                style={{ background: 'rgba(167,139,250,0.3)', filter: 'blur(60px)', animation: 'll-blob 13s ease-in-out infinite reverse' }} />

              <div className="relative flex items-start gap-5">
                {/* ── LEFT: Animated percent dial with orbital ring ── */}
                <div className="relative flex-shrink-0 w-32 h-32">
                  <div className="absolute inset-0 rounded-full"
                    style={{
                      background: 'conic-gradient(from 0deg, rgba(96,165,250,0.7), rgba(167,139,250,0.7), rgba(236,72,153,0.7), rgba(96,165,250,0.7))',
                      animation: 'll-orbit 6s linear infinite',
                      filter: 'blur(2px)',
                    }} />
                  <div className="absolute inset-1.5 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div className="text-center">
                      <div className="text-4xl font-extrabold text-white tabular-nums leading-none">{progress}%</div>
                      <div className="text-[10px] text-blue-200 tracking-[0.2em] uppercase mt-1">processing</div>
                    </div>
                  </div>
                </div>

                {/* ── RIGHT: Status block ── */}
                <div className="flex-1 min-w-0 text-white">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"
                        style={{ animation: 'll-pulse-badge 1.4s ease infinite' }} />
                      <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-blue-200">
                        live extraction
                      </span>
                    </div>
                    <span className="text-xs text-blue-200 tabular-nums">⏱ {formatElapsed(elapsedSeconds)}</span>
                  </div>

                  <div className="mt-2 text-base font-semibold">{statusMessage || 'Processing…'}</div>

                  {/* Live stats row (populated only when backend reports them) */}
                  {pageInfo && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                        style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)' }}>
                        📄 Page <span className="tabular-nums">{pageInfo.currentPage}/{pageInfo.totalPages}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                        style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)' }}>
                        🧩 <span className="tabular-nums">{pageInfo.linesSoFar}</span> lines so far
                      </span>
                    </div>
                  )}

                  {/* Shimmering progress bar */}
                  <div className="mt-4 relative w-full rounded-full h-2.5 overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <div className="h-full rounded-full relative overflow-hidden" style={{
                      width: `${Math.max(5, progress)}%`,
                      background: 'linear-gradient(90deg, #60a5fa, #a78bfa, #f472b6)',
                      animation: 'll-bar-glow 1.8s ease infinite',
                      transition: 'width 0.7s ease',
                    }}>
                      <div className="absolute inset-0" style={{
                        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)',
                        animation: 'll-shimmer 1.6s linear infinite',
                      }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Per-page tracker strip (shown when backend reports pages) ── */}
              {pageInfo && pageInfo.totalPages > 0 && (
                <div className="relative mt-5">
                  <div className="text-[10px] text-blue-200 tracking-[0.22em] uppercase mb-2">Page Pipeline</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: Math.min(pageInfo.totalPages, 40) }).map((_, i) => {
                      const pageN = i + 1;
                      const isDone    = pageN < pageInfo.currentPage;
                      const isCurrent = pageN === pageInfo.currentPage;
                      const accent    = isDone ? '#10b981' : isCurrent ? '#a78bfa' : 'rgba(255,255,255,0.18)';
                      return (
                        <div key={pageN}
                          title={`Page ${pageN}${isDone ? ' — done' : isCurrent ? ' — processing' : ''}`}
                          className="rounded-md flex items-center justify-center text-[10px] font-bold tabular-nums"
                          style={{
                            width: 28, height: 24,
                            background: isDone
                              ? 'rgba(16,185,129,0.2)'
                              : isCurrent
                                ? 'rgba(167,139,250,0.25)'
                                : 'rgba(255,255,255,0.06)',
                            border: `1px solid ${accent}`,
                            color: isDone ? '#34d399' : isCurrent ? '#c4b5fd' : 'rgba(255,255,255,0.45)',
                            position: 'relative',
                            overflow: 'hidden',
                            transition: 'all 0.35s ease',
                          }}>
                          {isCurrent && (
                            <div className="absolute inset-0 pointer-events-none" style={{
                              background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.35), transparent)',
                              animation: 'll-shimmer 1.4s linear infinite',
                            }} />
                          )}
                          <span className="relative">{isDone ? '✓' : pageN}</span>
                        </div>
                      );
                    })}
                    {pageInfo.totalPages > 40 && (
                      <span className="text-[10px] text-blue-200 self-center ml-1">
                        +{pageInfo.totalPages - 40} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* ── Pipeline stages tracker (purely visual) ── */}
              <div className="relative mt-5 grid grid-cols-5 gap-2">
                {LL_PIPELINE_STAGES.map(stage => {
                  const isActive = progress >= stage.from && progress < stage.to;
                  const isDone   = progress >= stage.to;
                  return (
                    <div key={stage.key}
                      className="rounded-xl px-2 py-2 text-center relative overflow-hidden"
                      style={{
                        background: isDone
                          ? 'rgba(16,185,129,0.15)'
                          : isActive
                            ? 'rgba(167,139,250,0.2)'
                            : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${isDone ? 'rgba(16,185,129,0.45)' : isActive ? 'rgba(167,139,250,0.45)' : 'rgba(255,255,255,0.12)'}`,
                        transition: 'all 0.35s ease',
                      }}>
                      {isActive && (
                        <div className="absolute inset-0 pointer-events-none" style={{
                          background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.25), transparent)',
                          animation: 'll-shimmer 1.6s linear infinite',
                        }} />
                      )}
                      <div className="relative text-lg leading-none mb-1">
                        {isDone ? '✅' : stage.icon}
                      </div>
                      <div className="relative text-[10px] font-semibold tracking-wide uppercase"
                        style={{ color: isDone ? '#6ee7b7' : isActive ? '#c4b5fd' : 'rgba(255,255,255,0.5)' }}>
                        {stage.label}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Rotating tip + patience hint ── */}
              <div className="relative mt-5 flex items-start gap-3 rounded-xl p-3"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <div className="flex items-center gap-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1 h-4 rounded-full bg-blue-300" style={{
                      animation: 'll-dot-wave 1.1s ease infinite',
                      animationDelay: `${i * 0.18}s`,
                    }} />
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-blue-100 leading-relaxed">
                    {LL_PROC_TIPS[procTipIdx]}
                  </div>
                  <div className="text-[10px] text-blue-300/70 mt-1 leading-relaxed">
                    {getPatienceMsg(elapsedSeconds)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div className="rounded-xl p-4 mb-4 flex items-start gap-3" style={{
              background: '#fef2f2',
              border: '1px solid rgba(239,68,68,0.2)',
              animation: 'll-fade-up 0.3s ease forwards',
            }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: 'rgba(239,68,68,0.12)' }}>
                <span className="text-red-500 text-xs font-bold">✕</span>
              </div>
              <p className="text-red-600 text-sm font-medium">{error}</p>
            </div>
          )}
          </>)}

          {/* ════════════════════════════════════════════════════════════════
              ENTERPRISE LINE REGISTER — management view (design layer)
              Mirrors the Equipment List template: breadcrumb header, tabs,
              KPI cards, search + filters, status badges, pagination, and a
              row-detail panel with specs / history / documents.
              All data below derives from `extractedData` — core extraction,
              polling and Excel export logic are untouched.
             ════════════════════════════════════════════════════════════════ */}
          {regView === 'register' && LL_REGISTER.enabled && (
            <div className="ll-section" style={{ animationDelay: '0s' }}>

              {/* ── Register header card: breadcrumb + title + meta + actions ── */}
              <div className="rounded-2xl mb-4 relative" style={{
                background: 'white', border: '1px solid #e2e8f0',
                boxShadow: '0 2px 12px rgba(15,118,110,0.05)',
              }}>
                <div className="px-6 pt-5 pb-0">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div style={{ minWidth: 0 }}>
                      <p className="text-xs text-slate-400 mb-1" style={{ margin: '0 0 4px' }}>
                        {LL_REGISTER.breadcrumbRoot}
                        <span className="mx-1.5 text-slate-300">/</span>
                        <span className="text-slate-500">{activeProject?.name || activeProject?.code || 'Workspace'}</span>
                      </p>
                      <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight" style={{ margin: 0, lineHeight: 1.2 }}>
                        Line List
                      </h2>
                      <p className="text-xs text-slate-500 mt-1" style={{ margin: '4px 0 0' }}>
                        {activeProject?.name || 'Project'} — Engineering line register and data validation
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Back to extraction workspace */}
                      <button onClick={() => setRegView('extract')}
                        title="Start a new extraction"
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 shadow-sm transition-all"
                        style={{ cursor: 'pointer' }}>
                        <CloudArrowUpIcon className="h-4 w-4" /> New extraction
                      </button>
                      {/* Register meta */}
                      <div className="flex items-center gap-2.5 text-xs text-slate-500">
                        <span>Register: <span className="font-semibold text-slate-700">{LL_REGISTER.registerNo}</span></span>
                        <span className="text-slate-300">|</span>
                        <span>Rev: <span className="font-semibold text-slate-700">{LL_REGISTER.revision}</span></span>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold"
                          style={{ background: 'rgba(15,118,110,0.09)', color: LL_REGISTER.accent, border: '1px solid rgba(15,118,110,0.25)' }}>
                          {LL_REGISTER.revisionStatus}
                        </span>
                      </div>
                      <button title="Help"
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 shadow-sm transition-all">
                        <QuestionMarkCircleIcon className="h-4 w-4" /> Help
                      </button>
                      <button title="More options"
                        className="flex items-center justify-center w-9 h-9 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 shadow-sm transition-all">
                        <EllipsisHorizontalIcon className="h-5 w-5" />
                      </button>
                      {/* Actions dropdown: Add line / Import / Export */}
                      <div className="relative">
                        <button
                          onClick={() => setRegActionsOpen(o => !o)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all"
                          style={{ background: LL_REGISTER.accent, boxShadow: '0 4px 12px rgba(15,118,110,0.28)', border: 'none', cursor: 'pointer' }}>
                          Actions <ChevronDownIcon className="h-3.5 w-3.5" />
                        </button>
                        {regActionsOpen && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setRegActionsOpen(false)} />
                            <div className="absolute right-0 mt-2 w-52 rounded-xl overflow-hidden z-50"
                              style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 12px 32px rgba(15,23,42,0.14)', top: '100%' }}>
                              {[
                                { icon: <PlusIcon className="h-4 w-4" />,          label: 'Add line',         onClick: handleRegAddLine },
                                { icon: <ArrowUpTrayIcon className="h-4 w-4" />,   label: 'Import CSV / Excel', onClick: () => regImportRef.current?.click() },
                                { icon: <ArrowDownTrayIcon className="h-4 w-4" />, label: 'Export Excel',     onClick: () => { setRegActionsOpen(false); handleExport(); } },
                                { icon: <FolderIcon className="h-4 w-4" />,        label: 'Saved outputs',    onClick: () => { setRegActionsOpen(false); setSavedOpen(true); } },
                              ].map(a => (
                                <button key={a.label} onClick={a.onClick}
                                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-teal-50 hover:text-teal-800 transition-colors"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                                  {a.icon}{a.label}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                        <input ref={regImportRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleRegImport} />
                      </div>
                    </div>
                  </div>

                  {/* ── Tabs ── */}
                  <div className="flex items-center gap-1 mt-5" style={{ borderTop: '1px solid #f1f5f9', paddingTop: 0 }}>
                    {LL_REGISTER.tabs.map(tab => {
                      const active = regTab === tab;
                      return (
                        <button key={tab}
                          onClick={() => setRegTab(tab)}
                          className="px-4 py-3 text-xs font-semibold transition-colors"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: active ? LL_REGISTER.accent : '#64748b',
                            borderBottom: active ? `2px solid ${LL_REGISTER.accent}` : '2px solid transparent',
                            marginBottom: -1,
                          }}>
                          {tab}
                          {tab === 'Validation' && (regKpis.errors + regKpis.warnings) > 0 && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                              style={{ background: 'rgba(239,68,68,0.1)', color: '#b91c1c' }}>
                              {regKpis.errors + regKpis.warnings}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ═══ TAB: Line List — KPIs + search/filters + register table + detail panel ═══ */}
              {regTab === 'Line List' && (
                <div className="grid gap-4" style={{ gridTemplateColumns: regSelectedRow ? 'minmax(0,1fr) 400px' : 'minmax(0,1fr)' }}>
                  <div style={{ minWidth: 0 }}>

                    {/* KPI cards */}
                    <div className="grid gap-0 mb-4 rounded-2xl overflow-hidden" style={{
                      gridTemplateColumns: 'repeat(5, minmax(0,1fr))',
                      background: 'white', border: '1px solid #e2e8f0',
                    }}>
                      {[
                        { icon: <ClipboardDocumentListIcon className="h-5 w-5" style={{ color: '#475569' }} />,   val: regKpis.total,         label: 'Total lines',    color: '#0f172a' },
                        { icon: <DocumentTextIcon className="h-5 w-5" style={{ color: LL_REGISTER.accent }} />,   val: regKpis.newCount + regKpis.changed, label: 'New / Changed', color: LL_REGISTER.accent },
                        { icon: <ExclamationCircleIcon className="h-5 w-5" style={{ color: '#dc2626' }} />,       val: regKpis.errors,        label: 'Errors',         color: '#dc2626' },
                        { icon: <ExclamationTriangleIcon className="h-5 w-5" style={{ color: '#d97706' }} />,     val: regKpis.warnings,      label: 'Warnings',       color: '#d97706' },
                        { icon: <ClockIcon className="h-5 w-5" style={{ color: '#64748b' }} />,                   val: regKpis.reviewPending, label: 'Review pending', color: '#0f172a' },
                      ].map((k, i) => (
                        <div key={k.label} className="flex items-center gap-3 px-5 py-4"
                          style={{ borderLeft: i > 0 ? '1px solid #f1f5f9' : 'none' }}>
                          {k.icon}
                          <div>
                            <div className="text-xl font-extrabold tabular-nums leading-none" style={{ color: k.color }}>{k.val}</div>
                            <div className="text-[11px] text-slate-400 mt-1">{k.label}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Search + filter bar */}
                    <div className="rounded-2xl p-3 mb-4 flex items-center gap-2.5 flex-wrap" style={{
                      background: 'white', border: '1px solid #e2e8f0',
                    }}>
                      <div className="relative flex-1" style={{ minWidth: 220 }}>
                        <MagnifyingGlassIcon className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          value={regSearch}
                          onChange={e => { setRegSearch(e.target.value); regResetPage(); }}
                          placeholder="Search line tags or descriptions…"
                          className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl outline-none"
                          style={{ border: '1px solid #e2e8f0', color: '#334155', background: '#f8fafc' }}
                          onFocus={e => { e.target.style.borderColor = 'rgba(15,118,110,0.45)'; e.target.style.boxShadow = '0 0 0 3px rgba(15,118,110,0.08)'; }}
                          onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                        />
                      </div>
                      {[
                        { key: 'fluid_code', label: 'Service',  options: regFilterOptions.fluid_code },
                        { key: 'status',     label: 'Status',   options: Object.keys(LL_STATUS_STYLES) },
                        { key: 'insulation', label: 'Insulation', options: regFilterOptions.insulation },
                        { key: 'pid_no',     label: 'P&ID',     options: regFilterOptions.pid_no },
                      ].map(f => (
                        <div key={f.key} className="relative">
                          <select
                            value={regFilters[f.key]}
                            onChange={e => { setRegFilters(prev => ({ ...prev, [f.key]: e.target.value })); regResetPage(); }}
                            className="appearance-none pl-3.5 pr-8 py-2.5 text-xs font-semibold rounded-xl outline-none cursor-pointer"
                            style={{
                              border: `1px solid ${regFilters[f.key] ? 'rgba(15,118,110,0.4)' : '#e2e8f0'}`,
                              color: regFilters[f.key] ? LL_REGISTER.accent : '#475569',
                              background: regFilters[f.key] ? 'rgba(15,118,110,0.05)' : 'white',
                            }}>
                            <option value="">{f.label}</option>
                            {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                          <ChevronDownIcon className="h-3.5 w-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                      ))}
                      {(regSearch || Object.values(regFilters).some(Boolean)) && (
                        <button
                          onClick={() => { setRegSearch(''); setRegFilters({ fluid_code: '', status: '', insulation: '', pid_no: '' }); regResetPage(); }}
                          className="flex items-center gap-1 px-3 py-2.5 text-xs font-semibold text-slate-500 hover:text-red-600 rounded-xl transition-colors"
                          style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                          <XMarkIcon className="h-3.5 w-3.5" /> Clear
                        </button>
                      )}
                    </div>

                    {/* Register table card */}
                    <div className="rounded-2xl overflow-hidden" style={{
                      background: 'white', border: '1px solid #e2e8f0',
                      boxShadow: '0 2px 16px rgba(15,23,42,0.04)',
                    }}>
                      <div className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
                        <h3 className="text-base font-bold text-slate-900" style={{ margin: 0 }}>Line register</h3>
                        <div className="flex items-center gap-2">
                          {regChecked.size > 0 && (
                            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                              style={{ background: 'rgba(15,118,110,0.08)', color: LL_REGISTER.accent, border: '1px solid rgba(15,118,110,0.2)' }}>
                              {regChecked.size} selected
                            </span>
                          )}
                          <button onClick={handleExport}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all hover:bg-slate-50"
                            style={{ border: '1px solid #e2e8f0', color: '#475569', background: 'white', cursor: 'pointer' }}>
                            <ArrowDownTrayIcon className="h-4 w-4" /> Export
                          </button>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead>
                            <tr style={{ background: '#f8fafc', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                              <th className="px-4 py-3 w-10">
                                <input type="checkbox"
                                  checked={regPageRows.length > 0 && regPageRows.every(r => regChecked.has(r))}
                                  onChange={regToggleAllOnPage}
                                  style={{ accentColor: LL_REGISTER.accent, cursor: 'pointer' }} />
                              </th>
                              {['Line Designation', 'Service', 'Size', 'Seq No.', 'Piping Spec', 'Insulation', 'From', 'To', 'P&ID No.', 'Status'].map(h => (
                                <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ whiteSpace: 'nowrap' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {regPageRows.length === 0 && (
                              <tr><td colSpan={11} className="px-4 py-10 text-center text-sm text-slate-400">
                                {!extractedData
                                  ? 'No lines yet — upload a P&ID above and run extraction, or use Actions → Add line / Import.'
                                  : 'No lines match the current search / filters.'}
                              </td></tr>
                            )}
                            {regPageRows.map((row, idx) => {
                              const status = getLineStatus(row);
                              const st = LL_STATUS_STYLES[status];
                              const isSel = regSelectedRow === row;
                              return (
                                <tr key={idx}
                                  onClick={() => { setRegSelectedRow(isSel ? null : row); setRegDetailTab('Details'); }}
                                  style={{
                                    background: isSel ? 'rgba(15,118,110,0.06)' : idx % 2 === 0 ? 'white' : '#fafcfd',
                                    borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                                    transition: 'background 0.15s',
                                  }}
                                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'rgba(15,118,110,0.03)'; }}
                                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = idx % 2 === 0 ? 'white' : '#fafcfd'; }}
                                >
                                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                    <input type="checkbox" checked={regChecked.has(row)} onChange={() => regToggleCheck(row)}
                                      style={{ accentColor: LL_REGISTER.accent, cursor: 'pointer' }} />
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-semibold"
                                      style={{ background: 'rgba(15,118,110,0.07)', color: '#0f766e', border: '1px solid rgba(15,118,110,0.15)', whiteSpace: 'nowrap' }}>
                                      {row.original_detection || '—'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-xs text-slate-600" title={row.fluid_description || ''}>
                                    {row.fluid_code || '—'}
                                  </td>
                                  <td className="px-4 py-3 text-xs text-slate-600">{row.size || '—'}</td>
                                  <td className="px-4 py-3 text-xs text-slate-600">{row.sequence_no || '—'}</td>
                                  <td className="px-4 py-3 text-xs text-slate-600" style={{ whiteSpace: 'nowrap' }}>{row.piping_spec || '—'}</td>
                                  <td className="px-4 py-3 text-xs text-slate-600" title={row.insulation_desc || ''}>{row.insulation || '—'}</td>
                                  <td className="px-4 py-3 text-xs text-slate-600" style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {row.from_line || row.from_equipment || row.from || '—'}
                                  </td>
                                  <td className="px-4 py-3 text-xs text-slate-600" style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {row.to_line || row.to_equipment || row.to || '—'}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="text-xs font-mono text-slate-500" style={{ whiteSpace: 'nowrap' }}>{row.pid_no || '—'}</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold"
                                      style={{ background: st.bg, color: st.fg, border: `1px solid ${st.border}`, whiteSpace: 'nowrap' }}>
                                      {status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      <div className="px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap text-xs text-slate-500"
                        style={{ borderTop: '1px solid #f1f5f9', background: '#fbfdfe' }}>
                        <span>
                          {regRows.length === 0 ? '0' : (regPageSafe - 1) * LL_REGISTER.pageSize + 1}–{Math.min(regPageSafe * LL_REGISTER.pageSize, regRows.length)} of {regRows.length}
                        </span>
                        <div className="flex items-center gap-1">
                          <button disabled={regPageSafe <= 1} onClick={() => setRegPage(p => Math.max(1, p - 1))}
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                            style={{ border: '1px solid #e2e8f0', background: 'white', color: regPageSafe <= 1 ? '#cbd5e1' : '#475569', cursor: regPageSafe <= 1 ? 'not-allowed' : 'pointer' }}>
                            <ChevronLeftIcon className="h-4 w-4" />
                          </button>
                          {Array.from({ length: regTotalPages }).map((_, i) => i + 1)
                            .filter(p => p === 1 || p === regTotalPages || Math.abs(p - regPageSafe) <= 2)
                            .reduce((acc, p, i, arr) => {
                              if (i > 0 && p - arr[i - 1] > 1) acc.push('…');
                              acc.push(p);
                              return acc;
                            }, [])
                            .map((p, i) => p === '…' ? (
                              <span key={`e${i}`} className="px-1.5 text-slate-400">…</span>
                            ) : (
                              <button key={p} onClick={() => setRegPage(p)}
                                className="w-8 h-8 rounded-lg text-xs font-semibold transition-colors"
                                style={p === regPageSafe
                                  ? { background: LL_REGISTER.accent, color: 'white', border: 'none', cursor: 'pointer' }
                                  : { border: '1px solid #e2e8f0', background: 'white', color: '#475569', cursor: 'pointer' }}>
                                {p}
                              </button>
                            ))}
                          <button disabled={regPageSafe >= regTotalPages} onClick={() => setRegPage(p => Math.min(regTotalPages, p + 1))}
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                            style={{ border: '1px solid #e2e8f0', background: 'white', color: regPageSafe >= regTotalPages ? '#cbd5e1' : '#475569', cursor: regPageSafe >= regTotalPages ? 'not-allowed' : 'pointer' }}>
                            <ChevronRightIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Detail panel — LINE DETAILS (template right column) ── */}
                  {regSelectedRow && (
                    <div className="rounded-2xl overflow-hidden self-start sticky" style={{
                      background: 'white', border: '1px solid #e2e8f0', top: 16,
                      boxShadow: '0 4px 20px rgba(15,23,42,0.06)',
                    }}>
                      <div className="px-5 pt-4 pb-0" style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Line Details</span>
                          <div className="flex items-center gap-1.5">
                            <button title="Open full view" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
                              style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                              <ArrowsPointingOutIcon className="h-4 w-4" />
                            </button>
                            <button title="Close" onClick={() => setRegSelectedRow(null)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
                              style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-lg font-extrabold text-slate-900 font-mono" style={{ margin: 0, wordBreak: 'break-all' }}>
                            {regSelectedRow.original_detection || 'Unnamed line'}
                          </h3>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold flex-shrink-0"
                            style={{
                              background: LL_STATUS_STYLES[getLineStatus(regSelectedRow)].bg,
                              color: LL_STATUS_STYLES[getLineStatus(regSelectedRow)].fg,
                              border: `1px solid ${LL_STATUS_STYLES[getLineStatus(regSelectedRow)].border}`,
                            }}>
                            {getLineStatus(regSelectedRow)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 mb-3" style={{ margin: '2px 0 12px' }}>
                          {regSelectedRow.fluid_description || 'Line'} · {regSelectedRow.pid_no || 'No P&ID ref'}
                        </p>
                        <div className="flex items-center gap-1">
                          {['Details', 'History', 'Documents'].map(t => (
                            <button key={t} onClick={() => setRegDetailTab(t)}
                              className="px-3.5 py-2.5 text-xs font-semibold transition-colors"
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: regDetailTab === t ? LL_REGISTER.accent : '#64748b',
                                borderBottom: regDetailTab === t ? `2px solid ${LL_REGISTER.accent}` : '2px solid transparent',
                                marginBottom: -1,
                              }}>
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="px-5 py-4">
                        {regDetailTab === 'Details' && (
                          <>
                            {/* General */}
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">General</p>
                            <div className="rounded-xl mb-4 overflow-hidden" style={{ border: '1px solid #f1f5f9' }}>
                              {[
                                ['Service', regSelectedRow.fluid_code ? `${regSelectedRow.fluid_code}${regSelectedRow.fluid_description ? ` — ${regSelectedRow.fluid_description}` : ''}` : '—'],
                                ['P&ID No.', regSelectedRow.pid_no || '—'],
                                ['From', regSelectedRow.from_line || regSelectedRow.from_equipment || regSelectedRow.from || '—'],
                                ['To', regSelectedRow.to_line || regSelectedRow.to_equipment || regSelectedRow.to || '—'],
                              ].map(([k, v], i, arr) => (
                                <div key={k} className="flex justify-between gap-3 px-3.5 py-2.5 text-xs"
                                  style={{ borderBottom: i < arr.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                                  <span className="text-slate-400">{k}</span>
                                  <span className="font-semibold text-slate-700 text-right" style={{ wordBreak: 'break-word' }}>{v}</span>
                                </div>
                              ))}
                            </div>

                            {/* Engineering specifications */}
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Engineering specifications</p>
                            <div className="rounded-xl mb-4 overflow-hidden" style={{ border: '1px solid #f1f5f9' }}>
                              {LL_SPEC_FIELDS.map((f, i) => (
                                <div key={f.key} className="flex justify-between gap-3 px-3.5 py-2.5 text-xs"
                                  style={{ borderBottom: i < LL_SPEC_FIELDS.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                                  <span className="text-slate-400">{f.label}</span>
                                  <span className="font-semibold text-slate-700 text-right">{regSelectedRow[f.key] || '—'}</span>
                                </div>
                              ))}
                            </div>

                            {/* Data-quality alerts */}
                            {getLineIssues(regSelectedRow).length > 0 && (
                              <div className="rounded-xl p-3.5 mb-4" style={{
                                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
                              }}>
                                <div className="flex items-center gap-2 mb-1">
                                  <ExclamationTriangleIcon className="h-4 w-4" style={{ color: '#d97706' }} />
                                  <span className="text-xs font-bold" style={{ color: '#b45309' }}>Data-quality alert</span>
                                </div>
                                <ul className="space-y-1 mt-1">
                                  {getLineIssues(regSelectedRow).map(iss => (
                                    <li key={iss} className="text-[11px] text-amber-800 leading-relaxed">• {iss}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Linked document */}
                            {pidDocument && (
                              <div className="rounded-xl p-3 mb-4 flex items-center gap-3" style={{ border: '1px solid #e2e8f0' }}>
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                                  <DocumentTextIcon className="h-5 w-5 text-red-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-slate-800 truncate" style={{ margin: 0 }}>{pidDocument.name}</p>
                                  <p className="text-[11px] text-slate-400" style={{ margin: 0 }}>Rev {LL_REGISTER.revision}</p>
                                </div>
                                <ArrowTopRightOnSquareIcon className="h-4 w-4 text-slate-400 flex-shrink-0" />
                              </div>
                            )}

                            {/* Review pending */}
                            <div className="rounded-xl p-3 mb-4 flex items-center gap-3" style={{ border: '1px solid #e2e8f0' }}>
                              <ClockIcon className="h-5 w-5 text-slate-400 flex-shrink-0" />
                              <div>
                                <p className="text-xs font-bold text-slate-800" style={{ margin: 0 }}>
                                  {getLineStatus(regSelectedRow) === 'Reviewed' ? 'Review complete' : 'Review pending'}
                                </p>
                                <p className="text-[11px] text-slate-400" style={{ margin: 0 }}>Assigned to Process Lead</p>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                              <button onClick={() => handleRegEditOpen(regSelectedRow)}
                                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:bg-slate-50"
                                style={{ border: '1px solid #cbd5e1', color: '#475569', background: 'white', cursor: 'pointer' }}>
                                <PencilSquareIcon className="h-4 w-4" /> Edit line
                              </button>
                              <button onClick={() => handleRegReviewRow(regSelectedRow)}
                                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all"
                                style={{ background: LL_REGISTER.accent, border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(15,118,110,0.25)' }}>
                                <CheckCircleIcon className="h-4 w-4" /> Review changes
                              </button>
                            </div>
                          </>
                        )}

                        {regDetailTab === 'History' && (
                          <div className="space-y-0">
                            {LL_REVISIONS.map((r, i) => (
                              <div key={r.rev} className="flex gap-3 pb-4 relative">
                                {i < LL_REVISIONS.length - 1 && (
                                  <div className="absolute left-[7px] top-5 bottom-0 w-px" style={{ background: '#e2e8f0' }} />
                                )}
                                <div className="w-3.5 h-3.5 rounded-full flex-shrink-0 mt-1"
                                  style={{
                                    background: r.live ? LL_REGISTER.accent : '#cbd5e1',
                                    border: `2px solid ${r.live ? 'rgba(15,118,110,0.3)' : '#e2e8f0'}`,
                                  }} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-slate-800">Rev {r.rev}</span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                      style={r.live
                                        ? { background: 'rgba(15,118,110,0.09)', color: LL_REGISTER.accent, border: '1px solid rgba(15,118,110,0.22)' }
                                        : { background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>
                                      {r.status}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed" style={{ margin: '4px 0 0' }}>{r.note}</p>
                                  <p className="text-[10px] text-slate-400 mt-1" style={{ margin: '4px 0 0' }}>
                                    {r.by}{r.live && pidDocument ? ` · from ${pidDocument.name}` : ''}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {regDetailTab === 'Documents' && (
                          <div className="space-y-2.5">
                            {[
                              pidDocument && { name: pidDocument.name, meta: `Source P&ID · Rev ${LL_REGISTER.revision}`, tone: 'red' },
                              activeLegend && { name: activeLegend.file_name || activeLegend.name || 'Legend sheet', meta: 'Legend sheet · Active', tone: 'emerald' },
                              { name: 'line_list_base_extraction.xlsx', meta: 'Last exported workbook', tone: 'teal' },
                            ].filter(Boolean).map(d => (
                              <div key={d.name} className="rounded-xl p-3 flex items-center gap-3" style={{ border: '1px solid #e2e8f0' }}>
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                                  style={{ background: `rgba(${d.tone === 'red' ? '239,68,68' : d.tone === 'emerald' ? '16,185,129' : '15,118,110'},0.08)` }}>
                                  <DocumentTextIcon className="h-5 w-5" style={{ color: d.tone === 'red' ? '#ef4444' : d.tone === 'emerald' ? '#059669' : LL_REGISTER.accent }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-slate-800 truncate" style={{ margin: 0 }}>{d.name}</p>
                                  <p className="text-[11px] text-slate-400" style={{ margin: 0 }}>{d.meta}</p>
                                </div>
                                <ArrowTopRightOnSquareIcon className="h-4 w-4 text-slate-400 flex-shrink-0" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ═══ TAB: Overview ═══ */}
              {regTab === 'Overview' && (
                <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)' }}>
                  <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid #e2e8f0' }}>
                    <h3 className="text-sm font-bold text-slate-800 mb-4" style={{ margin: '0 0 16px' }}>Register summary</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Total lines',     val: regKpis.total,         color: '#0f172a' },
                        { label: 'Reviewed',        val: regKpis.total - regKpis.reviewPending, color: '#047857' },
                        { label: 'Errors',          val: regKpis.errors,        color: '#dc2626' },
                        { label: 'Warnings',        val: regKpis.warnings,      color: '#d97706' },
                        { label: 'Services',        val: regFilterOptions.fluid_code.length, color: LL_REGISTER.accent },
                        { label: 'P&ID references', val: regFilterOptions.pid_no.length, color: '#4f46e5' },
                      ].map(s => (
                        <div key={s.label} className="rounded-xl p-4" style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                          <div className="text-2xl font-extrabold tabular-nums" style={{ color: s.color }}>{s.val}</div>
                          <div className="text-[11px] text-slate-400 mt-1">{s.label}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-xl p-3.5 text-xs text-slate-500 leading-relaxed" style={{ background: 'rgba(15,118,110,0.04)', border: '1px solid rgba(15,118,110,0.12)' }}>
                      Format: <span className="font-semibold text-slate-700">{FORMAT_OPTIONS.find(f => f.value === formatType)?.label || formatType}</span>
                      {pidDocument && <> · Source: <span className="font-semibold text-slate-700">{pidDocument.name}</span></>}
                      {' '}· AI-powered OCR with Computer Vision FROM→TO detection.
                    </div>
                  </div>
                  <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid #e2e8f0' }}>
                    <h3 className="text-sm font-bold text-slate-800 mb-4" style={{ margin: '0 0 16px' }}>Revision status</h3>
                    {LL_REVISIONS.map(r => (
                      <div key={r.rev} className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid #f8fafc' }}>
                        <span className="text-xs font-semibold text-slate-700">Rev {r.rev}</span>
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
                          style={r.live
                            ? { background: 'rgba(15,118,110,0.09)', color: LL_REGISTER.accent, border: '1px solid rgba(15,118,110,0.22)' }
                            : { background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>
                          {r.status}
                        </span>
                      </div>
                    ))}
                    <button onClick={() => setRegTab('Reviews')}
                      className="mt-4 w-full px-4 py-2.5 rounded-xl text-xs font-bold text-white"
                      style={{ background: LL_REGISTER.accent, border: 'none', cursor: 'pointer' }}>
                      Go to review workflow
                    </button>
                  </div>
                </div>
              )}

              {/* ═══ TAB: Changes — rows needing attention (New/Error/Warning) ═══ */}
              {regTab === 'Changes' && (
                <div className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '1px solid #e2e8f0' }}>
                  <div className="px-5 py-4" style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <h3 className="text-base font-bold text-slate-900" style={{ margin: 0 }}>Changes in Rev {LL_REGISTER.revision}</h3>
                    <p className="text-xs text-slate-400 mt-0.5" style={{ margin: '2px 0 0' }}>Lines that are new, incomplete, or awaiting review</p>
                  </div>
                  {regAllRows.filter(r => getLineStatus(r) !== 'Reviewed').length === 0 ? (
                    <div className="px-5 py-12 text-center">
                      <CheckCircleIcon className="h-10 w-10 mx-auto mb-2" style={{ color: '#10b981', opacity: 0.5 }} />
                      <p className="text-sm text-slate-500">All lines reviewed — no open changes.</p>
                    </div>
                  ) : (
                    regAllRows.filter(r => getLineStatus(r) !== 'Reviewed').map((row, i) => {
                      const status = getLineStatus(row);
                      const st = LL_STATUS_STYLES[status];
                      return (
                        <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                          style={{ borderBottom: '1px solid #f8fafc' }}
                          onClick={() => { setRegSelectedRow(row); setRegDetailTab('Details'); setRegTab('Line List'); }}>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-semibold"
                            style={{ background: 'rgba(15,118,110,0.07)', color: '#0f766e', border: '1px solid rgba(15,118,110,0.15)' }}>
                            {row.original_detection || '—'}
                          </span>
                          <span className="text-xs text-slate-500 flex-1 truncate">{getLineIssues(row).join(' · ') || 'New line added to register'}</span>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold"
                            style={{ background: st.bg, color: st.fg, border: `1px solid ${st.border}` }}>
                            {status}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* ═══ TAB: Validation — data-quality alerts ═══ */}
              {regTab === 'Validation' && (
                <div className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '1px solid #e2e8f0' }}>
                  <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <div>
                      <h3 className="text-base font-bold text-slate-900" style={{ margin: 0 }}>Data-quality alerts</h3>
                      <p className="text-xs text-slate-400 mt-0.5" style={{ margin: '2px 0 0' }}>Rows failing register completeness rules</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold"
                      style={{ background: regKpis.errors + regKpis.warnings > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)', color: regKpis.errors + regKpis.warnings > 0 ? '#b91c1c' : '#047857' }}>
                      {regKpis.errors + regKpis.warnings} open
                    </span>
                  </div>
                  {regAllRows.filter(r => getLineIssues(r).length > 0).length === 0 ? (
                    <div className="px-5 py-12 text-center">
                      <CheckCircleIcon className="h-10 w-10 mx-auto mb-2" style={{ color: '#10b981', opacity: 0.5 }} />
                      <p className="text-sm text-slate-500">No validation issues — all lines pass data-quality rules.</p>
                    </div>
                  ) : (
                    regAllRows.filter(r => getLineIssues(r).length > 0).map((row, i) => (
                      <div key={i} className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50 cursor-pointer transition-colors"
                        style={{ borderBottom: '1px solid #f8fafc' }}
                        onClick={() => { setRegSelectedRow(row); setRegDetailTab('Details'); setRegTab('Line List'); }}>
                        {getLineStatus(row) === 'Error'
                          ? <ExclamationCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: '#dc2626' }} />
                          : <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: '#d97706' }} />}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 font-mono" style={{ margin: 0 }}>{row.original_detection || 'Unnamed line'}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5" style={{ margin: '2px 0 0' }}>{getLineIssues(row).join(' · ')}</p>
                        </div>
                        <span className="text-[11px] font-semibold text-teal-700 flex-shrink-0">Review →</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ═══ TAB: Reviews — engineering review & approval workflow ═══ */}
              {regTab === 'Reviews' && (
                <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.2fr)' }}>
                  <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid #e2e8f0' }}>
                    <h3 className="text-sm font-bold text-slate-800 mb-4" style={{ margin: '0 0 16px' }}>Approval workflow — Rev {LL_REGISTER.revision}</h3>
                    {[
                      { step: 'Extraction complete',        done: true,  by: 'RAD AI Engine' },
                      { step: 'Data-quality validation',    done: regKpis.errors + regKpis.warnings === 0, by: 'Automated rules' },
                      { step: 'Process engineering review', done: regKpis.reviewPending === 0, by: 'Process Lead' },
                      { step: 'Engineering manager approval', done: false, by: 'Engineering Manager' },
                      { step: 'Issue Rev 04 for design',    done: false, by: 'Document Control' },
                    ].map((s, i, arr) => (
                      <div key={s.step} className="flex gap-3 pb-5 relative">
                        {i < arr.length - 1 && <div className="absolute left-[11px] top-7 bottom-0 w-px" style={{ background: '#e2e8f0' }} />}
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                          style={s.done
                            ? { background: 'rgba(16,185,129,0.12)', color: '#047857', border: '1.5px solid rgba(16,185,129,0.4)' }
                            : { background: '#f8fafc', color: '#94a3b8', border: '1.5px solid #e2e8f0' }}>
                          {s.done ? '✓' : i + 1}
                        </div>
                        <div>
                          <p className="text-xs font-bold" style={{ margin: 0, color: s.done ? '#047857' : '#334155' }}>{s.step}</p>
                          <p className="text-[11px] text-slate-400" style={{ margin: '2px 0 0' }}>{s.by}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid #e2e8f0' }}>
                    <h3 className="text-sm font-bold text-slate-800 mb-1" style={{ margin: '0 0 4px' }}>Revision history & activity</h3>
                    <p className="text-[11px] text-slate-400 mb-4" style={{ margin: '0 0 16px' }}>Latest activity first</p>
                    <div className="rounded-xl p-3 mb-4 flex items-center gap-3" style={{ background: 'rgba(15,118,110,0.05)', border: '1px solid rgba(15,118,110,0.15)' }}>
                      <ClockIcon className="h-5 w-5 flex-shrink-0" style={{ color: LL_REGISTER.accent }} />
                      <div>
                        <p className="text-xs font-bold text-slate-800" style={{ margin: 0 }}>Line list extracted{pidDocument ? ` from ${pidDocument.name}` : ''}</p>
                        <p className="text-[11px] text-slate-400" style={{ margin: 0 }}>{regKpis.total} lines · {regKpis.reviewPending} pending review</p>
                      </div>
                    </div>
                    {LL_REVISIONS.map(r => (
                      <div key={r.rev} className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid #f8fafc' }}>
                        <div>
                          <p className="text-xs font-bold text-slate-800" style={{ margin: 0 }}>Rev {r.rev} — {r.status}</p>
                          <p className="text-[11px] text-slate-400" style={{ margin: '2px 0 0' }}>{r.note} · {r.by}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ═══ TAB: Documents ═══ */}
              {regTab === 'Documents' && (
                <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid #e2e8f0' }}>
                  <h3 className="text-sm font-bold text-slate-800 mb-4" style={{ margin: '0 0 16px' }}>Linked documents</h3>
                  <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                    {[
                      pidDocument && { name: pidDocument.name, meta: `Source P&ID · ${(pidDocument.size / 1024 / 1024).toFixed(2)} MB · Rev ${LL_REGISTER.revision}`, tone: '#ef4444' },
                      activeLegend && { name: activeLegend.file_name || activeLegend.name || 'Legend sheet', meta: 'Legend sheet · Active for this section', tone: '#059669' },
                      { name: 'line_list_base_extraction.xlsx', meta: `Register export · ${regKpis.total} lines · Rev ${LL_REGISTER.revision}`, tone: LL_REGISTER.accent, action: handleExport },
                    ].filter(Boolean).map(d => (
                      <div key={d.name} className="rounded-xl p-4 flex items-center gap-3 transition-all hover:shadow-md"
                        style={{ border: '1px solid #e2e8f0', cursor: d.action ? 'pointer' : 'default' }}
                        onClick={d.action}>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: `${d.tone}12`, border: `1px solid ${d.tone}25` }}>
                          <DocumentTextIcon className="h-5 w-5" style={{ color: d.tone }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate" style={{ margin: 0 }}>{d.name}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5" style={{ margin: '2px 0 0' }}>{d.meta}</p>
                        </div>
                        <ArrowTopRightOnSquareIcon className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Results Table (legacy — shown when enterprise register is disabled) ── */}
          {extractedData && !LL_REGISTER.enabled && (
            <div className="rounded-2xl overflow-hidden ll-section" style={{
              background: 'white',
              border: '1px solid rgba(37,99,235,0.1)',
              boxShadow: '0 4px 24px rgba(37,99,235,0.07)',
              animationDelay: '0s',
            }}>
              {/* Header bar */}
              <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3" style={{
                background: 'linear-gradient(90deg, rgba(37,99,235,0.05), rgba(37,99,235,0.02))',
                borderBottom: '1px solid rgba(37,99,235,0.09)',
              }}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{
                    background: 'rgba(37,99,235,0.08)',
                    border: '1px solid rgba(37,99,235,0.16)',
                  }}>
                    <DocumentTextIcon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-slate-800 font-semibold text-base">
                      <span className="text-blue-600 text-xl font-bold">{extractedData.total_lines}</span>
                      {' '}Lines ·{' '}
                      <span className="text-blue-600">{extractedData.columns}</span> Columns Extracted
                    </h2>
                    <p className="text-slate-400 text-xs mt-0.5">
                      Format: {FORMAT_OPTIONS.find(f => f.value === formatType)?.label || formatType}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {[
                    { label: 'Lines',   val: extractedData.total_lines },
                    { label: 'Columns', val: extractedData.columns },
                  ].map(c => (
                    <div key={c.label} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{
                      background: 'rgba(37,99,235,0.07)',
                      border: '1px solid rgba(37,99,235,0.16)',
                      color: '#1e40af',
                    }}>
                      {c.val} {c.label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr style={{ background: 'linear-gradient(90deg, #1e3a8a, #1d4ed8)' }}>
                      <th className="px-3 py-3.5 text-left text-xs font-medium text-blue-200 uppercase tracking-wider w-10">#</th>
                      {COLUMNS.map(col => (
                        <th key={col.key}
                          className="px-4 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider"
                          style={{ whiteSpace: 'nowrap' }}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {extractedData.data.map((line, idx) => (
                      <tr
                        key={idx}
                        className="ll-row-animate"
                        style={{
                          animationDelay: `${Math.min(idx * 0.032, 0.5)}s`,
                          background: idx % 2 === 0 ? 'white' : '#f0f7ff',
                          borderBottom: '1px solid #f1f5f9',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(37,99,235,0.04)'}
                        onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'white' : '#f0f7ff'}
                      >
                        <td className="px-3 py-3 text-xs text-slate-400">{idx + 1}</td>
                        {COLUMNS.map(col => {
                          const val = resolveCellValue(line, col);
                          const display = val || '—';
                          return (
                            <td key={col.key} className="px-4 py-3 text-sm">
                              {col.key === 'original_detection' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-semibold"
                                  style={{ background: 'rgba(37,99,235,0.07)', color: '#1e40af', border: '1px solid rgba(37,99,235,0.14)' }}>
                                  {display}
                                </span>
                              ) : (col.key === 'pid_no') ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-semibold"
                                  style={{ background: 'rgba(16,185,129,0.07)', color: '#047857', border: '1px solid rgba(16,185,129,0.14)' }}>
                                  {display}
                                </span>
                              ) : (
                                <span className="text-slate-700">{display}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-6 py-3 flex items-center justify-between text-xs" style={{
                borderTop: '1px solid #f1f5f9', background: '#f8fafc',
              }}>
                <span className="text-slate-400">{extractedData.total_lines} total lines extracted</span>
                <span className="text-slate-400">AI-powered OCR · Computer Vision FROM-TO detection</span>
              </div>
            </div>
          )}

          {/* ── Info Panel (idle) — soft-coded off (LL_SHOW_WHAT_GETS_EXTRACTED) ── */}
          {LL_SHOW_WHAT_GETS_EXTRACTED && !extractedData && !isProcessing && (
            <div className="rounded-2xl p-6 mt-4 ll-section" style={{
              background: 'white',
              border: '1px solid rgba(37,99,235,0.1)',
              boxShadow: '0 2px 12px rgba(37,99,235,0.05)',
              animationDelay: '0.3s',
            }}>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-blue-500"
                  style={{ animation: 'll-pulse-badge 2s ease infinite' }} />
                <h3 className="text-sm font-semibold text-slate-700 tracking-wide">What Gets Extracted</h3>
                <span className="ml-auto text-[10px] text-slate-400 tracking-wider uppercase">7 capabilities</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  ['📄', 'P&ID Only',                     'Upload a single P&ID PDF — no HMB, PMS, NACE or Stress docs needed'],
                  ['📊', `${COLUMNS.length} Base Columns`, COLUMNS.map(c => c.label).join(', ')],
                  ['📋', 'Legend Sheet (optional)',        'Upload a project legend PDF to resolve service codes, insulation classes, and piping spec descriptions'],
                  ['🔄', 'Background Processing',          'Job runs async on the server — no browser timeout. Progress polling every 3 s.'],
                  ['🧠', 'AI FROM-TO',                     'Computer Vision + OpenAI detects flow direction for every line'],
                  ['⚡', 'Multi-Format Support',           FORMAT_OPTIONS.map(f => f.label).join(', ')],
                  ['📥', 'Excel Export',                   'Download all extracted rows as a formatted XLSX workbook'],
                ].map(([icon, title, desc], idx) => {
                  const accent = LL_FEATURE_ACCENTS[idx % LL_FEATURE_ACCENTS.length];
                  return (
                    <div key={title}
                      className="flex items-start gap-3 p-3.5 rounded-xl cll-stat-card"
                      style={{
                        background: accent.bg,
                        border: `1px solid ${accent.border}`,
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 10px 24px -10px ${accent.border}`; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                    >
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-lg"
                        style={{ background: 'white', border: `1px solid ${accent.border}` }}>
                        {icon}
                      </div>
                      <div>
                        <p className="text-xs font-bold mb-0.5" style={{ color: accent.fg }}>{title}</p>
                        <p className="text-xs text-slate-600 leading-relaxed">{desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Edit line modal ── */}
      {regEditRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(3px)' }}
          onClick={() => setRegEditRow(null)}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden"
            style={{ background: 'white', boxShadow: '0 24px 60px rgba(15,23,42,0.25)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <h3 className="text-base font-bold text-slate-900" style={{ margin: 0 }}>Edit line</h3>
                <p className="text-xs text-slate-400 font-mono" style={{ margin: '2px 0 0' }}>{regEditRow.original_detection || 'New line'}</p>
              </div>
              <button onClick={() => setRegEditRow(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto grid grid-cols-2 gap-3" style={{ flex: 1 }}>
              {COLUMNS.map(c => (
                <div key={c.key} className={c.key === 'original_detection' ? 'col-span-2' : ''}>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{c.label}</label>
                  <input
                    value={regEditForm[c.key] ?? ''}
                    onChange={e => setRegEditForm(f => ({ ...f, [c.key]: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                    style={{ border: '1px solid #e2e8f0', color: '#334155', background: '#f8fafc' }}
                    onFocus={e => { e.target.style.borderColor = 'rgba(15,118,110,0.45)'; e.target.style.boxShadow = '0 0 0 3px rgba(15,118,110,0.08)'; }}
                    onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>
              ))}
            </div>
            <div className="px-5 py-4 flex gap-2" style={{ borderTop: '1px solid #f1f5f9' }}>
              <button onClick={() => setRegEditRow(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:bg-slate-50"
                style={{ border: '1px solid #cbd5e1', color: '#475569', background: 'white', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleRegEditSave}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all"
                style={{ background: '#0f766e', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(15,118,110,0.25)' }}>
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Save notice toast (auto-dismisses) ── */}
      {savedNotice && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white shadow-lg"
          style={{ background: '#0f766e', animation: 'll-fade-up 0.25s ease both' }}>
          <CheckCircleIcon className="h-4 w-4" /> {savedNotice}
        </div>
      )}

      {/* ── Saved Outputs modal — re-download or reload past extractions ── */}
      {savedOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(3px)' }}
          onClick={() => setSavedOpen(false)}>
          <div className="w-full max-w-2xl rounded-2xl overflow-hidden"
            style={{ background: 'white', boxShadow: '0 24px 60px rgba(15,23,42,0.25)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <h3 className="text-base font-bold text-slate-900" style={{ margin: 0 }}>Saved outputs</h3>
                <p className="text-xs text-slate-400" style={{ margin: '2px 0 0' }}>Previously exported line lists — download or reopen in the register</p>
              </div>
              <button onClick={() => setSavedOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto" style={{ flex: 1 }}>
              {savedLoading ? (
                <div className="px-5 py-12 text-center text-sm text-slate-400">Loading saved outputs…</div>
              ) : savedOutputs.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <FolderIcon className="h-10 w-10 mx-auto mb-2" style={{ color: '#94a3b8', opacity: 0.5 }} />
                  <p className="text-sm text-slate-500">No saved outputs yet.</p>
                  <p className="text-xs text-slate-400 mt-1">Exports are saved automatically when you click Export.</p>
                </div>
              ) : (
                savedOutputs.map(o => (
                  <div key={o.id} className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: '1px solid #f8fafc' }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(15,118,110,0.08)', border: '1px solid rgba(15,118,110,0.18)' }}>
                      <DocumentTextIcon className="h-5 w-5" style={{ color: '#0f766e' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate" style={{ margin: 0 }}>{o.excel_filename || `line_list_${o.id}.xlsx`}</p>
                      <p className="text-[11px] text-slate-400" style={{ margin: '2px 0 0' }}>
                        {o.processing_date} · {o.total_lines} lines · {o.file_size_mb} MB · {o.processed_by}
                      </p>
                    </div>
                    {o.has_file ? (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => openSavedOutput(o)}
                          disabled={savedBusyId === o.id}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors"
                          style={{ border: '1px solid rgba(15,118,110,0.35)', color: '#0f766e', background: 'white', cursor: 'pointer' }}>
                          {savedBusyId === o.id ? '…' : 'Open'}
                        </button>
                        <button
                          onClick={() => downloadSavedOutput(o)}
                          disabled={savedBusyId === o.id}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white transition-colors"
                          style={{ background: '#0f766e', border: 'none', cursor: 'pointer' }}>
                          <ArrowDownTrayIcon className="h-3.5 w-3.5" /> {savedBusyId === o.id ? '…' : 'Download'}
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 flex-shrink-0">File unavailable</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Managed Legend Sheets modal (shared V1 system) ── */}
      {LL_LEGENDS.enabled && (
        <LegendSheetsModal
          open={legendModalOpen}
          onClose={() => setLegendModalOpen(false)}
          section={LL_LEGENDS.section}
          projectId={activeProject?.project_id}
          onActiveChange={handleLegendActiveChange}
        />
      )}
    </>
  );
};

export default LineList;
