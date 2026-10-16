/**
 * 🎛️ INSTRUMENT INDEX — Full P&ID Extraction
 *
 * Purpose: Extract ALL instrument tags (Tag No. + full index) from any P&ID PDF.
 * Route:   /engineering/instrument/index
 *
 * Features:
 * - P&ID PDF upload (drag & drop or click)
 * - Optional drawing metadata fields (drawing no., title, revision, project)
 * - AI Vision extraction covering ALL instrument categories
 *   (Flow, Pressure, Temperature, Level, Analysis, SDV/BDV, MOV, PSV, RO, etc.)
 * - Results table with category colour coding + incremental index numbers
 * - Summary stats cards per category
 * - One-click Excel download (Instrument Index + Summary sheets)
 * - Quick-link to Line List page for combined workflow
 *
 * Build: v1.0.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  DocumentTextIcon,
  CloudArrowUpIcon,
  CheckCircleIcon,
  ArrowDownTrayIcon,
  ChartBarIcon,
  ListBulletIcon,
  FolderPlusIcon,
  FolderIcon,
  ChevronRightIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon,
  BoltIcon,
  CpuChipIcon,
  ShieldCheckIcon,
  TagIcon,
  XMarkIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
} from '@heroicons/react/24/outline';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RTooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { BYOK_COST_CONFIG, estimateByokCost } from '../../../config/byokCost.config';
import { loadPdfLibrary } from '../../../components/Common/pdfDocumentLibrary';
import { getApiBaseUrl } from '../../../config/environment.config';
import { STORAGE_KEYS } from '../../../config/app.config';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import {
  useInstrumentProjects,
  ProjectBanner,
  ProjectManagerModal,
  CategoryBadge,
  ProjectSetupPanel,
  INSTRUMENT_PROJECT_CATEGORIES,
  PROJECT_FORM_LIMITS,
  getInstrumentTemplate,
} from './InstrumentProjectManager';
import WrenchAiDocAssist from '../../../components/Engineering/WrenchAiDocAssist';
// Shared project-legend inheritance (bridges local project by NAME)
import ProjectLegendPanel from '../../../components/Engineering/ProjectLegendPanel';
import LegendSheetsModal from '../Process/components/LegendSheetsModal';

// ═════════════════════════════════════════════════════════════════════════════
// PFD-FORMAT REDESIGN — theme, animations & landing-page primitives
// (mirrors the structure of PFDQualityChecker.jsx so /engineering/instrument/index
//  matches the same projects-grid + workspace pattern).
// All visual values are SOFT-CODED in T_INST; JSX consumes T_INST.* only.
// ═════════════════════════════════════════════════════════════════════════════

const T_INST = {
  // Page background — ALIGNED with P&ID Verification V1 (T.bg in PIDVerification.jsx)
  bg: 'linear-gradient(135deg, #f8faff 0%, #eef2ff 45%, #f0f9ff 75%, #fffbeb 100%)',

  blobs: [
    { color: 'rgba(59,130,246,0.09)', size: '520px', top: '-80px',   left: '18%',   anim: 'instFloatA 14s ease-in-out infinite' },
    { color: 'rgba(168,85,247,0.07)', size: '430px', top: '28%',     right: '-60px', anim: 'instFloatB 17s ease-in-out infinite' },
    { color: 'rgba(245,158,11,0.07)', size: '380px', bottom: '-60px', left: '32%',   anim: 'instFloatC 12s ease-in-out infinite' },
    { color: 'rgba(6,182,212,0.06)',  size: '300px', top: '62%',     left: '-40px', anim: 'instFloatA 10s ease-in-out infinite 3s' },
  ],

  card:  { background: '#ffffff', border: '1px solid rgba(59,130,246,0.15)', boxShadow: '0 4px 28px rgba(59,130,246,0.09), 0 1px 4px rgba(0,0,0,0.04)' },
  cardH: { boxShadow: '0 10px 30px rgba(0,0,0,0.10),0 2px 8px rgba(0,0,0,0.05)', borderColor: '#93c5fd', transform: 'translateY(-2px)' },
  panel: { background: 'rgba(255,255,255,0.85)', border: '1px solid #e8edf5', backdropFilter: 'blur(12px)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },

  accent:        'linear-gradient(135deg,#3b82f6,#6366f1)',
  accentHex:     '#3b82f6',
  accentShadow:  '0 4px 18px rgba(99,102,241,0.38)',
  accentShadowLg:'0 8px 28px rgba(99,102,241,0.42)',

  gradBar: 'linear-gradient(90deg,#3b82f6,#6366f1,#f59e0b,#3b82f6)',
  gridDot: 'radial-gradient(circle, rgba(99,102,241,0.055) 1px, transparent 1px)',

  // Card aesthetic — mirrors EQ_T card style in EquipmentList.jsx
  cardEq: { background: 'white', border: '1px solid rgba(59,130,246,0.15)', boxShadow: '0 4px 28px rgba(59,130,246,0.09), 0 1px 4px rgba(0,0,0,0.04)' },

  // Capability chips in hero section (Instrument Index flavor)
  chips: [
    { icon: '🏷️', label: 'Instrument Tags' },
    { icon: '🗂️', label: 'Categories' },
    { icon: '📊', label: 'Excel Export' },
    { icon: '🔑', label: 'BYOK AI' },
  ],
};

// ═════════════════════════════════════════════════════════════════════════════
// EQ_T-style presentation layer — copied from EquipmentList.jsx (EQ_KEYFRAMES)
// with the `eq` prefix renamed to `ii`. Purely visual: entrance animations,
// sticky table header, button hover glow, KPI pop, hero ring/sheen.
// ═════════════════════════════════════════════════════════════════════════════
const II_KEYFRAMES = `
  @keyframes iiGradShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
  @keyframes ii-shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(300%)} }
  @keyframes ii-row-in { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
  @keyframes ii-fade-up { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes ii-kpi-count { from{opacity:0;transform:translateY(8px) scale(0.9)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes iiChipPop { 0%{opacity:0;transform:scale(0.72) translateY(5px)} 62%{transform:scale(1.06) translateY(-1px)} 100%{opacity:1;transform:scale(1) translateY(0)} }
  @keyframes iiNodeGlow { 0%,100%{box-shadow:0 0 10px rgba(59,130,246,0.12),0 4px 16px rgba(59,130,246,0.07)} 50%{box-shadow:0 0 26px rgba(59,130,246,0.26),0 4px 22px rgba(59,130,246,0.13)} }
  @keyframes ii-pulse-badge { 0%,100%{opacity:1} 50%{opacity:0.55} }
  @keyframes ii-hero-ring { to { transform: rotate(360deg); } }
  @keyframes ii-hero-sheen { 0%{transform:translateX(-120%) skewX(-18deg)} 100%{transform:translateX(220%) skewX(-18deg)} }
  @keyframes ii-glow-light { 0%,100%{box-shadow:0 0 6px rgba(59,130,246,0.18)} 50%{box-shadow:0 0 18px rgba(59,130,246,0.38),0 0 36px rgba(59,130,246,0.1)} }
  @keyframes ii-spin-slow { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes iiSpinSlowRev { from{transform:rotate(360deg)} to{transform:rotate(0deg)} }
  .ii-row-animate { animation: ii-row-in 0.3s ease forwards; opacity: 0; }
  .ii-section { animation: ii-fade-up 0.5s ease both; }
  .ii-filter-input::placeholder { color: #94a3b8; }
  .ii-th-sticky { position: sticky; top: 0; z-index: 10; }
  .ii-upload-zone:hover { border-color: rgba(59,130,246,0.55) !important; background: rgba(59,130,246,0.06) !important; }
  .ii-action-btn:hover:not(:disabled) { box-shadow: 0 6px 24px rgba(59,130,246,0.42) !important; transform: translateY(-1px); }
  .ii-export-btn:hover { background: rgba(59,130,246,0.14) !important; border-color: rgba(59,130,246,0.4) !important; }
  .ii-kpi-card { animation: ii-kpi-count 0.45s ease both; }
  .ii-chip { animation: iiChipPop 0.4s ease both; }
  .ii-kpi-node { animation: iiNodeGlow 2.6s ease infinite; }
`;

const KEYFRAMES_INST = `
  @keyframes instFloatA { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(40px,-30px) scale(1.06)} }
  @keyframes instFloatB { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-35px,25px) scale(1.04)} }
  @keyframes instFloatC { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(20px,35px) scale(1.05)} }
  @keyframes instFadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
  @keyframes instCardIn { from{opacity:0;transform:translateY(10px) scale(0.98)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes instChipPop { 0%{transform:scale(0.7) translateY(6px);opacity:0} 70%{transform:scale(1.08) translateY(-1px)} 100%{transform:scale(1) translateY(0);opacity:1} }
  @keyframes instSpinSlow    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes instSpinSlowRev { from{transform:rotate(0deg)} to{transform:rotate(-360deg)} }
  @keyframes instGradShift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
  @keyframes instNodeGlow { 0%,100%{box-shadow:0 0 0 0 rgba(99,102,241,0);transform:scale(1)} 50%{box-shadow:0 0 18px 4px rgba(99,102,241,0.30);transform:scale(1.03)} }
  @keyframes instCountUp { from{transform:translateY(8px);opacity:0} to{transform:translateY(0);opacity:1} }
  @keyframes instPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes instFsIn  { from{opacity:0;transform:scale(0.985)} to{opacity:1;transform:scale(1)} }
  /* Fullscreen overlay: lifts the whole page above app chrome (header/sidebar). */
  .inst-fullscreen-wrap {
    position: fixed; inset: 0; z-index: 9990;
    overflow-y: auto;
    animation: instFsIn 0.22s ease both;
  }
  /* Hide global body scroll while in fullscreen so only the overlay scrolls. */
  body.inst-fullscreen-lock { overflow: hidden !important; }
`;

// Soft-coded hero capability badges (instrument flavor)
const INST_HERO_BADGES = [
  { label: 'ISA 5.1 compliant',   icon: '🏷️', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  { label: 'AI Vision multi-pass', icon: '🤖', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { label: 'Legend cross-check',   icon: '🔍', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  { label: 'Excel export',         icon: '📊', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
];

// Soft-coded: 3-step "How it works" cards (mirrors PFD layout)
const INST_HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Upload P&ID PDF',
    desc:  'Drag & drop or browse — single or multi-page. Your draft is auto-saved per project, so you can pause and continue anytime.',
    icon:  CloudArrowUpIcon,
    accent: '#3b82f6',
    border: '#ddd6fe',
    bg: 'linear-gradient(135deg,#faf5ff,#f5f3ff)',
  },
  {
    step: '2',
    title: 'AI Vision Multi-Pass Scan',
    desc:  '7-pass scan: standard + 90°/270° rotations + 4 quadrant tiles. Catches every instrument bubble, no matter the orientation. Optionally bring your own Claude / OpenAI key (BYOK) for maximum accuracy — never stored.',
    icon:  CpuChipIcon,
    accent: '#6366f1',
    border: '#c7d2fe',
    bg: 'linear-gradient(135deg,#eef2ff,#e0e7ff)',
  },
  {
    step: '3',
    title: 'Conditional Legend Cross-Check',
    desc:  'When a legend is configured in the Legends Manager — or a matching sheet is found in AWS S3 — extracted symbols are cross-verified against it. Without a legend, extraction still runs normally.',
    icon:  ShieldCheckIcon,
    accent: '#0f766e',
    border: '#99f6e4',
    bg: 'linear-gradient(135deg,#f0fdfa,#ccfbf1)',
  },
  {
    step: '4',
    title: 'Indexed & Ready to Export',
    desc:  'Categorised by ISA 5.1 and deduplicated. Review in the table, category charts or ISA matrix, edit rows inline, then one-click Excel export with summary sheet.',
    icon:  TagIcon,
    accent: '#0891b2',
    border: '#a5f3fc',
    bg: 'linear-gradient(135deg,#ecfeff,#e0f2fe)',
  },
];

// Soft-coded ring tick angles (decorative SVG on hero — mirrors PFD's RULE_RING_TICKS)
const INST_RING_TICKS = Array.from({ length: 12 }, (_, i) => i * 30);

// ─── Full-page animated background (PFD-format DarkBg, instrument palette) ───
const InstBg = ({ children, fullscreen = false }) => (
  <div
    className={`min-h-screen relative overflow-hidden${fullscreen ? ' inst-fullscreen-wrap' : ''}`}
    style={{ background: T_INST.bg }}
  >
    <style>{KEYFRAMES_INST + II_KEYFRAMES}</style>
    <div className="fixed inset-0 pointer-events-none"
      style={{ backgroundImage: T_INST.gridDot, backgroundSize: '44px 44px' }} />
    {T_INST.blobs.map((b, i) => (
      <div key={i} className="absolute rounded-full pointer-events-none"
        style={{
          width: b.size, height: b.size, top: b.top, bottom: b.bottom, left: b.left, right: b.right,
          background: `radial-gradient(circle, ${b.color} 0%, transparent 70%)`,
          animation: b.anim,
        }} />
    ))}
    <div className="absolute inset-x-0 top-0 h-[3px] pointer-events-none"
      style={{ backgroundImage: T_INST.gradBar, backgroundSize: '300% auto', animation: 'instGradShift 3s linear infinite' }} />
    <div className="relative z-10">{children}</div>
  </div>
);

// ─── Project card (PFD-format card grid item) ───────────────────────────────
function InstProjectCard({ project, idx, onSelect, onEdit, onDelete }) {
  const cat = INSTRUMENT_PROJECT_CATEGORIES.find(c => c.id === project.category) || INSTRUMENT_PROJECT_CATEGORIES[0];
  return (
    <div
      onClick={() => onSelect(project.id)}
      className="group relative rounded-2xl p-6 cursor-pointer transition-all duration-300 overflow-hidden"
      style={{ ...T_INST.card, animation: `instCardIn 0.55s ease-out ${0.05 + idx * 0.07}s both` }}
      onMouseEnter={e => Object.assign(e.currentTarget.style, T_INST.cardH)}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = T_INST.card.boxShadow; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = ''; }}>
      {/* Animated accent bar on hover */}
      <div className="absolute top-0 left-0 right-0 rounded-t-2xl overflow-hidden h-[3px]">
        <div className="h-full w-0 group-hover:w-full transition-all duration-500 ease-out rounded-t-2xl"
          style={{ background: T_INST.accent }} />
      </div>
      <div className="flex items-start justify-between mb-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center transition-colors text-xl"
          style={{ background: '#eef2ff', border: '1px solid #c7d2fe', animation: 'instNodeGlow 3s ease-in-out infinite' }}>
          {cat.icon}
        </div>
        <ChevronRightIcon className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all duration-300" />
      </div>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${cat.badgeBg} ${cat.badgeText} border ${cat.badgeBorder}`}>
          {cat.label}
        </span>
      </div>
      <h3 className="text-base font-bold text-slate-900 mb-1 group-hover:text-indigo-700 transition-colors line-clamp-1">{project.name}</h3>
      {project.description && <p className="text-xs text-slate-400 line-clamp-2 mb-3">{project.description}</p>}
      <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-100 mb-3">
        <span className="font-mono">{project.code || '—'}</span>
        <span>{project.created_at ? new Date(project.created_at).toLocaleDateString() : '—'}</span>
      </div>
      <div className="flex gap-2">
        <button onClick={ev => { ev.stopPropagation(); onEdit(project); }}
          className="flex-1 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1.5 text-xs font-medium">
          <PencilSquareIcon className="w-3.5 h-3.5" />Edit
        </button>
        <button onClick={ev => { ev.stopPropagation(); onDelete(project); }}
          className="flex-1 px-3 py-1.5 bg-red-50 border border-red-100 text-red-500 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5 text-xs font-medium">
          <TrashIcon className="w-3.5 h-3.5" />Delete
        </button>
      </div>
    </div>
  );
}

// ─── Quick-create modal (single name + category, PFD-format) ────────────────
function InstQuickCreateModal({ open, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(INSTRUMENT_PROJECT_CATEGORIES[0].id);
  const [err, setErr] = useState(null);
  useEffect(() => { if (open) { setName(''); setCategoryId(INSTRUMENT_PROJECT_CATEGORIES[0].id); setErr(null); } }, [open]);
  if (!open) return null;
  const submit = (e) => {
    e?.preventDefault?.();
    const n = name.trim();
    if (!n) { setErr('Enter a project name to continue.'); return; }
    if (n.length > PROJECT_FORM_LIMITS.nameMax) { setErr(`Name must be ${PROJECT_FORM_LIMITS.nameMax} characters or less.`); return; }
    onCreate({ name: n, category: categoryId });
  };
  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      style={{ background: 'rgba(15,23,42,0.45)' }}>
      <form onSubmit={submit} className="rounded-2xl max-w-lg w-full p-6 bg-white border border-slate-200 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: T_INST.accent, boxShadow: T_INST.accentShadow }}>
              <FolderPlusIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">New Instrument Project</h3>
              <p className="text-xs text-slate-500 mt-0.5">Name it now — code, client &amp; metadata can be added later.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <XMarkIcon className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Project Name</label>
            <input
              autoFocus
              type="text"
              value={name}
              maxLength={PROJECT_FORM_LIMITS.nameMax}
              onChange={(e) => { setName(e.target.value); if (err) setErr(null); }}
              placeholder="e.g. SAHIL Phase 3 — Pig Receiver"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
            />
            <div className="text-[10px] text-slate-400 mt-1 text-right">{name.length}/{PROJECT_FORM_LIMITS.nameMax}</div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
            >
              {INSTRUMENT_PROJECT_CATEGORIES.map(c => (
                <option key={c.id} value={c.id}>
                  {c.icon}  {c.label}{c.short ? ` — ${c.short}` : ''}
                </option>
              ))}
            </select>
            {(() => {
              const sel = INSTRUMENT_PROJECT_CATEGORIES.find(c => c.id === categoryId);
              return sel?.description ? (
                <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">{sel.description}</p>
              ) : null;
            })()}
          </div>
          {err && <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">⚠ {err}</div>}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            Cancel
          </button>
          <button type="submit"
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg transition-all hover:-translate-y-px"
            style={{ background: T_INST.accent, boxShadow: T_INST.accentShadow }}>
            <FolderPlusIcon className="w-4 h-4" />Create Project
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Confirm-delete modal ───────────────────────────────────────────────────
function InstConfirmModal({ open, title, message, onCancel, onConfirm, danger }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      style={{ background: 'rgba(15,23,42,0.45)' }}>
      <div className="rounded-2xl max-w-md w-full p-6 bg-white border border-slate-200 shadow-2xl">
        <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-600 mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
            {danger ? 'Delete' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Config ──────────────────────────────────────────────────────────────────
const API_BASE = getApiBaseUrl();
// Upload timeout — multi-page P&IDs can take a long time per sheet.
// Soft-coded (env-tunable) so dense ADNOC-style drawings with hundreds of
// instrument tags per page don't trip a fixed 10-min cap.  Override at build
// time via VITE_INSTRUMENT_INDEX_UPLOAD_TIMEOUT_MS (milliseconds).
// Must stay <= Vite proxy `proxyTimeout` (see frontend/vite.config.js) and
// <= Gunicorn worker timeout (40 min per gunicorn_config.py) / the Celery
// task soft limit (50 min — pid_analysis/tasks.py II_TASK_SOFT_LIMIT_S).
// Default: 55 min — the Celery task may legitimately run up to 50 min on
// dense multi-page P&IDs; the old 28-min cap aborted polling while the
// server was still working (and a Railway deploy can also restart the
// worker, redelivering the job). Override via VITE_INSTRUMENT_INDEX_UPLOAD_TIMEOUT_MS.
const UPLOAD_TIMEOUT_MS = Number(
  import.meta.env?.VITE_INSTRUMENT_INDEX_UPLOAD_TIMEOUT_MS
) || 3_300_000;

// ─── Network resilience (soft-coded) ─────────────────────────────────────────
// Railway's edge proxy / shared infra occasionally drops long-running HTTPS
// connections (surfaces as `ERR_CONNECTION_RESET` / `TypeError: Failed to fetch`).
// Gunicorn itself is configured for a 20-min worker timeout, so the request
// is almost always still progressing server-side.  We add a small soft retry
// that ONLY fires on transient network errors (never on HTTP 4xx/5xx) so a
// single proxy blip doesn't force the user to re-upload a 50-page P&ID.
const NETWORK_RETRY_CONFIG = {
  maxRetries:     2,        // total attempts = 1 + maxRetries
  backoffBaseMs:  4000,     // 4 s, then 8 s, then 16 s …
  backoffFactor:  2,
  // Substrings (case-insensitive) that mark a transient network error.
  transientMarkers: [
    'failed to fetch',
    'network error',
    'load failed',
    'connection reset',
    'econnreset',
    'err_connection',
    'err_network',
  ],
};
const isTransientNetworkError = (err) => {
  if (!err) return false;
  if (err.name === 'AbortError') return false;            // user aborted / timeout
  const msg = (err.message || '').toLowerCase();
  return NETWORK_RETRY_CONFIG.transientMarkers.some(m => msg.includes(m));
};
const CONN_RESET_HELP_MSG =
  'Connection was reset by the upstream proxy. This usually clears on its own — ' +
  'we retried automatically. If it keeps failing, try splitting the PDF into smaller files (≤ 10 pages).';

// ─── AI Document Assist (Wrench) — soft-coded panel config ──────────────────
// Mirrors the panel used on /engineering/process/pid-verification and
// /engineering/piping/pms.  Set `enabled: false` to hide without touching JSX.
const AI_DOC_ASSIST_CONFIG = {
  enabled:         false,   // hidden — upload works directly via drop zone
  title:           'AI Document Assist',
  subtitleTag:     '(Wrench · optional)',
  subtitle:        'Let RAD AI pick & recommend the right P&ID PDF for this project from Wrench DMS',
  defaultHint:     'instrument index p&id',
  hintPlaceholder: 'e.g. instrumentation, unit 100, control room',
  topN:            5,
  // Instrument Index extraction accepts ONLY PDF P&IDs.
  acceptedExts:    ['pdf'],
};

// ─── Stage-by-stage User Instructions & gating (soft-coded) ─────────────────
// Four-stage guided flow inside the upload card. Each stage carries its own
// instruction panel and an `isUnlocked(state)` gate — a stage's content stays
// hidden until the previous stage is completed (or explicitly skipped when
// optional). Edit text/links/gates here without touching JSX or core logic.
const STAGE_FLOW = [
  {
    id: 'upload',
    num: 1,
    title: 'Upload P&ID Drawing (PDF)',
    optional: false,
    isComplete: (s) => Boolean(s.pidFile),
    isUnlocked: () => true,
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
    id: 'legend',
    num: 2,
    title: 'Attach Legend / Symbol Sheet',
    optional: true,
    isComplete: (s) => Boolean(s.legendFile),
    isUnlocked: (s) => Boolean(s.pidFile),
    instruction: {
      heading: 'Cross-check your legends in the Legends Manager',
      bullets: [
        'Open the Legends Manager to review and cross-check the symbol legends configured for this project.',
        'Extracted values are automatically verified against your active project legends (and matching sheets in AWS S3 when available).',
        'Facing any difficulty with legends? Raise a request with the ICT department via My Enquiries.',
      ],
      action: { label: 'Open Legend Manager', route: '/engineering/legends?section=instrument_index&returnTo=/engineering/instrument/index&from=Instrument%20Index' },
      note: 'Optional — you may skip this step, but a configured legend improves verification accuracy. After aligning legends, use the "Return" banner in the Legend Manager to come back here.',
    },
  },
  {
    id: 'metadata',
    num: 3,
    title: 'Drawing Info',
    optional: true,
    isComplete: (s) => Boolean(s.drawingNumber || s.drawingTitle),
    isUnlocked: (s) => Boolean(s.pidFile) && (Boolean(s.legendFile) || Boolean(s.skipped.legend)),
    instruction: {
      heading: 'Fill in the drawing details',
      bullets: [
        'Enter the drawing number, title, revision and project name.',
        'These details are stamped on the exported Excel workbook and reports.',
      ],
      note: 'Optional — you may skip this step if the drawing number was auto-filled on upload.',
    },
  },
  {
    id: 'byok',
    num: 4,
    title: 'AI Extraction Key — BYOK',
    optional: true,
    isComplete: (s) => Boolean(s.byokApiKey && s.byokApiKey.trim()),
    isUnlocked: (s) =>
      Boolean(s.pidFile) &&
      (Boolean(s.legendFile) || Boolean(s.skipped.legend)) &&
      (Boolean(s.drawingNumber || s.drawingTitle) || Boolean(s.skipped.metadata)),
    instruction: {
      heading: 'Add your AI extraction key (BYOK)',
      bullets: [
        'Provide your own OpenAI or Claude API key for the most accurate extraction — it is used before the shared engines and is never stored.',
        "Don't have a key? Raise a ticket with the ICT department via My Enquiries to get one issued.",
      ],
      action: { label: 'Raise a ticket with ICT', route: '/my-enquiries' },
      note: 'Your own key gives the best accuracy and is never stored. Don\'t have one? Raise a ticket with ICT via My Enquiries.',
    },
  },
];

// ─── Legend attach options (soft-coded) ─────────────────────────────────────
// Legend PDF upload is currently unavailable — `enabled:false` swaps the
// drop zone for a smart guidance card (Legends Manager + ICT request).
// Flip to `true` to restore the PDF drop zone; no core logic changes either way.
const LEGEND_ATTACH_CONFIG = {
  pdfUploadEnabled: false,
  unavailableTitle: 'Legend PDF upload is currently unavailable',
  unavailableBody:
    'Legends are managed centrally in the Legends Manager — cross-check or configure the symbol legends for this project there. ' +
    'If you face any difficulty, raise a request with the ICT department and they will set it up for you.',
  // `returnTo`/`from` query params let the Legend Manager render a
  // "return to Instrument Index" banner so users can come back after aligning legends.
  legendManager: { label: 'Open Legend Manager', route: '/engineering/legends?section=instrument_index&returnTo=/engineering/instrument/index&from=Instrument%20Index' },
  raiseRequest:  { label: 'Raise a Request (ICT)', route: '/my-enquiries' },
};

// Smart guidance card shown when legend PDF upload is disabled (soft-coded).
// onAction (optional) runs before navigating to the Legend Manager — marks
// the legend stage addressed for the submit gate.
function LegendGuidanceCard({ onAction }) {
  const navigate = useNavigate();
  return (
    <div className="border border-dashed border-cyan-200 rounded-lg p-4 mb-4 bg-cyan-50/40">
      <div className="flex items-start gap-3">
        <span className="flex items-center justify-center h-8 w-8 rounded-full bg-cyan-100 text-cyan-700 text-sm shrink-0">
          ℹ️
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-cyan-900">{LEGEND_ATTACH_CONFIG.unavailableTitle}</p>
          <p className="text-xs text-cyan-800/80 mt-1 leading-relaxed">{LEGEND_ATTACH_CONFIG.unavailableBody}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              onClick={() => { onAction?.(); navigate(LEGEND_ATTACH_CONFIG.legendManager.route); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-md transition-all hover:-translate-y-px"
              style={{ background: 'linear-gradient(135deg,#0891b2,#0e7490)', boxShadow: '0 2px 8px rgba(8,145,178,0.3)' }}
            >
              {LEGEND_ATTACH_CONFIG.legendManager.label} <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => navigate(LEGEND_ATTACH_CONFIG.raiseRequest.route)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-cyan-700 bg-white hover:bg-cyan-50 border border-cyan-300 rounded-md transition-colors"
            >
              {LEGEND_ATTACH_CONFIG.raiseRequest.label} <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Soft-coded per-stage "User Instruction" panel — purely presentational.
// onAction (optional) runs before following the action route — used so the
// Legend Manager redirect also marks the legend stage as addressed.
function StageInstruction({ stage, onAction }) {
  const navigate = useNavigate();
  const { heading, bullets = [], note, action } = stage.instruction || {};
  if (!heading) return null;
  return (
    <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50/60 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-sky-700 mb-2">
        📘 User Instruction — {heading}
      </p>
      <ul className="list-disc list-inside space-y-1 text-xs text-slate-600">
        {bullets.map((b, i) => <li key={i}>{b}</li>)}
      </ul>
      {action && (
        <button
          type="button"
          onClick={() => { onAction?.(); navigate(action.route); }}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-700 bg-white hover:bg-sky-50 border border-sky-300 rounded-md transition-colors"
        >
          {action.label} <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
        </button>
      )}
      {note && <p className="mt-2 text-[11px] italic text-slate-400">{note}</p>}
    </div>
  );
}

// Soft-coded locked placeholder — shown in place of a stage's content until
// its `isUnlocked(state)` gate passes (keeps later steps hidden, per UX rule).
function StageGate({ stage }) {
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

// Soft-coded "skip" affordance for optional stages — skipping marks the stage
// as addressed so the next stage unlocks. No effect on core extraction logic.
function StageSkipButton({ stage, onSkip }) {
  if (!stage.optional) return null;
  return (
    <button
      type="button"
      onClick={onSkip}
      className="mb-4 inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors"
      title={`Continue without "${stage.title}"`}
    >
      Skip this step →
    </button>
  );
}

// ─── Related-tools recommendations (soft-coded) ──────────────────────────────
// Each entry produces a cross-link pill in the hero, a quick-launch button in
// the toolbar, and a capabilities-list bullet.  Add new tools here without
// touching JSX.
const INST_RELATED_TOOLS = [
  {
    id:           'line_list',
    label:        'Line List',
    path:         '/engineering/process/line-list',
    heroPrefix:   'Cross-linked with',
    capability:   ['Combine with Line List', 'Use the Line List page to extract piping lines from the same P&ID for a complete project dataset.'],
    showHero:     true,
    showToolbar:  true,
    showCapability: true,
    toolbarStyle: 'primary',   // uses T_INST.accent gradient
  },
  {
    id:           'io_list',
    label:        'IO List',
    path:         '/engineering/instrument/datasheet/io-list',
    heroPrefix:   'Also recommended',
    capability:   ['Generate IO List', 'Pipe the extracted instruments straight into the IO List generator — IO type, system (DCS/ESD), signal, IS/NIS, wiring and voltage are inferred automatically using the project rule set.'],
    showHero:     true,
    showToolbar:  true,
    showCapability: true,
    toolbarStyle: 'secondary', // outlined button
  },
];

// ─── Fullscreen layout (soft-coded) ──────────────────────────────────────────
// Edit max-widths / paddings here without touching JSX.  Mirrors LineList
// pattern (LAYOUT_CONFIG) so behaviour is consistent across the engineering
// pages.  `enabled: false` hides the toggle button entirely.
const INST_LAYOUT_CONFIG = {
  enabled:             true,
  normalMaxWidth:      '100%',    // full-width canvas like PID Verification V1
  normalPaddingX:      '1.5rem',
  normalPaddingY:      '2rem',
  fullscreenMaxWidth:  '100%',
  fullscreenPaddingX:  '1.5rem',
  fullscreenPaddingY:  '1.25rem',
  bodyLockClass:       'inst-fullscreen-lock',  // see KEYFRAMES_INST
  /* localStorage key so the choice persists across reloads */
  persistKey:          'instIndex.isFullscreen.v1',
};

// Soft-coded category colours (must stay in sync with service CATEGORY_COLOURS)
const CATEGORY_COLOURS = {
  'Flow':                  { bg: '#DDEEFF', text: '#1A3A6B' },
  'Pressure':              { bg: '#FFE4CC', text: '#7A2E00' },
  'Temperature':           { bg: '#FFE4E4', text: '#7A1010' },
  'Level':                 { bg: '#E4F4E4', text: '#1A5C1A' },
  'Differential Pressure': { bg: '#FFF9CC', text: '#665500' },
  'Analysis':              { bg: '#E8E4FF', text: '#3A1A8C' },
  'Safety':                { bg: '#FFCCCC', text: '#8C0000' },
  'Shutdown & ESD':        { bg: '#FFD9D9', text: '#660000' },
  'Control Valves':        { bg: '#CCFFEE', text: '#005533' },
  'Motor & Solenoid':      { bg: '#E0E0FF', text: '#220066' },
  'Position':              { bg: '#FFFACC', text: '#554400' },
  'Restriction':           { bg: '#DDEEDD', text: '#224422' },
  'Special':               { bg: '#F0F0F0', text: '#333333' },
};

// ─── Soft-coded: in-memory session cache ────────────────────────────────────
// Keeps stage inputs (uploaded File, drawing info, skipped stages) alive
// across in-app route navigation — e.g. the Legend Manager round-trip in
// step 2 unmounts this page; without this cache the upload would be lost.
// Module-scope only: cleared on full browser reload (intentional — File
// objects cannot be persisted to storage safely).
const II_SESSION_CACHE = {
  enabled: true,               // master switch — false restores legacy behaviour
  projectId: null,             // cache is only honoured for the same project
  pidFile: null,
  legendFile: null,
  drawingNumber: '',
  drawingTitle: '',
  revision: '0',
  projectName: '',
  skippedStages: {},
  byokChoice: '',                // submit-gate choice — the API key itself is NEVER cached
};

// ─── Soft-coded: IndexedDB auto-save (per-project draft) ────────────────────
// Persists the stage inputs — including the uploaded PDF File object — so a
// user can leave while waiting (e.g. for an ICT-issued AI extraction key) and
// later return to the project to continue exactly where they left off.
// Survives page reloads and browser restarts. IndexedDB structured-clone
// supports File/Blob natively.
// SECURITY: the BYOK API key is NEVER persisted (see `excludeKeys`).
const II_AUTOSAVE = {
  enabled:      true,
  dbName:       'radai_instrument_index',
  storeName:    'session_drafts',
  debounceMs:   500,
  excludeKeys:  ['byokApiKey'],           // never write secrets to disk
  savedLabel:   '💾 Draft auto-saved',    // small status chip in the UI
};

// Minimal promise-wrapped IndexedDB helpers (module scope, no dependencies).
const iiIdb = {
  open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(II_AUTOSAVE.dbName, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(II_AUTOSAVE.storeName);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async put(key, value) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(II_AUTOSAVE.storeName, 'readwrite');
      tx.objectStore(II_AUTOSAVE.storeName).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  async get(key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const req = db.transaction(II_AUTOSAVE.storeName, 'readonly')
        .objectStore(II_AUTOSAVE.storeName).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },
};

// ─── Soft-coded: enterprise results presentation ────────────────────────────
// Controls the results command bar, view-tab badges and status strips shown
// after extraction. Purely presentational — edit copy/colours here.
const II_RESULTS_UI = {
  commandBar: {
    enabled: true,
    eyebrow: 'Extraction Complete',
    title:   'Instrument Index Results',
    // chips shown left→right when values are available
    chips: [
      { key: 'drawingNumber', label: 'DWG' },
      { key: 'drawingTitle',  label: 'Title' },
      { key: 'revision',      label: 'Rev' },
      { key: 'projectName',   label: 'Project' },
    ],
    totalLabel: 'Instruments',
  },
  tabs: {
    showCounts: true,   // count badges on the view tabs
  },
  statusBar: {
    enabled: true,      // table footer: "Showing X of Y · Z selected"
  },
};

// ─── Soft-coded: enterprise "register" presentation ─────────────────────────
// Restyles the extraction results after the Deliverable_template register
// pattern: breadcrumb header, register/rev/status chips, underline tabs,
// white KPI stat cards, paginated table footer. Purely presentational.
const II_REGISTER_UI = {
  enabled:   true,
  accent:    '#0f766e',          // enterprise teal (template accent)
  accentSoft:'#f0fdfa',
  statusChip:{ label: 'Extracted', bg: '#e0f2fe', text: '#0369a1' },
  breadcrumbRoot: 'Projects',
  subtitle:  'Engineering instrument register — AI-extracted and ready for validation',
  pageSize:  10,                 // table rows per page (pagination footer)
  pageSizeOptions: [10, 25, 50],
  kpis: [
    { id: 'total',      label: 'Total items',    color: '#0f766e' },
    { id: 'categories', label: 'Categories',     color: '#0369a1' },
    { id: 'warnings',   label: 'Warnings',       color: '#b45309' },
    { id: 'inferred',   label: 'Inferred',       color: '#a21caf' },
    { id: 'selected',   label: 'Selected',       color: '#475569' },
  ],
  // Innovative visualizations (recharts) — toggleable without touching JSX.
  visuals: {
    summaryDonut:   true,   // Category Summary: donut distribution chart
    summaryBars:    true,   // Category Summary: horizontal ranked bars
    bubbleMatrix:   true,   // ISA Layout Matrix: bubble-size heatmap cells
    bubbleMinPx:    22,
    bubbleMaxPx:    46,
  },
};

// ─── Soft-coded: submit gate ─────────────────────────────────────────────────
// "Extract Instrument Index" stays disabled until all four stages are
// explicitly verified by the user. Stage 4 is a required CHOICE: a BYOK key
// entered, or an explicit opt-in to the shared engines. Mirrors the IO List
// submit gate. enabled:false restores legacy behaviour (file+project only).
const II_SUBMIT_GATE = {
  enabled: true,
  // BYOK-only mode: hide the "shared engines" choice — extraction requires
  // the user's own AI key. Flip to false to restore both choices.
  byokOnly: true,
  choices: {
    byok: {
      id: 'byok',
      label: 'Use my AI key (BYOK)',
      desc: 'Best accuracy — paste your Claude / OpenAI key below. Never stored.',
      icon: '🔑',
    },
    shared: {
      id: 'shared',
      label: 'Continue with shared engines',
      desc: 'No key needed — uses the platform shared engines (can be quota-limited).',
      icon: '⚙️',
    },
  },
  checklistTitle: 'Verify each step to enable extraction:',
  stages: [
    { id: 'upload',   label: 'P&ID PDF uploaded' },
    { id: 'legend',   label: 'Legend step addressed (cross-checked or skipped)' },
    { id: 'metadata', label: 'Drawing info filled or skipped' },
    { id: 'byok',     label: 'AI key choice confirmed' },
  ],
  byokKeyHint: 'Key choice selected — paste your API key below to complete.',
};

const DEFAULT_COLOUR = { bg: '#F5F5F5', text: '#333333' };

function categoryStyle(cat) {
  return CATEGORY_COLOURS[cat] || DEFAULT_COLOUR;
}

// ─── Soft-coded Step-by-Step Workflow ────────────────────────────────────────
// Each step is gated by `isUnlocked(state)` and marked complete via
// `isComplete(state)`. Add or reorder steps here without changing JSX.
const WORKFLOW_STEPS = [
  {
    id: 'project',
    num: 1,
    title: 'Project Setup',
    subtitle: 'Pick or create the project this drawing belongs to.',
    isUnlocked: () => true,
    isComplete: (s) => Boolean(s.activeProject),
  },
  {
    id: 'upload',
    num: 2,
    title: 'Upload P&ID Drawing (PDF)',
    subtitle: 'Drop the main P&ID PDF — single or multi-page supported.',
    isUnlocked: (s) => Boolean(s.activeProject),
    isComplete: (s) => Boolean(s.pidFile),
  },
  {
    id: 'legend',
    num: 3,
    title: 'Attach Legend / Symbol Sheet',
    subtitle: 'Optional — used for symbol cross-verification.',
    optional: true,
    isUnlocked: (s) => Boolean(s.pidFile),
    isComplete: (s) => Boolean(s.legendFile),
  },
  {
    id: 'metadata',
    num: 4,
    title: 'Drawing Info',
    subtitle: 'Optional — drawing number, title, revision.',
    optional: true,
    isUnlocked: (s) => Boolean(s.pidFile),
    isComplete: (s) => Boolean(s.drawingNumber || s.drawingTitle),
  },
  {
    id: 'extract',
    num: 5,
    title: 'Extract Instrument Index',
    subtitle: 'Run AI Vision extraction on the uploaded drawing.',
    isUnlocked: (s) => Boolean(s.activeProject && s.pidFile),
    isComplete: (s) => Boolean(s.result),
  },
];

// Compact horizontal stepper (soft-coded — renders WORKFLOW_STEPS).
function WorkflowStepper({ steps, state }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
      <ol className="flex flex-wrap items-center gap-2">
        {steps.map((step, idx) => {
          const complete = step.isComplete(state);
          const unlocked = step.isUnlocked(state);
          const active   = unlocked && !complete;
          const tone = complete
            ? 'bg-emerald-500 text-white border-emerald-500'
            : active
              ? 'bg-purple-600 text-white border-purple-600 ring-2 ring-purple-200'
              : 'bg-gray-100 text-gray-400 border-gray-200';
          const labelTone = complete
            ? 'text-emerald-700'
            : active ? 'text-purple-700' : 'text-gray-400';
          return (
            <li key={step.id} className="flex items-center gap-2">
              <span className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold border ${tone}`}>
                {complete ? '✓' : step.num}
              </span>
              <div className="flex flex-col">
                <span className={`text-xs font-semibold ${labelTone}`}>
                  {step.title}
                  {step.optional && <span className="ml-1 text-[10px] font-normal text-gray-400">(optional)</span>}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <span className={`hidden sm:block w-6 h-px ${complete ? 'bg-emerald-300' : 'bg-gray-200'}`} />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// Soft-coded "locked" placeholder shown for steps whose prerequisites are unmet.
function LockedStepCard({ step, hint, action }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-dashed border-gray-200 p-6 mb-6 opacity-90">
      <div className="flex items-start gap-4">
        <span className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-100 text-gray-400 text-sm font-bold border border-gray-200 shrink-0">
          {step.num}
        </span>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-gray-500 flex items-center gap-2">
            <span>🔒</span> {step.title}
          </h3>
          <p className="text-xs text-gray-400 mt-1">{hint || step.subtitle}</p>
        </div>
        {action}
      </div>
    </div>
  );
}

// ─── Edit-Row Modal ──────────────────────────────────────────────────────────
// Soft-coded: renders one input per entry in `template.editableFields`.
// Adding a new field to the registry on InstrumentProjectManager is enough —
// no edits required here.
function EditInstrumentModal({ open, draft, fields, onChange, onClose, onSave }) {
  if (!open || !draft || !Array.isArray(fields) || fields.length === 0) return null;

  // Group fields by their `group` attribute (preserving first-seen order).
  const groups = [];
  const seen = new Map();
  fields.forEach(f => {
    const g = f.group || 'Fields';
    if (!seen.has(g)) {
      seen.set(g, groups.length);
      groups.push({ name: g, items: [] });
    }
    groups[seen.get(g)].items.push(f);
  });

  const setField = (key, value) => onChange({ ...draft, [key]: value });

  const tag = draft.tag_number || '(new)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
         onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-blue-50 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800">Edit Instrument</h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">{tag}</p>
          </div>
          <button onClick={onClose} title="Close"
                  className="p-1.5 rounded-md hover:bg-white/70 text-slate-500 hover:text-slate-800 transition">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Body — scrollable, grouped accordion-style */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {groups.map(grp => (
            <fieldset key={grp.name} className="border border-slate-200 rounded-lg p-4">
              <legend className="px-2 text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                {grp.name}
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                {grp.items.map(f => {
                  const v = draft[f.key] ?? '';
                  const common =
                    'mt-1 w-full px-2.5 py-1.5 text-sm rounded-md border border-slate-300 ' +
                    'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ' +
                    'bg-white text-slate-800';
                  return (
                    <label key={f.key} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
                      <span className="text-[11px] font-semibold text-slate-600">{f.label}</span>
                      {f.type === 'textarea' ? (
                        <textarea
                          rows={2}
                          value={v}
                          onChange={e => setField(f.key, e.target.value)}
                          className={common + ' resize-y'}
                          placeholder={f.hint || ''}
                        />
                      ) : f.type === 'select' ? (
                        <select
                          value={v}
                          onChange={e => setField(f.key, e.target.value)}
                          className={common}
                        >
                          {(f.options || ['']).map(opt => (
                            <option key={opt} value={opt}>{opt === '' ? '— (blank) —' : opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={f.type === 'number' ? 'number' : 'text'}
                          value={v}
                          onChange={e => setField(f.key, e.target.value)}
                          className={common}
                          placeholder={f.hint || ''}
                        />
                      )}
                      {f.hint && f.type !== 'textarea' && (
                        <span className="text-[10px] text-slate-400 italic mt-0.5 block">{f.hint}</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
          <button onClick={onClose}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-md border border-slate-300 text-slate-600 bg-white hover:bg-slate-100 transition">
            Cancel
          </button>
          <button onClick={onSave}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-gradient-to-r from-indigo-500 to-blue-600 text-white hover:from-indigo-600 hover:to-blue-700 shadow-sm transition">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const InstrumentIndex = () => {
  const navigate = useNavigate();

  // ── Project Management (Phase 1) ────────────────────────────────────
  const {
    projects, activeProject, activeId, setActiveId,
    upsertProject, archiveProject, restoreProject, deleteProject,
  } = useInstrumentProjects();
  const [projectManagerOpen, setProjectManagerOpen] = useState(false);
  const [pmInitialView, setPmInitialView] = useState(null);
  const [pmInitialCategory, setPmInitialCategory] = useState(null);

  // Shared project-legend panel (soft-coded — see INST_LEGEND_PANEL)
  const [legendModalOpen, setLegendModalOpen] = useState(false);

  // Open the manager in a specific mode (used by ProjectSetupPanel quick-picks)
  const openManager = (opts = {}) => {
    setPmInitialView(opts.view || null);
    setPmInitialCategory(opts.category || null);
    setProjectManagerOpen(true);
  };

  // Upload state
  // Stage inputs hydrate from II_SESSION_CACHE so they survive the
  // Legend Manager round-trip (soft-coded; set cache.enabled=false to disable).
  const [pidFile, setPidFile]             = useState(II_SESSION_CACHE.enabled ? II_SESSION_CACHE.pidFile : null);
  const [legendFile, setLegendFile]       = useState(II_SESSION_CACHE.enabled ? II_SESSION_CACHE.legendFile : null);
  const [drawingNumber, setDrawingNumber] = useState(II_SESSION_CACHE.enabled ? II_SESSION_CACHE.drawingNumber : '');
  const [drawingTitle, setDrawingTitle]   = useState(II_SESSION_CACHE.enabled ? II_SESSION_CACHE.drawingTitle : '');
  const [revision, setRevision]           = useState(II_SESSION_CACHE.enabled ? II_SESSION_CACHE.revision : '0');
  const [projectName, setProjectName]     = useState(II_SESSION_CACHE.enabled ? II_SESSION_CACHE.projectName : '');

  // BYOK (Bring Your Own Key) — optional user-supplied OpenAI/Claude key,
  // tried BEFORE the shared/quota-limited engines for accurate extraction.
  // Sent with the upload, never stored anywhere (state only, like the
  // SLD Checker's key field).
  const [byokProvider, setByokProvider]   = useState('claude');
  const [byokApiKey, setByokApiKey]       = useState('');
  const [byokModel, setByokModel]         = useState('');
  // BYOK key self-test (soft-coded) — validates the key server-side with
  // one minimal call before a long extraction run. Required in byokOnly mode.
  const [byokTesting, setByokTesting]     = useState(false);
  const [byokTestResult, setByokTestResult] = useState(null);   // { valid, message }

  const handleByokTest = async () => {
    if (!byokApiKey.trim()) { setByokTestResult({ valid: false, message: 'Enter an API key first.' }); return; }
    setByokTesting(true); setByokTestResult(null);
    try {
      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const resp = await fetch(`${API_BASE}/pid/instrument-index/test-key/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ provider: byokProvider, api_key: byokApiKey.trim(), model: byokModel || undefined }),
      });
      const data = await resp.json().catch(() => ({}));
      setByokTestResult({ valid: Boolean(data.valid), message: data.message || (data.valid ? 'Key valid' : 'Test failed') });
    } catch (e) {
      setByokTestResult({ valid: false, message: e.message || 'Connection test failed' });
    } finally {
      setByokTesting(false);
    }
  };

  // ── Stage-flow gating (soft-coded UI only — no core logic) ───────────────
  // Tracks optional stages the user explicitly skipped so the next stage
  // can unlock. Gating rules live in STAGE_FLOW above.
  const [skippedStages, setSkippedStages] = useState(
    II_SESSION_CACHE.enabled ? II_SESSION_CACHE.skippedStages : {}
  );
  const skipStage = (id) => setSkippedStages(prev => ({ ...prev, [id]: true }));
  const stageFlowState = {
    pidFile, legendFile, drawingNumber, drawingTitle, byokApiKey,
    skipped: skippedStages,
  };

  // ── Submit gate (soft-coded; II_SUBMIT_GATE) ────────────────────────────
  // Stage 4 is a required CHOICE: 'byok' (key entered) or 'shared'
  // (explicit opt-in to shared engines). Extract stays disabled until all
  // four stages are verified.
  const [byokChoice, setByokChoice] = useState(
    II_SESSION_CACHE.enabled ? (II_SESSION_CACHE.byokChoice || '') : ''
  );  // '' | 'byok' | 'shared'
  const iiStageVerified = {
    upload:   Boolean(pidFile),
    legend:   Boolean(legendFile) || Boolean(skippedStages.legend),
    metadata: Boolean(drawingNumber || drawingTitle) || Boolean(skippedStages.metadata),
    byok:     (byokChoice === 'shared' && !II_SUBMIT_GATE.byokOnly)
              || (byokChoice === 'byok' && Boolean(byokApiKey.trim()) && byokTestResult?.valid === true),
  };
  const iiAllStagesVerified =
    !II_SUBMIT_GATE.enabled ||
    II_SUBMIT_GATE.stages.every(s => iiStageVerified[s.id]);

  // ── Auto-save: hydration + debounced persistence (soft-coded) ────────────
  // hydratedProjectRef tracks which project id has been hydrated from
  // IndexedDB, so we never overwrite a saved draft before restoring it.
  const hydratedProjectRef = useRef(null);
  const [draftSavedAt, setDraftSavedAt] = useState(null);

  // 1) Hydrate the saved draft when the active project resolves.
  useEffect(() => {
    const pid = activeProject?.id;
    if (!II_AUTOSAVE.enabled || !pid || hydratedProjectRef.current === pid) return;
    let cancelled = false;
    (async () => {
      try {
        const draft = await iiIdb.get(pid);
        if (cancelled) return;
        if (draft) {
          // In-memory cache is authoritative for the reset guard below.
          Object.assign(II_SESSION_CACHE, { ...draft, projectId: pid });
          if (draft.pidFile)       setPidFile(draft.pidFile);
          if (draft.legendFile)    setLegendFile(draft.legendFile);
          if (draft.drawingNumber) setDrawingNumber(draft.drawingNumber);
          if (draft.drawingTitle)  setDrawingTitle(draft.drawingTitle);
          if (draft.revision)      setRevision(draft.revision);
          if (draft.skippedStages) setSkippedStages(draft.skippedStages);
          if (draft.byokChoice)    setByokChoice(draft.byokChoice);
          if (draft.savedAt)       setDraftSavedAt(draft.savedAt);
        }
      } catch (_) { /* IDB unavailable (private mode etc.) — in-memory cache still works */ }
      hydratedProjectRef.current = pid;
    })();
    return () => { cancelled = true; };
  }, [activeProject?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── BYOK cost estimate (soft-coded; BYOK_COST_CONFIG) ────────────────────
  // Counts PDF pages client-side (pdfjs, no upload) so the BYOK panel can
  // show an up-front cost estimate for accountability. Non-blocking — the
  // estimate simply doesn't render if page counting fails.
  const [pidPageCount, setPidPageCount] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setPidPageCount(null);
    if (!BYOK_COST_CONFIG.enabled || !pidFile) return undefined;
    (async () => {
      try {
        const lib = await loadPdfLibrary();
        const buf = await pidFile.arrayBuffer();
        const doc = await lib.getDocument({ data: buf }).promise;
        if (!cancelled) setPidPageCount(doc.numPages || null);
        doc.destroy?.();
      } catch (_) { /* estimate hidden — extraction unaffected */ }
    })();
    return () => { cancelled = true; };
  }, [pidFile]);
  const byokCostEstimate = estimateByokCost(
    pidPageCount, BYOK_COST_CONFIG.tokensPerPage.instrumentIndex, byokProvider
  );

  // 2) Write-through: in-memory cache (sync) + IndexedDB (debounced).
  useEffect(() => {
    if (II_SESSION_CACHE.enabled) {
      Object.assign(II_SESSION_CACHE, {
        pidFile, legendFile, drawingNumber, drawingTitle, revision, projectName, skippedStages, byokChoice,
        projectId: activeProject?.id || null,
      });
    }
    if (!II_AUTOSAVE.enabled) return;
    const pid = activeProject?.id;
    if (!pid || hydratedProjectRef.current !== pid) return;  // wait for hydration
    const t = setTimeout(() => {
      const draft = {
        pidFile, legendFile, drawingNumber, drawingTitle, revision, projectName, skippedStages, byokChoice,
        savedAt: new Date().toISOString(),
        // NOTE: II_AUTOSAVE.excludeKeys (e.g. byokApiKey) are intentionally
        // omitted — secrets are never persisted.
      };
      iiIdb.put(pid, draft)
        .then(() => setDraftSavedAt(draft.savedAt))
        .catch(() => { /* non-fatal — in-memory cache still protects navigation */ });
    }, II_AUTOSAVE.debounceMs);
    return () => clearTimeout(t);
  }, [pidFile, legendFile, drawingNumber, drawingTitle, revision, projectName, skippedStages, byokChoice, activeProject?.id]);

  // Processing state
  const [isProcessing, setIsProcessing]     = useState(false);
  const [progress, setProgress]             = useState(0);
  const [statusMessage, setStatusMessage]   = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Results state
  const [result, setResult]   = useState(null);   // full API response
  const [error, setError]     = useState(null);

  // Table filtering state
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterText, setFilterText]         = useState('');
  const [tablePage, setTablePage]           = useState(1);   // enterprise pagination (soft-coded)
  const [tablePageSize, setTablePageSize]   = useState(II_REGISTER_UI.pageSize);
  const [activeView, setActiveView]         = useState('table'); // 'table' | 'summary' | 'layout'
  // Row selection (Set of zero-based instrument indices in result.instruments)
  const [selectedRows, setSelectedRows]     = useState(() => new Set());

  // Fullscreen mode (soft-coded — see INST_LAYOUT_CONFIG)
  const [isFullscreen, setIsFullscreen] = useState(() => {
    try { return JSON.parse(localStorage.getItem(INST_LAYOUT_CONFIG.persistKey) || 'false'); }
    catch (_) { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(INST_LAYOUT_CONFIG.persistKey, JSON.stringify(isFullscreen)); }
    catch (_) {}
    if (typeof document === 'undefined') return undefined;
    if (isFullscreen) document.body.classList.add(INST_LAYOUT_CONFIG.bodyLockClass);
    else              document.body.classList.remove(INST_LAYOUT_CONFIG.bodyLockClass);
    const onKey = (e) => { if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove(INST_LAYOUT_CONFIG.bodyLockClass);
    };
  }, [isFullscreen]);
  // Reset selection whenever a fresh extraction lands
  useEffect(() => { setSelectedRows(new Set()); }, [result?.total]);
  // Layout view state
  const [layoutSelected, setLayoutSelected] = useState(null); // { measured, fn } cell selected
  const [layoutHovered,  setLayoutHovered]  = useState(null);

  // Edit-row modal state — { idx, draft } when open, null when closed.
  const [editingRow, setEditingRow] = useState(null);

  // Apply the draft back to result.instruments[idx] (immutable update).
  const handleSaveEditedRow = useCallback(() => {
    if (!editingRow) return;
    const { idx, draft } = editingRow;
    setResult(prev => {
      if (!prev || !Array.isArray(prev.instruments)) return prev;
      const next = prev.instruments.map((inst, j) => (j === idx ? { ...inst, ...draft } : inst));
      return { ...prev, instruments: next };
    });
    setEditingRow(null);
  }, [editingRow]);

  const fileInputRef = useRef(null);
  const legendInputRef = useRef(null);
  const elapsedRef   = useRef(null);

  // ── Auto-sync project context into drawing metadata ─────────────────
  // When the active project changes, prefill the project name field so
  // every extraction is tagged with the current project context.
  //
  // SOFT-CODED PROJECT-SCOPED RESET:
  // Whenever the active project changes (including a brand-new project
  // just created by the user), we wipe every piece of upload + result
  // state so the workspace starts fresh — no stale P&ID, legend, drawing
  // metadata or extraction result leaking across projects. The list of
  // resetters below is the single place to extend if new per-project
  // state is added in the future.
  useEffect(() => {
    // 0) Hydration guard (soft-coded): when the session cache holds state
    //    for THIS SAME project — e.g. returning from the Legend Manager
    //    round-trip — keep the restored upload/metadata instead of wiping it.
    if (
      II_SESSION_CACHE.enabled &&
      II_SESSION_CACHE.projectId &&
      II_SESSION_CACHE.projectId === activeProject?.id
    ) {
      return;
    }

    // 1) Per-project state resetters (soft-coded list).
    const PROJECT_SCOPED_RESETTERS = [
      () => setPidFile(null),
      () => setLegendFile(null),
      () => setDrawingNumber(''),
      () => setDrawingTitle(''),
      () => setRevision('0'),
      () => setResult(null),
      () => setError(null),
      () => setSelectedRows(new Set()),
      () => setEditingRow(null),
      () => setLayoutSelected(null),
      () => setLayoutHovered(null),
      () => setProgress(0),
      () => setStatusMessage(''),
      () => setFilterCategory('All'),
      () => setFilterText(''),
      () => setActiveView('table'),
    ];
    PROJECT_SCOPED_RESETTERS.forEach(fn => { try { fn(); } catch (_) { /* no-op */ } });

    // 2) Clear native <input type="file"> values so the browser shows no
    //    leftover filename in the picker for the new project.
    if (fileInputRef.current)   fileInputRef.current.value = '';
    if (legendInputRef.current) legendInputRef.current.value = '';

    // 3) Prefill project-name field from the active project (if any).
    if (activeProject && activeProject.name) {
      setProjectName(activeProject.name);
    } else {
      setProjectName('');
    }
  }, [activeProject?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Elapsed timer ────────────────────────────────────────────────────
  useEffect(() => {
    if (isProcessing) {
      setElapsedSeconds(0);
      elapsedRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    } else {
      clearInterval(elapsedRef.current);
    }
    return () => clearInterval(elapsedRef.current);
  }, [isProcessing]);

  const formatElapsed = s =>
    s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;

  // ── Fake progress (visual only — real work is done server-side) ──────
  // Multi-pass extraction: 1 standard + 2 rotations + 4 tiles = 7 passes total.
  // Progress milestones match approximate pass sequence.
  //
  // Soft-coded heartbeat: after the initial pass-by-pass animation reaches its
  // primary cap, a second slower asymptote keeps the bar advancing toward an
  // upper cap so the user sees the request is still alive (instead of looking
  // frozen at 91% during long server-side AI work).  All thresholds are
  // module-level consts — tune without changing the request/retry logic.
  const PROGRESS_PRIMARY_CAP   = 91;   // pass-animation upper bound
  const PROGRESS_HEARTBEAT_CAP = 98;   // heartbeat upper bound (until real 100%)
  const PROGRESS_HEARTBEAT_AFTER_SEC = 60;  // start heartbeat after this many s
  const PROGRESS_LONG_RUN_SEC  = 8 * 60;    // when to surface "still working" notice
  const PROGRESS_MESSAGES = [
    { pct: 5,  msg: 'Uploading P&ID…' },
    { pct: 15, msg: 'Pass 1 — Full drawing (standard orientation)…' },
    { pct: 28, msg: 'Pass 2 — 90° rotation (vertical text)…' },
    { pct: 41, msg: 'Pass 3 — 270° rotation (opposite vertical)…' },
    { pct: 53, msg: 'Pass 4 — Tile scan: top-left quadrant…' },
    { pct: 63, msg: 'Pass 5 — Tile scan: top-right quadrant…' },
    { pct: 73, msg: 'Pass 6 — Tile scan: bottom-left quadrant…' },
    { pct: 83, msg: 'Pass 7 — Tile scan: bottom-right quadrant…' },
    { pct: PROGRESS_PRIMARY_CAP, msg: 'Merging & deduplicating results…' },
  ];

  useEffect(() => {
    if (!isProcessing) return;
    let msgIdx = 0;
    let ticks  = 0;          // 1 tick ≈ 1.8 s
    const id = setInterval(() => {
      ticks += 1;
      const elapsedSec = ticks * 1.8;
      setProgress(p => {
        const next = PROGRESS_MESSAGES[msgIdx];
        if (next && p >= next.pct - 5) {
          setStatusMessage(next.msg);
          msgIdx = Math.min(msgIdx + 1, PROGRESS_MESSAGES.length - 1);
        }
        // Heartbeat: once we hit the primary cap and the call is still in
        // flight, keep crawling toward the heartbeat cap so the bar never
        // looks frozen — even on very dense, multi-page P&IDs.
        if (p >= PROGRESS_PRIMARY_CAP && elapsedSec >= PROGRESS_HEARTBEAT_AFTER_SEC) {
          if (elapsedSec >= PROGRESS_LONG_RUN_SEC) {
            setStatusMessage(
              'Still working — dense multi-page P&IDs can take several minutes. ' +
              'No action needed; results will appear automatically.'
            );
          }
          if (p >= PROGRESS_HEARTBEAT_CAP) return p;
          return p + (PROGRESS_HEARTBEAT_CAP - p) * 0.008;
        }
        if (p >= PROGRESS_PRIMARY_CAP) return p;
        return p + (PROGRESS_PRIMARY_CAP - p) * 0.035;
      });
    }, 1800);
    return () => clearInterval(id);
  }, [isProcessing]);

  // ── File selection ───────────────────────────────────────────────────
  const handleFileSelect = e => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a PDF file.');
      return;
    }
    setPidFile(file);
    setError(null);
    setResult(null);
    // Pre-fill drawing number from filename
    if (!drawingNumber) {
      setDrawingNumber(file.name.replace(/\.pdf$/i, ''));
    }
  };

  const handleLegendFileSelect = e => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Legend sheet must be a PDF file.');
      return;
    }
    setLegendFile(file);
    setError(null);
  };

  // ── Drag & drop ──────────────────────────────────────────────────────
  const handleDrop = e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.toLowerCase().endsWith('.pdf')) {
      setPidFile(file);
      setError(null);
      setResult(null);
      if (!drawingNumber) setDrawingNumber(file.name.replace(/\.pdf$/i, ''));
    } else {
      setError('Only PDF files are accepted.');
    }
  };

  // ── Extract ──────────────────────────────────────────────────────────
  const handleExtract = async () => {
    if (!pidFile) { setError('Please upload a P&ID (PDF) first.'); return; }
    if (!activeProject) {
      setError('Please select or create an active project first.');
      openManager({ view: 'list' });
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);
    setProgress(0);
    setStatusMessage('Uploading P&ID…');

    const formData = new FormData();
    formData.append('pid_file', pidFile);
    if (legendFile) formData.append('legend_file', legendFile);
    formData.append('drawing_number', drawingNumber || pidFile.name.replace(/\.pdf$/i, ''));
    formData.append('drawing_title', drawingTitle);
    formData.append('revision', revision);
    formData.append('project_name', projectName || activeProject.name);
    // Project context (Phase 1 — sent for backend awareness; ignored if unused)
    formData.append('project_id', activeProject.id);
    formData.append('project_code', activeProject.code || '');
    formData.append('project_category', activeProject.category);
    formData.append('project_client', activeProject.client || '');
    // Explicit unit / area code (e.g. ADNOC Gas '562'). Drives the {unit}
    // prefix in tag-format normalisation when present.
    formData.append('project_unit', activeProject.unit || '');
    // BYOK — optional user key for extraction accuracy (backend tries it
    // before the shared engines; empty values are ignored server-side).
    if (byokApiKey.trim()) {
      formData.append('provider', byokProvider);
      formData.append('api_key', byokApiKey.trim());
      if (byokModel.trim()) formData.append('model', byokModel.trim());
    }

    const token  = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const url    = `${API_BASE}/pid/instrument-index/analyze/`;
    const ctrl   = new AbortController();
    const abort  = setTimeout(() => ctrl.abort(), UPLOAD_TIMEOUT_MS);

    // Soft-coded fetch-with-retry — only retries transient network errors
    // (ERR_CONNECTION_RESET / "Failed to fetch"); never retries on HTTP errors.
    const doFetch = () => fetch(url, {
      method:  'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body:    formData,
      signal:  ctrl.signal,
    });

    try {
      setStatusMessage('AI scanning P&ID for all instrument tags…');

      let resp;
      let attempt = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        try {
          resp = await doFetch();
          break; // success (HTTP-level errors are handled below)
        } catch (netErr) {
          if (attempt < NETWORK_RETRY_CONFIG.maxRetries && isTransientNetworkError(netErr)) {
            attempt += 1;
            const delay = NETWORK_RETRY_CONFIG.backoffBaseMs *
                          Math.pow(NETWORK_RETRY_CONFIG.backoffFactor, attempt - 1);
            setStatusMessage(`Network blip detected — auto-retrying (${attempt}/${NETWORK_RETRY_CONFIG.maxRetries}) in ${Math.round(delay/1000)} s…`);
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          throw netErr;
        }
      }
      clearTimeout(abort);

      if (!resp.ok) {
        let detail = `HTTP ${resp.status}`;
        try { const j = await resp.json(); detail = j.error || j.detail || detail; } catch (_) {}
        throw new Error(detail);
      }

      const data = await resp.json();

      // ── Async path — the backend queues extraction (202 + upload_id)
      // and the real result must be POLLED from the status endpoint.
      // (Previously the response was assumed synchronous, so a queued
      // job rendered nothing even though the worker finished fine.)
      if (data?.upload_id && !data.instruments) {
        const statusUrl = `${API_BASE}/pid/instrument-index/status/${data.upload_id}/`;
        const deadline  = Date.now() + UPLOAD_TIMEOUT_MS;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          if (Date.now() > deadline) {
            throw new Error(`Extraction timed out after ${Math.round(UPLOAD_TIMEOUT_MS / 60000)} min on this browser. The server job may still finish — wait a minute and re-run with BYOK (your own key is much faster), or split the PDF into single-sheet files.`);
          }
          await new Promise(r => setTimeout(r, 4000));
          let st;
          try {
            const sResp = await fetch(statusUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
            if (!sResp.ok) continue; // transient — keep polling
            st = await sResp.json();
          } catch (_) {
            continue; // network blip — keep polling until deadline
          }
          if (st?.status === 'failed') {
            throw new Error(st.error || 'Extraction failed on the server.');
          }
          if (st?.status === 'completed' || st?.instruments) {
            setProgress(100);
            setStatusMessage('Extraction complete!');
            setResult(st);
            return; // finally block still runs (setIsProcessing(false))
          }
          if (typeof st?.progress === 'number') setProgress(st.progress);
          if (st?.message) setStatusMessage(st.message);
        }
      }

      setProgress(100);
      setStatusMessage('Extraction complete!');
      setResult(data);
    } catch (err) {
      clearTimeout(abort);
      let msg;
      if (err.name === 'AbortError') {
        msg = `Upload timed out after ${Math.round(UPLOAD_TIMEOUT_MS / 60000)} min on this browser. The server job may still finish — re-run with BYOK (your own key is much faster), or split the PDF into single-sheet files.`;
      } else if (isTransientNetworkError(err)) {
        msg = CONN_RESET_HELP_MSG;
      } else {
        msg = err.message || 'Extraction failed — please try again.';
      }
      setError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Excel download via backend URL ───────────────────────────────────
  const handleDownloadExcel = () => {
    if (!result?.excel_url) return;
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    // Build absolute URL
    const base = API_BASE.replace(/\/api\/v1\/?$/, '');
    const fullUrl = `${base}${result.excel_url}`;
    // Simple link-click approach
    const a = document.createElement('a');
    a.href = fullUrl;
    if (token) {
      // For authenticated downloads attach token as query param (backend allows it)
      a.href += (fullUrl.includes('?') ? '&' : '?') + `token=${encodeURIComponent(token)}`;
    }
    a.download = `instrument_index_${(drawingNumber || 'export').replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ── Client-side Excel fallback (browser XLSX) ────────────────────────
  // Template-driven: the active project's category selects the template
  // (ADNOC Gas → 25-col manual sheet layout; default → legacy 15-col view).
  const handleDownloadClientExcel = () => {
    if (!result?.instruments?.length) return;
    const tpl = getInstrumentTemplate(activeProject?.category);
    const ctx = { project: activeProject || {}, result };

    // Honor row selection: if any rows are selected, export those only;
    // otherwise export everything in the result.
    const sourceList = selectedRows.size > 0
      ? result.instruments.filter((_, i) => selectedRows.has(i))
      : result.instruments;

    // Resolve a metaRow cell value via dotted "scope.key" lookup
    const _resolveMeta = (key) => {
      if (!key) return '';
      const [scope, ...rest] = key.split('.');
      const path = rest.join('.');
      const root = scope === 'project' ? ctx.project
                 : scope === 'result'  ? ctx.result
                 : ctx;
      return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), root) ?? '';
    };

    // Prepend "SL No." auto-column so exported Excel mirrors the on-screen view
    let _slCounter = 0;
    const SL_COL = {
      key: '__sl_no__', header: 'SL No.', width: 6, align: 'center',
      accessor: () => (++_slCounter),
    };
    const xCols = [SL_COL, ...tpl.columns];
    const COL_COUNT = xCols.length;

    const wsData = [];

    // 1) Title row
    wsData.push([tpl.sheetTitle.toUpperCase(), ...Array(COL_COUNT - 1).fill('')]);
    // 2) Metadata rows
    (tpl.metaRows || []).forEach(row => {
      const line = [];
      row.forEach(cell => {
        line.push(`${cell.label}: ${_resolveMeta(cell.key)}`);
        const span = (cell.span || 1) - 1;
        for (let s = 0; s < span; s++) line.push('');
      });
      while (line.length < COL_COUNT) line.push('');
      wsData.push(line);
    });
    wsData.push(Array(COL_COUNT).fill('')); // spacer

    // 3) Optional grouped header strip (extend with empty cell over SL No)
    if (tpl.groupHeader && tpl.groupHeader.length) {
      const groupRow = [''];
      tpl.groupHeader.forEach(g => {
        groupRow.push(g.label || '');
        for (let s = 1; s < (g.span || 1); s++) groupRow.push('');
      });
      while (groupRow.length < COL_COUNT) groupRow.push('');
      wsData.push(groupRow);
    }

    // 4) Column header row(s)
    wsData.push(xCols.map(c => (c.header || '').replace(/\n/g, ' ')));

    // 5) Body rows — with optional equipment grouping
    const groupedRows = [];
    if (tpl.groupBy) {
      const groups = new Map();
      const ungrouped = [];
      sourceList.forEach(i => {
        const key = tpl.groupBy(i);
        if (!key) { ungrouped.push(i); return; }
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(i);
      });
      const dash = tpl.emptyDash || '-';
      // Each group gets a section banner row (label in col 1, blanks elsewhere)
      groups.forEach((items, key) => {
        const label = (tpl.groupHeaderLabel ? tpl.groupHeaderLabel(key, items) : key) || key;
        const banner = [label, ...Array(COL_COUNT - 1).fill('')];
        groupedRows.push(banner);
        items.forEach((inst, gIdx) =>
          groupedRows.push(xCols.map(c => {
            try { const v = c.accessor(inst, { idx: gIdx, ctx }); return v == null || v === '' ? dash : v; }
            catch (_) { return dash; }
          }))
        );
      });
      ungrouped.forEach((inst, gIdx) =>
        groupedRows.push(xCols.map(c => {
          try { const v = c.accessor(inst, { idx: gIdx, ctx }); return v == null || v === '' ? dash : v; }
          catch (_) { return dash; }
        }))
      );
    } else {
      const dash = tpl.emptyDash || '—';
      sourceList.forEach((inst, idx) =>
        groupedRows.push(xCols.map(c => {
          try { const v = c.accessor(inst, { idx, ctx }); return v == null || v === '' ? dash : v; }
          catch (_) { return dash; }
        }))
      );
    }
    wsData.push(...groupedRows);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = xCols.map(c => ({ wch: Math.max(6, Math.min(c.width || 14, 50)) }));

    // Summary sheet (kept generic — independent of template)
    const summaryData = [
      ['Category', 'Count'],
      ...Object.entries(result.category_summary || {}).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      ['TOTAL', result.total || 0],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(summaryData);
    ws2['!cols'] = [{ wch: 28 }, { wch: 10 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws,  tpl.sheetTitle);
    XLSX.utils.book_append_sheet(wb, ws2, 'Summary');
    XLSX.writeFile(wb, `instrument_index_${(drawingNumber || 'export').replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`);
  };

  // ── Filtered instruments ─────────────────────────────────────────────
  const filteredInstruments = (result?.instruments || []).filter(inst => {
    const catOk  = filterCategory === 'All' || inst.category === filterCategory;
    const textOk = !filterText ||
      (inst.tag_number         || '').toLowerCase().includes(filterText.toLowerCase()) ||
      (inst.service_description|| '').toLowerCase().includes(filterText.toLowerCase()) ||
      (inst.instrument_type    || '').toLowerCase().includes(filterText.toLowerCase());
    return catOk && textOk;
  });

  const uniqueCategories = result
    ? ['All', ...new Set((result.instruments || []).map(i => i.category || 'Unknown'))]
    : ['All'];

  // ─────────────────────────────────────────────────────────────────────
  // RENDER — PFD-format two-view layout
  // ─────────────────────────────────────────────────────────────────────

  // Local UI state for the new landing-page modals (declared inside component
  // because they need to read/write the projects hook).
  const [createOpen, setCreateOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [deletingProject, setDeletingProject] = useState(null);

  const liveProjects = (projects || []).filter(p => !p.archived);

  const handleCreateInline = ({ name, category }) => {
    const id = `prj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    upsertProject({ id, name, category });
    setActiveId(id);
    setCreateOpen(false);
  };

  const handleEditSave = () => {
    if (!editingProject) return;
    upsertProject({ ...editingProject, name: editName.trim() || editingProject.name, description: editDesc });
    setEditingProject(null);
  };

  const handleDeleteConfirm = () => {
    if (!deletingProject) return;
    deleteProject(deletingProject.id);
    setDeletingProject(null);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // VIEW 1 — Landing (no active project)
  // ═══════════════════════════════════════════════════════════════════════
  if (!activeProject) {
    return (
      <InstBg>
        {/* Full-width canvas — aligned with PID Verification V1 (w-full px-2/4/6) */}
        <div className="w-full px-2 sm:px-4 lg:px-6 py-10">

          {/* ── Hero — V1 light header card (aligned with Valve MTO / common design) ── */}
          <div className="mb-10 rounded-3xl ii-section relative overflow-hidden" style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(238,242,255,0.94) 55%, rgba(240,249,255,0.96) 100%)',
            border: '1px solid rgba(255,255,255,0.7)',
            padding: '32px 36px',
            boxShadow: '0 12px 40px rgba(59,130,246,0.14), 0 2px 8px rgba(15,23,42,0.05)',
            backdropFilter: 'blur(8px)',
          }}>
          {/* Sheen sweep + soft inner glow orbs */}
          <div className="pointer-events-none absolute top-0 bottom-0 w-1/3" aria-hidden
            style={{ background: 'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)', animation: 'ii-hero-sheen 5.5s ease-in-out infinite' }} />
          <div className="pointer-events-none absolute -top-16 -right-10 w-64 h-64 rounded-full" aria-hidden
            style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.18), transparent 70%)' }} />
          <div className="pointer-events-none absolute -bottom-20 -left-10 w-64 h-64 rounded-full" aria-hidden
            style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.14), transparent 70%)' }} />
          <div className="flex flex-col lg:flex-row lg:items-center gap-8 relative">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-1 h-7 rounded-full" style={{ background: 'linear-gradient(180deg,#3b82f6,#6366f1)' }} />
                <span className="text-indigo-600 text-xs font-bold tracking-[0.3em] uppercase">AIFlow · Instrument Engineering</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: 'rgba(16,185,129,0.12)', color: '#047857', border: '1px solid rgba(16,185,129,0.25)' }}>
                  ✓ Production Ready
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-3 whitespace-nowrap">
                Instrument{' '}
                <span style={{ background: 'linear-gradient(90deg,#3b82f6,#6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  Index Extractor
                </span>
              </h1>
              <p className="text-slate-500 max-w-xl text-sm sm:text-base mb-4">
                Extract every instrument tag from any P&amp;ID — Flow, Pressure, Temperature, Level,
                SDV/BDV, MOV, Safety valves &amp; more. AI Vision multi-pass with ISA 5.1 intelligence.
              </p>
              <div className="flex flex-wrap gap-2">
                {INST_HERO_BADGES.map((b, i) => (
                  <span key={b.label}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 border rounded-full text-xs font-medium ${b.cls}`}
                    style={{ animation: 'instChipPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both', animationDelay: `${0.08 + i * 0.07}s` }}>
                    <span>{b.icon}</span>{b.label}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {INST_RELATED_TOOLS.filter(t => t.showHero).map((t, i) => (
                  <div key={t.id}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold"
                    style={{ animation: `instChipPop 0.5s cubic-bezier(0.34,1.56,0.64,1) ${0.55 + i * 0.08}s both` }}>
                    <BoltIcon className="w-3.5 h-3.5" style={{ animation: 'instPulse 2s ease-in-out infinite' }} />
                    {t.heroPrefix}
                    <a href={t.path}
                      className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-blue-900 transition-colors">
                      {t.label} <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: animated ring decoration */}
            <div className="flex-none hidden lg:flex items-center justify-center w-44 h-44 relative">
              <svg className="absolute inset-0" width="176" height="176" viewBox="0 0 176 176"
                style={{ animation: 'instSpinSlow 22s linear infinite' }}>
                <circle cx="88" cy="88" r="80" fill="none" stroke="rgba(124,58,237,0.18)" strokeWidth="1.5" strokeDasharray="4 6" />
                {INST_RING_TICKS.map(deg => {
                  const rad = (deg - 90) * Math.PI / 180;
                  const x1 = 88 + 80 * Math.cos(rad), y1 = 88 + 80 * Math.sin(rad);
                  const x2 = 88 + 72 * Math.cos(rad), y2 = 88 + 72 * Math.sin(rad);
                  return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />;
                })}
              </svg>
              <svg className="absolute inset-0" width="176" height="176" viewBox="0 0 176 176"
                style={{ animation: 'instSpinSlowRev 16s linear infinite' }}>
                <circle cx="88" cy="88" r="58" fill="none" stroke="rgba(79,70,229,0.20)" strokeWidth="1.5" strokeDasharray="3 9" />
                {INST_RING_TICKS.filter((_, j) => j % 3 === 0).map(deg => {
                  const rad = (deg - 90) * Math.PI / 180;
                  const x1 = 88 + 58 * Math.cos(rad), y1 = 88 + 58 * Math.sin(rad);
                  const x2 = 88 + 50 * Math.cos(rad), y2 = 88 + 50 * Math.sin(rad);
                  return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" />;
                })}
              </svg>
              <div className="relative z-10 w-20 h-20 rounded-2xl flex flex-col items-center justify-center"
                style={{ background: T_INST.accent, boxShadow: T_INST.accentShadowLg }}>
                <TagIcon className="w-7 h-7 text-white" style={{ animation: 'instCountUp 0.6s ease-out 0.4s both' }} />
                <span className="text-[10px] font-semibold text-indigo-100 tracking-wider uppercase mt-0.5">ISA 5.1</span>
              </div>
            </div>
          </div>
          </div>

          {/* ── Projects header row ── */}
          <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
            <p className="text-slate-500 text-sm">
              {liveProjects.length > 0
                ? `${liveProjects.length} project${liveProjects.length !== 1 ? 's' : ''} — select one to upload a P&ID drawing`
                : 'Create your first project to get started'}
            </p>
            <button onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 font-bold rounded-xl transition-all text-sm text-white hover:-translate-y-px"
              style={{ background: T_INST.accent, boxShadow: T_INST.accentShadow }}>
              <FolderPlusIcon className="w-4 h-4" />New Project
            </button>
          </div>

          {/* ── Projects grid / empty state ── */}
          {liveProjects.length === 0 ? (
            <div className="rounded-2xl p-16 text-center" style={T_INST.card}>
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5 bg-indigo-50 border border-indigo-100">
                <FolderIcon className="w-10 h-10 text-indigo-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">No Projects Yet</h3>
              <p className="text-slate-500 text-sm mb-6">Create a project to start uploading and indexing P&amp;ID drawings.</p>
              <button onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-3 font-bold rounded-xl text-white hover:-translate-y-px transition-all"
                style={{ background: T_INST.accent, boxShadow: T_INST.accentShadow }}>
                <FolderPlusIcon className="w-5 h-5" />Create First Project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {liveProjects.map((p, idx) => (
                <InstProjectCard
                  key={p.id}
                  project={p}
                  idx={idx}
                  onSelect={(id) => setActiveId(id)}
                  onEdit={(proj) => { setEditingProject(proj); setEditName(proj.name || ''); setEditDesc(proj.description || ''); }}
                  onDelete={(proj) => setDeletingProject(proj)}
                />
              ))}
            </div>
          )}

          {/* ── How it works ── */}
          <div className="relative flex items-center my-12">
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg,transparent,#c7d2fe,transparent)' }} />
            <span className="mx-4 text-xs font-bold text-indigo-600 tracking-[0.25em] uppercase px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(238,242,255,0.95)', border: '1px solid #c7d2fe' }}>
              How It Works
            </span>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg,transparent,#c7d2fe,transparent)' }} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-10">
            {INST_HOW_IT_WORKS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.step} className="relative rounded-2xl p-6 overflow-hidden"
                  style={{ background: step.bg, border: `1px solid ${step.border}`,
                    animation: `instCardIn 0.55s ease-out ${0.1 + i * 0.12}s both` }}>
                  <span className="absolute -top-2 -right-1 text-[80px] font-black leading-none select-none pointer-events-none"
                    style={{ color: step.accent, opacity: 0.07 }}>{step.step}</span>
                  <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl" style={{ background: step.accent }} />
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                    style={{ background: '#fff', border: `1px solid ${step.border}` }}>
                    <Icon className="w-6 h-6" style={{ color: step.accent }} />
                  </div>
                  <h4 className="text-base font-bold text-slate-900 mb-1.5">{step.title}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modals */}
        <InstQuickCreateModal open={createOpen} onClose={() => setCreateOpen(false)} onCreate={handleCreateInline} />
        <InstConfirmModal
          open={Boolean(deletingProject)}
          title="Delete project?"
          message={`This will permanently delete "${deletingProject?.name}" and remove it from your project list.`}
          onCancel={() => setDeletingProject(null)}
          onConfirm={handleDeleteConfirm}
          danger
        />
        {/* Edit modal — minimal inline */}
        {editingProject && (
          <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            style={{ background: 'rgba(15,23,42,0.45)' }}>
            <div className="rounded-2xl max-w-md w-full p-6 bg-white border border-slate-200 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-slate-900">Edit Project</h3>
                <button onClick={() => setEditingProject(null)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                  <XMarkIcon className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Project Name</label>
                  <input
                    type="text"
                    value={editName}
                    maxLength={PROJECT_FORM_LIMITS.nameMax}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description</label>
                  <textarea
                    rows={3}
                    value={editDesc}
                    maxLength={PROJECT_FORM_LIMITS.descriptionMax}
                    onChange={e => setEditDesc(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => setEditingProject(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                <button onClick={handleEditSave}
                  className="px-5 py-2 text-sm font-semibold text-white rounded-lg"
                  style={{ background: T_INST.accent, boxShadow: T_INST.accentShadow }}>Save</button>
              </div>
            </div>
          </div>
        )}

        <ProjectManagerModal
          open={projectManagerOpen}
          onClose={() => setProjectManagerOpen(false)}
          projects={projects}
          activeId={activeId}
          setActiveId={setActiveId}
          upsertProject={upsertProject}
          archiveProject={archiveProject}
          restoreProject={restoreProject}
          deleteProject={deleteProject}
          initialView={pmInitialView}
          initialCategory={pmInitialCategory}
        />
      </InstBg>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VIEW 2 — Project workspace (active project selected)
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <InstBg fullscreen={isFullscreen}>
      <div
        className="w-full px-2 sm:px-4 lg:px-6"
        style={{
          maxWidth: isFullscreen ? INST_LAYOUT_CONFIG.fullscreenMaxWidth : INST_LAYOUT_CONFIG.normalMaxWidth,
          paddingTop:    isFullscreen ? INST_LAYOUT_CONFIG.fullscreenPaddingY : INST_LAYOUT_CONFIG.normalPaddingY,
          paddingBottom: isFullscreen ? INST_LAYOUT_CONFIG.fullscreenPaddingY : INST_LAYOUT_CONFIG.normalPaddingY,
        }}
      >

        {/* ── Hero Header — elevated gradient card (EquipmentList EQ_T pattern) ── */}
        <div className="mb-8 ii-section relative" style={{ animationDelay: '0s' }}>
          {/* Glowing gradient border ring (rotating conic) */}
          <div className="absolute -inset-[1.5px] rounded-3xl pointer-events-none overflow-hidden" aria-hidden>
            <div style={{
              position: 'absolute', inset: '-40%',
              background: 'conic-gradient(from 0deg, rgba(59,130,246,0.55), rgba(99,102,241,0.55), rgba(245,158,11,0.45), rgba(16,185,129,0.45), rgba(59,130,246,0.55))',
              animation: 'ii-hero-ring 9s linear infinite',
            }} />
          </div>
          {/* Card body */}
          <div className="relative rounded-3xl overflow-hidden" style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(238,242,255,0.94) 55%, rgba(240,249,255,0.96) 100%)',
            border: '1px solid rgba(255,255,255,0.7)',
            boxShadow: '0 12px 40px rgba(59,130,246,0.14), 0 2px 8px rgba(15,23,42,0.05)',
            padding: '28px 32px',
            backdropFilter: 'blur(8px)',
          }}>
            {/* Sheen sweep */}
            <div className="pointer-events-none absolute top-0 bottom-0 w-1/3" aria-hidden
              style={{ background: 'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)', animation: 'ii-hero-sheen 5.5s ease-in-out infinite' }} />
            {/* Soft inner glow orbs */}
            <div className="pointer-events-none absolute -top-16 -right-10 w-64 h-64 rounded-full" aria-hidden
              style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.18), transparent 70%)' }} />
            <div className="pointer-events-none absolute -bottom-20 -left-10 w-64 h-64 rounded-full" aria-hidden
              style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.14), transparent 70%)' }} />

            {/* Badge pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-4 ii-chip"
              style={{
                background: 'linear-gradient(90deg, rgba(59,130,246,0.12), rgba(99,102,241,0.12))',
                border: '1px solid rgba(59,130,246,0.30)',
                animationDelay: '0.04s',
                boxShadow: '0 2px 10px rgba(59,130,246,0.15)',
              }}>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" style={{ animation: 'ii-pulse-badge 2s ease infinite' }} />
              <span className="text-blue-700 text-xs font-bold tracking-widest uppercase">AI-Powered · P&amp;ID Instrument Analysis</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold text-white"
                style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                ✓ PRODUCTION READY
              </span>
            </div>

            {/* Title */}
            <h1 className="text-4xl font-bold text-slate-900 flex items-center gap-4 mb-3">
              <div className="p-2.5 rounded-xl relative overflow-hidden flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(99,102,241,0.07) 100%)',
                  border: '1px solid rgba(59,130,246,0.22)',
                  animation: 'ii-glow-light 3s ease infinite',
                }}>
                <TagIcon className="h-7 w-7 text-blue-600" />
              </div>
              Instrument&nbsp;
              <span style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 60%, #6366f1 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                Index
              </span>
            </h1>

            {/* Description */}
            <p className="text-slate-500 text-base leading-relaxed max-w-2xl mb-6">
              Extract every instrument tag from any P&amp;ID using AI Vision — Flow, Pressure,
              Temperature, Level, SDV/BDV, MOV, PSV, RO &amp; more — categorised by ISA 5.1,
              cross-checked against your project legend when one is available, and ready for one-click Excel export.
            </p>

            {/* Capability chips */}
            <div className="flex flex-wrap gap-2">
              {T_INST.chips.map((chip, i) => (
                <span key={chip.label}
                  className="ii-chip inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{
                    background: 'rgba(59,130,246,0.06)',
                    border: '1px solid rgba(59,130,246,0.18)',
                    color: '#1e40af',
                    animationDelay: `${0.08 + i * 0.06}s`,
                  }}>
                  <span>{chip.icon}</span>
                  <span>{chip.label}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Slim project header / breadcrumb ── */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3" style={{ animation: 'instFadeUp 0.4s ease-out both' }}>
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setActiveId(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white/60 rounded-lg border border-slate-200 transition-colors">
              <ArrowLeftIcon className="w-3.5 h-3.5" />Projects
            </button>
            <ChevronRightIcon className="w-4 h-4 text-slate-300" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <CategoryBadge categoryId={activeProject.category} />
                {activeProject.code && <span className="font-mono text-[10px] text-slate-400">{activeProject.code}</span>}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight truncate">
                {activeProject.name}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {INST_LAYOUT_CONFIG.enabled && (
              <button
                onClick={() => setIsFullscreen(fs => !fs)}
                title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Expand to fullscreen'}
                aria-pressed={isFullscreen}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
              >
                {isFullscreen
                  ? <><ArrowsPointingInIcon className="h-3.5 w-3.5" /> Exit Fullscreen</>
                  : <><ArrowsPointingOutIcon className="h-3.5 w-3.5" /> Fullscreen</>
                }
              </button>
            )}
            <button
              onClick={() => openManager({ view: 'list' })}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors">
              Switch / Edit
            </button>
            {INST_RELATED_TOOLS.filter(t => t.showToolbar).map(t => (
              t.toolbarStyle === 'primary' ? (
                <button key={t.id}
                  onClick={() => navigate(t.path)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white rounded-lg transition-all hover:-translate-y-px"
                  style={{ background: T_INST.accent, boxShadow: T_INST.accentShadow }}>
                  {t.label} <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button key={t.id}
                  onClick={() => navigate(t.path)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-all hover:-translate-y-px">
                  {t.label} <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                </button>
              )
            ))}
          </div>
        </div>

        {/* ── Shared Project Legend panel — bridged by project NAME (soft-coded) ── */}
        <ProjectLegendPanel
          section="instrument_index"
          projectName={activeProject?.name || ''}
          onManage={() => setLegendModalOpen(true)}
          refreshToken={legendModalOpen ? 0 : 1}
        />

        {/* ── Step 2 · Upload P&ID Drawing card ── */}
        <div className="rounded-2xl p-6 mb-6 ii-section" style={{ ...T_INST.cardEq, animationDelay: '0.08s' }}>
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span className="h-6 w-6 rounded-full text-xs font-bold flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)', boxShadow: '0 2px 8px rgba(59,130,246,0.35)' }}>1</span>
            Upload P&amp;ID Drawing (PDF)
            {II_AUTOSAVE.enabled && draftSavedAt && (
              <span className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200"
                title={`Your upload and drawing details are auto-saved on this device.\nLast saved: ${new Date(draftSavedAt).toLocaleString()}\nYou can safely leave and continue later (e.g. after receiving your AI key from ICT).`}>
                {II_AUTOSAVE.savedLabel} · {new Date(draftSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </h2>

          {/* Stage 1 · User Instruction (soft-coded) */}
          <StageInstruction stage={STAGE_FLOW[0]} />

          {/* ── AI Document Assist (Wrench) — soft-coded, optional ─── */}
          {AI_DOC_ASSIST_CONFIG.enabled && (
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
                onFileSelected={(file, rec) => {
                  // Reuse the existing PDF acceptance path — no core logic change.
                  if (!file.name.toLowerCase().endsWith('.pdf')) {
                    setError('AI Document Assist returned a non-PDF file. Only PDF P&IDs are accepted.');
                    return;
                  }
                  setPidFile(file);
                  setResult(null);
                  setError(null);
                  // Pre-fill drawing number from the Wrench DOC_NO when available.
                  const docNo = (rec?.doc_no || '').trim();
                  if (docNo) setDrawingNumber(docNo);
                  else if (!drawingNumber) setDrawingNumber(file.name.replace(/\.pdf$/i, ''));
                }}
                onError={(msg) => setError(msg)}
              />
            </div>
          )}

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            className={`ii-upload-zone border-2 border-dashed rounded-xl p-8 transition-all cursor-pointer mb-4 ${
              pidFile
                ? 'border-green-300 bg-gradient-to-br from-green-50 to-emerald-50'
                : 'border-indigo-200 bg-gradient-to-br from-indigo-50/40 to-blue-50/40 hover:border-indigo-400 hover:from-indigo-50 hover:to-blue-50 hover:shadow-inner'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center gap-2 text-center">
              {pidFile ? (
                <>
                  <CheckCircleIcon className="h-10 w-10 text-green-500" />
                  <p className="text-sm font-medium text-gray-700">{pidFile.name}</p>
                  <p className="text-xs text-gray-500">
                    {(pidFile.size / 1024 / 1024).toFixed(2)} MB
                    &nbsp;·&nbsp;Click to change
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      // Stop the parent drop-zone click that would re-open the picker.
                      e.stopPropagation();
                      setPidFile(null);
                      setDrawingNumber('');
                      // Reset the underlying <input type="file"> so the same
                      // filename can be re-selected later if the user wishes.
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="mt-2 inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors"
                    title="Remove selected P&ID"
                  >
                    <XMarkIcon className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </>
              ) : (
                <>
                  <CloudArrowUpIcon className="h-10 w-10 text-gray-400" />
                  <p className="text-sm font-medium text-gray-700">
                    Click or drag &amp; drop P&ID PDF here
                  </p>
                  <p className="text-xs text-gray-400">
                    Supports single-page and multi-page P&IDs
                  </p>
                </>
              )}
            </div>
          </div>

          {/* ── Stage 2 · Attach Legend / Symbol Sheet (gated — soft-coded) ── */}
          {!STAGE_FLOW[1].isUnlocked(stageFlowState) ? (
            <StageGate stage={STAGE_FLOW[1]} />
          ) : (
          <>
          <h2 className={`text-lg font-semibold mb-3 flex items-center gap-2 ${pidFile ? 'text-gray-800' : 'text-gray-400'}`}>
            <span className={`h-6 w-6 rounded-full text-xs font-bold flex items-center justify-center ${pidFile ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-100 text-gray-400'}`}>2</span>
            Attach Legend / Symbol Sheet <span className="text-xs font-normal text-gray-400">(optional)</span>
            {!pidFile && <span className="text-xs">🔒</span>}
          </h2>

          {/* Stage 2 · User Instruction (soft-coded) — opening the Legend
              Manager also marks this stage addressed for the submit gate */}
          <StageInstruction stage={STAGE_FLOW[1]} onAction={() => skipStage('legend')} />

          {/* Legend attach: PDF drop zone (soft-coded flag) or smart guidance card */}
          {LEGEND_ATTACH_CONFIG.pdfUploadEnabled ? (
          <div
            className={`border border-dashed rounded-lg p-4 mb-4 transition-colors ${
              !pidFile
                ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                : 'border-cyan-300 bg-cyan-50/50 cursor-pointer hover:border-cyan-400'
            }`}
            onClick={() => pidFile && legendInputRef.current?.click()}
          >
            <input
              ref={legendInputRef}
              type="file"
              accept=".pdf"
              onChange={handleLegendFileSelect}
              className="hidden"
            />
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-cyan-900">
                  {legendFile ? legendFile.name : 'Attach legend/symbol sheet PDF for cross-verification'}
                </p>
                <p className="text-xs text-cyan-700 mt-1">
                  The app will cross-check extracted values against the uploaded legend sheet,
                  then also look for matching legend sheets in AWS S3 when available.
                </p>
              </div>
              {legendFile && <CheckCircleIcon className="h-6 w-6 text-cyan-600 shrink-0" />}
            </div>
          </div>
          ) : (
            <LegendGuidanceCard onAction={() => skipStage('legend')} />
          )}
          {!STAGE_FLOW[1].isComplete(stageFlowState) && (
            <StageSkipButton stage={STAGE_FLOW[1]} onSkip={() => skipStage('legend')} />
          )}
          </>
          )}

          {/* ── Stage 3 · Drawing Info (gated — soft-coded) ── */}
          {!STAGE_FLOW[2].isUnlocked(stageFlowState) ? (
            <StageGate stage={STAGE_FLOW[2]} />
          ) : (
          <>
          {/* Metadata fields */}
          <h2 className={`text-lg font-semibold mb-3 flex items-center gap-2 ${pidFile ? 'text-gray-800' : 'text-gray-400'}`}>
            <span className={`h-6 w-6 rounded-full text-xs font-bold flex items-center justify-center ${pidFile ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-400'}`}>3</span>
            Drawing Info <span className="text-xs font-normal text-gray-400">(optional)</span>
            {!pidFile && <span className="text-xs">🔒</span>}
          </h2>

          {/* Stage 3 · User Instruction (soft-coded) */}
          <StageInstruction stage={STAGE_FLOW[2]} />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Drawing Number', val: drawingNumber, set: setDrawingNumber, placeholder: 'P16093-14-01-08-1602' },
              { label: 'Drawing Title',  val: drawingTitle,  set: setDrawingTitle,  placeholder: 'Pig Receiver' },
              { label: 'Revision',       val: revision,      set: setRevision,      placeholder: '0' },
              { label: 'Project Name',   val: projectName,   set: setProjectName,   placeholder: 'SAHIL Phase 3' },
            ].map(({ label, val, set, placeholder }) => (
              <div key={label}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input
                  type="text"
                  value={val}
                  onChange={e => set(e.target.value)}
                  placeholder={placeholder}
                  disabled={isProcessing || !pidFile}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
            ))}
          </div>
          {!STAGE_FLOW[2].isComplete(stageFlowState) && (
            <StageSkipButton stage={STAGE_FLOW[2]} onSkip={() => skipStage('metadata')} />
          )}
          </>
          )}

          {/* ── Stage 4 · BYOK — Bring Your Own AI Key (gated — soft-coded) ── */}
          {!STAGE_FLOW[3].isUnlocked(stageFlowState) ? (
            <StageGate stage={STAGE_FLOW[3]} />
          ) : (
          <>
          <h2 className={`text-lg font-semibold mt-5 mb-3 flex items-center gap-2 ${pidFile ? 'text-gray-800' : 'text-gray-400'}`}>
            <span className={`h-6 w-6 rounded-full text-xs font-bold flex items-center justify-center ${pidFile ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-400'}`}>4</span>
            AI Extraction Key — BYOK <span className="text-xs font-normal text-gray-400">(optional, improves accuracy)</span>
            {!pidFile && <span className="text-xs">🔒</span>}
          </h2>

          {/* Stage 4 · User Instruction (soft-coded) */}
          <StageInstruction stage={STAGE_FLOW[3]} />

          {/* ── Stage 4 · required key choice (soft-coded; II_SUBMIT_GATE) ──
              Extract stays disabled until BYOK-vs-shared is decided. */}
          {II_SUBMIT_GATE.enabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              {(II_SUBMIT_GATE.byokOnly
                ? [II_SUBMIT_GATE.choices.byok]
                : [II_SUBMIT_GATE.choices.byok, II_SUBMIT_GATE.choices.shared]
              ).map(c => {
                const active = byokChoice === c.id;
                const verified = c.id === 'shared' ? active : (active && Boolean(byokApiKey.trim()) && byokTestResult?.valid === true);
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={!pidFile}
                    onClick={() => setByokChoice(c.id)}
                    className={`text-left rounded-xl border p-3 transition-all ${
                      verified
                        ? 'border-emerald-400 bg-emerald-50/60 ring-2 ring-emerald-200'
                        : active
                          ? 'border-purple-400 bg-purple-50/60 ring-2 ring-purple-200'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    } ${!pidFile ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>{c.icon}</span> {c.label}
                      {verified && <CheckCircleIcon className="h-4 w-4 text-emerald-600 ml-auto" />}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">{c.desc}</p>
                    {active && c.id === 'byok' && !verified && (
                      <p className="text-[11px] font-medium text-amber-700 mt-1.5">
                        {byokApiKey.trim() ? 'Key entered — click Test Connection below to validate it.' : II_SUBMIT_GATE.byokKeyHint}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className={`rounded-lg border p-4 ${pidFile ? 'border-purple-200 bg-purple-50/40' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
            <p className="text-xs text-gray-600 mb-3">
              Provide your own <b>OpenAI</b> or <b>Claude</b> API key for the most accurate extraction —
              it is used <b>before</b> the shared engines (which can be quota-limited) and is
              <b> never stored</b>.{' '}
              {II_SUBMIT_GATE.byokOnly
                ? <b>A key is required to run extraction.</b>
                : 'Leave empty to use the shared engines.'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Provider</label>
                <select
                  value={byokProvider}
                  onChange={e => { setByokProvider(e.target.value); setByokModel(''); setByokTestResult(null); }}
                  disabled={isProcessing || !pidFile}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                >
                  <option value="claude">Claude (Anthropic)</option>
                  <option value="openai">OpenAI (GPT-4o)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">API Key</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={byokApiKey}
                    onChange={e => { setByokApiKey(e.target.value); setByokTestResult(null); }}
                    placeholder={byokProvider === 'claude' ? 'sk-ant-…' : 'sk-…'}
                    autoComplete="off"
                    disabled={isProcessing || !pidFile}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                  />
                  <button
                    type="button"
                    onClick={handleByokTest}
                    disabled={isProcessing || !pidFile || byokTesting || !byokApiKey.trim()}
                    className="px-3 py-2 text-xs font-semibold border border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    title="Validate the key with one minimal provider call"
                  >
                    {byokTesting ? 'Testing…' : '⚡ Test'}
                  </button>
                </div>
                {byokTestResult && (
                  <p className={`text-[11px] mt-1.5 ${byokTestResult.valid ? 'text-emerald-600' : 'text-red-600'}`}>
                    {byokTestResult.valid ? '✓ ' : '✕ '}{byokTestResult.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Model</label>
                <select
                  value={byokModel}
                  onChange={e => { setByokModel(e.target.value); setByokTestResult(null); }}
                  disabled={isProcessing || !pidFile}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                >
                  {(byokProvider === 'claude'
                    ? [
                        ['', 'Claude default (auto)'],
                        ['claude-sonnet-5', 'Claude Sonnet 5'],
                        ['claude-opus-5', 'Claude Opus 5'],
                        ['claude-sonnet-4-5-20250929', 'Claude Sonnet 4.5'],
                      ]
                    : [
                        ['', 'OpenAI default (gpt-4o)'],
                        ['gpt-4o', 'GPT-4o'],
                        ['gpt-4o-mini', 'GPT-4o mini (cheaper)'],
                      ]
                  ).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ── BYOK cost estimate (soft-coded; BYOK_COST_CONFIG) ── */}
            {BYOK_COST_CONFIG.enabled && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 flex items-start gap-2">
                <span className="text-sm leading-none mt-0.5">💰</span>
                <div className="text-[11px] text-amber-900">
                  {byokCostEstimate ? (
                    <p>
                      <b>Estimated BYOK cost for this drawing: {byokCostEstimate.text}</b>
                      {' '}· {BYOK_COST_CONFIG.pricing[byokProvider]?.label} · 7-pass scan
                    </p>
                  ) : (
                    <p><b>Estimated BYOK cost</b> appears here once the drawing pages are counted ({BYOK_COST_CONFIG.pricing[byokProvider]?.label}, 7-pass scan).</p>
                  )}
                  <p className="text-amber-700/80 mt-0.5">{BYOK_COST_CONFIG.disclaimer}</p>
                </div>
              </div>
            )}
          </div>
          </>
          )}
        </div>

        {/* ── Action button ───────────────────────────────────────────── */}
        <div className="mb-6 ii-section" style={{ animationDelay: '0.15s' }}>
        {/* ── Submit gate checklist (soft-coded; II_SUBMIT_GATE) ── */}
        {II_SUBMIT_GATE.enabled && !iiAllStagesVerified && activeProject && (
          <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 mb-3 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              {II_SUBMIT_GATE.checklistTitle}
            </p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
              {II_SUBMIT_GATE.stages.map(s => (
                <li key={s.id} className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${iiStageVerified[s.id] ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {iiStageVerified[s.id]
                    ? <CheckCircleIcon className="h-3.5 w-3.5" />
                    : <span className="inline-block h-3.5 w-3.5 rounded-full border border-slate-300" />}
                  {s.label}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              if (II_SUBMIT_GATE.enabled && !iiAllStagesVerified) {
                setError('Please verify all steps above (including the AI key choice) before extracting.');
                return;
              }
              handleExtract();
            }}
            disabled={!pidFile || isProcessing || !activeProject || (II_SUBMIT_GATE.enabled && !iiAllStagesVerified)}
            title={
              !activeProject ? 'Select or create an active project first'
              : (II_SUBMIT_GATE.enabled && !iiAllStagesVerified) ? II_SUBMIT_GATE.checklistTitle
              : ''
            }
            className="ii-action-btn flex-1 sm:flex-none px-8 py-3.5 rounded-xl font-semibold text-sm relative overflow-hidden"
            style={
              !pidFile || isProcessing || !activeProject || (II_SUBMIT_GATE.enabled && !iiAllStagesVerified)
                ? { background: '#f1f5f9', color: '#94a3b8', cursor: 'not-allowed', border: '1px solid #e2e8f0', transition: 'all 0.25s' }
                : { background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', border: 'none', boxShadow: '0 4px 18px rgba(59,130,246,0.32)', transition: 'all 0.25s', cursor: 'pointer' }
            }
          >
            {/* Shimmer on active */}
            {pidFile && !isProcessing && activeProject && (
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)', animation: 'ii-shimmer 2.8s linear infinite' }} />
            )}
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Extracting Instruments…
              </span>
            ) : (
              <span className="flex items-center gap-2 justify-center">
                <span className="text-lg">⚡</span>
                Extract Instrument Index
              </span>
            )}
          </button>

          {result && (
            <>
              <button
                onClick={handleDownloadClientExcel}
                className="ii-export-btn flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm"
                style={{ background: 'rgba(59,130,246,0.07)', color: '#065f46', border: '1px solid rgba(59,130,246,0.22)', boxShadow: '0 2px 8px rgba(59,130,246,0.08)', transition: 'all 0.2s', cursor: 'pointer' }}
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
                Download Excel
              </button>
            </>
          )}
        </div>
        </div>{/* /ii-section action + gate wrapper */}

        {/* ── Progress bar ────────────────────────────────────────────── */}
        {isProcessing && (
          <div className="rounded-2xl overflow-hidden mb-6"
            style={{ background: 'white', border: '1px solid rgba(59,130,246,0.20)', boxShadow: '0 4px 24px rgba(59,130,246,0.10)', animation: 'ii-fade-up 0.35s ease forwards' }}>
            {/* Gradient top strip */}
            <div className="h-[3px]" style={{ backgroundImage: T_INST.gradBar, backgroundSize: '300% auto', animation: 'iiGradShift 2.5s linear infinite' }} />
            <div className="p-5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">{statusMessage}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 tabular-nums">
                  ⏱ {formatElapsed(elapsedSeconds)}
                </span>
                <span className="text-sm font-medium text-purple-600">
                  {Math.round(progress)}%
                </span>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="h-3 rounded-full transition-all duration-700"
                style={{ width: `${Math.max(5, progress)}%`, background: 'linear-gradient(90deg,#3b82f6,#6366f1)' }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {elapsedSeconds < 30
                ? 'Converting PDF pages to images for AI analysis…'
                : elapsedSeconds < 90
                ? 'AI Vision scanning instrument bubbles and tags…'
                : elapsedSeconds < 180
                ? 'Processing multi-page P&ID — identifying all instrument tags…'
                : `Still working (${formatElapsed(elapsedSeconds)}) — large drawings take longer. Please keep this tab open.`}
            </p>
            </div>
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-800 font-medium">⚠ {error}</p>
          </div>
        )}

        {/* ── Results ─────────────────────────────────────────────────── */}
        {result && (
          <>
            {/* Empty-state banner — shown when extraction returned 0 instruments */}
            {result.total === 0 && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 mb-6 flex gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="font-semibold text-amber-800">No instruments were extracted from this drawing.</p>
                  <p className="text-sm text-amber-700 mt-1">Possible reasons:</p>
                  <ul className="text-sm text-amber-700 list-disc list-inside mt-1 space-y-0.5">
                    <li>The PDF is a <strong>scanned image</strong> with no embedded text — Tesseract OCR will be used next.</li>
                    <li>All AI Vision engines (Gemini, OpenAI) are temporarily <strong>rate-limited or quota-exceeded</strong>.</li>
                    <li>The PDF does not contain ISA-standard instrument tag formats.</li>
                  </ul>
                  <p className="text-sm text-amber-700 mt-2">
                    Try uploading again in a few seconds, or check backend logs for details.
                  </p>
                </div>
              </div>
            )}
            {/* ── Enterprise register header (soft-coded — Deliverable_template pattern) ── */}
            {II_RESULTS_UI.commandBar.enabled && (
              <div className="ii-section" style={{ animationDelay: '0s' }}>
                {/* Breadcrumb + title + register chips */}
                <p className="text-xs text-slate-400 mb-1">
                  {II_REGISTER_UI.breadcrumbRoot} <span className="mx-1">/</span> <span className="text-slate-500 font-medium">{activeProject?.name || projectName || '—'}</span>
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Instrument Index</h2>
                  <div className="flex flex-wrap items-center gap-2 ml-auto text-[11px]">
                    {drawingNumber && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-600 font-semibold">
                        <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Register</span>
                        <span className="font-mono">{drawingNumber}</span>
                      </span>
                    )}
                    {revision && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-600 font-semibold">
                        <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Rev</span> {revision}
                      </span>
                    )}
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold"
                      style={{ background: II_REGISTER_UI.statusChip.bg, color: II_REGISTER_UI.statusChip.text }}>
                      {II_REGISTER_UI.statusChip.label}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-1 mb-4">
                  {activeProject?.name || projectName || ''}{activeProject || projectName ? ' — ' : ''}{II_REGISTER_UI.subtitle}
                </p>

                {/* ── Underline view tabs (template pattern) ── */}
                <div className="flex gap-6 border-b border-slate-200 mb-5">
                  {[
                    { id: 'table',   label: 'Instrument Table',  count: (result.instruments || []).length },
                    { id: 'summary', label: 'Category Summary',  count: Object.keys(result.category_summary || {}).length },
                    { id: 'layout',  label: 'ISA Layout Matrix', count: result.total },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveView(tab.id)}
                      className={`relative pb-2.5 text-sm font-semibold transition-colors ${
                        activeView === tab.id ? '' : 'text-slate-400 hover:text-slate-600'
                      }`}
                      style={activeView === tab.id ? { color: II_REGISTER_UI.accent } : {}}
                    >
                      {tab.label}
                      {II_RESULTS_UI.tabs.showCounts && (
                        <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] px-1 h-5 rounded-full text-[10px] font-black tabular-nums align-middle"
                          style={activeView === tab.id
                            ? { background: II_REGISTER_UI.accentSoft, color: II_REGISTER_UI.accent }
                            : { background: '#f1f5f9', color: '#94a3b8' }}>
                          {tab.count}
                        </span>
                      )}
                      {activeView === tab.id && (
                        <span className="absolute left-0 right-0 -bottom-px h-[3px] rounded-t-full"
                          style={{ background: II_REGISTER_UI.accent }} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── KPI stat cards (soft-coded enterprise register pattern) ── */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
              {II_REGISTER_UI.kpis.map((k, kpiIdx) => {
                const value =
                  k.id === 'total'      ? result.total :
                  k.id === 'categories' ? Object.keys(result.category_summary || {}).length :
                  k.id === 'warnings'   ? (result.instruments || []).filter(i => Array.isArray(i.warnings) && i.warnings.length > 0).length :
                  k.id === 'inferred'   ? (result.instruments || []).filter(i => i.inferred === true).length :
                  /* selected */          selectedRows.size;
                return (
                  <div key={k.id}
                    className="ii-kpi-card rounded-xl bg-white border border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow"
                    style={{ animationDelay: `${kpiIdx * 0.05}s` }}>
                    <span className="inline-flex items-center justify-center h-9 w-9 rounded-lg shrink-0"
                      style={{ background: `${k.color}14`, color: k.color }}>
                      {k.id === 'total'      && <ListBulletIcon className="h-5 w-5" />}
                      {k.id === 'categories' && <ChartBarIcon className="h-5 w-5" />}
                      {k.id === 'warnings'   && <span className="text-base font-black">⚠</span>}
                      {k.id === 'inferred'   && <span className="text-base font-black">◈</span>}
                      {k.id === 'selected'   && <CheckCircleIcon className="h-5 w-5" />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xl font-extrabold tabular-nums leading-none" style={{ color: value > 0 ? k.color : '#94a3b8' }}>{value}</p>
                      <p className="text-[10px] font-medium text-slate-400 mt-1 truncate">{k.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>


            {/* ── TABLE VIEW ─────────────────────────────────────────── */}
            {activeView === 'table' && (() => {
              // Soft-coded: pick the right template for the active project
              const tpl = getInstrumentTemplate(activeProject?.category);
              const useTpl = tpl.id !== 'default'; // ADNOC Gas (and future bespoke templates)
              const dash = tpl.emptyDash || '—';

              // ── Enterprise pagination (soft-coded) ─────────────────
              // Slices the filtered rows into pages; selection logic still
              // operates on the full filtered set (unchanged core behaviour).
              const totalRows  = filteredInstruments.length;
              const pageCount  = Math.max(1, Math.ceil(totalRows / tablePageSize));
              const safePage   = Math.min(Math.max(1, tablePage), pageCount);
              const pagedInstruments = II_REGISTER_UI.enabled
                ? filteredInstruments.slice((safePage - 1) * tablePageSize, safePage * tablePageSize)
                : filteredInstruments;

              // ── Build grouped row blocks when template requests it ──
              const buildBlocks = () => {
                if (!useTpl || !tpl.groupBy) {
                  return [{ key: '__all__', label: null, items: pagedInstruments }];
                }
                const groups = new Map();
                const ungrouped = [];
                pagedInstruments.forEach(i => {
                  const k = tpl.groupBy(i);
                  if (!k) { ungrouped.push(i); return; }
                  if (!groups.has(k)) groups.set(k, []);
                  groups.get(k).push(i);
                });
                const blocks = [];
                groups.forEach((items, k) =>
                  blocks.push({
                    key: k,
                    label: tpl.groupHeaderLabel ? tpl.groupHeaderLabel(k, items) : k,
                    items,
                  })
                );
                if (ungrouped.length) blocks.push({ key: '__ungrouped__', label: 'Other / Unassigned', items: ungrouped });
                return blocks;
              };
              const blocks = buildBlocks();

              // ── Selection helpers ──────────────────────────────────
              // Map each instrument back to its index in result.instruments
              // so a single Set keeps selection stable across grouping/filtering.
              const indexOfInst = (inst) => result.instruments.indexOf(inst);
              const visibleIdx  = filteredInstruments.map(indexOfInst);
              const allVisibleSelected = visibleIdx.length > 0 && visibleIdx.every(i => selectedRows.has(i));
              const someVisibleSelected = visibleIdx.some(i => selectedRows.has(i));
              const toggleRow = (i) => {
                const next = new Set(selectedRows);
                if (next.has(i)) next.delete(i); else next.add(i);
                setSelectedRows(next);
              };
              const toggleAllVisible = () => {
                const next = new Set(selectedRows);
                if (allVisibleSelected) visibleIdx.forEach(i => next.delete(i));
                else                    visibleIdx.forEach(i => next.add(i));
                setSelectedRows(next);
              };

              return (
              <div className="rounded-2xl overflow-hidden ii-section" style={{ background: 'white', border: '1px solid rgba(59,130,246,0.12)', boxShadow: '0 4px 24px rgba(59,130,246,0.07)', animationDelay: '0s' }}>
                {/* Filters + template badge + download */}
                <div className="px-5 py-4 bg-gradient-to-r from-slate-50 via-white to-slate-50 border-b border-gray-200 flex flex-wrap gap-3 items-center">
                  <h3 className="text-base font-semibold text-gray-800 mr-2 flex items-center gap-2">
                    <span className="inline-flex items-center justify-center h-6 min-w-[1.5rem] px-1.5 rounded-md bg-purple-100 text-purple-700 text-xs font-black tabular-nums">
                      {filteredInstruments.length}
                    </span>
                    Instrument{filteredInstruments.length !== 1 ? 's' : ''}
                    {filterCategory !== 'All' ? <span className="text-gray-400 font-normal"> · {filterCategory}</span> : ''}
                  </h3>
                  {useTpl && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200"
                      title={tpl.label}>
                      🔥 {tpl.label}
                    </span>
                  )}
                  {selectedRows.size > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      ☑ {selectedRows.size} selected
                      <button
                        onClick={() => setSelectedRows(new Set())}
                        className="ml-1 text-indigo-500 hover:text-indigo-800"
                        title="Clear selection">
                        ✕
                      </button>
                    </span>
                  )}
                  <div className="relative flex-1 min-w-[200px] max-w-xs">
                    <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z" /></svg>
                    <input
                      type="text"
                      placeholder="Filter by tag / service / type…"
                      value={filterText}
                      onChange={e => { setFilterText(e.target.value); setTablePage(1); }}
                      className="ii-filter-input w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                    />
                  </div>
                  <select
                    value={filterCategory}
                    onChange={e => { setFilterCategory(e.target.value); setTablePage(1); }}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-purple-400 bg-white"
                  >
                    {uniqueCategories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {(filterText || filterCategory !== 'All') && (
                    <button
                      onClick={() => { setFilterText(''); setFilterCategory('All'); setTablePage(1); }}
                      className="text-xs px-2 py-1 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                    >
                      Clear
                    </button>
                  )}
                  {/* Download Excel — exports selection if any, else everything */}
                  <button
                    onClick={handleDownloadClientExcel}
                    className="ii-export-btn ml-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg text-white"
                    style={{ background: II_REGISTER_UI.accent, border: `1px solid ${II_REGISTER_UI.accent}`, boxShadow: '0 2px 8px rgba(15,118,110,0.25)', transition: 'all 0.2s', cursor: 'pointer' }}
                    title={selectedRows.size > 0 ? `Download ${selectedRows.size} selected rows` : 'Download all rows'}
                  >
                    <ArrowDownTrayIcon className="h-4 w-4" />
                    {selectedRows.size > 0 ? `Download ${selectedRows.size}` : 'Download Excel'}
                  </button>
                </div>

                {/* ── Template-driven table (ADNOC Gas etc.) ───────────── */}
                {useTpl ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                      {/* Header colours soft-coded: every <th> gets an EXPLICIT solid
                          background — sticky cells cannot rely on the thead gradient,
                          otherwise white text becomes invisible while scrolling. */}
                      <thead className="ii-th-sticky text-[10px] uppercase tracking-wider text-white" style={{ background: '#065f46' }}>
                        {tpl.groupHeader && tpl.groupHeader.length > 0 && (
                          <tr>
                            {/* Empty span over checkbox + SL No */}
                            <th colSpan={2} className="px-2 py-2 border-b border-emerald-800/40" style={{ background: '#065f46' }} />
                            {tpl.groupHeader.map((g, gi) => (
                              <th key={gi} colSpan={g.span || 1}
                                className="px-3 py-2 text-center font-bold border-b border-emerald-800/40"
                                style={g.label
                                  ? { background: '#0f766e', color: '#ffffff', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)' }
                                  : { background: '#065f46' }}>
                                {g.label || ''}
                              </th>
                            ))}
                            {/* Empty span over the Action column */}
                            <th className="px-2 py-2 border-b border-emerald-800/40" style={{ background: '#2563eb' }} />
                          </tr>
                        )}
                        <tr>
                          <th className="px-2 py-2.5 text-center font-semibold border-b border-slate-200 w-8 sticky left-0 z-10" style={{ background: '#065f46' }}>
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 accent-indigo-600 cursor-pointer"
                              checked={allVisibleSelected}
                              ref={el => { if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected; }}
                              onChange={toggleAllVisible}
                              title={allVisibleSelected ? 'Deselect all' : 'Select all'}
                            />
                          </th>
                          <th className="px-2 py-2.5 text-center font-semibold border-b border-slate-200 w-10" style={{ background: '#065f46' }}>SL No.</th>
                          {tpl.columns.map((c) => (
                            <th key={c.key}
                              className="px-3 py-2.5 text-left font-semibold whitespace-pre-line align-bottom border-b border-slate-200"
                              style={{ minWidth: `${(c.width || 12) * 7}px`, background: '#047857', color: '#ffffff' }}>
                              {c.header}
                            </th>
                          ))}
                          <th className="px-2 py-2.5 text-center font-semibold border-b border-slate-200 w-16 sticky right-0 z-10" style={{ background: '#2563eb' }}>
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredInstruments.length === 0 ? (
                          <tr>
                            <td colSpan={tpl.columns.length + 3} className="px-4 py-12 text-center">
                              <div className="flex flex-col items-center gap-2 text-gray-400">
                                <svg className="h-12 w-12 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z" /></svg>
                                <p className="text-sm font-medium">No instruments match the current filter.</p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          (() => {
                            // Continuous SL No across grouped blocks
                            let _sl = 0;
                            return blocks.map(block => {
                              const rows = [];
                              if (block.label) {
                                rows.push(
                                  <tr key={`hdr-${block.key}`} className="bg-amber-50">
                                    <td colSpan={tpl.columns.length + 3}
                                      className="px-3 py-2 text-[11px] font-black uppercase tracking-wider text-amber-900 border-y border-amber-200">
                                      {block.label}
                                    </td>
                                  </tr>
                                );
                              }
                              block.items.forEach((inst, gIdx) => {
                                _sl += 1;
                                const sl = _sl;
                                const realIdx = indexOfInst(inst);
                                const isSelected = selectedRows.has(realIdx);
                                const style = categoryStyle(inst.category);
                                const hasWarnings = Array.isArray(inst.warnings) && inst.warnings.length > 0;
                                const isInferred  = inst.inferred === true;
                                const rowBg = isSelected ? 'bg-indigo-50/60'
                                              : isInferred ? 'bg-fuchsia-50/30'
                                              : hasWarnings ? 'bg-amber-50/40' : '';
                                rows.push(
                                  <tr key={`${block.key}-${gIdx}`} className={`${rowBg} ii-row-animate hover:bg-blue-50/60 transition-colors`} style={{ animationDelay: `${Math.min(sl * 0.035, 0.5)}s` }}>
                                    <td className="px-2 py-2 text-center sticky left-0 bg-inherit">
                                      <input
                                        type="checkbox"
                                        className="h-3.5 w-3.5 accent-indigo-600 cursor-pointer"
                                        checked={isSelected}
                                        onChange={() => toggleRow(realIdx)}
                                      />
                                    </td>
                                    <td className="px-2 py-2 text-center text-slate-500 tabular-nums font-medium">{sl}</td>
                                    {tpl.columns.map((c, ci) => {
                                      let v;
                                      try { v = c.accessor(inst, { idx: gIdx, ctx: { project: activeProject, result } }); }
                                      catch (_) { v = dash; }
                                      if (v == null || v === '') v = dash;
                                      const isTag = c.key === 'tag_number';
                                      const baseCls = `px-3 py-2 ${c.align === 'center' ? 'text-center' : c.align === 'right' ? 'text-right' : 'text-left'} ${c.mono ? 'font-mono' : ''} whitespace-nowrap`;
                                      return (
                                        <td key={ci} className={baseCls}
                                          style={isTag ? { color: style.text, fontWeight: 700 } : undefined}>
                                          {isTag ? (
                                            <div className="flex items-center gap-1.5">
                                              <span>{v}</span>
                                              {isInferred && (
                                                <span title={`Inferred accessory of ${inst.parent_tag || 'parent'}`}
                                                  className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200">INFERRED</span>
                                              )}
                                              {hasWarnings && (
                                                <span title={inst.warnings.join(' · ')}
                                                  className="inline-flex items-center justify-center h-4 w-4 rounded-full text-[9px] font-black bg-amber-100 text-amber-700 border border-amber-200 cursor-help">!</span>
                                              )}
                                            </div>
                                          ) : v}
                                        </td>
                                      );
                                    })}
                                    {/* Action column — Edit row button */}
                                    <td className="px-2 py-2 text-center sticky right-0 bg-inherit">
                                      <button
                                        type="button"
                                        onClick={() => setEditingRow({ idx: realIdx, draft: { ...inst } })}
                                        title="Edit this row"
                                        className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 text-slate-600 transition-colors shadow-sm"
                                      >
                                        <PencilSquareIcon className="h-3.5 w-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              });
                              return rows;
                            });
                          })()
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    {/* Explicit solid cell backgrounds — sticky headers cannot rely
                        on a thead gradient (white text becomes invisible on scroll). */}
                    <thead className="ii-th-sticky text-xs uppercase tracking-wider text-white" style={{ background: '#065f46' }}>
                      <tr>
                        <th className="px-2 py-3 text-center font-semibold w-8" style={{ background: '#065f46' }}>
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-indigo-600 cursor-pointer"
                            checked={allVisibleSelected}
                            ref={el => { if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected; }}
                            onChange={toggleAllVisible}
                            title={allVisibleSelected ? 'Deselect all' : 'Select all'}
                          />
                        </th>
                        <th className="px-2 py-3 text-center font-semibold w-12" style={{ background: '#065f46' }}>SL No.</th>
                        {['Tag Number', 'CS Tag', 'Instrument Type', 'Category', 'Service Description',
                          'Line No.', 'Equipment No.', 'Loop No.', 'Fail Safe', 'Signal',
                          'Set Point', 'P&ID No.', 'Rev.', 'Source'].map(h => (
                          <th key={h} className="px-3 py-3 text-left whitespace-nowrap font-semibold" style={{ background: '#047857', color: '#ffffff' }}>
                            {h}
                          </th>
                        ))}
                        <th className="px-2 py-3 text-center whitespace-nowrap font-semibold w-16" style={{ background: '#2563eb' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredInstruments.length === 0 ? (
                        <tr>
                          <td colSpan={17} className="px-4 py-12 text-center">
                            <div className="flex flex-col items-center gap-2 text-gray-400">
                              <svg className="h-12 w-12 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z" /></svg>
                              <p className="text-sm font-medium">No instruments match the current filter.</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        pagedInstruments.map((inst, idx) => {
                          const realIdx = indexOfInst(inst);
                          const isSelected = selectedRows.has(realIdx);
                          const style = categoryStyle(inst.category);
                          // Source badge styling
                          const note = inst.notes || '';
                          const sourceStyle = note.includes('Legends sheet')
                            ? { bg: '#ECFEFF', text: '#155E75' }  // cyan — legend-assisted
                            : note.startsWith('AI')
                            ? { bg: '#EEF2FF', text: '#3730A3' }  // indigo — AI
                            : note.startsWith('Inferred')
                            ? { bg: '#FDF4FF', text: '#86198F' }  // fuchsia — inferred accessory
                            : note.startsWith('OCR circle')
                            ? { bg: '#FFF7ED', text: '#C2410C' }  // orange — OCR circle
                            : note.startsWith('OCR')
                            ? { bg: '#FEF9C3', text: '#713F12' }  // yellow — OCR plain
                            : { bg: '#F0FDF4', text: '#166534' }; // green  — PDF text
                          const hasWarnings = Array.isArray(inst.warnings) && inst.warnings.length > 0;
                          const isInferred  = inst.inferred === true;
                          const rowBg = isSelected
                            ? 'bg-indigo-50/60'
                            : isInferred
                            ? 'bg-fuchsia-50/30'
                            : hasWarnings
                              ? 'bg-amber-50/40'
                              : '';
                          return (
                            <tr key={idx} className={`${rowBg} ii-row-animate hover:bg-blue-50/60 transition-colors`} style={{ animationDelay: `${Math.min(idx * 0.035, 0.5)}s` }}>
                              <td className="px-2 py-2.5 text-center">
                                <input
                                  type="checkbox"
                                  className="h-3.5 w-3.5 accent-indigo-600 cursor-pointer"
                                  checked={isSelected}
                                  onChange={() => toggleRow(realIdx)}
                                />
                              </td>
                              <td className="px-2 py-2.5 text-center text-gray-500 tabular-nums font-medium">{(safePage - 1) * tablePageSize + idx + 1}</td>
                              <td className="px-3 py-2.5 font-bold font-mono whitespace-nowrap" style={{ color: style.text }}>
                                <div className="flex items-center gap-1.5">
                                  <span>{inst.tag_number || '—'}</span>
                                  {isInferred && (
                                    <span title={`Inferred accessory of ${inst.parent_tag || 'parent'}`}
                                      className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200">
                                      INFERRED
                                    </span>
                                  )}
                                  {hasWarnings && (
                                    <span title={inst.warnings.join(' · ')}
                                      className="inline-flex items-center justify-center h-4 w-4 rounded-full text-[9px] font-black bg-amber-100 text-amber-700 border border-amber-200 cursor-help">
                                      !
                                    </span>
                                  )}
                                  {inst.is_inline && (
                                    <span title="Inline instrument"
                                      className="inline-flex items-center justify-center h-4 w-4 rounded-full text-[9px] font-black bg-blue-100 text-blue-700 border border-blue-200">
                                      •
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap text-indigo-700">{inst.control_system_tag || '—'}</td>
                              <td className="px-3 py-2.5 text-gray-700 max-w-xs">{inst.instrument_type || '—'}</td>
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <span
                                  className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                                  style={{ backgroundColor: style.bg, color: style.text }}
                                >
                                  {inst.category || '—'}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-gray-700 max-w-xs">{inst.service_description || '—'}</td>
                              <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{inst.line_number      || '—'}</td>
                              <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{inst.equipment_number  || '—'}</td>
                              <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{inst.loop_number       || '—'}</td>
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                {inst.fail_safe && inst.fail_safe !== 'N/A' ? (
                                  <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                    inst.fail_safe === 'FC' ? 'bg-red-100 text-red-700'
                                    : inst.fail_safe === 'FO' ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-700'
                                  }`}>{inst.fail_safe}</span>
                                ) : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap text-xs">{inst.signal_type       || '—'}</td>
                              <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap text-xs">{inst.set_point         || '—'}</td>
                              <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap font-mono text-xs">{inst.pid_no            || '—'}</td>
                              <td className="px-3 py-2.5 text-gray-600 text-center">{inst.revision || '0'}</td>
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                {note && (
                                  <span
                                    className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                                    style={{ backgroundColor: sourceStyle.bg, color: sourceStyle.text }}
                                    title={note}
                                  >
                                    {note}
                                  </span>
                                )}
                              </td>
                              {/* Action column — Edit row button */}
                              <td className="px-2 py-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => setEditingRow({ idx: realIdx, draft: { ...inst } })}
                                  title="Edit this row"
                                  className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 text-slate-600 transition-colors shadow-sm"
                                >
                                  <PencilSquareIcon className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                )}

                {/* ── Enterprise pagination footer (soft-coded — template pattern) ── */}
                {II_RESULTS_UI.statusBar.enabled && (
                  <div className="px-5 py-2.5 bg-white border-t border-slate-200 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-slate-500">
                    <span className="tabular-nums">
                      {totalRows === 0 ? '0' : `${(safePage - 1) * tablePageSize + 1}–${Math.min(safePage * tablePageSize, totalRows)}`} of {totalRows}
                    </span>
                    {filterCategory !== 'All' && <span>· Category: <b className="text-slate-700">{filterCategory}</b></span>}
                    {selectedRows.size > 0 && (
                      <span className="font-semibold" style={{ color: II_REGISTER_UI.accent }}>· {selectedRows.size} selected</span>
                    )}
                    {useTpl && <span className="font-semibold text-emerald-700">· Template: {tpl.label}</span>}

                    <div className="ml-auto flex items-center gap-1.5">
                      <select
                        value={tablePageSize}
                        onChange={e => { setTablePageSize(Number(e.target.value)); setTablePage(1); }}
                        className="px-1.5 py-1 text-[11px] border border-slate-200 rounded-md bg-white text-slate-600"
                        title="Rows per page">
                        {II_REGISTER_UI.pageSizeOptions.map(n => <option key={n} value={n}>{n} / page</option>)}
                      </select>
                      <button
                        onClick={() => setTablePage(p => Math.max(1, p - 1))}
                        disabled={safePage <= 1}
                        className="h-6 w-6 inline-flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                        ‹
                      </button>
                      {Array.from({ length: pageCount }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === pageCount || Math.abs(p - safePage) <= 2)
                        .reduce((acc, p, i, arr) => {
                          if (i > 0 && p - arr[i - 1] > 1) acc.push('…');
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((p, i) => p === '…' ? (
                          <span key={`gap-${i}`} className="px-1 text-slate-300">…</span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => setTablePage(p)}
                            className={`h-6 min-w-[1.5rem] px-1 rounded-md text-[11px] font-semibold tabular-nums transition-colors ${
                              p === safePage ? 'text-white' : 'text-slate-500 border border-slate-200 hover:bg-slate-50'
                            }`}
                            style={p === safePage ? { background: II_REGISTER_UI.accent } : {}}>
                            {p}
                          </button>
                        ))}
                      <button
                        onClick={() => setTablePage(p => Math.min(pageCount, p + 1))}
                        disabled={safePage >= pageCount}
                        className="h-6 w-6 inline-flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                        ›
                      </button>
                    </div>
                  </div>
                )}
              </div>
              );
            })()}

            {/* ── SUMMARY VIEW ───────────────────────────────────────── */}
            {activeView === 'summary' && (
              <div className="rounded-2xl p-6 ii-section" style={{ ...T_INST.cardEq, animationDelay: '0s' }}>
                <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">
                      Instruments by Category
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Visual distribution of {result.total} extracted instrument{result.total === 1 ? '' : 's'} across{' '}
                      {Object.keys(result.category_summary || {}).length} categor{Object.keys(result.category_summary || {}).length === 1 ? 'y' : 'ies'}
                    </p>
                  </div>
                </div>

                {/* ── Innovative visualizations (soft-coded, recharts) ── */}
                {result.total > 0 && (II_REGISTER_UI.visuals.summaryDonut || II_REGISTER_UI.visuals.summaryBars) && (() => {
                  const chartData = Object.entries(result.category_summary || {})
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, cnt]) => ({
                      name: cat,
                      value: cnt,
                      pct: ((cnt / result.total) * 100),
                      color: categoryStyle(cat).text,
                    }));
                  const ChartTip = ({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white rounded-lg shadow-lg border border-slate-200 px-3 py-2 text-xs">
                        <p className="font-bold" style={{ color: d.color }}>{d.name}</p>
                        <p className="text-slate-600">{d.value} tags · {d.pct.toFixed(1)}%</p>
                      </div>
                    );
                  };
                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                      {/* Donut — share of total */}
                      {II_REGISTER_UI.visuals.summaryDonut && (
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Distribution share</p>
                          <div className="relative" style={{ height: 260 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={chartData}
                                  dataKey="value"
                                  nameKey="name"
                                  innerRadius="58%"
                                  outerRadius="88%"
                                  paddingAngle={2}
                                  strokeWidth={2}
                                  stroke="#ffffff"
                                >
                                  {chartData.map(d => <Cell key={d.name} fill={d.color} />)}
                                </Pie>
                                <RTooltip content={<ChartTip />} />
                              </PieChart>
                            </ResponsiveContainer>
                            {/* Center total */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                              <p className="text-3xl font-black tabular-nums text-slate-800">{result.total}</p>
                              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Instruments</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1">
                            {chartData.map(d => (
                              <span key={d.name} className="inline-flex items-center gap-1.5 text-[10px] text-slate-500">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                                {d.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Ranked horizontal bars */}
                      {II_REGISTER_UI.visuals.summaryBars && (
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Ranked by count</p>
                          <div style={{ height: 260 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 44, left: 8, bottom: 4 }}>
                                <XAxis type="number" hide />
                                <YAxis
                                  type="category" dataKey="name" width={110}
                                  tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false}
                                />
                                <RTooltip content={<ChartTip />} cursor={{ fill: 'rgba(15,118,110,0.05)' }} />
                                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}
                                  label={{ position: 'right', fontSize: 10, fill: '#64748b', formatter: (v) => v }}>
                                  {chartData.map(d => <Cell key={d.name} fill={d.color} />)}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(result.category_summary || {})
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, cnt], rank) => {
                      const style = categoryStyle(cat);
                      const pct   = result.total > 0 ? (cnt / result.total) * 100 : 0;
                      return (
                        <div
                          key={cat}
                          className="rounded-xl p-4 border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg cursor-default"
                          style={{ backgroundColor: style.bg, borderColor: style.text + '35' }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-sm flex items-center gap-2" style={{ color: style.text }}>
                              <span className="inline-flex items-center justify-center h-5 min-w-[1.25rem] px-1 rounded-md text-[10px] font-black text-white/95 tabular-nums"
                                style={{ backgroundColor: style.text, opacity: 0.85 }}>
                                #{rank + 1}
                              </span>
                              {cat}
                            </span>
                            <span className="text-2xl font-bold tabular-nums" style={{ color: style.text }}>{cnt}</span>
                          </div>
                          <div className="w-full bg-white bg-opacity-60 rounded-full h-2">
                            <div
                              className="h-2 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, backgroundColor: style.text, opacity: 0.6 }}
                            />
                          </div>
                          <p className="text-xs mt-1" style={{ color: style.text }}>
                            {pct.toFixed(1)}% of total
                          </p>
                        </div>
                      );
                    })}
                </div>

                {/* Instruments per category detail */}
                <div className="mt-8 space-y-4">
                  {Object.entries(result.category_summary || {})
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat]) => {
                      const style = categoryStyle(cat);
                      const inCat = (result.instruments || []).filter(i => i.category === cat);
                      return (
                        <details key={cat} className="rounded-lg border overflow-hidden">
                          <summary
                            className="px-4 py-3 cursor-pointer font-medium text-sm flex items-center gap-2"
                            style={{ backgroundColor: style.bg, color: style.text }}
                          >
                            <span className="font-bold">{cat}</span>
                            <span className="ml-auto bg-white bg-opacity-60 px-2 py-0.5 rounded-full text-xs">
                              {inCat.length} tags
                            </span>
                          </summary>
                          <div className="px-4 py-2 flex flex-wrap gap-2">
                            {inCat.map((i, n) => (
                              <span
                                key={n}
                                className="inline-block px-2 py-0.5 rounded text-xs font-mono font-medium border"
                                style={{ backgroundColor: style.bg, color: style.text, borderColor: style.text + '40' }}
                              >
                                {i.tag_number}
                              </span>
                            ))}
                          </div>
                        </details>
                      );
                    })}
                </div>
              </div>
            )}

            {/* ── LAYOUT VIEW — ISA 5.1 Functional Classification Matrix ── */}
            {activeView === 'layout' && (() => {
              // ═══════════════════════════════════════════════════════════════════
              // Soft-coded: ISA 5.1 measured-variable first letters (rows of matrix)
              // Each entry: letter, full name, accent colour
              // ═══════════════════════════════════════════════════════════════════
              const ISA_MEASURED = [
                { letter:'F', name:'Flow',                   color:'#22c55e', light:'#f0fdf4' },
                { letter:'P', name:'Pressure',               color:'#f97316', light:'#fff7ed' },
                { letter:'T', name:'Temperature',            color:'#ef4444', light:'#fef2f2' },
                { letter:'L', name:'Level',                  color:'#eab308', light:'#fefce8' },
                { letter:'A', name:'Analysis',               color:'#a855f7', light:'#faf5ff' },
                { letter:'d', name:'Differential Pressure',  color:'#fb923c', light:'#fff7ed' },
                { letter:'Z', name:'Position / Actuator',    color:'#64748b', light:'#f8fafc' },
                { letter:'S', name:'Safety / Speed / Limit', color:'#dc2626', light:'#fef2f2' },
                { letter:'W', name:'Weight / Force',         color:'#6b7280', light:'#f9fafb' },
                { letter:'J', name:'Power / Elect.',         color:'#3b82f6', light:'#eff6ff' },
                { letter:'X', name:'Unknown / Other',        color:'#94a3b8', light:'#f8fafc' },
              ];

              // ═══════════════════════════════════════════════════════════════════
              // Soft-coded: ISA 5.1 function suffix letters (columns of matrix)
              // ═══════════════════════════════════════════════════════════════════
              const ISA_FUNCTIONS = [
                { code:'T',   label:'Transmitter' },
                { code:'I',   label:'Indicator'   },
                { code:'IC',  label:'Ind.Control.' },
                { code:'C',   label:'Controller'  },
                { code:'CV',  label:'Ctrl. Valve'  },
                { code:'V',   label:'Valve'        },
                { code:'S',   label:'Switch'       },
                { code:'SH',  label:'Switch Hi'    },
                { code:'SL',  label:'Switch Lo'    },
                { code:'SHH', label:'Switch HiHi'  },
                { code:'SLL', label:'Switch LoLo'  },
                { code:'AH',  label:'Alarm Hi'     },
                { code:'AL',  label:'Alarm Lo'     },
                { code:'E',   label:'Element'      },
                { code:'G',   label:'Gauge'        },
                { code:'R',   label:'Recorder'     },
                { code:'Y',   label:'Relay/Comput.' },
  ];

              // ═══════════════════════════════════════════════════════════════════
              // Soft-coded: parse ISA first-letter from a tag number
              // e.g. "FT-1234" → F,  "LIC-001" → L,  "dPT-5A" → d
              // ═══════════════════════════════════════════════════════════════════
              const parseTagMeasured = (tag) => {
                if (!tag) return 'X';
                const m = tag.match(/^([A-Za-z]{1,3})-?\d/);
                if (!m) return 'X';
                const prefix = m[1].toUpperCase();
                // Differential pressure: DPT, dPT, DP...
                if (prefix.startsWith('DP') || prefix.startsWith('d')) return 'd';
                return prefix[0];
              };

              // ═══════════════════════════════════════════════════════════════════
              // Soft-coded: parse ISA function suffix from tag prefix
              // e.g. "FT" → T,  "LIC" → IC,  "PSV" → SV
              // Match by longest suffix first to avoid false positives
              // ═══════════════════════════════════════════════════════════════════
              const FUNC_PRIORITY = ['SHH','SLL','SH','SL','IC','CV','AH','AL','T','I','C','V','S','E','G','R','Y'];
              const parseTagFn = (tag) => {
                if (!tag) return null;
                const m = tag.match(/^[A-Za-z]+/);
                if (!m) return null;
                const prefix = m[0].toUpperCase();
                const letters = prefix.replace(/^[FLPTA-Z]/, ''); // strip first measured variable letter
                for (const fn of FUNC_PRIORITY) {
                  if (letters.endsWith(fn) || letters === fn) return fn;
                }
                return null;
              };

              // Build matrix: { measured: { fn: [instruments] } }
              const matrix = {};
              for (const inst of (result.instruments || [])) {
                const mv  = parseTagMeasured(inst.tag_number);
                const fn  = parseTagFn(inst.tag_number) || '—';
                if (!matrix[mv]) matrix[mv] = {};
                if (!matrix[mv][fn]) matrix[mv][fn] = [];
                matrix[mv][fn].push(inst);
              }

              // Determine which function columns have any data
              const activeFns = ISA_FUNCTIONS.filter(f =>
                ISA_MEASURED.some(mv => (matrix[mv.letter]?.[f.code] || []).length > 0)
              );

              // Max count in any cell (for heatmap intensity)
              const allCounts  = ISA_MEASURED.flatMap(mv =>
                activeFns.map(fn => (matrix[mv.letter]?.[fn.code] || []).length)
              );
              const maxCount = Math.max(1, ...allCounts);

              // Instruments shown in the detail drawer
              const selectedCell = layoutSelected
                ? (matrix[layoutSelected.measured]?.[layoutSelected.fn] || [])
                : null;
              const selectedMvDef = layoutSelected
                ? ISA_MEASURED.find(m => m.letter === layoutSelected.measured)
                : null;
              const selectedFnDef = layoutSelected
                ? ISA_FUNCTIONS.find(f => f.code === layoutSelected.fn)
                : null;

              // Summary counts per row
              const rowTotal = (mv) =>
                activeFns.reduce((s, fn) => s + (matrix[mv]?.[fn.code]||[]).length, 0);
              const totalInMatrix = (result.instruments||[]).length;

              return (
                <div>
                  {/* ── Header ── */}
                  <div className="rounded-2xl p-5 mb-4 ii-section" style={{ ...T_INST.cardEq, animationDelay: '0s' }}>
                    <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          <span className="text-2xl">🎛️</span>
                          ISA 5.1 Instrument Classification Matrix
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          Each bubble represents the instruments for a given
                          <strong> Measured Variable</strong> (row) ×
                          <strong> Function Suffix</strong> (column) —
                          <strong> bubble size scales with count</strong>. Click any bubble to inspect the tag list.
                        </p>
                      </div>
                      <div className="flex gap-3 flex-shrink-0">
                        <div className="ii-kpi-card text-center px-4 py-2 bg-purple-50 border border-purple-200 rounded-xl" style={{ animationDelay: '0s' }}>
                          <p className="text-2xl font-black text-purple-700">{totalInMatrix}</p>
                          <p className="text-xs text-purple-500 font-medium">Instruments</p>
                        </div>
                        <div className="ii-kpi-card text-center px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl" style={{ animationDelay: '0.06s' }}>
                          <p className="text-2xl font-black text-indigo-700">
                            {ISA_MEASURED.filter(m => rowTotal(m.letter) > 0).length}
                          </p>
                          <p className="text-xs text-indigo-500 font-medium">Variables</p>
                        </div>
                        <div className="ii-kpi-card text-center px-4 py-2 bg-teal-50 border border-teal-200 rounded-xl" style={{ animationDelay: '0.12s' }}>
                          <p className="text-2xl font-black text-teal-700">{activeFns.length}</p>
                          <p className="text-xs text-teal-500 font-medium">Functions</p>
                        </div>
                      </div>
                    </div>

                    {/* ISA Legend strip */}
                    <div className="flex flex-wrap gap-1.5">
                      {ISA_MEASURED.filter(m => rowTotal(m.letter) > 0).map(m => (
                        <span key={m.letter}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold border"
                          style={{ background:m.light, color:m.color, borderColor:`${m.color}40` }}>
                          <span className="font-black font-mono">{m.letter}</span>
                          {m.name}
                          <span className="ml-1 font-black bg-white rounded-full px-1.5 py-0.5 text-[10px]"
                            style={{ color:m.color }}>{rowTotal(m.letter)}</span>
                        </span>
                      ))}
                      {/* Bubble scale legend (soft-coded) */}
                      {II_REGISTER_UI.visuals.bubbleMatrix && (() => {
                        const { bubbleMinPx, bubbleMaxPx } = II_REGISTER_UI.visuals;
                        const sample = [bubbleMinPx, Math.round((bubbleMinPx + bubbleMaxPx) / 2), bubbleMaxPx];
                        return (
                          <span className="inline-flex items-center gap-2 ml-2 pl-3 border-l border-slate-200 text-[10px] text-slate-400 font-medium">
                            Bubble size = count
                            <span className="inline-flex items-center gap-1">
                              {sample.map(sz => (
                                <span key={sz} className="rounded-full bg-slate-300/70 inline-block"
                                  style={{ width: Math.max(8, Math.round(sz * 0.45)), height: Math.max(8, Math.round(sz * 0.45)) }} />
                              ))}
                            </span>
                            fewer → more
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  {/* ── Matrix + Detail split ── */}
                  <div className="flex gap-4 items-start">

                    {/* Matrix table */}
                    <div className="flex-1 rounded-2xl overflow-hidden ii-section" style={{ minWidth:0, ...T_INST.cardEq }}>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-xs">
                          {/* Column headers */}
                          <thead>
                            <tr>
                              <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2.5 text-left font-bold text-gray-500 text-[10px] uppercase tracking-wider border-b border-r border-gray-200 whitespace-nowrap"
                                style={{ minWidth:'110px' }}>
                                Measured Variable
                              </th>
                              {activeFns.map(fn => (
                                <th key={fn.code}
                                  className="px-2 py-2.5 text-center font-bold text-gray-500 text-[10px] border-b border-gray-200 whitespace-nowrap"
                                  style={{ minWidth:'52px' }}>
                                  <div className="font-mono font-black text-gray-700">{fn.code}</div>
                                  <div className="text-[8px] text-gray-400 font-normal leading-tight mt-0.5">{fn.label}</div>
                                </th>
                              ))}
                              <th className="px-3 py-2.5 text-center font-bold text-gray-500 text-[10px] border-b border-l border-gray-200 whitespace-nowrap bg-gray-50">
                                Total
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {ISA_MEASURED.map((mv) => {
                              const total = rowTotal(mv.letter);
                              if (total === 0) return null;
                              return (
                                <tr key={mv.letter} className="group hover:bg-gray-50/70 transition-colors">
                                  {/* Row header */}
                                  <td className="sticky left-0 z-10 bg-white px-3 py-2.5 font-medium border-b border-r border-gray-100 group-hover:bg-gray-50/70"
                                      style={{ background:'inherit' }}>
                                    <div className="flex items-center gap-2">
                                      <span className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-black font-mono flex-shrink-0"
                                        style={{ background:mv.color }}>
                                        {mv.letter}
                                      </span>
                                      <div>
                                        <p className="font-bold text-gray-800 text-[11px] leading-none">{mv.name}</p>
                                      </div>
                                    </div>
                                  </td>
                                  {/* Data cells */}
                                  {activeFns.map(fn => {
                                    const items = matrix[mv.letter]?.[fn.code] || [];
                                    const cnt   = items.length;
                                    const isSelected = layoutSelected?.measured === mv.letter && layoutSelected?.fn === fn.code;
                                    const isHovered  = layoutHovered?.measured  === mv.letter && layoutHovered?.fn  === fn.code;
                                    // Heatmap: intensity proportional to count / maxCount
                                    const intensity  = cnt > 0 ? 0.12 + (cnt / maxCount) * 0.75 : 0;
                                    const cellBg     = cnt > 0
                                      ? `rgba(${mv.color === '#22c55e' ? '34,197,94'
                                               : mv.color === '#f97316' ? '249,115,22'
                                               : mv.color === '#ef4444' ? '239,68,68'
                                               : mv.color === '#eab308' ? '234,179,8'
                                               : mv.color === '#a855f7' ? '168,85,247'
                                               : mv.color === '#fb923c' ? '251,146,60'
                                               : mv.color === '#dc2626' ? '220,38,38'
                                               : mv.color === '#3b82f6' ? '59,130,246'
                                               : '148,163,184'},${intensity})`
                                      : 'transparent';

                                    return (
                                      <td key={fn.code}
                                        className={`px-1 py-2 text-center border-b border-gray-100 transition-all cursor-pointer ${
                                          cnt === 0 ? 'text-gray-200' : ''
                                        }`}
                                        style={{
                                          background: isSelected ? mv.color : isHovered && cnt > 0 ? `${mv.color}30` : cellBg,
                                          outline: isSelected ? `2px solid ${mv.color}` : undefined,
                                          outlineOffset: '-2px',
                                          borderRadius: isSelected ? '4px' : undefined,
                                        }}
                                        onClick={() => cnt > 0 && setLayoutSelected(
                                          isSelected ? null : { measured: mv.letter, fn: fn.code }
                                        )}
                                        onMouseEnter={() => cnt > 0 && setLayoutHovered({ measured: mv.letter, fn: fn.code })}
                                        onMouseLeave={() => setLayoutHovered(null)}>
                                        {cnt > 0 ? (
                                          II_REGISTER_UI.visuals.bubbleMatrix ? (() => {
                                            // Bubble size ∝ count (soft-coded range)
                                            const { bubbleMinPx, bubbleMaxPx } = II_REGISTER_UI.visuals;
                                            const size = Math.round(
                                              bubbleMinPx + (cnt / maxCount) * (bubbleMaxPx - bubbleMinPx)
                                            );
                                            return (
                                              <span
                                                className="inline-flex items-center justify-center rounded-full font-black text-white transition-transform duration-150"
                                                style={{
                                                  width: size, height: size,
                                                  fontSize: Math.max(9, Math.round(size * 0.32)),
                                                  background: `radial-gradient(circle at 30% 30%, ${mv.color}cc, ${mv.color})`,
                                                  boxShadow: isSelected
                                                    ? `0 0 0 3px #ffffff, 0 0 0 5px ${mv.color}, 0 4px 10px ${mv.color}66`
                                                    : `0 2px 6px ${mv.color}55`,
                                                  transform: isSelected ? 'scale(1.12)' : undefined,
                                                }}
                                                title={`${cnt} instrument${cnt === 1 ? '' : 's'} — click to inspect`}>
                                                {cnt}
                                              </span>
                                            );
                                          })()
                                          : (
                                          <span className={`font-black text-[11px] ${isSelected ? 'text-white' : ''}`}
                                            style={{ color: isSelected ? '#fff' : mv.color }}>
                                            {cnt}
                                          </span>
                                        )
                                        ) : (
                                          <span className="text-gray-100 text-[10px]">·</span>
                                        )}
                                      </td>
                                    );
                                  })}
                                  {/* Row total */}
                                  <td className="px-3 py-2 text-center border-b border-l border-gray-100 font-black text-[11px]"
                                    style={{ color:mv.color, background:`${mv.color}10` }}>
                                    {total}
                                  </td>
                                </tr>
                              );
                            })}
                            {/* Column totals row */}
                            <tr className="bg-gray-50 border-t-2 border-gray-200">
                              <td className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-[10px] font-black text-gray-500 uppercase tracking-wider border-r border-gray-200">
                                Total
                              </td>
                              {activeFns.map(fn => {
                                const colTotal = ISA_MEASURED.reduce((s,mv) => s + (matrix[mv.letter]?.[fn.code]||[]).length, 0);
                                return (
                                  <td key={fn.code} className="px-1 py-2 text-center font-black text-[11px] text-gray-600">
                                    {colTotal > 0 ? colTotal : '·'}
                                  </td>
                                );
                              })}
                              <td className="px-3 py-2 text-center font-black text-gray-800 border-l border-gray-200">
                                {totalInMatrix}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Detail drawer */}
                    <div style={{ width: selectedCell ? '320px' : '200px', flexShrink:0, transition:'width 0.22s ease' }}>
                      {selectedCell ? (
                        <div className="rounded-2xl overflow-hidden" style={{ maxHeight:'75vh', display:'flex', flexDirection:'column', ...T_INST.cardEq }}>
                          {/* Drawer header */}
                          <div className="px-4 py-3 flex items-center justify-between gap-2 border-b"
                            style={{ background: selectedMvDef ? selectedMvDef.light : '#f8fafc' }}>
                            <div>
                              <p className="text-sm font-black text-gray-900">
                                {selectedMvDef?.letter}{selectedFnDef?.code}
                                <span className="text-[11px] font-normal text-gray-500 ml-2">
                                  {selectedMvDef?.name} · {selectedFnDef?.label}
                                </span>
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {selectedCell.length} instrument{selectedCell.length!==1?'s':''}
                              </p>
                            </div>
                            <button
                              onClick={() => setLayoutSelected(null)}
                              className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none flex-shrink-0">
                              ×
                            </button>
                          </div>
                          {/* Tag list */}
                          <div className="overflow-y-auto flex-1 p-3 flex flex-col gap-2">
                            {selectedCell.map((inst, i) => {
                              const cs = categoryStyle(inst.category);
                              return (
                                <div key={i} className="rounded-xl border p-3 flex flex-col gap-1"
                                  style={{ borderColor: `${selectedMvDef?.color || '#94a3b8'}30`,
                                           background: selectedMvDef?.light || '#f8fafc' }}>
                                  <div className="flex items-center justify-between gap-2">
                                    <code className="text-sm font-black font-mono"
                                      style={{ color: selectedMvDef?.color || '#334155' }}>
                                      {inst.tag_number || '—'}
                                    </code>
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                      style={{ background:cs.bg, color:cs.text }}>
                                      {inst.category}
                                    </span>
                                  </div>
                                  {inst.instrument_type && (
                                    <p className="text-[10px] text-gray-600">{inst.instrument_type}</p>
                                  )}
                                  {inst.service_description && (
                                    <p className="text-[10px] text-gray-500 italic leading-snug">{inst.service_description}</p>
                                  )}
                                  <div className="flex flex-wrap gap-2 mt-1">
                                    {inst.line_number && (
                                      <span className="text-[9px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded border border-teal-100 font-mono">
                                        Line: {inst.line_number}
                                      </span>
                                    )}
                                    {inst.equipment_number && (
                                      <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100 font-mono">
                                        Equip: {inst.equipment_number}
                                      </span>
                                    )}
                                    {inst.set_point && (
                                      <span className="text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-100 font-mono">
                                        SP: {inst.set_point}
                                      </span>
                                    )}
                                    {inst.fail_safe && (
                                      <span className="text-[9px] bg-red-50 text-red-700 px-1.5 py-0.5 rounded border border-red-100">
                                        FS: {inst.fail_safe}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {/* Drawer footer */}
                          <div className="px-4 py-2 border-t bg-gray-50 flex items-center justify-between text-[9px] text-gray-400">
                            <span>{selectedCell.length} tag{selectedCell.length!==1?'s':''}</span>
                            <button
                              onClick={() => { setFilterCategory('All'); setFilterText(layoutSelected?.fn || ''); setActiveView('table'); }}
                              className="text-[9px] font-bold text-purple-600 hover:text-purple-800">
                              View in Table →
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl p-5 flex flex-col items-center text-center gap-3"
                          style={{ minHeight:'140px', ...T_INST.cardEq }}>
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                            style={{ background:'linear-gradient(135deg,#f5f3ff,#ede9fe)', border:'1px solid #c4b5fd' }}>
                            <span className="text-2xl">🔬</span>
                          </div>
                          <p className="text-xs font-bold text-gray-600">Click any cell</p>
                          <p className="text-[10px] text-gray-400 leading-snug">
                            Select a matrix cell to see the tag list for that instrument function
                          </p>
                        </div>
                      )}
                    </div>

                  </div>

                  {/* ── ISA Reference Quick Guide ── */}
                  <div className="rounded-2xl p-5 mt-4 ii-section" style={{ ...T_INST.cardEq, animationDelay: '0.05s' }}>
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">
                      ISA 5.1 Quick Reference — Instrument Identification Letters
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {/* Soft-coded: ISA 5.1 first-letter meanings */}
                      {[
                        { letter:'F', desc:'Flow (measurement)'                },
                        { letter:'P', desc:'Pressure (measurement)'            },
                        { letter:'T', desc:'Temperature (measurement)'         },
                        { letter:'L', desc:'Level (measurement)'               },
                        { letter:'A', desc:'Analysis / Composition'            },
                        { letter:'Z', desc:'Position, Dimension, Actuator'     },
                        { letter:'S', desc:'Speed, Frequency, Safety shutdown' },
                        { letter:'d', desc:'Differential (DP transmitter)'     },
                        { letter:'W', desc:'Weight, Force'                     },
                        { letter:'J', desc:'Power, Electrical'                 },
                      ].map(item => {
                        const mvDef = ISA_MEASURED.find(m => m.letter === item.letter);
                        return (
                          <div key={item.letter} className="flex items-start gap-2 p-2.5 rounded-lg border"
                            style={{ background: mvDef?.light || '#f8fafc', borderColor: `${mvDef?.color || '#94a3b8'}25` }}>
                            <span className="w-7 h-7 rounded-md flex items-center justify-center text-white text-sm font-black font-mono flex-shrink-0"
                              style={{ background: mvDef?.color || '#94a3b8' }}>
                              {item.letter}
                            </span>
                            <p className="text-[11px] text-gray-600 leading-snug">{item.desc}</p>
                          </div>
                        );
                      })}
                    </div>
                    {/* Function letter quick reference */}
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Function Suffix</p>
                      <div className="flex flex-wrap gap-2">
                        {/* Soft-coded: ISA 5.1 second-letter function meanings */}
                        {[
                          ['T','Transmitter'], ['I','Indicator'], ['C','Controller'], ['V','Valve'],
                          ['S','Switch'],      ['E','Element'],   ['G','Gauge'],     ['R','Recorder'],
                          ['A','Alarm'],       ['Y','Relay/Compute'], ['H','High'],  ['L','Low'],
                        ].map(([code, desc]) => (
                          <span key={code}
                            className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-gray-200 bg-gray-50 text-gray-600">
                            <code className="font-mono font-black text-indigo-600">{code}</code>
                            <span>{desc}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        )}

        {/* ── Help panel (empty state) ─────────────────────────────────── */}
        {!result && !isProcessing && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-6 mt-4">
            <h3 className="text-lg font-semibold text-purple-900 mb-3">
              ℹ️ About Instrument Index Extraction
            </h3>
            <ul className="space-y-2 text-purple-800 text-sm">
              {[
                ['P&ID Upload Only', 'Upload the P&ID in PDF format — single page or multi-page drawings.'],
                ['All Instrument Types', 'Extracts Flow (FIT, FI), Pressure (PIT, PI, PSV), Temperature (TI, TIT), Level (LIT, LG), Differential Pressure (DPIT), Shutdown Valves (SDV, BDV), Motor Valves (MOV), Restriction Orifices (RO), and more.'],
                ['Tag Number Recognition', 'Values inside instrument circles/bubbles are automatically read — e.g. FIT-3901-08A, PIT-3901-01, SDV-3601-01.'],
                ['Category Colour Coding', 'Each instrument category has its own colour for quick visual scanning in the table and Excel export.'],
                ['Excel Export', 'Two-sheet workbook: Instrument Index (all tags) + Summary (category counts).'],
                ...INST_RELATED_TOOLS.filter(t => t.showCapability).map(t => t.capability),
              ].map(([title, desc]) => (
                <li key={title} className="flex items-start gap-2">
                  <span className="font-bold text-purple-600 mt-0.5">•</span>
                  <span><strong>{title}:</strong> {desc}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

      </div>

      {/* ── Project Manager Modal ─────────────────────────────────────── */}
      <ProjectManagerModal
        open={projectManagerOpen}
        onClose={() => setProjectManagerOpen(false)}
        projects={projects}
        activeId={activeId}
        setActiveId={setActiveId}
        upsertProject={upsertProject}
        archiveProject={archiveProject}
        restoreProject={restoreProject}
        deleteProject={deleteProject}
        initialView={pmInitialView}
        initialCategory={pmInitialCategory}
      />

      {/* ── Edit Instrument Row Modal ─────────────────────────────────── */}
      <EditInstrumentModal
        open={!!editingRow}
        draft={editingRow?.draft}
        fields={
          (getInstrumentTemplate(activeProject?.category)?.editableFields) || []
        }
        onChange={(next) => setEditingRow(prev => prev ? { ...prev, draft: next } : prev)}
        onClose={() => setEditingRow(null)}
        onSave={handleSaveEditedRow}
      />

      {/* ── Shared Legend Sheets modal (bridged by project NAME) ── */}
      <LegendSheetsModal
        open={legendModalOpen}
        onClose={() => setLegendModalOpen(false)}
        section="instrument_index"
      />
    </InstBg>
  );
};

export default InstrumentIndex;
