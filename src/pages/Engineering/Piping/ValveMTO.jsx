import { radaiConfirm, radaiPrompt } from '../../../services/radaiDialog'
/**
 * Valve MTO — Material Take-Off Workspace
 * =======================================
 * Route: /engineering/piping/pms
 *
 * Aligned with the standard PIPING VALVES MTO template (Notes / ISLAND /
 * FIELD / COMBINED MTO / Pivot — 13 columns). Fully soft-coded: schema,
 * filters, options, importer aliases and exporter sheet layout all live
 * in `valveMTO.config.js` / `valveMTOImporter.js` / `valveMTOExporter.js`.
 *
 * Capabilities:
 *   • Upload an existing Valve MTO (.xls / .xlsx / .csv) → AI-style
 *     header detection auto-maps columns and bulk-loads rows.
 *   • Tabbed views: All / ISLAND / FIELD / COMBINED / Pivot.
 *   • Inline editable table with add / delete / search.
 *   • Per-tab live totals (Σ Island, Σ Field, Σ Total).
 *   • Excel export that emits the same 5-sheet template.
 *   • Auto-save to localStorage; cross-tab sync.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Wrench, UploadCloud, Plus, Trash2, Download, Save as SaveIcon,
  Search, AlertCircle, RefreshCw, X, Sparkles, History as HistoryIcon,
  RotateCcw, Pencil, Database, Layers, MapPin, FolderKanban, ChevronDown,
  Check, AlertTriangle, Activity, TrendingUp, Target, Zap, Award,
  Lightbulb, ChevronRight, Info, Clock, Maximize2, Minimize2,
  Cloud as CloudIcon, BookOpen as BookOpenIcon,
} from 'lucide-react';
import {
  STORAGE_KEY, REFRESH_EVENT, PROJECT_FIELDS, VALVE_COLUMNS, VALVE_TABS,
  DEFAULT_ROW, AREA_OPTIONS,
} from '../../../config/valveMTO.config';
import { deriveRemarksFromRow, mergeRemarks } from '../../../config/valveMTORemarks';
import importValveMTOFile from '../../../config/valveMTOImporter';
import exportValveMTOWorkbook, { exportValveMTOAllData } from '../../../config/valveMTOExporter';
import {
  HISTORY_REFRESH_EVENT, HISTORY_SOURCE_META, listHistory, saveHistoryEntry,
  renameHistoryEntry, deleteHistoryEntry, clearHistory,
} from '../../../config/valveMTOHistory';
import {
  PROJECTS_REFRESH_EVENT, PROJECT_NAME_MAX_LEN, PROJECT_DESC_MAX_LEN,
  ensureInitialised, listProjects,
  getActiveProject, setActiveProject, createProject, renameProject,
  deleteProject, syncActiveProject, setProjectServerId,
} from '../../../config/valveMTOProjects';
import valveMtoService from '../../../services/valveMtoService';
import {
  PERF_BANDS, PERF_MIN_ROWS_FOR_SCORE, computePerformance, bandFor,
  computeRecommendations,
} from '../../../config/valveMTOPerformance';
import ProcessingOverlay from './ValveMTOProcessingOverlay';
import ValveMTOWorkflowDocs from './components/ValveMTOWorkflowDocs';
import WrenchAiDocAssist from '../../../components/Engineering/WrenchAiDocAssist';
// The SAME shared Legend Sheets manager used by P&ID Verification V1/V2
// (apps.pid_checker_v2's structured, per-section-activated legend
// system) — imported directly, never modified, per this feature's own
// "reuse existing modal" requirement.
import LegendSheetsModal from '../Process/components/LegendSheetsModal';
// SAME service LegendSheetsModal itself uses — reused here only to
// auto-activate Valve MTO's 5 relevant sections before opening the
// modal (see handleOpenLegends below), never to duplicate the modal's
// own CRUD UI.
import { listLegends, createLegend, activateLegend } from '../../../services/pidCheckerV2API';
import apiClient from '../../../services/api.service';
// BUG FIX: LegendSheetsModal's own "Upload valve symbol image" feature
// keys its pictures off a apps.pid_verification PIDVProject id (see
// SymbolImageUploadView), NOT the apps.project_organizer id the modal's
// built-in project selector offers — those are two disjoint UUID spaces
// with no bridge between them, so a project picked from that selector
// 404s on upload every time. Fix: resolve/create a PIDVProject of our
// own here (reusing the SAME '/pid-verification/projects/' endpoint V1/
// V2 already use) and hand its id to the modal as `projectId`, exactly
// the pattern PIDCheckerV2.jsx already uses successfully.
import { listProjects as listPidvProjects, createProject as createPidvProject } from '../../../services/pidProjectsService';

// ─── Soft-coded page constants ───────────────────────────────────────────
const BACK_ROUTE       = '/engineering/piping';
const PAGE_TITLE       = 'Valve MTO';
const PAGE_SUBTITLE    = 'Valve Material Take-Off · Soft-coded template alignment · Smart import & export';
const AUTOSAVE_DEBOUNCE = 500;
const ACCEPTED_TYPES   = '.pdf,.xls,.xlsx,.csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// ─── Common V1 page theme (shared with Legend Manager / Line List / P&ID V1) ─
// Flip PMS_THEME.enabled to false to fall back to the legacy amber look.
// Pure styling — no logic depends on these values.
const PMS_THEME = {
  enabled:  true,
  bg:       'linear-gradient(135deg, #f8faff 0%, #eef2ff 45%, #f0f9ff 75%, #fffbeb 100%)',
  gridDot:  'radial-gradient(circle, rgba(99,102,241,0.055) 1px, transparent 1px)',
  gradBar:  'linear-gradient(90deg,#3b82f6,#6366f1,#f59e0b,#3b82f6)',
  accent:   'linear-gradient(135deg,#3b82f6,#6366f1)',           // icon tile / primary CTA
  accentAlt:'linear-gradient(135deg,#8b5cf6,#6366f1)',           // secondary CTA (AI)
  card:     { background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  headerCard: {
    background: 'linear-gradient(135deg, rgba(59,130,246,0.03) 0%, rgba(99,102,241,0.06) 100%)',
    border: '1px solid #e2e8f0',
  },
  eyebrow:  'AIFlow · Engineering Suite',
  badge:    { text: 'Production Ready', color: '#10b981' },
  featurePills: [
    { label: 'Smart Import',    color: '#3b82f6' },
    { label: '5-Sheet Export',  color: '#10b981' },
    { label: 'Auto-save',       color: '#8b5cf6' },
    { label: 'Island / Field',  color: '#f59e0b' },
  ],
};

// ─── Soft-coded layout offsets ───────────────────────────────────────────
// The global app header (<Layout> + <Header>) is fixed at top-0 with z-40.
// Its rendered height (logo 36px + p-2 wrapper 16px + nav py-4 32px ≈ 84px)
// is slightly taller than Layout's `pt-16` (64px) spacer, which caused the
// Back/Title row of this page to be clipped behind the blue bar.  Adjusting
// only here keeps the fix local — no global Layout change needed.
//   • PAGE_TOP_OFFSET     — extra top padding for the page root so the
//                           page-local header clears the global app bar.
//   • LOCAL_HEADER_STICKY — when false (default), header scrolls with the
//                           page so it never overlays the stat cards / tabs
//                           below. Flip to true for a pinned variant.
//   • LOCAL_HEADER_TOP    — sticky pin offset (only used if STICKY = true).
//   • LOCAL_HEADER_Z      — kept strictly below the global header (z-40).
const PAGE_TOP_OFFSET     = 'pt-4 sm:pt-5';
const LOCAL_HEADER_STICKY = false;
const LOCAL_HEADER_TOP    = 'top-16';
const LOCAL_HEADER_Z      = 'z-30';
const LOCAL_HEADER_CLASS  = LOCAL_HEADER_STICKY
  ? `sticky ${LOCAL_HEADER_TOP} ${LOCAL_HEADER_Z}`
  : '';

// ─── Fullscreen layout (soft-coded) ────────────────────────────
// Mirrors the LineList / Instrument Index pattern.  All knobs in one place;
// flip `enabled: false` to hide the toggle without touching JSX.
const PMS_FULLSCREEN_CONFIG = {
  enabled:             true,
  normalMaxWidth:      '1700px',       // default ValveMTO container width
  fullscreenMaxWidth:  '100%',
  fullscreenPaddingX:  '1.25rem',
  bodyLockClass:       'pms-fullscreen-lock',
  wrapClass:           'pms-fullscreen-wrap',
  persistKey:          'pms.valveMTO.isFullscreen.v1',
  zIndex:              9990,
};

// ─── AI Document Assist (Wrench) — soft-coded panel config ──────────────
// Mirrors the panel on /engineering/process/pid-verification.  All knobs are
// optional — set `enabled: false` to remove the panel without touching JSX.
const AI_DOC_ASSIST_CONFIG = {
  enabled:      true,
  title:        'AI Document Assist',
  subtitleTag:  '(Wrench · optional)',
  subtitle:     'Let RAD AI pick & recommend the right Valve MTO document for this project from Wrench DMS',
  defaultHint:  'valve mto material take off',
  hintPlaceholder: 'e.g. valve mto, gate valve, material take off',
  topN:         5,
  // Restrict to the file types the Valve MTO importer can actually parse.
  acceptedExts: ['pdf', 'xls', 'xlsx', 'csv'],
};

// Backend endpoint config for PDF extraction (vision-assisted, async).
// All timeouts are SOFT-CODED — adjust here, no other code changes needed.
const PDF_EXTRACTION_CONFIG = {
  startEndpoint: '/pid-verification/extract-valve-mto/',
  // The status endpoint takes the job_id appended.
  statusEndpoint: (jobId) => `/pid-verification/extract-valve-mto/${jobId}/`,
  fileFieldName: 'pid_file',
  pdfRegex:      /\.pdf$/i,

  // Per-request timeouts — each call finishes fast (start ≈ 1–3s, status ≈ 100ms).
  // The total job runtime is unbounded by HTTP — we poll instead.
  startTimeoutMs:  60000,
  statusTimeoutMs: 15000,

  // Polling cadence.
  pollIntervalMs:  2000,

  // ── Adaptive timeout strategy ───────────────────────────────────────────
  // Instead of a single hard cap, we use TWO deadlines:
  //   • stallTimeoutMs       — abort if the backend stops reporting progress
  //                            (default 8 min of silence). Resets whenever
  //                            page-count or row-count advances.
  //   • absoluteMaxDurationMs— hard ceiling regardless of progress
  //                            (default 60 min). Raise this for very large
  //                            PDFs; it never aborts a job that's still
  //                            actively producing rows.
  stallTimeoutMs:        12 * 60 * 1000,
  absoluteMaxDurationMs: 60 * 60 * 1000,
};

// BYOK (bring-your-own-key) config — same pattern as instrument_io_workflow's
// PID_VISION_CONFIG (IOListWorkflowPage.jsx's UploadCard): a user can supply
// their own OpenAI or Claude key instead of relying on the admin-configured
// one. sessionStorage-persisted, scoped per LOCAL project id (not global) —
// same reasoning as I/O List's own fix for this: a key entered for one
// project must never leak into / pre-fill a different project.
const VALVE_VISION_CONFIG = {
  providers: [
    { value: 'openai', label: 'OpenAI' },
    { value: 'claude', label: 'Claude' },
  ],
  defaultProvider: 'openai',
  sessionStorageProviderKey: 'valve_mto_vision_provider',
  sessionStorageApiKeyKey:   'valve_mto_vision_api_key',
  hint: 'Uses the admin-configured OpenAI key by default. Add your own OpenAI or Claude key here to use it instead — never sent anywhere except this one extraction request.',
};

// Scan mode — 'quick' (1 Vision call/page, today's original behaviour)
// vs 'thorough' (default: 2x2 tiled, 2 passes = 8 Vision calls/page —
// see services.piping_valve_mto_extractor's SCAN_MODE_* constants /
// _scan_mode_params, the single source of truth this must stay in sync
// with).
const SCAN_MODE_QUICK = 'quick';
const SCAN_MODE_THOROUGH = 'thorough';
const SCAN_MODE_DEFAULT = SCAN_MODE_THOROUGH;
const SCAN_MODE_STORAGE_KEY = 'radai.valveMTO.scanMode';
const SCAN_MODE_OPTIONS = [
  { value: SCAN_MODE_QUICK, label: 'Quick Scan', hint: 'Faster — 1 pass per page.' },
  { value: SCAN_MODE_THOROUGH, label: 'Thorough Scan', hint: 'More accurate — tiles each page into a 2×2 grid with 2 passes (8 Vision calls/page). Finds more valves on dense drawings, takes longer.' },
];

// Used below to auto-activate the user's own legend for each section (if
// one exists) before opening the shared Manage Legends modal, so Valve
// MTO extraction starts benefiting from them without an extra manual
// "Activate" click per section.
// The 7 apps.pid_checker_v2 legend sections Valve MTO extraction actually
// reads (see apps.pid_verification.services.piping_valve_mto_extractor's
// _build_legend_context — LEGEND_SECTIONS_ESSENTIAL/_OPTIONAL there is
// the single source of truth this list must stay in sync with).
// 'instrument_signal' (instrumentation line styles) and
// 'control_valve_regulator' (control-valve variants + regulators — a real
// gap in the 'valve' section's own 15-entry VALVE SYMBOL REFERENCE, e.g.
// "Control Valve with Hand Wheel", pressure/temperature/level/back-
// pressure regulators) were both added to the backend's essential list;
// this array was updated in lockstep so both get the same auto-create-
// default-if-empty + auto-activate treatment as the original 5.
const VALVE_MTO_LEGEND_SECTIONS = [
  'valve', 'piping', 'line_list', 'instrument_signal', 'control_valve_regulator',
  'scope_symbols', 'limit_line',
];

// Name of the PIDVProject auto-created (once per user) so the Manage
// Legends modal's "Upload symbol image" feature has a valid project to
// key pictures off — see resolveLegendProjectId / handleOpenLegends
// below. Isolated to Valve MTO: no other module creates or reads this.
const VALVE_MTO_DEFAULT_PROJECT_NAME = 'Valve MTO Default';

// Fluid codes (the FF segment of the PIPING LINE FORMAT: FF-DD-111XXX-
// XXXX-X) feed the 'line_list' section's merged "Line List MTO -
// Complete" legend (see autoPopulateLegendSection below) as one of its
// fields.
//
// BUG FIX: this data used to be a hand-duplicated JS object, hardcoded
// here AND separately hardcoded in the Vision prompt
// (apps.pid_verification.services.piping_valve_mto_extractor) — nothing
// kept the two in sync. apps.valve_mto.fluid_codes.FLUID_CODES is now
// the single source of truth for both; this file fetches that SAME data
// at runtime via GET /api/v1/valve-mto/fluid-codes/ instead of
// re-declaring it, so a future change to the customer's code list only
// ever needs to happen in one place (that backend module) to reach both
// the prompt and this legend.

// ─── Additional default legends (line_list / valve / piping) ─────────────
// Same auto-create-only-if-empty approach as the Fluid Code default above.
// These mirror the customer reference data already baked into the Vision
// prompt (apps.pid_verification.services.piping_valve_mto_extractor) —
// kept here as plain JS (not fetched from a shared backend module, unlike
// Fluid Codes) because this change is scoped to ValveMTO.jsx only; if the
// underlying customer data ever changes, update both places by hand.
const AREA_CODES_LOOKUP = {
  '026': 'GENERAL AND MISCELLANEOUS',
  '176': 'CAP GAS WELLS PLATFORM (US-58)',
  '177': 'GAS TREATMENT PLATFORM',
  '178': 'ABK TIE-IN PLATFORM',
  '179': 'COLLECTOR/SEPARATOR PLATFORM',
  '180': 'ORIGINAL CENTRAL COLLECTOR PLATFORM',
  '181': 'NORTHERN RISER PLATFORM',
  '182': 'EASTERN RISER PLATFORM',
  '183': 'UMM SHAIF EXISTING ACCOMMODATION PLATFORM',
  '184': 'POWER GENERATION PLATFORM',
  '185': 'WATER INJECTION PLATFORM (5 MODULES)',
  '186': 'WATER INJECTION PLATFORM (2 MODULES)',
  '187': 'BRIDGE B1', '188': 'BRIDGE B2', '189': 'BRIDGE B3', '190': 'BRIDGE B4',
  '191': 'BRIDGE B5', '192': 'BRIDGE B6', '193': 'BRIDGE B7', '194': 'BRIDGE B8',
  '195': 'BRIDGE B9', '196': 'BRIDGE B10', '197': 'BRIDGE B11',
  '350': 'EXTENSION TO GAS TREATMENT PLATFORM',
  '351': 'FLARES 1, 2 AND TA',
  '352': 'UMM SHAIF ADDITIONAL ACCOMMODATION',
  '359': 'BRIDGE SUPPORT TOWER S1',
  '360': 'BRIDGE SUPPORT TOWER S2',
  '361': 'BRIDGE SUPPORT TOWER S3',
  '391': 'CRESTAL GAS INJECTION TOWER US 272',
  '392': 'CRESTAL GAS INJECTION TOWER US 290',
  '414': 'NEW 36" MOL (SUBMARINE)',
  '415': 'NEW 36" MOL RISER PLATFORM',
  '418': 'BRIDGE SUPPORT TOWER S5',
  '419': 'BRIDGE SUPPORT TOWER S4',
  '420': 'BRIDGE B15', '421': 'BRIDGE B14', '423': 'BRIDGE B13',
  '422': 'TAWEELAH ALPHA PLATFORM',
  '427': 'NEW GAS TREATMENT PLATFORM',
  '428': 'THAMAMA PILOT GAS INJECTION US 213',
  '441': 'ARAB D GAS INJECTION TOWER US 251',
  '446': 'ARAB D GAS INJECTION TOWER US 250',
  '501': 'GENERAL & MISCELLANEOUS',
  '502': 'COLLECTOR SEPARATOR PLATFORM-1 (CSP-1)',
  '503': 'UMM SHAIF WATER DISPOSAL UNIT (UWDT)',
  '504': 'FLARE TOWER-4 (FT-4)', '505': 'FLARE TOWER-5 (FT-5)',
  '510': 'BRIDGE B16', '511': 'BRIDGE B17', '512': 'BRIDGE B18', '513': 'BRIDGE B19',
  '514': 'BRIDGE B20', '515': 'BRIDGE B21', '516': 'BRIDGE B22', '517': 'BRIDGE B23',
  '520': 'BRIDGE SUPPORT TOWER S6', '521': 'BRIDGE SUPPORT TOWER S7',
  '522': 'BRIDGE SUPPORT TOWER S8', '523': 'BRIDGE SUPPORT TOWER S9',
  '524': 'BRIDGE SUPPORT TOWER S10',
  '531': 'COMPRESSION PLATFORM-1 (CP-1)',
  '532': 'UMM SHAIF ACCOMMODATION PLATFORM (UAP)',
  '533': 'FLARE TOWER-6 (FT-6)',
  '538': 'BRIDGE B55', '539': 'BRIDGE B56', '540': 'BRIDGE B57',
  '547': 'BRIDGE SUPPORT TOWER S55', '548': 'BRIDGE SUPPORT TOWER S56',
};

const INSULATION_CODES_LOOKUP = {
  A: 'Acoustic',
  C: 'Cold Conservation',
  F: 'Fire Proofing',
  H: 'Heat Conservation',
  P: 'Personnel Protection',
  T: 'Heat Tracing',
  E: 'Electrical Heat Tracing',
};

const SPECIAL_VALVE_CODES_LOOKUP = {
  PSV: 'Pressure Safety Valve',
  SDV: 'Shutdown Valve',
  BDV: 'Blowdown Valve',
  MOV: 'Motor Operated Valve',
  SV: 'Solenoid Valve',
};

// Same 15 body-shape descriptions as the Vision prompt's own VALVE SYMBOL
// REFERENCE section, kept consistent so this default legend and the
// prompt never disagree about what each valve type looks like.
const VALVE_SYMBOLS_LOOKUP = {
  'Gate Valve': 'bowtie symbol on pipe',
  'Globe Valve': 'bowtie with circle on pipe',
  'Ball Valve': 'circle symbol on pipe',
  'Plug Valve': 'diamond symbol on pipe',
  'Check Valve': 'arrow/flap symbol (one direction)',
  'Butterfly Valve': 'dot inside bowtie',
  'Needle Valve': 'needle/fine control symbol',
  'Float Valve': 'float/ball symbol',
  'Diaphragm Valve': 'curved membrane symbol',
  'Angle Valve': '90 degree turn valve',
  'Choke Valve (Adjustable)': 'angle with adjustment',
  'Three-Way Valve': 'T-junction valve symbol',
  'Four-Way Valve': 'cross junction valve symbol',
  'Integral Double Block and Bleed': 'double bowtie',
  'Valve with Dead Mans Handle': 'handle symbol',
};

const AREA_CODES_LEGEND_DEFINITION = {
  separator: '-',
  fields: [{
    key: 'area_code',
    label: 'Area Code',
    regex: '\\d{3}',
    notes: 'The AREA segment of the Offshore line-number format AREA-FLUID-SIZE-PIPECLASS-SEQ, and the XXX segment of the DRAWING NUMBER FORMAT AD111-XXX-D-XXXXX — a match confirms the reading and identifies the platform/structure.',
    lookup: AREA_CODES_LOOKUP,
  }],
};

const DRAWING_FORMAT_LEGEND_DEFINITION = {
  separator: '-',
  fields: [
    { key: 'project_indicator', label: 'Project Indicator (AD111)', regex: 'AD\\d{3}',
      notes: 'AD111 = Project Indicator (USGIF).' },
    { key: 'area_code', label: 'Area Code (XXX)', regex: '\\d{3}',
      notes: 'See the "Area Codes - Standard" legend for the full lookup.',
      lookup: AREA_CODES_LOOKUP },
    { key: 'discipline_code', label: 'Discipline Code (D)', regex: '[A-Z]',
      notes: 'D = Process and P&IDs.' },
    { key: 'drawing_number', label: 'Drawing Number (XXXXX)', regex: '\\d{5}',
      notes: 'Drawing Number, 10000-19999.' },
  ],
};

const LINE_FORMAT_LEGEND_DEFINITION = {
  separator: '-',
  fields: [
    { key: 'fluid_code', label: 'Fluid Code (FF)', regex: '[A-Z]{1,3}',
      notes: 'See the "Fluid Code - Standard" legend for the full lookup.' },
    { key: 'diameter', label: 'Line Diameter (DD)', regex: '\\d{1,2}',
      notes: 'Line diameter in inches.' },
    { key: 'project_line_number', label: 'Project + Line Number (111XXX)', regex: '\\d{6}',
      notes: 'Project identifier plus line number.' },
    { key: 'piping_material_code', label: 'Piping Material Code (XXXX)', regex: '[A-Z0-9]{1,4}',
      notes: 'Piping material class code.' },
    { key: 'insulation_type', label: 'Insulation Type (X)', regex: '[A-Z]',
      notes: 'See the "Insulation Codes - Standard" legend for the full lookup.' },
  ],
};

// A single field, not 3 separated by an empty separator: the legend
// engine's compile_legend() treats '' as falsy and silently substitutes
// the default '-' separator, which would wrongly produce "V-111-XXXX"
// for a format that actually has no separators (V111XXXX) — confirmed
// via a real compile_legend() test before settling on this shape.
const VALVE_IDENTIFICATION_LEGEND_DEFINITION = {
  separator: '-',
  fields: [{
    key: 'valve_tag',
    label: 'Valve Tag',
    regex: 'V\\d{7}',
    notes: 'V = Valve, next 3 digits = Project Indicator (USGIF), final 4 digits = Sequential Number (0001-9999). Format: V111XXXX.',
  }],
};

const SPECIAL_VALVE_NUMBERING_LEGEND_DEFINITION = {
  separator: '-',
  fields: [
    { key: 'area_code', label: 'Area Code (XXX)', regex: '\\d{3}',
      notes: 'This project’s AREA CODE — see the "Area Codes - Standard" legend.' },
    { key: 'valve_code', label: 'Valve Code', regex: 'PSV|SDV|BDV|MOV|SV',
      notes: 'Sets "type" directly from the tag’s own code — overrides a visual best-guess.',
      lookup: SPECIAL_VALVE_CODES_LOOKUP },
    { key: 'sequence_number', label: 'Sequence Number (XXXXX)', regex: '\\d{4,5}',
      notes: 'Valid range depends on the code — see the Vision prompt for exact ranges.' },
  ],
};

const VALVE_SYMBOLS_LEGEND_DEFINITION = {
  separator: '=',
  fields: [{
    key: 'valve_type',
    label: 'Valve Type',
    regex: '[A-Za-z ()]+',
    notes: 'Body-shape description — match the symbol actually drawn on the P&ID to identify "type".',
    lookup: VALVE_SYMBOLS_LOOKUP,
  }],
};

// ─── "LINE SYMBOLS" (customer legend sheet) ───────────────────────────────
// The customer's own legend has a LINE SYMBOLS section with two
// subcategories. Neither "Pipe Connection" (fittings: flexible joint,
// expansion joint) nor "Special Piping" (discrete items: spade, spacer,
// reducer, barred tee) is a good fit — both describe POINT components,
// not continuous line styles/weights. The best EXISTING-section matches
// are:
//   PROCESS LINES      → 'piping' section — its own built-in default
//                         template already classifies lines the same way
//                         (MAIN FLOW / OTHERS FLOW / LINE ABOVE GROUND /
//                         LINE UNDER GROUND, etc.), so Major/Secondary/
//                         Minor/Existing/Future/Package line styles slot
//                         in naturally.
//   INSTRUMENTATION LINES → 'instrument_signal' section — its own
//                         built-in default template already lists
//                         Pneumatic/Hydraulic/Capillary/Electrical/
//                         Software-or-data-link/Electromagnetic-or-sonic
//                         signal types, a near-exact overlap with the
//                         customer's Pneumatic/Hydraulic/Capillary/
//                         Electrical/Soft Link/Sonic/Tubing list.
// No new section needed.
const PROCESS_LINES_LOOKUP = {
  'MAJOR PROCESS': 'MAJOR PROCESS',
  'SECONDARY PROCESS LINE AND UTILITY LINE': 'SECONDARY PROCESS LINE AND UTILITY LINE',
  'MINOR PROCESS': 'MINOR PROCESS',
  'EXISTING LINE': 'EXISTING LINE',
  'LINES TO BE DELETED': 'LINES TO BE DELETED',
  'FUTURE LINE': 'FUTURE LINE',
  'PACKAGE/SKID LINE': 'PACKAGE/SKID LINE',
};

const INSTRUMENTATION_LINES_LOOKUP = {
  'PROCESS INSTRUMENT LINE': 'PROCESS INSTRUMENT LINE',
  'PNEUMATIC': 'PNEUMATIC',
  'HYDRAULIC': 'HYDRAULIC',
  'CAPILLARY': 'CAPILLARY',
  'ELECTRICAL': 'ELECTRICAL',
  'MECHANICAL': 'MECHANICAL',
  'SOFT LINK (SOFTWARE)': 'SOFT LINK (SOFTWARE)',
  'SONIC': 'SONIC',
  'TUBING': 'TUBING',
};

const PROCESS_LINES_LEGEND_DEFINITION = {
  separator: '-',
  fields: [{
    key: 'process_line_type',
    label: 'Process Line Type',
    regex: '[A-Z0-9 /()&-]+',
    notes: 'Line weight/style from the customer Legend Sheet’s LINE SYMBOLS → PROCESS LINES table — identifies which lines are current, future, to-be-deleted, or package/skid, so only real, in-scope process lines are extracted.',
    lookup: PROCESS_LINES_LOOKUP,
  }],
};

const INSTRUMENTATION_LINES_LEGEND_DEFINITION = {
  separator: '-',
  fields: [{
    key: 'instrumentation_line_type',
    label: 'Instrumentation Line Type',
    regex: '[A-Z0-9 /()&-]+',
    notes: 'Signal-line style from the customer Legend Sheet’s LINE SYMBOLS → INSTRUMENTATION LINES table.',
    lookup: INSTRUMENTATION_LINES_LOOKUP,
  }],
};

// Control-valve variants and regulators — genuine "type" values the
// Valve section's own 15-entry VALVE SYMBOL REFERENCE doesn't cover
// (that list is manual/actuated on-off valve body shapes only).
const CONTROL_VALVE_REGULATOR_LOOKUP = {
  'CONTROL VALVE WITH HAND WHEEL': 'CONTROL VALVE WITH HAND WHEEL',
  'CONTROL VALVE (ANGLE TYPE)': 'CONTROL VALVE (ANGLE TYPE)',
  'PRESSURE REGULATOR': 'PRESSURE REGULATOR',
  'TEMPERATURE REGULATOR': 'TEMPERATURE REGULATOR',
  'LEVEL REGULATOR': 'LEVEL REGULATOR',
  'BACK PRESSURE REGULATOR': 'BACK PRESSURE REGULATOR',
};

const CONTROL_VALVE_REGULATOR_LEGEND_DEFINITION = {
  separator: '-',
  fields: [{
    key: 'control_valve_type',
    label: 'Control Valve Type',
    regex: '[A-Z0-9 /()&-]+',
    notes: 'Control-valve variant or regulator type — set "type" from this when the drawn symbol is a control valve/regulator rather than a manual/actuated on-off valve.',
    lookup: CONTROL_VALVE_REGULATOR_LOOKUP,
  }],
};

// BUG FIX (real, confirmed user confusion): this used to create THREE OR
// FOUR separate named legends per section (e.g. "Area Codes - Standard",
// "Line Format - Standard", "Drawing Format - Standard", "Fluid Code -
// Standard" all under line_list), with only the LAST one ending up
// "Active" — correct per PidCheckerV2LegendSheet's own one-active-per-
// section DB constraint, but confusing: a user opening Manage Legends saw
// several legends per section and had no way to tell which one actually
// mattered. Consolidated into exactly ONE legend per section (still
// auto-created ONLY when that section has no legend at all yet — never
// overwrites/duplicates existing user data), with every topic as its own
// FIELD inside that one legend instead of as separate legend rows. Every
// field still renders as its own labelled block (with its own lookup
// table) in the Vision prompt's "LEGEND REFERENCE:" section — see
// apps.pid_verification.services.piping_valve_mto_extractor's
// _format_legend_definition, which iterates `fields` the same way either
// way — so this is a pure UX simplification for Manage Legends, not a
// loss of any reference data reaching the prompt.
//
// TRADE-OFF worth knowing: this section's legends are the SAME ones
// shared with P&ID Verification V1/V2 (LegendSheetsModal's own "Create
// once, use everywhere" banner). V1/V2 has at least one real feature
// (ValidateLineTagsView / legend_validator.py) that compiles a legend's
// `fields` into ONE sequential regex and pattern-matches real extracted
// tags against it — a meaningful operation when a legend's fields really
// are the sequential segments of ONE tag format (the pre-merge legends
// were), but not when they're several UNRELATED topics concatenated
// together (post-merge). Valve MTO's own extraction never calls that
// regex — it only reads field labels/notes/lookups as prompt text — so
// this merge is harmless here, but if this same account's 'line_list' or
// 'valve' section is ever used with V1/V2's tag-validation feature, that
// feature will no longer produce a meaningful pass/fail per real tag.
const VALVE_MTO_COMPLETE_LEGEND_DEFINITION = {
  separator: '-',
  fields: [
    ...VALVE_IDENTIFICATION_LEGEND_DEFINITION.fields,
    ...VALVE_SYMBOLS_LEGEND_DEFINITION.fields,
    ...SPECIAL_VALVE_NUMBERING_LEGEND_DEFINITION.fields,
    ...CONTROL_VALVE_REGULATOR_LEGEND_DEFINITION.fields,
  ],
};

const PIPING_MTO_COMPLETE_LEGEND_DEFINITION = {
  separator: '-',
  fields: [
    { key: 'insulation_code', label: 'Insulation Code', regex: '[A-Z]',
      notes: 'Trailing single letter of the piping line format FF-DD-111XXX-XXXX-X.',
      lookup: INSULATION_CODES_LOOKUP },
    ...PROCESS_LINES_LEGEND_DEFINITION.fields,
    ...INSTRUMENTATION_LINES_LEGEND_DEFINITION.fields,
  ],
};

const SECTION_DEFAULT_LEGENDS = {
  // 'line_list' is NOT listed here — its one merged legend needs the
  // fluid-codes table fetched from the backend first, so it's built
  // directly in autoPopulateLegendSection below instead (see the
  // `section === 'line_list'` branch there).
  valve: [
    { name: 'Valve MTO - Complete',
      description: 'ALL valve reference data merged into one legend: Valve Identification (V111XXXX), all 15 valve symbols, PSV/SDV/BDV/MOV/SV numbering, and control valve/regulator types — auto-created default for Valve MTO extraction.',
      definition: VALVE_MTO_COMPLETE_LEGEND_DEFINITION },
  ],
  piping: [
    { name: 'Piping MTO - Complete',
      description: 'ALL piping reference data merged into one legend: insulation codes, process line styles, and instrumentation line styles — auto-created default for Valve MTO extraction.',
      definition: PIPING_MTO_COMPLETE_LEGEND_DEFINITION },
  ],
  instrument_signal: [
    { name: 'Instrumentation Lines - Standard',
      description: 'Customer Legend Sheet LINE SYMBOLS → INSTRUMENTATION LINES (Pneumatic/Hydraulic/Capillary/Electrical/Soft Link/Sonic/Tubing) — auto-created default for Valve MTO extraction.',
      definition: INSTRUMENTATION_LINES_LEGEND_DEFINITION },
  ],
  // Fills a real gap in 'valve' section's own 15-entry VALVE SYMBOL
  // REFERENCE: control-valve variants and regulators are genuine valve
  // types that reference doesn't cover. (Its content is ALSO folded into
  // "Valve MTO - Complete" above per this feature's own merge request —
  // this standalone legend is left as its own thing too, unchanged,
  // since 'control_valve_regulator' itself wasn't part of the merge.)
  control_valve_regulator: [
    { name: 'Control Valve - Standard',
      description: 'Control valve variants and regulators not covered by the Valve section’s own 15-entry VALVE SYMBOL REFERENCE — auto-created default for Valve MTO extraction.',
      definition: CONTROL_VALVE_REGULATOR_LEGEND_DEFINITION },
  ],
};

// Stat cards rendered above the table — fully soft-coded.
// Palette aligned to the common V1 engineering theme (blue/indigo family).
const STAT_CARDS = [
  { key: 'total',  label: 'Total Valves',  icon: Database, gradient: 'from-blue-500 to-indigo-600',
    pick: ({ rows })  => rows.length },
  { key: 'island', label: 'Σ Island Qty',  icon: MapPin,   gradient: 'from-sky-500 to-blue-600',
    pick: ({ rows })  => rows.reduce((a, r) => a + (Number(r.qty_island) || 0), 0) },
  { key: 'field',  label: 'Σ Field Qty',   icon: Layers,   gradient: 'from-violet-500 to-indigo-600',
    pick: ({ rows })  => rows.reduce((a, r) => a + (Number(r.qty_field) || 0), 0) },
  { key: 'history',label: 'Saved Snapshots', icon: HistoryIcon, gradient: 'from-emerald-500 to-teal-600',
    pick: ({ history }) => history.length },
];

// ─── Helpers ─────────────────────────────────────────────────────────────
const loadState = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      project: parsed.project || {},
      rows:    Array.isArray(parsed.rows) ? parsed.rows : [],
    };
  } catch {
    return { project: {}, rows: [] };
  }
};

const saveState = (state) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  try { window.dispatchEvent(new CustomEvent(REFRESH_EVENT)); } catch { /* no-op */ }
};

const sumQty = (rows, key) => rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
const colByKey = Object.fromEntries(VALVE_COLUMNS.map((c) => [c.key, c]));

// ─── Component ───────────────────────────────────────────────────────────
const ValveMTOPage = () => {
  const navigate = useNavigate();
  const [{ project, rows }, setState] = useState(() => loadState());
  const [activeId, setActiveId]       = useState(VALVE_TABS[0].id);
  const [search, setSearch]           = useState('');
  const [importMsg, setImportMsg]     = useState(null); // { type, text }
  const [importing, setImporting]     = useState(false);
  const [progress, setProgress]       = useState(null); // { current, total, rows } | null
  const [history, setHistory]         = useState(() => listHistory());
  const [projects, setProjects]       = useState(() => listProjects());
  const [activeProjectId, setActiveProjectId] = useState(() => {
    const initial = ensureInitialised(loadState());
    return initial.activeId;
  });
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  // BUG FIX (real, confirmed): `{project, rows}` state above is seeded
  // from loadState(), which mirrors whatever project was LAST active in
  // a previous session — so stat cards (Total Valves / Island Qty /
  // Field Qty) and the table showed that leftover project's data
  // immediately on page load, before the user had clicked anything on
  // the Projects tab. This flag gates DISPLAY only (visibleRows/totals/
  // stat cards below) — it deliberately does NOT touch `rows` itself or
  // the autosave/sync pipeline (saveState/syncActiveProject/
  // syncToServer), which still operate on the real underlying state
  // exactly as before; changing THAT would risk overwriting a project's
  // real saved data with emptiness on a page load that never explicitly
  // opened anything. Set true by every explicit "load a project's data"
  // action: switching projects, loading a Cloud project, creating a new
  // project, restoring a history snapshot, or a fresh extraction/import
  // completing.
  const [workspaceOpened, setWorkspaceOpened] = useState(false);
  // BUG FIX: this used to default to visible (false) and only hide itself
  // AFTER a Wrench error occurred — meaning every page load still showed
  // (and tried to eagerly use) the panel first, so a user on a page load
  // where Wrench happens to be unreachable saw an error moment before it
  // disappeared. Now hidden by default; the user can manually enable it
  // via the small toggle next to the project switcher if they actually
  // want to use it. See the AI Document Assist (Wrench) render block
  // below for the on-error auto-hide behaviour, which still applies once
  // enabled.
  const [wrenchPanelHidden, setWrenchPanelHidden] = useState(true);
  // Project dialog: { mode: 'create' | 'rename' | 'delete', target?: project }
  const [projectDialog, setProjectDialog] = useState(null);

  // ─── BYOK Vision (OpenAI/Claude) — see VALVE_VISION_CONFIG's own
  // comment for why this exists and its sessionStorage scoping. Always
  // shown as Step 1 of UploadHero's numbered steps (no longer a
  // collapsible toggle — see this feature's own requirement). ──────────
  const visionProviderStorageKey = `${VALVE_VISION_CONFIG.sessionStorageProviderKey}::${activeProjectId || 'unassigned'}`;
  const visionApiKeyStorageKey   = `${VALVE_VISION_CONFIG.sessionStorageApiKeyKey}::${activeProjectId || 'unassigned'}`;
  const [visionProvider, setVisionProvider] = useState(
    () => sessionStorage.getItem(`${VALVE_VISION_CONFIG.sessionStorageProviderKey}::${activeProjectId || 'unassigned'}`) || VALVE_VISION_CONFIG.defaultProvider,
  );
  const [visionApiKey, setVisionApiKey] = useState(
    () => sessionStorage.getItem(`${VALVE_VISION_CONFIG.sessionStorageApiKeyKey}::${activeProjectId || 'unassigned'}`) || '',
  );
  const [testingVisionKey, setTestingVisionKey] = useState(false);
  const [visionTestResult, setVisionTestResult] = useState(null);

  // ─── Scan mode (Quick vs Thorough) — see services.piping_valve_mto_
  // extractor's _scan_mode_params for exactly what each resolves to
  // server-side (tile grid + passes per page). Defaults to 'thorough'
  // per this feature's own requirement; persisted across sessions (not
  // per-project like the BYOK key above — it's a general scan-quality
  // preference, not something tied to one project's own data).
  const [scanMode, setScanMode] = useState(
    () => localStorage.getItem(SCAN_MODE_STORAGE_KEY) || SCAN_MODE_DEFAULT,
  );
  useEffect(() => {
    try { localStorage.setItem(SCAN_MODE_STORAGE_KEY, scanMode); } catch { /* no-op */ }
  }, [scanMode]);

  const handleTestVisionKey = async () => {
    if (!visionApiKey.trim()) { setVisionTestResult({ valid: false, message: 'Enter an API key first.' }); return; }
    setTestingVisionKey(true);
    setVisionTestResult(null);
    try {
      const res = await valveMtoService.testApiKey(visionProvider, visionApiKey.trim());
      setVisionTestResult(res);
    } catch (err) {
      setVisionTestResult({ valid: false, message: err?.response?.data?.message || err?.message || 'Test failed.' });
    } finally {
      setTestingVisionKey(false);
    }
  };

  // ─── Legend Sheets ──────────────────────────────────────────────────
  // CORRECTION: an earlier version of this built its OWN legend upload/
  // list UI + backend endpoints, reusing apps.pid_verification's
  // PIDVLegendSheet (an unstructured, AI-Vision-extracted legend system
  // with no "Valve" section) — the wrong system, entirely removed.
  // Valve MTO now reuses the EXISTING, shared LegendSheetsModal
  // component (same one P&ID Verification V1/V2 use), which already
  // manages apps.pid_checker_v2's structured, per-section-activated
  // legends — including a real 'valve' section — via its own internal
  // data fetching (pidCheckerV2API.js). No custom upload/list/delete
  // logic needed here at all; just open the shared modal.
  const [legendModalOpen, setLegendModalOpen] = useState(false);
  const [activatingLegends, setActivatingLegends] = useState(false);
  // BUG FIX: the modal's own "Upload symbol image" feature validates its
  // `projectId` against a PIDVProject row (apps.pid_verification), but
  // without this, Valve MTO never passed one — the modal's built-in
  // project selector only offers project_organizer.Project ids, a
  // completely different, unrelated UUID space, so every upload 404'd
  // with "project_id not found". Resolved once per session, cached here.
  const [legendProjectId, setLegendProjectId] = useState(null);

  // Fetches this user's PIDVProject list (same '/pid-verification/
  // projects/' endpoint V1/V2 already use via pidProjectsService) and
  // reuses the first one; creates "Valve MTO Default" only if the user
  // genuinely has none yet. Isolated to Valve MTO — no other module
  // reads or depends on this project.
  const resolveLegendProjectId = async () => {
    if (legendProjectId) return legendProjectId;
    try {
      const existing = await listPidvProjects();
      const list = Array.isArray(existing) ? existing : [];
      let project = list[0];
      if (!project) {
        project = await createPidvProject(
          VALVE_MTO_DEFAULT_PROJECT_NAME,
          'Auto-created so Valve MTO legend symbol-image uploads have a project to attach to.'
        );
      }
      const id = project?.project_id || null;
      if (id) setLegendProjectId(id);
      return id;
    } catch (err) {
      console.warn('[ValveMTO] Could not resolve a PIDVProject for legend symbol images:', err?.message);
      return null;
    }
  };

  // Auto-activates the user's own legend (if any) for each of Valve
  // MTO's 7 relevant sections before opening the modal — "these should
  // be ACTIVE by default for Valve MTO" per this feature's own
  // requirement. For every section with no SECTION_DEFAULT_LEGENDS entry,
  // only ever activates a legend the user already created (never
  // fabricates one) — a section with no legend at all is silently
  // skipped, same as the modal's own "no legends yet" empty state.
  // line_list/valve/piping/instrument_signal/control_valve_regulator are
  // the exception: if this user has NO legend at all yet for one of
  // those, its full set of SECTION_DEFAULT_LEGENDS (customer reference
  // data already baked into the Vision prompt statically) is created so a
  // brand-new user gets useful defaults from their very first extraction.
  // Only ONE legend per section can be active at a time (DB constraint),
  // so they're activated in sequence and the LAST one created ends up
  // active — see SECTION_DEFAULT_LEGENDS' own comment for the chosen
  // order. Never overwrites/duplicates EXISTING legends — this only
  // fires when the section is genuinely empty. Best-effort per section:
  // one section's failure (network hiccup, etc.) never blocks the others
  // or the modal from opening — this is a convenience, not a hard
  // requirement to extract.
  const autoPopulateLegendSection = async (section) => {
    try {
      const rows = await listLegends(section);
      const list = Array.isArray(rows) ? rows : [];
      const defaults = [...(SECTION_DEFAULT_LEGENDS[section] || [])];
      const hasOwnDefault = defaults.length > 0 || section === 'line_list';
      if (hasOwnDefault) {
        // BUG FIX (confirmed real on production): this used to gate on
        // `!list.length` — i.e. only auto-create when the section had
        // ZERO legends at all. That meant a single pre-existing, UNRELATED
        // legend (e.g. from P&ID Verification V1/V2, not Valve-MTO's own)
        // silently blocked the Valve-MTO-specific default forever, and
        // `list.some(l => l.is_active)` return-early above compounded it
        // by also skipping if any (possibly unrelated) legend was already
        // active. Now: match by NAME against this section's own
        // SECTION_DEFAULT_LEGENDS entries (set below, after the
        // line_list-specific one is built) — create+activate our own
        // default whenever it's missing, regardless of what else exists;
        // if it already exists, just make sure it's active. Still fully
        // idempotent — never duplicates our own default on repeat calls.
        if (section === 'line_list') {
          // Fetched lazily, only on this rare first-time-per-user path —
          // see the fluid-codes comment above for why this isn't a
          // hardcoded JS object. Merged into ONE legend with area
          // codes/line format/drawing format (same "one legend per
          // section" simplification as valve/piping above — see
          // SECTION_DEFAULT_LEGENDS' own comment).
          const { data } = await apiClient.get('/valve-mto/fluid-codes/');
          defaults.push({
            name: 'Line List MTO - Complete',
            description: 'ALL line-list reference data merged into one legend: fluid codes, area codes, line format (FF-DD-111XXX-XXXX-X), and drawing format (AD111-XXX-D-XXXXX) — auto-created default for Valve MTO extraction.',
            definition: {
              separator: '-',
              fields: [
                { key: 'fluid_code', label: 'Fluid Code', regex: '[A-Z]{1,3}',
                  notes: 'Leading segment (FF) of the piping line format FF-DD-111XXX-XXXX-X — validates a line number as real when it starts with one of these known codes.',
                  lookup: data?.codes || {} },
                ...AREA_CODES_LEGEND_DEFINITION.fields,
                ...LINE_FORMAT_LEGEND_DEFINITION.fields,
                ...DRAWING_FORMAT_LEGEND_DEFINITION.fields,
              ],
            },
          });
        }
        if (!defaults.length) return;
        const defaultNames = new Set(defaults.map((d) => d.name));
        const ownExisting = list.filter((l) => defaultNames.has(l.name));
        // PidCheckerV2LegendSheet has exactly ONE active legend per
        // (user, section) — no per-module dimension at all. Valve MTO's
        // own extraction needs ITS defaults active to feed the Vision
        // prompt (see _build_legend_context server-side), so this always
        // creates+activates them, even over a DIFFERENT already-active
        // legend. That used to visibly leak into P&ID V1/V2 and I/O
        // List's "Manage Legends" (an MTO legend would show there as the
        // active one) — now fixed at the source: LegendSheetsModal's own
        // `filterOutMTOLegends` prop (passed =true from PIDVerification.jsx
        // /PIDVerificationV2.jsx) hides any legend named with "MTO" from
        // both their legend list AND their active-legend reporting, so
        // activating our own default here can no longer surface there —
        // this file is the only caller that needs it active, and the
        // other callers now never see it regardless of what's active
        // server-side. (I/O List's own LegendSheetsModal is a fully
        // separate component/backend table — never shares this data at
        // all, so it was never actually affected either way.)
        if (ownExisting.length) {
          if (!ownExisting.some((l) => l.is_active)) {
            await activateLegend(ownExisting[0].legend_id);
          }
          return;
        }
        for (const def of defaults) {
          const created = await createLegend({ section, ...def });
          await activateLegend(created.legend_id);
        }
        return;
      }
      // No Valve-MTO-specific default for this section (e.g.
      // 'control_valve_regulator') — only ever activate a legend the user
      // already created themselves, never fabricate one here.
      if (!list.length || list.some((l) => l.is_active)) return;
      // listLegends orders by -updated_at (see LegendSheetsModal's
      // own refresh()), so the first row is the most recently
      // edited one for this section — the sensible default to
      // activate when the user hasn't picked one explicitly yet.
      await activateLegend(list[0].legend_id);
    } catch (err) {
      console.warn(`[ValveMTO] Could not auto-activate legend for section "${section}":`, err?.message);
    }
  };

  const handleOpenLegends = async () => {
    // TEMPORARY DIAGNOSTIC (per explicit request): confirms this handler
    // actually fires and shows which sections it's about to auto-populate
    // — remove once production auto-create is confirmed fixed.
    console.log('[ValveMTO] handleOpenLegends() called — sections:', VALVE_MTO_LEGEND_SECTIONS);
    setActivatingLegends(true);
    try {
      await Promise.all([
        resolveLegendProjectId(),
        ...VALVE_MTO_LEGEND_SECTIONS.map(autoPopulateLegendSection),
      ]);
    } finally {
      setActivatingLegends(false);
      setLegendModalOpen(true);
    }
  };

  // Fullscreen mode (soft-coded — see PMS_FULLSCREEN_CONFIG)
  const [isFullscreen, setIsFullscreen] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PMS_FULLSCREEN_CONFIG.persistKey) || 'false'); }
    catch (_) { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(PMS_FULLSCREEN_CONFIG.persistKey, JSON.stringify(isFullscreen)); }
    catch (_) {}
    if (typeof document === 'undefined') return undefined;
    if (isFullscreen) document.body.classList.add(PMS_FULLSCREEN_CONFIG.bodyLockClass);
    else              document.body.classList.remove(PMS_FULLSCREEN_CONFIG.bodyLockClass);
    const onKey = (e) => { if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove(PMS_FULLSCREEN_CONFIG.bodyLockClass);
    };
  }, [isFullscreen]);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayFilename, setOverlayFilename] = useState('');
  const [overlayStartedAt, setOverlayStartedAt] = useState(null);
  const [partialRows, setPartialRows] = useState([]);
  const fileRef = useRef(null);

  const activeTab = VALVE_TABS.find((t) => t.id === activeId) || VALVE_TABS[0];

  // ─── Server-side persistence (apps.valve_mto) ──────────────────────────
  // localStorage remains the fast, always-available copy (nothing above
  // changes) — this mirrors the same data server-side so it survives a
  // closed/cleared browser. 'idle' | 'saving' | 'saved' | 'error' — shown
  // as a small, non-blocking status next to the project switcher (a plain
  // inline <span> in the header, no overlay/fixed positioning — it was
  // never actually capable of blocking clicks on the rest of the page).
  const [serverSyncStatus, setServerSyncStatus] = useState('idle');
  const [serverProjects, setServerProjects] = useState([]);
  const [serverProjectsLoading, setServerProjectsLoading] = useState(false);

  // BUG FIX (real, confirmed): 'saved' never reverted to 'idle' on its
  // own — only the NEXT autosave/sync call changed serverSyncStatus
  // again, so "Saved to server" could sit in the header indefinitely
  // after a user's last edit, reading as the page being permanently
  // stuck even though nothing was actually blocked. Auto-dismiss it
  // after 3s, like a toast, back to the quiet "N projects backed up"
  // idle state. 'saving'/'error' are left alone — 'saving' needs to
  // stay visible for as long as a save is genuinely in flight, and
  // 'error' is actionable information worth leaving up rather than
  // silently hiding a failure.
  useEffect(() => {
    if (serverSyncStatus !== 'saved') return undefined;
    const t = setTimeout(() => setServerSyncStatus('idle'), 3000);
    return () => clearTimeout(t);
  }, [serverSyncStatus]);

  const refreshServerProjects = () => {
    setServerProjectsLoading(true);
    return valveMtoService.listProjects()
      .then((data) => setServerProjects(Array.isArray(data) ? data : []))
      .catch((err) => console.warn('[ValveMTO] Could not load server projects:', err?.message))
      .finally(() => setServerProjectsLoading(false));
  };

  // Load the user's server-saved projects once on mount — shown in the
  // "Cloud Projects" panel on the Projects tab (see CloudProjectsPanel),
  // letting a user browse/restore any project saved server-side, even
  // from a different browser/device than the one that created it.
  useEffect(() => {
    let cancelled = false;
    setServerProjectsLoading(true);
    valveMtoService.listProjects()
      .then((data) => { if (!cancelled) setServerProjects(Array.isArray(data) ? data : []); })
      .catch((err) => console.warn('[ValveMTO] Could not load server projects:', err?.message))
      .finally(() => { if (!cancelled) setServerProjectsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // BUG FIX (real, confirmed contributing cause of "stuck on Saving…"):
  // the post-extraction completion call (syncToServer(..., {status:
  // 'completed'})) and the debounced autosave effect below both call
  // this function, and both can fire within the same few hundred ms of
  // each other right after an extraction finishes (the completion call
  // is immediate/fire-and-forget; the autosave effect's own debounce
  // timer also fires once `rows`/`project` state updates). Two
  // overlapping in-flight calls can race on `localActive.serverId` being
  // read before the first call's createProject() has resolved and
  // persisted it — both then try to create a SEPARATE server-side
  // project, and whichever call's try/catch resolves LAST wins the
  // `serverSyncStatus` badge, regardless of which one actually matches
  // reality. These refs serialize calls: only one runs at a time, and a
  // call that arrives while one is already in flight is coalesced into a
  // single follow-up run (using its own, more current project/rows) that
  // fires the moment the in-flight one finishes, instead of starting a
  // second overlapping request.
  const syncInFlightRef = useRef(false);
  const pendingSyncRef = useRef(null);

  // Creates the server-side project on first save for this local project
  // (lazily — a brand-new, still-empty local project has nothing worth
  // syncing yet), then bulk-replaces its rows. Never throws to the
  // caller — a sync failure must never interrupt the localStorage-backed
  // UX, which already fully works without this.
  const syncToServer = async (currentProject, currentRows, { status } = {}) => {
    if (!currentRows.length) return;
    const localActive = getActiveProject();
    if (!localActive) return;
    if (syncInFlightRef.current) {
      // Remember the most recent request's data; never let a plain
      // autosave's lack of `status` silently erase an already-queued
      // 'completed' from an earlier request that raced it.
      pendingSyncRef.current = {
        project: currentProject,
        rows: currentRows,
        status: status || pendingSyncRef.current?.status,
      };
      return;
    }
    syncInFlightRef.current = true;
    setServerSyncStatus('saving');
    try {
      let serverId = localActive.serverId;
      if (!serverId) {
        const created = await valveMtoService.createProject({
          projectName: localActive.name || currentProject?.doc_title || 'Valve MTO Project',
          sourcePdfName: currentProject?.doc_no || '',
          status: status || 'extracting',
        });
        serverId = created.id;
        setProjectServerId(localActive.id, serverId);
      } else if (status) {
        await valveMtoService.updateProject(serverId, { status }).catch(() => {});
      }
      await valveMtoService.saveRows(serverId, currentRows);
      setServerSyncStatus('saved');
    } catch (err) {
      console.warn('[ValveMTO] Server sync failed (localStorage copy is unaffected):', err?.message);
      setServerSyncStatus('error');
    } finally {
      syncInFlightRef.current = false;
      const pending = pendingSyncRef.current;
      pendingSyncRef.current = null;
      if (pending) {
        syncToServer(pending.project, pending.rows, { status: pending.status });
      }
    }
  };

  // BUG FIX (real, confirmed root cause of "Saved to server" repeating
  // forever): this effect's dependency array is [project, rows] — React
  // compares those by REFERENCE, not content. saveState() below writes
  // to localStorage and dispatches REFRESH_EVENT; the cross-tab listener
  // a few lines down reacts to that event by calling
  // setState(loadState()), and loadState() does a fresh JSON.parse() —
  // which ALWAYS returns brand-new object/array references, even when
  // the content is byte-identical to what's already in state. Those new
  // references made this effect think project/rows had "changed" again,
  // so it re-ran saveState() -> REFRESH_EVENT -> setState(loadState())
  // -> [new references] -> this effect again, forever — each pass also
  // called syncToServer(), which is exactly why "Saved to server" kept
  // reappearing with no further user action. Fixed with a hasChanges
  // check: a content signature (not reference) of the last state this
  // effect actually acted on, so a reference-only replacement with
  // identical content is skipped instead of feeding the loop.
  const lastSyncedSignatureRef = useRef(null);

  // Auto-save (debounced) — also mirrors into the active project slot,
  // and (same debounce) into the server-side copy — "auto-save on every
  // edit" per this feature's own requirement.
  useEffect(() => {
    const t = setTimeout(() => {
      const signature = JSON.stringify({ project, rows });
      if (signature === lastSyncedSignatureRef.current) return;
      lastSyncedSignatureRef.current = signature;
      saveState({ project, rows });
      syncActiveProject({ project, rows });
      setProjects(listProjects());
      syncToServer(project, rows);
    }, AUTOSAVE_DEBOUNCE);
    return () => clearTimeout(t);
  }, [project, rows]);

  // Cross-tab sync.
  useEffect(() => {
    const onRefresh = () => setState(loadState());
    const onStorage = (e) => { if (e.key === STORAGE_KEY) setState(loadState()); };
    window.addEventListener(REFRESH_EVENT, onRefresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(REFRESH_EVENT, onRefresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // History sync.
  useEffect(() => {
    const onHistory = () => setHistory(listHistory());
    window.addEventListener(HISTORY_REFRESH_EVENT, onHistory);
    return () => window.removeEventListener(HISTORY_REFRESH_EVENT, onHistory);
  }, []);

  // Projects sync.
  useEffect(() => {
    const onProjects = () => setProjects(listProjects());
    window.addEventListener(PROJECTS_REFRESH_EVENT, onProjects);
    return () => window.removeEventListener(PROJECTS_REFRESH_EVENT, onProjects);
  }, []);

  // ─── Derived: filtered rows per active tab ─────────────────────────────
  const visibleRows = useMemo(() => {
    // See workspaceOpened's own comment — empty state until the user
    // explicitly opens a project, even though `rows` itself may still
    // hold a previous session's data underneath.
    let list = workspaceOpened ? rows : [];
    if (activeTab.areaFilter) {
      const af = activeTab.areaFilter.toLowerCase();
      list = list.filter((r) => String(r.area || '').toLowerCase() === af);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) =>
        VALVE_COLUMNS.some((c) => String(r[c.key] ?? '').toLowerCase().includes(q)),
      );
    }
    return list;
  }, [rows, activeTab, search, workspaceOpened]);

  const totals = useMemo(() => ({
    island: sumQty(visibleRows, 'qty_island'),
    field:  sumQty(visibleRows, 'qty_field'),
    total:  sumQty(visibleRows, 'qty_island') + sumQty(visibleRows, 'qty_field'),
    count:  visibleRows.length,
  }), [visibleRows]);

  // ─── Mutators ──────────────────────────────────────────────────────────
  const updateProject = (key, value) =>
    setState((s) => ({ ...s, project: { ...s.project, [key]: value } }));

  const updateRow = (id, key, value) =>
    setState((s) => ({
      ...s,
      rows: s.rows.map((r) => (r.id === id ? { ...r, [key]: value } : r)),
    }));

  const addRow = () => {
    const r = DEFAULT_ROW();
    if (activeTab.areaFilter) r.area = activeTab.areaFilter;
    r.sl_no = rows.length + 1;
    setState((s) => ({ ...s, rows: [...s.rows, r] }));
    // A manually-added row must be visible immediately, not silently
    // added to a still-hidden `rows` — see workspaceOpened's own comment.
    setWorkspaceOpened(true);
  };

  const deleteRow = (id) =>
    setState((s) => ({ ...s, rows: s.rows.filter((r) => r.id !== id) }));

  const clearAll = async () => {
    if (!(await radaiConfirm('Clear all valves? This cannot be undone (export first if needed).'))) return;
    setState({ project, rows: [] });
  };

  // ─── Import / Export ───────────────────────────────────────────────────
  const onPickFile = () => fileRef.current?.click();

  // Shim used by the AI Document Assist panel to hand a File from Wrench
  // straight into the existing import flow — no core logic changes.
  const runImportForFile = (file) => {
    if (!file) return;
    onFileChange({ target: { files: [file], value: '' } });
  };

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    setImportMsg(null);
    setProgress(null);
    setPartialRows([]);
    const isPdfFile = PDF_EXTRACTION_CONFIG.pdfRegex.test(file.name);
    if (isPdfFile) {
      setOverlayFilename(file.name);
      setOverlayStartedAt(Date.now());
      setOverlayOpen(true);
    }
    try {
      const isPdf = isPdfFile;
      let parsed = [];
      let projectMeta = {};
      let engineLabel = 'spreadsheet';
      let pdfSnapshot = null;

      if (isPdf) {
        // ── 1) Start the async extraction job ─────────────────────────────────────────────────────
        setImportMsg({ type: 'warn', text: 'Uploading PDF & queuing AI Vision extraction…' });
        const fd = new FormData();
        fd.append(PDF_EXTRACTION_CONFIG.fileFieldName, file);
        // BYOK — only sent when the user actually entered a key; omitted
        // entirely otherwise so the backend falls back to the admin-
        // configured OpenAI key exactly as it always has (see
        // _resolve_vision_credential's own docstring on the backend).
        if (visionApiKey.trim()) {
          fd.append('vision_provider', visionProvider);
          fd.append('vision_api_key', visionApiKey.trim());
        }
        // Always sent explicitly (not omit-when-default, unlike BYOK
        // above) — the backend also defaults to 'thorough' on its own,
        // but sending it here keeps the two sides from ever silently
        // disagreeing if either default is ever changed independently.
        fd.append('scan_mode', scanMode);
        const { data: startResp } = await apiClient.post(
          PDF_EXTRACTION_CONFIG.startEndpoint, fd,
          {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: PDF_EXTRACTION_CONFIG.startTimeoutMs,
          },
        );
        if (startResp?.status === 'error') throw new Error(startResp.message || 'Could not start extraction.');
        const jobId = startResp?.job_id;
        if (!jobId) throw new Error('Backend did not return a job_id.');

        // ── 2) Poll until done ────────────────────────────────────────────────────────────────────
        // Adaptive deadlines:
        //   • absoluteDeadline — hard ceiling, never extended.
        //   • stallDeadline    — extends whenever the backend reports forward
        //                        progress (page advanced or row count grew).
        const startedAt        = Date.now();
        const absoluteDeadline = startedAt + PDF_EXTRACTION_CONFIG.absoluteMaxDurationMs;
        let   stallDeadline    = startedAt + PDF_EXTRACTION_CONFIG.stallTimeoutMs;
        let   lastProgressKey  = '';   // "<current>:<total>:<rowCount>"
        let   lastSnapshot     = null;

        while (true) {
          const now = Date.now();
          if (now > absoluteDeadline) {
            const mins = Math.round(PDF_EXTRACTION_CONFIG.absoluteMaxDurationMs / 60000);
            throw new Error(`Extraction exceeded the safety ceiling of ${mins} min. The backend job is still running — refresh the page and any partial rows already saved will reappear.`);
          }
          if (now > stallDeadline) {
            const mins = Math.round(PDF_EXTRACTION_CONFIG.stallTimeoutMs / 60000);
            throw new Error(`No progress reported from the backend for ${mins} min. The server may be stuck — try again with a smaller PDF or check the deployment logs.`);
          }

          await new Promise((res) => setTimeout(res, PDF_EXTRACTION_CONFIG.pollIntervalMs));

          let snapshot;
          try {
            const { data } = await apiClient.get(
              PDF_EXTRACTION_CONFIG.statusEndpoint(jobId),
              { timeout: PDF_EXTRACTION_CONFIG.statusTimeoutMs },
            );
            snapshot = data;
          } catch (pollErr) {
            // Transient network/timeouts during polling shouldn't kill the job.
            console.warn('[ValveMTO] poll error (continuing):', pollErr?.message);
            continue;
          }
          lastSnapshot = snapshot;

          // Reset the stall timer whenever the backend reports forward progress
          // OR a heartbeat (updated_at changes). The latter covers the slow
          // PDF→JPEG render phase, which can take minutes on a slim-CPU
          // container without producing AI rows yet.
          const p           = snapshot?.progress || {};
          const rowsLen     = Array.isArray(snapshot?.rows) ? snapshot.rows.length : 0;
          const progressKey = `${snapshot?.status || ''}:${p.current || 0}:${p.total || 0}:${p.rows || rowsLen}:${snapshot?.updated_at || ''}`;
          if (progressKey !== lastProgressKey) {
            lastProgressKey = progressKey;
            stallDeadline   = Date.now() + PDF_EXTRACTION_CONFIG.stallTimeoutMs;
          }

          // Live progress UI (also used for partial rows as they arrive).
          if (snapshot?.progress) {
            setProgress(snapshot.progress);
            const { current, total, rows: rowsCount } = snapshot.progress;
            setImportMsg({
              type: 'warn',
              text: `AI Vision extracting… batch ${current}/${total || '?'} · ${rowsCount} valve row(s) found so far.`,
            });
          }

          // Stream partial rows so the user sees something while waiting.
          if (Array.isArray(snapshot?.rows) && snapshot.rows.length) {
            const liveRows = snapshot.rows.map((r) => {
              const merged = { ...DEFAULT_ROW(), ...r };
              const derived = deriveRemarksFromRow(merged);
              if (derived) merged.remarks = mergeRemarks(merged.remarks, derived);
              return merged;
            });
            setPartialRows(liveRows);
            setState((s) => ({
              project: { ...s.project, ...(snapshot.project_meta || {}) },
              rows: liveRows,
            }));
          }

          if (snapshot?.status === 'done')  break;
          if (snapshot?.status === 'error') {
            throw new Error(snapshot.error || 'Backend extraction failed.');
          }
        }

        parsed      = (lastSnapshot?.rows || []).map((r) => {
          const merged = { ...DEFAULT_ROW(), ...r };
          const derived = deriveRemarksFromRow(merged);
          if (derived) merged.remarks = mergeRemarks(merged.remarks, derived);
          return merged;
        });
        projectMeta = lastSnapshot?.project_meta || {};
        engineLabel = lastSnapshot?.engine || 'vision';
        pdfSnapshot = lastSnapshot;
      } else {
        // Client-side spreadsheet importer.
        const result = await importValveMTOFile(file);
        parsed      = result.rows;
        projectMeta = result.projectMeta;
      }

      if (!parsed.length) {
        // Surface backend warnings (e.g. OpenAI quota / API errors) when the
        // PDF extractor returns zero rows, so the user knows WHY nothing
        // came back instead of guessing the file is bad.
        const backendWarnings = pdfSnapshot?.warnings || [];
        const hint = backendWarnings.length
          ? ` Backend reported: ${backendWarnings[0]}`
          : '';
        setImportMsg({
          type: 'warn',
          text: `No valve rows could be detected in this file.${hint}`,
        });
      } else {
        const finalRows = parsed.map((r, i) => ({ ...r, sl_no: i + 1 }));
        const finalProject = { ...project, ...projectMeta };
        setState({ project: finalProject, rows: finalRows });
        setWorkspaceOpened(true);
        // Save the freshly extracted/imported rows to the server
        // immediately (not just via the debounced autosave) — "after
        // extraction completes: save all rows to server" per this
        // feature's own requirement. Fire-and-forget: a failure here is
        // logged (see syncToServer) but never blocks the success message
        // below — the data is still safe in localStorage either way.
        syncToServer(finalProject, finalRows, { status: 'completed' });
        // Auto-save a history snapshot so the user never has to re-extract.
        const snap = saveHistoryEntry({
          source:     isPdf ? 'pdf' : 'spreadsheet',
          sourceFile: file.name,
          engine:     engineLabel,
          project:    finalProject,
          rows:       finalRows,
        });
        if (snap) setHistory(listHistory());
        setImportMsg({
          type: 'ok',
          text: `Imported ${parsed.length} valve row(s) via ${engineLabel}${projectMeta.doc_no ? ` · ${projectMeta.doc_no}` : ''}. Snapshot saved to History.`,
        });
        setActiveId('all');
      }
    } catch (err) {
      console.error('[ValveMTO] Import failed:', err);
      let msg = err?.response?.data?.message || err?.message || 'Import failed.';
      if (err?.code === 'ECONNABORTED') {
        msg = 'AI Vision is still running but the network call timed out. Refresh the page — partial rows already saved will reappear, or try a smaller PDF.';
      }
      setImportMsg({ type: 'err', text: msg });
    } finally {
      setImporting(false);
      setProgress(null);
      setOverlayOpen(false);
      setOverlayStartedAt(null);
      setPartialRows([]);
    }
  };

  const onExport = () => {
    if (!rows.length) {
      setImportMsg({ type: 'warn', text: 'Add or import valves first, then export.' });
      return;
    }
    const filename = `${(project.doc_no || 'Valve_MTO').replace(/[\\/*?:[\]\s]+/g, '_')}.xlsx`;
    exportValveMTOWorkbook({ rows, project, filename });
  };

  // Separate "Download All Data" export — all 18 server-shaped columns on
  // every sheet, every row (real + line-recovery placeholders, same as
  // onExport above already includes — neither export filters those out).
  const onExportAllData = () => {
    if (!rows.length) {
      setImportMsg({ type: 'warn', text: 'Add or import valves first, then export.' });
      return;
    }
    const filename = `${(project.doc_no || 'Valve_MTO').replace(/[\\/*?:[\]\s]+/g, '_')}_AllData.xlsx`;
    exportValveMTOAllData({ rows, project, filename });
  };

  // ─── History ───────────────────────────────────────────────────────────
  const onSaveSnapshot = async () => {
    if (!rows.length) {
      setImportMsg({ type: 'warn', text: 'Add or import valves first — nothing to snapshot yet.' });
      return;
    }
    const label = (await radaiPrompt('Name this snapshot (leave blank to auto-name):', ''));
    if (label === null) return;
    const snap = saveHistoryEntry({
      source:  'manual',
      project, rows,
      label:   (label || '').trim() || undefined,
    });
    if (snap) {
      setHistory(listHistory());
      setImportMsg({ type: 'ok', text: `Snapshot “${snap.label}” saved to History.` });
    }
  };

  const onRestoreSnapshot = async (entry) => {
    if (!entry) return;
    const proceed = !rows.length || (await radaiConfirm(
      `Replace current ${rows.length} valve row(s) with snapshot “${entry.label}” (${entry.rowCount} row(s))?`,
    ));
    if (!proceed) return;
    setState({
      project: { ...(entry.project || {}) },
      rows:    (entry.rows || []).map((r, i) => ({ ...r, sl_no: i + 1 })),
    });
    setWorkspaceOpened(true);
    setActiveId('all');
    setImportMsg({ type: 'ok', text: `Restored snapshot “${entry.label}” (${entry.rowCount} row(s)).` });
  };

  const onRenameSnapshot = async (entry) => {
    const next = (await radaiPrompt('Rename snapshot:', entry.label));
    if (next == null) return;
    renameHistoryEntry(entry.id, next);
    setHistory(listHistory());
  };

  const onDeleteSnapshot = async (entry) => {
    if (!(await radaiConfirm(`Delete snapshot “${entry.label}”? This cannot be undone.`))) return;
    deleteHistoryEntry(entry.id);
    setHistory(listHistory());
  };

  const onClearHistory = async () => {
    if (!history.length) return;
    if (!(await radaiConfirm(`Delete all ${history.length} snapshot(s)? This cannot be undone.`))) return;
    clearHistory();
    setHistory(listHistory());
  };

  // ─── Projects ─────────────────────────────────────────────────────────────
  const onCreateProject = () => {
    setProjectMenuOpen(false);
    setProjectDialog({ mode: 'create' });
  };

  const onSwitchProject = (id) => {
    // BUG FIX: used to early-return as a no-op whenever `id` already
    // equalled `activeProjectId` — which, on a fresh page load, is
    // whatever project was active in a PREVIOUS session (see
    // ensureInitialised/workspaceOpened's own comment), never actually
    // opened by the user yet. Clicking that exact project in the
    // Projects list used to do nothing visible at all (stats stayed at
    // 0). Now still short-circuits the actual id-switch work when
    // nothing would change, but always falls through to mark the
    // workspace opened so its data/stats actually display.
    if (id === activeProjectId) {
      setWorkspaceOpened(true);
      setProjectMenuOpen(false);
      return;
    }
    // Persist current workspace into the outgoing active project.
    syncActiveProject({ project, rows });
    setActiveProject(id);
    const next = getActiveProject();
    if (next) {
      setActiveProjectId(next.id);
      setState({ project: { ...(next.project || {}) }, rows: (next.rows || []).map((r) => ({ ...r })) });
      setWorkspaceOpened(true);
      setImportMsg({ type: 'ok', text: `Switched to “${next.name}” (${next.rows?.length || 0} valve row(s)).` });
    }
    setProjectMenuOpen(false);
  };

  const onRenameActiveProject = () => {
    const cur = projects.find((p) => p.id === activeProjectId);
    if (!cur) return;
    setProjectMenuOpen(false);
    setProjectDialog({ mode: 'rename', target: cur });
  };

  const onDeleteActiveProject = () => {
    const cur = projects.find((p) => p.id === activeProjectId);
    if (!cur) return;
    setProjectMenuOpen(false);
    setProjectDialog({ mode: 'delete', target: cur });
  };

  // ─── Cloud Projects (server-side, apps.valve_mto) ──────────────────────
  // Loads a server-saved project into the workspace — reuses the LOCAL
  // project it's already linked to (via serverId) if one exists on this
  // browser, so re-loading doesn't create a duplicate local entry every
  // time; otherwise creates a fresh local project to hold it (e.g. the
  // browser was cleared, or this project was saved from a different
  // device).
  const onLoadServerProject = async (serverProject) => {
    syncActiveProject({ project, rows });
    try {
      const localMatch = projects.find((p) => p.serverId === serverProject.id);
      const mappedRows = await valveMtoService.getRows(serverProject.id);
      const nextProject = { doc_title: serverProject.project_name, doc_no: serverProject.source_pdf_name || '' };
      let targetId;
      if (localMatch) {
        targetId = localMatch.id;
        setActiveProject(targetId);
        syncActiveProject({ project: nextProject, rows: mappedRows });
      } else {
        const entry = createProject({
          name: serverProject.project_name,
          project: nextProject,
          rows: mappedRows,
          serverId: serverProject.id,
        });
        targetId = entry.id;
      }
      setActiveProjectId(targetId);
      setState({ project: nextProject, rows: mappedRows });
      setWorkspaceOpened(true);
      setProjects(listProjects());
      setActiveId('all');
      setImportMsg({ type: 'ok', text: `Loaded “${serverProject.project_name}” from the server (${mappedRows.length} valve row(s)).` });
    } catch (err) {
      setImportMsg({ type: 'err', text: err?.response?.data?.error || err?.message || 'Could not load this project from the server.' });
    }
  };

  const onRenameServerProject = async (serverProject) => {
    const name = await radaiPrompt('Rename this cloud project:', serverProject.project_name || '');
    if (name === null) return;
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    try {
      await valveMtoService.updateProject(serverProject.id, { project_name: trimmed, status: serverProject.status });
      await refreshServerProjects();
    } catch (err) {
      setImportMsg({ type: 'err', text: err?.response?.data?.error || err?.message || 'Rename failed.' });
    }
  };

  const onDeleteServerProject = async (serverProject) => {
    if (!(await radaiConfirm(`Delete “${serverProject.project_name}” from the server? This cannot be undone. (Any local copy in this browser is kept.)`))) return;
    try {
      await valveMtoService.deleteProject(serverProject.id);
      // Unlink any local project that pointed at it — the server row is
      // gone, so autosave must create a fresh one rather than trying to
      // update/save-rows against an id that no longer exists.
      const localMatch = projects.find((p) => p.serverId === serverProject.id);
      if (localMatch) setProjectServerId(localMatch.id, null);
      await refreshServerProjects();
    } catch (err) {
      setImportMsg({ type: 'err', text: err?.response?.data?.error || err?.message || 'Delete failed.' });
    }
  };

  // BUG FIX (real, confirmed gap): valveMtoService.exportXlsx() — a
  // fully-built server-side xlsx export (apps.valve_mto.views's own
  // `export` action, using export_project_to_xlsx) — had NO button
  // anywhere calling it. The main toolbar's "Download Valve MTO (.xlsx)"
  // button (onExport below) already existed and works fine for the
  // CURRENT in-browser `rows`, on every tab (it lives in the page header,
  // not inside any tab's content, so it's not tab-scoped at all) — but a
  // project sitting in Cloud Projects, not yet Loaded into the local
  // workspace, had no way to download its xlsx directly. This closes
  // that gap without requiring a Load first.
  const onExportServerProject = async (serverProject) => {
    try {
      const filename = `${(serverProject.project_name || 'Valve_MTO').replace(/[\\/*?:[\]\s]+/g, '_')}.xlsx`;
      await valveMtoService.exportXlsx(serverProject.id, filename);
    } catch (err) {
      setImportMsg({ type: 'err', text: err?.response?.data?.error || err?.message || 'Download failed.' });
    }
  };

  // Modal submit handlers
  const submitCreateProject = ({ name, description }) => {
    syncActiveProject({ project, rows });
    const entry = createProject({ name: name.trim(), description: (description || '').trim() });
    if (entry) {
      setActiveProjectId(entry.id);
      setState({ project: {}, rows: [] });
      setWorkspaceOpened(true);
      setProjects(listProjects());
      setProjectDialog(null);
      setImportMsg({ type: 'ok', text: `Project “${entry.name}” created. Workspace cleared — ready to import or add valves.` });
      setActiveId('upload');
    }
  };

  const submitRenameProject = ({ id, name, description }) => {
    renameProject(id, name.trim(), (description || '').trim());
    setProjects(listProjects());
    setProjectDialog(null);
    setImportMsg({ type: 'ok', text: `Project renamed to “${name.trim()}”.` });
  };

  const submitDeleteProject = ({ id }) => {
    const cur = projects.find((p) => p.id === id);
    const newActive = deleteProject(id);
    setProjects(listProjects());
    if (newActive) {
      setActiveProjectId(newActive);
      const np = getActiveProject();
      if (np) setState({ project: { ...(np.project || {}) }, rows: (np.rows || []).map((r) => ({ ...r })) });
    }
    setProjectDialog(null);
    setImportMsg({ type: 'ok', text: `Project “${cur?.name || ''}” deleted.` });
  };


  const activeProject = projects.find((p) => p.id === activeProjectId);

  // ─── Render helpers ────────────────────────────────────────────────────
  const renderField = (col, row) => {
    const v = row[col.key] ?? '';
    if (col.type === 'select' && col.options) {
      return (
        <input
          list={`vmto-${col.key}`}
          value={v}
          onChange={(e) => updateRow(row.id, col.key, e.target.value)}
          className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
        />
      );
    }
    if (col.type === 'number') {
      return (
        <input
          type="number"
          value={v}
          onChange={(e) => updateRow(row.id, col.key, e.target.value === '' ? '' : Number(e.target.value))}
          className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      );
    }
    return (
      <input
        type="text"
        value={v}
        onChange={(e) => updateRow(row.id, col.key, e.target.value)}
        className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
      />
    );
  };

  return (
    <div
      className={`min-h-screen relative overflow-x-hidden ${PAGE_TOP_OFFSET}${isFullscreen ? ` ${PMS_FULLSCREEN_CONFIG.wrapClass}` : ''}`}
      style={PMS_THEME.enabled ? { background: PMS_THEME.bg } : undefined}
    >
      {/* Legacy background class preserved for the disabled-theme fallback */}
      {!PMS_THEME.enabled && (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-amber-50 to-orange-50" />
      )}

      {/* Common V1 chrome — dot grid + animated top bar */}
      {PMS_THEME.enabled && (
        <>
          <div className="fixed inset-0 pointer-events-none"
            style={{ backgroundImage: PMS_THEME.gridDot, backgroundSize: '44px 44px' }} />
          <div className="absolute inset-x-0 top-0 h-[3px] pointer-events-none"
            style={{ backgroundImage: PMS_THEME.gradBar, backgroundSize: '300% auto', animation: 'pmsGradShift 4s linear infinite' }} />
          <style>{`@keyframes pmsGradShift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }`}</style>
        </>
      )}
      {/* Soft-coded fullscreen styles — lifts the page above app chrome */}
      <style>{`
        .${PMS_FULLSCREEN_CONFIG.wrapClass} {
          position: fixed; inset: 0; z-index: ${PMS_FULLSCREEN_CONFIG.zIndex};
          overflow-y: auto;
          animation: pmsFsIn 0.2s ease both;
        }
        body.${PMS_FULLSCREEN_CONFIG.bodyLockClass} { overflow: hidden !important; }
        @keyframes pmsFsIn { from{opacity:0;transform:scale(0.985)} to{opacity:1;transform:scale(1)} }
      `}</style>

      {/* Datalists for soft-coded option lists */}
      {VALVE_COLUMNS.filter((c) => c.options).map((c) => (
        <datalist key={c.key} id={`vmto-${c.key}`}>
          {c.options.map((o) => <option key={o} value={o} />)}
        </datalist>
      ))}

      {/* ── Header — V1-style light card (common design) ─────────────── */}
      <div className={`${LOCAL_HEADER_CLASS} relative z-10`}>
        <div
          className="mx-auto px-4 sm:px-6 lg:px-8 pt-4"
          style={{ maxWidth: isFullscreen ? PMS_FULLSCREEN_CONFIG.fullscreenMaxWidth : PMS_FULLSCREEN_CONFIG.normalMaxWidth }}
        >
          <div className="rounded-2xl mb-0" style={PMS_THEME.enabled ? { ...PMS_THEME.headerCard, padding: '20px 24px' } : { padding: '4px 0' }}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 min-w-0">
              <button
                onClick={() => navigate(BACK_ROUTE)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-white/70 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <div className="p-2.5 rounded-xl text-white" style={PMS_THEME.enabled ? { background: PMS_THEME.accent, boxShadow: '0 4px 14px rgba(59,130,246,0.3)' } : { background: 'linear-gradient(135deg,#f59e0b,#ea580c)' }}>
                <Wrench className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-blue-600 text-[11px] font-bold tracking-[0.22em] uppercase">{PMS_THEME.eyebrow}</span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ background: `${PMS_THEME.badge.color}15`, color: PMS_THEME.badge.color, border: `1px solid ${PMS_THEME.badge.color}30` }}>
                    <Check className="w-3 h-3" /> {PMS_THEME.badge.text}
                  </span>
                </div>
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight" style={{ margin: 0 }}>{PAGE_TITLE}</h1>
                <p className="text-xs text-slate-500 mt-0.5" style={{ margin: '2px 0 0' }}>{PAGE_SUBTITLE}</p>
                {/* Feature pills — V1 colour-coded */}
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {PMS_THEME.featurePills.map(p => (
                    <span key={p.label} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{ background: `${p.color}10`, color: p.color, border: `1px solid ${p.color}22` }}>
                      {p.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="h-8 w-px bg-slate-200 ml-2" />
              {/* Project switcher */}
              <ProjectSwitcher
                activeProject={activeProject}
                projects={projects}
                open={projectMenuOpen}
                onToggle={() => setProjectMenuOpen((v) => !v)}
                onClose={() => setProjectMenuOpen(false)}
                onSwitch={onSwitchProject}
                onCreate={onCreateProject}
                onRename={onRenameActiveProject}
                onDelete={onDeleteActiveProject}
              />
              {/* Server-side persistence status (apps.valve_mto) — see
                  syncToServer's own comment. Purely informational; the
                  page works fully without this succeeding. */}
              {serverSyncStatus === 'idle' && serverProjects.length > 0 && (
                <span className="text-[11px] text-slate-400" title="Projects backed up on the server from this or another session">
                  {serverProjects.length} project{serverProjects.length === 1 ? '' : 's'} backed up
                </span>
              )}
              {serverSyncStatus !== 'idle' && (
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded ${
                    serverSyncStatus === 'saving' ? 'text-slate-400'
                      : serverSyncStatus === 'error' ? 'text-amber-600 bg-amber-50'
                        : 'text-emerald-600 bg-emerald-50'
                  }`}
                  title={
                    serverSyncStatus === 'error'
                      ? 'Could not save to the server — your data is still safe in this browser.'
                      : 'Server-side backup status'
                  }
                >
                  {serverSyncStatus === 'saving' && <RefreshCw className="w-3 h-3 animate-spin" />}
                  {serverSyncStatus === 'saved' && <Check className="w-3 h-3" />}
                  {serverSyncStatus === 'error' && <AlertTriangle className="w-3 h-3" />}
                  {serverSyncStatus === 'saving' ? 'Saving…' : serverSyncStatus === 'saved' ? 'Saved to server' : 'Server save failed'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onPickFile}
                disabled={importing}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg shadow-sm transition-colors disabled:opacity-60"
                title="Import an existing Valve MTO .xls / .xlsx / .csv or P&ID PDF"
              >
                {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                {importing ? 'Importing…' : 'Import'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED_TYPES}
                onChange={onFileChange}
                className="hidden"
              />
              <button
                onClick={onSaveSnapshot}
                disabled={!rows.length}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                title="Save the current Valve MTO to History for future reuse"
              >
                <SaveIcon className="w-4 h-4" /> Save Snapshot
              </button>
              <button
                onClick={() => setActiveId('history')}
                className="relative inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-sm transition-colors"
                title="Open History panel"
              >
                <HistoryIcon className="w-4 h-4" /> History
                {history.length > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold text-white bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full">
                    {history.length}
                  </span>
                )}
              </button>
              {PMS_FULLSCREEN_CONFIG.enabled && (
                <button
                  onClick={() => setIsFullscreen((v) => !v)}
                  title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Expand to fullscreen'}
                  aria-pressed={isFullscreen}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-sm transition-colors"
                >
                  {isFullscreen
                    ? <><Minimize2 className="w-4 h-4" /> Exit</>
                    : <><Maximize2 className="w-4 h-4" /> Fullscreen</>
                  }
                </button>
              )}
              <button
                onClick={onExport}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-xl transition-all hover:-translate-y-px"
                style={PMS_THEME.enabled
                  ? { background: PMS_THEME.accent, boxShadow: '0 4px 12px rgba(59,130,246,0.35)' }
                  : { background: 'linear-gradient(90deg,#10b981,#059669)' }}
                title="Export the standard 5-sheet Valve MTO workbook"
              >
                <Download className="w-4 h-4" />
                Download Valve MTO (.xlsx)
              </button>
              <button
                onClick={onExportAllData}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-xl transition-all hover:-translate-y-px"
                style={{ background: 'linear-gradient(90deg,#0ea5e9,#2563eb)', boxShadow: '0 4px 12px rgba(37,99,235,0.35)' }}
                title="Export every column and every row (including line-recovery placeholder rows) across ALL VALVES / ISLAND / FIELD / COMBINED MTO / Pivot Summary"
              >
                <Download className="w-4 h-4" />
                Download All Data
              </button>
            </div>
          </div>
          </div>
        </div>

        {/* ── Tab Bar ─────────────────────────────────────────────── */}
        <div
          className="mx-auto px-4 sm:px-6 lg:px-8"
          style={{ maxWidth: isFullscreen ? PMS_FULLSCREEN_CONFIG.fullscreenMaxWidth : PMS_FULLSCREEN_CONFIG.normalMaxWidth }}
        >
          <div className="flex gap-1 overflow-x-auto -mb-px">
            {VALVE_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = tab.id === activeId;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveId(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    active
                      ? 'border-indigo-600 text-indigo-700 bg-indigo-50/60'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────── */}
      <div
        className="mx-auto px-4 sm:px-6 lg:px-8 py-6"
        style={{ maxWidth: isFullscreen ? PMS_FULLSCREEN_CONFIG.fullscreenMaxWidth : PMS_FULLSCREEN_CONFIG.normalMaxWidth }}
      >
        {importMsg && (
          <div
            className={`mb-4 flex items-start gap-3 p-3 rounded-lg border text-sm ${
              importMsg.type === 'ok'   ? 'border-emerald-200 bg-emerald-50 text-emerald-900' :
              importMsg.type === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-900' :
                                          'border-rose-200 bg-rose-50 text-rose-900'
            }`}
          >
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <div className="flex-1">{importMsg.text}</div>
            <button onClick={() => setImportMsg(null)} className="text-xs opacity-70 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}


        {/* ── Manage Legends — opens the SAME shared LegendSheetsModal
            P&ID Verification V1/V2 use (apps.pid_checker_v2). Auto-
            activates the user's own legend (if any) for Valve MTO's 5
            relevant sections first — see handleOpenLegends's own
            comment. Same small-button style as the two rows either
            side of it. ───────────────────────────────────────────── */}
        <button
          type="button"
          onClick={handleOpenLegends}
          disabled={activatingLegends}
          className="mb-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100 rounded-lg transition-colors disabled:opacity-60"
        >
          {activatingLegends ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <BookOpenIcon className="w-3.5 h-3.5" />}
          {activatingLegends ? 'Activating legends…' : 'Manage Legends'}
        </button>

        {/* ── AI Document Assist (Wrench) toggle — hidden by default, see
            wrenchPanelHidden's own comment. ─────────────────────────── */}
        {wrenchPanelHidden ? (
          <button
            type="button"
            onClick={() => setWrenchPanelHidden(false)}
            className="mb-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500 border border-dashed border-slate-300 hover:border-slate-400 hover:text-slate-700 rounded-lg transition-colors"
          >
            <CloudIcon className="w-3.5 h-3.5" /> Enable AI Document Assist (Wrench · optional)
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setWrenchPanelHidden(true)}
            className="mb-1.5 inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600"
          >
            <X className="w-3 h-3" /> Hide Wrench panel
          </button>
        )}

        {/* ── AI Document Assist (Wrench) — soft-coded, optional ────── */}
        {/* BUG FIX: this panel's own onError used to feed the page-level
            importMsg red banner (the same one used for real PDF/spreadsheet
            import failures) — a real, confirmed incident: a Wrench-side
            outage ("Failed to load Wrench projects" / "AI credential
            unavailable") made the whole page LOOK broken, even though the
            plain "Import" button (local file upload, onPickFile/fileRef
            above) never depended on Wrench at all and kept working fine.
            Wrench is explicitly optional (see AI_DOC_ASSIST_CONFIG's own
            subtitleTag) — a failure in it must never look like a failure
            of Valve MTO itself. Per the fix: on any Wrench error, hide
            this panel outright (not just suppress the banner) so it can
            never sit there half-broken in the user's way; the rest of the
            page — including local file upload — is completely unaffected
            either way. Logged to console instead of surfaced to the user,
            since there's nothing actionable for them to do about a Wrench-
            side outage from here. */}
        {AI_DOC_ASSIST_CONFIG.enabled && !wrenchPanelHidden && (
          <div className="mb-4">
            <WrenchAiDocAssist
              title={AI_DOC_ASSIST_CONFIG.title}
              subtitleTag={AI_DOC_ASSIST_CONFIG.subtitleTag}
              subtitle={AI_DOC_ASSIST_CONFIG.subtitle}
              defaultHint={AI_DOC_ASSIST_CONFIG.defaultHint}
              hintPlaceholder={AI_DOC_ASSIST_CONFIG.hintPlaceholder}
              topN={AI_DOC_ASSIST_CONFIG.topN}
              acceptedExts={AI_DOC_ASSIST_CONFIG.acceptedExts}
              projectName={activeProject?.name || ''}
              onFileSelected={(file) => runImportForFile(file)}
              onError={(msg) => {
                console.warn('[ValveMTO] Wrench AI Document Assist error — hiding the optional panel:', msg);
                setWrenchPanelHidden(true);
              }}
            />
          </div>
        )}

        {progress && progress.total > 0 && (
          <div className="mb-4 p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
                Extracting valves — batch {progress.current} of {progress.total}
              </span>
              <span><strong className="text-slate-900">{progress.rows}</strong> row(s) found</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all"
                style={{ width: `${Math.min(100, (progress.current / progress.total) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Stat cards — soft-coded gradient summary tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {STAT_CARDS.map((s) => {
            const Icon = s.icon;
            // 'history' (Saved Snapshots) isn't project-scoped — always
            // real. The other three cards ARE project-scoped, so they
            // stay at 0 until a project is explicitly opened.
            const value = s.pick({ rows: workspaceOpened ? rows : [], history });
            return (
              <div key={s.key} className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${s.gradient} text-white p-4 shadow-sm`}>
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide opacity-90">
                  <Icon className="w-3.5 h-3.5" /> {s.label}
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums">{value.toLocaleString()}</div>
                <Sparkles className="absolute -right-2 -bottom-2 w-16 h-16 opacity-10" />
              </div>
            );
          })}
        </div>

        {/* ── Valve MTO Workflow + Smart Documentation — shared split-screen design ──
            Soft-coded: components/ValveMTOWorkflowDocs.jsx (VMTO_DOCS_CONFIG) */}
        <ValveMTOWorkflowDocs />

        {/* Project Header (always visible — used by exporter) */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 mb-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Project Header</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {PROJECT_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="block text-[11px] text-slate-500 mb-1">{f.label}</label>
                <input
                  type="text"
                  value={project[f.key] ?? ''}
                  onChange={(e) => updateProject(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Per-tab body */}
        {activeTab.id === 'projects' ? (
          <>
            <ProjectsView
              projects={projects}
              activeProjectId={activeProjectId}
              onOpen={(id) => { onSwitchProject(id); setActiveId('upload'); }}
              onCreate={onCreateProject}
              onRename={(p) => { setActiveProjectId(p.id); setActiveProject(p.id); onRenameActiveProject(); }}
              onDelete={(p) => { setActiveProjectId(p.id); setActiveProject(p.id); onDeleteActiveProject(); }}
            />
            <CloudProjectsPanel
              serverProjects={serverProjects}
              loading={serverProjectsLoading}
              onRefresh={refreshServerProjects}
              onLoad={onLoadServerProject}
              onRename={onRenameServerProject}
              onDelete={onDeleteServerProject}
              onExport={onExportServerProject}
            />
          </>
        ) : activeTab.id === 'upload' ? (
          <UploadHero
            importing={importing}
            onPickFile={onPickFile}
            historyCount={history.length}
            onOpenHistory={() => setActiveId('history')}
            activeProject={activeProject}
            onChangeProject={() => setActiveId('projects')}
            onOpenLegends={handleOpenLegends}
            scanMode={scanMode}
            onScanModeChange={setScanMode}
            visionProvider={visionProvider}
            onVisionProviderChange={(v) => {
              setVisionProvider(v);
              setVisionTestResult(null);
              sessionStorage.setItem(visionProviderStorageKey, v);
            }}
            visionApiKey={visionApiKey}
            onVisionApiKeyChange={(v) => {
              setVisionApiKey(v);
              setVisionTestResult(null);
              sessionStorage.setItem(visionApiKeyStorageKey, v);
            }}
            testingVisionKey={testingVisionKey}
            visionTestResult={visionTestResult}
            onTestVisionKey={handleTestVisionKey}
          />
        ) : activeTab.id === 'pivot' ? (
          <PivotView rows={workspaceOpened ? rows : []} />
        ) : activeTab.id === 'history' ? (
          <HistoryView
            history={history}
            onRestore={onRestoreSnapshot}
            onRename={onRenameSnapshot}
            onDelete={onDeleteSnapshot}
            onClearAll={onClearHistory}
            onPickFile={onPickFile}
          />
        ) : activeTab.id === 'performance' ? (
          <PerformanceView history={history} onPickFile={onPickFile} onOpenHistory={() => setActiveId('history')} />
        ) : (
          <TableView
            tab={activeTab}
            rows={visibleRows}
            totals={totals}
            search={search}
            onSearch={setSearch}
            onAddRow={addRow}
            onDeleteRow={deleteRow}
            onClearAll={clearAll}
            renderField={renderField}
            noProjectOpened={!workspaceOpened}
          />
        )}

        <p className="mt-4 text-[11px] text-slate-400 inline-flex items-center gap-1">
          <SaveIcon className="w-3 h-3" /> Auto-saved locally · {rows.length} valve row(s) total
          {activeProject && <span className="ml-1">· Project: <strong className="text-slate-600">{activeProject.name}</strong></span>}
        </p>
      </div>

      {/* Engaging full-screen overlay during AI Vision processing */}
      <ProcessingOverlay
        open={overlayOpen}
        filename={overlayFilename}
        startedAt={overlayStartedAt}
        progress={progress}
        partialRows={partialRows}
        onClose={() => setOverlayOpen(false)}
      />

      {/* Project create / rename / delete dialog */}
      <ProjectDialog
        dialog={projectDialog}
        existingNames={projects.map((p) => p.name)}
        canDelete={projects.length > 1}
        onClose={() => setProjectDialog(null)}
        onSubmitCreate={submitCreateProject}
        onSubmitRename={submitRenameProject}
        onSubmitDelete={submitDeleteProject}
      />

      {/* Manage Legends — the SAME shared component P&ID Verification
          V1/V2 use (apps.pid_checker_v2's structured, per-section legend
          system). Opens directly on the "Valve" section; the user can
          switch to Piping/Line List/Scope Symbols/Limit Line via its own
          section tabstrip. projectId is a PIDVProject id we resolve/
          create ourselves (see resolveLegendProjectId above) — legend
          CRUD itself is per-user and works without it, but the modal's
          "Upload symbol image" feature needs a real PIDVProject id (not
          the project_organizer id its own selector offers) or every
          upload 404s; see the BUG FIX comment on that import above. */}
      <LegendSheetsModal
        open={legendModalOpen}
        onClose={() => setLegendModalOpen(false)}
        section="valve"
        projectId={legendProjectId || undefined}
        title="Valve MTO Legend Sheets"
        description="Upload valve symbols, piping classes, and line number formats to improve AI extraction accuracy for your P&ID drawings."
        syncTitle="Global Library"
        syncText="Legends are shared across all your Valve MTO extractions."
        // NOTE: harmless marker only — LegendSheetsModal.jsx does not
        // currently read/consume this prop (out of scope here to add
        // that). It does NOT gate anything: auto-create/auto-activate
        // already only runs from THIS file's own handleOpenLegends(),
        // never from the modal itself or from P&ID V1/V2 / I/O List
        // (they never call handleOpenLegends). The actual cross-module
        // leak this session's "CRITICAL BUG" report described was
        // fixed above in autoPopulateLegendSection (no longer steals
        // activation from an already-active legend in a shared section).
        isValveMTO
        filterOutMTOLegends={false}
      />
    </div>
  );
};

// ─── Project Switcher (header pill + popover) ─────────────────────────────
const ProjectSwitcher = ({
  activeProject, projects, open, onToggle, onClose,
  onSwitch, onCreate, onRename, onDelete,
}) => {
  // Close on Escape / outside click.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-slate-800 bg-white border border-slate-300 hover:border-amber-400 hover:bg-amber-50 rounded-lg shadow-sm transition-colors"
        title="Switch project"
      >
        <FolderKanban className="w-4 h-4 text-amber-600" />
        <span className="max-w-[180px] truncate">{activeProject?.name || 'No project'}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {/* click-away catcher */}
          <div className="fixed inset-0 z-30" onClick={onClose} />
          <div className="absolute left-0 top-full mt-2 w-80 z-40 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden">
            <div className="px-3 py-2.5 border-b border-slate-100 flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-amber-600" />
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wide flex-1">Projects</div>
              <span className="text-[10px] text-slate-400">{projects.length}</span>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {projects.map((p) => {
                const active = p.id === activeProject?.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => onSwitch(p.id)}
                    className={`w-full text-left px-3 py-2 flex items-start gap-2 transition-colors ${
                      active ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className={`mt-0.5 w-4 h-4 shrink-0 ${active ? 'text-amber-600' : 'text-transparent'}`}>
                      <Check className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-900 truncate">{p.name}</div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {p.rows?.length || 0} valve(s)
                        {p.project?.doc_no ? ` · ${p.project.doc_no}` : ''}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="p-2 border-t border-slate-100 grid grid-cols-3 gap-1.5">
              <button
                onClick={onCreate}
                className="inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 rounded transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> New
              </button>
              <button
                onClick={onRename}
                disabled={!activeProject}
                className="inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded transition-colors disabled:opacity-40"
              >
                <Pencil className="w-3.5 h-3.5" /> Rename
              </button>
              <button
                onClick={onDelete}
                disabled={!activeProject || projects.length <= 1}
                className="inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-rose-700 border border-rose-200 hover:bg-rose-50 rounded transition-colors disabled:opacity-40"
                title={projects.length <= 1 ? 'At least one project must remain.' : 'Delete this project'}
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────

// Soft-coded copy for the project dialog so labels are easy to refine.
const PROJECT_DIALOG_COPY = {
  create: {
    title: 'Create new project',
    subtitle: 'Each project is its own folder of valves, header data and history.',
    submit: 'Create project',
    accent: 'from-amber-500 to-orange-600',
    icon: FolderKanban,
  },
  rename: {
    title: 'Rename project',
    subtitle: 'Update the project name and description.',
    submit: 'Save changes',
    accent: 'from-sky-500 to-blue-600',
    icon: Pencil,
  },
  delete: {
    title: 'Delete project',
    subtitle: 'This permanently removes the project folder and every valve inside it.',
    submit: 'Delete project',
    accent: 'from-rose-500 to-red-600',
    icon: Trash2,
  },
};

const ProjectDialog = ({
  dialog, existingNames, canDelete,
  onClose, onSubmitCreate, onSubmitRename, onSubmitDelete,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  // Reset form whenever the dialog opens / mode changes.
  useEffect(() => {
    if (!dialog) return;
    if (dialog.mode === 'create') {
      setName(''); setDescription('');
    } else if (dialog.mode === 'rename') {
      setName(dialog.target?.name || '');
      setDescription(dialog.target?.description || '');
    } else {
      setConfirmText('');
    }
    setError('');
    // Auto-focus the first field shortly after the modal renders.
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [dialog]);

  // Close on Escape.
  useEffect(() => {
    if (!dialog) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, onClose]);

  if (!dialog) return null;
  const meta = PROJECT_DIALOG_COPY[dialog.mode];
  const Icon = meta.icon;
  const isDelete = dialog.mode === 'delete';
  const isCreate = dialog.mode === 'create';
  const target   = dialog.target;

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (isDelete) {
      if (!canDelete) { setError('At least one project must remain.'); return; }
      if (confirmText.trim().toLowerCase() !== 'delete') {
        setError('Type DELETE to confirm.'); return;
      }
      onSubmitDelete({ id: target.id });
      return;
    }
    const trimmed = (name || '').trim();
    if (!trimmed) { setError('Project name is required.'); return; }
    if (trimmed.length > PROJECT_NAME_MAX_LEN) {
      setError(`Name is too long (max ${PROJECT_NAME_MAX_LEN} characters).`); return;
    }
    const dupe = (existingNames || []).some(
      (n) => n.toLowerCase() === trimmed.toLowerCase() && (!target || n !== target.name)
    );
    if (dupe) { setError('A project with this name already exists.'); return; }
    if (isCreate) onSubmitCreate({ name: trimmed, description });
    else          onSubmitRename({ id: target.id, name: trimmed, description });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Card */}
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`relative px-6 py-5 text-white bg-gradient-to-br ${meta.accent}`}>
          <div className="absolute -top-12 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative flex items-start gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-base font-bold">{meta.title}</div>
              <div className="text-xs text-white/80 mt-0.5">{meta.subtitle}</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-white/80 hover:text-white hover:bg-white/20 rounded transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {!isDelete && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Project name <span className="text-rose-500">*</span>
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={name}
                  maxLength={PROJECT_NAME_MAX_LEN}
                  onChange={(e) => { setName(e.target.value); if (error) setError(''); }}
                  placeholder="e.g. AD-604 SCHIO 500000"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all"
                />
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-slate-400">
                    A clear, recognisable name helps you find it later.
                  </span>
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    {name.length}/{PROJECT_NAME_MAX_LEN}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Description <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={description}
                  maxLength={PROJECT_DESC_MAX_LEN}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Project tag, plant area, revision notes…"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all resize-none"
                />
                <div className="flex items-center justify-end mt-1">
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    {description.length}/{PROJECT_DESC_MAX_LEN}
                  </span>
                </div>
              </div>
            </>
          )}

          {isDelete && (
            <>
              <div className="flex items-start gap-3 p-3 bg-rose-50 border border-rose-200 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-rose-900">
                  You are about to permanently delete{' '}
                  <strong className="font-bold">“{target?.name}”</strong>.{' '}
                  All <strong>{target?.rows?.length || 0}</strong> valve row(s) in this project will be lost.
                  This action cannot be undone.
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Type <code className="px-1 py-0.5 bg-slate-100 text-rose-600 rounded font-mono">DELETE</code> to confirm
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={confirmText}
                  onChange={(e) => { setConfirmText(e.target.value); if (error) setError(''); }}
                  placeholder="DELETE"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-rose-400 transition-all font-mono uppercase"
                />
              </div>
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-md transition-all hover:scale-[1.02] bg-gradient-to-r ${meta.accent}`}
          >
            <Icon className="w-4 h-4" /> {meta.submit}
          </button>
        </div>
      </form>
    </div>
  );
};


// based on a stable hash of its id, so colors are consistent across reloads.
const PROJECT_FOLDER_GRADIENTS = [
  'from-amber-400 to-orange-600',
  'from-emerald-400 to-teal-600',
  'from-sky-400 to-blue-600',
  'from-violet-400 to-fuchsia-600',
  'from-rose-400 to-pink-600',
  'from-lime-400 to-green-600',
  'from-cyan-400 to-sky-600',
  'from-orange-400 to-rose-600',
];
const gradientFor = (id = '') => {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
  return PROJECT_FOLDER_GRADIENTS[Math.abs(h) % PROJECT_FOLDER_GRADIENTS.length];
};
const formatDate = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return iso; }
};

const ProjectsView = ({ projects, activeProjectId, onOpen, onCreate, onRename, onDelete }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
    <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
      <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-sm">
        <FolderKanban className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-base font-bold text-slate-900">Project Folders</div>
        <div className="text-xs text-slate-500">
          Each project keeps its own valves, header and history. Open a folder to import or edit valves.
        </div>
      </div>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 rounded-lg shadow-md shadow-amber-500/30 transition-all hover:scale-[1.02]"
      >
        <Plus className="w-4 h-4" /> New Project
      </button>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-5">
      {/* Create card */}
      <button
        onClick={onCreate}
        className="group relative rounded-2xl border-2 border-dashed border-slate-300 hover:border-amber-400 hover:bg-amber-50/40 transition-all p-5 text-left flex flex-col items-center justify-center min-h-[180px]"
      >
        <div className="p-3 rounded-2xl bg-slate-100 group-hover:bg-amber-100 transition-colors mb-3">
          <Plus className="w-7 h-7 text-slate-500 group-hover:text-amber-600 transition-colors" />
        </div>
        <div className="text-sm font-bold text-slate-700 group-hover:text-amber-700">Create new project</div>
        <div className="text-[11px] text-slate-500 mt-1 text-center">Start a fresh, isolated valve workspace</div>
      </button>

      {projects.map((p) => {
        const grad   = gradientFor(p.id);
        const active = p.id === activeProjectId;
        const valves = p.rows?.length || 0;
        return (
          <div
            key={p.id}
            className={`group relative rounded-2xl border bg-white overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 ${
              active ? 'border-amber-400 ring-2 ring-amber-200 shadow-lg' : 'border-slate-200'
            }`}
          >
            {/* Folder tab */}
            <div className={`relative h-20 bg-gradient-to-br ${grad}`}>
              <div className="absolute -bottom-3 left-4 right-4 h-6 bg-white rounded-t-lg" />
              <FolderKanban className="absolute top-3 right-3 w-16 h-16 text-white/20" />
              <div className="absolute top-3 left-3">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-white bg-black/20 backdrop-blur-sm rounded-full uppercase tracking-wider">
                  <FolderKanban className="w-3 h-3" /> Project
                </div>
              </div>
              {active && (
                <div className="absolute bottom-1 right-3">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-amber-900 bg-white rounded-full shadow-sm">
                    <Check className="w-3 h-3" /> Active
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 pt-3 pb-4">
              <div className="text-sm font-bold text-slate-900 truncate" title={p.name}>{p.name}</div>
              {p.description && (
                <div className="text-[11px] text-slate-500 truncate mt-0.5" title={p.description}>{p.description}</div>
              )}

              <div className="grid grid-cols-3 gap-1 mt-3 mb-3">
                <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                  <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Valves</div>
                  <div className="text-sm font-bold text-slate-900 tabular-nums">{valves}</div>
                </div>
                <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                  <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Doc</div>
                  <div className="text-[11px] font-mono font-semibold text-slate-800 truncate" title={p.project?.doc_no || ''}>
                    {p.project?.doc_no || '—'}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                  <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Updated</div>
                  <div className="text-[11px] font-medium text-slate-700 truncate">{formatDate(p.updatedAt)}</div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onOpen(p.id)}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-white rounded transition-all bg-gradient-to-r ${grad} hover:brightness-110`}
                >
                  <FolderKanban className="w-3.5 h-3.5" /> Open
                </button>
                <button
                  onClick={() => onRename(p)}
                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                  title="Rename"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDelete(p)}
                  disabled={projects.length <= 1}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title={projects.length <= 1 ? 'At least one project must remain.' : 'Delete project'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// Server-saved projects (apps.valve_mto) — separate from the local-only
// "Project Folders" above. A row here can exist on the server without
// (yet) being linked to any local project entry on THIS browser — e.g.
// saved from another device — which is exactly the case Load exists to
// handle.
const CloudProjectsPanel = ({ serverProjects, loading, onRefresh, onLoad, onRename, onDelete, onExport }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mt-4">
    <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
      <div className="p-2 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 shadow-sm">
        <CloudIcon className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-base font-bold text-slate-900">Cloud Projects</div>
        <div className="text-xs text-slate-500">
          Saved on the server — available even if this browser&apos;s data is cleared, or from another device.
        </div>
      </div>
      <button
        onClick={onRefresh}
        disabled={loading}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-60"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
      </button>
    </div>

    {serverProjects.length === 0 ? (
      <div className="p-6 text-sm text-slate-500 text-center">
        {loading ? 'Loading…' : 'No projects saved to the server yet — they appear here automatically after your first extraction/edit.'}
      </div>
    ) : (
      <div className="divide-y divide-slate-100">
        {serverProjects.map((sp) => (
          <div key={sp.id} className="px-5 py-3 flex items-center gap-3 flex-wrap hover:bg-slate-50/60 transition-colors">
            <CloudIcon className="w-4 h-4 text-sky-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">{sp.project_name || 'Untitled Project'}</div>
              <div className="text-[11px] text-slate-500">
                {formatDate(sp.updated_at)} · {sp.row_count ?? 0} valve row(s) · {sp.status}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => onLoad(sp)}
                className="px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 border border-sky-200 hover:bg-sky-100 rounded-lg transition-colors"
              >
                Load
              </button>
              <button
                onClick={() => onExport(sp)}
                title="Download this project's Valve MTO as .xlsx — no need to Load it first"
                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onRename(sp)}
                title="Rename"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDelete(sp)}
                title="Delete"
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const UploadHero = ({
  importing, onPickFile, historyCount = 0, onOpenHistory, activeProject, onChangeProject,
  onOpenLegends, scanMode, onScanModeChange,
  visionProvider, onVisionProviderChange, visionApiKey, onVisionApiKeyChange,
  testingVisionKey, visionTestResult, onTestVisionKey,
}) => (
  <div className="relative bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
    {/* Decorative gradient blobs */}
    <div className="absolute -top-20 -right-16 w-72 h-72 bg-gradient-to-br from-amber-200 via-orange-200 to-rose-200 rounded-full blur-3xl opacity-60 pointer-events-none" />
    <div className="absolute -bottom-24 -left-20 w-72 h-72 bg-gradient-to-br from-blue-200 via-violet-200 to-emerald-200 rounded-full blur-3xl opacity-50 pointer-events-none" />

    <div className="relative p-10 md:p-14 text-center">
      {activeProject && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-4 text-xs font-semibold text-amber-900 bg-white/80 border border-amber-200 rounded-full shadow-sm">
          <FolderKanban className="w-3.5 h-3.5 text-amber-600" />
          Importing into: <span className="font-bold">{activeProject.name}</span>
          <button
            onClick={onChangeProject}
            className="ml-1 text-[10px] uppercase tracking-wider text-slate-500 hover:text-amber-700 underline-offset-2 hover:underline"
          >
            change
          </button>
        </div>
      )}
      <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-4 text-[11px] font-semibold uppercase tracking-wider text-amber-800 bg-amber-100 border border-amber-200 rounded-full">
        <Sparkles className="w-3.5 h-3.5" /> AI Vision powered
      </div>
      <div className="inline-flex p-5 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 mb-5 shadow-lg shadow-amber-500/30">
        <UploadCloud className="w-12 h-12 text-white" />
      </div>
      <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
        Drop a P&amp;ID or Valve MTO
      </h2>
      <p className="text-sm text-slate-600 mb-7 max-w-2xl mx-auto leading-relaxed">
        Upload a <code className="bg-slate-100 px-1.5 py-0.5 rounded text-amber-700 font-semibold">.pdf</code>,{' '}
        <code className="bg-slate-100 px-1.5 py-0.5 rounded text-emerald-700 font-semibold">.xlsx</code> or{' '}
        <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sky-700 font-semibold">.csv</code> file.
        PDFs are read with multi-page GPT-4o Vision; spreadsheets parse locally with header-alias detection,
        emitting the standard 5-sheet <strong>PIPING VALVES MTO</strong> template.
      </p>

      {/* Step-by-step guide — Legend Sheet is optional but improves AI
          accuracy on valve types, PMS/piping class and line format (see
          apps.pid_verification.services.piping_valve_mto_extractor's
          _build_legend_context, which reads the SAME apps.pid_checker_v2
          legends this button opens — 'Valve'/'Piping'/'Line List'
          sections, same as P&ID Verification V1/V2). */}
      <div className="max-w-md mx-auto mb-6 text-left space-y-2">
        {/* Step 1 — AI Vision API Key. Always shown, not a collapsible
            toggle (see this feature's own requirement) — "(optional)"
            removed from the label since the wording made it read as
            skippable; the underlying fallback behaviour is unchanged
            (see VALVE_VISION_CONFIG.hint below and
            _resolve_vision_credential on the backend: a blank key here
            still falls back to the admin-managed OpenAI key exactly as
            before — this is a visibility/prominence change in the UI
            only, not a new hard requirement to enter a key). */}
        <div className="p-2.5 rounded-lg bg-white/70 border border-amber-100">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500 text-white text-[11px] font-bold flex items-center justify-center">1</span>
            <span className="text-xs text-slate-700 flex-1 font-semibold">AI Vision API Key</span>
            {visionApiKey.trim() && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded">
                <Check className="w-3 h-3" /> Key set
              </span>
            )}
          </div>
          <div className="pl-7 space-y-2">
            <p className="text-[11px] text-slate-500">{VALVE_VISION_CONFIG.hint}</p>
            <div className="flex gap-2 flex-wrap">
              <select
                value={visionProvider}
                onChange={(e) => onVisionProviderChange(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
              >
                {VALVE_VISION_CONFIG.providers.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <input
                type="password"
                value={visionApiKey}
                onChange={(e) => onVisionApiKeyChange(e.target.value)}
                placeholder="API key (uses admin key if blank)"
                className="flex-1 min-w-[220px] text-xs border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
              />
              <button
                type="button"
                onClick={onTestVisionKey}
                disabled={testingVisionKey || !visionApiKey.trim()}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1 flex-shrink-0"
              >
                {testingVisionKey ? <RefreshCw className="w-3 h-3 animate-spin" /> : null} Test Connection
              </button>
            </div>
            {visionTestResult && (
              <p className={`text-[11px] ${visionTestResult.valid ? 'text-emerald-600' : 'text-red-600'}`}>
                {visionTestResult.message}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white/70 border border-amber-100">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold flex items-center justify-center">2</span>
          <span className="text-xs text-slate-700 flex-1">Upload Legend <span className="text-slate-400">(Optional)</span></span>
          <button
            type="button"
            onClick={onOpenLegends}
            className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100 rounded-lg transition-colors"
          >
            <Sparkles className="w-3 h-3" /> Manage Legends
          </button>
        </div>
        {/* Scan mode — Quick (1 call/page) vs Thorough (2x2 tiles, 2
            passes = 8 calls/page), default Thorough — see
            SCAN_MODE_OPTIONS / services.piping_valve_mto_extractor's
            _scan_mode_params for exactly what each resolves to. */}
        <div className="p-2.5 rounded-lg bg-white/70 border border-amber-100">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold flex items-center justify-center">3</span>
            <span className="text-xs text-slate-700 flex-1">Scan Mode</span>
          </div>
          <div className="flex flex-col gap-1.5 pl-7">
            {SCAN_MODE_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="valve-mto-scan-mode"
                  value={opt.value}
                  checked={scanMode === opt.value}
                  onChange={() => onScanModeChange(opt.value)}
                  className="mt-0.5"
                />
                <span className="text-xs text-slate-700">
                  <span className="font-semibold">{opt.label}</span>
                  {opt.value === SCAN_MODE_DEFAULT && (
                    <span className="ml-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">DEFAULT</span>
                  )}
                  <span className="block text-[11px] text-slate-500">{opt.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white/70 border border-amber-100">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500 text-white text-[11px] font-bold flex items-center justify-center">4</span>
          <span className="text-xs text-slate-700">Upload P&amp;ID PDF</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onPickFile}
          disabled={importing}
          className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 rounded-xl shadow-lg shadow-amber-500/30 transition-all hover:shadow-xl hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
        >
          {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
          {importing ? 'Importing…' : 'Choose file'}
        </button>
        {historyCount > 0 && (
          <button
            onClick={onOpenHistory}
            className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-sm transition-all"
          >
            <HistoryIcon className="w-4 h-4" /> Reuse from History
            <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 text-[10px] font-bold text-white bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full">
              {historyCount}
            </span>
          </button>
        )}
      </div>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-3 text-left max-w-3xl mx-auto">
        {[
          { t: 'AI Vision (PDF)',   d: 'Multi-page P&ID & valve MTO PDFs read by GPT-4o in parallel.', icon: Sparkles,    color: 'from-amber-50 to-orange-50 border-amber-200' },
          { t: 'Smart spreadsheet', d: 'Auto-detects header row that contains ≥4 known column aliases.', icon: Layers,     color: 'from-sky-50 to-blue-50 border-sky-200' },
          { t: 'History & reuse',   d: 'Every successful import auto-saves so you never re-extract twice.', icon: HistoryIcon, color: 'from-emerald-50 to-teal-50 border-emerald-200' },
        ].map(({ t, d, icon: Ic, color }) => (
          <div key={t} className={`p-4 rounded-xl bg-gradient-to-br ${color} border`}>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="p-1.5 rounded-lg bg-white/70"><Ic className="w-3.5 h-3.5 text-slate-700" /></div>
              <div className="text-xs font-bold text-slate-800">{t}</div>
            </div>
            <div className="text-[11px] text-slate-600 leading-relaxed">{d}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ─── History view ────────────────────────────────────────────────────────
const formatTs = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch { return iso; }
};

const HistoryView = ({ history, onRestore, onRename, onDelete, onClearAll, onPickFile }) => {
  if (!history.length) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
        <div className="inline-flex p-4 rounded-full bg-slate-50 mb-3">
          <HistoryIcon className="w-9 h-9 text-slate-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">No snapshots yet</h3>
        <p className="text-sm text-slate-500 mb-5 max-w-md mx-auto">
          Every successful PDF or spreadsheet import auto-saves here. You can also use{' '}
          <strong>Save Snapshot</strong> at the top to capture the current Valve MTO at any time.
        </p>
        <button
          onClick={onPickFile}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 rounded-lg shadow-sm transition-colors"
        >
          <UploadCloud className="w-4 h-4" /> Import your first file
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-3 flex-wrap">
        <div className="text-sm font-semibold text-slate-800 inline-flex items-center gap-1.5">
          <HistoryIcon className="w-4 h-4 text-emerald-600" /> Saved snapshots
          <span className="ml-1 text-xs font-normal text-slate-500">({history.length})</span>
        </div>
        <p className="text-xs text-slate-500">Click a snapshot to restore it into the workspace.</p>
        <div className="ml-auto">
          <button
            onClick={onClearAll}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-700 border border-rose-200 hover:bg-rose-50 rounded transition-colors"
            title="Delete all snapshots"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear all
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
        {history.map((entry) => {
          const meta = HISTORY_SOURCE_META[entry.source] || HISTORY_SOURCE_META.manual;
          const accent = meta.accent;
          const accentClass =
            accent === 'amber' ? 'from-amber-500 to-orange-600' :
            accent === 'sky'   ? 'from-sky-500 to-blue-600' :
                                 'from-slate-500 to-slate-700';
          return (
            <div
              key={entry.id}
              className="group relative rounded-xl border border-slate-200 bg-white hover:border-amber-300 hover:shadow-md transition-all overflow-hidden"
            >
              <div className={`h-1 w-full bg-gradient-to-r ${accentClass}`} />
              <div className="p-4">
                <div className="flex items-start gap-2 mb-2">
                  <div className={`p-1.5 rounded-lg bg-gradient-to-br ${accentClass} text-white shrink-0`}>
                    <Database className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900 truncate" title={entry.label}>
                      {entry.label}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {meta.label}{entry.engine ? ` · ${entry.engine}` : ''}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 mb-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">Rows</div>
                    <div className="font-bold text-slate-900 tabular-nums">{entry.rowCount}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">Saved</div>
                    <div className="font-medium text-slate-700">{formatTs(entry.savedAt)}</div>
                  </div>
                  {entry.project?.doc_no && (
                    <div className="col-span-2 truncate" title={entry.project.doc_no}>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">Doc No.</div>
                      <div className="font-mono text-slate-800 truncate">{entry.project.doc_no}</div>
                    </div>
                  )}
                  {entry.sourceFile && (
                    <div className="col-span-2 truncate" title={entry.sourceFile}>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">Source File</div>
                      <div className="text-slate-700 truncate">{entry.sourceFile}</div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onRestore(entry)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded transition-colors"
                    title="Restore this snapshot into the workspace"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Restore
                  </button>
                  <button
                    onClick={() => onRename(entry)}
                    className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                    title="Rename snapshot"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDelete(entry)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                    title="Delete snapshot"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── AI Performance / Accuracy Dashboard ─────────────────────────────────
// Soft-coded color map keeps banding consistent across the dashboard.
const PERF_BAND_THEME = {
  emerald: { glow: 'shadow-emerald-500/40', text: 'text-emerald-600', soft: 'bg-emerald-50',  border: 'border-emerald-200', grad: 'from-emerald-400 to-teal-600',     hex: '#10b981' },
  sky:     { glow: 'shadow-sky-500/40',     text: 'text-sky-600',     soft: 'bg-sky-50',      border: 'border-sky-200',     grad: 'from-sky-400 to-blue-600',         hex: '#0ea5e9' },
  amber:   { glow: 'shadow-amber-500/40',   text: 'text-amber-600',   soft: 'bg-amber-50',    border: 'border-amber-200',   grad: 'from-amber-400 to-orange-600',     hex: '#f59e0b' },
  rose:    { glow: 'shadow-rose-500/40',    text: 'text-rose-600',    soft: 'bg-rose-50',     border: 'border-rose-200',    grad: 'from-rose-400 to-red-600',         hex: '#f43f5e' },
};

// Soft-coded SVG ring helpers — no bars, no lines, only circles.
const RING_R = 44;
const RING_C = 2 * Math.PI * RING_R; // ~276.46
const ringDash = (pct) => `${(Math.max(0, Math.min(100, pct)) / 100) * RING_C} ${RING_C}`;

// Reusable circular ring (soft-coded geometry).
const ScoreRing = ({ pct = 0, size = 'md', hex = '#10b981', label, sub }) => {
  const dim = size === 'lg' ? 160 : size === 'sm' ? 72 : 112;
  const stroke = size === 'lg' ? 12 : size === 'sm' ? 6 : 9;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: dim, height: dim }}>
      {/* Subtle halo glow behind ring */}
      <div
        className="absolute inset-2 rounded-full opacity-25 blur-xl"
        style={{ backgroundColor: hex }}
      />
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={RING_R} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        <circle
          cx="50" cy="50" r={RING_R} fill="none"
          stroke={hex}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={ringDash(pct)}
          style={{ transition: 'stroke-dasharray 700ms ease' }}
        />
      </svg>
      <div className="relative text-center">
        <div className="font-extrabold tabular-nums text-slate-900" style={{ fontSize: dim * 0.28 }}>
          {Math.round(pct)}
        </div>
        {label && (
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mt-0.5">{label}</div>
        )}
        {sub && (
          <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>
        )}
      </div>
    </div>
  );
};

const PerformanceView = ({ history, onPickFile, onOpenHistory }) => {
  const perf = useMemo(() => computePerformance(history), [history]);
  const recs = useMemo(() => computeRecommendations(perf), [perf]);
  const theme = PERF_BAND_THEME[perf.band.color] || PERF_BAND_THEME.amber;
  const hasAny = perf.totalSnapshots > 0;
  const hasScore = perf.totalSnapshots > 0
    && history.some((h) => h.source === 'pdf' && (h.rowCount || 0) >= PERF_MIN_ROWS_FOR_SCORE);
  const [expandedDetail, setExpandedDetail] = useState(null);
  const [showAllDetail, setShowAllDetail] = useState(false);

  // Empty state — no AI extractions yet.
  if (!hasAny) {
    return (
      <div className="relative bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="absolute -top-24 -right-20 w-80 h-80 bg-gradient-to-br from-violet-300 via-fuchsia-300 to-rose-300 rounded-full blur-3xl opacity-40 pointer-events-none" />
        <div className="absolute -bottom-32 -left-24 w-80 h-80 bg-gradient-to-br from-sky-300 via-cyan-300 to-emerald-300 rounded-full blur-3xl opacity-30 pointer-events-none" />
        <div className="relative p-12 text-center">
          <div className="inline-flex p-5 rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-2xl shadow-violet-500/40 mb-5">
            <Activity className="w-12 h-12 text-white" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">No AI extractions yet</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            Run an AI Vision extraction on a PDF to populate the performance dashboard.
            Metrics are calculated from your saved history — your data stays local.
          </p>
          <button
            onClick={onPickFile}
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl shadow-xl shadow-amber-500/40 hover:scale-[1.03] transition-all"
          >
            <UploadCloud className="w-4 h-4" /> Run your first extraction
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* HERO — glassmorphism dark gradient with the master ring */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shadow-xl">
        {/* Decorative gradient orbs */}
        <div className="absolute -top-24 -right-20 w-80 h-80 rounded-full blur-3xl opacity-40 pointer-events-none"
          style={{ backgroundColor: theme.hex }} />
        <div className="absolute -bottom-28 -left-24 w-72 h-72 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-full blur-3xl opacity-25 pointer-events-none" />
        {/* Faint dotted texture */}
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '18px 18px' }} />

        <div className="relative p-6 md:p-8 grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 items-center">
          {/* Master ring */}
          <div className="flex flex-col items-center gap-3">
            <ScoreRing pct={perf.avgScorePct} size="lg" hex={theme.hex} label="of 100" />
            <div className="inline-flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white rounded-full backdrop-blur-md"
              style={{ backgroundColor: `${theme.hex}33`, border: `1px solid ${theme.hex}55` }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: theme.hex }} />
              {hasScore ? perf.band.label : 'Collecting'}
            </div>
          </div>

          {/* Right side: title + glass stat pods */}
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 mb-3 text-[10px] font-bold uppercase tracking-widest text-violet-200 bg-white/10 backdrop-blur-md border border-white/10 rounded-full">
              <Activity className="w-3 h-3" /> AI Performance
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white leading-tight mb-1">
              {hasScore ? `Your AI is performing at ${perf.avgScorePct}%` : 'Collecting performance data'}
            </h2>
            <p className="text-sm text-slate-300/90 max-w-xl mb-5">
              {hasScore
                ? perf.band.desc
                : `Need at least ${PERF_MIN_ROWS_FOR_SCORE} valves per extraction to compute a confident score.`}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <GlassPod icon={Database} label="Extractions" value={perf.totalSnapshots} hint="AI Vision runs" hex={theme.hex} />
              <GlassPod icon={Layers}   label="Valves processed" value={perf.totalRows}
                hint={perf.totalSnapshots ? `Avg ${perf.avgRows.toFixed(1)} per run` : ''} hex="#a78bfa" />
              <GlassPod icon={Award}    label="Band"
                value={hasScore ? perf.band.label : '—'}
                hint={
                  perf.trendDeltaPct === 0
                    ? `Score ${perf.avgScorePct}/100`
                    : `${perf.trendDeltaPct > 0 ? '▲' : '▼'} ${Math.abs(perf.trendDeltaPct)} pts vs earlier runs`
                }
                hex={theme.hex}
                emphasiseValue
              />
            </div>
          </div>
        </div>
      </div>

      {/* RECOMMENDATIONS — soft-coded rule engine output */}
      {recs.length > 0 && (
        <RecommendationsPanel recs={recs} />
      )}

      {/* FIELD COMPLETENESS — donut grid, no bars */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3 flex-wrap">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-md shadow-sky-500/30">
            <Target className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-slate-900">Field completeness</div>
            <div className="text-xs text-slate-500">% of AI rows where each critical field was populated</div>
          </div>
        </div>

        <div className="p-6 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-5">
          {perf.fieldRates.map((f) => {
            const pct = Math.round(f.rate * 100);
            const localBand = bandFor(pct);
            const t = PERF_BAND_THEME[localBand.color] || PERF_BAND_THEME.amber;
            return (
              <div key={f.key} className="group flex flex-col items-center text-center">
                <div className="relative">
                  <ScoreRing pct={pct} size="sm" hex={t.hex} />
                </div>
                <div className="mt-2 text-xs font-semibold text-slate-800 truncate w-full" title={f.label}>
                  {f.label}
                </div>
                <div className={`text-[10px] font-semibold ${t.text}`}>{localBand.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* TREND — circular medallions instead of bars */}
      {perf.trend.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3 flex-wrap">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/30">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-base font-bold text-slate-900">Recent extractions</div>
              <div className="text-xs text-slate-500">
                Last {perf.trend.length} run{perf.trend.length === 1 ? '' : 's'} · oldest → newest
              </div>
            </div>
            <button
              onClick={onOpenHistory}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
            >
              <HistoryIcon className="w-3.5 h-3.5" /> View history
            </button>
          </div>

          <div className="p-6">
            <div className="flex items-start gap-3 overflow-x-auto pb-2">
              {perf.trend.map((t, idx) => {
                const pct = Math.round(t.score * 100);
                const b   = bandFor(pct);
                const th  = PERF_BAND_THEME[b.color] || PERF_BAND_THEME.amber;
                return (
                  <div key={t.id} className="group relative flex flex-col items-center gap-2 min-w-[88px] flex-shrink-0">
                    <div className="text-[10px] font-mono text-slate-400">#{idx + 1}</div>
                    <ScoreRing pct={pct} size="sm" hex={th.hex} />
                    <div className="text-[10px] font-semibold text-slate-700 truncate max-w-[88px] text-center" title={t.label}>
                      {t.label}
                    </div>
                    <div className="text-[10px] text-slate-400 tabular-nums">{t.rowCount} rows</div>
                    {/* Tooltip */}
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full hidden group-hover:block z-10 px-3 py-2 text-[11px] text-white bg-slate-900 rounded-xl shadow-xl whitespace-nowrap">
                      <div className="font-bold">{t.label}</div>
                      <div className="text-slate-300">Score {pct}% · {t.rowCount} rows</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Band legend as soft pills */}
            <div className="flex items-center justify-center gap-2 mt-5 flex-wrap">
              {PERF_BANDS.map((b) => {
                const t = PERF_BAND_THEME[b.color] || PERF_BAND_THEME.amber;
                return (
                  <div key={b.label}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold rounded-full ${t.soft} ${t.text} border ${t.border}`}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.hex }} />
                    {b.label}
                    <span className="opacity-60">≥{b.min}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* DETAILED SNAPSHOTS — per-run drill-down */}
      {perf.detailed.length > 0 && (
        <DetailedRunsPanel
          detailed={perf.detailed}
          expandedId={expandedDetail}
          onToggle={(id) => setExpandedDetail((cur) => (cur === id ? null : id))}
          showAll={showAllDetail}
          onToggleShowAll={() => setShowAllDetail((s) => !s)}
        />
      )}

      {/* ENGINES — circular avatar tiles */}
      {perf.engines.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-md shadow-amber-500/30">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-base font-bold text-slate-900">AI engines used</div>
              <div className="text-xs text-slate-500">Model variants behind your extractions</div>
            </div>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {perf.engines.map((e, i) => {
              const totalRuns = Math.max(1, perf.totalSnapshots);
              const sharePct  = Math.round((e.count / totalRuns) * 100);
              const accents   = ['#f59e0b', '#a78bfa', '#10b981', '#0ea5e9', '#f43f5e'];
              const hex       = accents[i % accents.length];
              return (
                <div key={e.engine}
                  className="group relative px-4 py-3 bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-2xl flex items-center gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden">
                  <div className="absolute -top-10 -right-8 w-28 h-28 rounded-full blur-2xl opacity-25 pointer-events-none"
                    style={{ backgroundColor: hex }} />
                  <ScoreRing pct={sharePct} size="sm" hex={hex} />
                  <div className="relative flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate font-mono">{e.engine || 'unknown'}</div>
                    <div className="text-[11px] text-slate-500">
                      {e.count} run{e.count === 1 ? '' : 's'} · {e.rows} rows
                    </div>
                    <div className="text-[10px] text-slate-400">{sharePct}% share</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-[11px] text-slate-400 text-center">
        Metrics are computed locally from your saved history. Score is a proxy for completeness — review extractions for engineering accuracy.
      </p>
    </div>
  );
};

// Glass-style pod used inside the dark hero. No bars, no lines.
const GlassPod = ({ icon: Icon, label, value, hint, hex = '#10b981', emphasiseValue = false }) => (
  <div className="relative px-4 py-3 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 overflow-hidden">
    <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-40 pointer-events-none"
      style={{ backgroundColor: hex }} />
    <div className="relative flex items-center gap-3">
      <div className="p-2 rounded-xl border border-white/15 backdrop-blur-md"
        style={{ backgroundColor: `${hex}22` }}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-slate-300 font-semibold">{label}</div>
        <div className={`tabular-nums leading-tight text-white ${emphasiseValue ? 'text-lg font-bold' : 'text-2xl font-extrabold'}`}>
          {value}
        </div>
        {hint && <div className="text-[10px] text-slate-300/80 truncate">{hint}</div>}
      </div>
    </div>
  </div>
);

// ─── Recommendations panel ─────────────────────────────────────────────
// Soft-coded severity → visual mapping. Tweak here, all cards update.
const REC_SEVERITY_THEME = {
  positive: { hex: '#10b981', soft: 'bg-emerald-50',  border: 'border-emerald-200', text: 'text-emerald-700', label: 'Insight'   },
  high:     { hex: '#f43f5e', soft: 'bg-rose-50',     border: 'border-rose-200',    text: 'text-rose-700',    label: 'Action needed' },
  medium:   { hex: '#f59e0b', soft: 'bg-amber-50',    border: 'border-amber-200',   text: 'text-amber-700',   label: 'Suggestion' },
  low:      { hex: '#0ea5e9', soft: 'bg-sky-50',      border: 'border-sky-200',     text: 'text-sky-700',     label: 'Tip' },
  info:     { hex: '#a78bfa', soft: 'bg-violet-50',   border: 'border-violet-200',  text: 'text-violet-700',  label: 'Note' },
};
const REC_ICON = { alert: AlertTriangle, lightbulb: Lightbulb, sparkles: Sparkles, target: Target };

const RecommendationsPanel = ({ recs }) => (
  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm">
    <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3 flex-wrap">
      <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-md shadow-violet-500/30">
        <Sparkles className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-base font-bold text-slate-900">Smart recommendations</div>
        <div className="text-xs text-slate-500">
          Personalised insights based on your extraction history. Updates automatically as you run more PDFs.
        </div>
      </div>
      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-violet-700 bg-violet-50 border border-violet-200 rounded-full">
        {recs.length} insight{recs.length === 1 ? '' : 's'}
      </span>
    </div>

    <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-3">
      {recs.map((r) => {
        const theme = REC_SEVERITY_THEME[r.severity] || REC_SEVERITY_THEME.info;
        const Icon  = REC_ICON[r.icon] || Lightbulb;
        return (
          <div key={r.id}
            className={`relative p-4 rounded-2xl border ${theme.border} ${theme.soft} overflow-hidden`}>
            <div className="absolute -top-10 -right-8 w-28 h-28 rounded-full blur-2xl opacity-30 pointer-events-none"
              style={{ backgroundColor: theme.hex }} />
            <div className="relative flex items-start gap-3">
              <div className="p-2 rounded-xl flex-shrink-0"
                style={{ backgroundColor: `${theme.hex}22`, border: `1px solid ${theme.hex}44` }}>
                <Icon className="w-4 h-4" style={{ color: theme.hex }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-[9px] font-bold uppercase tracking-widest ${theme.text}`}>
                    {theme.label}
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-900 mb-1 leading-snug">{r.title}</div>
                <div className="text-xs text-slate-700 leading-relaxed">{r.body}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// ─── Detailed runs panel ───────────────────────────────────────────────
const DETAIL_INITIAL_LIMIT = 5;
const formatRelative = (iso) => {
  if (!iso) return '';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)   return 'just now';
    if (m < 60)  return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30)  return `${d}d ago`;
    return new Date(iso).toLocaleDateString();
  } catch { return ''; }
};

const DetailedRunsPanel = ({ detailed, expandedId, onToggle, showAll, onToggleShowAll }) => {
  const visible = showAll ? detailed : detailed.slice(0, DETAIL_INITIAL_LIMIT);
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3 flex-wrap">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 shadow-md shadow-slate-500/30">
          <Database className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-bold text-slate-900">Detailed run history</div>
          <div className="text-xs text-slate-500">
            Click any run to see its weakest fields and per-field completeness
          </div>
        </div>
        <span className="text-[11px] text-slate-500 font-mono tabular-nums">
          {detailed.length} run{detailed.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {visible.map((d) => {
          const t = PERF_BAND_THEME[d.band.color] || PERF_BAND_THEME.amber;
          const isOpen = expandedId === d.id;
          return (
            <div key={d.id}>
              {/* Row */}
              <button
                onClick={() => onToggle(d.id)}
                className="w-full text-left px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50 transition-colors"
              >
                <ScoreRing pct={d.scorePct} size="sm" hex={t.hex} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-sm font-bold text-slate-900 truncate">{d.label}</div>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${t.soft} ${t.text} border ${t.border}`}>
                      {d.band.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                    <span className="inline-flex items-center gap-1"><Layers className="w-3 h-3" /> {d.rowCount} rows</span>
                    <span className="inline-flex items-center gap-1"><Zap className="w-3 h-3" /> {d.engine}</span>
                    <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {formatRelative(d.savedAt)}</span>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
              </button>

              {/* Drill-down */}
              {isOpen && (
                <div className="px-5 pb-5 pt-1 bg-slate-50/50">
                  {/* Weakest fields */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-[11px] font-bold uppercase tracking-widest text-slate-600">
                        Weakest fields in this run
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {d.weakest.map((w) => {
                        const pct = Math.round(w.rate * 100);
                        const wb  = bandFor(pct);
                        const wt  = PERF_BAND_THEME[wb.color] || PERF_BAND_THEME.amber;
                        return (
                          <span key={w.key}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-full ${wt.soft} ${wt.text} border ${wt.border}`}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: wt.hex }} />
                            {w.label} · {pct}%
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* All fields donut grid */}
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-widest text-slate-600 mb-3">
                      All fields
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3">
                      {d.rates.map((r) => {
                        const pct = Math.round(r.rate * 100);
                        const rb  = bandFor(pct);
                        const rt  = PERF_BAND_THEME[rb.color] || PERF_BAND_THEME.amber;
                        return (
                          <div key={r.key} className="flex flex-col items-center text-center">
                            <ScoreRing pct={pct} size="sm" hex={rt.hex} />
                            <div className="mt-1.5 text-[10px] font-semibold text-slate-700 truncate w-full" title={r.label}>
                              {r.label}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {d.sourceFile && (
                    <div className="mt-3 text-[10px] text-slate-400 font-mono truncate">
                      Source: {d.sourceFile}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {detailed.length > DETAIL_INITIAL_LIMIT && (
        <div className="px-6 py-3 border-t border-slate-100 text-center">
          <button
            onClick={onToggleShowAll}
            className="text-xs font-semibold text-slate-700 hover:text-violet-700 transition-colors"
          >
            {showAll
              ? 'Show fewer runs'
              : `Show all ${detailed.length} runs`}
          </button>
        </div>
      )}
    </div>
  );
};

const TableView = ({ tab, rows, totals, search, onSearch, onAddRow, onDeleteRow, onClearAll, renderField, noProjectOpened }) => {
  // Per-sheet column visibility — matches the Excel exporter.
  const visibleCols = useMemo(() => {
    const base = tab.id === 'combined'
      ? VALVE_COLUMNS.filter((c) => c.key !== 'size_2')
      : VALVE_COLUMNS.filter((c) => c.key !== 'bore');
    // BUG FIX: 'valve_tag' (TAG NUMBER) is declared near the end of
    // VALVE_COLUMNS (after LINE LIST) — far enough right in a wide table
    // that it read as "missing" even though it was rendering. Reordered
    // here, for table rendering only (VALVE_COLUMNS itself — shared by
    // the importer/exporter/datalists elsewhere in this file — is left
    // untouched), to sit right after AREA and before TYPE: SL. NO | AREA
    // | TAG NUMBER | VALVE TYPE | ...
    const tagIdx = base.findIndex((c) => c.key === 'valve_tag');
    const areaIdx = base.findIndex((c) => c.key === 'area');
    if (tagIdx === -1 || areaIdx === -1 || tagIdx === areaIdx + 1) return base;
    const tagCol = base[tagIdx];
    const withoutTag = base.filter((c) => c.key !== 'valve_tag');
    const insertAt = withoutTag.findIndex((c) => c.key === 'area') + 1;
    withoutTag.splice(insertAt, 0, tagCol);
    return withoutTag;
  }, [tab.id]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-3 flex-wrap">
        <div className="text-sm font-semibold text-slate-700">
          {tab.label}
          <span className="ml-2 text-xs font-normal text-slate-500">{tab.description}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search tag, type, class…"
              className="pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 w-56"
            />
          </div>
          <button
            onClick={onAddRow}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add row
          </button>
          <button
            onClick={onClearAll}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-700 border border-rose-200 hover:bg-rose-50 rounded transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
        </div>
      </div>

      {/* Totals strip */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-600 flex flex-wrap gap-x-6 gap-y-1">
        <span><strong className="text-slate-900">{totals.count}</strong> row(s)</span>
        <span>Σ Island: <strong className="text-slate-900">{totals.island}</strong></span>
        <span>Σ Field: <strong className="text-slate-900">{totals.field}</strong></span>
        <span>Σ Total: <strong className="text-emerald-700">{totals.total}</strong></span>
      </div>

      {/* Table */}
      <div className="overflow-auto max-h-[60vh]">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-100 sticky top-0 z-10">
            <tr>
              {visibleCols.map((c) => (
                <th
                  key={c.key}
                  className="px-2 py-2 text-left font-semibold text-slate-700 border-b border-slate-200 whitespace-nowrap"
                  style={{ minWidth: `${c.width * 7}px` }}
                >
                  {c.label}
                </th>
              ))}
              <th className="px-2 py-2 border-b border-slate-200 sticky right-0 bg-slate-100" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={visibleCols.length + 1} className="px-4 py-8 text-center text-slate-400 italic">
                  {noProjectOpened
                    ? 'No project open yet — open one from the Projects tab to see its valves here.'
                    : <>No valves to display. Click <strong>Add row</strong> or import an existing MTO.</>}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-amber-50/30 border-b border-slate-100">
                {visibleCols.map((c) => (
                  <td key={c.key} className="px-1.5 py-1 align-top">
                    {renderField(c, r)}
                  </td>
                ))}
                <td className="px-2 py-1 sticky right-0 bg-white">
                  <button
                    onClick={() => onDeleteRow(r.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                    title="Delete row"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const PivotView = ({ rows }) => {
  const groups = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const key = [r.type, r.pms_class, r.size_1, r.valve_tag].filter(Boolean).join(' / ');
      if (!key.trim()) continue;
      const cur = map.get(key) || { type: r.type, pms_class: r.pms_class, size_1: r.size_1, valve_tag: r.valve_tag, total: 0 };
      cur.total += (Number(r.qty_island) || 0) + (Number(r.qty_field) || 0);
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) =>
      `${a.type}${a.pms_class}${a.size_1}`.localeCompare(`${b.type}${b.pms_class}${b.size_1}`),
    );
  }, [rows]);
  const grandTotal = groups.reduce((acc, g) => acc + g.total, 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="px-4 py-3 border-b border-slate-200 text-sm font-semibold text-slate-700">
        Pivot Summary — Sum of Total to be ordered, by Type / Class / Size / Tag
      </div>
      <div className="overflow-auto max-h-[60vh]">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-100 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">Type</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">Class</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">Size</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">Valve Tag</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700 border-b border-slate-200">Total</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">
                  Add valves to see the pivot summary.
                </td>
              </tr>
            )}
            {groups.map((g, i) => (
              <tr key={i} className="hover:bg-slate-50 border-b border-slate-100">
                <td className="px-3 py-1.5">{g.type}</td>
                <td className="px-3 py-1.5">{g.pms_class}</td>
                <td className="px-3 py-1.5">{g.size_1}</td>
                <td className="px-3 py-1.5 font-mono">{g.valve_tag}</td>
                <td className="px-3 py-1.5 text-right font-semibold">{g.total}</td>
              </tr>
            ))}
          </tbody>
          {groups.length > 0 && (
            <tfoot className="bg-emerald-50 sticky bottom-0">
              <tr>
                <td colSpan={4} className="px-3 py-2 text-right font-semibold text-emerald-900">Grand Total</td>
                <td className="px-3 py-2 text-right font-bold text-emerald-900">{grandTotal}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

// `colByKey` is internal only — kept in module scope for performance.
void colByKey;
void AREA_OPTIONS;

export default ValveMTOPage;
