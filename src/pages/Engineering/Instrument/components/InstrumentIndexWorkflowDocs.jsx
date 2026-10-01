/**
 * InstrumentIndexWorkflowDocs.jsx — "Instrument Index Workflow" diagram +
 * "Smart Documentation" panel for the Instrument Index page, mirroring the
 * shared engineering design language (identical structure to
 * LineListWorkflowDocs / HMBWorkflowDocs / ValveMTOWorkflowDocs).
 *
 *   LEFT  — collapsible workflow diagram card (soft-coded image path, zoom)
 *   RIGHT — "Smart Documentation" tabbed panel: Quick Start (accordion
 *           steps), Categories, Best Practices, FAQ, File Formats
 *
 * SOFT-CODED: all content, colours and layout live in INST_DOCS_CONFIG below —
 * edit text/tabs/steps without touching JSX. Set enabled:false to hide.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader, AlertTriangle, ChevronDown, ChevronUp, BookOpen,
  PlayCircle, Tag, Star, HelpCircle, FileCheck, Maximize2, Minimize2,
  Upload as UploadIcon, Brain, Eye, Download, CheckCircle,
  ExternalLink, Cpu, FolderPlus,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// SOFT-CODED CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
export const INST_DOCS_CONFIG = {
  enabled: true,                        // master switch — false hides everything

  // ── Split-screen layout (mirrors P&ID Verification V1) ────────────────────
  splitScreen: {
    enabled:            true,
    workflowWidthPct:   45,
    docsWidthPct:       55,
    gap:                '20px',
    responsiveMinWidth: 1024,
    panelHeight:        '600px',        // both panels share this height
  },

  // ── Workflow diagram ──────────────────────────────────────────────────────
  workflow: {
    enabled:       true,
    imagePath:     '/assets/images/InstrumentIndex_Workflow.png',  // drop asset in frontend/public/assets/images/
    title:         'Instrument Index Workflow',
    altText:       'Instrument Index Workflow — upload P&ID, AI vision multi-pass scan, instrument index table, Excel export',
    badge:         'ISA 5.1',
    description:   'Extract every instrument tag from any P&ID with AI Vision: upload the drawing, run the multi-pass scan, review the categorised index, then export a two-sheet Excel workbook.',
    linkLabel:     'Open Legend Manager',
    linkRoute:     '/engineering/legends',
    collapsible:   true,
    defaultCollapsed: false,
    maxZoomPct:    200,
    zoomStepPct:   25,
    bareFrame:     true,
  },

  // ── Smart Documentation panel ─────────────────────────────────────────────
  docs: {
    enabled:          true,
    title:            'Smart Documentation',
    subtitle:         'Everything you need to produce a complete, standards-aligned instrument index',
    collapsible:      true,
    defaultCollapsed: false,
    defaultTab:       'quickstart',
  },
};

// ── Tab definitions (order = render order) ──────────────────────────────────
const DOC_TABS = [
  { id: 'quickstart', label: 'Quick Start',     Icon: PlayCircle, color: '#3b82f6' },
  { id: 'categories', label: 'Categories',      Icon: Tag,        color: '#8b5cf6' },
  { id: 'practices',  label: 'Best Practices',  Icon: Star,       color: '#f59e0b' },
  { id: 'faq',        label: 'FAQ',             Icon: HelpCircle, color: '#10b981' },
  { id: 'formats',    label: 'File Formats',    Icon: FileCheck,  color: '#6366f1' },
];

// ── Quick Start accordion steps (instrument extraction pipeline) ────────────
const QUICK_START_STEPS = [
  {
    key: 'step1', num: 1, title: 'Select / Create Project', color: '#3b82f6', Icon: FolderPlus,
    tagline: 'Pick a project workspace first',
    bullets: [
      'Choose an existing project or create a new one — every extraction is saved per project.',
      'Projects keep their own results, so different P&IDs stay cleanly separated.',
    ],
  },
  {
    key: 'step2', num: 2, title: 'Upload P&ID PDF', color: '#8b5cf6', Icon: UploadIcon,
    tagline: 'The only required input',
    bullets: [
      'Drag & drop your P&ID PDF — single or multi-page supported.',
      'Vector PDFs give the cleanest symbol detection; scanned drawings work too (≥ 300 DPI).',
      'Optionally add drawing metadata (number, title, revision, project).',
    ],
  },
  {
    key: 'step3', num: 3, title: 'Attach Legend Sheet', color: '#06b6d4', Icon: BookOpen,
    tagline: 'Optional — cross-verifies symbols',
    bullets: [
      'Upload the project legend sheet so AI can cross-check instrument bubbles against known symbols.',
      'Legends improve tag classification and reduce false positives.',
    ],
  },
  {
    key: 'step4', num: 4, title: 'AI Vision Multi-Pass Scan', color: '#f59e0b', Icon: Cpu,
    tagline: '7-pass scan catches every bubble',
    bullets: [
      'Standard pass plus 90°/270° rotations and 4 quadrant tiles — no matter the orientation, tags are caught.',
      'ISA 5.1 intelligence classifies each tag into its instrument category.',
      'Runs as an async job with live progress.',
    ],
  },
  {
    key: 'step5', num: 5, title: 'Review the Index', color: '#10b981', Icon: Eye,
    tagline: 'Categorised, filterable results table',
    bullets: [
      'Every instrument tag lands in a colour-coded table with incremental index numbers.',
      'Summary cards show counts per category (Flow, Pressure, Temperature, Level, SDV/BDV, MOV, PSV, RO…).',
      'Spot-check tags against the drawing before export.',
    ],
  },
  {
    key: 'step6', num: 6, title: 'Export to Excel', color: '#6366f1', Icon: Download,
    tagline: 'Two-sheet workbook, one click',
    bullets: [
      'Sheet 1: Instrument Index — every tag with its category and metadata.',
      'Sheet 2: Summary — per-category counts for quick review.',
      'Re-export anytime; each run reflects the latest extraction.',
    ],
  },
];

// ── Categories tab (instrument categories detected) ─────────────────────────
const INSTRUMENT_CATEGORIES = [
  { id: 'F',  name: 'Flow',            desc: 'Flow instruments — FE, FT, FI, FIC, flow indicators and transmitters.', sev: 'core' },
  { id: 'P',  name: 'Pressure',        desc: 'Pressure instruments — PT, PI, PIC, PSV relief and safety valves.',      sev: 'core' },
  { id: 'T',  name: 'Temperature',     desc: 'Temperature instruments — TE, TT, TI, TIC elements and transmitters.',   sev: 'core' },
  { id: 'L',  name: 'Level',           desc: 'Level instruments — LT, LI, LIC gauges and transmitters.',               sev: 'core' },
  { id: 'A',  name: 'Analysis',        desc: 'Analysers — AT, AI for composition and quality measurement.',            sev: 'minor' },
  { id: 'S',  name: 'SDV / BDV',       desc: 'Shutdown and blowdown valves for safety isolation.',                     sev: 'core' },
  { id: 'M',  name: 'MOV',             desc: 'Motor-operated valves detected on the drawing.',                         sev: 'core' },
  { id: 'R',  name: 'RO / Restriction', desc: 'Restriction orifices and similar fittings.',                            sev: 'minor' },
];

// ── Best Practices tab ───────────────────────────────────────────────────────
const BEST_PRACTICES = [
  { title: 'Use vector PDFs where possible',   desc: 'Native CAD-exported P&IDs carry embedded geometry — the vision pass is faster and more accurate.' },
  { title: 'Attach the legend sheet',          desc: 'Symbol cross-verification against the project legend sharply reduces mis-classified tags.' },
  { title: 'One drawing per run',              desc: 'Run each P&ID separately so results stay attributable to a single source drawing.' },
  { title: 'Let the multi-pass finish',        desc: 'The 7-pass scan (rotations + quadrants) is what catches rotated/partial bubbles — let it complete before reviewing.' },
  { title: 'Review categories before export',  desc: 'A quick pass over the colour-coded table catches any tag assigned to the wrong category.' },
  { title: 'Pair with the Line List',          desc: 'Run the same P&ID through Line List for the piping view — the two outputs complement each other.' },
];

// ── FAQ tab ──────────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  { q: 'What does the Instrument Index extract?',  a: 'Every instrument tag on the P&ID — Flow, Pressure, Temperature, Level, Analysis, SDV/BDV, MOV, PSV, RO and more — each with its category and an incremental index number.' },
  { q: 'How does the multi-pass scan work?',        a: 'The drawing is scanned in standard orientation, rotated 90°/270°, and split into 4 quadrant tiles — so instrument bubbles are detected regardless of orientation.' },
  { q: 'Do I need a legend sheet?',                 a: 'Optional, but recommended — it lets the AI cross-check symbols against your project legend and improves classification accuracy.' },
  { q: 'What does the Excel export contain?',       a: 'Two sheets: the full Instrument Index (all tags) and a Summary with per-category counts.' },
  { q: 'Is it ISA 5.1 aware?',                      a: 'Yes — tag letters are interpreted per ISA 5.1, so first/succeeding letters map to the correct measured variable and function.' },
  { q: 'Is my drawing sent to an external service?', a: 'No — extraction and classification run inside your RAD AI deployment.' },
];

// ── File Formats tab ─────────────────────────────────────────────────────────
const FILE_FORMATS = [
  { ext: 'PDF (vector)',  quality: 'Excellent', note: 'Preferred — embedded geometry gives the most accurate symbol detection.', ok: true },
  { ext: 'PDF (scanned)', quality: 'Good',      note: 'Raster PDF — handled via vision; use ≥ 300 DPI for best results.',        ok: true },
  { ext: 'PNG/JPG/TIFF',  quality: 'Good',      note: 'Accepted via vision; avoid heavy compression around thin symbols.',      ok: true },
  { ext: 'DWG/DXF',       quality: 'Unsupported', note: 'Export to PDF from the CAD package first.',                            ok: false },
];

// Severity chip colours (shared design language)
const SEV_CHIP = {
  core:  { bg: '#eff6ff', border: '#93c5fd', text: '#1d4ed8' },
  minor: { bg: '#fffbeb', border: '#fcd34d', text: '#a16207' },
  info:  { bg: '#f0fdf4', border: '#86efac', text: '#15803d' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components (identical structure to the shared WorkflowDocs pattern)
// ─────────────────────────────────────────────────────────────────────────────

const iconBtnStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: '26px', height: '26px', borderRadius: '7px',
  border: '1px solid rgba(59,130,246,0.25)', background: 'rgba(59,130,246,0.06)',
  color: '#3b82f6', cursor: 'pointer', transition: 'all 200ms ease',
};

const iconBtnStyleDark = {
  ...iconBtnStyle,
  border: '1px solid rgba(148,163,184,0.35)', background: 'rgba(148,163,184,0.12)',
  color: '#cbd5e1',
};

/** Workflow diagram card with loading / error / zoom states. */
const WorkflowDiagram = ({ cfg, panelHeight }) => {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(cfg.defaultCollapsed);
  const [zoom, setZoom]           = useState(100);
  const [loaded, setLoaded]       = useState(false);
  const [error, setError]         = useState(false);

  return (
    <div style={{
      background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: '16px',
      display: 'flex', flexDirection: 'column',
      height: panelHeight, maxHeight: panelHeight,
    }}>
      {/* Header bar — dark gradient */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 20px',
        borderBottom: collapsed ? 'none' : '1px solid #e2e8f0',
        background: 'linear-gradient(135deg, rgba(15,23,42,0.97) 0%, rgba(30,41,59,0.95) 100%)',
        cursor: cfg.collapsible ? 'pointer' : 'default', flexShrink: 0,
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
        <div style={{
          padding: '18px', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'flex-start',
          flex: 1, minHeight: 0, overflow: 'hidden',
        }}>
          {cfg.description && (
            <p style={{
              fontSize: '0.8rem', color: '#64748b', lineHeight: 1.6, maxWidth: '860px',
              margin: '0 auto 14px', textAlign: 'center', flexShrink: 0,
            }}>{cfg.description}</p>
          )}
          <div style={{
            width: '100%', margin: '0 auto', overflow: 'hidden',
            position: 'relative', flex: 1, minHeight: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
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
                maxWidth: `${zoom}%`, maxHeight: '100%', width: 'auto', height: 'auto',
                objectFit: 'contain', display: error ? 'none' : 'block',
                margin: '0 auto', transition: 'all 300ms ease',
                cursor: zoom < cfg.maxZoomPct ? 'zoom-in' : 'default',
              }}
              onClick={() => { if (zoom < cfg.maxZoomPct) setZoom(Math.min(cfg.maxZoomPct, zoom + cfg.zoomStepPct)); }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

/** Single accordion step in Quick Start. */
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
  // Default: all steps expanded so the full journey is visible at a glance.
  const [expandedSteps, setExpandedSteps] = useState(
    () => Object.fromEntries(QUICK_START_STEPS.map(s => [s.key, true]))
  );
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

  if (tab === 'categories') {
    return (
      <div>
        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '14px', lineHeight: 1.55 }}>
          Every detected tag is classified per <strong style={{ color: '#0f172a' }}>ISA 5.1</strong> into one of these categories.{' '}
          <strong style={{ color: SEV_CHIP.core.text }}>Core</strong> categories are always scanned,{' '}
          <strong style={{ color: SEV_CHIP.minor.text }}>Minor</strong> when present.
        </p>
        {INSTRUMENT_CATEGORIES.map(r => {
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
          Accepted input formats and the detection quality you can expect from each.
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
            }}>{f.ext}</span>
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
// Main export — split-screen: workflow (left) + Smart Documentation (right)
// ─────────────────────────────────────────────────────────────────────────────
const InstrumentIndexWorkflowDocs = () => {
  const cfg = INST_DOCS_CONFIG;
  const [docCollapsed, setDocCollapsed] = useState(cfg.docs.defaultCollapsed);
  const [activeTab, setActiveTab]       = useState(cfg.docs.defaultTab);

  if (!cfg.enabled) return null;

  const wfCfg = cfg.workflow?.enabled ? cfg.workflow : null;
  const panelHeight = cfg.splitScreen.panelHeight;

  const docsPanel = cfg.docs.enabled && (
    <div style={{
      background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      height: cfg.splitScreen.enabled ? panelHeight : undefined,
      maxHeight: cfg.splitScreen.enabled ? panelHeight : undefined,
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px',
        borderBottom: docCollapsed ? 'none' : '1px solid #e2e8f0',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.03) 0%, rgba(59,130,246,0.06) 100%)',
        flexShrink: 0,
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
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{cfg.docs.subtitle}</div>
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
        <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <TabContent tab={activeTab} />
        </div>
      )}
    </div>
  );

  // ── Split-screen layout: workflow LEFT, Smart Documentation RIGHT ──
  if (cfg.splitScreen.enabled && wfCfg) {
    return (
      <div className="inst-workflow-split" style={{
        display: 'grid',
        gridTemplateColumns: `${cfg.splitScreen.workflowWidthPct}% ${cfg.splitScreen.docsWidthPct}%`,
        gap: cfg.splitScreen.gap,
        marginBottom: '24px',
        alignItems: 'start',
      }}>
        <style>{`@media (max-width: ${cfg.splitScreen.responsiveMinWidth - 1}px) {
          .inst-workflow-split { display: block !important; grid-template-columns: 1fr !important; }
          .inst-workflow-split > * { margin-bottom: 16px; }
        }`}</style>
        <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <WorkflowDiagram cfg={wfCfg} panelHeight={panelHeight} />
        </div>
        {docsPanel}
      </div>
    );
  }

  // ── Stacked fallback ──
  return (
    <div style={{ marginTop: '8px' }}>
      {wfCfg && <WorkflowDiagram cfg={wfCfg} panelHeight={panelHeight} />}
      {docsPanel}
    </div>
  );
};

export default InstrumentIndexWorkflowDocs;
