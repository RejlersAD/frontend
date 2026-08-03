/**
 * Non-TEFF Metadata Extractor
 * Route:  /engineering/digitization/non-teff-metadata
 *
 * Upload multi-format engineering documents (PDF, Excel, Word, AutoCAD) and
 * extract standard Non-TEFF metadata fields via backend AI analysis.
 *
 * Pattern: mirrors EquipmentList.jsx (upload → async poll → table → Excel export)
 * Visual:  EQ_T emerald/teal animated theme (orbit loader, circuit trace, node glow)
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CloudArrowUpIcon,
  CheckCircleIcon,
  ArrowDownTrayIcon,
  DocumentMagnifyingGlassIcon,
  InformationCircleIcon,
  SparklesIcon,
  ArrowRightIcon,
  LightBulbIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentTextIcon,
  EyeIcon,
  FolderIcon,
} from '@heroicons/react/24/outline';
import apiClient from '../../../services/api.service';
import { getApiBaseUrl } from '../../../config/environment.config';
import WrenchAiDocAssist from '../../../components/Engineering/WrenchAiDocAssist';
import BulkMasterIndex from './BulkMasterIndex';
import DocumentSearchCanvasView from './DocumentSearchCanvas';
import NonTeffSmartFeatures from './NonTeffSmartFeatures';

// ---------------------------------------------------------------------------
// Soft-coded column definitions — mirrors config/non_teff_fields.json
// ---------------------------------------------------------------------------
const COLUMNS = [
  { key: 'document_no',          label: 'Document No.',          width: 16 },
  { key: 'document_title',       label: 'Document Title',        width: 28 },
  { key: 'document_type',        label: 'Document Type',         width: 18 },
  { key: 'document_subtype',     label: 'Document Sub-Type',     width: 26 },
  { key: 'revision',             label: 'Rev.',                  width:  6 },
  { key: 'discipline',           label: 'Discipline',            width: 14 },
  { key: 'instrument_tag_no',    label: 'Instrument Tag No.',    width: 18 },
  { key: 'line_number',          label: 'Line Number',           width: 18 },
  { key: 'equipment_no',         label: 'Equipment No.',         width: 16 },
  { key: 'mechanical_component', label: 'Mechanical Component',  width: 22 },
  { key: 'status',               label: 'Status',                width: 14 },
  { key: 'date',                 label: 'Date',                  width: 12 },
  { key: 'originator',           label: 'Originator',            width: 16 },
  { key: 'remarks',              label: 'Remarks',               width: 24 },
];

// Info panel field descriptions
const FIELD_INFO = [
  { key: 'document_no',          label: 'Document No.',          desc: 'Drawing / document reference number', color: '#059669' },
  { key: 'document_title',       label: 'Document Title',        desc: 'Full title of the source document',   color: '#0891b2' },
  { key: 'document_type',        label: 'Document Type',         desc: 'Top-level taxonomy class (Civil, Equipment, Piping, …)', color: '#0e7490' },
  { key: 'document_subtype',     label: 'Document Sub-Type',     desc: 'Controlled sub-class (Civil Calculations, Equipment Miscellaneous, Vessel Design Calculations, …)', color: '#0369a1' },
  { key: 'revision',             label: 'Revision',              desc: 'Current revision identifier (A, B, 01…)', color: '#7c3aed' },
  { key: 'discipline',           label: 'Discipline',            desc: 'Engineering discipline (Process, Instrument, …)', color: '#b45309' },
  { key: 'instrument_tag_no',    label: 'Instrument Tag No.',    desc: 'All instrument tag numbers found',    color: '#0f766e' },
  { key: 'line_number',          label: 'Line Number',           desc: 'Pipe / line numbers referenced',      color: '#1d4ed8' },
  { key: 'equipment_no',         label: 'Equipment No.',         desc: 'Equipment tag numbers (V-, P-, E-, …)', color: '#9d174d' },
  { key: 'mechanical_component', label: 'Mechanical Component',  desc: 'Mechanical items mentioned (pump, vessel, …)', color: '#6d28d9' },
  { key: 'status',               label: 'Status',                desc: 'Non-TEFF status (IFR, IFA, Draft, …)', color: '#b91c1c' },
  { key: 'date',                 label: 'Date',                  desc: 'Issue / revision date',               color: '#047857' },
  { key: 'originator',           label: 'Originator',            desc: 'Prepared-by / author information',    color: '#6b7280' },
  { key: 'remarks',              label: 'Remarks',               desc: 'Extraction source notes',             color: '#78716c' },
];

// ---------------------------------------------------------------------------
// Timing constants
// ---------------------------------------------------------------------------
const POLL_INTERVAL_MS  = 3000;
const POLL_MAX_WAIT_MS  = 300000;  // 5 min
// SOFT-CODED per-endpoint upload timeout. Keeps the global axios timeout
// (used by /auth/login/) small while letting Non-TEFF uploads run long.
// Override via Vite env: VITE_NONTEFF_UPLOAD_TIMEOUT_MS (ms).
// Default 30 min covers cold-start + large PDF normalisation on Railway
// without forcing the global timeout up (which would break login UX).
const _nontEffEnvNum = (raw, fallback) => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const UPLOAD_TIMEOUT_MS = _nontEffEnvNum(
  import.meta.env?.VITE_NONTEFF_UPLOAD_TIMEOUT_MS,
  30 * 60 * 1000,
);

// ---------------------------------------------------------------------------
// Supported formats
// ---------------------------------------------------------------------------
const SUPPORTED_FORMATS = [
  { ext: '.pdf',        label: 'PDF',        color: '#ef4444' },
  { ext: '.xlsx/.xls',  label: 'Excel',      color: '#22c55e' },
  { ext: '.docx/.doc',  label: 'Word',       color: '#3b82f6' },
  { ext: '.dwg/.dxf',   label: 'AutoCAD',    color: '#f59e0b' },
];

const ACCEPT_STRING = '.pdf,.xlsx,.xls,.docx,.doc,.dwg,.dxf';

// ─── AI Document Assist (Wrench) — soft-coded panel config ─────────────────
// Mirrors the panel on PID Verification / PMS / Instrument Index / CLL /
// PFD Quality Checker / Line List / Equipment List.
// Non-TEFF is multi-format: PDF / Excel / Word / AutoCAD.  Flip
// `enabled: false` to hide the panel without touching JSX.
const NT_AI_ASSIST_CONFIG = {
  enabled:         true,
  title:           'AI Document Assist',
  subtitleTag:     '(Wrench · optional)',
  subtitle:        'Let RAD AI pick & recommend the right engineering document (PDF / Excel / Word / DWG) for this project from Wrench DMS',
  defaultHint:     'engineering document metadata',
  hintPlaceholder: 'e.g. datasheet, specification, drawing list',
  topN:            6,
  // Mirror ACCEPT_STRING so the panel's file-type filter matches the page's <input accept=...>
  acceptedExts:    ['pdf','xlsx','xls','docx','doc','dwg','dxf'],
};

// apiClient already has baseURL=API_BASE_URL ('/api/v1'), so use a relative
// prefix — prepending getApiBaseUrl() here duplicates '/api/v1/api/v1/...'.
const API_PREFIX = '/non-teff';

// ---------------------------------------------------------------------------
// Keyframes — shared EQ style, teal/emerald palette
// ---------------------------------------------------------------------------
const NT_KEYFRAMES = `
  @keyframes ntOrbitA {
    from { transform: rotate(0deg)   translateX(30px) rotate(0deg);    }
    to   { transform: rotate(360deg) translateX(30px) rotate(-360deg); }
  }
  @keyframes ntOrbitB {
    from { transform: rotate(120deg) translateX(30px) rotate(-120deg); }
    to   { transform: rotate(480deg) translateX(30px) rotate(-480deg); }
  }
  @keyframes ntOrbitC {
    from { transform: rotate(240deg) translateX(30px) rotate(-240deg); }
    to   { transform: rotate(600deg) translateX(30px) rotate(-600deg); }
  }
  @keyframes ntGradShift {
    0%   { background-position: 0%   50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0%   50%; }
  }
  @keyframes ntTraceH {
    0%   { transform: scaleX(0); transform-origin: left;  }
    48%  { transform: scaleX(1); transform-origin: left;  }
    52%  { transform: scaleX(1); transform-origin: right; }
    100% { transform: scaleX(0); transform-origin: right; }
  }
  @keyframes ntTraceV {
    0%   { transform: scaleY(0); transform-origin: top;    }
    48%  { transform: scaleY(1); transform-origin: top;    }
    52%  { transform: scaleY(1); transform-origin: bottom; }
    100% { transform: scaleY(0); transform-origin: bottom; }
  }
  @keyframes ntNodeGlow {
    0%, 100% { box-shadow: 0 0 10px rgba(5,150,105,0.12), 0 4px 16px rgba(5,150,105,0.07); }
    50%       { box-shadow: 0 0 26px rgba(5,150,105,0.26), 0 4px 22px rgba(5,150,105,0.13); }
  }
  @keyframes ntChipPop {
    0%   { opacity: 0; transform: scale(0.72) translateY(5px); }
    62%  { transform: scale(1.06) translateY(-1px); }
    100% { opacity: 1; transform: scale(1)    translateY(0);   }
  }
  @keyframes ntFloatA {
    0%, 100% { transform: translateY(0)     scale(1);    }
    50%       { transform: translateY(-24px) scale(1.04); }
  }
  @keyframes ntFloatB {
    0%, 100% { transform: translateY(0)    scale(1);    }
    50%       { transform: translateY(20px) scale(0.97); }
  }
  @keyframes ntFloatC {
    0%, 100% { transform: translateY(0)     scale(1);    }
    50%       { transform: translateY(-15px) scale(1.02); }
  }
  @keyframes ntSpinSlowRev {
    from { transform: rotate(360deg); }
    to   { transform: rotate(0deg);   }
  }
  @keyframes ntRowIn {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0);   }
  }
  @keyframes ntFadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes ntPulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.5; }
  }
  .nt-row-animate { animation: ntRowIn 0.3s ease forwards; opacity: 0; }
  .nt-section     { animation: ntFadeUp 0.5s ease both; }
  .nt-chip        { animation: ntChipPop 0.4s ease both; }
  .nt-kpi-node    { animation: ntNodeGlow 2.6s ease infinite; }
  .nt-upload-zone:hover { border-color: rgba(5,150,105,0.55) !important; background: rgba(5,150,105,0.06) !important; }
  .nt-action-btn:hover:not(:disabled) { box-shadow: 0 6px 24px rgba(5,150,105,0.42) !important; transform: translateY(-1px); }
  .nt-export-btn:hover { background: rgba(5,150,105,0.14) !important; border-color: rgba(5,150,105,0.4) !important; }

  /* ─── Oil & Gas themed tab switcher ─── */
  @keyframes ntPipelineFlow {
    0%   { background-position:   0% 50%; }
    100% { background-position: 200% 50%; }
  }
  @keyframes ntDropletRise {
    0%   { transform: translateY(6px)  scale(0.85); opacity: 0; }
    40%  { opacity: 1; }
    100% { transform: translateY(-14px) scale(1);   opacity: 0; }
  }
  @keyframes ntTabGlow {
    0%, 100% { box-shadow: 0 4px 18px rgba(5,150,105,0.28), inset 0 1px 0 rgba(255,255,255,0.35); }
    50%       { box-shadow: 0 6px 26px rgba(8,145,178,0.45), inset 0 1px 0 rgba(255,255,255,0.45); }
  }
  @keyframes ntGaugeSweep {
    0%   { transform: rotate(-60deg); }
    50%  { transform: rotate(60deg);  }
    100% { transform: rotate(-60deg); }
  }
  .nt-tab-inactive:hover {
    background: rgba(255,255,255,0.85) !important;
    color: #047857 !important;
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(5,150,105,0.15);
  }
  .nt-tab-active { animation: ntTabGlow 3s ease-in-out infinite; }
  .nt-tab-pipeline {
    background: linear-gradient(90deg,
      rgba(5,150,105,0)    0%,
      rgba(5,150,105,0.9) 20%,
      rgba(8,145,178,0.9) 50%,
      rgba(5,150,105,0.9) 80%,
      rgba(5,150,105,0)   100%);
    background-size: 200% 100%;
    animation: ntPipelineFlow 2.8s linear infinite;
  }
  .nt-droplet { animation: ntDropletRise 1.8s ease-in-out infinite; }
  .nt-gauge-needle {
    transform-origin: 50% 100%;
    animation: ntGaugeSweep 2.4s ease-in-out infinite;
  }

  /* ─── Engagement layer: sheen, tip rotator, reco cards ─── */
  @keyframes ntSheen {
    0%   { background-position: -150% 0; }
    100% { background-position:  250% 0; }
  }
  @keyframes ntTipSlide {
    0%   { opacity: 0; transform: translateY(8px); }
    12%  { opacity: 1; transform: translateY(0);   }
    88%  { opacity: 1; transform: translateY(0);   }
    100% { opacity: 0; transform: translateY(-8px);}
  }
  @keyframes ntRecoPulse {
    0%, 100% { transform: translateX(0);   }
    50%      { transform: translateX(3px); }
  }
  @keyframes ntTrustCount {
    from { opacity: 0; transform: translateY(6px) scale(0.96); }
    to   { opacity: 1; transform: translateY(0)   scale(1);    }
  }
  .nt-hero-title-sheen {
    background: linear-gradient(90deg, #059669 0%, #0891b2 40%, #ffffff 50%, #0891b2 60%, #059669 100%);
    background-size: 250% 100%;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: ntSheen 6s ease-in-out infinite;
  }
  .nt-reco-card {
    transition: transform 0.25s cubic-bezier(0.4,0,0.2,1),
                box-shadow 0.25s cubic-bezier(0.4,0,0.2,1),
                border-color 0.25s ease;
    will-change: transform, box-shadow;
  }
  .nt-reco-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 14px 32px -10px rgba(5,150,105,0.28), 0 6px 12px -6px rgba(15,23,42,0.12) !important;
  }
  .nt-reco-card:hover .nt-reco-arrow { animation: ntRecoPulse 0.9s ease-in-out infinite; }
  .nt-trust-badge { animation: ntTrustCount 0.5s ease both; }
  .nt-info-card:hover {
    background: rgba(255,255,255,1) !important;
    transform: translateY(-2px);
    box-shadow: 0 6px 14px -6px rgba(5,150,105,0.18);
  }

  /* ─── Tab bar — responsive smart-alignment ───────────────────────────
     Soft-coded breakpoints prevent the "Single File / Bulk Master Index /
     History" pill from being clipped on narrow viewports and stop the
     hero <h1> from overlapping the tab strip. Behaviour by breakpoint:
       ≥ 880px → full pill, icon + label + hint sub-line shown
       640-879 → pill wraps; hint hidden; label kept full
       < 640px → tabs stack vertically; pill becomes full-width column
  */
  .nt-tab-pill {
    display: inline-flex;
    flex-wrap: wrap;
    max-width: 100%;
  }
  .nt-tab-btn {
    flex: 0 1 auto;
    min-width: 0;
  }
  .nt-tab-btn-label-hint { display: inline; }
  @media (max-width: 879px) {
    .nt-tab-btn-label-hint { display: none !important; }
  }
  @media (max-width: 639px) {
    .nt-tab-pill {
      display: flex !important;
      flex-direction: column;
      align-items: stretch !important;
      width: 100%;
      border-radius: 18px !important;
    }
    .nt-tab-btn {
      width: 100%;
      justify-content: flex-start !important;
      border-radius: 14px !important;
    }
  }
`;

// Visual theme constants
const NT_T = {
  bg:      'linear-gradient(145deg, #f0fdf4 0%, #ecfdf5 40%, #f1f5f9 100%)',
  gridDot: 'radial-gradient(circle, rgba(5,150,105,0.06) 1px, transparent 1px)',
  gradBar: 'linear-gradient(90deg,#059669,#0891b2,#10b981,#0284c7,#059669)',
  blobs: [
    { color:'rgba(5,150,105,0.09)',  size:'560px', top:'-80px',    left:'10%',    anim:'ntFloatA 14s ease-in-out infinite'     },
    { color:'rgba(8,145,178,0.06)',  size:'440px', top:'30%',      right:'-60px', anim:'ntFloatB 17s ease-in-out infinite'     },
    { color:'rgba(16,185,129,0.07)', size:'380px', bottom:'-60px', left:'35%',    anim:'ntFloatC 12s ease-in-out infinite'     },
    { color:'rgba(5,150,105,0.05)',  size:'300px', top:'55%',      left:'-50px',  anim:'ntFloatA 10s ease-in-out infinite 3s'  },
  ],
  electrons: ['#059669', '#0891b2', '#6ee7b7'],
  chips: [
    { icon:'🏷️', label:'Instrument Tags'    },
    { icon:'📄', label:'Document Metadata'  },
    { icon:'🔢', label:'Line Numbers'       },
    { icon:'⚙️', label:'Equipment Nos.'     },
    { icon:'🔩', label:'Mech. Components'   },
    { icon:'📁', label:'Multi-Format'       },
  ],
};

// ---------------------------------------------------------------------------
// Soft-coded engagement content — edit freely, no logic depends on this.
// ---------------------------------------------------------------------------

// Rotating "Did you know?" tips shown under the hero chips.
const PRO_TIPS = [
  { icon: '💡', text: 'Drop a folder of drawings into Bulk Master Index — RAD AI merges them into a single registry.' },
  { icon: '⚡', text: 'Extraction runs on a Celery worker, so you can keep reviewing earlier jobs while this one finishes.' },
  { icon: '🔒', text: 'Every uploaded document is scoped to your project — nothing is shared across tenants.' },
  { icon: '🎯', text: 'Ambiguous tags? Edit inline in the grid — RAD AI will re-learn your team\'s preferences.' },
  { icon: '🧠', text: 'AI-extracted fields feed directly into Equipment List, Line List and Datasheet modules.' },
];
const PRO_TIP_ROTATE_MS = 5500;

// Badges shown in the trust-strip beneath the chips.
const TRUST_BADGES = [
  { value: '12+',   label: 'Metadata fields'      },
  { value: '4',     label: 'Document formats'     },
  { value: '~30s',  label: 'Avg. extraction time' },
  { value: '100%',  label: 'Project-scoped'       },
];

// Recommendation system — surfaces other RAD AI modules this user will benefit from.
// Grouped by category; each item stays on-brand with its accent color.
const RECOMMENDED_FEATURES = [
  {
    category: 'Process Engineering',
    items: [
      { to: '/engineering/process/equipment-list',   icon: '⚙️', title: 'Equipment List',        tagline: 'Auto-register equipment from P&IDs',   benefit: 'Saves ~6 hrs / drawing',  accent: '#7c3aed' },
      { to: '/engineering/process/line-list',        icon: '🔢', title: 'Line List',             tagline: 'Piping line register with specs',      benefit: 'OCR-assisted',            accent: '#0891b2' },
      { to: '/engineering/process/pid-verification', icon: '🔍', title: 'P&ID Verification',     tagline: 'AI rule-engine for P&ID quality',      benefit: 'Catches 40+ issue types', accent: '#059669' },
      { to: '/engineering/process/pfd-quality-checker', icon: '📊', title: 'PFD Quality Checker', tagline: 'Five-stage PFD analysis',            benefit: 'Stream + mass balance',   accent: '#0284c7' },
    ],
  },
  {
    category: 'Piping & Datasheets',
    items: [
      { to: '/engineering/piping/critical-line-list',          icon: '🧪', title: 'Critical Line List',    tagline: 'Stress-critical piping inventory', benefit: 'Discipline-ready',     accent: '#b45309' },
      { to: '/engineering/process/datasheet',                  icon: '📝', title: 'Process Datasheets',    tagline: 'Generate equipment datasheets',    benefit: 'One-click PDF',        accent: '#9d174d' },
      { to: '/engineering/instrument/datasheet',               icon: '🎛️', title: 'Instrument Datasheets', tagline: 'AI-extract instrument specs',      benefit: 'From vendor PDFs',     accent: '#0f766e' },
      { to: '/engineering/electrical/datasheet/smart',         icon: '⚡', title: 'Electrical Datasheets', tagline: 'Motor, transformer, cable specs',  benefit: 'Smart Excel editor',   accent: '#d97706' },
    ],
  },
  {
    category: 'Document Control',
    items: [
      { to: '/crs-documents',    icon: '🔄', title: 'Change Request System', tagline: 'Multi-revision document workflow', benefit: 'Chain review',       accent: '#1d4ed8' },
      { to: '/wrench-integration', icon: '🔗', title: 'Wrench Integration',   tagline: 'Sync handover to Smart Project',   benefit: 'Transmittal-ready', accent: '#6d28d9' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Soft-coded tab switcher (oil & gas themed)
// ---------------------------------------------------------------------------
// Each tab has an SVG icon renderer so the visual intent stays in config.
// Update this array to add/rename/reorder tabs without touching logic.
const NT_TABS = [
  {
    id: 'single',
    label: 'Single File',
    hint: 'One document · focused extraction',
    accent: '#059669',   // emerald — well-head
    iconKind: 'pipe',
  },
  {
    id: 'bulk',
    label: 'Bulk Master Index',
    hint: 'Folder → master index · drop & go',
    accent: '#0891b2',   // cyan — pipeline
    iconKind: 'gauge',
  },
  {
    id: 'history',
    label: 'History',
    hint: 'Past extractions · re-open & re-test',
    accent: '#7c3aed',   // violet — archive
    iconKind: 'pipe',
  },
];

// ---------------------------------------------------------------------------
// NT_TAB_LAYOUT — soft-coded layout knobs for the tab bar. Tweak here to
// change spacing, max-width, hero clearance, etc. without hunting through
// JSX. Linked to the CSS rules in NT_KEYFRAMES (.nt-tab-pill / .nt-tab-btn).
// ---------------------------------------------------------------------------
const NT_TAB_LAYOUT = {
  // Outer wrapper
  wrapperMaxWidth:   1600,
  wrapperPadding:    '20px 24px 0 24px',
  // Pill container
  pillPadding:       5,
  pillGap:           4,
  pillRadius:        999,
  // Individual tab buttons
  btnPadding:        '10px 20px 10px 14px',
  btnMinHeight:      46,
  btnFontSize:       13,
  btnGap:            10,
  iconBoxSize:       30,
  // Vertical breathing room BELOW the tab bar so the hero <h1> never
  // overlaps the pill when tabs wrap onto a second row at < 880px wide.
  bottomClearance:   16,
};

// ---------------------------------------------------------------------------
// HISTORY_CONFIG — every knob for the History tab in one place
// Mirrors the backend service so frontend & backend evolve together.
// ---------------------------------------------------------------------------
const HISTORY_CONFIG = {
  endpoints: {
    list:   '/non-teff/history/',
    diag:   '/non-teff/history/diagnostics/',
    load:   (id) => `/non-teff/history/${id}/`,
    update: (id) => `/non-teff/history/${id}/update/`,
    remove: (id) => `/non-teff/history/${id}/delete/`,
    // Re-uses the existing batch/single export endpoints — no new logic.
    exportJob:   (id) => `/non-teff/export/${id}/`,
    exportBatch: (id) => `/non-teff/batch/${id}/export/`,
  },
  pageSize:        50,
  refreshMs:       0,             // 0 = manual refresh only
  // Status badge colours — soft-coded so a new status code just needs a row.
  statusColors: {
    completed:  { bg: '#ecfdf5', fg: '#047857', label: 'Completed'  },
    ready:      { bg: '#ecfdf5', fg: '#047857', label: 'Ready'      },
    exported:   { bg: '#dbeafe', fg: '#1e40af', label: 'Exported'   },
    processing: { bg: '#eff6ff', fg: '#1d4ed8', label: 'Processing' },
    extracting: { bg: '#eff6ff', fg: '#1d4ed8', label: 'Extracting' },
    uploading:  { bg: '#fef3c7', fg: '#b45309', label: 'Uploading'  },
    pending:    { bg: '#fef3c7', fg: '#b45309', label: 'Pending'    },
    draft:      { bg: '#f1f5f9', fg: '#475569', label: 'Draft'      },
    failed:     { bg: '#fee2e2', fg: '#b91c1c', label: 'Failed'     },
  },
  // Columns rendered in the table — pure config.
  columns: [
    { key: 'file_name',   label: 'Document',   flex: 2,   align: 'left'   },
    { key: 'file_format', label: 'Format',     flex: 0.6, align: 'center' },
    { key: 'total_items', label: 'Records',    flex: 0.6, align: 'center' },
    { key: 'status',      label: 'Status',     flex: 0.8, align: 'center' },
    { key: 'created_by',  label: 'User',       flex: 1,   align: 'left', adminOnly: true },
    { key: 'created_at',  label: 'Extracted',  flex: 1.2, align: 'left'   },
    { key: '__actions',   label: '',           flex: 1.6, align: 'right'  },
  ],
  // Soft-coded row actions — add/remove a row to add/remove a button.
  // `enabledFor` lists statuses where the button is clickable; `null` = always.
  // `requiresWrite`: hidden for users without write access (RBAC).
  actions: [
    { id: 'open',     label: 'Open',     icon: '↗',  variant: 'primary',
      enabledFor: ['completed', 'ready', 'exported'], requiresWrite: false },
    { id: 'modify',   label: 'Modify',   icon: '✎',  variant: 'ghost',
      enabledFor: null, requiresWrite: true },
    { id: 'download', label: 'Download', icon: '⬇',  variant: 'ghost',
      enabledFor: ['completed', 'ready', 'exported'], requiresWrite: false },
    { id: 'delete',   label: 'Delete',   icon: '✕',  variant: 'danger',
      enabledFor: null, requiresWrite: true, confirm: 'Delete this extraction permanently?' },
  ],
  emptyMessage: 'No past extractions yet. Upload a document to get started.',
  loadFailMsg:  'Could not load history. Please retry.',
};

// Inline SVG icon set — themed for oil & gas.
// `active` controls the animated accent (flow, needle sweep).
const NtTabIcon = ({ kind, active, accent }) => {
  if (kind === 'pipe') {
    // Well-head / valve wheel + single drop
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="10" r="5" stroke={accent} strokeWidth="1.6" />
        <path d="M12 5 V3 M12 17 V15 M7 10 H5 M19 10 H17 M8.5 6.5 L7 5 M15.5 6.5 L17 5 M8.5 13.5 L7 15 M15.5 13.5 L17 15"
              stroke={accent} strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="12" cy="10" r="1.6" fill={accent} />
        {active && (
          <path className="nt-droplet" d="M12 18 C 13 19.2 13 20.4 12 21 C 11 20.4 11 19.2 12 18 Z" fill={accent} />
        )}
      </svg>
    );
  }
  if (kind === 'gauge') {
    // Pressure gauge — needle sweeps when active
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="8.5" stroke={accent} strokeWidth="1.6" />
        <path d="M5 12 A7 7 0 0 1 19 12" stroke={accent} strokeWidth="1" strokeDasharray="1.5 2" opacity="0.5" />
        <g className={active ? 'nt-gauge-needle' : ''} style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}>
          <line x1="12" y1="12" x2="12" y2="5.5" stroke={accent} strokeWidth="1.6" strokeLinecap="round" />
        </g>
        <circle cx="12" cy="12" r="1.4" fill={accent} />
      </svg>
    );
  }
  return null;
};

// ---------------------------------------------------------------------------
// HistoryPanel — role-based list of past extractions, with re-open action.
// Pure presentation: receives `onOpen(item, payload)` and bubbles results up
// to the parent which sets state and switches back to the Single tab. The
// core extraction pipeline is untouched.
// ---------------------------------------------------------------------------
const HistoryPanel = ({ onOpen }) => {
  const [items,    setItems]    = React.useState([]);
  const [role,     setRole]     = React.useState('');
  const [loading,  setLoading]  = React.useState(false);
  const [error,    setError]    = React.useState(null);
  const [busyId,   setBusyId]   = React.useState(null);
  const [busyAct,  setBusyAct]  = React.useState(null);   // 'open' | 'modify' | 'download' | 'delete'
  const [editId,   setEditId]   = React.useState(null);   // row currently being renamed
  const [editName, setEditName] = React.useState('');
  // S3 archival diagnostics — soft-coded badge in the header. Falls back to
  // hidden if the diagnostics endpoint is unavailable (older backend).
  const [s3Diag,   setS3Diag]   = React.useState(null);

  const fetchHistory = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await apiClient.get(HISTORY_CONFIG.endpoints.list, {
        params: { limit: HISTORY_CONFIG.pageSize },
        timeout: 15000,
      });
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      setRole(res.data?.role || '');
    } catch (e) {
      setError(HISTORY_CONFIG.loadFailMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // One-shot S3 archival probe. Silently ignored on failure so the History
  // tab still works against older backends without the /diagnostics route.
  React.useEffect(() => {
    let cancelled = false;
    apiClient.get(HISTORY_CONFIG.endpoints.diag, { timeout: 8000 })
      .then(res => { if (!cancelled) setS3Diag(res.data || null); })
      .catch(() => { /* feature optional */ });
    return () => { cancelled = true; };
  }, []);

  // Soft-coded action dispatcher — switch on action.id
  const runAction = async (action, item) => {
    if (action.confirm && !window.confirm(action.confirm)) return;
    setBusyId(item.job_id); setBusyAct(action.id); setError(null);
    try {
      if (action.id === 'open') {
        const res = await apiClient.get(HISTORY_CONFIG.endpoints.load(item.job_id), { timeout: 20000 });
        onOpen?.(item, res.data);
      } else if (action.id === 'modify') {
        setEditId(item.job_id);
        setEditName(item.file_name || '');
      } else if (action.id === 'download') {
        const isBatch = item.kind === 'batch';
        const url = isBatch
          ? HISTORY_CONFIG.endpoints.exportBatch(item.job_id)
          : HISTORY_CONFIG.endpoints.exportJob(item.job_id);
        const res = await apiClient.get(url, { responseType: 'blob', timeout: 60000 });
        const blob = new Blob([res.data], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${(item.file_name || 'extraction').replace(/[^\w.-]+/g, '_')}.xlsx`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      } else if (action.id === 'delete') {
        await apiClient.delete(HISTORY_CONFIG.endpoints.remove(item.job_id), { timeout: 15000 });
        setItems(prev => prev.filter(i => i.job_id !== item.job_id));
      }
    } catch (e) {
      setError(`Could not ${action.label.toLowerCase()} this entry.`);
    } finally {
      setBusyId(null); setBusyAct(null);
    }
  };

  const submitRename = async (item) => {
    const next = (editName || '').trim();
    if (!next || next === item.file_name) { setEditId(null); return; }
    setBusyId(item.job_id); setBusyAct('modify'); setError(null);
    try {
      const res = await apiClient.patch(
        HISTORY_CONFIG.endpoints.update(item.job_id),
        { name: next },
        { timeout: 15000 },
      );
      const updatedName = res.data?.entry?.file_name || next;
      setItems(prev => prev.map(i => i.job_id === item.job_id ? { ...i, file_name: updatedName } : i));
      setEditId(null); setEditName('');
    } catch (e) {
      setError('Could not rename this entry.');
    } finally {
      setBusyId(null); setBusyAct(null);
    }
  };

  const isAdmin = role === 'admin';
  const visibleCols = HISTORY_CONFIG.columns.filter(c => !c.adminOnly || isAdmin);

  // Soft-coded button styling per variant.
  const variantStyle = (variant, disabled) => {
    if (disabled) {
      return { background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0', cursor: 'not-allowed' };
    }
    if (variant === 'primary') return { background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: '#fff', border: '1px solid #6d28d9', cursor: 'pointer' };
    if (variant === 'danger')  return { background: '#fff', color: '#b91c1c', border: '1px solid #fecaca', cursor: 'pointer' };
    return { background: '#fff', color: '#475569', border: '1px solid #e2e8f0', cursor: 'pointer' };
  };

  const fmtCell = (item, col) => {
    if (col.key === '__actions') {
      // Inline rename mode wins over normal action cluster
      if (editId === item.job_id) {
        return (
          <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitRename(item);
                if (e.key === 'Escape') { setEditId(null); setEditName(''); }
              }}
              style={{
                padding: '4px 8px', fontSize: 12, borderRadius: 6,
                border: '1px solid #c4b5fd', minWidth: 180,
              }}
            />
            <button onClick={() => submitRename(item)}
              style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #6d28d9', background: '#7c3aed', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              Save
            </button>
            <button onClick={() => { setEditId(null); setEditName(''); }}
              style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 11, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        );
      }

      // Standard action cluster — driven by HISTORY_CONFIG.actions
      const writeAllowed = isAdmin || (item.created_by && role && role !== 'guest' && role !== 'viewer');
      return (
        <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
          {HISTORY_CONFIG.actions.map(a => {
            if (a.requiresWrite && !writeAllowed) return null;
            const enabled = !a.enabledFor || a.enabledFor.includes(item.status);
            const busy = busyId === item.job_id && busyAct === a.id;
            const disabled = !enabled || busy;
            return (
              <button
                key={a.id}
                title={a.label}
                onClick={() => runAction(a, item)}
                disabled={disabled}
                style={{
                  padding: '5px 10px', borderRadius: 6,
                  fontSize: 11, fontWeight: 600,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  ...variantStyle(a.variant, disabled),
                }}
              >
                <span style={{ fontSize: 12, lineHeight: 1 }}>{a.icon}</span>
                <span>{busy ? '…' : a.label}</span>
              </button>
            );
          })}
        </div>
      );
    }
    if (col.key === 'status') {
      const s = HISTORY_CONFIG.statusColors[item.status] || { bg: '#f1f5f9', fg: '#475569', label: item.status };
      return (
        <span style={{
          display: 'inline-block', padding: '3px 10px', borderRadius: 999,
          background: s.bg, color: s.fg, fontSize: 11, fontWeight: 600,
        }}>{s.label}</span>
      );
    }
    if (col.key === 'created_at' && item.created_at) {
      const d = new Date(item.created_at);
      if (!Number.isNaN(d.getTime())) return d.toLocaleString();
    }
    if (col.key === 'file_format') {
      return <span style={{ textTransform: 'uppercase', fontSize: 11, fontWeight: 600, color: '#475569' }}>{item.file_format || '—'}</span>;
    }
    return item[col.key] ?? '—';
  };

  return (
    <div style={{
      background: 'rgba(255,255,255,0.94)',
      borderRadius: 16,
      border: '1px solid rgba(124,58,237,0.18)',
      boxShadow: '0 10px 40px -12px rgba(15,23,42,0.12)',
      padding: 24,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b', letterSpacing: 0.2 }}>
            Extraction History
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
            {isAdmin
              ? 'Showing extractions from all users (admin view).'
              : 'Your past extractions — Open, Modify, Download or Delete each entry below.'}
            {role && <span style={{ marginLeft: 8, padding: '2px 8px', background: '#ede9fe', color: '#6d28d9', borderRadius: 999, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>Role: {role}</span>}
            {/* S3 archival status — soft-coded, hidden when diag unavailable */}
            {s3Diag && (() => {
              const ok = s3Diag.enabled && s3Diag.connected && s3Diag.reachable;
              const palette = ok
                ? { bg: '#ecfdf5', fg: '#047857', label: 'S3 Archive Active', icon: '☁' }
                : (s3Diag.enabled
                    ? { bg: '#fef3c7', fg: '#b45309', label: 'S3 Unreachable',   icon: '⚠' }
                    : { bg: '#f1f5f9', fg: '#64748b', label: 'S3 Disabled',     icon: '○' });
              const tip = ok
                ? `Bucket: ${s3Diag.bucket || '—'} · Region: ${s3Diag.region || '—'} · Prefix: ${s3Diag.root_prefix || '—'}`
                : (s3Diag.error || 'Archival not active — DB-only history.');
              return (
                <span title={tip} style={{
                  marginLeft: 8, padding: '2px 8px', background: palette.bg, color: palette.fg,
                  borderRadius: 999, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: 0.4, cursor: 'help',
                }}>
                  {palette.icon} {palette.label}
                </span>
              );
            })()}
          </p>
        </div>
        <button
          onClick={fetchHistory}
          disabled={loading}
          style={{
            padding: '8px 16px', borderRadius: 8,
            border: '1px solid #c4b5fd', background: '#fff', color: '#6d28d9',
            fontSize: 12, fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{
          display: 'flex', background: '#f8fafc', borderBottom: '1px solid #e5e7eb',
          padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#475569',
          textTransform: 'uppercase', letterSpacing: 0.5,
        }}>
          {visibleCols.map(c => (
            <div key={c.key} style={{ flex: c.flex, textAlign: c.align }}>{c.label}</div>
          ))}
        </div>
        {!loading && items.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            {HISTORY_CONFIG.emptyMessage}
          </div>
        )}
        {items.map((it) => (
          <div key={it.job_id} style={{
            display: 'flex', alignItems: 'center',
            padding: '12px 14px', borderBottom: '1px solid #f1f5f9',
            fontSize: 13, color: '#1e293b',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#faf5ff'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            {visibleCols.map(c => (
              <div key={c.key} style={{ flex: c.flex, textAlign: c.align, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                {fmtCell(it, c)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Project context banner — soft-coded, additive. Lets the user pick / clear
// the active Non-TEFF project. The selection is persisted in localStorage and
// attached as `project_id` to upload requests so the backend can group jobs.
// ---------------------------------------------------------------------------
const PROJECT_BANNER_CFG = {
  api: {
    list: '/non-teff/projects/',
  },
  routes: {
    projects: '/engineering/digitization/non-teff-metadata/projects',
  },
  storageKey: 'nonTeffActiveProject',
  maxRecent: 50,
  // When true, the extractor is gated behind a project selection: users must
  // pick or create a project before they can upload files. Flip to false to
  // restore the legacy "extract without project" behaviour.
  requireProjectFirst: true,
};

const ProjectContextBanner = ({ project, onChange, onClear, onManage }) => {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  const persist = (p) => {
    try {
      if (p) localStorage.setItem(PROJECT_BANNER_CFG.storageKey, JSON.stringify(p));
      else   localStorage.removeItem(PROJECT_BANNER_CFG.storageKey);
    } catch (_) { /* ignore */ }
  };

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(PROJECT_BANNER_CFG.api.list, {
        params: query ? { q: query } : {},
      });
      setList((res.data?.items || []).slice(0, PROJECT_BANNER_CFG.maxRecent));
    } catch (_) {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    if (open) loadList();
  }, [open, loadList]);

  const handlePick = (p) => {
    const trimmed = { project_id: p.project_id, name: p.name, plant: p.plant };
    onChange?.(trimmed);
    persist(trimmed);
    setOpen(false);
  };

  return (
    <div style={{
      position: 'relative', zIndex: 3,
      maxWidth: 1480, margin: '14px auto 0', padding: '0 24px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: project
          ? 'linear-gradient(90deg, rgba(5,150,105,0.10), rgba(8,145,178,0.06))'
          : 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(8px)',
        border: `1px solid ${project ? 'rgba(5,150,105,0.35)' : 'rgba(5,150,105,0.18)'}`,
        borderRadius: 12, padding: '10px 14px',
        boxShadow: '0 2px 8px rgba(5,150,105,0.06)',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'rgba(5,150,105,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <FolderIcon width={16} style={{ color: '#059669' }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {project ? (
            <>
              <div style={{ fontSize: 11, color: '#65a30d', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                Active project
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#065f46',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {project.name}
                {project.plant && <span style={{ marginLeft: 8, fontWeight: 500, color: '#4b5563', fontSize: 12 }}>
                  · {project.plant}
                </span>}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                No project selected
              </div>
              <div style={{ fontSize: 12, color: '#475569' }}>
                Extractions will not be grouped. Pick a project to organise this work.
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            background: '#059669', color: '#fff', border: 'none',
            padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        >
          <FolderIcon width={14} /> {project ? 'Switch' : 'Select project'}
        </button>
        {project && (
          <button
            onClick={() => { onClear?.(); persist(null); }}
            title="Clear active project"
            style={{
              background: 'transparent', border: '1px solid rgba(5,150,105,0.3)',
              color: '#065f46', padding: '7px 10px', borderRadius: 8,
              fontSize: 12, cursor: 'pointer',
            }}
          >
            <XMarkIcon width={14} />
          </button>
        )}
        <button
          onClick={onManage}
          style={{
            background: 'transparent', border: '1px solid rgba(5,150,105,0.3)',
            color: '#065f46', padding: '7px 12px', borderRadius: 8,
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Manage…
        </button>
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 24, right: 24,
          background: '#fff', borderRadius: 12,
          border: '1px solid rgba(5,150,105,0.25)',
          boxShadow: '0 12px 32px rgba(15,23,42,0.18)',
          padding: 12, zIndex: 10, maxHeight: 360, overflow: 'auto',
        }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects by name, code, plant…"
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8,
                border: '1px solid rgba(5,150,105,0.25)', fontSize: 13, outline: 'none',
              }}
            />
            <button
              onClick={onManage}
              style={{
                background: '#059669', color: '#fff', border: 'none',
                padding: '8px 14px', borderRadius: 8, fontSize: 12,
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              + New
            </button>
          </div>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
              Loading projects…
            </div>
          ) : list.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
              No projects found. Click <strong>+ New</strong> to create one.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 4 }}>
              {list.map((p) => (
                <button
                  key={p.project_id}
                  onClick={() => handlePick(p)}
                  style={{
                    textAlign: 'left', padding: '10px 12px', borderRadius: 8,
                    border: project?.project_id === p.project_id
                      ? '1px solid #059669' : '1px solid transparent',
                    background: project?.project_id === p.project_id
                      ? 'rgba(5,150,105,0.08)' : 'transparent',
                    cursor: 'pointer', display: 'flex',
                    justifyContent: 'space-between', alignItems: 'center', gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#065f46',
                                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      {[p.code, p.plant, p.discipline].filter(Boolean).join(' · ') || 'No metadata'}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, color: '#0891b2', fontWeight: 600,
                    background: 'rgba(8,145,178,0.08)', padding: '3px 7px', borderRadius: 4,
                    whiteSpace: 'nowrap',
                  }}>
                    {(p.job_count || 0) + (p.batch_count || 0)} extractions
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};


// ---------------------------------------------------------------------------
// Project gate — shown before the extractor when no active project is set.
// Lets the user pick an existing project inline OR create a new one quickly.
// All copy/colors are driven by GATE_CFG; flip PROJECT_BANNER_CFG.requireProjectFirst
// to disable gating entirely (legacy behaviour).
// ---------------------------------------------------------------------------
const GATE_CFG = {
  title: 'Select a project to start',
  subtitle: 'Every Non-TEFF extraction belongs to a project so your work stays organised, traceable and role-scoped.',
  bullets: [
    'Group single-file jobs and bulk Master-Index batches together',
    'Filter, audit and re-run extractions per engineering project',
    'Admins see all projects · regular users see only their own',
  ],
  cta: {
    pickExisting: 'Open existing project',
    createNew:    'Create new project',
    manage:       'Manage all projects',
  },
  theme: {
    accent:       '#059669',
    accentSoft:   'rgba(5,150,105,0.08)',
    accentBorder: 'rgba(5,150,105,0.25)',
    secondary:    '#0891b2',
  },
};

const ProjectGate = ({ onPicked, onManage }) => {
  const T = GATE_CFG.theme;
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [query, setQuery]       = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName]   = useState('');
  const [newDesc, setNewDesc]   = useState('');
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState('');

  const persist = (p) => {
    try {
      localStorage.setItem(PROJECT_BANNER_CFG.storageKey, JSON.stringify(p));
    } catch (_) { /* ignore */ }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(PROJECT_BANNER_CFG.api.list, {
        params: query ? { q: query } : {},
      });
      setProjects(res.data?.items || []);
      setError('');
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not load projects.');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  const handlePick = (p) => {
    const trimmed = { project_id: p.project_id, name: p.name, plant: p.plant };
    persist(trimmed);
    onPicked?.(trimmed);
  };

  const handleCreate = async (e) => {
    e?.preventDefault?.();
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const res = await apiClient.post(PROJECT_BANNER_CFG.api.list, {
        name: newName.trim(),
        description: newDesc.trim(),
        status: 'active',
      });
      const p = res.data;
      handlePick(p);
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not create the project.');
    } finally {
      setBusy(false);
    }
  };

  const filtered = projects.filter((p) =>
    !query ||
    p.name?.toLowerCase().includes(query.toLowerCase()) ||
    p.code?.toLowerCase().includes(query.toLowerCase()) ||
    p.plant?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div style={{
      minHeight: '100vh', background: '#f8fafc',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 20px', fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{
        width: '100%', maxWidth: 980, display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 0,
        background: '#fff', borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(15,23,42,0.10)',
        border: `1px solid ${T.accentBorder}`,
      }}>

        {/* ── Left: hero / value ── */}
        <div style={{
          padding: '36px 32px',
          background: `linear-gradient(135deg, ${T.accentSoft}, rgba(8,145,178,0.05))`,
          borderRight: `1px solid ${T.accentBorder}`,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: `linear-gradient(135deg, ${T.accent}, ${T.secondary})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(5,150,105,0.25)', marginBottom: 18,
          }}>
            <FolderIcon width={28} style={{ color: '#fff' }} />
          </div>
          <div style={{ fontSize: 11, color: T.accent, fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
            Non-TEFF Metadata Generator
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a', lineHeight: 1.25 }}>
            {GATE_CFG.title}
          </h1>
          <p style={{ margin: '12px 0 22px', fontSize: 14, color: '#475569', lineHeight: 1.55 }}>
            {GATE_CFG.subtitle}
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
            {GATE_CFG.bullets.map((b, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#334155' }}>
                <span style={{
                  width: 18, height: 18, borderRadius: 999,
                  background: T.accentSoft, color: T.accent,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: 1,
                }}>✓</span>
                {b}
              </li>
            ))}
          </ul>
        </div>

        {/* ── Right: action panel ── */}
        <div style={{ padding: '32px 32px', display: 'flex', flexDirection: 'column' }}>
          {!creating ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                  {GATE_CFG.cta.pickExisting}
                </h2>
                <button onClick={onManage} style={{
                  background: 'transparent', border: 'none', color: T.accent,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>{GATE_CFG.cta.manage} →</button>
              </div>

              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, code, plant…"
                style={{
                  padding: '10px 14px', borderRadius: 10,
                  border: `1px solid ${T.accentBorder}`, fontSize: 13,
                  outline: 'none', marginBottom: 12,
                }}
              />

              <div style={{
                flex: 1, minHeight: 180, maxHeight: 280, overflow: 'auto',
                border: `1px solid ${T.accentBorder}`, borderRadius: 10,
                background: '#fafafa',
              }}>
                {loading ? (
                  <div style={{ padding: 30, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                    Loading projects…
                  </div>
                ) : error ? (
                  <div style={{ padding: 20, color: '#b91c1c', fontSize: 13 }}>{error}</div>
                ) : filtered.length === 0 ? (
                  <div style={{ padding: 30, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                    {query
                      ? 'No projects match your search.'
                      : 'No projects yet. Create your first one below.'}
                  </div>
                ) : (
                  filtered.map((p) => (
                    <button
                      key={p.project_id}
                      onClick={() => handlePick(p)}
                      style={{
                        width: '100%', textAlign: 'left', padding: '11px 14px',
                        background: 'transparent', border: 'none',
                        borderBottom: `1px solid ${T.accentBorder}`,
                        cursor: 'pointer', display: 'flex',
                        justifyContent: 'space-between', alignItems: 'center', gap: 10,
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = T.accentSoft}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a',
                                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                          {[p.code, p.plant, p.discipline].filter(Boolean).join(' · ') || 'No metadata'}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 11, color: T.secondary, fontWeight: 600,
                        background: 'rgba(8,145,178,0.10)', padding: '3px 8px', borderRadius: 999,
                        whiteSpace: 'nowrap',
                      }}>
                        {(p.job_count || 0) + (p.batch_count || 0)} extractions
                      </span>
                    </button>
                  ))
                )}
              </div>

              <button
                onClick={() => { setCreating(true); setError(''); }}
                style={{
                  marginTop: 16,
                  background: `linear-gradient(135deg, ${T.accent}, ${T.secondary})`,
                  color: '#fff', border: 'none',
                  padding: '12px 18px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                  justifyContent: 'center', gap: 8,
                  boxShadow: '0 6px 18px rgba(5,150,105,0.30)',
                }}
              >
                + {GATE_CFG.cta.createNew}
              </button>
            </>
          ) : (
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                  {GATE_CFG.cta.createNew}
                </h2>
                <button type="button" onClick={() => setCreating(false)} style={{
                  background: 'transparent', border: 'none', color: '#64748b',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>← Back</button>
              </div>

              <label style={{ fontSize: 11, fontWeight: 700, color: '#0f172a',
                              textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                Project Name *
              </label>
              <input
                type="text"
                value={newName}
                autoFocus
                required
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., ADNOC Trunkline Project"
                style={{
                  padding: '10px 12px', borderRadius: 8,
                  border: `1px solid ${T.accentBorder}`, fontSize: 14,
                  outline: 'none', marginBottom: 14,
                }}
              />

              <label style={{ fontSize: 11, fontWeight: 700, color: '#0f172a',
                              textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                Description <span style={{ color: '#64748b', fontWeight: 400, textTransform: 'none' }}>(optional)</span>
              </label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                rows={4}
                placeholder="Brief project description…"
                style={{
                  padding: '10px 12px', borderRadius: 8,
                  border: `1px solid ${T.accentBorder}`, fontSize: 13,
                  resize: 'vertical', fontFamily: 'inherit', outline: 'none',
                  marginBottom: 14,
                }}
              />

              {error && (
                <div style={{ background: '#fee2e2', color: '#991b1b',
                              padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 12 }}>
                  {error}
                </div>
              )}

              <div style={{ flex: 1 }} />

              <p style={{ margin: '0 0 10px', fontSize: 11, color: '#94a3b8' }}>
                You can add code, client, plant, discipline and status later from <strong>{GATE_CFG.cta.manage}</strong>.
              </p>

              <button
                type="submit"
                disabled={busy || !newName.trim()}
                style={{
                  background: !busy && newName.trim()
                    ? `linear-gradient(135deg, ${T.accent}, ${T.secondary})`
                    : '#cbd5e1',
                  color: '#fff', border: 'none',
                  padding: '12px 18px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                  cursor: !busy && newName.trim() ? 'pointer' : 'not-allowed',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: !busy && newName.trim() ? '0 6px 18px rgba(5,150,105,0.30)' : 'none',
                }}
              >
                {busy ? 'Creating…' : 'Create & Continue →'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};


// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const NonTeffMetadataPage = () => {
  const navigate = useNavigate();
  const [mode,         setMode]          = useState('single'); // 'single' | 'bulk'
  const [file,          setFile]          = useState(null);
  const [isProcessing,  setIsProcessing]  = useState(false);
  const [progress,      setProgress]      = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [results,       setResults]       = useState(null);
  const [error,         setError]         = useState(null);
  const [sortCol,       setSortCol]       = useState('document_no');
  const [sortAsc,       setSortAsc]       = useState(true);
  const [filterText,    setFilterText]    = useState('');
  const [elapsedSecs,   setElapsedSecs]   = useState(0);
  const [isDragging,    setIsDragging]    = useState(false);
  const [jobId,         setJobId]         = useState(null);
  const [tipIndex,      setTipIndex]      = useState(0);

  // Smart Features panel (additive — does not affect core extraction)
  const [smartOpen,     setSmartOpen]     = useState(false);
  const [smartFilterIdx, setSmartFilterIdx] = useState(null); // null = inactive
  const [smartFilterLabel, setSmartFilterLabel] = useState('');

  // Active project (additive — organisational only, never blocks extraction).
  // Persisted in localStorage so navigating between pages preserves context.
  const [activeProject, setActiveProject] = useState(() => {
    try {
      const raw = localStorage.getItem('nonTeffActiveProject');
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  });
  const clearActiveProject = () => {
    setActiveProject(null);
    try { localStorage.removeItem('nonTeffActiveProject'); } catch (_) {}
  };

  const fileRef      = useRef(null);
  const pollTimerRef = useRef(null);
  const pollStartRef = useRef(null);
  const elapsedRef   = useRef(null);

  // Elapsed timer
  useEffect(() => {
    if (isProcessing) {
      setElapsedSecs(0);
      elapsedRef.current = setInterval(() => setElapsedSecs(s => s + 1), 1000);
    } else {
      clearInterval(elapsedRef.current);
    }
    return () => clearInterval(elapsedRef.current);
  }, [isProcessing]);

  // Rotating pro-tip ticker (hero engagement only — no side-effects on logic)
  useEffect(() => {
    const t = setInterval(
      () => setTipIndex(i => (i + 1) % PRO_TIPS.length),
      PRO_TIP_ROTATE_MS,
    );
    return () => clearInterval(t);
  }, []);

  const formatElapsed = (s) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;

  // File selection
  const handleFileSelect = (e) => {
    const f = e.target.files[0];
    if (f) { setFile(f); setError(null); setResults(null); }
  };

  const handleDragOver  = (e) => { e.preventDefault(); if (!isProcessing) setIsDragging(true); };
  const handleDragEnter = (e) => { e.preventDefault(); if (!isProcessing) setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop      = (e) => {
    e.preventDefault(); setIsDragging(false);
    if (isProcessing) return;
    const f = e.dataTransfer.files[0];
    if (f) { setFile(f); setError(null); setResults(null); }
    else   { setError('No file detected — please try again.'); }
  };

  // Polling
  const pollStatus = useCallback((id) => {
    if (Date.now() - pollStartRef.current > POLL_MAX_WAIT_MS) {
      clearTimeout(pollTimerRef.current);
      setError('Extraction timed out — please try again.');
      setIsProcessing(false);
      return;
    }
    pollTimerRef.current = setTimeout(async () => {
      try {
        const res = await apiClient.get(`${API_PREFIX}/status/${id}/`, { timeout: 10000 });
        const data = res.data;
        setProgress(data.progress || 0);
        setStatusMessage(data.message || '');

        if (data.status === 'completed') {
          clearTimeout(pollTimerRef.current);
          const resData = await apiClient.get(`${API_PREFIX}/results/${id}/`, { timeout: 15000 });
          setResults(resData.data);
          setIsProcessing(false);
        } else if (data.status === 'failed') {
          clearTimeout(pollTimerRef.current);
          setError(data.error || 'Extraction failed.');
          setIsProcessing(false);
        } else {
          pollStatus(id);
        }
      } catch (err) {
        pollStatus(id);  // retry on transient error
      }
    }, POLL_INTERVAL_MS);
  }, []);

  // Submit
  const handleExtract = async () => {
    if (!file || isProcessing) return;
    setIsProcessing(true);
    setProgress(0);
    setStatusMessage('Reading file…');
    setError(null);
    setResults(null);
    setJobId(null);

    try {
      // ---------------------------------------------------------------------
      // Pre-read the selected file into an in-memory Blob BEFORE posting.
      //
      // Why: Chrome streams a File object lazily during multipart upload. If
      // the file lives on OneDrive (cloud-only stub), is open in another app
      // (VS Code PDF preview holds a Windows lock), or hits an antivirus
      // scan mid-stream, the OS denies the lazy read and Chrome aborts with
      // `net::ERR_ACCESS_DENIED` — the request never reaches Django, so we
      // see "Network Error" with no response.
      //
      // By forcing a synchronous full-buffer read first, we either:
      //   a) succeed → upload an in-memory Blob (no further OS reads needed)
      //   b) fail fast with a clean, actionable error message.
      //
      // Pure browser API, soft-coded — no extra deps, no backend changes.
      // ---------------------------------------------------------------------
      let uploadBlob;
      try {
        const buf = await file.arrayBuffer();
        uploadBlob = new Blob([buf], { type: file.type || 'application/octet-stream' });
      } catch (readErr) {
        throw new Error(
          `Cannot read "${file.name}" from disk. ` +
          `Likely causes: file is open in another app (e.g. VS Code PDF preview), ` +
          `OneDrive has it as a cloud-only stub, or antivirus is blocking access. ` +
          `Close it elsewhere, right-click → "Always keep on this device", ` +
          `or copy it to C:\\Temp and try again.`
        );
      }

      setStatusMessage('Uploading file…');
      const formData = new FormData();
      formData.append('file', uploadBlob, file.name);
      // Attach the active project (if any) so the backend links the job to it.
      if (activeProject?.project_id) {
        formData.append('project_id', activeProject.project_id);
      }
      const res = await apiClient.post(`${API_PREFIX}/upload/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: UPLOAD_TIMEOUT_MS,
      });
      const id = res.data.job_id;
      setJobId(id);
      setProgress(5);
      setStatusMessage('File received — extracting metadata…');
      pollStartRef.current = Date.now();
      pollStatus(id);
    } catch (err) {
      // Soft-coded diagnostic — distinguishes auth, network, and disk errors.
      const code   = err?.code;
      const status = err?.response?.status;
      let msg;
      if (err?.message?.startsWith('Cannot read "')) {
        msg = err.message;                                                // disk/OS
      } else if (status === 401 || status === 403) {
        msg = 'Your session has expired — please log in again to upload.'; // auth
      } else if (code === 'ERR_NETWORK' && !err?.response) {
        msg = `Cannot reach the backend. Check that the API container is running at ${apiClient.defaults.baseURL}.`;
      } else {
        msg = err.response?.data?.error || err.message || 'Upload failed.';
      }
      setError(msg);
      setIsProcessing(false);
    }
  };

  // Export Excel
  const handleExport = async () => {
    if (!jobId) return;
    try {
      const res = await apiClient.get(`${API_PREFIX}/export/${jobId}/`, {
        responseType: 'blob',
        timeout: 30000,
      });
      const url  = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.download = `NonTEFF_Metadata_${file?.name?.replace(/\.[^.]+$/, '') || 'export'}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Export failed — please try again.');
    }
  };

  // Derived table data
  const items = results?.items || [];

  // Optional AI-NL-query filter (set by the Smart Features panel). When
  // smartFilterIdx is a Set, restrict items to that index set BEFORE the
  // free-text filter so users get the combined narrow view.
  const itemsForView = (smartFilterIdx instanceof Set)
    ? items.filter((_, i) => smartFilterIdx.has(i))
    : items;

  const filteredItems = itemsForView.filter(row =>
    !filterText || COLUMNS.some(c => String(row[c.key] || '').toLowerCase().includes(filterText.toLowerCase()))
  );

  const sortedItems = [...filteredItems].sort((a, b) => {
    const av = String(a[sortCol] || '').toLowerCase();
    const bv = String(b[sortCol] || '').toLowerCase();
    return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const handleSort = (key) => {
    if (sortCol === key) setSortAsc(a => !a);
    else { setSortCol(key); setSortAsc(true); }
  };

  // Processing stage label
  const stageLabel = progress < 20 ? 'Uploading' : progress < 60 ? 'Analysing' : progress < 90 ? 'Extracting Fields' : 'Finalising';

  // ─── Render ──────────────────────────────────────────────────────────────
  // Shared tab bar — oil & gas themed pill switcher with animated pipeline flow
  const TabBar = () => {
    const activeIndex = Math.max(0, NT_TABS.findIndex(t => t.id === mode));
    const activeTab = NT_TABS[activeIndex];
    return (
      <div style={{
        position: 'relative', zIndex: 3,
        maxWidth: NT_TAB_LAYOUT.wrapperMaxWidth, margin: '0 auto',
        padding: NT_TAB_LAYOUT.wrapperPadding,
        paddingBottom: NT_TAB_LAYOUT.bottomClearance,
      }}>
        <style>{NT_KEYFRAMES}</style>

        {/* Pill container — single rounded capsule with animated pipeline underlay.
            Uses .nt-tab-pill so responsive rules in NT_KEYFRAMES can wrap / stack
            the tabs without ever clipping them (no overflow:hidden). */}
        <div className="nt-tab-pill" style={{
          position: 'relative',
          alignItems: 'stretch',
          gap: NT_TAB_LAYOUT.pillGap,
          padding: NT_TAB_LAYOUT.pillPadding,
          background: 'rgba(255,255,255,0.75)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(5,150,105,0.18)',
          borderRadius: NT_TAB_LAYOUT.pillRadius,
          boxShadow: '0 10px 30px -12px rgba(15,23,42,0.18), inset 0 1px 0 rgba(255,255,255,0.6)',
        }}>
          {/* Animated pipeline stripe — drifts horizontally behind the pill */}
          <div className="nt-tab-pipeline" style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            height: 3, borderRadius: 3, opacity: 0.85, pointerEvents: 'none',
          }} />

          {NT_TABS.map((t) => {
            const active = mode === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setMode(t.id)}
                className={`nt-tab-btn ${active ? 'nt-tab-active' : 'nt-tab-inactive'}`}
                style={{
                  position: 'relative',
                  display: 'flex', alignItems: 'center', gap: NT_TAB_LAYOUT.btnGap,
                  padding: NT_TAB_LAYOUT.btnPadding,
                  minHeight: NT_TAB_LAYOUT.btnMinHeight,
                  border: 'none',
                  borderRadius: 999,
                  fontSize: NT_TAB_LAYOUT.btnFontSize,
                  fontWeight: 600,
                  letterSpacing: 0.1,
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                  background: active
                    ? `linear-gradient(135deg, ${t.accent} 0%, #0891b2 100%)`
                    : 'transparent',
                  color: active ? '#ffffff' : '#475569',
                }}
              >
                {/* Icon pod — circular well-head */}
                <span style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: NT_TAB_LAYOUT.iconBoxSize, height: NT_TAB_LAYOUT.iconBoxSize,
                  borderRadius: '50%',
                  background: active ? 'rgba(255,255,255,0.22)' : 'rgba(5,150,105,0.08)',
                  border: active ? '1px solid rgba(255,255,255,0.4)' : '1px solid rgba(5,150,105,0.18)',
                  flexShrink: 0,
                }}>
                  <NtTabIcon kind={t.iconKind} active={active} accent={active ? '#ffffff' : t.accent} />
                </span>

                {/* Label + hint stacked. The hint sub-line hides automatically at
                    narrow viewports via the .nt-tab-btn-label-hint media rule. */}
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2, minWidth: 0 }}>
                  <span style={{ whiteSpace: 'nowrap' }}>{t.label}</span>
                  <span className="nt-tab-btn-label-hint" style={{
                    fontSize: 10, fontWeight: 500, letterSpacing: 0.2,
                    color: active ? 'rgba(255,255,255,0.85)' : '#94a3b8',
                    whiteSpace: 'nowrap',
                  }}>
                    {t.hint}
                  </span>
                </span>

                {/* Active indicator dot — pulses */}
                {active && (
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#ffffff',
                    marginLeft: 2,
                    animation: 'ntPulse 1.6s ease-in-out infinite',
                    boxShadow: '0 0 8px rgba(255,255,255,0.8)',
                    flexShrink: 0,
                  }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Active-tab breadcrumb strip */}
        <div style={{
          marginTop: 10,
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 11, color: '#64748b', letterSpacing: 0.2,
        }}>
          <span style={{ color: '#047857', fontWeight: 600 }}>
            {activeTab.label}
          </span>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: activeTab.accent }} />
          <span>{activeTab.hint}</span>
        </div>
      </div>
    );
  };

  // History tab — soft-coded re-open hook. Routes by entry kind so the
  // user sees the SAME view & SAME columns as the original extraction:
  //   • kind='batch' → Bulk Master Index (template-driven dynamic columns)
  //   • kind='job'   → Single-file canvas (NT_COLUMNS schema)
  // The core extraction pipeline is untouched.
  const [historyBatchId, setHistoryBatchId] = useState(null);
  // Target for the embedded Document Search Canvas (set when user clicks
  // 'locate' on a bulk-table row). Cleared whenever the user changes mode.
  const [canvasTarget, setCanvasTarget] = useState(null);
  // Ref on the canvas wrapper so we can scroll it into view whenever the
  // user picks a new record — saves them from manually scrolling down.
  const canvasSectionRef = useRef(null);
  // Soft-coded scroll behaviour. Tunable without touching component code.
  const CANVAS_SCROLL_CONFIG = { behavior: 'smooth', block: 'start' };

  // Scroll the canvas into view whenever the user clicks a record/locate link.
  useEffect(() => {
    if (!canvasTarget || !canvasSectionRef.current) return;
    try { canvasSectionRef.current.scrollIntoView(CANVAS_SCROLL_CONFIG); }
    catch { /* older browsers — silent fallback */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasTarget?.item_id, canvasTarget?.batch_id]);

  const handleHistoryOpen = useCallback((item, payload) => {
    const kind = (payload?.kind) || (item?.kind) || 'job';
    if (kind === 'batch') {
      // Bulk view will fetch its own items via the batch endpoints, which
      // guarantees the same columns the user saw at extraction time.
      setHistoryBatchId(payload?.job_id || item?.job_id);
      setError(null);
      setIsProcessing(false);
      setMode('bulk');
      return;
    }
    // Single-file job: hydrate the Single-mode canvas as before.
    const result = payload?.result || {};
    setFile(null);
    setResults({
      job_id:    payload.job_id || item.job_id,
      file_name: payload.file_name || item.file_name,
      total:     result.total ?? (result.items?.length ?? 0),
      items:     result.items || [],
    });
    setError(null);
    setIsProcessing(false);
    setMode('single');
  }, []);

  // Clear the preloaded batch id whenever the user manually leaves the bulk
  // tab so a subsequent fresh extraction starts clean.
  useEffect(() => { if (mode !== 'bulk') setHistoryBatchId(null); }, [mode]);
  useEffect(() => { if (mode !== 'bulk') setCanvasTarget(null); }, [mode]);

  // ── Project gate ──────────────────────────────────────────────────────────
  // If gating is enabled and no project is active, force the user to pick or
  // create one before they can use ANY workflow (single / bulk / history).
  // Soft-coded via PROJECT_BANNER_CFG.requireProjectFirst.
  if (PROJECT_BANNER_CFG.requireProjectFirst && !activeProject) {
    return (
      <ProjectGate
        onPicked={(p) => setActiveProject(p)}
        onManage={() => navigate(PROJECT_BANNER_CFG.routes.projects)}
      />
    );
  }

  if (mode === 'history') {
    return (
      <div style={{ minHeight: '100vh', background: NT_T.bg, fontFamily: "'Inter', sans-serif", position: 'relative', overflow: 'hidden' }}>
        <style>{NT_KEYFRAMES}</style>
        {NT_T.blobs.map((b, i) => (
          <div key={i} style={{
            position: 'absolute', borderRadius: '50%', background: b.color,
            width: b.size, height: b.size,
            top: b.top, bottom: b.bottom, left: b.left, right: b.right,
            animation: b.anim, pointerEvents: 'none', zIndex: 0,
          }} />
        ))}
        <TabBar />
        <div style={{
          position: 'relative', zIndex: 2,
          maxWidth: 1600, margin: '16px auto 0',
          padding: '0 24px 32px',
        }}>
          <HistoryPanel onOpen={handleHistoryOpen} />
        </div>
      </div>
    );
  }

  // Bulk Master Index workflow (early-return, uses its own chrome)
  if (mode === 'bulk') {
    return (
      <div style={{ minHeight: '100vh', background: NT_T.bg, fontFamily: "'Inter', sans-serif", position: 'relative', overflow: 'hidden' }}>
        <style>{NT_KEYFRAMES}</style>
        {/* Animated background blobs — kept identical to Single mode for visual continuity */}
        {NT_T.blobs.map((b, i) => (
          <div key={i} style={{
            position: 'absolute', borderRadius: '50%', background: b.color,
            width: b.size, height: b.size,
            top: b.top, bottom: b.bottom, left: b.left, right: b.right,
            animation: b.anim, pointerEvents: 'none', zIndex: 0,
          }} />
        ))}
        <TabBar />
        <div style={{
          position: 'relative', zIndex: 2,
          maxWidth: 1600, margin: '16px auto 0',
          padding: '24px',
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(8px)',
          borderRadius: 16,
          border: '1px solid rgba(5,150,105,0.12)',
          boxShadow: '0 10px 40px -12px rgba(15,23,42,0.12)',
          marginBottom: 32,
        }}>
          <BulkMasterIndex loadBatchId={historyBatchId} onSelectItem={setCanvasTarget} />
        </div>
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 1600, margin: '0 auto', padding: '0 24px 32px' }} ref={canvasSectionRef}>
          <DocumentSearchCanvasView preselect={canvasTarget} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: NT_T.bg, fontFamily: "'Inter', sans-serif", position: 'relative', overflow: 'hidden' }}>
      <style>{NT_KEYFRAMES}</style>
      <TabBar />

      {/* Project context banner — additive, organisational only */}
      <ProjectContextBanner
        project={activeProject}
        onChange={setActiveProject}
        onClear={clearActiveProject}
        onManage={() => navigate('/engineering/digitization/non-teff-metadata/projects')}
      />

      {/* Animated background blobs */}
      {NT_T.blobs.map((b, i) => (
        <div key={i} style={{
          position: 'absolute', borderRadius: '50%', background: b.color,
          width: b.size, height: b.size,
          top: b.top, bottom: b.bottom, left: b.left, right: b.right,
          animation: b.anim, pointerEvents: 'none', zIndex: 0,
        }} />
      ))}

      {/* Grid dot overlay */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: NT_T.gridDot, backgroundSize: '28px 28px', opacity: 0.7,
      }} />

      {/* Top animated gradient bar */}
      <div style={{
        position: 'relative', zIndex: 1,
        height: '4px',
        background: NT_T.gradBar,
        backgroundSize: '300% 300%',
        animation: 'ntGradShift 6s ease infinite',
      }} />

      {/* ── Content wrapper ── */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: '1480px', margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* ── Hero Header ── */}
        <div className="nt-section" style={{ display: 'flex', alignItems: 'flex-start', gap: '28px', marginBottom: '36px' }}>
          {/* Rule ring + icon */}
          <div style={{ position: 'relative', width: '88px', height: '88px', flexShrink: 0 }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              border: '2px dashed rgba(5,150,105,0.25)',
              animation: 'ntGradShift 8s linear infinite',
            }} />
            <div style={{
              position: 'absolute', inset: '8px', borderRadius: '50%',
              border: '1.5px solid rgba(5,150,105,0.15)',
              animation: 'ntSpinSlowRev 18s linear infinite',
            }} />
            <div style={{
              position: 'absolute', inset: '16px', borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(5,150,105,0.12), rgba(8,145,178,0.08))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <DocumentMagnifyingGlassIcon style={{ width: 32, height: 32, color: '#059669', opacity: 0.9 }} />
            </div>
          </div>

          <div style={{ flex: 1 }}>
            {/* Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '4px' }}>
              <h1 className="nt-hero-title-sheen" style={{
                fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1,
                margin: 0,
              }}>Non-TEF Metadata Generator</h1>
              <span style={{
                background: 'linear-gradient(90deg, #059669, #0891b2)', color: '#fff',
                fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em',
                padding: '2px 10px', borderRadius: '999px', whiteSpace: 'nowrap',
              }}>AI-POWERED</span>
            </div>
            <p style={{ color: '#475569', fontSize: '0.95rem', margin: '0 0 14px', maxWidth: '640px', lineHeight: 1.6 }}>
              Upload Non-TEFF engineering documents (PDF, Excel, Word, AutoCAD) and automatically extract
              metadata — instrument tags, line numbers, equipment references, mechanical components and more.
            </p>

            {/* Capability chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {NT_T.chips.map((chip, i) => (
                <span key={i} className="nt-chip" style={{
                  animationDelay: `${i * 0.07}s`,
                  background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(5,150,105,0.2)', borderRadius: '999px',
                  padding: '4px 12px', fontSize: '0.75rem', fontWeight: 600, color: '#065f46',
                  display: 'flex', alignItems: 'center', gap: '5px',
                }}>
                  <span style={{ fontSize: '0.85rem' }}>{chip.icon}</span>
                  {chip.label}
                </span>
              ))}
            </div>

            {/* Trust strip — soft-coded numeric badges */}
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12,
            }}>
              {TRUST_BADGES.map((b, i) => (
                <div key={b.label} className="nt-trust-badge" style={{
                  animationDelay: `${0.15 + i * 0.08}s`,
                  display: 'flex', alignItems: 'baseline', gap: 6,
                  padding: '5px 12px', borderRadius: 8,
                  background: 'linear-gradient(135deg, rgba(5,150,105,0.08), rgba(8,145,178,0.06))',
                  border: '1px solid rgba(5,150,105,0.15)',
                }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#047857', letterSpacing: '-0.02em' }}>
                    {b.value}
                  </span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748b', letterSpacing: 0.2 }}>
                    {b.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Rotating Pro-Tip banner */}
            <div key={tipIndex} style={{
              marginTop: 12, maxWidth: 640,
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 14px', borderRadius: 10,
              background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(10px)',
              border: '1px dashed rgba(8,145,178,0.28)',
              animation: 'ntTipSlide 5.5s ease-in-out',
            }}>
              <LightBulbIcon style={{ width: 16, height: 16, color: '#0891b2', flexShrink: 0 }} />
              <span style={{ fontSize: '0.78rem', color: '#334155', lineHeight: 1.4 }}>
                <span style={{ fontWeight: 700, color: '#047857', marginRight: 6 }}>
                  {PRO_TIPS[tipIndex].icon} Pro Tip
                </span>
                {PRO_TIPS[tipIndex].text}
              </span>
            </div>
          </div>

          {/* Workflow steps (right) */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
            {['Upload', 'AI Extract', 'Review', 'Export'].map((step, i) => (
              <React.Fragment key={step}>
                <div style={{
                  background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(5,150,105,0.2)', borderRadius: '10px',
                  padding: '6px 12px', fontSize: '0.7rem', fontWeight: 600, color: '#065f46',
                  textAlign: 'center', minWidth: '56px',
                }}>
                  <div style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.04em' }}>
                    0{i + 1}
                  </div>
                  {step}
                </div>
                {i < 3 && <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700 }}>›</div>}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ── AI Document Assist (Wrench) — soft-coded, optional ─────── */}
        {NT_AI_ASSIST_CONFIG.enabled && (
          <div className="nt-section" style={{ animationDelay: '0.08s', marginBottom: '16px' }}>
            <WrenchAiDocAssist
              title={NT_AI_ASSIST_CONFIG.title}
              subtitleTag={NT_AI_ASSIST_CONFIG.subtitleTag}
              subtitle={NT_AI_ASSIST_CONFIG.subtitle}
              defaultHint={NT_AI_ASSIST_CONFIG.defaultHint}
              hintPlaceholder={NT_AI_ASSIST_CONFIG.hintPlaceholder}
              topN={NT_AI_ASSIST_CONFIG.topN}
              acceptedExts={NT_AI_ASSIST_CONFIG.acceptedExts}
              projectName={activeProject?.name || ''}
              onFileSelected={(f) => { setFile(f); setError(null); setResults(null); }}
              onError={(msg) => setError(msg)}
            />
          </div>
        )}

        {/* ── Upload + Action row ── */}
        <div className="nt-section" style={{ animationDelay: '0.1s', display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', alignItems: 'start', marginBottom: '24px' }}>
          {/* Upload zone */}
          <div
            className="nt-upload-zone"
            onDragOver={handleDragOver} onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave} onDrop={handleDrop}
            onClick={() => !isProcessing && fileRef.current?.click()}
            style={{
              position: 'relative', overflow: 'hidden',
              border: isDragging ? '2px solid rgba(5,150,105,0.6)' : '2px dashed rgba(5,150,105,0.28)',
              borderRadius: '16px',
              background: isDragging ? 'rgba(5,150,105,0.06)' : 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(10px)',
              padding: '28px 32px',
              cursor: isProcessing ? 'default' : 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
            }}
          >
            {/* Circuit trace borders */}
            {['top','bottom'].map(side => (
              <div key={side} style={{
                position: 'absolute', [side]: 0, left: '10%', right: '10%', height: '2px',
                background: 'linear-gradient(90deg, transparent, rgba(5,150,105,0.5), transparent)',
                animation: 'ntTraceH 3.5s ease-in-out infinite',
                animationDelay: side === 'bottom' ? '1.75s' : '0s',
              }} />
            ))}
            {['left','right'].map(side => (
              <div key={side} style={{
                position: 'absolute', [side]: 0, top: '10%', bottom: '10%', width: '2px',
                background: 'linear-gradient(180deg, transparent, rgba(5,150,105,0.5), transparent)',
                animation: 'ntTraceV 3.5s ease-in-out infinite',
                animationDelay: side === 'right' ? '1.75s' : '0s',
              }} />
            ))}

            <input
              ref={fileRef} type="file" accept={ACCEPT_STRING}
              style={{ display: 'none' }} onChange={handleFileSelect}
            />

            <CloudArrowUpIcon style={{
              width: 40, height: 40,
              color: file ? '#059669' : '#94a3b8',
              transition: 'color 0.2s',
            }} />

            {file ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: '#059669', fontSize: '0.95rem' }}>{file.name}</div>
                <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '2px' }}>
                  {(file.size / 1024 / 1024).toFixed(2)} MB — click to change
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 600, color: '#334155', fontSize: '0.9rem' }}>
                  Drop a document here or click to browse
                </div>
                <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '4px' }}>
                  Supports: {SUPPORTED_FORMATS.map(f => (
                    <span key={f.ext} style={{ color: f.color, fontWeight: 600, marginLeft: '4px' }}>{f.label}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Extract button */}
          <button
            className="nt-action-btn"
            onClick={handleExtract}
            disabled={!file || isProcessing}
            style={{
              background: !file || isProcessing
                ? 'linear-gradient(135deg, #94a3b8, #64748b)'
                : 'linear-gradient(135deg, #059669, #0891b2)',
              color: '#fff', border: 'none', borderRadius: '14px',
              padding: '16px 28px', cursor: !file || isProcessing ? 'not-allowed' : 'pointer',
              fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.01em',
              boxShadow: !file || isProcessing ? 'none' : '0 4px 18px rgba(5,150,105,0.3)',
              transition: 'all 0.2s ease', whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: '8px', minWidth: '160px',
            }}
          >
            <DocumentMagnifyingGlassIcon style={{ width: 20, height: 20 }} />
            {isProcessing ? 'Extracting…' : 'Extract Metadata'}
          </button>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="nt-section" style={{
            background: 'rgba(254,242,242,0.9)', border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: '12px', padding: '14px 18px', marginBottom: '20px',
            color: '#b91c1c', fontSize: '0.88rem', fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <span style={{ fontSize: '1.1rem' }}>⚠️</span>
            {error}
          </div>
        )}

        {/* ── AI Processing Loader ── */}
        {isProcessing && (
          <div className="nt-section" style={{
            background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(16px)',
            border: '1px solid rgba(5,150,105,0.18)', borderRadius: '20px',
            padding: '36px', marginBottom: '24px', textAlign: 'center',
          }}>
            {/* Orbit electron loader */}
            <div style={{ display: 'inline-block', position: 'relative', width: '80px', height: '80px', marginBottom: '20px' }}>
              <div style={{
                position: 'absolute', inset: '50%', width: '16px', height: '16px',
                marginLeft: '-8px', marginTop: '-8px',
                background: 'linear-gradient(135deg, #059669, #0891b2)',
                borderRadius: '50%', boxShadow: '0 0 18px rgba(5,150,105,0.45)',
              }} />
              {NT_T.electrons.map((color, i) => (
                <div key={i} style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: `ntOrbit${['A','B','C'][i]} ${1.4 + i * 0.3}s linear infinite`,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }} />
                </div>
              ))}
            </div>

            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#065f46', marginBottom: '6px' }}>
              AI Metadata Extraction in Progress
            </div>
            <div style={{ color: '#475569', fontSize: '0.85rem', marginBottom: '20px' }}>
              {statusMessage || 'Analysing document structure…'}
            </div>

            {/* Progress bar */}
            <div style={{ maxWidth: '440px', margin: '0 auto', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(5,150,105,0.1)', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '999px', width: `${progress}%`,
                  background: 'linear-gradient(90deg, #059669, #0891b2)',
                  transition: 'width 0.4s ease',
                  boxShadow: '0 0 12px rgba(5,150,105,0.4)',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{stageLabel}</span>
                <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>{progress}%</span>
              </div>
            </div>

            {/* Stage indicators */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {['Upload', 'Parse', 'Extract Fields', 'Finalise'].map((stage, i) => {
                const active = Math.floor(progress / 25) >= i;
                return (
                  <div key={stage} style={{
                    padding: '4px 12px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600,
                    background: active ? 'rgba(5,150,105,0.12)' : 'rgba(148,163,184,0.08)',
                    color: active ? '#065f46' : '#94a3b8',
                    border: `1px solid ${active ? 'rgba(5,150,105,0.25)' : 'rgba(148,163,184,0.15)'}`,
                    transition: 'all 0.3s ease',
                  }}>
                    {active ? '✓ ' : ''}{stage}
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: '12px', fontSize: '0.72rem', color: '#94a3b8' }}>
              Elapsed: {formatElapsed(elapsedSecs)}
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {results && !isProcessing && (
          <div className="nt-section" style={{ animationDelay: '0.05s' }}>
            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '24px' }}>
              {[
                { label: 'Records Found',    value: results.total || 0,          icon: '📋', color: '#059669' },
                { label: 'Instrument Tags',  value: items.filter(r => r.instrument_tag_no).length, icon: '🏷️', color: '#0891b2' },
                { label: 'Equipment Nos.',   value: items.filter(r => r.equipment_no).length,      icon: '⚙️', color: '#7c3aed' },
                { label: 'Line Numbers',     value: items.filter(r => r.line_number).length,       icon: '🔢', color: '#b45309' },
                { label: 'Shown (filtered)', value: sortedItems.length,          icon: '🔍', color: '#0f766e' },
              ].map((kpi, i) => (
                <div key={i} className="nt-kpi-node" style={{
                  background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(10px)',
                  border: `1px solid rgba(5,150,105,0.14)`, borderRadius: '14px',
                  padding: '16px', animationDelay: `${i * 0.08}s`,
                }}>
                  <div style={{ fontSize: '1.4rem', marginBottom: '6px' }}>{kpi.icon}</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: kpi.color, lineHeight: 1 }}>
                    {kpi.value}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px', fontWeight: 500 }}>
                    {kpi.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Table toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                <input
                  type="text" placeholder="Filter across all fields…"
                  value={filterText} onChange={e => setFilterText(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 14px 9px 36px',
                    border: '1px solid rgba(5,150,105,0.22)', borderRadius: '10px',
                    background: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', color: '#334155',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '0.9rem' }}>
                  🔍
                </span>
              </div>

              <button
                className="nt-export-btn"
                onClick={handleExport}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '9px 18px', borderRadius: '10px',
                  background: 'rgba(255,255,255,0.8)',
                  border: '1px solid rgba(5,150,105,0.28)', color: '#065f46',
                  fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <ArrowDownTrayIcon style={{ width: 16, height: 16 }} />
                Export Excel
              </button>

              {/* ─── AI Insights button (opens Smart Features slide-over panel) ─── */}
              <button
                onClick={() => setSmartOpen(true)}
                title="Open the AI Insights panel — confidence heatmap, repair suggestions, consistency check, NL query and more"
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '9px 18px', borderRadius: '10px',
                  background: 'linear-gradient(90deg, #059669, #0891b2)',
                  border: '1px solid transparent', color: '#fff',
                  fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(5,150,105,0.25)',
                  transition: 'all 0.15s ease',
                }}
              >
                <SparklesIcon style={{ width: 16, height: 16 }} />
                AI Insights
              </button>

              {smartFilterIdx instanceof Set && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 10px', borderRadius: 10,
                  background: 'rgba(124,58,237,0.1)', color: '#581c87',
                  border: '1px solid rgba(124,58,237,0.3)',
                  fontSize: '0.74rem', fontWeight: 600,
                }}>
                  <span>✨ AI filter: {smartFilterLabel.slice(0, 40)}{smartFilterLabel.length > 40 ? '…' : ''}</span>
                  <button
                    onClick={() => { setSmartFilterIdx(null); setSmartFilterLabel(''); }}
                    style={{
                      background: 'transparent', border: 'none', color: '#7c3aed',
                      cursor: 'pointer', fontSize: '0.85rem', padding: 0, lineHeight: 1,
                    }}
                    title="Clear AI filter"
                  >✕</button>
                </span>
              )}
            </div>

            {/* Table */}
            <div style={{
              background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(5,150,105,0.14)', borderRadius: '16px',
              overflow: 'hidden',
            }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: 'linear-gradient(90deg, rgba(5,150,105,0.08), rgba(8,145,178,0.06))' }}>
                      <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: '#047857', fontSize: '0.72rem', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(5,150,105,0.12)' }}>
                        #
                      </th>
                      {COLUMNS.map(col => (
                        <th
                          key={col.key}
                          onClick={() => handleSort(col.key)}
                          style={{
                            padding: '12px 14px', textAlign: 'left', fontWeight: 700,
                            color: sortCol === col.key ? '#059669' : '#374151',
                            fontSize: '0.72rem', whiteSpace: 'nowrap',
                            borderBottom: '1px solid rgba(5,150,105,0.12)',
                            cursor: 'pointer', userSelect: 'none',
                            minWidth: `${col.width * 7}px`,
                          }}
                        >
                          {col.label}
                          {sortCol === col.key && (
                            <span style={{ marginLeft: '4px', color: '#059669' }}>
                              {sortAsc ? '↑' : '↓'}
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedItems.length === 0 ? (
                      <tr>
                        <td colSpan={COLUMNS.length + 1} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                          No records match the current filter.
                        </td>
                      </tr>
                    ) : sortedItems.map((row, idx) => (
                      <tr
                        key={idx}
                        className="nt-row-animate"
                        style={{
                          animationDelay: `${idx * 0.03}s`,
                          borderBottom: idx < sortedItems.length - 1 ? '1px solid rgba(5,150,105,0.06)' : 'none',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(5,150,105,0.04)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: '0.72rem', whiteSpace: 'nowrap', fontWeight: 600 }}>
                          {idx + 1}
                        </td>
                        {COLUMNS.map(col => (
                          <td key={col.key} style={{ padding: '10px 14px', color: '#374151', verticalAlign: 'top' }}>
                            {row[col.key] && row[col.key] !== ''
                              ? <span title={row[col.key]}>{row[col.key]}</span>
                              : <span style={{ color: '#cbd5e1' }}>—</span>
                            }
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table footer */}
              <div style={{
                padding: '10px 16px', borderTop: '1px solid rgba(5,150,105,0.08)',
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'rgba(5,150,105,0.03)',
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'ntPulse 2s ease infinite' }} />
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                  Showing {sortedItems.length} of {items.length} record{items.length !== 1 ? 's' : ''}
                  {filterText && ` — filtered by "${filterText}"`}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Success banner (no error, no results, just completed idle) ── */}
        {results && !isProcessing && items.length === 0 && (
          <div style={{
            background: 'rgba(240,253,244,0.9)', border: '1px solid rgba(5,150,105,0.2)',
            borderRadius: '12px', padding: '16px 20px', marginTop: '16px',
            color: '#065f46', fontSize: '0.88rem', fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <CheckCircleIcon style={{ width: 20, height: 20, color: '#10b981', flexShrink: 0 }} />
            Extraction completed — no structured metadata fields were identified in this document.
            Try a different format or a document with standard engineering tags.
          </div>
        )}

        {/* ── Info panel (idle) — collapsed by default to keep canvas clean ── */}
        {!results && !isProcessing && <IdleInfoPanel />}

        {/* ── Document Search Canvas (replaces "Discover more RAD AI modules") ── */}
        <DocumentSearchCanvas results={results} file={file} navigate={navigate} />
      </div>

      {/* ── AI Insights slide-over (additive — never mutates `items`) ── */}
      <NonTeffSmartFeatures
        open={smartOpen}
        onClose={() => setSmartOpen(false)}
        items={items}
        columns={COLUMNS}
        excerpt={results?.text_excerpt || ''}
        onApplyFilter={(idxs, label) => {
          setSmartFilterIdx(new Set(idxs));
          setSmartFilterLabel(label || 'AI query');
          setSmartOpen(false);
        }}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Idle Info Panel — soft-coded, collapsed by default.
// Replaces the always-on "Extracted Metadata Fields" 12-card grid that
// previously dominated the idle screen. Keeps the supported-formats strip
// always visible, but hides the field catalogue behind a single toggle.
// All data still comes from the existing FIELD_INFO and SUPPORTED_FORMATS
// constants — no duplication.
// ---------------------------------------------------------------------------
const IDLE_PANEL_CONFIG = {
  defaultExpanded: false,   // tweak here to default-open the field grid
  maxFileSizeLabel: '50 MB',
};

const IdleInfoPanel = () => {
  const [open, setOpen] = useState(IDLE_PANEL_CONFIG.defaultExpanded);

  return (
    <div className="nt-section" style={{ animationDelay: '0.2s', marginTop: '8px' }}>
      <div style={{
        background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(5,150,105,0.14)', borderRadius: '16px',
        overflow: 'hidden',
      }}>
        {/* Toggle header */}
        <button
          onClick={() => setOpen((s) => !s)}
          style={{
            width: '100%', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '10px',
            background: 'linear-gradient(90deg, rgba(5,150,105,0.08), rgba(8,145,178,0.05))',
            borderBottom: open ? '1px solid rgba(5,150,105,0.1)' : 'none',
          }}
        >
          <InformationCircleIcon style={{ width: 18, height: 18, color: '#059669' }} />
          <span style={{ fontWeight: 700, color: '#065f46', fontSize: '0.88rem' }}>
            What gets extracted?
          </span>
          <span style={{
            fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600,
            background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(5,150,105,0.18)',
            borderRadius: 999, padding: '2px 10px',
          }}>
            {FIELD_INFO.length} fields · {SUPPORTED_FORMATS.length} formats
          </span>
          <span style={{ flex: 1 }} />
          {open
            ? <ChevronUpIcon style={{ width: 16, height: 16, color: '#94a3b8' }} />
            : <ChevronDownIcon style={{ width: 16, height: 16, color: '#94a3b8' }} />}
        </button>

        {/* Collapsible field grid */}
        {open && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1px', background: 'rgba(5,150,105,0.06)' }}>
            {FIELD_INFO.map((field, i) => (
              <div key={field.key} className="nt-info-card" style={{
                background: 'rgba(255,255,255,0.9)', padding: '14px 18px',
                display: 'flex', alignItems: 'flex-start', gap: '12px',
                transition: 'all 0.15s ease',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '8px', flexShrink: 0,
                  background: `${field.color}18`,
                  border: `1px solid ${field.color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: '1px',
                }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: field.color, fontFamily: 'monospace' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#334155', fontSize: '0.82rem', marginBottom: '2px' }}>
                    {field.label}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.73rem', lineHeight: 1.4 }}>
                    {field.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Always-visible format support strip */}
        <div style={{
          padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
          background: 'rgba(5,150,105,0.03)', borderTop: '1px solid rgba(5,150,105,0.08)',
        }}>
          <span style={{ fontSize: '0.73rem', color: '#64748b', fontWeight: 600 }}>Supported formats:</span>
          {SUPPORTED_FORMATS.map(f => (
            <span key={f.ext} style={{
              background: `${f.color}15`, border: `1px solid ${f.color}35`,
              color: f.color, borderRadius: '6px', padding: '2px 10px',
              fontSize: '0.72rem', fontWeight: 700,
            }}>
              {f.label}
            </span>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#94a3b8' }}>
            Max file size: {IDLE_PANEL_CONFIG.maxFileSizeLabel}
          </span>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Document Search Canvas
// ---------------------------------------------------------------------------
// Soft-coded, self-contained search/preview panel that replaces the old
// "Discover more RAD AI modules" block. It is purely presentational —
// no extraction/upload/poll logic is touched. All knobs are in DSC_CONFIG.
//
// - Searches across the metadata rows already extracted on this page.
// - Inline preview pane for the source document (PDF/image/native browser view).
// - Recommendation list collapsed into a small footer link, preserved for
//   discoverability without consuming canvas space.
// ---------------------------------------------------------------------------
const DSC_CONFIG = {
  // Which extracted-row fields participate in the full-text search.
  searchableKeys: [
    'document_no', 'document_title', 'document_type', 'document_subtype',
    'revision', 'discipline',
    'instrument_tag_no', 'line_number', 'equipment_no',
    'mechanical_component', 'status', 'date', 'originator', 'remarks',
  ],
  // Visual fields shown on each result card (key → label).
  resultCardFields: [
    { key: 'document_no',       label: 'Doc No.'   },
    { key: 'document_subtype',  label: 'Sub-Type'  },
    { key: 'revision',          label: 'Rev'       },
    { key: 'discipline',        label: 'Discipline'},
    { key: 'status',            label: 'Status'    },
  ],
  // Highest-impact field for the result heading.
  titleKey: 'document_title',
  subtitleKey: 'document_no',
  // Maximum results rendered (paginate beyond this).
  maxResults: 50,
  // Theme — mirrors NT_T emerald/teal palette already used on the page.
  accent: '#059669',
  accentSoft: 'rgba(5,150,105,0.08)',
  accentBorder: 'rgba(5,150,105,0.18)',
  // File extensions the inline preview pane can render natively.
  inlinePreviewExt: ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'],
};

// ---------------------------------------------------------------------------
// Locator config — drives the "jump to coordinates" experience when a result
// row is clicked. Everything is soft-coded so the same canvas can power
// future extractors that emit different page / bbox shapes.
//
// • searchTermPriority: which row keys to try (in order) as the highlight term
// • pageKeys: which row keys may carry a page reference
// • pagePattern: regex to pull a 1-based page number out of a free-text label
//   (the current extractor stores values like "Page 3" in `remarks`)
// • bboxKeys: keys to inspect for explicit [x0,y0,x1,y1] / {x,y,w,h} payloads,
//   ready for future extractors that emit real coordinates
// • previewFragment: builds the URL hash for the browser's native PDF viewer
//   so it auto-jumps to the page and highlights every match.
// ---------------------------------------------------------------------------
const LOCATOR_CONFIG = {
  searchTermPriority: [
    'instrument_tag_no', 'equipment_no', 'line_number',
    'document_no', 'document_title', 'mechanical_component',
  ],
  pageKeys: ['_page', 'page', 'page_number', 'source', 'remarks'],
  pagePattern: /\bpage\s*[:#]?\s*(\d+)/i,
  bboxKeys: ['bbox', 'coordinates', 'coords', 'rect', 'region'],
  previewFragment: ({ page, term }) => {
    const parts = [];
    if (page) parts.push(`page=${page}`);
    if (term) parts.push(`search=${encodeURIComponent(term)}`);
    return parts.length ? `#${parts.join('&')}` : '';
  },
};

// Pure helper — derives { term, page, bbox, label } from a row using the
// soft-coded LOCATOR_CONFIG. Returns null when no useful locator info exists.
function buildLocator(row) {
  if (!row || typeof row !== 'object') return null;

  // 1. Search term — first non-empty value from priority list
  let term = '';
  let termKey = '';
  for (const k of LOCATOR_CONFIG.searchTermPriority) {
    const v = row[k];
    if (v != null && String(v).trim() !== '') {
      term = String(v).trim();
      termKey = k;
      break;
    }
  }

  // 2. Page number — first key that yields a parseable page
  let page = null;
  let pageSource = '';
  for (const k of LOCATOR_CONFIG.pageKeys) {
    const v = row[k];
    if (v == null || v === '') continue;
    if (typeof v === 'number' && Number.isFinite(v)) { page = Math.max(1, Math.round(v)); pageSource = k; break; }
    const m = String(v).match(LOCATOR_CONFIG.pagePattern);
    if (m) { page = parseInt(m[1], 10); pageSource = k; break; }
  }

  // 3. Explicit bbox — supported now in case the extractor adds it later
  let bbox = null;
  for (const k of LOCATOR_CONFIG.bboxKeys) {
    const v = row[k];
    if (!v) continue;
    if (Array.isArray(v) && v.length >= 4) {
      bbox = { x0: +v[0], y0: +v[1], x1: +v[2], y1: +v[3] };
      break;
    }
    if (typeof v === 'object') {
      if ('x0' in v && 'y0' in v) { bbox = { x0: +v.x0, y0: +v.y0, x1: +v.x1, y1: +v.y1 }; break; }
      if ('x' in v && 'y' in v)   { bbox = { x0: +v.x,  y0: +v.y,  x1: +v.x + (+v.w || +v.width || 0), y1: +v.y + (+v.h || +v.height || 0) }; break; }
    }
  }

  if (!term && !page && !bbox) return null;
  return { term, termKey, page, pageSource, bbox };
}

const DocumentSearchCanvas = ({ results, file, navigate }) => {
  const [query, setQuery]       = useState('');
  const [selected, setSelected] = useState(null);
  const [showRecs, setShowRecs] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Build a flat searchable row list from `results`.
  const allRows = React.useMemo(() => {
    if (!results) return [];
    if (Array.isArray(results)) return results;
    if (Array.isArray(results.rows)) return results.rows;
    if (Array.isArray(results.data)) return results.data;
    if (typeof results === 'object') return [results];
    return [];
  }, [results]);

  // Soft-coded fuzzy search across DSC_CONFIG.searchableKeys.
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allRows.slice(0, DSC_CONFIG.maxResults);
    return allRows.filter((row) =>
      DSC_CONFIG.searchableKeys.some((k) => {
        const v = row?.[k];
        if (v == null) return false;
        return String(v).toLowerCase().includes(q);
      })
    ).slice(0, DSC_CONFIG.maxResults);
  }, [allRows, query]);

  // Generate / revoke an object URL when a file is available so the preview
  // pane can render PDFs and images inline. Browser handles the rendering.
  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const fileName = file?.name || (results?.original_filename ?? '');
  const fileExt  = fileName ? `.${fileName.split('.').pop().toLowerCase()}` : '';
  const canInlinePreview = previewUrl && DSC_CONFIG.inlinePreviewExt.includes(fileExt);

  // Soft-coded locator — pure derivation from the selected row. Drives the
  // PDF preview's #page=N&search=… fragment so the native viewer jumps and
  // auto-highlights every occurrence. Falls back gracefully when no row is
  // selected or the row carries no locator hints.
  const selectedRow = selected != null ? filtered[selected] : null;
  const locator     = React.useMemo(() => buildLocator(selectedRow), [selectedRow]);
  const previewSrc  = React.useMemo(() => {
    if (!previewUrl) return null;
    if (!locator || fileExt !== '.pdf') return previewUrl;
    return `${previewUrl}${LOCATOR_CONFIG.previewFragment(locator)}`;
  }, [previewUrl, locator, fileExt]);

  const hasData = allRows.length > 0;

  // Highlight the matched substring inside a value.
  const highlight = (val) => {
    const text = String(val ?? '');
    const q = query.trim();
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: 'rgba(5,150,105,0.22)', color: '#065f46', padding: '0 2px', borderRadius: 3 }}>
          {text.slice(idx, idx + q.length)}
        </mark>
        {text.slice(idx + q.length)}
      </>
    );
  };

  return (
    <div className="nt-section" style={{ animationDelay: '0.25s', marginTop: 28 }}>
      <div style={{
        background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(10px)',
        border: `1px solid ${DSC_CONFIG.accentBorder}`, borderRadius: 18,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 22px',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          background: 'linear-gradient(90deg, rgba(5,150,105,0.10), rgba(8,145,178,0.07))',
          borderBottom: `1px solid ${DSC_CONFIG.accentBorder}`,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #059669, #0891b2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(5,150,105,0.3)',
          }}>
            <DocumentMagnifyingGlassIcon style={{ width: 20, height: 20, color: '#fff' }} />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontWeight: 800, color: '#065f46', fontSize: '0.95rem', letterSpacing: '-0.01em' }}>
              Document Search Canvas
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
              Search the extracted metadata · click a result to preview the source document.
            </div>
          </div>
          <span style={{
            background: 'rgba(255,255,255,0.9)', border: `1px solid ${DSC_CONFIG.accentBorder}`,
            borderRadius: 999, padding: '4px 12px',
            fontSize: '0.65rem', fontWeight: 700, color: '#047857', letterSpacing: 0.6,
          }}>
            {hasData ? `${allRows.length} ROW${allRows.length === 1 ? '' : 'S'} INDEXED` : 'WAITING FOR EXTRACTION'}
          </span>
        </div>

        {/* Search bar */}
        <div style={{
          padding: '14px 22px', borderBottom: `1px solid ${DSC_CONFIG.accentBorder}`,
          background: 'rgba(255,255,255,0.55)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: '#fff', border: `1px solid ${DSC_CONFIG.accentBorder}`,
            borderRadius: 10, padding: '8px 12px',
            boxShadow: '0 2px 6px -3px rgba(15,23,42,0.06)',
          }}>
            <MagnifyingGlassIcon style={{ width: 18, height: 18, color: DSC_CONFIG.accent, flexShrink: 0 }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={hasData ? 'Search by tag, document no., line number, status, originator…' : 'Upload and extract a document to enable search'}
              disabled={!hasData}
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: '0.9rem', color: '#0f172a', fontFamily: 'inherit',
              }}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                title="Clear"
                style={{
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  padding: 2, display: 'flex', alignItems: 'center',
                }}
              >
                <XMarkIcon style={{ width: 16, height: 16, color: '#94a3b8' }} />
              </button>
            )}
          </div>
          {query && (
            <div style={{ marginTop: 8, fontSize: '0.72rem', color: '#64748b' }}>
              {filtered.length} match{filtered.length === 1 ? '' : 'es'} found
              {filtered.length === DSC_CONFIG.maxResults ? ` (showing first ${DSC_CONFIG.maxResults})` : ''}
            </div>
          )}
        </div>

        {/* Body — split: results list + preview pane */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 0.9fr) minmax(300px, 1.1fr)',
          minHeight: 320, maxHeight: 540,
        }}>
          {/* Results list */}
          <div style={{
            borderRight: `1px solid ${DSC_CONFIG.accentBorder}`,
            overflow: 'auto', background: 'rgba(248,250,252,0.4)',
          }}>
            {!hasData && (
              <div style={{
                padding: '40px 22px', textAlign: 'center',
                color: '#94a3b8', fontSize: '0.85rem',
              }}>
                <DocumentTextIcon style={{ width: 36, height: 36, color: '#cbd5e1', margin: '0 auto 10px' }} />
                Upload a document above and run extraction.<br/>
                Searchable results will appear here.
              </div>
            )}

            {hasData && filtered.length === 0 && (
              <div style={{
                padding: '40px 22px', textAlign: 'center',
                color: '#94a3b8', fontSize: '0.85rem',
              }}>
                No results match <strong style={{ color: '#475569' }}>"{query}"</strong>
              </div>
            )}

            {filtered.map((row, idx) => {
              const isSelected = selected === idx;
              return (
                <button
                  key={`${row[DSC_CONFIG.subtitleKey] || 'row'}-${idx}`}
                  onClick={() => setSelected(isSelected ? null : idx)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    background: isSelected ? DSC_CONFIG.accentSoft : 'transparent',
                    border: 'none',
                    borderLeft: `3px solid ${isSelected ? DSC_CONFIG.accent : 'transparent'}`,
                    borderBottom: `1px solid ${DSC_CONFIG.accentBorder}`,
                    padding: '12px 16px', cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(5,150,105,0.04)'; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{
                    fontWeight: 700, color: '#0f172a', fontSize: '0.86rem',
                    marginBottom: 4, lineHeight: 1.3,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {highlight(row[DSC_CONFIG.titleKey] || row[DSC_CONFIG.subtitleKey] || '(untitled)')}
                  </div>
                  <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: 6,
                  }}>
                    {DSC_CONFIG.resultCardFields.map((f) => {
                      const v = row[f.key];
                      if (v == null || v === '') return null;
                      return (
                        <span key={f.key} style={{
                          fontSize: '0.68rem',
                          background: 'rgba(255,255,255,0.85)',
                          border: `1px solid ${DSC_CONFIG.accentBorder}`,
                          borderRadius: 6, padding: '2px 8px',
                          color: '#475569',
                        }}>
                          <span style={{ color: '#94a3b8', marginRight: 4 }}>{f.label}:</span>
                          <strong style={{ color: '#1f2937' }}>{highlight(v)}</strong>
                        </span>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Preview pane */}
          <div style={{
            display: 'flex', flexDirection: 'column',
            background: '#fff', minHeight: 0,
          }}>
            <div style={{
              padding: '10px 16px',
              borderBottom: `1px solid ${DSC_CONFIG.accentBorder}`,
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(248,250,252,0.6)',
            }}>
              <EyeIcon style={{ width: 16, height: 16, color: DSC_CONFIG.accent }} />
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
                Preview
              </span>
              {fileName && (
                <span style={{
                  fontSize: '0.72rem', color: '#94a3b8',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  flex: 1, minWidth: 0,
                }} title={fileName}>
                  · {fileName}
                </span>
              )}
            </div>

            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              {/* Selected row detail */}
              {selected != null && filtered[selected] && (
                <div style={{ padding: '14px 16px', borderBottom: `1px solid ${DSC_CONFIG.accentBorder}` }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
                    Extracted fields
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px' }}>
                    {DSC_CONFIG.searchableKeys.map((k) => {
                      const v = filtered[selected][k];
                      if (v == null || v === '') return null;
                      return (
                        <div key={k} style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                            {k.replace(/_/g, ' ')}
                          </div>
                          <div style={{
                            fontSize: '0.82rem', color: '#1f2937', fontWeight: 600,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }} title={String(v)}>
                            {highlight(v)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Locator strip — "exact coordinates" readout. Visible only when a
                  row is selected and we managed to derive at least one hint. */}
              {locator && (
                <div style={{
                  margin: '12px 16px 0', padding: '10px 12px',
                  background: 'linear-gradient(90deg, rgba(5,150,105,0.10), rgba(8,145,178,0.06))',
                  border: `1px solid ${DSC_CONFIG.accentBorder}`, borderRadius: 10,
                  display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                  fontSize: '0.74rem',
                }}>
                  <span style={{
                    background: DSC_CONFIG.accent, color: '#fff',
                    fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase',
                    borderRadius: 6, padding: '3px 8px', fontSize: '0.62rem',
                  }}>Locator</span>
                  {locator.page != null && (
                    <span style={{ color: '#065f46', fontWeight: 700 }}>
                      📄 Page <strong style={{ color: '#0f172a' }}>{locator.page}</strong>
                    </span>
                  )}
                  {locator.term && (
                    <span style={{ color: '#065f46', fontWeight: 700 }}>
                      🎯 Term <code style={{
                        background: '#fff', border: `1px solid ${DSC_CONFIG.accentBorder}`,
                        borderRadius: 4, padding: '1px 6px', color: '#0f172a',
                        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                      }}>{locator.term}</code>
                      <span style={{ color: '#94a3b8', fontWeight: 500, marginLeft: 4 }}>
                        (from {locator.termKey.replace(/_/g, ' ')})
                      </span>
                    </span>
                  )}
                  {locator.bbox && (
                    <span style={{ color: '#065f46', fontWeight: 700, fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                      📐 [{Math.round(locator.bbox.x0)}, {Math.round(locator.bbox.y0)}, {Math.round(locator.bbox.x1)}, {Math.round(locator.bbox.y1)}]
                    </span>
                  )}
                  <span style={{ flex: 1 }} />
                  {previewSrc && (
                    <a
                      href={previewSrc}
                      target="_blank" rel="noopener noreferrer"
                      style={{
                        background: '#fff', border: `1px solid ${DSC_CONFIG.accentBorder}`,
                        color: DSC_CONFIG.accent, fontWeight: 700,
                        borderRadius: 6, padding: '3px 10px', textDecoration: 'none',
                        fontSize: '0.7rem',
                      }}
                      title="Open the document in a new tab — the browser viewer will auto-jump to this location"
                    >
                      Open ↗
                    </a>
                  )}
                </div>
              )}

              {/* Inline document preview — `key` forces the iframe to reload
                  the URL fragment when the locator changes, so Chrome / Edge
                  re-run their internal page-jump + highlight pipeline. */}
              {canInlinePreview ? (
                <iframe
                  key={previewSrc}
                  src={previewSrc}
                  title="Document preview"
                  style={{ width: '100%', height: selected != null ? 280 : 460, border: 'none', display: 'block' }}
                />
              ) : (
                <div style={{
                  padding: '40px 22px', textAlign: 'center',
                  color: '#94a3b8', fontSize: '0.82rem',
                }}>
                  <DocumentTextIcon style={{ width: 36, height: 36, color: '#cbd5e1', margin: '0 auto 10px' }} />
                  {file
                    ? <>Inline preview not supported for <code style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: 4 }}>{fileExt}</code> files.<br/>Search results above stay fully interactive.</>
                    : <>Upload a document and run extraction to enable preview.</>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Collapsible footer — preserves "Discover more modules" without consuming space */}
        <div style={{
          borderTop: `1px solid ${DSC_CONFIG.accentBorder}`,
          background: 'rgba(248,250,252,0.5)',
        }}>
          <button
            onClick={() => setShowRecs((s) => !s)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 22px', border: 'none', background: 'transparent',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <SparklesIcon style={{ width: 16, height: 16, color: DSC_CONFIG.accent }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
              Discover more RAD AI modules
            </span>
            <span style={{ flex: 1 }} />
            {showRecs
              ? <ChevronUpIcon style={{ width: 16, height: 16, color: '#94a3b8' }} />
              : <ChevronDownIcon style={{ width: 16, height: 16, color: '#94a3b8' }} />}
          </button>
          {showRecs && (
            <div style={{ padding: '0 22px 18px' }}>
              <FeatureRecommendations navigate={navigate} embedded />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Presentational recommendation panel — soft-coded from RECOMMENDED_FEATURES.
// Receives navigate() so it never touches routing logic directly.
// `embedded` strips the outer wrapper when nested inside another panel.
// ---------------------------------------------------------------------------
const FeatureRecommendations = ({ navigate, embedded = false }) => {
  // Soft-coded: when embedded inside another panel (e.g. DocumentSearchCanvas
  // collapsible footer), skip the outer card chrome and header strip.
  const Body = (
    <div style={{ padding: embedded ? '4px 0 0' : '18px 22px 22px' }}>
        {RECOMMENDED_FEATURES.map((group) => (
          <div key={group.category} style={{ marginBottom: 18 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
            }}>
              <span style={{
                fontSize: '0.72rem', fontWeight: 700, color: '#047857',
                textTransform: 'uppercase', letterSpacing: 0.8,
              }}>
                {group.category}
              </span>
              <span style={{ flex: 1, height: 1, background: 'rgba(5,150,105,0.12)' }} />
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 12,
            }}>
              {group.items.map((item) => (
                <button
                  key={item.to}
                  onClick={() => navigate(item.to)}
                  className="nt-reco-card"
                  style={{
                    textAlign: 'left', cursor: 'pointer',
                    background: 'rgba(255,255,255,0.95)',
                    border: `1px solid ${item.accent}26`,
                    borderLeft: `3px solid ${item.accent}`,
                    borderRadius: 12,
                    padding: '14px 16px',
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    boxShadow: '0 2px 6px -3px rgba(15,23,42,0.06)',
                  }}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    background: `${item.accent}14`,
                    border: `1px solid ${item.accent}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.15rem',
                  }}>
                    {item.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2,
                    }}>
                      <span style={{
                        fontWeight: 700, color: '#1f2937', fontSize: '0.87rem',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {item.title}
                      </span>
                    </div>
                    <div style={{
                      fontSize: '0.74rem', color: '#64748b', lineHeight: 1.45, marginBottom: 6,
                    }}>
                      {item.tagline}
                    </div>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      background: `${item.accent}12`,
                      color: item.accent,
                      fontSize: '0.65rem', fontWeight: 700, letterSpacing: 0.3,
                      padding: '2px 8px', borderRadius: 999,
                      textTransform: 'uppercase',
                    }}>
                      {item.benefit}
                    </div>
                  </div>
                  <ArrowRightIcon
                    className="nt-reco-arrow"
                    style={{ width: 18, height: 18, color: item.accent, flexShrink: 0, marginTop: 4 }}
                  />
                </button>
              ))}
            </div>
          </div>
        ))}

        <div style={{
          marginTop: 6,
          textAlign: 'center',
          fontSize: '0.72rem', color: '#94a3b8',
        }}>
          💎 All modules included in your RAD AI subscription — no extra setup required.
        </div>
      </div>
  );

  if (embedded) return Body;

  return (
    <div className="nt-section" style={{ animationDelay: '0.25s', marginTop: 28 }}>
      <div style={{
        background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(5,150,105,0.14)', borderRadius: 18,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 22px',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          background: 'linear-gradient(90deg, rgba(5,150,105,0.1), rgba(8,145,178,0.07))',
          borderBottom: '1px solid rgba(5,150,105,0.1)',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #059669, #0891b2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(5,150,105,0.3)',
          }}>
            <SparklesIcon style={{ width: 20, height: 20, color: '#fff' }} />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontWeight: 800, color: '#065f46', fontSize: '0.95rem', letterSpacing: '-0.01em' }}>
              Discover more RAD AI modules
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
              Extracted metadata flows straight into these connected tools — one click away.
            </div>
          </div>
          <span style={{
            background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(5,150,105,0.2)',
            borderRadius: 999, padding: '4px 12px',
            fontSize: '0.65rem', fontWeight: 700, color: '#047857', letterSpacing: 0.6,
          }}>
            RECOMMENDED FOR YOU
          </span>
        </div>
        {Body}
      </div>
    </div>
  );
};

export default NonTeffMetadataPage;
