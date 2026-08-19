/**
 * 🗂️ INSTRUMENT PROJECT MANAGER — Phase 1
 *
 * A lightweight, soft-coded project management layer for the Instrument Index workflow.
 *
 * Phase 1 scope:
 *   • Category-driven projects (ADNOC Onshore / ADNOC Gas — extensible via config)
 *   • Local-first persistence (localStorage) — zero backend dependency to ship today
 *   • Smart project switcher banner + create / edit / archive modals
 *   • Active project context exposed via custom hook for the host page
 *
 * Phase 2 (future, drop-in): swap the storage adapter for a Django REST endpoint
 * (apps/instrument_projects/) — the component API stays the same.
 *
 * Build: v1.0.0
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  FolderIcon,
  FolderPlusIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckCircleIcon,
  ChevronUpDownIcon,
  XMarkIcon,
  ArchiveBoxIcon,
  BuildingOffice2Icon,
  MapPinIcon,
  IdentificationIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

// ──────────────────────────────────────────────────────────────────────────────
// SOFT-CODED CONFIG — extend here, no other file changes needed
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Project categories. Add a new entry to expose a new category in:
 *   • the "Create Project" category picker
 *   • the project list filter chips
 *   • the soft-coded badge styling
 */
export const INSTRUMENT_PROJECT_CATEGORIES = [
  // ─────────────────────────────────────────────────────────────────────
  // Presentation-only swap (2026-05-08): the historical extraction /
  // template logic keyed by id='adnoc_onshore' (and tag_format
  // 'ADNOC ONSHORE') is actually the correct behaviour for ADNOC GAS
  // projects, and vice versa. Rather than refactoring every downstream
  // branch, we keep the ids and `defaults.tag_format` stable (so every
  // existing rule, template, validator and saved DB row keeps working
  // unchanged) and swap ONLY the human-facing label / short /
  // description / icon / badge palette between the two entries.
  // Net effect: clicking "ADNOC Gas" in the UI now invokes the logic
  // originally written for Onshore, and clicking "ADNOC Onshore"
  // invokes the logic originally written for Gas — which is what the
  // engineering team wants.
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 'adnoc_onshore',          // ← internal id stays — drives all downstream logic
    label: 'ADNOC Gas',            // ← presentation swapped
    short: 'Gas',
    description: 'Gas processing, sweetening, dehydration & export facilities.',
    accent: 'from-emerald-500 via-teal-500 to-cyan-500',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-300',
    icon: '🔥',
    // Default specifications applicable to projects in this category — used
    // downstream (e.g. instrument index extraction) for ISA / engineering rules.
    // tag_format kept as 'ADNOC ONSHORE' because the backend extraction code
    // branches on this value; that branch is the logic we want for ADNOC Gas.
    defaults: {
      isa_standard: 'ISA 5.1',
      tag_format: 'ADNOC ONSHORE',
      typical_units: 'metric',
    },
  },
  {
    id: 'adnoc_gas',              // ← internal id stays — drives all downstream logic
    label: 'ADNOC Onshore',        // ← presentation swapped
    short: 'Onshore',
    description: 'Onshore oil & gas facilities — wellheads, GOSPs, manifold areas.',
    accent: 'from-amber-500 via-orange-500 to-red-500',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-300',
    icon: '🏜️',
    // tag_format kept as 'ADNOC GAS' — backend logic for that tag_format is
    // the one we now want surfaced for ADNOC Onshore projects.
    defaults: {
      isa_standard: 'ISA 5.1',
      tag_format: 'ADNOC GAS',
      typical_units: 'metric',
    },
  },
  {
    id: 'adnoc_offshore',
    label: 'ADNOC Offshore',
    short: 'Offshore',
    description: 'Offshore platforms, subsea & marine facilities (Upper Zakum, Umm Shaif, etc.).',
    accent: 'from-sky-500 via-blue-500 to-indigo-500',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-800',
    badgeBorder: 'border-sky-300',
    icon: '🌊',
    defaults: {
      isa_standard: 'ISA 5.1',
      tag_format: 'ADNOC OFFSHORE',
      typical_units: 'metric',
    },
  },
];

/** Editable project fields — modal renders dynamically from this list.
 *  `phase` controls when each field appears:
 *    'create' — shown in the simple Create form (kept minimal, à la PID Verification)
 *    'edit'   — shown only in the Edit form (advanced metadata)
 *    'both'   — shown in both
 */
export const PROJECT_EDITABLE_FIELDS = [
  { key: 'name',         label: 'Project Name',     type: 'text',   required: true,
    placeholder: 'e.g. SAHIL Phase 3 — Pig Receiver Upgrade', phase: 'both', autoFocus: true },
  { key: 'description',  label: 'Description',      type: 'textarea',
    placeholder: 'Brief project description… (optional)', phase: 'both' },
  { key: 'code',         label: 'Project Code',     type: 'text',
    placeholder: 'e.g. P16093', phase: 'edit' },
  { key: 'unit',         label: 'Unit / Area Code', type: 'text',
    placeholder: "e.g. '562' (ADNOC Onshore Habshan-5 Unit 562)",
    helpText: 'Numeric area / unit code that prefixes every instrument tag (e.g. 562-FT-1502). Required for ADNOC Onshore projects.',
    phase: 'both' },
  { key: 'client',       label: 'Client / Owner',   type: 'text',
    placeholder: 'e.g. ADNOC Onshore Operations', phase: 'edit' },
  { key: 'contractor',   label: 'EPC / Contractor', type: 'text',
    placeholder: 'e.g. Rejlers Abu Dhabi', phase: 'edit' },
  { key: 'location',     label: 'Location',         type: 'text',
    placeholder: 'e.g. Bab Field, Abu Dhabi, UAE', phase: 'edit' },
  { key: 'phase_stage',  label: 'Phase / Stage',    type: 'select',
    options: ['FEED', 'Detailed Design', 'EPC', 'Commissioning', 'Operations'], phase: 'edit' },
  { key: 'target_completion', label: 'Target Completion', type: 'date', phase: 'edit' },
];

/**
 * Fields displayed inside the Project Setup panel summary grid (soft-coded).
 * Add/remove rows here to control what shows in the active-project info card —
 * no JSX changes needed.
 */
export const PROJECT_SETUP_INFO_FIELDS = [
  { key: 'code',              label: 'Project Code',     icon: 'IdentificationIcon' },
  { key: 'unit',              label: 'Unit / Area Code', icon: 'HashtagIcon' },
  { key: 'client',            label: 'Client / Owner',   icon: 'BuildingOffice2Icon' },
  { key: 'contractor',        label: 'EPC / Contractor', icon: 'UserGroupIcon' },
  { key: 'location',          label: 'Location',         icon: 'MapPinIcon' },
  { key: 'phase_stage',       label: 'Phase / Stage',    icon: 'SparklesIcon' },
  { key: 'target_completion', label: 'Target Completion', icon: 'CalendarDaysIcon' },
];

/** Storage key — versioned to allow future migrations. */
const STORAGE_KEY = 'aiflow.instrument.projects.v1';
const ACTIVE_KEY  = 'aiflow.instrument.projects.active.v1';

/** Soft-coded form limits (mirrors PMS — keep UX consistent across modules). */
export const PROJECT_FORM_LIMITS = {
  nameMax: 80,
  descriptionMax: 240,
};

// ──────────────────────────────────────────────────────────────────────────────
// INSTRUMENT INDEX TEMPLATES — soft-coded per category
// ──────────────────────────────────────────────────────────────────────────────
/**
 * Each template controls how the Instrument Index workspace renders the
 * results table AND how the client-side Excel export is laid out.
 *
 * Schema:
 *   id            — must match a category id (or 'default')
 *   label         — short human label shown in UI
 *   sheetTitle    — Excel sheet name + visible title row
 *   metaRows      — array of header metadata rows shown above the table
 *                   (Excel-only; one row per array entry, each entry = list of
 *                   { label, key, span? } cells; key reads from project/result
 *                   context, e.g. project.code, result.drawing_number)
 *   groupHeader   — optional merged-header row above column headers
 *                   array of { label, span } — must total to columns.length
 *   columns       — ordered column list:
 *                   { key, header, sub?, width?, align?, mono?,
 *                     accessor(inst, ctx) -> string }
 *   groupBy       — optional accessor(inst) -> string. When set, rows are
 *                   partitioned by this value with a section header row above
 *                   each group (e.g. ADNOC Gas groups by equipment).
 *   emptyDash     — string used for empty cell values (default '—').
 *
 * To add a new client template (e.g. SAUDI_ARAMCO), append a new entry below.
 * No table-rendering or Excel-export code needs to change.
 */

// helpers — kept inline so templates remain self-contained ----------------
const _empty = (v) => (v === null || v === undefined || v === '' ? '-' : String(v));
const _get   = (inst, key) => _empty(inst?.[key]);

// Soft-coded "empty marker" set — values the API may emit for missing data.
// Centralised here so all templates treat them identically.
const _EMPTY_MARKERS = new Set(['', '-', '—', 'N/A', 'NA', 'NONE', 'NULL', 'UNDEFINED']);
const _isEmpty = (v) => {
  if (v === null || v === undefined) return true;
  const s = String(v).trim().toUpperCase();
  return _EMPTY_MARKERS.has(s);
};
const _str = (v) => (v === null || v === undefined ? '' : String(v));

// ─────────────────────────────────────────────────────────────────────────
// ADNOC GAS — display-side vocabulary (mirrors backend
// _ADNOC_GAS_INSTRUMENT_TYPE_MAP). Editing this dict re-styles the
// "Instrument Type" column without touching the backend, and shields the
// UI from any AI response that returned only a bare ISA code.
// ─────────────────────────────────────────────────────────────────────────
const ADNOC_GAS_TYPE_LABELS = {
  // Flow
  FE: 'Flow Element (Orifice)',
  FT: 'Flow Transmitter (DP Type)',
  FI: 'Flow Indicator',
  FG: 'Flow Glass / Sight Flow',
  FQI: 'Flow Quantity Indicator (Totalizer)',
  FV: 'Flow Control Valve (FCV, Globe)',
  FCV: 'Flow Control Valve (FCV, Globe)',
  FIC: 'Flow Indicating Controller',
  FC: 'Flow Controller',
  FY: 'Flow Computing Relay',
  // Pressure
  PG: 'Pressure Gauge',
  PT: 'Pressure Transmitter',
  PIT: 'Pressure Indicating Transmitter',
  PI: 'Pressure Indicator',
  PV: 'Pressure Control Valve (PCV, Globe)',
  PCV: 'Pressure Control Valve (PCV, Self-actuated)',
  PSV: 'Pressure Safety Valve',
  PSE: 'Pressure Safety Element (Rupture Disc)',
  // Temperature
  TE: 'Temperature Element (RTD with Thermowell)',
  TT: 'Temperature Transmitter',
  TIT: 'Temperature Indicating Transmitter',
  TI: 'Temperature Indicator',
  TG: 'Temperature Gauge (With Thermowell)',
  TW: 'Thermowell',
  TV: 'Temperature Control Valve (TCV)',
  // Level
  LG: 'Level Gauge (Mag)',
  LT: 'Level Transmitter (GWR)',
  LIT: 'Level Indicating Transmitter (GWR)',
  LI: 'Level Indicator',
  LV: 'Level Control Valve (LCV, Globe)',
  LCV: 'Level Control Valve (LCV, Globe)',
  LSH: 'Level Switch High',
  LSL: 'Level Switch Low',
  // Analyser
  AE: 'Analyzer Element (PH)',
  AT: 'Analyzer Transmitter (PH)',
  AIT: 'Analyzer Indicating Transmitter',
  AI: 'Analyzer Indicator',
  // Shutdown / on-off / motorised
  SDV: 'Shutdown Valve',
  BDV: 'Blowdown Valve',
  XV:  'On/Off Valve (Solenoid Actuated)',
  MOV: 'Motor Operated Valve',
  // Safety
  VSH: 'Vibration Switch High',
};

// Field-only instrument codes — Loop No. column is always '-' for these,
// matching the manual reference sheet.
const ADNOC_GAS_FIELD_ONLY = new Set([
  'FE', 'FG', 'PG', 'PSV', 'PSE', 'TE', 'TG', 'TW', 'LG', 'AE', 'RO',
]);

// Extract the ISA TYPE token from a tag like "803-FT-XXXX" → "FT".
const _isaTypeOf = (tag) => {
  const m = /^[A-Z0-9]+-([A-Z]{1,5})-/i.exec(_str(tag).toUpperCase());
  return m ? m[1] : '';
};

// ──────────────────────────────────────────────────────────────────────────
// ADNOC GAS — Loop No. canonical format mirroring the backend module-level
// `_ADNOC_LOOP_CTRL_MAP` in `instrument_index_service.py`.
//
// Each device ISA → ISA code that heads its loop. Display layer fallback
// when the backend hasn't yet normalised legacy records. Keep this dict
// in sync with the Python side.
// ──────────────────────────────────────────────────────────────────────────
const ADNOC_GAS_LOOP_CTRL_MAP = {
  // Flow
  FT:'FC', FIT:'FC', FE:'FC', FV:'FC', FCV:'FC', FIC:'FC', FC:'FC', FY:'FC', FQI:'FQI',
  FI:'FI', FG:'FI',
  // Pressure
  PT:'PIC', PIT:'PIC', PV:'PIC', PCV:'PIC', PIC:'PIC', PC:'PIC', PY:'PIC',
  PI:'PI', PG:'PI',
  // Temperature
  TT:'TIC', TIT:'TIC', TE:'TIC', TV:'TIC', TCV:'TIC', TIC:'TIC', TC:'TIC', TY:'TIC',
  TI:'TI', TG:'TI', TW:'TI',
  // Level
  LT:'LIC', LIT:'LIC', LV:'LIC', LCV:'LIC', LIC:'LIC', LC:'LIC', LY:'LIC',
  LI:'LI', LG:'LI', LSL:'LIC', LSH:'LIC', LSLL:'LIC', LSHH:'LIC',
  // Analytical
  AT:'AIC', AIT:'AIC', AE:'AIC', AY:'AIC', AIC:'AIC', AI:'AI',
  // Speed / vibration / position
  ST:'SIC', SI:'SI', VT:'VIC', VI:'VI', ZT:'ZIC', ZI:'ZI',
};
const ADNOC_GAS_LOOP_DEFAULT_SEQ = 'XXXX';
const ADNOC_GAS_LOOP_SEQ_RE = /^\d{3,4}[A-Z]?$/;
const ADNOC_GAS_LOOP_CANONICAL_RE = /^(\d{3})-([A-Z]{1,5})-([A-Z0-9]{2,5}[A-Z]?)$/;

// ──────────────────────────────────────────────────────────────────────────
// ADNOC GAS — Service-description display normaliser. Mirrors the backend
// `_adnoc_titlecase_service` (instrument_index_service.py). Soft-coded
// vocabularies — extend per template guide.
// ──────────────────────────────────────────────────────────────────────────
const ADNOC_GAS_SERVICE_CONNECTORS = new Set([
  'to', 'from', 'inlet', 'outlet', 'suction', 'discharge', 'via', 'at',
]);
const ADNOC_GAS_SERVICE_UPPER_TOKENS = new Set([
  'LP', 'MP', 'HP', 'VHP', 'LLP',
  'MBW', 'FW', 'BFW', 'DM', 'BD',
  'PSV', 'PCV', 'FCV', 'TCV', 'LCV',
  'FT', 'PT', 'TT', 'LT', 'AT',
  'I/O', 'DCS', 'ESD', 'F&G', 'PH', 'TI',
  'A/B', 'A/B/C', 'A/B/C/D',
]);
const ADNOC_GAS_SERVICE_TITLES = [
  'Steam Generator', 'Steam to', 'Steam from',
  'Continuous Blowdown', 'Intermittent Blowdown',
  'Flash Drum', 'KO Drum', 'Knockout Drum',
  'Reflux Drum', 'Suction Drum', 'Storage Tank',
  'Heat Exchanger', 'Air Cooler',
  'Diesel Product', 'Diesel Cooler',
  'Safe Location', 'Vent Header',
];
const _ADNOC_EQ_TAG_RE = /^\d{3}-[A-Z]+-[A-Z0-9X/]+/;

const _adnocTitleCaseService = (raw) => {
  let s = _str(raw).trim();
  if (!s) return s;
  s = s.replace(/\s+/g, ' ');
  const out = s.split(' ').map((tok) => {
    if (!tok) return tok;
    const bare = tok.replace(/[^A-Za-z0-9/&]/g, '');
    const upper = bare.toUpperCase();
    if (_ADNOC_EQ_TAG_RE.test(tok.toUpperCase())) return tok.toUpperCase();
    if (ADNOC_GAS_SERVICE_UPPER_TOKENS.has(upper)) {
      const tail = bare.length < tok.length ? tok.slice(bare.length) : '';
      return upper + tail;
    }
    if (ADNOC_GAS_SERVICE_CONNECTORS.has(upper.toLowerCase())) {
      return upper.toLowerCase();
    }
    return tok.charAt(0).toUpperCase() + tok.slice(1).toLowerCase();
  });
  s = out.join(' ');
  if (s) s = s.charAt(0).toUpperCase() + s.slice(1);
  for (const phrase of ADNOC_GAS_SERVICE_TITLES) {
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    s = s.replace(re, phrase);
  }
  return s;
};

/**
 * Display-side mirror of `_adnoc_normalize_loop_no`. Builds
 * `{UNIT}-{CTRL_ISA}-{LOOP_SEQ}` from a tag + any legacy loop value.
 * Idempotent: returns canonical input unchanged.
 */
const _adnocNormalizeLoopNo = (tagNumber, currentLoop) => {
  const tag = _str(tagNumber).trim().toUpperCase();
  const cur = _str(currentLoop).trim().toUpperCase();
  if (ADNOC_GAS_LOOP_CANONICAL_RE.test(cur)) return cur;

  const mt = /^(\d{3,4})-([A-Z]{1,5})-/.exec(tag);
  let unit = '';
  let deviceIsa = '';
  if (mt) {
    unit = mt[1].slice(0, 3);
    deviceIsa = mt[2];
  } else {
    const m2 = /^([A-Z]{1,5})-/.exec(tag);
    deviceIsa = m2 ? m2[1] : '';
  }
  if (!unit || !deviceIsa) return cur || '-';

  const ctrlIsa = ADNOC_GAS_LOOP_CTRL_MAP[deviceIsa] || deviceIsa;

  let seq = '';
  if (cur && !['-', 'N/A', 'NA', 'NONE', 'NULL'].includes(cur)) {
    const sm = /(\d{3,4}[A-Z]?)\s*$/.exec(cur);
    if (sm && ADNOC_GAS_LOOP_SEQ_RE.test(sm[1])) seq = sm[1];
  }
  if (!seq) seq = ADNOC_GAS_LOOP_DEFAULT_SEQ;

  return `${unit}-${ctrlIsa}-${seq}`;
};

// ── Soft-coded pure "Line No." column (ADNOC Gas only) ───────────────────
// The existing Gas "Line No (Note-7)" column follows the manual
// convention of substituting the equipment tag for vessel-mounted
// instruments, which hides the real pipeline line ID. This extra
// column always shows the raw `inst.line_number` field. Edit the
// constants below to retune presentation without touching column
// rendering or extraction logic.
const _GAS_PURE_LINE_NO_LABEL = 'LINE NO';
const _GAS_PURE_LINE_NO_WIDTH = 26;
const _GAS_PURE_LINE_NO_EMPTY = new Set(['', '-', '—', 'N/A', 'NA', 'NONE', 'NULL']);

const _gasPurelyLineNumber = (i) => {
  const raw = (i && i.line_number != null) ? String(i.line_number).trim() : '';
  if (_GAS_PURE_LINE_NO_EMPTY.has(raw.toUpperCase())) return '-';
  return raw.toUpperCase();
};

// Default template (ADNOC Onshore / Offshore / fallback) — mirrors the legacy
// 15-column results view that has shipped to date.
const _DEFAULT_TEMPLATE = {
  id: 'default',
  label: 'Standard Instrument Index',
  sheetTitle: 'Instrument Index',
  emptyDash: '—',
  metaRows: [
    [{ label: 'Project',        key: 'project.name' },
     { label: 'Project Code',   key: 'project.code' },
     { label: 'Drawing No.',    key: 'result.drawing_number' },
     { label: 'Revision',       key: 'result.revision' }],
  ],
  columns: [
    { key: 'index_no',            header: '#',                  width:  6, align:'right',
      accessor: (i, ctx) => i.index_no ?? (ctx.idx + 1) },
    { key: 'tag_number',          header: 'Tag Number',         width: 18, mono: true,
      accessor: i => _get(i, 'tag_number') },
    { key: 'control_system_tag',  header: 'CS Tag',             width: 16, mono: true,
      accessor: i => _get(i, 'control_system_tag') },
    { key: 'instrument_type',     header: 'Instrument Type',    width: 28,
      accessor: i => _get(i, 'instrument_type') },
    { key: 'category',            header: 'Category',           width: 16,
      accessor: i => _get(i, 'category') },
    { key: 'service_description', header: 'Service Description',width: 36,
      accessor: i => _get(i, 'service_description') },
    { key: 'line_number',         header: 'Line No.',           width: 22, mono: true,
      accessor: i => _get(i, 'line_number') },
    { key: 'equipment_number',    header: 'Equipment No.',      width: 18, mono: true,
      accessor: i => _get(i, 'equipment_number') },
    { key: 'loop_number',         header: 'Loop No.',           width: 14, mono: true,
      accessor: i => _get(i, 'loop_number') },
    { key: 'fail_safe',           header: 'Fail Safe',          width: 10,
      accessor: i => _get(i, 'fail_safe') },
    { key: 'signal_type',         header: 'Signal',             width: 12,
      accessor: i => _get(i, 'signal_type') },
    { key: 'set_point',           header: 'Set Point',          width: 14,
      accessor: i => _get(i, 'set_point') },
    { key: 'pid_no',              header: 'P&ID No.',           width: 22, mono: true,
      accessor: i => _get(i, 'pid_no') },
    { key: 'revision',            header: 'Rev.',               width:  6, align:'center',
      accessor: i => i.revision || '0' },
    { key: 'notes',               header: 'Source / Notes',     width: 24,
      accessor: i => _get(i, 'notes') },
  ],
};

// ADNOC Gas template — mirrors the manual "Manual Inst Index" Excel sheet.
// 25 columns with a merged "Calibration Range" (3) and "Alarm" (4) header row.
// Rows are grouped by equipment (e.g. "LP STEAM GENERATOR (803-E-XX1)").
//
// Soft-coded note suffixes (kept here so a single edit re-labels every column).
const NOTE_7  = '\n(Note-7)';
const NOTE_4  = ' (Note-4)';
const NOTE_7I = ' (Note-7)';   // inline form for group-header labels

// ─────────────────────────────────────────────────────────────────────────────
// EDITABLE-FIELDS REGISTRY
// ─────────────────────────────────────────────────────────────────────────────
// Soft-coded list driving the "Edit row" modal. Each entry is:
//   { key, label, type, options?, group?, hint? }
// Types: 'text' | 'textarea' | 'number' | 'select'
// `group` is purely cosmetic — it segregates fields into accordion sections
// in the modal so the form stays readable.
//
// Adding a new editable field is a single-line change here, and the Edit
// modal automatically picks it up — no UI code edits needed.
const _ADNOC_GAS_IO_OPTIONS       = ['', 'AI', 'AI-R', 'AO', 'AO-R', 'DI', 'DO', 'DO-R'];
const _ADNOC_GAS_LOCATION_OPTIONS = ['', 'Field', 'Vessel', 'Local Panel', 'Control Room'];
const _ADNOC_GAS_SYSTEM_OPTIONS   = ['', 'DCS', 'ESD', 'F&G', 'PLC', 'Local'];
const _ADNOC_GAS_FAILSAFE_OPTIONS = ['', 'FO', 'FC', 'FL', 'FAI'];
const _ADNOC_GAS_ALARM_OPTIONS    = ['', 'L', 'LL', 'H', 'HH'];

const _ADNOC_GAS_EDITABLE_FIELDS = [
  // Identification
  { key: 'tag_number',          label: 'Tag Number',           type: 'text',     group: 'Identification' },
  { key: 'loop_number',         label: 'Loop Number',          type: 'text',     group: 'Identification' },
  { key: 'pid_no',              label: 'P&ID No.',             type: 'text',     group: 'Identification' },
  { key: 'equipment_number',    label: 'Equipment No.',        type: 'text',     group: 'Identification' },
  { key: 'equipment_description', label: 'Equipment Description', type: 'text', group: 'Identification' },

  // Service & process
  { key: 'service_description', label: 'Service',              type: 'textarea', group: 'Service & Process',
    hint: 'Describe what the instrument measures. Leave blank if unknown — do not invent.' },
  { key: 'instrument_type',     label: 'Instrument Type',      type: 'text',     group: 'Service & Process' },
  { key: 'category',            label: 'Category',             type: 'text',     group: 'Service & Process' },
  { key: 'line_number',         label: 'Line Number',          type: 'text',     group: 'Service & Process' },
  { key: 'set_point',           label: 'Set Point',            type: 'text',     group: 'Service & Process' },

  // Calibration
  { key: 'calibration_min',     label: 'Calibration Min',      type: 'text',     group: 'Calibration Range' },
  { key: 'calibration_max',     label: 'Calibration Max',      type: 'text',     group: 'Calibration Range' },
  { key: 'calibration_unit',    label: 'Calibration Unit',     type: 'text',     group: 'Calibration Range',
    hint: 'e.g. kg/cm²g, °C, mmH₂O, %' },

  // Alarms (Note-7)
  { key: 'alarm_l',             label: 'Alarm L',              type: 'select',   options: _ADNOC_GAS_ALARM_OPTIONS, group: 'Alarms (Note-7)' },
  { key: 'alarm_ll',            label: 'Alarm LL',             type: 'select',   options: _ADNOC_GAS_ALARM_OPTIONS, group: 'Alarms (Note-7)' },
  { key: 'alarm_h',             label: 'Alarm H',              type: 'select',   options: _ADNOC_GAS_ALARM_OPTIONS, group: 'Alarms (Note-7)' },
  { key: 'alarm_hh',            label: 'Alarm HH',             type: 'select',   options: _ADNOC_GAS_ALARM_OPTIONS, group: 'Alarms (Note-7)' },

  // I/O & system
  { key: 'location',            label: 'Location',             type: 'select',   options: _ADNOC_GAS_LOCATION_OPTIONS, group: 'I/O & System' },
  { key: 'io_type',             label: 'I/O Type',             type: 'select',   options: _ADNOC_GAS_IO_OPTIONS,        group: 'I/O & System' },
  { key: 'system',              label: 'System',               type: 'select',   options: _ADNOC_GAS_SYSTEM_OPTIONS,    group: 'I/O & System' },
  { key: 'signal_type',         label: 'Signal Type',          type: 'text',     group: 'I/O & System' },
  { key: 'fail_safe',           label: 'Fail-Safe',            type: 'select',   options: _ADNOC_GAS_FAILSAFE_OPTIONS,  group: 'I/O & System' },
  { key: 'control_system_tag',  label: 'Control System Tag',   type: 'text',     group: 'I/O & System' },

  // Procurement / loop docs
  { key: 'purchase_order',      label: 'Purchase Order',       type: 'text',     group: 'Procurement & Docs' },
  { key: 'datasheet_no',        label: 'Datasheet No.',        type: 'text',     group: 'Procurement & Docs' },
  { key: 'manufacturer',        label: 'Manufacturer',         type: 'text',     group: 'Procurement & Docs' },
  { key: 'model_no',            label: 'Model No.',            type: 'text',     group: 'Procurement & Docs' },
  { key: 'junction_box',        label: 'Junction Box',         type: 'text',     group: 'Procurement & Docs' },
  { key: 'multi_cable',         label: 'Multi-Cable',          type: 'text',     group: 'Procurement & Docs' },
  { key: 'loop_dwg',            label: 'Loop Drawing',         type: 'text',     group: 'Procurement & Docs' },

  // Notes / remarks
  { key: 'instrument_remark',   label: 'Remarks',              type: 'textarea', group: 'Notes' },
  { key: 'notes',               label: 'Notes',                type: 'textarea', group: 'Notes' },
];

// Default-template editable fields (lighter set — no calibration / alarm columns).
const _DEFAULT_EDITABLE_FIELDS = [
  { key: 'tag_number',          label: 'Tag Number',           type: 'text',     group: 'Identification' },
  { key: 'control_system_tag',  label: 'Control System Tag',   type: 'text',     group: 'Identification' },
  { key: 'instrument_type',     label: 'Instrument Type',      type: 'text',     group: 'Identification' },
  { key: 'category',            label: 'Category',             type: 'text',     group: 'Identification' },
  { key: 'service_description', label: 'Service Description',  type: 'textarea', group: 'Service' },
  { key: 'line_number',         label: 'Line Number',          type: 'text',     group: 'Service' },
  { key: 'equipment_number',    label: 'Equipment Number',     type: 'text',     group: 'Service' },
  { key: 'loop_number',         label: 'Loop Number',          type: 'text',     group: 'Service' },
  { key: 'fail_safe',           label: 'Fail-Safe',            type: 'select',   options: _ADNOC_GAS_FAILSAFE_OPTIONS, group: 'I/O' },
  { key: 'signal_type',         label: 'Signal Type',          type: 'text',     group: 'I/O' },
  { key: 'set_point',           label: 'Set Point',            type: 'text',     group: 'I/O' },
  { key: 'pid_no',              label: 'P&ID No.',             type: 'text',     group: 'Docs' },
  { key: 'revision',            label: 'Revision',             type: 'text',     group: 'Docs' },
  { key: 'notes',               label: 'Notes',                type: 'textarea', group: 'Notes' },
];

const _ADNOC_GAS_TEMPLATE = {
  id: 'adnoc_gas',
  label: 'ADNOC Gas — Instrument Index (Scheme template)',
  sheetTitle: 'Instrument Index',
  emptyDash: '-',
  metaRows: [
    [{ label: 'Company Doc. No.', key: 'project.code',              span: 2 },
     { label: 'Project',          key: 'project.name',              span: 4 },
     { label: 'Unit',             key: 'project.unit',              span: 1 }],
    [{ label: 'Consultant Doc.',  key: 'result.drawing_number',     span: 2 },
     { label: 'Job No.',          key: 'project.code',              span: 1 },
     { label: 'Title',            key: 'result.drawing_title',      span: 4 }],
  ],
  // Top merged-header strip — totals MUST equal columns.length (26)
  groupHeader: [
    { label: '',                              span: 4  }, // Tag/Loop/Service/Type
    { label: `Calibration Range${NOTE_4}`,    span: 3  }, // Min / Max / Unit
    { label: `Alarm${NOTE_7I}`,               span: 4  }, // L / LL / H / HH
    // Trailing block widened by 1 to host the pure "Line No." column.
    { label: '',                              span: 15 }, // remaining cols
  ],
  columns: [
    { key: 'tag_number',     header: `Tag Number${NOTE_7}`, width: 18, mono: true,
      accessor: i => {
        const t = _str(i.tag_number).trim();
        return _isEmpty(t) ? '-' : t.toUpperCase();
      } },
    // Loop No. — canonical {UNIT}-{CTRL_ISA}-{LOOP_SEQ} (e.g. "803-FC-XXXX").
    // Field-only devices (FE/PG/TG/LG/PSV) → "-". Display layer normalises
    // any legacy backend value via `_adnocNormalizeLoopNo` so the column is
    // always in the manual's canonical format.
    { key: 'loop_number',    header: 'Loop No.',             width: 18, mono: true,
      accessor: i => {
        const isa = _isaTypeOf(i.tag_number);
        if (ADNOC_GAS_FIELD_ONLY.has(isa)) return '-';
        const src = _str(i.control_system_tag).trim() || _str(i.loop_number).trim();
        const norm = _adnocNormalizeLoopNo(i.tag_number, src);
        return _isEmpty(norm) ? '-' : norm;
      } },
    { key: 'service_description', header: 'Service',         width: 40,
      accessor: i => {
        const raw = _str(i.service_description).trim();
        // Empty-by-design: backend leaves Service blank when no manual-style
        // phrase can be safely built. Render nothing rather than a generic
        // placeholder so the column visibly differentiates "we know" vs
        // "we don't have data".
        if (_isEmpty(raw)) return '';
        return _adnocTitleCaseService(raw);
      } },
    { key: 'instrument_type',header: 'Instrument Type',      width: 28,
      accessor: i => {
        // Soft-coded display upgrade: if the API returned only a bare ISA
        // code (or an empty value), substitute the verbose label from the
        // ADNOC Gas vocabulary.
        const cur = _str(i.instrument_type).trim();
        const isa = _isaTypeOf(i.tag_number);
        const verbose = ADNOC_GAS_TYPE_LABELS[isa];
        if (_isEmpty(cur)) return verbose || '-';
        // If `cur` is just the ISA code itself (e.g. "FT"), upgrade it.
        if (verbose && cur.toUpperCase() === isa) return verbose;
        return cur;
      } },
    // Calibration Range
    { key: 'cal_min',  header: 'Min',  sub: 'Calibration Range', width:  8, align:'center',
      accessor: i => _get(i, 'calibration_min') },
    { key: 'cal_max',  header: 'Max',  sub: 'Calibration Range', width:  8, align:'center',
      accessor: i => _get(i, 'calibration_max') },
    { key: 'cal_unit', header: 'Unit', sub: 'Calibration Range', width: 10, align:'center',
      accessor: i => _get(i, 'calibration_unit') },
    // Alarm
    { key: 'alarm_l',  header: 'L',  sub: 'Alarm', width: 7, align:'center',
      accessor: i => _get(i, 'alarm_l') },
    { key: 'alarm_ll', header: 'LL', sub: 'Alarm', width: 7, align:'center',
      accessor: i => _get(i, 'alarm_ll') },
    { key: 'alarm_h',  header: 'H',  sub: 'Alarm', width: 7, align:'center',
      accessor: i => _get(i, 'alarm_h') },
    { key: 'alarm_hh', header: 'HH', sub: 'Alarm', width: 7, align:'center',
      accessor: i => _get(i, 'alarm_hh') },
    // Remaining
    { key: 'location',       header: 'Location',                width: 12,
      accessor: i => _get(i, 'location') },
    { key: 'io_type',        header: 'I/O Type',                width: 10, align:'center',
      // I/O type best-guess: explicit field, else derive from signal_type
      accessor: i => _empty(i.io_type ?? i.signal_type) },
    { key: 'system',         header: 'System',                  width: 10, align:'center',
      accessor: i => _empty(i.system ?? (i.signal_type ? 'DCS' : null)) },
    { key: 'pid_no',         header: 'PID',                     width: 24, mono: true,
      accessor: i => _get(i, 'pid_no') },
    // Pure line number (no equipment fallback) — ADNOC Gas only.
    { key: 'pure_line_no',   header: _GAS_PURE_LINE_NO_LABEL,   width: _GAS_PURE_LINE_NO_WIDTH,
      mono: true, align: 'center', accessor: _gasPurelyLineNumber },
    { key: 'line_number',    header: `Line No${NOTE_7}`,        width: 26, mono: true,
      // Manual convention: vessel-mounted instruments (LG/LT/PT/TG on a drum,
      // exchanger, etc.) put the EQUIPMENT TAG in this column.
      accessor: i => {
        const ln = _str(i.line_number).trim();
        if (!_isEmpty(ln)) return ln;
        const eq  = _str(i.equipment_number).trim();
        const loc = _str(i.location).trim().toLowerCase();
        if (!_isEmpty(eq) && (loc === 'vessel' || /vessel/i.test(loc))) return eq;
        return '-';
      } },
    { key: 'equipment_number',header:`Equip No${NOTE_7}`,       width: 18, mono: true,
      accessor: i => _get(i, 'equipment_number') },
    { key: 'purchase_order', header: `Purchase Order${NOTE_7}`, width: 18, mono: true,
      accessor: i => _get(i, 'purchase_order') },
    { key: 'datasheet_no',   header: `Datasheet No.${NOTE_7}`,  width: 22, mono: true,
      accessor: i => _get(i, 'datasheet_no') },
    { key: 'manufacturer',   header: `Manufacturer${NOTE_7}`,   width: 18,
      accessor: i => _get(i, 'manufacturer') },
    { key: 'model_no',       header: `Model No.${NOTE_7}`,      width: 16, mono: true,
      accessor: i => _get(i, 'model_no') },
    { key: 'junction_box',   header: `Junction Box${NOTE_7}`,   width: 16, mono: true,
      accessor: i => _get(i, 'junction_box') },
    { key: 'multi_cable',    header: `Multi Cable${NOTE_7}`,    width: 14, mono: true,
      accessor: i => _get(i, 'multi_cable') },
    { key: 'loop_dwg',       header: `Loop dwg.${NOTE_7}`,      width: 16, mono: true,
      accessor: i => _get(i, 'loop_dwg') },
    { key: 'remark',         header: 'Instrument Remark',       width: 32,
      accessor: i => _empty(i.instrument_remark ?? i.notes) },
  ],
  // Group rows by equipment number — ADNOC Gas template style.
  // Soft-coded "empty" sentinels: extend `EMPTY_EQ_TOKENS` if more variants
  // appear in upstream data.
  groupBy: (inst) => {
    const EMPTY_EQ_TOKENS = new Set(['', '-', '—', 'N/A', 'NA', 'NONE', 'NULL']);
    const eq = (inst.equipment_number || '').trim();
    if (EMPTY_EQ_TOKENS.has(eq.toUpperCase())) return null;
    return eq;
  },
  // Format a group header label like the reference sheet:
  //   equipment "803-E-XX1" + service "LP Steam Generator" → "LP STEAM GENERATOR (803-E-XX1)"
  // Priority: `equipment_description` (set by backend derivation) →
  // service_description matching an equipment-noun keyword → bare key.
  groupHeaderLabel: (key, instances) => {
    // Soft-coded list of equipment-noun keywords that signal a usable description
    const EQ_NOUN_RE = /generator|exchanger|pump|drum|column|tower|vessel|cooler|reactor|separator|filter|tank|compressor|heater|condenser|reboiler|absorber|stripper|contactor|regenerator|scrubber|coalescer|fractionator/i;
    // 1) Backend-derived `equipment_description` wins (set by
    //    `_derive_adnoc_equipment` on the Django side).
    const derived = instances
      .map(i => (i.equipment_description || '').trim())
      .find(s => s && EQ_NOUN_RE.test(s));
    let raw = derived;
    // 2) Fallback: scan service descriptions for an equipment noun.
    if (!raw) {
      raw = instances
        .map(i => i.service_description || '')
        .find(s => s && EQ_NOUN_RE.test(s));
    }
    if (!raw) return key;
    // Trim trailing connectors ("to", "from", "inlet", "outlet", ...) so we keep the equipment noun phrase
    const cleaned = raw
      .replace(/\s+/g, ' ')
      .replace(/[\s\-,–—]+(to|from|inlet|outlet|suction|discharge)\b.*$/i, '')
      .trim()
      .slice(0, 60)
      .toUpperCase();
    return `${cleaned} (${key})`;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ADNOC ONSHORE — fully isolated template & editable-fields registry
// ─────────────────────────────────────────────────────────────────────────────
// Soft-coded sibling of the ADNOC Gas template, scoped exclusively to the
// `adnoc_onshore` category. Mirrors the manual "Instrument Index" Excel
// sheet (Doc. No. ...-IN-LST-00001) — 18 columns with two merged
// "Inst range" + "Calibration range" group headers. Decoupling Onshore
// from both `_DEFAULT_TEMPLATE` and the ADNOC Gas constants guarantees:
//   • Edits aimed at ADNOC Onshore (column tweaks, ISA vocabulary,
//     editable fields) NEVER leak into ADNOC Gas or the generic
//     fallback template.
//   • Edits aimed at ADNOC Gas NEVER affect ADNOC Onshore — those
//     branches were already isolated by the
//     `if category === 'adnoc_gas'` backend gate.
//   • The generic `default` fallback stays a clean baseline for any
//     future category (Saudi Aramco, Qatar Energy, etc.).
//
// To customise ADNOC Onshore, edit only the constants in this section.
// ─────────────────────────────────────────────────────────────────────────────

// ISA → verbose instrument-type label vocabulary (Onshore-only).
// Some ISA codes have multiple Onshore variants; map the bare code to the
// most common label and rely on AI-extracted text when more specificity
// (e.g. "GWR" vs "DP" for LT) is needed.
const _ADNOC_ONSHORE_TYPE_LABELS = {
  FT:  'Flow Transmitter',
  FE:  'Flow Element (Orifice)',
  FIT: 'Flow Indicating Transmitter',
  FI:  'Flow Indicator',
  FV:  'Control Valve',
  FCV: 'Control Valve',
  FZT: 'Position Transmitter',
  FZI: 'Position Indicator',
  FAL: 'Flow Alarm Low',
  LT:  'Level Transmitter',
  LIT: 'Level Indicating Transmitter',
  LI:  'Level Indicator',
  LG:  'Level Gauge (Mag)',
  LV:  'Control Valve',
  LCV: 'Control Valve',
  LIC: 'Level Indicator Controller',
  LSL: 'Level Switch Low',
  LSH: 'Level Switch High',
  LSLL:'Level Switch Low Low',
  LSHH:'Level Switch High High',
  LALL:'Level Alarm Low Low',
  PG:  'Pressure Gauge',
  PT:  'Pressure Transmitter',
  PIT: 'Pressure Indicating Transmitter',
  PI:  'Pressure Indicator',
  PV:  'Control Valve',
  PCV: 'Control Valve',
  PIC: 'Pressure Indicator Controller',
  PSV: 'Pressure Safety Valve',
  PSH: 'Pressure Switch High',
  PSL: 'Pressure Switch Low',
  TG:  'Temperature Gauge',
  TT:  'Temperature Transmitter',
  TIT: 'Temperature Indicating Transmitter',
  TI:  'Temperature Indicator',
  TE:  'Temperature Element',
  TW:  'Thermowell',
  TIC: 'Temperature Indicator Controller',
  TV:  'Control Valve',
  HS:  'Hand Switch',
  VAH: 'Vibration Alarm High',
  VSH: 'Vibration Switch High',
  SDV: 'Shutdown Valve',
  BDV: 'Blowdown Valve',
  SOV: 'Solenoid Valve',
  MOV: 'Motor Operated Valve',
};

// I/O type, IS/NIS, System, Location dropdown vocabularies (Onshore-only).
const _ADNOC_ONSHORE_IO_OPTIONS       = ['', 'AI', 'AO', 'DI', 'DO', 'N/A'];
const _ADNOC_ONSHORE_IS_NIS_OPTIONS   = ['', 'IS', 'NIS', 'N/A'];
const _ADNOC_ONSHORE_SYSTEM_OPTIONS   = ['', 'DCS', 'ESD', 'F&G', 'PLC', 'Local', 'N/A'];
const _ADNOC_ONSHORE_LOCATION_OPTIONS = ['', 'Field', 'Local Panel', 'Control Room', 'CCR', 'Vessel'];
const _ADNOC_ONSHORE_STATUS_OPTIONS   = ['', 'New', 'Existing', 'Modified', 'Removed'];
const _ADNOC_ONSHORE_FAILSAFE_OPTIONS = ['', 'FO', 'FC', 'FL', 'FAI'];

// Soft-coded helpers — purely visual upgrades, no AI extraction changes.
const _onshoreIsa = (tag) => {
  const m = String(tag || '').toUpperCase().match(/^\d+\s*-\s*([A-Z]{1,5})\s*-/);
  return m ? m[1] : '';
};
const _onshoreEqOrLine = (i) => {
  // Manual-sheet convention: column 6 holds either a piping line number
  // (vessel-mounted instruments use the equipment tag instead).
  const ln = _str(i.line_number).trim();
  if (!_isEmpty(ln) && ln !== '-') return ln;
  const eq = _str(i.equipment_number).trim();
  if (!_isEmpty(eq) && eq !== '-') return eq;
  return '';
};

const _ADNOC_ONSHORE_TEMPLATE = {
  id:         'adnoc_onshore',
  label:      'ADNOC Onshore — Instrument Index',
  sheetTitle: 'Instrument Index',
  emptyDash:  '',
  // Project / drawing meta block — mirrors the manual sheet header.
  metaRows: [
    [{ label: 'Project',        key: 'project.name',          span: 4 },
     { label: 'Document No.',   key: 'result.drawing_number', span: 2 },
     { label: 'Location',       key: 'project.location',      span: 1 }],
    [{ label: 'Title',          key: 'result.drawing_title',  span: 4 },
     { label: 'Revision',       key: 'result.revision',       span: 1 },
     { label: 'Project Code',   key: 'project.code',          span: 2 }],
  ],
  // Top merged-header strip — totals MUST equal columns.length (18).
  groupHeader: [
    // Leading block widened by 1 to host the new "LINE NO" column.
    { label: '',                              span: 11 }, // Tag…Device Status (+ LINE NO)
    { label: 'Inst range (Refer Gen Note 5)', span: 3  }, // Min/Max/Unit
    { label: 'Calibration range',             span: 3  }, // Min/Max/Unit
    { label: '',                              span: 1  }, // Remarks
  ],
  columns: [
    { key: 'tag_number',         header: 'Tag No.',         width: 18, mono: true,
      accessor: i => {
        const t = _str(i.tag_number).trim();
        return _isEmpty(t) ? '' : t.toUpperCase();
      } },
    { key: 'instrument_type',    header: 'Instrument Type', width: 24,
      accessor: i => {
        const cur = _str(i.instrument_type).trim();
        const isa = _onshoreIsa(i.tag_number);
        const verbose = _ADNOC_ONSHORE_TYPE_LABELS[isa];
        if (_isEmpty(cur)) return verbose || '';
        // Upgrade bare ISA code (e.g. "FT") to verbose label.
        if (verbose && cur.toUpperCase() === isa) return verbose;
        return cur;
      } },
    { key: 'service_description',header: 'Service Description', width: 40,
      accessor: i => _str(i.service_description).trim() },
    { key: 'location',           header: 'Location',        width: 12,
      accessor: i => _get(i, 'location') },
    { key: 'equipment_or_line',  header: 'Equipment / Line No.', width: 26, mono: true,
      accessor: _onshoreEqOrLine },
    // Pure line-number column — reuses the Gas-style accessor (no equipment fallback).
    { key: 'pure_line_no',       header: _GAS_PURE_LINE_NO_LABEL, width: _GAS_PURE_LINE_NO_WIDTH,
      mono: true, align: 'center', accessor: _gasPurelyLineNumber },
    { key: 'pid_no',             header: 'P&ID No.',        width: 24, mono: true,
      accessor: i => _get(i, 'pid_no') },
    { key: 'io_type',            header: 'I/O Type',        width:  8, align: 'center',
      accessor: i => _empty(i.io_type) },
    { key: 'is_nis',             header: 'IS/NIS',          width:  8, align: 'center',
      accessor: i => _empty(i.is_nis) },
    { key: 'system',             header: 'System',          width: 10, align: 'center',
      accessor: i => _empty(i.system) },
    { key: 'device_status',      header: 'Device Status',   width: 10, align: 'center',
      accessor: i => _empty(i.device_status ?? 'New') },
    // Inst range
    { key: 'inst_range_min',  header: 'Min',  sub: 'Inst range', width: 8, align: 'center',
      accessor: i => _get(i, 'inst_range_min') },
    { key: 'inst_range_max',  header: 'Max',  sub: 'Inst range', width: 8, align: 'center',
      accessor: i => _get(i, 'inst_range_max') },
    { key: 'inst_range_unit', header: 'Unit', sub: 'Inst range', width: 8, align: 'center',
      accessor: i => _get(i, 'inst_range_unit') },
    // Calibration range — reuses the same backend keys as ADNOC Gas to
    // maximise extractor reuse, but the column headings stay distinct.
    { key: 'calibration_min',  header: 'Min',  sub: 'Calibration range', width: 8, align: 'center',
      accessor: i => _get(i, 'calibration_min') },
    { key: 'calibration_max',  header: 'Max',  sub: 'Calibration range', width: 8, align: 'center',
      accessor: i => _get(i, 'calibration_max') },
    { key: 'calibration_unit', header: 'Unit', sub: 'Calibration range', width: 8, align: 'center',
      accessor: i => _get(i, 'calibration_unit') },
    { key: 'remarks',         header: 'Remarks', width: 28,
      accessor: i => _empty(i.instrument_remark ?? i.notes) },
  ],
};

const _ADNOC_ONSHORE_EDITABLE_FIELDS = [
  // Identification
  { key: 'tag_number',          label: 'Tag No.',              type: 'text',     group: 'Identification' },
  { key: 'instrument_type',     label: 'Instrument Type',      type: 'text',     group: 'Identification',
    hint: 'Verbose label, e.g. "Flow Transmitter", "Level Transmitter (GWR)".' },
  { key: 'pid_no',              label: 'P&ID No.',             type: 'text',     group: 'Identification' },

  // Service & process
  { key: 'service_description', label: 'Service Description',  type: 'textarea', group: 'Service & Process' },
  { key: 'line_number',         label: 'Line Number',          type: 'text',     group: 'Service & Process' },
  { key: 'equipment_number',    label: 'Equipment Number',     type: 'text',     group: 'Service & Process' },

  // Location & I/O
  { key: 'location',            label: 'Location',             type: 'select',   options: _ADNOC_ONSHORE_LOCATION_OPTIONS, group: 'Location & I/O' },
  { key: 'io_type',             label: 'I/O Type',             type: 'select',   options: _ADNOC_ONSHORE_IO_OPTIONS,       group: 'Location & I/O' },
  { key: 'is_nis',              label: 'IS / NIS',             type: 'select',   options: _ADNOC_ONSHORE_IS_NIS_OPTIONS,   group: 'Location & I/O' },
  { key: 'system',              label: 'System',               type: 'select',   options: _ADNOC_ONSHORE_SYSTEM_OPTIONS,   group: 'Location & I/O' },
  { key: 'device_status',       label: 'Device Status',        type: 'select',   options: _ADNOC_ONSHORE_STATUS_OPTIONS,   group: 'Location & I/O' },
  { key: 'fail_safe',           label: 'Fail-Safe',            type: 'select',   options: _ADNOC_ONSHORE_FAILSAFE_OPTIONS, group: 'Location & I/O' },

  // Instrument range (Note-5)
  { key: 'inst_range_min',      label: 'Inst Range Min',       type: 'text',     group: 'Inst Range' },
  { key: 'inst_range_max',      label: 'Inst Range Max',       type: 'text',     group: 'Inst Range' },
  { key: 'inst_range_unit',     label: 'Inst Range Unit',      type: 'text',     group: 'Inst Range',
    hint: 'e.g. mmH₂O, barg, °C, mm, %' },

  // Calibration range
  { key: 'calibration_min',     label: 'Calibration Min',      type: 'text',     group: 'Calibration Range' },
  { key: 'calibration_max',     label: 'Calibration Max',      type: 'text',     group: 'Calibration Range' },
  { key: 'calibration_unit',    label: 'Calibration Unit',     type: 'text',     group: 'Calibration Range' },

  // Notes / remarks
  { key: 'instrument_remark',   label: 'Remarks',              type: 'textarea', group: 'Notes' },
  { key: 'notes',               label: 'Notes',                type: 'textarea', group: 'Notes' },
];

/** Public registry — exported so the host page can render the right template. */
export const INSTRUMENT_TEMPLATES = {
  default:       { ..._DEFAULT_TEMPLATE,        editableFields: _DEFAULT_EDITABLE_FIELDS        },
  adnoc_gas:     { ..._ADNOC_GAS_TEMPLATE,      editableFields: _ADNOC_GAS_EDITABLE_FIELDS      },
  adnoc_onshore: { ..._ADNOC_ONSHORE_TEMPLATE,  editableFields: _ADNOC_ONSHORE_EDITABLE_FIELDS  },
};

/** Resolve the template for a given project category id (with safe fallback). */
export const getInstrumentTemplate = (categoryId) =>
  INSTRUMENT_TEMPLATES[categoryId] || INSTRUMENT_TEMPLATES.default;

// ──────────────────────────────────────────────────────────────────────────────
// STORAGE ADAPTER — swap for HTTP in Phase 2
// ──────────────────────────────────────────────────────────────────────────────

/** Whitelisted keys that are safe to persist for a project. Keep in sync
 *  with `PROJECT_EDITABLE_FIELDS` plus housekeeping fields. */
const SERIALIZABLE_PROJECT_KEYS = [
  'id', 'category',
  'name', 'description', 'code', 'client', 'contractor', 'location',
  'phase_stage', 'target_completion',
  'created_at', 'updated_at', 'archived',
];

/** Strip everything that isn't in the whitelist (defensive — guards against
 *  stray React events / DOM nodes accidentally finding their way in). */
const sanitizeProject = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  for (const k of SERIALIZABLE_PROJECT_KEYS) {
    const v = raw[k];
    if (v === undefined || v === null) continue;
    const t = typeof v;
    if (t === 'string' || t === 'number' || t === 'boolean') {
      out[k] = v;
    }
  }
  return out;
};

const storage = {
  loadAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      // Sanitize on load too — recovers gracefully from any prior bad write.
      return Array.isArray(parsed)
        ? parsed.map(sanitizeProject).filter(Boolean)
        : [];
    } catch (_) { return []; }
  },
  saveAll(list) {
    try {
      const safe = (Array.isArray(list) ? list : []).map(sanitizeProject).filter(Boolean);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    } catch (err) {
      console.warn('[InstrumentProjects] saveAll failed:', err?.message);
    }
  },
  loadActiveId() {
    return localStorage.getItem(ACTIVE_KEY) || null;
  },
  saveActiveId(id) {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else    localStorage.removeItem(ACTIVE_KEY);
  },
};

// Cryptographically-light id generator (Phase 1 only)
const newId = () =>
  `prj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const categoryById = (id) =>
  INSTRUMENT_PROJECT_CATEGORIES.find((c) => c.id === id) || INSTRUMENT_PROJECT_CATEGORIES[0];

// ──────────────────────────────────────────────────────────────────────────────
// PUBLIC HOOK — used by host page to read the active project
// ──────────────────────────────────────────────────────────────────────────────

export function useInstrumentProjects() {
  const [projects, setProjects] = useState(() => storage.loadAll());
  const [activeId, setActiveId] = useState(() => storage.loadActiveId());

  // Persist on every change
  useEffect(() => { storage.saveAll(projects); }, [projects]);
  useEffect(() => { storage.saveActiveId(activeId); }, [activeId]);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeId) || null,
    [projects, activeId]
  );

  const upsertProject = useCallback((project) => {
    const safe = sanitizeProject(project);
    if (!safe) return;
    setProjects((prev) => {
      const existing = prev.findIndex((p) => p.id === safe.id);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { ...next[existing], ...safe, updated_at: new Date().toISOString() };
        return next;
      }
      return [
        ...prev,
        {
          ...safe,
          id: safe.id || newId(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          archived: false,
        },
      ];
    });
  }, []);

  const archiveProject = useCallback((id) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, archived: true } : p)));
    setActiveId((cur) => (cur === id ? null : cur));
  }, []);

  const deleteProject = useCallback((id) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setActiveId((cur) => (cur === id ? null : cur));
  }, []);

  const restoreProject = useCallback((id) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, archived: false } : p)));
  }, []);

  return {
    projects,
    activeProject,
    activeId,
    setActiveId,
    upsertProject,
    archiveProject,
    deleteProject,
    restoreProject,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// CATEGORY BADGE
// ──────────────────────────────────────────────────────────────────────────────

export function CategoryBadge({ categoryId, size = 'sm' }) {
  const cat = categoryById(categoryId);
  const sz = size === 'lg' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[10px]';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-bold uppercase tracking-wider ${sz} ${cat.badgeBg} ${cat.badgeText} ${cat.badgeBorder}`}>
      <span aria-hidden>{cat.icon}</span>
      <span>{cat.label}</span>
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// PROJECT BANNER — always-visible context strip
// ──────────────────────────────────────────────────────────────────────────────

export function ProjectBanner({ activeProject, onOpenManager }) {
  const cat = activeProject ? categoryById(activeProject.category) : null;
  return (
    <div className={`relative mb-6 overflow-hidden rounded-2xl shadow-md border ${
      activeProject
        ? 'border-white/20'
        : 'border-amber-200 bg-amber-50'
    }`}>
      {activeProject ? (
        <div className={`bg-gradient-to-r ${cat.accent} p-5`}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="shrink-0 h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center text-2xl">
                {cat.icon}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/25 text-white border border-white/30">
                    Active Project
                  </span>
                  <CategoryBadge categoryId={activeProject.category} />
                </div>
                <h2 className="text-xl font-bold text-white truncate">{activeProject.name}</h2>
                <div className="flex flex-wrap gap-3 text-xs text-white/85 mt-1">
                  {activeProject.code && (
                    <span className="inline-flex items-center gap-1">
                      <IdentificationIcon className="h-3.5 w-3.5" /> {activeProject.code}
                    </span>
                  )}
                  {activeProject.client && (
                    <span className="inline-flex items-center gap-1">
                      <BuildingOffice2Icon className="h-3.5 w-3.5" /> {activeProject.client}
                    </span>
                  )}
                  {activeProject.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPinIcon className="h-3.5 w-3.5" /> {activeProject.location}
                    </span>
                  )}
                  {activeProject.phase_stage && (
                    <span className="inline-flex items-center gap-1">
                      <SparklesIcon className="h-3.5 w-3.5" /> {activeProject.phase_stage}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onOpenManager}
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-white/15 backdrop-blur-sm border border-white/30 rounded-lg hover:bg-white/25 transition-all"
            >
              <ChevronUpDownIcon className="h-4 w-4" /> Switch / Manage
            </button>
          </div>
        </div>
      ) : (
        <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="shrink-0 h-12 w-12 rounded-xl bg-amber-200/60 border border-amber-300 flex items-center justify-center">
              <FolderPlusIcon className="h-6 w-6 text-amber-700" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-200 text-amber-900 border border-amber-300">
                  Setup Required
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white text-amber-700 border border-amber-300">
                  Phase 1
                </span>
              </div>
              <h2 className="text-lg font-bold text-amber-900">No active project selected</h2>
              <p className="text-sm text-amber-800 mt-0.5">
                Create or select a project to associate every extraction with the right
                ADNOC Onshore or ADNOC Gas asset.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenManager}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all shadow-md"
          >
            <FolderPlusIcon className="h-5 w-5" /> Set Up Project
          </button>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// PROJECT SETUP PANEL — primary "Step 1" card shown above the workflow
// ──────────────────────────────────────────────────────────────────────────────

const SETUP_FIELD_ICONS = {
  IdentificationIcon,
  BuildingOffice2Icon,
  UserGroupIcon,
  MapPinIcon,
  SparklesIcon,
  CalendarDaysIcon,
};

export function ProjectSetupPanel({
  activeProject,
  projects = [],
  onOpenManager,
  onCreateNew,
  onSelectProject,
  onQuickCreate,           // (data) => void — used by inline mini-form
  stepNumber = 1,
  title = 'Project Setup',
}) {
  const cat = activeProject ? categoryById(activeProject.category) : null;
  const liveProjects = projects.filter((p) => !p.archived);

  // ── ACTIVE STATE ───────────────────────────────────────────────────────
  if (activeProject) {
    const infoRows = PROJECT_SETUP_INFO_FIELDS
      .map((f) => ({ ...f, value: activeProject[f.key] }))
      .filter((row) => row.value);

    return (
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 mb-6 overflow-hidden">
        {/* Step header */}
        <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-3 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <span className="h-6 w-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center">
              {stepNumber}
            </span>
            {title}
          </h2>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircleIcon className="h-3.5 w-3.5" /> Active
          </span>
        </div>

        {/* Coloured project header */}
        <div className={`bg-gradient-to-r ${cat.accent} p-5`}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="shrink-0 h-14 w-14 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center text-3xl">
                {cat.icon}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <CategoryBadge categoryId={activeProject.category} />
                </div>
                <h3 className="text-xl font-bold text-white truncate">{activeProject.name}</h3>
                {activeProject.description && (
                  <p className="text-sm text-white/85 mt-1 line-clamp-2">{activeProject.description}</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                type="button"
                onClick={onOpenManager}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-white bg-white/15 backdrop-blur-sm border border-white/30 rounded-lg hover:bg-white/25 transition-all"
                title="Switch active project or edit details"
              >
                <ChevronUpDownIcon className="h-4 w-4" /> Switch / Edit
              </button>
              {onCreateNew && (
                <button
                  type="button"
                  onClick={onCreateNew}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-white bg-white/15 backdrop-blur-sm border border-white/30 rounded-lg hover:bg-white/25 transition-all"
                  title="Create a new project"
                >
                  <FolderPlusIcon className="h-4 w-4" /> New
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Project info grid */}
        {infoRows.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-5 bg-gradient-to-br from-slate-50/60 to-purple-50/30">
            {infoRows.map((row) => {
              const Icon = SETUP_FIELD_ICONS[row.icon] || IdentificationIcon;
              return (
                <div key={row.key} className="flex items-start gap-3 p-3 rounded-lg bg-white border border-gray-100 shadow-sm">
                  <Icon className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{row.label}</p>
                    <p className="text-sm font-medium text-gray-800 truncate">{row.value}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── EMPTY STATE — single inline mini-form (radically simplified) ────────
  return (
    <div className="bg-white rounded-2xl shadow-md border border-amber-200 mb-6 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-3 border-b border-amber-100">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <span className="h-6 w-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center">
            {stepNumber}
          </span>
          {title}
        </h2>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
          Setup Required
        </span>
      </div>

      <div className="p-6 bg-gradient-to-br from-amber-50/40 to-orange-50/20">
        <QuickCreateForm
          onCreate={(data) => onQuickCreate?.(data)}
          existingProjects={liveProjects}
          onPickExisting={(id) => onSelectProject?.(id)}
          onOpenManager={onOpenManager}
        />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// QUICK CREATE FORM — inline single-row form, the simplest possible UX
// ──────────────────────────────────────────────────────────────────────────────

function QuickCreateForm({ onCreate, existingProjects = [], onPickExisting, onOpenManager }) {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(INSTRUMENT_PROJECT_CATEGORIES[0].id);
  const [error, setError] = useState(null);

  const submit = (e) => {
    e?.preventDefault?.();
    const trimmed = (name || '').trim();
    if (!trimmed) { setError('Enter a project name to continue.'); return; }
    if (trimmed.length > PROJECT_FORM_LIMITS.nameMax) {
      setError(`Project name must be ${PROJECT_FORM_LIMITS.nameMax} characters or less.`); return;
    }
    setError(null);
    onCreate?.({ name: trimmed, category: categoryId });
    setName('');
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {/* One-line input + category + button */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={name}
          maxLength={PROJECT_FORM_LIMITS.nameMax}
          onChange={(e) => { setName(e.target.value); if (error) setError(null); }}
          placeholder="Name your project (e.g. SAHIL Phase 3 — Pig Receiver)"
          autoFocus
          className="flex-1 px-3.5 py-2.5 text-sm border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 bg-white"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg hover:shadow-md transition-all whitespace-nowrap"
        >
          <FolderPlusIcon className="h-4 w-4" /> Create
        </button>
      </div>

      {/* Category quick-toggle (soft-coded, compact pills) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Category:</span>
        {INSTRUMENT_PROJECT_CATEGORIES.map((c) => {
          const active = categoryId === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border-2 text-xs font-bold transition-all ${
                active
                  ? `bg-gradient-to-r ${c.accent} text-white border-transparent shadow`
                  : `bg-white text-slate-700 ${c.badgeBorder} hover:shadow-sm`
              }`}
            >
              <span>{c.icon}</span> {c.label}
              {active && <CheckCircleIcon className="h-3.5 w-3.5" />}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          ⚠ {error}
        </div>
      )}

      {/* Footer — pick an existing project or open full manager */}
      <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-slate-500">
        <span>💡 Press Enter to create. You can add code, client, location later via Edit.</span>
        {existingProjects.length > 0 && (
          <>
            <span className="text-slate-300">•</span>
            <select
              onChange={(e) => e.target.value && onPickExisting?.(e.target.value)}
              defaultValue=""
              className="px-2 py-1 border border-slate-200 rounded-md bg-white text-slate-700 focus:ring-1 focus:ring-purple-400 focus:outline-none"
            >
              <option value="" disabled>Pick existing…</option>
              {existingProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {categoryById(p.category).label} · {p.name}
                </option>
              ))}
            </select>
          </>
        )}
        {onOpenManager && (
          <>
            <span className="text-slate-300">•</span>
            <button
              type="button"
              onClick={onOpenManager}
              className="text-purple-700 font-semibold hover:underline"
            >
              Manage all projects →
            </button>
          </>
        )}
      </div>
    </form>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// PROJECT FORM (used in Create / Edit modal)
// ──────────────────────────────────────────────────────────────────────────────

function ProjectForm({ initial, onSubmit, onCancel, mode = 'create' }) {
  const [form, setForm] = useState(() => ({
    category: INSTRUMENT_PROJECT_CATEGORIES[0].id,
    name: '', code: '', client: '', contractor: '',
    location: '', phase_stage: 'Detailed Design', target_completion: '',
    description: '',
    ...(initial || {}),
  }));
  const [error, setError] = useState(null);
  // PMS-style: when caller pre-picked a category, collapse the picker.
  const [showCategoryPicker, setShowCategoryPicker] = useState(
    !(initial && initial.category)
  );

  const update = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  // Soft-coded field visibility — keep Create simple (à la PMS / PID Verification)
  const visibleFields = PROJECT_EDITABLE_FIELDS.filter((f) =>
    f.phase === 'both' || f.phase === mode
  );

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    for (const f of visibleFields) {
      if (f.required && !String(form[f.key] || '').trim()) {
        setError(`${f.label} is required.`);
        return;
      }
    }
    if ((form.name || '').length > PROJECT_FORM_LIMITS.nameMax) {
      setError(`Project name must be ${PROJECT_FORM_LIMITS.nameMax} characters or less.`);
      return;
    }
    setError(null);
    onSubmit(form);
  };

  const selectedCat = categoryById(form.category);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Compact category strip (PMS-style) — picker hidden by default when preset */}
      {!showCategoryPicker ? (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Category:
          </span>
          <CategoryBadge categoryId={form.category} size="lg" />
          <span className="text-xs text-slate-500 truncate flex-1">
            {selectedCat.description}
          </span>
          {mode === 'create' && (
            <button
              type="button"
              onClick={() => setShowCategoryPicker(true)}
              className="text-xs font-semibold text-purple-700 hover:text-purple-900 hover:underline whitespace-nowrap"
            >
              Change
            </button>
          )}
        </div>
      ) : (
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
            Category <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {INSTRUMENT_PROJECT_CATEGORIES.map((cat) => {
              const selected = form.category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => { update('category', cat.id); setShowCategoryPicker(false); }}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border-2 transition-all text-left ${
                    selected
                      ? `bg-gradient-to-br ${cat.accent} text-white border-transparent shadow-sm`
                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <span className="text-lg">{cat.icon}</span>
                  <span className="font-bold text-sm flex-1">{cat.label}</span>
                  {selected && <CheckCircleIcon className="h-4 w-4" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Dynamic fields — PMS-like single-column layout for create simplicity */}
      <div className="space-y-4">
        {visibleFields.map((f) => {
          const isName = f.key === 'name';
          const isDesc = f.key === 'description';
          const limit  = isName ? PROJECT_FORM_LIMITS.nameMax
                       : isDesc ? PROJECT_FORM_LIMITS.descriptionMax
                       : null;
          const value = form[f.key] || '';
          return (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {f.label}
                {f.required ? <span className="text-rose-500"> *</span>
                            : <span className="text-slate-400 font-normal"> (optional)</span>}
              </label>
              {f.type === 'textarea' ? (
                <textarea
                  rows={3}
                  value={value}
                  maxLength={limit || undefined}
                  onChange={(e) => { update(f.key, e.target.value); if (error) setError(null); }}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all resize-none"
                />
              ) : f.type === 'select' ? (
                <select
                  value={value}
                  onChange={(e) => update(f.key, e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 focus:border-purple-400"
                >
                  {f.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : (
                <input
                  type={f.type}
                  value={value}
                  maxLength={limit || undefined}
                  onChange={(e) => { update(f.key, e.target.value); if (error) setError(null); }}
                  placeholder={f.placeholder}
                  autoFocus={f.autoFocus && mode === 'create'}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 focus:border-purple-400"
                />
              )}
              {(isName || isDesc) && (
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-slate-400">
                    {isName
                      ? 'A clear, recognisable name helps you find it later.'
                      : 'Project tag, plant area, revision notes…'}
                  </span>
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    {value.length}/{limit}
                  </span>
                </div>
              )}
              {f.helpText && !isName && !isDesc && (
                <p className="text-[10px] text-slate-400 mt-1 leading-snug">{f.helpText}</p>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          ⚠ {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
        >
          Cancel
        </button>
        <button
          type="submit"
          onClick={handleSubmit}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:shadow-lg text-sm font-semibold"
        >
          {mode === 'edit' ? 'Save Changes' : 'Create Project'}
        </button>
      </div>
    </form>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// PROJECT MANAGER MODAL — list + filter + create + edit
// ──────────────────────────────────────────────────────────────────────────────

export function ProjectManagerModal({
  open, onClose,
  projects, activeId, setActiveId,
  upsertProject, archiveProject, restoreProject, deleteProject,
  initialView,        // optional 'list' | 'create' — overrides smart default
  initialCategory,    // optional category id used to seed Create form
}) {
  const [view, setView] = useState('list'); // 'list' | 'create' | 'edit'
  const [editing, setEditing] = useState(null);
  const [filterCat, setFilterCat] = useState('all'); // 'all' | category id
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [createSeed, setCreateSeed] = useState(null); // partial form preset for Create

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      setView('list');
      setEditing(null);
      setSearch('');
      setCreateSeed(null);
    } else {
      // Smart UX: caller-driven view → fallback to list/create based on data
      const hasAny = projects.some((p) => !p.archived);
      const next = initialView || (hasAny ? 'list' : 'create');
      setView(next);
      setCreateSeed(initialCategory ? { category: initialCategory } : null);
    }
  }, [open]);  // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const filtered = projects.filter((p) => {
    if (!showArchived && p.archived) return false;
    if (showArchived && !p.archived) return false;
    if (filterCat !== 'all' && p.category !== filterCat) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        (p.name || '').toLowerCase().includes(s) ||
        (p.code || '').toLowerCase().includes(s) ||
        (p.client || '').toLowerCase().includes(s)
      );
    }
    return true;
  });

  const handleCreate = (data) => {
    const proj = { ...data, id: newId() };
    upsertProject(proj);
    setActiveId(proj.id);
    setView('list');
    // Close the modal so the user lands back on the page with the new
    // project active — matches PMS / PID Verification UX.
    if (typeof onClose === 'function') onClose();
  };

  const handleEdit = (data) => {
    upsertProject({ ...editing, ...data });
    setEditing(null);
    setView('list');
    if (typeof onClose === 'function') onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white flex items-center gap-3">
          <FolderIcon className="h-6 w-6" />
          <div className="flex-1">
            <h2 className="text-lg font-bold">Instrument Project Manager</h2>
            <p className="text-xs text-purple-100">
              {view === 'list' && 'Select an active project, or create a new one for ADNOC Onshore / ADNOC Gas.'}
              {view === 'create' && 'Create a new project — fields drive every downstream extraction.'}
              {view === 'edit' && `Editing: ${editing?.name}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
            title="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {view === 'list' && (
            <>
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <button
                  onClick={() => setView('create')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg text-sm font-semibold hover:shadow-md"
                >
                  <FolderPlusIcon className="h-4 w-4" /> New Project
                </button>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name / code / client…"
                  className="flex-1 min-w-[200px] px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-400"
                />
                <button
                  onClick={() => setShowArchived((s) => !s)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border ${
                    showArchived
                      ? 'bg-slate-700 text-white border-slate-700'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <ArchiveBoxIcon className="h-4 w-4" />
                  {showArchived ? 'Showing Archived' : 'Active Only'}
                </button>
              </div>

              {/* Category filter chips */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => setFilterCat('all')}
                  className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    filterCat === 'all'
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  All ({projects.filter((p) => showArchived ? p.archived : !p.archived).length})
                </button>
                {INSTRUMENT_PROJECT_CATEGORIES.map((cat) => {
                  const count = projects.filter((p) =>
                    p.category === cat.id && (showArchived ? p.archived : !p.archived)
                  ).length;
                  const selected = filterCat === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setFilterCat(cat.id)}
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${
                        selected
                          ? `bg-gradient-to-r ${cat.accent} text-white border-transparent`
                          : `${cat.badgeBg} ${cat.badgeText} ${cat.badgeBorder} hover:opacity-80`
                      }`}
                    >
                      <span>{cat.icon}</span> {cat.label} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Project list */}
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <FolderIcon className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm font-medium">
                    {projects.length === 0
                      ? 'No projects yet — create your first one to get started.'
                      : 'No projects match the current filter.'}
                  </p>
                  {projects.length === 0 && (
                    <button
                      onClick={() => setView('create')}
                      className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg text-sm font-semibold"
                    >
                      <FolderPlusIcon className="h-4 w-4" /> Create First Project
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filtered.map((p) => {
                    const cat = categoryById(p.category);
                    const isActive = p.id === activeId;
                    return (
                      <div
                        key={p.id}
                        className={`relative rounded-xl border-2 p-4 transition-all ${
                          isActive
                            ? 'border-purple-400 bg-purple-50/40 shadow-md'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        } ${p.archived ? 'opacity-70' : ''}`}
                      >
                        {isActive && (
                          <span className="absolute -top-2 left-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-600 text-white shadow">
                            <CheckCircleIcon className="h-3 w-3" /> Active
                          </span>
                        )}
                        <div className="flex items-start gap-3 mb-2">
                          <div className={`shrink-0 h-10 w-10 rounded-lg bg-gradient-to-br ${cat.accent} flex items-center justify-center text-lg shadow-sm`}>
                            {cat.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-slate-900 truncate">{p.name}</div>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              <CategoryBadge categoryId={p.category} />
                              {p.code && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                  {p.code}
                                </span>
                              )}
                              {p.phase_stage && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                                  {p.phase_stage}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-slate-600 space-y-0.5 mb-3">
                          {p.client && (
                            <div className="flex items-center gap-1.5"><UserGroupIcon className="h-3.5 w-3.5 text-slate-400" /> {p.client}</div>
                          )}
                          {p.location && (
                            <div className="flex items-center gap-1.5"><MapPinIcon className="h-3.5 w-3.5 text-slate-400" /> {p.location}</div>
                          )}
                          {p.target_completion && (
                            <div className="flex items-center gap-1.5"><CalendarDaysIcon className="h-3.5 w-3.5 text-slate-400" /> Due {p.target_completion}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                          {!p.archived && !isActive && (
                            <button
                              onClick={() => { setActiveId(p.id); onClose(); }}
                              className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-purple-600 text-white rounded-md text-xs font-semibold hover:bg-purple-700"
                            >
                              <CheckCircleIcon className="h-3.5 w-3.5" /> Set Active
                            </button>
                          )}
                          {isActive && (
                            <span className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-emerald-100 text-emerald-700 rounded-md text-xs font-semibold border border-emerald-200">
                              <CheckCircleIcon className="h-3.5 w-3.5" /> Currently Active
                            </span>
                          )}
                          <button
                            onClick={() => { setEditing(p); setView('edit'); }}
                            className="px-2 py-1.5 bg-amber-500 text-white rounded-md text-xs font-semibold hover:bg-amber-600"
                            title="Edit"
                          >
                            <PencilSquareIcon className="h-3.5 w-3.5" />
                          </button>
                          {p.archived ? (
                            <>
                              <button
                                onClick={() => restoreProject(p.id)}
                                className="px-2 py-1.5 bg-blue-500 text-white rounded-md text-xs font-semibold hover:bg-blue-600"
                                title="Restore"
                              >
                                ↺
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm(`Permanently delete "${p.name}"? This cannot be undone.`)) {
                                    deleteProject(p.id);
                                  }
                                }}
                                className="px-2 py-1.5 bg-rose-600 text-white rounded-md text-xs font-semibold hover:bg-rose-700"
                                title="Delete permanently"
                              >
                                <TrashIcon className="h-3.5 w-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => archiveProject(p.id)}
                              className="px-2 py-1.5 bg-slate-500 text-white rounded-md text-xs font-semibold hover:bg-slate-600"
                              title="Archive"
                            >
                              <ArchiveBoxIcon className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {view === 'create' && (
            <ProjectForm
              mode="create"
              initial={createSeed || undefined}
              onSubmit={handleCreate}
              onCancel={() => setView('list')}
            />
          )}

          {view === 'edit' && editing && (
            <ProjectForm
              mode="edit"
              initial={editing}
              onSubmit={handleEdit}
              onCancel={() => { setView('list'); setEditing(null); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
