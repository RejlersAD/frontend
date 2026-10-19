/**
 * 🎯 VALVE MTO — Piping Valve Material Take-Off
 *
 * Route: /engineering/piping/pms
 *
 * Rebuilt from scratch by replicating the Line List page's design and
 * "method of execution":
 *   1. V1-style light header card (icon tile, title, badge, feature pills)
 *      on a light blue/indigo gradient page with subtle dot grid,
 *      fullscreen toggle and fade-up section animations.
 *   2. Shared Project Organizer workspace — project selection gates the
 *      page (same wiring as LineList via LL_PROJECTS pattern).
 *   3. P&ID PDF upload → async extraction job (POST) → poll status
 *      endpoint until done → rows render in a register-style table.
 *   4. Register table: search, inline-editable cells, add/delete row,
 *      totals strip (Σ Island / Σ Field / Σ Total), tab views
 *      ALL / ISLAND / FIELD / COMBINED, row selection highlighting.
 *   5. Spreadsheet import (client-side) + 5-sheet workbook export.
 *   6. Best-effort server persistence via valveMtoService (localStorage
 *      stays as an offline-friendly cache).
 *
 * Everything is soft-coded: copy, columns, endpoints and timing live in
 * constants at the top of this file or in the imported config modules.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  TableCellsIcon, CloudArrowUpIcon, CheckCircleIcon,
  ArrowsPointingOutIcon, ArrowsPointingInIcon, MagnifyingGlassIcon,
  XMarkIcon, ExclamationTriangleIcon, PlusIcon, TrashIcon,
  ArrowUpTrayIcon, ArrowDownTrayIcon, FolderIcon, FolderPlusIcon,
  BookOpenIcon, ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import apiClient from '../../../services/api.service';
import useAIProviderStatus from '../../../hooks/useAIProviderStatus';
import { buildValveMTOReview } from '../../../config/valveMTOReview';
import ValveMTOExtractionReview from './components/ValveMTOExtractionReview';

// Shared Project Organizer — soft-coded workspace (same pattern as LineList)
import { PROJECT_ORGANIZER_CONFIG } from '../../../config/projectOrganizer.config';
import projectOrganizerService from '../../../services/projectOrganizerService';
import { ProjectCard, ProjectFormModal, useActiveProject } from '../../../components/ProjectOrganizer';

// Valve MTO schema / IO configs (soft-coded single sources of truth)
import {
  VALVE_COLUMNS, isValveColumnVisible, sizeNBFromLineNumber, allocationTab, DEFAULT_ROW, AREA_OPTIONS, PROJECT_FIELDS, DEFAULT_FILENAME,
} from '../../../config/valveMTO.config';
import importValveMTOFile from '../../../config/valveMTOImporter';
import exportValveMTOWorkbook, { exportValveMTOAllData } from '../../../config/valveMTOExporter';
import valveMtoService, { mapLocalRowToServer } from '../../../services/valveMtoService';

// Legend Sheets — SHARED modal UI, but Valve MTO's OWN isolated legend
// service (apps.valve_mto's ValveMTOLegend table, NOT pid_checker_v2's
// shared table) so activating a legend here can never disturb P&ID
// Verification V1/V2's per-user active-legend state. The modal accepts a
// `legendApi` prop for exactly this swap (see LegendSheetsModal.jsx).
import LegendSheetsModal from '../Process/components/LegendSheetsModal';
import * as valveMtoLegendService from '../../../services/valveMtoLegendService';

// ---------------------------------------------------------------------------
// Soft-coded config — endpoints & timing (edit here only, never in JSX).
// ---------------------------------------------------------------------------
const VM_ENDPOINTS = {
  extract: '/pid-verification/extract-valve-mto/',           // POST multipart
  status:  (jobId) => `/pid-verification/extract-valve-mto/${jobId}/`,  // GET poll
};

// Multipart field names expected by the backend view.
const VM_UPLOAD = {
  fileField: 'pid_file',
  scanModeField: 'scan_mode',
  scanModeDefault: 'thorough',
  acceptedExt: '.pdf',
};

// PMS (Piping Material Specification) Excel/CSV upload — Stage 2. Parsed
// entirely client-side (SheetJS) into {code, pms_class, rating, facing}
// rows, then sent as a JSON string with the extraction request; the
// backend overlays it onto the legend-based specification lookup (see
// apps.valve_mto.specification_lookup.load_specification_lookups).
const VM_PMS_UPLOAD = {
  acceptedExt: '.xlsx,.xls,.csv',
};

const VM_VISION_PROVIDERS = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'claude', label: 'Claude (Anthropic)' },
];

// Model choices per provider — shown in the "AI Model" dropdown, right
// after the AI Provider dropdown in Stage 2.
const VM_VISION_MODELS = {
  claude: [
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (Recommended)' },
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (Most accurate)' },
    { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (Fastest)' },
  ],
  openai: [
    { id: 'gpt-4o-mini', label: 'GPT-4o mini (Recommended)' },
    { id: 'gpt-4o', label: 'GPT-4o (Most accurate)' },
  ],
};
const VM_VISION_MODEL_DEFAULTS = { claude: 'claude-sonnet-5-5', openai: 'gpt-4o-mini' };

// Timing (ms) — mirrors the deleted page's soft-coded values.
const UPLOAD_TIMEOUT_MS = 600000;    // 10 min upload ceiling
const POLL_INTERVAL_MS  = 3000;      // poll every 3 s
const POLL_MAX_WAIT_MS  = 3600000;   // give up after 60 min
const POLL_REQ_TIMEOUT  = 10000;     // per-poll GET timeout

// Local cache (server persistence via valveMtoService is the primary store).
const STORAGE_KEY = 'radai.valveMTO.state.v2';

// ---------------------------------------------------------------------------
// HEADER STYLE SWITCH — 'v1' = light card identical to Line List / P&ID V1.
// ---------------------------------------------------------------------------
const VM_HEADER_STYLE = 'v1';

// V1-style light header config (mirrors LineList's LL_HEADER constants)
const VM_HEADER = {
  icon:         'table',
  title:        'Valve MTO',
  subtitle:     'RADAI AI Engine and legend-symbol matching for a reviewable valve take-off from P&ID drawings. Verify observed quantities and specifications before procurement.',
  badgeText:    'Engineering Review',
  badgeColor:   '#10b981',
  iconSize:     40,
  featureBadges: [
    { label: 'RADAI AI Engine', color: '#3b82f6' },
    { label: 'Async Processing',     color: '#6366f1' },
    { label: 'Inline Editing',       color: '#8b5cf6' },
    { label: 'Excel Import / Export', color: '#f59e0b' },
    { label: 'Server Persistence',   color: '#06b6d4' },
  ],
  stats: [
    { key: 'columns', label: 'Columns' },
    { key: 'tabs',    label: 'Views' },
  ],
};

// Rotating tips shown during processing — soft-coded.
const VM_PROC_TIPS = [
  '💡 Thorough Scan tiles each P&ID page — dense drawings take longer.',
  '🧠 RADAI AI Engine combines drawing analysis with symbol evidence; unknown types remain unconfirmed.',
  '📐 Unknown area allocations and specifications stay blank — they are never invented.',
  '✨ You can keep this tab open in the background — polling runs every few seconds.',
  '📥 Results are editable inline and saved back to the server automatically.',
];
const VM_PROC_TIP_ROTATE_MS = 5000;

const colByKey = Object.fromEntries(VALVE_COLUMNS.map((c) => [c.key, c]));

// Tab views share rows; schema visibility controls the secondary slot.
const VM_TABS = [
  { id: 'all',      label: 'ALL',          areaFilter: null,     secondaryCol: 'size_2' },
  { id: 'island',   label: 'ISLAND',       areaFilter: 'ISLAND', secondaryCol: 'size_2' },
  { id: 'field',    label: 'FIELD',        areaFilter: 'Field',  secondaryCol: 'size_2' },
  { id: 'combined', label: 'COMBINED MTO', areaFilter: null,     secondaryCol: 'bore'   },
];

// Column key order for the register table (labels/widths come from
// VALVE_COLUMNS; the secondary column slot is resolved per active tab).
const VM_TABLE_KEYS = [
  'sl_no', 'area', 'type', 'pms_class', 'piping_class', 'rating', 'size_1',
  '__secondary__', 'pid_number', 'line_number', 'line_list', 'valve_tag', 'description',
  'qty_island', 'qty_field', 'qty_observed', 'unit', 'remarks', 'confidence', 'location_hint',
];

// Soft-coded layout config — change widths/padding here without touching JSX.
// ─── Enterprise Register (management view) — pure design layer ───────────
// Everything below is display/workflow config only — extraction, polling,
// import/export and persistence never read from these blocks.
// ---------------------------------------------------------------------------

// Register chrome — meta line, pagination, breadcrumb (template-aligned).
const REGISTER_CONFIG = {
  registerPrefix: 'VMTO',            // shown as "Register: VMTO-<project>"
  revisionPad:    2,                 // Rev: 03
  pageSize:       10,                // rows per register page
  breadcrumbRoot: 'Projects',
  mainTabs: [
    { id: 'register',   label: 'Register'   },
    { id: 'extraction', label: 'Extraction Review' },
    { id: 'validation', label: 'Validation' },
    { id: 'reviews',    label: 'Reviews'    },
    { id: 'activity',   label: 'Activity'   },
  ],
};

// Row status pills — derivation precedence: Error (validation) > stored
// status (New / Changed / Reviewed) > Unchanged.
const STATUS_CONFIG = {
  New:       { label: 'New',       bg: 'rgba(59,130,246,0.10)',  fg: '#1d4ed8', border: 'rgba(59,130,246,0.28)'  },
  Changed:   { label: 'Changed',   bg: 'rgba(245,158,11,0.14)',  fg: '#b45309', border: 'rgba(245,158,11,0.30)'  },
  Reviewed:  { label: 'Reviewed',  bg: 'rgba(16,185,129,0.12)',  fg: '#047857', border: 'rgba(16,185,129,0.28)'  },
  Error:     { label: 'Error',     bg: 'rgba(239,68,68,0.12)',   fg: '#b91c1c', border: 'rgba(239,68,68,0.28)'   },
  Unchanged: { label: 'Unchanged', bg: 'rgba(100,116,139,0.10)', fg: '#475569', border: 'rgba(100,116,139,0.22)' },
};

// Data-quality rules — test(row) returns TRUE when the row PASSES.
// severity 'error' → row status pill becomes Error; 'warning' → listed only.
const VALIDATION_RULES = [
  { key: 'missing_tag',      label: 'No visible valve tag (manual valves may be untagged)', severity: 'warning', test: (r) => !!String(r.valve_tag || '').trim() },
  { key: 'missing_type',     label: 'Missing or unconfirmed valve type', severity: 'error', test: (r) => !!String(r.type || '').trim() && !String(r.type).toUpperCase().includes('UNIDENTIFIED') },
  { key: 'missing_pms',      label: 'Missing piping material class', severity: 'error',  test: (r) => !!String(r.pms_class || '').trim() },
  { key: 'zero_qty',         label: 'No observed or allocated quantity', severity: 'error', test: (r) => (Number(r.qty_observed) || 0) + (Number(r.qty_island) || 0) + (Number(r.qty_field) || 0) > 0 },
  { key: 'missing_size',     label: `Missing ${colByKey.size_1.label}`, severity: 'warning', test: (r) => !!String(r.size_1 || '').trim() },
  { key: 'missing_pid',      label: 'Missing P&ID number',          severity: 'warning', test: (r) => !!String(r.pid_number || '').trim() },
  { key: 'missing_area', label: 'Missing DRG. TITLE for AREA', severity: 'warning', test: r => !!String(r.area || '').trim() && !AREA_OPTIONS.some(area => normArea(area) === normArea(r.area)) },
  { key: 'missing_rating', label: 'Rating / facing requires PMS or drawing evidence', severity: 'warning', test: r => !!String(r.rating || '').trim() },
  { key: 'missing_line', label: 'Connected line number requires verification', severity: 'warning', test: r => !!String(r.line_number || '').trim() },
];

// Engineering review workflow states (register-level, persisted per project).
const WORKFLOW_STATES = {
  in_review: { id: 'in_review', label: 'In Review', badgeColor: '#3b82f6' },
  approved:  { id: 'approved',  label: 'Approved',  badgeColor: '#10b981' },
  rejected:  { id: 'rejected',  label: 'Rejected',  badgeColor: '#ef4444' },
};

// Activity feed — event types + storage cap.
const ACTIVITY_CONFIG = {
  maxEntries: 200,
  events: {
    extraction: { icon: '🤖', label: 'Extraction' },
    import:     { icon: '📥', label: 'Import' },
    row_added:  { icon: '➕', label: 'Row added' },
    row_edited: { icon: '✏️', label: 'Row edited' },
    row_deleted:{ icon: '🗑️', label: 'Row deleted' },
    review:     { icon: '✅', label: 'Review' },
    export:     { icon: '📤', label: 'Export' },
    legend:     { icon: '📖', label: 'Legend' },
    pms:        { icon: '📋', label: 'PMS' },
    save:       { icon: '💾', label: 'Saved' },
  },
};

// Register filter bar — each filter: options resolved from row data or a
// static list; match(row) returns TRUE when the row passes (empty = all).
const FILTER_DEFS = [
  { key: 'type',   label: 'Type',   options: (rows) => [...new Set(rows.map(r => r.type).filter(Boolean))].sort(),
    match: (r, v) => r.type === v },
  { key: 'area',   label: 'Area / DRG. TITLE',   options: (rows) => [...new Set(rows.map(r => r.area).filter(Boolean))].sort(),
    match: (r, v) => normArea(r.area) === normArea(v) },
  { key: 'status', label: 'Status', options: () => Object.keys(STATUS_CONFIG),
    match: (r, v, ctx) => ctx.getRowStatus(r) === v },
  { key: 'quality', label: 'Data-quality', options: () => ['Errors', 'Warnings', 'Clean'],
    match: (r, v, ctx) => {
      const iss = ctx.getRowIssues(r);
      if (v === 'Errors') return iss.some(i => i.severity === 'error');
      if (v === 'Warnings') return iss.some(i => i.severity === 'warning');
      return iss.length === 0;
    } },
];

// Detail panel sections (right side) — config-driven groups of row fields.
const DETAIL_SECTIONS = [
  { key: 'general',  title: 'General',
    fields: [ { key: 'type', label: 'Type' }, { key: 'area', label: 'Area' }, { key: 'unit', label: 'Unit' } ] },
  { key: 'specs',    title: 'Engineering specifications',
    fields: [
      { key: 'pms_class', label: 'Piping material class' }, { key: 'piping_class', label: 'Piping class' },
      { key: 'rating', label: 'Rating / Facing' }, { key: 'facing', label: 'Facing' },
      { key: 'size_1', label: colByKey.size_1.label },
      { key: 'size_2', label: 'Size 2 (NB)' }, { key: 'bore', label: 'Bore' },
    ] },
  { key: 'quantities', title: 'Quantities',
    fields: [ { key: 'qty_observed', label: 'Observed (review)' }, { key: 'qty_island', label: 'Island' }, { key: 'qty_field', label: 'Field' } ],
    total: { label: 'Total to be ordered', compute: (r) => (Number(r.qty_island) || 0) + (Number(r.qty_field) || 0) } },
  { key: 'references', title: 'References',
    fields: [ { key: 'pid_number', label: 'P&ID number' }, { key: 'line_number', label: 'Line number' }, { key: 'line_list', label: 'Line list' } ] },
  { key: 'notes', title: 'Notes & quality',
    fields: [ { key: 'remarks', label: 'Remarks' }, { key: 'confidence', label: 'Confidence' }, { key: 'location_hint', label: 'Location hint' } ] },
];

// Side panel fields (single click opens the panel; these fields are
// ALWAYS editable, no separate edit mode) — which DETAIL_SECTIONS fields
// become inputs, and what kind. select/options reuse the SAME metadata the
// inline table-cell editor already uses (colByKey), so both editors stay
// consistent. valve_tag (panel header), type, unit, confidence,
// location_hint and qty_observed are deliberately absent here — they
// always stay plain read-only text.
const PANEL_EDITABLE_FIELDS = {
  pms_class: { kind: 'text' },
  piping_class: { kind: 'text' },
  rating: { kind: 'text' },
  facing: { kind: 'text' },
  size_1: { kind: 'select', options: colByKey.size_1.options },
  bore: { kind: 'select', options: colByKey.bore.options },
  line_number: { kind: 'text' },
  area: { kind: 'text' },
  pid_number: { kind: 'text' },
  remarks: { kind: 'textarea' },
  qty_island: { kind: 'number' },
  qty_field: { kind: 'number' },
};

// Linked documents resolver — soft-coded; safe empty state. Resolves the
// source P&ID PDF (from the extraction) into a list item.
const resolveLinkedDocuments = (ctx) => {
  const docs = [];
  if (ctx.sourcePdfName) {
    docs.push({ name: ctx.sourcePdfName, meta: 'Source P&ID', href: null });
  }
  return docs;
};

const LAYOUT_CONFIG = {
  normalMaxWidth:      '100%',
  normalPaddingX:      '1.5rem',
  normalPaddingY:      '2rem',
  fullscreenMaxWidth:  '100%',
  fullscreenPaddingX:  '2rem',
  fullscreenPaddingY:  '2rem',
};

// ---------------------------------------------------------------------------
// SOFT-CODED: Project Organizer integration for Valve MTO
// ---------------------------------------------------------------------------
const VM_PROJECTS = {
  enabled:    true,
  toolCode:   'piping_pms',                    // matches moduleCode in engineeringStructure.config
  storageKey: 'valveMTOActiveProject',
  theme:      PROJECT_ORGANIZER_CONFIG.defaultTheme,
  createTitle:'New Valve MTO Project',
};

// ---------------------------------------------------------------------------
// SOFT-CODED: Legend Sheets integration (Valve MTO's OWN isolated table)
// ---------------------------------------------------------------------------
// Section list MUST stay in sync with the backend:
//   apps.valve_mto.models.VALVE_MTO_LEGEND_SECTIONS and
//   piping_valve_mto_extractor's LEGEND_SECTIONS_ESSENTIAL/_OPTIONAL —
//   the extractor injects the user's ACTIVE legend for each of these
//   sections into the Vision prompt server-side (via the requesting
//   user's id, already passed to start_job by the view). The extraction
//   POST therefore needs NO legend-related parameter — confirmed by
//   reading extract_valve_mto_view / _build_legend_context end to end.
const VM_LEGENDS = {
  enabled: true,
  defaultSection: 'valve',
  sections: [
    'valve', 'piping', 'line_list', 'instrument_signal',
    'control_valve_regulator', 'scope_symbols', 'limit_line',
  ],
  // Minimal placeholder definitions auto-created + activated when a
  // section has NO legend at all, so the extractor's legend context is
  // never empty by accident. Shape matches LegendSheetsModal's FormEditor
  // ({separator, fields:[{key,label,regex,...}]}); users edit freely in
  // the modal afterwards.
  defaults: {
    valve:                  { name: 'Valve Types - Standard',            label: 'Valve Type Code' },
    piping:                 { name: 'Piping Classes - Standard',         label: 'Piping Class Code' },
    line_list:              { name: 'Line Format - Standard',            label: 'Line Field' },
    instrument_signal:      { name: 'Instrumentation Lines - Standard',  label: 'Signal Line Type' },
    control_valve_regulator:{ name: 'Control Valve - Standard',          label: 'Control Valve Type' },
    scope_symbols:          { name: 'Area Boundaries - Scope Symbols',   label: 'Scope Symbol' },
    limit_line:             { name: 'Area Boundaries - Limit Line',      label: 'Limit Line Marker' },
  },
};

// legendApi bundle consumed by LegendSheetsModal's `legendApi` prop.
const VM_LEGEND_API = {
  listLegends:     valveMtoLegendService.listLegends,
  createLegend:    valveMtoLegendService.createLegend,
  updateLegend:    valveMtoLegendService.updateLegend,
  deleteLegend:    valveMtoLegendService.deleteLegend,
  activateLegend:  valveMtoLegendService.activateLegend,
  previewLegendWorkbook: valveMtoLegendService.previewLegendWorkbook,
  importLegendWorkbook: valveMtoLegendService.importLegendWorkbook,
  sections: VM_LEGENDS.sections.map(id => ({ id, label: id.replaceAll('_', ' ') })),
};

const normArea = (a) => String(a || '').trim().toLowerCase();

// Defensive row normalization — extraction rows should already arrive in the
// local shape (keys matching VALVE_COLUMNS), but accept a few server-style
// aliases so nothing is silently dropped.
const normalizeRow = (raw = {}, idx = 0) => {
  const row = { ...DEFAULT_ROW(), id: raw.id || `v_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 8)}` };
  for (const c of VALVE_COLUMNS) {
    if (raw[c.key] !== undefined && raw[c.key] !== null) row[c.key] = raw[c.key];
  }
  // Server-style aliases (defensive fallback)
  if (!row.type && raw.valve_type) row.type = raw.valve_type;
  if (!row.valve_tag && raw.tag_number) row.valve_tag = raw.tag_number;
  if (!row.size_1 && raw.size_primary) row.size_1 = raw.size_primary;
  if (!row.size_2 && raw.size_secondary_2) row.size_2 = raw.size_secondary_2;
  if (!row.bore && raw.size_secondary) row.bore = raw.size_secondary;
  if (!row.line_list && raw.line_list_ref) row.line_list = raw.line_list_ref;
  if (!row.size_1) row.size_1 = sizeNBFromLineNumber(row.line_number);
  row.tab = allocationTab(raw);
  row.sl_no = Number(row.sl_no) || idx + 1;
  row.qty_island = Number(row.qty_island) || 0;
  row.qty_field = Number(row.qty_field) || 0;
  // Register status pill — extracted/imported rows start as 'New'; an
  // existing value (cache / defensive server read-back) is preserved.
  row.status = raw.status || 'New';
  return row;
};

const normalizeRows = (list = []) => (Array.isArray(list) ? list.map(normalizeRow) : []);

const renumber = (rows) => rows.map((r, i) => ({ ...r, sl_no: i + 1 }));

// ---------------------------------------------------------------------------
// Step-by-step unlock flow — same STAGE_FLOW pattern as InstrumentIndex.jsx:
// each stage carries its own `isUnlocked(state)` gate and `isComplete(state)`
// check. A stage's content stays hidden (VmStageGate) until the previous
// stage is completed (or explicitly skipped, for optional stages). Edit
// gates/copy here without touching JSX.
// ---------------------------------------------------------------------------
const VM_STAGE_FLOW = [
  {
    id: 'upload',
    num: 1,
    title: 'Upload P&ID Drawing (PDF)',
    optional: false,
    isUnlocked: () => true,
    isComplete: (s) => Boolean(s.pidDocument),
    instruction: {
      heading: 'How to provide your P&ID — pick any ONE option',
      bullets: [
        'Drag & drop the P&ID PDF onto the drop zone below.',
        'Click the drop zone to browse and select the PDF from your computer.',
      ],
      note: 'Single-page and multi-page PDFs are supported.',
    },
  },
  {
    id: 'pms',
    num: 2,
    title: 'PMS Document',
    optional: true,
    isUnlocked: (s) => Boolean(s.pidDocument),
    isComplete: (s) => Boolean(s.pmsComplete),
    instruction: {
      heading: 'Upload PMS document',
      bullets: [
        'Upload your Piping Material Specification Excel file with columns: PIPING_CLASS | PMS_CLASS | RATING | FACING.',
        'This automatically fills: ✅ Rating / Facing column, ✅ Piping Material Class column.',
        'Without a PMS document these columns will be empty after extraction.',
        "Skip if you don't have PMS data — you can fill these columns manually by clicking any row in results and editing it directly.",
      ],
      note: 'Optional — skip if you don’t have PMS data available right now.',
    },
  },
  {
    id: 'engine',
    num: 3,
    title: '⚡ RADAI AI Engine',
    subtitle: 'Requires your personal API key',
    optional: false,
    isUnlocked: (s) => Boolean(s.pidDocument) && Boolean(s.pmsComplete),
    isComplete: (s) => Boolean(s.engineComplete),
    instruction: {
      heading: 'Using the RADAI AI Engine',
      bullets: [
        'RADAI AI Engine analyses your P&ID drawing to extract valve data accurately.',
        'Provide your personal API key below to use the AI engine.',
        "Don't have a key? Raise a ticket with the ICT department via My Enquiries to get one issued.",
      ],
    },
  },
  {
    id: 'legend',
    num: 4,
    title: 'Valve Legend',
    optional: false,
    isUnlocked: (s) => Boolean(s.pidDocument) && Boolean(s.pmsComplete) && Boolean(s.engineComplete),
    isComplete: (s) => Boolean(s.legendComplete),
    instruction: {
      heading: 'Activate your valve legend',
      bullets: [
        "Click 'Activate Legends' to open the Legend Manager.",
        'In Legend Manager go to Piping (1.2) → Valve section.',
        'Activate at least one legend and click Save Changes.',
        "Click 'Return to Valve MTO' banner to come back.",
        'Start Extraction enables only after completing these steps.',
        'Facing difficulty? Raise a request with ICT via My Enquiries.',
      ],
      note: 'Required — activate a legend in Legend Manager and return here. Start Extraction stays disabled until this step is completed.',
    },
  },
];

// Scan Mode sub-instruction inside Stage 2 (RADAI AI Engine only) — moved out of
// its own stage; Local OCR has no Vision calls to tune, so there's nothing
// for it to gate separately any more.
const VM_SCANMODE_INSTRUCTION = {
  heading: 'Select scan mode',
  bullets: [
    'Quick Scan: ~1 API call per page — fast and cheap, good for clear drawings.',
    'Thorough Scan: ~8 API calls per page tiled — more accurate on dense or low-quality drawings.',
  ],
  note: 'Use Thorough Scan for best results.',
};

// Same ICT ticket route Instrument Index's own STAGE_FLOW/LEGEND_ATTACH_CONFIG
// use (`/my-enquiries`) — found by reading InstrumentIndex.jsx directly.
const VM_ICT_ROUTE = '/my-enquiries';

// Legend Manager page — same `section`/`returnTo`/`from` query-param
// contract Instrument Index's own LEGEND_ATTACH_CONFIG.legendManager.route
// uses, so LegendManagerPage.jsx's existing "Return to <from>" banner
// works unchanged for Valve MTO too.
const VM_LEGEND_MANAGER_ROUTE = '/engineering/legends?section=valve&returnTo=/engineering/piping/pms&from=Valve%20MTO';

// Module-scope in-memory cache — same pattern as Instrument Index's
// II_SESSION_CACHE. Navigating to Legend Manager is a real route change to
// a DIFFERENT <Route>, which unmounts this whole component; sessionStorage
// previously bridged that gap, but a plain object declared here at module
// scope does the same job more simply: the JS module itself stays loaded
// for the whole SPA session (only a full page reload clears it), so this
// object — including the real pidDocument File — survives the unmount
// untouched. useState reads it as each field's initial value below, and a
// write-through effect keeps it in sync with the live state on every
// change. `navigatingToLegends` is a one-shot flag, set right before
// navigating to Legend Manager and consumed by checkLegendManagerReturn —
// it's what lets the Valve Legend stage tell "returned from Legend
// Manager" apart from any other same-project remount (the projectId
// check alone can't: it's true for every remount of the same project,
// not just this one route). pmsFile/pmsSkipped/pmsData (PMS Document
// stage) follow the exact same restore-on-same-project pattern as
// pidDocument — including pmsFile itself being a real File object, safe
// here for the same reason pidDocument is (plain module memory, no
// serialization limit).
const VM_SESSION_CACHE = {
  enabled: true,
  projectId: null,
  pidDocument: null,
  pmsFile: null,
  pmsSkipped: false,
  pmsData: [],
  extractionMode: 'vision',
  visionProvider: 'openai',
  visionModel: '',
  visionApiKey: '',
  keyTestResult: null,
  scanMode: 'thorough',
  credentialMode: 'byok',
  legendsActivatedFromManager: false,
  navigatingToLegends: false,
};

// Submit-gate checklist copy — same role as Instrument Index's
// II_SUBMIT_GATE.stages, read by both the bottom checklist and (indirectly,
// via vmAllStagesVerified) the Extract button's disabled condition.
const VM_SUBMIT_GATE_STAGES = [
  { id: 'upload', label: 'P&ID PDF uploaded' },
  { id: 'pms', label: 'PMS document uploaded or skipped' },
  { id: 'engine', label: 'RADAI AI Engine configured' },
  { id: 'legend', label: 'Valve legend activated' },
];

// Soft-coded per-stage "User Instruction" panel — identical styling to
// Instrument Index's own StageInstruction — purely presentational.
// `instruction` can be passed directly (for sub-instructions, e.g. the BYOK
// box inside Stage 2, that aren't tied to a whole VM_STAGE_FLOW entry);
// otherwise falls back to `stage.instruction`. `actions`: optional array of
// {label, route} (navigates) or {label, onClick} (runs a callback instead —
// e.g. opening the Legend modal rather than navigating to a route).
function VmStageInstruction({ stage, instruction, actions }) {
  const navigate = useNavigate();
  const { heading, bullets = [], note } = instruction || stage?.instruction || {};
  if (!heading) return null;
  return (
    <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50/60 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-sky-700 mb-2">
        📘 User Instruction — {heading}
      </p>
      <ul className="list-disc list-inside space-y-1 text-xs text-slate-600">
        {bullets.map((b, i) => <li key={i}>{b}</li>)}
      </ul>
      {!!actions?.length && (
        <div className="flex flex-wrap gap-2 mt-3">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => (a.onClick ? a.onClick() : navigate(a.route))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-700 bg-white hover:bg-sky-50 border border-sky-300 rounded-md transition-colors"
            >
              {a.label} <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
      )}
      {note && <p className="mt-2 text-[11px] italic text-slate-400">{note}</p>}
    </div>
  );
}

// Soft-coded locked placeholder — identical styling to Instrument Index's
// own StageGate — shown in place of a stage's content until its
// `isUnlocked(state)` gate passes.
function VmStageGate({ stage }) {
  return (
    <div className="border border-dashed border-gray-200 rounded-lg p-4 mb-4 bg-gray-50/60 flex items-center gap-3 opacity-80">
      <span className="flex items-center justify-center h-6 w-6 rounded-full bg-gray-100 text-gray-400 text-xs font-bold border border-gray-200 shrink-0">
        🔒
      </span>
      <div>
        <p className="text-sm font-semibold text-gray-400">
          {stage.num}. {stage.title}
          {stage.optional && <span className="ml-1 text-[10px] font-normal text-gray-400">(optional)</span>}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">Complete the previous step to unlock this stage.</p>
      </div>
    </div>
  );
}

// Per-stage numbered badge — same visual language as Instrument Index's
// inline headings (coloured when unlocked, grey when locked), plus a green
// check once the stage is complete.
function VmStageHeading({ stage, unlocked, complete, colourClass }) {
  return (
    <div className="mb-3">
      <h2 className={`text-lg font-semibold flex items-center gap-2 ${unlocked ? 'text-gray-800' : 'text-gray-400'}`}>
        <span className={`h-6 w-6 rounded-full text-xs font-bold flex items-center justify-center ${unlocked ? colourClass : 'bg-gray-100 text-gray-400'}`}>
          {stage.num}
        </span>
        {stage.title}
        {stage.optional && <span className="text-xs font-normal text-gray-400">(optional)</span>}
        {complete && <CheckCircleIcon className="h-4 w-4 text-emerald-500" />}
        {!unlocked && <span className="text-xs">🔒</span>}
      </h2>
      {stage.subtitle && unlocked && (
        <p className="text-xs text-gray-400 mt-0.5 ml-8">{stage.subtitle}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const ValveMTO = () => {
  const navigate = useNavigate();
  // ── Project Organizer state (soft-coded — see VM_PROJECTS) ─────────────
  const { activeProject, setActiveProject, hydrated: projHydrated } = useActiveProject(VM_PROJECTS.storageKey);
  const [projects, setProjects]               = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [editingProject, setEditingProject]   = useState(null); // project being edited, or null for create
  const [projectBusy, setProjectBusy]         = useState(false);
  const [projectError, setProjectError]       = useState('');

  // ── Workspace state machine: idle → processing → results ───────────────
  // Every field below that's also tracked in VM_SESSION_CACHE reads that
  // cache as its initial value — on a fresh app session the cache is still
  // at its defaults (indistinguishable from a plain literal), but on a
  // remount within the same tab (e.g. returning from Legend Manager) it
  // carries the real in-memory values straight through, File object
  // included, with no re-upload or re-entry needed.
  const [pidDocument, setPidDocument]   = useState(VM_SESSION_CACHE.enabled ? VM_SESSION_CACHE.pidDocument : null);
  // ── PMS Document (Stage 2, optional) — restored from VM_SESSION_CACHE
  // the same way pidDocument is (see that cache's own comment above).
  const [pmsFile, setPmsFile]           = useState(VM_SESSION_CACHE.enabled ? VM_SESSION_CACHE.pmsFile : null);
  const [pmsSkipped, setPmsSkipped]     = useState(VM_SESSION_CACHE.enabled ? VM_SESSION_CACHE.pmsSkipped : false);
  const [pmsData, setPmsData]           = useState(VM_SESSION_CACHE.enabled ? VM_SESSION_CACHE.pmsData : []);
  // Complete the instant either a file is loaded OR the user explicitly
  // skipped — "skip" is a real, equally-valid way to finish this stage.
  const pmsComplete = Boolean(pmsFile) || Boolean(pmsSkipped);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress]         = useState(0);        // 0–100
  const [statusMessage, setStatusMessage] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [procTipIdx, setProcTipIdx]     = useState(0);
  const [error, setError]               = useState(null);
  const [extractionWarnings, setExtractionWarnings] = useState([]);
  // RADAI AI Engine is the only extraction engine now (Local OCR option
  // removed) — always 'vision'. Kept as its own state (rather than a
  // hardcoded literal) since handleExtract's formData/pre-flight checks
  // still read it.
  const [extractionMode, setExtractionMode] = useState(VM_SESSION_CACHE.enabled ? VM_SESSION_CACHE.extractionMode : 'vision');
  const [visionProvider, setVisionProvider] = useState(VM_SESSION_CACHE.enabled ? VM_SESSION_CACHE.visionProvider : 'openai');
  // Model choice for the selected provider — restored from the cache if
  // present, otherwise defaults to that provider's recommended model.
  const [visionModel, setVisionModel] = useState(() => {
    if (VM_SESSION_CACHE.enabled && VM_SESSION_CACHE.visionModel) return VM_SESSION_CACHE.visionModel;
    const initialProvider = VM_SESSION_CACHE.enabled ? VM_SESSION_CACHE.visionProvider : 'openai';
    return VM_VISION_MODEL_DEFAULTS[initialProvider] || VM_VISION_MODEL_DEFAULTS.openai;
  });
  // RADAI AI Engine is personal-key-only now (no shared/central option in
  // the UI) — credentialMode has no visible control any more, but
  // handleExtract still reads it to build the request, so it's pinned to
  // 'byok' by default (and re-pinned on every project switch, below).
  const [credentialMode, setCredentialMode] = useState(VM_SESSION_CACHE.enabled ? VM_SESSION_CACHE.credentialMode : 'byok');
  const [visionApiKey, setVisionApiKey] = useState(VM_SESSION_CACHE.enabled ? VM_SESSION_CACHE.visionApiKey : '');
  const [isTestingKey, setIsTestingKey] = useState(false);
  // keyTestResult is a status string, not an object — one of:
  // null ("not tested yet"), 'empty', 'testing', 'valid', 'invalid',
  // 'rate_limited'. Reset to null whenever the key/provider changes (see
  // their onChange handlers) so a previously-passed test never silently
  // carries over to a DIFFERENT key.
  const [keyTestResult, setKeyTestResult] = useState(VM_SESSION_CACHE.enabled ? VM_SESSION_CACHE.keyTestResult : null);
  const centralAI = useAIProviderStatus(visionProvider);
  // AI Vision only "can run" once the key has actually tested valid.
  const canUseVision = !isTestingKey && keyTestResult === 'valid';

  // ── Stage 2 completion — RADAI AI Engine is the only engine, so
  // completion is simply "the key has tested valid", no engine choice
  // to make any more.
  const engineComplete = keyTestResult === 'valid';

  // Quick Scan (1 Vision call/page, fast) vs Thorough Scan (tiled, more
  // calls/page, more accurate on dense drawings) — previously hardcoded to
  // VM_UPLOAD.scanModeDefault with no visible control; now a real toggle,
  // still defaulting to 'thorough'.
  const [scanMode, setScanMode] = useState(VM_SESSION_CACHE.enabled ? VM_SESSION_CACHE.scanMode : VM_UPLOAD.scanModeDefault);

  // ── Register state ─────────────────────────────────────────────────────
  const [rows, setRows]               = useState([]);
  const [hasResults, setHasResults]   = useState(false);
  const [activeTab, setActiveTab]     = useState('all');
  const [search, setSearch]           = useState('');
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [editCell, setEditCell]       = useState(null);       // {rowId, key}
  const [saveStatus, setSaveStatus]   = useState('');         // '' | 'Saving…' | 'Saved to server' | 'Save failed'
  const [serverProjectId, setServerProjectId] = useState(null);

  // ── Enterprise register / workflow state ───────────────────────────────
  const [mainTab, setMainTab]         = useState('register'); // register | validation | reviews | activity
  const extractionReview = buildValveMTOReview(rows, extractionWarnings);
  const [regFilters, setRegFilters]   = useState(() => Object.fromEntries(FILTER_DEFS.map(f => [f.key, ''])));
  const [regPage, setRegPage]         = useState(1);
  const [revision, setRevision]       = useState(1);
  const [activity, setActivity]       = useState([]);
  const [reviewState, setReviewState] = useState({ status: 'in_review', history: [] });
  const [reviewComment, setReviewComment] = useState('');

  // ── Managed Legend Sheets (Valve MTO's OWN isolated legend system) ──────
  const [legendModalOpen, setLegendModalOpen] = useState(false);
  const [activeLegends, setActiveLegends]     = useState({});   // section → legend
  // BUG FIX: a legend left active from a PREVIOUS visit/project used to
  // auto-complete the Valve Legend stage the instant the earlier stages
  // were done, with no actual trip to Legend Manager required. It now
  // only completes after the user explicitly navigates to Legend Manager
  // (via "Activate Legends")
  // and comes back — see checkLegendManagerReturn below — never merely
  // because a legend happens to already exist. Restored from the
  // module-scope VM_SESSION_CACHE (not just plain useState) so it survives
  // any same-project remount, same as pidDocument/the engine fields below.
  const [legendsActivatedFromManager, setLegendsActivatedFromManager] = useState(
    VM_SESSION_CACHE.enabled ? VM_SESSION_CACHE.legendsActivatedFromManager : false
  );

  // ── Stage-flow state — fed into VM_STAGE_FLOW's isUnlocked/isComplete,
  // same shape/role as InstrumentIndex.jsx's own stageFlowState. ──────────
  // Engine stage complete = key tested valid, nothing else.
  // Legend stage complete = legendsActivatedFromManager alone — it
  // already only ever becomes true via an actual Legend-Manager round-trip
  // with active legends found (see checkLegendManagerReturn), so gating it
  // further on pidDocument/engineComplete here was redundant; the overall
  // Start Extraction gate (vmAllStagesVerified below) still requires ALL
  // four stages simultaneously regardless.
  const legendComplete = Boolean(legendsActivatedFromManager);
  const stageFlowState = {
    pidDocument,
    pmsComplete,
    extractionMode,
    canUseVision,
    engineComplete,
    legendComplete,
    activeLegendsCount: Object.keys(activeLegends).length,
  };

  // ── Submit gate (soft-coded; mirrors Instrument Index's II_SUBMIT_GATE) ──
  // Extract stays disabled until every stage is verified. 4 stages now —
  // PMS Document (optional, Stage 2) added; Scan Mode stays inside the
  // RADAI AI Engine stage (AI Vision only), not its own gate.
  const vmStageVerified = {
    upload: Boolean(pidDocument),
    pms: pmsComplete,
    engine: engineComplete,
    legend: legendComplete,
  };
  const vmAllStagesVerified = Object.values(vmStageVerified).every(Boolean);

  // -------------------------------------------------------------------------
  // Local cache helpers (keyed per organizer project) — declared before the
  // legend block so legend changes can be logged to the activity feed.
  // -------------------------------------------------------------------------
  const cacheKey = useCallback(
    () => `${STORAGE_KEY}.${activeProject?.project_id || 'default'}`,
    [activeProject],
  );

  const readCache = useCallback(() => {
    try {
      const raw = localStorage.getItem(cacheKey());
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, [cacheKey]);

  const writeCache = useCallback((patch) => {
    try {
      const prev = readCache() || {};
      localStorage.setItem(cacheKey(), JSON.stringify({ ...prev, ...patch, savedAt: new Date().toISOString() }));
    } catch { /* quota — non-fatal */ }
  }, [cacheKey, readCache]);

  // Activity feed — timestamped, per-project, capped (soft-coded)
  const pushActivity = useCallback((type, text) => {
    setActivity((prev) => {
      const next = [{ type, text, at: new Date().toISOString() }, ...prev].slice(0, ACTIVITY_CONFIG.maxEntries);
      writeCache({ activity: next });
      return next;
    });
  }, [writeCache]);

  // Revision counter — increments on each extraction / import / save.
  const bumpRevision = useCallback(() => {
    setRevision((prev) => {
      const next = prev + 1;
      writeCache({ revision: next });
      return next;
    });
  }, [writeCache]);

  // Refresh the section → active-legend map (best-effort, never fatal).
  // Returns the fetched rows so callers can inspect the FRESH count
  // directly, rather than reading possibly-stale `activeLegends` state
  // right after calling this (the setState above won't have landed yet).
  const refreshActiveLegends = useCallback(async () => {
    if (!VM_LEGENDS.enabled) return [];
    try {
      const rows = await valveMtoLegendService.listActiveLegends();
      const map = {};
      (Array.isArray(rows) ? rows : []).forEach(l => { map[l.section] = l; });
      setActiveLegends(map);
      return Array.isArray(rows) ? rows : [];
    } catch { return []; /* non-fatal — legends are optional */ }
  }, []);

  // Stable callback for the modal (must be useCallback — an inline arrow
  // retriggers the modal's refresh effect and loops the legends endpoint).
  const handleLegendActiveChange = useCallback(() => {
    refreshActiveLegends();
    pushActivity('legend', 'Legend sheets updated');
  }, [refreshActiveLegends, pushActivity]);

  // Consumes VM_SESSION_CACHE.navigatingToLegends (set right before
  // navigating to Legend Manager — see the "Activate Legends" action
  // below) and, only when it was actually set, re-checks the fresh legend
  // count and marks Stage 3 activated-or-not accordingly. This is a
  // one-shot flag read/cleared directly on the module-scope cache object
  // (plain memory, not sessionStorage) — it's what lets this tell "came
  // back from Legend Manager specifically" apart from any other same-
  // project remount, which the projectId check used elsewhere can't do on
  // its own (it's true for every same-project remount, not just this one).
  const checkLegendManagerReturn = useCallback(async () => {
    if (!VM_SESSION_CACHE.navigatingToLegends) return;
    VM_SESSION_CACHE.navigatingToLegends = false;
    const rows = await refreshActiveLegends();
    setLegendsActivatedFromManager(rows.length > 0);
  }, [refreshActiveLegends]);

  useEffect(() => {
    refreshActiveLegends();
    checkLegendManagerReturn();
  }, [refreshActiveLegends, checkLegendManagerReturn]);

  // Secondary safety net: a genuine OS/browser-level tab-focus change
  // (alt-tab, switching browser tabs) — NOT itself what fires for the
  // "Activate Legends" round-trip (that's a same-tab client-side route
  // change, which the mount effect above already covers reliably), but
  // kept in case the user's actual return happens to coincide with one.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshActiveLegends();
        checkLegendManagerReturn();
      }
    };
    const handleFocus = () => {
      refreshActiveLegends();
      checkLegendManagerReturn();
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshActiveLegends, checkLegendManagerReturn]);

  // Write-through: mirror the live upload-form state into VM_SESSION_CACHE
  // on every change, so it's always current by the time the user clicks
  // "Activate Legends" (or navigates away for any other reason) — no
  // separate save-on-navigate call needed. pidDocument (a real File
  // object) is included: unlike sessionStorage, plain module memory has no
  // serialization limit, so it survives the round-trip intact.
  useEffect(() => {
    if (!projHydrated || !VM_SESSION_CACHE.enabled) return;
    Object.assign(VM_SESSION_CACHE, {
      projectId: activeProject?.project_id || null,
      pidDocument,
      pmsFile,
      pmsSkipped,
      pmsData,
      extractionMode,
      visionProvider,
      visionModel,
      visionApiKey,
      keyTestResult,
      scanMode,
      credentialMode,
      legendsActivatedFromManager,
    });
  }, [
    projHydrated, activeProject, pidDocument, pmsFile, pmsSkipped, pmsData,
    extractionMode, visionProvider, visionModel,
    visionApiKey, keyTestResult, scanMode, credentialMode, legendsActivatedFromManager,
  ]);

  // Open the manager — first auto-activate every Valve-MTO-relevant
  // section so the extractor's server-side legend context is populated:
  // if a section has no active legend, activate the first available one;
  // if it has none at all, create + activate the soft-coded default.
  const openLegendModal = useCallback(async () => {
    if (VM_LEGENDS.enabled) {
      for (const section of VM_LEGENDS.sections) {
        try {
          const list = await valveMtoLegendService.listLegends(section);
          const rows = Array.isArray(list) ? list : [];
          if (rows.some(l => l.is_active)) continue;
          let target = rows[0];
          if (!target) {
            const def = VM_LEGENDS.defaults[section];
            target = await valveMtoLegendService.createLegend({
              section,
              name: def.name,
              description: `Auto-created default legend for the "${section}" section — edit to match project conventions.`,
              definition: { separator: '-', fields: [{ key: 'code', label: def.label, regex: '[A-Z0-9]+' }] },
            });
          }
          if (target?.legend_id) await valveMtoLegendService.activateLegend(target.legend_id);
        } catch (e) {
          console.warn(`[ValveMTO] legend auto-activate failed for section "${section}":`, e?.message || e);
        }
      }
      refreshActiveLegends();
    }
    setLegendModalOpen(true);
  }, [refreshActiveLegends]);

  const pidRef        = useRef(null);
  const pmsRef        = useRef(null);
  const importRef     = useRef(null);
  const pollTimerRef  = useRef(null);
  const pollStartRef  = useRef(null);
  const elapsedTimerRef = useRef(null);
  const saveTimerRef  = useRef(null);

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Hydrate workspace when the active project changes

  // Hydrate workspace when the active project changes
  useEffect(() => {
    // BUG FIX: upload-form / stage-flow state (file, API key, engine
    // choice, scan mode, test-key status) used to be plain component-level
    // state with no project-scoping at all — only the register/results
    // state below was ever rehydrated per project, so a PDF/key/engine
    // choice left over from the previous project carried straight into
    // whichever project was opened next. Reset unconditionally here
    // (including when activeProject becomes null, e.g. going back to the
    // project list) so each project always starts from a clean upload form.
    //
    // EXCEPT: this effect ALSO fires on the very first mount after
    // returning from the "Activate Legends" round-trip to Legend Manager
    // (useActiveProject hydrates from localStorage on every mount, which
    // looks identical to a genuine project switch from this effect's
    // point of view). VM_SESSION_CACHE.projectId — set on every write-
    // through, never cleared by a remount (it's plain module memory, same
    // pattern as Instrument Index's II_SESSION_CACHE.projectId check) —
    // distinguishes that case: if it still matches the current
    // activeProject, this is the SAME project continuing, not a switch.
    //
    // BUG FIX: useActiveProject's own hydration effect starts activeProject
    // at null and only sets the real value in ITS OWN effect, one commit
    // later. That means THIS effect fires twice on every mount — once with
    // activeProject still null, once with the real value. Without gating on
    // projHydrated, the FIRST (spurious, activeProject === null) firing
    // would see VM_SESSION_CACHE.projectId (the real previous project) !==
    // null, treat it as "a different project", and wipe the cache's
    // in-memory pidDocument/key/etc. right out from under the SECOND,
    // real firing that follows immediately after. Gating here defers the
    // whole effect until useActiveProject has settled, so it only ever
    // runs once per real change, against the real activeProject value.
    if (!projHydrated) return;

    const sameProject = VM_SESSION_CACHE.enabled
      && VM_SESSION_CACHE.projectId
      && VM_SESSION_CACHE.projectId === (activeProject?.project_id || null);

    if (!sameProject) {
      // Genuine project switch (or the very first mount of a session) —
      // reset both the live state and the module cache so nothing from a
      // different project can leak into this one.
      setPidDocument(null);
      setPmsFile(null);
      setPmsSkipped(false);
      setPmsData([]);
      setVisionApiKey('');
      setExtractionMode('vision');
      setVisionProvider('openai');
      setVisionModel(VM_VISION_MODEL_DEFAULTS.openai);
      setScanMode(VM_UPLOAD.scanModeDefault);
      setKeyTestResult(null);
      setIsTestingKey(false);
      setCredentialMode('byok');
      setLegendsActivatedFromManager(false);
      if (VM_SESSION_CACHE.enabled) {
        Object.assign(VM_SESSION_CACHE, {
          projectId: activeProject?.project_id || null,
          pidDocument: null,
          pmsFile: null,
          pmsSkipped: false,
          pmsData: [],
          extractionMode: 'vision',
          visionProvider: 'openai',
          visionModel: VM_VISION_MODEL_DEFAULTS.openai,
          visionApiKey: '',
          keyTestResult: null,
          scanMode: VM_UPLOAD.scanModeDefault,
          credentialMode: 'byok',
          legendsActivatedFromManager: false,
          navigatingToLegends: false,
        });
      }
    }
    // else: same project (e.g. returning from the Legend Manager
    // round-trip) — the upload-form state was already restored by each
    // field's useState initial value above; nothing to do here.

    if (!activeProject) return;
    const cached = readCache();
    if (cached?.rows?.length) {
      const hydratedRows = cached.rows.map(row => ({ ...row, size_1: row.size_1 || sizeNBFromLineNumber(row.line_number) }));
      setRows(hydratedRows);
      if (hydratedRows.some((row, index) => row.size_1 !== cached.rows[index].size_1)) {
        writeCache({ rows: hydratedRows });
      }
      setHasResults(true);
      setServerProjectId(cached.serverProjectId || null);
    } else {
      setRows([]);
      setHasResults(false);
      setServerProjectId(cached?.serverProjectId || null);
    }
    setRevision(cached?.revision || 1);
    setActivity(Array.isArray(cached?.activity) ? cached.activity : []);
    setReviewState(cached?.reviewState || { status: 'in_review', history: [] });
    setExtractionWarnings(cached?.extractionWarnings || []);
    setRegPage(1);
    setSelectedRowId(null);
    setRegFilters(Object.fromEntries(FILTER_DEFS.map(f => [f.key, ''])));
  }, [activeProject, projHydrated, readCache, writeCache]);

  // -------------------------------------------------------------------------
  // Server persistence — best-effort, never blocks the UI
  // -------------------------------------------------------------------------
  const persistRows = useCallback(async (nextRows) => {
    writeCache({ rows: nextRows });
    if (!activeProject) return;
    setSaveStatus('Saving…');
    try {
      let pid = serverProjectId;
      if (!pid) {
        const proj = await valveMtoService.createProject({
          projectName: `${activeProject.name || activeProject.code || 'Valve MTO'} — Valve MTO`,
          sourcePdfName: pidDocument?.name || '',
          // Server choices are extracting/completed/failed (migration 0001) —
          // rows already exist by the time we persist, so 'completed' fits.
          status: 'completed',
        });
        pid = proj?.id;
        setServerProjectId(pid || null);
        writeCache({ serverProjectId: pid || null });
      }
      if (pid) {
        // Call-site mapping (valveMtoService.js untouched): reuse its
        // exported mapLocalRowToServer and add the register status onto the
        // server's `operational_status` field so row status round-trips.
        const payload = nextRows.map(r => ({ ...mapLocalRowToServer(r), operational_status: r.status || '' }));
        await apiClient.post(`/valve-mto/projects/${pid}/save-rows/`, { rows: payload });
        setSaveStatus('Saved to server');
        bumpRevision();
        pushActivity('save', `Saved ${nextRows.length} row${nextRows.length === 1 ? '' : 's'} to server`);
      } else {
        setSaveStatus('');
      }
    } catch (e) {
      console.warn('[ValveMTO] server save failed (local cache intact):', e);
      setSaveStatus('Save failed — cached locally');
    } finally {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => setSaveStatus(''), 6000);
    }
  }, [activeProject, pidDocument, serverProjectId, writeCache, bumpRevision, pushActivity]);

  // Row mutations — every mutation flows through updateRows so cache + server
  // persistence happen in exactly one place.
  const updateRows = useCallback((updater) => {
    setRows((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      persistRows(next);
      return next;
    });
  }, [persistRows]);

  // -------------------------------------------------------------------------
  // Project Organizer — load projects + handlers
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!VM_PROJECTS.enabled) { setLoadingProjects(false); return; }
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

  // Single onSubmit handler for ProjectFormModal, used for BOTH create and
  // edit — ProjectFormModal itself doesn't distinguish (it just calls
  // onSubmit(formData) either way, pre-filled from `initial` when editing),
  // so the branch lives here based on whether editingProject is set.
  const handleSaveProject = async (payload) => {
    setProjectBusy(true); setProjectError('');
    try {
      if (editingProject) {
        const p = await projectOrganizerService.updateProject(editingProject.project_id, payload);
        setProjects(prev => prev.map(item => (item.project_id === p.project_id ? p : item)));
        if (activeProject?.project_id === p.project_id) setActiveProject(p);
        setEditingProject(null);
      } else {
        const p = await projectOrganizerService.createProject(payload);
        setProjects(prev => [p, ...prev]);
        setActiveProject(p);
      }
      setShowCreateProject(false);
    } catch (e) {
      setProjectError(e?.response?.data?.error || (editingProject ? 'Failed to update project' : 'Failed to create project'));
    } finally {
      setProjectBusy(false);
    }
  };

  const handleEditProject = (project) => {
    setEditingProject(project);
    setShowCreateProject(true);
  };

  const handleDeleteProject = async (project) => {
    // Same native-confirm pattern already used by ManageProjectsPage.jsx's
    // own project delete; no custom confirm-dialog component exists in
    // this codebase to reuse.
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete project "${project.name}"? This cannot be undone.`)) return;
    try {
      await projectOrganizerService.deleteProject(project.project_id);
      setProjects(prev => prev.filter(p => p.project_id !== project.project_id));
      if (activeProject?.project_id === project.project_id) {
        setActiveProject(null);
      }
    } catch (err) {
      console.error('Delete failed:', err);
      // eslint-disable-next-line no-alert -- same reasoning as above.
      alert('Failed to delete project');
    }
  };

  // Fire-and-forget cross-tool activity log (never blocks extraction UX)
  const logExtractionActivity = (fileName, rowCount) => {
    if (!VM_PROJECTS.enabled || !activeProject) return;
    projectOrganizerService.logProjectActivity(activeProject.project_id, {
      toolCode: VM_PROJECTS.toolCode,
      summary: `Valve MTO extracted from "${fileName}" — ${rowCount} valve${rowCount === 1 ? '' : 's'}`,
      metadata: { file: fileName, valves: rowCount },
    }).catch(() => {});
  };

  // -------------------------------------------------------------------------
  // Elapsed-time ticker + rotating tips (run while processing)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (isProcessing) {
      setElapsedSeconds(0);
      elapsedTimerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    } else {
      clearInterval(elapsedTimerRef.current);
    }
    return () => clearInterval(elapsedTimerRef.current);
  }, [isProcessing]);

  useEffect(() => {
    if (!isProcessing) return;
    const id = setInterval(() => setProcTipIdx(i => (i + 1) % VM_PROC_TIPS.length), VM_PROC_TIP_ROTATE_MS);
    return () => clearInterval(id);
  }, [isProcessing]);

  useEffect(() => () => clearTimeout(pollTimerRef.current), []);

  const formatElapsed = (secs) => (secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`);

  // -------------------------------------------------------------------------
  // File selection
  // -------------------------------------------------------------------------
  const handlePIDSelect = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPidDocument(file);
      setError(null);
      // A new PDF means the Valve Legend stage must be re-earned — don't
      // let a legend activation tied to a PREVIOUS drawing silently
      // carry over.
      setLegendsActivatedFromManager(false);
    } else if (file) {
      setError('Please select a valid PDF file');
    }
  };

  // -------------------------------------------------------------------------
  // PMS Document (Stage 2, optional) — client-side parse
  // -------------------------------------------------------------------------
  const handlePmsSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      const sheetRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
      const parsed = sheetRows
        .map((r) => ({
          code: String(r.PIPING_CLASS ?? r.piping_class ?? '').trim().toUpperCase(),
          pms_class: String(r.PMS_CLASS ?? r.pms_class ?? '').trim(),
          rating: String(r.RATING ?? r.rating ?? '').trim(),
          facing: String(r.FACING ?? r.facing ?? '').trim(),
        }))
        .filter((r) => r.code);
      if (!parsed.length) {
        setError('PMS file has no valid rows — check it has a PIPING_CLASS column with data.');
        return;
      }
      setPmsFile(file);
      setPmsData(parsed);
      setPmsSkipped(false);
      setError(null);
      pushActivity('pms', `PMS document "${file.name}" loaded (${parsed.length} class code${parsed.length === 1 ? '' : 's'})`);
    } catch {
      setError('Could not read PMS file — please provide a valid .xlsx/.xls/.csv file.');
    }
  };

  const handleSkipPms = () => {
    setPmsSkipped(true);
    setPmsFile(null);
    setPmsData([]);
    if (pmsRef.current) pmsRef.current.value = '';
    pushActivity('pms', 'PMS document skipped — Rating/Facing and Piping Material Class will be filled manually');
  };

  // -------------------------------------------------------------------------
  // Polling helper — GET status endpoint until done / error / timeout
  // -------------------------------------------------------------------------
  // usage (optional): { total_input_tokens, total_output_tokens,
  // total_cost_usd, total_cost_aed, model, provider } — forwarded from the
  // job snapshot's own fields (see services.valve_mto_job_store /
  // piping_valve_mto_extractor's COST_PER_1K_TOKENS). Absent/incomplete
  // (e.g. local-mode extraction, or an older job snapshot) falls back to
  // the plain activity text with no token/cost suffix.
  const finishWithRows = useCallback((rawRows, sourceName, warnings = [], usage = null) => {
    const candidates = normalizeRows(rawRows);
    const normalized = renumber(candidates.filter(row => row.type || row.valve_tag));
    const messages = [...warnings];
    if (normalized.length !== candidates.length) {
      messages.push(`Discarded ${candidates.length - normalized.length} entries without a valve type or valve tag. Text fragments are not valve records.`);
    }
    setExtractionWarnings(messages);
    if (!normalized.length) {
      setError('No valve candidates were extracted. Existing register data has not been changed. Check the legend pictures, drawing quality and extraction warnings before retrying.');
      setStatusMessage('No valve candidates extracted.');
      setIsProcessing(false);
      return;
    }
    writeCache({ extractionWarnings: messages });
    setRows(normalized);
    setHasResults(true);
    setProgress(100);
    setStatusMessage('Extraction complete — engineering review required.');
    setIsProcessing(false);
    setRegPage(1);
    setSelectedRowId(null);
    logExtractionActivity(sourceName || 'P&ID', normalized.length);
    bumpRevision();
    let activityText = `Extraction completed from "${sourceName || 'P&ID'}" — ${normalized.length} valves`;
    const hasTokenData = usage && usage.model && ((usage.total_input_tokens || 0) + (usage.total_output_tokens || 0) > 0);
    if (hasTokenData) {
      const inTokens = Number(usage.total_input_tokens || 0).toLocaleString('en-US');
      const outTokens = Number(usage.total_output_tokens || 0).toLocaleString('en-US');
      const costAed = Number(usage.total_cost_aed || 0).toFixed(2);
      activityText += ` · ${usage.model} · Tokens: ${inTokens} in / ${outTokens} out · Cost: ~AED ${costAed}`;
    }
    pushActivity('extraction', activityText);
    persistRows(normalized);
  }, [persistRows, bumpRevision, pushActivity, writeCache]); // eslint-disable-line react-hooks/exhaustive-deps

  const pollStatus = useCallback((jobId) => {
    if (Date.now() - pollStartRef.current > POLL_MAX_WAIT_MS) {
      const waited = Math.round(POLL_MAX_WAIT_MS / 60000);
      setError(`Extraction is taking longer than ${waited} minutes. Please try again or split the P&ID into smaller files.`);
      setIsProcessing(false);
      return;
    }

    apiClient
      .get(VM_ENDPOINTS.status(jobId), { timeout: POLL_REQ_TIMEOUT })
      .then(({ data }) => {
        const state = data.status || data.state;

        if (state === 'done' || state === 'SUCCESS') {
          finishWithRows(data.rows || data.result?.rows || [], pidDocument?.name, data.warnings || data.result?.warnings || [], {
            total_input_tokens: data.total_input_tokens,
            total_output_tokens: data.total_output_tokens,
            total_cost_usd: data.total_cost_usd,
            total_cost_aed: data.total_cost_aed,
            model: data.model,
            provider: data.provider,
          });
        } else if (state === 'error' || state === 'FAILURE') {
          setError(data.error || data.message || 'Extraction failed on the server.');
          setExtractionWarnings(data.warnings || []);
          setStatusMessage('Extraction failed. Existing register data has not been changed.');
          setIsProcessing(false);
        } else {
          // queued / running — update progress from the job snapshot
          const p = data.progress || {};
          const pct = p.total ? Math.min(99, Math.round((p.current / p.total) * 100)) : 5;
          setProgress(pct);
          setStatusMessage(
            p.total
              ? `Processing ${pct}% — ${p.rows ?? 0} valve candidates so far…`
              : (data.message || 'Processing in background…'),
          );
          pollTimerRef.current = setTimeout(() => pollStatus(jobId), POLL_INTERVAL_MS);
        }
      })
      .catch((err) => {
        console.warn('[ValveMTO] poll error (retrying):', err?.message || err);
        // Network blip — retry rather than fail immediately
        pollTimerRef.current = setTimeout(() => pollStatus(jobId), POLL_INTERVAL_MS * 2);
      });
  }, [finishWithRows, pidDocument]);

  // -------------------------------------------------------------------------
  // Submit extraction job — POST multipart → 202 {job_id} → poll
  // -------------------------------------------------------------------------
  // Best-effort rate-limit detection: the backend's test_api_key()
  // (apps.pid_verification.services.piping_valve_mto_extractor) doesn't
  // classify rate-limiting as its own outcome — a 429 from the provider
  // falls through to the same generic "Connection test failed: <exc>"
  // message as any other failure, with valid=False either way. Since
  // only this frontend file is in scope, "valid but rate-limited" can
  // only be inferred from the message text, not a real backend signal.
  const RATE_LIMIT_PATTERN = /rate.?limit|too many requests|429/i;

  const handleTestApiKey = async () => {
    if (!visionApiKey.trim()) {
      setKeyTestResult('empty');
      return;
    }
    if (isTestingKey) return;
    setIsTestingKey(true);
    setKeyTestResult('testing');
    try {
      const result = await valveMtoService.testApiKey(visionProvider, visionApiKey.trim());
      if (result?.valid) {
        setKeyTestResult('valid');
      } else {
        setKeyTestResult(RATE_LIMIT_PATTERN.test(String(result?.message || '')) ? 'rate_limited' : 'invalid');
      }
    } catch (err) {
      const msg = String(err?.response?.data?.message || err?.message || '');
      setKeyTestResult(RATE_LIMIT_PATTERN.test(msg) ? 'rate_limited' : 'invalid');
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleExtract = async () => {
    if (!pidDocument) {
      setError('Please upload a P&ID document first');
      return;
    }
    if (extractionMode === 'vision' && !canUseVision) {
      setError(credentialMode === 'byok'
        ? 'Enter a personal API key and wait for any connection test to finish.'
        : centralAI.loading
        ? 'Checking the selected AI provider configuration. Please wait.'
        : centralAI.error
          ? 'AI configuration could not be checked. Refresh AI status before retrying.'
          : 'The selected AI provider is unavailable. Ask your administrator to enable a valid credential.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setExtractionWarnings([]);
    setProgress(0);
    setStatusMessage('Uploading P&ID…');

    const formData = new FormData();
    formData.append(VM_UPLOAD.fileField, pidDocument);
    formData.append(VM_UPLOAD.scanModeField, scanMode);
    formData.append('extraction_mode', extractionMode);
    if (extractionMode === 'vision') {
      formData.append('vision_provider', visionProvider);
      formData.append('vision_model', visionModel);
      formData.append('vision_credential_mode', credentialMode);
      if (credentialMode === 'byok') {
        formData.append('vision_api_key', visionApiKey.trim());
      }
    }
    // PMS Document (Stage 2, optional) — sent as JSON regardless of
    // engine/provider; the backend overlays it onto the legend-based
    // specification lookup (see apps.valve_mto.specification_lookup).
    if (pmsData.length) {
      formData.append('pms_data', JSON.stringify(pmsData));
    }

    try {
      const { data, status } = await apiClient.post(VM_ENDPOINTS.extract, formData, {
        timeout: UPLOAD_TIMEOUT_MS,
        headers: { 'Content-Type': 'multipart/form-data' },
        sensitiveRequest: extractionMode === 'vision' && credentialMode === 'byok',
      });

      // Synchronous result (defensive — some deployments return rows inline)
      if (status === 200 && (data?.rows || data?.status === 'done')) {
        finishWithRows(data.rows || [], pidDocument.name, data.warnings || [], {
          total_input_tokens: data.total_input_tokens,
          total_output_tokens: data.total_output_tokens,
          total_cost_usd: data.total_cost_usd,
          total_cost_aed: data.total_cost_aed,
          model: data.model,
          provider: data.provider,
        });
        return;
      }

      const jobId = data?.job_id;
      if (!jobId) throw new Error(data?.message || 'Server did not return a job_id. Please try again.');

      setStatusMessage('Processing in background — checking progress…');
      pollStartRef.current = Date.now();
      pollStatus(jobId);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Extraction failed — please try again.';
      setError(msg);
      setIsProcessing(false);
    }
  };

  // -------------------------------------------------------------------------
  // Spreadsheet import — client-side parse via the soft-coded importer
  // -------------------------------------------------------------------------
  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { rows: imported } = await importValveMTOFile(file);
      if (!imported?.length) { setError('Import failed — no valve rows matched the known column headers.'); return; }
      const merged = renumber([...rows, ...imported.map(r => ({ ...r, status: r.status || 'New' }))]);
      setRows(merged);
      setHasResults(true);
      setError(null);
      bumpRevision();
      pushActivity('import', `Imported ${imported.length} rows from "${file.name}"`);
      persistRows(merged);
    } catch {
      setError('Import failed — please provide a .xls / .xlsx / .csv Valve MTO workbook.');
    }
  };

  // -------------------------------------------------------------------------
  // Export — soft-coded exporters (5-sheet template + all-data workbook)
  // -------------------------------------------------------------------------
  const projectMeta = () => {
    const meta = { project_name: activeProject?.name || '' };
    PROJECT_FIELDS.forEach(f => { meta[f.key] = meta[f.key] || ''; });
    return meta;
  };

  const handleExport = () => {
    if (!rows.length) return;
    exportValveMTOWorkbook({ rows, project: projectMeta(), filename: DEFAULT_FILENAME });
    pushActivity('export', `Exported Valve MTO workbook (${rows.length} rows)`);
  };

  const handleExportAllData = () => {
    if (!rows.length) return;
    exportValveMTOAllData({ rows, project: projectMeta(), filename: 'Valve_MTO_All_Data.xlsx' });
    pushActivity('export', `Exported all-data workbook (${rows.length} rows)`);
  };

  const handleServerExport = async () => {
    if (!serverProjectId) return;
    try {
      await valveMtoService.exportXlsx(serverProjectId, DEFAULT_FILENAME);
      pushActivity('export', 'Exported server-side workbook');
    } catch {
      setError('Server export failed — use the local Excel export instead.');
    }
  };

  // -------------------------------------------------------------------------
  // Register — derived data + row handlers
  // -------------------------------------------------------------------------
  const activeTabDef = VM_TABS.find(t => t.id === activeTab) || VM_TABS[0];
  const visibleCols = VM_TABLE_KEYS.map(k => (k === '__secondary__' ? activeTabDef.secondaryCol : k)).filter(isValveColumnVisible).map(k => colByKey[k]);

  // Data-quality helpers (soft-coded VALIDATION_RULES)
  const getRowIssues = useCallback((row) =>
    VALIDATION_RULES.filter(rule => !rule.test(row)).map(rule => ({ key: rule.key, label: rule.label, severity: rule.severity })),
  []);

  // Status pill precedence: Error (any error-severity rule failing) → stored
  // status (New/Changed/Reviewed) → Unchanged.
  const getRowStatus = useCallback((row) => {
    if (getRowIssues(row).some(i => i.severity === 'error')) return 'Error';
    return row.status || 'Unchanged';
  }, [getRowIssues]);

  const filterCtx = { getRowStatus, getRowIssues };

  const filteredRows = rows.filter((r) => {
    if (activeTabDef.areaFilter && allocationTab(r) !== normArea(activeTabDef.areaFilter)) return false;
    for (const f of FILTER_DEFS) {
      const v = regFilters[f.key];
      if (v && !f.match(r, v, filterCtx)) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return ['area', 'valve_tag', 'type', 'pms_class', 'piping_class', 'line_number', 'line_list', 'description', 'remarks']
        .some(k => String(r[k] || '').toLowerCase().includes(q));
    }
    return true;
  });

  // Pagination (soft-coded page size)
  const regPageCount = Math.max(1, Math.ceil(filteredRows.length / REGISTER_CONFIG.pageSize));
  const regSafePage  = Math.min(regPage, regPageCount);
  const regPageRows  = filteredRows.slice((regSafePage - 1) * REGISTER_CONFIG.pageSize, regSafePage * REGISTER_CONFIG.pageSize);

  // Stat-card aggregates
  const allIssues   = rows.map(r => ({ row: r, issues: getRowIssues(r) })).filter(x => x.issues.length);
  const errorCount  = allIssues.filter(x => x.issues.some(i => i.severity === 'error')).length;
  const warnCount   = allIssues.filter(x => !x.issues.some(i => i.severity === 'error')).length;
  const changedCount = rows.filter(r => r.status === 'Changed').length;
  const reviewPending = reviewState.status === 'in_review' ? 1 : 0;

  const totals = filteredRows.reduce(
    (acc, r) => ({
      island: acc.island + (Number(r.qty_island) || 0),
      field:  acc.field  + (Number(r.qty_field)  || 0),
    }),
    { island: 0, field: 0 },
  );

  const setFilter = (key, value) => { setRegFilters(prev => ({ ...prev, [key]: value })); setRegPage(1); };

  // Inline edit — local state updates per keystroke (marks row Changed);
  // persistence + activity fire once when the editor closes (blur/Enter).
  const handleCellChange = (rowId, key, value) => {
    setRows(prev => prev.map(r => (r.id === rowId ? {
      ...r, [key]: value,
      ...(key === 'line_number' && !r.size_1 ? { size_1: sizeNBFromLineNumber(value) } : {}),
      status: r.status === 'Reviewed' ? 'Changed' : (r.status === 'Unchanged' || !r.status ? 'Changed' : r.status),
    } : r)));
  };

  const commitEdit = () => {
    if (!editCell) return;
    setEditCell(null);
    persistRows(rows);
    pushActivity('row_edited', 'Row edited');
  };

  // Side panel fields are always editable the moment the panel is open —
  // each field writes straight into `rows` via the SAME handleCellChange
  // the inline table-cell editor uses (so the table reflects every
  // keystroke immediately too, same as that editor); "Save Changes" just
  // persists the current `rows` to the server, mirroring commitEdit.
  const handleSavePanelChanges = () => {
    persistRows(rows);
    pushActivity('row_edited', 'Row edited via details panel');
  };

  const handleMarkReviewed = (rowId) => {
    updateRows(prev => prev.map(r => (r.id === rowId ? { ...r, status: 'Reviewed' } : r)));
    pushActivity('review', 'Row marked as Reviewed');
  };

  // Engineering review workflow actions (soft-coded WORKFLOW_STATES)
  const applyReviewAction = (action) => {
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const entry = { action, comment: reviewComment, at: stamp, by: 'Piping Engineer' };
    const next = {
      status: action === 'reset' ? 'in_review' : action,
      history: [entry, ...(reviewState.history || [])],
    };
    setReviewState(next);
    writeCache({ reviewState: next });
    if (action === 'approved') {
      updateRows(prev => prev.map(r => ({ ...r, status: 'Reviewed' })));
    }
    pushActivity('review', `Register ${WORKFLOW_STATES[next.status]?.label || next.status}${reviewComment ? ` — "${reviewComment}"` : ''}`);
    setReviewComment('');
  };

  const handleAddRow = () => {
    const row = { ...DEFAULT_ROW(), status: 'New' };
    row.sl_no = rows.length + 1;
    if (activeTabDef.areaFilter) row.tab = normArea(activeTabDef.areaFilter);
    updateRows(prev => [...prev, row]);
    setHasResults(true);
    setSelectedRowId(row.id);
    setMainTab('register');
    pushActivity('row_added', `Row ${row.sl_no} added manually`);
  };

  const handleDeleteRow = (rowId) => {
    const target = rows.find(r => r.id === rowId);
    updateRows(prev => renumber(prev.filter(r => r.id !== rowId)));
    if (selectedRowId === rowId) setSelectedRowId(null);
    pushActivity('row_deleted', `Row deleted${target?.valve_tag ? `: ${target.valve_tag}` : ''}`);
  };

  const handleNewExtraction = () => {
    setPidDocument(null);
    setError(null);
    setProgress(0);
    setStatusMessage('');
    if (pidRef.current) pidRef.current.value = '';
  };

  const handleClearRows = () => {
    updateRows([]);
    setHasResults(false);
    setSelectedRowId(null);
    setSearch('');
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  // ── PROJECT GATE — V1-style workspace: select/create a project first ─────
  if (VM_PROJECTS.enabled && (!projHydrated || loadingProjects)) {
    return <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f8faff 0%, #eef2ff 45%, #f0f9ff 75%, #fffbeb 100%)' }} />;
  }

  if (VM_PROJECTS.enabled && !activeProject) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f8faff 0%, #eef2ff 45%, #f0f9ff 75%, #fffbeb 100%)', padding: '32px 24px' }}>
        <div className="w-full" style={{ maxWidth: 1400, margin: '0 auto' }}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)', boxShadow: '0 4px 14px rgba(59,130,246,0.3)' }}>
              <TableCellsIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900" style={{ margin: 0 }}>Valve MTO — Project Workspace</h1>
              <p className="text-sm text-slate-500" style={{ margin: 0 }}>Select or create a project to organise your valve material take-offs.</p>
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
              <p className="text-sm text-slate-500 mt-1">Create your first project to start extracting valve MTOs.</p>
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
              {projects.map(p => (
                <ProjectCard key={p.project_id} project={p} theme={VM_PROJECTS.theme}
                  onOpen={() => setActiveProject(p)}
                  onEdit={() => handleEditProject(p)}
                  onDelete={() => handleDeleteProject(p)} />
              ))}
            </div>
          )}

          {(showCreateProject || editingProject) && (
            <ProjectFormModal theme={VM_PROJECTS.theme} busy={projectBusy} initial={editingProject}
              onClose={() => { setShowCreateProject(false); setEditingProject(null); }}
              onSubmit={handleSaveProject} />
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes vm-fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes vm-scan-line {
          0%   { top: 0%;   opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes vm-float {
          0%, 100% { transform: translateY(0)    scale(1);   opacity: 0.15; }
          50%       { transform: translateY(-20px) scale(1.2); opacity: 0.38; }
        }
        @keyframes vm-glow {
          0%, 100% { box-shadow: 0 0 7px  rgba(37,99,235,0.2); }
          50%       { box-shadow: 0 0 20px rgba(37,99,235,0.42), 0 0 40px rgba(37,99,235,0.1); }
        }
        @keyframes vm-row-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes vm-fs-in {
          from { opacity: 0; transform: scale(0.98); }
          to   { opacity: 1; transform: scale(1); }
        }
        .vm-section { animation: vm-fade-up 0.5s ease both; }
        .vm-fullscreen-wrap {
          position: fixed; inset: 0; z-index: 9990;
          overflow-y: auto;
          animation: vm-fs-in 0.2s ease both;
        }
        .vm-scan-line {
          position: absolute; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent, rgba(37,99,235,0.4), transparent);
          animation: vm-scan-line 3.2s ease-in-out infinite;
          pointer-events: none;
        }
        .vm-particle {
          position: absolute; border-radius: 50%;
          background: rgba(37,99,235,0.28);
          animation: vm-float ease-in-out infinite;
        }
        .vm-row-animate { animation: vm-row-in 0.3s ease forwards; }
      `}</style>

      {/* Light blue/indigo gradient page — wraps in fixed overlay when fullscreen */}
      <div
        className={`min-h-screen relative overflow-x-hidden${isFullscreen ? ' vm-fullscreen-wrap' : ''}`}
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
            <div key={i} className="vm-particle" style={{
              left: p.l, top: p.t, width: p.s, height: p.s,
              animationDelay: p.d, animationDuration: p.dur,
            }} />
          ))}
        </div>

        <div
          className="relative z-10"
          style={{
            maxWidth: isFullscreen ? LAYOUT_CONFIG.fullscreenMaxWidth : LAYOUT_CONFIG.normalMaxWidth,
            padding:  `${isFullscreen ? LAYOUT_CONFIG.fullscreenPaddingY : LAYOUT_CONFIG.normalPaddingY} ${isFullscreen ? LAYOUT_CONFIG.fullscreenPaddingX : LAYOUT_CONFIG.normalPaddingX}`,
          }}
        >
          {/* ── Page Header — V1-style light card (soft-coded) ── */}
          <div className="mb-8 vm-section" style={{ animationDelay: '0s' }}>
          {VM_HEADER_STYLE === 'v1' && (
            <div className="rounded-2xl" style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.03) 0%, rgba(99,102,241,0.06) 100%)',
              border: '1px solid #e2e8f0',
              padding: '32px',
            }}>
              <div className="flex items-center justify-between gap-6 flex-wrap">
                {/* Left: breadcrumb + Icon + Title + Description + feature pills */}
                <div className="flex items-start gap-5" style={{ flex: '1 1 0', minWidth: 320 }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '14px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                    boxShadow: '0 4px 14px rgba(59,130,246,0.3)',
                  }}>
                    <TableCellsIcon className="h-5 w-5 text-white" />
                  </div>

                  <div className="flex-1" style={{ minWidth: 0 }}>
                    {/* Breadcrumb — template-aligned (small, above title) */}
                    <div className="flex items-center gap-2 mb-1 text-xs" style={{ color: '#94a3b8' }}>
                      <span className="font-semibold text-slate-500">{REGISTER_CONFIG.breadcrumbRoot}</span>
                      <span>/</span>
                      <span className="font-semibold text-slate-600">{activeProject?.name || activeProject?.code || 'Workspace'}</span>
                    </div>
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight" style={{ margin: 0, lineHeight: 1.2 }}>
                        {VM_HEADER.title}
                      </h1>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
                        background: `${VM_HEADER.badgeColor}15`, color: VM_HEADER.badgeColor,
                        border: `1px solid ${VM_HEADER.badgeColor}30`,
                      }}>
                        <CheckCircleIcon className="h-3.5 w-3.5" />
                        {VM_HEADER.badgeText}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.95rem', color: '#64748b', margin: 0, maxWidth: '680px', lineHeight: 1.6 }}>
                      {VM_HEADER.subtitle}
                    </p>

                    {/* Feature pills — V1 colour-coded */}
                    <div className="flex flex-wrap gap-2 mt-4">
                      {VM_HEADER.featureBadges.map((b) => (
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

                {/* Right: register meta line + actions + quick stats — template-aligned */}
                <div className="flex flex-col items-end gap-3 flex-wrap" style={{ flex: '0 1 auto', maxWidth: 460 }}>
                  {/* Register meta (template's top-right meta line) */}
                  <div className="flex items-center gap-2 text-xs flex-wrap justify-end" style={{ color: '#94a3b8' }}>
                    <span>Register: <b className="text-slate-700">{REGISTER_CONFIG.registerPrefix}-{String(activeProject?.code || '001').slice(0, 8).toUpperCase()}</b></span>
                    <span className="text-slate-300">|</span>
                    <span>Rev: <b className="text-slate-700">{String(revision).padStart(REGISTER_CONFIG.revisionPad, '0')}</b></span>
                    <span className="text-slate-300">|</span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center',
                      padding: '2px 10px', borderRadius: '20px', fontSize: '0.68rem', fontWeight: 700,
                      background: `${WORKFLOW_STATES[reviewState.status]?.badgeColor}15`,
                      color: WORKFLOW_STATES[reviewState.status]?.badgeColor,
                      border: `1px solid ${WORKFLOW_STATES[reviewState.status]?.badgeColor}30`,
                    }}>
                      {WORKFLOW_STATES[reviewState.status]?.label || 'In Review'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {VM_PROJECTS.enabled && activeProject && (
                      <button onClick={() => setActiveProject(null)}
                        title="Switch project"
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-all">
                        <FolderIcon className="h-4 w-4" />
                        <span>{activeProject.name || activeProject.code}</span>
                        <span className="text-blue-400">·</span>
                        <span className="text-blue-500">Switch</span>
                      </button>
                    )}
                    {VM_LEGENDS.enabled && (
                      <button
                        onClick={openLegendModal}
                        title="Manage legend sheets"
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 shadow-sm transition-all"
                      >
                        <BookOpenIcon className="h-4 w-4" /> Manage Legends
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
                  </div>

                  <div className="flex gap-6">
                    <div className="text-center">
                      <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#3b82f6', lineHeight: 1 }}>{visibleCols.length}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Columns</div>
                    </div>
                    <div className="text-center">
                      <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#10b981', lineHeight: 1 }}>{VM_TABS.length}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Views</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>

          {/* ── Error banner ── */}
          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm flex items-start gap-3 vm-section" role="alert"
              style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', animationDelay: '0.04s' }}>
              <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          )}
          {!!extractionWarnings.length && (
            <div role="status" className="mb-4 px-4 py-3 rounded-xl text-sm flex items-center justify-between gap-4 flex-wrap"
              style={{ border: '1px solid #fde68a', background: '#fffbeb', color: '#92400e' }}>
              <div>
                <strong>Engineering review required</strong>
                <p className="text-xs mt-1">{extractionReview.rowsWithGaps} of {rows.length} rows have field gaps.
                  {' '}{extractionReview.groups.length} finding categories. Counts are not approved for procurement.</p>
              </div>
              <a href="#valve-mto-register" onClick={() => setMainTab('extraction')}
                className="rounded-lg bg-white border border-amber-200 px-4 py-2 text-xs font-bold text-amber-900">
                Open extraction summary
              </a>
            </div>
          )}

          {/* ═══ UPLOAD / PROCESSING SECTION ═══ */}
          <div className="rounded-2xl p-6 mb-6 vm-section" style={{
            background: 'white',
            border: '1px solid rgba(59,130,246,0.14)',
            boxShadow: '0 4px 24px rgba(59,130,246,0.06)',
            animationDelay: '0.08s',
          }}>
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <div className="flex items-center gap-2.5">
                <CloudArrowUpIcon className="h-5 w-5 text-blue-600" />
                <h2 className="text-base font-bold text-slate-900" style={{ margin: 0 }}>Upload P&amp;ID &amp; Extract Valves</h2>
              </div>
              {saveStatus && (
                <span className="text-xs font-semibold" style={{ color: saveStatus.startsWith('Saved') ? '#047857' : '#b45309' }}>
                  {saveStatus}
                </span>
              )}
            </div>

            {/* ── Stage 1 · Upload P&ID Drawing (PDF) — always unlocked ── */}
            <VmStageHeading stage={VM_STAGE_FLOW[0]} unlocked complete={vmStageVerified.upload} colourClass="bg-blue-100 text-blue-700" />
            <VmStageInstruction stage={VM_STAGE_FLOW[0]} />
            <div
              className="relative rounded-xl cursor-pointer overflow-hidden mb-3"
              style={{
                border: pidDocument ? '2px solid rgba(37,99,235,0.45)' : '2px dashed rgba(37,99,235,0.22)',
                background: pidDocument ? 'rgba(37,99,235,0.04)' : 'rgba(37,99,235,0.015)',
                minHeight: 136,
                transition: 'border-color 0.3s, background 0.3s',
                pointerEvents: isProcessing ? 'none' : 'auto',
                opacity: isProcessing ? 0.6 : 1,
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
              {!pidDocument && !isProcessing && <div className="vm-scan-line" />}
              <input ref={pidRef} type="file" accept={VM_UPLOAD.acceptedExt} onChange={handlePIDSelect} className="hidden" />
              <div className="flex flex-col items-center justify-center gap-3 py-8 px-6">
                {pidDocument ? (
                  <>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{
                      background: 'rgba(37,99,235,0.09)',
                      border: '2px solid rgba(37,99,235,0.32)',
                      animation: 'vm-glow 2.2s ease infinite',
                    }}>
                      <CheckCircleIcon className="h-7 w-7 text-blue-600" />
                    </div>
                    <div className="text-center">
                      <p className="text-slate-800 font-medium text-sm">{pidDocument.name}</p>
                      <p className="text-slate-400 text-xs mt-1">
                        {(pidDocument.size / 1024 / 1024).toFixed(2)} MB · Ready for extraction
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="px-3 py-1 rounded-full text-xs font-semibold text-blue-700" style={{
                        background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.18)',
                      }}>✓ PDF Loaded</div>
                      <button type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPidDocument(null);
                          if (pidRef.current) pidRef.current.value = '';
                        }}
                        disabled={isProcessing}
                        className="px-3 py-1 rounded-full text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                        style={{ border: '1px solid rgba(239,68,68,0.3)', background: 'white' }}>
                        ✕ Remove
                      </button>
                    </div>
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
                      <p className="text-slate-400 text-xs mt-1">Single and multi-page PDFs supported</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── Stage 2 · PMS Document (gated, optional) — Excel/CSV
                parsed entirely client-side (SheetJS); fills Rating/Facing
                and Piping Material Class columns during extraction, or is
                explicitly skipped. ── */}
            {!VM_STAGE_FLOW[1].isUnlocked(stageFlowState) ? (
              <VmStageGate stage={VM_STAGE_FLOW[1]} />
            ) : (
            <>
            <VmStageHeading stage={VM_STAGE_FLOW[1]} unlocked complete={vmStageVerified.pms} colourClass="bg-amber-100 text-amber-700" />
            <VmStageInstruction stage={VM_STAGE_FLOW[1]} />
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <button type="button" onClick={handleSkipPms} disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors">
                Skip — I&apos;ll fill manually later →
              </button>
            </div>
            <div
              className="relative rounded-xl cursor-pointer overflow-hidden mb-3"
              style={{
                border: pmsFile ? '2px solid rgba(217,119,6,0.45)' : '2px dashed rgba(217,119,6,0.25)',
                background: pmsFile ? 'rgba(217,119,6,0.04)' : 'rgba(217,119,6,0.02)',
                minHeight: 92,
                transition: 'border-color 0.3s, background 0.3s',
                pointerEvents: isProcessing ? 'none' : 'auto',
                opacity: isProcessing ? 0.6 : 1,
              }}
              onClick={() => !isProcessing && pmsRef.current?.click()}
            >
              <input ref={pmsRef} type="file" accept={VM_PMS_UPLOAD.acceptedExt} onChange={handlePmsSelect} className="hidden" />
              <div className="flex flex-col items-center justify-center gap-2 py-6 px-6">
                {pmsFile ? (
                  <>
                    <CheckCircleIcon className="h-6 w-6 text-amber-600" />
                    <div className="text-center">
                      <p className="text-slate-800 font-medium text-sm">{pmsFile.name}</p>
                      <p className="text-slate-400 text-xs mt-1">
                        {(pmsFile.size / 1024 / 1024).toFixed(2)} MB · {pmsData.length} class code{pmsData.length === 1 ? '' : 's'} loaded
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="px-3 py-1 rounded-full text-xs font-semibold text-emerald-700" style={{
                        background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                      }}>✓ PMS Loaded</div>
                      <button type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPmsFile(null);
                          setPmsData([]);
                          setPmsSkipped(false);
                          if (pmsRef.current) pmsRef.current.value = '';
                        }}
                        disabled={isProcessing}
                        className="px-3 py-1 rounded-full text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                        style={{ border: '1px solid rgba(239,68,68,0.3)', background: 'white' }}>
                        ✕ Remove
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <ArrowUpTrayIcon className="h-6 w-6 text-amber-400" />
                    <p className="text-slate-600 font-medium text-sm">Drop PMS Excel here or click to browse</p>
                  </>
                )}
              </div>
            </div>
            {pmsSkipped && !pmsFile && (
              <div className="mb-3 px-3 py-2 rounded-lg text-xs font-medium text-amber-700" style={{
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
              }}>
                ⚠ Rating/Facing and Piping Material Class columns will be empty
              </div>
            )}
            </>
            )}

            {/* ── Stage 3 · RADAI AI Engine (gated) — Local OCR option
                removed; RADAI AI Engine (AI Vision under the hood) is the
                only engine now, so extractionMode is always 'vision' and
                there's no choice to make — straight into the API key
                section. ── */}
            {!VM_STAGE_FLOW[2].isUnlocked(stageFlowState) ? (
              <VmStageGate stage={VM_STAGE_FLOW[2]} />
            ) : (
            <>
            <VmStageHeading stage={VM_STAGE_FLOW[2]} unlocked complete={vmStageVerified.engine} colourClass="bg-cyan-100 text-cyan-700" />
            <VmStageInstruction
              stage={VM_STAGE_FLOW[2]}
              actions={[{ label: 'Raise a ticket with ICT', route: VM_ICT_ROUTE }]}
            />
            <div className="mb-4 space-y-2">
              <label className="block text-xs font-semibold text-slate-600">
                AI Provider
                <select value={visionProvider} onChange={event => {
                  const nextProvider = event.target.value;
                  setVisionProvider(nextProvider);
                  setVisionModel(VM_VISION_MODEL_DEFAULTS[nextProvider] || '');
                  setVisionApiKey('');
                  setKeyTestResult(null);
                }}
                  disabled={isProcessing || isTestingKey} className="block mt-1 p-2 border border-slate-200 rounded-lg bg-white">
                  {VM_VISION_PROVIDERS.map(provider => (
                    <option key={provider.id} value={provider.id}>{provider.label}</option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-semibold text-slate-600">
                AI Model
                <select value={visionModel} onChange={event => setVisionModel(event.target.value)}
                  disabled={isProcessing || isTestingKey} className="block mt-1 p-2 border border-slate-200 rounded-lg bg-white">
                  {(VM_VISION_MODELS[visionProvider] || []).map(model => (
                    <option key={model.id} value={model.id}>{model.label}</option>
                  ))}
                </select>
              </label>

              <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                <label className="block text-xs font-semibold text-slate-600">
                  Personal API key
                  <input type="password" value={visionApiKey} autoComplete="off"
                    disabled={isProcessing || isTestingKey}
                    onChange={event => { setVisionApiKey(event.target.value); setKeyTestResult(null); }}
                    className="block mt-1 w-full p-2 border border-slate-200 rounded-lg bg-white" />
                </label>
                <p className="text-xs text-slate-500">
                  Your key is kept in memory for this page only and is cleared on reload or provider changes.
                </p>
                <button type="button" onClick={handleTestApiKey}
                  disabled={isProcessing || isTestingKey}
                  className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold disabled:opacity-50">
                  {isTestingKey ? 'Testing key...' : 'Test API key'}
                </button>
                {(() => {
                  const KEY_TEST_DISPLAY = {
                    empty:        { icon: '⚠️', text: 'Please enter an API key first', cls: 'text-amber-600' },
                    testing:      { icon: '🔄', text: 'Testing connection...', cls: 'text-slate-500' },
                    valid:        { icon: '✅', text: 'Connected — API key is valid', cls: 'text-emerald-700' },
                    invalid:      { icon: '❌', text: 'Invalid API key — please check and try again', cls: 'text-red-700' },
                    rate_limited: { icon: '⚠️', text: 'API key valid but rate limited — try again shortly', cls: 'text-amber-600' },
                  };
                  const state = KEY_TEST_DISPLAY[keyTestResult] || { icon: '○', text: 'Not tested yet', cls: 'text-slate-400' };
                  return (
                    <p role="status" className={`text-xs font-medium flex items-center gap-1.5 ${state.cls}`}>
                      <span className={keyTestResult === 'testing' ? 'inline-block animate-spin' : 'inline-block'}>{state.icon}</span>
                      {state.text}
                    </p>
                  );
                })()}
              </div>
              <p className="text-xs text-slate-500">
                RADAI AI Engine sends drawing images and active Legend Manager text and symbol pictures to the selected provider.
                Reference pictures guide classification and are not valves to count.
                Testing a key sends only a short synthetic prompt and may incur a small provider charge.
                AI results still require engineering review.
              </p>

              {/* ── Scan Mode — shown once a key has tested valid. ── */}
              {engineComplete && (
                <>
                  <VmStageInstruction instruction={VM_SCANMODE_INSTRUCTION} />
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setScanMode('quick')}
                        disabled={isProcessing}
                        className={`px-3 py-1.5 text-xs font-semibold ${scanMode === 'quick' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                      >
                        Quick Scan
                      </button>
                      <button
                        type="button"
                        onClick={() => setScanMode('thorough')}
                        disabled={isProcessing}
                        className={`px-3 py-1.5 text-xs font-semibold border-l border-slate-300 ${scanMode === 'thorough' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                      >
                        Thorough Scan
                      </button>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {scanMode === 'quick'
                        ? '~1 API call/page — fast, lower cost'
                        : '~up to 8 API calls/page (tiled) — slower, more accurate on dense or rotated drawings'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Default: Thorough Scan.</p>
                </>
              )}
            </div>
            </>
            )}

            {/* ── Stage 4 · Valve Legend (gated, required — no skip option) ── */}
            {!VM_STAGE_FLOW[3].isUnlocked(stageFlowState) ? (
              <VmStageGate stage={VM_STAGE_FLOW[3]} />
            ) : (
            <>
            <VmStageHeading stage={VM_STAGE_FLOW[3]} unlocked complete={vmStageVerified.legend} colourClass="bg-indigo-100 text-indigo-700" />
            <VmStageInstruction
              stage={VM_STAGE_FLOW[3]}
              actions={[
                {
                  label: 'Activate Legends',
                  onClick: () => {
                    // Set BEFORE navigating — this is plain module memory
                    // (VM_SESSION_CACHE), not sessionStorage, so it's still
                    // there, untouched, when this component remounts after
                    // the round-trip; consumed by checkLegendManagerReturn.
                    VM_SESSION_CACHE.navigatingToLegends = true;
                    navigate(VM_LEGEND_MANAGER_ROUTE);
                  },
                },
                { label: 'Raise a Request (ICT)', route: VM_ICT_ROUTE },
              ]}
            />
            {/* Active legend status — the backend extractor injects the user's
                ACTIVE ValveMTOLegend per section into the Vision prompt
                server-side (no request parameter needed), so we just surface
                what's active. Uses Valve MTO's OWN legend table — activation
                here never affects P&ID Verification V1/V2. */}
            {VM_LEGENDS.enabled && (
              <div className="flex items-center gap-2 mb-2 text-xs flex-wrap" style={{ color: '#64748b' }}>
                <BookOpenIcon className="h-4 w-4 text-blue-500" />
                <span className="font-semibold text-slate-600">Active legends:</span>
                {VM_LEGENDS.sections.filter(s => activeLegends[s]).length === 0 ? (
                  <span className="italic text-slate-400">none yet — activate a valve legend workbook to continue</span>
                ) : (
                  VM_LEGENDS.sections.filter(s => activeLegends[s]).map(s => (
                    <span key={s} className="px-2 py-0.5 rounded-full font-medium"
                      style={{ background: 'rgba(59,130,246,0.07)', color: '#1d4ed8', border: '1px solid rgba(59,130,246,0.18)' }}
                      title={s}>
                      {activeLegends[s].name}
                    </span>
                  ))
                )}
              </div>
            )}
            </>
            )}

            {/* ── Submit gate checklist — same role as Instrument Index's
                II_SUBMIT_GATE checklist ── */}
            {!vmAllStagesVerified && (
              <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 mb-3 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Verify each step to enable extraction:
                </p>
                <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {VM_SUBMIT_GATE_STAGES.map(s => (
                    <li key={s.id} className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${vmStageVerified[s.id] ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {vmStageVerified[s.id]
                        ? <CheckCircleIcon className="h-3.5 w-3.5" />
                        : <span className="inline-block h-3.5 w-3.5 rounded-full border border-slate-300" />}
                      {s.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action row */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handleExtract}
                disabled={!pidDocument || isProcessing || !vmAllStagesVerified || isTestingKey}
                title={!vmAllStagesVerified ? 'Verify each step above before extracting.' : ''}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white rounded-xl transition-all"
                style={!pidDocument || isProcessing || !vmAllStagesVerified ? {
                  background: '#cbd5e1', cursor: 'not-allowed', border: 'none',
                } : {
                  background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                  boxShadow: '0 4px 14px rgba(59,130,246,0.35)',
                  border: 'none', cursor: 'pointer',
                }}
              >
                {isProcessing ? 'Extracting…' : 'Start Extraction'}
              </button>

              <button
                onClick={() => importRef.current?.click()}
                disabled={isProcessing}
                className="inline-flex items-center gap-2 px-4 py-3 text-xs font-semibold rounded-xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 shadow-sm transition-all"
              >
                <ArrowUpTrayIcon className="h-4 w-4" /> Import .xls / .xlsx / .csv
              </button>
              <input ref={importRef} type="file" accept=".xls,.xlsx,.csv" onChange={handleImport} className="hidden" />

              {hasResults && (
                <>
                  <button onClick={handleExport}
                    className="inline-flex items-center gap-2 px-4 py-3 text-xs font-semibold rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-all">
                    <ArrowDownTrayIcon className="h-4 w-4" /> Download Valve MTO
                  </button>
                  <button onClick={handleExportAllData}
                    className="inline-flex items-center gap-2 px-4 py-3 text-xs font-semibold rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 transition-all">
                    <ArrowDownTrayIcon className="h-4 w-4" /> Download All Data
                  </button>
                  {serverProjectId && (
                    <button onClick={handleServerExport}
                      className="inline-flex items-center gap-2 px-4 py-3 text-xs font-semibold rounded-xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 transition-all">
                      <ArrowDownTrayIcon className="h-4 w-4" /> Server Export
                    </button>
                  )}
                </>
              )}
            </div>

            {/* ── Help panel (empty state) — same style as Instrument Index's
                own "About Instrument Index Extraction" panel. Hidden once
                there are results, same as Instrument Index hides its own
                panel once `result` exists. Ordered AFTER the Action row
                (buttons) per explicit request — Steps → checklist →
                buttons → About. ── */}
            {!hasResults && !isProcessing && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-6 mt-5">
                <h3 className="text-lg font-semibold text-purple-900 mb-3">
                  ℹ️ About Valve MTO Extraction
                </h3>
                <ul className="space-y-2 text-purple-800 text-sm">
                  {[
                    ['P&ID Upload Only', 'Upload the P&ID in PDF format — single page or multi-page drawings.'],
                    ['RADAI AI Engine', 'Uses AI to accurately extract Gate, Globe, Ball, Check, Butterfly, Control Valves, PSVs, MOVs, SDVs, BDVs and more. Requires your personal API key.'],
                    ['PMS Document (optional)', 'Upload your Piping Material Specification Excel to auto-fill Rating/Facing and Piping Material Class columns. Download the template from Stage 2.'],
                    ['Tag Number Recognition', 'Motor operated and control valves with tags are automatically read — e.g. MOV-2002, SDV-101, PSV-186.'],
                    ['Piping Class Auto-fill', 'Piping material class extracted from line number — e.g. 6-PL-DC3N-8166-P → DC3N.'],
                    ['Register Output', 'Results shown in valve register with ISLAND/FIELD/COMBINED tabs, validation and review workflow.'],
                    ['Excel Export', 'Two download options — standard MTO workbook (customer format) or full data export with all fields including confidence and location.'],
                    ['Legend Required', 'Visit Legend Manager, activate a valve legend and return to Valve MTO — Start Extraction stays disabled until this step is completed.'],
                  ].map(([title, desc]) => (
                    <li key={title} className="flex items-start gap-2">
                      <span className="font-bold text-purple-600 mt-0.5">•</span>
                      <span><strong>{title}:</strong> {desc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Processing progress — mirrors LineList's processing card */}
            {isProcessing && (
              <div className="mt-5 rounded-xl p-5" style={{
                background: 'linear-gradient(135deg, rgba(59,130,246,0.04) 0%, rgba(99,102,241,0.07) 100%)',
                border: '1px solid rgba(59,130,246,0.18)',
              }}>
                <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-800" style={{ margin: 0 }}>{statusMessage || 'Processing…'}</p>
                  <span className="text-xs font-bold text-blue-700 tabular-nums">{progress}% · {formatElapsed(elapsedSeconds)}</span>
                </div>
                <div className="w-full rounded-full overflow-hidden" style={{ height: 8, background: 'rgba(59,130,246,0.12)' }}>
                  <div style={{
                    width: `${progress}%`, height: '100%',
                    background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                <p className="text-xs text-slate-500 mt-3" style={{ margin: '0.75rem 0 0' }}>
                  {VM_PROC_TIPS[procTipIdx]}
                </p>
              </div>
            )}
          </div>

          {/* ═══ RESULTS — Enterprise Valve MTO Register (template-aligned) ═══
              BUG FIX: used to always render once a project was open, even with
              0 rows, showing an empty table before any extraction/import ever
              ran. Now only renders once there's actual data (hasResults is set
              true by extraction completion, import, or a hydrated cache — see
              setHasResults call sites). */}
          {!isProcessing && hasResults && (
            <div id="valve-mto-register" className="rounded-2xl p-6 vm-section" style={{
              background: 'white',
              border: '1px solid rgba(15,118,110,0.16)',
              boxShadow: '0 4px 24px rgba(15,118,110,0.05)',
              animationDelay: '0.12s',
            }}>
              {/* Main tabs — Register / Validation / Reviews / Activity */}
              <div className="flex items-center gap-6 mb-5" style={{ borderBottom: '1px solid #e2e8f0' }}>
                {REGISTER_CONFIG.mainTabs.map(t => (
                  <button key={t.id} onClick={() => setMainTab(t.id)}
                    className="pb-2.5 text-sm font-semibold transition-all"
                    style={mainTab === t.id ? {
                      color: '#0f766e', background: 'none', cursor: 'pointer',
                      borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: '2px solid #0f766e',
                    } : {
                      color: '#64748b', background: 'none', cursor: 'pointer',
                      borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: '2px solid transparent',
                    }}>
                    {t.label}
                    {t.id === 'validation' && errorCount > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ background: 'rgba(239,68,68,0.12)', color: '#b91c1c' }}>{errorCount}</span>
                    )}
                  </button>
                ))}
              </div>

              {mainTab === 'extraction' && (
                <ValveMTOExtractionReview review={extractionReview}
                  onOpenLegends={() => setLegendModalOpen(true)}
                  onOpenValidation={() => setMainTab('validation')} />
              )}

              {/* ── REGISTER TAB ── */}
              {mainTab === 'register' && (
                <div className="flex gap-5 items-start">
                  {/* Left: stats + filters + table */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Stat cards */}
                    <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                      {[
                        { label: 'Total items',    value: rows.length,   color: '#0f766e', icon: '📋' },
                        { label: 'Changed',        value: changedCount,  color: '#b45309', icon: '📝' },
                        { label: 'Errors',         value: errorCount,    color: '#b91c1c', icon: '⛔' },
                        { label: 'Warnings',       value: warnCount,     color: '#b45309', icon: '⚠️' },
                        { label: 'Review pending', value: reviewPending, color: '#1d4ed8', icon: '🕐' },
                      ].map(s => (
                        <div key={s.label} className="rounded-xl px-4 py-3 flex items-center gap-3"
                          style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: '1.1rem' }}>{s.icon}</span>
                          <div>
                            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 2 }}>{s.label}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Filter bar (soft-coded FILTER_DEFS) + actions */}
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                      <div className="relative">
                        <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          value={search}
                          onChange={(e) => { setSearch(e.target.value); setRegPage(1); }}
                          placeholder="Search valve tags, types, classes…"
                          className="pl-9 pr-8 py-2 text-xs rounded-xl outline-none"
                          style={{ border: '1px solid #e2e8f0', width: 240, background: '#f8fafc', color: '#334155' }}
                        />
                        {search && (
                          <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <XMarkIcon className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {FILTER_DEFS.map(f => (
                        <select key={f.key} value={regFilters[f.key]} onChange={(e) => setFilter(f.key, e.target.value)}
                          className="px-3 py-2 text-xs rounded-xl outline-none font-medium"
                          style={{ border: '1px solid #e2e8f0', background: regFilters[f.key] ? '#eff6ff' : 'white', color: '#334155' }}>
                          <option value="">{f.label}</option>
                          {f.options(rows).map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ))}
                      <div className="flex items-center gap-2 ml-auto flex-wrap">
                        <button onClick={handleAddRow}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-all">
                          <PlusIcon className="h-4 w-4" /> Add Row
                        </button>
                        <button onClick={handleNewExtraction}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 transition-all">
                          <CloudArrowUpIcon className="h-4 w-4" /> New Extraction
                        </button>
                        <button onClick={handleClearRows}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-all">
                          <TrashIcon className="h-4 w-4" /> Clear
                        </button>
                      </div>
                    </div>

                    {/* Area sub-tabs — ALL / ISLAND / FIELD / COMBINED */}
                    <div className="flex gap-1 mb-4 p-1 rounded-xl w-fit" style={{ background: '#f1f5f9', border: '1px solid #e2e8f0' }}>
                      {VM_TABS.map(t => (
                        <button key={t.id} onClick={() => { setActiveTab(t.id); setRegPage(1); }}
                          className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
                          style={activeTab === t.id ? {
                            background: 'white', color: '#0f766e',
                            boxShadow: '0 1px 4px rgba(15,118,110,0.15)',
                            border: '1px solid rgba(15,118,110,0.2)',
                          } : {
                            background: 'transparent', color: '#64748b', border: '1px solid transparent',
                          }}>
                          {t.label}
                        </button>
                      ))}
                    </div>

                    {/* Table */}
                    <div className="rounded-xl overflow-auto" style={{ border: '1px solid #e2e8f0', maxHeight: isFullscreen ? 'calc(100vh - 420px)' : 560 }}>
                      <table className="w-full text-xs" style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: 1700 }}>
                        <thead>
                          <tr>
                            {visibleCols.map(c => (
                              <th key={c.key} className="text-left font-bold uppercase tracking-wide sticky top-0"
                                style={{
                                  padding: '10px 12px', background: '#f8fafc', color: '#475569',
                                  borderBottom: '2px solid #e2e8f0', fontSize: '0.68rem',
                                  minWidth: (c.width || 12) * 8, whiteSpace: 'nowrap',
                                }}>
                                {c.label}
                              </th>
                            ))}
                            <th className="text-left font-bold uppercase tracking-wide sticky top-0"
                              style={{ padding: '10px 12px', background: '#f8fafc', color: '#475569', borderBottom: '2px solid #e2e8f0', fontSize: '0.68rem' }}>
                              Status
                            </th>
                            <th className="sticky top-0" style={{
                              padding: '10px 12px', background: '#f8fafc',
                              borderBottom: '2px solid #e2e8f0', width: 44,
                            }} />
                          </tr>
                        </thead>
                        <tbody>
                          {regPageRows.length === 0 ? (
                            <tr>
                              <td colSpan={visibleCols.length + 2} className="text-center py-10 text-slate-400">
                                {rows.length === 0
                                  ? 'No valves yet — import a file, run an extraction, or click Add Row to start the register.'
                                  : `No valves match this view${search ? ' / search' : ''}.`}
                              </td>
                            </tr>
                          ) : regPageRows.map((row) => {
                            const st = STATUS_CONFIG[getRowStatus(row)] || STATUS_CONFIG.Unchanged;
                            return (
                              <tr key={row.id}
                                className="vm-row-animate"
                                onClick={() => setSelectedRowId(row.id)}
                                style={{
                                  cursor: 'pointer',
                                  background: selectedRowId === row.id ? 'rgba(59,130,246,0.07)' : 'transparent',
                                  outline: selectedRowId === row.id ? '1px solid rgba(59,130,246,0.3)' : 'none',
                                  outlineOffset: -1,
                                }}>
                                {visibleCols.map(c => {
                                  const isEditing = editCell && editCell.rowId === row.id && editCell.key === c.key;
                                  const cellVal = row[c.key] ?? '';
                                  const displayVal = c.key === 'rating' ? [cellVal, row.facing].filter(Boolean).join(' ') : cellVal;
                                  return (
                                    <td key={c.key}
                                      style={{ padding: '6px 12px', borderBottom: '1px solid #f1f5f9', color: '#334155', verticalAlign: 'middle' }}
                                      onDoubleClick={() => setEditCell({ rowId: row.id, key: c.key })}>
                                      {isEditing ? (
                                        c.type === 'select' ? (
                                          <select
                                            autoFocus
                                            value={cellVal}
                                            onChange={(e) => handleCellChange(row.id, c.key, e.target.value)}
                                            onBlur={commitEdit}
                                            className="w-full px-1.5 py-1 text-xs rounded outline-none"
                                            style={{ border: '1px solid rgba(59,130,246,0.45)', background: 'white' }}>
                                            <option value="">—</option>
                                            {(c.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                                          </select>
                                        ) : (
                                          <input
                                            autoFocus
                                            type={c.type === 'number' ? 'number' : 'text'}
                                            value={cellVal}
                                            onChange={(e) => handleCellChange(
                                              row.id, c.key,
                                              c.type === 'number' ? (Number(e.target.value) || 0) : e.target.value,
                                            )}
                                            onBlur={commitEdit}
                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') commitEdit(); }}
                                            className="w-full px-1.5 py-1 text-xs rounded outline-none"
                                            style={{ border: '1px solid rgba(59,130,246,0.45)', background: 'white', minWidth: 60 }}
                                          />
                                        )
                                      ) : (
                                        <span style={{ display: 'inline-block', maxWidth: (c.width || 12) * 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                          title="Double-click to edit">
                                          {displayVal === '' || displayVal === 0 && c.type !== 'number' ? '—' : String(displayVal)}
                                        </span>
                                      )}
                                    </td>
                                  );
                                })}
                                {/* Status pill (soft-coded STATUS_CONFIG) */}
                                <td style={{ padding: '6px 12px', borderBottom: '1px solid #f1f5f9' }}>
                                  <span style={{
                                    display: 'inline-block', padding: '3px 10px', borderRadius: '20px',
                                    fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap',
                                    background: st.bg, color: st.fg, border: `1px solid ${st.border}`,
                                  }}>
                                    {st.label}
                                  </span>
                                </td>
                                <td style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9' }}>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteRow(row.id); }}
                                    title="Delete row"
                                    className="text-slate-300 hover:text-red-500 transition-colors">
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination footer — "1–10 of N" + numbered pages */}
                    <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                      <span className="text-xs text-slate-500">
                        {filteredRows.length === 0 ? '0 of 0' : `${(regSafePage - 1) * REGISTER_CONFIG.pageSize + 1}–${Math.min(regSafePage * REGISTER_CONFIG.pageSize, filteredRows.length)} of ${filteredRows.length}`}
                      </span>
                      <div className="flex items-center gap-1">
                        <button disabled={regSafePage <= 1} onClick={() => setRegPage(p => Math.max(1, p - 1))}
                          className="px-2 py-1 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                          style={{ border: 'none', background: 'none', cursor: 'pointer' }}>‹</button>
                        {Array.from({ length: regPageCount }, (_, i) => i + 1)
                          .filter(p => p === 1 || p === regPageCount || Math.abs(p - regSafePage) <= 2)
                          .reduce((acc, p, idx, arr) => (idx > 0 && p - arr[idx - 1] > 1 ? [...acc, '…', p] : [...acc, p]), [])
                          .map((p, i) => p === '…' ? (
                            <span key={`gap-${i}`} className="px-1 text-xs text-slate-400">…</span>
                          ) : (
                            <button key={p} onClick={() => setRegPage(p)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                              style={p === regSafePage ? {
                                background: 'rgba(15,118,110,0.1)', color: '#0f766e', border: '1px solid rgba(15,118,110,0.25)', cursor: 'pointer',
                              } : {
                                background: 'none', color: '#64748b', border: 'none', cursor: 'pointer',
                              }}>
                              {p}
                            </button>
                          ))}
                        <button disabled={regSafePage >= regPageCount} onClick={() => setRegPage(p => Math.min(regPageCount, p + 1))}
                          className="px-2 py-1 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                          style={{ border: 'none', background: 'none', cursor: 'pointer' }}>›</button>
                      </div>
                    </div>

                    {/* Totals strip */}
                    <div className="flex items-center gap-6 mt-4 px-4 py-3 rounded-xl w-fit"
                      style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <span className="text-xs font-semibold text-slate-500">Σ Island: <b className="text-slate-800 tabular-nums">{totals.island}</b></span>
                      <span className="text-xs font-semibold text-slate-500">Σ Field: <b className="text-slate-800 tabular-nums">{totals.field}</b></span>
                      <span className="text-xs font-semibold text-slate-500">Σ Total: <b className="text-teal-700 tabular-nums">{totals.island + totals.field}</b></span>
                      <span className="text-[10px] text-slate-400 italic">double-click a cell to edit · AREA = source DRG. TITLE</span>
                    </div>
                  </div>

                  {/* Right: row detail panel (template's EQUIPMENT DETAILS) */}
                  {(() => {
                    const sel = rows.find(r => r.id === selectedRowId);
                    if (!sel) return null;
                    const selStatus = STATUS_CONFIG[getRowStatus(sel)] || STATUS_CONFIG.Unchanged;
                    const selIssues = getRowIssues(sel);
                    const docs = resolveLinkedDocuments({ sourcePdfName: pidDocument?.name });
                    return (
                      <div className="rounded-xl p-5 flex-shrink-0 vm-section" style={{
                        width: 340, border: '1px solid #e2e8f0', background: 'white',
                        boxShadow: '0 2px 12px rgba(15,23,42,0.05)',
                        position: 'sticky', top: 16,
                      }}>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div style={{ minWidth: 0 }}>
                            <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#94a3b8' }}>Valve Details</div>
                            <div className="text-xl font-extrabold text-slate-900" style={{ wordBreak: 'break-word' }}>{sel.valve_tag || '(untagged)'}</div>
                            <div className="text-xs text-slate-500">{sel.type || '—'}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span style={{
                              padding: '3px 10px', borderRadius: '20px', fontSize: '0.68rem', fontWeight: 700,
                              background: selStatus.bg, color: selStatus.fg, border: `1px solid ${selStatus.border}`,
                            }}>{selStatus.label}</span>
                            <button onClick={() => setSelectedRowId(null)} className="text-slate-400 hover:text-slate-600">
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Config-driven sections — editable fields (per
                            PANEL_EDITABLE_FIELDS) are always inputs the
                            moment the panel is open; no separate edit mode. */}
                        {DETAIL_SECTIONS.map(sec => (
                          <div key={sec.key} className="mt-4">
                            <div className="text-xs font-bold text-slate-800 mb-2">{sec.title}</div>
                            {sec.fields.filter(f => isValveColumnVisible(f.key)).map(f => {
                              const editable = PANEL_EDITABLE_FIELDS[f.key];
                              const rawVal = sel[f.key];
                              if (editable) {
                                const { kind, options } = PANEL_EDITABLE_FIELDS[f.key];
                                return (
                                  <div key={f.key} className="py-1">
                                    <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
                                    {kind === 'select' ? (
                                      <select value={rawVal ?? ''} onChange={(e) => handleCellChange(sel.id, f.key, e.target.value)}
                                        className="w-full px-1.5 py-1 text-xs rounded outline-none"
                                        style={{ border: '1px solid rgba(59,130,246,0.45)', background: 'white' }}>
                                        <option value="">—</option>
                                        {(options || []).map(o => <option key={o} value={o}>{o}</option>)}
                                      </select>
                                    ) : kind === 'textarea' ? (
                                      <textarea value={rawVal ?? ''} rows={3} onChange={(e) => handleCellChange(sel.id, f.key, e.target.value)}
                                        className="w-full px-1.5 py-1 text-xs rounded outline-none resize-none"
                                        style={{ border: '1px solid rgba(59,130,246,0.45)', background: 'white' }} />
                                    ) : kind === 'number' ? (
                                      <input type="number" value={rawVal ?? 0}
                                        onChange={(e) => handleCellChange(sel.id, f.key, Number(e.target.value) || 0)}
                                        className="w-full px-1.5 py-1 text-xs rounded outline-none"
                                        style={{ border: '1px solid rgba(59,130,246,0.45)', background: 'white' }} />
                                    ) : (
                                      <input type="text" value={rawVal ?? ''} onChange={(e) => handleCellChange(sel.id, f.key, e.target.value)}
                                        className="w-full px-1.5 py-1 text-xs rounded outline-none"
                                        style={{ border: '1px solid rgba(59,130,246,0.45)', background: 'white' }} />
                                    )}
                                  </div>
                                );
                              }
                              return (
                                <div key={f.key} className="flex justify-between gap-3 py-1" style={{ borderBottom: '1px solid #f8fafc' }}>
                                  <span className="text-xs text-slate-400">{f.label}</span>
                                  <span className="text-xs font-semibold text-slate-700 text-right" style={{ wordBreak: 'break-word' }}>
                                    {rawVal === '' || rawVal === undefined || rawVal === null ? '—' : String(rawVal)}
                                  </span>
                                </div>
                              );
                            })}
                            {sec.total && (
                              <div className="flex justify-between gap-3 mt-2 px-3 py-2 rounded-lg"
                                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                                <span className="text-xs font-semibold" style={{ color: '#b45309' }}>{sec.total.label}</span>
                                <span className="text-sm font-extrabold" style={{ color: '#b45309' }}>{sec.total.compute(sel)}</span>
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Validation warnings block */}
                        {selIssues.length > 0 && (
                          <div className="mt-4 px-3 py-2.5 rounded-lg"
                            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
                            <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: '#b45309' }}>
                              <ExclamationTriangleIcon className="h-4 w-4" /> Validation warning{selIssues.length === 1 ? '' : 's'}
                            </div>
                            <ul className="mt-1.5 pl-4" style={{ margin: '6px 0 0' }}>
                              {selIssues.map(i => (
                                <li key={i.key} className="text-xs" style={{ color: i.severity === 'error' ? '#b91c1c' : '#b45309' }}>
                                  {i.label}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Linked documents */}
                        <div className="mt-4">
                          <div className="text-xs font-bold text-slate-800 mb-2">Linked documents</div>
                          {docs.length === 0 ? (
                            <div className="text-xs text-slate-400 italic">No linked documents — run an extraction to attach the source P&ID.</div>
                          ) : docs.map(d => (
                            <div key={d.name} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg mb-1.5"
                              style={{ border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                              <div style={{ minWidth: 0 }}>
                                <div className="text-xs font-semibold text-slate-700" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                                <div className="text-[10px] text-slate-400">{d.meta}</div>
                              </div>
                              <ArrowTopRightOnSquareIcon className="h-4 w-4 text-slate-400 flex-shrink-0" />
                            </div>
                          ))}
                        </div>

                        {/* Panel actions */}
                        <button onClick={handleSavePanelChanges}
                          className="w-full mt-5 px-3 py-2.5 text-xs font-bold rounded-xl text-white transition-all"
                          style={{ background: '#2563eb', border: 'none', cursor: 'pointer' }}>
                          💾 Save Changes
                        </button>
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => handleMarkReviewed(sel.id)}
                            className="flex-1 px-3 py-2 text-xs font-bold rounded-xl transition-all"
                            style={{ background: 'rgba(16,185,129,0.1)', color: '#047857', border: '1px solid rgba(16,185,129,0.3)', cursor: 'pointer' }}>
                            Mark reviewed
                          </button>
                          <button onClick={() => setMainTab('reviews')}
                            className="flex-1 px-3 py-2 text-xs font-bold rounded-xl text-white transition-all"
                            style={{ background: '#0f766e', border: 'none', cursor: 'pointer' }}>
                            Review changes
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ── VALIDATION TAB ── */}
              {mainTab === 'validation' && (
                <div>
                  {rows.length === 0 ? (
                    <div className="rounded-xl p-10 text-center" style={{ background: '#f8fafc', border: '1px dashed #e2e8f0' }}>
                      <div className="text-sm font-bold text-slate-700">No data yet</div>
                      <div className="text-xs text-slate-400 mt-1">Extract a P&ID, import a workbook, or add rows manually — validation results will appear here.</div>
                    </div>
                  ) : allIssues.length === 0 ? (
                    <div className="rounded-xl p-10 text-center" style={{ background: 'rgba(16,185,129,0.05)', border: '1px dashed rgba(16,185,129,0.3)' }}>
                      <CheckCircleIcon className="h-10 w-10 mx-auto mb-2" style={{ color: '#10b981' }} />
                      <div className="text-sm font-bold text-slate-800">All {rows.length} rows pass every data-quality rule</div>
                    </div>
                  ) : (
                    VALIDATION_RULES.map(rule => {
                      const failing = allIssues.filter(x => x.issues.some(i => i.key === rule.key));
                      if (!failing.length) return null;
                      const isErr = rule.severity === 'error';
                      return (
                        <div key={rule.key} className="rounded-xl p-4 mb-3"
                          style={{
                            background: isErr ? 'rgba(239,68,68,0.04)' : 'rgba(245,158,11,0.05)',
                            border: `1px solid ${isErr ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.25)'}`,
                          }}>
                          <div className="flex items-center gap-2 mb-2">
                            <ExclamationTriangleIcon className="h-4 w-4" style={{ color: isErr ? '#b91c1c' : '#b45309' }} />
                            <span className="text-xs font-bold" style={{ color: isErr ? '#b91c1c' : '#b45309' }}>{rule.label}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                              style={{ background: isErr ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.14)', color: isErr ? '#b91c1c' : '#b45309' }}>
                              {failing.length} row{failing.length === 1 ? '' : 's'}
                            </span>
                            <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: isErr ? '#ef4444' : '#d97706' }}>{rule.severity}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {failing.map(({ row }) => (
                              <button key={row.id}
                                onClick={() => { setSelectedRowId(row.id); setMainTab('register'); setSearch(''); }}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all hover:-translate-y-px"
                                style={{ background: 'white', border: '1px solid #e2e8f0', color: '#334155', cursor: 'pointer' }}>
                                {row.valve_tag || `Row ${row.sl_no}`}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* ── REVIEWS TAB ── */}
              {mainTab === 'reviews' && (
                <div className="rounded-xl p-5" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', maxWidth: 720 }}>
                  <div className="flex items-center gap-3 mb-4 flex-wrap">
                    <span className="text-sm font-bold text-slate-800">
                      Register {REGISTER_CONFIG.registerPrefix}-{String(activeProject?.code || '001').slice(0, 8).toUpperCase()} · Rev {String(revision).padStart(REGISTER_CONFIG.revisionPad, '0')}
                    </span>
                    <span style={{
                      padding: '3px 12px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700,
                      background: `${WORKFLOW_STATES[reviewState.status]?.badgeColor}15`,
                      color: WORKFLOW_STATES[reviewState.status]?.badgeColor,
                      border: `1px solid ${WORKFLOW_STATES[reviewState.status]?.badgeColor}30`,
                    }}>
                      {WORKFLOW_STATES[reviewState.status]?.label || 'In Review'}
                    </span>
                    <span className="text-xs text-slate-400">{rows.length} rows · {errorCount} errors · {warnCount} warnings</span>
                  </div>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Review comment (optional)…"
                    rows={3}
                    className="w-full px-3 py-2 text-xs rounded-xl outline-none mb-3"
                    style={{ border: '1px solid #e2e8f0', background: 'white', color: '#334155', resize: 'vertical' }}
                  />
                  <div className="flex gap-2 mb-5">
                    <button onClick={() => applyReviewAction('approved')}
                      className="px-4 py-2 text-xs font-bold rounded-xl text-white"
                      style={{ background: '#10b981', border: 'none', cursor: 'pointer' }}>Approve</button>
                    <button onClick={() => applyReviewAction('rejected')}
                      className="px-4 py-2 text-xs font-bold rounded-xl text-white"
                      style={{ background: '#ef4444', border: 'none', cursor: 'pointer' }}>Reject</button>
                    <button onClick={() => applyReviewAction('reset')}
                      className="px-4 py-2 text-xs font-bold rounded-xl"
                      style={{ background: 'white', color: '#64748b', border: '1px solid #e2e8f0', cursor: 'pointer' }}>Reset to In Review</button>
                  </div>
                  <div className="text-xs font-bold text-slate-700 mb-2">Review history</div>
                  {(reviewState.history || []).length === 0 ? (
                    <div className="text-xs text-slate-400 italic">No review actions yet.</div>
                  ) : (
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                      {reviewState.history.map((h, i) => (
                        <li key={i} className="flex items-start gap-3 py-2" style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <span style={{
                            padding: '2px 10px', borderRadius: '20px', fontSize: '0.68rem', fontWeight: 700, flexShrink: 0,
                            background: `${WORKFLOW_STATES[h.action === 'reset' ? 'in_review' : h.action]?.badgeColor}15`,
                            color: WORKFLOW_STATES[h.action === 'reset' ? 'in_review' : h.action]?.badgeColor,
                          }}>
                            {WORKFLOW_STATES[h.action === 'reset' ? 'in_review' : h.action]?.label || h.action}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            {h.comment && <div className="text-xs text-slate-700">{h.comment}</div>}
                            <div className="text-[10px] text-slate-400">{h.by} · {h.at}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* ── ACTIVITY TAB ── */}
              {mainTab === 'activity' && (
                <div className="rounded-xl p-5" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', maxWidth: 720 }}>
                  <div className="text-xs font-bold text-slate-700 mb-3">Activity — Rev {String(revision).padStart(REGISTER_CONFIG.revisionPad, '0')} (last {ACTIVITY_CONFIG.maxEntries} events kept)</div>
                  {activity.length === 0 ? (
                    <div className="text-xs text-slate-400 italic">No activity yet — extraction, imports, edits and reviews are logged here.</div>
                  ) : (
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                      {activity.map((a, i) => {
                        const ev = ACTIVITY_CONFIG.events[a.type] || { icon: '•', label: a.type };
                        return (
                          <li key={i} className="flex items-start gap-3 py-2" style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <span style={{ fontSize: '0.9rem', flexShrink: 0 }} title={ev.label}>{ev.icon}</span>
                            <div style={{ minWidth: 0 }}>
                              <div className="text-xs text-slate-700">{a.text}</div>
                              <div className="text-[10px] text-slate-400">{ev.label} · {new Date(a.at).toLocaleString()}</div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Managed Legend Sheets modal — shared LegendSheetsModal UI, but
          backed by Valve MTO's OWN isolated legend service (legendApi prop)
          so activation here can never disturb P&ID V1/V2's shared state.
          The extraction POST needs no legend parameter: the backend reads
          this user's active ValveMTOLegend rows server-side. ── */}
      {VM_LEGENDS.enabled && (
        <LegendSheetsModal
          open={legendModalOpen}
          onClose={() => { setLegendModalOpen(false); refreshActiveLegends(); }}
          section={VM_LEGENDS.defaultSection}
          projectId={activeProject?.project_id}
          onActiveChange={handleLegendActiveChange}
          legendApi={VM_LEGEND_API}
          title="Valve MTO Legend Sheets"
          description="Define extraction rules for valve tags, piping classes and line formats — isolated from P&ID Verification's legends."
          syncTitle="Isolated Valve MTO Legends"
          syncText="These legends live in Valve MTO's own table — activating here never changes P&ID Verification's active legends."
        />
      )}
    </>
  );
};

export default ValveMTO;

