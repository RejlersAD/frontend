/**
 * Equipment List - P&ID Equipment Tag Extraction
 * Route:  /engineering/process/equipment-list
 * Module: pid_analysis (same access control as Line List)
 *
 * Mirrors LineList.jsx upload/poll/table/export pattern.
 * Soft-coded: COLUMNS array at top, timing constants below imports.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  CloudArrowUpIcon,
  CheckCircleIcon,
  ArrowDownTrayIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
} from '@heroicons/react/24/outline';
import { Boxes } from 'lucide-react';
import apiClient from '../../../services/api.service';
import * as XLSX from 'xlsx';
import { getApiBaseUrl } from '../../../config/environment.config';
import { STORAGE_KEYS } from '../../../config/app.config';
import WrenchAiDocAssist from '../../../components/Engineering/WrenchAiDocAssist';

// ---------------------------------------------------------------------------
// Soft-coded column definitions — add/remove columns here only.
// key must match the backend response field name.
// ---------------------------------------------------------------------------
const COLUMNS = [
  { key: 'sl_no',               label: 'SL No.',                   width: 6  },
  { key: 'revision',            label: 'Rev.',                      width: 7  },
  { key: 'tag',                 label: 'Equipment Tag No.',          width: 16 },
  { key: 'description',         label: 'Description',               width: 28 },
  { key: 'design_flowrate',     label: 'Design Flowrate / Duty',    width: 22 },
  { key: 'oper_pressure',       label: 'Oper. Pressure (PSIG)',     width: 18 },
  { key: 'oper_temperature',    label: 'Oper. Temp. (°F)',          width: 16 },
  { key: 'design_pressure_min', label: 'Des. Pressure (MIN)',        width: 20 },
  { key: 'design_pressure_max', label: 'Des. Pressure (MAX)',        width: 20 },
  { key: 'design_temp_min',     label: 'Des. Temp. Min (°F)',       width: 16 },
  { key: 'design_temp_max',     label: 'Des. Temp. Max (°F)',       width: 16 },
  { key: 'moc',                 label: 'MOC',                       width: 16 },
  { key: 'insulation',          label: 'Insulation',                width: 14 },
  { key: 'dimension_length',    label: 'Length / Height (mm)',      width: 18 },
  { key: 'dimension_diameter',  label: 'Diameter / Width (mm)',     width: 18 },
  { key: 'motor_rating',        label: 'Motor Rating (kW)',         width: 14 },
  { key: 'pid_no',              label: 'P&ID No.',                  width: 16 },
  { key: 'quality_required',    label: 'Quantity Required',         width: 18 },
  { key: 'phase',               label: 'Phase',                     width: 12 },
  { key: 'remarks',             label: 'Remarks',                   width: 24 },
];

const UPLOAD_TIMEOUT_MS  = 600000;  // 10 min
const POLL_INTERVAL_MS   = 3000;
const POLL_MAX_WAIT_MS   = 3600000; // 60 min
const POLL_REQ_TIMEOUT   = 10000;
const MAX_POST_RETRIES   = 3;
const POST_RETRY_BASE_MS = 4000;

// ---------------------------------------------------------------------------
// Soft-coded export filenames — change here only.
// Kept short per user request; previous form
// `${drawing_ref}_equipment_list.xlsx` produced very lengthy file names.
// ---------------------------------------------------------------------------
const EXPORT_FILENAME          = 'Equipment_list.xlsx';
const EXPORT_FILENAME_SELECTED = 'Equipment_list_selected.xlsx';

// ---------------------------------------------------------------------------
// Soft-coded layout config — change widths/padding here without touching JSX.
// ---------------------------------------------------------------------------
const LAYOUT_CONFIG = {
  normalMaxWidth:     '80rem',    // max-w-7xl = 1280 px
  normalPaddingX:     '1.5rem',
  normalPaddingY:     '2rem',
  fullscreenMaxWidth: '100%',
  fullscreenPaddingX: '2rem',
  fullscreenPaddingY: '2rem',
};

const API_BASE = getApiBaseUrl();

// ─── AI Document Assist (Wrench) — soft-coded panel config ─────────────────
// Mirrors the panel on PID Verification / PMS / Instrument Index / CLL /
// PFD Quality Checker / Line List.  Equipment List accepts MULTIPLE PDFs,
// so each Wrench pick is APPENDED (deduped by name) to the existing list.
const EL_AI_ASSIST_CONFIG = {
  enabled:         true,
  title:           'AI Document Assist',
  subtitleTag:     '(Wrench · optional)',
  subtitle:        'Let RAD AI pick & recommend the right P&ID PDFs for this Equipment List from Wrench DMS',
  defaultHint:     'equipment list p&id',
  hintPlaceholder: 'e.g. equipment list, p&id, unit 100',
  topN:            6,
  acceptedExts:    ['pdf'],
};

// ---------------------------------------------------------------------------
// Soft-coded line / nozzle connection rendering config
// Change LINE_ARROW_SEPARATOR to any symbol (e.g. '⟶', '➜', '▸') to restyle.
// Extend FLUID_COLOR_MAP with any fluid code and { bg, text, border } theme.
// ---------------------------------------------------------------------------
const LINE_ARROW_SEPARATOR = '→';

const FLUID_COLOR_MAP = {
  // Gases
  PG:  { bg: 'rgba(59,130,246,0.10)',  text: '#1e3a5f', border: 'rgba(59,130,246,0.30)'  },
  VG:  { bg: 'rgba(139,92,246,0.10)',  text: '#3b0764', border: 'rgba(139,92,246,0.30)'  },
  FG:  { bg: 'rgba(14,165,233,0.10)',  text: '#0c4a6e', border: 'rgba(14,165,233,0.30)'  },
  GC:  { bg: 'rgba(234,179,8,0.10)',   text: '#713f12', border: 'rgba(234,179,8,0.30)'   },
  NG:  { bg: 'rgba(99,102,241,0.10)',  text: '#312e81', border: 'rgba(99,102,241,0.30)'  },
  HG:  { bg: 'rgba(99,102,241,0.10)',  text: '#312e81', border: 'rgba(99,102,241,0.30)'  },
  // Liquid hydrocarbons
  HO:  { bg: 'rgba(245,158,11,0.10)',  text: '#78350f', border: 'rgba(245,158,11,0.30)'  },
  LO:  { bg: 'rgba(245,158,11,0.10)',  text: '#78350f', border: 'rgba(245,158,11,0.30)'  },
  CO:  { bg: 'rgba(245,158,11,0.10)',  text: '#78350f', border: 'rgba(245,158,11,0.30)'  },
  // Water
  W:   { bg: 'rgba(6,182,212,0.10)',   text: '#164e63', border: 'rgba(6,182,212,0.30)'   },
  CW:  { bg: 'rgba(6,182,212,0.10)',   text: '#164e63', border: 'rgba(6,182,212,0.30)'   },
  SW:  { bg: 'rgba(20,184,166,0.10)',  text: '#134e4a', border: 'rgba(20,184,166,0.30)'  },
  FW:  { bg: 'rgba(6,182,212,0.10)',   text: '#164e63', border: 'rgba(6,182,212,0.30)'   },
  WW:  { bg: 'rgba(6,182,212,0.10)',   text: '#164e63', border: 'rgba(6,182,212,0.30)'   },
  // Steam / condensate
  ST:  { bg: 'rgba(249,115,22,0.10)',  text: '#7c2d12', border: 'rgba(249,115,22,0.30)'  },
  SC:  { bg: 'rgba(249,115,22,0.10)',  text: '#7c2d12', border: 'rgba(249,115,22,0.30)'  },
  // Drain / vent
  D:   { bg: 'rgba(100,116,139,0.10)', text: '#334155', border: 'rgba(100,116,139,0.30)' },
  DR:  { bg: 'rgba(100,116,139,0.10)', text: '#334155', border: 'rgba(100,116,139,0.30)' },
  V:   { bg: 'rgba(167,139,250,0.10)', text: '#4c1d95', border: 'rgba(167,139,250,0.30)' },
  // Air
  A:   { bg: 'rgba(132,204,22,0.10)',  text: '#3f6212', border: 'rgba(132,204,22,0.30)'  },
  IA:  { bg: 'rgba(132,204,22,0.10)',  text: '#3f6212', border: 'rgba(132,204,22,0.30)'  },
  PA:  { bg: 'rgba(132,204,22,0.10)',  text: '#3f6212', border: 'rgba(132,204,22,0.30)'  },
  // Chemicals / inhibitors
  CH:  { bg: 'rgba(239,68,68,0.08)',   text: '#7f1d1d', border: 'rgba(239,68,68,0.25)'   },
  INH: { bg: 'rgba(239,68,68,0.08)',   text: '#7f1d1d', border: 'rgba(239,68,68,0.25)'   },
  MEG: { bg: 'rgba(239,68,68,0.08)',   text: '#7f1d1d', border: 'rgba(239,68,68,0.25)'   },
};
const FLUID_COLOR_DEFAULT = { bg: 'rgba(148,163,184,0.10)', text: '#475569', border: 'rgba(148,163,184,0.30)' };

// ---------------------------------------------------------------------------
// Soft-coded: equipment-type → quantity field semantic hint.
// Key: uppercase prefix of the equipment tag (before first '-').
// Value: { label, placeholder } — displayed as tooltip/helper in Quantity Required cell.
// Add new prefixes here to extend dynamic behaviour for future P&IDs.
// ---------------------------------------------------------------------------
const EQUIPMENT_QUANTITY_HINTS = {
  // Vessels / Separators / Tanks / Drums / Filters / Slug Catchers
  V:   { label: 'Volume',            placeholder: 'e.g. 327 M³' },
  T:   { label: 'Volume',            placeholder: 'e.g. 100 M³' },
  TK:  { label: 'Volume',            placeholder: 'e.g. 500 M³' },
  S:   { label: 'Volume',            placeholder: 'e.g. 50 M³'  },
  D:   { label: 'Volume',            placeholder: 'e.g. 20 M³'  },
  SC:  { label: 'Volume',            placeholder: 'e.g. 327 M³' },
  F:   { label: 'Volume',            placeholder: 'e.g. 10 M³'  },
  // Pumps / Compressors / Blowers / Fans
  P:   { label: 'Design Flow Rate',  placeholder: 'e.g. 250 m³/h' },
  C:   { label: 'Design Flow Rate',  placeholder: 'e.g. 1000 Nm³/h' },
  K:   { label: 'Design Flow Rate',  placeholder: 'e.g. 5000 Nm³/h' },
  B:   { label: 'Design Flow Rate',  placeholder: 'e.g. 2000 m³/h' },
  // Heat Exchangers / Coolers / Heaters / Fired Heaters
  E:   { label: 'Duty',              placeholder: 'e.g. 2.5 MMBtu/hr' },
  H:   { label: 'Duty',              placeholder: 'e.g. 5 MMBtu/hr' },
  A:   { label: 'Duty',              placeholder: 'e.g. 1.2 MMBtu/hr' },
  // Columns / Towers
  CO:  { label: 'Volume',            placeholder: 'e.g. 80 M³' },
};

/** Resolve quantity hint for an equipment tag string (e.g. "V-803-TF" → Volume) */
function resolveQuantityHint(tag) {
  if (!tag || tag === '—') return null;
  const prefix = String(tag).split('-')[0].toUpperCase();
  // Try longest match first (e.g. "SC" before "S", "TK" before "T", "CO" before "C")
  const sorted = Object.keys(EQUIPMENT_QUANTITY_HINTS).sort((a, b) => b.length - a.length);
  for (const k of sorted) {
    if (prefix === k) return EQUIPMENT_QUANTITY_HINTS[k];
  }
  return null;
}

/**
 * Extract fluid code from a line tag.
 * Format: SIZE"-FLUIDCODE-SEQUENCE-PIPECLASS[-INSULATION]
 * e.g.  "2"-D-6109-033842-X"  →  "D"
 *       "16"-PG-5140-031440-X" → "PG"
 */
function parseFluidCode(lineTag) {
  const m = String(lineTag).match(/^[\d½¾¼]+["']?-([A-Z]{1,4})-/);
  return m ? m[1] : null;
}

/** Render line connection tags as colour-coded mono badges joined by flow arrows */
function renderLineBadges(lines) {
  if (!Array.isArray(lines) || !lines.length) return <span style={{ color: '#94a3b8' }}>—</span>;
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
      {lines.map((line, i) => {
        const fluid   = parseFluidCode(line);
        const colours = (fluid && FLUID_COLOR_MAP[fluid]) || FLUID_COLOR_DEFAULT;
        return (
          <React.Fragment key={i}>
            {i > 0 && (
              <span style={{ color: '#94a3b8', fontSize: '0.65rem', fontWeight: 700, userSelect: 'none', padding: '0 1px' }}>
                {LINE_ARROW_SEPARATOR}
              </span>
            )}
            <span
              title={`${line}${fluid ? ` (${fluid})` : ''}`}
              style={{
                background:    colours.bg,
                color:         colours.text,
                border:        `1px solid ${colours.border}`,
                borderRadius:  '4px',
                padding:       '1px 6px',
                fontSize:      '0.67rem',
                fontFamily:    'ui-monospace, SFMono-Regular, monospace',
                fontWeight:    600,
                whiteSpace:    'nowrap',
                letterSpacing: '0.01em',
              }}
            >
              {line}
            </span>
          </React.Fragment>
        );
      })}
    </span>
  );
}

/** Render nozzle connection tags as compact emerald mono badges */
function renderNozzleBadges(nozzles) {
  if (!Array.isArray(nozzles) || !nozzles.length) return <span style={{ color: '#94a3b8' }}>—</span>;
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '4px' }}>
      {nozzles.map((nozzle, i) => (
        <span
          key={i}
          title={nozzle}
          style={{
            background:   'rgba(5,150,105,0.07)',
            color:        '#065f46',
            border:       '1px solid rgba(5,150,105,0.20)',
            borderRadius: '4px',
            padding:      '1px 6px',
            fontSize:     '0.67rem',
            fontFamily:   'ui-monospace, SFMono-Regular, monospace',
            fontWeight:   600,
            whiteSpace:   'nowrap',
          }}
        >
          {nozzle}
        </span>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Soft-coded: condition column keys — temperature and pressure fields that
// may contain normalised range values (e.g. "60 – 105 °F") from the backend.
// _RANGE_SEP must match the backend _TEMP_RANGE_SEPARATOR constant.
// ---------------------------------------------------------------------------
const _RANGE_SEP = ' \u2013 ';  // en-dash with spaces
const CONDITION_COLS = new Set([
  'oper_pressure',
  'oper_temperature',
  'design_pressure_min',
  'design_pressure_max',
  'design_temp_min',
  'design_temp_max',
]);

/**
 * Render a temperature or pressure value with a visual indicator when the
 * backend has normalised it to a MIN – MAX range (contains en-dash separator).
 */
function renderConditionValue(display) {
  if (!display || display === '—') return <span style={{ color: '#94a3b8' }}>—</span>;
  const str = String(display);
  if (str.includes(_RANGE_SEP)) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
        <span
          title="Range value (min – max)"
          style={{
            fontSize: '0.6rem',
            fontWeight: 700,
            color: '#6ee7b7',
            letterSpacing: '-0.5px',
            userSelect: 'none',
          }}
        >⇕</span>
        <span>{str}</span>
      </span>
    );
  }
  return <span>{str}</span>;
}

// ---------------------------------------------------------------------------
// Soft-coded: blank manual observation row template.
// Add/remove keys here to extend manual entry fields. Must match COLUMNS keys.
// ---------------------------------------------------------------------------
const MANUAL_OBS_BLANK = {
  tag: '', description: '', design_flowrate: '', oper_pressure: '',
  oper_temperature: '', design_pressure_min: '', design_pressure_max: '',
  design_temp_min: '', design_temp_max: '', moc: '', insulation: '',
  dimension_length: '', dimension_diameter: '', motor_rating: '',
  pid_no: '', quality_required: '', phase: '', remarks: '', revision: '',
};

// ---------------------------------------------------------------------------
// SOFT-CODED: All animation keyframes live in EQ_KEYFRAMES.
// Visual theme constants (colours, gradients, decoration config) live in EQ_T.
// JSX only references these — no magic values inline.
// ---------------------------------------------------------------------------
const EQ_KEYFRAMES = `
  /* ── Orbit electrons (AI processing loader) ── */
  @keyframes eqOrbitA {
    from { transform: rotate(0deg)   translateX(30px) rotate(0deg);    }
    to   { transform: rotate(360deg) translateX(30px) rotate(-360deg); }
  }
  @keyframes eqOrbitB {
    from { transform: rotate(120deg) translateX(30px) rotate(-120deg); }
    to   { transform: rotate(480deg) translateX(30px) rotate(-480deg); }
  }
  @keyframes eqOrbitC {
    from { transform: rotate(240deg) translateX(30px) rotate(-240deg); }
    to   { transform: rotate(600deg) translateX(30px) rotate(-600deg); }
  }
  /* ── Animated top gradient bar ── */
  @keyframes eqGradShift {
    0%   { background-position: 0%   50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0%   50%; }
  }
  /* ── Circuit trace on upload border ── */
  @keyframes eqTraceH {
    0%     { transform: scaleX(0); transform-origin: left;  }
    48%    { transform: scaleX(1); transform-origin: left;  }
    52%    { transform: scaleX(1); transform-origin: right; }
    100%   { transform: scaleX(0); transform-origin: right; }
  }
  @keyframes eqTraceV {
    0%     { transform: scaleY(0); transform-origin: top;    }
    48%    { transform: scaleY(1); transform-origin: top;    }
    52%    { transform: scaleY(1); transform-origin: bottom; }
    100%   { transform: scaleY(0); transform-origin: bottom; }
  }
  /* ── Pipe flow dashes ── */
  @keyframes eqPipeFlow {
    from { stroke-dashoffset: 40; }
    to   { stroke-dashoffset: 0;  }
  }
  /* ── Streaming data dots across pipe ── */
  @keyframes eqStreamDot {
    0%   { left: -6px;           opacity: 0; }
    6%   { opacity: 1; }
    94%  { opacity: 1; }
    100% { left: calc(100% + 6px); opacity: 0; }
  }
  /* ── Node glow for KPI cards ── */
  @keyframes eqNodeGlow {
    0%, 100% { box-shadow: 0 0 10px rgba(5,150,105,0.12), 0 4px 16px rgba(5,150,105,0.07); }
    50%       { box-shadow: 0 0 26px rgba(5,150,105,0.26), 0 4px 22px rgba(5,150,105,0.13); }
  }
  /* ── Badge / chip pop entrance ── */
  @keyframes eqChipPop {
    0%   { opacity: 0; transform: scale(0.72) translateY(5px); }
    62%  { transform: scale(1.06) translateY(-1px); }
    100% { opacity: 1; transform: scale(1)    translateY(0);   }
  }
  /* ── Slow reverse spin (rule ring inner) ── */
  @keyframes eqSpinSlowRev {
    from { transform: rotate(360deg); }
    to   { transform: rotate(0deg);   }
  }
  /* ── Ambient blob floats ── */
  @keyframes eqFloatA {
    0%, 100% { transform: translateY(0)     scale(1);    }
    50%       { transform: translateY(-24px) scale(1.04); }
  }
  @keyframes eqFloatB {
    0%, 100% { transform: translateY(0)    scale(1);    }
    50%       { transform: translateY(20px) scale(0.97); }
  }
  @keyframes eqFloatC {
    0%, 100% { transform: translateY(0)     scale(1);    }
    50%       { transform: translateY(-15px) scale(1.02); }
  }
  /* ── Legacy keyframes (kept for backward compat) ── */
  @keyframes eq-scan-line {
    0%   { top: 0%;   opacity: 0; }
    5%   { opacity: 1; }
    95%  { opacity: 1; }
    100% { top: 100%; opacity: 0; }
  }
  @keyframes eq-float {
    0%, 100% { transform: translateY(0)    scale(1);    opacity: 0.18; }
    50%       { transform: translateY(-18px) scale(1.25); opacity: 0.42; }
  }
  @keyframes eq-glow-light {
    0%, 100% { box-shadow: 0 0 6px  rgba(5,150,105,0.18); }
    50%       { box-shadow: 0 0 18px rgba(5,150,105,0.38), 0 0 36px rgba(5,150,105,0.1); }
  }
  @keyframes eq-shimmer {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(300%); }
  }
  @keyframes eq-row-in {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes eq-fade-up {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes eq-kpi-count {
    from { opacity: 0; transform: translateY(8px) scale(0.9); }
    to   { opacity: 1; transform: translateY(0)   scale(1);   }
  }
  @keyframes eq-bar-glow {
    0%, 100% { filter: brightness(1); }
    50%       { filter: brightness(1.2) drop-shadow(0 0 5px rgba(5,150,105,0.5)); }
  }
  @keyframes eq-dot-wave {
    0%, 100% { transform: scaleY(0.5); opacity: 0.4; }
    50%       { transform: scaleY(1.5); opacity: 1; }
  }
  @keyframes eq-spin-slow {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes eq-pulse-badge {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.55; }
  }
  @keyframes eq-fs-in {
    from { opacity: 0; transform: scale(0.98); }
    to   { opacity: 1; transform: scale(1); }
  }
  .eq-fullscreen-wrap {
    position: fixed; inset: 0; z-index: 9990;
    overflow-y: auto;
    animation: eq-fs-in 0.2s ease both;
  }
  /* ── CSS utility classes ── */
  .eq-scan-line {
    position: absolute; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, transparent, rgba(5,150,105,0.45), transparent);
    animation: eq-scan-line 3s ease-in-out infinite;
    pointer-events: none;
  }
  .eq-particle {
    position: absolute; border-radius: 50%;
    background: rgba(5,150,105,0.30);
    animation: eq-float ease-in-out infinite;
  }
  .eq-row-animate       { animation: eq-row-in 0.3s ease forwards; opacity: 0; }
  .eq-section           { animation: eq-fade-up 0.5s ease both; }
  .eq-filter-input::placeholder { color: #94a3b8; }
  .eq-th-sticky         { position: sticky; top: 0; z-index: 10; }
  .eq-upload-zone:hover { border-color: rgba(5,150,105,0.55) !important; background: rgba(5,150,105,0.06) !important; }
  .eq-action-btn:hover:not(:disabled) { box-shadow: 0 6px 24px rgba(5,150,105,0.42) !important; transform: translateY(-1px); }
  .eq-export-btn:hover  { background: rgba(5,150,105,0.14) !important; border-color: rgba(5,150,105,0.4) !important; }
  .eq-kpi-card          { animation: eq-kpi-count 0.45s ease both; }
  .eq-info-card:hover   { border-color: rgba(5,150,105,0.28) !important; background: rgba(5,150,105,0.03) !important; }
  .eq-chip              { animation: eqChipPop 0.4s ease both; }
  .eq-kpi-node          { animation: eqNodeGlow 2.6s ease infinite; }
`;

// SOFT-CODED: visual theme constants for EquipmentList — colours, gradients, decoration
const EQ_T = {
  bg:      'linear-gradient(145deg, #f0fdf4 0%, #ecfdf5 40%, #f1f5f9 100%)',
  gridDot: 'radial-gradient(circle, rgba(5,150,105,0.06) 1px, transparent 1px)',
  gradBar: 'linear-gradient(90deg,#059669,#047857,#10b981,#34d399,#059669)',
  blobs: [
    { color:'rgba(5,150,105,0.09)',  size:'560px', top:'-80px',    left:'10%',    anim:'eqFloatA 14s ease-in-out infinite'     },
    { color:'rgba(5,150,105,0.06)',  size:'440px', top:'30%',      right:'-60px', anim:'eqFloatB 17s ease-in-out infinite'     },
    { color:'rgba(16,185,129,0.07)', size:'380px', bottom:'-60px', left:'35%',    anim:'eqFloatC 12s ease-in-out infinite'     },
    { color:'rgba(5,150,105,0.05)',  size:'300px', top:'55%',      left:'-50px',  anim:'eqFloatA 10s ease-in-out infinite 3s'  },
  ],
  electrons: ['#059669', '#10b981', '#6ee7b7'],  // A / B / C orbit colours
  // Capability chips in hero section
  chips: [
    { icon:'🏷️', label:'Equipment Tags'     },
    { icon:'🌡️', label:'Process Conditions'  },
    { icon:'🧱', label:'MOC & Insulation'   },
    { icon:'📐', label:'Dimensions'         },
    { icon:'⚡', label:'Motor Rating'       },
    { icon:'📋', label:'P&ID Reference'     },
  ],
  // Stream dots for right-side SVG decoration
  streamDots: [
    { top:'22%', delay:'0s',   dur:'3.0s', color:'#059669' },
    { top:'22%', delay:'1.0s', dur:'3.0s', color:'#10b981' },
    { top:'22%', delay:'2.0s', dur:'3.0s', color:'#6ee7b7' },
    { top:'62%', delay:'0.5s', dur:'2.7s', color:'#047857' },
    { top:'62%', delay:'1.5s', dur:'2.7s', color:'#059669' },
  ],
};

// ---------------------------------------------------------------------------
const EquipmentList = () => {
  const [files,          setFiles]          = useState([]);
  const [isProcessing,   setIsProcessing]   = useState(false);
  const [progress,       setProgress]       = useState(0);
  const [statusMessage,  setStatusMessage]  = useState('');
  const [results,        setResults]        = useState(null);
  const [debugInfo,      setDebugInfo]      = useState(null);
  const [error,          setError]          = useState(null);
  const [sortCol,        setSortCol]        = useState('tag');
  const [sortAsc,        setSortAsc]        = useState(true);
  const [filterText,     setFilterText]     = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isDragging,     setIsDragging]     = useState(false);
  const [manualObs,      setManualObs]      = useState([{ ...MANUAL_OBS_BLANK }]);
  const [showManualForm, setShowManualForm] = useState(false);
  const [selectedRows,   setSelectedRows]   = useState(new Set());
  const [isFullscreen,   setIsFullscreen]   = useState(false);

  const fileRef      = useRef(null);
  const pollTimerRef = useRef(null);
  const pollStartRef = useRef(null);
  const elapsedRef   = useRef(null);

  // Elapsed timer
  useEffect(() => {
    if (isProcessing) {
      setElapsedSeconds(0);
      elapsedRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    } else {
      clearInterval(elapsedRef.current);
    }
    return () => clearInterval(elapsedRef.current);
  }, [isProcessing]);

  const formatElapsed = (s) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;

  // Manual observation helpers
  const handleManualFieldChange = (rowIdx, field, value) => {
    setManualObs(prev => prev.map((r, i) => i === rowIdx ? { ...r, [field]: value } : r));
  };

  const handleAddManualRow = () => {
    setManualObs(prev => [...prev, { ...MANUAL_OBS_BLANK }]);
  };

  const handleRemoveManualRow = (rowIdx) => {
    setManualObs(prev => prev.length === 1 ? [{ ...MANUAL_OBS_BLANK }] : prev.filter((_, i) => i !== rowIdx));
  };

  /** Merge manual observations into results — appends non-empty tag rows */
  const handleAddManualToResults = () => {
    const valid = manualObs.filter(r => r.tag && r.tag.trim());
    if (!valid.length) return;
    const injected = valid.map((r, i) => ({ ...r, sl_no: (results?.equipment?.length || 0) + i + 1, _manual: true }));
    if (results) {
      setResults(prev => ({
        ...prev,
        equipment: [...(prev.equipment || []), ...injected],
        total: (prev.total || 0) + injected.length,
      }));
    } else {
      // No AI results yet — create a synthetic result set from manual entries only
      setResults({ equipment: injected, total: injected.length, drawing_ref: 'Manual Entry' });
    }
    setManualObs([{ ...MANUAL_OBS_BLANK }]);
    setShowManualForm(false);
  };

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
    if (!selected.length) { setError('Please select valid PDF file(s)'); return; }
    setFiles(selected);
    setError(null);
    setResults(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isProcessing) setIsDragging(true);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isProcessing) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isProcessing) return;
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    if (!dropped.length) { setError('Please drop valid PDF file(s)'); return; }
    setFiles(dropped);
    setError(null);
    setResults(null);
  };

  // Polling - used when server returns 202 + upload_id
  const pollStatus = useCallback((uploadId) => {
    if (Date.now() - pollStartRef.current > POLL_MAX_WAIT_MS) {
      clearTimeout(pollTimerRef.current);
      setError('Extraction timed out — please try again.');
      setIsProcessing(false);
      return;
    }
    apiClient
      .get(`/pid/equipment/status/${uploadId}/`, { timeout: POLL_REQ_TIMEOUT })
      .then(({ data }) => {
        const s = data.status;
        setProgress(data.progress || 0);
        setStatusMessage(data.message || 'Processing…');
        if (s === 'completed') {
          clearTimeout(pollTimerRef.current);
          apiClient.get(`/pid/equipment/results/${uploadId}/`)
            .then(({ data: r }) => {
              setResults({ equipment: r.equipment, total: r.total, drawing_ref: r.drawing_ref, upload_id: uploadId });
              setSelectedRows(new Set());
              setProgress(100);
              setStatusMessage('Extraction complete!');
              setIsProcessing(false);
            })
            .catch(() => {
              setError('Failed to load results. Please try again.');
              setIsProcessing(false);
            });
        } else if (s === 'failed') {
          clearTimeout(pollTimerRef.current);
          setError(data.message || 'Extraction failed on the server.');
          setIsProcessing(false);
        } else {
          pollTimerRef.current = setTimeout(() => pollStatus(uploadId), POLL_INTERVAL_MS);
        }
      })
      .catch(() => {
        pollTimerRef.current = setTimeout(() => pollStatus(uploadId), POLL_INTERVAL_MS * 2);
      });
  }, []);

  const handleExtract = async () => {
    if (!files.length) { setError('Please upload a P&ID document first'); return; }
    setIsProcessing(true);
    setError(null);
    setResults(null);
    setDebugInfo(null);
    setProgress(0);

    const isBatch   = files.length > 1;
    const uploadUrl = isBatch
      ? `${API_BASE}/pid/equipment/analyze-batch/`
      : `${API_BASE}/pid/equipment/analyze/`;

    setStatusMessage(
      isBatch ? `Uploading ${files.length} P&ID file(s)…` : 'Uploading P&ID…'
    );

    // Build FormData — single file uses field 'file'; batch uses 'file_0', 'file_1'…
    const formData = new FormData();
    if (isBatch) {
      files.forEach((f, i) => formData.append(`file_${i}`, f));
    } else {
      formData.append('file', files[0]);
    }

    const token   = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    let lastErr   = null;

    for (let attempt = 1; attempt <= MAX_POST_RETRIES; attempt++) {
      if (attempt > 1) {
        const delay = POST_RETRY_BASE_MS * Math.pow(2, attempt - 2);
        setStatusMessage(`Retrying (attempt ${attempt}/${MAX_POST_RETRIES})…`);
        await new Promise(r => setTimeout(r, delay));
      }
      setStatusMessage(
        attempt === 1
          ? (isBatch ? `Uploading ${files.length} P&ID file(s)…` : 'Uploading P&ID…')
          : `Sending (attempt ${attempt}/${MAX_POST_RETRIES})…`
      );

      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

      try {
        const resp = await fetch(uploadUrl, {
          method:  'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body:    formData,
          signal:  controller.signal,
        });
        clearTimeout(abortTimer);

        if (!resp.ok) {
          let detail = `HTTP ${resp.status}`;
          try { detail = (await resp.json()).error || detail; } catch (_) {}
          throw Object.assign(new Error(detail), { isHttpError: true });
        }

        const data = await resp.json();

        // Synchronous result (HTTP 200)
        if (data.success && data.equipment !== undefined) {
          setResults({ equipment: data.equipment, total: data.total, drawing_ref: data.drawing_ref, upload_id: data.upload_id });
          setSelectedRows(new Set());
          if (data.debug_info) setDebugInfo(data.debug_info);
          setProgress(100);
          setStatusMessage('Extraction complete!');
          setIsProcessing(false);
          return;
        }

        // Async result (HTTP 202 + upload_id)
        if (data.upload_id) {
          setStatusMessage(
            isBatch
              ? `Processing ${files.length} P&ID file(s) in background…`
              : 'Processing in background…'
          );
          pollStartRef.current = Date.now();
          pollStatus(data.upload_id);
          return;
        }

        throw new Error('Unexpected server response format.');

      } catch (err) {
        clearTimeout(abortTimer);
        lastErr = err;
        const retryable = err.name === 'AbortError' || (err instanceof TypeError && err.message.includes('fetch'));
        if (!retryable || attempt === MAX_POST_RETRIES) break;
      }
    }

    setError(
      lastErr?.name === 'AbortError'
        ? `Upload timed out after ${Math.round(UPLOAD_TIMEOUT_MS / 1000)}s. Please try again.`
        : lastErr?.message || 'Extraction failed — please try again.'
    );
    setIsProcessing(false);
  };

  // Sorted + filtered rows
  const displayRows = React.useMemo(() => {
    if (!results?.equipment) return [];
    let rows = [...results.equipment];

    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      rows = rows.filter(r =>
        COLUMNS.some(c => {
          const v = r[c.key];
          if (Array.isArray(v)) return v.some(s => String(s).toLowerCase().includes(q));
          return String(v || '').toLowerCase().includes(q);
        })
      );
    }

    rows.sort((a, b) => {
      let va = a[sortCol] ?? '';
      let vb = b[sortCol] ?? '';
      if (Array.isArray(va)) va = va.join(',');
      if (Array.isArray(vb)) vb = vb.join(',');
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      return sortAsc ? cmp : -cmp;
    });

    return rows;
  }, [results, sortCol, sortAsc, filterText]);

  const handleSort = (key) => {
    if (sortCol === key) setSortAsc(a => !a);
    else { setSortCol(key); setSortAsc(true); }
  };

  const getRowKey = (row, idx) => (row.tag && row.tag.trim() && row.tag !== '—' ? row.tag : `row-${idx}`);

  const handleSelectRow = (key) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedRows.size === displayRows.length && displayRows.length > 0) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(displayRows.map((row, idx) => getRowKey(row, idx))));
    }
  };

  const handleExportSelected = () => {
    const rowsToExport = displayRows.filter((row, idx) => selectedRows.has(getRowKey(row, idx)));
    if (!rowsToExport.length) return;
    const wsData = [
      COLUMNS.map(c => c.label),
      ...rowsToExport.map((row, idx) =>
        COLUMNS.map(c => {
          const v = c.key === 'sl_no' ? idx + 1 : row[c.key];
          if (Array.isArray(v)) return v.join(', ') || '—';
          return v || '—';
        })
      ),
    ];
    const ws    = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = COLUMNS.map(c => ({ wch: c.width || 18 }));
    const wb    = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Equipment List');
    XLSX.writeFile(wb, EXPORT_FILENAME_SELECTED);
  };

  const handleExport = () => {
    if (!displayRows.length) return;
    const wsData = [
      COLUMNS.map(c => c.label),
      ...displayRows.map((row, idx) =>
        COLUMNS.map(c => {
          // sl_no: always sequential 1-based index regardless of backend value
          const v = c.key === 'sl_no' ? idx + 1 : row[c.key];
          if (Array.isArray(v)) return v.join(', ') || '—';
          return v || '—';
        })
      ),
    ];
    const ws    = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = COLUMNS.map(c => ({ wch: c.width || 18 }));
    const wb    = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Equipment List');
    XLSX.writeFile(wb, EXPORT_FILENAME);
  };

  // ── Derived stats for KPI bar (shown after extraction) ──────────────────
  const kpiStats = React.useMemo(() => {
    if (!results?.equipment?.length) return null;
    const eq = results.equipment;
    const filled  = f => eq.filter(r => r[f] && r[f] !== '—' && r[f] !== '').length;
    const types   = [...new Set(eq.map(r => (r.tag || '').split('-')[0]).filter(Boolean))];
    const withMtr = eq.filter(r => r.motor_rating && !['No','N/A','no','n/a'].includes(String(r.motor_rating).trim())).length;
    return {
      total:    eq.length,
      types:    types.length,
      withMoc:  filled('moc'),
      withMtr,
      withDim:  filled('dimension_length'),
      drawings: results?.drawing_ref
        ? results.drawing_ref.split(',').map(s => s.trim()).filter(Boolean).length
        : 1,
    };
  }, [results]);

  return (
    <>
      <style>{EQ_KEYFRAMES}</style>

      {/* ── Full-page background — wraps in fixed overlay when fullscreen ── */}
      <div
        className={`min-h-screen relative overflow-x-hidden${isFullscreen ? ' eq-fullscreen-wrap' : ''}`}
        style={{ background: EQ_T.bg }}
      >

        {/* Fine dot grid */}
        <div className="fixed inset-0 pointer-events-none"
          style={{ backgroundImage: EQ_T.gridDot, backgroundSize:'44px 44px' }} />

        {/* Ambient gradient blobs */}
        {EQ_T.blobs.map((b, i) => (
          <div key={i} className="absolute rounded-full pointer-events-none"
            style={{ width:b.size, height:b.size, top:b.top, bottom:b.bottom, left:b.left, right:b.right,
              background:`radial-gradient(circle, ${b.color} 0%, transparent 70%)`, animation:b.anim }} />
        ))}

        {/* Right-side animated SVG pipe decoration */}
        <div className="absolute right-0 top-0 bottom-0 w-52 pointer-events-none overflow-hidden opacity-25 hidden xl:block">
          <svg width="208" height="100%" viewBox="0 0 208 800" preserveAspectRatio="none"
            fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="0" y1="176" x2="208" y2="176" stroke="#059669" strokeWidth="2.5"
              strokeDasharray="12 8" style={{ animation:'eqPipeFlow 2.4s linear infinite' }} />
            <line x1="0" y1="496" x2="208" y2="496" stroke="#047857" strokeWidth="2.5"
              strokeDasharray="12 8" style={{ animation:'eqPipeFlow 2.8s linear infinite 0.4s' }} />
            <line x1="104" y1="176" x2="104" y2="496" stroke="#10b981" strokeWidth="1.5"
              strokeDasharray="8 10" style={{ animation:'eqPipeFlow 3.2s linear infinite 0.8s' }} />
            <rect x="32"  y="154" width="40" height="44" rx="5" fill="rgba(5,150,105,0.12)" stroke="#059669" strokeWidth="1.5"/>
            <rect x="136" y="154" width="40" height="44" rx="5" fill="rgba(4,120,87,0.10)"  stroke="#047857" strokeWidth="1.5"/>
            <rect x="84"  y="474" width="40" height="44" rx="5" fill="rgba(16,185,129,0.10)" stroke="#10b981" strokeWidth="1.5"/>
            <text x="43"  y="180" fill="#059669" fontSize="8" fontFamily="monospace" fontWeight="700">V-101</text>
            <text x="147" y="180" fill="#047857" fontSize="8" fontFamily="monospace" fontWeight="700">E-201</text>
            <text x="91"  y="500" fill="#10b981" fontSize="8" fontFamily="monospace" fontWeight="700">P-301</text>
            <text x="4"   y="170" fill="#059669" fontSize="7" fontFamily="monospace" opacity="0.65">S-01</text>
            <text x="4"   y="490" fill="#047857" fontSize="7" fontFamily="monospace" opacity="0.65">S-03</text>
          </svg>
          {EQ_T.streamDots.map((d, i) => (
            <div key={i} className="absolute w-2 h-2 rounded-full pointer-events-none"
              style={{ top: d.top, left: 0, background: d.color,
                boxShadow: `0 0 5px ${d.color}`, animation: `eqStreamDot ${d.dur} linear infinite ${d.delay}` }} />
          ))}
        </div>

        {/* Animated top gradient bar */}
        <div className="absolute inset-x-0 top-0 h-[3px] pointer-events-none"
          style={{ backgroundImage: EQ_T.gradBar, backgroundSize:'300% auto', animation:'eqGradShift 3s linear infinite' }} />

        <div className="relative z-10">

          {/* ── Centered content wrapper ── */}
          <div
            className="mx-auto"
            style={{
              maxWidth: isFullscreen ? LAYOUT_CONFIG.fullscreenMaxWidth : LAYOUT_CONFIG.normalMaxWidth,
              padding:  `${isFullscreen ? LAYOUT_CONFIG.fullscreenPaddingY : LAYOUT_CONFIG.normalPaddingY} ${isFullscreen ? LAYOUT_CONFIG.fullscreenPaddingX : LAYOUT_CONFIG.normalPaddingX}`,
            }}
          >

          {/* ── Hero Header ── */}
          <div className="mb-10 eq-section relative" style={{ animationDelay: '0s' }}>

            {/* Rule ring decoration (right side, desktop only) */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 hidden xl:block pointer-events-none" style={{ opacity: 0.20 }}>
              <svg width="172" height="172" viewBox="0 0 172 172" fill="none">
                <circle cx="86" cy="86" r="76" stroke="url(#eqRingGradOuter)" strokeWidth="1.5" strokeDasharray="4 7"
                  style={{ animation: 'eq-spin-slow 24s linear infinite' }} />
                <circle cx="86" cy="86" r="50" stroke="url(#eqRingGradInner)" strokeWidth="1" strokeDasharray="3 9"
                  style={{ animation: 'eqSpinSlowRev 16s linear infinite' }} />
                {Array.from({ length: 12 }, (_, i) => {
                  const ang = (i * 30 * Math.PI) / 180;
                  const x = 86 + 76 * Math.cos(ang);
                  const y = 86 + 76 * Math.sin(ang);
                  return <circle key={i} cx={x} cy={y} r="2.5" fill="#059669" opacity="0.8" />;
                })}
                <defs>
                  <linearGradient id="eqRingGradOuter" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#059669" /><stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                  <linearGradient id="eqRingGradInner" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#047857" /><stop offset="100%" stopColor="#34d399" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* Badge pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-4 eq-chip" style={{
              background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.22)', animationDelay: '0.04s',
            }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" style={{ animation: 'eq-pulse-badge 2s ease infinite' }} />
              <span className="text-emerald-700 text-xs font-semibold tracking-widest uppercase">AI-Powered · P&amp;ID Analysis</span>
            </div>

            {/* Title + Fullscreen toggle */}
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-4xl font-bold text-slate-900 flex items-center gap-4 mb-3">
                <div className="p-2.5 rounded-xl relative overflow-hidden flex-shrink-0" style={{
                  background: 'linear-gradient(135deg, rgba(5,150,105,0.12) 0%, rgba(16,185,129,0.07) 100%)',
                  border: '1px solid rgba(5,150,105,0.22)',
                  animation: 'eq-glow-light 3s ease infinite',
                }}>
                  <Boxes className="h-7 w-7 text-emerald-600" />
                </div>
                Equipment&nbsp;
                <span style={{
                  background: 'linear-gradient(135deg, #059669 0%, #047857 60%, #10b981 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>List</span>
              </h1>

              {/* Fullscreen toggle — layout-only control, no core logic */}
              <button
                onClick={() => setIsFullscreen(fs => !fs)}
                title={isFullscreen ? 'Exit fullscreen' : 'Expand to fullscreen'}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold flex-shrink-0"
                style={{
                  background: isFullscreen ? 'rgba(5,150,105,0.14)' : 'rgba(5,150,105,0.07)',
                  border: '1px solid rgba(5,150,105,0.22)',
                  color: '#065f46',
                  transition: 'all 0.2s',
                }}
              >
                {isFullscreen
                  ? <><ArrowsPointingInIcon className="h-4 w-4" /> Exit Fullscreen</>
                  : <><ArrowsPointingOutIcon className="h-4 w-4" /> Fullscreen</>
                }
              </button>
            </div>

            {/* Description */}
            <p className="text-slate-500 text-base leading-relaxed max-w-2xl mb-6">
              Extract 18 engineering fields from Equipment List registers or P&amp;ID drawings using AI — Tag No., Description, Operating &amp; Design Conditions, MOC, Insulation, Dimensions, Motor Rating, P&amp;ID Ref and more
            </p>

            {/* Capability chips */}
            <div className="flex flex-wrap gap-2 mb-5">
              {EQ_T.chips.map((chip, i) => (
                <span key={chip.label} className="eq-chip inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{
                    background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.18)',
                    color: '#065f46', animationDelay: `${0.08 + i * 0.06}s`,
                  }}>
                  <span>{chip.icon}</span><span>{chip.label}</span>
                </span>
              ))}
            </div>

            {/* Workflow steps */}
            <div className="flex flex-wrap gap-3">
              {[
                { n:'01', label:'Upload PDF',       desc:'P&ID drawing or Equipment Register',  icon:'📄' },
                { n:'02', label:'AI Extraction',    desc:'18-field OCR + rule engine',            icon:'🤖' },
                { n:'03', label:'Selection Record', desc:'Review & confirm extracted rows',       icon:'☑️'  },
                { n:'04', label:'Download Excel',   desc:'Structured register ready to use',      icon:'📊' },
              ].map((step, i) => (
                <div key={step.n} className="eq-chip flex items-center gap-2.5 px-4 py-2.5 rounded-xl"
                  style={{
                    background: 'white',
                    border: '1px solid rgba(5,150,105,0.12)',
                    boxShadow: '0 1px 4px rgba(5,150,105,0.06)',
                    animationDelay: `${0.45 + i * 0.07}s`,
                  }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                    style={{ background: 'linear-gradient(135deg,#059669,#047857)' }}>
                    {step.n}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700 leading-none mb-0.5">{step.label}</p>
                    <p className="text-[10px] text-slate-400 leading-none">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Upload Card ── */}
          <div className="rounded-2xl p-6 mb-4 eq-section" style={{
            background: 'white',
            border: '1px solid rgba(5,150,105,0.15)',
            boxShadow: '0 4px 28px rgba(5,150,105,0.09), 0 1px 4px rgba(0,0,0,0.04)',
            animationDelay: '0.08s',
          }}>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                boxShadow: '0 2px 8px rgba(5,150,105,0.35)',
              }}>1</div>
              <h2 className="text-sm font-semibold text-slate-700 tracking-wide">Upload P&amp;ID Document</h2>
              <span className="ml-auto text-xs text-slate-400 font-medium px-2.5 py-1 rounded-full" style={{
                background: '#f8fafc', border: '1px solid #e2e8f0',
              }}>PDF only</span>
            </div>

            {/* ── AI Document Assist (Wrench) — soft-coded, optional ─────── */}
            {EL_AI_ASSIST_CONFIG.enabled && (
              <div className="mb-5">
                <WrenchAiDocAssist
                  title={EL_AI_ASSIST_CONFIG.title}
                  subtitleTag={EL_AI_ASSIST_CONFIG.subtitleTag}
                  subtitle={EL_AI_ASSIST_CONFIG.subtitle}
                  defaultHint={EL_AI_ASSIST_CONFIG.defaultHint}
                  hintPlaceholder={EL_AI_ASSIST_CONFIG.hintPlaceholder}
                  topN={EL_AI_ASSIST_CONFIG.topN}
                  acceptedExts={EL_AI_ASSIST_CONFIG.acceptedExts}
                  projectName=""
                  onFileSelected={(f) => {
                    // Append (dedupe by name+size) to support multi-PDF workflow
                    setFiles(prev => {
                      const key = `${f.name}|${f.size}`;
                      const has = prev.some(p => `${p.name}|${p.size}` === key);
                      return has ? prev : [...prev, f];
                    });
                    setError(null);
                    setResults(null);
                  }}
                  onError={(msg) => setError(msg)}
                />
              </div>
            )}

            <div
              className="eq-upload-zone relative rounded-xl cursor-pointer overflow-hidden"
              style={{
                border: isDragging ? '2px solid rgba(5,150,105,0.75)' : files.length ? '2px solid rgba(5,150,105,0.5)' : '2px dashed rgba(5,150,105,0.25)',
                background: isDragging ? 'rgba(5,150,105,0.08)' : files.length ? 'rgba(5,150,105,0.04)' : 'rgba(5,150,105,0.015)',
                minHeight: 148,
                transition: 'border-color 0.25s, background 0.25s, box-shadow 0.25s',
              }}
              onClick={() => !isProcessing && fileRef.current?.click()}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* Circuit trace border — top edge */}
              <div className="absolute top-0 left-0 right-0 h-[2px] pointer-events-none"
                style={{ background: 'rgba(5,150,105,0.55)', animation: 'eqTraceH 2.8s ease-in-out infinite' }} />
              {/* Circuit trace border — bottom edge (offset) */}
              <div className="absolute bottom-0 left-0 right-0 h-[2px] pointer-events-none"
                style={{ background: 'rgba(5,150,105,0.40)', animation: 'eqTraceH 2.8s ease-in-out infinite 1.4s' }} />
              {/* Circuit trace border — left edge */}
              <div className="absolute top-0 bottom-0 left-0 w-[2px] pointer-events-none"
                style={{ background: 'rgba(5,150,105,0.45)', animation: 'eqTraceV 2.8s ease-in-out infinite 0.7s' }} />
              {/* Circuit trace border — right edge (offset) */}
              <div className="absolute top-0 bottom-0 right-0 w-[2px] pointer-events-none"
                style={{ background: 'rgba(5,150,105,0.35)', animation: 'eqTraceV 2.8s ease-in-out infinite 2.1s' }} />

              {/* Corner brackets */}
              {[
                'top-0 left-0   border-t-2 border-l-2',
                'top-0 right-0  border-t-2 border-r-2',
                'bottom-0 left-0  border-b-2 border-l-2',
                'bottom-0 right-0 border-b-2 border-r-2',
              ].map((cls, i) => (
                <div key={i} className={`absolute ${cls} w-5 h-5 pointer-events-none`}
                  style={{ borderColor: 'rgba(5,150,105,0.45)' }} />
              ))}

              {/* Scan line (idle only) */}
              {!files.length && !isProcessing && <div className="eq-scan-line" />}

              <input ref={fileRef} type="file" accept=".pdf" multiple onChange={handleFileSelect} className="hidden" />

              <div className="flex flex-col items-center justify-center gap-3 py-9 px-6">
                {files.length > 0 ? (
                  <>
                    <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{
                      background: 'linear-gradient(135deg, rgba(5,150,105,0.15), rgba(5,150,105,0.08))',
                      border: '2px solid rgba(5,150,105,0.4)',
                      animation: 'eq-glow-light 2.2s ease infinite',
                    }}>
                      <CheckCircleIcon className="h-8 w-8 text-emerald-600" />
                    </div>
                    <div className="text-center">
                      {files.length === 1 ? (
                        <>
                          <p className="text-slate-800 font-semibold text-sm">{files[0].name}</p>
                          <p className="text-slate-400 text-xs mt-1">{(files[0].size / 1024 / 1024).toFixed(2)} MB · Ready for extraction</p>
                        </>
                      ) : (
                        <>
                          <p className="text-slate-800 font-semibold text-sm">{files.length} PDF files selected</p>
                          <div className="text-slate-400 text-xs mt-1 max-h-20 overflow-y-auto space-y-0.5">
                            {files.map((f, i) => (
                              <p key={i}>{f.name} &nbsp;<span className="text-slate-300">({(f.size / 1024 / 1024).toFixed(2)} MB)</span></p>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="px-3 py-1 rounded-full text-xs font-semibold text-emerald-700 flex items-center gap-1.5" style={{
                        background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.2)',
                      }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"
                          style={{ animation: 'eq-pulse-badge 1.6s ease infinite' }} />
                        {files.length === 1 ? 'PDF Loaded' : `${files.length} PDFs Loaded`}
                      </div>
                      {!isProcessing && (
                        <button
                          onClick={e => { e.stopPropagation(); setFiles([]); setResults(null); setError(null); }}
                          className="px-2.5 py-1 rounded-full text-xs font-medium text-slate-400 hover:text-red-500"
                          style={{ background: '#f8fafc', border: '1px solid #e2e8f0', transition: 'color 0.2s' }}
                        >✕ Remove</button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{
                      background: 'linear-gradient(135deg, rgba(5,150,105,0.10), rgba(5,150,105,0.04))',
                      border: '1.5px solid rgba(5,150,105,0.20)',
                    }}>
                      <CloudArrowUpIcon className="h-9 w-9 text-emerald-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-slate-700 font-semibold text-sm">Drop a P&amp;ID PDF here <span className="text-slate-400 font-normal">or</span> <span className="text-emerald-600 font-semibold">click to browse</span></p>
                      <p className="text-slate-400 text-xs mt-1.5">Equipment List registers &amp; P&amp;ID drawings · Auto-detects mode · Multi-angle OCR (0°/90°/180°/270°)</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Manual Observation Panel ── */}
          <div className="rounded-2xl mb-4 eq-section overflow-hidden" style={{
            background: 'white',
            border: '1px solid rgba(5,150,105,0.15)',
            boxShadow: '0 4px 24px rgba(5,150,105,0.08), 0 1px 4px rgba(0,0,0,0.04)',
            animationDelay: '0.12s',
          }}>
            {/* Collapsible header */}
            <button
              onClick={() => setShowManualForm(v => !v)}
              className="w-full flex items-center gap-2.5 px-6 py-4"
              style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              }}>2</div>
              <h2 className="text-sm font-semibold text-slate-700 tracking-wide flex-1">
                Manual Observations
                {manualObs.some(r => r.tag?.trim()) && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold text-emerald-700"
                    style={{ background: 'rgba(5,150,105,0.1)', border: '1px solid rgba(5,150,105,0.2)' }}>
                    {manualObs.filter(r => r.tag?.trim()).length} pending
                  </span>
                )}
              </h2>
              <span className="text-slate-400 text-xs font-medium mr-2">Enter equipment data manually from P&amp;ID drawing</span>
              <span className="text-slate-400 text-sm">{showManualForm ? '▲' : '▼'}</span>
            </button>

            {showManualForm && (
              <div className="px-6 pb-5" style={{ borderTop: '1px solid rgba(5,150,105,0.08)' }}>
                {manualObs.map((row, rowIdx) => {
                  const hint = resolveQuantityHint(row.tag);
                  return (
                    <div key={rowIdx} className="mb-5 pt-4" style={{ borderTop: rowIdx > 0 ? '1px dashed rgba(5,150,105,0.15)' : 'none' }}>
                      {rowIdx > 0 && (
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-xs font-semibold text-slate-500">Entry #{rowIdx + 1}</span>
                          <button onClick={() => handleRemoveManualRow(rowIdx)}
                            className="text-xs text-red-400 hover:text-red-600 font-medium px-2 py-0.5 rounded"
                            style={{ background: '#fef2f2', border: '1px solid rgba(239,68,68,0.15)' }}>
                            ✕ Remove
                          </button>
                        </div>
                      )}

                      {/* Row 1: Tag + Description + PID No */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                        {[
                          { field: 'tag',         label: 'Equipment Tag No. *', placeholder: 'e.g. V-803-TF',     mono: true },
                          { field: 'description', label: 'Description',          placeholder: 'e.g. MRD OIL SLUG CATCHER' },
                          { field: 'pid_no',      label: 'P&ID No.',             placeholder: 'e.g. PJ6-EXD-MRI-BQDA-0023' },
                        ].map(({ field, label, placeholder, mono }) => (
                          <div key={field}>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                            <input
                              type="text"
                              value={row[field]}
                              onChange={e => handleManualFieldChange(rowIdx, field, e.target.value)}
                              placeholder={placeholder}
                              className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                              style={{
                                background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155',
                                fontFamily: mono ? 'ui-monospace, SFMono-Regular, monospace' : undefined,
                                transition: 'border-color 0.2s, box-shadow 0.2s',
                              }}
                              onFocus={e => { e.target.style.borderColor='rgba(5,150,105,0.45)'; e.target.style.boxShadow='0 0 0 3px rgba(5,150,105,0.1)'; }}
                              onBlur={e => { e.target.style.borderColor='#e2e8f0'; e.target.style.boxShadow='none'; }}
                            />
                          </div>
                        ))}
                      </div>

                      {/* Row 2: Quantity Required (dynamic label) + Design Flowrate + Phase */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Quantity Required
                            {hint && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded text-xs font-medium text-emerald-700"
                                style={{ background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.18)' }}>
                                {hint.label}
                              </span>
                            )}
                          </label>
                          <input
                            type="text"
                            value={row.quality_required}
                            onChange={e => handleManualFieldChange(rowIdx, 'quality_required', e.target.value)}
                            placeholder={hint ? hint.placeholder : 'e.g. 327 M³'}
                            className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                            style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', transition: 'border-color 0.2s, box-shadow 0.2s' }}
                            onFocus={e => { e.target.style.borderColor='rgba(5,150,105,0.45)'; e.target.style.boxShadow='0 0 0 3px rgba(5,150,105,0.1)'; }}
                            onBlur={e => { e.target.style.borderColor='#e2e8f0'; e.target.style.boxShadow='none'; }}
                          />
                        </div>
                        {[
                          { field: 'design_flowrate',  label: 'Design Flowrate / Duty', placeholder: 'e.g. 2.5 MMBtu/hr' },
                          { field: 'phase',             label: 'Phase',                  placeholder: 'e.g. Liquid / Gas / Mixed' },
                        ].map(({ field, label, placeholder }) => (
                          <div key={field}>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                            <input
                              type="text"
                              value={row[field]}
                              onChange={e => handleManualFieldChange(rowIdx, field, e.target.value)}
                              placeholder={placeholder}
                              className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', transition: 'border-color 0.2s, box-shadow 0.2s' }}
                              onFocus={e => { e.target.style.borderColor='rgba(5,150,105,0.45)'; e.target.style.boxShadow='0 0 0 3px rgba(5,150,105,0.1)'; }}
                              onBlur={e => { e.target.style.borderColor='#e2e8f0'; e.target.style.boxShadow='none'; }}
                            />
                          </div>
                        ))}
                      </div>

                      {/* Row 3: Operating conditions */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                        {[
                          { field: 'oper_pressure',       label: 'Oper. Pressure (PSIG)',      placeholder: 'e.g. 150' },
                          { field: 'oper_temperature',    label: 'Oper. Temp. (°F)',            placeholder: 'e.g. 105/60' },
                          { field: 'design_pressure_min', label: 'Des. Press. Min (PSIG)',      placeholder: 'e.g. FV' },
                          { field: 'design_pressure_max', label: 'Des. Press. Max (PSIG)',      placeholder: 'e.g. 195' },
                        ].map(({ field, label, placeholder }) => (
                          <div key={field}>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                            <input type="text" value={row[field]} onChange={e => handleManualFieldChange(rowIdx, field, e.target.value)}
                              placeholder={placeholder} className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', transition: 'border-color 0.2s, box-shadow 0.2s' }}
                              onFocus={e => { e.target.style.borderColor='rgba(5,150,105,0.45)'; e.target.style.boxShadow='0 0 0 3px rgba(5,150,105,0.1)'; }}
                              onBlur={e => { e.target.style.borderColor='#e2e8f0'; e.target.style.boxShadow='none'; }}
                            />
                          </div>
                        ))}
                      </div>

                      {/* Row 4: Design temps + MOC + Insulation + Dimensions */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                        {[
                          { field: 'design_temp_min',    label: 'Des. Temp. Min (°F)',   placeholder: 'e.g. -13.2' },
                          { field: 'design_temp_max',    label: 'Des. Temp. Max (°F)',   placeholder: 'e.g. 185' },
                          { field: 'moc',                label: 'MOC',                   placeholder: 'e.g. CS + LINING' },
                          { field: 'insulation',         label: 'Insulation',            placeholder: 'e.g. HOT' },
                        ].map(({ field, label, placeholder }) => (
                          <div key={field}>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                            <input type="text" value={row[field]} onChange={e => handleManualFieldChange(rowIdx, field, e.target.value)}
                              placeholder={placeholder} className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', transition: 'border-color 0.2s, box-shadow 0.2s' }}
                              onFocus={e => { e.target.style.borderColor='rgba(5,150,105,0.45)'; e.target.style.boxShadow='0 0 0 3px rgba(5,150,105,0.1)'; }}
                              onBlur={e => { e.target.style.borderColor='#e2e8f0'; e.target.style.boxShadow='none'; }}
                            />
                          </div>
                        ))}
                      </div>

                      {/* Row 5: Dimensions + Motor + Revision + Remarks */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { field: 'dimension_length',   label: 'Length / Height (mm)',  placeholder: 'e.g. 15000' },
                          { field: 'dimension_diameter', label: 'Diameter / Width (mm)', placeholder: 'e.g. 5000' },
                          { field: 'motor_rating',       label: 'Motor Rating (kW)',      placeholder: 'e.g. N/A' },
                          { field: 'revision',           label: 'Rev.',                   placeholder: 'e.g. 1' },
                        ].map(({ field, label, placeholder }) => (
                          <div key={field}>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                            <input type="text" value={row[field]} onChange={e => handleManualFieldChange(rowIdx, field, e.target.value)}
                              placeholder={placeholder} className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', transition: 'border-color 0.2s, box-shadow 0.2s' }}
                              onFocus={e => { e.target.style.borderColor='rgba(5,150,105,0.45)'; e.target.style.boxShadow='0 0 0 3px rgba(5,150,105,0.1)'; }}
                              onBlur={e => { e.target.style.borderColor='#e2e8f0'; e.target.style.boxShadow='none'; }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Form action buttons */}
                <div className="flex items-center gap-3 mt-4 pt-4" style={{ borderTop: '1px solid rgba(5,150,105,0.1)' }}>
                  <button onClick={handleAddManualRow}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-emerald-700"
                    style={{ background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.2)', cursor: 'pointer' }}>
                    + Add Another Entry
                  </button>
                  <button
                    onClick={handleAddManualToResults}
                    disabled={!manualObs.some(r => r.tag?.trim())}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white"
                    style={manualObs.some(r => r.tag?.trim()) ? {
                      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                      border: 'none', cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(5,150,105,0.32)',
                    } : {
                      background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0', cursor: 'not-allowed',
                    }}
                  >
                    ✓ Add to Equipment List
                  </button>
                  <button onClick={() => { setManualObs([{ ...MANUAL_OBS_BLANK }]); setShowManualForm(false); }}
                    className="ml-auto text-xs text-slate-400 hover:text-slate-600 px-3 py-1.5 rounded-lg font-medium"
                    style={{ background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Action Buttons ── */}
          <div className="flex gap-3 mb-6 eq-section" style={{ animationDelay: '0.15s' }}>
            <button
              onClick={handleExtract}
              disabled={!files.length || isProcessing}
              className="eq-action-btn flex-1 py-3.5 px-6 rounded-xl font-semibold text-sm relative overflow-hidden"
              style={!files.length || isProcessing ? {
                background: '#f1f5f9',
                color: '#94a3b8',
                cursor: 'not-allowed',
                border: '1px solid #e2e8f0',
                transition: 'all 0.25s',
              } : {
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: 'white',
                border: 'none',
                boxShadow: '0 4px 18px rgba(5,150,105,0.32)',
                transition: 'all 0.25s',
                cursor: 'pointer',
              }}
            >
              {/* Shimmer on active */}
              {files.length > 0 && !isProcessing && (
                <div className="absolute inset-0 pointer-events-none" style={{
                  background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)',
                  animation: 'eq-shimmer 2.8s linear infinite',
                }} />
              )}
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2.5">
                  <svg className="h-5 w-5 text-emerald-600" viewBox="0 0 24 24"
                    style={{ animation: 'eq-spin-slow 1.2s linear infinite' }}>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-slate-500">Extracting…</span>
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2 relative z-10">
                  <span className="text-base">⚡</span>
                  <span>Extract Equipment List</span>
                  {files.length > 0 && <span className="ml-1 text-emerald-200 text-xs font-normal opacity-80">→ AI-powered</span>}
                </span>
              )}
            </button>

            {results && (
              <>
                {selectedRows.size > 0 && (
                  <button
                    onClick={handleExportSelected}
                    className="eq-export-btn flex items-center gap-2 px-5 py-3.5 rounded-xl font-semibold text-sm"
                    style={{
                      background: 'rgba(5,150,105,0.12)',
                      color: '#065f46',
                      border: '1px solid rgba(5,150,105,0.35)',
                      boxShadow: '0 2px 8px rgba(5,150,105,0.12)',
                      transition: 'all 0.2s',
                      cursor: 'pointer',
                    }}
                  >
                    <ArrowDownTrayIcon className="h-4 w-4" />
                    Download Selected
                    <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold text-white"
                      style={{ background: '#059669' }}>
                      {selectedRows.size}
                    </span>
                  </button>
                )}
                <button
                  onClick={handleExport}
                  className="eq-export-btn flex items-center gap-2 px-5 py-3.5 rounded-xl font-semibold text-sm"
                  style={{
                    background: 'rgba(5,150,105,0.07)',
                    color: '#065f46',
                    border: '1px solid rgba(5,150,105,0.22)',
                    boxShadow: '0 2px 8px rgba(5,150,105,0.08)',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                  }}
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  Download Excel
                </button>
              </>
            )}
          </div>

          {/* ── Progress ── */}
          {isProcessing && (
            <div className="rounded-2xl overflow-hidden mb-4" style={{
              background: 'white',
              border: '1px solid rgba(5,150,105,0.20)',
              boxShadow: '0 4px 24px rgba(5,150,105,0.10)',
              animation: 'eq-fade-up 0.35s ease forwards',
            }}>
              {/* Gradient top strip */}
              <div className="h-[3px]" style={{
                backgroundImage: EQ_T.gradBar, backgroundSize:'300% auto',
                animation: 'eqGradShift 2.5s linear infinite',
              }} />

              <div className="p-5">
                <div className="flex items-start gap-5 mb-4">
                  {/* Orbit electron AI loader */}
                  <div className="relative flex-shrink-0 w-14 h-14" style={{ marginTop: '2px' }}>
                    {/* Orbit ring */}
                    <div className="absolute inset-0 rounded-full border border-dashed pointer-events-none"
                      style={{ borderColor: 'rgba(5,150,105,0.18)' }} />
                    {/* Core glow */}
                    <div className="absolute inset-[14px] rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(5,150,105,0.09)', animation: 'eq-glow-light 1.8s ease infinite' }}>
                      <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="1.5" style={{ animation: 'eq-spin-slow 6s linear infinite' }}>
                        <path d="M12 2a10 10 0 1 0 10 10" strokeLinecap="round"/>
                        <path d="M12 6v6l3 3" strokeLinecap="round"/>
                      </svg>
                    </div>
                    {/* Orbit electrons A / B / C */}
                    {EQ_T.electrons.map((color, i) => (
                      <div key={i} className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-2 h-2 rounded-full" style={{
                          background: color,
                          boxShadow: `0 0 6px ${color}`,
                          animation: `eqOrbit${['A','B','C'][i]} ${['1.4s','1.8s','2.2s'][i]} linear infinite`,
                        }} />
                      </div>
                    ))}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-slate-700">{statusMessage || 'AI Processing…'}</span>
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs text-slate-400 tabular-nums font-mono">⏱ {formatElapsed(elapsedSeconds)}</span>
                        <span className="text-sm font-bold text-emerald-600 tabular-nums">{progress}%</span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="relative w-full rounded-full h-2.5 overflow-hidden" style={{ background: '#f1f5f9' }}>
                      <div className="h-full rounded-full relative overflow-hidden" style={{
                        width: `${Math.max(5, progress)}%`,
                        background: 'linear-gradient(90deg, #047857, #059669, #34d399)',
                        animation: 'eq-bar-glow 1.6s ease infinite',
                        transition: 'width 0.7s ease',
                      }}>
                        <div className="absolute inset-0" style={{
                          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)',
                          animation: 'eq-shimmer 2s linear infinite',
                        }} />
                      </div>
                    </div>
                    {/* Stage indicators */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
                      {[
                        { label:'OCR Extraction',  done: progress >= 20 },
                        { label:'Tag Detection',   done: progress >= 40 },
                        { label:'Field Mapping',   done: progress >= 65 },
                        { label:'Post-processing', done: progress >= 85 },
                      ].map(stage => (
                        <div key={stage.label} className="flex items-center gap-1.5 text-[11px]">
                          <div className="w-3 h-3 rounded-full border flex items-center justify-center" style={{
                            background: stage.done ? '#059669' : 'transparent',
                            borderColor: stage.done ? '#059669' : '#e2e8f0',
                            transition: 'all 0.4s ease',
                          }}>
                            {stage.done && <span className="text-white font-bold" style={{ fontSize:'7px' }}>✓</span>}
                          </div>
                          <span style={{ color: stage.done ? '#059669' : '#94a3b8', fontWeight: stage.done ? 600 : 400 }}>
                            {stage.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pt-3" style={{ borderTop: '1px solid #f1f5f9' }}>
                  <span className="text-xs text-slate-400 flex-1">
                    {elapsedSeconds > 20 ? 'OCR scanning P&ID drawing — large drawings may take 1–3 min' : 'AI scanning document for equipment registers and tag numbers'}
                  </span>
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-4 rounded-full bg-emerald-400 flex-shrink-0" style={{
                      animation: 'eq-dot-wave 1.1s ease infinite',
                      animationDelay: `${i * 0.18}s`,
                    }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div className="rounded-xl p-4 mb-4 flex items-start gap-3" style={{
              background: '#fef2f2',
              border: '1px solid rgba(239,68,68,0.22)',
              animation: 'eq-fade-up 0.3s ease forwards',
            }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: 'rgba(239,68,68,0.12)' }}>
                <span className="text-red-500 text-xs font-bold">✕</span>
              </div>
              <p className="text-red-600 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* ── Diagnostic Panel (when 0 items extracted) ── */}
          {debugInfo && results && results.total === 0 && (
            <div className="rounded-2xl p-5 mb-4 eq-section" style={{
              background: '#fffbeb',
              border: '1px solid rgba(245,158,11,0.35)',
              boxShadow: '0 2px 12px rgba(245,158,11,0.08)',
              animationDelay: '0.1s',
            }}>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{
                  background: 'rgba(245,158,11,0.12)',
                  border: '1px solid rgba(245,158,11,0.3)',
                }}>
                  <span className="text-amber-600 text-sm font-bold">!</span>
                </div>
                <h3 className="text-sm font-semibold text-amber-800">No Equipment Found — Extraction Diagnostics</h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {[
                  { label: 'Mode', value: debugInfo.extraction_mode || '—' },
                  { label: 'Text Extracted', value: debugInfo.text_len != null ? `${debugInfo.text_len.toLocaleString()} chars` : '—' },
                  { label: 'Raw Tag Matches', value: debugInfo.raw_items_count != null ? String(debugInfo.raw_items_count) : '—' },
                  { label: 'After Dedup', value: debugInfo.after_dedup_count != null ? String(debugInfo.after_dedup_count) : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl px-3 py-2.5" style={{
                    background: 'white',
                    border: '1px solid rgba(245,158,11,0.2)',
                  }}>
                    <p className="text-xs text-amber-600 font-medium mb-0.5">{label}</p>
                    <p className="text-sm font-bold text-slate-800">{value}</p>
                  </div>
                ))}
              </div>

              {debugInfo.text_preview ? (
                <div>
                  <p className="text-xs font-semibold text-amber-700 mb-1.5">PDF Text Preview (first 400 chars extracted by backend):</p>
                  <pre className="text-xs text-slate-600 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all" style={{
                    background: '#fefce8',
                    border: '1px solid rgba(245,158,11,0.18)',
                    maxHeight: '160px',
                    overflowY: 'auto',
                  }}>
                    {debugInfo.text_preview}
                  </pre>
                  <p className="text-xs text-amber-600 mt-2 leading-relaxed">
                    {debugInfo.text_len === 0
                      ? '⚠ No text was extracted from the PDF. The drawing may be a scanned image — try enabling Force OCR in a future version.'
                      : debugInfo.raw_items_count === 0
                        ? '⚠ Text was extracted but no equipment tags (e.g. V-308, P-101A) were found in it. Check that the preview above contains recognisable tag numbers.'
                        : '⚠ Tags were found but removed during deduplication. The tag pattern may be too strict — contact support.'}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-amber-600">
                  {debugInfo.extraction_mode === 'register'
                    ? 'Register mode ran but found no matching table structure in the document.'
                    : 'No text preview available — extraction may have encountered an error before reaching the text stage.'}
                </p>
              )}
            </div>
          )}

          </div>{/* end centered wrapper */}

          {/* ── KPI Summary Bar (after extraction) ── */}
          {kpiStats && (
            <div className="max-w-7xl mx-auto px-6 mb-6">
              {/* Section label */}
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(5,150,105,0.2))' }} />
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-widest px-3 py-1 rounded-full eq-chip"
                  style={{ background:'rgba(5,150,105,0.06)', border:'1px solid rgba(5,150,105,0.16)', animationDelay:'0s' }}>
                  Extraction Summary
                </span>
                <div className="h-px flex-1" style={{ background: 'linear-gradient(270deg, transparent, rgba(5,150,105,0.2))' }} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                {[
                  { label: 'P&ID Drawings',   value: kpiStats.drawings, icon: '📋', color: '#047857', delay: '0s'    },
                  { label: 'Items Extracted', value: kpiStats.total,    icon: '🏷️', color: '#059669', delay: '0.05s' },
                  { label: 'Equipment Types', value: kpiStats.types,    icon: '🗂️', color: '#047857', delay: '0.1s'  },
                  { label: 'With MOC',        value: kpiStats.withMoc,  icon: '🧱', color: '#065f46', delay: '0.15s' },
                  { label: 'With Dimensions', value: kpiStats.withDim,  icon: '📐', color: '#059669', delay: '0.2s'  },
                  { label: 'With Motor',      value: kpiStats.withMtr,  icon: '⚡', color: '#047857', delay: '0.25s' },
                ].map(({ label, value, icon, color, delay }) => (
                  <div key={label} className="eq-kpi-card eq-kpi-node rounded-2xl px-4 py-4 flex items-center gap-3" style={{
                    background: 'white',
                    border: '1px solid rgba(5,150,105,0.13)',
                    animationDelay: delay,
                  }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl" style={{
                      background: `linear-gradient(135deg, ${color}18 0%, ${color}0c 100%)`,
                      border: `1px solid ${color}22`,
                    }}>
                      {icon}
                    </div>
                    <div>
                      <p className="text-2xl font-bold leading-none tabular-nums" style={{ color }}>{value}</p>
                      <p className="text-xs text-slate-400 mt-0.5 font-medium">{label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Visual divider before table ── */}
          {results && (
            <div className="max-w-7xl mx-auto px-6 mb-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(5,150,105,0.25), transparent)' }} />
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-emerald-700" style={{
                  background: 'rgba(5,150,105,0.07)', border: '1px solid rgba(5,150,105,0.18)',
                }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                    style={{ animation: 'eq-pulse-badge 2s ease infinite' }} />
                  Extraction Results
                </div>
                <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(5,150,105,0.25), transparent)' }} />
              </div>
            </div>
          )}

          {/* ── Results Table — full viewport width breakout ── */}
          {results && (
            <div className="px-4 mt-4">
            <div className="rounded-2xl overflow-hidden eq-section" style={{
              background: 'white',
              border: '1px solid rgba(5,150,105,0.12)',
              boxShadow: '0 4px 24px rgba(5,150,105,0.07)',
              animationDelay: '0s',
            }}>
              {/* Results header */}
              <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3" style={{
                background: 'linear-gradient(90deg, rgba(5,150,105,0.05), rgba(5,150,105,0.02))',
                borderBottom: '1px solid rgba(5,150,105,0.1)',
              }}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{
                    background: 'rgba(5,150,105,0.08)',
                    border: '1px solid rgba(5,150,105,0.18)',
                  }}>
                    <Boxes className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-slate-800 font-semibold text-base">
                      <span className="text-emerald-600 text-xl font-bold">{results.total}</span>
                      {' '}Equipment Item{results.total !== 1 ? 's' : ''} Extracted
                    </h2>
                    {results.drawing_ref && (
                      <p className="text-slate-400 text-xs mt-0.5">Drawing: {results.drawing_ref}</p>
                    )}
                  </div>
                </div>

                {/* Filter input */}
                <div className="relative">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  <input
                    type="text"
                    placeholder="Filter by tag, type, fluid…"
                    value={filterText}
                    onChange={e => setFilterText(e.target.value)}
                    className="eq-filter-input pl-8 pr-3 py-2 text-sm rounded-lg outline-none w-56"
                    style={{
                      background: 'white',
                      border: '1px solid #e2e8f0',
                      color: '#334155',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = 'rgba(5,150,105,0.45)';
                      e.target.style.boxShadow   = '0 0 0 3px rgba(5,150,105,0.1)';
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = '#e2e8f0';
                      e.target.style.boxShadow   = 'none';
                    }}
                  />
                </div>
              </div>

              {displayRows.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-slate-400 text-sm">
                    {filterText ? 'No items match your filter.' : 'No equipment items were extracted from this drawing.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="eq-th-sticky">
                      <tr style={{ background: 'linear-gradient(90deg, #065f46, #047857)' }}>
                        <th className="px-3 py-3.5 text-center" style={{ width: '40px' }}>
                          <input
                            type="checkbox"
                            checked={selectedRows.size === displayRows.length && displayRows.length > 0}
                            onChange={handleSelectAll}
                            title="Select / deselect all"
                            style={{ cursor: 'pointer', accentColor: '#10b981', width: '15px', height: '15px' }}
                          />
                        </th>
                        {COLUMNS.map(col => (
                          <th
                            key={col.key}
                            className="px-4 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider cursor-pointer select-none"
                            style={{ transition: 'background 0.18s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            onClick={() => handleSort(col.key)}
                          >
                            <span className="flex items-center gap-1">
                              {col.label}
                              {sortCol === col.key && (
                                <span className="text-emerald-200">{sortAsc ? ' ↑' : ' ↓'}</span>
                              )}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayRows.map((row, idx) => {
                        const rowKey = getRowKey(row, idx);
                        const isSelected = selectedRows.has(rowKey);
                        return (
                        <tr
                          key={row.tag}
                          className="eq-row-animate"
                          style={{
                            animationDelay: `${Math.min(idx * 0.035, 0.5)}s`,
                            background: isSelected ? 'rgba(5,150,105,0.08)' : idx % 2 === 0 ? 'white' : '#f0fdf4',
                            borderBottom: '1px solid #f1f5f9',
                            transition: 'background 0.15s',
                            outline: isSelected ? '1px solid rgba(5,150,105,0.25)' : 'none',
                          }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(5,150,105,0.05)'; }}
                          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = idx % 2 === 0 ? 'white' : '#f0fdf4'; }}
                        >
                          <td className="px-3 py-3 text-center" style={{ width: '40px' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleSelectRow(rowKey)}
                              style={{ cursor: 'pointer', accentColor: '#059669', width: '15px', height: '15px' }}
                            />
                          </td>
                          {COLUMNS.map(col => {
                            // sl_no: always sequential 1-based index regardless of backend value
                            const raw     = row[col.key];
                            const v       = col.key === 'sl_no' ? idx + 1 : raw;
                            const display = Array.isArray(v)
                              ? (v.length ? v.join(' · ') : '—')
                              : (v || '—');
                            const isConnectionCol = col.key === 'line_connections' || col.key === 'nozzle_connections';
                            return (
                              <td
                                key={col.key}
                                className={`px-4 py-3 text-sm ${col.key === 'tag' ? 'font-mono font-bold' : ''}`}
                                style={{
                                  color:      col.key === 'tag' ? '#065f46' : '#334155',
                                  whiteSpace: isConnectionCol ? 'normal' : 'nowrap',
                                  maxWidth:   col.key === 'line_connections' ? '320px' : undefined,
                                }}
                                title={Array.isArray(v) ? v.join(', ') : String(v || '')}
                              >
                                {col.key === 'tag' ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-bold"
                                    style={{ background: 'rgba(5,150,105,0.08)', color: '#065f46', border: '1px solid rgba(5,150,105,0.15)' }}>
                                    {display}
                                  </span>
                                ) : col.key === 'quality_required' ? (
                                  <span className="flex flex-col gap-0.5">
                                    {display !== '—' && <span>{display}</span>}
                                    {(() => {
                                      const h = resolveQuantityHint(row.tag);
                                      return h ? (
                                        <span className="text-xs font-medium px-1.5 py-0.5 rounded self-start"
                                          style={{ background: 'rgba(5,150,105,0.07)', color: '#059669', border: '1px solid rgba(5,150,105,0.15)' }}
                                          title={`Expected: ${h.label} (${h.placeholder})`}>
                                          {h.label}
                                        </span>
                                      ) : (display === '—' ? <span style={{ color: '#94a3b8' }}>—</span> : null);
                                    })()}
                                  </span>
                                ) : col.key === 'line_connections' ? (
                                  renderLineBadges(v)
                                ) : col.key === 'nozzle_connections' ? (
                                  renderNozzleBadges(v)
                                ) : CONDITION_COLS.has(col.key) ? (
                                  renderConditionValue(display)
                                ) : (
                                  <span className="block">{display}</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ); })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="px-6 py-3 flex items-center justify-between text-xs" style={{
                borderTop: '1px solid #f1f5f9',
                background: 'linear-gradient(90deg, #f8fafc, rgba(5,150,105,0.02))',
              }}>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                    style={{ animation: 'eq-pulse-badge 2s ease infinite' }} />
                  <span className="text-slate-400 font-medium">
                    {filterText ? `${displayRows.length} of ${results.total} shown` : `${results.total} equipment items`}
                  </span>
                </div>
                <span className="text-slate-300 hidden sm:block">↑↓ Click column header to sort</span>
              </div>
            </div>
            </div>
          )}

          {/* ── Info Panel (idle) ── */}
          <div className="max-w-7xl mx-auto px-6">
          {!results && !isProcessing && (
            <div className="rounded-2xl overflow-hidden mt-4 eq-section" style={{
              background: 'white',
              border: '1px solid rgba(5,150,105,0.12)',
              boxShadow: '0 4px 24px rgba(5,150,105,0.07)',
              animationDelay: '0.25s',
            }}>
              {/* Gradient top strip */}
              <div className="h-[3px]" style={{
                backgroundImage: EQ_T.gradBar, backgroundSize:'300% auto',
                animation: 'eqGradShift 4s linear infinite',
              }} />

              <div className="p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                    background: 'linear-gradient(135deg, rgba(5,150,105,0.12), rgba(16,185,129,0.06))',
                    border: '1px solid rgba(5,150,105,0.20)',
                  }}>
                    <span className="text-emerald-600 text-sm">📋</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">What Gets Extracted</h3>
                    <p className="text-xs text-slate-400">18-field engineering register · P&ID + Equipment List modes</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                      style={{ animation: 'eq-pulse-badge 2s ease infinite' }} />
                    <span className="text-xs font-semibold text-emerald-600">AI-Ready</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    ['🔢', 'SL No. & Revision',           'Row serial number and document revision extracted from the register table',       '#059669'],
                    ['🏷️', 'Equipment Tag No.',            'ISA/project-style tag (V-101, P-201A, E-302…) from tag column',                  '#047857'],
                    ['📝', 'Description',                  'Equipment description as listed in the register',                                  '#065f46'],
                    ['💧', 'Design Flowrate / Duty',       'Design flow rate, duty, or volume capacity from the process column',              '#059669'],
                    ['🌡️', 'Operating Pressure (PSIG)',    'Normal operating pressure extracted from oper. press. column',                    '#047857'],
                    ['🔥', 'Operating Temperature (°F)',   'Normal operating temperature from oper. temp. column',                            '#065f46'],
                    ['⬆️', 'Design/Set Press. Min & Max',  'Minimum and maximum design or set pressure from the two PSIG columns',           '#059669'],
                    ['⬆️', 'Design Temp. Min & Max (°F)',  'Minimum and maximum design temperature from the two Deg F columns',              '#047857'],
                    ['🧱', 'MOC',                          'Material of Construction — shell, body or wetted-parts material',                 '#065f46'],
                    ['🧊', 'Insulation',                   'Insulation type or code (PERS, PITS, ICS, CONS, HOT, COLD…)',                    '#059669'],
                    ['📐', 'Length / Height (mm)',          'Tangent-to-tangent length or overall height from the dimension column',           '#047857'],
                    ['⭕', 'Diameter / Width (mm)',         'Outside diameter or width from the dimension column',                             '#065f46'],
                    ['⚡', 'Motor Rating (kW)',             'Installed motor or driver power rating from the KW column',                      '#059669'],
                    ['📋', 'P&ID No.',                     'P&ID reference number cross-linked to this equipment item',                      '#047857'],
                    ['✅', 'Quantity Required',             'Volume / Flow Rate / Duty — resolved dynamically from equipment tag prefix',      '#065f46'],
                    ['🔄', 'Phase',                        'Process fluid phase (Gas, Liquid, Mixed, Vapour…)',                               '#059669'],
                    ['💬', 'Remarks',                      'Notes, holds, TBD items or other remarks from the last column',                   '#047857'],
                    ['🔀', 'Multi-Angle OCR',              'Extracts at 0°, 90°, 180°, 270° — handles landscape CAD title blocks',           '#065f46'],
                  ].map(([icon, title, desc, color]) => (
                    <div key={title} className="eq-info-card flex items-start gap-3 p-3.5 rounded-xl" style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      transition: 'border-color 0.2s, background 0.2s',
                      cursor: 'default',
                    }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-base" style={{
                        background: `linear-gradient(135deg, ${color}12 0%, ${color}07 100%)`,
                        border: `1px solid ${color}1a`,
                      }}>
                        {icon}
                      </div>
                      <div>
                        <p className="text-xs font-semibold mb-0.5" style={{ color }}>{title}</p>
                        <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          </div>{/* end info panel wrapper */}

        </div>
      </div>
    </>
  );
};

export default EquipmentList;
