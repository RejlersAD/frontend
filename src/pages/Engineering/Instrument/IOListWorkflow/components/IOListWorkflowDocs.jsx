/**
 * IOListWorkflowDocs.jsx — "IO List Workflow" diagram + "Smart Documentation"
 * panel for the Instrument I/O List page, mirroring the shared engineering
 * design language (identical structure to LineListWorkflowDocs /
 * HMBWorkflowDocs / InstrumentIndexWorkflowDocs).
 *
 *   LEFT  — collapsible workflow diagram card (soft-coded image path, zoom)
 *   RIGHT — "Smart Documentation" tabbed panel: Quick Start (accordion
 *           steps), I/O Columns, Best Practices, FAQ, File Formats
 *
 * SOFT-CODED: all content, colours and layout live in IO_DOCS_CONFIG below —
 * edit text/tabs/steps without touching JSX. Set enabled:false to hide.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader, AlertTriangle, ChevronDown, ChevronUp, BookOpen,
  PlayCircle, Table2, Star, HelpCircle, FileCheck, Maximize2, Minimize2,
  Upload as UploadIcon, Brain, Eye, Download, CheckCircle,
  ExternalLink, FolderPlus, Sparkles, ListOrdered,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// SOFT-CODED CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
export const IO_DOCS_CONFIG = {
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
    imagePath:     '/assets/images/IOList_Workflow.png',  // drop asset in frontend/public/assets/images/
    title:         'IO List Workflow',
    altText:       'IO List Workflow — upload P&ID/IO list, AI extraction, multi-revision IO table, Excel export',
    badge:         'Multi-Revision',
    description:   'Build a multi-revision Instrument I/O List: upload a P&ID or an existing I/O list, let AI extract the I/O points, review the tabbed table, then export the workbook — revisions tracked automatically.',
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
    subtitle:         'Everything you need to produce a clean, multi-revision I/O list',
    collapsible:      true,
    defaultCollapsed: false,
    defaultTab:       'quickstart',
  },
};

// ── Tab definitions (order = render order) ──────────────────────────────────
const DOC_TABS = [
  { id: 'quickstart', label: 'Quick Start',     Icon: PlayCircle,  color: '#3b82f6' },
  { id: 'columns',    label: 'I/O Columns',     Icon: Table2,      color: '#8b5cf6' },
  { id: 'practices',  label: 'Best Practices',  Icon: Star,        color: '#f59e0b' },
  { id: 'faq',        label: 'FAQ',             Icon: HelpCircle,  color: '#10b981' },
  { id: 'formats',    label: 'File Formats',    Icon: FileCheck,   color: '#6366f1' },
];

// ── Quick Start accordion steps (IO list pipeline) ──────────────────────────
const QUICK_START_STEPS = [
  {
    key: 'step1', num: 1, title: 'Select / Create Project', color: '#3b82f6', Icon: FolderPlus,
    tagline: 'Scope the work to a project',
    bullets: [
      'Pick or create a project so documents, revisions and comments stay grouped.',
      'Each project tracks its own I/O list revisions independently.',
    ],
  },
  {
    key: 'step2', num: 2, title: 'Upload Document', color: '#8b5cf6', Icon: UploadIcon,
    tagline: 'P&ID PDF or an existing I/O list',
    bullets: [
      'Upload a P&ID PDF to extract I/O points, or an existing I/O list (.xlsx/.csv) to revise it.',
      'The engine detects the document type automatically (P&ID vs I/O list).',
      'Drag & drop into the upload zone or use the toolbar button.',
    ],
  },
  {
    key: 'step3', num: 3, title: 'AI Extraction', color: '#f59e0b', Icon: Brain,
    tagline: 'Vision-powered I/O point detection',
    bullets: [
      'AI scans the drawing and identifies every instrument I/O point (AI/AO/DI/DO).',
      'Extraction runs async with a live progress banner — safe to leave the tab.',
      'Choose quick or thorough scan depth depending on drawing density.',
    ],
  },
  {
    key: 'step4', num: 4, title: 'Review I/O Table', color: '#10b981', Icon: Table2,
    tagline: 'Tabbed detail view per document',
    bullets: [
      'Open a document to the tabbed view: Overview, Comments, I/O Table, Metadata.',
      'The I/O Table is fully editable — correct tags, signal types and assignments inline.',
      'Extracted comments carry drawing notes alongside the table.',
    ],
  },
  {
    key: 'step5', num: 5, title: 'Track Revisions', color: '#ec4899', Icon: ListOrdered,
    tagline: 'Every upload is a new revision',
    bullets: [
      'Re-uploading a revised document creates a new revision — history is preserved.',
      'Compare revisions to see what changed between issues.',
      'Previous revisions remain downloadable for traceability.',
    ],
  },
  {
    key: 'step6', num: 6, title: 'Export Workbook', color: '#6366f1', Icon: Download,
    tagline: 'Formatted Excel I/O list',
    bullets: [
      'Download the I/O list as a formatted .xlsx ready for issue.',
      'Export always reflects the latest saved edits.',
      'Revisions can each be exported independently.',
    ],
  },
];

// ── I/O Columns tab ─────────────────────────────────────────────────────────
const IO_COLUMNS = [
  { id: 'IO-01', name: 'Tag Number',        desc: 'Instrument tag the I/O point belongs to (e.g. FT-1001).',   sev: 'core' },
  { id: 'IO-02', name: 'Signal Type',       desc: 'AI / AO / DI / DO — the I/O signal direction and type.',     sev: 'core' },
  { id: 'IO-03', name: 'Service Description', desc: 'What the point measures or controls.',                     sev: 'core' },
  { id: 'IO-04', name: 'Loop Number',       desc: 'Control loop the point belongs to.',                         sev: 'minor' },
  { id: 'IO-05', name: 'P&ID Reference',    desc: 'Source drawing number for traceability.',                    sev: 'minor' },
  { id: 'IO-06', name: 'I/O Assignment',    desc: 'System/panel/channel the point is wired to.',                sev: 'core' },
  { id: 'IO-07', name: 'Range / Units',     desc: 'Engineering range and units where applicable.',              sev: 'minor' },
  { id: 'IO-08', name: 'Remarks',           desc: 'Free-text notes carried with the point.',                    sev: 'minor' },
];

// ── Best Practices tab ───────────────────────────────────────────────────────
const BEST_PRACTICES = [
  { title: 'Start from the latest revision',    desc: 'Always upload the newest drawing/list — revisions stack, so the latest becomes the working copy.' },
  { title: 'Use thorough scan for dense P&IDs', desc: 'Quick scan suits clean drawings; switch to thorough for congested multi-system P&IDs to catch every I/O point.' },
  { title: 'Review the Comments tab',           desc: 'Extracted drawing notes often carry critical I/O caveats — check them before exporting.' },
  { title: 'Correct in the I/O Table',          desc: 'Edits are saved to the revision, so fix tags/assignments in the table rather than in Excel afterwards.' },
  { title: 'Attach the legend sheet',           desc: 'A project legend improves signal-type classification and tag interpretation.' },
  { title: 'Keep revisions, don\'t delete',      desc: 'Revision history is your audit trail — delete only true duplicates.' },
];

// ── FAQ tab ──────────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  { q: 'What can I upload?',                       a: 'A P&ID PDF (to extract I/O points) or an existing I/O list (.xlsx/.csv) to revise. The document type is detected automatically.' },
  { q: 'How are revisions handled?',                a: 'Each new upload creates a new revision of the document — previous revisions stay available for comparison and download.' },
  { q: 'Quick vs thorough scan — which do I pick?', a: 'Quick is faster for clean drawings; thorough runs more vision passes and suits dense or rotated P&IDs.' },
  { q: 'Can I edit the extracted table?',           a: 'Yes — the I/O Table tab is fully editable, and changes are saved against the revision before export.' },
  { q: 'What does the export include?',             a: 'A formatted Excel workbook of the I/O list reflecting your latest edits, exportable per revision.' },
  { q: 'Is my drawing sent to an external service?', a: 'No — extraction and classification run inside your RAD AI deployment.' },
];

// ── File Formats tab ─────────────────────────────────────────────────────────
const FILE_FORMATS = [
  { ext: 'PDF (vector)',  quality: 'Excellent', note: 'Preferred for P&ID extraction — embedded geometry gives clean detection.', ok: true },
  { ext: 'PDF (scanned)', quality: 'Good',      note: 'Raster PDF — handled via vision; use ≥ 300 DPI.',                          ok: true },
  { ext: 'XLSX/CSV',      quality: 'Excellent', note: 'Existing I/O list for revision — columns map onto the I/O schema.',        ok: true },
  { ext: 'DWG/DXF',       quality: 'Unsupported', note: 'Export to PDF from the CAD package first.',                              ok: false },
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
      // No fixed height — the card grows to the diagram's natural aspect ratio so
      // wide workflows stay large and readable (matches the width-fill fitMode).
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
                // width-fill: the diagram spans the card and keeps its aspect ratio,
                // so wide workflows stay large and readable.
                width: `${zoom}%`, height: 'auto', display: error ? 'none' : 'block',
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

  if (tab === 'columns') {
    return (
      <div>
        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '14px', lineHeight: 1.55 }}>
          The I/O table schema each document maps onto.{' '}
          <strong style={{ color: SEV_CHIP.core.text }}>Core</strong> columns always extracted,{' '}
          <strong style={{ color: SEV_CHIP.minor.text }}>Minor</strong> when present.
        </p>
        {IO_COLUMNS.map(r => {
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
          Accepted input formats and the extraction quality you can expect from each.
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
const IOListWorkflowDocs = () => {
  const cfg = IO_DOCS_CONFIG;
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
      height: cfg.splitScreen.enabled ? '100%' : undefined,
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
      <div className="io-workflow-split" style={{
        display: 'grid',
        gridTemplateColumns: `${cfg.splitScreen.workflowWidthPct}% ${cfg.splitScreen.docsWidthPct}%`,
        gap: cfg.splitScreen.gap,
        marginBottom: '24px',
        alignItems: 'stretch',
      }}>
        <style>{`@media (max-width: ${cfg.splitScreen.responsiveMinWidth - 1}px) {
          .io-workflow-split { display: block !important; grid-template-columns: 1fr !important; }
          .io-workflow-split > * { margin-bottom: 16px; }
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

export default IOListWorkflowDocs;
