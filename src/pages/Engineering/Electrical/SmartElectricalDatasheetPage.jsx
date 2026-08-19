import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DocumentArrowUpIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  XCircleIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  CheckCircleIcon,
  TableCellsIcon,
  SparklesIcon,
  CpuChipIcon,
  BoltIcon,
  CloudArrowUpIcon,
  ChartBarIcon,
  ClockIcon,
  ShareIcon,
  ChatBubbleLeftRightIcon,
  PencilSquareIcon,
  ArchiveBoxIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  PlusCircleIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import electricalDatasheetService from '../../../services/electricalDatasheet.service';
import apiClient from '../../../services/api.service';
import { API_TIMEOUT_UPLOAD } from '../../../config/api.config';

// ─────────────────────────────────────────────────────────────────────────────
// SOFT-CODED THEME — Electrical Engineering × AI Automation
// Change values here to restyle the entire page
// ─────────────────────────────────────────────────────────────────────────────
const THEME = {
  // Primary brand gradient — electric blue → cyan → amber (live wire feel)
  brandGradient:    'from-blue-600 via-cyan-500 to-amber-400',
  brandGradientHover: 'from-blue-700 via-cyan-600 to-amber-500',
  // Secondary AI accent (used for AI-specific elements)
  aiGradient:       'from-cyan-500 via-blue-500 to-indigo-600',
  // Page background — cool electrical white-blue
  pageBg:           'bg-gradient-to-br from-slate-50 via-sky-50 to-blue-50',
  // Glass card style — high-tech control-panel look
  glass:            'bg-white/85 backdrop-blur-xl border border-blue-100 shadow-xl shadow-blue-100/40',
  glassHover:       'hover:bg-white hover:border-cyan-300',
  // Text palette
  textPrimary:      'text-slate-900',
  textSecondary:    'text-slate-700',
  textMuted:        'text-slate-500',
  // Accent rings & glows (electric cyan)
  glow:             'shadow-[0_0_30px_-5px_rgba(6,182,212,0.45)]',
  glowStrong:       'shadow-[0_8px_40px_-5px_rgba(59,130,246,0.5)]',
  ringFocus:        'focus:ring-2 focus:ring-cyan-400/60 focus:border-cyan-400',
  // Voltage indicator colors
  liveColor:        'rgb(245, 158, 11)',   // amber — phase / live
  neutralColor:     'rgb(59, 130, 246)',   // blue  — neutral
  earthColor:       'rgb(16, 185, 129)',   // green — earth
};

// Per-equipment color palette (electrical disciplines)
const EQUIPMENT_COLORS = {
  transformer:    { ring: 'ring-blue-400/50',    grad: 'from-blue-500 to-cyan-500',     glow: 'shadow-blue-500/40',    voltage: '11kV / 0.4kV' },
  dg_set:         { ring: 'ring-emerald-400/50', grad: 'from-emerald-500 to-green-500', glow: 'shadow-emerald-500/40', voltage: '0.4kV · Diesel' },
  mv_switchgear:  { ring: 'ring-purple-400/50',  grad: 'from-purple-500 to-fuchsia-500',glow: 'shadow-purple-500/40',  voltage: '11kV / 33kV' },
  lv_switchgear:  { ring: 'ring-amber-400/50',   grad: 'from-amber-500 to-orange-500',  glow: 'shadow-amber-500/40',   voltage: '0.4kV LV' },
  ac_ups:         { ring: 'ring-rose-400/50',    grad: 'from-rose-500 to-red-500',      glow: 'shadow-rose-500/40',    voltage: '230V AC' },
  dc_ups:         { ring: 'ring-indigo-400/50',  grad: 'from-indigo-500 to-violet-500', glow: 'shadow-indigo-500/40',  voltage: '110V DC' },
};

// Electrical specification badges — shown in hero (soft-coded)
const ELECTRICAL_STANDARDS = [
  { code: 'IEC 60076',  label: 'Power Transformers'      },
  { code: 'IEC 62271',  label: 'HV Switchgear'           },
  { code: 'IEC 61439',  label: 'LV Assemblies'           },
  { code: 'IEEE C57',   label: 'Distribution Transformers' },
  { code: 'IEC 62040',  label: 'UPS Systems'             },
  { code: 'ADNOC AGES', label: 'Project Spec'            },
];

// AI processing stages — electrical-engineering vocabulary
const AI_PIPELINE_STAGES = [
  { id: 'upload',  label: 'Acquiring document',          icon: CloudArrowUpIcon, threshold: 0   },
  { id: 'extract', label: 'Parsing technical data',      icon: DocumentTextIcon, threshold: 30  },
  { id: 'detect',  label: 'Classifying equipment',       icon: CpuChipIcon,      threshold: 55  },
  { id: 'analyze', label: 'Energising AI inference',     icon: SparklesIcon,     threshold: 75  },
  { id: 'compose', label: 'Synthesising datasheet',      icon: TableCellsIcon,   threshold: 92  },
  { id: 'done',    label: 'Commissioned',                icon: CheckCircleIcon,  threshold: 100 },
];

// Workflow stepper labels
const WORKFLOW_STEPS = [
  { id: 1, label: 'Select Equipment' },
  { id: 2, label: 'Upload Documents' },
  { id: 3, label: 'AI Generation'    },
  { id: 4, label: 'Review & Export'  },
];


// ── Accepted upload formats (soft-coded, mirrors backend) ─────────────────
// Source of truth: backend/apps/electrical_datasheet/document_extractor.py
//   SUPPORTED_FORMATS / SUPPORTED_FORMATS_LABEL
// Keep this list in sync. Per-equipment overrides go on EQUIPMENT_TYPES via
// `acceptedFormats: { extensions: [...], label: '...' }`.
const DEFAULT_ACCEPTED_FORMATS = {
  extensions: [
    '.pdf',
    '.xlsx', '.xlsm', '.xls',
    '.docx',
    '.csv',
    '.txt',
    '.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.tif',
  ],
  label: 'PDF · Excel · Word · CSV · TXT · Images',
  mime: '*',
};

const isFileAccepted = (file, formats = DEFAULT_ACCEPTED_FORMATS) => {
  if (!file || !file.name) return false;
  const lower = file.name.toLowerCase();
  return formats.extensions.some(ext => lower.endsWith(ext));
};

// Equipment type configurations
const EQUIPMENT_TYPES = [
  {
    id: 'transformer',
    name: 'Transformers',
    description: 'Power & Distribution Transformers',
    icon: '⚡',
    color: 'blue',
    requiredFiles: ['Transformer Sizing Calculation (Power and Distribution)'],     
    optionalFiles: ['Additional Technical Documents']
  },
  {
    id: 'dg_set',
    name: 'DG Set',
    description: 'Diesel Generator Sets',
    icon: '🔌',
    color: 'green',
    requiredFiles: ['Emergency Diesel Generator (EDG) Sizing Calculation'],
    optionalFiles: ['Site Layout', 'Technical Specifications']
  },
  {
    id: 'mv_switchgear',
    name: 'MV Switchgear',
    description: 'Medium Voltage Switchgear (11kV, 33kV)',
    icon: '⚙️',
    color: 'purple',
    requiredFiles: ['SLD for 11KV Switchgear'],
    optionalFiles: ['Protection Setting', 'Technical Specs']
  },
  {
    id: 'lv_switchgear',
    name: 'LV Switchgear',
    description: 'Low Voltage Switchgear & Panels',
    icon: '🔧',
    color: 'yellow',
    requiredFiles: ['SLD Drawing', 'Load Schedule'],
    optionalFiles: ['Panel Layout', 'Cable Schedule']
  },
  {
    id: 'ac_ups',
    name: 'AC UPS',
    description: 'AC Uninterruptible Power Supply',
    icon: '🔋',
    color: 'red',
    requiredFiles: ['Load Calculation', 'System Diagram'],
    optionalFiles: ['Battery Sizing', 'Technical Specs']
  },
  {
    id: 'dc_ups',
    name: 'DC UPS',
    description: 'DC Uninterruptible Power Supply',
    icon: '⚡',
    color: 'indigo',
    requiredFiles: ['DC Load List', 'Battery Sizing'],
    optionalFiles: ['System Diagram', 'Technical Specs']
  }
];


// ─── ADNOC Transformer document — soft-coded sub-page content ─────────────
// Mirrors backend/apps/electrical_datasheet/transformer_datasheet_schema.py.
// Keep these structures in sync; everything in the UI reads from here.
const TRANSFORMER_DOC_HEADER = {
  company_name:        'Abu Dhabi Polymers Company Ltd. (Borouge)',
  location:            'RUWAIS - U.A.E.',
  project_title:       'EPC FOR BOROUGE EU3 H2 EXTRACTION UNIT PROJECT AGREEMENT NO. 4700002115',
  document_title:      'TECHNICAL DATA SHEET FOR TRANSFORMER (POWER AND DISTRIBUTION)',
  company_doc_label:   'COMPANY DOCUMENT NUMBER',
  company_doc_default: 'DS-13-574-EP-00001',
  contractor_label:    'CONTRACTOR DRAWING NUMBER',
  contractor_default:  'PA-31011-DS-13-574-EP-00001',
  rejlers_label:       'REJLERS DRAWING NUMBER',
  rejlers_default:     '5900863-EL-DAT-0001',
};

const TRANSFORMER_REVISION_HISTORY = [
  { rev: 'L', date: '10.Jan.25', section: '-', description: 'ISSUED FOR COMPANY REVIEW'  },
  { rev: 'N', date: '18.Jun.25', section: '-', description: 'APPROVED FOR ENGINEERING'   },
  { rev: 'P', date: '09.Jul.25', section: '-', description: 'APPROVED FOR PURCHASE'      },
];

const TRANSFORMER_REVISION_FOOTER = [
  'This page records the revision status of the document.',
  'All previous issues are hereby superseded.',
  'Revisions after first issues are denoted by a triangular flag with revision number adjacent to revised area.',
  'Document changes shall be made in track changes mode and reviewed before issue.',
];

const TRANSFORMER_HOLDS = [
  { rev: '1', description: 'NIL', section: '' },
];

const TRANSFORMER_INDEX = [
  { sr: '1', description: 'COVER SHEET',            sheet: '1'    },
  { sr: '2', description: 'REVISION HISTORY',       sheet: '2'    },
  { sr: '3', description: 'HOLD',                   sheet: '3'    },
  { sr: '4', description: 'TABLE OF CONTENTS',      sheet: '4'    },
  { sr: '5', description: 'TRANSFORMER DATA SHEET', sheet: '5-10' },
  { sr: '6', description: 'GENERAL NOTES',          sheet: '11'   },
];

const TRANSFORMER_ABBREVIATIONS = [
  ['***', 'VENDOR TO SPECIFY'],
  ['CT',  'CURRENT TRANSFORMER'],
  ['kA',  'KILO AMPERE'],
  ['kV',  'KILO VOLT'],
  ['kVA', 'KILO VOLT AMPERE'],
  ['NER', 'NEUTRAL EARTHING RESISTOR'],
  ['NA',  'NOT APPLICABLE'],
  ['VT',  'VOLTAGE TRANSFORMER'],
  ['W',   'WATT'],
];

const TRANSFORMER_NOTES = [
  ['1',  'TRANSFORMER DESIGN SHALL BE SUITABLE FOR PRIMARY INPUT VOLTAGE OF +/-10% AND FREQUENCY VARIATION OF +/- 2%.'],
  ['2',  'THE FOLLOWING FILTERING VALVES WITH BLANKING PLATES SHALL BE INCLUDED:'],
  ['a',  'TANK TOP AND BOTTOM'],
  ['b',  'RADIATOR TOP AND BOTTOM'],
  ['c',  'DRAIN VALVES'],
  ['3',  'ALL TRANSFORMER PROTECTION DEVICES SHALL BE PROVIDED WITH 2 SETS OF TRIP ALARM CONTACTS, ONE SET FOR SWITCHGEAR TRIP & ALARM AND ONE SET FOR SCMS.'],
  ['4',  'VENDOR TO PROVIDE CALCULATION FOR PRESSURE WITHSTAND CAPABILITY OF TERMINAL BOXES UNDER MAXIMUM FAULT CONDITION AND ARCING FAULT WITH FAULT CURRENT EQUAL TO RATED SHORT CIRCUIT CURRENT. TERMINAL BOXES SHALL BE CAPABLE OF WITHSTANDING PRESSURE UNDER WORST FAULT CONDITION.'],
  ['5',  'SPECIAL AND ROUTINE TESTS SHALL BE FULLY WITNESSED BY CLIENT\u2019S REPRESENTATIVE AND TO BE CONSIDERED AS HOLD POINT.'],
  ['6',  'THERMAL IMAGE WINDOWS SHALL BE PROVIDED AT CABLE BOXES. THE WINDOWS SHALL WITHSTAND THE PRESSURE CREATED DUE TO SHORT CIRCUIT INSIDE THE CABLE BOX. IT SHALL BE TESTED WITH TRANSFORMER CABLE BOXES.'],
  ['7',  'IN ADDITION TO APPENDIX-3 OF BGS-EE-003, "MAGNETIC BALANCE TEST" SHALL BE PERFORMED ON EACH TRANSFORMER.'],
  ['8',  'CERTIFICATION SHALL BE REQUIRED FOR TRANSFORMER OF IDENTICAL DESIGN AND RATING. OTHERWISE TESTING ONE UNIT OF AN IDENTICAL BATCH IS REQUIRED.'],
  ['9',  '"LEAK TEST" SPECIFIED IN CL. 3-g OF APPENDIX-3 OF BGE-EE-003 SHALL BE PERFORMED ON EACH TRANSFORMER & BE WITNESSED.'],
  ['10', 'ONLY MOMENTARY PARALLELING DURING SCHEDULED CHANGE OVER OR RESTORATION OF NORMAL SUPPLY.'],
  ['11', 'TRANSFORMER SHALL BE CAPABLE TO WITHSTAND SHORT TIME OVERLOADING AS PER IEC-60076-7 TABLE 3.'],
];

// Page tabs (mirrors openpyxl SHEET_TITLES)
const TRANSFORMER_PAGES = [
  { id: 'cover',    label: 'Cover Sheet',  short: 'Cover',    page: '01/11', kind: 'cover',     icon: '📄' },
  { id: 'revision', label: 'Revision',     short: 'Revision', page: '02/11', kind: 'revision',  icon: '🔁' },
  { id: 'hold',     label: 'Hold',         short: 'Hold',     page: '03/11', kind: 'hold',      icon: '⏸️' },
  { id: 'index',    label: 'Index',        short: 'Index',    page: '04/11', kind: 'index',     icon: '📑' },
  { id: 'data_125', label: '1.25 MVA',     short: '1.25MVA',  page: '05/10', kind: 'datasheet', icon: '⚡', variant: 'distribution', subtitle: '1250 kVA · 11/0.433 kV Distribution Transformer' },
  { id: 'data_25',  label: '25 MVA',       short: '25MVA',    page: '05/10', kind: 'datasheet', icon: '⚡', variant: 'power',        subtitle: '25 MVA · 33/11.5 kV Power Transformer' },
  { id: 'notes',    label: 'General Notes',short: 'Notes',    page: '11/11', kind: 'notes',     icon: '📝' },
];

// ─── ADNOC DG Set document — soft-coded sub-page content ─────────────────
// Mirrors backend/apps/electrical_datasheet/dg_set_datasheet_generator.py.
const DG_DOC_HEADER = {
  company_name:        'Abu Dhabi Polymers Company Ltd. (Borouge)',
  location:            'RUWAIS - U.A.E.',
  project_title:       'EPC FOR BOROUGE EU3 H2 EXTRACTION UNIT PROJECT AGREEMENT NO. 4700002115',
  document_title:      'TECHNICAL DATA SHEET FOR EMERGENCY DIESEL GENERATOR',
  company_doc_label:   'COMPANY DOCUMENT NUMBER',
  company_doc_default: 'DS-13-EE-403-70010',
  contractor_label:    'CONTRACTOR DOCUMENT NUMBER',
  contractor_default:  'PA-31011-DS-13-EE-403-70010',
  rejlers_label:       'REJLERS DOCUMENT NUMBER',
  rejlers_default:     '5900863-EL-DAT-0003',
};

const DG_REVISION_HISTORY = [
  { rev: 'N', date: '11.Mar.2025', section: '-', description: 'ISSUED FOR COMPANY REVIEW' },
  { rev: 'L', date: '14.May.2025', section: '-', description: 'APPROVED FOR ENGINEERING'  },
  { rev: 'P', date: '18.Jul.2025', section: '-', description: 'APPROVED FOR PURCHASE'     },
];

const DG_REVISION_FOOTER = [
  'This page records the revision status of this documents.',
  'All previous issues are hereby superseded and are to be destroyed.',
  'Revisions after first issues are denoted as follows:',
  'Document changes shall be made in track changes with a vertical line in the right-hand margin against the revision text in Blue Font.',
];

const DG_HOLDS = [
  { rev: '1', description: 'NIL', section: '-' },
];

const DG_INDEX = [
  { sr: '1', description: 'COVER SHEET',                  sheet: '1'    },
  { sr: '2', description: 'REVISION HISTORY',             sheet: '2'    },
  { sr: '3', description: 'HOLD',                         sheet: '3'    },
  { sr: '4', description: 'TABLE OF CONTENTS',            sheet: '4'    },
  { sr: '5', description: 'DIESEL GENERATOR DATA SHEET',  sheet: '5-23' },
];

const DG_ABBREVIATIONS = [
  ['***', 'VENDOR TO SPECIFY'],
  ['CT',  'CURRENT TRANSFORMER'],
  ['kA',  'KILO AMPERE'],
  ['kV',  'KILO VOLT'],
  ['kVA', 'KILO VOLT AMPERE'],
  ['NA',  'NOT APPLICABLE'],
  ['VT',  'VOLTAGE TRANSFORMER'],
  ['W',   'WATT'],
];

const DG_NOTES = []; // Template has no separate Notes sheet — kept empty (Notes tab hidden).

const DG_PAGES = [
  { id: 'cover',    label: 'Cover Sheet',     short: 'Cover',    page: '01/23', kind: 'cover',     icon: '📄' },
  { id: 'revision', label: 'Revision',        short: 'Revision', page: '02/23', kind: 'revision',  icon: '🔁' },
  { id: 'hold',     label: 'Hold',            short: 'Hold',     page: '03/23', kind: 'hold',      icon: '⏸️' },
  { id: 'index',    label: 'Index',           short: 'Index',    page: '04/23', kind: 'index',     icon: '📑' },
  { id: 'data',     label: 'DG Set Datasheet',short: 'DG Set',   page: '05/23', kind: 'datasheet', icon: '⚡', subtitle: 'Emergency Diesel Generator Set' },
];

// ─── ADNOC 11kV Switchgear document — soft-coded sub-page content ────────
// Mirrors Documents/Electrical/Datasheet/11KV_SwitchGear/DS-13-574-ES-00001.xlsm.
const MV_SWGR_DOC_HEADER = {
  company_name:        'Abu Dhabi Polymers Company Ltd. (Borouge)',
  location:            'RUWAIS - U.A.E.',
  project_title:       'EPC FOR BOROUGE EU3 H2 EXTRACTION UNIT PROJECT AGREEMENT NO. 4700002115',
  document_title:      'TECHNICAL DATA SHEET FOR 11kV SWITCHGEAR',
  company_doc_label:   'COMPANY DOCUMENT NUMBER',
  company_doc_default: 'DS-13-574-ES-00001',
  contractor_label:    'CONTRACTOR DOCUMENT NUMBER',
  contractor_default:  'PA-31011-DS-13-574-ES-00001',
  rejlers_label:       'REJLERS DOCUMENT NUMBER',
  rejlers_default:     '5900863-EL-DAT-0004',
};

const MV_SWGR_REVISION_HISTORY = [
  { rev: 'L', date: '24.Jan.2025', section: '-', description: 'ISSUED FOR COMPANY REVIEW' },
  { rev: 'N', date: '22.Mar.2025', section: '-', description: 'APPROVED FOR ENGINEERING'  },
  { rev: 'P', date: '25.Jun.2025', section: '-', description: 'APPROVED FOR PURCHASE'     },
];

const MV_SWGR_REVISION_FOOTER = [
  'This page records the revision status of this documents.',
  'All previous issues are hereby superseded and are to be destroyed.',
  'Revisions after first issues are denoted as follows:',
  'Document changes shall be made in track changes with a vertical line in the right-hand margin against the revision text in Blue Font.',
];

const MV_SWGR_HOLDS = [
  { rev: '1', description: 'NIL', section: '-' },
];

const MV_SWGR_INDEX = [
  { sr: '1', description: 'COVER SHEET',                   sheet: '1'   },
  { sr: '2', description: 'REVISION HISTORY',              sheet: '2'   },
  { sr: '3', description: 'HOLD SHEET',                    sheet: '3'   },
  { sr: '4', description: 'TABLE OF CONTENTS',             sheet: '4'   },
  { sr: '5', description: '11kV SWITCHGEAR DATA SHEET',    sheet: '5-7' },
];

const MV_SWGR_ABBREVIATIONS = [
  ['***', 'VENDOR TO SPECIFY'],
  ['CT',  'CURRENT TRANSFORMER'],
  ['kA',  'KILO AMPERE'],
  ['kV',  'KILO VOLT'],
  ['kVA', 'KILO VOLT AMPERE'],
  ['NER', 'NEUTRAL EARTHING RESISTOR'],
  ['NA',  'NOT APPLICABLE'],
  ['VT',  'VOLTAGE TRANSFORMER'],
  ['W',   'WATT'],
];

const MV_SWGR_NOTES = []; // Template has no separate Notes sheet — kept empty.

const MV_SWGR_PAGES = [
  { id: 'cover',    label: 'Cover Sheet',         short: 'Cover',     page: '1/7', kind: 'cover',     icon: '📄' },
  { id: 'revision', label: 'Revision',            short: 'Revision',  page: '2/7', kind: 'revision',  icon: '🔁' },
  { id: 'hold',     label: 'Hold',                short: 'Hold',      page: '3/7', kind: 'hold',      icon: '⏸️' },
  { id: 'index',    label: 'Index',               short: 'Index',     page: '4/7', kind: 'index',     icon: '📑' },
  { id: 'data',     label: '11kV Switchgear Datasheet', short: '11kV SWGR', page: '5/7', kind: 'datasheet', icon: '⚡', subtitle: '11kV Medium Voltage Switchgear' },
];

// Soft-coded per-equipment document schema. Add a new equipment by adding
// an entry here — the document viewer auto-renders Cover/Revision/Hold/
// Index/Notes/Datasheet tabs from the schema. The renderer is generic.
const EQUIPMENT_DOC_SCHEMAS = {
  transformer: {
    docHeader:        TRANSFORMER_DOC_HEADER,
    revisionHistory:  TRANSFORMER_REVISION_HISTORY,
    revisionFooter:   TRANSFORMER_REVISION_FOOTER,
    holds:            TRANSFORMER_HOLDS,
    index:            TRANSFORMER_INDEX,
    abbreviations:    TRANSFORMER_ABBREVIATIONS,
    notes:            TRANSFORMER_NOTES,
    pages:            TRANSFORMER_PAGES,
    coverTitleFallback: 'TECHNICAL DATASHEET FOR TRANSFORMER (POWER AND DISTRIBUTION)',
    coverSubtitleFor: (variant) => variant === 'distribution'
      ? '1250 kVA · 11/0.433 kV Distribution Transformer'
      : '25 MVA · 33/11.5 kV Power Transformer',
    bannerTitle:      'TRANSFORMER',
  },
  dg_set: {
    docHeader:        DG_DOC_HEADER,
    revisionHistory:  DG_REVISION_HISTORY,
    revisionFooter:   DG_REVISION_FOOTER,
    holds:            DG_HOLDS,
    index:            DG_INDEX,
    abbreviations:    DG_ABBREVIATIONS,
    notes:            DG_NOTES,
    pages:            DG_PAGES,
    coverTitleFallback: 'TECHNICAL DATASHEET FOR EMERGENCY DIESEL GENERATOR',
    coverSubtitleFor: () => 'Emergency Diesel Generator Set',
    bannerTitle:      'EMERGENCY DIESEL GENERATOR',
  },
  mv_switchgear: {
    docHeader:        MV_SWGR_DOC_HEADER,
    revisionHistory:  MV_SWGR_REVISION_HISTORY,
    revisionFooter:   MV_SWGR_REVISION_FOOTER,
    holds:            MV_SWGR_HOLDS,
    index:            MV_SWGR_INDEX,
    abbreviations:    MV_SWGR_ABBREVIATIONS,
    notes:            MV_SWGR_NOTES,
    pages:            MV_SWGR_PAGES,
    coverTitleFallback: 'TECHNICAL DATASHEET FOR 11KV SWITCHGEAR',
    coverSubtitleFor: () => '11kV Medium Voltage Switchgear',
    bannerTitle:      '11kV SWITCHGEAR',
  },
};

// ── Smart Datasheet workflow constants (soft-coded) ─────────────────────
const WORKFLOW_MODES = [
  { id: 'generate', label: 'Generate New', icon: SparklesIcon },
  { id: 'history',  label: 'History',      icon: ClockIcon },
];
// Columns the user may edit inline. Server enforces the same allowlist
// (see backend/apps/electrical_datasheet/smart_storage.py::EDITABLE_COLUMNS).
const EDITABLE_COLUMNS = ['required_data', 'vendor_data', 'rev'];
const AUTOSAVE_DEBOUNCE_MS = 700;
const STATUS_BADGE = {
  draft:     'bg-gray-200 text-gray-700',
  in_review: 'bg-amber-100 text-amber-800',
  issued:    'bg-emerald-100 text-emerald-800',
  archived:  'bg-red-100 text-red-700',
};
const EQUIPMENT_LABELS = {
  transformer:    'Transformer',
  dg_set:         'DG Set',
  mv_switchgear:  '11kV Switchgear',
};

// ─── Soft-coded inline-edit storage for non-tabular sub-pages ──────────────
// Cover / Revision / Hold / Index / Notes content is editable client-side and
// persisted to localStorage so the user can correct values without modifying
// the AI-generated rows pipeline (Excel export still uses the original data).
const AUX_STORAGE_PREFIX = 'radai:elec_ds_aux:';
const AUX_DRAFT_KEY      = 'draft';
// Compose a localStorage key per datasheet (or 'draft' before a save exists).
const auxStorageKey = (datasheetId) => `${AUX_STORAGE_PREFIX}${datasheetId || AUX_DRAFT_KEY}`;
// Compose a per-field key: <pageId>:<rowIdx|field>:<col?>  (col optional)
const auxKey = (pageId, rowOrField, col) =>
  col === undefined ? `${pageId}:${rowOrField}` : `${pageId}:${rowOrField}:${col}`;

// Soft-coded list of "extra revision rows" (user-added). Stored as JSON
// array of stable IDs under this key inside auxEdits/localStorage.
const REVISION_EXTRAS_KEY = auxKey('revision', 'extras');
const REVISION_EXTRA_DEFAULTS = { rev: '', date: '', section: '-', description: '' };

/**
 * Inline-editable text element for non-table contexts (e.g. Cover sheet).
 * Mirrors the spreadsheet UX: plain text at rest, click to edit, Enter/Escape
 * to commit. No box, no separate column — just like the table cells.
 */
const EditableInline = ({ valueKey, initialValue, status, onChange, className = '', placeholderClass = 'text-slate-400', as: Tag = 'span', placeholder = '—' }) => {
  const [val, setVal]         = React.useState(initialValue ?? '');
  const [editing, setEditing] = React.useState(false);
  const inputRef              = React.useRef(null);
  React.useEffect(() => { setVal(initialValue ?? ''); }, [initialValue]);
  React.useEffect(() => { if (editing && inputRef.current) inputRef.current.select(); }, [editing]);

  const dotColor = status === 'dirty'  ? 'bg-amber-400'
                 : status === 'saving' ? 'bg-cyan-400 animate-pulse'
                 : status === 'saved'  ? 'bg-emerald-500'
                 : status === 'error'  ? 'bg-red-500'
                 : status === 'local'  ? 'bg-slate-300'
                 : 'bg-transparent';

  return (
    <Tag className={`relative inline-block cursor-text ${className}`} onClick={() => !editing && setEditing(true)} title="Click to edit">
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={val}
          autoFocus
          onChange={(e) => { setVal(e.target.value); onChange(valueKey, e.target.value); }}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.target.blur(); }}
          className="w-full bg-white/90 border-0 outline-none ring-1 ring-cyan-400 rounded-sm px-1"
          style={{ font: 'inherit', color: 'inherit', textAlign: 'inherit' }}
        />
      ) : (
        <span className={val ? '' : placeholderClass}>{val || placeholder}</span>
      )}
      {dotColor !== 'bg-transparent' && (
        <span className={`absolute -top-1 -right-2 h-1.5 w-1.5 rounded-full ${dotColor}`} />
      )}
    </Tag>
  );
};

/**
 * Spreadsheet-style inline-editable table cell.
 *
 * UX (matches the ValveMTO/PMS pattern):
 *  - Looks identical to a normal `<td>` at rest — no extra column or boxed input
 *  - On click/focus, the same cell becomes a borderless input
 *  - On blur, returns to text appearance
 *  - A tiny coloured corner dot signals save state (dirty / saving / saved / error)
 *  - When `disabled` (section header rows), behaves like a plain read-only cell
 */
const EditableCell = ({ rowIdx, columnKey, initialValue, status, disabled, onChange, className, placeholderClass = 'text-slate-300', align = 'left' }) => {
  const [val, setVal]         = React.useState(initialValue || '');
  const [editing, setEditing] = React.useState(false);
  const inputRef              = React.useRef(null);

  React.useEffect(() => { setVal(initialValue || ''); }, [initialValue]);
  React.useEffect(() => { if (editing && inputRef.current) inputRef.current.select(); }, [editing]);

  if (disabled) {
    return (
      <td className={className}>
        <span className={val ? '' : placeholderClass}>{val || ''}</span>
      </td>
    );
  }

  const dotColor = status === 'dirty'  ? 'bg-amber-400'
                 : status === 'saving' ? 'bg-cyan-400 animate-pulse'
                 : status === 'saved'  ? 'bg-emerald-500'
                 : status === 'error'  ? 'bg-red-500'
                 : status === 'local'  ? 'bg-slate-300'
                 : 'bg-transparent';

  const dotTitle = status === 'saving' ? 'Saving…'
                 : status === 'saved'  ? 'Saved'
                 : status === 'error'  ? 'Save failed — check connection'
                 : status === 'local'  ? 'Edited locally (not yet persisted)'
                 : status === 'dirty'  ? 'Unsaved changes'
                 : 'Click to edit';

  const alignCls = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';

  return (
    <td
      className={`${className} relative cursor-text hover:bg-cyan-50/40`}
      onClick={() => setEditing(true)}
      title={dotTitle}
    >
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={val}
          autoFocus
          onChange={(e) => { setVal(e.target.value); onChange(rowIdx, columnKey, e.target.value); }}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.target.blur(); }}
          className={`w-full bg-white/70 border-0 outline-none ring-1 ring-cyan-400 rounded-sm px-0 m-0 ${alignCls}`}
          style={{ font: 'inherit', color: 'inherit' }}
        />
      ) : (
        <span className={`block ${alignCls} ${val ? '' : placeholderClass}`}>{val || '—'}</span>
      )}
      {dotColor !== 'bg-transparent' && (
        <span className={`absolute top-1 right-1 h-1.5 w-1.5 rounded-full ${dotColor}`} />
      )}
    </td>
  );
};

const SmartElectricalDatasheetPage = () => {
  const [searchParams] = useSearchParams();

  // Pre-select equipment from URL parameter
  useEffect(() => {
    const equipmentParam = searchParams.get('equipment');
    if (equipmentParam && EQUIPMENT_TYPES.find(eq => eq.id === equipmentParam)) {
      setSelectedEquipmentType(equipmentParam);
    }
  }, [searchParams]);

  const [selectedEquipmentType, setSelectedEquipmentType] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState({});
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisStage, setAnalysisStage] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [excelBlob, setExcelBlob] = useState(null);
  // Active sub-page when previewing a multi-sheet ADNOC document (transformer)
  const [activePage, setActivePage] = useState(TRANSFORMER_PAGES[0].id);

  // ── Smart Datasheet lifecycle state ─────────────────────────────
  const [workflowMode, setWorkflowMode] = useState('generate');
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [cellStatus, setCellStatus] = useState({}); // { 'rowIdx:col': 'dirty'|'saving'|'saved'|'error' }
  const [recheckOpen, setRecheckOpen] = useState(false);
  const [recheckLoading, setRecheckLoading] = useState(false);
  const [recheckDiff, setRecheckDiff] = useState(null);
  const [shareLink, setShareLink] = useState('');
  const [edits, setEdits] = useState({}); // local cell overrides keyed by 'rowIdx:col'

  // ── Aux content (Cover / Revision / Hold / Index / Notes) inline edits ───
  // Stored keyed by `${pageId}:${rowIdx|field}:${col?}`. Persisted in
  // localStorage per datasheet so users can refine static text without
  // touching the AI-generated row pipeline.
  const [auxEdits, setAuxEdits]   = useState({});
  const [auxStatus, setAuxStatus] = useState({});

  // Hydrate aux edits when datasheet identity changes.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(auxStorageKey(results?.datasheet_id));
      setAuxEdits(raw ? JSON.parse(raw) : {});
    } catch { setAuxEdits({}); }
    setAuxStatus({});
  }, [results?.datasheet_id]);

  // Persist + flag saved status. Keys are opaque strings.
  const handleAuxEdit = React.useCallback((key, value) => {
    setAuxStatus(prev => ({ ...prev, [key]: 'dirty' }));
    setAuxEdits(prev => {
      const next = { ...prev, [key]: value };
      try {
        window.localStorage.setItem(auxStorageKey(results?.datasheet_id), JSON.stringify(next));
        setTimeout(() => setAuxStatus(s => ({ ...s, [key]: 'saved' })), 200);
      } catch {
        setAuxStatus(s => ({ ...s, [key]: 'error' }));
      }
      return next;
    });
  }, [results?.datasheet_id]);

  // Resolver: returns user override or fallback. Soft-coded fallback chain.
  const aux = React.useCallback((key, fallback) => {
    const v = auxEdits[key];
    return v !== undefined && v !== null ? v : (fallback ?? '');
  }, [auxEdits]);

  // Load history when switching to history mode
  useEffect(() => {
    if (workflowMode !== 'history') return;
    setHistoryLoading(true);
    electricalDatasheetService
      .listGenerated()
      .then((d) => {
        const items = d?.items || d?.data?.items || d?.results || [];
        setHistoryItems(Array.isArray(items) ? items : []);
      })
      .catch(() => setHistoryItems([]))
      .finally(() => setHistoryLoading(false));
  }, [workflowMode]);

  // Open a saved datasheet from history into the existing viewer
  const openFromHistory = async (item) => {
    try {
      const payload = await electricalDatasheetService.getGenerated(item.id);
      const ds = payload?.data || payload;
      if (!ds?.id) {
        throw new Error('Invalid datasheet payload');
      }

      setSelectedEquipmentType(ds.equipment_type || '');
      setResults({
        success: true,
        equipment_type: ds.equipment_type,
        datasheet_rows: ds.rows || [],
        summary: ds.summary || {},
        extraction_metadata: ds.metadata || {},
        variant: ds.variant || 'default',
        datasheet_id: ds.id,
        excel_url: ds.excel_url,
      });
      setEdits({});
      setCellStatus({});
      setWorkflowMode('generate');
    } catch (e) {
      setError('Failed to open datasheet: ' + (e.response?.data?.error || e.message));
    }
  };

  const archiveFromHistory = async (item) => {
    if (!window.confirm(`Archive "${item.title || item.id.slice(0, 8)}"?`)) return;
    try {
      await electricalDatasheetService.archiveGenerated(item.id);
      setHistoryItems(prev => prev.filter(h => h.id !== item.id));
    } catch (e) { /* silent */ }
  };

  // Debounced cell autosave (per-cell timer)
  const cellTimers = React.useRef({});
  const handleCellEdit = (rowIdx, columnKey, value) => {
    const key = `${rowIdx}:${columnKey}`;
    setEdits(prev => ({ ...prev, [key]: value }));

    // No persisted datasheet yet → keep edit in local state only
    if (!results?.datasheet_id) {
      setCellStatus(prev => ({ ...prev, [key]: 'local' }));
      return;
    }

    setCellStatus(prev => ({ ...prev, [key]: 'dirty' }));
    if (cellTimers.current[key]) clearTimeout(cellTimers.current[key]);
    cellTimers.current[key] = setTimeout(async () => {
      setCellStatus(prev => ({ ...prev, [key]: 'saving' }));
      try {
        await electricalDatasheetService.updateCells(results.datasheet_id, [
          { row_index: rowIdx, column_key: columnKey, new_value: value },
        ]);
        setCellStatus(prev => ({ ...prev, [key]: 'saved' }));
      } catch (e) {
        setCellStatus(prev => ({ ...prev, [key]: 'error' }));
      }
    }, AUTOSAVE_DEBOUNCE_MS);
  };

  // Flush local edits once a datasheet_id appears (e.g. after persistence completes)
  useEffect(() => {
    if (!results?.datasheet_id) return;
    const localKeys = Object.entries(cellStatus).filter(([, s]) => s === 'local').map(([k]) => k);
    if (localKeys.length === 0) return;
    const payload = localKeys.map(k => {
      const [r, c] = k.split(':');
      return { row_index: Number(r), column_key: c, new_value: edits[k] };
    });
    setCellStatus(prev => {
      const next = { ...prev };
      localKeys.forEach(k => { next[k] = 'saving'; });
      return next;
    });
    electricalDatasheetService.updateCells(results.datasheet_id, payload)
      .then(() => setCellStatus(prev => {
        const next = { ...prev };
        localKeys.forEach(k => { next[k] = 'saved'; });
        return next;
      }))
      .catch(() => setCellStatus(prev => {
        const next = { ...prev };
        localKeys.forEach(k => { next[k] = 'error'; });
        return next;
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results?.datasheet_id]);

  const handleRecheck = async () => {
    if (!results?.datasheet_id) return;
    setRecheckOpen(true);
    setRecheckLoading(true);
    setRecheckDiff(null);
    try {
      const d = await electricalDatasheetService.recheck(results.datasheet_id);
      setRecheckDiff(d);
    } catch (e) {
      setRecheckDiff({ error: e.response?.data?.error || e.message });
    } finally {
      setRecheckLoading(false);
    }
  };

  const handleSnapshot = async () => {
    if (!results?.datasheet_id) return;
    const label = window.prompt('Revision label (e.g. Rev B for IFR):', 'B');
    if (!label) return;
    try {
      await electricalDatasheetService.createSnapshot(results.datasheet_id, label);
      window.alert(`Snapshot "${label}" saved.`);
    } catch (e) {
      window.alert('Snapshot failed: ' + (e.response?.data?.error || e.message));
    }
  };

  const handleShare = async () => {
    if (!results?.datasheet_id) return;
    try {
      const d = await electricalDatasheetService.createShare(results.datasheet_id);
      const fullUrl = `${window.location.origin}${d.share_path}`;
      setShareLink(fullUrl);
      try { await navigator.clipboard.writeText(fullUrl); } catch { /* ignore */ }
    } catch (e) {
      window.alert('Share failed: ' + (e.response?.data?.error || e.message));
    }
  };

  // When new results land, switch to the matching variant tab if applicable
  useEffect(() => {
    const schema = results?.equipment_type ? EQUIPMENT_DOC_SCHEMAS[results.equipment_type] : null;
    if (!schema) return;
    if (results.equipment_type === 'transformer') {
      const variant = results.variant || 'power';
      const matchTab = schema.pages.find(p => p.kind === 'datasheet' && p.variant === variant);
      setActivePage(matchTab?.id || 'cover');
    } else {
      setActivePage('cover');
    }
  }, [results]);

  const selectedEquipment = EQUIPMENT_TYPES.find(eq => eq.id === selectedEquipmentType);

  const handleEquipmentChange = (e) => {
    const newType = e.target.value;
    setSelectedEquipmentType(newType);
    setUploadedFiles({});
    setError('');
    setResults(null);
  };

  const handleFileUpload = (fileType, file) => {
    const formats = (selectedEquipment && selectedEquipment.acceptedFormats) || DEFAULT_ACCEPTED_FORMATS;
    if (!isFileAccepted(file, formats)) {
      setError(`“${file?.name || 'file'}” is not a supported format. ${formats.label} accepted for ${selectedEquipment?.name || 'this equipment'}.`);
      return;
    }
    setUploadedFiles(prev => ({
      ...prev,
      [fileType]: file
    }));
    setError('');
  };

  const removeFile = (fileType) => {
    const newFiles = { ...uploadedFiles };
    delete newFiles[fileType];
    setUploadedFiles(newFiles);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const canSubmit = () => {
    if (!selectedEquipment) return false;
    return selectedEquipment.requiredFiles.every(fileType => uploadedFiles[fileType]);
  };

  const resetForm = () => {
    setSelectedEquipmentType('');
    setUploadedFiles({});
    setUploading(false);
    setUploadProgress(0);
    setAnalysisStage('');
    setResults(null);
    setError('');
    setExcelBlob(null);
  };

  const handleGenerate = async () => {
    if (!canSubmit()) {
      setError('Please upload all required documents');
      return;
    }

    setUploading(true);
    setError('');
    setUploadProgress(0);

    try {
      const formData = new FormData();
      
      // Special handling for MV Switchgear - generate datasheet from SLD
      if (selectedEquipmentType === 'mv_switchgear') {
        const sldFile = uploadedFiles['SLD for 11KV Switchgear'];
        if (!sldFile) {
          setError('Please upload SLD for 11KV Switchgear');
          setUploading(false);
          return;
        }

        formData.append('sld_file', sldFile);
        formData.append('project_name', '');
        formData.append('drawing_number', '');
        formData.append('area', '');

        setAnalysisStage('Extracting datasheet from SLD using AI...');

        const response = await apiClient.post(
          '/electrical-datasheet/datasheets/generate-switchgear-datasheet/',
          formData,
          {
            timeout: API_TIMEOUT_UPLOAD,
            onUploadProgress: (progressEvent) => {
              const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(progress);
            },
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          }
        );

        if (response.data.success) {
          setAnalysisStage('Processing complete!');
          setResults({
            success: true,
            equipment_type: 'mv_switchgear',
            datasheet_rows: response.data.datasheet_rows,
            summary: response.data.summary,
            extraction_metadata: response.data.extraction_metadata,
            datasheet_id: response.data.datasheet_id,
            excel_url: response.data.excel_url,
          });
        } else {
          setError(response.data.error || 'Failed to generate switchgear datasheet');
          setAnalysisStage('');
        }

      } else if (selectedEquipmentType === 'transformer') {
        // ── TRANSFORMER: generate datasheet from sizing calculation PDF ──
        const sizingFile = uploadedFiles['Transformer Sizing Calculation (Power and Distribution)'];
        if (!sizingFile) {
          setError('Please upload the Transformer Sizing Calculation document');
          setUploading(false);
          return;
        }

        formData.append('sizing_calc_file', sizingFile);
        formData.append('project_name', '');
        formData.append('drawing_number', '');
        formData.append('area', '');

        setAnalysisStage('Extracting transformer datasheet from sizing calculation using AI...');

        const response = await apiClient.post(
          '/electrical-datasheet/datasheets/generate-transformer-datasheet/',
          formData,
          {
            timeout: API_TIMEOUT_UPLOAD,
            onUploadProgress: (progressEvent) => {
              const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(progress);
            },
            headers: { 'Content-Type': 'multipart/form-data' }
          }
        );

        if (response.data.success) {
          setAnalysisStage('Processing complete!');
          setResults({
            success: true,
            equipment_type: 'transformer',
            datasheet_rows: response.data.datasheet_rows,
            summary: response.data.summary,
            extraction_metadata: response.data.extraction_metadata,
            variant: response.data.summary?.variant,
            datasheet_id: response.data.datasheet_id,
            excel_url: response.data.excel_url,
          });
        } else {
          setError(response.data.error || 'Failed to generate transformer datasheet');
          setAnalysisStage('');
        }

      } else if (selectedEquipmentType === 'dg_set') {
          // DG SET: generate datasheet from EDG sizing calculation PDF
          const edgFile = uploadedFiles['Emergency Diesel Generator (EDG) Sizing Calculation'];
          if (!edgFile) {
            setError('Please upload the Emergency Diesel Generator (EDG) Sizing Calculation document');
            setUploading(false);
            return;
          }

          formData.append('edg_sizing_file', edgFile);
          formData.append('project_name', '');
          formData.append('drawing_number', '');
          formData.append('area', '');

          setAnalysisStage('Extracting DG set datasheet from sizing calculation using AI...');

          const response = await apiClient.post(
            '/electrical-datasheet/datasheets/generate-dg-datasheet/',
            formData,
            {
              timeout: API_TIMEOUT_UPLOAD,
              onUploadProgress: (progressEvent) => {
                const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                setUploadProgress(progress);
              },
              headers: { 'Content-Type': 'multipart/form-data' }
            }
          );

          if (response.data.success) {
            setAnalysisStage('Processing complete!');
            setResults({
              success: true,
              equipment_type: 'dg_set',
              datasheet_rows: response.data.datasheet_rows,
              summary: response.data.summary,
              extraction_metadata: response.data.extraction_metadata,
              datasheet_id: response.data.datasheet_id,
              excel_url: response.data.excel_url,
            });
          } else {
            setError(response.data.error || 'Failed to generate DG set datasheet');
            setAnalysisStage('');
          }

      } else {
        // Original logic for other equipment types
        formData.append('equipment_type', selectedEquipmentType);

        Object.entries(uploadedFiles).forEach(([fileType, file]) => {
          formData.append('files', file);
          formData.append('file_types', fileType);
        });

        setAnalysisStage('Uploading files...');

        const response = await apiClient.post(
          '/electrical-datasheet/datasheets/generate-smart/',
          formData,
          {
            timeout: API_TIMEOUT_UPLOAD,
            onUploadProgress: (progressEvent) => {
              const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(progress);
            },
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          }
        );

        setAnalysisStage('Processing complete!');
        setResults(response.data);

        if (response.data.excel_url) {
          const excelResponse = await apiClient.get(response.data.excel_url, {
            responseType: 'blob'
          });
          setExcelBlob(excelResponse.data);
        }
      }

    } catch (err) {
      console.error('Generation error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to generate datasheet');
      setAnalysisStage('');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = () => {
    if (!excelBlob) return;

    const url = window.URL.createObjectURL(excelBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedEquipment.name.replace(/\s+/g, '_')}_Datasheet_${Date.now()}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadSwitchgearExcel = async () => {
    if (!results?.datasheet_rows) return;

    try {
      const response = await apiClient.post(
        '/electrical-datasheet/datasheets/export-switchgear-datasheet/',
        {
          datasheet_rows: results.datasheet_rows,
          project_info: {
            project_name: '',
            drawing_number: '',
            area: '',
            voltage_level: '11KV'
          }
        },
        {
          responseType: 'blob',
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `11KV_Switchgear_Datasheet_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      setError('Failed to download Excel file');
    }
  };

  const handleDownloadTransformerExcel = async () => {
    if (!results?.datasheet_rows) return;
    try {
      const response = await apiClient.post(
        '/electrical-datasheet/datasheets/export-transformer-datasheet/',
        {
          datasheet_rows: results.datasheet_rows,
          project_info: { project_name: '', drawing_number: '', area: '' }
        },
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Transformer_Datasheet_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Transformer download error:', error);
      setError('Failed to download transformer Excel file');
    }
  };

  const handleDownloadDGExcel = async () => {
    if (!results?.datasheet_rows) return;
    try {
      const response = await apiClient.post(
        '/electrical-datasheet/datasheets/export-dg-datasheet/',
        {
          datasheet_rows: results.datasheet_rows,
          project_info: { project_name: '', drawing_number: '', area: '' }
        },
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `DGSet_Datasheet_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('DG Set download error:', error);
      setError('Failed to download DG set Excel file');
    }
  };

  // Derived workflow state for the stepper
  const currentStep = results ? 4 : uploading ? 3 : selectedEquipment ? 2 : 1;
  const eqColor = (selectedEquipmentType && EQUIPMENT_COLORS[selectedEquipmentType]) || EQUIPMENT_COLORS.transformer;

  return (
    <div className={`relative min-h-screen ${THEME.pageBg} py-10 px-4 overflow-hidden`}>
      {/* ── Inline keyframes — engaging motion ──────────────────────────── */}
      <style>{`
        @keyframes blob {
          0%,100% { transform: translate(0,0) scale(1); }
          33%     { transform: translate(40px,-30px) scale(1.1); }
          66%     { transform: translate(-30px,30px) scale(0.95); }
        }
        @keyframes spin-slow { to { transform: rotate(360deg); } }
        @keyframes gradient-shift {
          0%,100% { background-position: 0% 50%; }
          50%     { background-position: 100% 50%; }
        }
        @keyframes float-up {
          0%   { transform: translateY(0)    rotate(0deg); opacity: 0; }
          10%  { opacity: 0.7; }
          100% { transform: translateY(-120px) rotate(180deg); opacity: 0; }
        }
        @keyframes shimmer-line {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(0.8); opacity: 0.6; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes tilt-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        /* ── Electrical-discipline keyframes ────────────────────────── */
        @keyframes current-flow {
          0%   { stroke-dashoffset: 0;   }
          100% { stroke-dashoffset: -40; }
        }
        @keyframes spark {
          0%, 100% { opacity: 0; transform: scale(0.5); }
          50%      { opacity: 1; transform: scale(1.3); }
        }
        @keyframes voltage-pulse {
          0%, 100% { opacity: 0.3; }
          50%      { opacity: 1;   }
        }
        @keyframes scan-line {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(2000%); }
        }
        .anim-blob       { animation: blob 18s ease-in-out infinite; }
        .anim-spin-slow  { animation: spin-slow 8s linear infinite; }
        .anim-grad-shift { background-size: 200% 200%; animation: gradient-shift 6s ease infinite; }
        .anim-float-up   { animation: float-up 6s ease-in-out infinite; }
        .anim-shimmer    { animation: shimmer-line 2.5s linear infinite; }
        .anim-pulse-ring { animation: pulse-ring 2s ease-out infinite; }
        .anim-tilt-in    { animation: tilt-in 0.5s ease-out both; }
        .anim-current    { animation: current-flow 1.5s linear infinite; stroke-dasharray: 8 6; }
        .anim-spark      { animation: spark 1.6s ease-in-out infinite; }
        .anim-voltage    { animation: voltage-pulse 1.8s ease-in-out infinite; }
        .anim-scan       { animation: scan-line 4s linear infinite; }
      `}</style>

      {/* ── Decorative animated blobs (light, soft) ─────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[460px] h-[460px] rounded-full bg-gradient-to-br from-cyan-300/40 to-blue-300/30 blur-3xl anim-blob" />
        <div className="absolute top-1/3 -right-32 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-amber-200/40 to-orange-200/25 blur-3xl anim-blob" style={{ animationDelay: '4s' }} />
        <div className="absolute bottom-0 left-1/4 w-[420px] h-[420px] rounded-full bg-gradient-to-br from-blue-300/30 to-emerald-200/30 blur-3xl anim-blob" style={{ animationDelay: '8s' }} />

        {/* Circuit-board grid pattern */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.07]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="circuit-grid" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
              {/* horizontal trace */}
              <path d="M0 40 L30 40 L35 35 L45 35 L50 40 L80 40" stroke="#0ea5e9" strokeWidth="1" fill="none" />
              {/* vertical trace */}
              <path d="M40 0 L40 30 L35 35 M40 50 L40 80" stroke="#0ea5e9" strokeWidth="1" fill="none" />
              {/* solder pads */}
              <circle cx="40" cy="40" r="3" fill="#0ea5e9" />
              <circle cx="40" cy="40" r="1.5" fill="#fff" />
              <circle cx="80" cy="40" r="2" fill="#0ea5e9" />
              <circle cx="40" cy="80" r="2" fill="#0ea5e9" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#circuit-grid)" />
        </svg>
      </div>

      <div className="relative max-w-6xl mx-auto">
        {/* ── HERO HEADER ─────────────────────────────────────────────────── */}
        <div className="mb-10 text-center">
          {/* Live AI badge — phase indicators (R/Y/B) */}
          <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-white border border-blue-200 shadow-sm shadow-blue-100 backdrop-blur-md mb-6">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-rose-500 anim-voltage" />
              <span className="h-2 w-2 rounded-full bg-amber-500 anim-voltage" style={{ animationDelay: '0.6s' }} />
              <span className="h-2 w-2 rounded-full bg-blue-500 anim-voltage" style={{ animationDelay: '1.2s' }} />
            </span>
            <span className="text-[11px] font-semibold text-blue-700 tracking-[0.2em] uppercase">3-Phase AI · Energised</span>
            <span className="text-slate-300">|</span>
            <span className="text-[11px] font-semibold text-slate-500">GPT-4o</span>
          </div>

          {/* Hero icon — transformer/coil with current-flow lines */}
          <div className="relative inline-flex items-center justify-center mb-6">
            <div className="absolute inset-0 -m-3 rounded-full anim-spin-slow"
                 style={{ background: 'conic-gradient(from 0deg, #3b82f6, #06b6d4, #f59e0b, #10b981, #3b82f6)' }} />
            <div className="absolute inset-0 -m-3 rounded-full bg-white blur-md opacity-40 anim-pulse-ring" />
            <div className={`relative h-24 w-24 rounded-full bg-gradient-to-br ${THEME.brandGradient} flex items-center justify-center shadow-xl shadow-cyan-300/50`}>
              {/* Stylised electrical bolt */}
              <svg viewBox="0 0 24 24" className="h-12 w-12 text-white drop-shadow" fill="currentColor">
                <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
              </svg>
            </div>
            {/* Spark particles */}
            {[0,1,2,3,4,5].map(i => (
              <div key={i}
                   className="absolute h-1 w-1 rounded-full bg-amber-400 anim-spark"
                   style={{
                     left:  `${50 + 60 * Math.cos((i / 6) * Math.PI * 2)}%`,
                     top:   `${50 + 60 * Math.sin((i / 6) * Math.PI * 2)}%`,
                     boxShadow: '0 0 8px rgba(245,158,11,0.9)',
                     animationDelay: `${i * 0.25}s`,
                   }} />
            ))}
          </div>

          <h1 className="text-5xl md:text-6xl font-black tracking-tight text-slate-900 mb-4 leading-tight">
            <span className={`bg-gradient-to-r ${THEME.brandGradient} bg-clip-text text-transparent anim-grad-shift`}>
              Electrical Datasheet
            </span>
            <span className="block text-slate-900 mt-1">Powered by AI Automation</span>
          </h1>

          <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            From sizing calculation to standards-compliant datasheet —
            <span className="font-semibold text-blue-700"> one AI-energised pipeline </span>
            for every electrical asset on your project.
          </p>

          {/* Animated single-line schematic */}
          <div className="relative max-w-2xl mx-auto mt-8 mb-2">
            <svg viewBox="0 0 600 60" className="w-full h-12">
              {/* incoming source */}
              <circle cx="20" cy="30" r="8" fill="none" stroke="#0ea5e9" strokeWidth="2" />
              <text x="20" y="34" textAnchor="middle" fontSize="10" fill="#0ea5e9" fontWeight="bold">G</text>
              {/* main bus */}
              <line x1="28" y1="30" x2="180" y2="30" stroke="#3b82f6" strokeWidth="2" className="anim-current" />
              {/* transformer symbol */}
              <circle cx="200" cy="30" r="10" fill="none" stroke="#0ea5e9" strokeWidth="2" />
              <circle cx="215" cy="30" r="10" fill="none" stroke="#0ea5e9" strokeWidth="2" />
              {/* outgoing line */}
              <line x1="225" y1="30" x2="380" y2="30" stroke="#3b82f6" strokeWidth="2" className="anim-current" />
              {/* breaker */}
              <line x1="380" y1="30" x2="395" y2="20" stroke="#f59e0b" strokeWidth="2.5" />
              <circle cx="395" cy="20" r="2" fill="#f59e0b" />
              <line x1="400" y1="30" x2="560" y2="30" stroke="#3b82f6" strokeWidth="2" className="anim-current" />
              {/* load */}
              <rect x="555" y="22" width="20" height="16" fill="none" stroke="#10b981" strokeWidth="2" rx="2" />
              <text x="565" y="34" textAnchor="middle" fontSize="9" fill="#10b981" fontWeight="bold">M</text>
              {/* AI brain marker on bus */}
              <circle cx="290" cy="30" r="4" fill="#a855f7" className="anim-voltage" />
            </svg>
            <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold text-slate-400 -mt-1 px-1">
              <span>Source</span><span className="text-blue-600">Transformer</span><span className="text-amber-600">Switchgear</span><span className="text-emerald-600">Load</span>
            </div>
          </div>

          {/* Standards / spec chips */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            {ELECTRICAL_STANDARDS.slice(0, 4).map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-blue-200 bg-white text-xs font-semibold text-blue-700 shadow-sm">
                <BoltIcon className="h-3.5 w-3.5 text-amber-500" />
                <span className="font-mono">{s.code}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-600 font-medium">{s.label}</span>
              </span>
            ))}
          </div>
        </div>

        {/* ── WORKFLOW STEPPER ────────────────────────────────────────────── */}
        <div className={`${THEME.glass} rounded-2xl p-5 mb-8`}>
          <div className="flex items-center justify-between">
            {WORKFLOW_STEPS.map((step, idx) => {
              const active   = currentStep === step.id;
              const complete = currentStep > step.id;
              return (
                <React.Fragment key={step.id}>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className={`relative h-11 w-11 rounded-2xl flex items-center justify-center font-bold text-sm transition-all
                      ${complete
                        ? 'bg-gradient-to-br from-emerald-400 to-green-500 text-white shadow-lg shadow-emerald-200'
                        : active
                          ? `bg-gradient-to-br ${THEME.brandGradient} text-white shadow-lg shadow-purple-200`
                          : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
                      {complete ? <CheckCircleIcon className="h-5 w-5" /> : step.id}
                      {active && (
                        <span className="absolute inset-0 rounded-2xl border-2 border-purple-400 anim-pulse-ring" />
                      )}
                    </div>
                    <span className={`hidden md:block text-sm font-semibold transition-colors
                      ${active ? 'text-slate-900' : complete ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {step.label}
                    </span>
                  </div>
                  {idx < WORKFLOW_STEPS.length - 1 && (
                    <div className="flex-1 h-1 mx-3 rounded-full bg-slate-200 overflow-hidden relative">
                      <div className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700
                        ${complete ? 'w-full bg-gradient-to-r from-emerald-400 to-cyan-500' :
                          active   ? 'w-1/2 bg-gradient-to-r from-cyan-400 to-amber-400 anim-grad-shift' :
                                     'w-0'}`} />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* ── WORKFLOW MODE TOGGLE: Generate vs History ────────────────── */}
        {!results && (
          <div className="mb-6 flex items-center gap-2">
            {WORKFLOW_MODES.map(m => {
              const Icon = m.icon;
              const active = workflowMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setWorkflowMode(m.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    active
                      ? `bg-gradient-to-r ${THEME.brandGradient} text-white shadow-md`
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {m.label}
                </button>
              );
            })}
          </div>
        )}

        {/* ── HISTORY PANEL ─────────────────────────────────────────────── */}
        {!results && workflowMode === 'history' && (
          <div className={`${THEME.glass} rounded-2xl p-6 md:p-8 mb-8`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <ClockIcon className="h-6 w-6 text-slate-700" />
                <h2 className="text-xl font-bold text-slate-900">Datasheet History</h2>
              </div>
              <div className="relative">
                <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  placeholder="Search title or equipment..."
                  className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>
            </div>
            {historyLoading ? (
              <div className="text-center py-12 text-slate-500">
                <ArrowPathIcon className="h-8 w-8 mx-auto animate-spin mb-2" />
                Loading history...
              </div>
            ) : historyItems.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <DocumentTextIcon className="h-10 w-10 mx-auto mb-2" />
                No saved datasheets yet. Generate one and it will appear here.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {historyItems
                  .filter(it => {
                    const q = historySearch.toLowerCase();
                    if (!q) return true;
                    return (it.title || '').toLowerCase().includes(q)
                        || (it.equipment_type || '').toLowerCase().includes(q);
                  })
                  .map(it => (
                  <div key={it.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <BoltIcon className="h-5 w-5 text-cyan-600" />
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          {EQUIPMENT_LABELS[it.equipment_type] || it.equipment_type}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[it.status] || STATUS_BADGE.draft}`}>
                        {it.status?.toUpperCase() || 'DRAFT'}
                      </span>
                    </div>
                    <div className="font-semibold text-slate-900 text-sm mb-1 truncate">
                      {it.title || `Datasheet ${it.id.slice(0, 8)}`}
                    </div>
                    <div className="text-xs text-slate-500 mb-3">
                      Rev {it.revision} · {new Date(it.created_at).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openFromHistory(it)}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
                      >
                        <EyeIcon className="h-3.5 w-3.5" /> Open
                      </button>
                      <button
                        onClick={() => archiveFromHistory(it)}
                        className="px-2 py-1.5 text-xs text-slate-500 hover:text-red-600 border border-slate-200 rounded-lg"
                        title="Archive"
                      >
                        <ArchiveBoxIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 1: EQUIPMENT GRID SELECTOR ─────────────────────────────── */}
        {!results && workflowMode === 'generate' && (
          <div className={`${THEME.glass} rounded-2xl p-6 md:p-8 mb-8 relative overflow-hidden`}>
            {/* Bus-bar accent line at the top */}
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${THEME.brandGradient} anim-grad-shift`} />
            <div className="flex items-center gap-3 mb-6">
              <div className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${THEME.brandGradient} flex items-center justify-center shadow-lg shadow-cyan-200`}>
                <BoltIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Select Electrical Asset</h2>
                <p className="text-xs text-slate-500">Choose the equipment class — the AI will load its discipline-specific schema</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {EQUIPMENT_TYPES.map((equipment, idx) => {
                const isSelected = selectedEquipmentType === equipment.id;
                const colors = EQUIPMENT_COLORS[equipment.id] || EQUIPMENT_COLORS.transformer;
                return (
                  <button
                    key={equipment.id}
                    type="button"
                    disabled={uploading}
                    onClick={() => handleEquipmentChange({ target: { value: equipment.id } })}
                    style={{ animationDelay: `${idx * 60}ms` }}
                    className={`anim-tilt-in group relative p-4 rounded-2xl border-2 transition-all duration-300 text-left overflow-hidden
                      ${isSelected
                        ? `bg-gradient-to-br ${colors.grad} border-transparent shadow-xl ${colors.glow} scale-[1.03]`
                        : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-100'}
                      ${uploading ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-1'}`}
                  >
                    {/* Animated corner sweep on hover (unselected) */}
                    {!isSelected && (
                      <div className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                           style={{ background: `conic-gradient(from 0deg, transparent, ${equipment.id === 'transformer' ? '#3b82f6' : equipment.id === 'dg_set' ? '#10b981' : equipment.id === 'mv_switchgear' ? '#a855f7' : equipment.id === 'lv_switchgear' ? '#f59e0b' : equipment.id === 'ac_ups' ? '#f43f5e' : '#6366f1'}, transparent)`, padding: '2px' }}>
                        <div className="h-full w-full rounded-2xl bg-white" />
                      </div>
                    )}
                    {/* Glow blob */}
                    {!isSelected && (
                      <div className={`absolute -bottom-6 -right-6 h-16 w-16 rounded-full bg-gradient-to-br ${colors.grad} opacity-0 group-hover:opacity-20 blur-xl transition-opacity`} />
                    )}
                    <div className="relative">
                      <div className={`text-3xl mb-2 transition-transform group-hover:scale-110 group-hover:-rotate-6 ${isSelected ? 'drop-shadow-lg' : ''}`}>
                        {equipment.icon}
                      </div>
                      <div className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                        {equipment.name}
                      </div>
                      <div className={`text-[11px] mt-0.5 leading-tight ${isSelected ? 'text-white/85' : 'text-slate-500'}`}>
                        {equipment.description}
                      </div>
                      {/* Voltage / rating tag */}
                      <div className={`mt-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider
                        ${isSelected ? 'bg-white/25 text-white' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                        <BoltIcon className="h-2.5 w-2.5" />
                        {colors.voltage}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-white/30 backdrop-blur flex items-center justify-center">
                        <CheckCircleIcon className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {selectedEquipment && (
              <div className="anim-tilt-in mt-6 p-5 rounded-2xl bg-gradient-to-br from-white to-indigo-50/60 border border-indigo-100 relative overflow-hidden">
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${eqColor.grad}`} />
                <div className="flex items-start gap-4">
                  <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${eqColor.grad} flex items-center justify-center text-3xl flex-shrink-0 shadow-lg ${eqColor.glow}`}>
                    {selectedEquipment.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 text-lg">{selectedEquipment.name}</h3>
                    <p className="text-sm text-slate-600 mt-0.5">{selectedEquipment.description}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-semibold border border-rose-200 inline-flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                        {selectedEquipment.requiredFiles.length} required
                      </span>
                      {selectedEquipment.optionalFiles.length > 0 && (
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200 inline-flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                          {selectedEquipment.optionalFiles.length} optional
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ERROR BANNER ────────────────────────────────────────────────── */}
        {error && (
          <div className="mb-8 p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 shadow-sm">
            <XCircleIcon className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-red-900">Error</h4>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* ── STEP 2: FILE UPLOAD ─────────────────────────────────────────── */}
        {selectedEquipment && !results && (
          <div className="space-y-6">
            {/* Required Files */}
            <div className={`${THEME.glass} rounded-2xl p-6 md:p-8 relative overflow-hidden`}>
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${eqColor.grad}`} />
              <div className="flex items-center gap-3 mb-5">
                <div className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${eqColor.grad} flex items-center justify-center shadow-lg ${eqColor.glow}`}>
                  <DocumentArrowUpIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Required Documents</h3>
                  <p className="text-xs text-slate-500">Source files used by the AI pipeline</p>
                </div>
              </div>

              <div className="space-y-3">
                {selectedEquipment.requiredFiles.map((fileType, idx) => (
                  <div key={idx}>
                    {uploadedFiles[fileType] ? (
                      <div className="anim-tilt-in bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-200">
                            <CheckCircleIcon className="h-6 w-6 text-white" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 truncate">
                              {uploadedFiles[fileType].name}
                            </div>
                            <div className="text-xs text-emerald-700 font-medium">
                              {formatFileSize(uploadedFiles[fileType].size)} · ready for analysis
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => removeFile(fileType)}
                          className="p-2 hover:bg-red-100 rounded-lg transition-colors flex-shrink-0"
                        >
                          <XMarkIcon className="h-5 w-5 text-red-500" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <input
                          type="file"
                          id={`required-${idx}`}
                          accept={((selectedEquipment && selectedEquipment.acceptedFormats) || DEFAULT_ACCEPTED_FORMATS).extensions.join(',')}
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleFileUpload(fileType, e.target.files[0]);
                            }
                          }}
                          className="hidden"
                        />
                        <label
                          htmlFor={`required-${idx}`}
                          className="group relative flex items-center gap-4 p-5 border-2 border-dashed border-indigo-200 rounded-2xl
                                   bg-gradient-to-br from-indigo-50/40 to-purple-50/40
                                   hover:border-purple-400 hover:from-indigo-50 hover:to-purple-50
                                   cursor-pointer transition-all overflow-hidden"
                        >
                          {/* shimmer line on hover */}
                          <div className="absolute inset-y-0 left-0 w-1/3 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-transparent via-white to-transparent anim-shimmer pointer-events-none" />
                          <div className="relative h-12 w-12 rounded-xl bg-white border border-indigo-200 group-hover:border-purple-400 group-hover:bg-gradient-to-br group-hover:from-indigo-100 group-hover:to-purple-100 flex items-center justify-center transition-all shadow-sm">
                            <CloudArrowUpIcon className="h-6 w-6 text-indigo-500 group-hover:text-purple-600 group-hover:-translate-y-0.5 transition-all" />
                          </div>
                          <div className="relative flex-1 min-w-0">
                            <div className="text-sm font-semibold text-slate-900">
                              {fileType} <span className="text-rose-500">*</span>
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5 font-mono">
                              <span className="text-amber-600">●</span> {((selectedEquipment && selectedEquipment.acceptedFormats) || DEFAULT_ACCEPTED_FORMATS).label} &nbsp;|&nbsp; Click or drag to terminal
                            </div>
                          </div>
                          <div className="relative flex items-center gap-1 text-xs font-bold text-cyan-700 px-3 py-1.5 rounded-full bg-cyan-50 border border-cyan-300 group-hover:bg-cyan-600 group-hover:text-white group-hover:border-cyan-600 transition-all">
                            <BoltIcon className="h-3.5 w-3.5" />
                            <span className="font-mono tracking-wider">CONNECT</span>
                          </div>
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Optional Files */}
            {selectedEquipment.optionalFiles.length > 0 && (
              <div className={`${THEME.glass} rounded-2xl p-6 md:p-8`}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-11 w-11 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                    <DocumentTextIcon className="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Optional Documents</h3>
                    <p className="text-xs text-slate-500">Improves extraction accuracy</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {selectedEquipment.optionalFiles.map((fileType, idx) => (
                    <div key={idx}>
                      {uploadedFiles[fileType] ? (
                        <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <CheckCircleIcon className="h-6 w-6 text-emerald-500 flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900 truncate">
                                {uploadedFiles[fileType].name}
                              </div>
                              <div className="text-xs text-emerald-700">
                                {formatFileSize(uploadedFiles[fileType].size)}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => removeFile(fileType)}
                            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                          >
                            <XMarkIcon className="h-5 w-5 text-red-500" />
                          </button>
                        </div>
                      ) : (
                        <div>
                          <input
                            type="file"
                            id={`optional-${idx}`}
                            accept={((selectedEquipment && selectedEquipment.acceptedFormats) || DEFAULT_ACCEPTED_FORMATS).extensions.join(',')}
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleFileUpload(fileType, e.target.files[0]);
                              }
                            }}
                            className="hidden"
                          />
                          <label
                            htmlFor={`optional-${idx}`}
                            className="flex items-center gap-3 p-4 border-2 border-dashed border-slate-200
                                     rounded-2xl hover:border-slate-400 hover:bg-slate-50 cursor-pointer transition-all"
                          >
                            <DocumentTextIcon className="h-6 w-6 text-slate-400" />
                            <div>
                              <div className="text-sm font-semibold text-slate-700">
                                {fileType}
                              </div>
                              <div className="text-xs text-slate-500">
                                Click to upload PDF, Excel, or Image
                              </div>
                            </div>
                          </label>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Generate Button + AI Pipeline */}
            <div className={`${THEME.glass} rounded-2xl p-6 md:p-8`}>
              <button
                onClick={handleGenerate}
                disabled={!canSubmit() || uploading}
                className={`group relative w-full py-5 px-6 rounded-2xl font-bold text-lg transition-all overflow-hidden
                          ${canSubmit() && !uploading
                            ? `bg-gradient-to-r ${THEME.brandGradient} hover:${THEME.brandGradientHover} text-white shadow-xl shadow-cyan-300/50 hover:shadow-2xl hover:shadow-amber-300/60 hover:scale-[1.01] anim-grad-shift`
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'}`}
              >
                {/* shimmer */}
                {canSubmit() && !uploading && (
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                )}
                <span className="relative flex items-center justify-center gap-3">
                  {uploading ? (
                    <>
                      <ArrowPathIcon className="h-6 w-6 animate-spin" />
                      Energising AI Pipeline…
                    </>
                  ) : (
                    <>
                      <BoltIcon className="h-6 w-6 text-amber-200 group-hover:scale-125 group-hover:rotate-12 transition-transform drop-shadow-lg" />
                      Energise AI · Generate Datasheet
                      <SparklesIcon className="h-5 w-5 text-white/90" />
                    </>
                  )}
                </span>
              </button>

              {/* AI Pipeline Visualisation */}
              {uploading && (
                <div className="mt-6 space-y-4">
                  {/* Progress bar */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-700 tracking-wider uppercase">{analysisStage || 'Initialising'}</span>
                      <span className={`text-sm font-black bg-gradient-to-r ${THEME.brandGradient} bg-clip-text text-transparent`}>
                        {uploadProgress}%
                      </span>
                    </div>
                    <div className="relative w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
                      <div
                        className={`absolute inset-y-0 left-0 bg-gradient-to-r ${THEME.brandGradient} rounded-full transition-all duration-500 anim-grad-shift`}
                        style={{ width: `${uploadProgress}%` }}
                      >
                        <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-r from-transparent via-white/50 to-transparent anim-shimmer" />
                      </div>
                    </div>
                  </div>

                  {/* Stage timeline */}
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {AI_PIPELINE_STAGES.map((stage) => {
                      const reached = uploadProgress >= stage.threshold;
                      const active  = !reached && uploadProgress >= (AI_PIPELINE_STAGES[Math.max(0, AI_PIPELINE_STAGES.indexOf(stage) - 1)]?.threshold ?? 0);
                      const Icon = stage.icon;
                      return (
                        <div key={stage.id} className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all
                          ${reached ? 'bg-emerald-50 border border-emerald-200' :
                            active ? 'bg-purple-50 border border-purple-300 shadow-md shadow-purple-100' :
                            'bg-slate-50 border border-slate-200'}`}>
                          <div className={`relative h-8 w-8 rounded-lg flex items-center justify-center
                            ${reached ? 'bg-gradient-to-br from-emerald-400 to-green-500 text-white' :
                              active  ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white' :
                              'bg-white text-slate-400 border border-slate-200'}`}>
                            <Icon className={`h-4 w-4 ${active ? 'animate-pulse' : ''}`} />
                            {active && <span className="absolute inset-0 rounded-lg border-2 border-purple-400 anim-pulse-ring" />}
                          </div>
                          <span className={`text-[10px] text-center leading-tight font-semibold
                            ${reached ? 'text-emerald-700' : active ? 'text-purple-700' : 'text-slate-500'}`}>
                            {stage.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Results Section */}
        {results && (
          <div className={`${THEME.glass} rounded-2xl p-6 md:p-8`}>
            {/* Success banner */}
            <div className="relative text-center mb-8 py-10 rounded-2xl bg-gradient-to-br from-emerald-50 via-cyan-50 to-white border border-emerald-200 overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.18),transparent_60%)]" />
              {/* confetti dots */}
              {[...Array(12)].map((_, i) => (
                <span key={i} className="absolute h-2 w-2 rounded-full anim-float-up"
                      style={{
                        left: `${(i * 8 + 5) % 95}%`,
                        bottom: '0%',
                        background: ['#10b981','#06b6d4','#a855f7','#f59e0b','#ec4899'][i % 5],
                        animationDelay: `${i * 0.4}s`,
                      }} />
              ))}
              <div className="relative">
                <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-xl shadow-emerald-300/50 mb-4">
                  <CheckCircleIcon className="h-12 w-12 text-white" />
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-2">
                  Datasheet Generated{' '}
                  <span className="bg-gradient-to-r from-emerald-500 to-cyan-600 bg-clip-text text-transparent">Successfully</span>
                </h2>
                <p className="text-slate-600">
                  Your <span className="font-semibold text-slate-900">{selectedEquipment.name}</span> datasheet is ready for review &amp; export
                </p>
              </div>
            </div>

            {/* Results Summary — animated metric cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Equipment',   value: selectedEquipment.name,                       icon: BoltIcon,        accent: 'from-blue-500 to-cyan-500' },
                { label: 'Files',       value: Object.keys(uploadedFiles).length,            icon: DocumentTextIcon,accent: 'from-purple-500 to-fuchsia-500' },
                { label: 'Total Rows',  value: results.summary?.total_rows ?? '—',           icon: TableCellsIcon,  accent: 'from-amber-500 to-orange-500' },
                { label: 'Completed',   value: results.summary?.completed_fields ?? '—',     icon: ChartBarIcon,    accent: 'from-emerald-500 to-green-500' },
              ].map((m, i) => {
                const Icon = m.icon;
                return (
                  <div key={i} className="relative p-4 rounded-2xl bg-white border border-slate-200 overflow-hidden group hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-100 transition-all anim-tilt-in"
                       style={{ animationDelay: `${i * 80}ms` }}>
                    <div className={`absolute -top-6 -right-6 h-24 w-24 rounded-full bg-gradient-to-br ${m.accent} opacity-15 group-hover:opacity-30 blur-2xl transition-opacity`} />
                    <div className="relative">
                      <div className={`inline-flex h-9 w-9 rounded-xl bg-gradient-to-br ${m.accent} items-center justify-center mb-2 shadow-md`}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{m.label}</div>
                      <div className="text-lg font-black text-slate-900 truncate">{m.value}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {results.summary?.missing_fields !== undefined && results.summary.missing_fields > 0 && (
              <div className="mb-6 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-2">
                <BoltIcon className="h-4 w-4 text-amber-600" />
                <span className="font-bold">{results.summary.missing_fields}</span>
                <span>field(s) require manual completion</span>
              </div>
            )}

            {/* ── SMART TOOLBAR (only when datasheet has been persisted) ── */}
            {results.datasheet_id && (
              <div className="mb-6 flex flex-wrap items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-2">Smart Actions</span>
                <button
                  onClick={handleRecheck}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:border-cyan-400 hover:text-cyan-700"
                  title="Re-run extraction on the original source and show diff"
                >
                  <ArrowPathIcon className="h-3.5 w-3.5" /> Recheck
                </button>
                <button
                  onClick={handleSnapshot}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:border-cyan-400 hover:text-cyan-700"
                >
                  <PencilSquareIcon className="h-3.5 w-3.5" /> Save Revision
                </button>
                <button
                  onClick={handleShare}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:border-cyan-400 hover:text-cyan-700"
                >
                  <ShareIcon className="h-3.5 w-3.5" /> Share
                </button>
                {results.excel_url && (
                  <a
                    href={results.excel_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:border-cyan-400 hover:text-cyan-700"
                  >
                    <ArrowDownTrayIcon className="h-3.5 w-3.5" /> Excel (S3)
                  </a>
                )}
                <span className="ml-auto text-[11px] text-slate-400">
                  Datasheet ID: <code className="font-mono">{results.datasheet_id.slice(0, 8)}</code>
                  {Object.values(cellStatus).some(s => s === 'saving') && <span className="ml-2 text-cyan-600">· Saving...</span>}
                  {Object.values(cellStatus).some(s => s === 'error')   && <span className="ml-2 text-red-600">· Save error</span>}
                </span>
                {shareLink && (
                  <div className="basis-full mt-2 text-xs text-slate-600 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                    Share link copied: <code className="font-mono break-all">{shareLink}</code>
                  </div>
                )}
              </div>
            )}


            {/* ── ADNOC Multi-Page Document Viewer (transformer + DG set + 11kV switchgear) ── */}
            {results.datasheet_rows && results.datasheet_rows.length > 0 && EQUIPMENT_DOC_SCHEMAS[results.equipment_type] && (() => {
              const schema      = EQUIPMENT_DOC_SCHEMAS[results.equipment_type];
              // Soft-coded per-equipment toolbar/download theme. Add a new equipment_type here.
              const TOOLBAR_THEMES = {
                transformer:   { grad: 'bg-gradient-to-r from-blue-700 via-cyan-600 to-amber-500',     text: 'text-blue-700',    handler: handleDownloadTransformerExcel, title: 'Power / Distribution Transformer Datasheet' },
                dg_set:        { grad: 'bg-gradient-to-r from-emerald-700 via-green-600 to-lime-500', text: 'text-emerald-700', handler: handleDownloadDGExcel,          title: 'Emergency Diesel Generator Set Datasheet' },
                mv_switchgear: { grad: 'bg-gradient-to-r from-purple-700 via-fuchsia-600 to-pink-500', text: 'text-purple-700', handler: handleDownloadSwitchgearExcel,  title: '11kV Switchgear Datasheet' },
              };
              const theme           = TOOLBAR_THEMES[results.equipment_type] || TOOLBAR_THEMES.transformer;
              const toolbarGrad     = theme.grad;
              const toolbarText     = theme.text;
              const downloadHandler = theme.handler;
              const datasheetTitle  = theme.title;
              return (
              <div className="mb-6">
                {/* Toolbar */}
                <div className={`${toolbarGrad} px-6 py-4 rounded-t-2xl flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <TableCellsIcon className="w-6 h-6 text-white" />
                    <div>
                      <h3 className="text-xl font-bold text-white">{datasheetTitle}</h3>
                      <p className="text-[11px] text-white/80 font-mono">{schema.docHeader.company_doc_default} · Rev {results?.revision || 'P'}</p>
                    </div>
                  </div>
                  <button onClick={downloadHandler} className={`flex items-center gap-2 bg-white ${toolbarText} px-4 py-2 rounded-lg font-semibold hover:bg-slate-50 transition-colors shadow-md`}>
                    <ArrowDownTrayIcon className="w-5 h-5" />
                    Download Excel
                  </button>
                </div>

                {/* Page tab strip — like Excel sheet tabs */}
                <div className="bg-slate-100 border-x border-slate-200 px-2 pt-2 flex flex-wrap gap-1 overflow-x-auto">
                  {schema.pages.map((p) => {
                    const isActive = activePage === p.id;
                    const isDisabledVariant = p.kind === 'datasheet' && p.variant && results.variant && p.variant !== results.variant;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setActivePage(p.id)}
                        className={`relative inline-flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-semibold transition-all whitespace-nowrap
                          ${isActive
                            ? `bg-white ${toolbarText} border border-slate-200 border-b-white shadow-sm -mb-px`
                            : 'bg-slate-50 text-slate-600 border border-transparent hover:text-blue-700 hover:bg-white/60'}
                          ${isDisabledVariant ? 'opacity-60' : ''}`}
                      >
                        <span className="text-sm">{p.icon}</span>
                        <span>{p.short}</span>
                        <span className="text-[9px] font-mono text-slate-400">{p.page}</span>
                        {isActive && <span className={`absolute -bottom-px left-0 right-0 h-0.5 ${toolbarGrad}`} />}
                      </button>
                    );
                  })}
                </div>

                {/* Page canvas */}
                <div className="border-x border-b border-slate-200 rounded-b-2xl bg-white overflow-hidden">
                  {(() => {
                    const page = schema.pages.find(p => p.id === activePage) || schema.pages[0];

                    // Soft-coded ADNOC header block — appears on every sub-page.
                    // Every text field is inline-editable; values share the
                    // same `header:*` auxEdits namespace across all sub-pages,
                    // so editing the company name on Cover updates it on
                    // Revision/Hold/Index/Notes/Datasheet too.
                    const hk = (field) => auxKey('header', field);
                    const HField = ({ field, fallback, className = '', align = 'center', placeholder = '—' }) => {
                      const k = hk(field);
                      return (
                        <EditableInline
                          as="div"
                          valueKey={k}
                          initialValue={aux(k, fallback)}
                          status={auxStatus[k]}
                          onChange={handleAuxEdit}
                          className={`w-full ${className}`}
                          placeholder={placeholder}
                        />
                      );
                    };
                    const sheetKey = hk(`sheet_${page.id}`); // sheet number is per-page
                    const revKey   = hk('rev');
                    const DocHeader = (
                      <div className="grid grid-cols-6 border border-slate-300 text-[11px]" style={{ fontFamily: 'Calibri, Arial, sans-serif' }}>
                        <div className="col-span-3 row-span-2 border border-slate-300 p-3 flex items-center justify-center text-center font-bold">
                          <HField field="company_name" fallback={schema.docHeader.company_name} />
                        </div>
                        <div className="col-span-2 border border-slate-300 p-2 text-center font-bold bg-slate-50">
                          <HField field="company_doc_label" fallback={schema.docHeader.company_doc_label} />
                        </div>
                        <div className="border border-slate-300 p-2 text-center font-bold bg-slate-50">Rev</div>
                        <div className="col-span-2 border border-slate-300 p-2 text-center font-mono">
                          <HField field="company_doc_default" fallback={schema.docHeader.company_doc_default} />
                        </div>
                        <div className="border border-slate-300 p-2 text-center font-bold">
                          <EditableInline as="div" valueKey={revKey} initialValue={aux(revKey, results?.revision || 'P')} status={auxStatus[revKey]} onChange={handleAuxEdit} className="w-full" />
                        </div>
                        <div className="col-span-3 border border-slate-300 p-2 text-center whitespace-pre-wrap">
                          <b>LOCATION:</b><br />
                          <HField field="location" fallback={schema.docHeader.location} />
                        </div>
                        <div className="col-span-2 border border-slate-300 p-2 text-center text-[10px]">
                          <HField field="project_title" fallback={schema.docHeader.project_title} />
                        </div>
                        <div className="border border-slate-300 p-2 text-center">
                          <div className="font-bold text-[10px]">Sheet</div>
                          <EditableInline as="div" valueKey={sheetKey} initialValue={aux(sheetKey, page.page)} status={auxStatus[sheetKey]} onChange={handleAuxEdit} className="w-full font-mono" />
                        </div>
                        <div className="col-span-3 border border-slate-300 p-2 text-center font-bold">
                          <span className="mr-1">DOCUMENT TITLE:</span>
                          <HField field="document_title" fallback={schema.docHeader.document_title} className="inline" />
                        </div>
                        <div className="col-span-3 border border-slate-300 p-2 text-center font-bold bg-slate-50">
                          <HField field="contractor_label" fallback={schema.docHeader.contractor_label} />
                        </div>
                        <div className="col-span-3 border border-slate-300 p-2"></div>
                        <div className="col-span-3 border border-slate-300 p-2 text-center font-mono">
                          <HField field="contractor_default" fallback={schema.docHeader.contractor_default} />
                        </div>
                        <div className="col-span-3 border border-slate-300 p-2"></div>
                        <div className="col-span-3 border border-slate-300 p-2 text-center font-bold bg-slate-50">
                          <HField field="rejlers_label" fallback={schema.docHeader.rejlers_label} />
                        </div>
                        <div className="col-span-3 border border-slate-300 p-2"></div>
                        <div className="col-span-3 border border-slate-300 p-2 text-center font-mono">
                          <HField field="rejlers_default" fallback={schema.docHeader.rejlers_default} />
                        </div>
                      </div>
                    );

                    // Banner (used by every page except cover)
                    const banner = (text) => (
                      <div className="bg-[#1F4E79] text-white text-center font-bold py-2 border border-slate-300 border-t-0">
                        {text}
                      </div>
                    );

                    // Section dispatcher
                    if (page.kind === 'cover') {
                      const coverTitleKey    = auxKey('cover', 'title');
                      const coverSubtitleKey = auxKey('cover', 'subtitle');
                      return (
                        <div className="p-6 bg-white">
                          {DocHeader}
                          <div className="mt-4 border border-slate-300 bg-[#1F4E79] text-white text-center py-12 px-6">
                            <div className="text-2xl md:text-3xl font-black tracking-wide mb-3 leading-snug">
                              <EditableInline
                                as="div"
                                valueKey={coverTitleKey}
                                initialValue={aux(coverTitleKey, schema.coverTitleFallback)}
                                status={auxStatus[coverTitleKey]}
                                onChange={handleAuxEdit}
                                className="min-w-[60%]"
                              />
                            </div>
                            <div className="mt-6 inline-block px-6 py-2 bg-white/15 border border-white/40 rounded-md text-sm font-mono">
                              <EditableInline
                                valueKey={coverSubtitleKey}
                                initialValue={aux(coverSubtitleKey, page.subtitle || schema.coverSubtitleFor(results.variant))}
                                status={auxStatus[coverSubtitleKey]}
                                onChange={handleAuxEdit}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (page.kind === 'revision') {
                      // Soft-coded user-added revision rows.
                      let revisionExtras = [];
                      try {
                        const raw = auxEdits[REVISION_EXTRAS_KEY];
                        revisionExtras = Array.isArray(raw) ? raw : (raw ? JSON.parse(raw) : []);
                      } catch { revisionExtras = []; }

                      const persistExtras = (next) => handleAuxEdit(REVISION_EXTRAS_KEY, next);
                      const addRevisionRow = () => {
                        const id = `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`;
                        persistExtras([...revisionExtras, { id, ...REVISION_EXTRA_DEFAULTS }]);
                      };
                      const removeRevisionRow = (id) => {
                        persistExtras(revisionExtras.filter(r => r.id !== id));
                      };

                      return (
                        <div className="p-6 bg-white">
                          {DocHeader}
                          {banner('REVISION HISTORY')}
                          <table className="w-full text-xs border border-slate-300 border-t-0">
                            <thead className="bg-[#1F4E79] text-white">
                              <tr>
                                <th className="px-3 py-2 border border-slate-300 w-20">Rev. No.</th>
                                <th className="px-3 py-2 border border-slate-300 w-28">Date</th>
                                <th className="px-3 py-2 border border-slate-300 w-44">Section / Page Revised</th>
                                <th className="px-3 py-2 border border-slate-300 text-left">Revision Description</th>
                                <th className="px-3 py-2 border border-slate-300 w-12" title="Actions"> </th>
                              </tr>
                            </thead>
                            <tbody>
                              {schema.revisionHistory.map((r, i) => {
                                const ek = (col) => auxKey('revision', i, col);
                                return (
                                <tr key={i} className="hover:bg-blue-50">
                                  <EditableCell rowIdx={`revision:${i}`} columnKey="rev"         initialValue={aux(ek('rev'), r.rev)}                 status={auxStatus[ek('rev')]}        onChange={(_, __, v) => handleAuxEdit(ek('rev'), v)}        className="px-3 py-2 border border-slate-300 text-center font-bold" align="center" />
                                  <EditableCell rowIdx={`revision:${i}`} columnKey="date"        initialValue={aux(ek('date'), r.date)}               status={auxStatus[ek('date')]}       onChange={(_, __, v) => handleAuxEdit(ek('date'), v)}       className="px-3 py-2 border border-slate-300 text-center font-mono" align="center" />
                                  <EditableCell rowIdx={`revision:${i}`} columnKey="section"     initialValue={aux(ek('section'), r.section)}         status={auxStatus[ek('section')]}    onChange={(_, __, v) => handleAuxEdit(ek('section'), v)}    className="px-3 py-2 border border-slate-300 text-center" align="center" />
                                  <EditableCell rowIdx={`revision:${i}`} columnKey="description" initialValue={aux(ek('description'), r.description)} status={auxStatus[ek('description')]} onChange={(_, __, v) => handleAuxEdit(ek('description'), v)} className="px-3 py-2 border border-slate-300" />
                                  <td className="px-2 py-2 border border-slate-300 text-center text-slate-300" title="Original revision (cannot delete)">—</td>
                                </tr>
                                );
                              })}
                              {revisionExtras.map((row) => {
                                const ek = (col) => auxKey('revision_extra', row.id, col);
                                return (
                                <tr key={row.id} className="hover:bg-emerald-50 bg-emerald-50/30">
                                  <EditableCell rowIdx={`revision_extra:${row.id}`} columnKey="rev"         initialValue={aux(ek('rev'), row.rev)}                 status={auxStatus[ek('rev')]}        onChange={(_, __, v) => handleAuxEdit(ek('rev'), v)}        className="px-3 py-2 border border-slate-300 text-center font-bold" align="center" />
                                  <EditableCell rowIdx={`revision_extra:${row.id}`} columnKey="date"        initialValue={aux(ek('date'), row.date)}               status={auxStatus[ek('date')]}       onChange={(_, __, v) => handleAuxEdit(ek('date'), v)}       className="px-3 py-2 border border-slate-300 text-center font-mono" align="center" />
                                  <EditableCell rowIdx={`revision_extra:${row.id}`} columnKey="section"     initialValue={aux(ek('section'), row.section)}         status={auxStatus[ek('section')]}    onChange={(_, __, v) => handleAuxEdit(ek('section'), v)}    className="px-3 py-2 border border-slate-300 text-center" align="center" />
                                  <EditableCell rowIdx={`revision_extra:${row.id}`} columnKey="description" initialValue={aux(ek('description'), row.description)} status={auxStatus[ek('description')]} onChange={(_, __, v) => handleAuxEdit(ek('description'), v)} className="px-3 py-2 border border-slate-300" />
                                  <td className="px-2 py-2 border border-slate-300 text-center">
                                    <button
                                      type="button"
                                      onClick={() => removeRevisionRow(row.id)}
                                      className="inline-flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 rounded p-1 transition-colors"
                                      title="Delete revision row"
                                    >
                                      <TrashIcon className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                                );
                              })}
                              <tr>
                                <td colSpan={5} className="px-3 py-2 border border-slate-300 bg-slate-50">
                                  <button
                                    type="button"
                                    onClick={addRevisionRow}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-cyan-700 bg-white border border-cyan-300 rounded hover:bg-cyan-50 hover:border-cyan-400 transition-colors"
                                  >
                                    <PlusCircleIcon className="w-4 h-4" />
                                    Add Revision
                                  </button>
                                  <span className="ml-3 text-[10px] text-slate-500">New rows are saved locally to this datasheet.</span>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                          <div className="mt-4 p-3 border border-slate-200 rounded bg-slate-50 text-xs text-slate-700">
                            <div className="font-bold mb-1">NOTES:</div>
                            <ul className="list-disc pl-5 space-y-0.5">
                              {schema.revisionFooter.map((n, i) => {
                                const k = auxKey('revision_note', i);
                                return (
                                  <li key={i}>
                                    <EditableInline
                                      valueKey={k}
                                      initialValue={aux(k, n)}
                                      status={auxStatus[k]}
                                      onChange={handleAuxEdit}
                                      className="min-w-[80%]"
                                    />
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        </div>
                      );
                    }

                    if (page.kind === 'hold') {
                      return (
                        <div className="p-6 bg-white">
                          {DocHeader}
                          {banner('HOLDS')}
                          <table className="w-full text-xs border border-slate-300 border-t-0">
                            <thead className="bg-[#1F4E79] text-white">
                              <tr>
                                <th className="px-3 py-2 border border-slate-300 w-24">Rev. No.</th>
                                <th className="px-3 py-2 border border-slate-300 text-left">Hold Description</th>
                                <th className="px-3 py-2 border border-slate-300 w-28">Section</th>
                              </tr>
                            </thead>
                            <tbody>
                              {schema.holds.map((h, i) => {
                                const ek = (col) => auxKey('hold', i, col);
                                return (
                                <tr key={i} className="hover:bg-blue-50">
                                  <EditableCell rowIdx={`hold:${i}`} columnKey="rev"         initialValue={aux(ek('rev'), h.rev)}                 status={auxStatus[ek('rev')]}         onChange={(_, __, v) => handleAuxEdit(ek('rev'), v)}         className="px-3 py-2 border border-slate-300 text-center font-bold" align="center" />
                                  <EditableCell rowIdx={`hold:${i}`} columnKey="description" initialValue={aux(ek('description'), h.description)} status={auxStatus[ek('description')]} onChange={(_, __, v) => handleAuxEdit(ek('description'), v)} className="px-3 py-2 border border-slate-300" />
                                  <EditableCell rowIdx={`hold:${i}`} columnKey="section"     initialValue={aux(ek('section'), h.section)}         status={auxStatus[ek('section')]}     onChange={(_, __, v) => handleAuxEdit(ek('section'), v)}     className="px-3 py-2 border border-slate-300 text-center" align="center" />
                                </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    }

                    if (page.kind === 'index') {
                      return (
                        <div className="p-6 bg-white">
                          {DocHeader}
                          {banner('TABLE OF CONTENTS')}
                          <table className="w-full text-xs border border-slate-300 border-t-0">
                            <thead className="bg-[#1F4E79] text-white">
                              <tr>
                                <th className="px-3 py-2 border border-slate-300 w-20">Sr. No.</th>
                                <th className="px-3 py-2 border border-slate-300 text-left">DESCRIPTION</th>
                                <th className="px-3 py-2 border border-slate-300 w-24">SHEET</th>
                              </tr>
                            </thead>
                            <tbody>
                              {schema.index.map((r, i) => {
                                const ek = (col) => auxKey('index', i, col);
                                return (
                                <tr key={i} className="hover:bg-blue-50">
                                  <EditableCell rowIdx={`index:${i}`} columnKey="sr"          initialValue={aux(ek('sr'), r.sr)}                   status={auxStatus[ek('sr')]}          onChange={(_, __, v) => handleAuxEdit(ek('sr'), v)}          className="px-3 py-2 border border-slate-300 text-center font-bold" align="center" />
                                  <EditableCell rowIdx={`index:${i}`} columnKey="description" initialValue={aux(ek('description'), r.description)} status={auxStatus[ek('description')]} onChange={(_, __, v) => handleAuxEdit(ek('description'), v)} className="px-3 py-2 border border-slate-300" />
                                  <EditableCell rowIdx={`index:${i}`} columnKey="sheet"       initialValue={aux(ek('sheet'), r.sheet)}             status={auxStatus[ek('sheet')]}       onChange={(_, __, v) => handleAuxEdit(ek('sheet'), v)}       className="px-3 py-2 border border-slate-300 text-center font-mono" align="center" />
                                </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          <div className="mt-4">
                            <div className="bg-[#1F4E79] text-white text-center font-bold py-2 border border-slate-300">ABBREVIATIONS</div>
                            <table className="w-full text-xs border border-slate-300 border-t-0">
                              <tbody>
                                {schema.abbreviations.map(([abbr, meaning], i) => {
                                  const ek = (col) => auxKey('abbr', i, col);
                                  return (
                                  <tr key={i} className="hover:bg-blue-50">
                                    <EditableCell rowIdx={`abbr:${i}`} columnKey="abbr"    initialValue={aux(ek('abbr'), abbr)}       status={auxStatus[ek('abbr')]}    onChange={(_, __, v) => handleAuxEdit(ek('abbr'), v)}    className="px-3 py-2 border border-slate-300 text-center font-mono font-bold w-24 bg-slate-50" align="center" />
                                    <EditableCell rowIdx={`abbr:${i}`} columnKey="meaning" initialValue={aux(ek('meaning'), meaning)} status={auxStatus[ek('meaning')]} onChange={(_, __, v) => handleAuxEdit(ek('meaning'), v)} className="px-3 py-2 border border-slate-300" />
                                  </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    }

                    if (page.kind === 'notes') {
                      return (
                        <div className="p-6 bg-white">
                          {DocHeader}
                          {banner('GENERAL NOTES')}
                          <table className="w-full text-xs border border-slate-300 border-t-0">
                            <thead className="bg-[#1F4E79] text-white">
                              <tr>
                                <th className="px-3 py-2 border border-slate-300 w-20">SI. NO.</th>
                                <th className="px-3 py-2 border border-slate-300 text-left">Description</th>
                              </tr>
                            </thead>
                            <tbody>
                              {schema.notes.map(([label, text], i) => {
                                const ek = (col) => auxKey('notes', i, col);
                                const isSub = /^[a-z]$/.test(label);
                                return (
                                <tr key={i} className="hover:bg-blue-50">
                                  <EditableCell rowIdx={`notes:${i}`} columnKey="label" initialValue={aux(ek('label'), label)} status={auxStatus[ek('label')]} onChange={(_, __, v) => handleAuxEdit(ek('label'), v)} className={`px-3 py-2 border border-slate-300 text-center font-bold ${isSub ? 'text-slate-500' : 'text-slate-900'}`} align="center" />
                                  <EditableCell rowIdx={`notes:${i}`} columnKey="text"  initialValue={aux(ek('text'), text)}   status={auxStatus[ek('text')]}  onChange={(_, __, v) => handleAuxEdit(ek('text'), v)}  className={`px-3 py-2 border border-slate-300 ${isSub ? 'pl-10 italic text-slate-700' : ''}`} />
                                </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    }

                    // page.kind === 'datasheet'
                    const variantMatches = !page.variant || !results.variant || page.variant === results.variant;
                    return (
                      <div className="p-6 bg-white">
                        {DocHeader}
                        {banner(page.subtitle || page.label)}
                        {variantMatches ? (
                          <div className="overflow-x-auto max-h-[600px] overflow-y-auto border border-slate-300 border-t-0">
                            <table className="w-full text-xs">
                              <thead className="bg-[#1F4E79] text-white sticky top-0">
                                <tr>
                                  <th className="px-3 py-2 border border-slate-300 w-16">SI NO.</th>
                                  <th className="px-3 py-2 border border-slate-300 text-left w-2/5">DESCRIPTION</th>
                                  <th className="px-3 py-2 border border-slate-300 w-16">UNIT</th>
                                  <th className="px-3 py-2 border border-slate-300 text-left w-2/5">SPECIFIED DESIGN DATA</th>
                                  <th className="px-3 py-2 border border-slate-300 w-16">Rev</th>
                                </tr>
                              </thead>
                              <tbody>
                                {results.datasheet_rows.map((row, index) => {
                                  const isSectionHeader = row.is_section === true
                                    || (!row.sr_no && row.description && !row.required_data && !row.vendor_data);
                                  return (
                                    <tr key={index} className={`${isSectionHeader ? 'bg-blue-100 font-bold' : index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50 border-b border-slate-200`}>
                                      <td className={`px-3 py-2 border border-slate-200 ${isSectionHeader ? 'text-blue-900' : 'text-slate-900'} text-center`}>{row.sr_no}</td>
                                      <td className={`px-3 py-2 border border-slate-200 ${isSectionHeader ? 'text-blue-900 uppercase' : 'text-slate-900'}`}>{row.description}</td>
                                      <td className="px-3 py-2 border border-slate-200 text-center text-slate-500">{row.unit || ''}</td>
                                      <EditableCell
                                        rowIdx={index}
                                        columnKey="required_data"
                                        initialValue={edits[`${index}:required_data`] !== undefined ? edits[`${index}:required_data`] : row.required_data}
                                        status={cellStatus[`${index}:required_data`]}
                                        disabled={isSectionHeader}
                                        onChange={handleCellEdit}
                                        className="px-3 py-2 border border-slate-200 text-slate-700"
                                      />
                                      <EditableCell
                                        rowIdx={index}
                                        columnKey="rev"
                                        initialValue={edits[`${index}:rev`] !== undefined ? edits[`${index}:rev`] : row.rev}
                                        status={cellStatus[`${index}:rev`]}
                                        disabled={isSectionHeader}
                                        onChange={handleCellEdit}
                                        className="px-3 py-2 border border-slate-200 text-center text-slate-600"
                                        align="center"
                                        placeholderClass="text-slate-300"
                                      />
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="p-10 text-center text-sm text-slate-600 border border-slate-300 border-t-0 bg-slate-50">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold mb-3">
                              <BoltIcon className="h-3.5 w-3.5" />
                              Variant not in current generation
                            </div>
                            <p>
                              The current document was generated for the
                              <span className="font-semibold text-slate-900"> {results.variant === 'distribution' ? '1.25 MVA Distribution' : '25 MVA Power'} </span>
                              transformer variant. To view the
                              <span className="font-semibold text-slate-900"> {page.variant === 'distribution' ? '1.25 MVA' : '25 MVA'} </span>
                              datasheet, generate it from the matching sizing calculation document.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
              );
            })()}

            {/* Download Button */}
            <div className="flex flex-col sm:flex-row gap-3">
              {excelBlob && (
                <button
                  onClick={handleDownload}
                  className="group relative flex-1 py-4 px-6 bg-gradient-to-r from-emerald-500 to-cyan-500
                           hover:from-emerald-400 hover:to-cyan-400 text-white rounded-xl
                           font-bold flex items-center justify-center gap-2 transition-all
                           shadow-[0_0_30px_-5px_rgba(16,185,129,0.5)] hover:shadow-[0_0_40px_-5px_rgba(16,185,129,0.7)]
                           hover:scale-[1.01] overflow-hidden"
                >
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                  <ArrowDownTrayIcon className="relative h-5 w-5" />
                  <span className="relative">Download Excel Datasheet</span>
                </button>
              )}
              <button
                onClick={resetForm}
                className="px-6 py-4 border border-white/15 text-slate-200 rounded-xl
                         hover:bg-white/5 hover:border-white/30 font-semibold transition-all
                         flex items-center justify-center gap-2"
              >
                <ArrowPathIcon className="h-5 w-5" />
                Generate Another
              </button>
            </div>
          </div>
        )}

        {/* Instructions / How It Works */}
        {!selectedEquipmentType && !results && (
          <div className={`${THEME.glass} rounded-2xl p-6 md:p-8 mt-6`}>
            <div className="flex items-center gap-3 mb-6">
              <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${THEME.brandGradient} flex items-center justify-center ${THEME.glow}`}>
                <SparklesIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">How It Works</h3>
                <p className="text-xs text-slate-400">Five-step AI-driven datasheet generation</p>
              </div>
            </div>

            <ol className="grid md:grid-cols-5 gap-3">
              {[
                'Pick equipment type',
                'Upload required docs',
                'Add optional docs',
                'Run AI generation',
                'Download datasheet',
              ].map((step, i) => (
                <li key={i} className="relative p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all">
                  <div className={`absolute -top-3 left-4 h-6 w-6 rounded-full bg-gradient-to-br ${THEME.brandGradient} flex items-center justify-center text-xs font-bold text-white shadow-lg`}>
                    {i + 1}
                  </div>
                  <p className="text-sm text-slate-200 mt-2">{step}</p>
                </li>
              ))}
            </ol>

            <div className="mt-6 grid md:grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-400/20">
                <div className="text-[11px] uppercase tracking-wider text-blue-300 font-semibold mb-1">Supported Equipment</div>
                <p className="text-sm text-slate-200">Transformers · DG Set · MV / LV Switchgear · AC &amp; DC UPS</p>
              </div>
              <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-400/20">
                <div className="text-[11px] uppercase tracking-wider text-purple-300 font-semibold mb-1">File Formats</div>
                <p className="text-sm text-slate-200">PDF · Excel (.xlsx, .xls) · Images (.png, .jpg, .jpeg)</p>
              </div>
            </div>
          </div>
        )}

        {/* ── RECHECK MODAL ──────────────────────────────────────────── */}
        {recheckOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-cyan-50 to-blue-50">
                <div className="flex items-center gap-3">
                  <ArrowPathIcon className={`h-5 w-5 text-cyan-600 ${recheckLoading ? 'animate-spin' : ''}`} />
                  <h3 className="text-lg font-bold text-slate-900">Recheck Results</h3>
                </div>
                <button onClick={() => setRecheckOpen(false)} className="text-slate-400 hover:text-slate-700">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="px-6 py-4 overflow-y-auto flex-1">
                {recheckLoading && (
                  <div className="text-center py-12 text-slate-500">
                    Re-running extraction on the original source from S3...
                  </div>
                )}
                {recheckDiff?.error && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                    {recheckDiff.error}
                  </div>
                )}
                {recheckDiff && !recheckDiff.error && (
                  <>
                    <div className="text-sm text-slate-600 mb-3">
                      <span className="font-semibold">{recheckDiff.changed_count ?? 0}</span> field(s) changed
                      {' · '}<span className="font-semibold">{recheckDiff.added_count ?? 0}</span> added
                      {' · '}<span className="font-semibold">{recheckDiff.removed_count ?? 0}</span> removed
                    </div>
                    {Array.isArray(recheckDiff.changes) && recheckDiff.changes.length > 0 ? (
                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-100 text-slate-600">
                            <tr>
                              <th className="px-3 py-2 text-left">Row</th>
                              <th className="px-3 py-2 text-left">Field</th>
                              <th className="px-3 py-2 text-left">Old</th>
                              <th className="px-3 py-2 text-left">New</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recheckDiff.changes.map((c, i) => (
                              <tr key={i} className="border-t border-slate-100">
                                <td className="px-3 py-2">{c.row_index}</td>
                                <td className="px-3 py-2 font-medium">{c.column_key}</td>
                                <td className="px-3 py-2 text-red-600 line-through">{String(c.old ?? '')}</td>
                                <td className="px-3 py-2 text-emerald-700 font-medium">{String(c.new ?? '')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500 py-6 text-center">
                        No differences detected — your datasheet is up-to-date.
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
                <button
                  onClick={() => setRecheckOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartElectricalDatasheetPage;

