/**
 * ValveMTOWorkflowDocs.jsx — "Valve MTO Workflow" diagram + "Smart
 * Documentation" panel for the Valve MTO page, mirroring the shared
 * engineering design language (identical structure to
 * LineListWorkflowDocs / P&ID Verification V1).
 *
 *   LEFT  — collapsible workflow diagram card (soft-coded image path, zoom)
 *   RIGHT — "Smart Documentation" tabbed panel: Quick Start (accordion
 *           steps), Template Columns, Best Practices, FAQ, File Formats
 *
 * SOFT-CODED: all content, colours and layout live in VMTO_DOCS_CONFIG below —
 * edit text/tabs/steps without touching JSX. Set enabled:false to hide.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader, AlertTriangle, ChevronDown, ChevronUp, BookOpen,
  PlayCircle, List, Star, HelpCircle, FileCheck, Maximize2, Minimize2,
  Upload as UploadIcon, Brain, Eye, Download, CheckCircle,
  ExternalLink, Table, Save,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// SOFT-CODED CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
export const VMTO_DOCS_CONFIG = {
  enabled: true,                        // master switch — false hides everything

  // ── Split-screen layout (mirrors P&ID Verification V1) ────────────────────
  splitScreen: {
    enabled:            true,
    workflowWidthPct:   45,
    docsWidthPct:       55,
    gap:                '20px',
    responsiveMinWidth: 1024,
  },

  // ── Workflow diagram ──────────────────────────────────────────────────────
  workflow: {
    enabled:       true,
    imagePath:     '/assets/images/ValveMTO_Workflow.png',  // drop asset in frontend/public/assets/images/
    title:         'Valve MTO Workflow',
    altText:       'Valve MTO Workflow — Import Valve MTO, review/edit rows, export 5-sheet workbook',
    badge:         'Material Take-Off',
    description:   'Build a standards-aligned Valve Material Take-Off: import an existing MTO (or start blank), review and enrich the rows per tab, then export the 5-sheet template workbook.',
    linkLabel:     'Open Legend Manager',
    linkRoute:     '/engineering/legends',
    collapsible:   true,
    defaultCollapsed: false,
    maxZoomPct:    200,
    zoomStepPct:   25,
  },

  // ── Smart Documentation panel ─────────────────────────────────────────────
  docs: {
    enabled:          true,
    title:            'Smart Documentation',
    subtitle:         'Everything you need to produce a clean, template-aligned Valve MTO',
    collapsible:      true,
    defaultCollapsed: false,
    defaultTab:       'quickstart',
  },
};

// ── Tab definitions (order = render order) ──────────────────────────────────
const DOC_TABS = [
  { id: 'quickstart', label: 'Quick Start',      Icon: PlayCircle, color: '#3b82f6' },
  { id: 'columns',    label: 'Template Columns', Icon: Table,      color: '#8b5cf6' },
  { id: 'practices',  label: 'Best Practices',   Icon: Star,       color: '#f59e0b' },
  { id: 'faq',        label: 'FAQ',              Icon: HelpCircle, color: '#10b981' },
  { id: 'formats',    label: 'File Formats',     Icon: FileCheck,  color: '#6366f1' },
];

// ── Quick Start accordion steps ─────────────────────────────────────────────
const QUICK_START_STEPS = [
  {
    key: 'step1', num: 1, title: 'Pick or create a project', color: '#3b82f6', Icon: Save,
    tagline: 'Valve MTOs are saved per project',
    bullets: [
      'Use the project switcher in the header to open an existing MTO workspace or create a new one.',
      'Each project keeps its own rows, project header fields and history snapshots.',
      'Switching projects auto-loads that project\'s last saved state.',
    ],
  },
  {
    key: 'step2', num: 2, title: 'Import an existing MTO (optional)', color: '#8b5cf6', Icon: UploadIcon,
    tagline: 'Start from a template or a blank grid',
    bullets: [
      'Click Import and drop an existing Valve MTO (.xlsx / .xls / .csv) — headers are auto-detected and columns mapped.',
      'A P&ID PDF can also be imported to pre-extract candidate valves.',
      'Skip this step to build the MTO row-by-row from scratch.',
    ],
  },
  {
    key: 'step3', num: 3, title: 'Review & edit rows per tab', color: '#f59e0b', Icon: Eye,
    tagline: 'All / ISLAND / FIELD / COMBINED / Pivot views',
    bullets: [
      'Every cell is inline-editable — click a cell to edit; changes auto-save.',
      'ISLAND and FIELD tabs show per-area rows; COMBINED merges them; Pivot summarises by tag/type.',
      'Live totals (Σ Island, Σ Field, Σ Total) update as you edit.',
      'Add or delete rows with the table toolbar; use search to filter quickly.',
    ],
  },
  {
    key: 'step4', num: 4, title: 'Save a snapshot', color: '#10b981', Icon: Save,
    tagline: 'Version your work for later reuse',
    bullets: [
      'Save Snapshot stores the current MTO in History so you can roll back or branch.',
      'Snapshots are listed with timestamps — rename or delete them from the History panel.',
    ],
  },
  {
    key: 'step5', num: 5, title: 'Export the 5-sheet workbook', color: '#6366f1', Icon: Download,
    tagline: 'Template-aligned Excel output',
    bullets: [
      'Download Valve MTO (.xlsx) emits the standard 5-sheet template: Notes, ISLAND, FIELD, COMBINED MTO, Pivot.',
      'Column order and headers match the standard 13-column layout, ready for issue.',
      'Re-export after any edit — each download reflects the current state.',
    ],
  },
];

// ── Template Columns tab (the 13 standard columns) ──────────────────────────
const TEMPLATE_COLUMNS = [
  { id: 'C-01', name: 'Tag Number',        desc: 'Unique valve tag (e.g. XV-1001). Drives Pivot grouping.',           sev: 'core' },
  { id: 'C-02', name: 'Valve Type',        desc: 'Gate, Globe, Ball, Butterfly, Check, etc.',                        sev: 'core' },
  { id: 'C-03', name: 'Size',              desc: 'Nominal bore (e.g. 2").',                                          sev: 'core' },
  { id: 'C-04', name: 'Rating / Class',    desc: 'Pressure rating (e.g. 150#, 300#).',                               sev: 'core' },
  { id: 'C-05', name: 'Body Material',     desc: 'Body/bonnet material of construction.',                            sev: 'core' },
  { id: 'C-06', name: 'Trim Material',     desc: 'Internal trim material.',                                          sev: 'minor' },
  { id: 'C-07', name: 'End Connection',    desc: 'Flanged, socket-weld, threaded, wafer, etc.',                      sev: 'core' },
  { id: 'C-08', name: 'Qty — Island',      desc: 'Quantity in the ISLAND area. Sums into Σ Island.',                 sev: 'core' },
  { id: 'C-09', name: 'Qty — Field',       desc: 'Quantity in the FIELD area. Sums into Σ Field.',                   sev: 'core' },
  { id: 'C-10', name: 'Qty — Total',       desc: 'Combined quantity (Island + Field) shown in COMBINED view.',       sev: 'info' },
  { id: 'C-11', name: 'Service / Line',    desc: 'Associated service or line reference.',                            sev: 'minor' },
  { id: 'C-12', name: 'P&ID Reference',    desc: 'Source drawing number for traceability.',                          sev: 'minor' },
  { id: 'C-13', name: 'Remarks',           desc: 'Free-text notes; auto-derived hints can be merged per row.',       sev: 'minor' },
];

// ── Best Practices tab ───────────────────────────────────────────────────────
const BEST_PRACTICES = [
  { title: 'Import the latest template first',  desc: 'Starting from the standard template guarantees the exported workbook matches the expected 5-sheet layout.' },
  { title: 'Keep tag numbers consistent',        desc: 'The Pivot tab groups by tag and type — consistent tagging gives a clean summary.' },
  { title: 'Split Island vs Field deliberately', desc: 'Enter quantities in the correct area columns so Σ Island / Σ Field totals stay meaningful.' },
  { title: 'Save snapshots before big edits',    desc: 'A snapshot lets you roll back instantly if a bulk import or edit goes wrong.' },
  { title: 'Fill the Project Header',            desc: 'Exporter pulls project fields into the workbook header — complete them before issuing.' },
  { title: 'Spot-check the Pivot before export', desc: 'A quick Pivot review catches miscounted or mis-typed rows before they reach the issued MTO.' },
];

// ── FAQ tab ──────────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  { q: 'What file types can I import?',              a: 'Excel (.xlsx / .xls), CSV, and P&ID PDF for candidate pre-extraction. Headers are auto-mapped to the template columns.' },
  { q: 'How do the tabs relate to each other?',       a: 'All shows every row; ISLAND and FIELD are per-area views; COMBINED merges areas into one row per tag; Pivot summarises quantities by tag/type.' },
  { q: 'Is my work saved automatically?',             a: 'Yes — edits auto-save to your browser (and sync across open tabs). Use Save Snapshot to create a named, restorable version.' },
  { q: 'What does the export contain?',               a: 'A 5-sheet .xlsx matching the standard template: Notes, ISLAND, FIELD, COMBINED MTO and Pivot — 13 columns in canonical order.' },
  { q: 'Can I undo a mistaken import?',               a: 'Import replaces the current rows; save a snapshot first, or restore an earlier snapshot from History to recover.' },
  { q: 'Where does the Pivot data come from?',        a: 'The Pivot tab is computed live from your rows — no separate input needed.' },
];

// ── File Formats tab ─────────────────────────────────────────────────────────
const FILE_FORMATS = [
  { ext: 'XLSX', quality: 'Excellent', note: 'Preferred — headers auto-map; template structure preserved on import.', ok: true  },
  { ext: 'XLS',  quality: 'Good',      note: 'Legacy Excel — supported; column mapping is heuristic.',                 ok: true  },
  { ext: 'CSV',  quality: 'Good',      note: 'Plain-text rows — ensure headers match template names for clean mapping.', ok: true },
  { ext: 'PDF',  quality: 'Pre-extract', note: 'P&ID PDF — used to pre-extract candidate valves, not a full MTO import.', ok: true },
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
      display: 'flex', flexDirection: 'column',
      // Fill the grid cell so the workflow card matches the docs panel height.
      height: '100%',
    }}>
      {/* Header bar — dark gradient */}
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

  if (tab === 'columns') {
    return (
      <div>
        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '14px', lineHeight: 1.55 }}>
          The export emits the standard <strong style={{ color: '#0f172a' }}>13-column template</strong>.
          Legend: <strong style={{ color: SEV_CHIP.core.text }}>Core</strong> always present,{' '}
          <strong style={{ color: SEV_CHIP.minor.text }}>Minor</strong> optional,{' '}
          <strong style={{ color: SEV_CHIP.info.text }}>Info</strong> derived.
        </p>
        {TEMPLATE_COLUMNS.map(r => {
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
          Accepted import formats and how cleanly each maps onto the template.
        </p>
        {FILE_FORMATS.map(f => (
          <div key={f.ext} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '11px 14px', marginBottom: '8px', borderRadius: '10px',
            background: '#ffffff', border: '1px solid #e2e8f0',
          }}>
            <span style={{
              fontSize: '0.72rem', fontWeight: 800, fontFamily: 'monospace',
              padding: '4px 10px', borderRadius: '7px', flexShrink: 0,
              background: 'rgba(99,102,241,0.08)', color: '#6366f1',
              border: '1px solid rgba(99,102,241,0.25)',
            }}>{f.ext}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.5 }}>{f.note}</div>
            </div>
            <span style={{
              fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', flexShrink: 0,
              letterSpacing: '0.06em', padding: '3px 8px', borderRadius: '999px',
              background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac',
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
const ValveMTOWorkflowDocs = () => {
  const cfg = VMTO_DOCS_CONFIG;
  const [docCollapsed, setDocCollapsed] = useState(cfg.docs.defaultCollapsed);
  const [activeTab, setActiveTab]       = useState(cfg.docs.defaultTab);

  if (!cfg.enabled) return null;

  const wfCfg = cfg.workflow?.enabled ? cfg.workflow : null;

  const docsPanel = cfg.docs.enabled && (
    <div style={{
      background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      // Match the workflow card height (stretch to the grid row).
      height: '100%',
      maxHeight: cfg.splitScreen.enabled ? 'none' : undefined,
    }}>
      {/* Header */}
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
        <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
          <TabContent tab={activeTab} />
        </div>
      )}
    </div>
  );

  // ── Split-screen layout: workflow LEFT, Smart Documentation RIGHT ──
  if (cfg.splitScreen.enabled && wfCfg) {
    return (
      <div className="vmto-workflow-split" style={{
        display: 'grid',
        gridTemplateColumns: `${cfg.splitScreen.workflowWidthPct}% ${cfg.splitScreen.docsWidthPct}%`,
        gap: cfg.splitScreen.gap,
        marginBottom: '24px',
        alignItems: 'stretch',
      }}>
        <style>{`@media (max-width: ${cfg.splitScreen.responsiveMinWidth - 1}px) {
          .vmto-workflow-split { display: block !important; grid-template-columns: 1fr !important; }
          .vmto-workflow-split > * { margin-bottom: 16px; }
        }`}</style>
        <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>{wfCfg && <WorkflowDiagram cfg={wfCfg} />}</div>
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

export default ValveMTOWorkflowDocs;
