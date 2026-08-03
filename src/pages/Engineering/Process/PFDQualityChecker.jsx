import React, { useState, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../../config/api.config';
import CrossRecommendationPanel from '../../../components/recommendations/CrossRecommendationPanel';
import WrenchAiDocAssist from '../../../components/Engineering/WrenchAiDocAssist';
import {
  Upload as UploadIcon, FileText, CheckCircle, AlertTriangle,
  Loader, X, Download, Activity, Shield, GitBranch, Cpu, Clock,
  RefreshCw, FolderPlus, Package, Layers, ChevronRight, Edit,
  Trash2, ArrowLeft, BarChart2, Save, Zap, ScanLine, Brain,
  CircleDot, ExternalLink, Tag, Sliders, Ruler, Eye, MapPin,
} from 'lucide-react';

// Soft-coded: overlay marker animation config (mirrors PIDVerification)
const PFD_OVERLAY_MARKER_ANIM_PING_SCALE  = 2.5;   // ripple ring final scale
const PFD_OVERLAY_MARKER_ANIM_ENABLED      = true;  // toggle all marker animation
const PFD_OVERLAY_MARKER_ANIM_DURATION_MS  = 2200;  // ping cycle ms

// ─── AI Document Assist (Wrench) — soft-coded panel config ─────────────────
// Mirrors the panel used on PID Verification / PMS / Instrument Index / CLL.
// Set `enabled: false` to hide the panel without touching JSX.
const PFDQ_AI_ASSIST_CONFIG = {
  enabled:         true,
  title:           'AI Document Assist',
  subtitleTag:     '(Wrench · optional)',
  subtitle:        'Let RAD AI pick & recommend the right PFD drawing for this project from Wrench DMS',
  defaultHint:     'pfd process flow diagram',
  hintPlaceholder: 'e.g. pfd, process flow, unit 100',
  topN:            5,
  // PFD Quality Checker accepts the same file types as its file input.
  acceptedExts:    ['pdf','png','jpg','jpeg','tiff','tif'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Animation keyframes — PFD Quality Checker signature animations
// Reference: P&ID Verification animation style, extended with PFD-specific
// process-flow, data-stream, pipe-flow, circuit-trace & scan-beam effects.
// SOFT-CODED: edit durations/distances here; no JSX changes needed.
// ─────────────────────────────────────────────────────────────────────────────
const KEYFRAMES = `
  /* ── Ambient background floats ── */
  @keyframes floatA { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(40px,-30px) scale(1.06)} }
  @keyframes floatB { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-35px,25px) scale(1.04)} }
  @keyframes floatC { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(20px,35px) scale(1.05)} }

  /* ── Entry & transition ── */
  @keyframes fadeUp    { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn    { from{opacity:0} to{opacity:1} }
  @keyframes cardIn    { from{opacity:0;transform:translateY(10px) scale(0.98)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes panelSlide{ from{opacity:0;transform:translateX(-14px)} to{opacity:1;transform:translateX(0)} }
  @keyframes railIn    { from{opacity:0;transform:translateX(-24px)} to{opacity:1;transform:translateX(0)} }
  @keyframes slideRight{ from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }

  /* ── Gradient bar & shimmer ── */
  @keyframes gradShift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
  @keyframes shimmer   { 0%{background-position:-200% 0} 100%{background-position:200% 0} }

  /* ── Loader stages ── */
  @keyframes factSlide { 0%{opacity:0;transform:translateY(8px)} 15%,85%{opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(-8px)} }
  @keyframes checkPop  { 0%{transform:scale(0);opacity:0} 70%{transform:scale(1.2)} 100%{transform:scale(1);opacity:1} }
  @keyframes pulse2    { 0%,100%{opacity:1} 50%{opacity:0.4} }

  /* ── Orbit electrons (AI brain loader) ── */
  @keyframes orbitA { 0%{transform:rotate(0deg)   translateX(52px) rotate(0deg)}   100%{transform:rotate(360deg)  translateX(52px) rotate(-360deg)} }
  @keyframes orbitB { 0%{transform:rotate(120deg) translateX(52px) rotate(-120deg)} 100%{transform:rotate(480deg)  translateX(52px) rotate(-480deg)} }
  @keyframes orbitC { 0%{transform:rotate(240deg) translateX(52px) rotate(-240deg)} 100%{transform:rotate(600deg)  translateX(52px) rotate(-600deg)} }

  /* ── PFD-specific: scan beam sweeps top→bottom over the drawing placeholder ── */
  @keyframes scanBeam {
    0%   { top:-4px; opacity:0; }
    5%   { opacity:1; }
    95%  { opacity:0.85; }
    100% { top:100%; opacity:0; }
  }

  /* ── PFD-specific: circuit trace along upload-zone border ── */
  @keyframes traceH {
    0%   { width:0%;  left:0%;   opacity:0; }
    10%  { opacity:1; }
    45%  { width:100%; left:0%;  opacity:1; }
    55%  { width:0%;  left:100%; opacity:0; }
    100% { width:0%;  left:0%;   opacity:0; }
  }
  @keyframes traceV {
    0%   { height:0%;  top:0%;   opacity:0; }
    10%  { opacity:1; }
    45%  { height:100%; top:0%;  opacity:1; }
    55%  { height:0%;  top:100%; opacity:0; }
    100% { height:0%;  top:0%;   opacity:0; }
  }

  /* ── PFD-specific: data-stream dots flowing left→right through pipe ── */
  @keyframes streamDot {
    0%   { transform:translateX(-12px); opacity:0; }
    15%  { opacity:1; }
    85%  { opacity:1; }
    100% { transform:translateX(calc(100% + 12px)); opacity:0; }
  }

  /* ── PFD-specific: pipe flow dash animation on SVG ── */
  @keyframes pipeFlow {
    0%   { stroke-dashoffset: 120; }
    100% { stroke-dashoffset: 0;   }
  }

  /* ── PFD-specific: node glow pulse for project cards ── */
  @keyframes nodeGlow {
    0%,100% { box-shadow: 0 0 0 0 rgba(13,148,136,0); transform:scale(1); }
    50%     { box-shadow: 0 0 18px 4px rgba(13,148,136,0.35); transform:scale(1.04); }
  }

  /* ── PFD-specific: progress bar fill wave ── */
  @keyframes barWave {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(400%); }
  }

  /* ── PFD-specific: stat counter roll-up ── */
  @keyframes countUp {
    from { transform: translateY(8px); opacity:0; }
    to   { transform: translateY(0);   opacity:1; }
  }

  /* ── PFD-specific: tag badge pop-in for capability chips ── */
  @keyframes chipPop {
    0%   { transform:scale(0.7) translateY(6px); opacity:0; }
    70%  { transform:scale(1.08) translateY(-1px); }
    100% { transform:scale(1) translateY(0); opacity:1; }
  }

  /* ── PFD-specific: rotating rule-ring on hero ── */
  @keyframes spinSlow   { from{transform:rotate(0deg)}   to{transform:rotate(360deg)}  }
  @keyframes spinSlowRev{ from{transform:rotate(0deg)}   to{transform:rotate(-360deg)} }

  /* ── Marker ping ring + glow (mirrors PID Verification) ── */
  @keyframes markerPing {
    0%   { transform: translate(-50%,-50%) scale(1);    opacity: 0;    }
    12%  { transform: translate(-50%,-50%) scale(1.05); opacity: 0.85; }
    100% { transform: translate(-50%,-50%) scale(${PFD_OVERLAY_MARKER_ANIM_PING_SCALE}); opacity: 0; }
  }
  @keyframes markerGlow {
    0%, 100% { opacity: 1;    filter: brightness(1);    }
    50%      { opacity: 0.55; filter: brightness(1.35); }
  }

  /* ── Nav rail tab slide-in ── */
  @keyframes navTabIn {
    from { opacity: 0; transform: translateX(18px) scale(0.92); }
    to   { opacity: 1; transform: translateX(0)    scale(1);    }
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Theme constants — teal/cyan palette with deep-ocean accent
// SOFT-CODED: all visual values live here; JSX references T.xxx only.
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  // Page background — subtle deep-sea gradient
  bg: 'linear-gradient(145deg, #f0fdfa 0%, #ecfeff 30%, #f0f9ff 65%, #f0fdfa 100%)',

  // Ambient blob colours & positions
  blobs: [
    { color:'rgba(20,184,166,0.10)',  size:'580px', top:'-100px',   left:'15%',    anim:'floatA 14s ease-in-out infinite'    },
    { color:'rgba(6,182,212,0.08)',   size:'460px', top:'25%',      right:'-80px', anim:'floatB 17s ease-in-out infinite'    },
    { color:'rgba(16,185,129,0.08)',  size:'400px', bottom:'-80px', left:'30%',    anim:'floatC 12s ease-in-out infinite'    },
    { color:'rgba(14,165,233,0.07)',  size:'320px', top:'60%',      left:'-60px',  anim:'floatA 10s ease-in-out infinite 3s' },
    { color:'rgba(20,184,166,0.05)',  size:'260px', top:'40%',      right:'20%',   anim:'floatB  9s ease-in-out infinite 2s' },
  ],

  // Card & panel surfaces
  card:  { background:'#ffffff', border:'1px solid #e2e8f0', boxShadow:'0 1px 3px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.04)' },
  cardH: { boxShadow:'0 12px 40px rgba(13,148,136,0.14),0 2px 8px rgba(0,0,0,0.05)', borderColor:'#5eead4', transform:'translateY(-2px)' },
  panel: { background:'rgba(255,255,255,0.90)', border:'1px solid #ccfbf1', backdropFilter:'blur(16px)', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' },
  modal: { background:'#ffffff', border:'1px solid #e2e8f0', boxShadow:'0 24px 70px rgba(0,0,0,0.16)' },
  input: { background:'#f8fafc', border:'1px solid #e2e8f0' },

  // Accent colours
  accent:       'linear-gradient(135deg,#0d9488,#0891b2)',
  accentDeep:   'linear-gradient(135deg,#0f766e,#0e7490)',
  accentHex:    '#0d9488',
  accentShadow: '0 4px 18px rgba(8,145,178,0.38)',
  accentShadowLg:'0 8px 28px rgba(8,145,178,0.42)',

  // Top gradient bar (animated)
  gradBar: 'linear-gradient(90deg,#14b8a6,#0891b2,#06b6d4,#10b981,#14b8a6)',

  // Grid dot overlay
  gridDot: 'radial-gradient(circle, rgba(20,184,166,0.07) 1px, transparent 1px)',

  // Scan beam sweep colour
  scanBeam: 'linear-gradient(180deg,transparent,rgba(20,184,166,0.18),rgba(6,182,212,0.22),rgba(20,184,166,0.18),transparent)',

  // Circuit trace colour
  trace: 'rgba(20,184,166,0.6)',

  // Stream dot colours for the pipe‑flow illustration
  streamColors: ['#14b8a6','#0891b2','#06b6d4','#10b981'],
};

// ─────────────────────────────────────────────────────────────────────────────
// DarkBg — full-page animated background
// Contains: grid dots, ambient blobs, gradient top-bar, animated SVG pipe-flow
// ribbon, and three data-stream tokens sweeping across a pipe illustration.
// SOFT-CODED: all visual values come from T; JSX structure is stable.
// ─────────────────────────────────────────────────────────────────────────────

// Soft-coded stream dot positions and delays for background pipe decoration
const STREAM_DOTS = [
  { top:'23%', delay:'0s',    dur:'3.2s', color:'#14b8a6' },
  { top:'23%', delay:'1.1s',  dur:'3.2s', color:'#0891b2' },
  { top:'23%', delay:'2.2s',  dur:'3.2s', color:'#06b6d4' },
  { top:'67%', delay:'0.4s',  dur:'2.8s', color:'#10b981' },
  { top:'67%', delay:'1.6s',  dur:'2.8s', color:'#14b8a6' },
  { top:'67%', delay:'2.4s',  dur:'2.8s', color:'#0891b2' },
];

const DarkBg = ({ children }) => (
  <div className="min-h-screen relative overflow-hidden" style={{ background: T.bg }}>
    <style>{KEYFRAMES}</style>

    {/* Fine dot grid */}
    <div className="absolute inset-0 pointer-events-none"
      style={{ backgroundImage: T.gridDot, backgroundSize:'44px 44px' }} />

    {/* Ambient gradient blobs */}
    {T.blobs.map((b, i) => (
      <div key={i} className="absolute rounded-full pointer-events-none"
        style={{ width:b.size, height:b.size, top:b.top, bottom:b.bottom, left:b.left, right:b.right,
          background:`radial-gradient(circle, ${b.color} 0%, transparent 70%)`, animation:b.anim }} />
    ))}

    {/* ── Animated SVG pipe-flow ribbon (decorative, right-side) ── */}
    <div className="absolute right-0 top-0 bottom-0 w-64 pointer-events-none overflow-hidden opacity-30 hidden xl:block">
      <svg width="256" height="100%" viewBox="0 0 256 800" preserveAspectRatio="none"
        fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Horizontal pipe at 23% */}
        <line x1="0" y1="184" x2="256" y2="184" stroke="#14b8a6" strokeWidth="2.5"
          strokeDasharray="12 8" style={{ animation:'pipeFlow 2.4s linear infinite' }} />
        {/* Horizontal pipe at 67% */}
        <line x1="0" y1="536" x2="256" y2="536" stroke="#0891b2" strokeWidth="2.5"
          strokeDasharray="12 8" style={{ animation:'pipeFlow 2.8s linear infinite 0.4s' }} />
        {/* Vertical connector */}
        <line x1="128" y1="184" x2="128" y2="536" stroke="#06b6d4" strokeWidth="1.5"
          strokeDasharray="8 10" style={{ animation:'pipeFlow 3.2s linear infinite 0.8s' }} />
        {/* Equipment boxes */}
        <rect x="44"  y="162" width="40" height="44" rx="5" fill="rgba(20,184,166,0.14)" stroke="#14b8a6" strokeWidth="1.5"/>
        <rect x="172" y="162" width="40" height="44" rx="5" fill="rgba(8,145,178,0.12)"  stroke="#0891b2" strokeWidth="1.5"/>
        <rect x="108" y="514" width="40" height="44" rx="5" fill="rgba(6,182,212,0.12)"  stroke="#06b6d4" strokeWidth="1.5"/>
        {/* Stream number labels */}
        <text x="58"  y="190" fill="#0d9488" fontSize="9" fontFamily="monospace" fontWeight="700">E-101</text>
        <text x="184" y="190" fill="#0d9488" fontSize="9" fontFamily="monospace" fontWeight="700">V-201</text>
        <text x="118" y="542" fill="#0d9488" fontSize="9" fontFamily="monospace" fontWeight="700">P-301</text>
        {/* Stream numbers */}
        <text x="6"   y="178" fill="#0891b2" fontSize="8" fontFamily="monospace" opacity="0.7">S-01</text>
        <text x="6"   y="530" fill="#0891b2" fontSize="8" fontFamily="monospace" opacity="0.7">S-03</text>
      </svg>
      {/* Flowing data dots on pipe lines */}
      {STREAM_DOTS.map((d, i) => (
        <div key={i} className="absolute w-2 h-2 rounded-full pointer-events-none"
          style={{
            top: d.top, left:0,
            background: d.color,
            boxShadow: `0 0 6px ${d.color}`,
            animation: `streamDot ${d.dur} linear infinite ${d.delay}`,
          }} />
      ))}
    </div>

    {/* Top gradient bar */}
    <div className="absolute inset-x-0 top-0 h-[3px] pointer-events-none"
      style={{ backgroundImage:T.gradBar, backgroundSize:'300% auto', animation:'gradShift 3s linear infinite' }} />

    <div className="relative z-10">{children}</div>
  </div>
);

const DarkModal = ({ show, onClose, title, subtitle, iconEl, children }) =>
  show ? (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      style={{ background:'rgba(15,23,42,0.45)' }}>
      <div className="rounded-2xl max-w-lg w-full p-6 max-h-[80vh] flex flex-col" style={T.modal}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {iconEl}
            <div>
              <h3 className="text-base font-bold text-slate-900">{title}</h3>
              {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        {children}
      </div>
    </div>
  ) : null;

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const API_PREFIX = `${API_BASE_URL}/pfd-quality`;

const SEVERITY_STYLES = {
  critical: 'bg-red-100 text-red-800 border-red-300',
  major:    'bg-orange-100 text-orange-800 border-orange-300',
  minor:    'bg-yellow-100 text-yellow-800 border-yellow-300',
  info:     'bg-teal-100 text-teal-800 border-teal-300',
};

// Soft-coded: category display labels
// Add new categories here to extend without touching table render logic
const CATEGORY_LABELS = {
  equipment:   'Equipment Tagging',
  stream:      'Stream Numbers',
  control:     'Control Elements',
  title_block: 'Title Block',
  safety:      'Safety Devices',
  utility:     'Utilities',
  notes:       'Notes & HOLDs',
};

// Soft-coded: categories hidden from the findings table
const HIDDEN_CATEGORIES = new Set([]);

// Soft-coded: when false, suppresses the native browser tooltip that appears on
// hover over every overlay marker on the PFD drawing. Core marker logic unchanged.
const PFD_OVERLAY_SHOW_MARKER_TOOLTIP = false;

// Soft-coded: localStorage keys for the engineer correction + stats system.
// Corrections key format: 'drawingId:findingId' → { correctedLeft, correctedTop, … }
// Stats key format: 'drawingId' → { tierCounts: { TAG:n, ZONE:n, CX:n }, timestamp }
const PFD_CALIB_STORAGE_KEY = 'pfd_calib_corrections';
const PFD_CALIB_STATS_KEY   = 'pfd_calib_stats';

// Soft-coded: flip to true to render a tiny tier label (TAG / ZONE / CX) beside
// each overlay marker for diagnosis. Default false for production.
const PFD_SHOW_RESOLUTION_DEBUG = false;

// Soft-coded: nav rail dimensions and animation timing
const PFD_NAV_RAIL_ENTRY_DELAY_MS    = 55;
const PFD_NAV_RAIL_ENTRY_DURATION_MS = 320;
const PFD_NAV_RAIL_WIDTH             = 148;

// Soft-coded: performance panel — tier placement weights, colours, labels
const PFD_PERF_TIER_WEIGHT = { TAG: 1.00, ZONE: 0.50, CX: 0.95 };
const PFD_PERF_TIER_COLOR  = { TAG: '#10b981', ZONE: '#f59e0b', CX: '#06b6d4' };
const PFD_PERF_TIER_LABEL  = { TAG: 'Exact Tag Match', ZONE: 'Category Zone', CX: 'Engineer Corrected' };

// Soft-coded: performance panel — score thresholds
const PFD_PERF_SCORE_THRESHOLDS        = { high: 80, moderate: 55 };
const PFD_PERF_ANCHOR_THRESHOLDS       = { high: 70, moderate: 40 };
const PFD_PERF_DOC_ACCURACY_THRESHOLDS = { high: 75, moderate: 50 };

// Soft-coded: weighted document accuracy formula
const PFD_PERF_DOC_ACCURACY_WEIGHTS = { ocr: 0.30, placement: 0.45, anchor: 0.25 };
const PFD_PERF_OCR_GOOD_THRESHOLD   = 500;   // chars — what counts as "good" OCR
const PFD_PERF_TOP_RULES_COUNT      = 8;
const PFD_PERF_TOP_CATS_COUNT       = 6;

// ─────────────────────────────────────────────────────────────────────────────
// SOFT-CODED: VIEW 1 hero capability badges
// Extend this array to add new capability chips — no JSX changes needed.
// ─────────────────────────────────────────────────────────────────────────────
const HERO_BADGES = [
  { icon:'🔧', label:'Equipment Tagging',  cls:'bg-teal-50 border-teal-200 text-teal-700'          },
  { icon:'🌊', label:'Stream Numbers',      cls:'bg-cyan-50 border-cyan-200 text-cyan-700'          },
  { icon:'📋', label:'Title Block',         cls:'bg-sky-50 border-sky-200 text-sky-700'             },
  { icon:'🛡️', label:'Safety Devices',     cls:'bg-emerald-50 border-emerald-200 text-emerald-700' },
  { icon:'⚙️', label:'Control Elements',   cls:'bg-teal-50 border-teal-200 text-teal-700'          },
  { icon:'📌', label:'ISO 10628',           cls:'bg-indigo-50 border-indigo-200 text-indigo-700'    },
];

// Tick-mark angles for the animated rule-ring decoration (12 rules → 30° apart)
const RULE_RING_TICKS = Array.from({ length: 12 }, (_, i) => i * 30);

// ─────────────────────────────────────────────────────────────────────────────
// SOFT-CODED: "How It Works" 3-step workflow shown below the project grid
// ─────────────────────────────────────────────────────────────────────────────
const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Upload PFD Drawing',
    desc: 'Drop a PDF, PNG or TIFF of your Process Flow Diagram. Multi-page documents supported.',
    icon: UploadIcon,
    accent: '#0d9488',
    glow: 'rgba(13,148,136,0.20)',
    bg: 'linear-gradient(135deg,#f0fdfa,#ccfbf1)',
    border: '#99f6e4',
  },
  {
    step: '02',
    title: 'AI + Rule Engine Scan',
    desc: '12 deterministic rules run against OCR text, equipment tags, stream numbers, title block and safety devices.',
    icon: Brain,
    accent: '#0891b2',
    glow: 'rgba(8,145,178,0.20)',
    bg: 'linear-gradient(135deg,#ecfeff,#cffafe)',
    border: '#a5f3fc',
  },
  {
    step: '03',
    title: 'Quality Report',
    desc: 'Receive a ranked findings list with severity, rule reference and one-click overlay markers on the drawing.',
    icon: CheckCircle,
    accent: '#10b981',
    glow: 'rgba(16,185,129,0.20)',
    bg: 'linear-gradient(135deg,#f0fdf4,#dcfce7)',
    border: '#86efac',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SOFT-CODED: Rule coverage grid shown below "How It Works" (8 categories)
// ─────────────────────────────────────────────────────────────────────────────
const RULE_COVERAGE = [
  { icon:'🔧', label:'Equipment Tags',   sub:'Naming & sequence',          color:'#0d9488' },
  { icon:'🌊', label:'Stream Numbers',   sub:'Continuity & coverage',       color:'#0891b2' },
  { icon:'📋', label:'Title Block',      sub:'Rev, scale, approval',        color:'#0284c7' },
  { icon:'🛡️', label:'Safety Devices',  sub:'PRV, BDV placement',          color:'#dc2626' },
  { icon:'⚙️', label:'Control Elements',sub:'Valves, instruments',          color:'#7c3aed' },
  { icon:'🔁', label:'Utility Lines',    sub:'Utility & service headers',   color:'#0891b2' },
  { icon:'📌', label:'HOLD Notations',   sub:'Pending decisions flagged',   color:'#d97706' },
  { icon:'⚡', label:'ISO 10628',        sub:'Standard compliance check',   color:'#0d9488' },
];

// ─────────────────────────────────────────────────────────────────────────────
// SOFT-CODED: "What Gets Checked" compact tiles shown below upload area
// This is a subset — shown inside a project before uploading a file
// ─────────────────────────────────────────────────────────────────────────────
const CHECKS_PREVIEW = [
  { icon: Tag,      label: 'Equipment Tagging', desc: 'Tag format & sequence'   },
  { icon: Ruler,    label: 'Stream Numbers',    desc: 'Continuity validation'   },
  { icon: FileText, label: 'Title Block',       desc: 'Rev, scale, sign-off'    },
  { icon: Shield,   label: 'Safety Devices',    desc: 'PRV/BDV coverage'        },
  { icon: Sliders,  label: 'Control Elements',  desc: 'Valve & loop checks'     },
  { icon: Brain,    label: 'AI Rule Engine',    desc: '12-rule deterministic'   },
];

const authHeader = () => {
  const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ─────────────────────────────────────────────────────────────────────────────
// SOFT-CODED: PFD analysis stages shown in the processing loader
// Edit here to add/remove/reorder stages. No other code changes needed.
// durationMs: cumulative elapsed time at which the stage is marked "done"
// ─────────────────────────────────────────────────────────────────────────────
const PFD_STAGES = [
  { id: 'ocr',       label: 'OCR text extraction',        icon: ScanLine,  durationMs: 4000  },
  { id: 'equipment', label: 'Equipment tag detection',    icon: Tag,       durationMs: 7000  },
  { id: 'streams',   label: 'Stream number validation',   icon: Ruler,     durationMs: 9000  },
  { id: 'title',     label: 'Title block verification',   icon: FileText,  durationMs: 11000 },
  { id: 'safety',    label: 'Safety device checks',       icon: Shield,    durationMs: 14000 },
  { id: 'control',   label: 'Control element audit',      icon: Sliders,   durationMs: 17000 },
  { id: 'rules',     label: 'Deterministic rule engine',  icon: Brain,     durationMs: 20000 },
  { id: 'report',    label: 'Building findings report',   icon: FileText,  durationMs: 24000 },
];

// Soft-coded: rotating engineering facts shown during processing
const PFD_FACTS = [
  'A PFD represents the primary flow path, major equipment and stream data — not individual control loops.',
  'ISO 10628-1 defines PFDs as schematic representations of a process and the relationship between its main production units.',
  'Stream tables on PFDs include temperature, pressure, flow rate and composition for each numbered stream.',
  'A well-drawn PFD is the foundation for P&ID development — all mass and heat balances must close.',
  'Equipment tags on PFDs follow ISA-S5.1: E-xxx for exchangers, P-xxx for pumps, V-xxx for vessels, C-xxx for compressors.',
  'Title blocks must include revision tracking — missing revisions are among the most common PFD quality violations.',
  'Safety devices on PFDs (PRVs, BDVs) represent critical safeguards that define emergency depressurisation sequences.',
  'HOLD notations on PFDs signal pending engineering decisions — every HOLD should have a defined owner and deadline.',
  'Stream numbers must be consistent from PFD to P&ID — a mismatch here causes expensive downstream rework.',
];

// ─────────────────────────────────────────────────────────────────────────────
// AnalysisLoader — shown while backend processes the PFD
// Design: scan beam + circular stage-dial + shimmer progress bar + fact card
// SOFT-CODED: stage list comes from PFD_STAGES; facts from PFD_FACTS.
// ─────────────────────────────────────────────────────────────────────────────
const AnalysisLoader = ({ elapsedSec, fileName }) => {
  const [factIdx, setFactIdx] = React.useState(0);
  const [factKey, setFactKey] = React.useState(0);

  React.useEffect(() => {
    const t = setInterval(() => {
      setFactIdx(i => (i + 1) % PFD_FACTS.length);
      setFactKey(k => k + 1);
    }, 5000);
    return () => clearInterval(t);
  }, []);

  const completedStages = PFD_STAGES.filter(s => elapsedSec * 1000 >= s.durationMs);
  const activeIdx       = Math.min(completedStages.length, PFD_STAGES.length - 1);
  const progressPct     = Math.min(98, Math.round((completedStages.length / PFD_STAGES.length) * 100) + 2);
  const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
  const secs = String(elapsedSec % 60).padStart(2, '0');

  return (
    <div className="mt-5 rounded-2xl overflow-hidden"
      style={{ border:'1px solid #99f6e4', background:'linear-gradient(145deg,#f0fdfa,#ecfeff 50%,#f0f9ff)', animation:'fadeUp 0.45s ease-out both' }}>

      {/* ── Header bar ── */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-3 flex-wrap"
        style={{ borderBottom:'1px solid rgba(153,246,228,0.5)' }}>
        <div className="flex items-center gap-2.5">
          <div className="relative w-5 h-5">
            <div className="absolute inset-0 rounded-full border-2 border-teal-200" />
            <div className="absolute inset-0 rounded-full border-2 border-teal-500 border-t-transparent"
              style={{ animation:'spinSlow 1s linear infinite' }} />
          </div>
          <span className="text-sm font-bold text-slate-800">Analysing PFD Drawing</span>
          {fileName && (
            <span className="hidden sm:inline text-xs text-slate-400 truncate max-w-[200px] font-mono">· {fileName}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono tabular-nums"
          style={{ background:'rgba(255,255,255,0.8)', border:'1px solid #99f6e4' }}>
          <Clock className="w-3.5 h-3.5 text-teal-500" />
          <span className="text-sm font-bold text-teal-700">{mins}:{secs}</span>
        </div>
      </div>

      <div className="px-5 py-5 grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── LEFT: scan-beam illustration + progress ── */}
        <div className="flex flex-col items-center gap-4">

          {/* Scan-beam box — mimics a drawing being scanned */}
          <div className="relative w-full rounded-xl overflow-hidden flex items-center justify-center"
            style={{ background:'rgba(255,255,255,0.6)', border:'1px solid #99f6e4',
                     height:'140px', boxShadow:'inset 0 2px 8px rgba(13,148,136,0.06)' }}>

            {/* Faint PFD grid lines */}
            <div className="absolute inset-0 pointer-events-none opacity-20"
              style={{ backgroundImage:'linear-gradient(rgba(13,148,136,0.4) 1px,transparent 1px),linear-gradient(90deg,rgba(13,148,136,0.4) 1px,transparent 1px)',
                       backgroundSize:'28px 28px' }} />

            {/* Tiny equipment boxes decoration */}
            {[
              { left:'12%', top:'28%', w:32, h:22, label:'V-101' },
              { left:'42%', top:'18%', w:28, h:22, label:'E-201' },
              { left:'68%', top:'32%', w:30, h:22, label:'P-301' },
            ].map((b, i) => (
              <div key={i} className="absolute rounded flex items-center justify-center"
                style={{ left:b.left, top:b.top, width:b.w, height:b.h,
                         background:'rgba(13,148,136,0.08)', border:'1px solid rgba(13,148,136,0.3)' }}>
                <span style={{ fontSize:7, color:'#0d9488', fontFamily:'monospace', fontWeight:700 }}>{b.label}</span>
              </div>
            ))}

            {/* AI brain orb */}
            <div className="relative w-14 h-14 z-10">
              <div className="absolute inset-0 rounded-full flex items-center justify-center"
                style={{ background:'linear-gradient(135deg,#0d9488,#0891b2)', boxShadow:'0 0 28px rgba(13,148,136,0.5)' }}>
                <Cpu className="w-6 h-6 text-white" />
              </div>
              {[
                { color:'#14b8a6', anim:'orbitA 2.2s linear infinite' },
                { color:'#0891b2', anim:'orbitB 2.2s linear infinite' },
                { color:'#10b981', anim:'orbitC 2.2s linear infinite' },
              ].map((o, i) => (
                <span key={i} className="absolute w-2.5 h-2.5 rounded-full"
                  style={{ background:o.color, animation:o.anim, boxShadow:`0 0 6px ${o.color}`,
                    top:'50%', left:'50%', marginTop:'-5px', marginLeft:'-5px' }} />
              ))}
            </div>

            {/* Scan beam sweeping downward */}
            <div className="absolute left-0 right-0 h-[3px] pointer-events-none"
              style={{ background:T.scanBeam, animation:'scanBeam 2.2s ease-in-out infinite', zIndex:20 }} />

            {/* Corner brackets */}
            {[
              'top-2 left-2   border-t-2 border-l-2',
              'top-2 right-2  border-t-2 border-r-2',
              'bottom-2 left-2  border-b-2 border-l-2',
              'bottom-2 right-2 border-b-2 border-r-2',
            ].map((cls, i) => (
              <div key={i} className={`absolute w-5 h-5 pointer-events-none ${cls}`}
                style={{ borderColor:'rgba(13,148,136,0.5)', borderRadius:2 }} />
            ))}
          </div>

          {/* Progress bar with shimmer wave */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-600">
                {PFD_STAGES[activeIdx]?.label || 'Processing…'}
              </span>
              <span className="text-xs font-bold text-teal-600 tabular-nums">{progressPct}%</span>
            </div>
            <div className="relative w-full h-3 rounded-full overflow-hidden"
              style={{ background:'rgba(255,255,255,0.7)', border:'1px solid #99f6e4' }}>
              <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-[2000ms] ease-out overflow-hidden"
                style={{
                  width:`${progressPct}%`,
                  background:'linear-gradient(90deg,#0d9488,#0891b2,#06b6d4)',
                  boxShadow:'0 0 10px rgba(13,148,136,0.5)',
                }}>
                {/* Shimmer wave overlay */}
                <div className="absolute inset-0"
                  style={{
                    background:'linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.5) 50%,transparent 100%)',
                    backgroundSize:'200% 100%',
                    animation:'barWave 1.8s linear infinite',
                  }} />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 text-right">
              {completedStages.length} / {PFD_STAGES.length} stages complete
            </p>
          </div>
        </div>

        {/* ── RIGHT: stage checklist ── */}
        <div className="space-y-1">
          {PFD_STAGES.map((stage, i) => {
            const done    = elapsedSec * 1000 >= stage.durationMs;
            const running = i === activeIdx && !done;
            const Icon    = stage.icon;
            return (
              <div key={stage.id}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-500"
                style={
                  done    ? { background:'rgba(16,185,129,0.07)', border:'1px solid rgba(16,185,129,0.2)'  }
                : running ? { background:'rgba(13,148,136,0.09)', border:'1px solid rgba(13,148,136,0.3)', boxShadow:'0 0 10px rgba(13,148,136,0.1)' }
                :           { background:'transparent',           border:'1px solid transparent' }
                }>
                {done
                  ? <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" style={{ animation:'checkPop 0.35s ease-out both' }} />
                  : running
                    ? <Loader className="w-4 h-4 text-teal-500 flex-shrink-0 animate-spin" />
                    : <Icon className="w-4 h-4 text-slate-300 flex-shrink-0" />}
                <span className={`text-xs font-medium flex-1 ${done ? 'text-emerald-700' : running ? 'text-teal-700 font-semibold' : 'text-slate-400'}`}>
                  {stage.label}
                </span>
                {done    && <span className="text-[10px] text-emerald-500 font-bold">✓</span>}
                {running && (
                  <span className="text-[10px] text-teal-500 font-bold tabular-nums"
                    style={{ animation:'pulse2 1s ease-in-out infinite' }}>running</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Fact card ── */}
      <div className="px-5 pb-5">
        <div className="rounded-xl px-4 py-3 min-h-[52px] flex items-start gap-2.5"
          style={{ background:'rgba(255,255,255,0.65)', border:'1px solid #99f6e4' }}>
          <Zap className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" style={{ animation:'pulse2 2s ease-in-out infinite' }} />
          <p key={factKey} className="text-xs text-slate-600 leading-relaxed"
            style={{ animation:'factSlide 5s ease-in-out forwards' }}>
            <span className="font-bold text-amber-600">Did you know? </span>
            {PFD_FACTS[factIdx]}
          </p>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
const PFDQualityChecker = () => {

  // ── Project management state ──────────────────────────────────────────────
  const [projects,          setProjects]         = useState([]);
  const [loadingProjects,   setLoadingProjects]  = useState(true);
  const [selectedProject,   setSelectedProject]  = useState(null);
  const [showCreateModal,   setShowCreateModal]  = useState(false);
  const [newProjectName,    setNewProjectName]   = useState('');
  const [newProjectDesc,    setNewProjectDesc]   = useState('');
  const [creatingProject,   setCreatingProject]  = useState(false);
  const [showEditModal,     setShowEditModal]    = useState(false);
  const [editingProject,    setEditingProject]   = useState(null);
  const [editName,          setEditName]         = useState('');
  const [editDesc,          setEditDesc]         = useState('');
  const [updatingProject,   setUpdatingProject]  = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm]= useState(false);
  const [deletingProject,   setDeletingProject]  = useState(null);
  const [isDeleting,        setIsDeleting]       = useState(false);
  const [message,           setMessage]          = useState({ type: '', text: '' });

  // ── Upload / verification state ───────────────────────────────────────────
  const [file,          setFile]          = useState(null);
  const [dragOver,      setDragOver]      = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [polling,       setPolling]       = useState(false);
  const [documentId,    setDocumentId]    = useState(null);
  const [docStatus,     setDocStatus]     = useState(null);
  const [results,       setResults]       = useState(null);
  const [error,         setError]         = useState('');
  const [activeDrawing, setActiveDrawing] = useState(null);
  const pollRef = useRef(null);

  // ── Elapsed-time timer (mirrors PIDVerification) ──────────────────────────
  const [elapsedSec, setElapsedSec] = useState(0);
  const timerRef = useRef(null);

  // ── Engineer review overrides ─────────────────────────────────────────────
  const [overrides,       setOverrides]       = useState({});
  const [savingOverrides, setSavingOverrides] = useState(false);
  const [overridesSaved,  setOverridesSaved]  = useState(false);
  const [downloadingXlsx, setDownloadingXlsx] = useState(false);
  const [downloadingPdf,  setDownloadingPdf]  = useState(false);

  // ── History ────────────────────────────────────────────────────────────────
  const [history,        setHistory]        = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ── Right-rail panel navigation (soft-coded PANELS defined inline below) ──
  const [activePanel, setActivePanel] = useState('drawing');

  // ── Findings filters ──────────────────────────────────────────────────────
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus,   setFilterStatus]   = useState('all');

  // ── Drawing image overlay ─────────────────────────────────────────────────
  const [drawingImageUrl,     setDrawingImageUrl]     = useState(null);
  const [drawingImageLoading, setDrawingImageLoading] = useState(false);
  const [drawingImageError,   setDrawingImageError]   = useState(null); // null | 'missing' | 'error'
  const [focusedFindingId,    setFocusedFindingId]    = useState(null);
  const [showHeuristic,       setShowHeuristic]       = useState(true);
  const [reextracting,        setReextracting]        = useState(false);
  // Engineer correction mode — click a finding row to focus it, then click
  // ⊹ Correct Marker to enter crosshair mode and pin the exact drawing location.
  const [correctionMode,     setCorrectionMode]     = useState(false);
  // Stored engineer corrections keyed 'drawingId:findingId' from localStorage.
  const [calibCorrections,   setCalibCorrections]   = useState({});

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => { fetchProjects(); }, []);

  // ── Drawing image loader — refetch when active drawing changes ────────────
  useEffect(() => {
    let objectUrl = null;
    const docId = documentId || results?.document_id;
    if (!docId || !results) { setDrawingImageUrl(null); return; }
    const drawing = results?.drawings?.find(d => d.drawing_id === activeDrawing);
    if (!drawing) { setDrawingImageUrl(null); return; }
    const pageIndex = drawing.page_index ?? 0;
    setDrawingImageLoading(true);
    setDrawingImageUrl(null);
    setDrawingImageError(null);
    axios.get(
      `${API_PREFIX}/drawing-image/${docId}/${pageIndex}/`,
      { headers: authHeader(), responseType: 'blob', timeout: 30000 }
    ).then(res => {
      objectUrl = URL.createObjectURL(res.data);
      setDrawingImageUrl(objectUrl);
      setDrawingImageError(null);
    }).catch(err => {
      setDrawingImageUrl(null);
      setDrawingImageError(err?.response?.status === 404 ? 'missing' : 'error');
    }).finally(() => {
      setDrawingImageLoading(false);
    });
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [documentId, activeDrawing, results?.document_id]);

  // Load stored calibration corrections from localStorage on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PFD_CALIB_STORAGE_KEY);
      if (raw) setCalibCorrections(JSON.parse(raw));
    } catch { /* non-fatal */ }
  }, []);

  // ── Project API ───────────────────────────────────────────────────────────
  const saveCalibration = (next) => {
    setCalibCorrections(next);
    try { localStorage.setItem(PFD_CALIB_STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  const clearDrawingCorrections = () => {
    if (!activeDrawing) return;
    const next = { ...calibCorrections };
    for (const k of Object.keys(next)) {
      if (k.startsWith(`${activeDrawing}:`)) delete next[k];
    }
    saveCalibration(next);
  };

  const exportCalibrationData = () => {
    try {
      const corrections = JSON.parse(localStorage.getItem(PFD_CALIB_STORAGE_KEY) || '{}');
      const stats      = JSON.parse(localStorage.getItem(PFD_CALIB_STATS_KEY)    || '{}');
      const payload = { exportedAt: new Date().toISOString(), corrections, stats };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `pfd_calibration_${Date.now()}.json`;
      a.click(); URL.revokeObjectURL(url);
    } catch {}
  };

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const res = await axios.get(`${API_PREFIX}/projects/`, { headers: authHeader() });
      setProjects(res.data || []);
    } catch {
      flash('error', 'Failed to load projects');
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchHistory = async (projectId) => {
    setLoadingHistory(true);
    try {
      const res = await axios.get(`${API_PREFIX}/list/?project_id=${projectId}`, { headers: authHeader() });
      setHistory(res.data || []);
    } catch {
      // non-fatal
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setCreatingProject(true);
    try {
      const res = await axios.post(`${API_PREFIX}/projects/`, {
        project_name: newProjectName, description: newProjectDesc,
      }, { headers: authHeader() });
      const p = res.data;
      setProjects(prev => [p, ...prev]);
      setShowCreateModal(false);
      setNewProjectName(''); setNewProjectDesc('');
      flash('success', `Project "${p.project_name}" created`);
    } catch (e) {
      flash('error', e.response?.data?.project_name?.[0] || 'Failed to create project');
    } finally {
      setCreatingProject(false);
    }
  };

  const handleUpdateProject = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return;
    setUpdatingProject(true);
    try {
      const res = await axios.put(`${API_PREFIX}/projects/${editingProject.project_id}/`, {
        project_name: editName, description: editDesc,
      }, { headers: authHeader() });
      setProjects(prev => prev.map(p => p.project_id === editingProject.project_id ? res.data : p));
      if (selectedProject?.project_id === editingProject.project_id) setSelectedProject(res.data);
      setShowEditModal(false);
      flash('success', 'Project updated');
    } catch {
      flash('error', 'Failed to update project');
    } finally {
      setUpdatingProject(false);
    }
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await axios.delete(`${API_PREFIX}/projects/${deletingProject.project_id}/`, { headers: authHeader() });
      setProjects(prev => prev.filter(p => p.project_id !== deletingProject.project_id));
      setShowDeleteConfirm(false);
      flash('success', 'Project deleted');
    } catch {
      flash('error', 'Failed to delete project');
    } finally {
      setIsDeleting(false);
    }
  };

  // Delete the currently-viewed document and return to the upload screen
  const deleteCurrentDocument = async () => {
    const docId = documentId || results?.document_id;
    if (!docId) return;
    setIsDeleting(true);
    try {
      await axios.delete(`${API_PREFIX}/delete/${docId}/`, { headers: authHeader() });
      resetUpload();
      setResults(null);
      if (selectedProject) fetchHistory(selectedProject.project_id);
      flash('success', 'Document deleted — please re-upload the PFD drawing');
    } catch {
      flash('error', 'Failed to delete document');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSelectProject = (p) => {
    setSelectedProject(p);
    resetUpload();
    setResults(null);
    fetchHistory(p.project_id);
  };

  const handleBackToProjects = () => {
    clearInterval(pollRef.current);
    clearInterval(timerRef.current);
    setSelectedProject(null);
    setHistory([]);
    resetUpload();
    setResults(null);
    setMessage({ type:'', text:'' });
  };

  // ── Upload / verification API ─────────────────────────────────────────────
  const handleFileChange = (e) => { setFile(e.target.files[0] || null); setError(''); };

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) { setFile(f); setError(''); }
  }, []);

  const handleUpload = async () => {
    if (!file) { setError('Please select a PFD file first.'); return; }
    setError(''); setUploading(true); setResults(null); setDocStatus(null); setDocumentId(null);

    const fd = new FormData();
    fd.append('file', file);
    if (selectedProject) fd.append('project_id', selectedProject.project_id);

    try {
      const res = await axios.post(`${API_PREFIX}/upload-pfd/`, fd, {
        headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      const { document_id, status: s } = res.data;
      setDocumentId(document_id);
      setDocStatus(s);
      if (s === 'completed') {
        await fetchResults(document_id);
      } else {
        startPolling(document_id);
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const startPolling = (docId) => {
    setPolling(true);
    setElapsedSec(0);
    timerRef.current = setInterval(() => setElapsedSec(s => s + 1), 1000);
    pollRef.current = setInterval(async () => {
      try {
        const res = await axios.get(`${API_PREFIX}/status/${docId}/`, { headers: authHeader(), timeout: 15000 });
        const s = res.data.status;
        setDocStatus(s);
        if (s === 'completed') {
          clearInterval(pollRef.current); clearInterval(timerRef.current); setPolling(false);
          await fetchResults(docId);
          if (selectedProject) fetchHistory(selectedProject.project_id);
        } else if (s === 'failed') {
          clearInterval(pollRef.current); clearInterval(timerRef.current); setPolling(false);
          setError(res.data.error_message || 'Processing failed.');
        }
      } catch (_) {}
    }, 3000);
  };

  const fetchResults = async (docId) => {
    try {
      const res = await axios.get(`${API_PREFIX}/results/${docId}/`, { headers: authHeader(), timeout: 30000 });
      setResults(res.data);
      if (res.data.drawings?.length > 0) setActiveDrawing(res.data.drawings[0].drawing_id);
    } catch {
      setError('Failed to load results.');
    }
  };

  const resetUpload = () => {
    clearInterval(pollRef.current);
    clearInterval(timerRef.current);
    setFile(null); setDocumentId(null); setDocStatus(null);
    setError(''); setPolling(false); setActiveDrawing(null);
    setElapsedSec(0);
    setOverrides({}); setOverridesSaved(false);
    setDrawingImageUrl(null); setFocusedFindingId(null);
    setActivePanel('drawing');
  };

  const handleOverrideChange = (findingId, field, value) => {
    setOverrides(prev => ({ ...prev, [findingId]: { ...prev[findingId], [field]: value } }));
    setOverridesSaved(false);
  };

  const handleSaveOverrides = async () => {
    setSavingOverrides(true);
    const count = Object.keys(overrides).length;
    try {
      await Promise.all(
        Object.entries(overrides).map(([id, changes]) =>
          axios.patch(`${API_PREFIX}/findings/${id}/`, changes, { headers: authHeader() })
        )
      );
      setOverridesSaved(true);
      setOverrides({});
      await fetchResults(documentId);
      flash('success', `${count} finding${count !== 1 ? 's' : ''} updated`);
    } catch {
      flash('error', 'Failed to save overrides');
    } finally {
      setSavingOverrides(false);
    }
  };

  const downloadExcel = async () => {
    if (downloadingXlsx) return;
    setDownloadingXlsx(true);
    try {
      const res = await axios.get(`${API_PREFIX}/export/excel/${documentId}/`, {
        headers: authHeader(), responseType: 'blob', timeout: 120000,
      });
      const url = URL.createObjectURL(res.data);
      const a   = document.createElement('a');
      const safeName = (results?.file_name || documentId).replace(/\.[^.]+$/, '').replace(/\s+/g, '_');
      a.href = url; a.download = `pfdq_findings_${safeName}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      flash('error', 'Excel export failed — ' + (e.response?.data?.error || e.message));
    } finally {
      setDownloadingXlsx(false);
    }
  };

  const downloadPDF = async () => {
    if (downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      const res = await axios.get(`${API_PREFIX}/export/pdf/${documentId}/`, {
        headers: authHeader(), responseType: 'blob', timeout: 120000,
      });
      const url = URL.createObjectURL(res.data);
      const a   = document.createElement('a');
      const safeName = (results?.file_name || documentId).replace(/\.[^.]+$/, '').replace(/\s+/g, '_');
      a.href = url; a.download = `pfdq_report_${safeName}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      flash('error', 'PDF export failed — ' + (e.response?.data?.error || e.message));
    } finally {
      setDownloadingPdf(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const flash = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type:'', text:'' }), 3500);
  };

  const activeDrawingData = results?.drawings?.find(d => d.drawing_id === activeDrawing);
  const getVal = (f, field) => overrides[f.id]?.[field] ?? f[field];
  const pendingCount  = Object.keys(overrides).length;
  const allIssues     = results?.drawings?.flatMap(d => d.issues ?? []) ?? [];
  const totalIssues   = results?.total_issues ?? allIssues.length;
  const criticalCount = allIssues.filter(f => getVal(f, 'severity') === 'critical').length;
  const majorCount    = allIssues.filter(f => getVal(f, 'severity') === 'major').length;

  // ── Overlay node builder — positions finding markers on the drawing ─────
  //
  // Priority order per finding:
  //  1. Each individual tag extracted from evidence → real OCR/OCR position
  //     (creates one marker per tag, capped at MAX_TAGS_PER_FINDING)
  //  2. Category-specific semantic zone heuristic (predictable, not random)
  //
  // "all" array support: when backend stores multiple occurrences per tag,
  // pickBestOcc filters to the drawing content area and picks the one nearest
  // the content centroid — avoiding title-block / border / legend hits.
  const buildOverlayNodes = React.useCallback((issues = []) => {
    // ── Soft-coded calibration constants ─────────────────────────────────
    // Shift ALL real-position markers by this offset (% of image dimensions).
    // Tune here if markers are consistently offset in one direction.
    const OVERLAY_CALIB_X_PCT = 0;
    const OVERLAY_CALIB_Y_PCT = 0;

    // Drawing content area bounds.  Positions outside this are likely in the
    // title block / border area — excluded when picking best occurrence.
    // Typical PFD landscape A1: title block occupies right ~16% & bottom ~12%.
    const AREA_X_MIN = 2;
    const AREA_X_MAX = 83;
    const AREA_Y_MIN = 2;
    const AREA_Y_MAX = 87;

    // Content centroid — used to pick the nearest-to-centre occurrence from tag's 'all' array.
    const CONTENT_CX = 45;
    const CONTENT_CY = 40;

    // Maximum individual-tag markers created per finding (prevents dot clouds)
    const MAX_TAGS_PER_FINDING = 6;

    // Soft-coded: category → semantic heuristic zone [left%, top%] used when
    // no real position is available for that finding category.
    const CATEGORY_ZONES = {
      equipment:   [45, 38],
      stream:      [35, 45],
      control:     [55, 35],
      safety:      [40, 22],
      title_block: [87, 88],
      notes:       [20, 55],
      utility:     [60, 55],
    };

    const realPositions = activeDrawingData?.metadata?.tag_positions || {};

    // Pick best occurrence from a tag_positions entry.
    // If 'all' array present: filter to content area → pick nearest centroid.
    // If no 'all' array (legacy format): use direct x_pct/y_pct.
    const pickBestOcc = (pos) => {
      if (!pos) return null;
      if (!pos.all || pos.all.length === 0) {
        return (pos.x_pct != null && pos.y_pct != null) ? pos : null;
      }
      const inArea = pos.all.filter(o =>
        o.x_pct >= AREA_X_MIN && o.x_pct <= AREA_X_MAX &&
        o.y_pct >= AREA_Y_MIN && o.y_pct <= AREA_Y_MAX
      );
      const pool = inArea.length > 0 ? inArea : pos.all;
      let best = pool[0], bestDist = Infinity;
      for (const o of pool) {
        const d = (o.x_pct - CONTENT_CX) ** 2 + (o.y_pct - CONTENT_CY) ** 2;
        if (d < bestDist) { bestDist = d; best = o; }
      }
      return { x_pct: best.x_pct, y_pct: best.y_pct };
    };

    // Apply calibration and clamp to visible canvas
    const applyCalib = (xp, yp) => ({
      left: Math.min(AREA_X_MAX, Math.max(AREA_X_MIN, xp + OVERLAY_CALIB_X_PCT)),
      top:  Math.min(AREA_Y_MAX, Math.max(AREA_Y_MIN, yp + OVERLAY_CALIB_Y_PCT)),
    });

    // Extract individual candidate tags from an evidence string.
    // Returns list of string tokens to look up in realPositions.
    const extractTagsFromEvidence = (str) => {
      const tags = [];
      // Equipment / vessel tags  (V-101, E-201, P-301, K-401 …)
      for (const m of str.matchAll(/\b([VEPKTRFC]-\d{3,4}[A-Z]?)\b/g)) tags.push(m[1]);
      // Control valves  (FCV-101, PCV-201, LCV-301 …)
      for (const m of str.matchAll(/\b((?:FCV|PCV|HCV|LCV|TCV|PV|XCV)-\d{3,4}[A-Z]?)\b/g)) tags.push(m[1]);
      // Relief devices  (PSV-101, PRV-201 …)
      for (const m of str.matchAll(/\b((?:PSV|PRV|SRV|BDV|TSV)-\d{3,4}[A-Z]?)\b/g)) tags.push(m[1]);
      // HOLD items  (HOLD-001, HOLD A …)
      for (const m of str.matchAll(/\b(HOLD[-\s]?\w+)\b/gi)) tags.push(m[1].toUpperCase());
      // Standalone stream numbers (comma-separated digits)
      for (const m of str.matchAll(/(?:^|,\s*)(\d{1,4})(?=\s*(?:,|$))/g)) tags.push(m[1]);
      // Utility labels
      for (const m of str.matchAll(/\b(CW|IA|N2|LP|HP|MW|BFW|COND)\b/g)) tags.push(m[1]);
      return [...new Set(tags)];
    };

    // Stable FNV-1a hash → deterministic fractional offset (same as PIDVerification)
    const stableUnit = (str, salt) => {
      let h = 2166136261 ^ salt;
      for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
      return ((h >>> 0) % 10000) / 10000;
    };

    const bandRank = { low: 1, medium: 2, high: 3 };
    const severityBand = (sev) =>
      sev === 'critical' || sev === 'major' ? 'high' : sev === 'minor' ? 'medium' : 'low';

    const nodes = [];
    const usedKeys = new Set(); // deduplicate markers at the same grid cell

    for (const f of issues) {
      const evidence = f.evidence?.trim() || `${f.rule_id}-${f.sl_no}`;
      const band = severityBand(f.severity);
      const tags = extractTagsFromEvidence(evidence);

      let placed = 0;
      for (const tag of tags.slice(0, MAX_TAGS_PER_FINDING)) {
        const pos = pickBestOcc(realPositions[tag] ?? null);
        if (!pos) continue;
        const { left, top } = applyCalib(pos.x_pct, pos.y_pct);
        const cellKey = `${Math.round(left * 2)},${Math.round(top * 2)}`;
        if (usedKeys.has(cellKey)) continue;
        usedKeys.add(cellKey);
        // Check for stored engineer correction (always wins)
        const corrKey = `${activeDrawing || 'pfd'}:${f.id}`;
        const storedCorr = calibCorrections[corrKey];
        if (storedCorr) {
          nodes.push({ finding: f, band, rawKey: tag, left: storedCorr.correctedLeft, top: storedCorr.correctedTop, anchored: true, tier: 'CX' });
          placed++; break;
        }
        nodes.push({ finding: f, band, rawKey: tag, left, top, anchored: true, tier: 'TAG' });
        placed++;
      }

      // Fallback: use category semantic zone + small hash jitter per finding
      if (placed === 0) {
        // Check engineer correction first
        const corrKey = `${activeDrawing || 'pfd'}:${f.id}`;
        const storedCorr = calibCorrections[corrKey];
        if (storedCorr) {
          nodes.push({ finding: f, band, rawKey: evidence, left: storedCorr.correctedLeft, top: storedCorr.correctedTop, anchored: true, tier: 'CX' });
        } else {
          const zone = CATEGORY_ZONES[f.category] ?? [50, 45];
          const seed = `${activeDrawing || 'pfd'}:${f.rule_id}:${evidence}`;
          const jx = (stableUnit(seed, 11) - 0.5) * 16;
          const jy = (stableUnit(seed, 29) - 0.5) * 16;
          const left = Math.min(AREA_X_MAX, Math.max(AREA_X_MIN, zone[0] + jx));
          const top  = Math.min(AREA_Y_MAX, Math.max(AREA_Y_MIN, zone[1] + jy));
          const cellKey = `${Math.round(left * 2)},${Math.round(top * 2)}`;
          if (!usedKeys.has(cellKey)) {
            usedKeys.add(cellKey);
            nodes.push({ finding: f, band, rawKey: evidence, left, top, anchored: false, tier: 'ZONE' });
          }
        }
      }
    }
    return nodes;
  }, [activeDrawingData, activeDrawing, calibCorrections]);

  const jumpToFinding = (findingId) => {
    setFocusedFindingId(prev => prev === findingId ? null : findingId);
    // Stay on drawing panel — scroll the mini issues list below the drawing
    setTimeout(() => {
      const el = document.getElementById(`pfd-drawing-finding-${findingId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  };

  // Re-extract tag positions for the current document using the improved OCR pipeline
  const reextractPositions = async () => {
    const docId = documentId || results?.document_id;
    if (!docId) return;
    setReextracting(true);
    try {
      await axios.post(`${API_PREFIX}/reextract/${docId}/`, {}, { headers: authHeader() });
      flash('success', 'Marker positions refreshed — reloading results…');
      // Reload results so new tag_positions come back from the server
      await fetchResults(docId);
    } catch {
      flash('error', 'Re-extraction failed. Try re-uploading the drawing.');
    } finally {
      setReextracting(false);
    }
  };

  // Filtered findings for the Findings panel
  const filteredIssues = (activeDrawingData?.issues ?? []).filter(f => {
    if (HIDDEN_CATEGORIES.has(f.category)) return false;
    if (filterSeverity !== 'all' && getVal(f, 'severity') !== filterSeverity) return false;
    if (filterCategory !== 'all' && f.category          !== filterCategory)   return false;
    if (filterStatus   !== 'all' && (getVal(f, 'status') ?? 'open') !== filterStatus) return false;
    return true;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Flash banner
  // ─────────────────────────────────────────────────────────────────────────
  const FlashBanner = () => message.text ? (
    <div className={`mb-5 p-4 rounded-xl border flex items-center gap-3 ${
      message.type === 'success' ? 'bg-teal-50 border-teal-200 text-teal-700'
      : message.type === 'error' ? 'bg-red-50 border-red-200 text-red-700'
      : 'bg-cyan-50 border-cyan-200 text-cyan-700'
    }`}>
      {message.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
      <span className="text-sm">{message.text}</span>
    </div>
  ) : null;

  // ─────────────────────────────────────────────────────────────────────────
  // VIEW 1 — Project selection
  // ─────────────────────────────────────────────────────────────────────────
  if (!selectedProject) {
    return (
      <DarkBg>
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

          {/* ── VIEW 1 hero ── */}
          <div className="mb-10 flex flex-col lg:flex-row lg:items-center gap-8" style={{ animation:'fadeUp 0.6s ease-out both' }}>

            {/* Left: text + badges */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-1 h-7 rounded-full" style={{ background:'linear-gradient(180deg,#0d9488,#0891b2)' }} />
                <span className="text-teal-600 text-xs font-bold tracking-[0.3em] uppercase">AIFlow · Engineering Suite</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-3">
                PFD Quality
                <span className="block" style={{ background:'linear-gradient(90deg,#0d9488,#0891b2)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
                  Rule Engine
                </span>
              </h1>
              <p className="text-slate-500 max-w-xl text-sm sm:text-base mb-4">
                Deterministic 12-rule PFD quality checks — equipment tags, stream numbers, title block, safety devices &amp; more.
              </p>

              {/* ── Animated capability badges (chipPop stagger) ── */}
              <div className="flex flex-wrap gap-2">
                {HERO_BADGES.map((b, i) => (
                  <span key={b.label}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 border rounded-full text-xs font-medium ${b.cls}`}
                    style={{ animation:`chipPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both`, animationDelay:`${0.08 + i * 0.07}s` }}>
                    <span>{b.icon}</span>{b.label}
                  </span>
                ))}
              </div>

              {/* ── Cross-tool link ── */}
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold"
                style={{ animation:'chipPop 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.55s both' }}>
                <Activity className="w-3.5 h-3.5" style={{ animation:'pulse2 2s ease-in-out infinite' }} />
                Cross-linked with
                <a href="/engineering/process/pid-verification"
                  className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-blue-900 transition-colors">
                  P&amp;ID Verification <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Right: animated rule-ring SVG decoration */}
            <div className="flex-none hidden lg:flex items-center justify-center w-44 h-44 relative">
              {/* Outer ring — slow CW */}
              <svg className="absolute inset-0" width="176" height="176" viewBox="0 0 176 176"
                style={{ animation:'spinSlow 22s linear infinite' }}>
                <circle cx="88" cy="88" r="80" fill="none" stroke="rgba(20,184,166,0.18)" strokeWidth="1.5" strokeDasharray="4 6" />
                {RULE_RING_TICKS.map(deg => {
                  const rad = (deg - 90) * Math.PI / 180;
                  const x1 = 88 + 80 * Math.cos(rad), y1 = 88 + 80 * Math.sin(rad);
                  const x2 = 88 + 72 * Math.cos(rad), y2 = 88 + 72 * Math.sin(rad);
                  return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round" />;
                })}
              </svg>
              {/* Inner ring — slow CCW */}
              <svg className="absolute inset-0" width="176" height="176" viewBox="0 0 176 176"
                style={{ animation:'spinSlowRev 16s linear infinite' }}>
                <circle cx="88" cy="88" r="58" fill="none" stroke="rgba(8,145,178,0.20)" strokeWidth="1.5" strokeDasharray="3 9" />
                {RULE_RING_TICKS.filter((_, j) => j % 3 === 0).map(deg => {
                  const rad = (deg - 90) * Math.PI / 180;
                  const x1 = 88 + 58 * Math.cos(rad), y1 = 88 + 58 * Math.sin(rad);
                  const x2 = 88 + 50 * Math.cos(rad), y2 = 88 + 50 * Math.sin(rad);
                  return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0891b2" strokeWidth="1.5" strokeLinecap="round" />;
                })}
              </svg>
              {/* Centre badge */}
              <div className="relative z-10 w-20 h-20 rounded-2xl flex flex-col items-center justify-center"
                style={{ background: T.accent, boxShadow: T.accentShadowLg }}>
                <span className="text-2xl font-black text-white leading-none" style={{ animation:'countUp 0.6s ease-out 0.4s both' }}>12</span>
                <span className="text-[10px] font-semibold text-teal-100 tracking-wider uppercase mt-0.5">Rules</span>
              </div>
            </div>
          </div>

          <FlashBanner />

          <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
            <p className="text-slate-500 text-sm">
              {projects.length > 0
                ? `${projects.length} project${projects.length !== 1 ? 's' : ''} — select one to upload a PFD drawing`
                : 'Create your first project to get started'}
            </p>
            <button onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 font-bold rounded-xl transition-all text-sm text-white hover:-translate-y-px"
              style={{ background: T.accent, boxShadow: T.accentShadow }}>
              <FolderPlus className="w-4 h-4" />New Project
            </button>
          </div>

          {loadingProjects ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 border-2 border-teal-100 rounded-full" />
                <div className="absolute inset-0 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-slate-400 text-sm">Loading projects…</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-2xl p-16 text-center" style={T.card}>
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5 bg-teal-50 border border-teal-100">
                <Package className="w-10 h-10 text-teal-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">No Projects Yet</h3>
              <p className="text-slate-500 text-sm mb-6">Create a project to start uploading and checking PFD drawings</p>
              <button onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 font-bold rounded-xl text-white hover:-translate-y-px transition-all"
                style={{ background: T.accent, boxShadow: T.accentShadow }}>
                <FolderPlus className="w-5 h-5" />Create First Project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {projects.map((p, idx) => (
                <div key={p.project_id} onClick={() => handleSelectProject(p)}
                  className="group relative rounded-2xl p-6 cursor-pointer transition-all duration-300 overflow-hidden"
                  style={{ ...T.card, animation:`cardIn 0.55s ease-out ${0.05 + idx * 0.07}s both` }}
                  onMouseEnter={e => Object.assign(e.currentTarget.style, T.cardH)}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = T.card.boxShadow; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = ''; }}>

                  {/* Animated accent bar — slides in on hover via CSS transition */}
                  <div className="absolute top-0 left-0 right-0 rounded-t-2xl overflow-hidden h-[3px]">
                    <div className="h-full w-0 group-hover:w-full transition-all duration-500 ease-out rounded-t-2xl"
                      style={{ background: T.accent }} />
                  </div>

                  <div className="flex items-start justify-between mb-4">
                    {/* nodeGlow icon — pulses gently on hover */}
                    <div className="w-11 h-11 bg-teal-50 border border-teal-100 rounded-xl flex items-center justify-center transition-colors group-hover:bg-teal-100"
                      style={{ animation:'nodeGlow 3s ease-in-out infinite' }}>
                      <Layers className="w-5 h-5 text-teal-600" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-teal-500 group-hover:translate-x-1 transition-all duration-300" />
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mb-1 group-hover:text-teal-700 transition-colors line-clamp-1">{p.project_name}</h3>
                  {p.description && <p className="text-xs text-slate-400 line-clamp-2 mb-4">{p.description}</p>}
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-100 mb-4">
                    <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" />{p.document_count ?? 0} drawings</span>
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{new Date(p.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={ev => { ev.stopPropagation(); setEditingProject(p); setEditName(p.project_name); setEditDesc(p.description||''); setShowEditModal(true); }}
                      className="flex-1 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1.5 text-xs font-medium">
                      <Edit className="w-3.5 h-3.5" />Edit
                    </button>
                    <button onClick={ev => { ev.stopPropagation(); setDeletingProject(p); setShowDeleteConfirm(true); }}
                      className="flex-1 px-3 py-1.5 bg-red-50 border border-red-100 text-red-500 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5 text-xs font-medium">
                      <Trash2 className="w-3.5 h-3.5" />Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              BOTTOM SECTION — fills the page so it never looks empty
          ══════════════════════════════════════════════════════════════════ */}

          {/* Divider with centred label */}
          <div className="relative flex items-center my-12">
            <div className="flex-1 h-px" style={{ background:'linear-gradient(90deg,transparent,#99f6e4,transparent)' }} />
            <span className="mx-4 text-xs font-bold text-teal-600 tracking-[0.25em] uppercase px-3 py-1.5 rounded-full"
              style={{ background:'rgba(240,253,250,0.9)', border:'1px solid #99f6e4' }}>
              How the Engine Works
            </span>
            <div className="flex-1 h-px" style={{ background:'linear-gradient(90deg,transparent,#99f6e4,transparent)' }} />
          </div>

          {/* ── How It Works — 3 animated step cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
            {HOW_IT_WORKS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.step} className="relative rounded-2xl p-6 overflow-hidden"
                  style={{ background: step.bg, border:`1px solid ${step.border}`,
                    animation:`cardIn 0.55s ease-out ${0.1 + i * 0.12}s both` }}>

                  {/* Large ghost step number */}
                  <span className="absolute -top-2 -right-1 text-[80px] font-black leading-none select-none pointer-events-none"
                    style={{ color: step.accent, opacity: 0.07 }}>{step.step}</span>

                  {/* Animated accent bar top */}
                  <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl"
                    style={{ background:`linear-gradient(90deg,${step.accent},${step.accent}80)`,
                      backgroundSize:'200% auto', animation:'gradShift 3s linear infinite' }} />

                  {/* Icon */}
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                    style={{ background:'rgba(255,255,255,0.7)', border:`1px solid ${step.border}`,
                      boxShadow:`0 4px 14px ${step.glow}`, animation:'nodeGlow 4s ease-in-out infinite' }}>
                    <Icon className="w-6 h-6" style={{ color: step.accent }} />
                  </div>

                  {/* Step pill */}
                  <span className="inline-block text-[10px] font-black tracking-[0.2em] uppercase px-2 py-0.5 rounded-full mb-2"
                    style={{ background: step.accent, color:'#fff', opacity:0.9 }}>Step {step.step}</span>

                  <h3 className="text-sm font-black text-slate-900 mb-1.5">{step.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>

                  {/* Connector arrow (not on last) */}
                  {i < HOW_IT_WORKS.length - 1 && (
                    <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 hidden md:flex items-center justify-center z-10">
                      <ChevronRight className="w-5 h-5 text-teal-500" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Rule Coverage Grid ── */}
          <div className="rounded-2xl overflow-hidden mb-4"
            style={{ background:'rgba(255,255,255,0.80)', border:'1px solid #e2e8f0',
              backdropFilter:'blur(12px)', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>

            {/* Header */}
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: T.accent, boxShadow:'0 3px 10px rgba(13,148,136,0.28)' }}>
                <Shield className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-sm font-black text-slate-900">Quality Rules Coverage</h2>
              <span className="ml-auto text-[10px] font-bold text-teal-600 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                12 Rules · ISO 10628
              </span>
            </div>

            {/* 4-col tile grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-slate-100">
              {RULE_COVERAGE.map((rule, i) => (
                <div key={rule.label}
                  className="flex items-start gap-3 px-4 py-4 hover:bg-teal-50/40 transition-colors"
                  style={{ animation:`fadeUp 0.45s ease-out ${0.05 + i * 0.06}s both` }}>
                  <span className="text-xl flex-shrink-0 mt-0.5">{rule.icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 leading-tight">{rule.label}</p>
                    <p className="text-[10px] text-slate-400 leading-snug mt-0.5">{rule.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Bottom standards strip ── */}
          <div className="rounded-2xl px-6 py-4 flex flex-wrap items-center justify-between gap-3 mb-2"
            style={{ background:'linear-gradient(135deg,rgba(240,253,250,0.8),rgba(236,254,255,0.8))',
              border:'1px solid #99f6e4' }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: T.accent, boxShadow:'0 3px 10px rgba(13,148,136,0.30)' }}>
                <Activity className="w-4 h-4 text-white" style={{ animation:'pulse2 2s ease-in-out infinite' }} />
              </div>
              <div>
                <p className="text-xs font-black text-slate-900">AI-Powered · Standards-Compliant</p>
                <p className="text-[10px] text-slate-500">ISO 10628-1 &amp; -2 · ISA-S5.1 · IEC 61511</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {['PDF Export','Excel Export','Drawing Overlay','Cross-Ref P&ID'].map((tag, i) => (
                <span key={tag} className="text-[10px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-full"
                  style={{ animation:`chipPop 0.4s ease-out ${0.1 + i * 0.07}s both` }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <DarkModal show={showCreateModal} onClose={() => { setShowCreateModal(false); setNewProjectName(''); setNewProjectDesc(''); }}
            title="Create New Project" subtitle="Set up a folder for your PFD quality drawings"
            iconEl={<div className="w-9 h-9 bg-teal-50 border border-teal-200 rounded-lg flex items-center justify-center"><FolderPlus className="w-4 h-4 text-teal-600" /></div>}>
            <form onSubmit={handleCreateProject} className="space-y-4 flex-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Project Name *</label>
                <input type="text" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="e.g., ADNOC Trunkline PFD Review"
                  className="w-full px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-teal-400/40 text-slate-900 placeholder-slate-400 text-sm outline-none transition-all" style={T.input} required autoFocus />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Description (Optional)</label>
                <textarea value={newProjectDesc} onChange={e => setNewProjectDesc(e.target.value)} placeholder="Brief project description…" rows="3"
                  className="w-full px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-teal-400/40 text-slate-900 placeholder-slate-400 text-sm resize-none outline-none transition-all" style={T.input} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowCreateModal(false); setNewProjectName(''); setNewProjectDesc(''); }}
                  className="flex-1 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg font-medium text-sm transition-colors">Cancel</button>
                <button type="submit" disabled={creatingProject}
                  className="flex-1 px-4 py-2.5 disabled:opacity-50 text-white font-bold rounded-lg flex items-center justify-center gap-2 text-sm transition-all hover:-translate-y-px"
                  style={{ background: T.accent }}>
                  {creatingProject ? <><Loader className="w-4 h-4 animate-spin" />Creating…</> : <><CheckCircle className="w-4 h-4" />Create Project</>}
                </button>
              </div>
            </form>
          </DarkModal>

          <DarkModal show={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Project"
            iconEl={<div className="w-9 h-9 bg-cyan-50 border border-cyan-200 rounded-lg flex items-center justify-center"><Edit className="w-4 h-4 text-cyan-600" /></div>}>
            <form onSubmit={handleUpdateProject} className="space-y-4 flex-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Project Name *</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-teal-400/40 text-slate-900 text-sm outline-none transition-all" style={T.input} required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Description</label>
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows="3"
                  className="w-full px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-teal-400/40 text-slate-900 text-sm resize-none outline-none transition-all" style={T.input} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg font-medium text-sm transition-colors">Cancel</button>
                <button type="submit" disabled={updatingProject}
                  className="flex-1 px-4 py-2.5 disabled:opacity-50 text-white font-bold rounded-lg flex items-center justify-center gap-2 text-sm transition-all hover:-translate-y-px"
                  style={{ background: T.accent }}>
                  {updatingProject ? <><Loader className="w-4 h-4 animate-spin" />Updating…</> : 'Update Project'}
                </button>
              </div>
            </form>
          </DarkModal>

          <DarkModal show={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Project"
            iconEl={<div className="w-9 h-9 bg-red-50 border border-red-200 rounded-lg flex items-center justify-center"><Trash2 className="w-4 h-4 text-red-500" /></div>}>
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-5">
              <p className="text-sm text-slate-600 mb-1">Permanently deleting:</p>
              <p className="font-bold text-slate-900">{deletingProject?.project_name}</p>
              <p className="text-xs text-red-500 mt-2">All drawings will become unassigned. This cannot be undone.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}
                className="flex-1 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg font-medium text-sm transition-colors">Cancel</button>
              <button onClick={confirmDelete} disabled={isDeleting}
                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold rounded-lg flex items-center justify-center gap-2 text-sm transition-colors">
                {isDeleting ? <><Loader className="w-4 h-4 animate-spin" />Deleting…</> : <><Trash2 className="w-4 h-4" />Delete</>}
              </button>
            </div>
          </DarkModal>

        </div>
      </DarkBg>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VIEW 2 — Upload + Results (inside a project)
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <DarkBg>
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 pb-14 pt-6">

        {/* ── Dashboard hero header (aligned with PIDVerification) ────────── */}
        <div className="rounded-2xl mb-6 overflow-hidden"
          style={{ background:'linear-gradient(135deg,rgba(240,253,250,0.98),rgba(236,254,255,0.98))',
                   border:'1px solid #99f6e4', backdropFilter:'blur(16px)',
                   boxShadow:'0 1px 3px rgba(0,0,0,0.04)', animation:'fadeUp 0.4s ease-out both' }}>
          <div className="px-5 py-4 flex items-center gap-4 flex-wrap">
            <button onClick={handleBackToProjects}
              className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-xl transition-all text-sm shadow-sm flex-shrink-0">
              <ArrowLeft className="w-4 h-4" />Projects
            </button>
            <div className="w-px h-8 bg-teal-200 flex-shrink-0 hidden sm:block" />
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: T.accent, boxShadow:'0 4px 12px rgba(13,148,136,0.3)' }}>
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-teal-600 font-bold tracking-widest uppercase leading-none mb-0.5">PFD Quality Review · Engineering Suite</p>
              <h1 className="text-xl font-black text-slate-900 truncate leading-tight">{selectedProject.project_name}</h1>
            </div>
            <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
              {[
                { label:'12 Rules',   cls:'text-teal-700 bg-teal-50 border-teal-200'           },
                { label:'ISO 10628',  cls:'text-cyan-700 bg-cyan-50 border-cyan-200'           },
                { label:'AI Engine',  cls:'text-emerald-700 bg-emerald-50 border-emerald-200'  },
              ].map(p => (
                <span key={p.label} className={`text-xs font-semibold border px-2.5 py-1 rounded-full ${p.cls}`}>{p.label}</span>
              ))}
            </div>
            {/* Interconnect — jump to matching P&ID verification */}
            <a href="/engineering/process/pid-verification"
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl transition-all text-xs font-semibold flex-shrink-0">
              <Activity className="w-3.5 h-3.5" />P&amp;ID Verify
              <ExternalLink className="w-3 h-3" />
            </a>
            <button onClick={() => { fetchHistory(selectedProject.project_id); setActivePanel('history'); }}
              className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-xl transition-all text-sm shadow-sm flex-shrink-0">
              <BarChart2 className="w-4 h-4" />History
            </button>
          </div>
          <div className="h-0.5" style={{ backgroundImage:T.gradBar, backgroundSize:'200% auto', animation:'gradShift 4s linear infinite' }} />
        </div>

        <FlashBanner />

        {/* ── Upload card ──────────────────────────────────────────────────── */}
        {!results && (
          <div className="rounded-2xl p-5 sm:p-6 mb-5" style={{ ...T.panel, animation:'fadeUp 0.5s ease-out 0.2s both' }}>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">PFD Drawing (PDF) *</label>

            {/* ── AI Document Assist (Wrench) — soft-coded, optional ─────── */}
            {PFDQ_AI_ASSIST_CONFIG.enabled && (
              <div className="mb-4">
                <WrenchAiDocAssist
                  title={PFDQ_AI_ASSIST_CONFIG.title}
                  subtitleTag={PFDQ_AI_ASSIST_CONFIG.subtitleTag}
                  subtitle={PFDQ_AI_ASSIST_CONFIG.subtitle}
                  defaultHint={PFDQ_AI_ASSIST_CONFIG.defaultHint}
                  hintPlaceholder={PFDQ_AI_ASSIST_CONFIG.hintPlaceholder}
                  topN={PFDQ_AI_ASSIST_CONFIG.topN}
                  acceptedExts={PFDQ_AI_ASSIST_CONFIG.acceptedExts}
                  projectName={selectedProject?.project_name || ''}
                  onFileSelected={(f) => { setFile(f); setError(''); }}
                  onError={(msg) => setError(msg)}
                />
              </div>
            )}

            {/* ── Drop zone with circuit-trace border animation ── */}
            <div className="relative"
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('pfdq-file-input').click()}>

              {/* Circuit trace lines — only visible when not dragging */}
              {!dragOver && !file && (<>
                <div className="absolute top-0 left-0 right-0 h-[2px] pointer-events-none overflow-hidden rounded-t-xl">
                  <div className="absolute h-full rounded-full"
                    style={{ background: T.trace, width:'40%', animation:'traceH 3.5s ease-in-out infinite' }} />
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-[2px] pointer-events-none overflow-hidden rounded-b-xl">
                  <div className="absolute h-full rounded-full"
                    style={{ background: T.trace, width:'40%', animation:'traceH 3.5s ease-in-out infinite 1.75s' }} />
                </div>
                <div className="absolute top-0 bottom-0 left-0 w-[2px] pointer-events-none overflow-hidden rounded-l-xl">
                  <div className="absolute w-full rounded-full"
                    style={{ background: T.trace, height:'35%', animation:'traceV 3.5s ease-in-out infinite 0.5s' }} />
                </div>
                <div className="absolute top-0 bottom-0 right-0 w-[2px] pointer-events-none overflow-hidden rounded-r-xl">
                  <div className="absolute w-full rounded-full"
                    style={{ background: T.trace, height:'35%', animation:'traceV 3.5s ease-in-out infinite 2.25s' }} />
                </div>
              </>)}

              {/* Corner brackets */}
              {(['top-0 left-0','top-0 right-0','bottom-0 left-0','bottom-0 right-0']).map((pos, i) => (
                <div key={i} className={`absolute ${pos} w-4 h-4 pointer-events-none`}>
                  <div className="absolute top-0 left-0 w-full h-[2px] rounded-full" style={{ background: T.accentHex, opacity: 0.5 }} />
                  <div className="absolute top-0 left-0 h-full w-[2px] rounded-full" style={{ background: T.accentHex, opacity: 0.5 }} />
                </div>
              ))}

              <div className={`border-2 border-dashed rounded-xl p-10 text-center transition-all duration-300 cursor-pointer ${
                dragOver ? 'border-cyan-400 bg-cyan-50 shadow-lg shadow-cyan-200/60'
                : file    ? 'border-teal-400 bg-teal-50'
                :           'border-slate-300 hover:border-teal-400 bg-white hover:bg-teal-50/40'
              }`}>
                {/* Scan beam overlay when file is loaded */}
                {file && (
                  <div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden">
                    <div className="absolute inset-x-0 h-16 pointer-events-none"
                      style={{ background: T.scanBeam, animation:'scanBeam 2.5s ease-in-out infinite' }} />
                  </div>
                )}

                <div className={`w-14 h-14 mx-auto mb-3 rounded-xl flex items-center justify-center transition-all ${
                  dragOver ? 'bg-cyan-100 animate-bounce' : file ? 'bg-teal-50 border border-teal-200' : 'bg-teal-50 border border-teal-200'
                }`}>
                  {file
                    ? <FileText className="w-7 h-7 text-teal-500" />
                    : <UploadIcon className={`w-7 h-7 ${dragOver ? 'text-cyan-500' : 'text-teal-500'}`} />}
                </div>
                <p className="text-sm font-semibold text-slate-700 mb-1">
                  {file ? file.name : dragOver ? 'Drop your PFD here' : 'Drag & drop or click to upload'}
                </p>
                <p className="text-xs text-slate-400">{file ? `${(file.size/1024/1024).toFixed(2)} MB` : 'PDF, PNG, JPG, TIFF · Max 50 MB'}</p>
                <input id="pfdq-file-input" type="file" accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif" className="hidden" onChange={handleFileChange} />
              </div>
            </div>

            {file && (
              <div className="mt-3 flex items-center gap-2 bg-white border border-teal-200 rounded-xl px-4 py-2.5">
                <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span className="text-sm font-medium text-slate-800 truncate flex-1">{file.name}</span>
                <button onClick={e => { e.stopPropagation(); setFile(null); }} className="p-1 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {error && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button onClick={handleUpload} disabled={uploading || !file}
              className={`mt-5 w-full py-3 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                uploading || !file ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                : 'text-white shadow-lg hover:-translate-y-px active:translate-y-0'
              }`}
              style={uploading || !file ? undefined : { background: T.accent, boxShadow: T.accentShadow }}>
              {uploading ? <><Loader className="w-4 h-4 animate-spin" />Uploading…</> : <><Cpu className="w-4 h-4" />Run PFD Quality Check</>}
            </button>

            {/* Rich AnalysisLoader — mirrors PIDVerification's processing state UI */}
            {(polling || docStatus === 'processing') && (
              <AnalysisLoader elapsedSec={elapsedSec} fileName={file?.name} />
            )}
          </div>
        )}

        {/* ── "What Gets Checked" info panel — shown only before results load ── */}
        {!results && !polling && docStatus !== 'processing' && (
          <div className="rounded-2xl overflow-hidden mb-5"
            style={{ background:'rgba(255,255,255,0.80)', border:'1px solid #e2e8f0',
              backdropFilter:'blur(12px)', animation:'fadeUp 0.5s ease-out 0.35s both' }}>

            {/* Header row */}
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: T.accent, boxShadow:'0 3px 10px rgba(13,148,136,0.28)' }}>
                <Shield className="w-3.5 h-3.5 text-white" />
              </div>
              <h2 className="text-xs font-black text-slate-700 uppercase tracking-wider">What Gets Checked</h2>
              <span className="ml-auto text-[10px] font-bold text-teal-600 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                12 Deterministic Rules
              </span>
            </div>

            {/* 3-col checks grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
              {CHECKS_PREVIEW.map((check, i) => {
                const Icon = check.icon;
                return (
                  <div key={check.label} className="flex items-center gap-3 px-4 py-3.5 hover:bg-teal-50/30 transition-colors"
                    style={{ animation:`fadeUp 0.4s ease-out ${0.05 + i * 0.07}s both` }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background:'rgba(240,253,250,0.9)', border:'1px solid #ccfbf1' }}>
                      <Icon className="w-4 h-4 text-teal-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 leading-none">{check.label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{check.desc}</p>
                    </div>
                    <div className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: T.accentHex, animation:'pulse2 2s ease-in-out infinite', animationDelay:`${i * 0.25}s` }} />
                  </div>
                );
              })}
            </div>

            {/* Mini standards strip */}
            <div className="px-5 py-2.5 border-t border-slate-100 flex items-center gap-2 flex-wrap"
              style={{ background:'rgba(240,253,250,0.5)' }}>
              <span className="text-[10px] text-slate-500 font-medium">Standards:</span>
              {['ISO 10628-1','ISO 10628-2','ISA-S5.1','IEC 61511'].map(s => (
                <span key={s} className="text-[10px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── Results section — icon-rail panel navigation ─────────────────── */}
        {results && (() => {
          // ── SOFT-CODED panel definitions ────────────────────────────────────
          // Add a new entry here to create a new panel tab. No other changes needed.
          const overlayNodes    = buildOverlayNodes(activeDrawingData?.issues ?? []);
          const visibleNodes     = overlayNodes.filter(n => showHeuristic || n.anchored);

          // Auto-record per-drawing tier stats to localStorage (runs on first render per drawing)
          (() => {
            if (!activeDrawing || overlayNodes.length === 0) return;
            try {
              const tc = {};
              for (const n of overlayNodes) { const t = n.tier || 'ZONE'; tc[t] = (tc[t] || 0) + 1; }
              const raw = localStorage.getItem(PFD_CALIB_STATS_KEY);
              const all = raw ? JSON.parse(raw) : {};
              if (!all[activeDrawing]) {
                all[activeDrawing] = { drawingId: activeDrawing, timestamp: new Date().toISOString(), totalFindings: overlayNodes.length, tierCounts: tc, anchoredCount: overlayNodes.filter(n => n.anchored).length, correctedCount: overlayNodes.filter(n => n.tier === 'CX').length };
                localStorage.setItem(PFD_CALIB_STATS_KEY, JSON.stringify(all));
              }
            } catch {}
          })();

          // Soft-coded: severity → fill colour for overlay dots
          const SEV_COLOR = {
            critical: { bg:'#dc2626', border:'#991b1b', glow:'rgba(220,38,38,0.5)' },
            major:    { bg:'#f97316', border:'#c2410c', glow:'rgba(249,115,22,0.5)' },
            minor:    { bg:'#fbbf24', border:'#d97706', glow:'rgba(251,191,36,0.4)' },
            info:     { bg:'#0d9488', border:'#0f766e', glow:'rgba(13,148,136,0.4)' },
          };

          const PANELS = [
            {
              id: 'drawing',
              label: 'Drawing',
              icon: ({ cls }) => <Eye className={cls} />,
              badge: visibleNodes.length || null,
              badgeCls: 'bg-teal-600 text-white',
              accent: '#0d9488',
              glow:   'rgba(13,148,136,0.25)',
            },
            {
              id: 'findings',
              label: 'Findings',
              icon: ({ cls }) => <GitBranch className={cls} />,
              badge: totalIssues || null,
              badgeCls: totalIssues > 0 ? 'bg-red-500 text-white' : 'bg-green-500 text-white',
              accent: '#ef4444',
              glow:   'rgba(239,68,68,0.25)',
            },
            {
              id: 'summary',
              label: 'Summary',
              icon: ({ cls }) => <BarChart2 className={cls} />,
              badge: results.drawings?.length || null,
              badgeCls: 'bg-teal-500 text-white',
              accent: '#0d9488',
              glow:   'rgba(13,148,136,0.25)',
            },
            {
              id: 'cross',
              label: 'Cross-Ref',
              icon: ({ cls }) => <Activity className={cls} />,
              badge: null,
              accent: '#f59e0b',
              glow:   'rgba(245,158,11,0.25)',
            },
            {
              id: 'history',
              label: 'History',
              icon: ({ cls }) => <Clock className={cls} />,
              badge: history.length || null,
              badgeCls: 'bg-slate-500 text-white',
              accent: '#64748b',
              glow:   'rgba(100,116,139,0.25)',
            },
            {
              id: 'performance',
              label: 'Accuracy',
              icon: ({ cls }) => <Zap className={cls} />,
              badge: null,
              accent: '#0d9488',
              glow:   'rgba(13,148,136,0.28)',
            },
          ];

          return (
          <div className="flex gap-4 items-start" style={{ animation:'fadeUp 0.5s ease-out 0.05s both' }}>

            {/* ── ICON RAIL — left sidebar navigation ──────────────────────── */}
            <div className="flex flex-col gap-1 py-3 px-2 rounded-2xl sticky top-6 flex-shrink-0"
              style={{ background:'rgba(255,255,255,0.9)', border:'1px solid #d1fae5',
                       backdropFilter:'blur(12px)', boxShadow:'0 2px 12px rgba(13,148,136,0.08)',
                       animation:'railIn 0.3s ease-out both', width:`${PFD_NAV_RAIL_WIDTH}px` }}>
              {PANELS.map((p, pIdx) => {
                const Icon     = p.icon;
                const isActive = activePanel === p.id;
                return (
                  <button key={p.id} onClick={() => setActivePanel(p.id)}
                    className="relative flex items-center gap-2 pl-2.5 pr-3 py-2.5 rounded-xl w-full transition-all duration-200"
                    style={{
                      animation:`navTabIn ${PFD_NAV_RAIL_ENTRY_DURATION_MS}ms cubic-bezier(0.22,1,0.36,1) both`,
                      animationDelay:`${pIdx * PFD_NAV_RAIL_ENTRY_DELAY_MS}ms`,
                      ...(isActive
                        ? { background:`linear-gradient(135deg,${p.accent},${p.accent}cc)`,
                            boxShadow:`0 4px 14px ${p.glow}, 0 1px 3px rgba(0,0,0,0.08)`,
                            border:`1px solid ${p.accent}` }
                        : { background:'#ffffff', border:'1px solid #e2e8f0' }),
                    }}>
                    {/* Icon chip */}
                    <span className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center"
                      style={isActive
                        ? { background:'rgba(255,255,255,0.22)' }
                        : { background:`${p.accent}14`, border:`1px solid ${p.accent}28` }}>
                      <span style={{ color: isActive ? '#ffffff' : p.accent }}>
                        <Icon cls="w-3.5 h-3.5 flex-shrink-0" />
                      </span>
                    </span>
                    {/* Label — always full width; badge floats absolute */}
                    <span className={`text-[10px] font-bold uppercase tracking-normal leading-none whitespace-nowrap ${isActive ? 'text-white' : 'text-slate-600'}`}>
                      {p.label}
                    </span>
                    {/* Badge — absolute so it never steals label space */}
                    {p.badge !== null && p.badge !== undefined && (
                      <span className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-black px-1 ${
                        isActive ? 'bg-white text-slate-700' : (p.badgeCls || 'bg-teal-500 text-white')
                      }`}>
                        {p.badge > 99 ? '99+' : p.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── CONTENT AREA ────────────────────────────────────────────── */}
            <div className="flex-1 min-w-0 space-y-4">

              {/* ── Results hero banner ── */}
              <div className="relative rounded-2xl overflow-hidden" style={{ animation:'fadeUp 0.35s ease-out both' }}>
                <div className="px-5 py-4 flex items-center gap-4 flex-wrap"
                  style={{ background:'linear-gradient(135deg,#f0fdfa,#ecfeff,#f0f9ff)', border:'1px solid #99f6e4' }}>
                  {/* Status icon */}
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: totalIssues > 0 ? 'linear-gradient(135deg,#fef2f2,#fee2e2)' : 'linear-gradient(135deg,#f0fdf4,#dcfce7)',
                             border:`1px solid ${totalIssues > 0 ? '#fca5a5' : '#86efac'}` }}>
                    {totalIssues > 0 ? <AlertTriangle className="w-5 h-5 text-red-500" /> : <CheckCircle className="w-5 h-5 text-green-500" style={{ animation:'checkPop 0.4s ease-out both' }} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-0.5">Analysis Complete</p>
                    <p className="text-sm font-bold text-slate-800 truncate max-w-[260px]" title={results.file_name}>{results.file_name}</p>
                  </div>
                  {/* Stat chips with countUp animation */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {[
                      { v: results.drawings?.length ?? 0, label:'Drawings',
                        color:'text-teal-700', bg:'rgba(20,184,166,0.10)', border:'rgba(20,184,166,0.22)', glow:'' },
                      { v: totalIssues, label:'Issues',
                        color: totalIssues > 0 ? 'text-red-700' : 'text-green-700',
                        bg: totalIssues > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
                        border: totalIssues > 0 ? 'rgba(239,68,68,0.18)' : 'rgba(34,197,94,0.18)',
                        glow: totalIssues > 0 ? '0 0 10px rgba(239,68,68,0.15)' : '' },
                      { v: criticalCount, label:'Critical',
                        color:'text-red-800', bg:'rgba(220,38,38,0.09)', border:'rgba(220,38,38,0.20)',
                        glow: criticalCount > 0 ? '0 0 12px rgba(220,38,38,0.22)' : '' },
                      { v: majorCount, label:'Major',
                        color:'text-orange-700', bg:'rgba(234,88,12,0.08)', border:'rgba(234,88,12,0.18)',
                        glow: majorCount > 0 ? '0 0 12px rgba(234,88,12,0.18)' : '' },
                    ].map((chip, ci) => (
                      <div key={chip.label} className="rounded-xl px-3 py-2 text-center flex-shrink-0 transition-all"
                        style={{ background:chip.bg, border:`1px solid ${chip.border}`, minWidth:'62px',
                          boxShadow: chip.glow || undefined,
                          animation:`countUp 0.5s ease-out ${0.1 + ci * 0.08}s both` }}>
                        <p className={`font-black text-lg leading-none ${chip.color}`}>{chip.v}</p>
                        <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{chip.label}</p>
                      </div>
                    ))}
                  </div>
                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-wrap ml-auto">
                    <button onClick={downloadExcel} disabled={downloadingXlsx}
                      className="flex items-center gap-1.5 text-xs font-bold text-white px-3 py-2 rounded-xl transition-all hover:-translate-y-px disabled:opacity-60"
                      style={{ background:'linear-gradient(135deg,#059669,#10b981)', boxShadow:'0 3px 10px rgba(16,185,129,0.25)' }}>
                      {downloadingXlsx ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}Excel
                    </button>
                    <button onClick={downloadPDF} disabled={downloadingPdf}
                      className="flex items-center gap-1.5 text-xs font-bold text-white px-3 py-2 rounded-xl transition-all hover:-translate-y-px disabled:opacity-60"
                      style={{ background:'linear-gradient(135deg,#dc2626,#ef4444)', boxShadow:'0 3px 10px rgba(239,68,68,0.25)' }}>
                      {downloadingPdf ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}PDF
                    </button>
                    <button onClick={() => { resetUpload(); setResults(null); setActivePanel('findings'); }}
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-xl transition-all">
                      <RefreshCw className="w-3.5 h-3.5" />New
                    </button>
                  </div>
                </div>
                {/* Gradient bar at bottom of hero */}
                <div className="h-[3px]" style={{ backgroundImage: T.gradBar, backgroundSize:'300% auto', animation:'gradShift 3s linear infinite' }} />
              </div>

              {/* Drawing tabs */}
              {results.drawings?.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {results.drawings.map(d => (
                    <button key={d.drawing_id} onClick={() => setActiveDrawing(d.drawing_id)}
                      className={`text-sm px-4 py-1.5 rounded-full border font-medium transition-all ${
                        activeDrawing === d.drawing_id ? 'text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-teal-400'
                      }`}
                      style={activeDrawing === d.drawing_id ? { background: T.accent } : undefined}>
                      {d.drawing_id}
                      <span className={`ml-1.5 text-xs font-semibold ${activeDrawing === d.drawing_id ? 'text-teal-100' : 'text-slate-400'}`}>({d.issue_count})</span>
                    </button>
                  ))}
                </div>
              )}

              {/* ═══ PANEL BODIES ═══ */}
              <div key={activePanel} style={{ animation:'panelSlide 0.25s ease-out both' }}>

              {/* ─── DRAWING panel ────────────────────────────────── */}
              {activePanel === 'drawing' && (
              <div className="rounded-2xl overflow-hidden" style={T.card}>
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-teal-50 border border-teal-200 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Eye className="w-4 h-4 text-teal-600" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">{activeDrawing} — Drawing Overlay</h2>
                      <p className="text-xs text-slate-500">
                        {visibleNodes.filter(n => n.anchored).length} anchored · {visibleNodes.filter(n => !n.anchored).length} heuristic
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-3 text-[10px] text-slate-500">
                      {[['critical','#dc2626'],['major','#f97316'],['minor','#fbbf24'],['info','#0d9488']].map(([sev, col]) => (
                        <span key={sev} className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background:col }} />
                          {sev[0].toUpperCase()+sev.slice(1)}
                        </span>
                      ))}
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full border-2 border-dashed border-slate-400 flex-shrink-0" />
                        Heuristic
                      </span>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
                      <input type="checkbox" checked={showHeuristic} onChange={e => setShowHeuristic(e.target.checked)}
                        className="w-3.5 h-3.5 accent-teal-500" />
                      Show heuristic
                    </label>
                    <button onClick={reextractPositions} disabled={reextracting}
                      title="Re-run OCR extraction to place markers at exact locations"
                      className="flex items-center gap-1 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1.5 rounded-lg hover:bg-teal-100 transition-colors disabled:opacity-50">
                      {reextracting ? <Loader className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      {reextracting ? 'Scanning…' : 'Refresh Markers'}
                    </button>
                    <button onClick={() => setActivePanel('findings')}
                      className="text-xs text-teal-600 hover:text-teal-800 underline underline-offset-2 transition-colors">
                      View table
                    </button>
                    {/* Correction mode — pin exact marker location */}
                    <button
                      onClick={() => setCorrectionMode(v => !v)}
                      disabled={!focusedFindingId}
                      title={focusedFindingId ? 'Click drawing to pin marker at exact location' : 'Click a finding below first'}
                      className={`text-[10px] px-2 py-1 rounded border font-semibold transition-colors ${
                        correctionMode
                          ? 'bg-amber-400 text-white border-amber-500'
                          : focusedFindingId
                            ? 'bg-white text-slate-600 border-slate-300 hover:border-amber-400 hover:text-amber-700'
                            : 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                      }`}
                    >
                      {correctionMode ? '⊕ Click drawing…' : '⊕ Correct Marker'}
                    </button>
                    <button
                      onClick={exportCalibrationData}
                      title="Export correction records and tier stats as JSON"
                      className="text-[10px] px-2 py-1 rounded border font-semibold bg-white text-slate-600 border-slate-300 hover:border-teal-400 hover:text-teal-600 transition-colors"
                    >
                      ↓ Export Data
                    </button>
                    {activeDrawing && Object.keys(calibCorrections).some(k => k.startsWith(`${activeDrawing}:`)) && (
                      <button
                        onClick={clearDrawingCorrections}
                        title="Remove all stored corrections for this drawing"
                        className="text-[10px] px-2 py-1 rounded border font-semibold bg-white text-red-400 border-red-200 hover:border-red-400 transition-colors"
                      >
                        ✕ Clear Fixes
                      </button>
                    )}
                  </div>
                </div>
                <div className="bg-slate-100">
                  {/* Correction mode active banner */}
                  {correctionMode && focusedFindingId && (
                    <div className="mx-3 mt-3 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-800 font-semibold">
                      <span className="text-amber-500 text-base leading-none flex-shrink-0">⊕</span>
                      <span>Click the <strong>exact location</strong> on the drawing to pin the marker for <strong>{visibleNodes.find(n => n.finding.id === focusedFindingId)?.rawKey ?? 'focused finding'}</strong>.</span>
                      <button onClick={() => setCorrectionMode(false)} className="ml-auto text-amber-500 hover:text-amber-700 font-bold text-sm leading-none flex-shrink-0">✕</button>
                    </div>
                  )}
                  {drawingImageLoading && (
                    <div className="flex items-center justify-center gap-2 py-12 text-slate-400 text-xs">
                      <Loader className="w-4 h-4 animate-spin" />Loading drawing…
                    </div>
                  )}
                  {!drawingImageLoading && !drawingImageUrl && (
                    <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-400">
                      <AlertTriangle className="w-6 h-6" />
                      {drawingImageError === 'missing' ? (
                        <>
                          <span className="text-xs font-semibold text-amber-400">Original file not found on server</span>
                          <span className="text-[11px] text-slate-500 text-center max-w-xs leading-relaxed">
                            This document was processed on a previous server. The PDF file no longer exists on disk.
                          </span>
                          <button
                            onClick={deleteCurrentDocument}
                            disabled={isDeleting}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white transition-all disabled:opacity-60"
                            style={{ background:'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow:'0 3px 10px rgba(220,38,38,0.35)' }}>
                            {isDeleting
                              ? <><Loader className="w-3.5 h-3.5 animate-spin" />Deleting…</>
                              : <><Trash2 className="w-3.5 h-3.5" />Delete &amp; Re-upload</>}
                          </button>
                        </>
                      ) : (
                        <span className="text-xs">Drawing preview unavailable for this file</span>
                      )}
                    </div>
                  )}
                  {!drawingImageLoading && drawingImageUrl && (
                    <div className="overflow-auto" style={{ maxHeight:'72vh' }}>
                      <div
                        className="relative w-full"
                        style={{ lineHeight:0, cursor: correctionMode && focusedFindingId ? 'crosshair' : 'default' }}
                        onClick={(e) => {
                          if (!correctionMode || !focusedFindingId) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const clL = Math.min(83, Math.max(2, ((e.clientX - rect.left)  / rect.width)  * 100));
                          const clT = Math.min(87, Math.max(2, ((e.clientY - rect.top)   / rect.height) * 100));
                          const corrKey  = `${activeDrawing || 'pfd'}:${focusedFindingId}`;
                          const existing = overlayNodes.find(n => n.finding.id === focusedFindingId);
                          saveCalibration({
                            ...calibCorrections,
                            [corrKey]: {
                              drawingId: activeDrawing, findingId: focusedFindingId,
                              ruleId: existing?.finding?.rule_id,
                              evidenceKey: existing?.rawKey, tier: existing?.tier,
                              originalLeft: existing?.left ?? null, originalTop: existing?.top ?? null,
                              correctedLeft: clL, correctedTop: clT,
                              timestamp: new Date().toISOString(),
                            },
                          });
                          setCorrectionMode(false);
                        }}
                      >
                        <img src={drawingImageUrl} alt={activeDrawing} draggable={false}
                          className="w-full block" style={{ height:'auto', userSelect:'none' }} />
                        <div className="absolute inset-0" style={{ pointerEvents:'none' }}>
                          {visibleNodes.map((n) => {
                            const isFocused = focusedFindingId === n.finding.id;
                            const sev = (n.finding?.severity || 'info').toLowerCase();
                            const cat = (n.finding?.category || '').toLowerCase();
                            const col = SEV_COLOR[sev] || SEV_COLOR.info;
                            const isDiamond = cat === 'title_block';
                            const scale = isFocused ? 1.6 : 1;
                            const shapeStyle = isDiamond
                              ? { borderRadius:'3px', transform:`translate(-50%,-50%) rotate(45deg) scale(${scale})`, width:'13px', height:'13px' }
                              : { borderRadius:'50%', transform:`translate(-50%,-50%) scale(${scale})`, width:'16px', height:'16px' };
                            return (
                              <React.Fragment key={n.rawKey}>
                                {/* Ping ring — animates outward from the marker centre */}
                                {PFD_OVERLAY_MARKER_ANIM_ENABLED && !isFocused && !isDiamond && (
                                  <div aria-hidden="true" style={{
                                    position:'absolute',
                                    left:`${n.left}%`, top:`${n.top}%`,
                                    width:'16px', height:'16px',
                                    border:`2.5px solid ${col.bg}`,
                                    backgroundColor:'transparent',
                                    borderRadius:'50%',
                                    animation:`markerPing ${PFD_OVERLAY_MARKER_ANIM_DURATION_MS}ms ease-out infinite`,
                                    pointerEvents:'none', zIndex:9,
                                  }} />
                                )}
                                <button
                                  onClick={() => jumpToFinding(n.finding.id)}
                                  title={PFD_OVERLAY_SHOW_MARKER_TOOLTIP ? `[${cat}] ${n.finding.issue_observed}` : undefined}
                                  className={`absolute border-2 transition-all ${isFocused ? 'z-20' : 'z-10 hover:opacity-90'}`}
                                  style={{
                                    left: `${n.left}%`,
                                    top:  `${n.top}%`,
                                    backgroundColor: col.bg,
                                    borderColor: col.border,
                                    boxShadow: isFocused
                                      ? `0 0 0 4px ${col.glow}, 0 2px 8px rgba(0,0,0,0.5)`
                                      : '0 1px 4px rgba(0,0,0,0.4)',
                                    pointerEvents: 'all',
                                    outline: n.anchored ? undefined : '2px dashed rgba(100,116,139,0.7)',
                                    outlineOffset: n.anchored ? undefined : '3px',
                                    animation: PFD_OVERLAY_MARKER_ANIM_ENABLED && !isFocused && !isDiamond
                                      ? `markerGlow ${PFD_OVERLAY_MARKER_ANIM_DURATION_MS}ms ease-in-out infinite` : undefined,
                                    ...shapeStyle,
                                  }}
                                />
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {(activeDrawingData?.issues?.length ?? 0) > 0 && (
                  <div className="border-t border-slate-100 divide-y divide-slate-50 max-h-48 overflow-y-auto">
                    {(activeDrawingData?.issues ?? []).map(f => {
                      const sev = (f.severity || 'info').toLowerCase();
                      const col = SEV_COLOR[sev] || SEV_COLOR.info;
                      const isFocused = focusedFindingId === f.id;
                      return (
                        <button key={f.id} id={`pfd-drawing-finding-${f.id}`}
                          onClick={() => setFocusedFindingId(prev => prev === f.id ? null : f.id)}
                          className={`w-full text-left px-4 py-2.5 flex items-start gap-3 transition-colors ${
                            isFocused ? 'bg-teal-50 border-l-2 border-teal-400' : 'hover:bg-slate-50'
                          }`}>
                          <span className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5" style={{ background:col.bg }} />
                          <span className="flex-1 min-w-0">
                            <span className="text-xs font-semibold text-slate-700">[{f.rule_id}] </span>
                            <span className="text-xs text-slate-600 line-clamp-1">{f.issue_observed}</span>
                          </span>
                          <span className="text-[10px] text-slate-400 flex-shrink-0">{f.evidence?.split(' ').slice(0,4).join(' ')}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              )}
              {/* ─── end DRAWING ──────────────────────────────────────── */}

              {/* ─── FINDINGS panel ─────────────────────────────────── */}
              {activePanel === 'findings' && activeDrawingData && (
              <div className="rounded-2xl overflow-hidden" style={T.card}>
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-teal-50 border border-teal-200 rounded-lg flex items-center justify-center flex-shrink-0">
                      <GitBranch className="w-4 h-4 text-teal-600" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">{activeDrawing}</h2>
                      <p className="text-xs text-slate-500">{filteredIssues.length} of {activeDrawingData.issues?.length ?? 0} findings</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 outline-none cursor-pointer hover:border-teal-400">
                      <option value="all">All Severity</option>
                      {['critical','major','minor','info'].map(s => <option key={s} value={s}>{s[0].toUpperCase()+s.slice(1)}</option>)}
                    </select>
                    <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 outline-none cursor-pointer hover:border-teal-400">
                      <option value="all">All Categories</option>
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 outline-none cursor-pointer hover:border-teal-400">
                      <option value="all">All Status</option>
                      {['open','in_review','resolved','wont_fix'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
                    </select>
                    {overridesSaved && pendingCount === 0 && (
                      <span className="text-xs text-teal-600 flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" />Saved</span>
                    )}
                    {pendingCount > 0 && (
                      <>
                        <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full font-medium">
                          {pendingCount} unsaved
                        </span>
                        <button onClick={handleSaveOverrides} disabled={savingOverrides}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white rounded-lg disabled:opacity-50 transition-all hover:-translate-y-px"
                          style={{ background: T.accent }}>
                          {savingOverrides ? <><Loader className="w-3.5 h-3.5 animate-spin" />Saving…</> : <><Save className="w-3.5 h-3.5" />Save</>}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        {['#','Category','Rule','Issue Observed','Action Required','Severity','Status'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredIssues.length === 0 ? (
                        <tr><td colSpan="7" className="px-4 py-10 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <CheckCircle className="w-8 h-8 text-teal-400" />
                            <p className="text-sm font-semibold text-slate-700">
                              {(activeDrawingData.issues?.length ?? 0) === 0 ? 'No issues detected' : 'No issues match filters'}
                            </p>
                          </div>
                        </td></tr>
                      ) : filteredIssues.map((f, i) => (
                        <tr key={f.id} id={`pfd-finding-row-${f.id}`}
                          onClick={() => setFocusedFindingId(prev => prev === f.id ? null : f.id)}
                          className={`transition-colors cursor-pointer ${
                            focusedFindingId === f.id ? 'bg-teal-50 ring-1 ring-teal-300'
                            : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                          } hover:bg-teal-50/30`}>
                          <td className="px-4 py-3 text-xs text-slate-400 font-mono">{f.sl_no}</td>
                          <td className="px-4 py-3">
                            <span className="inline-block text-xs bg-teal-50 text-teal-700 border border-teal-100 px-2 py-0.5 rounded-full font-medium">
                              {CATEGORY_LABELS[f.category] ?? f.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-slate-500 whitespace-nowrap">{f.rule_id}</td>
                          <td className="px-4 py-3 text-xs text-slate-700 max-w-[220px]">
                            <p className="line-clamp-3">{f.issue_observed}</p>
                            {f.evidence && <p className="text-slate-400 mt-1 italic text-[11px] line-clamp-2">{f.evidence}</p>}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600 max-w-[200px]">
                            <p className="line-clamp-3">{f.action_required}</p>
                          </td>
                          <td className="px-4 py-3">
                            <select value={getVal(f,'severity')} onChange={e => handleOverrideChange(f.id,'severity',e.target.value)}
                              className={`text-xs px-2.5 py-1 rounded-full border font-semibold cursor-pointer focus:outline-none ${SEVERITY_STYLES[getVal(f,'severity')]}`}>
                              <option value="critical">Critical</option>
                              <option value="major">Major</option>
                              <option value="minor">Minor</option>
                              <option value="info">Info</option>
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <select value={getVal(f,'status') ?? 'open'} onChange={e => handleOverrideChange(f.id,'status',e.target.value)}
                              className="text-xs px-2.5 py-1 rounded-full border bg-slate-50 text-slate-700 border-slate-200 font-medium cursor-pointer focus:outline-none">
                              <option value="open">Open</option>
                              <option value="in_review">In Review</option>
                              <option value="resolved">Resolved</option>
                              <option value="wont_fix">Won&apos;t Fix</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              )}
              {/* ─── end FINDINGS ─────────────────────────────────────── */}

              {/* ─── SUMMARY panel ────────────────────────────────────── */}
              {activePanel === 'summary' && (() => {
                // ── Soft-coded: severity config ──────────────────────────
                const SUMM_SEV_ORDER  = ['critical','major','minor','info'];
                const SUMM_SEV_COLOR  = { critical:'#dc2626', major:'#f97316', minor:'#fbbf24', info:'#0d9488' };
                const SUMM_SEV_LABEL  = { critical:'Critical',  major:'Major',   minor:'Minor',  info:'Info'   };
                const SUMM_SEV_ICON   = { critical:'🔴',         major:'🟠',       minor:'🟡',      info:'🟢'     };

                // Soft-coded: category icons (extend here — no JSX changes needed)
                const SUMM_CAT_ICON = {
                  equipment:'⚙️', stream:'🌊', control:'🎛️',
                  title_block:'📋', safety:'🛡️', utility:'🔁', notes:'📌',
                };

                // Soft-coded: quality score severity penalties
                const SUMM_PENALTY = { critical:8, major:3, minor:1, info:0 };

                // ── Derived data ─────────────────────────────────────────
                const drawings = results.drawings ?? [];
                const totalD   = drawings.length;
                const passD    = drawings.filter(d => (d.issue_count ?? 0) === 0).length;
                const failD    = totalD - passD;

                const sevTotals = {};
                for (const s of SUMM_SEV_ORDER) {
                  sevTotals[s] = allIssues.filter(f => (f.severity || 'minor').toLowerCase() === s).length;
                }

                const catData = {};
                for (const f of allIssues) {
                  const c = f.category || 'other';
                  if (!catData[c]) catData[c] = { total:0, critical:0, major:0, minor:0, info:0 };
                  catData[c].total++;
                  const sv = (f.severity || 'minor').toLowerCase();
                  catData[c][sv] = (catData[c][sv] || 0) + 1;
                }
                const catSorted = Object.entries(catData).sort((a,b) => b[1].total - a[1].total);
                const maxCat    = catSorted[0]?.[1]?.total || 1;

                // Weighted quality score (100 = perfect, 0 = worst)
                const penalty      = Object.entries(sevTotals).reduce((s,[sv,c]) => s + c * (SUMM_PENALTY[sv] ?? 0), 0);
                const qualityScore = Math.max(0, Math.min(100, 100 - penalty));
                const scoreColor   = qualityScore >= 80 ? '#10b981' : qualityScore >= 55 ? '#f59e0b' : '#ef4444';
                const scoreLabel   = qualityScore >= 80 ? 'Good' : qualityScore >= 55 ? 'Fair' : 'Needs Work';

                // SVG arc (270° sweep, starts bottom-left)
                const arc = (cx, cy, r, pct) => {
                  if (pct >= 100) pct = 99.99;
                  const angle = ((pct / 100) * 270 - 135) * Math.PI / 180;
                  const sx = cx + r * Math.cos(-135 * Math.PI / 180);
                  const sy = cy + r * Math.sin(-135 * Math.PI / 180);
                  return `M ${sx} ${sy} A ${r} ${r} 0 ${pct > 50 ? 1 : 0} 1 ${cx + r * Math.cos(angle)} ${cy + r * Math.sin(angle)}`;
                };

                return (
                  <div className="space-y-4" style={{ animation:'panelSlide 0.25s ease-out both' }}>

                    {/* ── KPI strip ── */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label:'Total Issues',    val:totalIssues,         icon:'🔍', col:'#0d9488', bg:'rgba(13,148,136,0.07)',  border:'rgba(13,148,136,0.18)' },
                        { label:'Critical',        val:sevTotals.critical,  icon:'🔴', col:'#dc2626', bg:'rgba(220,38,38,0.07)',   border:'rgba(220,38,38,0.18)'  },
                        { label:'Major',           val:sevTotals.major,     icon:'🟠', col:'#f97316', bg:'rgba(249,115,22,0.07)',  border:'rgba(249,115,22,0.18)' },
                        { label:'Drawings Passed', val:`${passD}/${totalD}`,icon:'✅', col:'#10b981', bg:'rgba(16,185,129,0.07)', border:'rgba(16,185,129,0.18)' },
                      ].map((k, i) => (
                        <div key={k.label} className="rounded-2xl p-4 flex flex-col gap-2"
                          style={{ background:k.bg, border:`1px solid ${k.border}`, animation:`countUp 0.5s ease-out ${i*0.07}s both` }}>
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xl leading-none">{k.icon}</span>
                            <span className="text-[9px] font-bold uppercase tracking-normal text-slate-400 text-right leading-tight">{k.label}</span>
                          </div>
                          <p className="text-3xl font-black leading-none" style={{ color:k.col }}>{k.val}</p>
                        </div>
                      ))}
                    </div>

                    {/* ── Quality score + severity ring ── */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                      {/* Quality Score */}
                      <div className="rounded-2xl overflow-hidden" style={T.card}>
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3"
                          style={{ background:'linear-gradient(135deg,#f0fdfa,#ecfeff)' }}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background:'linear-gradient(135deg,#0d9488,#0891b2)', boxShadow:'0 3px 10px rgba(13,148,136,0.28)' }}>
                            <Activity className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">Overall Quality Score</h3>
                            <p className="text-xs text-slate-500">Weighted penalty model per severity</p>
                          </div>
                        </div>
                        <div className="p-5 flex flex-col items-center gap-4">
                          <svg width="180" height="120" viewBox="0 0 180 120">
                            {/* Track */}
                            <path d={arc(90,100,68,100)} fill="none" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round"/>
                            {/* Score arc */}
                            <path d={arc(90,100,68,qualityScore)} fill="none"
                              stroke={scoreColor} strokeWidth="12" strokeLinecap="round"
                              style={{ filter:`drop-shadow(0 0 8px ${scoreColor}88)` }}/>
                            {/* Score text */}
                            <text x="90" y="94" textAnchor="middle" fontSize="30" fontWeight="900" fill={scoreColor} fontFamily="system-ui,sans-serif">{qualityScore}</text>
                            <text x="90" y="114" textAnchor="middle" fontSize="11" fill="#64748b" fontWeight="700" fontFamily="system-ui,sans-serif">{scoreLabel}</text>
                          </svg>
                          <div className="grid grid-cols-2 gap-2 w-full">
                            {[
                              { label:'Drawings',  val:`${passD} / ${totalD} passed`, col:'#10b981' },
                              { label:'Findings',  val:`${totalIssues} total`,         col: totalIssues > 0 ? '#dc2626' : '#10b981' },
                            ].map(s => (
                              <div key={s.label} className="rounded-xl p-3 text-center"
                                style={{ background:'rgba(248,250,252,0.9)', border:'1px solid #e2e8f0' }}>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-normal mb-1.5">{s.label}</p>
                                <p className="text-xs font-black leading-none" style={{ color:s.col }}>{s.val}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Severity distribution */}
                      <div className="rounded-2xl overflow-hidden" style={T.card}>
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3"
                          style={{ background:'linear-gradient(135deg,#fff7ed,#fef3c7)' }}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background:'linear-gradient(135deg,#f97316,#fbbf24)', boxShadow:'0 3px 10px rgba(249,115,22,0.25)' }}>
                            <AlertTriangle className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">Severity Distribution</h3>
                            <p className="text-xs text-slate-500">{totalIssues} findings across {totalD} drawing{totalD !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <div className="p-5 space-y-3.5">
                          {SUMM_SEV_ORDER.map(s => {
                            const cnt = sevTotals[s] ?? 0;
                            const pct = totalIssues > 0 ? Math.round((cnt / totalIssues) * 100) : 0;
                            const col = SUMM_SEV_COLOR[s];
                            return (
                              <div key={s} className="flex items-center gap-3">
                                <span className="text-base flex-shrink-0 w-5 text-center">{SUMM_SEV_ICON[s]}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs font-bold text-slate-700">{SUMM_SEV_LABEL[s]}</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-sm font-black tabular-nums" style={{ color:col }}>{cnt}</span>
                                      <span className="text-[10px] text-slate-400">({pct}%)</span>
                                    </div>
                                  </div>
                                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background:`${col}18` }}>
                                    <div className="h-full rounded-full transition-all duration-700"
                                      style={{ width:`${pct}%`, background:col, boxShadow:`0 0 8px ${col}66` }} />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {totalIssues === 0 && (
                            <div className="py-6 text-center flex flex-col items-center gap-2">
                              <CheckCircle className="w-8 h-8 text-emerald-400" style={{ animation:'checkPop 0.4s ease-out both' }} />
                              <p className="text-sm font-semibold text-emerald-700">No findings detected</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ── Category breakdown (segmented stacked bars) ── */}
                    {catSorted.length > 0 && (
                      <div className="rounded-2xl overflow-hidden" style={T.card}>
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background:'linear-gradient(135deg,#f0fdfa,#ccfbf1)', border:'1px solid #99f6e4' }}>
                            <BarChart2 className="w-4 h-4 text-teal-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-slate-900">Category Breakdown</h3>
                            <p className="text-xs text-slate-500">{catSorted.length} rule categories · segmented by severity</p>
                          </div>
                          <span className="text-[10px] font-bold text-teal-600 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full flex-shrink-0">ISO 10628</span>
                        </div>
                        <div className="p-5 space-y-4">
                          {catSorted.map(([cat, counts], i) => {
                            const label   = CATEGORY_LABELS[cat] ?? cat;
                            const icon    = SUMM_CAT_ICON[cat] ?? '📌';
                            const critPct = (counts.critical / maxCat) * 100;
                            const majPct  = (counts.major    / maxCat) * 100;
                            const minPct  = (counts.minor    / maxCat) * 100;
                            const infPct  = (counts.info     / maxCat) * 100;
                            return (
                              <div key={cat} style={{ animation:`fadeUp 0.35s ease-out ${i * 0.04}s both` }}>
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="text-base flex-shrink-0 w-6 text-center">{icon}</span>
                                  <span className="flex-1 text-xs font-bold text-slate-800">{label}</span>
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    {counts.critical > 0 && (
                                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                                        style={{ background:'rgba(220,38,38,0.10)', color:'#dc2626', border:'1px solid rgba(220,38,38,0.20)' }}>
                                        {counts.critical} crit
                                      </span>
                                    )}
                                    {counts.major > 0 && (
                                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                                        style={{ background:'rgba(249,115,22,0.10)', color:'#f97316', border:'1px solid rgba(249,115,22,0.20)' }}>
                                        {counts.major} maj
                                      </span>
                                    )}
                                    <span className="text-xs font-black text-slate-700 min-w-[20px] text-right">{counts.total}</span>
                                  </div>
                                </div>
                                {/* Segmented stacked bar */}
                                <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex gap-0">
                                  {critPct > 0 && <div className="h-full transition-all duration-700" style={{ width:`${critPct}%`, background:'#dc2626' }} />}
                                  {majPct  > 0 && <div className="h-full transition-all duration-700" style={{ width:`${majPct}%`,  background:'#f97316' }} />}
                                  {minPct  > 0 && <div className="h-full transition-all duration-700" style={{ width:`${minPct}%`,  background:'#fbbf24' }} />}
                                  {infPct  > 0 && <div className="h-full transition-all duration-700" style={{ width:`${infPct}%`,  background:'#0d9488' }} />}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {/* Legend */}
                        <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-5 flex-wrap"
                          style={{ background:'rgba(240,253,250,0.5)' }}>
                          {[['Critical','#dc2626'],['Major','#f97316'],['Minor','#fbbf24'],['Info','#0d9488']].map(([lbl, col]) => (
                            <span key={lbl} className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background:col }} />{lbl}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── Drawings health grid ── */}
                    {drawings.length > 0 && (
                      <div className="rounded-2xl overflow-hidden" style={T.card}>
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background:'linear-gradient(135deg,#f0fdfa,#ccfbf1)', border:'1px solid #99f6e4' }}>
                            <Layers className="w-4 h-4 text-teal-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-slate-900">Drawings Health</h3>
                            <p className="text-xs text-slate-500">Click any card to inspect its findings</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{passD} ✓ passed</span>
                            {failD > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">{failD} ✗ issues</span>}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                          {drawings.map((d, i) => {
                            const cnt   = d.issue_count ?? 0;
                            const draws = d.issues ?? [];
                            const critC = draws.filter(f => f.severity === 'critical').length;
                            const majC  = draws.filter(f => f.severity === 'major').length;
                            const minC  = draws.filter(f => f.severity === 'minor').length;
                            const topSev = critC > 0 ? 'critical' : majC > 0 ? 'major' : cnt > 0 ? 'minor' : null;
                            const health = cnt === 0 ? 100 : Math.max(5, Math.round(100 - critC*8 - majC*3 - minC));
                            const hCol   = health >= 80 ? '#10b981' : health >= 55 ? '#f59e0b' : '#ef4444';
                            const sevCol = topSev ? SUMM_SEV_COLOR[topSev] : '#10b981';
                            return (
                              <div key={d.drawing_id}
                                className="relative rounded-xl border p-4 flex flex-col gap-3 cursor-pointer group transition-all duration-200 hover:-translate-y-0.5"
                                style={{
                                  background: cnt === 0 ? 'linear-gradient(135deg,#f0fdf4,#dcfce7)' : '#ffffff',
                                  borderColor: cnt === 0 ? '#86efac' : `${sevCol}55`,
                                  boxShadow: cnt === 0 ? '0 2px 12px rgba(16,185,129,0.10)' : '0 1px 4px rgba(0,0,0,0.05)',
                                  animation:`cardIn 0.35s ease-out ${i * 0.05}s both`,
                                }}
                                onClick={() => { setActiveDrawing(d.drawing_id); setActivePanel('findings'); }}>
                                {/* Top accent bar */}
                                <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl"
                                  style={{ background: cnt === 0 ? '#10b981' : sevCol }} />
                                {/* Header row */}
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                      style={{ background: cnt === 0 ? 'rgba(16,185,129,0.12)' : `${sevCol}14`, border:`1px solid ${cnt === 0 ? '#86efac' : sevCol+'44'}` }}>
                                      {cnt === 0
                                        ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                                        : <AlertTriangle className="w-4 h-4" style={{ color:sevCol }} />}
                                    </div>
                                    <code className="text-xs font-mono font-bold text-slate-800 truncate">{d.drawing_id}</code>
                                  </div>
                                  {topSev ? (
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0"
                                      style={{ background:`${sevCol}15`, color:sevCol, border:`1px solid ${sevCol}30` }}>
                                      {topSev}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 bg-emerald-50 text-emerald-600 border border-emerald-200">
                                      ✓ pass
                                    </span>
                                  )}
                                </div>
                                {/* Issue count chips */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`text-lg font-black leading-none ${cnt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{cnt}</span>
                                  <span className="text-xs text-slate-400">issue{cnt !== 1 ? 's' : ''}</span>
                                  {critC > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">{critC} crit</span>}
                                  {majC  > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200">{majC} maj</span>}
                                </div>
                                {/* Health bar */}
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] text-slate-400 font-medium">Drawing Health</span>
                                    <span className="text-[10px] font-black tabular-nums" style={{ color:hCol }}>{health}%</span>
                                  </div>
                                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-700"
                                      style={{ width:`${health}%`, background:hCol, boxShadow:`0 0 6px ${hCol}55` }} />
                                  </div>
                                </div>
                                {/* CTA */}
                                <div className="w-full py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all group-hover:opacity-90"
                                  style={{ background: cnt === 0 ? 'rgba(16,185,129,0.10)' : 'rgba(13,148,136,0.08)', color: cnt === 0 ? '#10b981' : '#0d9488', border:`1px solid ${cnt === 0 ? '#86efac' : '#99f6e4'}` }}>
                                  {cnt === 0 ? '✓ All Clear' : <><ScanLine className="w-3 h-3" /> Inspect Findings</>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  </div>
                );
              })()}
              {/* ─── end SUMMARY ──────────────────────────────────────── */}

              {/* ─── CROSS-REF panel ─────────────────────────────────── */}
              {activePanel === 'cross' && (
              <div className="rounded-2xl overflow-hidden" style={T.card}>
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap"
                  style={{ background:'linear-gradient(135deg,#fffbeb,#fef3c7)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background:'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                      <Activity className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">Cross-Reference</h2>
                      <p className="text-xs text-slate-500">Link this PFD to its matching P&amp;ID verification</p>
                    </div>
                  </div>
                  <a href="/engineering/process/pid-verification"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white rounded-xl transition-all hover:-translate-y-px"
                    style={{ background:'linear-gradient(135deg,#3b82f6,#6366f1)', boxShadow:'0 3px 10px rgba(99,102,241,0.25)' }}>
                    Open P&amp;ID Verify <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="p-4">
                  <CrossRecommendationPanel
                    sourceType="pfd"
                    documentId={documentId || results?.document_id}
                    projectId={selectedProject?.project_id || results?.project_id}
                    fileName={results?.file_name}
                  />
                </div>
              </div>
              )}
              {/* ─── end CROSS-REF ───────────────────────────────────── */}

              {/* ─── HISTORY panel ───────────────────────────────────── */}
              {activePanel === 'history' && (
              <div className="rounded-2xl overflow-hidden" style={T.card}>
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4 text-slate-600" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">Document History</h2>
                      <p className="text-xs text-slate-500">Previous analyses in this project</p>
                    </div>
                  </div>
                  <button onClick={() => fetchHistory(selectedProject.project_id)} disabled={loadingHistory}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-lg transition-colors disabled:opacity-50">
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />Refresh
                  </button>
                </div>
                {loadingHistory ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-slate-400 text-sm">
                    <Loader className="w-4 h-4 animate-spin" />Loading…
                  </div>
                ) : history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                    <FileText className="w-10 h-10 opacity-30" />
                    <p className="text-sm font-medium">No documents yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {history.map(doc => (
                      <div key={doc.document_id} className="px-5 py-3 flex items-center gap-3 hover:bg-teal-50/30 transition-colors">
                        <FileText className="w-4 h-4 text-red-400 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 truncate">{doc.file_name}</p>
                          <p className="text-xs text-slate-400">{new Date(doc.created_at).toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                            doc.status === 'completed' ? 'bg-teal-50 text-teal-700 border-teal-200'
                            : doc.status === 'failed'  ? 'bg-red-50 text-red-600 border-red-200'
                            : 'bg-amber-50 text-amber-600 border-amber-200'
                          }`}>{doc.status}</span>
                          {doc.total_issues !== undefined && (
                            <span className="text-xs text-slate-400">{doc.total_issues} issues</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )}
              {/* ─── end HISTORY ─────────────────────────────────────── */}

              {/* ─── PERFORMANCE / ACCURACY panel ───────────────────── */}
              {activePanel === 'performance' && (() => {
                const allDrawings = results?.drawings ?? [];

                // ── Active-drawing marker placement stats ──────────────
                const tierCounts = {};
                for (const n of overlayNodes) {
                  const t = n.tier || 'ZONE';
                  tierCounts[t] = (tierCounts[t] || 0) + 1;
                }
                const totalMarkers  = overlayNodes.length;
                const anchoredCount = overlayNodes.filter(n => n.anchored).length;

                const placementScore = totalMarkers === 0 ? null
                  : Math.round(
                      (Object.entries(tierCounts).reduce(
                        (sum, [t, c]) => sum + c * (PFD_PERF_TIER_WEIGHT[t] ?? 0.3), 0
                      ) / totalMarkers) * 100
                    );
                const anchorRate = totalMarkers === 0 ? null
                  : Math.round((anchoredCount / totalMarkers) * 100);

                const scoreQuality = (val, thresholds) => {
                  if (val == null) return { color: '#94a3b8', label: 'No data' };
                  if (val >= thresholds.high)     return { color: '#10b981', label: 'High' };
                  if (val >= thresholds.moderate) return { color: '#f59e0b', label: 'Moderate' };
                  return { color: '#ef4444', label: 'Low' };
                };
                const confQuality   = scoreQuality(placementScore, PFD_PERF_SCORE_THRESHOLDS);
                const anchorQuality = scoreQuality(anchorRate,     PFD_PERF_ANCHOR_THRESHOLDS);

                // ── Document Accuracy Rate ─────────────────────────────
                const es = activeDrawingData?.metadata?.extraction_summary || null;
                const ocrScore = (() => {
                  if (!es || es.no_text_detected) return 0;
                  const len = es.raw_text_length ?? 0;
                  if (len >= PFD_PERF_OCR_GOOD_THRESHOLD) return 100;
                  return Math.round((len / PFD_PERF_OCR_GOOD_THRESHOLD) * 100);
                })();
                const docAccuracyRate = (placementScore == null && anchorRate == null && !es)
                  ? null
                  : Math.min(100, Math.round(
                      (ocrScore              * PFD_PERF_DOC_ACCURACY_WEIGHTS.ocr)      +
                      ((placementScore ?? 0) * PFD_PERF_DOC_ACCURACY_WEIGHTS.placement) +
                      ((anchorRate     ?? 0) * PFD_PERF_DOC_ACCURACY_WEIGHTS.anchor)
                    ));
                const docAccQuality = scoreQuality(docAccuracyRate, PFD_PERF_DOC_ACCURACY_THRESHOLDS);

                const entityCounts = es ? [
                  { label:'Equipment', val: es.equipment  ?? 0, icon:'⚙️' },
                  { label:'Streams',   val: es.streams    ?? 0, icon:'🌊' },
                  { label:'Tags',      val: es.tags       ?? 0, icon:'🏷'  },
                  { label:'Valves',    val: es.valves     ?? 0, icon:'🔧' },
                ] : [];

                // ── All-drawings aggregated findings ───────────────────
                const allIssuesSrc    = allDrawings.flatMap(d => d.issues ?? []);
                const totalFindingsAll = allIssuesSrc.length;

                const sevCountP = {};
                for (const f of allIssuesSrc) {
                  const s = (f.severity || 'minor').toLowerCase();
                  sevCountP[s] = (sevCountP[s] || 0) + 1;
                }
                const SEV_ORDER_P  = ['critical','major','minor'];
                const SEV_COLORS_P = { critical:'#dc2626', major:'#f97316', minor:'#fbbf24' };

                const catCountP = {};
                for (const f of allIssuesSrc) {
                  const c = CATEGORY_LABELS[f.category] || f.category || 'Unknown';
                  catCountP[c] = (catCountP[c] || 0) + 1;
                }
                const catListP = Object.entries(catCountP)
                  .sort((a, b) => b[1] - a[1]).slice(0, PFD_PERF_TOP_CATS_COUNT);

                const ruleCountP = {};
                for (const f of allIssuesSrc) {
                  const r = f.rule_id || '—';
                  ruleCountP[r] = (ruleCountP[r] || 0) + 1;
                }
                const ruleListP = Object.entries(ruleCountP)
                  .sort((a, b) => b[1] - a[1]).slice(0, PFD_PERF_TOP_RULES_COUNT);

                const drawingSummaryP = allDrawings.map(d => {
                  const iss  = d.issues ?? [];
                  const sevs = iss.map(f => (f.severity || 'minor').toLowerCase());
                  const topSev = SEV_ORDER_P.find(s => sevs.includes(s)) || null;
                  return { id: d.drawing_id, count: iss.length, topSev };
                });

                // SVG arc helper (270° sweep starting at bottom-left)
                const describeArc = (cx, cy, r, pct) => {
                  if (pct >= 100) pct = 99.99;
                  const a  = ((pct / 100) * 270 - 135) * Math.PI / 180;
                  const sx = cx + r * Math.cos(-135 * Math.PI / 180);
                  const sy = cy + r * Math.sin(-135 * Math.PI / 180);
                  const ex = cx + r * Math.cos(a);
                  const ey = cy + r * Math.sin(a);
                  const laf = pct > 50 ? 1 : 0;
                  return `M ${sx} ${sy} A ${r} ${r} 0 ${laf} 1 ${ex} ${ey}`;
                };

                return (
                  <div className="space-y-4" style={{ animation:'panelSlide 0.25s ease-out both' }}>

                    {/* ── Hero: Document Accuracy Rate ── */}
                    <div className="rounded-2xl overflow-hidden" style={T.card}>
                      <div className="px-5 pt-5 pb-4"
                        style={{ background:'linear-gradient(135deg,#f0fdfa,#ecfeff,#f0f9ff)', borderBottom:'1px solid #99f6e4' }}>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background:'linear-gradient(135deg,#0d9488,#0891b2)', boxShadow:'0 4px 12px rgba(13,148,136,0.3)' }}>
                            <Zap className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <h2 className="text-sm font-bold text-slate-900">Document Accuracy Rate</h2>
                            <p className="text-xs text-slate-500">Composite OCR + placement + anchor score</p>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-6">
                          {/* Arc gauge */}
                          <div className="flex-shrink-0 flex flex-col items-center">
                            <svg width="140" height="100" viewBox="0 0 140 100">
                              <path d={describeArc(70,80,52,100)} fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />
                              {docAccuracyRate != null && (
                                <path d={describeArc(70,80,52,docAccuracyRate)} fill="none"
                                  stroke={docAccQuality.color} strokeWidth="10" strokeLinecap="round"
                                  style={{ filter:`drop-shadow(0 0 6px ${docAccQuality.color}88)` }} />
                              )}
                              <text x="70" y="76" textAnchor="middle" fontSize="22" fontWeight="900" fill={docAccQuality.color} fontFamily="system-ui">
                                {docAccuracyRate != null ? `${docAccuracyRate}%` : '—'}
                              </text>
                              <text x="70" y="93" textAnchor="middle" fontSize="9" fill="#64748b" fontWeight="600" fontFamily="system-ui">
                                {docAccQuality.label}
                              </text>
                            </svg>
                          </div>
                          {/* Sub-score pills */}
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                            {[
                              { label:'OCR Quality',  val:ocrScore,       weight:`${Math.round(PFD_PERF_DOC_ACCURACY_WEIGHTS.ocr*100)}%`,       color:'#0d9488' },
                              { label:'Placement',    val:placementScore, weight:`${Math.round(PFD_PERF_DOC_ACCURACY_WEIGHTS.placement*100)}%`,  color:'#0891b2' },
                              { label:'Anchor Rate',  val:anchorRate,     weight:`${Math.round(PFD_PERF_DOC_ACCURACY_WEIGHTS.anchor*100)}%`,     color:'#06b6d4' },
                            ].map(sub => (
                              <div key={sub.label} className="rounded-xl p-3 flex flex-col gap-1"
                                style={{ background:'rgba(255,255,255,0.7)', border:'1px solid rgba(153,246,228,0.6)' }}>
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{sub.label}</span>
                                  <span className="text-[10px] font-semibold text-slate-400">×{sub.weight}</span>
                                </div>
                                <p className="text-lg font-black leading-none" style={{ color: sub.color }}>
                                  {sub.val != null ? `${sub.val}%` : '—'}
                                </p>
                                <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width:`${sub.val ?? 0}%`, background: sub.color, transition:'width 0.8s ease-out' }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        {entityCounts.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            <span className="text-[10px] text-slate-400 font-medium flex items-center">Extracted:</span>
                            {entityCounts.map(e => (
                              <span key={e.label} className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg"
                                style={{ background:'rgba(255,255,255,0.8)', border:'1px solid #99f6e4', color:'#0d9488' }}>
                                {e.icon} {e.val} {e.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── Gauges row ── */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[
                        { label:'Placement Confidence', val:placementScore, q:confQuality,   maxLabel:true,  icon:<Activity className="w-4 h-4" /> },
                        { label:'Anchor Rate',          val:anchorRate,     q:anchorQuality, maxLabel:true,  icon:<MapPin className="w-4 h-4" /> },
                        { label:'Total Findings',       val:totalFindingsAll, q:{ color:'#0d9488', label:'' }, maxLabel:false, icon:<GitBranch className="w-4 h-4" /> },
                      ].map(g => (
                        <div key={g.label} className="rounded-2xl p-5 flex flex-col items-center gap-3" style={T.card}>
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                            style={{ background:`${g.q.color}18`, border:`1px solid ${g.q.color}38`, color:g.q.color }}>
                            {g.icon}
                          </div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide text-center">{g.label}</p>
                          <p className="text-3xl font-black" style={{ color: g.q.color }}>
                            {g.val != null ? (g.maxLabel ? `${g.val}%` : g.val) : '—'}
                          </p>
                          {g.q.label && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background:`${g.q.color}18`, color:g.q.color }}>
                              {g.q.label}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* ── Marker tier breakdown ── */}
                    {totalMarkers > 0 && (
                      <div className="rounded-2xl overflow-hidden" style={T.card}>
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background:'linear-gradient(135deg,#f0fdfa,#ccfbf1)', border:'1px solid #99f6e4' }}>
                            <CircleDot className="w-4 h-4 text-teal-600" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">Marker Resolution Tiers</h3>
                            <p className="text-xs text-slate-500">{totalMarkers} markers on active drawing</p>
                          </div>
                        </div>
                        <div className="p-5 space-y-3">
                          {Object.entries(PFD_PERF_TIER_WEIGHT).map(([tier, weight]) => {
                            const cnt = tierCounts[tier] ?? 0;
                            const pct = totalMarkers > 0 ? Math.round((cnt / totalMarkers) * 100) : 0;
                            const col = PFD_PERF_TIER_COLOR[tier] ?? '#94a3b8';
                            const lbl = PFD_PERF_TIER_LABEL[tier] ?? tier;
                            return (
                              <div key={tier}>
                                <div className="flex items-center justify-between mb-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background:col }} />
                                    <span className="text-xs font-bold text-slate-700">{tier}</span>
                                    <span className="text-[10px] text-slate-400">{lbl}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-slate-500">×{weight.toFixed(2)}</span>
                                    <span className="text-xs font-black" style={{ color:col }}>{cnt}</span>
                                    <span className="text-[10px] text-slate-400">({pct}%)</span>
                                  </div>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all duration-700"
                                    style={{ width:`${pct}%`, background:col, boxShadow:`0 0 8px ${col}66` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* ── Severity + Category breakdown ── */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Severity */}
                      <div className="rounded-2xl overflow-hidden" style={T.card}>
                        <div className="px-5 py-3.5 border-b border-slate-100">
                          <h3 className="text-sm font-bold text-slate-900">Severity Breakdown</h3>
                          <p className="text-xs text-slate-400">{totalFindingsAll} total findings</p>
                        </div>
                        <div className="p-4 space-y-2.5">
                          {SEV_ORDER_P.map(s => {
                            const cnt = sevCountP[s] ?? 0;
                            const pct = totalFindingsAll > 0 ? Math.round((cnt / totalFindingsAll) * 100) : 0;
                            const col = SEV_COLORS_P[s] ?? '#94a3b8';
                            return (
                              <div key={s}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-semibold text-slate-700 capitalize">{s}</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-black" style={{ color:col }}>{cnt}</span>
                                    <span className="text-[10px] text-slate-400">({pct}%)</span>
                                  </div>
                                </div>
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width:`${pct}%`, background:col, transition:'width 0.8s ease-out' }} />
                                </div>
                              </div>
                            );
                          })}
                          {totalFindingsAll === 0 && <p className="text-center text-xs text-slate-400 py-4">No findings</p>}
                        </div>
                      </div>
                      {/* Category */}
                      <div className="rounded-2xl overflow-hidden" style={T.card}>
                        <div className="px-5 py-3.5 border-b border-slate-100">
                          <h3 className="text-sm font-bold text-slate-900">Top Categories</h3>
                          <p className="text-xs text-slate-400">Top {PFD_PERF_TOP_CATS_COUNT} by finding count</p>
                        </div>
                        <div className="p-4 space-y-2.5">
                          {catListP.length === 0
                            ? <p className="text-center text-xs text-slate-400 py-4">No findings</p>
                            : catListP.map(([cat, cnt], i) => {
                                const pct = totalFindingsAll > 0 ? Math.round((cnt / totalFindingsAll) * 100) : 0;
                                const tealHues = ['#0d9488','#0891b2','#06b6d4','#14b8a6','#10b981','#059669'];
                                const col = tealHues[i % tealHues.length];
                                return (
                                  <div key={cat}>
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs font-semibold text-slate-700 truncate max-w-[120px]" title={cat}>{cat}</span>
                                      <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <span className="text-xs font-black" style={{ color:col }}>{cnt}</span>
                                        <span className="text-[10px] text-slate-400">({pct}%)</span>
                                      </div>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div className="h-full rounded-full" style={{ width:`${pct}%`, background:col, transition:'width 0.8s ease-out' }} />
                                    </div>
                                  </div>
                                );
                              })
                          }
                        </div>
                      </div>
                    </div>

                    {/* ── Rule leaderboard ── */}
                    {ruleListP.length > 0 && (
                      <div className="rounded-2xl overflow-hidden" style={T.card}>
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background:'linear-gradient(135deg,#f0fdfa,#ccfbf1)', border:'1px solid #99f6e4' }}>
                            <Shield className="w-4 h-4 text-teal-600" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">Top Triggered Rules</h3>
                            <p className="text-xs text-slate-500">Top {PFD_PERF_TOP_RULES_COUNT} rules by finding frequency</p>
                          </div>
                        </div>
                        <div className="divide-y divide-slate-50">
                          {ruleListP.map(([rule, cnt], i) => {
                            const pct  = totalFindingsAll > 0 ? Math.round((cnt / totalFindingsAll) * 100) : 0;
                            const barW = ruleListP[0]?.[1] > 0 ? Math.round((cnt / ruleListP[0][1]) * 100) : 0;
                            return (
                              <div key={rule} className="px-5 py-2.5 flex items-center gap-3 hover:bg-teal-50/20 transition-colors">
                                <span className="w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0"
                                  style={{ background: i < 3 ? 'linear-gradient(135deg,#0d9488,#0891b2)' : '#f1f5f9', color: i < 3 ? '#fff' : '#64748b' }}>
                                  {i+1}
                                </span>
                                <code className="text-xs font-mono font-bold text-teal-700 flex-shrink-0 w-24 truncate">{rule}</code>
                                <div className="flex-1 min-w-0">
                                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width:`${barW}%`, background:'linear-gradient(90deg,#0d9488,#0891b2)', transition:'width 0.8s ease-out' }} />
                                  </div>
                                </div>
                                <span className="text-xs font-black text-teal-700 flex-shrink-0 w-6 text-right">{cnt}</span>
                                <span className="text-[10px] text-slate-400 flex-shrink-0 w-8 text-right">{pct}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* ── Per-drawing summary table ── */}
                    {drawingSummaryP.length > 1 && (
                      <div className="rounded-2xl overflow-hidden" style={T.card}>
                        <div className="px-5 py-4 border-b border-slate-100">
                          <h3 className="text-sm font-bold text-slate-900">Per-Drawing Summary</h3>
                          <p className="text-xs text-slate-500">{drawingSummaryP.length} drawing{drawingSummaryP.length !== 1 ? 's' : ''} analysed</p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-100">
                                {['Drawing ID','Findings','Top Severity','Action'].map(h => (
                                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wide">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {drawingSummaryP.map(d => (
                                <tr key={d.id} className="hover:bg-teal-50/20 transition-colors cursor-pointer"
                                  onClick={() => { setActiveDrawing(d.id); setActivePanel('findings'); }}>
                                  <td className="px-4 py-2.5"><code className="text-xs font-mono font-bold text-teal-700">{d.id}</code></td>
                                  <td className="px-4 py-2.5">
                                    <span className={`text-xs font-black ${d.count > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{d.count}</span>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    {d.topSev
                                      ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background:`${SEV_COLORS_P[d.topSev]}18`, color:SEV_COLORS_P[d.topSev] }}>{d.topSev}</span>
                                      : <span className="text-[10px] text-emerald-600 font-bold">✓ Pass</span>
                                    }
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <button className="text-[10px] font-semibold text-teal-600 hover:text-teal-800 underline underline-offset-2">View →</button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })()}
              {/* ─── end PERFORMANCE panel ───────────────────────────── */}

              </div>
            </div>
          </div>
          );
        })()}

      </div>
    </DarkBg>
  );
};

export default PFDQualityChecker;
