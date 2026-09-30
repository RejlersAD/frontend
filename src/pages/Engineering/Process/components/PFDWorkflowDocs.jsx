/**
 * PFDWorkflowDocs.jsx — Workflow diagram + Documentation panel for the
 * PFD Quality Checker, mirroring the design language of
 * PIDVerification.jsx (P&ID Verification V1):
 *   • Collapsible workflow diagram card (soft-coded image path, zoom, loader)
 *   • Tabbed documentation panel: Quick Start (5 accordion steps), Quality
 *     Rules, Best Practices, FAQ, File Formats
 *
 * SOFT-CODED: every visual value & content block lives in the config objects
 * below — edit text/colours/tabs without touching the JSX structure.
 * Set PFD_DOCS_CONFIG.enabled = false to hide the whole section.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader, AlertTriangle, ChevronDown, ChevronUp, BookOpen,
  PlayCircle, List, Star, HelpCircle, FileCheck, Maximize2, Minimize2,
  FolderPlus, Upload as UploadIcon, Brain, Eye, Download, CheckCircle,
  ExternalLink,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// SOFT-CODED CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
export const PFD_DOCS_CONFIG = {
  enabled: true,                      // master switch — false hides everything

  // ── Split-screen layout (mirrors P&ID Verification V1) ────────────────────
  splitScreen: {
    enabled:            true,         // false → stacked vertical layout
    workflowWidthPct:   45,           // left column width
    docsWidthPct:       55,           // right column width
    gap:                '20px',
    responsiveMinWidth: 1024,         // px — stacks below this viewport width
  },

  // ── Workflow diagram ──────────────────────────────────────────────────────
  workflow: {
    // SOFT-CODED: PFD Quality Workflow card removed — flip to true to restore.
    enabled:       false,
    imagePath:     '/assets/images/PFD_Workflow.png',  // drop the asset in frontend/public/assets/images/
    title:         'PFD Quality Workflow',
    altText:       'PFD Quality Workflow — 3 Stage Process: Upload Drawing, Rule Engine Scan, Quality Report',
    collapsible:   true,
    defaultCollapsed: false,
    maxZoomPct:    200,
    zoomStepPct:   25,
  },

  // ── PFD Verification Workflow (reuses V1 artwork) ─────────────────────────
  pidWorkflow: {
    enabled:       true,
    imagePath:     '/assets/images/P&ID_Final.png',    // same diagram used on P&ID Verification V1
    title:         'PFD Verification Workflow',
    altText:       'PFD Verification Workflow — 3 Stage Process: Upload Documents, AI Analysis, Quality Report',
    badge:         'Cross-Tool',
    description:   'The same proven pipeline that powers P&ID Verification V1 — PFD quality runs through an identical Upload → AI Analysis → Quality Report journey.',
    linkLabel:     'Open P&ID Verification',
    linkRoute:     '/engineering/process/pid-verification-v1',
    collapsible:   true,
    defaultCollapsed: false,
    maxZoomPct:    200,
    zoomStepPct:   25,
  },

  // ── Smart Documentation panel ─────────────────────────────────────────────
  docs: {
    enabled:          true,
    title:            'Smart Documentation',
    subtitle:         'Everything you need to run a standards-compliant PFD quality review',
    collapsible:      true,
    defaultCollapsed: false,
    defaultTab:       'quickstart',
  },
};

// ── Tab definitions (order = render order). Add/remove tabs here. ───────────
const DOC_TABS = [
  { id: 'quickstart', label: 'Quick Start',    Icon: PlayCircle, color: '#3b82f6' },
  { id: 'rules',      label: 'Quality Rules',  Icon: List,       color: '#8b5cf6' },
  { id: 'practices',  label: 'Best Practices', Icon: Star,       color: '#f59e0b' },
  { id: 'faq',        label: 'FAQ',            Icon: HelpCircle, color: '#10b981' },
  { id: 'formats',    label: 'File Formats',   Icon: FileCheck,  color: '#6366f1' },
];

// ── Quick Start: 5 accordion steps (mirrors V1 structure, PFD content) ──────
const QUICK_START_STEPS = [
  {
    key: 'step1', num: 1, title: 'Create Project', color: '#3b82f6', Icon: FolderPlus,
    tagline: 'Organise drawings by plant, unit or client deliverable',
    bullets: [
      'Click "New Project" on the dashboard and give it a meaningful name (e.g. "ADNOC Trunkline PFD Review").',
      'Add an optional description so teammates know the scope at a glance.',
      'Each project keeps its own drawings, findings history and export reports.',
      'You can rename or delete a project at any time from its card actions.',
    ],
  },
  {
    key: 'step2', num: 2, title: 'Upload PFD', color: '#8b5cf6', Icon: UploadIcon,
    tagline: 'Critical step for accurate rule-engine analysis',
    bullets: [
      'Open your project and drag & drop the PFD into the upload zone (PDF, PNG, JPG, TIFF).',
      'Use native / vector PDFs whenever possible — OCR accuracy is highest on clean exports.',
      'Scanned drawings work too; aim for ≥ 300 DPI and an upright, unskewed page.',
      'One drawing per upload — multi-sheet PFD sets should be uploaded sheet by sheet.',
    ],
  },
  {
    key: 'step3', num: 3, title: 'AI + Rule Engine Scan', color: '#f59e0b', Icon: Brain,
    tagline: '12 deterministic rules, zero guesswork',
    bullets: [
      'Click "Run Quality Check" — the engine OCRs the drawing and resolves every text entity.',
      '12 rules execute against equipment tags, stream numbers, title block, safety devices & more.',
      'Watch the live stage indicator; a typical A0 PFD completes in under a minute.',
      'No data leaves your environment — processing is fully server-side.',
    ],
  },
  {
    key: 'step4', num: 4, title: 'Review Results', color: '#10b981', Icon: Eye,
    tagline: 'Findings ranked by severity with on-drawing markers',
    bullets: [
      'Findings are grouped by category and colour-coded: Critical → Major → Minor → Info.',
      'Click any finding to jump to its overlay marker directly on the drawing.',
      'Use the per-category filters to focus on one discipline at a time.',
      'Mark false positives — your corrections calibrate placement for the next run.',
    ],
  },
  {
    key: 'step5', num: 5, title: 'Export Report', color: '#6366f1', Icon: Download,
    tagline: 'Professional deliverables in one click',
    bullets: [
      'Export a full PDF report with severity summary, findings table and drawing snapshots.',
      'Excel export gives you a filterable findings register for action tracking.',
      'Reports carry project name, drawing revision and run timestamp for audit trails.',
      'Re-run after revisions — each run is versioned so progress is measurable.',
    ],
  },
];

// ── Quality Rules tab content (the 12 deterministic rules) ──────────────────
const QUALITY_RULES = [
  { id: 'EQ-01', name: 'Equipment Tag Presence',    desc: 'Every equipment symbol must carry a readable tag (E-101, P-301, V-201 …).',        sev: 'critical' },
  { id: 'EQ-02', name: 'Equipment Tag Format',      desc: 'Tags must follow the project naming convention — letter code + sequence number.',   sev: 'major'    },
  { id: 'ST-01', name: 'Stream Number Coverage',    desc: 'All process streams between equipment must be numbered.',                         sev: 'critical' },
  { id: 'ST-02', name: 'Stream Number Continuity',  desc: 'Stream numbers must be unique and follow a continuous sequence across sheets.',     sev: 'major'    },
  { id: 'TB-01', name: 'Title Block Completeness',  desc: 'Title block must include drawing number, revision, scale, date and approvals.',     sev: 'major'    },
  { id: 'TB-02', name: 'Revision Consistency',      desc: 'Revision letter/number in the title block must match the revision table.',          sev: 'minor'    },
  { id: 'SF-01', name: 'Safety Device Placement',   desc: 'PRVs / BDVs must be shown on protected equipment with set pressures.',              sev: 'critical' },
  { id: 'CE-01', name: 'Control Elements Shown',    desc: 'Control valves and key instruments must appear on their process streams.',          sev: 'major'    },
  { id: 'UT-01', name: 'Utility Headers Labelled',  desc: 'Utility supply/return lines must carry service codes (CW, ST, N2, FG …).',          sev: 'minor'    },
  { id: 'NT-01', name: 'HOLD & Notes Flagged',      desc: 'HOLD notations and unresolved notes are surfaced for engineer decision.',           sev: 'info'     },
  { id: 'XR-01', name: 'Cross-Reference Integrity', desc: 'Continuation arrows must reference valid sheets / stream numbers.',                 sev: 'major'    },
  { id: 'ISO-01', name: 'ISO 10628 Compliance',     desc: 'Symbol usage and flow scheme layout checked against ISO 10628-1/-2 patterns.',      sev: 'major'    },
];

// ── Best Practices tab ───────────────────────────────────────────────────────
const BEST_PRACTICES = [
  { title: 'Prefer vector PDFs',            desc: 'Export PFDs directly from the authoring tool. Vector text eliminates OCR ambiguity almost entirely.' },
  { title: 'One sheet per upload',          desc: 'Run each PFD sheet separately so overlay markers and exports map 1:1 to the drawing.' },
  { title: 'Fix Criticals first',           desc: 'Critical findings (missing tags, streams, safety devices) block design reviews — clear them before Minor/Info.' },
  { title: 'Mark false positives',          desc: 'Your corrections feed the calibration store and measurably improve the next run on similar drawings.' },
  { title: 'Re-run on every revision',      desc: 'Quality is a trend, not an event. Each run is versioned so you can prove improvement to QA.' },
  { title: 'Pair with P&ID Verification',   desc: 'Once the PFD passes, carry the same project into P&ID Verification for the detailed-engineering check.' },
];

// ── FAQ tab ──────────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  { q: 'Which PFD standards are checked?',            a: 'The rule set is derived from ISO 10628-1/-2 flow-scheme conventions, with project naming rules configurable per deployment.' },
  { q: 'Does it work on scanned / hand-marked PFDs?', a: 'Yes — OCR handles raster input. For best results scan at ≥ 300 DPI, upright and unskewed. Vector PDFs remain the gold standard.' },
  { q: 'Will it modify my drawing?',                  a: 'Never. The checker is read-only: it produces a findings list, overlay markers and exportable reports. Your source file is untouched.' },
  { q: 'How long does a run take?',                   a: 'Typically 15–60 seconds for an A0 PFD, depending on text density and server load.' },
  { q: 'Can I export the findings?',                  a: 'Yes — PDF report (summary + findings + snapshots) and Excel register (filterable, action-tracking ready).' },
  { q: 'Is my data sent to an external AI?',          a: 'No. OCR and all 12 rules run server-side inside your RAD AI deployment.' },
];

// ── File Formats tab ─────────────────────────────────────────────────────────
const FILE_FORMATS = [
  { ext: 'PDF',  quality: 'Excellent', note: 'Preferred. Native/vector PDFs give near-perfect text extraction.', ok: true  },
  { ext: 'PNG',  quality: 'Good',      note: 'Raster — use ≥ 300 DPI exports for reliable OCR.',                   ok: true  },
  { ext: 'JPG',  quality: 'Good',      note: 'Acceptable; avoid heavy compression artefacts around thin lines.',   ok: true  },
  { ext: 'TIFF', quality: 'Good',      note: 'Lossless raster, ideal for scanned legacy drawings.',                ok: true  },
  { ext: 'DWG',  quality: 'Unsupported', note: 'Export to PDF from the CAD package first.',                        ok: false },
];

// Severity chip colours (aligned with PFDQualityChecker SEVERITY_STYLES)
const SEV_CHIP = {
  critical: { bg: '#fef2f2', border: '#fca5a5', text: '#b91c1c' },
  major:    { bg: '#fff7ed', border: '#fdba74', text: '#c2410c' },
  minor:    { bg: '#fffbeb', border: '#fcd34d', text: '#a16207' },
  info:     { bg: '#f0fdf4', border: '#86efac', text: '#15803d' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Workflow diagram card with loading / error / zoom states (V1 pattern).
 *  Optional cfg extras: badge, description, linkLabel, linkRoute. */
const WorkflowDiagram = ({ cfg }) => {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(cfg.defaultCollapsed);
  const [zoom, setZoom]           = useState(100);
  const [loaded, setLoaded]       = useState(false);
  const [error, setError]         = useState(false);

  return (
    <div style={{
      background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: '16px',
    }}>
      {/* Header bar — dark gradient, identical to V1's workflow card header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 20px',
        borderBottom: collapsed ? 'none' : '1px solid #e2e8f0',
        background: 'linear-gradient(135deg, rgba(15,23,42,0.97) 0%, rgba(30,41,59,0.95) 100%)',
        cursor: cfg.collapsible ? 'pointer' : 'default',
      }}
      onClick={() => cfg.collapsible && setCollapsed(c => !c)}
      >
        <div style={{
          width: '30px', height: '30px', borderRadius: '9px', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
          boxShadow: '0 3px 10px rgba(59,130,246,0.45)',
        }}>
          <BookOpen style={{ width: '15px', height: '15px', color: '#fff' }} />
        </div>
        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f1f5f9' }}>{cfg.title}</span>
        {cfg.badge && (
          <span style={{
            fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
            padding: '3px 9px', borderRadius: '999px',
            background: 'linear-gradient(135deg,#8b5cf6,#6366f1)', color: '#fff',
            boxShadow: '0 2px 8px rgba(139,92,246,0.45)',
          }}>{cfg.badge}</span>
        )}
        {cfg.linkRoute && (
          <button onClick={(e) => { e.stopPropagation(); navigate(cfg.linkRoute); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '5px 12px', borderRadius: '8px', border: '1px solid rgba(129,140,248,0.4)',
              background: 'rgba(99,102,241,0.18)', color: '#c7d2fe',
              fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', transition: 'all 200ms ease',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.32)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,102,241,0.18)'}>
            <ExternalLink style={{ width: '12px', height: '12px' }} />{cfg.linkLabel || 'Open'}
          </button>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
          {!collapsed && (
            <button
              onClick={() => setZoom(z => (z >= cfg.maxZoomPct ? 100 : Math.min(cfg.maxZoomPct, z + cfg.zoomStepPct)))}
              title="Zoom"
              style={iconBtnStyleDark}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(148,163,184,0.25)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(148,163,184,0.12)'}
            >
              {zoom >= cfg.maxZoomPct
                ? <Minimize2 style={{ width: '14px', height: '14px' }} />
                : <Maximize2 style={{ width: '14px', height: '14px' }} />}
            </button>
          )}
          {cfg.collapsible && (
            <button onClick={(e) => { e.stopPropagation(); setCollapsed(c => !c); }} title={collapsed ? 'Expand' : 'Collapse'}
              style={iconBtnStyleDark}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(148,163,184,0.25)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(148,163,184,0.12)'}>
              {collapsed ? <ChevronDown style={{ width: '14px', height: '14px' }} />
                         : <ChevronUp   style={{ width: '14px', height: '14px' }} />}
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {cfg.description && (
            <p style={{
              fontSize: '0.8rem', color: '#64748b', lineHeight: 1.6, maxWidth: '860px',
              margin: '0 auto 14px', textAlign: 'center',
            }}>{cfg.description}</p>
          )}
          <div style={{
            width: '95%', maxWidth: '1400px', margin: '0 auto', borderRadius: '12px',
            overflow: zoom === 100 ? 'hidden' : 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)', background: 'white',
            border: '2px solid rgba(59,130,246,0.2)', position: 'relative',
            transition: 'all 300ms ease',
          }}>
            {!loaded && !error && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                justifyContent: 'center', zIndex: 10, minHeight: '180px',
                background: 'linear-gradient(135deg, rgba(59,130,246,0.05) 0%, rgba(99,102,241,0.05) 100%)',
              }}>
                <div style={{ textAlign: 'center' }}>
                  <Loader style={{ width: '32px', height: '32px', color: '#3b82f6', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                  <p style={{ marginTop: '12px', fontSize: '13px', color: '#64748b' }}>Loading workflow diagram…</p>
                </div>
              </div>
            )}
            {error && (
              <div style={{
                padding: '36px 20px', textAlign: 'center',
                background: 'linear-gradient(135deg, rgba(59,130,246,0.04) 0%, rgba(99,102,241,0.04) 100%)',
              }}>
                <AlertTriangle style={{ width: '40px', height: '40px', color: '#f59e0b', margin: '0 auto' }} />
                <h3 style={{ marginTop: '12px', fontSize: '15px', color: '#0f172a', fontWeight: 700 }}>Workflow diagram not yet uploaded</h3>
                <p style={{ marginTop: '6px', fontSize: '12.5px', color: '#64748b' }}>
                  Drop the artwork at <code style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>{cfg.imagePath}</code> — this card updates automatically.
                </p>
              </div>
            )}
            <img
              src={cfg.imagePath}
              alt={cfg.altText}
              onLoad={() => { setLoaded(true); setError(false); }}
              onError={() => { setError(true); setLoaded(false); }}
              style={{
                width: `${zoom}%`, height: 'auto', display: error ? 'none' : 'block',
                margin: '0 auto', transition: 'transform 300ms ease',
                cursor: zoom < cfg.maxZoomPct ? 'zoom-in' : 'default', minHeight: error ? 0 : '200px',
              }}
              onClick={() => { if (zoom < cfg.maxZoomPct) setZoom(Math.min(cfg.maxZoomPct, zoom + cfg.zoomStepPct)); }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const iconBtnStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: '26px', height: '26px', borderRadius: '7px',
  border: '1px solid rgba(59,130,246,0.25)', background: 'rgba(59,130,246,0.06)',
  color: '#3b82f6', cursor: 'pointer', transition: 'all 200ms ease',
};

// Dark-header variant (workflow card header sits on a dark slate gradient)
const iconBtnStyleDark = {
  ...iconBtnStyle,
  border: '1px solid rgba(148,163,184,0.35)', background: 'rgba(148,163,184,0.12)',
  color: '#cbd5e1',
};

/** Single accordion step in Quick Start (V1 pattern). */
const StepAccordion = ({ step, expanded, onToggle }) => (
  <div style={{
    marginBottom: '14px', border: `2px solid ${step.color}33`,
    borderRadius: '14px', overflow: 'hidden',
    background: expanded ? `${step.color}08` : '#ffffff',
    transition: 'all 250ms ease',
  }}>
    <button onClick={onToggle} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
      padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
      borderBottom: expanded ? `1px solid ${step.color}33` : 'none', textAlign: 'left',
    }}>
      <div style={{
        width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `linear-gradient(135deg, ${step.color}, ${step.color}cc)`,
        boxShadow: `0 4px 12px ${step.color}44`,
      }}>
        <step.Icon style={{ width: '17px', height: '17px', color: '#fff' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
          Step {step.num}: {step.title}
        </div>
        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '1px' }}>{step.tagline}</div>
      </div>
      {expanded
        ? <ChevronUp   style={{ width: '16px', height: '16px', color: step.color, flexShrink: 0 }} />
        : <ChevronDown style={{ width: '16px', height: '16px', color: '#94a3b8', flexShrink: 0 }} />}
    </button>
    {expanded && (
      <div style={{ padding: '12px 16px 14px 64px' }}>
        {step.bullets.map((b, i) => (
          <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '7px' }}>
            <CheckCircle style={{ width: '13px', height: '13px', color: step.color, flexShrink: 0, marginTop: '2px' }} />
            <span style={{ fontSize: '0.8rem', color: '#334155', lineHeight: 1.55 }}>{b}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

/** Tab content renderers — one per DOC_TABS id. */
const TabContent = ({ tab }) => {
  const [expandedSteps, setExpandedSteps] = useState({ step1: true });
  const [openFaq, setOpenFaq] = useState({ 0: true });

  if (tab === 'quickstart') {
    const allOpen  = QUICK_START_STEPS.every(s => expandedSteps[s.key]);
    return (
      <div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setExpandedSteps(Object.fromEntries(QUICK_START_STEPS.map(s => [s.key, !allOpen])))}
            style={{
              padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px',
              border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.06)',
              color: '#3b82f6', cursor: 'pointer', display: 'flex', alignItems: 'center',
              gap: '4px', fontWeight: 500, transition: 'all 200ms ease',
            }}>
            {allOpen
              ? <><ChevronUp style={{ width: '14px', height: '14px' }} /> Collapse All</>
              : <><ChevronDown style={{ width: '14px', height: '14px' }} /> Expand All</>}
          </button>
        </div>
        {QUICK_START_STEPS.map(step => (
          <StepAccordion key={step.key} step={step}
            expanded={!!expandedSteps[step.key]}
            onToggle={() => setExpandedSteps(p => ({ ...p, [step.key]: !p[step.key] }))} />
        ))}
      </div>
    );
  }

  if (tab === 'rules') {
    return (
      <div>
        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '14px', lineHeight: 1.55 }}>
          The engine runs <strong style={{ color: '#0f172a' }}>12 deterministic rules</strong> on every drawing.
          Severity legend: <strong style={{ color: SEV_CHIP.critical.text }}>Critical</strong> blocks review,{' '}
          <strong style={{ color: SEV_CHIP.major.text }}>Major</strong> needs action,{' '}
          <strong style={{ color: SEV_CHIP.minor.text }}>Minor</strong> is advisory,{' '}
          <strong style={{ color: SEV_CHIP.info.text }}>Info</strong> is observational.
        </p>
        {QUALITY_RULES.map(r => {
          const c = SEV_CHIP[r.sev];
          return (
            <div key={r.id} style={{
              display: 'flex', gap: '12px', alignItems: 'flex-start',
              padding: '11px 14px', marginBottom: '8px', borderRadius: '10px',
              background: '#ffffff', border: '1px solid #e2e8f0',
            }}>
              <span style={{
                fontSize: '0.68rem', fontWeight: 800, fontFamily: 'monospace',
                padding: '3px 8px', borderRadius: '6px', flexShrink: 0, marginTop: '1px',
                background: 'rgba(59,130,246,0.08)', color: '#3b82f6',
                border: '1px solid rgba(59,130,246,0.25)',
              }}>{r.id}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>{r.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px', lineHeight: 1.5 }}>{r.desc}</div>
              </div>
              <span style={{
                fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                padding: '3px 8px', borderRadius: '999px', flexShrink: 0,
                background: c.bg, color: c.text, border: `1px solid ${c.border}`,
              }}>{r.sev}</span>
            </div>
          );
        })}
      </div>
    );
  }

  if (tab === 'practices') {
    return (
      <div>
        {BEST_PRACTICES.map((p, i) => (
          <div key={i} style={{
            display: 'flex', gap: '12px', padding: '12px 14px', marginBottom: '9px',
            borderRadius: '10px', background: 'linear-gradient(135deg, rgba(245,158,11,0.05), rgba(245,158,11,0.02))',
            border: '1px solid rgba(245,158,11,0.2)',
          }}>
            <Star style={{ width: '15px', height: '15px', color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>{p.title}</div>
              <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px', lineHeight: 1.55 }}>{p.desc}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tab === 'faq') {
    return (
      <div>
        {FAQ_ITEMS.map((f, i) => (
          <div key={i} style={{
            marginBottom: '8px', borderRadius: '10px', overflow: 'hidden',
            border: '1px solid #e2e8f0', background: '#ffffff',
          }}>
            <button
              onClick={() => setOpenFaq(p => ({ ...p, [i]: !p[i] }))}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                padding: '12px 14px', background: 'transparent', border: 'none',
                cursor: 'pointer', textAlign: 'left',
              }}>
              <HelpCircle style={{ width: '15px', height: '15px', color: '#10b981', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>{f.q}</span>
              {openFaq[i]
                ? <ChevronUp style={{ width: '14px', height: '14px', color: '#10b981', flexShrink: 0 }} />
                : <ChevronDown style={{ width: '14px', height: '14px', color: '#94a3b8', flexShrink: 0 }} />}
            </button>
            {openFaq[i] && (
              <div style={{ padding: '0 14px 12px 39px', fontSize: '0.78rem', color: '#475569', lineHeight: 1.6 }}>
                {f.a}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (tab === 'formats') {
    return (
      <div>
        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '14px', lineHeight: 1.55 }}>
          Accepted upload formats and the extraction quality you can expect from each.
        </p>
        {FILE_FORMATS.map(f => (
          <div key={f.ext} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '11px 14px', marginBottom: '8px', borderRadius: '10px',
            background: f.ok ? '#ffffff' : '#fafafa',
            border: `1px solid ${f.ok ? '#e2e8f0' : '#fecaca'}`,
            opacity: f.ok ? 1 : 0.75,
          }}>
            <span style={{
              fontSize: '0.72rem', fontWeight: 800, fontFamily: 'monospace',
              padding: '4px 10px', borderRadius: '7px', flexShrink: 0,
              background: f.ok ? 'rgba(99,102,241,0.08)' : 'rgba(239,68,68,0.08)',
              color: f.ok ? '#6366f1' : '#ef4444',
              border: `1px solid ${f.ok ? 'rgba(99,102,241,0.25)' : 'rgba(239,68,68,0.25)'}`,
            }}>.{f.ext.toLowerCase()}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.5 }}>{f.note}</div>
            </div>
            <span style={{
              fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', flexShrink: 0,
              letterSpacing: '0.06em', padding: '3px 8px', borderRadius: '999px',
              background: f.ok ? '#f0fdf4' : '#fef2f2',
              color: f.ok ? '#15803d' : '#b91c1c',
              border: `1px solid ${f.ok ? '#86efac' : '#fca5a5'}`,
            }}>{f.quality}</span>
          </div>
        ))}
      </div>
    );
  }

  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Main export — V1 split-screen: workflow diagram (left) + Smart Documentation (right)
// ─────────────────────────────────────────────────────────────────────────────
const PFDWorkflowDocs = ({ projectCount = 0 }) => {
  const cfg = PFD_DOCS_CONFIG;
  const [docCollapsed, setDocCollapsed] = useState(cfg.docs.defaultCollapsed);
  const [activeTab, setActiveTab]       = useState(cfg.docs.defaultTab);

  if (!cfg.enabled) return null;

  // Which workflow config feeds the left column (pidWorkflow preferred; legacy 'workflow' fallback)
  const wfCfg = cfg.pidWorkflow?.enabled ? cfg.pidWorkflow
              : cfg.workflow?.enabled    ? cfg.workflow : null;

  // Dynamic subtitle — mirrors V1's project-aware subtitle
  const docsSubtitle = projectCount === 0
    ? 'Get started with your first PFD quality review'
    : `${projectCount} project${projectCount === 1 ? '' : 's'} • AI-powered quality analysis`;

  const docsPanel = cfg.docs.enabled && (
    <div style={{
      background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      maxHeight: cfg.splitScreen.enabled ? '600px' : undefined,
    }}>
      {/* Header — gradient identical to V1's documentation header */}
      <div style={{
        padding: '14px 20px',
        borderBottom: docCollapsed ? 'none' : '1px solid #e2e8f0',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.03) 0%, rgba(59,130,246,0.06) 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '9px', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
            boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
          }}>
            <BookOpen style={{ width: '16px', height: '16px', color: '#fff' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>{cfg.docs.title}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{docsSubtitle}</div>
          </div>
          {cfg.docs.collapsible && (
            <button onClick={() => setDocCollapsed(c => !c)}
              style={iconBtnStyle}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.12)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(59,130,246,0.06)'}>
              {docCollapsed ? <ChevronDown style={{ width: '14px', height: '14px' }} />
                            : <ChevronUp   style={{ width: '14px', height: '14px' }} />}
            </button>
          )}
        </div>

        {/* Tab bar */}
        {!docCollapsed && (
          <div style={{ display: 'flex', gap: '4px', marginTop: '12px', flexWrap: 'wrap' }}>
            {DOC_TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', borderRadius: '10px', border: 'none',
                  background: activeTab === tab.id ? 'rgba(59,130,246,0.12)' : 'transparent',
                  color: activeTab === tab.id ? tab.color : '#64748b',
                  fontSize: '0.8rem', fontWeight: activeTab === tab.id ? 600 : 500,
                  cursor: 'pointer', transition: 'all 200ms ease', whiteSpace: 'nowrap',
                  borderBottom: activeTab === tab.id ? `2px solid ${tab.color}` : '2px solid transparent',
                }}
                onMouseEnter={e => { if (activeTab !== tab.id) e.currentTarget.style.background = 'rgba(148,163,184,0.08)'; }}
                onMouseLeave={e => { if (activeTab !== tab.id) e.currentTarget.style.background = 'transparent'; }}>
                <tab.Icon style={{ width: '14px', height: '14px' }} />
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {!docCollapsed && (
        <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
          <TabContent tab={activeTab} />
        </div>
      )}
    </div>
  );

  // ── Split-screen layout (V1): workflow LEFT, Smart Documentation RIGHT ──
  if (cfg.splitScreen.enabled && wfCfg) {
    return (
      <div className="pfdq-workflow-split" style={{
        display: 'grid',
        gridTemplateColumns: `${cfg.splitScreen.workflowWidthPct}% ${cfg.splitScreen.docsWidthPct}%`,
        gap: cfg.splitScreen.gap,
        marginBottom: '40px',
        animation: 'fadeUp 0.5s ease-out 0.2s both',
      }}>
        {/* Responsive: stack below breakpoint (mirrors V1's SPLIT_SCREEN_MIN_WIDTH) */}
        <style>{`@media (max-width: ${cfg.splitScreen.responsiveMinWidth - 1}px) {
          .pfdq-workflow-split { display: block !important; grid-template-columns: 1fr !important; }
          .pfdq-workflow-split > * { margin-bottom: 16px; }
        }`}</style>
        <div>{wfCfg && <WorkflowDiagram cfg={wfCfg} />}</div>
        {docsPanel}
      </div>
    );
  }

  // ── Stacked fallback ──
  return (
    <div style={{ marginTop: '8px' }}>
      {wfCfg && <WorkflowDiagram cfg={wfCfg} />}
      {docsPanel}
    </div>
  );
};

export default PFDWorkflowDocs;
