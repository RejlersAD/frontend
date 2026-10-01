/**
 * EquipmentListWorkflowDocs.jsx — Verification Workflow diagram + Smart
 * Documentation panel for the Equipment List page, mirroring the design
 * language and split-screen placement of PIDVerification.jsx (V1).
 *
 * SOFT-CODED: all content lives in EQ_DOCS_CONFIG below — edit text/tabs/
 * steps without touching JSX. Set enabled:false to hide the whole section.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader, AlertTriangle, ChevronDown, ChevronUp, BookOpen,
  PlayCircle, List, Star, HelpCircle, FileCheck, Maximize2, Minimize2,
  Upload as UploadIcon, Brain, Eye, Download, CheckCircle,
  ExternalLink,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// SOFT-CODED CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
export const EQ_DOCS_CONFIG = {
  enabled: true,

  splitScreen: {
    enabled:            true,
    workflowWidthPct:   45,
    docsWidthPct:       55,
    gap:                '20px',
    responsiveMinWidth: 1024,
  },

  workflow: {
    enabled:       true,
    imagePath:     '/assets/images/EquipmentList_Workflow.png',  // drop asset in frontend/public/assets/images/
    title:         'Equipment List Verification Workflow',
    altText:       'Equipment List Workflow — Upload P&ID, AI Extraction, Equipment Register Output',
    badge:         'P&ID Analysis',
    description:   'The same proven pipeline that powers P&ID Verification V1 — equipment extraction follows an identical Upload → AI Analysis → Quality Output journey.',
    linkLabel:     'Open P&ID Verification',
    linkRoute:     '/engineering/process/pid-verification-v1',
    collapsible:   true,
    defaultCollapsed: false,
    maxZoomPct:    200,
    zoomStepPct:   25,
  },

  docs: {
    enabled:          true,
    title:            'Smart Documentation',
    collapsible:      true,
    defaultCollapsed: false,
    defaultTab:       'quickstart',
  },
};

const DOC_TABS = [
  { id: 'quickstart', label: 'Quick Start',       Icon: PlayCircle, color: '#3b82f6' },
  { id: 'rules',      label: 'Extraction Fields', Icon: List,       color: '#8b5cf6' },
  { id: 'practices',  label: 'Best Practices',    Icon: Star,       color: '#f59e0b' },
  { id: 'faq',        label: 'FAQ',               Icon: HelpCircle, color: '#10b981' },
  { id: 'formats',    label: 'File Formats',      Icon: FileCheck,  color: '#6366f1' },
];

const QUICK_START_STEPS = [
  {
    key: 'step1', num: 1, title: 'Select a Project', color: '#3b82f6', Icon: CheckCircle,
    tagline: 'Organise extractions by plant, unit or deliverable',
    bullets: [
      'Pick an existing project from the workspace, or create a new one.',
      'Each project keeps its own extraction history and activity trail.',
      'Projects are shared across tools — the same project works in Line List and HMB Extractor.',
    ],
  },
  {
    key: 'step2', num: 2, title: 'Upload P&ID(s)', color: '#8b5cf6', Icon: UploadIcon,
    tagline: 'Single PDF or batch — multi-file supported',
    bullets: [
      'Drag & drop one or more P&ID PDFs into the upload zone.',
      'Vector PDFs give the fastest, most accurate extraction; scans work too (≥ 300 DPI).',
      'Equipment registers (PDF) are also accepted as a source.',
    ],
  },
  {
    key: 'step3', num: 3, title: 'AI Extraction Runs', color: '#f59e0b', Icon: Brain,
    tagline: '18-field OCR + rule engine, fully server-side',
    bullets: [
      'The engine detects equipment tags (V-, P-, E-, T-, C- …) and their data blocks.',
      'Operating & design conditions, MOC, insulation, dimensions and motor ratings are parsed.',
      'Dense drawings take longer — progress polling keeps you updated; the tab can be left open.',
    ],
  },
  {
    key: 'step4', num: 4, title: 'Review & Add Manual Rows', color: '#10b981', Icon: Eye,
    tagline: 'Sortable, filterable register with manual entry support',
    bullets: [
      'Sort by any column, filter by text, and select rows for partial export.',
      'Add manual observations for equipment the OCR missed — they merge into the register.',
      'KPI summary shows extraction coverage (tags, MOC, dimensions, motor ratings).',
    ],
  },
  {
    key: 'step5', num: 5, title: 'Export to Excel', color: '#6366f1', Icon: Download,
    tagline: 'Full register or selected rows only',
    bullets: [
      'Export All downloads the complete register; Export Selected downloads only ticked rows.',
      'Column widths are pre-set for readability in Excel.',
      'Re-run after drawing revisions — each extraction is a fresh snapshot.',
    ],
  },
];

const EXTRACTION_FIELDS = [
  { id: 'F-01', name: 'Equipment Tag No.',      desc: 'Tag parsed from equipment bubbles/tables (V-101, P-301A …).',        sev: 'core' },
  { id: 'F-02', name: 'Description',            desc: 'Equipment description from register or title block proximity.',       sev: 'core' },
  { id: 'F-03', name: 'Design Flowrate / Duty', desc: 'Design flow or duty value with units.',                               sev: 'core' },
  { id: 'F-04', name: 'Operating Pressure',     desc: 'Normal operating pressure (PSIG).',                                   sev: 'core' },
  { id: 'F-05', name: 'Operating Temperature',  desc: 'Normal operating temperature (°F).',                                  sev: 'core' },
  { id: 'F-06', name: 'Design Pressure Range',  desc: 'Min/max design pressure envelope.',                                   sev: 'core' },
  { id: 'F-07', name: 'Design Temp Range',      desc: 'Min/max design temperature envelope.',                                sev: 'core' },
  { id: 'F-08', name: 'MOC',                    desc: 'Material of construction (CS, SS316, …).',                            sev: 'core' },
  { id: 'F-09', name: 'Insulation',             desc: 'Insulation class / thickness where shown.',                           sev: 'minor' },
  { id: 'F-10', name: 'Dimensions',             desc: 'Length/height and diameter/width in mm.',                             sev: 'minor' },
  { id: 'F-11', name: 'Motor Rating',           desc: 'Driver power in kW for rotating equipment.',                          sev: 'minor' },
  { id: 'F-12', name: 'P&ID Reference',         desc: 'Source drawing number for traceability.',                             sev: 'core' },
];

const BEST_PRACTICES = [
  { title: 'Vector PDFs first',             desc: 'CAD-exported PDFs carry embedded text — OCR is skipped where possible, faster and more accurate.' },
  { title: 'Batch related sheets',          desc: 'Upload all P&IDs of a unit together — the register consolidates tags across drawings.' },
  { title: 'Review the KPI summary',        desc: 'Low MOC or dimension coverage usually means the source register area was not scanned — re-check the drawing region.' },
  { title: 'Use manual rows for gaps',      desc: 'Add the handful of items OCR missed instead of re-running the whole drawing.' },
  { title: 'Configure a legend',            desc: 'A managed legend (Manage Legends) improves tag classification and description resolution across runs.' },
  { title: 'Pair with P&ID Verification',   desc: 'Run the drawing through P&ID Verification first — a clean P&ID yields a cleaner register.' },
];

const FAQ_ITEMS = [
  { q: 'Which equipment types are detected?',       a: 'Vessels, pumps, heat exchangers, tanks, columns, compressors and more — anything with a standard equipment tag pattern (letter code + number).' },
  { q: 'Can I upload multiple P&IDs at once?',      a: 'Yes — batch upload is supported. Each file is processed and merged into one register.' },
  { q: 'Does it work on scanned P&IDs?',            a: 'Yes — OCR handles raster input. Use ≥ 300 DPI, upright, unskewed scans for reliable results.' },
  { q: 'What if a tag is missed?',                  a: 'Add it via the manual observation form — manual rows merge into the register and export like extracted rows.' },
  { q: 'Is my drawing sent to an external AI?',     a: 'No. OCR and parsing run server-side inside your RAD AI deployment.' },
  { q: 'Can I export only part of the register?',   a: 'Yes — tick rows and use Export Selected to download just those entries.' },
];

const FILE_FORMATS = [
  { ext: 'PDF (vector)',  quality: 'Excellent',    note: 'Preferred — embedded text gives near-perfect extraction.',      ok: true  },
  { ext: 'PDF (scanned)', quality: 'Good',         note: 'Raster PDF — OCR path; use ≥ 300 DPI for best results.',        ok: true  },
  { ext: 'PNG/JPG/TIFF',  quality: 'Good',         note: 'Accepted via OCR; avoid heavy compression around thin lines.',  ok: true  },
  { ext: 'DWG/DXF',       quality: 'Unsupported',  note: 'Export to PDF from the CAD package first.',                     ok: false },
];

const SEV_CHIP = {
  core:  { bg: '#eff6ff', border: '#93c5fd', text: '#1d4ed8' },
  minor: { bg: '#fffbeb', border: '#fcd34d', text: '#a16207' },
};

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

/** Workflow diagram card with loading / error / zoom states (V1 pattern). */
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
          Every extraction targets the same <strong style={{ color: '#0f172a' }}>18-column register</strong>.
          Legend: <strong style={{ color: SEV_CHIP.core.text }}>Core</strong> always extracted,{' '}
          <strong style={{ color: SEV_CHIP.minor.text }}>Minor</strong> when present on the drawing.
        </p>
        {EXTRACTION_FIELDS.map(r => {
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
const EquipmentListWorkflowDocs = () => {
  const cfg = EQ_DOCS_CONFIG;
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
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Everything you need to produce a standards-aligned equipment register</div>
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

      {!docCollapsed && (
        <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
          <TabContent tab={activeTab} />
        </div>
      )}
    </div>
  );

  if (cfg.splitScreen.enabled && wfCfg) {
    return (
      <div className="eq-workflow-split" style={{
        display: 'grid',
        gridTemplateColumns: `${cfg.splitScreen.workflowWidthPct}% ${cfg.splitScreen.docsWidthPct}%`,
        gap: cfg.splitScreen.gap,
        marginBottom: '24px',
        alignItems: 'stretch',
        animation: 'eq-fade-up 0.5s ease-out 0.08s both',
      }}>
        <style>{`@media (max-width: ${cfg.splitScreen.responsiveMinWidth - 1}px) {
          .eq-workflow-split { display: block !important; grid-template-columns: 1fr !important; }
          .eq-workflow-split > * { margin-bottom: 16px; }
        }`}</style>
        <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>{wfCfg && <WorkflowDiagram cfg={wfCfg} />}</div>
        {docsPanel}
      </div>
    );
  }

  return (
    <div style={{ marginTop: '8px' }}>
      {wfCfg && <WorkflowDiagram cfg={wfCfg} />}
      {docsPanel}
    </div>
  );
};

export default EquipmentListWorkflowDocs;
